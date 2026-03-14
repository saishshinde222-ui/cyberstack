import Link from "next/link";

const FEATURES = [
  { label: "GitHub OAuth (connected accounts)", tag: "Integrations" },
  { label: "Sign-in (OAuth, Magic Link, Passkeys)", tag: "Auth" },
  { label: "2FA / MFA gate for sensitive scans", tag: "Security" },
  { label: "Organizations (workspaces)", tag: "Teams" },
  { label: "JWT-validated scans", tag: "Auth" },
  { label: "Pre-built UI (UserButton, TeamSwitcher)", tag: "UI" },
  { label: "Impersonation for support", tag: "Support" },
  { label: "Webhooks on each scan", tag: "Events" },
  { label: "M2M API Keys", tag: "CI/CD" },
  { label: "MCP Server", tag: "AI" },
  { label: "Compliance reports", tag: "Audit" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-20 text-center">
        <div className="rounded-full border border-red-800 bg-red-950/30 px-4 py-1 text-xs text-red-300">
          Security + Stack Auth
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight">
          Who Ran What
        </h1>
        <p className="max-w-lg text-lg text-zinc-400 leading-relaxed">
          Security audit feed for GitHub repos. Connect via Stack Auth OAuth, scan for secrets, vulnerable deps, and code issues. Every run is attributed to a real user + workspace — full audit trail.
        </p>
        <div className="flex flex-wrap justify-center gap-4 mt-2">
          <Link href="/handler/signin" className="rounded-lg bg-white px-8 py-3 text-zinc-900 font-semibold hover:bg-zinc-200 transition-colors">
            Sign in
          </Link>
          <Link href="/handler/signup" className="rounded-lg border border-zinc-600 px-8 py-3 font-semibold hover:bg-zinc-800 transition-colors">
            Sign up
          </Link>
          <Link href="/dashboard" className="rounded-lg border border-red-600 px-8 py-3 font-semibold text-red-300 hover:bg-red-950/30 transition-colors">
            Dashboard →
          </Link>
        </div>
      </section>

      <section className="border-t border-zinc-800 bg-zinc-900/30 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold mb-2">Security Scanners</h2>
          <p className="text-center text-sm text-zinc-500 mb-8">
            Four security agents run against your GitHub repos. Findings feed into a team audit trail.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-red-800 bg-red-950/20 p-4 text-center">
              <p className="text-2xl mb-2">🔐</p>
              <p className="font-semibold">Secret Scanner</p>
              <p className="text-xs text-zinc-500 mt-1">API keys, passwords, tokens</p>
            </div>
            <div className="rounded-xl border border-amber-800 bg-amber-950/20 p-4 text-center">
              <p className="text-2xl mb-2">📦</p>
              <p className="font-semibold">Dependency Checker</p>
              <p className="text-xs text-zinc-500 mt-1">Known vulnerable packages</p>
            </div>
            <div className="rounded-xl border border-violet-800 bg-violet-950/20 p-4 text-center">
              <p className="text-2xl mb-2">🔍</p>
              <p className="font-semibold">Code Reviewer</p>
              <p className="text-xs text-zinc-500 mt-1">SQLi, XSS, eval, unsafe patterns (MFA required)</p>
            </div>
            <div className="rounded-xl border border-sky-800 bg-sky-950/20 p-4 text-center">
              <p className="text-2xl mb-2">⚙️</p>
              <p className="font-semibold">Config Auditor</p>
              <p className="text-xs text-zinc-500 mt-1">Env, docker, k8s misconfigs</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-800 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold mb-2">Stack Auth Features Used</h2>
          <p className="text-center text-sm text-zinc-500 mb-8">
            Identity, teams, MFA, OAuth connections, webhooks — all from Stack Auth.
          </p>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.label} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 text-center">
                <span className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{f.tag}</span>
                <span className="text-sm font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-800 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold mb-8">How It Works</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-xl">1</div>
              <h3 className="font-semibold mb-1">Connect GitHub (optional)</h3>
              <p className="text-sm text-zinc-500">Link GitHub via Stack Auth OAuth to scan private repos. Or scan any public repo by owner/name.</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-xl">2</div>
              <h3 className="font-semibold mb-1">Run security scans</h3>
              <p className="text-sm text-zinc-500">Enter a repo, run Secret Scanner, Dependency Checker, Code Reviewer, or Config Auditor. Every scan is JWT-validated and attributed to you + your workspace.</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-xl">3</div>
              <h3 className="font-semibold mb-1">Audit, compliance, MCP</h3>
              <p className="text-sm text-zinc-500">View findings by severity. Generate compliance reports. Query scan history from Claude via MCP. Revoke users in Stack — they lose access instantly.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-800 px-6 py-8 text-center text-xs text-zinc-600">
        Who Ran What — Security Audit Feed for GitHub · Stack Auth Hackathon 2026
      </footer>
    </main>
  );
}
