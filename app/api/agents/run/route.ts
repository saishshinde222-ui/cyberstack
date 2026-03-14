import { NextRequest, NextResponse } from "next/server";
import { stackServerApp } from "@/stack/server";
import { addRun } from "@/app/lib/runs-store";

const AGENT_OUTPUTS: Record<string, string[]> = {
  researcher: [
    "Found 12 relevant papers on transformer architectures. Key finding: attention scaling improves with sparse patterns.",
    "Market analysis complete: SaaS auth market growing 23% YoY. Top competitor gaps identified in team management.",
    "Summarized 8 customer interviews. Common theme: teams need audit trails for AI agent usage.",
  ],
  writer: [
    "Draft blog post ready: '5 Reasons Your AI Agents Need Identity Management' — 1,200 words, SEO-optimized.",
    "Release notes generated for v2.4: 3 new features, 2 bug fixes, 1 breaking change documented.",
    "Email sequence drafted: 4 emails for onboarding flow, personalized with user's team name.",
  ],
  coder: [
    "Refactored auth middleware: reduced token validation from 45ms to 12ms. 3 files changed, tests passing.",
    "Generated TypeScript types from OpenAPI spec: 47 interfaces, 12 enums, full JSDoc coverage.",
    "Code review complete: found 2 security issues (SQL injection in search, missing CSRF token). PRs created.",
  ],
  analyst: [
    "Dashboard report: 340 agent runs this week, 94% success rate. Top agent: Researcher (142 runs).",
    "Cost analysis: estimated $23.40 in API costs this month. Recommendation: cache Researcher results.",
    "Team productivity up 18% since adding Writer agent. Bottleneck: Code agent queue times.",
  ],
};

export async function POST(req: NextRequest) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized — no valid Stack Auth session" }, { status: 401 });
    }

    const body = await req.json();
    const { agentId, agentName, pipeInput } = body;

    if (!agentId || !agentName) {
      return NextResponse.json({ error: "agentId and agentName required" }, { status: 400 });
    }

    const selectedTeam = user.selectedTeam;
    const orgId = selectedTeam?.id ?? "personal";
    const orgName = selectedTeam?.displayName ?? "Personal";

    let result: string;
    if (pipeInput) {
      const PIPE_TEMPLATES: Record<string, (input: string) => string> = {
        researcher: (input) => `Research context from previous step: "${input.slice(0, 80)}…" → Found 8 supporting sources. Key insight: the data confirms the hypothesis with 92% confidence.`,
        writer: (input) => `Based on: "${input.slice(0, 60)}…" → Drafted a 1,200-word blog post with SEO optimization. Title: "What the Data Really Says" — ready for review.`,
        coder: (input) => `Implementing from: "${input.slice(0, 60)}…" → Generated TypeScript module with 3 functions, input validation, error handling, and unit tests (14/14 passing).`,
        analyst: (input) => `Analyzing: "${input.slice(0, 60)}…" → Report generated. Sentiment: 78% positive. Key metric: 3.2x improvement over baseline. Recommendation: proceed with rollout.`,
      };
      result = PIPE_TEMPLATES[agentId]?.(pipeInput) ?? `[${agentName}] Processed piped input successfully.`;
    } else {
      const outputs = AGENT_OUTPUTS[agentId] ?? [`[${agentName}] Task completed successfully.`];
      result = outputs[Math.floor(Math.random() * outputs.length)];
    }

    const run = addRun({
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      agentId,
      agentName,
      status: "completed",
      userId: user.id,
      userDisplayName: user.displayName ?? user.primaryEmail ?? "Unknown",
      orgId,
      orgName,
      result,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(run);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
