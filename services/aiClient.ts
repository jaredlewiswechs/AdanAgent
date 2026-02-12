
/**
 * Shared AI client — single source of truth for:
 * - extractAIContent (OpenAI JSON unwrapping)
 * - callFreeAI (Puter.js primary → Pollinations fallback)
 * - QueryCache (in-memory LRU cache for identical queries)
 */

import { AI_CONFIG } from '../config';

// ---- Puter.js global type declaration ----

declare global {
    interface Window {
        puter?: {
            ai: {
                chat(
                    prompt: string | Array<{ role: string; content: string }>,
                    options?: { model?: string; stream?: boolean }
                ): Promise<{
                    message: {
                        // OpenAI models return string; Claude models return array
                        content: string | Array<{ text: string }>;
                    };
                }>;
            };
        };
    }
}

// ---- Response unwrapping ----

const extractTextFromUnknown = (value: unknown): string => {
    if (typeof value === 'string') return value;

    if (Array.isArray(value)) {
        const parts = value
            .map(item => {
                if (typeof item === 'string') return item;
                if (item && typeof item === 'object') {
                    const textCandidate = (item as { text?: unknown; content?: unknown }).text
                        ?? (item as { text?: unknown; content?: unknown }).content;
                    return extractTextFromUnknown(textCandidate);
                }
                return '';
            })
            .filter(Boolean);
        return parts.join('\n').trim();
    }

    if (value && typeof value === 'object') {
        const candidate = value as {
            text?: unknown;
            content?: unknown;
            message?: { content?: unknown; text?: unknown };
            choices?: Array<{ message?: { content?: unknown; text?: unknown }; text?: unknown }>;
        };

        if (candidate.choices?.[0]) {
            const choice = candidate.choices[0];
            return extractTextFromUnknown(choice.message?.content ?? choice.message?.text ?? choice.text);
        }

        return extractTextFromUnknown(candidate.message?.content ?? candidate.message?.text ?? candidate.content ?? candidate.text);
    }

    return '';
};

export const extractAIContent = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            const extracted = extractTextFromUnknown(parsed).trim();
            if (extracted) return extracted;
        } catch {
            // Not JSON wrapper, return as-is.
        }
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

// ---- Puter.js AI provider ----

/**
 * Try calling the Puter.js SDK which provides free AI without API keys.
 * Tries each configured model in order.
 */
const tryPuterAI = async (messages: AIMessage[]): Promise<string> => {
    if (!AI_CONFIG.puter.enabled || !window.puter?.ai) {
        throw new AIRequestError('Puter.js SDK not available', null);
    }

    const formattedMessages = messages.map(m => ({
        role: m.role,
        content: m.content
    }));

    for (const model of AI_CONFIG.puter.models) {
        try {
            const result = await Promise.race([
                window.puter.ai.chat(formattedMessages, { model }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Puter timeout')), AI_CONFIG.puter.timeoutMs)
                )
            ]);

            const raw = result?.message?.content;
            // Claude models return content as [{text: "..."}], others return a string
            let content: string | undefined;
            if (typeof raw === 'string') {
                content = raw;
            } else if (Array.isArray(raw) && raw.length > 0 && typeof raw[0]?.text === 'string') {
                content = raw[0].text;
            }

            if (content && content.trim()) {
                return content.trim();
            }
            // Empty response — try next model
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.warn(`Puter [${model}] failed: ${msg}`);
            // Try next model
        }
    }

    throw new AIRequestError('All Puter.js models failed', null);
};

// ---- Pollinations fallback providers ----

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
 * Last-resort GET-based fallback using gen.pollinations.ai/text/{prompt}.
 * Combines all messages into a single prompt string.
 */
