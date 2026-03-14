import { NextRequest, NextResponse } from "next/server";
import { stackServerApp } from "@/stack/server";
import { listRuns, getRunStats } from "@/app/lib/runs-store";

export async function GET(req: NextRequest) {
  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId") ?? undefined;
  const userId = url.searchParams.get("userId") ?? undefined;
  const agentId = url.searchParams.get("agentId") ?? undefined;
  const stats = url.searchParams.get("stats") === "true";
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

  if (stats) {
    return NextResponse.json(getRunStats(orgId));
  }

  return NextResponse.json(listRuns({ orgId, userId, agentId, limit }));
}
