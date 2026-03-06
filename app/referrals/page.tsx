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
};

type Referral = {
  id: string;
  full_name: string;
  avatar_color: string;
  avatar_initials: string;
  created_at: string;
};

export default function ReferralsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [level1, setLevel1]   = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState(false);
  const [error, setError]     = useState("");

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

        if (prof.referral_code) {
          const { data: l1 } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_color, avatar_initials, created_at")
            .eq("referred_by", prof.referral_code);
          setLevel1((l1 as Referral[]) || []);
        }
      } catch (err) {
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

  return (
    <main className="min-h-screen bg-[#050E1F] text-white pb-12">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <Link href="/dashboard" className="text-white/50 hover:text-white transition">←</Link>
        <h1 className="text-lg font-bold">My Referrals</h1>
      </div>

      <div className="px-4 py-6 max-w-xl mx-auto space-y-6">

        {/* Commission Tiers */}
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["Level 1", "7%", "Direct"],
              ["Level 2", "2%", "Their refs"],
              ["Level 3", "1%", "3rd degree"],
            ] as const
          ).map(([lvl, pct, desc]) => (
            <div key={lvl} className="bg-[#0A1628] border border-white/10 rounded-xl p-3 text-center">
              <p className="text-white/40 text-xs">{lvl}</p>
              <p className="text-green-400 font-extrabold text-xl">{pct}</p>
              <p className="text-white/30 text-xs mt-0.5">{desc}</p>
            </div>
          ))}
        </div>

        {/* Referral Link */}
        <div className="bg-[#0A1628] border border-green-500/20 rounded-2xl p-5">
          <p className="text-white/60 text-xs mb-2 font-semibold">Your Referral Link</p>
          <div className="flex gap-2 mb-3">
            <input
              readOnly
              value={referralLink}
              placeholder="Loading your referral link..."
              className="flex-1 bg-[#050E1F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/60 truncate"
            />
            <button
              onClick={handleCopy}
              disabled={!referralLink}
              className={`px-4 py-2 font-semibold rounded-xl text-xs transition disabled:opacity-40 ${
                copied ? "bg-green-600 text-white" : "bg-green-500 hover:bg-green-400 text-black"
              }`}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-white/30 text-xs">
            Share this link. When your friend deposits, you earn commission automatically.
          </p>
        </div>

        {/* Level 1 Referrals List */}
        <div>
          <h2 className="font-semibold text-sm text-white/60 mb-3">
            Level 1 Referrals ({level1.length})
          </h2>
          {level1.length === 0 ? (
            <div className="bg-[#0A1628] border border-white/10 rounded-xl p-8 text-center text-white/30 text-sm">
              No referrals yet.<br />Share your link to start earning!
            </div>
          ) : (
            <div className="space-y-3">
              {level1.map((u) => (
                <div key={u.id} className="bg-[#0A1628] border border-white/10 rounded-xl p-4 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: u.avatar_color || "#16A34A" }}
                  >
                    {u.avatar_initials || "U"}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{u.full_name}</p>
                    <p className="text-white/30 text-xs">Joined {new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}