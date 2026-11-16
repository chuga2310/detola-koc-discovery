import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

// Be Vietnam Pro: font của design system DETOLA, hỗ trợ đầy đủ dấu tiếng Việt
const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "KOC Discovery",
  description: "Tìm KOC TikTok cho chiến dịch: lọc số liệu, phân tích nội dung và video bằng AI, đề xuất có bằng chứng.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${beVietnam.variable} h-full`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
