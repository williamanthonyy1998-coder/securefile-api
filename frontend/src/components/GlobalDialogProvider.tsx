import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, Eye, EyeOff } from "lucide-react";

type DialogState = {
  kind: "confirm" | "prompt" | "alert";
  message: string;
  title?: string;
  danger?: boolean;
  confirmLabel?: string;
  defaultValue?: string;
  inputType?: "text" | "password";
  inputLabel?: string;
  inputPlaceholder?: string;
  tone?: "error" | "info" | "success";
  resolve: (value: any) => void;
};

export default function GlobalDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [value, setValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  useEffect(() => {
    const onDialog = (event: Event) => {
      const detail = (event as CustomEvent).detail as DialogState;
      if (!detail?.resolve) return;
      setValue(detail.defaultValue || "");
      setShowPassword(false);
      setDialog(detail);
    };
    window.addEventListener("sf:dialog", onDialog);
    return () => window.removeEventListener("sf:dialog", onDialog);
  }, []);

  useEffect(() => {
    const onAlert = (event: Event) => {
      const detail = (event as CustomEvent).detail as { type?: string; message?: string };
      const type = detail?.type === "error" || detail?.type === "info" ? detail.type : "success";
      const message = String(detail?.message || "").trim();
      if (!message) return;
      setToast({ type, message });
      window.setTimeout(() => {
        setToast((current) => current?.message === message ? null : current);
      }, type === "error" ? 6500 : 4200);
    };
    window.addEventListener("sf:alert", onAlert);
    return () => window.removeEventListener("sf:alert", onAlert);
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(dialog.kind === "prompt" ? null : false);
      if (e.key === "Enter" && dialog.kind !== "alert" && document.activeElement?.tagName !== "TEXTAREA") finish(dialog.kind === "prompt" ? value : true);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, [dialog, value]);

  function finish(result: any) {
    const current = dialog;
    if (!current) return;
    setDialog(null);
    current.resolve(result);
  }

  return <>
    {children}
    {toast && (
      <div className={`sf-alert-toast sf-alert-toast-${toast.type}`} role={toast.type === "error" ? "alert" : "status"}>
        <span className="sf-alert-toast-icon" aria-hidden="true">
          {toast.type === "error" ? "!" : toast.type === "info" ? "i" : "✓"}
        </span>
        <span className="sf-alert-toast-message">{toast.message}</span>
        <button type="button" className="sf-alert-toast-close" aria-label="Dismiss" onClick={() => setToast(null)}>
          <X size={14} />
        </button>
      </div>
    )}
    {dialog && (
      <div className="sf-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) finish(dialog.kind === "prompt" ? null : false); }}>
        <div className={`sf-dialog ${dialog.danger ? "is-danger" : ""}`} role="dialog" aria-modal="true">
          <div className="sf-dialog-head">
            <div className={`sf-dialog-icon ${dialog.danger ? "danger" : dialog.tone || "info"}`}>
              {dialog.danger || dialog.tone === "error" ? <AlertTriangle size={20} /> : dialog.tone === "success" ? <CheckCircle2 size={20} /> : <Info size={20} />}
            </div>
            <div className="sf-dialog-heading">
              <h2>{dialog.title || (dialog.kind === "confirm" ? "Confirm action" : dialog.kind === "prompt" ? "Enter a name" : "SecureFile")}</h2>
              <p>{dialog.message}</p>
            </div>
            <button className="sf-dialog-close" type="button" aria-label="Close" onClick={() => finish(dialog.kind === "prompt" ? null : false)}><X size={18} /></button>
          </div>
          {dialog.kind === "prompt" && (
            <div className="sf-dialog-field">
              <label>{dialog.inputLabel || "Name"}</label>
              <div className="sf-dialog-password-wrap">
                <input autoFocus type={dialog.inputType === "password" && !showPassword ? "password" : "text"} value={value} placeholder={dialog.inputPlaceholder || "Enter a value"} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
                {dialog.inputType === "password" && <button type="button" className="sf-dialog-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>}
              </div>
            </div>
          )}
          <div className="sf-dialog-actions">
            {dialog.kind !== "alert" && <button className="btn secondary" type="button" onClick={() => finish(dialog.kind === "prompt" ? null : false)}>Cancel</button>}
            <button className={`btn ${dialog.danger ? "danger" : ""}`} type="button" autoFocus={dialog.kind !== "prompt"} onClick={() => finish(dialog.kind === "prompt" ? value : dialog.kind === "alert" ? undefined : true)}>{dialog.confirmLabel || (dialog.kind === "confirm" ? "Confirm" : dialog.kind === "prompt" ? "Save" : "OK")}</button>
          </div>
        </div>
      </div>
    )}
  </>;
}
