// Which chains are within reach of the user: their location, nearby
// restaurants from OpenStreetMap, and a travel time estimated from distance.
// The search uses Photon (photon.komoot.io), a free OpenStreetMap search that
// allows calls straight from the browser, with OpenStreetMap's Nominatim as
// the backup. Only a rounded location (about 1 km) leaves the phone.

// What to search for, and how a result's name must start.
export const BRANDS = {
  mcdonalds: { query: "McDonald's", name: /^mcdonald/i },
  tacobell: { query: 'Taco Bell', name: /^taco bell/i },
  chipotle: { query: 'Chipotle', name: /^chipotle/i },
  panera: { query: 'Panera Bread', name: /^panera/i },
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

// Widest search: a 30 minute drive (about 7 miles in a straight line), which
// also covers the delivery radius.
export const SEARCH_MILES = 7;

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

// Rounded to 2 decimals (about 1 km) so the location sent is coarse.
export const roundCoord = (n) => Math.round(n * 100) / 100;

// [west, south, east, north] around a point, `miles` in each direction.
export function bboxAround({ lat, lon }, miles = SEARCH_MILES) {
  const dLat = miles / 69;
  const dLon = miles / (69 * Math.cos((lat * Math.PI) / 180));
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map((n) => Math.round(n * 1000) / 1000);
}

export function photonUrl(chain, here) {
  const params = new URLSearchParams({
    q: BRANDS[chain].query,
    lat: roundCoord(here.lat),
    lon: roundCoord(here.lon),
    bbox: bboxAround({ lat: roundCoord(here.lat), lon: roundCoord(here.lon) }, SEARCH_MILES + 1).join(','),
    osm_tag: 'amenity',
    limit: 25,
  });
  return `https://photon.komoot.io/api/?${params}`;
}

export function nominatimUrl(chain, here) {
  const [w, s, e, n] = bboxAround({ lat: roundCoord(here.lat), lon: roundCoord(here.lon) }, SEARCH_MILES + 1);
  const params = new URLSearchParams({
    q: BRANDS[chain].query,
    format: 'jsonv2',
    addressdetails: 1,
    limit: 25,
    viewbox: [w, n, e, s].join(','),
    bounded: 1,
  });
  return `https://nominatim.openstreetmap.org/search?${params}`;
}

function place(chain, lat, lon, a, here) {
  const street = [a.housenumber, a.street].filter(Boolean).join(' ');
  return {
    chain,
    lat,
    lon,
    miles: milesBetween(here, { lat, lon }),
    address: [street, a.city].filter(Boolean).join(', ') || null,
    zip: a.postcode?.slice(0, 5) ?? null,
  };
}

// Photon GeoJSON → this chain's places. Results are restaurants (amenity)
// whose name matches the chain.
export function parsePhoton(chain, json, here) {
  return (json?.features ?? [])
    .filter((f) => f.properties?.osm_key === 'amenity' && BRANDS[chain].name.test(f.properties.name ?? ''))
    .map((f) => {
      const [lon, lat] = f.geometry.coordinates;
      return place(chain, lat, lon, f.properties, here);
    });
}

export function parseNominatim(chain, json, here) {
  return (Array.isArray(json) ? json : [])
    .filter((r) => r.category === 'amenity' && BRANDS[chain].name.test(r.name ?? ''))
    .map((r) => {
      const a = r.address ?? {};
      const addr = { housenumber: a.house_number, street: a.road, city: a.city ?? a.town ?? a.village, postcode: a.postcode };
      return place(chain, Number(r.lat), Number(r.lon), addr, here);
    });
}

// All places of every chain near `here`, nearest first.
export function sortPlaces(lists) {
  return lists.flat().sort((a, b) => a.miles - b.miles);
}

// The nearest location of each chain.
export function nearestByChain(places) {
  const out = {};
  for (const p of places) if (!out[p.chain]) out[p.chain] = p;
  return out;
}

async function getJson(fetchImpl, url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Photon for every chain at once; if Photon fails, Nominatim one chain at a
// time (its usage policy allows one request a second).
export async function fetchPlaces(here, { fetchImpl = (...a) => fetch(...a), timeoutMs = 15000, gapMs = 1100 } = {}) {
  const chains = Object.keys(BRANDS);
  try {
    const lists = await Promise.all(chains.map(async (c) => parsePhoton(c, await getJson(fetchImpl, photonUrl(c, here), timeoutMs), here)));
    return sortPlaces(lists);
  } catch {
    const lists = [];
    for (const [i, c] of chains.entries()) {
      if (i > 0) await pause(gapMs);
      lists.push(parseNominatim(c, await getJson(fetchImpl, nominatimUrl(c, here), timeoutMs), here));
    }
    return sortPlaces(lists);
  }
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
