import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";
import api, { BACKEND_URL } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ShieldCheck, AlertCircle, KeyRound, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const BG_IMG = "https://images.unsplash.com/photo-1745689226178-a99780b5151b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGNvcnBvcmF0ZSUyMGFyY2hpdGVjdHVyZXxlbnwwfHx8fDE3Nzc2MTYwNTd8MA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stage, setStage] = useState("credentials"); // credentials | mfa-setup | mfa-verify
  const [email, setEmail] = useState("admin@auditai.com");
  const [password, setPassword] = useState("Admin@123");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [mfa, setMfa] = useState({ challenge: null, qr: null, secret: null });
  const [mfaCode, setMfaCode] = useState("");

  useEffect(() => { if (user) navigate("/dashboard"); }, [user, navigate]);

  const finalizeLogin = (data) => {
    localStorage.setItem("auth_token", data.access_token);
    localStorage.setItem("auth_user", JSON.stringify(data.user));
    window.location.href = "/dashboard";
  };

  const submitCreds = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const r = await api.post("/auth/login", { email, password });
      if (r.data.mfa_required) {
        if (r.data.mfa_setup_required) {
          // First-time MFA setup
          const setupRes = await api.post("/auth/mfa/setup", { mfa_challenge: r.data.mfa_challenge });
          setMfa({ challenge: r.data.mfa_challenge, qr: setupRes.data.qr, secret: setupRes.data.secret });
          setStage("mfa-setup");
        } else {
          setMfa({ challenge: r.data.mfa_challenge, qr: null, secret: null });
          setStage("mfa-verify");
        }
      } else {
        finalizeLogin(r.data);
      }
    } catch (ex) {
      const d = ex.response?.data?.detail;
      if (d != null) {
        setErr(typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => x.msg || String(x)).join(" ") : String(d));
      } else if (!ex.response) {
        setErr(`Cannot reach the API at ${BACKEND_URL}. Start the backend (uvicorn on port 8001) and ensure MongoDB is running.`);
      } else {
        setErr("Login failed");
      }
    } finally { setBusy(false); }
  };

  const submitMfa = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const r = await api.post("/auth/mfa/verify", { mfa_challenge: mfa.challenge, code: mfaCode });
      toast.success("MFA verified");
      finalizeLogin(r.data);
    } catch (ex) {
      setErr(ex.response?.data?.detail || "Invalid code");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-zinc-100 dark:bg-zinc-950">
      <div className="relative hidden lg:block overflow-hidden">
        <img src={BG_IMG} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-zinc-950/80 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/60 via-zinc-950/80 to-black/90" />
        <div className="relative z-10 h-full flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm border border-white/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="crt-overline text-white/60">ONE TOUCH</div>
              <div className="font-display font-black text-xl tracking-tight">IT AUDIT AI</div>
            </div>
          </div>
          <div className="space-y-6">
            <h1 className="font-display text-5xl xl:text-6xl font-black tracking-tighter leading-[0.95]">Audit-ready.<br/>Always.</h1>
            <p className="text-zinc-300 max-w-md text-base leading-relaxed">The AI-powered command center for CIOs. Continuous controls monitoring, real-time risk prioritization, and board-ready reports — in a single pane of glass.</p>
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/10">
              {[{l:"FRAMEWORKS",v:"ISO • SOC2 • DPDP • RBI"},{l:"CONTROLS",v:"50+ continuous"},{l:"AI",v:"Claude Sonnet 4.5"}].map((s) => (
                <div key={s.l}><div className="crt-overline text-white/50 text-[9px]">{s.l}</div><div className="text-sm font-semibold mt-1">{s.v}</div></div>
              ))}
            </div>
          </div>
          <div className="text-xs text-white/40">Govt. of India ready • DPDP Act compliant</div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <Card className="w-full max-w-md p-8 crt-card border-zinc-200 dark:border-zinc-800">
          <div className="lg:hidden flex items-center gap-2 mb-8"><ShieldCheck className="w-6 h-6 text-blue-700 dark:text-blue-400" /><span className="font-display font-black tracking-tight">ONE TOUCH IT AUDIT AI</span></div>

          {stage === "credentials" && (
            <>
              <div className="crt-overline mb-2">Sign In</div>
              <h2 className="font-display text-3xl font-black tracking-tight mb-1">Welcome back, CIO.</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">Access your audit command center.</p>
              <form onSubmit={submitCreds} className="space-y-5">
                <div><Label className="crt-overline text-[10px]">Email</Label><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="cio@yourorg.com" className="mt-2 rounded-sm border-zinc-300 dark:border-zinc-700 h-11" data-testid="login-email-input" /></div>
                <div><Label className="crt-overline text-[10px]">Password</Label><Input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 rounded-sm border-zinc-300 dark:border-zinc-700 h-11" data-testid="login-password-input" /></div>
                {err && <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-sm text-sm text-red-800 dark:text-red-300"><AlertCircle className="w-4 h-4" /> {err}</div>}
                <Button type="submit" disabled={busy} className="w-full h-11 rounded-sm bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 font-semibold tracking-wide" data-testid="login-submit-button">{busy ? "Signing in..." : "Sign In →"}</Button>
              </form>
              <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <div className="crt-overline mb-2 text-[9px]">Demo Credentials</div>
                <div className="font-mono text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                  <div>admin@auditai.com / Admin@123</div>
                  <div className="text-zinc-400 dark:text-zinc-500">ananya.reddy@auditai.com / Welcome@123</div>
                </div>
              </div>
            </>
          )}

          {stage === "mfa-setup" && (
            <>
              <button onClick={() => setStage("credentials")} className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 mb-4 flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Back</button>
              <div className="crt-overline mb-2">Enroll MFA</div>
              <h2 className="font-display text-2xl font-black tracking-tight mb-1">Set up authenticator</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Scan the QR with Google / Microsoft Authenticator, then enter the 6-digit code.</p>
              {mfa.qr && (
                <div className="flex justify-center mb-4 p-4 bg-white border border-zinc-200 dark:border-zinc-800 rounded-sm">
                  <img src={mfa.qr} alt="QR code" className="w-48 h-48" data-testid="mfa-qr-code" />
                </div>
              )}
              {mfa.secret && (
                <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm">
                  <div className="crt-overline text-[9px] mb-1">Or paste manually</div>
                  <div className="font-mono text-xs text-zinc-600 dark:text-zinc-400 break-all">{mfa.secret}</div>
                </div>
              )}
              <form onSubmit={submitMfa} className="space-y-4">
                <div><Label className="crt-overline text-[10px]">6-Digit Code</Label><Input required maxLength={6} value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g,''))} className="mt-2 rounded-sm border-zinc-300 dark:border-zinc-700 h-11 text-center font-mono text-lg tracking-[0.5em]" placeholder="000000" data-testid="mfa-code-input" /></div>
                {err && <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-sm text-sm text-red-800 dark:text-red-300"><AlertCircle className="w-4 h-4" /> {err}</div>}
                <Button type="submit" disabled={busy || mfaCode.length !== 6} className="w-full h-11 rounded-sm bg-blue-700 hover:bg-blue-800 font-semibold" data-testid="mfa-verify-btn">{busy ? "Verifying..." : "Verify & Enable MFA"}</Button>
              </form>
            </>
          )}

          {stage === "mfa-verify" && (
            <>
              <button onClick={() => setStage("credentials")} className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 mb-4 flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Back</button>
              <div className="crt-overline mb-2">MFA Required</div>
              <h2 className="font-display text-2xl font-black tracking-tight mb-1 flex items-center gap-2"><KeyRound className="w-5 h-5" /> Enter authenticator code</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Open your authenticator app to retrieve the 6-digit code.</p>
              <form onSubmit={submitMfa} className="space-y-4">
                <Input required maxLength={6} value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g,''))} className="rounded-sm border-zinc-300 dark:border-zinc-700 h-12 text-center font-mono text-2xl tracking-[0.5em]" placeholder="000000" data-testid="mfa-code-input" autoFocus />
                {err && <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-sm text-sm text-red-800 dark:text-red-300"><AlertCircle className="w-4 h-4" /> {err}</div>}
                <Button type="submit" disabled={busy || mfaCode.length !== 6} className="w-full h-11 rounded-sm bg-blue-700 hover:bg-blue-800 font-semibold" data-testid="mfa-verify-btn">{busy ? "Verifying..." : "Verify"}</Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
