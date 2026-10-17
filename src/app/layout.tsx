import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, Bowlby_One, Permanent_Marker, Space_Mono } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

// Design doc Part 3 typography: display, UI labels, body, handwritten marker, evidence mono.
const display = Bowlby_One({ weight: "400", subsets: ["latin"], display: "swap", variable: "--nf-display" });
const ui = Barlow_Condensed({ weight: ["600", "800"], subsets: ["latin"], display: "swap", variable: "--nf-ui" });
const body = Barlow({ weight: ["400", "600"], subsets: ["latin"], display: "swap", variable: "--nf-body" });
const marker = Permanent_Marker({ weight: "400", subsets: ["latin"], display: "swap", variable: "--nf-marker" });
const mono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], display: "swap", variable: "--nf-mono" });

export const metadata: Metadata = {
  title: "Caught Watching",
  description: "we read your youtube history. then we roast you for it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${ui.variable} ${body.variable} ${marker.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
