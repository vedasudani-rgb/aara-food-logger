import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aara — Food Logger",
  description: "Voice-first, guilt-free food logging for South Indian meals",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ backgroundColor: "#FBF7F0" }}>
        <main className="mx-auto max-w-md min-h-screen relative">
          {children}
        </main>
      </body>
    </html>
  );
}
