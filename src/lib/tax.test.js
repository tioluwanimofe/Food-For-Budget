import { describe, expect, it } from 'vitest';
import table from '../data/tax-rates.json';
import { taxForZip } from './tax.js';

describe('taxForZip', () => {
  it.each([
    ['37203', 0.0925, 'Nashville (Davidson County), TN'],
    ['37902', 0.0961, 'Tennessee average'],
    ['10001', 0.0854, 'New York average'],
    ['90210', 0.0903, 'California average'],
    ['60601', 0.0898, 'Illinois average'],
    ['73301', 0.082, 'Texas average'],
    ['97201', 0, 'Oregon average'],
    ['99501', 0.0182, 'Alaska average'],
    ['20500', 0.06, 'District of Columbia average'],
    ['05501', 0.0625, 'Massachusetts average'],
  ])('%s → %s', (zip, rate, label) => {
    const t = taxForZip(zip);
    expect(t.rate).toBeCloseTo(rate, 6);
    expect(t.label).toBe(label);
  });

  it('rejects partial, non-numeric and territory ZIPs', () => {
    expect(taxForZip('372')).toBeNull();
    expect(taxForZip('abcde')).toBeNull();
    expect(taxForZip('00901')).toBeNull(); // Puerto Rico
  });

  it('covers every state and DC with no overlapping ranges', () => {
    const covered = new Set(table.zip3.map((r) => r[2]));
    expect(covered.size).toBe(51);
    const sorted = [...table.zip3].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i][0]).toBeGreaterThan(sorted[i - 1][1]);
  });
});
