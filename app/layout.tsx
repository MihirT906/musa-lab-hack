import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FieldReady",
  description: "Practice HVAC and electrical troubleshooting calls with an AI homeowner.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
