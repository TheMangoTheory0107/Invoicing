import type { Metadata } from "next";
import "./globals.css";
import DisableNumberInputScroll from "@/components/DisableNumberInputScroll";

export const metadata: Metadata = {
  title: "THE MANGO THEORY Invoicing",
  description: "Invoicing, registers and reconciliation for THE MANGO THEORY",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <DisableNumberInputScroll />
        {children}
      </body>
    </html>
  );
}
