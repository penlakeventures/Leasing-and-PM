import type { Metadata } from "next";
import { Geist, Geist_Mono, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Fallback for the "pen." wordmark in the logo, used wherever the real
// brand typeface (Avenir Next Condensed — a licensed font, so it's tried
// by name first in logo.tsx rather than loaded here) isn't installed.
// Barlow Condensed is the closest free equivalent's proportions; stays
// out of the app's own Geist UI font everywhere else.
const barlowCondensed = Barlow_Condensed({
  variable: "--font-logo",
  weight: ["500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pen Lake Ventures — Leasing & PM",
  description: "Internal leasing and property management system",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-50">
        {children}
      </body>
    </html>
  );
}
