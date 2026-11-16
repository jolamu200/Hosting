/**
 * GitHub helpers: repo search (by repo name, owner name or pasted URL), repo info for the bot list,
 * and validation of repositories users want to deploy.
 * Optional: set GITHUB_TOKEN in .env to raise GitHub's API rate limit (60 -> 5000 requests/hour).
 */
const API = "https://api.github.com";

interface GhRepo {
  full_name: string;
  name: string;
  owner?: { login?: string; avatar_url?: string };
  description?: string | null;
  html_url: string;
  stargazers_count?: number;
  forks_count?: number;
  language?: string | null;
  private?: boolean;
  archived?: boolean;
  disabled?: boolean;
  size?: number;
  default_branch?: string;
}

export interface RepoCard {
  fullName: string;
  owner: string;
  name: string;
  description: string;
  url: string;
  avatar: string;
  stars: number;
  forks: number;
  language: string;
}

const cache = new Map<string, { t: number; v: unknown }>();
function cached<T>(key: string, ttlMs: number): T | undefined {
  const hit = cache.get(key);
  return hit && Date.now() - hit.t < ttlMs ? (hit.v as T) : undefined;
}
function remember<T>(key: string, v: T): T {
  if (cache.size > 500) cache.clear();
  cache.set(key, { t: Date.now(), v });
  return v;
}

async function gh<T>(path: string): Promise<T | null> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "Bmb-Tech-Hosting",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const token = (process.env.GITHUB_TOKEN || "").trim();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API}${path}`, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const toCard = (r: GhRepo): RepoCard => ({
  fullName: r.full_name,
  owner: r.owner?.login || r.full_name.split("/")[0],
  name: r.name,
  description: r.description || "",
  url: r.html_url,
  avatar: r.owner?.avatar_url || "",
  stars: r.stargazers_count || 0,
  forks: r.forks_count || 0,
  language: r.language || "",
});

/** "https://github.com/o/r", "github.com/o/r.git" or "o/r"  ->  { owner, repo } */
export function parseRepoRef(input: string): { owner: string; repo: string } | null {
  const q = input.trim();
  const m = q.match(/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i) || q.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export async function getRepoCard(owner: string, repo: string): Promise<RepoCard | null> {
  const key = `repo:${owner}/${repo}`.toLowerCase();
  const hit = cached<RepoCard | null>(key, 60 * 60 * 1000);
  if (hit !== undefined) return hit;
  const r = await gh<GhRepo>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  return remember(key, r && !r.private ? toCard(r) : null);
}

export async function searchRepos(raw: string): Promise<RepoCard[]> {
  const q = raw.trim().slice(0, 100);
  if (q.length < 2) return [];
  const key = `search:${q.toLowerCase()}`;
  const hit = cached<RepoCard[]>(key, 5 * 60 * 1000);
  if (hit) return hit;

  const ref = parseRepoRef(q);
  if (ref) {
    const one = await getRepoCard(ref.owner, ref.repo);
    return remember(key, one ? [one] : []);
  }

  const out: RepoCard[] = [];
  const seen = new Set<string>();
  const push = (r: GhRepo) => {
    if (r.private || r.archived || r.disabled) return;
    const id = r.full_name.toLowerCase();
    if (seen.has(id)) return;
    seen.add(id);
    out.push(toCard(r));
  };

  const asUser = /^[\w-]{1,39}$/.test(q);
  const [byUser, byName] = await Promise.all([
    asUser ? gh<GhRepo[]>(`/users/${encodeURIComponent(q)}/repos?per_page=30&sort=updated`) : Promise.resolve(null),
    gh<{ items?: GhRepo[] }>(`/search/repositories?q=${encodeURIComponent(q + " in:name")}&per_page=30&sort=stars&order=desc`),
  ]);
  (Array.isArray(byUser) ? byUser : []).forEach(push);   // that person's own repos first
  (byName?.items || []).forEach(push);
  return remember(key, out.slice(0, 40));
}

export interface DeployableRepo { card: RepoCard; branch: string; logo: string }

/** Public, not archived, reasonable size, and ships an app.json (needed to deploy). */
export async function validateDeployableRepo(owner: string, repo: string): Promise<{ ok: true; value: DeployableRepo } | { ok: false; error: string }> {
  const r = await gh<GhRepo>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  if (!r) return { ok: false, error: "Repository not found or GitHub is busy. Try again in a moment." };
  if (r.private) return { ok: false, error: "Only public repositories can be deployed." };
  if (r.archived || r.disabled) return { ok: false, error: "This repository is archived or disabled." };
  if ((r.size || 0) > 150_000) return { ok: false, error: "This repository is too large to deploy." };
  const branch = r.default_branch || "main";
  let logo = "";
  try {
    const raw = await fetch(`https://raw.githubusercontent.com/${r.full_name}/${branch}/app.json`, { signal: AbortSignal.timeout(8000) });
    if (!raw.ok) return { ok: false, error: "This repository has no app.json, so it can't be deployed here." };
    const json = (await raw.json().catch(() => null)) as { env?: unknown; logo?: string; image?: string } | null;
    if (!json || typeof json !== "object") return { ok: false, error: "The repository's app.json is not valid." };
    logo = json.logo || json.image || "";
  } catch {
    return { ok: false, error: "Could not read the repository's app.json." };
  }
  return { ok: true, value: { card: toCard(r), branch, logo } };
}
