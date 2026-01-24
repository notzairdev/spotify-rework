import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { Providers } from "@/components/wrapped/providers";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const fontMono = Inter({subsets:['latin'],variable:'--font-mono'});

export const metadata: Metadata = {
  title: "Spotify Rework",
  description: "A Spotify UI rework",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body
        className={`antialiased ${fontMono.variable}`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
