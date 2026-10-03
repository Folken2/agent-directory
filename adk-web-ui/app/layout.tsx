import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SessionProvider from "@/components/providers/SessionProvider";
import PageViewTracker from "@/components/analytics/PageViewTracker";
import CookieConsentBanner from "@/components/analytics/CookieConsentBanner";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import { Snackbar } from "@/components/ui/snackbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const googleSans = localFont({
  variable: "--font-google-sans",
  display: "swap",
  src: [{ path: "./fonts/GoogleSansFlex-latin.woff2", weight: "100 1000", style: "normal" }],
  fallback: ["Inter", "system-ui", "sans-serif"],
});

const googleSansCode = localFont({
  variable: "--font-google-sans-code",
  display: "swap",
  preload: false,
  src: [{ path: "./fonts/GoogleSansCode-latin.woff2", weight: "300 800", style: "normal" }],
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Resize the layout (and therefore 100dvh) when the on-screen keyboard opens
  // so the chat composer stays above the keyboard instead of being covered by it.
  interactiveWidget: "resizes-content",
};

const SITE_TITLE = "ADK Agent Directory | Design and try agents built with Google's Agent Development Kit";
const SITE_DESCRIPTION =
  "Describe the agent you want and an agent builder designs it with you using Google's Agent Development Kit (ADK). Try working example agents. Independent open-source project, not affiliated with Google.";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    "Agent Development Kit",
    "ADK",
    "ADK agents",
    "AI agent builder",
    "agent design",
    "multi-agent systems",
    "AI Agents",
    "Gemini",
    "AI agent examples",
  ],
  authors: [{ name: "Albert Folch" }],
  creator: "Albert Folch",
  publisher: "Albert Folch",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://agentdirectory.folch.ai'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'ADK Agent Directory',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add Google Search Console verification when available
    // google: 'your-verification-code',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://agentdirectory.folch.ai';
  
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'ADK Agent Directory',
    url: baseUrl,
    description: SITE_DESCRIPTION,
    publisher: { '@type': 'Person', name: 'Albert Folch' },
    about: {
      '@type': 'Thing',
      name: 'Agent Development Kit (ADK)',
      description: 'Open-source framework from Google for building AI agents',
    },
    keywords: ['Agent Development Kit', 'ADK', 'AI agent builder', 'AI Agents'],
  };

  return (
    <html lang="en" className={`${googleSans.variable} ${googleSansCode.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className="antialiased h-full flex flex-col"
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <ThemeProvider>
          <TooltipProvider>
            <SessionProvider>
              <Navigation />
              <main className="flex-1">
                {children}
              </main>
              <Footer />
              <Suspense fallback={null}>
                <PageViewTracker />
              </Suspense>
              <CookieConsentBanner />
            </SessionProvider>
          </TooltipProvider>
          <Snackbar />
        </ThemeProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
