import React, { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Bell, Check, AlertTriangle, FileText, ShieldAlert, ClipboardList } from "lucide-react";
import api from "@/api";
import { timeAgo } from "@/lib/format";

const ICON = {
  CCM_Alert: ShieldAlert,
  Observation_Assigned: ClipboardList,
  SLA_Warning: AlertTriangle,
  SLA_Breached: AlertTriangle,
  Report_Ready: FileText,
  Evidence_Requested: FileText,
  Audit_Started: ClipboardList,
  Escalation: AlertTriangle,
};

export default function NotificationDrawer({ open, onOpenChange, onChange }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const r = await api.get("/notifications");
      setItems(r.data || []);
    } finally { setBusy(false); }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const markRead = async (id) => {
    await api.post(`/notifications/${id}/mark-read`);
    setItems((s) => s.map(x => x.notification_id === id ? { ...x, is_read: true } : x));
    if (onChange) {
      const r = await api.get("/notifications/unread-count");
      onChange(r.data.count || 0);
    }
  };

  const markAll = async () => {
    await api.post("/notifications/mark-all-read");
    setItems((s) => s.map(x => ({ ...x, is_read: true })));
    if (onChange) onChange(0);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:max-w-md overflow-y-auto rounded-none">
        <SheetHeader className="pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-display tracking-tight flex items-center gap-2">
              <Bell className="w-4 h-4" /> Notifications
            </SheetTitle>
            <Button variant="ghost" size="sm" onClick={markAll} className="text-xs rounded-sm" data-testid="mark-all-read-btn">
              <Check className="w-3.5 h-3.5 mr-1" /> Mark all read
            </Button>
          </div>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {busy && <div className="text-sm text-zinc-500">Loading…</div>}
          {!busy && items.length === 0 && (
            <div className="text-sm text-zinc-500 text-center py-12">No notifications</div>
          )}
          {items.map((n) => {
            const Ic = ICON[n.notification_type] || Bell;
            return (
              <div
                key={n.notification_id}
                onClick={() => markRead(n.notification_id)}
                data-testid={`notification-item-${n.notification_id}`}
                className={`p-3 border rounded-sm cursor-pointer transition-colors ${
                  n.is_read
                    ? "bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800"
                    : "bg-white dark:bg-zinc-900 border-blue-200 dark:border-blue-900 hover:border-blue-400"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-sm flex items-center justify-center flex-shrink-0 ${
                    n.priority === "Critical" || n.priority === "High"
                      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}>
                    <Ic className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold truncate">{n.title}</span>
                      {!n.is_read && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full flex-shrink-0" />}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">{n.body}</div>
                    <div className="text-[10px] text-zinc-400 mt-1 font-mono">{timeAgo(n.created_at)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
