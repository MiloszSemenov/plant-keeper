import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import { themeCssVariables } from "@/lib/design-tokens";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-display"
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "Plant Keeper",
  description: "Manage shared plant spaces, watering schedules, and plant identification in one calm dashboard."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${newsreader.variable} ${plusJakartaSans.variable}`}
        style={themeCssVariables as CSSProperties}
      >
        {children}
      </body>
    </html>
  );
}
