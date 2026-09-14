import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

type DialogKind = "confirm" | "alert" | "prompt";
type DialogTone = "danger" | "warning" | "info" | "success";

type DialogRequest = {
  kind: DialogKind;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
  inputLabel?: string;
  inputPlaceholder?: string;
  defaultValue?: string;
};

type DialogContextValue = {
  confirm: (options: Omit<DialogRequest, "kind"> | string) => Promise<boolean>;
  alert: (options: Omit<DialogRequest, "kind"> | string) => Promise<void>;
  prompt: (options: Omit<DialogRequest, "kind"> | string) => Promise<string | null>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

function normalize(input: Omit<DialogRequest, "kind"> | string): Omit<DialogRequest, "kind"> {
  return typeof input === "string" ? { title: "Please confirm", message: input } : input;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [resolver, setResolver] = useState<((value: boolean | string | null) => void) | null>(null);
  const [inputValue, setInputValue] = useState("");

  const close = useCallback((result: boolean | string | null) => {
    resolver?.(result);
    setResolver(null);
    setRequest(null);
    setInputValue("");
  }, [resolver]);

  const submit = useCallback(() => {
    if (!request) return;
    if (request.kind === "prompt") {
      close(inputValue);
      return;
    }
    close(true);
  }, [request, inputValue, close]);

  const confirm = useCallback((input: Omit<DialogRequest, "kind"> | string) => {
    return new Promise<boolean>((resolve) => {
      setRequest({ ...normalize(input), kind: "confirm" });
      setInputValue("");
      setResolver(() => (value: boolean | string | null) => resolve(value === true));
    });
  }, []);

  const alert = useCallback((input: Omit<DialogRequest, "kind"> | string) => {
    return new Promise<void>((resolve) => {
      setRequest({ ...normalize(input), kind: "alert" });
      setInputValue("");
      setResolver(() => () => resolve());
    });
  }, []);

  const prompt = useCallback((input: Omit<DialogRequest, "kind"> | string) => {
    return new Promise<string | null>((resolve) => {
      const normalized = normalize(input);
      setRequest({ ...normalized, kind: "prompt" });
      setInputValue(normalized.defaultValue || "");
      setResolver(() => (value: boolean | string | null) =>
  resolve(typeof value === "string" ? value : null)
);
    });
  }, []);

  useEffect(() => {
    if (!request) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(false);
      }
      if (event.key === "Enter") {
        const target = event.target as HTMLElement | null;
        if (target?.tagName === "TEXTAREA") return;
        event.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [request, close, inputValue]);

  const tone = request?.tone || (request?.kind === "confirm" ? "warning" : "info");
  const Icon = tone === "danger" ? XCircle : tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertTriangle;

  return (
    <DialogContext.Provider value={{ confirm, alert, prompt }}>
      {children}
      {request && (
        <div className="sf-dialog-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && request.kind === "confirm" && close(false)}>
          <section className={`sf-dialog sf-dialog-${tone}`} role="dialog" aria-modal="true" aria-labelledby="sf-dialog-title" aria-describedby="sf-dialog-message">
            <button className="sf-dialog-close" type="button" aria-label="Close" onClick={() => close(false)}>
              <X size={17} />
            </button>
            <div className="sf-dialog-icon"><Icon size={22} strokeWidth={2.2} /></div>
            <div className="sf-dialog-content">
              <h2 id="sf-dialog-title">{request.title}</h2>
              <p id="sf-dialog-message">{request.message}</p>
              {request.kind === "prompt" && (
                <div className="sf-dialog-input-wrap">
                  {request.inputLabel && <label htmlFor="sf-dialog-input">{request.inputLabel}</label>}
                  <input
                    id="sf-dialog-input"
                    autoFocus
                    value={inputValue}
                    placeholder={request.inputPlaceholder || "Enter a value"}
                    onChange={(e) => setInputValue(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="sf-dialog-actions">
              {(request.kind === "confirm" || request.kind === "prompt") && (
                <button type="button" className="btn secondary sf-dialog-btn" onClick={() => close(false)}>
                  {request.cancelLabel || "Cancel"}
                </button>
              )}
              <button type="button" autoFocus className={`btn sf-dialog-btn ${tone === "danger" ? "danger" : ""}`} onClick={submit}>
                {request.confirmLabel || (request.kind === "prompt" ? "Save" : request.kind === "confirm" ? "Confirm" : "OK")}
              </button>
            </div>
          </section>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error("useDialog must be used inside DialogProvider");
  return context;
}
