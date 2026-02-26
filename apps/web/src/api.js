const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

let token = "";

export async function loginDefault() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "manager@demo.com", password: "demo123" })
  });
  if (!res.ok) throw new Error("Login failed");
  const data = await res.json();
  token = data.token;
  return data;
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
  getSites: () => request("/sites"),
  getSite: (siteId) => request(`/sites/${siteId}`),
  getPumps: (siteId) => request(`/sites/${siteId}/pumps`),
  createSite: (payload) =>
    request("/sites", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateSite: (siteId, payload) =>
    request(`/sites/${siteId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteSite: (siteId) =>
    request(`/sites/${siteId}`, {
      method: "DELETE"
    }),
  updateIntegrations: (siteId, payload) =>
    request(`/sites/${siteId}/integrations`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  addTank: (siteId, payload) =>
    request(`/sites/${siteId}/tanks`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateTank: (tankId, payload) =>
    request(`/tanks/${tankId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteTank: (tankId) =>
    request(`/tanks/${tankId}`, {
      method: "DELETE"
    }),
  addPump: (siteId, payload) =>
    request(`/sites/${siteId}/pumps`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updatePump: (pumpId, payload) =>
    request(`/pumps/${pumpId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deletePump: (pumpId) =>
    request(`/pumps/${pumpId}`, {
      method: "DELETE"
    }),
  getLayout: (siteId) => request(`/sites/${siteId}/layout`),
  saveLayout: (siteId, payload) =>
    request(`/sites/${siteId}/layout`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getAlerts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/alerts${query ? `?${query}` : ""}`);
  },
  getTankHistory: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/history/tanks${query ? `?${query}` : ""}`);
  },
  ackAlert: (id) => request(`/alerts/${id}/ack`, { method: "POST" })
};
