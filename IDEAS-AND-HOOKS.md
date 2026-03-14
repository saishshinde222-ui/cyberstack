# Ideas, product hooks & Stack Auth hooks

Product angles and the exact hooks (and one combo hook) you need for the multi-agent + Stack Auth app.

---

## 1. Product hooks (why this combo is compelling)

| Hook | One-liner |
|------|-----------|
| **“One identity, every agent”** | Users sign in once (Stack). Every agent run, workspace, and team share that same identity. No “log in to the dashboard” vs “API key for the runner” — one session, one story. |
| **“Workspaces that are actually teams”** | A “workspace” is a Stack Auth organization. Invite teammates by email (Stack invites); they instantly see the same agents and runs. No custom invite flow or role sync. |
| **“Permissions, not API keys”** | Who can create/run/delete agents = Stack RBAC. Revoke access in one place (Stack dashboard); no per-app API key rotation. Great for enterprises and compliance. |
| **“Support sees what the user sees”** | Stack impersonation = support signs in as the user and debugs agent runs in their real workspace. No fake “admin view” or export of PII. |
| **“Auth that scales with the graph”** | When you add a new agent type or org role, you add a permission in Stack and gate it in UI + API. The orchestration graph grows; the auth model stays one place. |

---

## 2. Feature ideas (things to build on top)

- **Default workspace on signup** – Stack webhook `user.created` → create a Stack org “Personal” and add user as owner. First login they already have one workspace.
- **“Run as” in the UI** – Show “Run as: [current user]” and “Workspace: [current org]” on every run. Makes it obvious that identity and tenant come from Stack (and support can impersonate to reproduce).
- **Invite-to-workspace = invite-to-org** – “Invite teammate” opens Stack’s org invite (or deep link). When they accept, they get the org’s default role and see the same agents; no custom onboarding.
- **Permission-gated actions** – “New agent” only if `agent:create`; “Run” only if `agent:run`; “Workspace settings” only if `workspace:admin`. Use `usePermission()` so the UI never shows actions the user can’t do.
- **Audit trail from tokens** – Every run stores `stack_user_id` and `stack_org_id`. For “who ran what,” you only need run logs; user/org details stay in Stack (or you join via Stack API when needed).

---

## 3. Stack Auth hooks (and one combo)

Use these in client components. All from `@stackframe/stack`.

### Core identity

```ts
import { useUser, useStackApp } from "@stackframe/stack";

// Current user; redirect if not signed in
const user = useUser({ or: "redirect" });
// user.id, user.displayName, user.primaryEmail, user.profileImageUrl, ...

// Stack app (URLs, config)
const app = useStackApp();
app.signInUrl();
app.signUpUrl();
app.signOutUrl();
```

### Workspace = Organization

```ts
import { useOrganization, useOrganizations } from "@stackframe/stack";

// Current org (e.g. selected workspace)
const org = useOrganization();
// org?.id, org?.displayName, org?.members, ...

// List orgs the user belongs to (for workspace switcher)
const orgs = useOrganizations();
// orgs[].id, orgs[].displayName, ...
```

### Permissions (RBAC)

```ts
import { usePermission } from "@stackframe/stack";

const canCreateAgent = usePermission("agent:create");
const canRunAgent = usePermission("agent:run");
const isWorkspaceAdmin = usePermission("workspace:admin");

// In JSX
{canCreateAgent && <Button>New agent</Button>}
{canRunAgent && <Button onClick={runAgent}>Run</Button>}
```

### Combo: “current workspace context” (one hook to rule them)

You can wrap user + org + a few permissions in one hook so the rest of the app just asks for “current context”:

```ts
// hooks/useWorkspaceContext.ts
"use client";

import { useUser, useOrganization, usePermission } from "@stackframe/stack";

export function useWorkspaceContext() {
  const user = useUser({ or: "redirect" });
  const org = useOrganization();
  const canCreate = usePermission("agent:create");
  const canRun = usePermission("agent:run");
  const canAdmin = usePermission("workspace:admin");

  return {
    user,
    org,
    userId: user?.id,
    orgId: org?.id,
    permissions: {
      canCreateAgent: canCreate,
      canRunAgent: canRun,
      canManageWorkspace: canAdmin,
    },
    // Handy for API calls and run attribution
    runContext: { stack_user_id: user?.id, stack_org_id: org?.id },
  };
}
```

Usage:

```tsx
function AgentList() {
  const { user, org, permissions, runContext } = useWorkspaceContext();

  const handleRun = async (agentId: string) => {
    if (!permissions.canRunAgent) return;
    await fetch("/api/agents/run", {
      method: "POST",
      body: JSON.stringify({ agentId, ...runContext }),
      credentials: "include", // send Stack session
    });
  };

  return (
    <div>
      <p>Signed in as {user.displayName} · Workspace: {org?.displayName}</p>
      {permissions.canCreateAgent && <Button>New agent</Button>}
      {/* list agents, Run buttons gated by permissions.canRunAgent */}
    </div>
  );
}
```

---

## 4. One-liner cheat sheet

| Need | Hook / approach |
|------|------------------|
| Current user (or redirect) | `useUser({ or: "redirect" })` |
| Sign-in / sign-up URLs | `useStackApp()` → `.signInUrl()`, `.signUpUrl()` |
| Current workspace (org) | `useOrganization()` |
| List workspaces | `useOrganizations()` |
| Can user do X? | `usePermission("permission:key")` |
| User + org + permissions in one place | `useWorkspaceContext()` (custom, see above) |
| Logout | `useStackApp().signOutUrl()` or Stack’s sign-out component |

---

## 5. “Something” to ship first

- **Ship the combo hook** – Implement `useWorkspaceContext()` and use it on one page (e.g. dashboard or agent list). Every new feature (agents, runs, settings) can then depend on `user`, `org`, and `permissions` from one place.
- **One permission-gated button** – e.g. “New agent” only if `agent:create`. Proves RBAC is wired and not an add-on.
- **One API route that uses Stack** – e.g. `POST /api/agents/run` that validates the Stack session, reads `userId` and `orgId` from the token, checks `agent:run`, and returns a run id. No API keys; Stack-only auth.

After that, the rest is orchestration logic; identity and access stay entirely in Stack Auth.
