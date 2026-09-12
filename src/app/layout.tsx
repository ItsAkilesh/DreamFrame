import type { Metadata } from "next";
import { Oxanium, Roboto, Geist_Mono } from "next/font/google";
import "./globals.css";

import { TooltipProvider } from "@/components/ui/tooltip";

const oxanium = Oxanium({
  subsets: ["latin"],
  variable: "--font-oxanium",
});

const roboto = Roboto({
  subsets: ["latin"],
  variable: "--font-roboto",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "DreamFrame",
  description: "AI simulation and decision-support tool for writers and directors.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${oxanium.variable} ${roboto.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
