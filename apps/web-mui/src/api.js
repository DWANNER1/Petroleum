const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const TOKEN_STORAGE_KEY = "petroleum.mui.auth.token";
const LEGACY_TOKEN_STORAGE_KEY = "petroleum.auth.token";

let token = localStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(LEGACY_TOKEN_STORAGE_KEY) || "";

if (token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(LEGACY_TOKEN_STORAGE_KEY, token);
}

function setToken(nextToken) {
  token = nextToken || "";
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(LEGACY_TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
  }
}

export function getApiBase() {
  return API_BASE;
}

export function getToken() {
  return token;
}

export function logout() {
  setToken("");
}

export function completeOAuthLogin(nextToken) {
  setToken(nextToken);
}

export async function loginWithPassword(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Login failed");
  }
  const data = await res.json();
  setToken(data.token);
  return data;
}

export async function getOAuthProviders() {
  const res = await fetch(`${API_BASE}/auth/oauth/providers`);
  if (!res.ok) throw new Error("Unable to load OAuth providers");
  return res.json();
}

export function oauthStartUrl(provider) {
  const redirectTo = `${window.location.origin}/auth/callback`;
  const url = new URL(`${API_BASE}/auth/oauth/${provider}/start`);
  url.searchParams.set("redirectTo", redirectTo);
  return url.toString();
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status}: ${text}`);
  }
  return response.json();
}

export const api = {
  getSessionUser: () => request("/auth/me"),
  getCurrentJobber: () => request("/jobber"),
  getJobberEiaCredentialsStatus: () => request("/jobber/eia-credentials"),
  saveJobberEiaCredentials: (payload) =>
    request("/jobber/eia-credentials", {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  getJobberOpisCredentialsStatus: () => request("/jobber/opis-credentials"),
  saveJobberOpisCredentials: (payload) =>
    request("/jobber/opis-credentials", {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  getJobberPricingConfigs: () => request("/jobber/pricing-configs"),
  saveJobberPricingConfig: (payload) =>
    request("/jobber/pricing-configs", {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  updateCurrentJobber: (payload) =>
    request("/jobber", {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  getManagementOverview: () => request("/management/overview"),
  createManagedUser: (payload) =>
    request("/management/users", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateManagedUser: (userId, payload) =>
    request(`/management/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteManagedUser: (userId) =>
    request(`/management/users/${userId}`, {
      method: "DELETE"
    }),
  getSites: () => request("/sites"),
  getSite: (siteId) => request(`/sites/${siteId}`),
  getTankHistory: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/history/tanks${query ? `?${query}` : ""}`);
  },
  getTankInformation: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/tank-information${query ? `?${query}` : ""}`);
  },
  getAlliedPortfolioSummary: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/allied-transactions/portfolio-summary${query ? `?${query}` : ""}`);
  },
  getAlliedTransactionsSummary: (siteId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/sites/${siteId}/allied-transactions/summary${query ? `?${query}` : ""}`);
  },
  getAlliedTransactions: (siteId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/sites/${siteId}/allied-transactions${query ? `?${query}` : ""}`);
  },
  getAlliedTransactionsExportUrl: (siteId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return `${API_BASE}/sites/${siteId}/allied-transactions/export${query ? `?${query}` : ""}`;
  },
  getPricingSnapshot: () => request("/market/pricing"),
  getOpisSnapshot: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/market/opis${query ? `?${query}` : ""}`);
  }
};
