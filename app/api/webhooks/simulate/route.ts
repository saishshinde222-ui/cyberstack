import { NextRequest, NextResponse } from "next/server";
import { stackServerApp } from "@/stack/server";

export async function POST(req: NextRequest) {
  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { event, payload } = body;

  const webhook = {
    id: `wh-${Date.now()}`,
    event: event ?? "agent.run.completed",
    payload: payload ?? {
      agentName: "Researcher",
      userId: user.id,
      userDisplayName: user.displayName,
      orgId: user.selectedTeam?.id ?? "personal",
      orgName: user.selectedTeam?.displayName ?? "Personal",
      timestamp: new Date().toISOString(),
    },
    deliveredAt: new Date().toISOString(),
    status: "delivered",
    destination: "https://hooks.slack.com/services/T00/B00/xxx (simulated)",
  };

  return NextResponse.json(webhook);
}
