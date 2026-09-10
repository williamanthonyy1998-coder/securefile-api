import { useEffect, useMemo, useState } from "react";
import { Bell, Files, Folder, HardDrive, Users } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const USED_COLOR = "#f77f00";
const FREE_COLOR = "#e8e8e8";

export default function Dashboard() {
  const [d, setD] = useState<any>();

  useEffect(() => {
    api("/companies/stats").then(setD).catch(console.error);
  }, []);

  const usedGb = Number(d?.storageUsedBytes || 0) / 1073741824;
  const limitGb = Number(d?.storageLimitGb || 0) || 1;
  const freeGb = Math.max(0, limitGb - usedGb);
  const usedPct = Math.min(100, (usedGb / limitGb) * 100);

  const chartData = useMemo(
    () => [
      { name: "Used", value: Number(usedGb.toFixed(4)), fill: USED_COLOR },
      { name: "Available", value: Number(freeGb.toFixed(4)), fill: FREE_COLOR },
    ],
    [usedGb, freeGb],
  );

  const stats: Array<[string, number, typeof Users]> = [
    ["Users", d?.users || 0, Users],
    ["Files", d?.files || 0, Files],
    ["Folders", d?.folders || 0, Folder],
    ["Unread notifications", d?.unreadNotifications || 0, Bell],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
          Workspace
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Everything your team needs in one place.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, Icon]) => (
          <Card key={label} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription className="text-[13px] font-medium">
                {label}
              </CardDescription>
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
                <Icon size={16} />
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-[28px] font-bold tracking-tight">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Storage</CardTitle>
            <CardDescription className="mt-1">
              {usedGb.toFixed(2)} GB used of {d?.storageLimitGb || 0} GB
            </CardDescription>
          </div>
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
            <HardDrive size={16} />
          </span>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
          <div className="mx-auto h-[200px] w-full max-w-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={84}
                  paddingAngle={2}
                  stroke="none"
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    `${Number(value || 0).toFixed(2)} GB`,
                    "",
                  ]}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #e8e8e8",
                    background: "#ffffff",
                    color: "#1b1b1b",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Progress value={usedPct} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {usedPct.toFixed(0)}% of plan storage in use
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/50 px-4 py-3">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: USED_COLOR }}
                  />
                  Used
                </div>
                <p className="text-lg font-bold tracking-tight text-foreground">
                  {usedGb.toFixed(2)} GB
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/50 px-4 py-3">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: FREE_COLOR }}
                  />
                  Available
                </div>
                <p className="text-lg font-bold tracking-tight text-foreground">
                  {freeGb.toFixed(2)} GB
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
