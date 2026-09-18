import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BroAgent - AI Personal Education Agent",
  description: "An AI companion you can talk to when you don't know who to talk to.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
