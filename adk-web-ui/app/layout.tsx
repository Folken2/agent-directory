import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SessionProvider from "@/components/providers/SessionProvider";
import PageViewTracker from "@/components/analytics/PageViewTracker";
import CookieConsentBanner from "@/components/analytics/CookieConsentBanner";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";

// Google Sans is not available via next/font/google, so we use Inter as the closest alternative
// Inter is Google's recommended open-source alternative with similar characteristics
const inter = Inter({
  variable: "--font-google-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Roboto Mono for code snippets
const robotoMono = Inter({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Resize the layout (and therefore 100dvh) when the on-screen keyboard opens
  // so the chat composer stays above the keyboard instead of being covered by it.
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: "ADK Agent Directory | AI agents built with Google's Agent Development Kit",
  description: "Discover and interact with AI agents built on Google's Agent Development Kit (ADK). Explore specialized AI agents powered by Gemini 3 Flash. Independent project, not affiliated with Google.",
  keywords: [
    "Google AI",
    "Google ADK",
    "Google Agent Development Kit",
    "Gemini",
    "Gemini AI",
    "Gemini agents",
    "AI Agents",
    "Agent Development Kit",
    "Artificial Intelligence",
    "ADK agents",
    "Gemini 3 Flash",
    "AI agent directory",
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
    title: 'ADK Agent Directory | AI agents built with Google\'s Agent Development Kit',
    description: 'Discover and interact with AI agents built on Google\'s Agent Development Kit (ADK). Explore specialized AI agents powered by Gemini 3 Flash. Independent project, not affiliated with Google.',
    images: [
      {
        url: '/adk_logo.png',
        width: 1200,
        height: 630,
        alt: 'ADK Agent Directory - built with Google\'s Agent Development Kit',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ADK Agent Directory | AI agents built with Google\'s Agent Development Kit',
    description: 'Discover AI agents built with Google\'s Agent Development Kit (ADK) and Gemini. Independent project, not affiliated with Google.',
    images: ['/adk_logo.png'],
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
  icons: {
    icon: '/adk_logo.png',
    apple: '/adk_logo.png',
    shortcut: '/adk_logo.png',
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
    description: 'Discover and interact with AI agents built on Google\'s Agent Development Kit (ADK). Explore specialized AI agents powered by Gemini 3 Flash. Independent project, not affiliated with Google.',
    publisher: { '@type': 'Person', name: 'Albert Folch' },
    about: {
      '@type': 'Thing',
      name: 'Google AI Agent Development Kit',
      alternateName: ['Google ADK', 'Google Agent Development Kit'],
      description: 'Google\'s Agent Development Kit (ADK) for building AI agents powered by Gemini',
    },
    keywords: [
      'Google AI',
      'Google ADK',
      'Google Agent Development Kit',
      'Gemini',
      'Gemini AI',
      'AI Agents',
    ],
  };

  return (
    <html lang="en" className="h-full">
      <body
        className={`${inter.variable} ${robotoMono.variable} antialiased h-full flex flex-col`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
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
        <GoogleAnalytics />
      </body>
    </html>
  );
}
