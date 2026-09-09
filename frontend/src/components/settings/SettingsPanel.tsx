import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function SettingsPanel() {
  const [m, setM] = useState<any>(null),
    [users, setUsers] = useState(1),
    [storage, setStorage] = useState(1),
    [months, setMonths] = useState(1),
    [customMonths, setCustomMonths] = useState(1),
    [quote, setQuote] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState(""),
    [notice, setNotice] = useState("");
  async function load() {
    try {
      setErr("");
      const c = await api("/companies/me");
      setM(c);
      setUsers(Number(c.subscription?.users || 1));
      setStorage(Number(c.subscription?.storageGb || c.storageLimitGb || 1));
    } catch (e: any) {
      setErr(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  const sub = m?.subscription;
  const isAdmin = localStorage.getItem("sf_role") === "COMPANY_ADMIN";
  const planName =
    (
      {
        STARTER: "Basic",
        BUSINESS: "Advanced",
        PROFESSIONAL: "Premium",
        CUSTOM: "Enterprise",
      } as any
    )[sub?.planCode || "CUSTOM"] || "Enterprise";
  const extraRate =
    sub?.planCode === "STARTER"
      ? 5
      : sub?.planCode === "BUSINESS"
        ? 10
        : sub?.planCode === "PROFESSIONAL"
          ? 12
          : 5;
  const expiresAt = sub?.expiresAt ? new Date(sub.expiresAt) : null;
  const expired =
    !!sub &&
    (sub.status === "SUSPENDED" ||
      sub.status === "CANCELED" ||
      (expiresAt ? expiresAt.getTime() <= Date.now() : false));
  const daysLeft =
    expiresAt && !expired
      ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000))
      : 0;
  const changed =
    users > Number(sub?.users || 0) || storage > Number(sub?.storageGb || 0);
  async function getQuote() {
    try {
      setErr("");
      setNotice("");
      const d = await api("/subscriptions/change-quote", {
        method: "POST",
        body: JSON.stringify({ users, storageGb: storage, months }),
      });
      setQuote(d.quote);
    } catch (e: any) {
      setErr(e.message);
    }
  }
  async function requestChange() {
    try {
      setBusy(true);
      setErr("");
      setNotice("");
      const d = await api("/subscriptions/checkout", {
        method: "POST",
        body: JSON.stringify({
          planCode: sub?.planCode || "CUSTOM",
          users,
          storageGb: storage,
          months,
        }),
      });
      setQuote(d.quote);
      if (d.checkoutUrl) {
        window.location.href = d.checkoutUrl;
        return;
      }
      setNotice(
        d.warning ||
          "Checkout is ready. Payment must be successfully confirmed before new limits or access are applied.",
      );
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (
      !confirm(
        "Cancel this SecureFile subscription now? Your workspace and data will be preserved, but all normal work will be suspended immediately. You can renew from Settings at any time.",
      )
    )
      return;
    try {
      setBusy(true);
      setErr("");
      setNotice("");
      await api("/subscriptions/cancel", { method: "POST" });
      setNotice(
        "Subscription canceled. Your workspace is now view-only. Renew from Settings to restore full access.",
      );
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  const canCheckout = expired || changed;
  return (
    <div className="grid2">
      <div className="panel">
        <h2>Company</h2>
        <p>
          <b>{m?.name || "—"}</b>
        </p>
        <p>{m?.businessIndustry || "—"}</p>
        <p>{m?.businessDescription || "—"}</p>
      </div>
      <div className="panel">
        <h2>Subscription & Billing</h2>
        <p>
          Plan: <b>{planName}</b>
        </p>
        <p>
          Status:{" "}
          <b className={`status-pill ${(sub?.status || "NONE").toLowerCase()}`}>
            {expired ? "EXPIRED / VIEW-ONLY" : sub?.status || "—"}
          </b>
        </p>
        <p>
          Current users: <b>{sub?.users || 0}</b>
        </p>
        <p>
          Current storage: <b>{sub?.storageGb || 0} GB</b>
        </p>
        <p>
          Paid period:{" "}
          <b>
            {sub?.months || 1} month{Number(sub?.months || 1) !== 1 ? "s" : ""}
          </b>
        </p>
        <p>
          Expires: <b>{expiresAt ? expiresAt.toLocaleString() : "—"}</b>
          {!expired && expiresAt && (
            <span className="muted">
              {" "}
              · {daysLeft} day{daysLeft === 1 ? "" : "s"} left
            </span>
          )}
        </p>
        {expired && (
          <div className="notice" style={{ marginTop: 14 }}>
            <b>Your workspace is view-only.</b>
            <p style={{ margin: "6px 0 0" }}>
              Your data is preserved, but normal work is locked until a renewal
              payment is successfully confirmed.
            </p>
          </div>
        )}
        {sub?.pendingUsers && (
          <div className="notice" style={{ marginTop: 12 }}>
            Payment pending: {sub.pendingUsers} users · {sub.pendingStorageGb}{" "}
            GB. Current limits remain active until payment is approved.
          </div>
        )}
        {isAdmin && (
          <>
            {expired ? (
              <div className="modal-section" style={{ marginTop: 20 }}>
                Renew subscription
              </div>
            ) : (
              <div className="modal-section" style={{ marginTop: 20 }}>
                Purchase additional capacity
              </div>
            )}
            <label>
              Total users
              <input
                type="number"
                min={Number(sub?.users || 1)}
                value={users}
                onChange={(e) => {
                  setUsers(
                    Math.max(Number(sub?.users || 1), +e.target.value || 1),
                  );
                  setQuote(null);
                }}
              />
              <small className="muted">
                Current plan: {planName}. Additional user rate:{" "}
                <b>${extraRate}/user/month</b>. Every added user receives the
                same {planName} features.
              </small>
            </label>
            <label>
              Storage (GB)
              <input
                type="number"
                min={Number(sub?.storageGb || 1)}
                value={storage}
                onChange={(e) => {
                  setStorage(
                    Math.max(Number(sub?.storageGb || 1), +e.target.value || 1),
                  );
                  setQuote(null);
                }}
              />
              <small className="muted">
                Additional storage is $0.30/GB/month beyond your included plan
                storage. The selected period is paid upfront.
              </small>
            </label>
            <label>
              Purchase duration
              <select
                value={[1, 3, 6, 12, 24, 36].includes(months) ? months : 0}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v === 0) {
                    setCustomMonths(customMonths);
                    setMonths(customMonths);
                  } else setMonths(v);
                  setQuote(null);
                }}
              >
                <option value={1}>1 month</option>
                <option value={3}>3 months</option>
                <option value={6}>6 months</option>
                <option value={12}>12 months</option>
                <option value={24}>24 months</option>
                <option value={36}>36 months</option>
                <option value={0}>Custom</option>
              </select>
            </label>
            {![1, 3, 6, 12, 24, 36].includes(months) && (
              <label>
                Number of months
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={customMonths}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(120, +e.target.value || 1));
                    setCustomMonths(v);
                    setMonths(v);
                    setQuote(null);
                  }}
                />
              </label>
            )}
            <div className="toolbar">
              {!expired && (
                <button
                  className="btn secondary"
                  disabled={!changed || busy}
                  onClick={getQuote}
                >
                  Calculate price
                </button>
              )}
              <button
                className="btn"
                disabled={!canCheckout || busy}
                onClick={requestChange}
              >
                {busy
                  ? "Processing..."
                  : expired
                    ? "Renew & restore access"
                    : "Pay & increase limits"}
              </button>
            </div>
            {!expired && (
              <button
                className="btn secondary"
                style={{ marginTop: 10 }}
                disabled={busy}
                onClick={cancel}
              >
                Cancel subscription
              </button>
            )}
          </>
        )}
        {!isAdmin && (
          <p className="muted" style={{ marginTop: 20 }}>
            Only the Company Admin can renew or purchase additional
            users/storage.
          </p>
        )}
        {quote && (
          <div className="success" style={{ marginTop: 14 }}>
            Monthly equivalent: <b>${Number(quote.monthly).toFixed(2)}</b> ·
            Upfront total for {months} month(s):{" "}
            <b>${Number(quote.total).toFixed(2)}</b>. Access/limits update only
            after successful payment.
          </div>
        )}
        {notice && (
          <div className="success" style={{ marginTop: 14 }}>
            {notice}
          </div>
        )}
        {err && (
          <div className="error" style={{ marginTop: 14 }}>
            {err}
          </div>
        )}
      </div>
    </div>
  );
}
