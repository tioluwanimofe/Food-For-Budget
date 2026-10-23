import { describe, expect, it, vi } from 'vitest';
import sample from './__fixtures__/photon-nashville.json';
import {
  deliveryExtras,
  deliveryItems,
  fetchPlaces,
  inReach,
  milesBetween,
  nearestByChain,
  BRANDS,
  nominatimUrl,
  parseNominatim,
  parsePhoton,
  photonUrl,
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

describe('OpenStreetMap search', () => {
  const photonFetch = () =>
    vi.fn(async (url) => {
      const q = new URL(url).searchParams.get('q');
      const chain = Object.keys(BRANDS).find((c) => BRANDS[c].query === q);
      return { ok: true, json: async () => sample[chain] };
    });

  it('asks Photon for each chain around a rounded location', () => {
    const url = new URL(photonUrl('chipotle', here));
    expect(url.origin).toBe('https://photon.komoot.io');
    expect(url.searchParams.get('q')).toBe('Chipotle');
    expect(url.searchParams.get('lat')).toBe('36.16');
    expect(url.searchParams.get('lon')).toBe('-86.78');
    expect(url.searchParams.get('osm_tag')).toBe('amenity');
    const [w, s, e, n] = url.searchParams.get('bbox').split(',').map(Number);
    expect(n - s).toBeCloseTo(16 / 69, 2); // 8 miles each way
    expect(w).toBeLessThan(-86.78);
    expect(e).toBeGreaterThan(-86.78);
  });

  it('keeps restaurants whose name matches the chain', () => {
    const mc = parsePhoton('mcdonalds', sample.mcdonalds, here);
    expect(mc).toHaveLength(2); // not the bus stop
    expect(mc[0]).toMatchObject({ chain: 'mcdonalds', lat: 36.1561382, lon: -86.7875493, address: '1601 Broadway, Nashville', zip: '37203' });
    const cp = parsePhoton('chipotle', sample.chipotle, here);
    expect(cp).toHaveLength(1); // not Taqueria Chipotle Express
  });

  it('finds every chain, nearest first, and the nearest of each', async () => {
    const fetchImpl = photonFetch();
    const places = await fetchPlaces(here, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(places.every((p, i) => i === 0 || p.miles >= places[i - 1].miles)).toBe(true);
    const nearest = nearestByChain(places);
    expect(Object.keys(nearest).sort()).toEqual(['chipotle', 'mcdonalds', 'panera', 'tacobell']);
    expect(nearest.mcdonalds.address).toBe('1601 Broadway, Nashville');
    expect(nearest.chipotle.zip).toBe('37212');
  });

  it('falls back to Nominatim, one chain a second, when Photon fails', async () => {
    const result = [{ category: 'amenity', type: 'fast_food', name: 'Chipotle', lat: '36.1442350', lon: '-86.8130984', address: { house_number: '2809', road: 'West End Avenue', city: 'Nashville', postcode: '37203' } }];
    const fetchImpl = vi.fn(async (url) => {
      if (url.startsWith('https://photon')) return { ok: false, status: 503 };
      const q = new URL(url).searchParams.get('q');
      return { ok: true, json: async () => (q === 'Chipotle' ? result : []) };
    });
    const places = await fetchPlaces(here, { fetchImpl, gapMs: 0 });
    const nominatimCalls = fetchImpl.mock.calls.map(([u]) => u).filter((u) => u.startsWith('https://nominatim.openstreetmap.org/search?'));
    expect(nominatimCalls).toHaveLength(4);
    expect(new URL(nominatimCalls[0]).searchParams.get('bounded')).toBe('1');
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ chain: 'chipotle', lat: 36.144235, zip: '37203' });
  });

  it('throws when both searches fail', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    await expect(fetchPlaces(here, { fetchImpl, gapMs: 0 })).rejects.toThrow('HTTP 429');
  });

  it('parses Nominatim results the same way', () => {
    const rows = [
      { category: 'amenity', name: 'Taco Bell', lat: '36.1', lon: '-86.8', address: { road: 'Main St', town: 'Smyrna' } },
      { category: 'shop', name: 'Taco Bell Outlet', lat: '36.1', lon: '-86.8' },
    ];
    expect(parseNominatim('tacobell', rows, here)).toEqual([
      expect.objectContaining({ chain: 'tacobell', lat: 36.1, lon: -86.8, address: 'Main St, Smyrna', zip: null }),
    ]);
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
