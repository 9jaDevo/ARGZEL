import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./experience-polish.css";
import "./voice-flow.css";
import "./final-polish.css";
export const metadata: Metadata = {
  title: "ARGZEL — A little less on your mind.",
  description:
    "Speak it. Confirm it. Remember it. A premium voice reminder experience.",
  icons: { apple: "/brand/argzel-apple-touch.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f8f9fb",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
