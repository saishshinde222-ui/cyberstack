import { NextResponse } from "next/server";
import { stackServerApp } from "@/stack/server";

const BASE = "https://api.github.com/repos";

export async function GET(req: Request) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const repo = searchParams.get("repo");
    const path = searchParams.get("path");
    if (!repo || !path) return NextResponse.json({ error: "Missing repo or path" }, { status: 400 });

    const [owner, name] = repo.split("/");
    if (!owner || !name) return NextResponse.json({ error: "Invalid repo format" }, { status: 400 });

    const accounts = await user.listConnectedAccounts();
    const github = accounts.find((a: { provider?: string }) => a.provider === "github");
    if (!github || !("getAccessToken" in github)) {
      return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
    }

    const result = await (github as { getAccessToken: () => Promise<{ status: string; data?: { accessToken: string } }> }).getAccessToken();
    if (result.status !== "ok" || !result.data) {
      return NextResponse.json({ error: "Failed to get GitHub token" }, { status: 400 });
    }

    const url = `${BASE}/${owner}/${name}/contents/${encodeURIComponent(path)}?ref=HEAD`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${result.data.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    if (!res.ok) return NextResponse.json({ error: `GitHub API ${res.status}` }, { status: res.status });

    const data = (await res.json()) as { content?: string; encoding?: string };
    if (!data.content) return NextResponse.json({ error: "No content" }, { status: 404 });

    const content = Buffer.from(data.content, (data.encoding as BufferEncoding) || "base64").toString("utf-8");
    return NextResponse.json({ content, path });
  } catch {
    return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 });
  }
}
