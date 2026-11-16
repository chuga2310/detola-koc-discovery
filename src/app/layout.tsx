import type { Metadata } from "next";
import { Be_Vietnam_Pro, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const sans = Be_Vietnam_Pro({ variable: "--font-sans-vn", subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KOC Discovery — DETOLA assessment",
  description: "AI KOC discovery pipeline: funnel lọc số liệu -> AI text -> AI video -> xếp hạng có bằng chứng",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line bg-panel">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              KOC Discovery <span className="text-muted font-normal">/ DETOLA</span>
            </Link>
            <span className="text-xs text-muted">funnel: data → text AI → video AI → rank</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
