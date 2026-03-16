# Clairity

> Enhance your prompts on ChatGPT, Claude, and Gemini using
> conversation context and the Lyra optimization framework.

## Install & Use (5 minutes)

**Prerequisites:** Node.js >= 20, npm >= 10, Chrome

**1. Clone and build**
```bash
git clone https://github.com/Jadenw9013/Clairity.git
cd Clairity
npm install
npm run build --workspace=shared
npm run build --workspace=extension
```

**2. Load in Chrome**
1. Go to `chrome://extensions`
2. Enable Developer Mode (top right toggle)
3. Click **Load unpacked** → select `extension/dist/`

**3. Add your API key**
1. Open the Clairity popup in Chrome
2. Enter your Anthropic API key (starts with `sk-ant-`)
3. Click **Save** — the enhance button unlocks

Get a free key at [console.anthropic.com](https://console.anthropic.com).
Costs fractions of a cent per use.

**To update after a `git pull`:**
```bash
npm run build --workspace=shared
npm run build --workspace=extension
```
Then hit the **refresh icon** on the extension in `chrome://extensions`.

No `.env` setup required. The backend runs on a hosted server. Just build, load, and add your key.

---

Production-grade Chrome extension that rewrites prompts into optimized
structured prompts for better LLM outputs.


## Architecture

```
┌─────────────┐     HTTPS      ┌─────────────┐      ┌──────────────┐
│  Extension   │ ──────────────→│  Backend API │─────→│ LLM Provider │
│  (MV3)       │←──────────────│  (/v1)       │←─────│ (OpenAI etc) │
└─────────────┘    JSON         └─────────────┘      └──────────────┘
```

**Security rule:** The extension never holds LLM provider API keys.
All LLM calls are mediated through the backend.

## Quick Start

### Prerequisites

- Node.js >= 20
- npm >= 10
- Chrome (for extension loading)

### Install

```bash
git clone <repo-url> && cd Clairity
npm install
```

### Run Backend (dev)

```bash
cp backend/.env.example backend/.env    # Add your LLM_API_KEY
npm run dev --workspace=backend
```

### Build Extension

```bash
npm run build --workspace=extension
```

Then load `extension/dist/` as an unpacked extension in `chrome://extensions`.

### Run Tests

```bash
npm test
```

## Project Structure

```
extension/   Chrome extension (Manifest V3, TypeScript)
backend/     API server (Node.js, TypeScript)
shared/      Shared types and utilities
docs/        Architecture, security, workflow docs
specs/       API contracts, system specifications
agents/      AI agent instruction files
```

## Documentation

- [Architecture](docs/architecture.md) — system design and data flow
- [Security](docs/security.md) — threat model and mitigations
- [Workflow](docs/workflow.md) — development conventions

## Specifications

- [API Contract](specs/api-contract.md) — endpoint schemas
- [Adapter System](specs/adapter-system.md) — site integration pattern
- [Rewrite Engine](specs/rewrite-engine.md) — prompt rewrite pipeline
- [Auth System](specs/auth-system.md) — authentication design

## Agent Instructions

See `agents/` directory for role-specific AI agent prompts:
`backend-agent`, `extension-agent`, `security-agent`,
`testing-agent`, `release-agent`.

## Constraints

- TypeScript strict mode everywhere
- No `.md` file exceeds 150 lines
- Minimal Chrome permissions (no `<all_urls>`)
- Versioned API routes (`/v1/`)
- Structured logging, input validation, rate limiting
- Adapter pattern for all site integrations

## License

Proprietary. All rights reserved.
