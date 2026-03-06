// PATH: app/admin/page.tsx

"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Deposit        = { id: string; user_id: string; amount: number; daily_earnings: number; screenshot_url: string; status: string; created_at: string; profiles: { full_name: string; email: string } };
type Withdrawal     = { id: string; user_id: string; amount: number; fee: number; amount_after_fee: number; phone: string; status: string; created_at: string; profiles: { full_name: string; email: string } };
type User           = { id: string; full_name: string; email: string; phone: string; avatar_color: string; avatar_initials: string; balance: number; referral_code: string; created_at: string; banned: boolean; banned_reason?: string };
type RedeemCode     = { id: string; code: string; value: number; used: boolean; created_at: string };
type Package        = { id: string; amount: number; daily_earnings: number; duration_days: number; active: boolean };
type PaymentSetting = { id: string; account_number: string; account_name: string; network: string; active: boolean; created_at: string };

const TABS = [
  { key: "deposits",    icon: "💰", label: "Deposits" },
  { key: "withdrawals", icon: "💸", label: "Withdrawals" },
  { key: "packages",    icon: "📦", label: "Packages" },
  { key: "payment",     icon: "🏦", label: "Payment Info" },
  { key: "users",       icon: "👥", label: "Users" },
  { key: "codes",       icon: "🎟️", label: "Daily Code" },
  { key: "notify",      icon: "📢", label: "Notify" },
];

const INPUT = "w-full bg-[#050E1F] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-green-500 focus:outline-none transition";

