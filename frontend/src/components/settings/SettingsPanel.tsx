import { useEffect, useState } from "react";
import { KeyRound, Mail, Building2 } from "lucide-react";
import { api } from "@/lib/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export type SettingsTab = "profile" | "security" | "subscription";

type SettingsPanelProps = {
  tab: SettingsTab;
};

const PLAN_NAMES: Record<string, string> = {
  STARTER: "Basic",
  BUSINESS: "Advanced",
  PROFESSIONAL: "Premium",
  CUSTOM: "Enterprise",
};

const ROLE_LABELS: Record<string, string> = {
  COMPANY_ADMIN: "Company Admin",
  EMPLOYEE: "Employee",
  CLIENT: "Client",
  SUPER_ADMIN: "Super Admin",
};

export default function SettingsPanel({ tab }: SettingsPanelProps) {
  const [m, setM] = useState<any>(null);
  const [profile, setProfile] = useState<{
    id: string;
    email: string;
    uniqueName: string;
    role: string;
    status: string;
  } | null>(null);
  const [users, setUsers] = useState(1);
  const [storage, setStorage] = useState(1);
  const [months, setMonths] = useState(1);
  const [customMonths, setCustomMonths] = useState(1);
  const [quote, setQuote] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    try {
      setErr("");
      const meId = localStorage.getItem("sf_user_id") || "";
      const [c, userList] = await Promise.all([
        api("/companies/me"),
        api("/users").catch(() => []),
      ]);
      setM(c);
      setUsers(Number(c.subscription?.users || 1));
      setStorage(Number(c.subscription?.storageGb || c.storageLimitGb || 1));

      const me = Array.isArray(userList)
        ? userList.find((u: any) => u.id === meId)
        : null;

      setProfile({
        id: meId,
        email: me?.email || localStorage.getItem("sf_email") || "",
        uniqueName: me?.uniqueName || me?.email?.split("@")[0] || "User",
        role: me?.role || localStorage.getItem("sf_role") || "",
        status: me?.status || "ACTIVE",
      });
    } catch (e: any) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const sub = m?.subscription;
  const isAdmin = localStorage.getItem("sf_role") === "COMPANY_ADMIN";
  const planName = PLAN_NAMES[sub?.planCode || "CUSTOM"] || "Enterprise";
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
  const canCheckout = expired || changed;

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

  async function sendPasswordReset() {
    const email = profile?.email || localStorage.getItem("sf_email") || "";
    if (!email) {
      setErr("No email found for this account.");
      return;
    }
    try {
      setResetBusy(true);
      setErr("");
      setNotice("");
      const d = await api("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setNotice(
        d.message ||
          "If an account exists for this email, a password reset link has been sent.",
      );
    } catch (e: any) {
      setErr(e.message || "Unable to send password reset email.");
    } finally {
      setResetBusy(false);
    }
  }

  const initial = (profile?.uniqueName || profile?.email || "U")
    .trim()
    .charAt(0)
    .toUpperCase();

  if (tab === "profile") {
    return (
      <div className="space-y-4">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>
              Your SecureFile account identity in this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar className="size-14 rounded-xl">
                <AvatarFallback className="rounded-xl bg-foreground text-lg font-bold text-background">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-semibold tracking-tight">
                  {profile?.uniqueName || "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {ROLE_LABELS[profile?.role || ""] || profile?.role || "—"}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-foreground">Name</span>
                <Input value={profile?.uniqueName || ""} readOnly />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-foreground">Email</span>
                <Input value={profile?.email || ""} readOnly />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-foreground">Role</span>
                <Input
                  value={
                    ROLE_LABELS[profile?.role || ""] || profile?.role || ""
                  }
                  readOnly
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-foreground">Status</span>
                <Input value={profile?.status || ""} readOnly />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 size={16} />
              Company
            </CardTitle>
            <CardDescription>
              Workspace company details linked to your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">Company name</span>
              <Input value={m?.name || ""} readOnly />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium text-foreground">Industry</span>
              <Input value={m?.businessIndustry || ""} readOnly />
            </label>
            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-foreground">Description</span>
              <Input value={m?.businessDescription || ""} readOnly />
            </label>
          </CardContent>
        </Card>

        {err && <div className="error">{err}</div>}
      </div>
    );
  }

  if (tab === "security") {
    return (
      <div className="space-y-4">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Security</CardTitle>
            <CardDescription>
              Reset your password securely via email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                <Mail size={15} />
                Account email
              </div>
              <p className="text-sm text-muted-foreground">
                {profile?.email || localStorage.getItem("sf_email") || "—"}
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              We’ll send a password reset link to your verified email. Use that
              link to choose a new password.
            </p>

            <Button
              onClick={sendPasswordReset}
              disabled={resetBusy}
              className="gap-2"
            >
              <KeyRound size={15} />
              {resetBusy ? "Sending…" : "Send password reset email"}
            </Button>

            {notice && <div className="success">{notice}</div>}
            {err && <div className="error">{err}</div>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Subscription & Billing</CardTitle>
          <CardDescription>
            Review your current plan and manage capacity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
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
            <div className="mt-5 space-y-5 rounded-xl border border-border bg-muted/40 p-4 sm:p-5">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  {expired
                    ? "Renew subscription"
                    : "Purchase additional capacity"}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {expired
                    ? "Restore full workspace access by renewing your plan."
                    : "Increase users or storage. Limits update only after successful payment."}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm sm:col-span-1">
                  <span className="font-medium text-foreground">
                    Total users
                  </span>
                  <Input
                    type="number"
                    min={Number(sub?.users || 1)}
                    value={users}
                    onChange={(e) => {
                      setUsers(
                        Math.max(Number(sub?.users || 1), +e.target.value || 1),
                      );
                      setQuote(null);
                    }}
                    className="bg-card"
                  />
                  <span className="block text-xs text-muted-foreground">
                    Current plan: {planName}. Extra users:{" "}
                    <b className="text-foreground">
                      ${extraRate}/user/month
                    </b>
                    .
                  </span>
                </label>

                <label className="space-y-1.5 text-sm sm:col-span-1">
                  <span className="font-medium text-foreground">
                    Storage (GB)
                  </span>
                  <Input
                    type="number"
                    min={Number(sub?.storageGb || 1)}
                    value={storage}
                    onChange={(e) => {
                      setStorage(
                        Math.max(
                          Number(sub?.storageGb || 1),
                          +e.target.value || 1,
                        ),
                      );
                      setQuote(null);
                    }}
                    className="bg-card"
                  />
                  <span className="block text-xs text-muted-foreground">
                    Extra storage:{" "}
                    <b className="text-foreground">$0.30/GB/month</b>, paid
                    upfront for the selected period.
                  </span>
                </label>

                <label className="space-y-1.5 text-sm sm:col-span-2">
                  <span className="font-medium text-foreground">
                    Purchase duration
                  </span>
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
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
                  <label className="space-y-1.5 text-sm sm:col-span-2">
                    <span className="font-medium text-foreground">
                      Number of months
                    </span>
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      value={customMonths}
                      onChange={(e) => {
                        const v = Math.max(
                          1,
                          Math.min(120, +e.target.value || 1),
                        );
                        setCustomMonths(v);
                        setMonths(v);
                        setQuote(null);
                      }}
                      className="bg-card"
                    />
                  </label>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {!expired && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!changed || busy}
                    onClick={getQuote}
                    className="bg-card"
                  >
                    Calculate price
                  </Button>
                )}
                <Button
                  type="button"
                  disabled={!canCheckout || busy}
                  onClick={requestChange}
                >
                  {busy
                    ? "Processing..."
                    : expired
                      ? "Renew & restore access"
                      : "Pay & increase limits"}
                </Button>
                {!expired && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={cancel}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:ml-auto"
                  >
                    Cancel subscription
                  </Button>
                )}
              </div>
            </div>
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
        </CardContent>
      </Card>
    </div>
  );
}
