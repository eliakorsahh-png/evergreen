// PATH: app/dashboard/page.tsx

"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import NotificationBell from "@/components/NotificationBell";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Package    = { id: string; amount: number; daily_earnings: number; duration_days: number; active: boolean };
type Investment = { id: string; amount: number; daily_earnings: number; active: boolean; created_at: string };
type Profile    = {
  id: string; full_name: string; email: string; phone: string;
  avatar_color: string; avatar_initials: string;
  balance: number; referral_code: string;
  banned: boolean; banned_reason?: string;
};

export default function DashboardPage() {
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [packages, setPackages]       = useState<Package[]>([]);
  const [loading, setLoading]         = useState(true);
  const [copied, setCopied]           = useState(false);
  const [tab, setTab]                 = useState<"overview" | "invest" | "referral" | "redeem">("overview");

  // Redeem state
  const [redeemCode, setRedeemCode]         = useState("");
  const [redeemLoading, setRedeemLoading]   = useState(false);
  const [redeemMsg, setRedeemMsg]           = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [todayCodeActive, setTodayCodeActive] = useState(false); // is there a live code right now?

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { window.location.href = "/login"; return; }

      const [profRes, invRes, pkgRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).single(),
        supabase.from("investments").select("*").eq("user_id", session.user.id).eq("active", true).order("created_at", { ascending: false }),
        supabase.from("packages").select("*").eq("active", true).order("amount", { ascending: true }),
      ]);

      setProfile(profRes.data);
      setInvestments(invRes.data || []);
      setPackages(pkgRes.data || []);

      // Check if there's an active code today
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: codes } = await supabase
        .from("redeem_codes")
        .select("id")
        .gte("created_at", cutoff)
        .limit(1);
      setTodayCodeActive(!!(codes && codes.length > 0));

      setLoading(false);
    }
    load();
  }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = "/login"; };
  const handleCopy = () => { navigator.clipboard.writeText(referralLink); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  // ─── Redeem handler ────────────────────────────────────────────────────────
  const handleRedeem = async () => {
    if (!redeemCode.trim() || !profile) return;
    setRedeemLoading(true);
    setRedeemMsg(null);

    const code = redeemCode.trim().toUpperCase();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Find active (non-expired) code
    const { data: codeRow } = await supabase
      .from("redeem_codes")
      .select("*")
      .eq("code", code)
      .gte("created_at", cutoff)
      .maybeSingle();

    if (!codeRow) {
      setRedeemMsg({ type: "error", text: "Invalid or expired code. Check today's notification for the correct code." });
      setRedeemLoading(false);
      return;
    }

    // 2. Check if user already redeemed this code
    const { data: existingLog } = await supabase
      .from("redeem_logs")
      .select("id")
      .eq("user_id", profile.id)
      .eq("code_id", codeRow.id)
      .maybeSingle();

    if (existingLog) {
      setRedeemMsg({ type: "error", text: "You've already redeemed today's code. Come back tomorrow!" });
      setRedeemLoading(false);
      return;
    }

    // 3. Credit balance
    const newBalance = (profile.balance || 0) + codeRow.value;
    const { error: balErr } = await supabase
      .from("profiles")
      .update({ balance: newBalance })
      .eq("id", profile.id);

    if (balErr) {
      setRedeemMsg({ type: "error", text: "Something went wrong. Please try again." });
      setRedeemLoading(false);
      return;
    }

    // 4. Log it
    await supabase.from("redeem_logs").insert({ user_id: profile.id, code_id: codeRow.id });

    // 5. Notify
    await supabase.from("notifications").insert({
      user_id: profile.id,
      title: "🎟️ Code Redeemed Successfully!",
      message: `You redeemed today's code and received GHS ${codeRow.value} in your wallet. 🎉`,
      type: "redeem",
    });

    setProfile(prev => prev ? { ...prev, balance: newBalance } : prev);
    setRedeemCode("");
    setRedeemMsg({ type: "success", text: `🎉 GHS ${codeRow.value} has been added to your wallet!` });
    setRedeemLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050E1F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (profile?.banned) {
    return (
      <main className="min-h-screen bg-[#050E1F] flex items-center justify-center px-4">
        <div className="bg-[#0A1628] border border-red-500/30 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-white mb-2">Account Suspended</h2>
          <p className="text-white/50 text-sm mb-3">Your account has been suspended and you cannot access the platform.</p>
          {profile.banned_reason && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-5">
              <p className="text-red-400 text-xs font-semibold">Reason</p>
              <p className="text-white/60 text-sm mt-0.5">{profile.banned_reason}</p>
            </div>
          )}
          <p className="text-white/40 text-xs mb-5">To appeal, contact us:<br />+1 (289) 908-2443 · +1 (343) 443-6208</p>
          <button onClick={handleLogout} className="w-full py-3 border border-white/20 rounded-xl text-sm text-white/60 hover:text-white transition">Sign Out</button>
        </div>
      </main>
    );
  }

  const totalDailyEarnings = investments.reduce((sum, inv) => sum + (inv.daily_earnings || 0), 0);
  const referralLink = typeof window !== "undefined" && profile?.referral_code
    ? `${window.location.origin}/signup?ref=${profile.referral_code}` : "";

  return (
    <main className="min-h-screen bg-[#050E1F] text-white pb-24">

      {/* NAV */}
      <nav className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-[#050E1F]/95 backdrop-blur sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
            <img src="/favicon.ico" alt="Evergreen Asset" className="w-full rounded-full h-full object-contain" />
          </div>
          <span className="font-bold text-green-400 text-sm hidden sm:block">Evergreen Asset</span>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell userId={profile?.id} />
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold cursor-pointer ring-2 ring-white/10 hover:ring-green-500/50 transition"
            style={{ backgroundColor: profile?.avatar_color || "#16A34A" }} title={profile?.full_name}>
            {profile?.avatar_initials || "U"}
          </div>
        </div>
      </nav>

      <div className="px-4 pt-5 pb-2 max-w-xl mx-auto">

        {/* GREETING */}
        <div className="mb-5">
          <p className="text-white/40 text-sm">Good day,</p>
          <h2 className="text-2xl font-extrabold">{profile?.full_name?.split(" ")[0]} 👋</h2>
        </div>

        {/* BALANCE CARD */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0D2137] via-[#0A2040] to-[#081628] border border-white/10 rounded-2xl p-5 mb-5">
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-green-500/5 pointer-events-none" />
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-green-500/5 pointer-events-none" />
          <p className="text-white/40 text-xs font-medium mb-1 uppercase tracking-widest">Wallet Balance</p>
          <p className="text-5xl font-extrabold text-white tracking-tight">
            <span className="text-2xl text-white/40 font-bold mr-1">GHS</span>
            {(profile?.balance || 0).toFixed(2)}
          </p>
          {totalDailyEarnings > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <p className="text-green-400 text-xs font-semibold">+GHS {totalDailyEarnings}/day earning</p>
            </div>
          )}
          <div className="flex gap-3 mt-5">
            <Link href="/deposit" className="flex-1 py-3 bg-green-500 hover:bg-green-400 active:bg-green-600 text-black font-bold rounded-xl text-sm text-center transition shadow-lg shadow-green-500/20">💰 Deposit</Link>
            <Link href="/withdraw" className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-sm text-center transition border border-white/10">💸 Withdraw</Link>
          </div>
        </div>

        {/* STATS ROW */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-3.5 text-center">
            <p className="text-white/40 text-xs mb-1">Investments</p>
            <p className="text-xl font-bold">{investments.length}</p>
          </div>
          <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-3.5 text-center">
            <p className="text-white/40 text-xs mb-1">Daily Earn</p>
            <p className="text-xl font-bold text-green-400">{totalDailyEarnings}</p>
          </div>
          <Link href="/referrals">
            <div className="bg-[#0A1628] border border-white/10 hover:border-green-500/30 rounded-2xl p-3.5 text-center transition cursor-pointer h-full">
              <p className="text-white/40 text-xs mb-1">Referrals</p>
              <p className="text-xl font-bold">👥</p>
            </div>
          </Link>
        </div>

        {/* TABS */}
        <div className="flex gap-1.5 mb-5 bg-[#0A1628] border border-white/10 p-1 rounded-xl overflow-x-auto">
          {(["overview", "invest", "referral", "redeem"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 min-w-fit py-2 px-2 rounded-lg text-xs font-semibold transition whitespace-nowrap relative ${tab === t ? "bg-green-500 text-black" : "text-white/40 hover:text-white"}`}>
              {t === "overview" ? "📊 Overview"
                : t === "invest"   ? "📦 Packages"
                : t === "referral" ? "🔗 Referral"
                : <>🎟️ Redeem {todayCodeActive && tab !== "redeem" && <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-400 rounded-full" />}</>}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="space-y-4">
            {investments.length > 0 ? (
              <>
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">Active Investments</h3>
                {investments.map((inv) => (
                  <div key={inv.id} className="bg-[#0A1628] border border-white/10 rounded-xl p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-lg flex-shrink-0">📈</div>
                      <div>
                        <p className="font-bold text-sm">GHS {inv.amount} Package</p>
                        <p className="text-white/40 text-xs">Since {new Date(inv.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-green-400 font-bold text-sm">+GHS {inv.daily_earnings}</p>
                      <p className="text-white/30 text-xs">per day</p>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-8 text-center">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-white/60 font-semibold text-sm mb-1">No Active Investments</p>
                <p className="text-white/30 text-xs mb-4">Make a deposit to start earning daily.</p>
                <Link href="/deposit" className="inline-block px-6 py-2.5 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl text-sm transition">Make a Deposit</Link>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <a href="https://chat.whatsapp.com/Gd7PcmtOoil5AxlPDrV3Q2" target="_blank" rel="noreferrer"
                className="bg-[#0A1628] border border-white/10 hover:border-green-500/30 rounded-xl p-4 transition text-center flex flex-col items-center gap-1">
                <span className="text-2xl">💬</span><span className="text-xs text-white/60">WhatsApp Group</span>
              </a>
              <Link href="/withdraw" className="bg-[#0A1628] border border-white/10 hover:border-green-500/30 rounded-xl p-4 transition text-center flex flex-col items-center gap-1">
                <span className="text-2xl">💸</span><span className="text-xs text-white/60">Withdraw Funds</span>
              </Link>
            </div>
          </div>
        )}

        {/* PACKAGES */}
        {tab === "invest" && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1">Available Packages</h3>
            {packages.length === 0 ? (
              <div className="bg-[#0A1628] border border-white/10 rounded-xl p-8 text-center text-white/30 text-sm">No packages available. Check back soon.</div>
            ) : packages.map((pkg) => (
              <Link key={pkg.id} href={`/deposit?package=${pkg.amount}`}>
                <div className="bg-[#0A1628] border border-white/10 hover:border-green-500/40 rounded-xl p-4 flex items-center justify-between transition group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center font-bold text-sm text-green-400 flex-shrink-0">
                      {pkg.amount >= 1000 ? "💎" : pkg.amount >= 500 ? "🥇" : "🥈"}
                    </div>
                    <div>
                      <p className="font-bold">GHS {pkg.amount}</p>
                      <p className="text-white/40 text-xs">⏱ {pkg.duration_days || 30} days</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-green-400 font-bold text-sm">GHS {pkg.daily_earnings}/day</p>
                      <p className="text-white/30 text-xs">Total: GHS {(pkg.daily_earnings * (pkg.duration_days || 30)).toLocaleString()}</p>
                    </div>
                    <span className="text-white/30 group-hover:text-green-400 transition text-lg">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* REFERRAL */}
        {tab === "referral" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[{ level: "Level 1", pct: "7%", desc: "Direct" }, { level: "Level 2", pct: "2%", desc: "Their refs" }, { level: "Level 3", pct: "1%", desc: "3rd level" }].map((r) => (
                <div key={r.level} className="bg-[#0A1628] border border-white/10 rounded-xl p-3 text-center">
                  <p className="text-white/40 text-xs">{r.level}</p>
                  <p className="text-green-400 font-extrabold text-2xl">{r.pct}</p>
                  <p className="text-white/30 text-xs mt-0.5">{r.desc}</p>
                </div>
              ))}
            </div>
            <div className="bg-[#0A1628] border border-green-500/20 rounded-2xl p-5">
              <p className="text-white/50 text-xs font-semibold mb-1 uppercase tracking-widest">Your Referral Link</p>
              <p className="text-white/30 text-xs mb-3">Share this link. Earn commission when your friend deposits.</p>
              <div className="flex gap-2">
                <input readOnly value={referralLink} className="flex-1 bg-[#050E1F] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white/60 truncate min-w-0" />
                <button onClick={handleCopy} className={`px-4 py-2.5 font-semibold rounded-xl text-xs transition flex-shrink-0 ${copied ? "bg-green-600 text-white" : "bg-green-500 hover:bg-green-400 text-black"}`}>
                  {copied ? "✓ Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <Link href="/referrals" className="flex items-center justify-between bg-[#0A1628] border border-white/10 hover:border-green-500/30 rounded-xl p-4 transition">
              <div className="flex items-center gap-3"><span className="text-2xl">👥</span><div><p className="font-semibold text-sm">View My Referrals</p><p className="text-white/40 text-xs">See who you've referred</p></div></div>
              <span className="text-white/30 text-lg">→</span>
            </Link>
          </div>
        )}

        {/* REDEEM */}
        {tab === "redeem" && (
          <div className="space-y-4">

            {/* Step 1 — check notifications */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#130d2a] to-[#0a1628] border border-purple-500/25 rounded-2xl p-5">
              <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-purple-500/5 pointer-events-none" />
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-2xl flex-shrink-0">🔔</div>
                <div>
                  <p className="font-bold text-white text-sm mb-0.5">Step 1 — Check Your Notifications</p>
                  <p className="text-white/50 text-xs leading-relaxed">
                    Every day the admin sends a <span className="text-purple-300 font-semibold">daily redeem code</span> to all users via notification. Tap the bell icon at the top to find today's code.
                  </p>
                  {todayCodeActive ? (
                    <span className="inline-block mt-2 text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full font-semibold">🟢 Today's code is live!</span>
                  ) : (
                    <span className="inline-block mt-2 text-xs bg-white/10 text-white/40 px-3 py-1 rounded-full">No code yet today — check back later</span>
                  )}
                </div>
              </div>
            </div>

            {/* Step 2 — enter code */}
            <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-400">2</div>
                <p className="font-semibold text-sm">Enter the Code</p>
              </div>

              <input
                type="text"
                value={redeemCode}
                onChange={(e) => { setRedeemCode(e.target.value.toUpperCase()); setRedeemMsg(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleRedeem(); }}
                placeholder="e.g. A3BX9K2P"
                maxLength={10}
                className="w-full bg-[#050E1F] border border-white/10 rounded-xl px-4 py-4 text-white text-2xl font-mono placeholder-white/20 focus:border-purple-500 focus:outline-none transition tracking-widest text-center uppercase"
              />

              {redeemMsg && (
                <div className={`rounded-xl px-4 py-3 text-sm font-semibold text-center ${redeemMsg.type === "success" ? "bg-green-500/15 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
                  {redeemMsg.text}
                </div>
              )}

              <button
                onClick={handleRedeem}
                disabled={redeemLoading || !redeemCode.trim()}
                className="w-full py-4 bg-purple-500 hover:bg-purple-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-base transition active:scale-95"
              >
                {redeemLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Verifying...
                  </span>
                ) : "Redeem Code"}
              </button>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0A1628] border border-white/10 rounded-xl p-4 text-center">
                <p className="text-xl mb-1">📅</p>
                <p className="text-white/60 text-xs font-semibold">One Per Day</p>
                <p className="text-white/30 text-xs mt-0.5">New code released daily by admin</p>
              </div>
              <div className="bg-[#0A1628] border border-white/10 rounded-xl p-4 text-center">
                <p className="text-xl mb-1">⏳</p>
                <p className="text-white/60 text-xs font-semibold">24hr Window</p>
                <p className="text-white/30 text-xs mt-0.5">Code expires after 24 hours</p>
              </div>
            </div>
          </div>
        )}

        {/* SIGN OUT */}
        <button onClick={handleLogout} className="w-full mt-8 py-3 text-white/20 hover:text-white/50 text-sm transition">Sign Out</button>

      </div>
    </main>
  );
}