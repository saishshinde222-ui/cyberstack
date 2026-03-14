# Problem Statement & Judge Pitch

**Principle:** The product solves a real problem. Stack Auth is how we do sign-in, workspaces, and permissions — it fits the problem naturally; we didn’t build the app “for” Stack Auth.

**Full ComplyKit-style pitch (problem → gap → solution → Stack Auth integration → target users → why it wins → prize alignment):** see **`PITCH-COMPLYKIT-STYLE.md`** — product name **Who Ran What**, same structure as the ComplyKit example.

---

## The product (problem-first)

**What we built:** A **run audit feed for AI agents** — one place to see who ran which agent, when, and in which workspace. Filter by person, workspace, or agent. So teams and compliance can answer “who ran this?” without digging through logs or API keys.

**The problem we’re solving:**  
Teams are already running AI agents (research, writing, code, etc.). When something goes wrong or compliance asks “who had access?”, there’s no clear answer: shared API keys, personal logins, no real notion of “workspace” or “team.” So you get shadow AI, audit headaches, and no way to revoke someone when they leave.

**Why this product:**  
We wanted a single feed: “Sarah ran Researcher at 2pm · Workspace: Marketing.” That requires **real users** and **real workspaces** — not fake “workspace” tables or API keys. So we needed proper auth and teams. We used **Stack Auth** for that: sign-in, organizations (workspaces), and permissions. It gave us one place for identity and teams so we could focus on the feed and the run logic. Stack Auth isn’t the product; it’s the layer that makes the product possible.

---

## One-line problem statement

**“Teams run AI agents but can’t answer ‘who ran what’ or revoke access when someone leaves. We built a run audit feed — one screen showing who ran which agent, when, and in which workspace. We use Stack Auth for sign-in and workspaces so every run is tied to a real user and team.”**

---

## 60-second pitch (problem → product → how we built it)

1. **Problem (15 sec)**  
   “Teams are running AI agents today. When compliance asks ‘who ran this?’ or someone leaves and you need to revoke access, there’s usually no good answer — shared keys, no real workspaces, no audit trail.”

2. **Product (20 sec)**  
   “We built a run audit feed: one screen that shows who ran which agent, when, and in which workspace. You can filter by person or workspace. So you get a real answer to ‘who ran it?’ and you can revoke access in one place when someone’s offboarded.”

3. **How we built it (15 sec)**  
   “We needed real users and real workspaces — not a custom auth system. We used Stack Auth for sign-in and for teams. Every run is tied to a Stack user and org, so the feed is an audit trail by design. Support can use Stack’s impersonation to see what a user sees when we’re debugging.”

4. **Close (10 sec)**  
   “So the product is the audit feed; Stack Auth is how we get identity and teams without building them ourselves.”

---

## How Stack Auth is used (naturally)

| Need | How we use Stack Auth |
|------|------------------------|
| Sign-in / sign-up | Stack’s handler and account — we didn’t build login. |
| “Who ran this?” | Every run stores Stack user ID and org ID; the feed reads from that. |
| Workspaces | Workspaces = Stack Auth organizations; invite = Stack org invite. |
| Revoke access | Revoke in Stack dashboard → that user no longer appears in the feed. |
| Support debug | Stack impersonation so support sees the same feed as the user. |

We didn’t choose Stack to “showcase” it; we needed identity and teams, and Stack gave us both in one place so we could ship the product.

---

## Judge Q&A (short answers)

| Question | Answer |
|----------|--------|
| What’s the product? | A run audit feed for AI agents — who ran what, when, which workspace. |
| What problem does it solve? | Teams can’t answer “who ran this?” or revoke access cleanly; we give them one feed and real users/workspaces. |
| Why Stack Auth? | We needed sign-in and teams. Stack gave us users, orgs, and permissions in one system so we didn’t build our own auth or workspace store. |
| What did you build? | The feed UI, run storage, and filters; identity and workspaces come from Stack Auth. |

---

## What to avoid in the pitch

- Don’t lead with “We use Stack Auth” — lead with the problem and the feed.
- Don’t say “We built this to showcase Stack Auth” — say “We built an audit feed; we used Stack Auth for identity and teams.”
- Keep Stack Auth as the **enabler**, not the **product**.
