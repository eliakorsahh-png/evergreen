// PATH: app/page.tsx

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Fix: explicit type instead of never[] ──────────────────────────────────
type Package = {
  id: string;
  amount: number;
  daily_earnings: number;
  duration_days: number;
  active: boolean;
};

export default function HomePage() {
  const [count, setCount]                   = useState(0);
  const [packages, setPackages]             = useState<Package[]>([]);   // ← typed
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [videoPlaying, setVideoPlaying]     = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount((prev) => (prev < 12480 ? prev + 47 : 12480));
    }, 10);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchPackages() {
      const { data, error } = await supabase
        .from("packages")
        .select("*")
        .eq("active", true)
        .order("amount", { ascending: true });
      if (!error && data) setPackages(data as Package[]);   // ← cast
      setLoadingPackages(false);
    }
    fetchPackages();
  }, []);

  return (
    <main className="min-h-screen bg-[#050E1F] text-white overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-white/10 sticky top-0 z-50 bg-[#050E1F]/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 overflow-hidden flex items-center justify-center">
            <img src="/favicon.ico" alt="Evergreen Asset" className="w-full h-full object-contain rounded-full" />
          </div>
          <span className="text-base sm:text-lg font-bold tracking-wide text-green-400">Evergreen Asset</span>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Link href="/login" className="px-3 sm:px-5 py-2 text-xs sm:text-sm border border-white/20 rounded-full hover:border-green-400 transition">
            Login
          </Link>
          <Link href="/signup" className="px-3 sm:px-5 py-2 text-xs sm:text-sm bg-green-500 hover:bg-green-400 rounded-full font-semibold transition text-black">
            Sign Up Free
          </Link>
        </div>
      </nav>

      {/* ── HERO BANNER ── */}
      <div className="relative w-full h-48 sm:h-64 md:h-80 lg:h-96 overflow-hidden">
        <img
          src="/hero.jpeg"
          alt="Evergreen Asset – Earn Daily"
          className="absolute inset-0 w-full h-full object-cover object-center"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050E1F]/60 via-[#050E1F]/40 to-[#050E1F]" />
        <div className="absolute inset-0 bg-gradient-to-r from-green-900/30 via-transparent to-blue-900/20" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <div className="inline-block bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-3 tracking-widest uppercase backdrop-blur-sm">
            🎁 Get 5 GHS Sign-Up Bonus
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight drop-shadow-lg">
            Buy a Package.<br />
            <span className="text-green-400">Earn Every Day.</span>
          </h1>
        </div>
      </div>

      {/* ── HERO BODY ── */}
      <section className="relative px-4 sm:px-6 pt-10 pb-16 sm:pb-20 text-center max-w-4xl mx-auto">
        <p className="text-white/60 text-base sm:text-lg mb-10 max-w-xl mx-auto">
          Join thousands earning daily on Evergreen Asset. Start with as little as GHS 100 and watch your investment grow.
        </p>

        {/* ── VIDEO ── */}
        <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0A1628] aspect-video max-w-2xl mx-auto mb-10 shadow-2xl shadow-green-900/20">
          {videoPlaying ? (
            <video
              className="absolute inset-0 w-full h-full object-cover"
              src="/yt.mp4"
              autoPlay
              controls
            />
          ) : (
            <button
              className="absolute inset-0 w-full h-full flex flex-col items-center justify-center group"
              onClick={() => setVideoPlaying(true)}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900/50 to-green-900/30" />
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-500/20 border-2 border-green-400 flex items-center justify-center mb-3 group-hover:bg-green-500/40 group-hover:scale-110 transition-all duration-300 shadow-lg shadow-green-500/30">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8 text-green-400 ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <p className="text-white/80 text-sm font-semibold">Watch How to Get Started</p>
                <p className="text-white/40 text-xs mt-1">2 min guide · No experience needed</p>
              </div>
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup" className="px-8 py-4 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl text-base sm:text-lg transition shadow-lg shadow-green-500/20 active:scale-95">
            Start Earning Now →
          </Link>
          <a href="https://chat.whatsapp.com/Gd7PcmtOoil5AxlPDrV3Q2" target="_blank" rel="noreferrer"
            className="px-8 py-4 border border-white/20 hover:border-green-400 rounded-xl text-base sm:text-lg transition active:scale-95">
            Join WhatsApp Group
          </a>
        </div>

        <div className="mt-12">
          <p className="text-white/40 text-sm mb-1">Total Earnings Paid Out</p>
          <p className="text-3xl sm:text-4xl font-bold text-green-400">GHS {count.toLocaleString()}+</p>
        </div>
      </section>

      {/* ── PACKAGES ── */}
      <section className="px-4 sm:px-6 py-16 max-w-6xl mx-auto">
        <h2 className="text-center text-2xl sm:text-3xl font-bold mb-2">Investment Packages</h2>
        <p className="text-center text-white/50 mb-10 text-sm">Choose a package and earn daily returns</p>

        {loadingPackages ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-[#0A1628] border border-white/10 rounded-2xl p-4 animate-pulse">
                <div className="h-3 bg-white/10 rounded mb-2 w-16" />
                <div className="h-6 bg-white/10 rounded mb-3 w-20" />
                <div className="h-px bg-white/10 my-3" />
                <div className="h-3 bg-white/10 rounded mb-1 w-12" />
                <div className="h-5 bg-green-900/30 rounded w-16" />
              </div>
            ))}
          </div>
        ) : packages.length === 0 ? (
          <p className="text-center text-white/40 py-10">No packages available right now.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {packages.map((pkg) => (
              <Link
                key={pkg.id}
                href="/signup"
                className="bg-[#0A1628] border border-white/10 rounded-2xl p-4 hover:border-green-500/60 hover:bg-[#0d1f3a] hover:-translate-y-1 transition-all duration-200 group"
              >
                <p className="text-white/40 text-xs mb-1">Package</p>
                <p className="text-xl font-bold text-white group-hover:text-green-300 transition">GHS {pkg.amount}</p>
                {pkg.duration_days && (
                  <p className="text-white/30 text-xs mt-0.5">{pkg.duration_days} days</p>
                )}
                <div className="h-px bg-white/10 my-3" />
                <p className="text-xs text-white/40">Daily Earnings</p>
                <p className="text-green-400 font-bold text-lg">GHS {pkg.daily_earnings}/day</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="px-4 sm:px-6 py-16 bg-[#081018] text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-10">How It Works</h2>
        <div className="grid sm:grid-cols-3 gap-6 sm:gap-8 max-w-3xl mx-auto">
          {[
            { step: "1", title: "Sign Up", desc: "Create your account in minutes and get a 5 GHS welcome bonus instantly." },
            { step: "2", title: "Deposit", desc: "Send your deposit via MTN MoMo and upload your payment screenshot for confirmation." },
            { step: "3", title: "Earn Daily", desc: "Buy a package and earn daily returns. Withdraw every weekday 9am–4pm." },
          ].map((item) => (
            <div key={item.step} className="flex flex-col items-center px-2">
              <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500 text-green-400 font-bold text-lg flex items-center justify-center mb-4 shadow-lg shadow-green-500/10">
                {item.step}
              </div>
              <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── REFERRAL ── */}
      <section className="px-4 sm:px-6 py-16 bg-[#081018] text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">Earn More by Referring Friends</h2>
        <p className="text-white/50 text-sm mb-8">Get commission when your referrals deposit</p>
        <div className="flex justify-center gap-4 sm:gap-6 flex-wrap">
          {[
            ["Level 1", "7%", "Direct referrals"],
            ["Level 2", "2%", "Their referrals"],
            ["Level 3", "1%", "3rd level"],
          ].map(([level, pct, sub]) => (
            <div key={level} className="bg-[#0A1628] border border-white/10 rounded-2xl px-6 sm:px-8 py-6 hover:border-green-500/30 transition min-w-[100px]">
              <p className="text-white/50 text-xs mb-1">{level}</p>
              <p className="text-3xl sm:text-4xl font-bold text-green-400">{pct}</p>
              <p className="text-white/30 text-xs mt-1">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── ABOUT US ── */}
      <section className="px-4 sm:px-6 py-16 max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">About Evergreen Asset</h2>
          <div className="flex justify-center gap-3 text-2xl">
            <span title="Senegal">🇸🇳</span>
            <span title="Nigeria">🇳🇬</span>
            <span title="Ghana">🇬🇭</span>
          </div>
        </div>
        <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-4">
          <p className="text-white/70 text-sm sm:text-base leading-relaxed">
            Evergreen Asset is an <span className="text-white font-semibold">international investment platform</span> and company that expanded its operations into Africa in 2023. The platform was first officially launched in <span className="text-green-400 font-semibold">Senegal in 2024</span>, followed by <span className="text-green-400 font-semibold">Nigeria in 2025</span>.
          </p>
          <p className="text-white/70 text-sm sm:text-base leading-relaxed">
            In 2026, Evergreen Asset proudly extends its presence to <span className="text-green-400 font-semibold">Ghana 🇬🇭</span>. Our operations in Ghana are planned to run for a period of <span className="text-white font-semibold">365 to 800 days</span>, during which we aim to provide valuable opportunities and services to the public.
          </p>
          <p className="text-white/70 text-sm sm:text-base leading-relaxed">
            We look forward to strong participation from Ghanaians and hope the community will help make the Evergreen Asset platform widely recognized and trending across the country. 🌍📈
          </p>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
            {[["2023", "Africa Launch"], ["3", "Countries"], ["365–800", "Days in Ghana"]].map(([val, label]) => (
              <div key={label} className="text-center">
                <p className="text-green-400 font-bold text-xl sm:text-2xl">{val}</p>
                <p className="text-white/40 text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to Start Earning?</h2>
        <p className="text-white/50 mb-8 text-sm sm:text-base">Join now and claim your 5 GHS welcome bonus</p>
        <Link href="/signup" className="inline-block px-10 py-4 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl text-lg transition shadow-lg shadow-green-500/20 active:scale-95">
          Create Free Account
        </Link>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/10 px-4 sm:px-6 py-8 text-center text-white/30 text-xs sm:text-sm space-y-1">
        <p>Evergreen Asset © {new Date().getFullYear()} · Canada 🇨🇦</p>
        <p>Customer Service: +1 (289) 908-2443 · +1 (343) 443-6208</p>
      </footer>
    </main>
  );
}