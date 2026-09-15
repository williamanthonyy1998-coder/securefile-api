export type DialogKind = "confirm" | "prompt" | "alert";

function request<T>(detail: any): Promise<T> {
  if (typeof window === "undefined") return Promise.resolve(detail.kind === "prompt" ? null : false) as Promise<T>;
  return new Promise<T>((resolve) => {
    window.dispatchEvent(new CustomEvent("sf:dialog", { detail: { ...detail, resolve } }));
  });
}

export function sfConfirm(message: string, options: { title?: string; danger?: boolean; confirmLabel?: string } = {}) {
  return request<boolean>({ kind: "confirm", message, ...options });
}

export function sfPrompt(message: string, defaultValue = "", options: { title?: string; confirmLabel?: string; inputType?: "text" | "password"; inputLabel?: string; inputPlaceholder?: string } = {}) {
  return request<string | null>({ kind: "prompt", message, defaultValue, ...options });
}

export function sfAlert(message: string, options: { title?: string; tone?: "error" | "info" | "success" } = {}) {
  return request<void>({ kind: "alert", message, ...options });
}
