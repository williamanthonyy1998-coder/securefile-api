import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { KeyRound, Mail, Building2, ShieldCheck, Smartphone, Upload, Copy, CheckCircle2 } from "lucide-react";
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
import { sfConfirm, sfPrompt } from "../../lib/dialogs";
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
    avatarUrl?: string | null;
    twoFactorEnabled?: boolean;
  } | null>(null);
  const [users, setUsers] = useState(1);
  const [storage, setStorage] = useState(1);
  const [months, setMonths] = useState(1);
  const [customMonths, setCustomMonths] = useState(1);
  const [quote, setQuote] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceIndustry, setWorkspaceIndustry] = useState("");
  const [workspaceDescription, setWorkspaceDescription] = useState("");
  const [twoFaSetup, setTwoFaSetup] = useState<{secret:string;otpauthUrl:string} | null>(null);
  const [twoFaQrDataUrl, setTwoFaQrDataUrl] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaBusy, setTwoFaBusy] = useState(false);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    try {
      setErr("");
      const meId = localStorage.getItem("sf_user_id") || "";
      const [c, me] = await Promise.all([
        api("/companies/me"),
        api("/users/me", { headers: { "X-SF-Force-Refresh": "true" } }),
      ]);
      setM(c);
      setWorkspaceName(c?.name || "");
      setWorkspaceIndustry(c?.businessIndustry || "");
      setWorkspaceDescription(c?.businessDescription || "");
      setUsers(Number(c.subscription?.users || 1));
      setStorage(Number(c.subscription?.storageGb || c.storageLimitGb || 1));

      setProfile({
        id: meId,
        email: me?.email || localStorage.getItem("sf_email") || "",
        uniqueName: me?.uniqueName || me?.email?.split("@")[0] || "User",
        role: me?.role || localStorage.getItem("sf_role") || "",
        status: me?.status || "ACTIVE",
        avatarUrl: me?.avatarUrl || null,
        twoFactorEnabled: !!me?.twoFactorEnabled,
      });
      setProfileName(me?.uniqueName || "");
      setProfileAvatar(me?.avatarUrl || null);
      setTwoFaEnabled(!!me?.twoFactorEnabled);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!twoFaSetup?.otpauthUrl) {
      setTwoFaQrDataUrl("");
      return;
    }
    QRCode.toDataURL(twoFaSetup.otpauthUrl, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#111827", light: "#ffffff" },
    })
      .then((url) => { if (!cancelled) setTwoFaQrDataUrl(url); })
      .catch(() => { if (!cancelled) setTwoFaQrDataUrl(""); });
    return () => { cancelled = true; };
  }, [twoFaSetup?.otpauthUrl]);

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
    if (!(await sfConfirm("Cancel this SecureFile subscription now? Your workspace and data will be preserved, but normal work will be suspended immediately.", { title: "Cancel subscription", danger: true, confirmLabel: "Cancel subscription" }))) return;
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

  async function readImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("Please choose an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setErr("Profile image must be 5 MB or smaller."); return; }
    const raw = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const size = 320; const scale = Math.min(1, size / Math.max(img.width, img.height)); const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale)); const ctx = canvas.getContext("2d"); if (!ctx) return reject(new Error("Unable to process image")); ctx.drawImage(img,0,0,canvas.width,canvas.height); resolve(canvas.toDataURL("image/jpeg",.82)); }; img.onerror=()=>reject(new Error("Unable to read image")); img.src=String(r.result); }; r.onerror = reject; r.readAsDataURL(file); });
    setProfileAvatar(raw);
  }

  async function saveWorkspace() {
    try {
      setWorkspaceBusy(true);
      setErr("");
      setNotice("");
      const updated = await api("/companies/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: workspaceName,
          businessIndustry: workspaceIndustry,
          businessDescription: workspaceDescription,
        }),
      });
      setM((prev: any) => prev ? { ...prev, ...updated } : updated);
      setWorkspaceName(updated.name || "");
      setWorkspaceIndustry(updated.businessIndustry || "");
      setWorkspaceDescription(updated.businessDescription || "");
      setNotice("Workspace details updated successfully.");
    } catch (e:any) {
      setErr(e.message || "Unable to update workspace details.");
    } finally {
      setWorkspaceBusy(false);
    }
  }

  async function saveProfile() {
    try {
      setProfileBusy(true); setErr(""); setNotice("");
      const updated = await api("/users/me/profile", { method: "PATCH", body: JSON.stringify({ name: profileName, avatarUrl: profileAvatar }) });
      setProfile(prev => prev ? { ...prev, uniqueName: updated.uniqueName, avatarUrl: updated.avatarUrl } : prev);
      localStorage.setItem("sf_display_name", updated.uniqueName);
      localStorage.setItem("sf_avatar_url", updated.avatarUrl || "");
      window.dispatchEvent(new CustomEvent("sf:profile-updated", { detail: updated }));
      setNotice("Profile updated successfully.");
    } catch (e:any) { setErr(e.message || "Unable to update profile."); }
    finally { setProfileBusy(false); }
  }

  async function startTwoFa() {
    try { setTwoFaBusy(true); setErr(""); const d = await api("/auth/2fa/setup", { method: "POST" }); setTwoFaSetup(d); setTwoFaQrDataUrl(""); setTwoFaCode(""); }
    catch(e:any) { setErr(e.message || "Unable to start 2FA setup."); }
    finally { setTwoFaBusy(false); }
  }

  async function enableTwoFa() {
    try { setTwoFaBusy(true); setErr(""); await api("/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code: twoFaCode }) }); setTwoFaEnabled(true); setTwoFaSetup(null); setTwoFaQrDataUrl(""); setTwoFaCode(""); setNotice("Two-factor authentication is now enabled."); }
    catch(e:any) { setErr(e.message || "Invalid authentication code."); }
    finally { setTwoFaBusy(false); }
  }

  async function disableTwoFa() {
    const password = await sfPrompt("Enter your current password.", "", { title: "Disable 2FA" });
    if (password === null) return;
    const code = await sfPrompt("Enter your current 6-digit authenticator code.", "", { title: "Disable 2FA" });
    if (code === null) return;
    if (!(await sfConfirm("Disable two-factor authentication for this account?", { title: "Disable 2FA", danger: true, confirmLabel: "Disable 2FA" }))) return;
    try { setTwoFaBusy(true); setErr(""); await api("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password, code }) }); setTwoFaEnabled(false); setNotice("Two-factor authentication has been disabled."); }
    catch(e:any) { setErr(e.message || "Unable to disable 2FA."); }
    finally { setTwoFaBusy(false); }
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
    const initial = (profileName || profile?.email || "U").trim().charAt(0).toUpperCase();
    return (
      <div className="space-y-4">
        <Card className="settings-hero-card overflow-hidden">
          <CardContent className="relative p-0">
            <div className="settings-profile-banner" />
            <div className="relative -mt-8 px-5 pb-5 sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-end gap-4">
                  <div className="settings-avatar-large">{profileAvatar ? <img src={profileAvatar} alt="Profile" /> : initial}</div>
                  <div className="pb-1"><p className="text-xl font-bold tracking-tight">{profileName || "Your profile"}</p><p className="text-sm text-muted-foreground">{ROLE_LABELS[profile?.role || ""] || profile?.role || "User"}</p></div>
                </div>
                <label className="btn secondary small w-fit cursor-pointer"><input hidden type="file" accept="image/*" onChange={e => readImage(e.target.files?.[0])} /><Upload size={14}/> Change photo</label>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Profile details</CardTitle><CardDescription>Keep your SecureFile identity up to date.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm sm:col-span-1"><span className="font-medium">Display name</span><Input value={profileName} onChange={e=>setProfileName(e.target.value)} placeholder="Your name" /></label>
            <label className="space-y-1.5 text-sm"><span className="font-medium">Email</span><Input value={profile?.email || ""} readOnly /></label>
            <label className="space-y-1.5 text-sm"><span className="font-medium">Role</span><Input value={ROLE_LABELS[profile?.role || ""] || profile?.role || ""} readOnly /></label>
            <label className="space-y-1.5 text-sm"><span className="font-medium">Account status</span><Input value={profile?.status || ""} readOnly /></label>
            <div className="sm:col-span-2 flex justify-end"><Button onClick={saveProfile} disabled={profileBusy} aria-busy={profileBusy} className="gap-2">{profileBusy ? "Saving…" : "Save profile"}</Button></div>
          </CardContent>
        </Card>
        {isAdmin && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Building2 size={16}/> Workspace</CardTitle>
              <CardDescription>Edit the company information shown across your SecureFile workspace.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm"><span className="font-medium">Company name</span><Input value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} placeholder="Company name" /></label>
              <label className="space-y-1.5 text-sm"><span className="font-medium">Industry</span><Input value={workspaceIndustry} onChange={e => setWorkspaceIndustry(e.target.value)} placeholder="Industry" /></label>
              <label className="space-y-1.5 text-sm sm:col-span-2"><span className="font-medium">Description</span><textarea value={workspaceDescription} onChange={e => setWorkspaceDescription(e.target.value)} placeholder="Describe your workspace" maxLength={500} rows={3} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-primary/20 focus:border-primary" /></label>
              <div className="sm:col-span-2 flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Workspace details are visible according to each user’s access.</span>
                <Button onClick={saveWorkspace} disabled={workspaceBusy} aria-busy={workspaceBusy} className="gap-2">{workspaceBusy ? "Saving…" : "Save workspace"}</Button>
              </div>
            </CardContent>
          </Card>
        )}
        {notice && <div className="success">{notice}</div>}{err && <div className="error">{err}</div>}
      </div>
    );
  }

  if (tab === "security") {
    return (
      <div className="space-y-4">
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base">Password & account security</CardTitle><CardDescription>Manage the credentials used to protect your workspace account.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-4"><div className="mb-1 flex items-center gap-2 text-sm font-medium"><Mail size={15}/> Account email</div><p className="text-sm text-muted-foreground">{profile?.email || "—"}</p></div>
            <Button onClick={sendPasswordReset} disabled={resetBusy} aria-busy={resetBusy} className="gap-2"><KeyRound size={15}/>{resetBusy ? "Sending…" : "Send password reset email"}</Button>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-primary/20">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck size={17}/> Two-factor authentication</CardTitle><CardDescription>Add a second verification step with an authenticator app whenever you sign in.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 p-4"><div className="flex items-center gap-3"><span className={`security-status-dot ${twoFaEnabled ? "on" : ""}`} /><div><strong className="block text-sm">{twoFaEnabled ? "2FA is enabled" : "2FA is not enabled"}</strong><span className="text-xs text-muted-foreground">{twoFaEnabled ? "Your authenticator code is required after password sign-in." : "Recommended for every SecureFile account."}</span></div></div>{twoFaEnabled ? <Button variant="outline" onClick={disableTwoFa} disabled={twoFaBusy} aria-busy={twoFaBusy}>Disable 2FA</Button> : <Button onClick={startTwoFa} disabled={twoFaBusy} aria-busy={twoFaBusy} className="gap-2"><Smartphone size={15}/>{twoFaBusy ? "Preparing…" : "Set up 2FA"}</Button>}</div>
            {twoFaSetup && !twoFaEnabled && <div className="twofa-setup-card"><div className="twofa-setup-grid"><div className="twofa-manual-card">{twoFaQrDataUrl ? <div className="twofa-qr-wrap"><img src={twoFaQrDataUrl} alt="SecureFile 2FA setup QR code" /></div> : <div className="twofa-qr-placeholder"><Smartphone size={28}/><span>Preparing QR code…</span></div>}<strong>Scan with your authenticator</strong><small>Open Google Authenticator, Microsoft Authenticator, 1Password, Authy, or another TOTP app and scan this QR code.</small>{twoFaSetup.otpauthUrl && <a className="btn secondary small" href={twoFaSetup.otpauthUrl}>Open authenticator</a>}<code>SecureFile</code></div><div className="space-y-4"><div><p className="text-sm font-semibold">1. Scan the QR code</p><p className="text-xs text-muted-foreground">Use Google Authenticator, Microsoft Authenticator, 1Password, Authy, or another TOTP app.</p></div><div><p className="mb-1 text-sm font-semibold">2. Or enter this setup key</p><div className="flex gap-2"><Input readOnly value={twoFaSetup.secret} className="font-mono tracking-widest"/><Button type="button" variant="outline" size="icon" onClick={()=>navigator.clipboard.writeText(twoFaSetup.secret)}><Copy size={15}/></Button></div></div><div><p className="mb-1 text-sm font-semibold">3. Enter the 6-digit code</p><div className="flex gap-2"><Input inputMode="numeric" maxLength={6} value={twoFaCode} onChange={e=>setTwoFaCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000" className="text-center font-mono text-lg tracking-[0.35em]"/><Button type="button" onClick={enableTwoFa} disabled={twoFaBusy || twoFaCode.length!==6} aria-busy={twoFaBusy}>{twoFaBusy ? "Verifying…" : "Verify & enable"}</Button></div></div></div></div></div>}
          </CardContent>
        </Card>
        {notice && <div className="success">{notice}</div>}{err && <div className="error">{err}</div>}
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
                  aria-busy={busy}
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
