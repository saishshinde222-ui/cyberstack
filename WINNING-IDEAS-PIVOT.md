# Product-First Ideas (Stack Auth Used Naturally)

**Principle:** The app should be a **real product for a real problem**. Stack Auth should be the natural choice for sign-in and teams, not the reason the app exists.

---

## What “naturally” means

- **Problem-first:** “Teams can’t answer who ran what” → we build an audit feed. “Teams can’t collaborate on agents” → we build a shared workspace. The problem drives the product.
- **Stack Auth as enabler:** We need users and workspaces → we use Stack Auth because it gives us both. We don’t say “we built this for Stack Auth”; we say “we built this, and we used Stack Auth for auth and teams.”
- **Avoid:** Products that only exist to show off Stack (e.g. “climb floors by doing auth steps”). Those feel like demos, not products.

---

## Idea 1: **Run audit feed** (current direction — recommended)

**Product:** One screen: “Who ran which agent, when, in which workspace?” Filter by user, workspace, or agent.

**Problem:** Teams run AI agents but can’t answer “who ran this?” or revoke access when someone leaves. Shared keys, no real workspaces, no audit trail.

**Why Stack Auth fits naturally:**  
You need real users and real workspaces for an audit feed. Stack Auth gives you sign-in, organizations (workspaces), and permissions. Every run is tied to a Stack user + org, so the feed is an audit trail by design. Revoke in Stack → they’re gone from the feed. Impersonation → support sees what the user sees. No custom auth or workspace table.

**Pitch:** “We built a run audit feed so teams can answer ‘who ran it?’ and revoke access in one place. We used Stack Auth for sign-in and workspaces so we could ship without building auth.”

---

## Idea 2: **Team workspace for AI agents**

**Product:** A shared workspace where the team shares the same agents and run history. Invite teammates; they see the same agents and runs. Roles: who can create vs run vs delete.

**Problem:** Today people run agents on their own. There’s no shared “workspace,” no clear roles, no way to onboard the team.

**Why Stack Auth fits naturally:**  
Workspaces = Stack Auth organizations. Invite = Stack org invite. Roles = Stack permissions (e.g. `agent:create`, `agent:run`). We don’t build a “workspace” or “invite” system; we use Stack’s. The product is the workspace UI and the agents; identity and membership come from Stack.

**Pitch:** “We built a team workspace for AI agents — same agents, same run history, invite by email. We used Stack Auth for teams and permissions so we didn’t have to build our own.”

---

## Idea 3: **Compliance-ready agent runs**

**Product:** Run agents in a way that’s auditable and revocable: every run has a user and org, optional SSO, and a place to revoke access when someone leaves.

**Problem:** Legal and security block agent adoption because there’s no audit trail, no RBAC, no “offboard this person.”

**Why Stack Auth fits naturally:**  
Audit trail = runs keyed by Stack user + org. RBAC and SSO = Stack. Revoke = Stack dashboard. The product is “agents you can run without compliance saying no”; Stack Auth is how we get the identity and access piece.

**Pitch:** “We built an agent runner that’s audit-ready and revocable. We used Stack Auth for identity, RBAC, and SSO so compliance is covered.”

---

## What to avoid

| Avoid | Prefer |
|-------|--------|
| “We built this to showcase Stack Auth” | “We built X; we used Stack Auth for auth and teams.” |
| Products that are just “do auth steps to progress” (e.g. Auth Tower) | Products that solve a real job (audit, collaboration, compliance). |
| Leading with “We use Stack Auth” | Leading with the problem and the product; Stack Auth comes in as “how we did identity/teams.” |

---

## Recommended

**Run audit feed** is the cleanest fit: the problem (“who ran this?”) is clear, the product (one feed screen) is easy to demo, and Stack Auth is the obvious way to get “real user + real workspace” per run. Stack stays in the background as the identity layer, not the star of the pitch.
