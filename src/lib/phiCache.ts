// Module-level singleton — deduplicates concurrent fetches from multiple components
// on the same page (e.g. PHIntelligenceFeed + IDSPWeeklyReport + OutbreakAlerts).

interface PHIResponse {
  items: unknown[];
  sources: unknown[];
  errors: unknown[];
  refreshedAt: string | null;
  fromCache: boolean;
}

const TTL_MS = 5 * 60 * 1000;

let inFlight: Promise<PHIResponse> | null = null;
let cached: { data: PHIResponse; expiresAt: number } | null = null;

export function fetchPHI(refresh = false): Promise<PHIResponse> {
  if (!refresh && cached && Date.now() < cached.expiresAt) {
    return Promise.resolve(cached.data);
  }
  if (!refresh && inFlight) return inFlight;

  inFlight = fetch(`/api/ph-intelligence${refresh ? "?refresh=1" : ""}`)
    .then(r => r.json() as Promise<PHIResponse>)
    .then(data => {
      cached = { data, expiresAt: Date.now() + TTL_MS };
      inFlight = null;
      return data;
    })
    .catch(err => {
      inFlight = null;
      throw err;
    });

  return inFlight;
}

export function invalidatePHICache() {
  cached = null;
  inFlight = null;
}
