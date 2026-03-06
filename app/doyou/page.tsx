// PATH: app/admin/page.tsx

"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Types ────────────────────────────────────────────────────────────────────
type Deposit       = { id: string; user_id: string; amount: number; daily_earnings: number; screenshot_url: string; status: string; created_at: string; profiles: { full_name: string; email: string } };
type Withdrawal    = { id: string; user_id: string; amount: number; fee: number; amount_after_fee: number; phone: string; status: string; created_at: string; profiles: { full_name: string; email: string } };
type User          = { id: string; full_name: string; email: string; phone: string; avatar_color: string; avatar_initials: string; balance: number; referral_code: string; created_at: string; banned: boolean; banned_reason?: string };
type RedeemCode    = { id: string; code: string; value: number; used: boolean; created_at: string };
type Package       = { id: string; amount: number; daily_earnings: number; duration_days: number; active: boolean };
type PaymentSetting = { id: string; account_number: string; account_name: string; network: string; active: boolean; created_at: string };

// ─── Sidebar tabs ─────────────────────────────────────────────────────────────
const TABS = [
  { key: "deposits",    icon: "💰", label: "Deposits" },
  { key: "withdrawals", icon: "💸", label: "Withdrawals" },
  { key: "packages",    icon: "📦", label: "Packages" },
  { key: "payment",     icon: "🏦", label: "Payment Info" },
  { key: "users",       icon: "👥", label: "Users" },
  { key: "codes",       icon: "🎟️", label: "Redeem Codes" },
  { key: "notify",      icon: "📢", label: "Notify" },
];

const INPUT = "w-full bg-[#050E1F] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-green-500 focus:outline-none transition";

