# ContextCore — MCS ↔ Clairity Integration Contract

> Backend-to-backend HTTP integration. Local-only. Repos remain separate.

## Architecture Boundary

```
Clairity Extension (browser)
  → Clairity Backend (localhost:3001)
    → MCS Daemon (localhost:4040)  GET /pack
  ← Clairity Rewrite Engine
← Extension UI
```

**The extension MUST NOT call MCS directly.**

---

## Ports

| Service          | Default Port | Notes |
|------------------|-------------|-------|
| Clairity Backend | 3001        | Express, session-based auth |
| MCS Daemon       | 4040        | `ctx-daemon`, context packing |
| MCS Cloud        | 4041        | `ctx-cloud` — do NOT use for context |

---

## Environment Variables (Clairity Backend)

| Variable | Default | Description |
|----------|---------|-------------|
| `MCS_ENABLED` | `false` | Kill switch — must be `true` to call MCS |
| `MCS_BASE_URL` | `http://localhost:4040` | MCS daemon base URL |
| `MCS_CONTEXT_MODE` | `auto` | `off` / `auto` / `pinned` |
| `MCS_TIMEOUT_MS` | `2000` | HTTP request timeout |
| `MCS_MAX_ITEMS` | `10` | Max graph nodes to extract |
| `MCS_MAX_CONTEXT_TOKENS` | `4000` | Max chars to inject into prompt |
| `MCS_PINNED_CATEGORIES` | _(empty)_ | Comma-separated (pinned mode only) |

All values logged at startup via the `Feature flags` log line.

---

## MCS Endpoint Contract

### Request

```
GET http://localhost:4040/pack?target=<target>&task=<text>&budget=<n>&format=json
```

| Param | Required | Values | Notes |
|-------|----------|--------|-------|
| `target` | Yes | `claude` / `gpt` / `gemini` | Mapped from Clairity `context.site` (`chatgpt` → `gpt`) |
| `task` | Yes | Prompt text (≤200 chars) | Used for relevance ranking |
| `budget` | No | Integer ≥ 100 | Token budget for pack (default: 4000) |
| `format` | No | `json` / `toon` | Always `json` from Clairity |

### Response (ContextPack)

```json
{
  "version": "1.0",
  "target": "claude",
  "task": "...",
  "graph": {
    "nodes": [
      {
        "id": "task-...",
        "type": "Task",
        "label": "Short description",
        "content": "Full context text",
        "provenance": { "truthTier": "CONFIRMED", "derivedFromEventIds": [...] }
      }
    ],
    "edges": [...],
    "stats": { "totalNodes": 50, "totalEdges": 51 }
  },
  "meta": {
    "selectedNodes": 13,
    "droppedNodes": 37,
    "budgetRespected": true,
    "finalTokenEstimate": 3926
  }
}
```

### Normalized Clairity Shape

Clairity extracts `graph.nodes[]` → `McsContextItem[]`:

```typescript
interface McsContextItem {
  content: string;      // node.content || node.label
  label?: string;       // node.label
  nodeType?: string;    // "Task" | "Decision" | "Artifact" | ...
  truthTier?: string;   // "VERIFIED" | "CONFIRMED" | "EXTRACTED" | "RAW"
}
```

Items are joined with `\n\n---\n\n` separator, capped to `MCS_MAX_CONTEXT_TOKENS`.

---

## Fallback Behavior

| Scenario | `metadata.mcs_context` | Rewrite |
|----------|----------------------|---------|
| `MCS_ENABLED=false` | `{ status: "disabled" }` | Normal |
| `contextMode=off` | `{ status: "skipped", reason: "contextMode=off" }` | Normal |
| Daemon not running | `{ status: "fallback", reason: "no_data" }` | Normal |
| Request times out | `{ status: "fallback", reason: "no_data" }` | Normal |
| Pack has 0 nodes | `{ status: "fallback", reason: "no_data" }` | Normal |
| Pack returns nodes | `{ status: "enriched", source: "mcs-daemon", item_count: N }` | Enriched |

**Rewrite always succeeds.** MCS is strictly additive.

---

## Logging

All MCS-related logs include structured fields:

| Event | Level | Message | Key Fields |
|-------|-------|---------|------------|
| Startup | info | `Feature flags` | All MCS env values |
| HTTP call | info | `MCS → calling` | `url`, `timeoutMs` |
| HTTP response | info | `MCS ← response` | `url`, `status` |
| Context lookup | info | `MCS context lookup` | `target`, `mode`, `task`, `maxItems` |
| Success | info | `MCS context fetched successfully` | `itemCount`, `snippetLength`, `truncated` |
| Timeout | warn | `MCS request timed out — fallback...` | `url`, `timeoutMs` |
| Conn refused | warn | `MCS daemon not reachable...` | `url` |
| Empty pack | info | `MCS pack returned 0 nodes — fallback...` | `target` |
| Disabled | debug | `MCS context skipped (MCS_ENABLED=false)` | — |

---

## Local Development Workflow

### 1. Start MCS daemon

```bash
cd C:\Dev\ContextCore\master-context
npm install    # fixes workspace symlinks
npm run build
npm run dev:daemon
# → MCS daemon → http://localhost:4040
```

### 2. Verify MCS is healthy

```bash
curl http://localhost:4040/health
# → {"status":"ok","timestamp":"..."}
```

### 3. Start Clairity backend with MCS

Edit `Clairity/backend/.env`:
```env
MCS_ENABLED=true
MCS_CONTEXT_MODE=auto
```

```bash
cd C:\Dev\ContextCore\Clairity\backend
node --env-file=.env --import tsx src/server.ts
```

### 4. Verify E2E

```powershell
# Get session
$s = Invoke-RestMethod -Method POST -Uri http://localhost:3001/v1/session

# Rewrite with MCS context
$body = '{"prompt":"test","context":{"site":"claude"},"mcs":{"contextMode":"auto"}}'
$r = Invoke-RestMethod -Method POST -Uri http://localhost:3001/v1/rewrite `
  -Headers @{Authorization="Bearer $($s.token)";"Content-Type"="application/json"} `
  -Body $body

# Check MCS context status
$r.metadata.mcs_context
```

---

## Scope Parameters (Optional)

Routes accept an optional `mcs` field in the request body:

```json
{
  "mcs": {
    "contextMode": "auto",
    "workspaceId": "my-project",
    "projectId": "sub-module",
    "conversationId": "conv-123",
    "sourceApp": "clairity-extension",
    "pinnedCategories": ["coding"]
  }
}
```

---

## Code Locations

| What | File |
|------|------|
| MCS client | `Clairity/backend/src/lib/mcsClient.ts` |
| Feature flags | `Clairity/backend/src/lib/featureFlags.ts` |
| Rewrite route | `Clairity/backend/src/routes/v1/rewrite.ts` |
| Improve route | `Clairity/backend/src/routes/v1/improve.ts` |
| MCS client tests | `Clairity/backend/tests/mcsClient.test.ts` |
| MCS daemon | `master-context/packages/ctx-daemon/src/server.ts` |
| Pack builder | `master-context/packages/ctx-core/src/packBuilder.ts` |
