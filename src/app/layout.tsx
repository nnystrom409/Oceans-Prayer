import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oceans Prayer Globe",
  description: "An interactive prayer globe showing connections around the world",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