const tryGetFallback = async (
    messages: AIMessage[],
    signal: AbortSignal
): Promise<string> => {
    // Build a single prompt from the messages, using only the last user
    // message when the full prompt would exceed safe URL length limits.
    const MAX_PROMPT_CHARS = 1200;
    let combined = messages
        .map(m => m.role === 'system' ? `[System]: ${m.content}` : m.content)
        .join('\n\n');

    if (combined.length > MAX_PROMPT_CHARS) {
        // Fall back to just the last user message to stay within URL limits
        const lastUser = [...messages].reverse().find(m => m.role === 'user');
        combined = lastUser ? lastUser.content.slice(0, MAX_PROMPT_CHARS) : combined.slice(0, MAX_PROMPT_CHARS);
    }

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

/**
 * Additional GET-based fallback using text.pollinations.ai/{prompt}
 * via the Vite proxy (/api/ai/text-pollinations/).
 * Used as a last-ditch attempt when all other providers fail.
 */
const tryLegacyGetFallback = async (
    messages: AIMessage[],
    signal: AbortSignal
): Promise<string> => {
    const MAX_PROMPT_CHARS = 1200;
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    const prompt = lastUser
        ? lastUser.content.slice(0, MAX_PROMPT_CHARS)
        : messages.map(m => m.content).join(' ').slice(0, MAX_PROMPT_CHARS);

    const encoded = encodeURIComponent(prompt);
    // Try proxied path first, fall back to direct URL
    const urls = [
        `/api/ai/text-pollinations/${encoded}?model=openai&json=true`,
        `https://text.pollinations.ai/${encoded}?model=openai&json=true`,
    ];

    for (const url of urls) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'text/plain, application/json, */*' },
                signal,
            });

            if (!response.ok) {
                throw new AIRequestError(
                    `Legacy GET fallback failed: ${response.status} ${response.statusText}`,
                    response.status
                );
            }

            const raw = await response.text();
            const content = extractAIContent(raw);
            if (!content) throw new AIRequestError('Empty response from legacy GET fallback', null);
            return content;
        } catch (error) {
            if (url === urls[urls.length - 1]) throw error;
            // Try next URL
        }
    }

    throw new AIRequestError('All legacy GET fallback URLs failed', null);
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

    // PRIMARY: Try Puter.js (free, no API key)
    try {
        const content = await tryPuterAI(messages);

        if (useCache) {
            const cacheKey = queryCache.makeKey(messages);
            queryCache.set(cacheKey, content);
        }

        return content;
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Puter.js: ${msg}`);
        console.warn('Puter.js unavailable, falling back to Pollinations endpoints.', msg);
    }

    // FALLBACK: Try proxied endpoints first, then direct endpoints.
    // Proxied endpoints go through the Vite dev server to bypass
    // browser CORS restrictions and corporate proxy/firewall blocks.
    const allEndpoints = [
        ...AI_CONFIG.endpoints.map(e => ({ ...e, label: 'proxied' })),
        ...AI_CONFIG.directEndpoints.map(e => ({ ...e, label: 'direct' })),
    ];

    for (const endpoint of allEndpoints) {
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
                        errors.push(`${endpoint.url} (${endpoint.label}) [${model}]: ${err.message}`);
                        break;
                    }

                    errors.push(`${endpoint.url} (${endpoint.label}) [${model}] attempt ${attempt + 1}: ${err.message}`);
                    // On last retry for this model, move to next
                    if (attempt === AI_CONFIG.retry.maxRetries) break;
                }
            }
        }
    }

    // Last resort: GET-based text endpoints with retry
    const getFallbacks = [
        { name: 'GET fallback', fn: tryGetFallback },
        { name: 'Legacy GET fallback', fn: tryLegacyGetFallback },
    ];

    for (const { name, fn } of getFallbacks) {
        for (let attempt = 0; attempt <= 1; attempt++) {
            if (attempt > 0) await sleep(AI_CONFIG.retry.baseDelayMs);
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.retry.timeoutMs);
                const content = await fn(messages, controller.signal);
                clearTimeout(timeoutId);

                if (useCache) {
                    const cacheKey = queryCache.makeKey(messages);
                    queryCache.set(cacheKey, content);
                }

                return content;
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                errors.push(`${name} attempt ${attempt + 1}: ${msg}`);
            }
        }
    }

    throw new AIRequestError(
        `All AI endpoints failed:\n${errors.join('\n')}`,
        null
    );
};
