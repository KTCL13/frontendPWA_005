const BASE_URL = "https://elprofehugo.online/api/v1";

function cleanUrl(path) {
  return `${BASE_URL}${path}`.split("?")[0];
}

export async function apiFetch(method, path, body = null) {
  const token = localStorage.getItem("jwt_token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let url = `${BASE_URL}${path}`;
  if (method === "GET") {
    const separator = path.includes("?") ? "&" : "?";
    url += `${separator}_t=${Date.now()}`;
  }

  const options = { method, headers };
  if (body !== null) options.body = JSON.stringify(body);

  let response;
  try {
    response = await fetch(url, options);
  } catch {
    if (method === "GET" && typeof caches !== "undefined") {
      try {
        const cached = await caches.match(cleanUrl(path));
        if (cached) {
          return await cached.json();
        }
      } catch {}
    }
    if (method === "GET" && !navigator.onLine) {
      return [];
    }
    throw new Error("Sin conexión al servidor");
  }

  if (response.status === 401) {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("jwt_expires");
    localStorage.removeItem("current_user");
    window.location.hash = "#/login";
    throw new Error("Sesión expirada. Por favor inicia sesión de nuevo.");
  }

  if (
    response.status === 503 &&
    method === "GET" &&
    typeof caches !== "undefined"
  ) {
    try {
      const cached = await caches.match(cleanUrl(path));
      if (cached) {
        return await cached.json();
      }
    } catch {}
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const msg =
      (data && (data.message || data.error)) || `Error ${response.status}`;
    throw new Error(Array.isArray(msg) ? msg.join(", ") : msg);
  }

  return data;
}

export const api = {
  get: (path) => apiFetch("GET", path),
  post: (path, body) => apiFetch("POST", path, body),
  patch: (path, body) => apiFetch("PATCH", path, body),
  delete: (path) => apiFetch("DELETE", path),
};
