import "./globals.css";
import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import LanguageInit from "@/components/shared/LanguageInit";

export const metadata: Metadata = {
  title: "BroAgent - Your Personal AI Assistant",
  description: "Think, learn, research, create, and get things done with one AI assistant.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <LanguageInit />
        {children}
      </body>
    </html>
  );
}
