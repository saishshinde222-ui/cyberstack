# Topic Improvements + Lovable Script

## Part 1: How to improve the topic

**Current topic:** Who Ran What — activity feed for AI agent runs; "Reddit for who ran what"; audit and revoke.

**Improvements:**

1. **Sharpen the one question**  
   Make the product answer a single question: *"Who ran this?"* — so the topic is "The app that answers 'Who ran this?' for AI agent runs." Everything (feed, filters, workspaces) serves that.

2. **Add a concrete first use case**  
   Pin the topic to one scenario: e.g. "When compliance asks for an audit of your AI agent usage" or "When someone leaves and you need to revoke their access to agent runs." Lead with that scenario so the topic feels grounded.

3. **Narrow "agents" at first**  
   Instead of "AI agents" (vague), say "AI agent runs" or "runs from your research/writing/code agents" so it's clear we mean executable runs, not chatbots in general.

4. **Frame the feed as the product, not a feature**  
   Topic = "An audit feed that is the product" — one screen you open to see who ran what. Not "a platform that has a feed" but "the feed is the product." That keeps the topic tight.

**One-line improved topic:**  
*"Who Ran What is the place you open to answer 'Who ran this?' for your team's AI agent runs — one activity feed, real users and workspaces, revoke in one place."*

---

## Part 2: Lovable script (paste this into Lovable)

Copy everything below the line into Lovable as your app description / prompt.

---

**Product goal (one sentence):**  
Build a web app called **Who Ran What**: the activity feed where teams see who ran which AI agent, when, and in which workspace. Every run is tied to a real user and workspace; the feed is the main product.

**Who it's for:**  
Engineering and product teams that run AI agents (research, writing, code) and need one place to answer "who ran this?" and to revoke access when someone leaves.

**Success criteria:**  
- User can sign in (auth required).  
- User sees their current workspace and can run 2–3 demo agents (e.g. Researcher, Writer, Coder).  
- Every run appears in a single **activity feed** with: who ran it (name), which agent, which workspace, timestamp, and a short result/summary.  
- Header shows "Run as [current user name] · Workspace: [current workspace name]".  
- User can open Account/settings and Sign out.  
- No custom user or workspace tables — auth and workspace come from an external auth provider (Stack Auth); the app only stores run records with `user_id` and `workspace_id` from that provider.

**Screens/pages:**

1. **Landing (public)**  
   - App name: "Who Ran What".  
   - Short tagline: e.g. "The activity feed for AI agent runs — who ran what, when, and in which workspace."  
   - Buttons: Sign in, Sign up, Go to feed (or Dashboard).  
   - Clean, minimal; not dark-only — prefer a light or balanced theme with good contrast.

2. **Dashboard / Activity feed (authenticated)**  
   - Top: Header with app name "Who Ran What", then a line like "Run as **Sarah** · Workspace: **Marketing**" (from auth).  
   - Right side of header: Account link, Sign out.  
   - Section 1 — **Agents**: 3 cards in a row (or grid). Each card: agent name (e.g. Researcher, Writer, Coder), one-line description, primary button "Run". Clicking Run triggers a run and adds a row to the activity feed.  
   - Section 2 — **Activity feed**: Single scrollable list. Each item is a **card** (not a plain row): avatar or initial of the user who ran it, user name, agent name, workspace name, relative time (e.g. "2 min ago"), and a short result/summary line. Newest at top. Use cards with subtle borders or shadows so it feels like a feed, not a table.  
   - Empty state: "No runs yet. Run an agent above to see it here."

3. **Auth flows**  
   - Sign in and Sign up: Use Stack Auth (or a placeholder auth that returns user id + display name + workspace/org id). If Lovable doesn't support Stack Auth directly, use a simple "current user" + "current workspace" mock that the feed and run API use.  
   - Account: Link to Stack Auth account settings or a simple profile placeholder.

**Data model:**  
- **Run**: `id`, `agentId`, `agentName`, `runBy` (display name), `workspace` (name), `userId`, `workspaceId`, `result` (short text), `at` (timestamp).  
- Runs are created when user clicks Run; stored in state or a small backend. No users or workspaces stored in app DB — they come from auth.

**Actions / logic:**  
- Click **Run** on an agent → POST to an API (or local handler) with `agentId`, `agentName`, `userId`, `workspaceId`; API returns a run object; append to activity feed and show at top.  
- Feed is read-only (no edit/delete in this version).  
- Sign out clears session and returns to landing.

**Design requirements:**  
- **Not generic "AI slop"**: Avoid default purple gradients and generic SaaS look.  
- **Feed-first**: The activity feed should feel like the main content — clear cards, good typography, readable timestamps and names.  
- **Calm and clear**: Plenty of whitespace, clear hierarchy (app name → run-as line → agents → feed).  
- **Responsive**: Works on desktop and tablet; feed stacks nicely on small screens.  
- **Accessible**: Sufficient contrast, focus states on buttons and links.  
- Optional: Light theme with a soft off-white or very light gray background, dark text, and one accent color (e.g. blue or green) for primary actions.

**Tech constraints:**  
- Next.js or React app.  
- Auth: Integrate Stack Auth if possible (sign-in, sign-up, user, organization/workspace). If not, use a mock that provides `userId`, `displayName`, `workspaceId`, `workspaceName` so the feed and run logic still work.  
- Run creation: API route or server action that accepts `agentId`, `agentName`, `userId`, `workspaceId` and returns a run object; frontend adds it to the activity feed.

**Core workflow:**  
1. User lands on homepage → clicks Sign in → signs in (Stack Auth or mock).  
2. User is redirected to Dashboard. Sees "Run as [name] · Workspace: [workspace]", three agent cards, and an empty (or existing) activity feed.  
3. User clicks Run on "Researcher" → one new card appears at top of activity feed: "[Name] ran Researcher · [Workspace] · 2 min ago" + result line.  
4. User can open Account or Sign out from header.

---

**End of Lovable script.** Paste the entire "Product goal" through "Core workflow" block into Lovable.
