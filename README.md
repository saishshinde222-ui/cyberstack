# CyberStack — Security Audit Feed for GitHub Repos

Security audit feed for GitHub repositories. Scan for secrets, vulnerable dependencies, code issues, and misconfigurations. Every scan is tied to a real user and workspace via Stack Auth — full audit trail, MCP-queryable.

## Features

- **4 security scanners:** Secret Scanner, Dependency Checker, Code Reviewer (MFA-gated), Config Auditor
- **Findings feed:** Aggregated by severity with in-place fix suggestions (Copy fix or Create PR)
- **Integrations:** Add your GitHub OAuth app (Client ID/Secret) for write access and Create PR
- **MCP server:** Query scan history from Claude — "Who scanned vercel/next.js this week?"
- **Stack Auth:** Sign-in, workspaces, MFA, webhooks, impersonation, API keys

## Get it running

```bash
npm install
cp .env.local.example .env.local
# Add your keys from app.stack-auth.com → your project → API keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Env

Create `.env.local`:

```
NEXT_PUBLIC_STACK_PROJECT_ID=...
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=...
STACK_SECRET_SERVER_KEY=...
```

From [app.stack-auth.com](https://app.stack-auth.com) → your project → API keys.

**Optional:** `NEXT_PUBLIC_APP_URL` — set for production or if using ngrok/tunnel (used for GitHub OAuth callback URL).

## GitHub OAuth (Integrations tab)

For Create PR on findings, add your own GitHub OAuth app:

1. GitHub → Settings → Developer settings → OAuth Apps → New
2. Set **Authorization callback URL** to `http://localhost:3000/api/github/oauth/callback` (or your app URL + `/api/github/oauth/callback`)
3. Dashboard → **Integrations** → enter Client ID & Client Secret → Save → Connect GitHub

## What's in the repo

| Path | Purpose |
|------|---------|
| `app/page.tsx` | Landing |
| `app/dashboard/page.tsx` | Control Room, Findings, Integrations, MCP, etc. |
| `app/api/scan/route.ts` | Run security scanners |
| `app/api/github/fix/route.ts` | Create branch/PR for findings |
| `app/api/integrations/github/route.ts` | Store GitHub OAuth credentials |
| `app/api/mcp/route.ts` | MCP server for Claude |
| `app/lib/scan-engine.ts` | Scan rules and patterns |
| `app/lib/fix-suggestions.ts` | Fix suggestions per rule |
| `stack.config.ts` | Stack Auth config |

## MCP (Claude Desktop)

Add to your Claude config:

```json
{
  "mcpServers": {
    "cyberstack": { "url": "http://localhost:3000/api/mcp" }
  }
}
```

Ask: "Who ran security scans on vercel/next.js?"
