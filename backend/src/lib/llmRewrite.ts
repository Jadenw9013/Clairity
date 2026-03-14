// backend/src/lib/llmRewrite.ts
// Optional LLM rewrite adapter — only used when REWRITE_LLM_ENABLED=true + LLM_API_KEY set.
// Falls back to null if unavailable, caller MUST use deterministic fallback.

import { REWRITE_LLM_ENABLED, LLM_API_KEY } from "./featureFlags.js";

export interface LlmRewriteResult {
    enhanced_prompt: string;
    model_used: string;
}

/**
 * Attempt an LLM-based rewrite. Returns null if disabled, unconfigured, or fails.
 * Caller MUST fall back to deterministic pipeline on null.
 */
export async function llmRewrite(
    prompt: string,
    intent: string,
    mode: string
): Promise<LlmRewriteResult | null> {
    if (!REWRITE_LLM_ENABLED || !LLM_API_KEY) {
        return null;
    }

    try {
        // Stub: OpenAI-compatible API call
        // Replace with real provider when ready
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LLM_API_KEY}`,
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are a prompt engineering expert. Rewrite the user's prompt to be clearer, more specific, and better structured for an AI assistant. Mode: ${mode}. Detected intent: ${intent}. Return ONLY the improved prompt text, no explanation.`,
                    },
                    { role: "user", content: prompt },
                ],
                max_tokens: 2000,
                temperature: 0.3,
            }),
        });

        if (!res.ok) return null;

        const data = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
            model?: string;
        };

        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content) return null;

        return {
            enhanced_prompt: content,
            model_used: data.model ?? "gpt-4o-mini",
        };
    } catch {
        // LLM failure is non-fatal — caller will use deterministic fallback
        return null;
    }
}
