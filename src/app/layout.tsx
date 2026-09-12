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
  icons: {
    icon: "/DreamFrame.png",
    apple: "/DreamFrame.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${oxanium.variable} ${roboto.variable} ${geistMono.variable} h-full overflow-hidden antialiased`}
    >
      <body className="flex h-full min-h-full flex-col overflow-hidden">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
