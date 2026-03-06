// PATH: app/deposit/page.tsx

"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Package        = { id: string; amount: number; daily_earnings: number; duration_days: number; active: boolean };
type PaymentSetting = { id: string; account_number: string; account_name: string; network: string; active: boolean };

export default function DepositPage() {
  const [userId, setUserId]               = useState<string | null>(null);
  const [packages, setPackages]           = useState<Package[]>([]);
  const [payment, setPayment]             = useState<PaymentSetting | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [file, setFile]                   = useState<File | null>(null);
  const [preview, setPreview]             = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);
  const [submitting, setSubmitting]       = useState(false);
  const [success, setSuccess]             = useState(false);
  const [error, setError]                 = useState("");

  useEffect(() => {
    async function init() {
      // Get current session — required for storage upload auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { window.location.href = "/login"; return; }
      setUserId(session.user.id);

      const [pkgRes, payRes] = await Promise.all([
        supabase.from("packages").select("*").eq("active", true).order("amount", { ascending: true }),
        supabase.from("payment_settings").select("*").eq("active", true).maybeSingle(),
      ]);

      const pkgs: Package[] = pkgRes.data || [];
      setPackages(pkgs);
      setPayment(payRes.data || null);

      // Pre-select package from URL param
      const pkgAmount = parseInt(new URLSearchParams(window.location.search).get("package") || "");
      if (pkgAmount) {
        const found = pkgs.find(p => p.amount === pkgAmount);
        if (found) setSelectedPackage(found);
      }

      setLoading(false);
    }
    init();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // Validate file type
    if (!f.type.startsWith("image/")) { setError("Please upload an image file (JPG, PNG, WEBP)."); return; }
    // Validate file size (max 5MB)
    if (f.size > 5 * 1024 * 1024) { setError("File too large. Maximum size is 5MB."); return; }
    setError("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!selectedPackage) { setError("Please select a package."); return; }
    if (!file) { setError("Please upload your payment screenshot."); return; }
    if (!userId) { setError("Session expired. Please log in again."); return; }

    setSubmitting(true);
    setError("");

    try {
      // Re-check session before upload — important!
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Your session expired. Please log in again.");
        setTimeout(() => window.location.href = "/login", 2000);
        return;
      }

      // Build a clean filename
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filename = `deposits/${userId}-${Date.now()}.${ext}`;

      // Upload to Supabase storage bucket "green"
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("green")
        .upload(filename, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        // Provide a clear error based on the code
        if (uploadError.message.includes("row-level security") || uploadError.message.includes("policy")) {
          setError("Storage permission denied. Please ask admin to run supabase-storage-fix.sql in the SQL editor.");
        } else if (uploadError.message.includes("Bucket not found")) {
          setError('Bucket "green" not found. Please create it in Supabase Storage and run supabase-storage-fix.sql.');
        } else {
          setError("Upload failed: " + uploadError.message);
        }
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage.from("green").getPublicUrl(filename);

      // Insert deposit record
      const { error: depositError } = await supabase.from("deposits").insert({
        user_id: userId,
        amount: selectedPackage.amount,
        daily_earnings: selectedPackage.daily_earnings,
        screenshot_url: publicUrl,
        status: "pending",
      });

      if (depositError) throw depositError;

      // Send notification
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "📨 Deposit Request Received",
        message: `Your deposit of GHS ${selectedPackage.amount} is under review and will be confirmed within 24 hours.`,
        type: "deposit",
      });

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#050E1F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Success ────────────────────────────────────────────────────────────────
  if (success) {
    return (
      <main className="min-h-screen bg-[#050E1F] flex items-center justify-center px-4">
        <div className="bg-[#0A1628] border border-green-500/30 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-white mb-2">Deposit Submitted!</h2>
          <p className="text-white/60 text-sm mb-2">
            Your screenshot was received. Our team will confirm your{" "}
            <span className="text-green-400 font-bold">GHS {selectedPackage?.amount}</span> deposit within 24 hours.
          </p>
          <div className="bg-[#050E1F] rounded-xl p-3 my-4 text-xs text-white/40">
            You will get a notification once approved.
          </div>
          <p className="text-white/40 text-xs mb-6">
            Need help?<br />+1 (289) 908-2443 · +1 (343) 443-6208
          </p>
          <Link href="/dashboard" className="block w-full py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  // ─── Main ───────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#050E1F] text-white pb-16">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <Link href="/dashboard" className="text-white/50 hover:text-white transition text-xl leading-none">←</Link>
        <h1 className="text-lg font-bold">Make a Deposit</h1>
      </div>

      <div className="px-4 py-6 max-w-xl mx-auto space-y-6">

        {/* PAYMENT ACCOUNT */}
        {payment ? (
          <div className="bg-[#0A1628] border border-green-500/20 rounded-2xl p-5">
            <p className="text-white/40 text-xs mb-4 uppercase tracking-widest font-semibold">Send Payment To</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💳</span>
                <div>
                  <p className="text-white/40 text-xs">Account Number</p>
                  <p className="font-mono font-bold text-2xl tracking-wider">{payment.account_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">👤</span>
                <div>
                  <p className="text-white/40 text-xs">Account Name</p>
                  <p className="font-semibold text-lg">{payment.account_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏦</span>
                <div>
                  <p className="text-white/40 text-xs">Network</p>
                  <p className="font-semibold text-yellow-400">{payment.network}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-green-400 text-xs text-center">
              ✅ Deposits accepted 24/7 · Minimum: GHS 100
            </div>
          </div>
        ) : (
          <div className="bg-[#0A1628] border border-orange-500/20 rounded-2xl p-5 text-orange-400 text-sm text-center">
            ⚠️ Payment account not set up yet. Contact admin.
          </div>
        )}

        {/* SELECT PACKAGE */}
        <div>
          <p className="text-white/60 text-sm font-semibold mb-3">Select a Package</p>
          {packages.length === 0 ? (
            <p className="text-white/30 text-sm">No packages available. Contact admin.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => { setSelectedPackage(pkg); setError(""); }}
                  className={`rounded-xl p-4 border cursor-pointer transition select-none ${
                    selectedPackage?.id === pkg.id
                      ? "border-green-500 bg-green-500/10 shadow-lg shadow-green-500/10"
                      : "border-white/10 bg-[#0A1628] hover:border-white/30"
                  }`}
                >
                  <p className="font-bold text-white">GHS {pkg.amount}</p>
                  <p className={`text-sm font-semibold ${selectedPackage?.id === pkg.id ? "text-green-400" : "text-white/50"}`}>
                    GHS {pkg.daily_earnings}/day
                  </p>
                  <p className="text-white/30 text-xs mt-0.5">⏱ {pkg.duration_days || 30} days</p>
                  {selectedPackage?.id === pkg.id && (
                    <p className="text-green-400 text-xs mt-1 font-semibold">✓ Selected</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* UPLOAD SCREENSHOT */}
        <div>
          <p className="text-white/60 text-sm font-semibold mb-3">Upload Payment Screenshot</p>
          <label className="block border-2 border-dashed border-white/20 hover:border-green-500/50 rounded-2xl p-6 cursor-pointer transition text-center">
            {preview ? (
              <div>
                <img src={preview} alt="Preview" className="max-h-56 mx-auto rounded-xl object-contain mb-2" />
                <p className="text-green-400 text-xs">Tap to change image</p>
              </div>
            ) : (
              <div>
                <p className="text-5xl mb-3">📸</p>
                <p className="text-white/60 text-sm font-medium">Tap to upload screenshot</p>
                <p className="text-white/30 text-xs mt-1">JPG, PNG or WEBP · Max 5MB</p>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </label>
        </div>

        {/* SUMMARY */}
        {selectedPackage && (
          <div className="bg-[#0A1628] border border-white/10 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Package</span>
              <span className="font-bold">GHS {selectedPackage.amount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Daily Earnings</span>
              <span className="text-green-400 font-bold">GHS {selectedPackage.daily_earnings}/day</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Duration</span>
              <span>{selectedPackage.duration_days || 30} days</span>
            </div>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* SUBMIT */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !selectedPackage || !file || !payment}
          className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:opacity-40 text-black font-bold rounded-xl text-lg transition shadow-lg shadow-green-500/20"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Uploading...
            </span>
          ) : (
            "Submit Deposit Request ✅"
          )}
        </button>

        <p className="text-white/30 text-xs text-center pb-4">
          Manually reviewed · Approval within 24 hours<br />
          Questions? WhatsApp: +1 (289) 908-2443
        </p>
      </div>
    </main>
  );
}