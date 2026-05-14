import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Noto_Sans } from "next/font/google";
import { cn } from "@/lib/utils";

const notoSans = Noto_Sans({subsets:['latin'],variable:'--font-sans'});

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "문서봇 — AI 실무 문서 작성 도구",
  description: "기획서, 제안서, 보고서를 AI와 함께 완성하세요. 목차부터 본문까지, 문서봇이 단계별로 안내합니다.",
  openGraph: {
    title: "문서봇 — AI 실무 문서 작성 도구",
    description: "기획서, 제안서, 보고서를 AI와 함께 완성하세요. 목차부터 본문까지, 문서봇이 단계별로 안내합니다.",
    url: "https://docbot.vercel.app",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "문서봇 — AI 실무 문서 작성 도구",
    description: "기획서, 제안서, 보고서를 AI와 함께 완성하세요. 목차부터 본문까지, 문서봇이 단계별로 안내합니다.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", notoSans.variable)}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
