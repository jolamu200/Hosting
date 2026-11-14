const HEROKU_API_KEY = process.env.HEROKU_API_KEY || "";
import { DEFAULT_BOT_REPO } from "../config.js";

const herokuHeaders = {
  Authorization: `Bearer ${HEROKU_API_KEY}`,
  Accept: "application/vnd.heroku+json; version=3",
  "Content-Type": "application/json"
};

export async function getTeamAppCount(team: string): Promise<number> {
  const res = await fetch(`https://api.heroku.com/teams/${team}/apps`, { headers: herokuHeaders });
  if (!res.ok) return Infinity;
  const apps = await res.json() as Array<Record<string, unknown>>;
  return apps.length;
}

export async function findBestTeam(teams: string[]): Promise<string | null> {
  let bestTeam: string | null = null;
  let lowestCount = Infinity;
  for (const team of teams) {
    const count = await getTeamAppCount(team);
    if (count < lowestCount) { lowestCount = count; bestTeam = team; }
  }
  return bestTeam;
}

export async function deployBotApp(appName: string, team: string, session: string, phoneNumber: string, isTrial: boolean = false, sourceUrlOverride?: string, envOverrides?: Record<string, string>): Promise<{ success: boolean; setupId?: string }> {
  const sourceUrl = sourceUrlOverride || (DEFAULT_BOT_REPO ? `${DEFAULT_BOT_REPO.replace(/\/+$/, "")}/tarball/main` : "");
  const baseEnv = envOverrides || { SESSION: session, BOT_NAME: appName, OWNER_NUMBER: phoneNumber, HEROKU_API_KEY: HEROKU_API_KEY, HEROKU_APP_NAME: appName };
  const env = { ...baseEnv, HEROKU_APP_NAME: baseEnv.HEROKU_APP_NAME || appName, BMBHOSTING: "1", TOXICHOSTING: "1" };
  console.log(`[DEPLOY] app=${appName} team=${team} isTrial=${isTrial} env=${JSON.stringify(env)}`);
  const res = await fetch("https://api.heroku.com/app-setups", {
    method: "POST",
    headers: herokuHeaders,
    body: JSON.stringify({
      app: { name: appName, organization: team },
      source_blob: { url: sourceUrl },
      overrides: { env }
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.log(`[DEPLOY] app-setups FAILED app=${appName} status=${res.status} body=${body}`);
    return { success: false };
  }
  const data = await res.json() as { id?: string; status?: string };
  console.log(`[DEPLOY] app-setups accepted app=${appName} setupId=${data.id} status=${data.status}`);
  return { success: true, setupId: data.id };
}


export async function getSetupStatus(setupId: string): Promise<{ status: string; build?: Record<string, unknown> }> {
  const res = await fetch(`https://api.heroku.com/app-setups/${setupId}`, { headers: herokuHeaders });
  if (!res.ok) return { status: "unknown" };
  const data = await res.json() as { status?: string; build?: Record<string, unknown> };
  return { status: data.status || "unknown", build: data.build };
}

export async function appExists(appName: string): Promise<boolean> {
  const res = await fetch(`https://api.heroku.com/apps/${appName}`, { headers: herokuHeaders });
  return res.ok;
}

export async function deleteApp(appName: string): Promise<boolean> {
  const res = await fetch(`https://api.heroku.com/apps/${appName}`, { method: "DELETE", headers: herokuHeaders });
  return res.ok || res.status === 404;
}

export async function restartApp(appName: string): Promise<boolean> {
  const res = await fetch(`https://api.heroku.com/apps/${appName}/dynos`, { method: "DELETE", headers: herokuHeaders });
  return res.ok;
}

export async function getAppStatus(appName: string): Promise<string> {
  const [appRes, dynoRes] = await Promise.all([
    fetch(`https://api.heroku.com/apps/${appName}`, { headers: herokuHeaders }),
    fetch(`https://api.heroku.com/apps/${appName}/dynos`, { headers: herokuHeaders })
  ]);
  if (!appRes.ok) return appRes.status === 404 ? "deleted" : "unknown";
  const app = await appRes.json() as { maintenance?: boolean };
  if (app.maintenance) return "stopped";
  if (!dynoRes.ok) return "unknown";
  const dynos = await dynoRes.json() as Array<{ state: string; type: string }>;
  const webDynos = dynos.filter(d => d.type === "web");
  if (webDynos.length === 0) return "stopped";
  const hasUp = webDynos.some(d => d.state === "up" || d.state === "starting");
  return hasUp ? "running" : "stopped";
}

export async function getAppLogs(appName: string): Promise<string> {
  const res = await fetch(`https://api.heroku.com/apps/${appName}/log-sessions`, {
    method: "POST",
    headers: herokuHeaders,
    body: JSON.stringify({ lines: 200, tail: false })
  });
  if (!res.ok) return "No logs available";
  const data = await res.json() as { logplex_url?: string };
  if (!data.logplex_url) return "No logs available";
  const logRes = await fetch(data.logplex_url);
  if (!logRes.ok) return "Failed to fetch logs";
  return await logRes.text();
}

export async function scaleDyno(appName: string, type: string, quantity: number): Promise<boolean> {
  const res = await fetch(`https://api.heroku.com/apps/${appName}/formation/${type}`, {
    method: "PATCH",
    headers: herokuHeaders,
    body: JSON.stringify({ quantity })
  });
  return res.ok;
}

export async function stopApp(appName: string): Promise<boolean> {
  // Try to scale web dyno to 0 first; fall back to maintenance mode
  const scaled = await scaleDyno(appName, "web", 0).catch(() => false);
  if (!scaled) {
    // Fall back to maintenance mode
    const res = await fetch(`https://api.heroku.com/apps/${appName}`, {
      method: "PATCH",
      headers: herokuHeaders,
      body: JSON.stringify({ maintenance: true })
    });
    return res.ok;
  }
  return scaled;
}

export async function startApp(appName: string): Promise<boolean> {
  // Try to scale web dyno back to 1 first; fall back to disabling maintenance mode
  const scaled = await scaleDyno(appName, "web", 1).catch(() => false);
  if (!scaled) {
    const res = await fetch(`https://api.heroku.com/apps/${appName}`, {
      method: "PATCH",
      headers: herokuHeaders,
      body: JSON.stringify({ maintenance: false })
    });
    return res.ok;
  }
  return scaled;
}

export async function enableMaintenanceMode(appName: string): Promise<boolean> {
  const res = await fetch(`https://api.heroku.com/apps/${appName}`, {
    method: "PATCH",
    headers: herokuHeaders,
    body: JSON.stringify({ maintenance: true })
  });
  return res.ok;
}

export async function disableMaintenanceMode(appName: string): Promise<boolean> {
  const res = await fetch(`https://api.heroku.com/apps/${appName}`, {
    method: "PATCH",
    headers: herokuHeaders,
    body: JSON.stringify({ maintenance: false })
  });
  return res.ok;
}

export async function setConfigVar(appName: string, key: string, value: string): Promise<boolean> {
  const res = await fetch(`https://api.heroku.com/apps/${appName}/config-vars`, {
    method: "PATCH",
    headers: herokuHeaders,
    body: JSON.stringify({ [key]: value })
  });
  return res.ok;
}

export async function getTeamApps(team: string): Promise<string[]> {
  try {
    const res = await fetch(`https://api.heroku.com/teams/${encodeURIComponent(team)}/apps`, { headers: herokuHeaders });
    if (!res.ok) return [];
    const apps = await res.json() as { name: string }[];
    return apps.map(a => a.name);
  } catch { return []; }
}
