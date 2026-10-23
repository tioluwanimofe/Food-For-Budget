import { cashierLine } from '../lib/optimizer.js';

const money = (n) => `$${n.toFixed(2)}`;

function Lines({ order }) {
  return (
    <ul className="lines">
      {order.lines.map(({ item, qty }, i) => (
        <li key={item.id} style={{ '--i': i }}>
          <span className="qty">{qty}×</span>
          <span className="name">
            {item.name}
            {item.deal && <small>{item.contents.join(' + ')}</small>}
          </span>
          <span className="price">{money(item.price * qty)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function OrderCard({ plan, taxRate, onBack }) {
  const { best, nextBest } = plan ?? {};

  if (!best) {
    return (
      <section className="card result">
        <h2>Nothing fits yet</h2>
        <p>No combination fits that budget and those limits once tax is added. Try a bit more money or looser limits.</p>
        <button type="button" className="feed" onClick={onBack}>
          Try again
        </button>
      </section>
    );
  }

  const hasDeal = best.lines.some((l) => l.item.deal);

  return (
    <section className="card result">
      <h2>Your order</h2>
      <Lines order={best} />

      <dl className="totals">
        <div>
          <dt>Total with tax</dt>
          <dd>{money(best.total)}</dd>
        </div>
        <div className="protein">
          <dt>Protein</dt>
          <dd>{best.protein} g</dd>
        </div>
        <div>
          <dt>Calories</dt>
          <dd>{best.calories}</dd>
        </div>
        <div>
          <dt>Carbs</dt>
          <dd>{best.carbs} g</dd>
        </div>
      </dl>
      <p className="fine">
        {money(best.subtotal)} + {money(best.tax)} tax ({+(taxRate * 100).toFixed(3)}%). Prices are estimates.
        {hasDeal && ' Meal Deal nutrition assumes water or a diet drink.'}
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

      <button type="button" className="feed" onClick={onBack}>
        New order
      </button>
    </section>
  );
}
