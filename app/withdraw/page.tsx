// PATH: app/withdraw/page.tsx

"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const WITHDRAWAL_FEE_PERCENT = 10;
const MIN_WITHDRAWAL = 45;

type Profile = {
  id: string;
  full_name: string;
  phone: string;
  balance: number;
};

export default function WithdrawPage() {
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [amount, setAmount]           = useState("");
  const [phone, setPhone]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [success, setSuccess]         = useState(false);
  const [error, setError]             = useState("");
  const [finalAmount, setFinalAmount] = useState(0);
  const [hasDeposited, setHasDeposited] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { window.location.href = "/login"; return; }

      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      setProfile(prof as Profile);
      setPhone((prof as Profile)?.phone || "");

      const { data: deposits } = await supabase
        .from("deposits")
        .select("id")
        .eq("user_id", session.user.id)
        .limit(1);

      setHasDeposited(!!deposits && deposits.length > 0);
      setPageLoading(false);
    }
    load();
  }, []);

  const numAmount  = parseFloat(amount) || 0;
  const fee        = (numAmount * WITHDRAWAL_FEE_PERCENT) / 100;
  const youReceive = numAmount - fee;

  const isWithinHours = () => {
    const now  = new Date();
    const day  = now.getDay();
    const hour = now.getHours();
    return day >= 1 && day <= 6 && hour >= 9 && hour < 16;
  };

  const handleSubmit = async () => {
    setError("");
    if (!hasDeposited) {
      setError("You must make a deposit before you can withdraw.");
      return;
    }
    if (!isWithinHours()) {
      setError("Withdrawals are only processed Monday–Saturday, 9am–4pm.");
      return;
    }
    if (numAmount < MIN_WITHDRAWAL) {
      setError(`Minimum withdrawal is GHS ${MIN_WITHDRAWAL}.`);
      return;
    }
    if (numAmount > (profile?.balance || 0)) {
      setError("Insufficient balance.");
      return;
    }
    if (!phone.trim()) {
      setError("Please enter your MoMo phone number.");
      return;
    }
    if (!profile) return;

    setLoading(true);
    try {
      await supabase.from("withdrawals").insert({
        user_id: profile.id,
        amount: numAmount,
        fee,
        amount_after_fee: youReceive,
        phone,
        status: "pending",
      });

      await supabase
        .from("profiles")
        .update({ balance: (profile.balance || 0) - numAmount })
        .eq("id", profile.id);

      await supabase.from("notifications").insert({
        user_id: profile.id,
        title: "💸 Withdrawal Request Submitted",
        message: `Your withdrawal of GHS ${numAmount} (you receive GHS ${youReceive.toFixed(2)} after 10% fee) has been submitted. Processing takes 9hrs–1 business day.`,
        type: "withdrawal",
      });

      setFinalAmount(youReceive);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="min-h-screen bg-[#050E1F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────────
  if (success) {
    return (
      <main className="min-h-screen bg-[#050E1F] flex items-center justify-center px-4">
        <div className="bg-[#0A1628] border border-green-500/30 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">💸</div>
          <h2 className="text-xl font-bold text-white mb-2">Withdrawal Submitted!</h2>
          <p className="text-white/60 text-sm mb-2">
            You will receive{" "}
            <span className="text-green-400 font-bold">GHS {finalAmount.toFixed(2)}</span>{" "}
            after the 10% fee.
          </p>
          <p className="text-white/40 text-xs mb-6">Processing time: 9 hours – 1 business day</p>
          <Link href="/dashboard"
            className="block py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  // ── No deposit yet ───────────────────────────────────────────────────────────
  if (hasDeposited === false) {
    return (
      <main className="min-h-screen bg-[#050E1F] flex items-center justify-center px-4">
        <div className="bg-[#0A1628] border border-orange-500/30 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-white mb-2">Deposit Required</h2>
          <p className="text-white/60 text-sm mb-6">
            You need to make at least one deposit before you can withdraw funds.
          </p>
          <Link href="/deposit"
            className="block py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition mb-3">
            Make a Deposit
          </Link>
          <Link href="/dashboard"
            className="block py-3 border border-white/10 text-white/60 hover:text-white rounded-xl transition text-sm">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  // ── Main ────────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#050E1F] text-white pb-12">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <Link href="/dashboard" className="text-white/50 hover:text-white transition text-xl leading-none">←</Link>
        <h1 className="text-lg font-bold">Withdraw Funds</h1>
      </div>

      <div className="px-4 py-6 max-w-xl mx-auto space-y-5">

        {/* Hours Banner */}
        <div className={`rounded-xl px-4 py-3 text-sm border ${
          isWithinHours()
            ? "bg-green-500/10 border-green-500/30 text-green-400"
            : "bg-orange-500/10 border-orange-500/30 text-orange-400"
        }`}>
          {isWithinHours()
            ? "✅ Withdrawals are open now (9am–4pm, Mon–Sat)"
            : "⏰ Withdrawals available Monday–Saturday, 9am–4pm"}
        </div>

        {/* Balance */}
        <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-5">
          <p className="text-white/50 text-xs">Available Balance</p>
          <p className="text-3xl font-extrabold text-white">
            GHS {(profile?.balance || 0).toFixed(2)}
          </p>
        </div>

        {/* Amount */}
        <div>
          <label className="text-white/60 text-xs block mb-2">Withdrawal Amount (GHS)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Min. GHS ${MIN_WITHDRAWAL}`}
            className="w-full bg-[#0A1628] border border-white/10 rounded-xl px-4 py-4 text-white text-lg placeholder-white/30 focus:border-green-500 focus:outline-none transition"
          />
        </div>

        {/* Fee Breakdown */}
        {numAmount > 0 && (
          <div className="bg-[#0A1628] border border-white/10 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Requested</span>
              <span>GHS {numAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">10% Fee</span>
              <span className="text-orange-400">- GHS {fee.toFixed(2)}</span>
            </div>
            <div className="h-px bg-white/10" />
            <div className="flex justify-between font-bold">
              <span>You Receive</span>
              <span className="text-green-400">GHS {youReceive.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* MoMo Number */}
        <div>
          <label className="text-white/60 text-xs block mb-2">MTN MoMo Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 0244000000"
            className="w-full bg-[#0A1628] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-green-500 focus:outline-none transition"
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || numAmount < MIN_WITHDRAWAL}
          className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:opacity-40 text-black font-bold rounded-xl text-lg transition"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            "Request Withdrawal"
          )}
        </button>

        <p className="text-white/30 text-xs text-center">
          Withdrawals are manually approved · 9hrs–1 day processing<br />
          Min GHS {MIN_WITHDRAWAL} · 10% service fee applies
        </p>

      </div>
    </main>
  );
}