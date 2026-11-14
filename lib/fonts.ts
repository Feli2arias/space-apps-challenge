import { GeistMono } from "geist/font/mono";
import { GeistPixelSquare } from "geist/font/pixel/square";
import { GeistSans } from "geist/font/sans";

/**
 * Fonts ship with the `geist` package, so the build never depends on a font CDN.
 * Each one exposes a CSS variable that the tokens in `app/globals.css` pick up.
 */
export const fontVariables = [
  GeistSans.variable,
  GeistMono.variable,
  GeistPixelSquare.variable,
].join(" ");
