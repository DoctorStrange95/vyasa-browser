import type { MetadataRoute } from "next";
import states from "@/data/states.json";
import cities from "@/data/cities.json";

const BASE = "https://www.vyasaa.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,                   lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE}/citizens`,     lastModified: now, changeFrequency: "weekly",  priority: 0.9 },
    { url: "https://health.vyasaa.com/nfhs-6", lastModified: now, changeFrequency: "monthly", priority: 0.95 },
    { url: "https://health.vyasaa.com/states", lastModified: now, changeFrequency: "monthly", priority: 0.95 },
    { url: `${BASE}/sources`,      lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/join`,         lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/contribute`,   lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/team`,         lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/contact`,      lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/privacy`,      lastModified: now, changeFrequency: "yearly",  priority: 0.2 },
    { url: `${BASE}/cookies`,      lastModified: now, changeFrequency: "yearly",  priority: 0.1 },
  ];

  const statePages: MetadataRoute.Sitemap = states.map(s => ({
    url: `${BASE}/state/${s.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  const districtPages: MetadataRoute.Sitemap = cities.map(c => ({
    url: `${BASE}/district/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...statePages, ...districtPages];
}
