import type { Metadata, Viewport } from "next";
import "./style.css";
export const metadata: Metadata = {
  title: "Hong Kong Companion | رفيق هونج كونج",
  description: "رفيقك الشخصي لرحلة هونج كونج",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HK Companion",
  },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};
export const viewport: Viewport = { themeColor: "#f8f7f4" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar-EG" dir="rtl" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
