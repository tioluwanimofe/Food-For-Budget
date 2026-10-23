import { useCallback, useEffect, useMemo, useState } from 'react';
import { CHAINS, CHAIN_BY_ID } from './data/chains/index.js';
import defaults from './data/settings.json';
import { applyFilters, LOW_SODIUM_MG } from './lib/filters.js';
import { GOALS } from './lib/goals.js';
import { planAcrossChains } from './lib/optimizer.js';
import { taxForZip } from './lib/tax.js';
import { loadSaved, save } from './lib/storage.js';
import BudgetForm from './components/BudgetForm.jsx';
import MysteryBox from './components/MysteryBox.jsx';
import OrderCard from './components/OrderCard.jsx';
import MenuEditor from './components/MenuEditor.jsx';

export default function App() {
  const saved = useMemo(loadSaved, []);
  const [prices, setPrices] = useState(saved.prices ?? {});
  const [taxRate, setTaxRate] = useState(saved.taxRate ?? defaults.taxRate);
  const [taxLabel, setTaxLabel] = useState(saved.taxLabel ?? `${defaults.taxLabel}, default`);
  const [zip, setZip] = useState(saved.zip ?? '');
  const [cap, setCap] = useState(saved.cap ?? defaults.quantityCap);
  const [favorites, setFavorites] = useState(saved.favorites ?? []);
  const [chain, setChain] = useState(saved.chain in CHAIN_BY_ID ? saved.chain : 'all');
  const [filters, setFilters] = useState({ vegetarian: false, noPork: false, lowSodium: false, avoid: [], ...saved.filters });
  const [form, setForm] = useState({
    budget: 10,
    goal: saved.goal ?? 'protein',
    calorieLimit: '',
    carbLimit: '',
    proteinMin: '',
    proteinPct: '',
    carbPct: '',
    fatPct: '',
    calorieMin: '',
  });
  const [plan, setPlan] = useState(null);
  const [phase, setPhase] = useState('form'); // form | reveal | result
  const [showMenu, setShowMenu] = useState(false);

  useEffect(
    () => save({ prices, taxRate, taxLabel, zip, cap, favorites, filters, chain, goal: form.goal }),
    [prices, taxRate, taxLabel, zip, cap, favorites, filters, chain, form.goal],
  );

  function changeZip(value) {
    setZip(value);
    const tax = taxForZip(value);
    if (tax) {
      setTaxRate(tax.rate);
      setTaxLabel(`${(tax.rate * 100).toFixed(2)}%, ${tax.label} (estimate)`);
    } else if (value.length === 5) {
      setTaxLabel('ZIP not recognized, enter the rate by hand');
    }
  }

  function changeTaxRate(rate) {
    setTaxRate(rate);
    setTaxLabel('set by you');
  }

  // Prefill the selected goal's targets with their defaults the first time it is picked.
  useEffect(() => {
    const targets = GOALS[form.goal].targets ?? [];
    setForm((f) => {
      const empty = targets.filter((t) => f[t.key] === '');
      return empty.length ? { ...f, ...Object.fromEntries(empty.map((t) => [t.key, t.default])) } : f;
    });
  }, [form.goal]);

  // The chains in play ('all' or one chain), each with the user's prices and favorites applied.
  const menus = useMemo(
    () =>
      CHAINS.filter((c) => chain === 'all' || c.id === chain).map((c) => ({
        chain: c,
        items: c.items.map((i) => ({
          ...i,
          price: prices[i.id] ?? i.price,
          edited: i.id in prices,
          favorite: favorites.includes(i.id),
        })),
      })),
    [chain, prices, favorites],
  );
  const favoriteCount = menus.reduce((n, m) => n + m.items.filter((i) => i.favorite).length, 0);

  const revealDone = useCallback(() => setPhase('result'), []);

  function feedMe() {
    const goalKeys = (GOALS[form.goal].targets ?? []).map((t) => t.key);
    // A goal's own inputs always apply; the optional limits apply when set.
    const num = (key) => Number(form[key]) || undefined;
    const goalNum = (key) => (goalKeys.includes(key) ? num(key) : undefined);
    setPlan(
      planAcrossChains(menus.map((m) => ({ ...m, items: applyFilters(m.items, filters) })), {
        goal: form.goal,
        budget: Number(form.budget),
        taxRate,
        cap,
        calorieLimit: num('calorieLimit'),
        carbLimit: num('carbLimit'),
        sodiumLimit: filters.lowSodium ? LOW_SODIUM_MG : undefined,
        proteinMin: goalNum('proteinMin'),
        calorieMin: goalNum('calorieMin'),
        proteinPct: goalNum('proteinPct'),
        carbPct: goalNum('carbPct'),
        fatPct: goalNum('fatPct'),
      }),
    );
    setPhase('reveal');
  }

  return (
    <div className="app">
      <header className="brand">
        <img src="/icon.svg" alt="" width="40" height="40" />
        <h1>
          Food for <span>Budget</span>
        </h1>
      </header>

      <main>
        {phase === 'form' && (
          <BudgetForm
            form={form}
            onChange={setForm}
            onSubmit={feedMe}
            taxRate={taxRate}
            onTaxRate={changeTaxRate}
            taxLabel={taxLabel}
            zip={zip}
            onZip={changeZip}
            cap={cap}
            onCap={setCap}
            onEditMenu={() => setShowMenu(true)}
            favoriteCount={favoriteCount}
            chain={chain}
            onChain={setChain}
            filters={filters}
            onFilters={setFilters}
          />
        )}
        {phase === 'reveal' && <MysteryBox onDone={revealDone} />}
        {phase === 'result' && <OrderCard
            plan={plan}
            goal={form.goal}
            chain={chain}
            filtered={filters.vegetarian || filters.noPork || filters.lowSodium || filters.avoid.length > 0}
            taxRate={taxRate}
            onBack={() => setPhase('form')}
          />}
      </main>

      {showMenu && (
        <MenuEditor
          menus={menus}
          prices={prices}
          onPrices={setPrices}
          favorites={favorites}
          onFavorites={setFavorites}
          onClose={() => setShowMenu(false)}
        />
      )}

      <footer>
        {chain === 'all' ? (
          <p>Prices are national estimates and vary by location. Edit them to match your local menus.</p>
        ) : (
          <p>{CHAIN_BY_ID[chain].priceNote}</p>
        )}
        <p>Not affiliated with {CHAINS.map((c) => c.name).join(', ')}. Not medical or nutrition advice.</p>
      </footer>
    </div>
  );
}
