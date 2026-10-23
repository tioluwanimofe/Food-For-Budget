// One menu file per chain. Item ids are unique across chains (each chain's ids
// carry its own prefix), so prices and favorites can share one saved map.
import mcdonalds from './mcdonalds.json';
import tacobell from './tacobell.json';
import chipotle from './chipotle.json';
import panera from './panera.json';

export const CHAINS = [mcdonalds, tacobell, chipotle, panera];

export const CHAIN_BY_ID = Object.fromEntries(CHAINS.map((c) => [c.id, c]));
