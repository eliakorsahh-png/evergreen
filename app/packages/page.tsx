// PATH: app/packages/page.tsx

"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Package = { id: string; name: string; amount: number; daily_earnings: number; duration_days: number; active: boolean };

const PACKAGE_STYLES = [
  { bg: "from-slate-900 to-slate-800", badge: "bg-slate-600/40 text-slate-300", border: "border-slate-600/40", glow: "" },
  { bg: "from-amber-950 to-yellow-950", badge: "bg-yellow-600/40 text-yellow-300", border: "border-yellow-600/40", glow: "shadow-yellow-900/30" },
  { bg: "from-indigo-950 to-blue-950", badge: "bg-blue-600/40 text-blue-300", border: "border-blue-600/40", glow: "shadow-blue-900/30" },
  { bg: "from-emerald-950 to-green-950", badge: "bg-green-600/40 text-green-300", border: "border-green-500/50", glow: "shadow-green-900/30" },
  { bg: "from-purple-950 to-violet-950", badge: "bg-purple-600/40 text-purple-300", border: "border-purple-500/50", glow: "shadow-purple-900/30" },
];

const EMOJIS = ["🥉", "🥈", "🥇", "💎", "👑"];

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { window.location.href = "/login"; return; }

      const { data } = await supabase
        .from("packages")
        .select("*")
        .eq("active", true)
        .order("amount", { ascending: true });

      setPackages((data as Package[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050E1F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#050E1F] text-white pb-16">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <Link href="/dashboard" className="text-white/50 hover:text-white transition text-xl leading-none">←</Link>
        <div>
          <h1 className="text-lg font-bold">Investment Packages</h1>
          <p className="text-white/40 text-xs">Choose a plan and start earning daily</p>
        </div>
      </div>

      {/* How it works banner */}
      <div className="px-4 pt-5 max-w-xl mx-auto">
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 mb-6 text-center">
          <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-1">📈 How It Works</p>
          <p className="text-white/60 text-sm">Deposit once. Earn daily returns. Withdraw anytime after your package matures.</p>
        </div>
      </div>

      <div className="px-4 max-w-xl mx-auto space-y-4">
        {packages.length === 0 ? (
          <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-12 text-center">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-white/60 font-semibold">No packages available right now.</p>
            <p className="text-white/30 text-sm mt-1">Check back soon or contact support.</p>
          </div>
        ) : (
          packages.map((pkg, i) => {
            const style    = PACKAGE_STYLES[Math.min(i, PACKAGE_STYLES.length - 1)];
            const emoji    = EMOJIS[Math.min(i, EMOJIS.length - 1)];
            const total    = pkg.daily_earnings * (pkg.duration_days || 30);
            const roi      = ((total / pkg.amount) * 100).toFixed(0);

            return (
              <div
                key={pkg.id}
                className={`relative bg-gradient-to-br ${style.bg} border ${style.border} rounded-2xl overflow-hidden shadow-xl ${style.glow}`}
              >
                {/* Top section */}
                <div className="p-5 pb-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{emoji}</span>
                      <div>
                        <p className="font-extrabold text-xl text-white">{pkg.name || `Package ${i + 1}`}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${style.badge}`}>
                          {roi}% ROI
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white/40 text-xs">Deposit</p>
                      <p className="text-3xl font-extrabold text-white">GHS {pkg.amount}</p>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/5 rounded-xl p-3 text-center">
                      <p className="text-white/40 text-xs mb-1">Daily</p>
                      <p className="text-green-400 font-extrabold text-lg">GHS {pkg.daily_earnings}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center">
                      <p className="text-white/40 text-xs mb-1">Duration</p>
                      <p className="text-white font-extrabold text-lg">{pkg.duration_days || 30}</p>
                      <p className="text-white/30 text-xs">days</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 text-center">
                      <p className="text-white/40 text-xs mb-1">Total Return</p>
                      <p className="text-white font-extrabold text-base">GHS {total.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/10 mx-5" />

                {/* CTA */}
                <div className="p-5 pt-4">
                  <Link href={`/deposit?package=${pkg.amount}`}>
                    <button className="w-full py-3.5 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition shadow-lg shadow-green-500/20 text-base">
                      Invest GHS {pkg.amount} →
                    </button>
                  </Link>
                </div>
              </div>
            );
          })
        )}

        {/* Commission reminder */}
        <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-4 text-center mt-2">
          <p className="text-white/40 text-xs mb-2">💡 Refer friends and earn commission</p>
          <div className="flex justify-center gap-6 text-sm">
            <div><span className="text-green-400 font-bold">7%</span> <span className="text-white/40 text-xs">Level 1</span></div>
            <div><span className="text-green-400 font-bold">2%</span> <span className="text-white/40 text-xs">Level 2</span></div>
            <div><span className="text-green-400 font-bold">1%</span> <span className="text-white/40 text-xs">Level 3</span></div>
          </div>
        </div>
      </div>
    </main>
  );
}