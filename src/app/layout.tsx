import type { Metadata } from "next";
import { Geist, Geist_Mono, Mali, Sarabun } from "next/font/google";
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

// Thai document typeface (Sarabun family, as used in Thai official documents) for printed reports
const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["400", "600", "700"],
});

// Rounded Thai typeface for the kids UI (.theme-kids, docs/KIDS-ART-UI.md)
const mali = Mali({
  variable: "--font-mali",
  subsets: ["thai", "latin"],
  weight: ["500", "700"],
});

// Favicon: src/app/icon.svg (the mascot)
export const metadata: Metadata = {
  title: "AI Physio Kids — ยืด ขยับ แข็งแรง",
  description:
    "เกมยืดเหยียดสำหรับเด็กผ่านกล้อง AI ช่วยดูท่าทางแบบ Real-time เพื่อดูแลและป้องกันปัญหาท่าทาง สำหรับเด็ก ผู้ปกครอง และคุณครู",
  keywords: ["ยืดเหยียด", "เด็ก", "ท่าทาง", "AI Physio Kids", "Pose Estimation", "MediaPipe", "โรงเรียน"],
  openGraph: {
    title: "AI Physio Kids — ยืด ขยับ แข็งแรง",
    description: "เด็กเล่นยืดเหยียดกับน้องยืด กล้อง AI ช่วยดูท่า คุณครูให้ภารกิจ ผู้ปกครองติดตามผล",
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
        className={`${geistSans.variable} ${geistMono.variable} ${sarabun.variable} ${mali.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}