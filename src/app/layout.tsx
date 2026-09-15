import type { Metadata } from "next";
import { Geist, Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Used only for the "pen." wordmark in the logo — the geometric weight
// matches the brand mark better than the app's own Geist UI font, which
// stays as-is everywhere else.
const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["700"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-50">
        {children}
      </body>
    </html>
  );
}
