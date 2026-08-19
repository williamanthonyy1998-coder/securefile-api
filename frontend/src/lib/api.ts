const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export function token() {
  return localStorage.getItem("sf_token") || "";
}

export async function api(path: string, opts: RequestInit = {}) {
  const headers = new Headers(opts.headers);
  if (!(opts.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token()) headers.set("Authorization", `Bearer ${token()}`);

  const response = await fetch(API + path, { ...opts, headers });
  const text = await response.text();

  let data: any = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = { error: text }; }
  }

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("sf_token");
      localStorage.removeItem("sf_role");
    }
    throw new Error(data?.error || `Request failed (${response.status})`);
  }

  return data;
}

export { API };
