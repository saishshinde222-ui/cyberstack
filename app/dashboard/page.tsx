"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useUser,
  UserButton,
  SelectedTeamSwitcher,
} from "@stackframe/stack";
import type { Run, Finding } from "@/app/lib/runs-store";
import { canAutoFix, suggestFix } from "@/app/lib/fix-suggestions";

const SECURITY_AGENTS = [
  { id: "secret-scanner", name: "Secret Scanner", icon: "🔐", description: "Find hardcoded API keys, passwords, tokens", sensitive: false },
  { id: "dependency-checker", name: "Dependency Checker", icon: "📦", description: "Check for known vulnerable packages", sensitive: false },
  { id: "code-reviewer", name: "Code Reviewer", icon: "🔍", description: "Detect SQLi, XSS, eval, unsafe patterns", sensitive: true },
  { id: "config-auditor", name: "Config Auditor", icon: "⚙️", description: "Audit env, docker, k8s for misconfigs", sensitive: false },
];

const AGENT_COLOR: Record<string, string> = {
  "secret-scanner": "border-red-800 bg-red-950/30",
  "dependency-checker": "border-amber-800 bg-amber-950/30",
  "code-reviewer": "border-violet-800 bg-violet-950/30",
  "config-auditor": "border-sky-800 bg-sky-950/30",
};
const AGENT_DOT: Record<string, string> = {
  "secret-scanner": "bg-red-400",
  "dependency-checker": "bg-amber-400",
  "code-reviewer": "bg-violet-400",
  "config-auditor": "bg-sky-400",
};

const DEMO_REPOS = [
  { owner: "OWASP", name: "NodeGoat", full: "OWASP/NodeGoat", hint: "deliberately vulnerable" },
  { owner: "vercel", name: "next.js", full: "vercel/next.js" },
  { owner: "facebook", name: "react", full: "facebook/react" },
  { owner: "stack-auth", name: "stack", full: "stack-auth/stack" },
];

type WebhookLog = { id: string; event: string; destination: string; deliveredAt: string; status: string };
type Tab = "control" | "findings" | "analytics" | "compliance" | "webhooks" | "api-keys" | "integrations" | "mcp";

export default function DashboardPage() {
  return <DashboardWithStack />;
}

