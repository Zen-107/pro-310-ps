import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Physio — กายภาพบำบัดอัจฉริยะ",
  description:
    "ระบบกายภาพบำบัดผ่านเว็บแคมด้วย AI ตรวจจับท่าทาง คำนวณมุมข้อต่อ และให้ Feedback แบบ Real-time",
  keywords: [
    "กายภาพบำบัด",
    "AI Physio",
    "Physical Therapy",
    "Pose Estimation",
    "MediaPipe",
    "Rehabilitation",
  ],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "AI Physio — กายภาพบำบัดอัจฉริยะ",
    description:
      "นำ Computer Vision และ AI มาช่วยกายภาพบำบัดที่บ้าน ตรวจจับท่าทาง คำนวณมุมข้อต่อ ให้ Feedback แบบ Real-time",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}