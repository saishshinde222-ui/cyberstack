# Who Ran What — Audit Feed for AI Agent Runs

**Reddit for AI agent runs** — one activity feed: who ran which agent, when, and in which workspace. Real users and workspaces via Stack Auth. Demoable in 3 minutes.

## What you can demo (no backend required)

- **Without Stack Auth:** `npm run dev` → open Dashboard → click **Run** on any agent → see run history with “Run by Demo User · Personal”. Shows the flow; banner says “add .env.local for real auth”.
- **With Stack Auth:** Add keys to `.env.local` → **Sign in** / **Sign up** (Stack UI) → Dashboard shows your name and workspace → **Run** an agent → run history shows your identity and org. **Account** opens Stack account settings. **Sign out** uses Stack.

## Get it running (2 min)

```bash
npm install
cp .env.local.example .env.local
# Add your keys from app.stack-auth.com → your project → API keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**No Stack project yet?** The app still runs in **demo mode**: dashboard works with a mock user so you can click through. Add `.env.local` when you have a Stack project to get real sign-in and identity.

## 3-minute demo script (for judges)

1. **Landing (15 sec)**  
   Show the home page. “Sign in” and “Sign up” go to Stack Auth. “Dashboard” goes straight to the workspace.

2. **Sign in (30 sec)**  
   Click **Sign in** → use Stack Auth (email/password or OAuth if you configured it). After sign-in you land on the dashboard. Point out: “Run as [your name] · Workspace: [org]. That’s all from Stack Auth — no custom user table.”

3. **Run an agent (45 sec)**  
   Click **Run** on e.g. “Researcher”. Show the run appearing in **Run history** with your name and workspace. Say: “Every run is stored with `stack_user_id` and `stack_org_id`. Full audit trail. Backend would validate the Stack JWT; we’re not using API keys for users.”

4. **Permissions & account (30 sec)**  
   Point to the green banner: “You have `agent:create` — that’s Stack RBAC. We’d gate ‘New agent’ on this.” Then: **Account** → opens Stack’s account settings (profile, 2FA, etc.). “We didn’t build any of this — Stack Auth is the only identity.”

5. **Close (15 sec)**  
   “One identity, every agent. Workspaces are Stack orgs, permissions are RBAC, support can use Stack impersonation. All demoable here.”

## What’s in the repo

| Path | Purpose |
|------|--------|
| `app/page.tsx` | Landing: Sign in, Sign up, Dashboard |
| `app/dashboard/page.tsx` | Agents list, Run button, run history (user + workspace from Stack) |
| `app/handler/[[...path]]/page.tsx` | Stack Auth routes (sign-in, sign-up, account settings) |
| `app/api/agents/run/route.ts` | POST run — accepts `stack_user_id` / `stack_org_id` (add JWT validation for production) |
| `stack.config.ts` | Stack Auth config |
| `MULTI-AGENT-STACK-AUTH-ARCHITECTURE.md` | Why Stack is the core, not an add-on |
| `PROBLEM-STATEMENT-AND-PITCH.md` | Problem + 60s pitch for judges |

## Env (for real auth)

Create `.env.local`:

```
NEXT_PUBLIC_STACK_PROJECT_ID=...
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=...
STACK_SECRET_SERVER_KEY=...
```

From [app.stack-auth.com](https://app.stack-auth.com) → your project → API keys.

## Optional: Organizations for “workspace”

In the Stack dashboard, create an organization and add your user. After that, the dashboard will show that org as the workspace (via `useOrganization()`). Invites = Stack org invites.
