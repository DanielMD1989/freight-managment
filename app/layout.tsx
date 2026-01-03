import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider, ToastContainer } from "@/components/Toast";
import CSRFProvider from "@/components/CSRFProvider";

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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <CSRFProvider>
          <ToastProvider>
            {children}
            <ToastContainer />
          </ToastProvider>
        </CSRFProvider>
      </body>
    </html>
  );
}
