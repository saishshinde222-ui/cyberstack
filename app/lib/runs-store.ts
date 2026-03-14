export type Finding = {
  severity: "critical" | "high" | "medium" | "low";
  rule: string;
  file: string;
  line?: number;
  message: string;
  recommendation?: string;
};

export type Run = {
  id: string;
  agentId: string;
  agentName: string;
  status: "completed" | "failed";
  userId: string;
  userDisplayName: string;
  orgId: string;
  orgName: string;
  result: string;
  createdAt: string;
  repo?: { owner: string; name: string; fullName: string };
  findings?: Finding[];
};

const runs: Run[] = [];

export function addRun(run: Run) {
  runs.unshift(run);
  if (runs.length > 200) runs.length = 200;
  return run;
}

export function listRuns(filters?: { orgId?: string; userId?: string; agentId?: string; repoFullName?: string; limit?: number }) {
  let result = [...runs];
  if (filters?.orgId) result = result.filter((r) => r.orgId === filters.orgId);
  if (filters?.userId) result = result.filter((r) => r.userId === filters.userId);
  if (filters?.agentId) result = result.filter((r) => r.agentId === filters.agentId);
  if (filters?.repoFullName) result = result.filter((r) => r.repo?.fullName === filters.repoFullName);
  if (filters?.limit) result = result.slice(0, filters.limit);
  return result;
}

export function getRun(id: string) {
  return runs.find((r) => r.id === id) ?? null;
}

export function getRunStats(orgId?: string) {
  const scoped = orgId ? runs.filter((r) => r.orgId === orgId) : runs;
  const byAgent: Record<string, number> = {};
  const byUser: Record<string, number> = {};
  const byRepo: Record<string, number> = {};
  let totalFindings = 0;
  for (const r of scoped) {
    byAgent[r.agentName] = (byAgent[r.agentName] ?? 0) + 1;
    byUser[r.userDisplayName] = (byUser[r.userDisplayName] ?? 0) + 1;
    if (r.repo?.fullName) byRepo[r.repo.fullName] = (byRepo[r.repo.fullName] ?? 0) + 1;
    if (r.findings) totalFindings += r.findings.length;
  }
  return { total: scoped.length, byAgent, byUser, byRepo, totalFindings };
}
