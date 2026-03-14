import { NextResponse } from "next/server";
import { stackServerApp } from "@/stack/server";

export async function GET() {
  try {
    const user = await stackServerApp.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accounts = await user.listConnectedAccounts();
    const github = accounts.find((a: { provider?: string; id?: string }) => a.provider === "github" || a.id === "github");
    if (!github || !("getAccessToken" in github)) {
      return NextResponse.json({ repos: [], connected: false });
    }

    const result = await (github as { getAccessToken: () => Promise<{ status: string; data?: { accessToken: string } }> }).getAccessToken();
    if (result.status !== "ok" || !result.data) {
      return NextResponse.json({ repos: [], connected: false });
    }

    const res = await fetch("https://api.github.com/user/repos?per_page=30&sort=updated", {
      headers: {
        Authorization: `Bearer ${result.data.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    if (!res.ok) return NextResponse.json({ repos: [], connected: true });

    const data = await res.json();
    const repos = (data as { full_name: string; name: string; private?: boolean }[]).map((r) => ({
      fullName: r.full_name,
      name: r.name,
      owner: r.full_name.split("/")[0],
      private: r.private,
    }));

    return NextResponse.json({ repos, connected: true });
  } catch {
    return NextResponse.json({ repos: [], connected: false });
  }
}
