import { NextRequest, NextResponse } from "next/server";
import { listRuns, getRun, getRunStats } from "@/app/lib/runs-store";

const TOOLS = [
  {
    name: "list_recent_runs",
    description: "List recent AI agent runs. Optionally filter by workspace (orgId), user (userId), or agent (agentId).",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "Filter by workspace/org ID" },
        userId: { type: "string", description: "Filter by user ID" },
        agentId: { type: "string", description: "Filter by agent ID (researcher, writer, coder, analyst)" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "get_run_details",
    description: "Get full details of a specific agent run by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "The run ID" },
      },
      required: ["runId"],
    },
  },
  {
    name: "get_workspace_stats",
    description: "Get aggregated stats: total runs, runs by agent, runs by user. Optionally scoped to a workspace.",
    inputSchema: {
      type: "object",
      properties: {
        orgId: { type: "string", description: "Scope stats to this workspace/org ID" },
      },
    },
  },
];

export async function GET() {
  return NextResponse.json({
    name: "who-ran-what",
    version: "1.0.0",
    description: "MCP server for Who Ran What — query AI agent run history, audit trails, and workspace stats.",
    tools: TOOLS,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { method, params } = body;

    if (method === "tools/list") {
      return NextResponse.json({ tools: TOOLS });
    }

    if (method === "tools/call") {
      const { name, arguments: args } = params ?? {};

      if (name === "list_recent_runs") {
        const runs = listRuns({
          orgId: args?.orgId,
          userId: args?.userId,
          agentId: args?.agentId,
          limit: args?.limit ?? 20,
        });
        return NextResponse.json({
          content: [{ type: "text", text: JSON.stringify(runs, null, 2) }],
        });
      }

      if (name === "get_run_details") {
        const run = getRun(args?.runId);
        if (!run) {
          return NextResponse.json({
            content: [{ type: "text", text: "Run not found." }],
            isError: true,
          });
        }
        return NextResponse.json({
          content: [{ type: "text", text: JSON.stringify(run, null, 2) }],
        });
      }

      if (name === "get_workspace_stats") {
        const stats = getRunStats(args?.orgId);
        return NextResponse.json({
          content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
        });
      }

      return NextResponse.json({
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      });
    }

    return NextResponse.json({ error: "Unknown method" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
