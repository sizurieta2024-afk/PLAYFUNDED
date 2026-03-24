import { DM_Serif_Display, Syne, Manrope, DM_Mono } from "next/font/google";
import localFont from "next/font/local";
import { AuthHashSessionHandler } from "@/components/auth/AuthHashSessionHandler";
import "./globals.css";

const dmSerifDisplay = DM_Serif_Display({
  subsets: ["latin"],
  variable: "--font-dm-serif",
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-dm-mono",
  weight: ["300", "400", "500"],
  display: "swap",
});

// Keep Geist Mono as fallback for monospace
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning className="dark">
      <body
        className={`${dmSerifDisplay.variable} ${syne.variable} ${manrope.variable} ${dmMono.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <AuthHashSessionHandler />
        {children}
      </body>
    </html>
  );
}
