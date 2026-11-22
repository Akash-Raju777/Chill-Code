import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import NavigationProgressBar from "@/components/NavigationProgressBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chill Code - AI Coding Assessment Platform",
  description: "AI Powered Coding Assessment and Evaluation Platform",
  icons: {
    icon: "/Logobg.png",
    shortcut: "/Logobg.png",
    apple: "/Logobg.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ backgroundColor: '#0b0c10', color: '#c5c6c7' }}
    >
      <head>
        <link rel="preload" href="/Logobg.png" as="image" type="image/png" />
        <style dangerouslySetInnerHTML={{
          __html: `
            html, body {
              background-color: #0b0c10 !important;
              color: #c5c6c7 !important;
              margin: 0;
              padding: 0;
            }
          `
        }} />
      </head>
      <body
        className="min-h-full flex flex-col bg-[#0b0c10] text-[#c5c6c7]"
        style={{ backgroundColor: '#0b0c10', color: '#c5c6c7' }}
      >
        <Suspense fallback={null}>
          <NavigationProgressBar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