function isCodeExpired(createdAt: string) {
  return (Date.now() - new Date(createdAt).getTime()) > 24 * 60 * 60 * 1000;
}
function codeExpiresIn(createdAt: string) {
  const ms = (new Date(createdAt).getTime() + 24 * 60 * 60 * 1000) - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m remaining`;
}

export default function AdminPage() {
  const [tab, setTab] = useState("deposits");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [deposits, setDeposits]               = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals]         = useState<Withdrawal[]>([]);
  const [users, setUsers]                     = useState<User[]>([]);
  const [redeemCodes, setRedeemCodes]         = useState<RedeemCode[]>([]);
  const [packages, setPackages]               = useState<Package[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSetting[]>([]);

  // Track which deposit IDs are currently being approved (prevents double-click)
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  // Track which deposit IDs have already been approved this session
  const [approvedIds, setApprovedIds]   = useState<Set<string>>(new Set());

  const [pkgForm, setPkgForm]       = useState({ amount: "", daily: "", duration: "30" });
  const [editingPkg, setEditingPkg] = useState<Package | null>(null);
  const [pkgMsg, setPkgMsg]         = useState("");

  const [payForm, setPayForm]         = useState({ account_number: "", account_name: "", network: "" });
  const [editingPayId, setEditingPayId] = useState<string | null>(null);
  const [payMsg, setPayMsg]           = useState("");

  const [newCodeValue, setNewCodeValue]     = useState("");
  const [codeGenerating, setCodeGenerating] = useState(false);

  const [notifTarget, setNotifTarget] = useState("all");
  const [notifTitle, setNotifTitle]   = useState("");
  const [notifMsg, setNotifMsg]       = useState("");

  const [banModal, setBanModal]   = useState<User | null>(null);
  const [banReason, setBanReason] = useState("");

  const [authed, setAuthed] = useState(false);
  const [pw, setPw]         = useState("");
  const [toast, setToast]   = useState("");
  const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  useEffect(() => { if (authed) loadAll(); }, [authed]);

  const loadAll = useCallback(async () => {
    const [dep, wit, usr, codes, pkgs, pay] = await Promise.all([
      supabase.from("deposits").select("*, profiles(full_name, email)").order("created_at", { ascending: false }),
      supabase.from("withdrawals").select("*, profiles(full_name, email)").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("redeem_codes").select("*").order("created_at", { ascending: false }),
      supabase.from("packages").select("*").order("amount", { ascending: true }),
      supabase.from("payment_settings").select("*").order("id", { ascending: false }),
    ]);
    if (dep.data)   setDeposits(dep.data);
    if (wit.data)   setWithdrawals(wit.data);
    if (usr.data)   setUsers(usr.data);
    if (codes.data) setRedeemCodes(codes.data);
    if (pkgs.data)  setPackages(pkgs.data);
    if (pay.data)   setPaymentSettings(pay.data);
    if (pay.error)  showToast("⚠️ " + pay.error.message);
  }, []);

  // ─── Deposits — one-click protection ─────────────────────────────────────
  async function approveDeposit(dep: Deposit) {
    // Block if already approved or currently approving
    if (approvingIds.has(dep.id) || approvedIds.has(dep.id)) return;

    setApprovingIds(prev => new Set(prev).add(dep.id));

    await supabase.from("deposits").update({ status: "approved" }).eq("id", dep.id);
    await supabase.from("investments").insert({ user_id: dep.user_id, amount: dep.amount, daily_earnings: dep.daily_earnings, active: true });

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

    // Mark as approved in this session — button stays locked even before reload
    setApprovedIds(prev => new Set(prev).add(dep.id));
    setApprovingIds(prev => { const s = new Set(prev); s.delete(dep.id); return s; });

    showToast("✅ Deposit approved!");
    loadAll();
  }

  async function rejectDeposit(id: string) {
    await supabase.from("deposits").update({ status: "rejected" }).eq("id", id);
    showToast("❌ Deposit rejected."); loadAll();
  }

  // ─── Withdrawals ───────────────────────────────────────────────────────────
  async function approveWithdrawal(wit: Withdrawal) {
    await supabase.from("withdrawals").update({ status: "approved" }).eq("id", wit.id);
    await supabase.from("notifications").insert({ user_id: wit.user_id, title: "✅ Withdrawal Approved!", message: `Your withdrawal of GHS ${wit.amount_after_fee?.toFixed(2)} has been sent to your MoMo. Allow 1–2 hours to reflect.`, type: "withdrawal" });
    showToast("✅ Withdrawal approved!"); loadAll();
  }
  async function rejectWithdrawal(wit: Withdrawal) {
    await supabase.from("withdrawals").update({ status: "rejected" }).eq("id", wit.id);
    const { data: prof } = await supabase.from("profiles").select("balance").eq("id", wit.user_id).single();
    await supabase.from("profiles").update({ balance: (prof?.balance || 0) + wit.amount }).eq("id", wit.user_id);
    await supabase.from("notifications").insert({ user_id: wit.user_id, title: "❌ Withdrawal Rejected", message: `Your withdrawal of GHS ${wit.amount} was rejected and refunded to your wallet.`, type: "withdrawal" });
    showToast("Withdrawal rejected & refunded."); loadAll();
  }

  // ─── Packages ──────────────────────────────────────────────────────────────
  async function savePackage() {
    const amount = parseFloat(pkgForm.amount), daily = parseFloat(pkgForm.daily), duration = parseInt(pkgForm.duration) || 30;
    if (!amount || !daily) { setPkgMsg("Please enter amount and daily earnings."); return; }
    if (editingPkg) {
      const { error } = await supabase.from("packages").update({ amount, daily_earnings: daily, duration_days: duration }).eq("id", editingPkg.id);
      if (error) { setPkgMsg("Error: " + error.message); return; }
      setEditingPkg(null); showToast("✅ Package updated!");
    } else {
      const { error } = await supabase.from("packages").insert({ amount, daily_earnings: daily, duration_days: duration, active: true });
      if (error) { setPkgMsg("Error: " + error.message); return; }
      showToast("✅ Package added!");
    }
    setPkgForm({ amount: "", daily: "", duration: "30" }); setPkgMsg(""); loadAll();
  }
  function startEditPackage(pkg: Package) { setEditingPkg(pkg); setPkgForm({ amount: String(pkg.amount), daily: String(pkg.daily_earnings), duration: String(pkg.duration_days || 30) }); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function togglePackage(pkg: Package) { await supabase.from("packages").update({ active: !pkg.active }).eq("id", pkg.id); loadAll(); }
  async function deletePackage(id: string) {
    if (!confirm("Delete this package?")) return;
    await supabase.from("packages").delete().eq("id", id); showToast("🗑️ Package deleted."); loadAll();
  }

  // ─── Payment Settings ──────────────────────────────────────────────────────
  function startEditPayment(pay: PaymentSetting) { setEditingPayId(pay.id); setPayForm({ account_number: pay.account_number, account_name: pay.account_name, network: pay.network }); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function savePayment() {
    if (!payForm.account_number || !payForm.account_name || !payForm.network) { setPayMsg("Please fill in all fields."); return; }
    if (editingPayId) {
      const { error } = await supabase.from("payment_settings").update({ account_number: payForm.account_number, account_name: payForm.account_name, network: payForm.network }).eq("id", editingPayId);
      if (error) { setPayMsg("Error: " + error.message); return; }
      setEditingPayId(null); showToast("✅ Payment info updated!");
    } else {
      const { error } = await supabase.from("payment_settings").insert({ account_number: payForm.account_number, account_name: payForm.account_name, network: payForm.network, active: false });
      if (error) { setPayMsg("Error: " + error.message); return; }
      showToast("✅ Payment account added!");
    }
    setPayForm({ account_number: "", account_name: "", network: "" }); setPayMsg(""); loadAll();
  }
  async function setActivePayment(id: string) {
    await supabase.from("payment_settings").update({ active: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("payment_settings").update({ active: true }).eq("id", id);
    showToast("✅ Active payment updated!"); loadAll();
  }
  async function deletePayment(id: string) {
    if (!confirm("Delete this payment account?")) return;
    await supabase.from("payment_settings").delete().eq("id", id); showToast("🗑️ Deleted."); loadAll();
  }

  // ─── Users ─────────────────────────────────────────────────────────────────
  async function confirmBan() {
    if (!banModal) return;
    if (banModal.banned) {
      await supabase.from("profiles").update({ banned: false, banned_reason: null }).eq("id", banModal.id);
      showToast("✅ User unbanned.");
    } else {
      await supabase.from("profiles").update({ banned: true, banned_reason: banReason || "Violation of terms" }).eq("id", banModal.id);
      await supabase.from("notifications").insert({ user_id: banModal.id, title: "🚫 Account Suspended", message: `Your account has been suspended. Reason: ${banReason || "Violation of terms"}. Contact support to appeal.`, type: "admin" });
      showToast("🚫 User banned.");
    }
    setBanModal(null); setBanReason(""); loadAll();
  }
  async function deleteUser(user: User) {
    if (!confirm(`Permanently delete ${user.full_name}?`)) return;
    await Promise.all([
      supabase.from("deposits").delete().eq("user_id", user.id),
      supabase.from("withdrawals").delete().eq("user_id", user.id),
      supabase.from("investments").delete().eq("user_id", user.id),
      supabase.from("notifications").delete().eq("user_id", user.id),
    ]);
    await supabase.from("profiles").delete().eq("id", user.id);
    showToast("🗑️ User deleted."); loadAll();
  }

  // ─── Daily Code ────────────────────────────────────────────────────────────
  async function generateAndBroadcastCode() {
    const value = parseFloat(newCodeValue);
    if (!value || value <= 0) { showToast("Enter a valid GHS amount."); return; }
    if (users.length === 0) { showToast("No users to notify."); return; }
    setCodeGenerating(true);
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const { data: codeRow, error: codeErr } = await supabase.from("redeem_codes").insert({ code, value, used: false }).select().single();
    if (codeErr || !codeRow) { showToast("Error creating code: " + codeErr?.message); setCodeGenerating(false); return; }
    const notifications = users.map((u) => ({
      user_id: u.id,
      title: "🎟️ Daily Redeem Code is Here!",
      message: `Today's redeem code is: ${code}\n\nRedeem it in the app to receive GHS ${value} in your wallet. Valid for 24 hours only — don't miss it! 🎉`,
      type: "redeem",
    }));
    const { error: notifErr } = await supabase.from("notifications").insert(notifications);
    if (notifErr) { showToast("Code created but notifications failed: " + notifErr.message); }
    else { showToast(`✅ Code "${code}" sent to all ${users.length} users!`); }
    setNewCodeValue(""); setCodeGenerating(false); loadAll();
  }

  async function deleteRedeemCode(id: string) {
    if (!confirm("Delete this code? Users won't be able to redeem it.")) return;
    await supabase.from("redeem_logs").delete().eq("code_id", id);
    await supabase.from("redeem_codes").delete().eq("id", id);
    showToast("🗑️ Code deleted."); loadAll();
  }

  // ─── Notifications ─────────────────────────────────────────────────────────
  async function sendNotification() {
    if (!notifTitle || !notifMsg) { showToast("Please fill title and message."); return; }
    if (notifTarget === "all") {
      await supabase.from("notifications").insert(users.map((u) => ({ user_id: u.id, title: notifTitle, message: notifMsg, type: "admin" })));
    } else {
      await supabase.from("notifications").insert({ user_id: notifTarget, title: notifTitle, message: notifMsg, type: "admin" });
    }
    setNotifTitle(""); setNotifMsg(""); showToast("📢 Notification sent!");
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <main className="min-h-screen bg-[#050E1F] flex items-center justify-center px-4">
        <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">🔐</div>
          <h2 className="text-xl font-bold text-white mb-4">Admin Access</h2>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") pw === ADMIN_PASSWORD ? setAuthed(true) : alert("Wrong password"); }}
            placeholder="Enter admin password" className={INPUT + " mb-4"} />
          <button onClick={() => { if (pw === ADMIN_PASSWORD) setAuthed(true); else alert("Wrong password"); }}
            className="w-full py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 transition">Enter</button>
        </div>
      </main>
    );
  }

  // ─── Computed values ───────────────────────────────────────────────────────
  const pendingDeposits      = deposits.filter((d) => d.status === "pending").length;
  const pendingWithdrawals   = withdrawals.filter((w) => w.status === "pending");
  const approvedWithdrawals  = withdrawals.filter((w) => w.status === "approved");

  // Pending payout
  const totalPendingPay      = pendingWithdrawals.reduce((s, w) => s + (w.amount_after_fee || 0), 0);
  const totalPendingRequested= pendingWithdrawals.reduce((s, w) => s + (w.amount || 0), 0);
  const totalPendingFees     = pendingWithdrawals.reduce((s, w) => s + (w.fee || 0), 0);

  // All-time totals
  const totalEverPaid        = approvedWithdrawals.reduce((s, w) => s + (w.amount_after_fee || 0), 0);
  const totalEverFees        = approvedWithdrawals.reduce((s, w) => s + (w.fee || 0), 0);
  const totalUserBalances    = users.reduce((s, u) => s + (u.balance || 0), 0);

  const todayCode = redeemCodes.find(c => !isCodeExpired(c.created_at));

  return (
    <div className="min-h-screen bg-[#050E1F] text-white flex flex-col lg:flex-row relative">

      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-[#0A1628] border border-green-500/40 text-white text-sm px-5 py-3 rounded-xl shadow-xl max-w-xs">
          {toast}
        </div>
      )}

      {banModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-lg mb-1">{banModal.banned ? "Unban User" : "Ban User"}</h3>
            <p className="text-white/50 text-sm mb-4">{banModal.full_name} · {banModal.email}</p>
            {!banModal.banned && (
              <div className="mb-4">
                <label className="text-white/50 text-xs block mb-1">Reason (optional)</label>
                <input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="e.g. Fraudulent activity" className={INPUT} />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={confirmBan} className={`flex-1 py-3 font-bold rounded-xl transition text-sm ${banModal.banned ? "bg-green-500 hover:bg-green-400 text-black" : "bg-red-500 hover:bg-red-400 text-white"}`}>
                {banModal.banned ? "✅ Unban User" : "🚫 Confirm Ban"}
              </button>
              <button onClick={() => { setBanModal(null); setBanReason(""); }} className="px-5 py-3 border border-white/20 hover:border-white/40 rounded-xl text-sm transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile top bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-4 border-b border-white/10 bg-[#050E1F] sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 overflow-hidden"><img src="/favicon.ico" alt="" className="w-full h-full object-contain rounded-full" /></div>
          <span className="text-green-400 font-bold text-sm">Evergreen Admin</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 bg-[#0A1628] border border-white/10 rounded-xl">
          <span className={`block w-5 h-0.5 bg-white transition-all ${sidebarOpen ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`block w-5 h-0.5 bg-white transition-all ${sidebarOpen ? "opacity-0" : ""}`} />
          <span className={`block w-5 h-0.5 bg-white transition-all ${sidebarOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-60 bg-[#081018] border-r border-white/10 flex flex-col pt-6 pb-8 px-3 transition-transform duration-300 lg:static lg:translate-x-0 lg:flex lg:w-56 xl:w-60 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-8 px-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 overflow-hidden"><img src="/favicon.ico" alt="" className="w-full h-full object-contain rounded-full" /></div>
            <span className="text-green-400 font-bold">Evergreen</span>
          </div>
          <p className="text-white/30 text-xs pl-10">Admin Panel</p>
        </div>
        <nav className="flex-1 space-y-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left ${tab === t.key ? "bg-green-500/15 text-green-400 border border-green-500/30" : "text-white/50 hover:bg-white/5 hover:text-white"}`}>
              <span>{t.icon}</span>
              <span className="flex-1">{t.label}</span>
              {t.key === "deposits"    && pendingDeposits > 0            && <span className="bg-green-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">{pendingDeposits}</span>}
              {t.key === "withdrawals" && pendingWithdrawals.length > 0  && <span className="bg-orange-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">{pendingWithdrawals.length}</span>}
              {t.key === "codes"       && todayCode                      && <span className="bg-purple-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">LIVE</span>}
            </button>
          ))}
        </nav>
        <div className="px-2 pt-4 border-t border-white/10 text-white/20 text-xs space-y-0.5">
          <p>{users.length} users · {deposits.length} deposits</p>
          <p>{packages.length} packages · {redeemCodes.length} codes</p>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-4 lg:px-8 py-5 border-b border-white/10 bg-[#050E1F] sticky top-0 lg:top-0 z-30">
          <h1 className="text-lg font-bold">{TABS.find(t => t.key === tab)?.icon} {TABS.find(t => t.key === tab)?.label}</h1>
        </div>

        {/* ══════ GLOBAL PAYOUT OVERVIEW BANNER ══════ */}
        {/* Always visible at the top of every tab */}
        <div className="px-4 lg:px-8 pt-5">
          <div className="bg-gradient-to-r from-[#0d1f10] via-[#0a1f1a] to-[#0d1a2f] border border-green-500/20 rounded-2xl p-4 mb-6">
            <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
              <span>📊</span> Platform Financial Overview · {users.length} Users
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

              {/* What you owe right now */}
              <div className="bg-orange-500/10 border border-orange-500/25 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
                <p className="text-orange-300 text-xs font-semibold mb-1">💸 Pending Payouts</p>
                <p className="text-orange-400 font-extrabold text-2xl">GHS {totalPendingPay.toFixed(2)}</p>
                <p className="text-orange-300/50 text-xs mt-0.5">{pendingWithdrawals.length} request{pendingWithdrawals.length !== 1 ? "s" : ""} to process</p>
              </div>

              {/* Total all-time paid out */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-white/40 text-xs mb-1">✅ Total Paid Out</p>
                <p className="text-white font-bold text-xl">GHS {totalEverPaid.toFixed(2)}</p>
                <p className="text-white/30 text-xs mt-0.5">{approvedWithdrawals.length} withdrawals</p>
              </div>

              {/* Total fees earned */}
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
                <p className="text-green-400 text-xs mb-1">💰 Total Fees Earned</p>
                <p className="text-green-400 font-bold text-xl">GHS {(totalEverFees + totalPendingFees).toFixed(2)}</p>
                <p className="text-green-400/40 text-xs mt-0.5">10% of all withdrawals</p>
              </div>

              {/* Total sitting in user wallets */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                <p className="text-blue-300 text-xs mb-1">🏦 In User Wallets</p>
                <p className="text-blue-300 font-bold text-xl">GHS {totalUserBalances.toFixed(2)}</p>
                <p className="text-blue-300/40 text-xs mt-0.5">across all accounts</p>
              </div>

            </div>
          </div>
        </div>

        <div className="px-4 lg:px-8 pb-6 max-w-4xl space-y-6">

          {/* ══════ DEPOSITS ══════ */}
          {tab === "deposits" && (
            <div className="space-y-6">
              <section>
                <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Pending ({pendingDeposits})</h2>
                {pendingDeposits === 0 && <Empty text="No pending deposits" />}
                <div className="grid gap-4 sm:grid-cols-2">
                  {deposits.filter(d => d.status === "pending").map(d => {
                    const isApproving = approvingIds.has(d.id);
                    const isApproved  = approvedIds.has(d.id);
                    return (
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
                            <p className="text-green-400 text-xs mt-1 text-center">🔍 Click to view full</p>
                          </a>
                        )}
                        <div className="flex gap-2">
                          {/* ── ONE-CLICK APPROVE BUTTON ── */}
                          <button
                            onClick={() => approveDeposit(d)}
                            disabled={isApproving || isApproved}
                            className={`flex-1 py-2 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2
                              ${isApproved
                                ? "bg-green-900/40 text-green-600 cursor-not-allowed border border-green-700/30"
                                : isApproving
                                  ? "bg-green-500/50 text-black cursor-not-allowed"
                                  : "bg-green-500 hover:bg-green-400 text-black"
                              }`}
                          >
                            {isApproved ? (
                              <><span>✅</span> Approved</>
                            ) : isApproving ? (
                              <><span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" /> Approving...</>
                            ) : (
                              "✅ Approve"
                            )}
                          </button>
                          <button
                            onClick={() => rejectDeposit(d.id)}
                            disabled={isApproved || isApproving}
                            className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/40 disabled:opacity-30 disabled:cursor-not-allowed text-red-400 rounded-xl text-sm transition"
                          >
                            ❌ Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
              <section>
                <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">All Deposits</h2>
                <div className="space-y-2">
                  {deposits.map(d => (
                    <div key={d.id} className="bg-[#0A1628] border border-white/10 rounded-xl p-3 flex justify-between items-center text-sm">
                      <div><p className="font-semibold">{d.profiles?.full_name}</p><p className="text-white/40 text-xs">GHS {d.amount} · {new Date(d.created_at).toLocaleDateString()}</p></div>
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
              {pendingWithdrawals.length > 0 && (
                <div className="bg-gradient-to-r from-orange-900/30 to-yellow-900/20 border border-orange-500/30 rounded-2xl p-5">
                  <p className="text-orange-400 text-xs font-bold uppercase tracking-widest mb-3">
                    💸 Pending Payout Summary — {pendingWithdrawals.length} request{pendingWithdrawals.length !== 1 ? "s" : ""}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-black/20 rounded-xl p-3 text-center"><p className="text-white/40 text-xs mb-1">Total Requested</p><p className="text-white font-bold text-lg">GHS {totalPendingRequested.toFixed(2)}</p></div>
                    <div className="bg-black/20 rounded-xl p-3 text-center"><p className="text-white/40 text-xs mb-1">Fees Earned (10%)</p><p className="text-green-400 font-bold text-lg">GHS {totalPendingFees.toFixed(2)}</p></div>
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 text-center"><p className="text-orange-300 text-xs mb-1 font-semibold">YOU MUST PAY</p><p className="text-orange-400 font-extrabold text-xl">GHS {totalPendingPay.toFixed(2)}</p></div>
                  </div>
                  <p className="text-white/30 text-xs mt-3 text-center">Send GHS {totalPendingPay.toFixed(2)} total across {pendingWithdrawals.length} MoMo transfer{pendingWithdrawals.length !== 1 ? "s" : ""}</p>
                </div>
              )}
              <section>
                <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Pending ({pendingWithdrawals.length})</h2>
                {pendingWithdrawals.length === 0 && <Empty text="No pending withdrawals" />}
                <div className="grid gap-4 sm:grid-cols-2">
                  {pendingWithdrawals.map(w => (
                    <div key={w.id} className="bg-[#0A1628] border border-orange-500/20 rounded-xl p-4">
                      <p className="font-bold">{w.profiles?.full_name}</p>
                      <p className="text-white/40 text-xs mb-2">MoMo: <span className="font-mono text-white/60">{w.phone}</span></p>
                      <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                        <div className="bg-white/5 rounded-lg p-2 text-center"><p className="text-white/40 text-xs">Requested</p><p className="font-bold">GHS {w.amount}</p></div>
                        <div className="bg-white/5 rounded-lg p-2 text-center"><p className="text-white/40 text-xs">Fee 10%</p><p className="text-orange-400 font-bold">-{w.fee?.toFixed(2)}</p></div>
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2 text-center"><p className="text-orange-300 text-xs font-semibold">Pay</p><p className="text-orange-400 font-bold">GHS {w.amount_after_fee?.toFixed(2)}</p></div>
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
                      <div><p className="font-semibold">{w.profiles?.full_name}</p><p className="text-white/40 text-xs">GHS {w.amount} → GHS {w.amount_after_fee?.toFixed(2)} · {new Date(w.created_at).toLocaleDateString()}</p></div>
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
                  <div><label className="text-white/50 text-xs block mb-1">Amount (GHS)</label><input type="number" value={pkgForm.amount} onChange={e => setPkgForm({ ...pkgForm, amount: e.target.value })} placeholder="e.g. 500" className={INPUT} /></div>
                  <div><label className="text-white/50 text-xs block mb-1">Daily Earnings (GHS)</label><input type="number" value={pkgForm.daily} onChange={e => setPkgForm({ ...pkgForm, daily: e.target.value })} placeholder="e.g. 35" className={INPUT} /></div>
                  <div><label className="text-white/50 text-xs block mb-1">Duration (Days)</label><input type="number" value={pkgForm.duration} onChange={e => setPkgForm({ ...pkgForm, duration: e.target.value })} placeholder="e.g. 30" className={INPUT} /></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={savePackage} className="flex-1 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition">{editingPkg ? "Save Changes" : "Add Package"}</button>
                  {editingPkg && <button onClick={() => { setEditingPkg(null); setPkgForm({ amount: "", daily: "", duration: "30" }); setPkgMsg(""); }} className="px-6 py-3 border border-white/20 rounded-xl text-sm transition">Cancel</button>}
                </div>
              </div>
              <div>
                <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">All Packages ({packages.length})</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {packages.map(pkg => (
                    <div key={pkg.id} className={`bg-[#0A1628] border rounded-xl p-4 ${pkg.active ? "border-white/10" : "border-white/5 opacity-50"}`}>
                      <div className="flex justify-between items-start mb-1"><p className="font-bold text-lg">GHS {pkg.amount}</p><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${pkg.active ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"}`}>{pkg.active ? "Active" : "Hidden"}</span></div>
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
                  <div><label className="text-white/50 text-xs block mb-1">Account Number</label><input value={payForm.account_number} onChange={e => setPayForm({ ...payForm, account_number: e.target.value })} placeholder="e.g. 0256420940" className={INPUT} /></div>
                  <div><label className="text-white/50 text-xs block mb-1">Account Name</label><input value={payForm.account_name} onChange={e => setPayForm({ ...payForm, account_name: e.target.value })} placeholder="e.g. JOHN KWAME OWUSU" className={INPUT} /></div>
                  <div>
                    <label className="text-white/50 text-xs block mb-1">Network / Service</label>
                    <select value={payForm.network} onChange={e => setPayForm({ ...payForm, network: e.target.value })} className={INPUT}>
                      <option value="">Select network</option>
                      <option>MTN Mobile Money</option><option>Vodafone Cash</option><option>AirtelTigo Money</option><option>Bank Transfer</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={savePayment} className="flex-1 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition">{editingPayId ? "Save Changes" : "Add Account"}</button>
                  {editingPayId && <button onClick={() => { setEditingPayId(null); setPayForm({ account_number: "", account_name: "", network: "" }); setPayMsg(""); }} className="px-6 py-3 border border-white/20 rounded-xl text-sm transition">Cancel</button>}
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
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0 ${pay.active ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"}`}>{pay.active ? "✅ Active" : "Inactive"}</span>
                      </div>
                      <div className="flex gap-2">
                        {!pay.active && <button onClick={() => setActivePayment(pay.id)} className="flex-1 py-2 bg-green-500/20 hover:bg-green-500/40 text-green-400 font-semibold rounded-xl text-sm transition">Set Active</button>}
                        <button onClick={() => startEditPayment(pay)} className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm transition">✏️ Edit</button>
                        <button onClick={() => deletePayment(pay.id)} className="py-2 px-4 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded-xl text-sm transition">🗑️</button>
                      </div>
                    </div>
                  ))}
                  {paymentSettings.length === 0 && <Empty text="No payment accounts yet." />}
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
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ backgroundColor: u.avatar_color || "#16A34A" }}>{u.avatar_initials || "U"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><p className="font-semibold text-sm truncate">{u.full_name}</p>{u.banned && <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full flex-shrink-0">Banned</span>}</div>
                      <p className="text-white/40 text-xs truncate">{u.email}</p>
                      <p className="text-white/30 text-xs">Ref: {u.referral_code}</p>
                    </div>
                    <div className="text-right flex-shrink-0 mr-2"><p className="text-green-400 font-bold text-sm">GHS {(u.balance || 0).toFixed(2)}</p><p className="text-white/30 text-xs">{new Date(u.created_at).toLocaleDateString()}</p></div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button onClick={() => { setBanModal(u); setBanReason(""); }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${u.banned ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"}`}>{u.banned ? "Unban" : "Ban"}</button>
                      <button onClick={() => deleteUser(u)} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded-lg text-xs transition">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════ DAILY CODE ══════ */}
          {tab === "codes" && (
            <div className="space-y-6">
              {todayCode ? (
                <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/20 border border-purple-500/30 rounded-2xl p-6 text-center">
                  <p className="text-purple-400 text-xs font-bold uppercase tracking-widest mb-2">🟢 Today's Active Code</p>
                  <p className="text-4xl font-mono font-extrabold text-white tracking-widest my-3">{todayCode.code}</p>
                  <p className="text-green-400 font-bold text-lg">GHS {todayCode.value} per user</p>
                  <p className="text-purple-300 text-xs mt-2 font-semibold">⏳ {codeExpiresIn(todayCode.created_at)}</p>
                  <p className="text-white/30 text-xs mt-1">Sent to {users.length} users via notification</p>
                  <button onClick={() => deleteRedeemCode(todayCode.id)} className="mt-4 px-5 py-2 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded-xl text-xs transition">🗑️ Delete & Invalidate Code</button>
                </div>
              ) : (
                <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-5 text-center">
                  <p className="text-3xl mb-2">🎟️</p>
                  <p className="text-white/50 text-sm">No active code today. Generate one below.</p>
                </div>
              )}
              <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-5">
                <h2 className="font-bold mb-1">Generate Today's Code</h2>
                <p className="text-white/40 text-xs mb-4">All <strong className="text-white/60">{users.length} users</strong> will instantly receive a notification with the code. Each user can only redeem it once.</p>
                {todayCode && <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-yellow-400 text-xs mb-4">⚠️ A code is already active today. Delete it first if you want to generate a new one.</div>}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-white/50 text-xs block mb-1">Amount each user receives (GHS)</label>
                    <input type="number" value={newCodeValue} onChange={e => setNewCodeValue(e.target.value)} placeholder="e.g. 20" disabled={!!todayCode} className={INPUT + (todayCode ? " opacity-40 cursor-not-allowed" : "")} />
                  </div>
                  <div className="flex items-end">
                    <button onClick={generateAndBroadcastCode} disabled={codeGenerating || !!todayCode}
                      className="px-5 py-3 bg-purple-500 hover:bg-purple-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition">
                      {codeGenerating ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending...</span> : "Generate & Notify All"}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Code History ({redeemCodes.length})</h2>
                <div className="space-y-2">
                  {redeemCodes.map(c => {
                    const expired = isCodeExpired(c.created_at);
                    return (
                      <div key={c.id} className={`bg-[#0A1628] border rounded-xl p-4 flex justify-between items-center ${expired ? "border-white/5 opacity-50" : "border-purple-500/20"}`}>
                        <div>
                          <p className={`font-mono font-bold text-lg tracking-widest ${expired ? "text-white/30" : "text-purple-300"}`}>{c.code}</p>
                          <p className="text-white/40 text-xs">GHS {c.value} · {new Date(c.created_at).toLocaleString()}</p>
                          {!expired && <p className="text-purple-400 text-xs font-semibold mt-0.5">⏳ {codeExpiresIn(c.created_at)}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${expired ? "bg-white/10 text-white/30" : "bg-purple-500/20 text-purple-400"}`}>{expired ? "Expired" : "Active"}</span>
                          <button onClick={() => deleteRedeemCode(c.id)} className="p-1.5 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded-lg text-xs transition">🗑️</button>
                        </div>
                      </div>
                    );
                  })}
                  {redeemCodes.length === 0 && <Empty text="No codes generated yet" />}
                </div>
              </div>
            </div>
          )}

          {/* ══════ NOTIFY ══════ */}
          {tab === "notify" && (
            <div className="max-w-lg space-y-4">
              <div><label className="text-white/60 text-xs block mb-2">Target</label>
                <select value={notifTarget} onChange={e => setNotifTarget(e.target.value)} className={INPUT}>
                  <option value="all">📢 All Users ({users.length})</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name} — {u.email}</option>)}
                </select>
              </div>
              <div><label className="text-white/60 text-xs block mb-2">Title</label><input value={notifTitle} onChange={e => setNotifTitle(e.target.value)} placeholder="Notification title" className={INPUT} /></div>
              <div><label className="text-white/60 text-xs block mb-2">Message</label><textarea value={notifMsg} onChange={e => setNotifMsg(e.target.value)} rows={5} placeholder="Your message..." className={INPUT + " resize-none"} /></div>
              <button onClick={sendNotification} className="w-full py-4 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition text-lg">Send Notification 📢</button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="col-span-full bg-[#0A1628] border border-white/10 rounded-xl p-8 text-center text-white/30 text-sm">{text}</div>;
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