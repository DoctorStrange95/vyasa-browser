import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vyasa Integrated Healthcare",
    short_name: "Vyasa",
    description: "District-level public health data for every Indian state and UT — IMR, vaccination, disease outbreaks, hospital infrastructure and more.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#070f1e",
    theme_color: "#0d9488",
    categories: ["health", "medical", "government"],
    lang: "en-IN",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/og-default.png",
        sizes: "1200x630",
        type: "image/png",
      },
    ],
    shortcuts: [
      {
        name: "Find Hospital",
        short_name: "Hospitals",
        description: "Find Ayushman empanelled hospitals near you",
        url: "/citizens?tab=hospitals",
        icons: [{ src: "/icons/icon.svg", sizes: "any" }],
      },
      {
        name: "Disease Outbreaks",
        short_name: "Outbreaks",
        description: "Latest IDSP disease surveillance data",
        url: "/citizens?tab=idsp",
        icons: [{ src: "/icons/icon.svg", sizes: "any" }],
      },
      {
        name: "State Health Data",
        short_name: "States",
        description: "Browse health data by state",
        url: "/",
        icons: [{ src: "/icons/icon.svg", sizes: "any" }],
      },
    ],
  };
}
