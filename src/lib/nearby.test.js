import { describe, expect, it, vi } from 'vitest';
import sample from './__fixtures__/overpass-nashville.json';
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
    for (const id of ['Q38076', 'Q752941', 'Q465751', 'Q7130852']) expect(q).toContain(id);
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

  it('falls back to the second server when the first fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ ok: true, json: async () => sample });
    const places = await fetchPlaces(here, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(places.length).toBe(5);
  });

  it('throws when every server fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 504 });
    await expect(fetchPlaces(here, { fetchImpl })).rejects.toThrow('HTTP 504');
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
