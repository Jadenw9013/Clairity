# Rewrite Engine Specification

## Purpose

The rewrite engine transforms user prompts into optimized, structured
prompts that produce better LLM outputs. It runs server-side and
orchestrates the LLM call that performs the actual rewriting.

## Rewrite Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `enhance` | Improve clarity, add structure, keep length similar | Default; quick improvement |
| `restructure` | Reorganize into structured format with sections | Complex/multi-part prompts |
| `expand` | Add context, constraints, and output format specs | Brief prompts needing detail |

## Pipeline

```
User Prompt
  → Input Sanitization
  → Mode Selection
  → System Prompt Construction
  → LLM Call
  → Output Validation
  → Response Formatting
```

### Step 1: Input Sanitization

- Trim whitespace.
- Reject if empty or exceeds 10,000 characters.
- Strip control characters except newlines.
- Detect language (pass-through; do not translate).

### Step 2: Mode Selection

- Use mode from request if provided.
- If not provided, auto-detect based on prompt characteristics:
  - Short (< 100 chars) → `expand`
  - Medium, unstructured → `enhance`
  - Long, multi-topic → `restructure`

### Step 3: System Prompt Construction

The system prompt instructs the LLM on how to rewrite. It varies by mode.

**Template variables:**
- `{mode}` — selected rewrite mode
- `{language}` — detected/specified language
- `{preserve_intent}` — boolean flag
- `{max_length}` — optional length constraint

**System prompt principles:**
- Preserve the user's original intent.
- Add structure (headers, lists, constraints) where beneficial.
- Include explicit output format instructions when appropriate.
- Do not add information the user didn't imply.
- Maintain the user's tone and formality level.

### Step 4: LLM Call

```typescript
interface LLMCallConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  system_prompt: string;
  user_prompt: string;
  max_tokens: number;
  temperature: number;  // Low (0.3-0.5) for consistent rewrites
}
```

The engine calls the LLM provider adapter (see below) and awaits
the response. Timeout: 30 seconds.

### Step 5: Output Validation

- Verify response is non-empty.
- Verify response length is within acceptable bounds.
- Verify response language matches input language.
- If validation fails, return original prompt with error metadata.

### Step 6: Response Formatting

```typescript
interface RewriteResult {
  enhanced_prompt: string;
  metadata: {
    model_used: string;
    tokens_used: { input: number; output: number };
    rewrite_mode: string;
    processing_time_ms: number;
  };
}
```

## LLM Provider Adapter

```typescript
interface LLMProvider {
  readonly id: string;
  readonly name: string;
  call(config: LLMCallConfig): Promise<LLMResponse>;
}

interface LLMResponse {
  content: string;
  tokens: { input: number; output: number };
  model: string;
}
```

Provider adapters handle API-specific serialization:
- **OpenAI:** maps to Chat Completions API format.
- **Anthropic:** maps to Messages API format.

## Error Handling

| Error | Behavior |
|-------|----------|
| LLM timeout (>30s) | Return 502 PROVIDER_ERROR |
| LLM rate limited | Return 502 with Retry-After hint |
| LLM returned empty | Return 502 PROVIDER_ERROR |
| Invalid rewrite mode | Return 400 VALIDATION_ERROR |
| Prompt too long | Return 400 VALIDATION_ERROR |

## Caching Strategy (future)

- Cache key: SHA-256 of `(prompt + mode + options)`.
- TTL: 1 hour.
- Cache layer sits between validation and LLM call.
- Not implemented in Milestone 1.

## Metrics

Track per rewrite:
- Processing time (total and LLM call).
- Token usage (input + output).
- Mode distribution.
- Error rate by type.
