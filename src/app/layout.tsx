import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oceans Prayer Globe",
  description: "An interactive prayer globe showing connections around the world",
};

export const viewport: Viewport = {
  viewportFit: "cover",
};

const geist = Geist({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-geist",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
