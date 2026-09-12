import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Default bottom-left position sits on top of the Editor View's timeline
  // transport controls (also bottom-left) in dev mode.
  devIndicators: {
    position: "top-left",
  },
};

export default nextConfig;
