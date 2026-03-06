// PATH: app/login/page.jsx

"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    if (!email || !password) { setError("Please enter email and password."); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); setLoading(false); return; }
    window.location.href = "/dashboard";
  };

  return (
    <main className="min-h-screen bg-[#050E1F] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-xl font-bold mx-auto mb-3">E</div>
          <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
          <p className="text-white/40 text-sm mt-1">Login to your Evergreen account</p>
        </div>

        <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">{error}</div>
          )}

          <div>
            <label className="text-white/60 text-xs block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-[#050E1F] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-green-500 focus:outline-none transition"
            />
          </div>

          <div>
            <label className="text-white/60 text-xs block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="w-full bg-[#050E1F] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-green-500 focus:outline-none transition"
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold rounded-xl text-lg transition shadow-lg shadow-green-500/20"
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          <p className="text-center text-white/40 text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-green-400 hover:underline">Sign Up Free</Link>
          </p>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          Need help? WhatsApp: +1 (289) 908-2443
        </p>
      </div>
    </main>
  );
}