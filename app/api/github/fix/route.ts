import { NextResponse } from "next/server";
import { stackServerApp } from "@/stack/server";
import { suggestFix } from "@/app/lib/fix-suggestions";

const BASE = "https://api.github.com/repos";

export async function POST(req: Request) {
  try {
    const user = await stackServerApp.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { repo, path, line, rule, content: fullContent } = body as {
      repo: string;
      path: string;
      line: number;
      rule: string;
      content: string;
    };
    if (!repo || !path || !line || !rule || !fullContent) {
      return NextResponse.json({ error: "Missing repo, path, line, rule, or content" }, { status: 400 });
    }

    const [owner, name] = repo.split("/");
    if (!owner || !name) return NextResponse.json({ error: "Invalid repo format" }, { status: 400 });

    const accounts = await user.listConnectedAccounts();
    const github = accounts.find((a: { provider?: string }) => a.provider === "github");
    if (!github || !("getAccessToken" in github)) {
      return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
    }

    const ghWriteToken = req.cookies?.get?.("gh_write_token")?.value;
    let token: string | undefined;
    if (ghWriteToken) {
      token = ghWriteToken;
    } else {
      const result = await (github as { getAccessToken: () => Promise<{ status: string; data?: { accessToken: string } }> }).getAccessToken();
      if (result.status !== "ok" || !result.data) {
        return NextResponse.json({ error: "Failed to get GitHub token" }, { status: 400 });
      }
      token = result.data.accessToken;
    }
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    };

    const lineIndex = line - 1;
    const lines = fullContent.split("\n");
    const oldLine = lines[lineIndex];
    if (oldLine === undefined) return NextResponse.json({ error: "Line out of range" }, { status: 400 });

    const fixedLine = suggestFix(rule, oldLine);
    const newLines = [...lines];
    if (fixedLine === "") {
      newLines.splice(lineIndex, 1);
    } else {
      const indent = oldLine.match(/^\s*/)?.[0] ?? "";
      newLines[lineIndex] = indent + fixedLine.trim();
    }
    const newContent = newLines.join("\n");

    const branchName = `fix/security-${rule.toLowerCase()}-${Date.now()}`;

    // Resolve repo: use fork if no push access (404 on repo)
    let targetOwner = owner;
    let targetRepo = name;

    const repoRes = await fetch(`${BASE}/${owner}/${name}`, { headers });
    if (!repoRes.ok) {
      if (repoRes.status === 404) {
        return NextResponse.json({ error: "Repo not found or you don't have access. Use a repo you own or have push access to." }, { status: 400 });
      }
      return NextResponse.json({ error: `GitHub API ${repoRes.status}` }, { status: repoRes.status });
    }

    const repoData = (await repoRes.json()) as { default_branch?: string; permissions?: { push?: boolean } };
    const defaultBranch = repoData.default_branch ?? "main";

    const userRes = await fetch("https://api.github.com/user", { headers });
    if (!userRes.ok) return NextResponse.json({ error: "Could not get GitHub user" }, { status: 400 });
    const userData = (await userRes.json()) as { login?: string };
    const myLogin = userData.login;
    if (!myLogin) return NextResponse.json({ error: "Could not get GitHub username" }, { status: 400 });

    const hasPushAccess = repoData.permissions?.push === true;
    const isOwner = owner.toLowerCase() === myLogin.toLowerCase();

    // If we don't own the repo and don't have push access, try to fork
    if (!isOwner && !hasPushAccess) {
      const forkRes = await fetch(`${BASE}/${owner}/${name}/forks`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
      });
      if (!forkRes.ok) {
        return NextResponse.json({
          error: `Can't fix ${owner}/${name} — you don't have push access (GitHub: ${myLogin}). Only Fix findings from ${myLogin}/* repos.`,
        }, { status: 400 });
      }
      const forkData = (await forkRes.json()) as { full_name?: string; owner?: { login?: string } };
      targetOwner = forkData.owner?.login ?? myLogin;
      targetRepo = name;
    }

    const refUrl = `${BASE}/${targetOwner}/${targetRepo}/git/ref/heads/${defaultBranch}`;
    const refRes = await fetch(refUrl, { headers });
    if (!refRes.ok) {
      const refErr = await refRes.text();
      return NextResponse.json({ error: `Could not get branch ref: ${refErr}` }, { status: refRes.status });
    }
    const refData = (await refRes.json()) as { object?: { sha?: string } };
    const commitSha = refData.object?.sha;
    if (!commitSha || commitSha.length !== 40) {
      return NextResponse.json({ error: "Invalid commit SHA from GitHub" }, { status: 400 });
    }

    const createBranchRes = await fetch(`${BASE}/${targetOwner}/${targetRepo}/git/refs`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: commitSha }),
    });
    if (!createBranchRes.ok) {
      const err = await createBranchRes.text();
      if (createBranchRes.status === 404) {
        return NextResponse.json({
          error: "GitHub token lacks write scope (Stack Auth OAuth limit). Use 'Copy fix' button instead, then paste the fix into your repo manually.",
        }, { status: 400 });
      }
      return NextResponse.json({ error: `Failed to create branch: ${err}` }, { status: createBranchRes.status });
    }

    const fileRes = await fetch(`${BASE}/${targetOwner}/${targetRepo}/contents/${encodeURIComponent(path)}?ref=${branchName}`, { headers });
    const fileData = (await fileRes.json()) as { sha?: string };
    if (!fileData.sha) return NextResponse.json({ error: "Could not get file sha" }, { status: 400 });

    const updateRes = await fetch(`${BASE}/${targetOwner}/${targetRepo}/contents/${encodeURIComponent(path)}`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `fix(security): resolve ${rule} in ${path}`,
        content: Buffer.from(newContent).toString("base64"),
        sha: fileData.sha,
        branch: branchName,
      }),
    });
    if (!updateRes.ok) {
      const err = await updateRes.text();
      return NextResponse.json({ error: `Failed to update file: ${err}` }, { status: updateRes.status });
    }

    const prHead = targetOwner !== owner ? `${targetOwner}:${branchName}` : branchName;
    const prRes = await fetch(`${BASE}/${owner}/${name}/pulls`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `[Security] Fix ${rule} in ${path}`,
        head: prHead,
        base: defaultBranch,
        body: `Automated fix for security finding: **${rule}**\n\nFile: \`${path}\`\nLine: ${line}\n\nReview and merge when ready.`,
      }),
    });
    if (!prRes.ok) {
      const err = await prRes.text();
      return NextResponse.json({ error: `File updated but PR creation failed: ${err}` }, { status: prRes.status });
    }

    const prData = (await prRes.json()) as { html_url?: string; number?: number };
    return NextResponse.json({ prUrl: prData.html_url, prNumber: prData.number });
  } catch (e) {
    return NextResponse.json({ error: "Failed to create fix" }, { status: 500 });
  }
}
