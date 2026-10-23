// Vercel function: GET /api/nearby?lat=..&lon=.. searches OpenStreetMap's
// Overpass API for the chains near that point. Overpass blocks requests made
// straight from a browser and asks clients to identify themselves, so the
// app's search goes through here. Results are cached at Vercel's edge for a
// day per rounded location, which keeps load on the free servers low.
import { SEARCH_MILES, overpassQuery, roundCoord } from '../src/lib/nearby.js';

export const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const USER_AGENT = 'FoodForBudget/1.0 (+https://food-for-budget.vercel.app)';

export async function searchOverpass(lat, lon, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  // One extra mile covers the rounding of the user's location.
  const body = new URLSearchParams({ data: overpassQuery({ lat, lon }, SEARCH_MILES + 1) });
  const errors = [];
  for (const url of ENDPOINTS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        body,
        headers: { 'User-Agent': USER_AGENT, Referer: 'https://food-for-budget.vercel.app/', Accept: 'application/json' },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return { elements: json.elements ?? [] };
    } catch (e) {
      errors.push(`${new URL(url).host}: ${e.name === 'AbortError' ? 'timed out' : e.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(errors.join('; '));
}

export default async function handler(req, res) {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) {
    res.status(400).json({ error: 'lat and lon are required' });
    return;
  }
  try {
    const result = await searchOverpass(roundCoord(lat), roundCoord(lon));
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json(result);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: e.message });
  }
}
