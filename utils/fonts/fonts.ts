import localFont from "@next/font/local";
import { Creepster, Jolly_Lodger } from "@next/font/google";

// Google Fonts
export const creepster = Creepster({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-creepster",
});

export const jollyLodger = Jolly_Lodger({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-jolly",
});

// Local Shadow of the Dead font (inside utils/fonts)
export const shadow = localFont({
  src: "./shadow-of-the-dead.ttf", // ✅ relative path
  variable: "--font-shadow",
});