function DashboardWithStack() {
  const user = useUser({ or: "redirect" });
  const searchParams = useSearchParams();

  const [runs, setRuns] = useState<Run[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("control");
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [mfaPromptAgent, setMfaPromptAgent] = useState<string | null>(null);
  const [chainQueue, setChainQueue] = useState<string[]>([]);
  const [chainRunning, setChainRunning] = useState(false);
  const [chainResults, setChainResults] = useState<Run[]>([]);

  const [repoInput, setRepoInput] = useState("OWASP/NodeGoat");
  const [githubConnected, setGithubConnected] = useState(false);
  const [userRepos, setUserRepos] = useState<{ fullName: string; owner: string; name: string }[]>([]);

  const selectedTeam = user.selectedTeam;
  const displayName = user.displayName ?? user.primaryEmail ?? "You";
  const orgName = selectedTeam?.displayName ?? "Personal";
  const orgId = selectedTeam?.id ?? "personal";
  const hasMfa = user.otpAuthEnabled || user.passkeyAuthEnabled;

  const [repoOwner, repoName] = repoInput.includes("/")
    ? repoInput.split("/").map((s) => s.trim())
    : ["", ""];
  const repoValid = !!repoOwner && !!repoName;

  useEffect(() => {
    const t = searchParams.get("tab") as Tab | null;
    const valid: Tab[] = ["control", "findings", "analytics", "compliance", "webhooks", "api-keys", "integrations", "mcp"];
    if (t && valid.includes(t)) setTab(t);
  }, [searchParams]);

  useEffect(() => {
    fetch(`/api/runs?orgId=${orgId}&limit=50`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setRuns(data); })
      .catch(() => {});
  }, [orgId]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`/api/runs?orgId=${orgId}&limit=50`)
        .then((r) => r.json())
        .then((data) => {
          if (!Array.isArray(data)) return;
          setRuns((prev) => {
            const byId = new Map<string, Run>();
            for (const r of data) byId.set(r.id, r);
            for (const r of prev) if (!byId.has(r.id)) byId.set(r.id, r);
            return Array.from(byId.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 50);
          });
        })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [orgId]);

  useEffect(() => {
    fetch("/api/github/repos", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setGithubConnected(data.connected);
        if (data.repos?.length) setUserRepos(data.repos);
      })
      .catch(() => {});
  }, [tab]);

  const linkGitHub = useCallback(() => {
    user.linkConnectedAccount("github").catch(() => {});
  }, [user]);

  const fireScan = useCallback(
    async (agentId: string, agentName: string) => {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ repoOwner, repoName, agentId }),
      });
      const run: Run = await res.json();
      if (run.id) setRuns((prev) => [run, ...prev]);

      fetch("/api/webhooks/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ event: "scan.completed", payload: { agentId, runId: run.id, userId: user.id, orgId, repo: run.repo?.fullName } }),
      })
        .then((r) => r.json())
        .then((wh) => setWebhookLogs((prev) => [wh, ...prev].slice(0, 30)))
        .catch(() => {});

      return run;
    },
    [repoOwner, repoName, user.id, orgId],
  );

  const runSingle = useCallback(
    async (agentId: string, agentName: string) => {
      setRunning(agentId);
      try {
        await fireScan(agentId, agentName);
      } finally {
        setRunning(null);
      }
    },
    [fireScan],
  );

  const runChain = useCallback(async () => {
    if (chainQueue.length < 2 || !repoValid) return;
    const hasSensitive = chainQueue.some((id) => SECURITY_AGENTS.find((a) => a.id === id)?.sensitive);
    if (hasSensitive && !hasMfa) {
      setMfaPromptAgent("chain (contains Code Reviewer)");
      return;
    }
    setChainRunning(true);
    setChainResults([]);
    for (const id of chainQueue) {
      const agent = SECURITY_AGENTS.find((a) => a.id === id);
      if (!agent) continue;
      const run = await fireScan(agent.id, agent.name);
      setChainResults((prev) => [...prev, run]);
      await new Promise((r) => setTimeout(r, 800));
    }
    setChainRunning(false);
  }, [chainQueue, repoValid, hasMfa, fireScan]);

  const runCompleteScan = useCallback(async () => {
    if (!repoValid) return;
    const codeReviewer = SECURITY_AGENTS.find((a) => a.id === "code-reviewer");
    if (codeReviewer?.sensitive && !hasMfa) {
      setMfaPromptAgent("Complete Scan (includes Code Reviewer)");
      return;
    }
    setRunning("complete-scan");
    try {
      for (const agent of SECURITY_AGENTS) {
        await fireScan(agent.id, agent.name);
        await new Promise((r) => setTimeout(r, 500));
      }
    } finally {
      setRunning(null);
    }
  }, [repoValid, hasMfa, fireScan]);

  const handleRunClick = (agentId: string, agentName: string, sensitive: boolean) => {
    if (!repoValid) return;
    if (sensitive && !hasMfa) {
      setMfaPromptAgent(agentName);
      return;
    }
    runSingle(agentId, agentName);
  };

  const toggleChainAgent = (id: string) => {
    setChainQueue((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "control", label: "Control Room" },
    { id: "findings", label: "Findings", badge: runs.reduce((n, r) => n + (r.findings?.length ?? 0), 0) || undefined },
    { id: "analytics", label: "Analytics" },
    { id: "compliance", label: "Compliance" },
    { id: "webhooks", label: "Webhooks", badge: webhookLogs.length || undefined },
    { id: "api-keys", label: "API Keys" },
    { id: "integrations", label: "Integrations" },
    { id: "mcp", label: "MCP" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg font-bold tracking-tight">Who Ran What</Link>
            <div className="hidden sm:block"><SelectedTeamSwitcher /></div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/handler/account-settings" className="text-sm text-zinc-400 hover:text-white transition-colors">Account</Link>
            <UserButton />
          </div>
        </div>
      </header>

      <div className="sm:hidden border-b border-zinc-800 px-4 py-2"><SelectedTeamSwitcher /></div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {mfaPromptAgent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
              <h3 className="text-lg font-semibold">MFA Required</h3>
              <p className="mt-2 text-sm text-zinc-400"><strong>{mfaPromptAgent}</strong> requires 2FA enabled.</p>
              <div className="mt-4 flex gap-3">
                <Link href="/handler/account-settings" className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200">Enable 2FA</Link>
                <button onClick={() => setMfaPromptAgent(null)} className="rounded-lg border border-zinc-600 px-4 py-2 text-sm hover:bg-zinc-800">Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/50 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {t.label}
              {t.badge ? <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] text-white">{t.badge}</span> : null}
            </button>
          ))}
        </div>

        {tab === "control" && (
          <ControlRoom
            runs={runs}
            running={running}
            hasMfa={hasMfa}
            displayName={displayName}
            orgName={orgName}
            repoInput={repoInput}
            setRepoInput={setRepoInput}
            repoValid={repoValid}
            githubConnected={githubConnected}
            userRepos={userRepos}
            onLinkGitHub={linkGitHub}
            onRun={handleRunClick}
            chainQueue={chainQueue}
            onToggleChain={toggleChainAgent}
            onRunChain={runChain}
            chainRunning={chainRunning}
            chainResults={chainResults}
          />
        )}
        {tab === "findings" && (
          <FindingsTab
            runs={runs}
            githubConnected={githubConnected}
            repoInput={repoInput}
            repoValid={repoValid}
            onCompleteScan={runCompleteScan}
            completeScanRunning={running === "complete-scan"}
          />
        )}
        {tab === "analytics" && <AnalyticsTab runs={runs} />}
        {tab === "compliance" && <ComplianceTab runs={runs} user={user} orgName={orgName} hasMfa={hasMfa} />}
        {tab === "webhooks" && <WebhooksTab logs={webhookLogs} />}
        {tab === "api-keys" && <ApiKeysTab />}
        {tab === "integrations" && <IntegrationsTab />}
        {tab === "mcp" && <McpTab />}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  CONTROL ROOM — repo picker, security scanners, live feed                  */
/* ────────────────────────────────────────────────────────────────────────── */

function ControlRoom({
  runs, running, hasMfa, displayName, orgName,
  repoInput, setRepoInput, repoValid, githubConnected, userRepos, onLinkGitHub,
  onRun, chainQueue, onToggleChain, onRunChain, chainRunning, chainResults,
}: {
  runs: Run[];
  running: string | null;
  hasMfa: boolean;
  displayName: string;
  orgName: string;
  repoInput: string;
  setRepoInput: (v: string) => void;
  repoValid: boolean;
  githubConnected: boolean;
  userRepos: { fullName: string; owner: string; name: string }[];
  onLinkGitHub: () => void;
  onRun: (id: string, name: string, sensitive: boolean) => void;
  chainQueue: string[];
  onToggleChain: (id: string) => void;
  onRunChain: () => void;
  chainRunning: boolean;
  chainResults: Run[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2 space-y-6">
        {/* Repo picker */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">GitHub Repository</h2>
          <div className="flex gap-2">
            <input
              placeholder="owner/repo (e.g. vercel/next.js)"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
          </div>
          {!githubConnected ? (
            <button
              onClick={onLinkGitHub}
              className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800"
            >
              <span>🔗</span> Connect GitHub (Stack Auth OAuth) to scan your private repos
            </button>
          ) : userRepos.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs text-zinc-500 mb-1">Your repos:</p>
              <select
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-white"
              >
                {userRepos.map((r) => (
                  <option key={r.fullName} value={r.fullName}>{r.fullName}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="mt-2">
            <p className="text-xs text-zinc-500 mb-1">Try: OWASP/NodeGoat (deliberately vulnerable), vercel/next.js, facebook/react</p>
            <div className="flex flex-wrap gap-1">
              {DEMO_REPOS.map((r) => (
                <button key={r.full} onClick={() => setRepoInput(r.full)} className={`rounded px-2 py-0.5 text-xs hover:bg-zinc-700 ${r.full === "OWASP/NodeGoat" ? "bg-amber-900/50 text-amber-300" : "bg-zinc-800"}`}>
                  {r.full}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security scanners */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Security Scanners</h2>
          <div className="grid gap-3">
            {SECURITY_AGENTS.map((agent) => (
              <div key={agent.id} className={`relative rounded-xl border p-4 ${AGENT_COLOR[agent.id]}`}>
                {agent.sensitive && <span className="absolute right-3 top-3 text-[10px] text-amber-400 font-medium uppercase">MFA</span>}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{agent.icon}</span>
                  <span className="font-semibold text-sm">{agent.name}</span>
                </div>
                <p className="text-xs text-zinc-400 mb-3">{agent.description}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onRun(agent.id, agent.name, agent.sensitive)}
                    disabled={!repoValid || !!running || chainRunning}
                    className="flex-1 rounded-lg bg-white/90 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-white disabled:opacity-40"
                  >
                    {running === agent.id ? "Scanning…" : agent.sensitive && !hasMfa ? "Needs MFA" : "Scan"}
                  </button>
                  <button
                    onClick={() => onToggleChain(agent.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                      chainQueue.includes(agent.id) ? "border-violet-500 bg-violet-500/20 text-violet-300" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                    }`}
                  >
                    {chainQueue.includes(agent.id) ? `#${chainQueue.indexOf(agent.id) + 1}` : "+Chain"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Run all chain */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Run Full Scan</h2>
          {chainQueue.length < 2 ? (
            <p className="text-xs text-zinc-500">Select 2+ scanners above to run them sequentially on the repo.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1 mb-3">
                {chainQueue.map((id, i) => {
                  const a = SECURITY_AGENTS.find((x) => x.id === id);
                  return (
                    <span key={id} className="flex items-center gap-1">
                      {i > 0 && <span className="text-zinc-600 text-xs">→</span>}
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${AGENT_COLOR[id]}`}>{a?.icon} {a?.name}</span>
                    </span>
                  );
                })}
              </div>
              <button
                onClick={onRunChain}
                disabled={chainRunning || !repoValid}
                className="w-full rounded-lg bg-gradient-to-r from-red-600 to-amber-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                {chainRunning ? "Scanning…" : "Run Full Scan"}
              </button>
            </>
          )}
          {chainResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {chainResults.map((r, i) => (
                <div key={r.id} className={`rounded-lg border p-3 text-xs ${AGENT_COLOR[r.agentId]}`}>
                  <div className="flex items-center gap-1 mb-1">
                    <span className={`inline-block h-2 w-2 rounded-full ${AGENT_DOT[r.agentId]}`} />
                    <span className="font-semibold">Step {i + 1}: {r.agentName}</span>
                  </div>
                  <p className="text-zinc-300">{r.result}</p>
                  {r.findings && r.findings.length > 0 && (
                    <p className="mt-1 text-red-300">{r.findings.length} finding(s)</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live feed */}
      <div className="lg:col-span-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Security Events — {orgName}</h2>
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        </div>

        {runs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 p-16 text-center text-zinc-500">
            <p className="text-2xl mb-2">🔐</p>
            <p className="font-medium">No scans yet</p>
            <p className="text-sm mt-1">Enter a repo and run a security scanner. Connect GitHub to scan your private repos.</p>
          </div>
        ) : (
          <ul className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {runs.map((run) => (
              <li key={run.id} className={`rounded-xl border p-4 ${AGENT_COLOR[run.agentId] || "border-zinc-800 bg-zinc-900/50"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${AGENT_DOT[run.agentId] || "bg-zinc-500"}`} />
                    <span className="font-semibold text-sm">{run.agentName}</span>
                    {run.repo && <span className="text-xs text-zinc-500 font-mono">{run.repo.fullName}</span>}
                    <span className="text-[10px] text-zinc-500">{run.userDisplayName === displayName ? "you" : run.userDisplayName}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 whitespace-nowrap">{formatTime(run.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm text-zinc-300">{run.result}</p>
                {run.findings && run.findings.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {run.findings.slice(0, 5).map((f, i) => (
                      <span key={i} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        f.severity === "critical" ? "bg-red-900/50 text-red-300" :
                        f.severity === "high" ? "bg-amber-900/50 text-amber-300" : "bg-zinc-800 text-zinc-400"
                      }`}>
                        {f.file}:{f.line ?? "?"} — {f.rule}
                      </span>
                    ))}
                    {run.findings.length > 5 && <span className="text-xs text-zinc-500">+{run.findings.length - 5} more</span>}
                  </div>
                )}
                <div className="mt-2 flex gap-3 text-[10px] text-zinc-500 font-mono">
                  <span>{run.orgName}</span>
                  <span>uid:{run.userId.slice(0, 8)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  FINDINGS — aggregated view                                               */
/* ────────────────────────────────────────────────────────────────────────── */

function FindingsTab({
  runs,
  githubConnected,
  repoInput,
  repoValid,
  onCompleteScan,
  completeScanRunning,
}: {
  runs: Run[];
  githubConnected: boolean;
  repoInput: string;
  repoValid: boolean;
  onCompleteScan: () => void;
  completeScanRunning: boolean;
}) {
  const [fixTarget, setFixTarget] = useState<Finding & { runId: string; agentName: string; repo?: string } | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fixLoading, setFixLoading] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);
  const [creatingPR, setCreatingPR] = useState(false);

  const allFindings = useMemo(() => {
    const out: (Finding & { runId: string; agentName: string; repo?: string; createdAt: string })[] = [];
    for (const r of runs) {
      for (const f of r.findings ?? []) {
        out.push({ ...f, runId: r.id, agentName: r.agentName, repo: r.repo?.fullName, createdAt: r.createdAt });
      }
    }
    return out.sort((a, b) => {
      const ord = { critical: 0, high: 1, medium: 2, low: 3 };
      return (ord[a.severity] ?? 4) - (ord[b.severity] ?? 4) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [runs]);

  const bySeverity = useMemo(() => {
    const s: Record<string, number> = {};
    for (const f of allFindings) {
      s[f.severity] = (s[f.severity] ?? 0) + 1;
    }
    return s;
  }, [allFindings]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Security Findings</h2>
          <p className="text-sm text-zinc-500">All findings from security scans. Filter by severity, repo, or agent.</p>
        </div>
        {repoValid && (
          <button
            type="button"
            disabled={completeScanRunning}
            onClick={onCompleteScan}
            className="rounded-xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {completeScanRunning ? "Scanning…" : "Complete Scan"}
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-red-800 bg-red-950/20 p-4">
          <p className="text-xs text-zinc-500 uppercase">Critical</p>
          <p className="text-2xl font-bold text-red-400">{bySeverity.critical ?? 0}</p>
        </div>
        <div className="rounded-xl border border-amber-800 bg-amber-950/20 p-4">
          <p className="text-xs text-zinc-500 uppercase">High</p>
          <p className="text-2xl font-bold text-amber-400">{bySeverity.high ?? 0}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500 uppercase">Medium</p>
          <p className="text-2xl font-bold">{bySeverity.medium ?? 0}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500 uppercase">Low</p>
          <p className="text-2xl font-bold">{bySeverity.low ?? 0}</p>
        </div>
      </div>

      {allFindings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 p-12 text-center text-zinc-500">
          <p className="text-lg mb-2">No findings yet</p>
          <p className="text-sm">Run security scans on a repo to see findings here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {allFindings.map((f, i) => (
            <li key={`${f.runId}-${i}`} className={`rounded-xl border p-4 ${
              f.severity === "critical" ? "border-red-800 bg-red-950/20" :
              f.severity === "high" ? "border-amber-800 bg-amber-950/20" : "border-zinc-800 bg-zinc-900/50"
            }`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                  f.severity === "critical" ? "bg-red-900/50 text-red-300" :
                  f.severity === "high" ? "bg-amber-900/50 text-amber-300" : "bg-zinc-800 text-zinc-400"
                }`}>{f.severity}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-zinc-500">{f.file}{f.line ? `:${f.line}` : ""}</span>
                  {f.repo && f.line && canAutoFix(f.rule) && (
                    <button
                      type="button"
                      disabled={!githubConnected}
                      title={!githubConnected ? "Connect GitHub in Control Room to fix" : undefined}
                      onClick={() => {
                        if (!githubConnected) return;
                        setFixTarget(f);
                        setFileContent(null);
                        setFixError(null);
                        setFixLoading(true);
                        fetch(`/api/github/file?repo=${encodeURIComponent(f.repo!)}&path=${encodeURIComponent(f.file)}`, { credentials: "include" })
                          .then((r) => r.json())
                          .then((d) => { setFileContent(d.content ?? null); setFixError(d.error ?? null); })
                          .catch(() => setFixError("Failed to fetch file"))
                          .finally(() => setFixLoading(false));
                      }}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                        githubConnected
                          ? "bg-emerald-900/50 text-emerald-300 hover:bg-emerald-800/50"
                          : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                      }`}
                    >
                      Fix{!githubConnected ? " (connect GitHub)" : ""}
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 font-medium">{f.rule}</p>
              <p className="mt-1 text-sm text-zinc-400">{f.message}</p>
              {f.recommendation && <p className="mt-1 text-xs text-zinc-500">{f.recommendation}</p>}
              <div className="mt-2 flex gap-2 text-[10px] text-zinc-600">
                <span>{f.agentName}</span>
                {f.repo && <span>· {f.repo}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {fixTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setFixTarget(null)}>
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6 max-w-3xl w-full shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Fix: {fixTarget.rule}</h3>
            <p className="text-sm text-zinc-500 mt-1 font-mono">{fixTarget.file}{fixTarget.line ? `:${fixTarget.line}` : ""} · {fixTarget.repo}</p>
            {fixLoading ? (
              <p className="mt-4 text-sm text-zinc-400">Loading file...</p>
            ) : fixError ? (
              <p className="mt-4 text-sm text-red-400">{fixError}</p>
            ) : fileContent && fixTarget.line && fixTarget.line <= fileContent.split("\n").length ? (
              <>
                <div className="mt-5 rounded-lg border border-zinc-700 overflow-hidden">
                  <div className="grid grid-cols-2 divide-x divide-zinc-700">
                    <div className="bg-red-950/30">
                      <div className="px-3 py-2 border-b border-zinc-700 bg-red-950/20">
                        <span className="text-xs font-semibold uppercase tracking-wider text-red-300">Original</span>
                        <span className="ml-2 text-xs text-zinc-500">Line {fixTarget.line}</span>
                      </div>
                      <pre className="p-4 text-sm font-mono overflow-x-auto text-red-200/90 whitespace-pre-wrap break-all min-h-[60px]">
                        {fileContent.split("\n")[fixTarget.line - 1] || " "}
                      </pre>
                    </div>
                    <div className="bg-emerald-950/20">
                      <div className="px-3 py-2 border-b border-zinc-700 bg-emerald-950/30">
                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Suggested fix</span>
                      </div>
                      <pre className="p-4 text-sm font-mono overflow-x-auto text-emerald-200/90 whitespace-pre-wrap break-all min-h-[60px]">
                        {suggestFix(fixTarget.rule, fileContent.split("\n")[fixTarget.line - 1]) || "(remove line)"}
                      </pre>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-xs text-zinc-500">Create PR requires GitHub write scope (not available with Stack Auth). Use Copy fix to apply manually.</p>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    disabled={creatingPR}
                    title="Requires GitHub write scope (Stack Auth OAuth limit)"
                    onClick={async () => {
                      setCreatingPR(true);
                      try {
                        const res = await fetch("/api/github/fix", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({
                            repo: fixTarget.repo,
                            path: fixTarget.file,
                            line: fixTarget.line,
                            rule: fixTarget.rule,
                            content: fileContent,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error ?? "Failed");
                        if (data.prUrl) window.open(data.prUrl, "_blank");
                        setFixTarget(null);
                      } catch (e) {
                        setFixError(String(e instanceof Error ? e.message : "Failed to create PR"));
                      } finally {
                        setCreatingPR(false);
                      }
                    }}
                    className="rounded-xl bg-zinc-700 px-8 py-4 text-base font-semibold text-zinc-400 hover:bg-zinc-600 disabled:opacity-50 transition-colors"
                  >
                    {creatingPR ? "Creating…" : "Create PR (may not work)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const line = fileContent!.split("\n")[fixTarget.line! - 1];
                      const fix = suggestFix(fixTarget.rule, line);
                      navigator.clipboard.writeText(fix || "(remove this line)");
                    }}
                    className="rounded-xl bg-emerald-600 px-8 py-4 text-base font-semibold text-white hover:bg-emerald-500 transition-colors"
                  >
                    Copy fix ✓
                  </button>
                </div>
              </>
            ) : null}
            <button type="button" onClick={() => setFixTarget(null)} className="mt-5 text-sm text-zinc-500 hover:text-zinc-300">Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  ANALYTICS                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function AnalyticsTab({ runs }: { runs: Run[] }) {
  const stats = useMemo(() => {
    const byAgent: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    const byRepo: Record<string, number> = {};
    let totalFindings = 0;
    for (const r of runs) {
      byAgent[r.agentName] = (byAgent[r.agentName] ?? 0) + 1;
      byUser[r.userDisplayName] = (byUser[r.userDisplayName] ?? 0) + 1;
      if (r.repo?.fullName) byRepo[r.repo.fullName] = (byRepo[r.repo.fullName] ?? 0) + 1;
      totalFindings += r.findings?.length ?? 0;
    }
    return { total: runs.length, byAgent, byUser, byRepo, totalFindings };
  }, [runs]);

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500 uppercase">Total Scans</p>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500 uppercase">Total Findings</p>
          <p className="text-2xl font-bold mt-1 text-red-400">{stats.totalFindings}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500 uppercase">Repos Scanned</p>
          <p className="text-2xl font-bold mt-1">{Object.keys(stats.byRepo).length}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500 uppercase">Unique Users</p>
          <p className="text-2xl font-bold mt-1">{Object.keys(stats.byUser).length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Scans by Agent</h3>
          {Object.entries(stats.byAgent).length === 0 ? (
            <p className="text-sm text-zinc-500">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.byAgent).map(([name, count]) => (
                <div key={name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{name}</span>
                    <span className="font-mono text-zinc-400">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full rounded-full bg-violet-500" style={{ width: `${(count / stats.total) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Scans by Repo</h3>
          {Object.entries(stats.byRepo).length === 0 ? (
            <p className="text-sm text-zinc-500">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.byRepo)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([repo, count]) => (
                  <div key={repo} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-zinc-300">{repo}</span>
                    <span className="text-zinc-400">{count}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  COMPLIANCE                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

function ComplianceTab({ runs, user, orgName, hasMfa }: {
  runs: Run[];
  user: ReturnType<typeof useUser> & {};
  orgName: string;
  hasMfa: boolean;
}) {
  const [generated, setGenerated] = useState(false);
  const uniqueUsers = Array.from(new Set(runs.map((r) => r.userDisplayName)));
  const codeReviewRuns = runs.filter((r) => r.agentId === "code-reviewer");

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Security Audit Report</h2>
          <p className="text-sm text-zinc-500">Compliance report from Stack Auth identity + scan audit trail.</p>
        </div>
        <button
          onClick={() => setGenerated(true)}
          className="rounded-lg bg-gradient-to-r from-violet-600 to-sky-600 px-5 py-2 text-sm font-semibold text-white hover:brightness-110"
        >
          Generate Report
        </button>
      </div>

      {generated && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6 space-y-6">
          <div className="border-b border-zinc-800 pb-4">
            <h3 className="text-xl font-bold">Who Ran What — Security Audit Report</h3>
            <p className="text-sm text-zinc-400 mt-1">Workspace: <strong className="text-white">{orgName}</strong> · Generated: {new Date().toLocaleString()}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-800 p-3">
              <p className="text-xs text-zinc-500 uppercase">Total Scans</p>
              <p className="text-xl font-bold mt-0.5">{runs.length}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 p-3">
              <p className="text-xs text-zinc-500 uppercase">Unique Users</p>
              <p className="text-xl font-bold mt-0.5">{uniqueUsers.length}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 p-3">
              <p className="text-xs text-zinc-500 uppercase">Code Review Runs</p>
              <p className="text-xl font-bold mt-0.5">{codeReviewRuns.length}</p>
            </div>
            <div className={`rounded-lg border p-3 ${hasMfa ? "border-emerald-800" : "border-amber-700 bg-amber-950/20"}`}>
              <p className="text-xs text-zinc-500 uppercase">MFA Compliance</p>
              <p className={`text-xl font-bold mt-0.5 ${hasMfa ? "text-emerald-400" : "text-amber-400"}`}>{hasMfa ? "✓" : "⚠ Required"}</p>
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 p-4">
            <h4 className="text-sm font-semibold mb-3">Identity Verification (Stack Auth)</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${user.primaryEmailVerified ? "border-emerald-800/50" : "border-amber-800/50"}`}>
                <span>{user.primaryEmailVerified ? "✓" : "✗"}</span> Email verified
              </div>
              <div className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${user.otpAuthEnabled ? "border-emerald-800/50" : "border-zinc-800"}`}>
                <span>{user.otpAuthEnabled ? "✓" : "—"}</span> TOTP 2FA
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 p-4">
            <h4 className="text-sm font-semibold mb-3">Audit Trail</h4>
            <p className="text-sm text-zinc-400">
              All scans JWT-validated via Stack Auth. Each run stores userId + orgId. Revoke user in Stack → access gone. Impersonation available for support.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  WEBHOOKS, API KEYS, MCP (unchanged structure, minor copy tweaks)           */
/* ────────────────────────────────────────────────────────────────────────── */

function WebhooksTab({ logs }: { logs: WebhookLog[] }) {
  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">Webhook Events</h2>
      <p className="mb-4 text-sm text-zinc-500">Each scan fires a webhook (Stack Auth / Svix).</p>
      {logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 p-12 text-center text-zinc-500">
          <p className="text-lg mb-2">No webhook events yet</p>
          <p className="text-sm">Run a security scan — a webhook fires automatically.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {logs.map((wh) => (
            <li key={wh.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex items-center justify-between gap-2">
                <code className="text-sm font-medium text-emerald-300">{wh.event}</code>
                <span className="rounded bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-300">{wh.status}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{wh.destination}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ApiKeysTab() {
  const user = useUser({ or: "redirect" });
  const [keys, setKeys] = useState<{ id: string; description: string; createdAt: string; prefix: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);

  const createKey = async () => {
    setCreating(true);
    try {
      const key = await user.createApiKey({
        description: `CLI key — ${new Date().toLocaleDateString()}`,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });
      const keyValue = typeof key.value === "string" ? key.value : key.id;
      setNewKeyValue(keyValue);
      setKeys((prev) => [{ id: key.id, description: `CLI key — ${new Date().toLocaleDateString()}`, createdAt: new Date().toISOString(), prefix: keyValue.slice(0, 12) + "…" }, ...prev]);
    } catch {
      setNewKeyValue("error: check API key settings in Stack Auth dashboard");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">API Keys (M2M Auth)</h2>
        <p className="text-sm text-zinc-500">Create keys for CI/CD to trigger security scans programmatically.</p>
      </div>
      <button onClick={createKey} disabled={creating} className="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200 disabled:opacity-50">
        {creating ? "Creating…" : "Create API Key"}
      </button>
      {newKeyValue && (
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4">
          <p className="text-sm text-emerald-300 mb-2">Key created — copy now:</p>
          <code className="block rounded-lg bg-zinc-800 px-4 py-2 text-xs text-white break-all font-mono">{newKeyValue}</code>
        </div>
      )}
      {keys.length > 0 && (
        <ul className="space-y-2">
          {keys.map((k) => (
            <li key={k.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 flex items-center justify-between">
              <span className="font-mono text-sm text-zinc-300">{k.prefix}</span>
              <span className="text-xs text-zinc-600">{new Date(k.createdAt).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function IntegrationsTab() {
  const [config, setConfig] = useState<{ hasClientId: boolean; hasClientSecret: boolean; clientId?: string | null; callbackUrl: string } | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);
  const [oauthSuccess, setOauthSuccess] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    fetch("/api/integrations/github", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setConfig(data))
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    const status = searchParams.get("github_oauth");
    const detail = searchParams.get("msg");
    if (status === "error") {
      const hints: Record<string, string> = {
        bad_verification_code: "Authorization code expired or already used. Try Connect GitHub again.",
        incorrect_client_credentials: "Invalid Client ID or Client Secret. Check and save again.",
        redirect_uri_mismatch: "Callback URL must match exactly. In GitHub OAuth App settings, set Authorization callback URL to the value shown above.",
        application_suspended: "Your GitHub OAuth app may be suspended.",
      };
      setOauthMessage(detail && hints[detail] ? hints[detail] : detail ? `GitHub error: ${detail}` : "GitHub OAuth failed. Check your Client ID/Secret and callback URL.");
      setOauthSuccess(false);
    } else if (status === "no_config") {
      setOauthMessage("Add Client ID and Client Secret first.");
      setOauthSuccess(false);
    } else if (status === "success") {
      setOauthMessage("GitHub connected. Create PR should now work for repos you own.");
      setOauthSuccess(true);
    } else if (!status) {
      setOauthMessage(null);
      setOauthSuccess(false);
    }
  }, [searchParams]);

  const saveCredentials = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/integrations/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clientId: clientId.trim() || undefined, clientSecret: clientSecret ? clientSecret : undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        const next = await fetch("/api/integrations/github", { credentials: "include" }).then((r) => r.json());
        setConfig(next);
        setClientId("");
        setClientSecret("");
      }
    } finally {
      setSaving(false);
    }
  };

  const connectGitHub = () => {
    if (!config?.hasClientId || !config?.hasClientSecret) {
      setOauthMessage("Add and save Client ID and Client Secret first.");
      return;
    }
    const cid = config.clientId;
    const url = config.callbackUrl;
    if (!cid || !url) {
      fetch("/api/integrations/github", { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          if (!data?.clientId || !data?.callbackUrl) {
            setOauthMessage("Client ID not configured. Save credentials first.");
            return;
          }
          window.location.href = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(data.clientId)}&scope=repo&redirect_uri=${encodeURIComponent(data.callbackUrl)}`;
        })
        .catch(() => setOauthMessage("Could not load config."));
      return;
    }
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(cid)}&scope=repo&redirect_uri=${encodeURIComponent(url)}`;
  };

  const hasBoth = config?.hasClientId && config?.hasClientSecret;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="text-sm text-zinc-500">Add your GitHub OAuth app credentials to enable Create PR on findings. Use your own Client ID/Secret for write access.</p>
      </div>

      {oauthMessage && (
        <div className={`rounded-xl border p-4 text-sm ${oauthSuccess ? "border-emerald-800 bg-emerald-950/30 text-emerald-200" : "border-amber-800 bg-amber-950/30 text-amber-200"}`}>
          {oauthMessage}
        </div>
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4 max-w-lg">
        <h3 className="text-sm font-semibold">GitHub OAuth App</h3>
        <p className="text-xs text-zinc-500">Create an OAuth App at GitHub → Settings → Developer settings → OAuth Apps. Set the <strong>Authorization callback URL</strong> to exactly:</p>
        {config?.callbackUrl && (
          <div className="flex gap-2">
            <code className="flex-1 rounded-lg bg-zinc-800 px-4 py-2 text-xs text-emerald-300 break-all font-mono">{config.callbackUrl}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(config!.callbackUrl)}
              className="shrink-0 rounded-lg border border-zinc-600 px-3 py-2 text-xs hover:bg-zinc-800"
            >
              Copy
            </button>
          </div>
        )}
        <p className="text-xs text-zinc-500">Must match exactly: same protocol (http/https), no trailing slash. If using ngrok/tunnel, set <code className="bg-zinc-800 px-1 rounded">NEXT_PUBLIC_APP_URL</code> in .env.</p>
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Client ID</label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder={config?.hasClientId ? "•••••••• (saved)" : "Enter Client ID"}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white placeholder:text-zinc-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Client Secret</label>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={config?.hasClientSecret ? "•••••••• (saved)" : "Enter Client Secret"}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white placeholder:text-zinc-500"
          />
        </div>
        <button onClick={saveCredentials} disabled={saving} className="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200 disabled:opacity-50">
          {saving ? "Saving…" : "Save Credentials"}
        </button>
      </div>

      {hasBoth && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 max-w-lg">
          <h3 className="text-sm font-semibold mb-2">Connect GitHub</h3>
          <p className="text-xs text-zinc-500 mb-4">Authorize with your OAuth app to enable Create PR for findings.</p>
          <button
            onClick={connectGitHub}
            className="rounded-lg bg-zinc-200 px-5 py-2 text-sm font-semibold text-zinc-900 hover:bg-white transition-colors"
          >
            Connect GitHub
          </button>
        </div>
      )}
    </section>
  );
}

function McpTab() {
  const [response, setResponse] = useState<string | null>(null);
  const [querying, setQuerying] = useState(false);
  const queryMcp = async (toolName: string, args: Record<string, unknown> = {}) => {
    setQuerying(true);
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "tools/call", params: { name: toolName, arguments: args } }),
      });
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      setResponse(`Error: ${err}`);
    } finally {
      setQuerying(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">MCP Server</h2>
        <p className="text-sm text-zinc-500">Query scan history from Claude/ChatGPT via <code className="text-xs bg-zinc-800 px-1 rounded">/api/mcp</code>.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
          <h3 className="text-sm font-semibold">Tools</h3>
          {[
            { name: "list_recent_runs", desc: "List recent security scans", args: { limit: 5 } },
            { name: "get_workspace_stats", desc: "Scan statistics", args: {} },
          ].map((tool) => (
            <button key={tool.name} onClick={() => queryMcp(tool.name, tool.args)} disabled={querying} className="w-full text-left rounded-lg border border-zinc-700 p-3 hover:border-zinc-500 disabled:opacity-50">
              <code className="text-sm text-violet-300">{tool.name}</code>
              <p className="text-xs text-zinc-500 mt-0.5">{tool.desc}</p>
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="text-sm font-semibold mb-3">Claude Desktop Config</h3>
          <pre className="rounded-lg bg-zinc-800 p-3 text-xs text-zinc-300 overflow-x-auto">{`{\n  "mcpServers": {\n    "who-ran-what": { "url": "http://localhost:3000/api/mcp" }\n  }\n}`}</pre>
          <p className="text-xs text-zinc-500 mt-3">Ask: &quot;Who ran security scans on vercel/next.js?&quot;</p>
        </div>
      </div>
      {response && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="text-sm font-semibold mb-2 text-zinc-400">Response</h3>
          <pre className="rounded-lg bg-zinc-800 p-4 text-xs text-emerald-300 overflow-x-auto max-h-80 overflow-y-auto">{response}</pre>
        </div>
      )}
    </section>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}
