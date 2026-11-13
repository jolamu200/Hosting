const API_URL = "/api";

  function getToken(): string | null {
    return localStorage.getItem("token");
  }

  async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
    const token = getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {})
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(`${API_URL}${path}`, { ...options, headers });
  }

  export async function login(usernameOrEmail: string, password: string) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernameOrEmail, password })
    });
    return res.json();
  }

  export async function signup(email: string, username: string, password: string, referralCode?: string, fingerprint?: string) {
    const res = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password, referralCode, fingerprint })
    });
    return res.json();
  }

  export async function logout() {
    await fetchWithAuth("/auth/logout", { method: "POST" });
    localStorage.removeItem("token");
  }

  export async function deleteAccount() {
    const res = await fetchWithAuth("/auth/me", { method: "DELETE" });
    const data = await res.json();
    localStorage.removeItem("token");
    return data;
  }

  export async function getMe() {
    const res = await fetchWithAuth("/auth/me");
    return res.json();
  }

  export async function updateUsername(username: string) {
    const res = await fetchWithAuth("/auth/username", {
      method: "PATCH",
      body: JSON.stringify({ username })
    });
    return res.json();
  }

  export async function getBots() {
    const res = await fetchWithAuth("/bots");
    return res.json();
  }

  export async function deployBot(data: { phoneNumber?: string; botName?: string; sessionVar: string; isTrial?: boolean; device?: string; months?: number }) {
    const res = await fetchWithAuth("/bots/deploy", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.json();
  }

  export async function stopBot(id: string) {
    const res = await fetchWithAuth(`/bots/${id}/stop`, { method: "POST" });
    return res.json();
  }

  export async function startBot(id: string) {
    const res = await fetchWithAuth(`/bots/${id}/start`, { method: "POST" });
    return res.json();
  }

  export async function restartBot(id: string) {
    const res = await fetchWithAuth(`/bots/${id}/restart`, { method: "POST" });
    return res.json();
  }

  export async function renewBot(id: string, months: number) {
    const res = await fetchWithAuth(`/bots/${id}/renew`, {
      method: "POST",
      body: JSON.stringify({ months })
    });
    return res.json();
  }

  export async function deleteBot(id: string) {
    const res = await fetchWithAuth(`/bots/${id}/delete`, { method: "POST" });
    return res.json();
  }

  export async function getBotLogs(id: string) {
    const res = await fetchWithAuth(`/bots/${id}/logs`);
    return res.json();
  }

  export async function updateBotVars(id: string, session: string, device?: string, extraVars?: Record<string, string>) {
    const body: Record<string, unknown> = { session };
    if (device) body.device = device;
    if (extraVars && Object.keys(extraVars).length > 0) body.extraVars = extraVars;
    const res = await fetchWithAuth(`/bots/${id}/vars`, {
      method: "PATCH",
      body: JSON.stringify(body)
    });
    return res.json();
  }

  export async function checkTrial(phone: string) {
    const res = await fetchWithAuth(`/bots/trial-check/${phone}`);
    return res.json();
  }

  export async function getPackages() {
    const res = await fetch(`${API_URL}/payments/packages`);
    return res.json();
  }

  export async function initiatePayment(packageId: string) {
    const res = await fetchWithAuth("/payments/initiate", {
      method: "POST",
      body: JSON.stringify({ packageId })
    });
    return res.json();
  }

  export async function getTransactions() {
    const res = await fetchWithAuth("/payments/history");
    return res.json();
  }

  export async function verifyPayment(reference: string) {
    const res = await fetchWithAuth(`/payments/verify/${reference}`);
    return res.json();
  }

  export async function getMobileChargeStatus(reference: string) {
    const res = await fetchWithAuth(`/payments/charge/status/${reference}`);
    return res.json();
  }

  export async function claimCoupon(code: string) {
    const res = await fetchWithAuth("/coupons/claim", {
      method: "POST",
      body: JSON.stringify({ code })
    });
    return res.json();
  }

  export async function getAdminStats() {
    const res = await fetchWithAuth("/admin/stats");
    return res.json();
  }

  export async function getAdminUsers() {
    const res = await fetchWithAuth("/admin/users");
    return res.json();
  }

  export async function banUser(id: string, reason?: string) {
    const res = await fetchWithAuth(`/admin/users/${id}/ban`, {
      method: "POST",
      body: JSON.stringify({ reason })
    });
    return res.json();
  }

  export async function unbanUser(id: string) {
    const res = await fetchWithAuth(`/admin/users/${id}/unban`, { method: "POST" });
    return res.json();
  }

  export async function grantTx(id: string, amount: number) {
    const res = await fetchWithAuth(`/admin/users/${id}/tx`, {
      method: "POST",
      body: JSON.stringify({ amount })
    });
    return res.json();
  }

  export async function subtractTx(id: string, amount: number) {
    const res = await fetchWithAuth(`/admin/users/${id}/subtract-tx`, {
      method: "POST",
      body: JSON.stringify({ amount })
    });
    return res.json();
  }

  export async function resetPassword(id: string, password: string) {
    const res = await fetchWithAuth(`/admin/users/${id}/password`, {
      method: "POST",
      body: JSON.stringify({ password })
    });
    return res.json();
  }

  export async function deleteUser(id: string) {
    const res = await fetchWithAuth(`/admin/users/${id}`, { method: "DELETE" });
    return res.json();
  }

  export async function sendUserNotification(id: string, title: string, message: string) {
    const res = await fetchWithAuth(`/admin/users/${id}/notify`, {
      method: "POST",
      body: JSON.stringify({ title, message })
    });
    return res.json();
  }

  export async function getAdminBots() {
    const res = await fetchWithAuth("/admin/bots");
    return res.json();
  }

  export async function getAdminTransactions() {
    const res = await fetchWithAuth("/admin/transactions");
    return res.json();
  }

  export async function getAdminCoupons() {
    const res = await fetchWithAuth("/admin/coupons");
    return res.json();
  }

  export async function createCoupon(code: string, txAmount: number) {
    const res = await fetchWithAuth("/admin/coupons", {
      method: "POST",
      body: JSON.stringify({ code, txAmount })
    });
    return res.json();
  }

  export async function deleteCoupon(id: string) {
    const res = await fetchWithAuth(`/admin/coupons/${id}`, { method: "DELETE" });
    return res.json();
  }

  export async function getAdminReferrals() {
    const res = await fetchWithAuth("/admin/referrals");
    return res.json();
  }

  export async function deleteAllAdminReferrals() {
    const res = await fetchWithAuth("/admin/referrals/all", { method: "DELETE" });
    return res.json();
  }

  export async function stopAdminBot(id: string) {
    const res = await fetchWithAuth(`/admin/bots/${id}/stop`, { method: "POST" });
    return res.json();
  }

  export async function startAdminBot(id: string) {
    const res = await fetchWithAuth(`/admin/bots/${id}/start`, { method: "POST" });
    return res.json();
  }

  export async function restartAdminBot(id: string) {
    const res = await fetchWithAuth(`/admin/bots/${id}/restart`, { method: "POST" });
    return res.json();
  }

  export async function deleteAdminBot(id: string) {
    const res = await fetchWithAuth(`/admin/bots/${id}`, { method: "DELETE" });
    return res.json();
  }

    export async function deleteAdminTransaction(id: string) {
      const res = await fetchWithAuth(`/admin/transactions/${id}`, { method: "DELETE" });
      return res.json();
    }

  export async function getAdminBotLogs(id: string) {
    const res = await fetchWithAuth(`/admin/bots/${id}/logs`);
    return res.json();
  }

  export async function getAdminTeams() {
    const res = await fetchWithAuth("/admin/teams");
    return res.json();
  }

  export async function createAdminTeam(name: string, billingLabel: string) {
    const res = await fetchWithAuth("/admin/teams", {
      method: "POST",
      body: JSON.stringify({ name, billingLabel })
    });
    return res.json();
  }

  export async function updateAdminTeam(id: string, billingLabel: string, active?: boolean) {
    const body: Record<string, unknown> = { billingLabel };
    if (typeof active === "boolean") body.active = active;
    const res = await fetchWithAuth(`/admin/teams/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    });
    return res.json();
  }

  export async function deleteAdminTeam(id: string) {
    const res = await fetchWithAuth(`/admin/teams/${id}`, { method: "DELETE" });
    return res.json();
  }

  export async function getAdminDbStats() {
    const res = await fetchWithAuth("/admin/db/stats");
    return res.json();
  }

  export async function purgeAdminCollection(collection: string) {
    const res = await fetchWithAuth(`/admin/db/purge/${collection}`, { method: "DELETE" });
    return res.json();
  }

export async function getBotTemplates() {
  const res = await fetchWithAuth("/bot-templates");
  return res.json();
}

export async function getBotTemplateBySlug(slug: string) {
  const res = await fetch(`${API_URL}/bot-templates/slug/${slug}`);
  return res.json();
}

export async function addBotTemplate(data: { name: string; githubRepo: string; sessionIdUrl: string; costTx: number }) {
  const res = await fetchWithAuth("/bot-templates", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function deleteBotTemplate(id: string) {
  const res = await fetchWithAuth(`/bot-templates/${id}`, { method: "DELETE" });
  return res.json();
}

export async function refreshBotTemplateImage(id: string) {
  const res = await fetchWithAuth(`/bot-templates/${id}/refresh-image`, { method: "POST" });
  return res.json();
}

export async function getPanelPlans() {
  const res = await fetch(`${API_URL}/panels/plans`);
  return res.json();
}

export async function getMyPanels() {
  const res = await fetchWithAuth("/panels/my");
  return res.json();
}

export async function purchasePanel(planId: string, opts?: { panelEmail?: string; panelUsername?: string; panelPassword?: string }) {
  const res = await fetchWithAuth("/panels/purchase", {
    method: "POST",
    body: JSON.stringify({ planId, ...opts })
  });
  return res.json();
}

export async function renewPanel(panelId: string) {
  const res = await fetchWithAuth(`/panels/${panelId}/renew`, { method: "POST" });
  return res.json();
}

export async function purchaseAdminPanel(opts?: { panelEmail?: string; panelUsername?: string; panelPassword?: string }) {
    const res = await fetchWithAuth("/panels/purchase-admin", {
      method: "POST",
      body: JSON.stringify({ ...opts })
    });
    return res.json();
  }

  export async function getAdminPanels() {
    const res = await fetchWithAuth("/panels/admin/all");
    return res.json();
  }

  export async function deleteAdminPanel(id: string) {
    const res = await fetchWithAuth(`/panels/admin/panel/${id}`, { method: "DELETE" });
    return res.json();
  }

  export async function deletePanel(id: string) {
    const res = await fetchWithAuth(`/panels/my/${id}`, { method: "DELETE" });
    return res.json();
  }

  export async function deployBotWithTemplate(data: {
  botTemplateId: string;
  botName: string;
  sessionVar: string;
  device?: string;
  months?: number;
  extraVars?: Record<string, string>;
}) {
  const res = await fetchWithAuth("/bots/deploy-template", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function getAdminPanelPlans() {
  const res = await fetchWithAuth("/panels/plans");
  return res.json();
}

export async function createAdminPanelPlan(data: {
  name: string;
  description: string;
  txCost: number;
  ram: string;
  disk: string;
  cpu: string;
  isBestDeal: boolean;
}) {
  const res = await fetchWithAuth("/panels/admin/plans", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function deleteAdminPanelPlan(id: string) {
  const res = await fetchWithAuth(`/panels/admin/plans/${id}`, { method: "DELETE" });
  return res.json();
}

export async function getAdminAllPanels() {
  const res = await fetchWithAuth("/panels/admin/all");
  return res.json();
}

export async function initiateCustomPayment(ksAmount: number, txAmount: number) {
  const res = await fetchWithAuth("/payments/initiate-custom", {
    method: "POST",
    body: JSON.stringify({ ksAmount, txAmount })
  });
  return res.json();
}

export async function initiatePaymentNg(data: { ngnAmount: number; txAmount: number; bonusTx: number; packageName?: string }) {
  const res = await fetchWithAuth("/payments/initiate-ng", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function prepareCardNg(data: { ngnAmount: number; txAmount: number; bonusTx: number }) {
  const res = await fetchWithAuth("/payments/prepare-card-ng", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function getPaymentsConfig() {
  const res = await fetch(`${API_URL}/payments/config`);
  return res.json();
}

  export async function getPaymentHistory() {
    const res = await fetchWithAuth("/payments/history");
    return res.json();
  }

  export async function getOrphanHerokuApps() {
    const res = await fetchWithAuth("/admin/orphan-apps");
    return res.json();
  }

  export async function deleteOrphanApp(appName: string) {
    const res = await fetchWithAuth(`/admin/orphan-apps/${encodeURIComponent(appName)}`, { method: "DELETE" });
    return res.json();
  }
  
  export async function getTutorials() {
    const res = await fetch(`${API_URL}/tutorials`);
    return res.json();
  }

  export async function getAdminTutorials() {
    const res = await fetchWithAuth("/admin/tutorials");
    return res.json();
  }

  export async function createAdminTutorial(data: { title: string; youtubeUrl: string; order?: number }) {
    const res = await fetchWithAuth("/admin/tutorials", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.json();
  }

  export async function deleteAdminTutorial(id: string) {
    const res = await fetchWithAuth(`/admin/tutorials/${id}`, { method: "DELETE" });
    return res.json();
  }

  export async function deleteAdminTransactionsBulk(ids: string[]) {
    const res = await fetchWithAuth("/admin/transactions/bulk", {
      method: "DELETE",
      body: JSON.stringify({ ids })
    });
    return res.json();
  }

  export async function resolveStaleTransactions() {
    const res = await fetchWithAuth("/admin/transactions/resolve-stale", { method: "POST" });
    return res.json();
  }

  export async function getBotVars(id: string) {
    const res = await fetchWithAuth(`/bots/${id}/vars`);
    return res.json();
  }

export async function getTemplateAppVars(templateId: string): Promise<{ vars: { key: string; description: string; required: boolean; value: string }[]; sessionIdUrl: string }> {
  const res = await fetchWithAuth(`/bots/template-appvars/${templateId}`);
  return res.json();
}

export async function getNotifications() {
  const res = await fetchWithAuth("/notifications");
  return res.json();
}

export async function getUnreadNotificationCount() {
  const res = await fetchWithAuth("/notifications/unread-count");
  return res.json();
}

export async function markNotificationsRead() {
  const res = await fetchWithAuth("/notifications/mark-read", { method: "POST" });
  return res.json();
}

export async function deleteNotification(id: string) {
  const res = await fetchWithAuth(`/notifications/${id}`, { method: "DELETE" });
  return res.json();
}

export async function deleteAllNotifications() {
  const res = await fetchWithAuth("/notifications/all", { method: "DELETE" });
  return res.json();
}

// ── Admin Revenue ──────────────────────────────────────────────────────────
export async function getAdminRevenue() {
  const res = await fetchWithAuth("/admin/revenue");
  return res.json();
}


export async function getAdminBoostCatalogueMeta() {
  const res = await fetchWithAuth("/admin/boost-catalogue/meta");
  return res.json();
}

export async function syncAdminBoostCatalogue() {
  const res = await fetchWithAuth("/admin/boost-catalogue/sync", { method: "POST" });
  return res.json();
}

export async function clearAdminBoostCatalogue() {
  const res = await fetchWithAuth("/admin/boost-catalogue", { method: "DELETE" });
  return res.json();
}

export async function getAdminApiKeys() {
  const res = await fetchWithAuth("/admin/api-keys");
  return res.json();
}

export async function markAdminBoostOrderComplete(id: string) {
  const res = await fetchWithAuth(`/admin/boost-orders/${id}/complete`, { method: "POST" });
  return res.json();
}

export async function getAdminBoostOrders(params?: { page?: number; limit?: number; status?: string; q?: string }) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.status) sp.set("status", params.status);
  if (params?.q) sp.set("q", params.q);
  const qs = sp.toString();
  const res = await fetchWithAuth(`/admin/boost-orders${qs ? `?${qs}` : ""}`);
  return res.json();
}


// ── Admin Broadcast Notifications ─────────────────────────────────────────
export async function getAdminBroadcastNotifications() {
  const res = await fetchWithAuth("/admin/broadcast-notifications");
  return res.json();
}

export async function createAdminBroadcastNotification(data: { title: string; message: string; type?: string }) {
  const res = await fetchWithAuth("/admin/broadcast-notifications", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function deleteAdminBroadcastNotification(id: string) {
  const res = await fetchWithAuth(`/admin/broadcast-notifications/${id}`, { method: "DELETE" });
  return res.json();
}

// ── Cameroon Payments ─────────────────────────────────────────────────────
export async function initiateCameroonPayment(data: { xafAmount: number; txAmount: number; bonusTx: number }) {
  const res = await fetchWithAuth("/payments/initiate-cameroon", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function checkCameroonPaymentStatus(transId: string) {
  const res = await fetchWithAuth(`/payments/cameroon-status/${encodeURIComponent(transId)}`);
  return res.json();
}

// ── Moderators ─────────────────────────────────────────────────────────────
export async function promoteToModerator(id: string) {
  const res = await fetchWithAuth(`/admin/users/${id}/moderator`, { method: "POST" });
  return res.json();
}

// ── Maintenance mode ───────────────────────────────────────────────────────
export async function getMaintenanceMode() {
  const res = await fetchWithAuth("/admin/maintenance");
  return res.json();
}

export async function setMaintenanceModeApi(enabled: boolean) {
  const res = await fetchWithAuth("/admin/maintenance", {
    method: "POST",
    body: JSON.stringify({ enabled })
  });
  return res.json();
}

export async function getPublicMaintenanceStatus() {
  const res = await fetch(`${API_URL}/settings/maintenance`);
  return res.json();
}

export async function getCurrencyList() {
  const res = await fetch(`${API_URL}/currency/list`);
  return res.json();
}

export async function setUserCurrency(currency: string) {
  const res = await fetchWithAuth("/currency/set", {
    method: "PATCH",
    body: JSON.stringify({ currency })
  });
  return res.json();
}

const BOOST_CACHE_TTL_MS = 5 * 60 * 1000;

interface BoostServiceApi {
  id: number;
  name: string;
  category: string;
  pricePer1000: number;
  pricePer1000Kes: number;
  currency: string;
  min: number;
  max: number;
  platformId: string;
  serviceType: string;
  isRegionVariant: boolean;
}

interface BoostServicesResponse {
  services: BoostServiceApi[];
  currency?: string;
  error?: string;
}

interface LocalCacheEntry<T> { data: T; fetchedAt: number }

function readLocalCache<T>(key: string): LocalCacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalCacheEntry<T>;
    if (typeof parsed?.fetchedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalCache<T>(key: string, entry: LocalCacheEntry<T>) {
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {}
}

const boostServicesCache = new Map<string, { data: BoostServicesResponse; fetchedAt: number }>();
let boostCategoriesCache: { data: unknown; fetchedAt: number } | null = null;

export async function getBoostServices(params: { q?: string; category?: string; currency?: string }): Promise<BoostServicesResponse> {
  const currency = params.currency || "";
  const cacheKey = currency;
  const localKey = `boostServicesCache:${cacheKey}`;
  let cached = boostServicesCache.get(cacheKey);
  if (!cached) {
    const fromLocal = readLocalCache<BoostServicesResponse>(localKey);
    if (fromLocal) { cached = fromLocal; boostServicesCache.set(cacheKey, fromLocal); }
  }
  let all: BoostServicesResponse;

  if (cached && Date.now() - cached.fetchedAt < BOOST_CACHE_TTL_MS) {
    all = cached.data;
  } else {
    const search = new URLSearchParams();
    if (currency) search.set("currency", currency);
    const res = await fetchWithAuth(`/boost/services?${search.toString()}`);
    all = await res.json();
    if (Array.isArray(all?.services)) {
      const entry = { data: all, fetchedAt: Date.now() };
      boostServicesCache.set(cacheKey, entry);
      writeLocalCache(localKey, entry);
    }
  }

  if (!Array.isArray(all?.services)) return all;
  const qWords = params.q?.toLowerCase().trim().split(/\s+/).filter(Boolean) || [];
  const category = params.category;
  const filtered = all.services.filter(s => {
    const haystack = `${s.name} ${s.category}`.toLowerCase();
    const matchesQ = qWords.length === 0 || qWords.every(w => haystack.includes(w));
    const matchesCategory = !category || s.category === category;
    return matchesQ && matchesCategory;
  });
  return { ...all, services: filtered.sort((a, b) => a.pricePer1000 - b.pricePer1000) };
}

export async function getBoostCategories() {
  const localKey = "boostCategoriesCache";
  if (!boostCategoriesCache) {
    const fromLocal = readLocalCache<unknown>(localKey);
    if (fromLocal) boostCategoriesCache = fromLocal;
  }
  if (boostCategoriesCache && Date.now() - boostCategoriesCache.fetchedAt < BOOST_CACHE_TTL_MS) {
    return boostCategoriesCache.data;
  }
  const res = await fetchWithAuth("/boost/categories");
  const data = await res.json();
  boostCategoriesCache = { data, fetchedAt: Date.now() };
  writeLocalCache(localKey, boostCategoriesCache);
  return data;
}

export async function placeBoostOrder(data: { serviceId: number; link: string; quantity: number }) {
  const res = await fetchWithAuth("/boost/order", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function getBoostOrders() {
  const res = await fetchWithAuth("/boost/orders");
  return res.json();
}

export async function refreshBoostOrder(id: string) {
  const res = await fetchWithAuth(`/boost/orders/${id}/refresh`);
  return res.json();
}

export async function prepareBoostOrder(data: { serviceId: number; link: string; quantity: number }) {
  const res = await fetchWithAuth("/boost/order/prepare", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function payBoostMpesa(data: { boostOrderId: string; phone: string; provider?: "mpesa" | "airtel" }) {
  const res = await fetchWithAuth("/boost/order/pay/mpesa", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function getBoostMpesaStatus(reference: string) {
  const res = await fetchWithAuth(`/boost/order/pay/mpesa/status/${encodeURIComponent(reference)}`);
  return res.json();
}

export async function payBoostDRC(data: { boostOrderId: string; phone: string; currency?: "CDF" | "USD"; amount: number }) {
  const res = await fetchWithAuth("/boost/order/pay/drc", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function getBoostDRCStatus(refTransa: string) {
  const res = await fetchWithAuth(`/boost/order/pay/drc/status/${encodeURIComponent(refTransa)}`);
  return res.json();
}

export async function payBoostCameroon(data: { boostOrderId: string; phone: string; amount: number }) {
  const res = await fetchWithAuth("/boost/order/pay/cameroon", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function getBoostCameroonStatus(transId: string) {
  const res = await fetchWithAuth(`/boost/order/pay/cameroon/status/${encodeURIComponent(transId)}`);
  return res.json();
}

export async function payBoostTanzania(data: { boostOrderId: string; phone: string; amount: number }) {
  const res = await fetchWithAuth("/boost/order/pay/tanzania", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function getBoostTanzaniaStatus(reference: string) {
  const res = await fetchWithAuth(`/boost/order/pay/tanzania/status/${encodeURIComponent(reference)}`);
  return res.json();
}

export async function payBoostCardPrepare(data: { boostOrderId: string; email: string }) {
  const res = await fetchWithAuth("/boost/order/pay/card", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function payBoostCardInit(data: { boostOrderId: string; email: string }) {
  const res = await fetchWithAuth("/boost/order/pay/card/init", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function verifyBoostCard(reference: string) {
  const res = await fetchWithAuth("/boost/order/pay/card/verify", {
    method: "POST",
    body: JSON.stringify({ reference })
  });
  return res.json();
}

export async function getApiKeyStatus() {
  const res = await fetchWithAuth("/apikeys");
  return res.json();
}

export async function generateApiKey() {
  const res = await fetchWithAuth("/apikeys/generate", { method: "POST" });
  return res.json();
}

export async function pauseApiKey() {
  const res = await fetchWithAuth("/apikeys/pause", { method: "POST" });
  return res.json();
}

export async function resumeApiKey() {
  const res = await fetchWithAuth("/apikeys/resume", { method: "POST" });
  return res.json();
}

export async function deleteApiKey() {
  const res = await fetchWithAuth("/apikeys", { method: "DELETE" });
  return res.json();
}

export async function revealApiKey() {
  const res = await fetchWithAuth("/apikeys/reveal");
  return res.json();
}
