// PATH: app/referrals/page.tsx

"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Profile = {
  id: string;
  full_name: string;
  referral_code: string;
  avatar_color: string;
  avatar_initials: string;
  balance: number;
};

type Referral = {
  id: string;
  full_name: string;
  avatar_color: string;
  avatar_initials: string;
  created_at: string;
  hasDeposited: boolean;
  totalDeposited: number;
  commissionEarned: number;
};

export default function ReferralsPage() {
  const [profile, setProfile]             = useState<Profile | null>(null);
  const [referrals, setReferrals]         = useState<Referral[]>([]);
  const [totalCommission, setTotalCommission] = useState(0);
  const [loading, setLoading]             = useState(true);
  const [copied, setCopied]               = useState(false);
  const [error, setError]                 = useState("");

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { window.location.href = "/login"; return; }

        const { data: prof, error: profError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profError || !prof) {
          setError("Profile not found. Please complete sign up first.");
          setLoading(false);
          return;
        }

        setProfile(prof as Profile);

        if (!prof.referral_code) { setLoading(false); return; }

        // Get all Level 1 referrals (no limit)
        const { data: l1 } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_color, avatar_initials, created_at")
          .eq("referred_by", prof.referral_code)
          .order("created_at", { ascending: false });

        const l1List = (l1 || []) as { id: string; full_name: string; avatar_color: string; avatar_initials: string; created_at: string }[];

        if (l1List.length === 0) { setLoading(false); return; }

        // For each referral, check their approved deposits to calculate commission
        const enriched: Referral[] = await Promise.all(
          l1List.map(async (u) => {
            const { data: deps } = await supabase
              .from("deposits")
              .select("amount")
              .eq("user_id", u.id)
              .eq("status", "approved");

            const totalDeposited = (deps || []).reduce((s: number, d: { amount: number }) => s + (d.amount || 0), 0);
            const commissionEarned = totalDeposited * 0.07; // 7% L1

            return {
              ...u,
              hasDeposited: (deps || []).length > 0,
              totalDeposited,
              commissionEarned,
            };
          })
        );

        const total = enriched.reduce((s, r) => s + r.commissionEarned, 0);
        setReferrals(enriched);
        setTotalCommission(total);
      } catch {
        setError("Something went wrong. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const referralLink =
    typeof window !== "undefined" && profile?.referral_code
      ? `${window.location.origin}/signup?ref=${profile.referral_code}`
      : "";

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050E1F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050E1F] flex items-center justify-center px-4">
        <div className="bg-[#0A1628] border border-red-500/30 rounded-2xl p-8 max-w-sm w-full text-center">
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <Link href="/dashboard" className="text-green-400 hover:underline text-sm">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const deposited   = referrals.filter(r => r.hasDeposited);
  const notDeposited = referrals.filter(r => !r.hasDeposited);

  return (
    <main className="min-h-screen bg-[#050E1F] text-white pb-12">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <Link href="/dashboard" className="text-white/50 hover:text-white transition text-xl leading-none">←</Link>
        <h1 className="text-lg font-bold">My Referrals</h1>
      </div>

      <div className="px-4 py-6 max-w-xl mx-auto space-y-6">

        {/* Commission Tiers */}
        <div className="grid grid-cols-3 gap-3">
          {([
            ["Level 1", "7%", "Direct referrals"],
            ["Level 2", "2%", "Their referrals"],
            ["Level 3", "1%", "3rd degree"],
          ] as const).map(([lvl, pct, desc]) => (
            <div key={lvl} className="bg-[#0A1628] border border-white/10 rounded-xl p-3 text-center">
              <p className="text-white/40 text-xs">{lvl}</p>
              <p className="text-green-400 font-extrabold text-xl">{pct}</p>
              <p className="text-white/30 text-xs mt-0.5">{desc}</p>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#0A1628] border border-white/10 rounded-xl p-4 text-center">
            <p className="text-white/40 text-xs mb-1">Total Referred</p>
            <p className="text-2xl font-extrabold text-white">{referrals.length}</p>
            <p className="text-white/30 text-xs mt-0.5">people</p>
          </div>
          <div className="bg-[#0A1628] border border-green-500/20 rounded-xl p-4 text-center">
            <p className="text-white/40 text-xs mb-1">Deposited</p>
            <p className="text-2xl font-extrabold text-green-400">{deposited.length}</p>
            <p className="text-white/30 text-xs mt-0.5">earning you</p>
          </div>
          <div className="bg-[#0A1628] border border-green-500/30 rounded-xl p-4 text-center">
            <p className="text-white/40 text-xs mb-1">Commission</p>
            <p className="text-xl font-extrabold text-green-400">GHS {totalCommission.toFixed(2)}</p>
            <p className="text-white/30 text-xs mt-0.5">earned total</p>
          </div>
        </div>

        {/* Referral Link */}
        <div className="bg-[#0A1628] border border-green-500/20 rounded-2xl p-5">
          <p className="text-white/50 text-xs font-semibold mb-1 uppercase tracking-widest">Your Referral Link</p>
          <p className="text-white/30 text-xs mb-3">
            Share this link with anyone. There's <span className="text-green-400 font-semibold">no limit</span> — refer as many people as you want!
          </p>
          <div className="flex gap-2 mb-2">
            <input
              readOnly
              value={referralLink}
              placeholder="Loading..."
              className="flex-1 bg-[#050E1F] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white/60 truncate min-w-0"
            />
            <button
              onClick={handleCopy}
              disabled={!referralLink}
              className={`px-4 py-2.5 font-semibold rounded-xl text-xs transition disabled:opacity-40 flex-shrink-0 ${
                copied ? "bg-green-600 text-white" : "bg-green-500 hover:bg-green-400 text-black"
              }`}
            >
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-white/20 text-xs">
            You earn 7% of every deposit your direct referral makes
          </p>
        </div>

        {/* How bonuses work */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
          <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-2">💡 How Bonuses Work</p>
          <div className="space-y-1.5 text-white/50 text-xs">
            <p>✅ Your friend signs up using your link</p>
            <p>✅ They make a deposit and it gets approved</p>
            <p>✅ You instantly receive <span className="text-green-400 font-semibold">7% commission</span> in your wallet</p>
            <p>✅ Every time they make a new deposit, you earn again</p>
            <p>🔁 No limit on how many people you can refer</p>
          </div>
        </div>

        {/* Referrals who deposited */}
        {deposited.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">
              ✅ Deposited ({deposited.length})
            </h2>
            <div className="space-y-3">
              {deposited.map((u) => (
                <div key={u.id} className="bg-[#0A1628] border border-green-500/20 rounded-xl p-4 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: u.avatar_color || "#16A34A" }}
                  >
                    {u.avatar_initials || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{u.full_name}</p>
                    <p className="text-white/30 text-xs">Joined {new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-green-400 font-bold text-sm">+GHS {u.commissionEarned.toFixed(2)}</p>
                    <p className="text-white/30 text-xs">from GHS {u.totalDeposited}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Referrals who haven't deposited yet */}
        {notDeposited.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">
              ⏳ Not Deposited Yet ({notDeposited.length})
            </h2>
            <div className="space-y-2">
              {notDeposited.map((u) => (
                <div key={u.id} className="bg-[#0A1628] border border-white/10 rounded-xl p-4 flex items-center gap-3 opacity-60">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: u.avatar_color || "#16A34A" }}
                  >
                    {u.avatar_initials || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{u.full_name}</p>
                    <p className="text-white/30 text-xs">Joined {new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="text-xs bg-orange-500/10 border border-orange-500/20 text-orange-400 px-2 py-1 rounded-full">Pending deposit</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-white/20 text-xs mt-2 text-center">
              Remind them to deposit to start earning your commission
            </p>
          </div>
        )}

        {/* Empty state */}
        {referrals.length === 0 && (
          <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-10 text-center">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-white/60 font-semibold text-sm mb-1">No referrals yet</p>
            <p className="text-white/30 text-xs mb-4">Copy your link above and share it with friends, family, or on social media!</p>
            <button onClick={handleCopy} className="px-6 py-2.5 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl text-sm transition">
              {copied ? "✓ Copied!" : "Copy My Referral Link"}
            </button>
          </div>
        )}

      </div>
    </main>
  );
}