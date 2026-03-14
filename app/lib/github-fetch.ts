const MAX_FILES = 40;
const MAX_SIZE = 100_000;
const SCAN_EXT = [".js", ".jsx", ".ts", ".tsx", ".json", ".env", ".env.example", ".yml", ".yaml", "Dockerfile", "docker-compose"];
const IGNORE = ["node_modules", ".git", "dist", "build", ".next", "coverage"];

type GHItem = { name: string; path: string; type: "file" | "dir"; content?: string; encoding?: string };
type GHResponse = GHItem | GHItem[];

async function fetchGH<T = GHResponse>(url: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "WhoRanWhat-Security",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

function shouldScan(path: string): boolean {
  if (IGNORE.some((d) => path.includes(`/${d}/`) || path.startsWith(d))) return false;
  return SCAN_EXT.some((e) => path.endsWith(e) || path.includes(e));
}

export async function fetchRepoContents(
  owner: string,
  repo: string,
  token?: string
): Promise<{ path: string; content: string }[]> {
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const files: { path: string; content: string }[] = [];

  async function walk(path: string): Promise<void> {
    if (files.length >= MAX_FILES) return;
    const url = path ? `${base}/contents/${path}?ref=HEAD` : `${base}/contents?ref=HEAD`;
    const data = await fetchGH(url, token) as GHItem[];

    if (!Array.isArray(data)) {
      const file = data as GHItem;
      if (file.type === "file" && (file as { content?: string }).content) {
        const content = Buffer.from((file as { content: string }).content, "base64").toString("utf-8");
        if (content.length < MAX_SIZE && shouldScan(file.path)) {
          files.push({ path: file.path, content });
        }
      }
      return;
    }

    const items = data as GHItem[];
    const filesFirst = [...items.filter((i) => i.type === "file")];
    const dirsSecond = [...items.filter((i) => i.type === "dir")];
    for (const item of [...filesFirst, ...dirsSecond]) {
      if (files.length >= MAX_FILES) return;
      if (IGNORE.includes(item.name)) continue;
      if (item.type === "dir") await walk(item.path);
      else if (item.type === "file" && shouldScan(item.path)) {
        try {
          const fileData = await fetchGH<GHItem & { content?: string }>(`${base}/contents/${item.path}?ref=HEAD`, token);
          if (fileData.content) {
            const content = Buffer.from(fileData.content, "base64").toString("utf-8");
            if (content.length < MAX_SIZE) files.push({ path: item.path, content });
          }
        } catch {
          // skip failed files
        }
      }
    }
  }

  await walk("");
  return files;
}
