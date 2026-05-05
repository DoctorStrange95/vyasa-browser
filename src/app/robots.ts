import type { MetadataRoute } from "next";

const BASE = "https://www.vyasaa.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth",
          "/auth/",
          "/profile",
          "/profile/",
          "/dashboard",
          "/dashboard/",
          "/admin",
          "/admin/",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
