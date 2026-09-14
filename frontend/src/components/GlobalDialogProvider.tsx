import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type DialogState = {
  kind: "confirm" | "prompt" | "alert";
  message: string;
  title?: string;
  danger?: boolean;
  confirmLabel?: string;
  defaultValue?: string;
  tone?: "error" | "info" | "success";
  resolve: (value: any) => void;
};

export default function GlobalDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    const onDialog = (event: Event) => {
      const detail = (event as CustomEvent).detail as DialogState;
      if (!detail?.resolve) return;
      setValue(detail.defaultValue || "");
      setDialog(detail);
    };
    window.addEventListener("sf:dialog", onDialog);
    return () => window.removeEventListener("sf:dialog", onDialog);
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
          {dialog.kind === "prompt" && <div className="sf-dialog-field"><label>Name</label><input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.stopPropagation()} /></div>}
          <div className="sf-dialog-actions">
            {dialog.kind !== "alert" && <button className="btn secondary" type="button" onClick={() => finish(dialog.kind === "prompt" ? null : false)}>Cancel</button>}
            <button className={`btn ${dialog.danger ? "danger" : ""}`} type="button" autoFocus={dialog.kind !== "prompt"} onClick={() => finish(dialog.kind === "prompt" ? value : dialog.kind === "alert" ? undefined : true)}>{dialog.confirmLabel || (dialog.kind === "confirm" ? "Confirm" : dialog.kind === "prompt" ? "Save" : "OK")}</button>
          </div>
        </div>
      </div>
    )}
  </>;
}
