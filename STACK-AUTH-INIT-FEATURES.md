# Stack Auth: `npx @stackframe/stack-cli@latest init` — Feature walkthrough

Run init **inside an existing Next.js (or React/JS) project**. If the folder is empty, create the app first, then run init.

**Prerequisite:** Create a project at [app.stack-auth.com](https://app.stack-auth.com) first; otherwise `stack init` will say "You don't own any projects."

---

## 1. How to run init

```bash
# From project root (e.g. a Next.js app)
npx @stackframe/stack-cli@latest init
```

**Useful flags:**

| Flag | Purpose |
|------|--------|
| `--next` | Initialize for Next.js (detection may ask otherwise). |
| `--js` | Use JavaScript instead of TypeScript. |
| `--no-browser` | Don’t open the browser for dashboard/API key setup (e.g. CI or no GUI). |
| `--npm` / `--yarn` / `--pnpm` / `--bun` | Force package manager. |
| `--client` | Client-only setup. |
| `--server` | Server-only setup. |
| `--dry-run` | Show what would be done without writing files. |
| `--neon` | Use Neon database. |

**Non-interactive (CI):**

```bash
# Requires a project at app.stack-auth.com first
npx @stackframe/stack-cli@latest init --mode create --no-agent --output-dir .
# Or:
STACK_DISABLE_INTERACTIVE=1 npx @stackframe/stack-cli@latest init --next --no-browser
```

---

## 2. What the CLI does (files it adds/edits)

| What | Where |
|------|--------|
| Installs SDK | `@stackframe/stack` (+ peer deps) |
| Config | `stack.config.ts` (or `.js`) at project root — project ID and client/server config |
| Env vars | `.env.local`: `NEXT_PUBLIC_STACK_PROJECT_ID`, `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`, `STACK_SECRET_SERVER_KEY` |
| App wiring | Wraps app with **`StackProvider`**; mounts **`<StackHandler />`** for auth routes |

Add the real keys from [app.stack-auth.com](https://app.stack-auth.com) → your project → API keys into `.env.local`.

---

## 3. Go through the features (after init)

### A. Config & runtime (in your repo)

| Feature | What it is | Where it lives |
|--------|------------|----------------|
| **stack.config.ts** | Builds Stack client (and optional server). Exports config for `StackProvider`. | Project root |
| **StackProvider** | Wraps root layout; provides auth state and Stack client to the tree. | e.g. `app/layout.tsx` |
| **StackHandler** | Renders auth UI and handles redirects. Serves sign-in, sign-up, account settings, OAuth callbacks, magic link, password reset. | Layout or catch-all (e.g. `/handler/*`) |

**Handler routes:** `/handler/signin`, `/handler/signup`, `/handler/account-settings`, plus password reset, magic link, OAuth callbacks.

---

### B. Client SDK — hooks (use in client components)

| Feature | What it does |
|--------|----------------|
| **useUser({ or: "redirect" })** | Current user; `or: "redirect"` sends unauthenticated users to sign-in. |
| **useStackApp()** | Stack client: `signInUrl()`, `signUpUrl()`, app config. |
| **useOrganization()** / **useOrganizations()** | Orgs (teams) — enable in dashboard first. |
| **usePermission()** / permission helpers | RBAC — enable in dashboard; check permissions in UI. |

All from `import { ... } from "@stackframe/stack"`.

---

### C. Pre-built UI (via StackHandler / components)

| Feature | What you get |
|--------|----------------|
| **Sign-in** | Password, magic link, OAuth (Google, GitHub, etc. — enable in dashboard). |
| **Sign-up** | Same methods; email verification. |
| **Account settings** | Profile, email, password, linked accounts, 2FA/MFA, passkeys. |
| **Password reset** | Request and complete reset via email. |

---

### D. Auth methods (enable in dashboard)

At [app.stack-auth.com](https://app.stack-auth.com) → your project → Auth / Sign-in methods:

| Method | Description |
|--------|-------------|
| Email + password | Classic sign-up/sign-in. |
| Magic link | Passwordless email link. |
| OAuth | Google, GitHub, etc. (add apps in dashboard). |
| Passkeys | Passwordless (biometrics / security keys). |
| 2FA / MFA | TOTP (e.g. authenticator app). |

---

### E. Backend / API

| Feature | What it is |
|--------|------------|
| **JWT / session** | Stack issues and refreshes tokens; use in API routes, server actions, or any backend that validates Stack JWTs. |
| **REST API** | Custom backends or non-React clients; auth with same project and keys (see docs). |

---

### F. Dashboard (app.stack-auth.com) — config only

| Feature | What you can do |
|--------|------------------|
| **Users** | List, search, filter, view details. |
| **Auth methods** | Enable/disable password, magic link, OAuth apps, passkeys, MFA. |
| **Organizations (teams)** | Create orgs; invite by email; use with `useOrganization` / `useOrganizations`. |
| **Roles & permissions (RBAC)** | Define roles and permission trees; use in app with `usePermission` or server-side. |
| **Webhooks** | Send events (e.g. user signed up, org invite) to Slack, Discord, or your endpoint. |
| **Impersonation** | Sign in as a user for support/debug (dashboard only). |
| **SSO** | If enabled for your plan, configure enterprise SSO. |

---

## 4. Minimal usage after init

**Protected page (e.g. `app/dashboard/page.tsx`):**

```tsx
"use client";
import { useUser } from "@stackframe/stack";

export default function DashboardPage() {
  const user = useUser({ or: "redirect" });
  return <div>Hi, {user.displayName}</div>;
}
```

**Sign-in / sign-up links:**

```tsx
import { useStackApp } from "@stackframe/stack";

// In a client component:
const app = useStackApp();
// app.signInUrl(), app.signUpUrl(), etc.
```

**Account settings:**  
Send users to `/handler/account-settings` (or the path you mounted `StackHandler` on).

---

## 5. If init fails or the project is empty

1. **Create a Next.js app first** (if needed):
   ```bash
   npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir
   ```
2. **Create a Stack Auth project** at [app.stack-auth.com](https://app.stack-auth.com).
3. **Run init:**
   ```bash
   npx @stackframe/stack-cli@latest init --next --no-browser
   ```
4. **Copy env vars** from the dashboard into `.env.local` and run `npm run dev`.
5. **Test:** open `http://localhost:3000/handler/signup` (or your handler base path).

---

## 6. Quick reference

- **Docs:** [docs.stack-auth.com](https://docs.stack-auth.com)
- **Dashboard:** [app.stack-auth.com](https://app.stack-auth.com)
- **MCP:** [mcp.stack-auth.com](https://mcp.stack-auth.com)
