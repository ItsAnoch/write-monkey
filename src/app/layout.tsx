import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextUIProvider } from "@nextui-org/system";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Write Monkey",
  description: "Writing Speed Test",
  viewport: "width=device-width, initial-scale=1.0"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en" className="bg-zinc-800">
        
        <head>
          {/* Light Mode */}
          <link rel="apple-touch-icon" sizes="180x180" href="/lightmode/apple-touch-icon.png" id="light-scheme-icon"/>
          <link rel="icon" type="image/png" sizes="32x32" href="/lightmode/favicon-32x32.png" id="light-scheme-icon"/>
          <link rel="icon" type="image/png" sizes="16x16" href="/lightmode/favicon-16x16.png" id="light-scheme-icon"/>
          <link rel="manifest" href="/lightmode/site.webmanifest" id="light-scheme-icon"/>

          <link rel="apple-touch-icon" sizes="180x180" href="/darkmode/apple-touch-icon.png" id="dark-scheme-icon"/>
          <link rel="icon" type="image/png" sizes="32x32" href="/darkmode/favicon-32x32.png" id="dark-scheme-icon"/>
          <link rel="icon" type="image/png" sizes="16x16" href="/darkmode/favicon-16x16.png" id="dark-scheme-icon"/>
          <link rel="manifest" href="/darkmode/site.webmanifest" id="dark-scheme-icon"/>
        </head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"></meta>
        <body className={inter.className}>{children}</body>
      </html>
  );
}
