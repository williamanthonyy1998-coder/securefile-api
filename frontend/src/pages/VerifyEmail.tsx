import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, MailCheck } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import { api } from "@/lib/api";

export default function VerifyEmail() {
  const [sp] = useSearchParams();
  const nav = useNavigate();

  useEffect(() => {
    const token = sp.get("token");
    if (!token) {
      window.dispatchEvent(new CustomEvent("sf:alert", { detail: { type: "error", message: "Verification link is missing." } }));
      return;
    }
    api("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) })
      .then(() => window.dispatchEvent(new CustomEvent("sf:alert", { detail: { type: "success", message: "Email verified successfully. Your workspace is ready. You can now sign in." } })))
      .catch((e) => window.dispatchEvent(new CustomEvent("sf:alert", { detail: { type: "error", message: e.message || "Unable to verify email." } })));
  }, [sp]);

  return (
    <AuthShell title="Verify your SecureFile account." subtitle="Confirm your email to finish activating your workspace access.">
      <div className="auth-card-v2">
        <div className="auth-card-top">
          <span className="auth-icon-badge"><MailCheck size={20} /></span>
          <div><p className="auth-eyebrow">Email verification</p><h2>Verification complete</h2><p>Your verification request has been processed.</p></div>
        </div>
        <div className="auth-verify-state"><CheckCircle2 size={18} /><div><strong>You're all set.</strong><span>Use your SecureFile credentials to continue.</span></div></div>
        <button className="auth-submit" type="button" onClick={() => nav("/login")}>Go to sign in</button>
      </div>
    </AuthShell>
  );
}
