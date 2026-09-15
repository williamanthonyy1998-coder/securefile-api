import { ReactNode } from "react";
import { LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

export default function AuthShell({ children, title, subtitle }: { children: ReactNode; title?: string; subtitle?: string }) {
  return <main className="auth-v2"><div className="auth-v2-orb auth-v2-orb-one"/><div className="auth-v2-orb auth-v2-orb-two"/><div className="auth-v2-shell"><aside className="auth-v2-brand"><img className="auth-logo-image" src="/securefile-logo.png" alt="GPA SecureFile" /><div className="auth-brand-content"><div className="auth-brand-kicker"><Sparkles size={13}/> Secure document workspace</div><h1>{title || "Your files. Your team. Secure."}</h1><p>{subtitle || "A modern workspace for storing, sharing and managing sensitive business documents."}</p><div className="auth-trust-list"><span><ShieldCheck size={16}/> Enterprise-ready security</span><span><LockKeyhole size={16}/> Protected access controls</span><span><Sparkles size={16}/> Built for productive teams</span></div></div><div className="auth-brand-footer">© {new Date().getFullYear()} SecureFile</div></aside><section className="auth-v2-form">{children}</section></div></main>;
}
