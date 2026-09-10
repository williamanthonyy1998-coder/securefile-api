import { useMemo, useState } from "react";
import { CreditCard, Shield, User } from "lucide-react";
import { cn } from "@/lib/utils";
import SettingsPanel, {
  type SettingsTab,
} from "../components/settings/SettingsPanel";

const TABS: Array<{
  id: SettingsTab;
  label: string;
  description: string;
  icon: typeof User;
}> = [
  {
    id: "profile",
    label: "Profile",
    description: "Your account details",
    icon: User,
  },
  {
    id: "security",
    label: "Security",
    description: "Password and account access",
    icon: Shield,
  },
  {
    id: "subscription",
    label: "Subscription",
    description: "Plan, billing, and limits",
    icon: CreditCard,
  },
];

export default function Settings() {
  const [tab, setTab] = useState<SettingsTab>("profile");
  const active = useMemo(() => TABS.find((t) => t.id === tab) || TABS[0], [tab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
          Workspace
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">{active.description}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-border bg-card p-2 shadow-sm">
          <nav className="flex flex-col gap-0.5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-medium transition-colors",
                  tab === id
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <Icon size={15} className="shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <SettingsPanel tab={tab} />
      </div>
    </div>
  );
}
