// PATH: app/layout.tsx
//
// ── SETUP CHECKLIST ──────────────────────────────────────────────────────────
//  ✅ /public/hero.jpeg         → WhatsApp / OG preview image (min 1200×630px)
//  ✅ /public/favicon.ico       → browser tab icon
//  ✅ /public/icon-192.png      → PWA home screen icon (192×192)
//  ✅ /public/icon-512.png      → PWA splash icon (512×512)
//  ✅ /public/apple-icon.png    → iOS home screen icon (180×180)
//  ✅ /public/robots.txt        → crawler rules
//  ✅ /public/sitemap.xml       → Google sitemap
//  ✅ /public/manifest.json     → PWA manifest
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL  = "https://evergreenaset.com";
const SITE_NAME = "Evergreen Asset";
const TITLE     = "Evergreen Asset — Earn Daily Returns in Ghana 🇬🇭";
const DESC      = "Ghana's #1 daily investment platform. Buy a package from GHS 100, earn every day, and withdraw instantly via MTN MoMo. Get a FREE GHS 5 sign-up bonus!";
const OG_IMAGE  = `${SITE_URL}/hero.jpeg`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default:  TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESC,

  keywords: [
    "evergreen asset",
    "evergreen asset ghana",
    "investment platform ghana",
    "earn daily returns ghana",
    "daily income ghana",
    "momo investment ghana",
    "make money online ghana",
    "passive income ghana",
    "online investment ghana",
    "ghc daily earnings",
    "ghana fintech 2026",
    "accra investment app",
    "earn ghs daily",
    "referral income ghana",
    "mobile money investment",
  ],

  authors:   [{ name: SITE_NAME, url: SITE_URL }],
  creator:   SITE_NAME,
  publisher: SITE_NAME,
  category:  "Finance",

  alternates: { canonical: "/" },

  // WhatsApp, Facebook, Telegram, LinkedIn all use Open Graph
  openGraph: {
    type:        "website",
    locale:      "en_GH",
    url:         SITE_URL,
    siteName:    SITE_NAME,
    title:       TITLE,
    description: DESC,
    images: [
      {
        url:    OG_IMAGE,
        width:  1200,
        height: 630,
        alt:    `${SITE_NAME} — Earn Daily Returns in Ghana`,
        type:   "image/jpeg",
      },
    ],
  },

  twitter: {
    card:        "summary_large_image",
    title:       TITLE,
    description: DESC,
    images:      [OG_IMAGE],
    creator:     "@evergreenasset",
  },

  icons: {
    icon: [
      { url: "/favicon.ico",  sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple:    [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.ico",
  },

  applicationName: SITE_NAME,
  manifest:        "/manifest.json",
  appleWebApp: {
    capable:        true,
    title:          SITE_NAME,
    statusBarStyle: "black-translucent",
  },

  robots: {
    index:  true,
    follow: true,
    googleBot: {
      index:               true,
      follow:              true,
      "max-image-preview": "large",
      "max-snippet":       -1,
    },
  },

  // Uncomment and paste your codes when ready:
  // verification: {
  //   google: "YOUR_GOOGLE_SEARCH_CONSOLE_CODE",
  //   other:  { "msvalidate.01": "YOUR_BING_CODE" },
  // },
};

export const viewport: Viewport = {
  themeColor:   "#050E1F",
  width:        "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>

        {/* ── WhatsApp OG tags — must be hardcoded in <head> HTML ───────────
            WhatsApp's crawler does NOT always respect Next.js metadata,
            so these explicit tags guarantee the hero.jpeg shows up.        */}
        <meta property="og:image"            content={OG_IMAGE} />
        <meta property="og:image:secure_url" content={OG_IMAGE} />
        <meta property="og:image:type"       content="image/jpeg" />
        <meta property="og:image:width"      content="1200" />
        <meta property="og:image:height"     content="630" />
        <meta property="og:image:alt"        content={`${SITE_NAME} — Earn Daily Returns in Ghana`} />
        <meta property="og:title"            content={TITLE} />
        <meta property="og:description"      content={DESC} />
        <meta property="og:url"              content={SITE_URL} />
        <meta property="og:site_name"        content={SITE_NAME} />
        <meta property="og:type"             content="website" />
        <meta property="og:locale"           content="en_GH" />

        {/* ── Structured Data (JSON-LD) — boosts Google rich results ──── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id":   `${SITE_URL}/#org`,
                  name:    SITE_NAME,
                  url:     SITE_URL,
                  logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png` },
                  image:   OG_IMAGE,
                  description: "International investment platform operating in Ghana since 2026.",
                  contactPoint: {
                    "@type":           "ContactPoint",
                    telephone:         "+12899082443",
                    contactType:       "customer support",
                    availableLanguage: ["English"],
                  },
                  sameAs: ["https://chat.whatsapp.com/Gd7PcmtOoil5AxlPDrV3Q2"],
                },
                {
                  "@type":     "WebSite",
                  "@id":       `${SITE_URL}/#site`,
                  url:         SITE_URL,
                  name:        SITE_NAME,
                  description: DESC,
                  publisher:   { "@id": `${SITE_URL}/#org` },
                  inLanguage:  "en-GH",
                },
                {
                  "@type":     "WebPage",
                  "@id":       `${SITE_URL}/#page`,
                  url:         SITE_URL,
                  name:        TITLE,
                  description: DESC,
                  isPartOf:    { "@id": `${SITE_URL}/#site` },
                  about:       { "@id": `${SITE_URL}/#org` },
                  inLanguage:  "en-GH",
                  image: { "@type": "ImageObject", url: OG_IMAGE, width: 1200, height: 630 },
                },
                {
                  "@type":       "FinancialService",
                  name:          SITE_NAME,
                  url:           SITE_URL,
                  image:         OG_IMAGE,
                  description:   "Earn daily returns on your investment. Packages from GHS 100. Withdraw via MTN MoMo.",
                  priceRange:    "GHS 100 – GHS 3000",
                  areaServed:    { "@type": "Country", name: "Ghana" },
                  offers: {
                    "@type":       "AggregateOffer",
                    priceCurrency: "GHS",
                    lowPrice:      "100",
                    highPrice:     "3000",
                    offerCount:    "10",
                    description:   "Investment packages with daily earnings",
                  },
                },
                {
                  "@type": "FAQPage",
                  mainEntity: [
                    {
                      "@type": "Question",
                      name:    "How do I start earning on Evergreen Asset?",
                      acceptedAnswer: {
                        "@type": "Answer",
                        text:    "Sign up free, claim your GHS 5 welcome bonus, deposit via MTN MoMo from GHS 100, and start earning daily returns as soon as your deposit is confirmed.",
                      },
                    },
                    {
                      "@type": "Question",
                      name:    "How do I withdraw my earnings?",
                      acceptedAnswer: {
                        "@type": "Answer",
                        text:    "Withdrawals are processed Monday–Saturday 9am–4pm via MTN Mobile Money. A 10% service fee applies. Minimum withdrawal is GHS 45.",
                      },
                    },
                    {
                      "@type": "Question",
                      name:    "Is Evergreen Asset safe and legit?",
                      acceptedAnswer: {
                        "@type": "Answer",
                        text:    "Yes. Evergreen Asset is an international platform that launched in Senegal (2024), expanded to Nigeria (2025), and Ghana in 2026 with planned operations of 365–800 days.",
                      },
                    },
                    {
                      "@type": "Question",
                      name:    "Can I earn by referring friends?",
                      acceptedAnswer: {
                        "@type": "Answer",
                        text:    "Yes! Earn 7% on Level 1 (direct) referrals, 2% on Level 2, and 1% on Level 3 every time they make a deposit.",
                      },
                    },
                    {
                      "@type": "Question",
                      name:    "What is the minimum investment?",
                      acceptedAnswer: {
                        "@type": "Answer",
                        text:    "The minimum investment package starts at GHS 100 with daily returns credited to your wallet every day.",
                      },
                    },
                  ],
                },
              ],
            }),
          }}
        />

        {/* ── Performance ──────────────────────────────────────────────── */}
        <link rel="preconnect"   href="https://fonts.googleapis.com" />
        <link rel="preconnect"   href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://supabase.co" />

      </head>
      <body>{children}</body>
    </html>
  );
}