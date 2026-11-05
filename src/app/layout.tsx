import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: { default: "2ndHandGuru — Buy & sell second-hand safely in Kenya", template: "%s · 2ndHandGuru" },
  description: "Kenya's second-hand marketplace with verified sellers and M-Pesa escrow buyer protection.",
};

export const viewport: Viewport = { themeColor: "#F5B800", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white antialiased">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
