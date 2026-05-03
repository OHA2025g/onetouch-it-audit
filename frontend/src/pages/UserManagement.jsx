import React, { useEffect, useState } from "react";
import api from "@/api";
import { PageHeader, SectionHeader, StatusBadge } from "@/components/Primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Users, ShieldCheck, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role_name: "Auditor", designation: "" });
  const [settings, setSettings] = useState(null);
  const [savingSetting, setSavingSetting] = useState(false);

  const load = () => api.get("/admin/users").then(r => setUsers(r.data)).finally(() => setLoading(false));
  useEffect(() => {
    load();
    api.get("/admin/roles").then(r => setRoles(r.data));
    api.get("/admin/settings").then(r => setSettings(r.data)).catch(() => setSettings({ mfa_enforcement_enabled: false }));
  }, []);

  const toggleMfa = async (next) => {
    setSavingSetting(true);
    try {
      const r = await api.patch("/admin/settings", { mfa_enforcement_enabled: next });
      setSettings(r.data);
      toast.success(next ? "MFA enforcement enabled for privileged roles" : "MFA enforcement disabled — users log in with password only");
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setSavingSetting(false); }
  };

  const create = async () => {
    try {
      await api.post("/admin/users", form);
      toast.success("User created");
      setOpen(false);
      setForm({ name: "", email: "", password: "", role_name: "Auditor", designation: "" });
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  if (loading) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-6" data-testid="user-management-page">
      <PageHeader eyebrow="ADMIN · RBAC" title="User Management" subtitle={`${users.length} users · ${roles.length} role definitions`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-sm bg-blue-700 hover:bg-blue-800" data-testid="invite-user-btn"><Plus className="w-3.5 h-3.5 mr-1" /> Invite User</Button>
            </DialogTrigger>
            <DialogContent className="rounded-sm">
              <DialogHeader><DialogTitle className="font-display tracking-tight">Invite New User</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label className="crt-overline text-[10px]">Full Name</Label><Input className="rounded-sm mt-1" value={form.name} onChange={e => setForm({...form, name: e.target.value})} data-testid="newuser-name" /></div>
                <div><Label className="crt-overline text-[10px]">Email</Label><Input type="email" className="rounded-sm mt-1" value={form.email} onChange={e => setForm({...form, email: e.target.value})} data-testid="newuser-email" /></div>
                <div><Label className="crt-overline text-[10px]">Initial Password</Label><Input className="rounded-sm mt-1" value={form.password} onChange={e => setForm({...form, password: e.target.value})} data-testid="newuser-password" /></div>
                <div>
                  <Label className="crt-overline text-[10px]">Role</Label>
                  <Select value={form.role_name} onValueChange={v => setForm({...form, role_name: v})}>
                    <SelectTrigger className="rounded-sm mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{roles.map(r => <SelectItem key={r.role_name} value={r.role_name}>{r.role_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="crt-overline text-[10px]">Designation</Label><Input className="rounded-sm mt-1" value={form.designation} onChange={e => setForm({...form, designation: e.target.value})} /></div>
                <Button onClick={create} className="w-full rounded-sm bg-blue-700 hover:bg-blue-800" data-testid="newuser-submit">Create User</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Security Settings */}
      <div className="crt-card p-5" data-testid="security-settings-card">
        <SectionHeader eyebrow="SECURITY"><Settings2 className="w-3.5 h-3.5 inline-block mr-1" /> Authentication Settings</SectionHeader>
        <div className="flex items-start justify-between gap-4 p-3 border border-zinc-200 dark:border-zinc-800 rounded-sm">
          <div className="flex-1">
            <div className="font-medium text-sm">MFA Enforcement (TOTP)</div>
            <div className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
              When enabled, users in <span className="font-mono">CIO / CISO / Admin</span> roles must complete a 6-digit TOTP code after password login.
              When disabled, all users log in with email + password only. TOTP secrets remain preserved.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm border ${settings?.mfa_enforcement_enabled ? "text-emerald-600 border-emerald-500/50 bg-emerald-500/5" : "text-zinc-500 border-zinc-500/40"}`} data-testid="mfa-state-badge">
              {settings?.mfa_enforcement_enabled ? "ENABLED" : "DISABLED"}
            </span>
            <Switch
              checked={!!settings?.mfa_enforcement_enabled}
              onCheckedChange={toggleMfa}
              disabled={!settings || savingSetting}
              data-testid="mfa-enforcement-toggle"
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="crt-card p-5 lg:col-span-2">
          <SectionHeader eyebrow={`${users.length} ACCOUNTS`}><Users className="w-3.5 h-3.5 inline-block mr-1" /> Users</SectionHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs crt-table">
              <thead className="text-zinc-500 border-b border-zinc-200 dark:border-zinc-800"><tr>
                <th className="text-left py-2 px-2">Name</th><th className="text-left px-2">Email</th><th className="text-left px-2">Role</th><th className="text-left px-2">Status</th><th className="text-left px-2">Last Login</th><th className="text-left px-2">MFA</th>
              </tr></thead>
              <tbody>{users.map(u => (
                <tr key={u.user_id} className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="py-2 px-2 font-medium">{u.name}</td>
                  <td className="px-2 font-mono text-[10px] text-zinc-500">{u.email}</td>
                  <td className="px-2"><span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-sm">{u.role_name}</span></td>
                  <td className="px-2"><StatusBadge value={u.status === "active" ? "Active" : "Inactive"} /></td>
                  <td className="px-2 font-mono text-[10px] text-zinc-500">{fmtDate(u.last_login)}</td>
                  <td className="px-2">{u.mfa_enabled ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-zinc-400">—</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
        <div className="crt-card p-5">
          <SectionHeader eyebrow={`${roles.length} DEFINED`}><ShieldCheck className="w-3.5 h-3.5 inline-block mr-1" /> Roles</SectionHeader>
          <div className="space-y-2">
            {roles.map(r => (
              <div key={r.role_id} className="p-2.5 border border-zinc-200 dark:border-zinc-800 rounded-sm">
                <div className="font-display font-bold text-sm tracking-tight">{r.role_name}</div>
                <div className="text-[11px] text-zinc-500 mt-1">{r.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
