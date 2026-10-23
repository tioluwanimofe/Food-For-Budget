import { describe, expect, it, vi } from 'vitest';
import sample from './__fixtures__/overpass-nashville.json';
import handler, { ENDPOINTS } from '../../api/nearby.js';
import {
  deliveryExtras,
  deliveryItems,
  fetchPlaces,
  inReach,
  milesBetween,
  nearestByChain,
  overpassQuery,
  parsePlaces,
  travelMinutes,
} from './nearby.js';

const here = { lat: 36.1627, lon: -86.7816 }; // downtown Nashville

describe('distance and time', () => {
  it('measures miles between points', () => {
    // Nashville to Memphis is about 197 miles in a straight line.
    expect(milesBetween(here, { lat: 35.1495, lon: -90.049 })).toBeCloseTo(197, -1);
    expect(milesBetween(here, here)).toBe(0);
  });

  it('estimates walk and drive minutes', () => {
    expect(travelMinutes(1, 'walk')).toBe(26); // 1.3 mi at 3 mph
    expect(travelMinutes(1, 'drive')).toBe(7); // 1.3 mi at 20 mph + 3 min to park
    expect(travelMinutes(0, 'walk')).toBe(1);
    expect(travelMinutes(1, 'delivery')).toBeNull();
  });

  it('checks reach for each mode', () => {
    expect(inReach({ miles: 0.5 }, 'walk', 15)).toBe(true); // 13 min
    expect(inReach({ miles: 0.7 }, 'walk', 15)).toBe(false); // 18 min
    expect(inReach({ miles: 4 }, 'drive', 20)).toBe(true); // 19 min
    expect(inReach({ miles: 4.9 }, 'delivery')).toBe(true);
    expect(inReach({ miles: 5.1 }, 'delivery')).toBe(false);
    expect(inReach({ miles: 500 }, 'any')).toBe(true);
  });
});

describe('OpenStreetMap results', () => {
  it('builds a query around the user for every chain', () => {
    const q = overpassQuery(here, 1);
    expect(q).toContain('around:1609,36.1627,-86.7816');
    for (const id of ['Q38076', 'Q752941', 'Q465751', 'Q7130852']) expect(q).toContain(`["brand:wikidata"="${id}"]`);
  });

  it('keeps known chains, skips closed and duplicate places, nearest first', () => {
    const places = parsePlaces(sample, here);
    expect(places.map((p) => p.chain)).toEqual(['mcdonalds', 'mcdonalds', 'chipotle', 'tacobell', 'panera']);
    expect(places.every((p, i) => i === 0 || p.miles >= places[i - 1].miles)).toBe(true);
    const chipotle = places.find((p) => p.chain === 'chipotle');
    expect(chipotle.lat).toBe(36.1478); // a way uses its center
    expect(chipotle.zip).toBe('37203');
    expect(places.find((p) => p.address)?.address).toBe('1601 Broadway, Nashville');
  });

  it('picks the nearest location of each chain', () => {
    const nearest = nearestByChain(parsePlaces(sample, here));
    expect(Object.keys(nearest).sort()).toEqual(['chipotle', 'mcdonalds', 'panera', 'tacobell']);
    expect(nearest.mcdonalds.lat).toBe(36.17); // the closer of the two McDonald's
  });

  it('asks this app\'s /api/nearby with a rounded location', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => sample });
    const places = await fetchPlaces(here, { fetchImpl });
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/nearby?lat=36.16&lon=-86.78');
    expect(places.length).toBe(5);
    // Distances still use the precise location, which never leaves the phone.
    expect(places[0].miles).toBeCloseTo(milesBetween(here, places[0]), 6);
  });

  it('throws when the search fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 502 });
    await expect(fetchPlaces(here, { fetchImpl })).rejects.toThrow('HTTP 502');
  });
});

describe('/api/nearby', () => {
  const ok = { ok: true, json: async () => sample };
  const call = async (query, fetchImpl) => {
    vi.stubGlobal('fetch', fetchImpl);
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; } };
    await handler({ query }, res);
    vi.unstubAllGlobals();
    return res;
  };

  it('identifies the app to Overpass and caches the answer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok);
    const res = await call({ lat: '36.16', lon: '-86.78' }, fetchImpl);
    expect(res.code).toBe(200);
    expect(res.body.elements).toHaveLength(sample.elements.length);
    expect(res.headers['Cache-Control']).toMatch(/s-maxage=86400/);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(ENDPOINTS[0]);
    expect(init.method).toBe('POST');
    expect(init.headers['User-Agent']).toMatch(/^FoodForBudget\//);
    expect(init.body.get('data')).toContain('around:12875,36.16,-86.78');
  });

  it('falls back to the next server, and reports every failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: false, status: 406 }).mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(ok);
    expect((await call({ lat: '36.16', lon: '-86.78' }, fetchImpl)).code).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    const failing = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    const res = await call({ lat: '36.16', lon: '-86.78' }, failing);
    expect(res.code).toBe(502);
    expect(res.body.error).toBe(ENDPOINTS.map((u) => `${new URL(u).host}: HTTP 429`).join('; '));
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('rejects a missing or bad location', async () => {
    const fetchImpl = vi.fn();
    expect((await call({}, fetchImpl)).code).toBe(400);
    expect((await call({ lat: '200', lon: '0' }, fetchImpl)).code).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('order in', () => {
  it('marks up prices and adds fees and tip', () => {
    const [item] = deliveryItems([{ id: 'x', price: 10 }], { markup: 20 });
    expect(item.price).toBe(12);
    expect(deliveryExtras({ fees: '4.99', tip: 3 })).toBeCloseTo(7.99);
    expect(deliveryExtras({ fees: '', tip: '' })).toBe(0);
  });
});
