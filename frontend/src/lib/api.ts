const API =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://securefile-api.vercel.app/api"
    : "http://localhost:4000/api");

/**
 * Get the currently selected SecureFile tenant.
 *
 * Production tenant URLs:
 *   /t/test
 *   /t/company1
 *
 * We also keep localStorage support so that after entering a tenant URL,
 * all subsequent API requests know which workspace/company is active.
 */
function getTenantSlug(): string {
  if (typeof window === "undefined") return "";

  // First preference: explicit tenant saved by the tenant route.
  const storedTenant = localStorage.getItem("securefile_tenant");
  if (storedTenant) {
    return storedTenant.trim().toLowerCase();
  }

  // Fallback: detect /t/:tenant from the current URL.
  const match = window.location.pathname.match(/^\/t\/([^/?#]+)/i);

  if (match?.[1]) {
    const slug = decodeURIComponent(match[1]).trim().toLowerCase();

    if (slug) {
      localStorage.setItem("securefile_tenant", slug);
      return slug;
    }
  }

  return "";
}

export function token() {
  return localStorage.getItem("sf_token") || "";
}

function dispatchAlert(
  type: "success" | "error" | "info",
  message: string
) {
  if (typeof window !== "undefined" && message) {
    window.dispatchEvent(
      new CustomEvent("sf:alert", {
        detail: {
          type,
          message,
        },
      })
    );
  }
}

function friendlySuccess(path: string, method: string, data: any) {
  if (data?.message && typeof data.message === "string") {
    return data.message;
  }

  const p = path.toLowerCase();

  if (p.includes("/upload")) {
    return "File uploaded successfully.";
  }

  if (p.includes("/move")) {
    return "Moved successfully.";
  }

  if (p.includes("/share")) {
    return "Sharing updated successfully.";
  }

  if (p.includes("/rename")) {
    return "Renamed successfully.";
  }

  if (p.includes("/delete") || p.includes("/trash")) {
    return "Action completed successfully.";
  }

  if (p.includes("/fax")) {
    return method === "POST"
      ? "Fax request submitted successfully."
      : "Fax action completed successfully.";
  }

  if (p.includes("/scan")) {
    return "Scan action completed successfully.";
  }

  if (p.includes("/checkout")) {
    return "Checkout session created. Redirecting to secure payment.";
  }

  if (method === "POST") {
    return "Saved successfully.";
  }

  if (method === "PATCH") {
    return "Updated successfully.";
  }

  if (method === "DELETE") {
    return "Deleted successfully.";
  }

  return "Action completed successfully.";
}

export async function api(path: string, opts: RequestInit = {}) {
  const headers = new Headers(opts.headers);

  const silentAlert = headers.get("X-Silent-Alert") === "true";

  if (!(opts.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const authToken = token();

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  /**
   * Send the tenant/workspace identifier with every API request.
   *
   * Backend can use X-Tenant-Slug to resolve the company/workspace.
   */
  const tenantSlug = getTenantSlug();

  if (tenantSlug) {
    headers.set("X-Tenant-Slug", tenantSlug);
  }

  const response = await fetch(API + path, {
    ...opts,
    headers,
  });

  const text = await response.text();

  let data: any = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {
        error: text,
      };
    }
  }

  if (!response.ok) {
    if (!silentAlert) {
      dispatchAlert(
        "error",
        data?.error || `Request failed (${response.status})`
      );
    }

    if (response.status === 401) {
      localStorage.removeItem("sf_token");
      localStorage.removeItem("sf_role");
    }

    throw new Error(
      data?.error || `Request failed (${response.status})`
    );
  }

  const method = String(opts.method || "GET").toUpperCase();

  if (
    !silentAlert &&
    !["GET", "HEAD", "OPTIONS"].includes(method) &&
    !path.includes("/workspace/notifications")
  ) {
    dispatchAlert(
      "success",
      friendlySuccess(path, method, data)
    );
  }

  return data;
}

export { API };

/**
 * Download a private file through the authenticated SecureFile API.
 *
 * We intentionally do not navigate directly to a Supabase signed URL here.
 * Browsers can handle those URLs inconsistently (and a stale/invalid signed
 * storage path can otherwise result in a blank/error page). The API already
 * performs the permission check and streams the private object back to the
 * authenticated user, so using a blob download keeps the behaviour reliable.
 */
/** Fetch a private preview through the authenticated API and return a local blob URL. */
export async function getPrivatePreviewUrl(fileId: string) {
  const headers = new Headers();
  const authToken = token();
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  const tenantSlug = getTenantSlug();
  if (tenantSlug) headers.set("X-Tenant-Slug", tenantSlug);

  const response = await fetch(
    `${API}/files/${encodeURIComponent(fileId)}/preview`,
    { method: "GET", headers }
  );

  if (!response.ok) {
    const text = await response.text();
    let message = text || `Preview failed (${response.status})`;
    try {
      const data = JSON.parse(text);
      message = data?.error || message;
    } catch {}
    dispatchAlert("error", message);
    throw new Error(message);
  }

  const blob = await response.blob();
  return { url: URL.createObjectURL(blob), mimeType: response.headers.get("Content-Type") || blob.type };
}

export async function downloadPrivateFile(fileId: string, fallbackName = "download") {
  const headers = new Headers();
  const authToken = token();

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const tenantSlug = getTenantSlug();
  if (tenantSlug) {
    headers.set("X-Tenant-Slug", tenantSlug);
  }

  const response = await fetch(
    `${API}/files/${encodeURIComponent(fileId)}/download`,
    { method: "GET", headers }
  );

  if (!response.ok) {
    const text = await response.text();
    let message = text || `Download failed (${response.status})`;
    try {
      const data = JSON.parse(text);
      message = data?.error || message;
    } catch {
      // Keep the plain-text response when it is not JSON.
    }
    dispatchAlert("error", message);
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  let filename = fallbackName || "download";

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const normalMatch = disposition.match(/filename="?([^";]+)"?/i);

  if (utf8Match?.[1]) {
    try {
      filename = decodeURIComponent(utf8Match[1]);
    } catch {
      filename = utf8Match[1];
    }
  } else if (normalMatch?.[1]) {
    filename = normalMatch[1];
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  return filename;
}

/**
 * Direct / normal file upload.
 */
export async function directUpload(
  file: File,
  options: {
    folderId?: string;
    source?: "UPLOAD" | "SCAN" | "FAX";
    name?: string;
  } = {}
) {
  try {
    if (import.meta.env.VITE_DIRECT_UPLOAD !== "true") {
      const fd = new FormData();

      fd.append("file", file);

      if (options.folderId) {
        fd.append("folderId", options.folderId);
      }

      if (options.source) {
        fd.append("source", options.source);
      }

      return api("/files/upload", {
        method: "POST",
        body: fd,
      });
    }

    const ticket: any = await api("/files/upload-ticket", {
      method: "POST",
      headers: {
        "X-Silent-Alert": "true",
      },
      body: JSON.stringify({
        name: options.name || file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        folderId: options.folderId,
        source: options.source || "UPLOAD",
      }),
    });

    const put = await fetch(ticket.ticket.signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type":
          file.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: file,
    });

    if (!put.ok) {
      throw new Error(
        `Storage upload failed (${put.status}).`
      );
    }

    const committed = await api("/files/commit-upload", {
      method: "POST",
      headers: {
        "X-Silent-Alert": "true",
      },
      body: JSON.stringify({
        storageKey: ticket.ticket.key,
        name: ticket.name,
        mimeType: ticket.mimeType,
        sizeBytes: ticket.sizeBytes,
        folderId: ticket.folderId,
        source: ticket.source,
      }),
    });

    dispatchAlert(
      "success",
      "File uploaded successfully."
    );

    return committed;
  } catch (e: any) {
    dispatchAlert(
      "error",
      e?.message || "File upload failed."
    );

    throw e;
  }
}

/**
 * Get a signed URL for preview/download.
 */
export async function getSignedFileUrl(
  fileId: string,
  mode: "preview" | "download" = "preview"
) {
  const data: any = await api(
    `/files/${encodeURIComponent(
      fileId
    )}/signed-url?mode=${mode}`
  );

  return String(data.url || "");
}