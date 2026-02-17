import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import CSRFProvider from "@/components/CSRFProvider";
import { ThemeProvider } from "@/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "FreightHub - Ethiopian Freight Platform",
    template: "%s | FreightHub",
  },
  description:
    "Ethiopian freight management and load board platform - Connect shippers with carriers seamlessly",
  keywords: [
    "freight",
    "logistics",
    "Ethiopia",
    "shipping",
    "carriers",
    "load board",
    "trucking",
  ],
  authors: [{ name: "FreightHub" }],
  icons: {
    icon: [{ url: "/icon", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <CSRFProvider>
            {children}
            <Toaster position="top-right" />
          </CSRFProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
