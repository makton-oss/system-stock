const { DateTime } = require("luxon");

// ======================
// DAILY NETTING — return/correction handling
//
// Rule (within same outlet+item+MY-calendar-day):
// - OUT builds an "outstanding" pool.
// - IN qty <= outstanding → WHOLE record = correction (does NOT add to stockIn,
//   instead reduces net usage). Pool is reduced by qty.
// - IN qty >  outstanding → WHOLE record = genuine stock-in. Pool unchanged.
// - WASTAGE never touches the pool (cannot be "returned").
//
// Input rows need: outlet_id, item, type, qty, created_at
// Output: same rows + { isCorrection: boolean }
//
// ⚠️ PRECONDITION: caller MUST apply tenant_id filter (applyTenant()) on the
// query BEFORE passing data into this function. This util does NOT scope by
// tenant itself — it trusts the input is already isolated per-tenant.
// ======================
function applyDailyNetting(movements = []) {

  const groups = new Map();

  movements.forEach(r => {
    const day = DateTime
      .fromISO(r.created_at)
      .setZone("Asia/Kuala_Lumpur")
      .toFormat("yyyy-MM-dd");

    const key = `${r.outlet_id}-${r.item}-${day}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  });

  const result = [];

  groups.forEach(group => {

    const sorted = [...group].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );

    let outstanding = 0;

    sorted.forEach(r => {

      if (r.type === "out") {
        outstanding += Number(r.qty || 0);
        result.push({ ...r, isCorrection: false });
        return;
      }

      if (r.type === "in") {
        const qty = Number(r.qty || 0);

        if (outstanding > 0 && qty <= outstanding) {
          outstanding -= qty;
          result.push({ ...r, isCorrection: true });
        } else {
          result.push({ ...r, isCorrection: false });
        }
        return;
      }

      // wastage — pool tak terlibat, lalu terus
      result.push({ ...r, isCorrection: false });
    });
  });

  return result;
}

module.exports = { applyDailyNetting };