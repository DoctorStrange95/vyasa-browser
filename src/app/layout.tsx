import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import Header from "@/components/Header";
import GlobalSidebar from "@/components/GlobalSidebar";
import Footer from "@/components/Footer";
import FeedbackButton from "@/components/FeedbackButton";
import FacilityDrawer from "@/components/FacilityDrawer";
import CookieConsent from "@/components/CookieConsent";
import SignInPrompt from "@/components/SignInPrompt";
import FeedbackWidget from "@/components/FeedbackWidget";
import { getUserSession } from "@/lib/userAuth";
import PageTracker from "@/components/PageTracker";
import PWASetup from "@/components/PWASetup";
import { getSiteConfig } from "@/lib/siteConfig";

const BASE_URL = "https://healthforindia.vyasa.health";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  themeColor: "#0d9488",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "India's Public Health Transparency Platform",
    template: "%s | Vyasa",
  },
  description:
    "District-level public health data for every Indian state and UT — infant mortality, vaccination coverage, disease outbreaks, hospital infrastructure, nutrition and air quality. Powered by NFHS-5, SRS 2023, IDSP and MoHFW.",
  keywords: [
    "India public health data", "district health statistics India", "IMR India",
    "infant mortality rate India state wise", "NFHS-5 data India", "IDSP outbreak report India",
    "vaccination coverage India state wise", "hospital infrastructure India district",
    "India disease surveillance IDSP", "MoHFW data portal", "SRS 2023 India state",
    "Ayushman Bharat hospital list", "state health ranking India", "public health dashboard India",
    "India health statistics comparison", "infant mortality rate by state India 2023",
    "PHC CHC district India", "air quality index India cities", "health score India state",
  ],
  authors: [{ name: "Vyasa Health", url: BASE_URL }],
  creator: "Vyasa Health",
  publisher: "Vyasa Health",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: BASE_URL,
    siteName: "Vyasa — India's Public Health Transparency Platform",
    title: "India's Public Health Transparency Platform",
    description:
      "Real-time district-level health data across 36 states and UTs. IMR, vaccination, disease outbreaks, hospital beds, air quality — all in one place.",
    images: [{ url: "/og?title=India%27s+Public+Health+Transparency+Platform", width: 1200, height: 630, alt: "Vyasa Dashboard" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@VyasaHealth",
    creator: "@VyasaHealth",
    title: "India's Public Health Transparency Platform",
    description:
      "Real-time district-level health data across 36 states and UTs. IMR, vaccination, disease outbreaks, hospital beds, air quality.",
    images: ["/og?title=India%27s+Public+Health+Transparency+Platform"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  alternates: { canonical: BASE_URL },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, uiConfig] = await Promise.all([getUserSession(), getSiteConfig()]);
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Vyasa",
            "alternateName": "India's Public Health Transparency Platform",
            "url": BASE_URL,
            "description": "India's largest open public health data platform — district-level IMR, vaccination, disease outbreaks, hospital infrastructure across 36 states and 700+ districts.",
            "potentialAction": {
              "@type": "SearchAction",
              "target": { "@type": "EntryPoint", "urlTemplate": `${BASE_URL}/state/{state_slug}` },
              "query-input": "required name=state_slug",
            },
            "publisher": {
              "@type": "Organization",
              "name": "Vyasa Health",
              "url": BASE_URL,
              "logo": { "@type": "ImageObject", "url": `${BASE_URL}/icons/icon.svg` },
            },
          }) }}
        />
        {/* PWA */}
        <meta name="application-name" content="Vyasa" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Vyasa" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
      </head>
      <body>
        <Header user={session} uiConfig={uiConfig} />
        <div style={{ height: "64px", flexShrink: 0 }} />
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <Suspense fallback={null}>
            <GlobalSidebar user={session} uiConfig={uiConfig} />
          </Suspense>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: "calc(100vh - 64px)" }}>
            <main style={{ flex: 1 }}>{children}</main>
            <Footer />
          </div>
        </div>
        <PageTracker />
        <PWASetup />
        <FeedbackButton />
        <FacilityDrawer />
        <CookieConsent />
        <SignInPrompt isLoggedIn={!!session} />
        <FeedbackWidget user={session ? { name: session.name, email: session.email } : null} />
      </body>
    </html>
  );
}
