import React, { useEffect, useState } from "react";
import api from "@/api";
import { PageHeader, SectionHeader } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle, FileText, ClipboardList, ShieldAlert, Check } from "lucide-react";
import { timeAgo } from "@/lib/format";

const ICONS = {
  CCM_Alert: ShieldAlert, Observation_Assigned: ClipboardList,
  SLA_Warning: AlertTriangle, SLA_Breached: AlertTriangle,
  Report_Ready: FileText, Evidence_Requested: FileText,
};

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = () => api.get("/notifications").then(r => setItems(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const markAll = async () => { await api.post("/notifications/mark-all-read"); load(); };
  return (
    <div className="space-y-6" data-testid="notifications-page">
      <PageHeader eyebrow="ALL ALERTS" title="Notifications"
        actions={<Button size="sm" variant="outline" className="rounded-sm" onClick={markAll}><Check className="w-3.5 h-3.5 mr-1" /> Mark all read</Button>}
      />
      {loading ? <Skeleton className="h-96" /> : (
        <div className="crt-card p-5 space-y-2">
          {items.length === 0 && <div className="py-12 text-center text-sm text-zinc-400">No notifications</div>}
          {items.map(n => {
            const Ic = ICONS[n.notification_type] || Bell;
            return (
              <div key={n.notification_id} className={`flex items-start gap-3 p-3 border rounded-sm ${n.is_read ? 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800' : 'bg-white dark:bg-zinc-900 border-blue-200 dark:border-blue-900'}`}>
                <Ic className="w-4 h-4 text-zinc-500 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{n.title}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{n.body}</div>
                  <div className="text-[10px] text-zinc-400 mt-1 font-mono">{timeAgo(n.created_at)} · {n.priority}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
