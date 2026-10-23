// Which chains are within reach of the user: their location, nearby
// restaurants from OpenStreetMap (Overpass API, free, no key), and a travel
// time estimated from distance. Only the search leaves the device.

// OpenStreetMap tags chain locations with the brand's Wikidata id; the name
// pattern catches locations that only have a name.
export const BRANDS = {
  mcdonalds: { wikidata: 'Q38076', name: /mcdonald/i },
  tacobell: { wikidata: 'Q752941', name: /taco bell/i },
  chipotle: { wikidata: 'Q465751', name: /chipotle/i },
  panera: { wikidata: 'Q7130852', name: /panera/i },
};

// Travel modes. Time is estimated from straight-line distance: roads add
// about 30%, then walking at 3 mph, or driving at 20 mph in town plus 3
// minutes to park. Delivery reaches about 5 miles.
export const MODES = {
  any: { label: 'Anywhere' },
  walk: { label: 'Walk', mph: 3, extraMin: 0, verb: 'walk', travelmode: 'walking' },
  drive: { label: 'Drive', mph: 20, extraMin: 3, verb: 'drive', travelmode: 'driving' },
  delivery: { label: 'Order in', maxMiles: 5 },
};
export const MODE_IDS = Object.keys(MODES);
export const TIME_LIMITS = [5, 10, 15, 20, 30];
const DETOUR = 1.3;

// Widest search: a 30 minute drive, or the delivery radius if that is larger.
export const SEARCH_MILES = 10;

const METERS_PER_MILE = 1609.344;

export function milesBetween(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

export function travelMinutes(miles, mode) {
  const m = MODES[mode];
  if (!m?.mph) return null;
  return Math.max(1, Math.round((miles * DETOUR * 60) / m.mph + m.extraMin));
}

// Whether a place is reachable under the chosen mode and time limit.
export function inReach(place, mode, minutes) {
  if (mode === 'any') return true;
  if (mode === 'delivery') return place.miles <= MODES.delivery.maxMiles;
  return travelMinutes(place.miles, mode) <= minutes;
}

export function overpassQuery({ lat, lon }, miles = SEARCH_MILES) {
  const r = Math.round(miles * METERS_PER_MILE);
  const ids = Object.values(BRANDS).map((b) => b.wikidata).join('|');
  const names = 'McDonald|Taco Bell|Chipotle|Panera';
  const area = `(around:${r},${lat},${lon})`;
  return (
    `[out:json][timeout:25];(` +
    `nwr${area}["brand:wikidata"~"^(${ids})$"];` +
    `nwr${area}["amenity"~"^(fast_food|restaurant|cafe)$"]["name"~"${names}",i];` +
    `);out center tags;`
  );
}

function chainOf(tags) {
  for (const [id, b] of Object.entries(BRANDS)) if (tags['brand:wikidata'] === b.wikidata) return id;
  const label = tags.brand ?? tags.name ?? '';
  for (const [id, b] of Object.entries(BRANDS)) if (b.name.test(label)) return id;
  return null;
}

function addressOf(tags) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  return [street, tags['addr:city']].filter(Boolean).join(', ') || null;
}

// Overpass JSON → known-chain places with distance from `here`, nearest first.
export function parsePlaces(json, here) {
  const seen = new Set();
  const places = [];
  for (const el of json?.elements ?? []) {
    const tags = el.tags ?? {};
    const chain = chainOf(tags);
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!chain || lat == null || lon == null) continue;
    // Skip closed locations and drive-through-only kiosks with no position.
    if (tags['disused:amenity'] || /^(no|closed)$/.test(tags.opening_hours ?? '')) continue;
    const key = `${el.type}/${el.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({
      chain,
      lat,
      lon,
      miles: milesBetween(here, { lat, lon }),
      address: addressOf(tags),
      zip: tags['addr:postcode']?.slice(0, 5) ?? null,
    });
  }
  return places.sort((a, b) => a.miles - b.miles);
}

// The nearest location of each chain.
export function nearestByChain(places) {
  const out = {};
  for (const p of places) if (!out[p.chain]) out[p.chain] = p;
  return out;
}

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

export async function fetchPlaces(here, { fetchImpl = fetch, timeoutMs = 20000 } = {}) {
  const body = new URLSearchParams({ data: overpassQuery(here) });
  let lastError;
  for (const url of ENDPOINTS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { method: 'POST', body, signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parsePlaces(await res.json(), here);
    } catch (e) {
      lastError = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

export function locate({ geo = globalThis.navigator?.geolocation } = {}) {
  return new Promise((resolve, reject) => {
    if (!geo) return reject(new Error('unsupported'));
    geo.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(new Error(e.code === 1 ? 'denied' : 'unavailable')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  });
}

export function directionsUrl(place, mode) {
  const travelmode = MODES[mode]?.travelmode ?? 'driving';
  return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}&travelmode=${travelmode}`;
}

// Order in: delivery apps mark up menu prices and add fees and a tip. The
// fees and tip come out of the budget first; tax applies to the marked-up food.
export const DELIVERY_DEFAULTS = { markup: 20, fees: 5, tip: 3 };

export function deliveryItems(items, { markup }) {
  const k = 1 + (Number(markup) || 0) / 100;
  return items.map((i) => ({ ...i, price: Math.round(i.price * k * 100) / 100 }));
}

export function deliveryExtras({ fees, tip }) {
  return (Number(fees) || 0) + (Number(tip) || 0);
}
