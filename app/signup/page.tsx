// PATH: app/signup/page.tsx

"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function generateAvatar(name: string) {
  const colors = ["#16A34A", "#1D4ED8", "#7C3AED", "#DC2626", "#D97706", "#0891B2"];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return { color, initials };
}

function generateReferralCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function SignUpPage() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    redeemCode: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [avatar, setAvatar] = useState<{ color: string; initials: string } | null>(null);
  const [bonusAmount, setBonusAmount] = useState(5);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (e.target.name === "fullName" && e.target.value.trim()) {
      setAvatar(generateAvatar(e.target.value.trim()));
    }
  };

  const handleSubmit = async () => {
    setError("");

    if (!form.fullName || !form.email || !form.password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const avatarData = generateAvatar(form.fullName);
      const referralCode = generateReferralCode();
      const refParam = new URLSearchParams(window.location.search).get("ref") || null;

      // Step 1: Check redeem code BEFORE creating the user
      let redeemBonus = 0;
      let redeemCodeId: string | null = null;

      if (form.redeemCode.trim()) {
        const { data: codeData } = await supabase
          .from("redeem_codes")
          .select("*")
          .eq("code", form.redeemCode.trim().toUpperCase())
          .eq("used", false)
          .maybeSingle(); // use maybeSingle to avoid error when not found

        if (codeData) {
          redeemBonus = codeData.value;
          redeemCodeId = codeData.id;
        } else if (form.redeemCode.trim()) {
          setError("Invalid or already used redeem code.");
          setLoading(false);
          return;
        }
      }

      const signupBonus = 5 + redeemBonus;

      // Step 2: Create Supabase auth user
      // IMPORTANT: In newer Supabase, we pass profile data in options.data
      // so we can use it in a database trigger OR read it right after sign up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName,
            phone: form.phone,
            avatar_color: avatarData.color,
            avatar_initials: avatarData.initials,
            referral_code: referralCode,
            referred_by: refParam,
            balance: signupBonus,
          },
        },
      });

      if (authError) throw authError;

      // Step 3: Get user ID — works even if email confirmation is on
      // authData.user is available immediately after signUp even before confirmation
      const userId = authData.user?.id;

      if (!userId) {
        throw new Error("User creation failed. Please try again.");
      }

      // Step 4: Insert profile row manually (more reliable than triggers)
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        full_name: form.fullName,
        phone: form.phone,
        email: form.email,
        avatar_color: avatarData.color,
        avatar_initials: avatarData.initials,
        balance: signupBonus,
        referral_code: referralCode,
        referred_by: refParam,
      });

      // If profile insert fails due to duplicate (user already exists), try update
      if (profileError) {
        if (profileError.code === "23505") {
          // Duplicate key — profile may already exist from a previous attempt
          await supabase.from("profiles").update({
            full_name: form.fullName,
            phone: form.phone,
            avatar_color: avatarData.color,
            avatar_initials: avatarData.initials,
            balance: signupBonus,
            referral_code: referralCode,
            referred_by: refParam,
          }).eq("id", userId);
        } else {
          throw profileError;
        }
      }

      // Step 5: Mark redeem code as used
      if (redeemCodeId) {
        await supabase
          .from("redeem_codes")
          .update({ used: true, used_by: userId })
          .eq("id", redeemCodeId);
      }

      // Step 6: Insert welcome notification
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "🎉 Welcome to Evergreen Asset!",
        message: `Congratulations on joining us! Your account has been credited with GHS ${signupBonus} welcome bonus. Start investing and earn daily!`,
        type: "bonus",
      });

      setBonusAmount(signupBonus);
      setAvatar(avatarData);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── SUCCESS SCREEN ───────────────────────────────────────────────────────────
  if (success) {
    return (
      <main className="min-h-screen bg-[#050E1F] flex items-center justify-center px-4">
        <div className="bg-[#0A1628] border border-green-500/30 rounded-2xl p-8 max-w-sm w-full text-center">
          {avatar && (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4 border-4 border-green-500"
              style={{ backgroundColor: avatar.color }}
            >
              {avatar.initials}
            </div>
          )}
          <div className="text-4xl mb-3">🎉</div>
          <h2 className="text-2xl font-bold text-white mb-2">Welcome aboard!</h2>
          <p className="text-white/60 text-sm mb-4">
            Your account is ready!{" "}
            <span className="text-green-400 font-semibold">GHS {bonusAmount} bonus</span> has been added to your wallet.
          </p>
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6">
            <p className="text-green-400 font-semibold text-sm">🎁 Sign-Up Bonus Credited</p>
            <p className="text-white text-2xl font-bold">+ GHS {bonusAmount}.00</p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href="/dashboard"
              className="block py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition"
            >
              Go to Dashboard
            </Link>
            <a
              href="https://chat.whatsapp.com/Gd7PcmtOoil5AxlPDrV3Q2"
              target="_blank"
              rel="noreferrer"
              className="block py-3 border border-white/20 hover:border-green-400 text-white rounded-xl transition text-sm"
            >
              Join WhatsApp Group
            </a>
          </div>
        </div>
      </main>
    );
  }

  // ─── SIGN UP FORM ─────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#050E1F] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-xl font-bold mx-auto mb-3">
            E
          </div>
          <h1 className="text-2xl font-bold text-white">Create Your Account</h1>
          <p className="text-white/40 text-sm mt-1">Get 5 GHS free on sign up</p>
        </div>

        {avatar && (
          <div className="flex justify-center mb-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white border-4 border-green-500 shadow-lg shadow-green-500/20"
              style={{ backgroundColor: avatar.color }}
            >
              {avatar.initials}
            </div>
          </div>
        )}

        <div className="bg-[#0A1628] border border-white/10 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {(
            [
              { name: "fullName", label: "Full Name *", placeholder: "Your full name", type: "text" },
              { name: "email", label: "Email Address *", placeholder: "you@example.com", type: "email" },
              { name: "phone", label: "Phone Number", placeholder: "e.g. 0244000000", type: "tel" },
              { name: "password", label: "Password *", placeholder: "Min. 6 characters", type: "password" },
              { name: "confirmPassword", label: "Confirm Password *", placeholder: "Repeat password", type: "password" },
              { name: "redeemCode", label: "Redeem Code (optional)", placeholder: "Enter code for bonus", type: "text" },
            ] as const
          ).map((field) => (
            <div key={field.name}>
              <label className="text-white/60 text-xs block mb-1">{field.label}</label>
              <input
                name={field.name}
                type={field.type}
                value={form[field.name]}
                onChange={handleChange}
                placeholder={field.placeholder}
                className="w-full bg-[#050E1F] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-green-500 focus:outline-none transition"
              />
            </div>
          ))}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold rounded-xl text-lg transition shadow-lg shadow-green-500/20 mt-2"
          >
            {loading ? "Creating Account..." : "Sign Up & Claim Bonus 🎁"}
          </button>

          <p className="text-center text-white/40 text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-green-400 hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}