
/**
 * Shared AI client — single source of truth for:
 * - extractAIContent (OpenAI JSON unwrapping)
 * - callFreeAI (with retry + exponential backoff)
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

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= AI_CONFIG.retry.maxRetries; attempt++) {
        if (attempt > 0) {
            const delay = AI_CONFIG.retry.baseDelayMs * Math.pow(2, attempt - 1);
            await sleep(delay);
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.retry.timeoutMs);

            const response = await fetch(AI_CONFIG.pollinationsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'openai',
                    messages,
                    temperature: 0.2,
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const err = new AIRequestError(
                    `AI request failed: ${response.status} ${response.statusText}`,
                    response.status
                );
                if (!err.retryable) throw err; // 4xx (not 429) → don't retry
                lastError = err;
                continue;
            }

            const raw = await response.text();
            const content = extractAIContent(raw);

            // Cache the result
            if (useCache) {
                const cacheKey = queryCache.makeKey(messages);
                queryCache.set(cacheKey, content);
            }

            return content;
        } catch (error) {
            if (error instanceof AIRequestError && !error.retryable) throw error;
            lastError = error instanceof Error ? error : new Error(String(error));
            // AbortError from timeout → retryable
            continue;
        }
    }

    throw new AIRequestError(
        `AI request failed after ${AI_CONFIG.retry.maxRetries + 1} attempts: ${lastError?.message}`,
        null
    );
};
