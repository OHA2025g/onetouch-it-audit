import React, { useEffect, useState } from "react";
import api from "@/api";
import { PageHeader, SectionHeader, StatusBadge } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmtDate, timeAgo } from "@/lib/format";
import { toast } from "sonner";
import { Plug, CheckCircle2, XCircle, AlertCircle, Settings, RefreshCw, PlayCircle } from "lucide-react";

const FIELD_HINTS = {
  AWS: ["access_key_id", "secret_access_key", "region"],
  "Active Directory": ["host", "bind_user", "bind_password", "base_dn"],
  ServiceNow: ["instance", "username", "password"],
  GitHub: ["token", "org"],
};

function detectKind(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("aws") || n.includes("amazon")) return "AWS";
  if (n.includes("active directory") || n.includes("ldap") || n.includes(" ad ")) return "Active Directory";
  if (n.includes("servicenow") || n.includes("service-now")) return "ServiceNow";
  if (n.includes("github")) return "GitHub";
  return null;
}

export default function Integrations() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(null);
  const [syncing, setSyncing] = useState(null);
  const [results, setResults] = useState({});
  const [editing, setEditing] = useState(null);
  const [config, setConfig] = useState({});

  const load = () => api.get("/admin/integrations").then(r => setItems(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const test = async (id) => {
    setTesting(id);
    try {
      const r = await api.post(`/admin/integrations/${id}/test`);
      setResults(s => ({ ...s, [id]: r.data }));
      if (r.data.success) toast.success(r.data.message);
      else toast.error(r.data.message);
      load();
    } catch { toast.error("Test failed"); }
    finally { setTesting(null); }
  };

  const sync = async (id) => {
    setSyncing(id);
    try {
      const r = await api.post(`/admin/integrations/${id}/sync`);
      setResults(s => ({ ...s, [id]: r.data }));
      if (r.data.success) toast.success(`Sync OK · ${r.data.message}`);
      else toast.error(`Sync failed · ${r.data.message}`);
      load();
    } catch { toast.error("Sync failed"); }
    finally { setSyncing(null); }
  };

  const openEdit = (it) => {
    setEditing(it);
    // Server returns masked values like "••• set" — keep them so UI shows the field is set
    setConfig(it.auth_config || {});
  };

  const saveConfig = async () => {
    try {
      await api.patch(`/admin/integrations/${editing.integration_id}`, { auth_config: config });
      toast.success("Configuration saved");
      setEditing(null);
      load();
    } catch { toast.error("Save failed"); }
  };

  if (loading) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-6" data-testid="integrations-page">
      <PageHeader eyebrow="CONNECTOR HUB" title="Integrations" subtitle={`${items.length} systems wired · AWS · LDAP/AD · ServiceNow · GitHub supported`} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(it => {
          const kind = detectKind(it.system_name);
          const supported = !!kind;
          const lastResult = results[it.integration_id];
          return (
            <div key={it.integration_id} className="crt-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-zinc-100 dark:bg-zinc-800 rounded-sm flex items-center justify-center">
                    <Plug className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-display font-bold text-sm tracking-tight">{it.system_name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">{it.system_type} · {it.connector_type}</div>
                  </div>
                </div>
                <StatusBadge value={it.last_sync_status} />
              </div>
              <div className="text-[10px] text-zinc-500 font-mono mb-3">Last sync: {timeAgo(it.last_sync_at)}</div>
              {!supported && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-400 mb-3 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-sm border border-amber-200 dark:border-amber-900">
                  <AlertCircle className="w-3 h-3" /> Connector implementation pending
                </div>
              )}
              {lastResult && (
                <div className={`text-[10px] mb-3 p-2 rounded-sm border ${lastResult.success ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400'}`}>
                  <div className="flex items-center gap-1 mb-0.5">
                    {lastResult.success ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    <span className="font-bold">{lastResult.success ? "Connected" : "Failed"}</span>
                  </div>
                  {lastResult.message}
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="rounded-sm flex-1" disabled={!supported} onClick={() => openEdit(it)} data-testid={`integration-config-${it.integration_id}`}><Settings className="w-3 h-3 mr-1" /> Configure</Button>
                <Button size="sm" variant="outline" className="rounded-sm flex-1" disabled={testing === it.integration_id || !supported} onClick={() => test(it.integration_id)} data-testid={`integration-test-${it.integration_id}`}>
                  <RefreshCw className={`w-3 h-3 mr-1 ${testing === it.integration_id ? 'animate-spin' : ''}`} /> Test
                </Button>
                <Button size="sm" className="rounded-sm bg-blue-700 hover:bg-blue-800 flex-1" disabled={syncing === it.integration_id || !supported} onClick={() => sync(it.integration_id)} data-testid={`integration-sync-${it.integration_id}`}>
                  <PlayCircle className={`w-3 h-3 mr-1 ${syncing === it.integration_id ? 'animate-pulse' : ''}`} /> Sync
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="rounded-sm">
          <DialogHeader><DialogTitle className="font-display tracking-tight">{editing?.system_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">Provide credentials. Stored Fernet-encrypted at rest. Existing values shown as <code>••• set</code> — leave blank to keep, type new value to overwrite.</p>
            {(FIELD_HINTS[detectKind(editing?.system_name)] || []).map(f => (
              <div key={f}>
                <Label className="crt-overline text-[10px]">{f.replace(/_/g, " ")}</Label>
                {f.includes("password") || f === "token" || f.includes("secret") ? (
                  <Input type="password" placeholder={config[f] === "••• set" ? "••• set (leave blank to keep)" : ""} className="rounded-sm mt-1" value={config[f] === "••• set" ? "" : (config[f] || "")} onChange={e => setConfig({...config, [f]: e.target.value})} data-testid={`integration-field-${f}`} />
                ) : (
                  <Input placeholder={config[f] === "••• set" ? "••• set" : ""} className="rounded-sm mt-1" value={config[f] === "••• set" ? "" : (config[f] || "")} onChange={e => setConfig({...config, [f]: e.target.value})} data-testid={`integration-field-${f}`} />
                )}
              </div>
            ))}
            <Button onClick={saveConfig} className="w-full rounded-sm bg-blue-700 hover:bg-blue-800" data-testid="integration-save-btn">Save Configuration</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
