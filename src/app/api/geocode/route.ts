import { NextResponse } from "next/server";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const PINCODE_API = "https://api.postalpincode.in/pincode";

function isPincode(q: string) {
  return /^\d{6}$/.test(q.trim());
}

/* ── India Post API for 6-digit pincodes ─────────────────────────── */
async function geocodeByPincode(pin: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
  try {
    const res  = await fetch(`${PINCODE_API}/${pin}`, { next: { revalidate: 86400 } });
    const data = await res.json() as Array<{ Status: string; PostOffice?: Array<{ Name: string; District: string; State: string; Latitude?: string; Longitude?: string }> }>;
    if (!data?.[0] || data[0].Status !== "Success" || !data[0].PostOffice?.length) return null;
    const po = data[0].PostOffice[0];
    const formatted = `${po.Name}, ${po.District}, ${po.State} — ${pin}`;
    /* Some records have lat/lng; if not, fall through to Nominatim */
    if (po.Latitude && po.Longitude && po.Latitude !== "NA") {
      return { lat: parseFloat(po.Latitude), lng: parseFloat(po.Longitude), formatted };
    }
    /* Use district name to get coords via Nominatim */
    const coords = await geocodeByNominatim(`${po.District}, ${po.State}, India`);
    return coords ? { ...coords, formatted } : null;
  } catch {
    return null;
  }
}

/* ── OpenStreetMap Nominatim for any text query ───────────────────── */
async function geocodeByNominatim(q: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
  try {
    const url = `${NOMINATIM}?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=in&addressdetails=1`;
    const res  = await fetch(url, {
      headers: { "User-Agent": "Vyasa/2.0 (healthforindia.in)" },
      next: { revalidate: 86400 },
    });
    const data = await res.json() as Array<{ lat: string; lon: string; display_name: string }>;
    if (!data?.length) return null;
    return {
      lat:       parseFloat(data[0].lat),
      lng:       parseFloat(data[0].lon),
      formatted: data[0].display_name,
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });

  try {
    let result: { lat: number; lng: number; formatted: string } | null = null;

    if (isPincode(q)) {
      /* Try India Post first (pincode-specific), fall back to Nominatim */
      result = await geocodeByPincode(q) ?? await geocodeByNominatim(q + ", India");
    } else {
      /* District / city / state name — Nominatim handles these well */
      result = await geocodeByNominatim(q + ", India");
    }

    if (!result) {
      return NextResponse.json({ error: `Could not locate "${q}". Try a district name or 6-digit pincode.` }, { status: 404 });
    }

    return NextResponse.json(result);

  } catch {
    return NextResponse.json({ error: "Geocoding failed. Please try again." }, { status: 500 });
  }
}
