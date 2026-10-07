import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ApparelFlow ERP | Production Control",
  description: "Cutting operations, component verification, and sewing queue control.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
