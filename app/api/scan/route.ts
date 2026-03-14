import { NextRequest, NextResponse } from "next/server";
import { stackServerApp } from "@/stack/server";
import { addRun } from "@/app/lib/runs-store";
import { fetchRepoContents } from "@/app/lib/github-fetch";
import { scanSecrets, scanDependencies, scanCode, scanConfig } from "@/app/lib/scan-engine";
import type { Finding } from "@/app/lib/scan-engine";

const SCANNERS: Record<string, (files: { path: string; content: string }[]) => Finding[]> = {
  "secret-scanner": scanSecrets,
  "dependency-checker": scanDependencies,
  "code-reviewer": scanCode,
  "config-auditor": scanConfig,
};

export async function POST(req: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { repoOwner, repoName, agentId } = body;

    if (!repoOwner || !repoName || !agentId) {
      return NextResponse.json(
        { error: "repoOwner, repoName, and agentId required" },
        { status: 400 }
      );
    }

    const agentNames: Record<string, string> = {
      "secret-scanner": "Secret Scanner",
      "dependency-checker": "Dependency Checker",
      "code-reviewer": "Code Reviewer",
      "config-auditor": "Config Auditor",
    };
    const agentName = agentNames[agentId] ?? agentId;

    if (!SCANNERS[agentId]) {
      return NextResponse.json({ error: `Unknown agent: ${agentId}` }, { status: 400 });
    }

    let token: string | undefined;
    try {
      const accounts = await user.listConnectedAccounts();
      const github = accounts.find((a: { provider?: string; id?: string }) => a.provider === "github" || a.id === "github");
      if (github && "getAccessToken" in github) {
        const result = await (github as { getAccessToken: () => Promise<{ status: string; data?: { accessToken: string } }> }).getAccessToken();
        if (result.status === "ok" && result.data) token = result.data.accessToken;
      }
    } catch {
      // continue without token — public API
    }

    const fullName = `${repoOwner}/${repoName}`;
    const files = await fetchRepoContents(repoOwner, repoName, token);
    const scanFn = SCANNERS[agentId];
    const findings = scanFn(files);

    const critical = findings.filter((f) => f.severity === "critical").length;
    const high = findings.filter((f) => f.severity === "high").length;
    const summary =
      findings.length === 0
        ? `No issues found. Scanned ${files.length} files.`
        : `Found ${findings.length} issue(s): ${critical} critical, ${high} high. Scanned ${files.length} files.`;

    const run = addRun({
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      agentId,
      agentName,
      status: "completed",
      userId: user.id,
      userDisplayName: user.displayName ?? user.primaryEmail ?? "Unknown",
      orgId: user.selectedTeam?.id ?? "personal",
      orgName: user.selectedTeam?.displayName ?? "Personal",
      result: summary,
      createdAt: new Date().toISOString(),
      repo: { owner: repoOwner, name: repoName, fullName },
      findings,
    });

    return NextResponse.json(run);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Scan failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
