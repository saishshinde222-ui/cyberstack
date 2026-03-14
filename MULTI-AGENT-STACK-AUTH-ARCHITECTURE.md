# Multi-Agent Orchestration with Stack Auth as the Core

**Idea:** Build a multi-agent orchestration platform where **Stack Auth is the only identity and access system**—no separate auth service, no API keys for “dashboard access,” no custom user store. Every user, team, and permission flows through Stack Auth.

---

## 1. Principle: Stack Auth Is Not an Add-on

| Add-on pattern (avoid) | Core pattern (use) |
|------------------------|---------------------|
| “We use Stack Auth for login” | Stack Auth **is** the only way to identify users and authorize actions |
| Separate “workspace” or “team” table | **Stack Auth Organizations** = workspaces/teams; membership and invites via Stack |
| Custom roles in your DB | **Stack Auth RBAC** = who can create/run/manage agents; no duplicate role store |
| Your own JWT or API keys for app access | **Stack-issued JWTs** for every request; backend validates only Stack tokens |
| Custom profile/settings pages | **Stack account settings** for profile, email, 2FA, linked accounts |
| Your own “support login” | **Stack Impersonation** to debug as a user |
| Custom webhooks for “user joined” | **Stack Webhooks** (e.g. `user.created`, `organization.member_added`) drive provisioning |

---

## 2. How Each Stack Auth Feature Is Used

### Identity (only source of truth)

- **Sign-in / Sign-up** – Only way to get into the product. Password, magic link, OAuth, passkeys, 2FA — all configured in Stack dashboard; no custom login UI needed (use StackHandler or headless).
- **User record** – No `users` table for “who is this person.” Stack Auth user ID and profile (display name, email, etc.) are the source. Your DB stores **only** references: `stack_user_id`, `stack_org_id`, and agent/run data.

### Organizations = Agent Workspaces / Teams

- **One Stack Auth Organization per workspace (or team).** Create org in dashboard or via API when user creates a “Workspace.”
- **Invites** – Stack Auth org invites (email). New member joins org → they see that workspace’s agents and runs.
- **SDK:** `useOrganization()`, `useOrganizations()` — list workspaces, current org, members. No custom “workspace membership” table; Stack is source of truth.

### Permissions (RBAC) = Agent Permissions

- **Define in Stack dashboard:** e.g. `agent:create`, `agent:run`, `agent:view`, `workspace:admin`, `billing:manage`.
- **Assign to org roles:** e.g. “Member” gets `agent:run`, `agent:view`; “Admin” gets all.
- **In app:** `usePermission("agent:create")` to show/hide “New agent” button; in API/agent runner, validate permission server-side with Stack (token or server SDK) before creating/running agents.
- **No custom role table** — roles and permissions live only in Stack Auth.

### Sessions / Tokens (only way to call your backend)

- **Frontend** – Stack session (cookie/JWT). All API calls send Stack session or token.
- **Backend / Agent runner** – Validate Stack JWT on every request; extract `userId`, `orgId` (if org-scoped), and permissions. Reject requests without valid Stack token. No “API key for dashboard” for end users; optional server-to-server keys only for internal services if needed.

### Account settings / Security

- **Profile, email, password, 2FA, passkeys, linked accounts** — all via Stack (account settings page or headless). You don’t build or host these.

### Webhooks (provisioning and automation)

- **`user.created`** – e.g. create a default “Personal” workspace (Stack org) and assign user as owner.
- **`organization.member_added`** – e.g. grant default role/permissions for that org, or send internal notification.
- **Custom events** – if you emit events from your backend, you can still use Stack webhooks for auth-related events so one system handles “who exists” and “who belongs where.”

### Impersonation

- **Support/debug** – Use Stack impersonation in dashboard to “sign in as user.” Then use your app normally; agent runs and workspace data are in that user’s context. No custom “support override” logic.

### SSO (optional)

- **Enterprise** – If you offer SSO, it’s Stack Auth SSO. Same identity for the orchestration platform; no second IdP.

---

## 3. Data Model (Auth-Oblivious Storage)

Your DB does **not** duplicate identity or membership. It only stores:

- **Agents** – `id`, `stack_org_id` (workspace), `stack_created_by_user_id`, `name`, `config`, `created_at`, etc.
- **Runs** – `id`, `agent_id`, `stack_user_id`, `stack_org_id`, `input`, `output`, `status`, `started_at`, etc.
- **Optional:** Org-level settings (e.g. default model, webhook URL) keyed by `stack_org_id`.

**Access control:**

- “Can user X see agent A?” → A’s `stack_org_id` must be an org X belongs to (from Stack), and X must have `agent:view` in that org (from Stack).
- “Can user X run agent A?” → Same org check + `agent:run` permission from Stack.

You never store passwords, roles, or “workspace members” — you only store references and enforce access using Stack’s token and server-side permission checks.

---

## 4. Request Flow (High Level)

1. **User** signs in (Stack only) → gets Stack session.
2. **Frontend** loads workspace (current org from `useOrganization()`), lists agents (API filtered by `stack_org_id` from token).
3. **User** clicks “Run agent” → frontend calls your API with Stack session (cookie or Bearer).
4. **API** validates Stack JWT, reads `userId`, `orgId`, checks permission `agent:run` (via Stack server SDK or token claims), loads agent by `agent_id` and checks `agent.stack_org_id === orgId`, then enqueues or runs the agent. Run record stores `stack_user_id`, `stack_org_id`.
5. **Agent runner** (same or another service) receives job with `stack_user_id` / `stack_org_id`; no separate “run as” identity — everything is tied to Stack identity.

---

## 5. Multi-Agent Orchestration Layer (On Top of Stack Auth)

- **Orchestrator** – Your code that composes multiple agents (tasks, DAG, or sequential). It runs in the context of the authenticated user and org; all permissions and tenant isolation come from Stack.
- **Agents** – Each agent is a capability (e.g. “researcher,” “writer,” “coder”). They are created and run only within a Stack Auth organization; visibility and run history are scoped by org and permission.
- **Runs** – Stored with `stack_user_id` and `stack_org_id`; displayed in UI only if user has access to that org and `agent:view` (and optionally `agent:run` for re-runs).

No “agent-specific” auth: the only identity is Stack. The orchestration layer is **purely** business logic and execution; auth and tenant boundaries are 100% Stack Auth.

---

## 6. Summary

- **Single source of truth:** Stack Auth for users, orgs, roles, permissions, sessions.
- **Your storage:** Only agent definitions, runs, and org-scoped settings keyed by Stack user/org IDs.
- **Your backend:** Validates Stack JWTs and uses Stack for permission checks; no custom auth or API keys for end users.
- **Result:** Multi-agent orchestration where Stack Auth is completely used instead of an add-on — identity and access are fully delegated to Stack; the rest is orchestration and data.
