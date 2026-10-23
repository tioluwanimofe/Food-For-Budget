import table from '../data/tax-rates.json';

// Estimate the sales tax rate for a 5-digit ZIP code from its 3-digit prefix:
// a few known local overrides first, else the state's average combined rate.
// Returns { rate (fraction), label } or null for unknown or non-state ZIPs.
export function taxForZip(zip) {
  if (!/^\d{5}$/.test(zip ?? '')) return null;
  const zip3 = Number(zip.slice(0, 3));

  const override = table.overrides.find((o) => o.zip3 === zip3);
  if (override) return { rate: override.rate / 100, label: override.label };

  const range = table.zip3.find(([lo, hi]) => zip3 >= lo && zip3 <= hi);
  if (!range) return null;
  const state = table.states[range[2]];
  return { rate: state.combined / 100, label: `${state.name} average` };
}
