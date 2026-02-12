
/**
 * Shared AI client — single source of truth for:
 * - extractAIContent (OpenAI JSON unwrapping)
 * - callFreeAI (multi-endpoint with retry + exponential backoff)
 * - QueryCache (in-memory LRU cache for identical queries)
 */

import { AI_CONFIG } from '../config';

// ---- Response unwrapping ----

export const extractAIContent = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('{')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed.choices?.[0]?.message?.content) {
                return parsed.choices[0].message.content;
            }
            if (typeof parsed.content === 'string') return parsed.content;
            if (typeof parsed.text === 'string') return parsed.text;
        } catch { /* not JSON wrapper, return as-is */ }
    }
    return trimmed;
};

// ---- In-memory query cache ----

export class QueryCache {
    private cache = new Map<string, { value: string; timestamp: number }>();
    private maxSize: number;
    private ttlMs: number;

    constructor(maxSize = AI_CONFIG.cache.maxSize, ttlMs = AI_CONFIG.cache.ttlMs) {
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
    }

    get(key: string): string | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            return null;
        }
        return entry.value;
    }

    set(key: string, value: string): void {
        // Evict oldest if at capacity
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) this.cache.delete(oldestKey);
        }
        this.cache.set(key, { value, timestamp: Date.now() });
    }

    makeKey(messages: { role: string; content: string }[]): string {
        return messages.map(m => `${m.role}:${m.content}`).join('|');
    }
}

// Shared singleton cache
export const queryCache = new QueryCache();

// ---- Retry with exponential backoff ----

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export type AIMessage = { role: 'system' | 'user'; content: string };

export class AIRequestError extends Error {
    public readonly status: number | null;
    public readonly retryable: boolean;

    constructor(message: string, status: number | null = null) {
        super(message);
        this.name = 'AIRequestError';
        this.status = status;
        // 429 = rate limit, 5xx = server errors → retryable
        this.retryable = status === null || status === 429 || status >= 500;
    }
}

/**
 * Try a single fetch to a POST endpoint with the given model.
 * Returns the extracted text content on success, or throws.
 */
const tryPostEndpoint = async (
    url: string,
    model: string,
    messages: AIMessage[],
    signal: AbortSignal
): Promise<string> => {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
        },
        body: JSON.stringify({
            model,
            messages,
            temperature: 0.2,
            jsonMode: true,
        }),
        signal,
    });

    if (!response.ok) {
        throw new AIRequestError(
            `${response.status} ${response.statusText}`,
            response.status
        );
    }

    const raw = await response.text();
    const content = extractAIContent(raw);
    if (!content) throw new AIRequestError('Empty response from AI', null);
    return content;
};

/**
 * Last-resort GET-based fallback using text.pollinations.ai/{prompt}.
 * Combines all messages into a single prompt string.
 */
const tryGetFallback = async (
    messages: AIMessage[],
    signal: AbortSignal
): Promise<string> => {
    // Build a single prompt from the messages
    const combined = messages
        .map(m => m.role === 'system' ? `[System]: ${m.content}` : m.content)
        .join('\n\n');

    const encoded = encodeURIComponent(combined);
    const url = `${AI_CONFIG.textFallbackUrl}${encoded}?model=mistral&json=true`;

    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'text/plain, application/json, */*' },
        signal,
    });

    if (!response.ok) {
        throw new AIRequestError(
            `GET fallback failed: ${response.status} ${response.statusText}`,
            response.status
        );
    }

    const raw = await response.text();
    const content = extractAIContent(raw);
    if (!content) throw new AIRequestError('Empty response from GET fallback', null);
    return content;
};

export const callFreeAI = async (
    messages: AIMessage[],
    useCache = true
): Promise<string> => {
    // Check cache first
    if (useCache) {
        const cacheKey = queryCache.makeKey(messages);
        const cached = queryCache.get(cacheKey);
        if (cached !== null) return cached;
    }

    const errors: string[] = [];

    // Try each configured endpoint with its model list
    for (const endpoint of AI_CONFIG.endpoints) {
        for (const model of endpoint.models) {
            for (let attempt = 0; attempt <= AI_CONFIG.retry.maxRetries; attempt++) {
                if (attempt > 0) {
                    const delay = AI_CONFIG.retry.baseDelayMs * Math.pow(2, attempt - 1);
                    await sleep(delay);
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(
                    () => controller.abort(),
                    AI_CONFIG.retry.timeoutMs
                );

                try {
                    const content = await tryPostEndpoint(
                        endpoint.url, model, messages, controller.signal
                    );
                    clearTimeout(timeoutId);

                    // Cache the result
                    if (useCache) {
                        const cacheKey = queryCache.makeKey(messages);
                        queryCache.set(cacheKey, content);
                    }

                    return content;
                } catch (error) {
                    clearTimeout(timeoutId);
                    const err = error instanceof AIRequestError ? error : (
                        error instanceof Error ? new AIRequestError(error.message) : new AIRequestError(String(error))
                    );

                    // Non-retryable 4xx (except 429) → skip to next model
                    if (!err.retryable) {
                        errors.push(`${endpoint.url} [${model}]: ${err.message}`);
                        break;
                    }

                    errors.push(`${endpoint.url} [${model}] attempt ${attempt + 1}: ${err.message}`);
                    // On last retry for this model, move to next
                    if (attempt === AI_CONFIG.retry.maxRetries) break;
                }
            }
        }
    }

    // Last resort: simple GET-based text endpoint
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.retry.timeoutMs);
        const content = await tryGetFallback(messages, controller.signal);
        clearTimeout(timeoutId);

        if (useCache) {
            const cacheKey = queryCache.makeKey(messages);
            queryCache.set(cacheKey, content);
        }

        return content;
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`GET fallback: ${msg}`);
    }

    throw new AIRequestError(
        `All AI endpoints failed:\n${errors.join('\n')}`,
        null
    );
};
