// Base en mémoire : juste ce que le pare-feu utilise (select/eq/is/not/order/in/maybeSingle, insert, update, upsert).
const T = { provider_profiles: [], provider_private: [], commission_debts: [], payment_alerts: [], app_settings: [], profiles: [] }
let n = 0
function q(table) {
  const st = { table, filters: [], op: 'select', payload: null, order: null }
  const rows = () => T[table].filter(r => st.filters.every(f => f(r)))
  const run = () => {
    if (st.op === 'insert') { for (const p of [].concat(st.payload)) T[table].push({ id: 'id' + (++n), created_at: new Date(Date.now() + n).toISOString(), status: table === 'commission_debts' ? 'open' : undefined, ...p }); return { data: null, error: null } }
    if (st.op === 'update') { for (const r of rows()) Object.assign(r, st.payload); return { data: null, error: null } }
    if (st.op === 'upsert') { const p = st.payload; const ex = T[table].find(r => r.id === p.id); ex ? Object.assign(ex, p) : T[table].push({ ...p }); return { data: null, error: null } }
    let d = rows(); if (st.order) d = d.slice().sort((a, b) => (a[st.order] > b[st.order] ? 1 : -1)); return { data: d, error: null }
  }
  const b = {
    select() { return b }, eq(c, v) { st.filters.push(r => r[c] === v); return b }, is(c, v) { st.filters.push(r => (r[c] ?? null) === v); return b },
    not(c, op, v) { st.filters.push(r => (r[c] ?? null) !== v); return b }, in(c, vs) { st.filters.push(r => vs.includes(r[c])); return b },
    order(c) { st.order = c; return b }, limit() { return b },
    insert(p) { st.op = 'insert'; st.payload = p; return b }, update(p) { st.op = 'update'; st.payload = p; return b }, upsert(p) { st.op = 'upsert'; st.payload = p; return b },
    maybeSingle() { const r = run(); return Promise.resolve({ data: (r.data || [])[0] ?? null, error: null }) },
    then(res, rej) { return Promise.resolve(run()).then(res, rej) },
  }
  return b
}
const db = { from: q }
module.exports = { createAdminClient: () => db, T }
