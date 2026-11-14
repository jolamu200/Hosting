const BASE_URL = "https://xmdapis.bwmxmd.co.ke/api";

function getApiKey(): string {
  const key = process.env.BWM_API || "";
  if (!key) throw new Error("Social boosting is temporarily unavailable");
  return key;
}

async function callProvider<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getApiKey()}`,
      ...(options.headers as Record<string, string> || {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.success === false) {
    const message = (data && (data.error?.message || data.error)) || `Provider request failed (${res.status})`;
    const err = new Error(typeof message === "string" ? message : "Provider request failed");
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return data as T;
}

export interface ProviderService {
  id: number;
  name: string;
  category: string;
  provider: string;
  price_per_1000_ksh: number;
  min: number;
  max: number;
}

const CATALOGUE_TTL_MS = 10 * 60 * 1000; // refresh the full catalogue at most every 10 minutes
let catalogueCache: ProviderService[] | null = null;
let catalogueFetchedAt = 0;
let catalogueInFlight: Promise<ProviderService[]> | null = null;

async function fetchFullCatalogue(): Promise<ProviderService[]> {
  const data = await callProvider<{ data: ProviderService[] }>("/services");
  return data.data || [];
}

async function getCatalogue(): Promise<ProviderService[]> {
  const isStale = Date.now() - catalogueFetchedAt > CATALOGUE_TTL_MS;

  if (catalogueCache && !isStale) return catalogueCache;

  if (catalogueCache && isStale) {
    // Serve the slightly-stale cache instantly, refresh in the background so the
    // page never has to sit and wait on the slow upstream provider.
    if (!catalogueInFlight) {
      catalogueInFlight = fetchFullCatalogue()
        .then(fresh => {
          catalogueCache = fresh;
          catalogueFetchedAt = Date.now();
          return fresh;
        })
        .catch(() => catalogueCache as ProviderService[])
        .finally(() => { catalogueInFlight = null; });
    }
    return catalogueCache;
  }

  // No cache at all yet (first request since boot) - have to wait for it once.
  if (!catalogueInFlight) {
    catalogueInFlight = fetchFullCatalogue()
      .then(fresh => {
        catalogueCache = fresh;
        catalogueFetchedAt = Date.now();
        return fresh;
      })
      .finally(() => { catalogueInFlight = null; });
  }
  return catalogueInFlight;
}

export async function listProviderServices(q?: string, category?: string): Promise<ProviderService[]> {
  const all = await getCatalogue();
  if (!q && !category) return all;
  const qLower = q?.toLowerCase();
  return all.filter(s => {
    const matchesQ = !qLower || s.name.toLowerCase().includes(qLower) || s.category.toLowerCase().includes(qLower);
    const matchesCategory = !category || s.category === category;
    return matchesQ && matchesCategory;
  });
}

export interface ProviderOrderResult {
  order_id: number;
  status: string;
  cost_xd: number;
}

export async function placeProviderOrder(input: { service_id: number; provider: string; link: string; quantity: number }): Promise<ProviderOrderResult> {
  const data = await callProvider<{ data: ProviderOrderResult }>("/services/order", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.data;
}

export async function getProviderOrderStatus(orderId: string | number): Promise<{ status: string; quantity?: number }> {
  const data = await callProvider<{ data: { status: string; quantity?: number } }>(`/services/order/${orderId}`);
  return data.data;
}
