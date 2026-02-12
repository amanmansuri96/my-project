import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agent Ranker — Aspora CX",
  description: "CX Agent Performance Leaderboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav className="border-b bg-white">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
            <a href="/dashboard" className="font-bold text-lg text-gray-900">
              Aspora Agent Ranker
            </a>
            <div className="flex items-center gap-6 text-sm">
              <a href="/dashboard" className="text-gray-600 hover:text-gray-900">
                Leaderboard
              </a>
              <a href="/settings" className="text-gray-600 hover:text-gray-900">
                Settings
              </a>
            </div>
          </div>
        </nav>
        <main className="min-h-screen bg-gray-50">{children}</main>
      </body>
    </html>
  );
}
