import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

// Archivo variable: trục wdth (62–125) cho phép 1 họ chữ vừa là chữ UI vừa là chữ condensed
// cho số thứ hạng / handle / con dấu verdict — phân cấp bằng độ rộng thay vì đổi font.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "vietnamese"],
  axes: ["wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "KOC Discovery",
  description: "Tìm KOC TikTok cho chiến dịch: lọc số liệu, phân tích nội dung và video bằng AI, đề xuất có bằng chứng.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${archivo.variable} h-full`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
