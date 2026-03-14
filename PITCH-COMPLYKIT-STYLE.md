# Who Ran What — Security Audit Feed for GitHub Repos

**One-liner:** "Who Ran What is the security audit feed for GitHub repos. Connect via Stack Auth OAuth, scan for secrets, vulnerable deps, and code issues. Every scan is attributed to a real user + workspace — full audit trail, MCP-queryable."

---

## Problem Statement

### The Problem

Teams running AI agents and security tooling hit the same wall: **who ran what scan, on which repo, and how do we revoke when someone leaves?**

1. **No audit trail for security scans** — Scans are triggered by shared API keys or local scripts. When a critical finding surfaces, nobody can trace it to a real person or know who has access to which repos.
2. **No real workspaces** — Tools are single-user or use custom "workspace" tables. "Marketing sees only Marketing scans" requires building your own permission system.
3. **GitHub OAuth scattered** — Every tool wants to "connect GitHub" — separate OAuth flows, token storage, refresh logic. No single identity layer.
4. **No revoke or debug** — When someone leaves, you can't turn off their access. Support can't see the app as that user without building impersonation yourself.

### The Gap

| Approach | Problem |
|----------|---------|
| Enterprise security platforms | Identity and audit are add-ons; SSO required; expensive |
| Build your own | Users, workspaces, GitHub OAuth, invites, roles, audit logs — months before shipping |
| CLI/local tools | No "who," no workspace, no audit, no revoke |

### The Solution — Who Ran What

One platform: connect GitHub via Stack Auth OAuth, run security scans (Secret Scanner, Dependency Checker, Code Reviewer, Config Auditor) on your repos. Every scan is attributed to a real user and a real team. Findings feed into a team audit trail. Revoke the user → they disappear. Support can see the app as any user. Ask Claude "who scanned vercel/next.js this week?" via MCP.

---

## Product Flow

1. **Sign in** — Stack Auth (OAuth, magic link, passkeys)
2. **Connect GitHub (optional)** — `linkConnectedAccount("github")` via Stack Auth OAuth. Token stored and refreshed by Stack. Enables private repo access and "My Repos" picker.
3. **Enter repo** — Manual `owner/repo` or select from connected repos
4. **Run security scanners** — Secret Scanner, Dependency Checker, Code Reviewer (MFA required), Config Auditor. Each scan fetches repo via GitHub API (with token if connected), runs pattern-based analysis, returns findings.
5. **View findings** — Feed shows runs with finding summaries. Dedicated Findings tab aggregates by severity.
6. **Compliance report** — One-click report: total scans, findings, MFA status, identity verification
7. **MCP** — Query scan history from Claude: "list_recent_runs", "get_workspace_stats"

---

## Stack Auth Features Used

| Feature | How it's used |
|---------|----------------|
| Sign-in (OAuth, magic link, passkeys) | StackHandler |
| UserButton, SelectedTeamSwitcher | Dashboard header |
| AccountSettings | Profile, 2FA, passkeys |
| Organizations (Teams) | Workspace = Stack org |
| OAuth Connections (GitHub) | `linkConnectedAccount("github")` — token for GitHub API |
| JWT / Sessions | Every `/api/scan` validated server-side |
| MFA gate | Code Reviewer requires 2FA |
| Webhooks | Scan completed → webhook event |
| Impersonation | Stack dashboard — see app as any user |
| M2M API Keys | Create keys for CI/CD scans |
| MCP Server | Query runs via `/api/mcp` |

---

## Security Scanners

| Agent | What it does | Sensitive? |
|-------|--------------|------------|
| Secret Scanner | Regex for AWS keys, API keys, passwords, private keys, GitHub tokens | No |
| Dependency Checker | Parses package.json, checks against known vulnerable versions | No |
| Code Reviewer | Detects eval, innerHTML, SQL concat, dangerouslySetInnerHTML, weak hash | Yes (MFA) |
| Config Auditor | Audits .env, docker-compose, k8s for dev-in-prod, permissive CORS, insecure TLS | No |

---

## Demo Flow

1. Sign in with Google
2. Enter `vercel/next.js` (or any public repo)
3. Run Secret Scanner → see findings (or "No issues found")
4. Run Dependency Checker → check package.json
5. Try Code Reviewer → MFA required modal → enable 2FA → run again
6. Run Full Scan (chain all 4) → sequential results
7. Switch to Findings tab → aggregated by severity
8. Generate Compliance Report
9. Connect GitHub (if configured in dashboard) → see "My Repos"
10. MCP tab → query list_recent_runs

---

## Target Users

- Dev teams that need "who scanned what repo" for compliance
- Security teams that want audit trails without building auth
- Startups that can't build custom GitHub OAuth + workspace systems

## Why This Wins

- **Unique combination** — Security scanning + audit feed + Stack Auth OAuth for GitHub. Not just "we use Stack Auth" — we use it for GitHub repo access.
- **Real scans** — Pattern-based detection (secrets, deps, code, config). Findings are real, not mocked.
- **Full audit** — Every run: userId, orgId, repo, findings. Revoke in Stack → gone.
- **MCP-native** — Ask Claude about your scan history.

---

## Tech Stack

- **Frontend:** Next.js 14, Tailwind, Stack Auth components
- **Auth & identity:** Stack Auth (sign-in, orgs, OAuth connections, MFA, webhooks)
- **Scans:** GitHub API (public or OAuth token) + pattern-based scan engine
- **Storage:** In-memory runs store (extend to DB for production)