export default function AdminPage() {
  const [tab, setTab] = useState("deposits");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [deposits, setDeposits]           = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals]     = useState<Withdrawal[]>([]);
  const [users, setUsers]                 = useState<User[]>([]);
  const [redeemCodes, setRedeemCodes]     = useState<RedeemCode[]>([]);
  const [packages, setPackages]           = useState<Package[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSetting[]>([]);

  // Package form
  const [pkgForm, setPkgForm]   = useState({ amount: "", daily: "", duration: "30" });
  const [editingPkg, setEditingPkg] = useState<Package | null>(null);
  const [pkgMsg, setPkgMsg]     = useState("");

  // Payment form
  const [payForm, setPayForm]   = useState({ account_number: "", account_name: "", network: "" });
  const [editingPayId, setEditingPayId] = useState<string | null>(null);
  const [payMsg, setPayMsg]     = useState("");

  // Redeem code
  const [newCodeValue, setNewCodeValue] = useState("");

  // Notify
  const [notifTarget, setNotifTarget] = useState("all");
  const [notifTitle, setNotifTitle]   = useState("");
  const [notifMsg, setNotifMsg]       = useState("");

  // Ban modal
  const [banModal, setBanModal]       = useState<User | null>(null);
  const [banReason, setBanReason]     = useState("");

  // Auth — password checked server-side, never exposed in client bundle
  const [authed, setAuthed]           = useState(false);
  const [pw, setPw]                   = useState("");
  const [toast, setToast]             = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError]     = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  useEffect(() => { if (authed) loadAll(); }, [authed]);

  // ─── Load all ──────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    const [dep, wit, usr, codes, pkgs, pay] = await Promise.all([
      supabase.from("deposits").select("*, profiles(full_name, email)").order("created_at", { ascending: false }),
      supabase.from("withdrawals").select("*, profiles(full_name, email)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("redeem_codes").select("*").order("created_at", { ascending: false }),
      supabase.from("packages").select("*").order("amount", { ascending: true }),
      // FIX: don't order by created_at — use id instead to avoid 400 if column missing
      supabase.from("payment_settings").select("*").order("id", { ascending: false }),
    ]);
    if (dep.data)   setDeposits(dep.data);
    if (wit.data)   setWithdrawals(wit.data);
    if (usr.data)   setUsers(usr.data);
    if (codes.data) setRedeemCodes(codes.data);
    if (pkgs.data)  setPackages(pkgs.data);
    if (pay.data)   setPaymentSettings(pay.data);
    if (pay.error)  showToast("⚠️ Payment settings error: " + pay.error.message);
  }, []);

  // ─── Deposits ──────────────────────────────────────────────────────────────
  async function approveDeposit(dep: Deposit) {
    await supabase.from("deposits").update({ status: "approved" }).eq("id", dep.id);

    // Look up duration_days from the matching package
    const { data: pkg } = await supabase
      .from("packages")
      .select("duration_days")
      .eq("amount", dep.amount)
      .maybeSingle();

    await supabase.from("investments").insert({
      user_id: dep.user_id,
      amount: dep.amount,
      daily_earnings: dep.daily_earnings,
      duration_days: pkg?.duration_days || 30,
      days_elapsed: 0,
      active: true,
    });
    const { data: depositor } = await supabase.from("profiles").select("referred_by").eq("id", dep.user_id).single();
    if (depositor?.referred_by) {
      const { data: l1 } = await supabase.from("profiles").select("id, balance").eq("referral_code", depositor.referred_by).maybeSingle();
      if (l1) {
        const commission = dep.amount * 0.07;
        await supabase.from("profiles").update({ balance: l1.balance + commission }).eq("id", l1.id);
        await supabase.from("notifications").insert({ user_id: l1.id, title: "💰 Referral Commission!", message: `You earned GHS ${commission.toFixed(2)} (7%) from a Level 1 referral deposit of GHS ${dep.amount}.`, type: "commission" });
      }
    }
    await supabase.from("notifications").insert({ user_id: dep.user_id, title: "✅ Deposit Confirmed!", message: `Your deposit of GHS ${dep.amount} has been confirmed and is now earning GHS ${dep.daily_earnings}/day!`, type: "deposit" });
    showToast("✅ Deposit approved!");
    loadAll();
  }

  async function rejectDeposit(id: string) {
    await supabase.from("deposits").update({ status: "rejected" }).eq("id", id);
    showToast("❌ Deposit rejected.");
    loadAll();
  }

  // ─── Withdrawals ───────────────────────────────────────────────────────────
  async function approveWithdrawal(wit: Withdrawal) {
    await supabase.from("withdrawals").update({ status: "approved" }).eq("id", wit.id);
    await supabase.from("notifications").insert({ user_id: wit.user_id, title: "✅ Withdrawal Approved!", message: `Your withdrawal of GHS ${wit.amount_after_fee?.toFixed(2)} has been sent to your MoMo. Allow 1–2 hours to reflect.`, type: "withdrawal" });
    showToast("✅ Withdrawal approved!");
    loadAll();
  }

  async function rejectWithdrawal(wit: Withdrawal) {
    await supabase.from("withdrawals").update({ status: "rejected" }).eq("id", wit.id);
    const { data: prof } = await supabase.from("profiles").select("balance").eq("id", wit.user_id).single();
    await supabase.from("profiles").update({ balance: (prof?.balance || 0) + wit.amount }).eq("id", wit.user_id);
    await supabase.from("notifications").insert({ user_id: wit.user_id, title: "❌ Withdrawal Rejected", message: `Your withdrawal of GHS ${wit.amount} was rejected and refunded to your wallet.`, type: "withdrawal" });
    showToast("Withdrawal rejected & refunded.");
    loadAll();
  }

  // ─── Packages ──────────────────────────────────────────────────────────────
  async function savePackage() {
    const amount   = parseFloat(pkgForm.amount);
    const daily    = parseFloat(pkgForm.daily);
    const duration = parseInt(pkgForm.duration) || 30;
    if (!amount || !daily) { setPkgMsg("Please enter amount and daily earnings."); return; }

    if (editingPkg) {
      const { error } = await supabase.from("packages").update({ amount, daily_earnings: daily, duration_days: duration }).eq("id", editingPkg.id);
      if (error) { setPkgMsg("Error: " + error.message); return; }
      setEditingPkg(null);
      showToast("✅ Package updated!");
    } else {
      const { error } = await supabase.from("packages").insert({ amount, daily_earnings: daily, duration_days: duration, active: true });
      if (error) { setPkgMsg("Error: " + error.message); return; }
      showToast("✅ Package added!");
    }
    setPkgForm({ amount: "", daily: "", duration: "30" });
    setPkgMsg("");
    loadAll();
  }

  function startEditPackage(pkg: Package) {
    setEditingPkg(pkg);
    setPkgForm({ amount: String(pkg.amount), daily: String(pkg.daily_earnings), duration: String(pkg.duration_days || 30) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function togglePackage(pkg: Package) {
    await supabase.from("packages").update({ active: !pkg.active }).eq("id", pkg.id);
    loadAll();
  }

  async function deletePackage(id: string) {
    if (!confirm("Delete this package? This cannot be undone.")) return;
    const { error } = await supabase.from("packages").delete().eq("id", id);
    if (error) { showToast("Delete failed: " + error.message); return; }
    showToast("🗑️ Package deleted.");
    loadAll();
  }

  // ─── Payment Settings ──────────────────────────────────────────────────────
  function startEditPayment(pay: PaymentSetting) {
    setEditingPayId(pay.id);
    setPayForm({ account_number: pay.account_number, account_name: pay.account_name, network: pay.network });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function savePayment() {
    if (!payForm.account_number || !payForm.account_name || !payForm.network) {
      setPayMsg("Please fill in all fields.");
      return;
    }
    if (editingPayId) {
      const { error } = await supabase.from("payment_settings").update({ account_number: payForm.account_number, account_name: payForm.account_name, network: payForm.network }).eq("id", editingPayId);
      if (error) { setPayMsg("Error: " + error.message); return; }
      setEditingPayId(null);
      showToast("✅ Payment info updated!");
    } else {
      const { error } = await supabase.from("payment_settings").insert({ account_number: payForm.account_number, account_name: payForm.account_name, network: payForm.network, active: false });
      if (error) { setPayMsg("Error: " + error.message); return; }
      showToast("✅ Payment account added!");
    }
    setPayForm({ account_number: "", account_name: "", network: "" });
    setPayMsg("");
    loadAll();
  }

  async function setActivePayment(id: string) {
    // Deactivate all, then activate selected
    await supabase.from("payment_settings").update({ active: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("payment_settings").update({ active: true }).eq("id", id);
    showToast("✅ Active payment updated!");
    loadAll();
  }

  async function deletePayment(id: string) {
    if (!confirm("Delete this payment account?")) return;
    const { error } = await supabase.from("payment_settings").delete().eq("id", id);
    if (error) { showToast("Delete failed: " + error.message); return; }
    showToast("🗑️ Payment account deleted.");
    loadAll();
  }

  // ─── Users — ban / delete ──────────────────────────────────────────────────
  async function confirmBan() {
    if (!banModal) return;
    if (banModal.banned) {
      // Unban
      await supabase.from("profiles").update({ banned: false, banned_reason: null }).eq("id", banModal.id);
      showToast("✅ User unbanned.");
    } else {
      // Ban
      await supabase.from("profiles").update({ banned: true, banned_reason: banReason || "Violation of terms" }).eq("id", banModal.id);
      await supabase.from("notifications").insert({ user_id: banModal.id, title: "🚫 Account Suspended", message: `Your account has been suspended. Reason: ${banReason || "Violation of terms"}. Contact support to appeal.`, type: "admin" });
      showToast("🚫 User banned.");
    }
    setBanModal(null);
    setBanReason("");
    loadAll();
  }

  async function deleteUser(user: User) {
    if (!confirm(`Permanently delete ${user.full_name}? This removes their profile and all data. This CANNOT be undone.`)) return;
    // Delete related data first
    await Promise.all([
      supabase.from("deposits").delete().eq("user_id", user.id),
      supabase.from("withdrawals").delete().eq("user_id", user.id),
      supabase.from("investments").delete().eq("user_id", user.id),
      supabase.from("notifications").delete().eq("user_id", user.id),
    ]);
    const { error } = await supabase.from("profiles").delete().eq("id", user.id);
    if (error) { showToast("Delete failed: " + error.message); return; }
    showToast("🗑️ User deleted.");
    loadAll();
  }

  // ─── Redeem Codes ──────────────────────────────────────────────────────────
  async function generateRedeemCode() {
    if (!newCodeValue || isNaN(parseFloat(newCodeValue))) return;
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const { error } = await supabase.from("redeem_codes").insert({ code, value: parseFloat(newCodeValue), used: false });
    if (error) { showToast("Error: " + error.message); return; }
    setNewCodeValue("");
    showToast("✅ Code generated: " + code);
    loadAll();
  }

  async function deleteRedeemCode(id: string) {
    if (!confirm("Delete this redeem code?")) return;
    const { error } = await supabase.from("redeem_codes").delete().eq("id", id);
    if (error) { showToast("Delete failed: " + error.message); return; }
    showToast("🗑️ Code deleted.");
    loadAll();
  }

  // ─── Notifications ─────────────────────────────────────────────────────────
  async function sendNotification() {
    if (!notifTitle || !notifMsg) { showToast("Please fill title and message."); return; }
    if (notifTarget === "all") {
      const inserts = users.map((u) => ({ user_id: u.id, title: notifTitle, message: notifMsg, type: "admin" }));
      await supabase.from("notifications").insert(inserts);
    } else {
      await supabase.from("notifications").insert({ user_id: notifTarget, title: notifTitle, message: notifMsg, type: "admin" });
    }
    setNotifTitle(""); setNotifMsg("");
    showToast("📢 Notification sent!");
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────
  async function handleLogin() {
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        setAuthed(true);
      } else {
        setAuthError("Wrong password. Try again.");
      }
    } catch {
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-[#050E1F] flex items-center justify-center px-4">
        <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">🔐</div>
          <h2 className="text-xl font-bold text-white mb-4">Admin Access</h2>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
            placeholder="Enter admin password"
            className={INPUT + " mb-3"}
          />
          {authError && (
            <p className="text-red-400 text-sm mb-3">{authError}</p>
          )}
          <button
            onClick={handleLogin}
            disabled={authLoading || !pw}
            className="w-full py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 disabled:opacity-40 transition"
          >
            {authLoading ? "Checking..." : "Enter"}
          </button>
        </div>
      </main>
    );
  }

  const pendingDeposits    = deposits.filter((d) => d.status === "pending").length;
  const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending").length;

  // ─── Layout ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050E1F] text-white flex flex-col lg:flex-row relative">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-[#0A1628] border border-green-500/40 text-white text-sm px-5 py-3 rounded-xl shadow-xl animate-fade-in">
          {toast}
        </div>
      )}

      {/* Ban Modal */}
      {banModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-lg mb-1">{banModal.banned ? "Unban User" : "Ban User"}</h3>
            <p className="text-white/50 text-sm mb-4">{banModal.full_name} · {banModal.email}</p>
            {!banModal.banned && (
              <div className="mb-4">
                <label className="text-white/50 text-xs block mb-1">Reason (optional)</label>
                <input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="e.g. Fraudulent activity"
                  className={INPUT} />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={confirmBan}
                className={`flex-1 py-3 font-bold rounded-xl transition text-sm ${banModal.banned ? "bg-green-500 hover:bg-green-400 text-black" : "bg-red-500 hover:bg-red-400 text-white"}`}>
                {banModal.banned ? "✅ Unban User" : "🚫 Confirm Ban"}
              </button>
              <button onClick={() => { setBanModal(null); setBanReason(""); }}
                className="px-5 py-3 border border-white/20 hover:border-white/40 rounded-xl text-sm transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE TOP BAR ── */}
      <div className="lg:hidden flex items-center justify-between px-4 py-4 border-b border-white/10 bg-[#050E1F] sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center font-bold text-xs">E</div>
          <span className="text-green-400 font-bold text-sm">Evergreen Admin</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 bg-[#0A1628] border border-white/10 rounded-xl">
          <span className={`block w-5 h-0.5 bg-white transition-all ${sidebarOpen ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`block w-5 h-0.5 bg-white transition-all ${sidebarOpen ? "opacity-0" : ""}`} />
          <span className={`block w-5 h-0.5 bg-white transition-all ${sidebarOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </div>

      {/* ── SIDEBAR ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-60 bg-[#081018] border-r border-white/10 flex flex-col pt-6 pb-8 px-3 transition-transform duration-300
        lg:static lg:translate-x-0 lg:flex lg:w-56 xl:w-60
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="mb-8 px-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center font-bold text-sm">E</div>
            <span className="text-green-400 font-bold">Evergreen</span>
          </div>
          <p className="text-white/30 text-xs pl-10">Admin Panel</p>
        </div>

        <nav className="flex-1 space-y-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left ${
                tab === t.key ? "bg-green-500/15 text-green-400 border border-green-500/30" : "text-white/50 hover:bg-white/5 hover:text-white"
              }`}>
              <span>{t.icon}</span>
              <span className="flex-1">{t.label}</span>
              {t.key === "deposits" && pendingDeposits > 0 && (
                <span className="bg-green-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">{pendingDeposits}</span>
              )}
              {t.key === "withdrawals" && pendingWithdrawals > 0 && (
                <span className="bg-orange-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">{pendingWithdrawals}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-2 pt-4 border-t border-white/10 text-white/20 text-xs space-y-0.5">
          <p>{users.length} users · {deposits.length} deposits</p>
          <p>{packages.length} packages · {redeemCodes.length} codes</p>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ── MAIN ── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-4 lg:px-8 py-5 border-b border-white/10 bg-[#050E1F] sticky top-0 lg:top-0 z-30">
          <h1 className="text-lg font-bold">{TABS.find(t => t.key === tab)?.icon} {TABS.find(t => t.key === tab)?.label}</h1>
        </div>

        <div className="px-4 lg:px-8 py-6 max-w-4xl space-y-6">

          {/* ══════ DEPOSITS ══════ */}
          {tab === "deposits" && (
            <div className="space-y-6">
              <section>
                <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Pending ({pendingDeposits})</h2>
                {pendingDeposits === 0 && <Empty text="No pending deposits" />}
                <div className="grid gap-4 sm:grid-cols-2">
                  {deposits.filter(d => d.status === "pending").map(d => (
                    <div key={d.id} className="bg-[#0A1628] border border-yellow-500/20 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold">{d.profiles?.full_name}</p>
                          <p className="text-white/40 text-xs">{d.profiles?.email}</p>
                          <p className="text-green-400 font-bold mt-1">GHS {d.amount} → GHS {d.daily_earnings}/day</p>
                          <p className="text-white/30 text-xs">{new Date(d.created_at).toLocaleString()}</p>
                        </div>
                        <Badge color="yellow" text="Pending" />
                      </div>
                      {d.screenshot_url && (
                        <a href={d.screenshot_url} target="_blank" rel="noreferrer" className="block mb-3">
                          <img src={d.screenshot_url} alt="Proof" className="rounded-xl max-h-40 w-full object-contain border border-white/10 bg-black/20" />
                          <p className="text-green-400 text-xs mt-1 text-center">🔍 Click to view full screenshot</p>
                        </a>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => approveDeposit(d)} className="flex-1 py-2 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl text-sm transition">✅ Approve</button>
                        <button onClick={() => rejectDeposit(d.id)} className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-xl text-sm transition">❌ Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">All Deposits</h2>
                <div className="space-y-2">
                  {deposits.map(d => (
                    <div key={d.id} className="bg-[#0A1628] border border-white/10 rounded-xl p-3 flex justify-between items-center text-sm">
                      <div>
                        <p className="font-semibold">{d.profiles?.full_name}</p>
                        <p className="text-white/40 text-xs">GHS {d.amount} · {new Date(d.created_at).toLocaleDateString()}</p>
                      </div>
                      <StatusBadge status={d.status} />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ══════ WITHDRAWALS ══════ */}
          {tab === "withdrawals" && (
            <div className="space-y-6">
              <section>
                <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Pending ({pendingWithdrawals})</h2>
                {pendingWithdrawals === 0 && <Empty text="No pending withdrawals" />}
                <div className="grid gap-4 sm:grid-cols-2">
                  {withdrawals.filter(w => w.status === "pending").map(w => (
                    <div key={w.id} className="bg-[#0A1628] border border-orange-500/20 rounded-xl p-4">
                      <p className="font-bold">{w.profiles?.full_name}</p>
                      <p className="text-white/40 text-xs mb-2">MoMo: {w.phone}</p>
                      <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                        <div className="bg-white/5 rounded-lg p-2 text-center"><p className="text-white/40 text-xs">Requested</p><p className="font-bold">GHS {w.amount}</p></div>
                        <div className="bg-white/5 rounded-lg p-2 text-center"><p className="text-white/40 text-xs">Fee 10%</p><p className="text-orange-400 font-bold">-{w.fee?.toFixed(2)}</p></div>
                        <div className="bg-white/5 rounded-lg p-2 text-center"><p className="text-white/40 text-xs">To Pay</p><p className="text-green-400 font-bold">GHS {w.amount_after_fee?.toFixed(2)}</p></div>
                      </div>
                      <p className="text-white/30 text-xs mb-3">{new Date(w.created_at).toLocaleString()}</p>
                      <div className="flex gap-2">
                        <button onClick={() => approveWithdrawal(w)} className="flex-1 py-2 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl text-sm transition">✅ Approve</button>
                        <button onClick={() => rejectWithdrawal(w)} className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-xl text-sm transition">❌ Reject & Refund</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">All Withdrawals</h2>
                <div className="space-y-2">
                  {withdrawals.map(w => (
                    <div key={w.id} className="bg-[#0A1628] border border-white/10 rounded-xl p-3 flex justify-between items-center text-sm">
                      <div>
                        <p className="font-semibold">{w.profiles?.full_name}</p>
                        <p className="text-white/40 text-xs">GHS {w.amount} → GHS {w.amount_after_fee?.toFixed(2)} · {new Date(w.created_at).toLocaleDateString()}</p>
                      </div>
                      <StatusBadge status={w.status} />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ══════ PACKAGES ══════ */}
          {tab === "packages" && (
            <div className="space-y-6">
              <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-5">
                <h2 className="font-bold mb-4">{editingPkg ? "✏️ Edit Package" : "➕ Add New Package"}</h2>
                {pkgMsg && <p className="text-red-400 text-sm mb-3">{pkgMsg}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className="text-white/50 text-xs block mb-1">Amount (GHS)</label>
                    <input type="number" value={pkgForm.amount} onChange={e => setPkgForm({ ...pkgForm, amount: e.target.value })} placeholder="e.g. 500" className={INPUT} />
                  </div>
                  <div>
                    <label className="text-white/50 text-xs block mb-1">Daily Earnings (GHS)</label>
                    <input type="number" value={pkgForm.daily} onChange={e => setPkgForm({ ...pkgForm, daily: e.target.value })} placeholder="e.g. 35" className={INPUT} />
                  </div>
                  <div>
                    <label className="text-white/50 text-xs block mb-1">Duration (Days)</label>
                    <input type="number" value={pkgForm.duration} onChange={e => setPkgForm({ ...pkgForm, duration: e.target.value })} placeholder="e.g. 30" className={INPUT} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={savePackage} className="flex-1 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition">
                    {editingPkg ? "Save Changes" : "Add Package"}
                  </button>
                  {editingPkg && (
                    <button onClick={() => { setEditingPkg(null); setPkgForm({ amount: "", daily: "", duration: "30" }); setPkgMsg(""); }}
                      className="px-6 py-3 border border-white/20 hover:border-white/40 rounded-xl text-sm transition">
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">All Packages ({packages.length})</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {packages.map(pkg => (
                    <div key={pkg.id} className={`bg-[#0A1628] border rounded-xl p-4 ${pkg.active ? "border-white/10" : "border-white/5 opacity-50"}`}>
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-bold text-lg">GHS {pkg.amount}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${pkg.active ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"}`}>
                          {pkg.active ? "Active" : "Hidden"}
                        </span>
                      </div>
                      <p className="text-green-400 font-semibold text-sm">GHS {pkg.daily_earnings}/day</p>
                      <p className="text-white/40 text-xs mt-0.5">⏱ {pkg.duration_days || 30} days</p>
                      <div className="flex gap-1.5 mt-3">
                        <button onClick={() => startEditPackage(pkg)} className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs transition">✏️</button>
                        <button onClick={() => togglePackage(pkg)} className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs transition">{pkg.active ? "🙈" : "👁"}</button>
                        <button onClick={() => deletePackage(pkg.id)} className="py-1.5 px-3 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded-lg text-xs transition">🗑️</button>
                      </div>
                    </div>
                  ))}
                  {packages.length === 0 && <Empty text="No packages yet" />}
                </div>
              </div>
            </div>
          )}

          {/* ══════ PAYMENT INFO ══════ */}
          {tab === "payment" && (
            <div className="space-y-6">
              <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-5">
                <h2 className="font-bold mb-4">{editingPayId ? "✏️ Edit Payment Account" : "➕ Add Payment Account"}</h2>
                {payMsg && <p className="text-red-400 text-sm mb-3">{payMsg}</p>}
                <div className="space-y-3">
                  <div>
                    <label className="text-white/50 text-xs block mb-1">Account Number</label>
                    <input value={payForm.account_number} onChange={e => setPayForm({ ...payForm, account_number: e.target.value })} placeholder="e.g. 0256420940" className={INPUT} />
                  </div>
                  <div>
                    <label className="text-white/50 text-xs block mb-1">Account Name</label>
                    <input value={payForm.account_name} onChange={e => setPayForm({ ...payForm, account_name: e.target.value })} placeholder="e.g. JOHN KWAME OWUSU" className={INPUT} />
                  </div>
                  <div>
                    <label className="text-white/50 text-xs block mb-1">Network / Service</label>
                    <select value={payForm.network} onChange={e => setPayForm({ ...payForm, network: e.target.value })} className={INPUT}>
                      <option value="">Select network</option>
                      <option>MTN Mobile Money</option>
                      <option>Vodafone Cash</option>
                      <option>AirtelTigo Money</option>
                      <option>Bank Transfer</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={savePayment} className="flex-1 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition">
                    {editingPayId ? "Save Changes" : "Add Account"}
                  </button>
                  {editingPayId && (
                    <button onClick={() => { setEditingPayId(null); setPayForm({ account_number: "", account_name: "", network: "" }); setPayMsg(""); }}
                      className="px-6 py-3 border border-white/20 hover:border-white/40 rounded-xl text-sm transition">Cancel</button>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">All Payment Accounts</h2>
                <div className="space-y-3">
                  {paymentSettings.map(pay => (
                    <div key={pay.id} className={`bg-[#0A1628] border rounded-2xl p-5 ${pay.active ? "border-green-500/30" : "border-white/10"}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2"><span>💳</span><span className="font-mono font-bold">{pay.account_number}</span></div>
                          <div className="flex items-center gap-2"><span>👤</span><span className="font-semibold">{pay.account_name}</span></div>
                          <div className="flex items-center gap-2"><span>🏦</span><span className="text-yellow-400 font-semibold">{pay.network}</span></div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0 ${pay.active ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"}`}>
                          {pay.active ? "✅ Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {!pay.active && (
                          <button onClick={() => setActivePayment(pay.id)} className="flex-1 py-2 bg-green-500/20 hover:bg-green-500/40 text-green-400 font-semibold rounded-xl text-sm transition">Set Active</button>
                        )}
                        <button onClick={() => startEditPayment(pay)} className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm transition">✏️ Edit</button>
                        <button onClick={() => deletePayment(pay.id)} className="py-2 px-4 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded-xl text-sm transition">🗑️</button>
                      </div>
                    </div>
                  ))}
                  {paymentSettings.length === 0 && <Empty text="No payment accounts yet. Add one above." />}
                </div>
              </div>
            </div>
          )}

          {/* ══════ USERS ══════ */}
          {tab === "users" && (
            <div>
              <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">{users.length} Total Users</h2>
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className={`bg-[#0A1628] border rounded-xl p-4 flex items-center gap-3 ${u.banned ? "border-red-500/20 opacity-60" : "border-white/10"}`}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: u.avatar_color || "#16A34A" }}>
                      {u.avatar_initials || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{u.full_name}</p>
                        {u.banned && <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full flex-shrink-0">Banned</span>}
                      </div>
                      <p className="text-white/40 text-xs truncate">{u.email}</p>
                      <p className="text-white/30 text-xs">Ref: {u.referral_code}</p>
                    </div>
                    <div className="text-right flex-shrink-0 mr-2">
                      <p className="text-green-400 font-bold text-sm">GHS {(u.balance || 0).toFixed(2)}</p>
                      <p className="text-white/30 text-xs">{new Date(u.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button onClick={() => { setBanModal(u); setBanReason(""); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${u.banned ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"}`}>
                        {u.banned ? "Unban" : "Ban"}
                      </button>
                      <button onClick={() => deleteUser(u)} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded-lg text-xs transition">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════ REDEEM CODES ══════ */}
          {tab === "codes" && (
            <div className="space-y-6">
              <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-5">
                <h2 className="font-bold mb-4">Generate New Code</h2>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-white/50 text-xs block mb-1">Value (GHS)</label>
                    <input type="number" value={newCodeValue} onChange={e => setNewCodeValue(e.target.value)} placeholder="e.g. 50" className={INPUT} />
                  </div>
                  <div className="flex items-end">
                    <button onClick={generateRedeemCode} className="px-6 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition">Generate</button>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">All Codes ({redeemCodes.length})</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {redeemCodes.map(c => (
                    <div key={c.id} className="bg-[#0A1628] border border-white/10 rounded-xl p-4 flex justify-between items-center">
                      <div>
                        <p className="font-mono font-bold text-green-400 text-lg tracking-widest">{c.code}</p>
                        <p className="text-white/40 text-xs">GHS {c.value} · {new Date(c.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${c.used ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                          {c.used ? "Used" : "Active"}
                        </span>
                        <button onClick={() => deleteRedeemCode(c.id)} className="p-1.5 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded-lg text-xs transition">🗑️</button>
                      </div>
                    </div>
                  ))}
                  {redeemCodes.length === 0 && <Empty text="No codes generated yet" />}
                </div>
              </div>
            </div>
          )}

          {/* ══════ NOTIFY ══════ */}
          {tab === "notify" && (
            <div className="max-w-lg space-y-4">
              <div>
                <label className="text-white/60 text-xs block mb-2">Target</label>
                <select value={notifTarget} onChange={e => setNotifTarget(e.target.value)} className={INPUT}>
                  <option value="all">📢 All Users ({users.length})</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name} — {u.email}</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/60 text-xs block mb-2">Title</label>
                <input value={notifTitle} onChange={e => setNotifTitle(e.target.value)} placeholder="Notification title" className={INPUT} />
              </div>
              <div>
                <label className="text-white/60 text-xs block mb-2">Message</label>
                <textarea value={notifMsg} onChange={e => setNotifMsg(e.target.value)} rows={5} placeholder="Your message..." className={INPUT + " resize-none"} />
              </div>
              <button onClick={sendNotification} className="w-full py-4 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition text-lg">
                Send Notification 📢
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function Empty({ text }: { text: string }) {
  return (
    <div className="col-span-full bg-[#0A1628] border border-white/10 rounded-xl p-8 text-center text-white/30 text-sm">
      {text}
    </div>
  );
}

function Badge({ color, text }: { color: string; text: string }) {
  const map: Record<string, string> = { yellow: "bg-yellow-500/20 text-yellow-400", green: "bg-green-500/20 text-green-400", red: "bg-red-500/20 text-red-400" };
  return <span className={`text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0 ${map[color]}`}>{text}</span>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge color="green" text="approved" />;
  if (status === "rejected") return <Badge color="red" text="rejected" />;
  return <Badge color="yellow" text="pending" />;
}