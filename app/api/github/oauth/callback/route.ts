import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const CONFIG_PATH = join(process.cwd(), ".github-oauth.json");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code) return NextResponse.redirect(new URL("/dashboard?tab=integrations&github_oauth=error", req.url));

  let config: { clientId?: string; clientSecret?: string } = {};
  if (existsSync(CONFIG_PATH)) {
    try {
      config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    } catch {}
  }
  if (!config.clientId || !config.clientSecret) {
    return NextResponse.redirect(new URL("/dashboard?tab=integrations&github_oauth=no_config", req.url));
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/github/oauth/callback`;

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
      state,
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };

  if (!data.access_token) {
    return NextResponse.redirect(new URL(`/dashboard?tab=integrations&github_oauth=error&msg=${encodeURIComponent(data.error || "no_token")}`, req.url));
  }

  const response = NextResponse.redirect(new URL("/dashboard?tab=integrations&github_oauth=success", req.url));
  response.cookies.set("gh_write_token", data.access_token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return response;
}
