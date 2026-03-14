import { NextRequest, NextResponse } from "next/server";
import { stackServerApp } from "@/stack/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const CONFIG_PATH = join(process.cwd(), ".github-oauth.json");

type Config = { clientId?: string; clientSecret?: string };

function readConfig(): Config {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

export async function GET() {
  try {
    await stackServerApp.getUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const config = readConfig();
  return NextResponse.json({
    hasClientId: !!config.clientId,
    hasClientSecret: !!config.clientSecret,
    clientId: config.clientId || null,
    callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/github/oauth/callback`,
  });
}

export async function POST(req: NextRequest) {
  try {
    await stackServerApp.getUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { clientId, clientSecret } = body as { clientId?: string; clientSecret?: string };
  const config = readConfig();
  if (clientId !== undefined) config.clientId = clientId;
  if (clientSecret !== undefined) config.clientSecret = clientSecret;
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (e) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
