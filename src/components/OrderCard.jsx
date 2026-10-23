import { CHAIN_BY_ID } from '../data/chains/index.js';
import { GOALS } from '../lib/goals.js';
import { cashierLine, macroSplit } from '../lib/optimizer.js';

const money = (n) => `$${n.toFixed(2)}`;

function Lines({ order }) {
  return (
    <ul className="lines">
      {order.lines.map(({ item, qty }, i) => (
        <li key={item.id} style={{ '--i': i }}>
          <span className="qty">{qty}×</span>
          <span className="name">
            {item.name}
            {item.contents && <small>{item.contents.join(' + ')}</small>}
          </span>
          <span className="price">{money(item.price * qty)}</span>
        </li>
      ))}
    </ul>
  );
}

// The stat each goal is chasing gets the highlight on the card.
const HIGHLIGHT = { protein: 'protein', calories: 'protein', lowcarb: 'protein', cheapest: 'total', mostfood: 'calories', pickforme: 'calories' };

export default function OrderCard({ plan, goal, chain, filtered, taxRate, onBack }) {
  const { best, nextBest, others = [] } = plan ?? {};
  const place = plan?.chain?.name;
  const hi = (key) => (HIGHLIGHT[goal] === key ? 'hi' : undefined);

  if (!best) {
    return (
      <section className="card result">
        <h2>Nothing fits yet</h2>
        <p>
          {GOALS[goal].favoritesOnly
            ? 'None of your favorites fit that budget yet. Star a few more, or try a bit more money.'
            : filtered
              ? `Nothing on ${chain === 'all' ? 'any menu' : 'the menu'} fits that budget, those limits and your diet filters. Try turning a filter off.${chain === 'mcdonalds' ? " (Nothing at McDonald's is vegetarian: even the fries use beef flavor.)" : ''}`
              : 'No combination fits that budget and those limits once tax is added. Try a bit more money or looser limits.'}
        </p>
        <button type="button" className="feed" onClick={onBack}>
          Try again
        </button>
      </section>
    );
  }

  const hasDeal = best.lines.some((l) => l.item.deal);

  return (
    <section className="card result">
      <h2>Your order at {place}</h2>
      <p className="fine goal-tag">{GOALS[goal].label}</p>
      <Lines order={best} />

      <dl className="totals">
        <div className={hi('total')}>
          <dt>Total with tax</dt>
          <dd>{money(best.total)}</dd>
        </div>
        <div className={hi('protein')}>
          <dt>Protein</dt>
          <dd>{best.protein} g</dd>
        </div>
        <div className={hi('calories')}>
          <dt>Calories</dt>
          <dd>{best.calories}</dd>
        </div>
        <div>
          <dt>Carbs</dt>
          <dd>{best.carbs} g</dd>
        </div>
      </dl>
      <p className="fine">
        Fat {best.fat} g · Sodium {best.sodiumKnown ? `${best.sodium.toLocaleString()} mg` : 'not known for every item'}
        {goal === 'balanced' && ` · Split ${macroSplit(best).join('/')} (protein/carbs/fat)`}
      </p>
      <p className="fine">
        {money(best.subtotal)} + {money(best.tax)} tax ({+(taxRate * 100).toFixed(3)}%). Prices are estimates.
        {hasDeal && ' Meal Deal nutrition assumes water or a diet drink.'}
        {best.carbsEstimated && ' Carbs are estimated for some items.'}
      </p>

      <blockquote className="say">
        <span>Say this at the counter</span>“{cashierLine(best.lines)}”
      </blockquote>

      {nextBest && (
        <details className="next">
          <summary>Next best option (if the {nextBest.missing} is out)</summary>
          <Lines order={nextBest} />
          <p className="fine">
            {money(nextBest.total)} with tax · {nextBest.protein} g protein · {nextBest.calories} cal · {nextBest.carbs} g carbs
          </p>
          <p className="fine">“{cashierLine(nextBest.lines)}”</p>
        </details>
      )}

      {others.length > 0 && (
        <details className="next">
          <summary>How the other chains compare</summary>
          <ul className="compare">
            {others.map(({ chain: c, best: o }) => (
              <li key={c.id}>
                <strong>{c.name}</strong>
                <span className="fine">
                  {money(o.total)} · {o.protein} g protein · {o.calories} cal · {o.carbs} g carbs
                </span>
                <span className="fine">{o.lines.map((l) => `${l.qty}× ${l.item.name}`).join(', ')}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <button type="button" className="feed" onClick={onBack}>
        New order
      </button>
    </section>
  );
}
