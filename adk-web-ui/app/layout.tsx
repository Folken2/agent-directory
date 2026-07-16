import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SessionProvider from "@/components/providers/SessionProvider";
import PageViewTracker from "@/components/analytics/PageViewTracker";
import { Analytics } from "@vercel/analytics/next";

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

export const metadata: Metadata = {
  title: "ADK Agent Directory | Google AI Agent Development Kit | Gemini Agents",
  description: "Discover and interact with AI agents built on Google's Agent Development Kit (ADK). Explore specialized Google AI agents powered by Gemini 3 Flash.",
  keywords: [
    "Google AI",
    "Google agents AI",
    "Google ADK",
    "Google Agent Development Kit",
    "Google Advent of Agents",
    "Gemini",
    "Gemini AI",
    "Gemini agents",
    "AI Agents",
    "Agent Development Kit",
    "Artificial Intelligence",
    "Google AI platform",
    "ADK agents",
    "Google AI tools",
    "Gemini 3 Flash",
    "AI agent directory",
  ],
  authors: [{ name: "Google" }],
  creator: "Google",
  publisher: "Google",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://agentdirectory.folch.ai'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'ADK Agent Directory',
    title: 'ADK Agent Directory | Google AI Agent Development Kit | Gemini Agents',
    description: 'Discover and interact with AI agents built on Google\'s Agent Development Kit (ADK). Explore specialized Google AI agents powered by Gemini 3 Flash.',
    images: [
      {
        url: '/adk_logo.png',
        width: 1200,
        height: 630,
        alt: 'Google ADK Agent Directory - Google AI Agent Development Kit',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ADK Agent Directory | Google AI Agent Development Kit | Gemini Agents',
    description: 'Discover Google AI agents built on the Agent Development Kit (ADK). Explore Gemini-powered agents from Google Advent of Agents.',
    images: ['/adk_logo.png'],
    creator: '@Google',
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
    alternateName: 'Google ADK Agent Directory',
    url: baseUrl,
    description: 'Discover and interact with AI agents built on Google\'s Agent Development Kit (ADK). Explore specialized Google AI agents powered by Gemini 3 Flash.',
    publisher: {
      '@type': 'Organization',
      name: 'Google',
      url: 'https://www.google.com',
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    about: {
      '@type': 'Thing',
      name: 'Google AI Agent Development Kit',
      alternateName: ['Google ADK', 'Google Agent Development Kit', 'Google Advent of Agents'],
      description: 'Google\'s Agent Development Kit (ADK) for building AI agents powered by Gemini',
    },
    keywords: [
      'Google AI',
      'Google agents AI',
      'Google ADK',
      'Google Agent Development Kit',
      'Google Advent of Agents',
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
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
