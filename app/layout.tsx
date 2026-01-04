import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider, ToastContainer } from "@/components/Toast";
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
  title: "Freight Management Platform",
  description: "Ethiopian freight management and load board platform",
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
            <ToastProvider>
              {children}
              <ToastContainer />
            </ToastProvider>
          </CSRFProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
