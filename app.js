/* Cohesively Cashflow — App-Logik (Vanilla JS, keine Frameworks)
   v2: Notion-Schicht integriert (Sparziele mit Intention, Meilenstein-Formeln,
   Wishlist mit URL/Zeitrahmen, Budget-Auto-Roll, Money-Date-Reflexion) */

let state = loadState();
let view = "dashboard";
let group = "Gesamt";
let terraceGroup = "Gesamt"; // Personen-Filter der Reisterrassen
let selMonth = null;      // ausgewählter Monat (Cashflow/Budgets)
let formType = "item";    // aktiver Buchungstyp im Formular

/* ================= Helpers ================= */
const EUR0 = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const EUR2 = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n, dec) => (dec ? EUR2 : EUR0).format(n || 0);
const pct = (p) => (p == null || !isFinite(p)) ? "– %" : Math.round(p * 100) + " %";
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const MONTH_NAMES = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
function mLabel(m) { const [y, mo] = m.split("-"); return MONTH_NAMES[+mo - 1] + " " + y.slice(2); }

function monthRange(from, to) {
  const out = []; let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) { out.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}
const NOW_MONTH = new Date().toISOString().slice(0, 7);

function addMonths(m, n) {
  let [y, mo] = m.split("-").map(Number);
  mo += n; while (mo > 12) { mo -= 12; y++; } while (mo < 1) { mo += 12; y--; }
  return `${y}-${String(mo).padStart(2, "0")}`;
}

/* Monatsbereich dynamisch aus den Daten: von der ersten Buchung bis heute + 6 Monate */
let ALL_MONTHS = [];
function recalcMonths() {
  const ms = [NOW_MONTH];
  [...state.incomes, ...state.fixed, ...state.items, ...state.business, ...state.transfers]
    .forEach(r => { if (r.month) ms.push(r.month); });
  Object.values(state.budgets).forEach(b => ms.push(...Object.keys(b)));
  const min = ms.reduce((a, b) => a < b ? a : b);
  const max = ms.reduce((a, b) => a > b ? a : b);
  const end = addMonths(NOW_MONTH, 6);
  ALL_MONTHS = monthRange(min, end > max ? end : max);
}

function latestDataMonth() {
  let max = null;
  [...state.incomes, ...state.fixed, ...state.items, ...state.business].forEach(r => { if (r.month && r.amount && (!max || r.month > max)) max = r.month; });
  return max || NOW_MONTH;
}

/* Anzeige-Namen: interne Schlüssel (Person A/B) bleiben stabil, Labels kommen aus dem Haushalt */
function personLabel(p) {
  const h = state.household || {};
  if (p === "Person A" && h.personA) return h.personA;
  if (p === "Person B" && h.personB) return h.personB;
  return p;
}
function groupLabel(g) {
  if (g === "Person A" || g === "Person B") {
    const n = personLabel(g);
    return n === g ? g : `${g} · ${n}`;
  }
  return GROUPS[g] ? GROUPS[g].label : g;
}
function personOptions(sel, withBusiness = true) {
  const list = withBusiness ? ["Person A", "Person B", "Familie", "Business A", "Business B"] : ["Person A", "Person B", "Familie"];
  return list.map(p => `<option value="${p}" ${p === sel ? "selected" : ""}>${esc(personLabel(p))}</option>`).join("");
}

function inGroup(person, g) {
  if (g === "Gesamt") return true;
  const list = GROUPS[g].persons;
  return list.includes(person) || (!person && g === "Familie");
}

/* Bucket-Summen eines Monats für eine Gruppe */
function bucketTotals(month, g) {
  const t = { Income: 0, Business: 0, Needs: 0, Savings: 0, Wealth: 0, Wants: 0 };
  state.incomes.forEach(r => { if (r.month === month && inGroup(r.person, g)) t.Income += r.amount; });
  state.business.forEach(r => { if (r.month === month && inGroup(r.person, g)) t.Business += r.amount; });
  [...state.fixed, ...state.items].forEach(r => {
    if (r.month === month && inGroup(r.person, g) && t[r.bucket] !== undefined) t[r.bucket] += r.amount;
  });
  t.Expenses = t.Business + t.Needs + t.Savings + t.Wealth + t.Wants;
  t.Cashflow = t.Income - t.Expenses;
  return t;
}

function dataMonths() { return ALL_MONTHS.filter(m => m <= latestDataMonth()); }

function avgCashflow(g) {
  const ms = dataMonths();
  if (!ms.length) return 0;
  return ms.reduce((s, m) => s + bucketTotals(m, g).Cashflow, 0) / ms.length;
}

/* Monatliche Fixkosten (wiederkehrend, anteilig) je Gruppe — Needs aus privat + Business */
function fixMonthly(g) {
  const seen = {}; let sum = 0;
  [...state.fixed, ...state.business].forEach(r => {
    if (!inGroup(r.person, g) || r.freq === "einmalig" || r.bucket !== "Needs") return;
    const key = (r.title || r.cat) + "|" + (r.person || "");
    if (!seen[key] || r.month > seen[key].month) seen[key] = r;
  });
  Object.values(seen).forEach(r => sum += (r.monthly || 0));
  return sum;
}

/* Liquide Mittel: Giro + Tagesgeld + Gemeinschaftskonto (keine Kreditkarten/Depots) */
function liquid(g) {
  return state.accounts
    .filter(a => inGroup(a.owner, g) && ["Girokonto", "Tagesgeld", "Gemeinschaft"].includes(a.type))
    .reduce((s, a) => s + a.balance, 0);
}

/* ---------- Sparziele (Notion: Saving Goals DB, mit Personen-Dimension) ---------- */
function goalSaved(s) { return (s.savedManual || 0) + (s.savedAuto || 0); }
function phaseGoals(phase, g = "Gesamt") { return state.savingGoals.filter(s => s.phase === phase && inGroup(s.person, g)); }
function phaseSaved(phase, g = "Gesamt") { return phaseGoals(phase, g).reduce((a, s) => a + goalSaved(s), 0); }
function phaseRate(phase, g = "Gesamt") { return phaseGoals(phase, g).reduce((a, s) => a + (s.rate || 0), 0); }
function totalGoalSaved(g = "Gesamt") { return state.savingGoals.filter(s => inGroup(s.person, g)).reduce((a, s) => a + goalSaved(s), 0); }

/* Ø Wunschausgaben (Wants) pro Monat — Basis der Freiheits-Formel */
function wantsMonthly(g = "Gesamt") {
  const ms = dataMonths();
  return ms.length ? ms.reduce((s, m) => s + bucketTotals(m, g).Wants, 0) / ms.length : 0;
}

/* ---------- Meilensteine / Terrassen (Notion-Formeln, je Person oder Gesamt) ----------
   Schutz     = Faktor × Fixkosten           · gefüllt durch Sparziele der Phase Schutz
   Sicherheit = Faktor × Fixkosten           · gefüllt durch Sparziele der Phase Sicherheit
   Freiheit   = Faktor × Wunschausgaben/Monat· gefüllt durch Sparziele der Phase Freiheit */
function terraces(g = "Gesamt") {
  const F = state.goals.factors;
  const fix = fixMonthly(g);
  const liq = liquid(g);
  const cf = avgCashflow(g);
  const wants = wantsMonthly(g);
  const ms = dataMonths();
  const living = ms.length ? ms.reduce((s, m) => { const t = bucketTotals(m, g); return s + t.Needs + t.Wants; }, 0) / ms.length : 0;

  const mk = (phase, goal) => {
    const saved = phaseSaved(phase, g), rate = phaseRate(phase, g);
    return {
      phase, value: saved, goal,
      progress: clamp(goal ? saved / goal : 0, 0, 1),
      rate, monthsTo: rate > 0 && saved < goal ? (goal - saved) / rate : null
    };
  };
  return {
    group: g, fix, liq, cf, wants, living,
    passive: state.goals.passiveIncome || 0,
    protection: Object.assign(mk("Schutz", Math.max(100, Math.ceil(F.schutz * fix / 100) * 100)), { monthsCovered: fix > 0 ? liq / fix : null }),
    security: mk("Sicherheit", F.sicherheit * fix),
    freedom: mk("Freiheit", F.freiheit * wants)
  };
}

function semClass(p) { return p >= 1 ? "excellent" : p >= 0.66 ? "good" : p >= 0.33 ? "fair" : "poor"; }
function budgetClass(ist, soll) {
  if (!soll) return ist > 0 ? "fair" : "good";
  const r = ist / soll;
  return r <= 0.7 ? "excellent" : r <= 1 ? "good" : r <= 1.2 ? "fair" : "poor";
}

/* Budget-SOLL mit Auto-Roll: gilt der letzte gesetzte Monat weiter (löst den
   Notion-Schmerz „Budgets monatlich duplizieren“) */
function budgetSoll(cat, m) {
  const b = state.budgets[cat] || {};
  if (b[m] !== undefined) return { value: b[m], rolled: false };
  let best = null;
  Object.keys(b).forEach(k => { if (k < m && (!best || k > best)) best = k; });
  return best ? { value: b[best], rolled: true, from: best } : { value: 0, rolled: false };
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

/* ================= Render-Gerüst ================= */
const app = document.getElementById("app");

const VIEWS = {
  dashboard: "Dashboard", terrassen: "Reisterrassen", cashflow: "Cashflow",
  budgets: "Budgets", wishlist: "Wishlist", buchungen: "Buchungen", daten: "Daten"
};

function render() {
  recalcMonths();
  if (!state.onboarded) view = "onboarding";
  document.querySelectorAll("nav.tabs .pill").forEach(b => b.classList.toggle("active", b.dataset.v === view));
  if (!selMonth) selMonth = latestDataMonth();
  ({ dashboard: rDashboard, terrassen: rTerraces, cashflow: rCashflow, budgets: rBudgets, wishlist: rWishlist, buchungen: rBookings, daten: rData, onboarding: rOnboarding })[view]();
  animateCounts();
  document.getElementById("staleChip").outerHTML = staleChip();
}

function staleChip() {
  const last = latestDataMonth();
  const stale = last < NOW_MONTH;
  return `<span id="staleChip" class="chip ${stale ? "stale" : ""}" title="Letzter Monat mit Buchungen">${stale ? "⚠ Daten bis " + mLabel(last) : "Daten aktuell"}</span>`;
}

function groupPills(current, onclickName) {
  return `<div class="selrow"><span class="lbl">Ansicht</span>` +
    Object.keys(GROUPS).map(k => `<button class="pill ${current === k ? "active" : ""}" onclick="${onclickName}('${k}')">${esc(groupLabel(k))}</button>`).join("") + `</div>`;
}
function setGroup(g) { group = g; render(); }
function setTerraceGroup(g) { terraceGroup = g; render(); }
function setMonth(m) { selMonth = m; render(); }
function setView(v) {
  if (!state.onboarded) { state.onboarded = true; saveState(state); } // Wizard bewusst verlassen
  view = v; render();
}
function setFormType(t) { formType = t; render(); }

function monthPills(current) {
  return `<div class="selrow"><span class="lbl">Monat</span>` + ALL_MONTHS.slice(0, 12).map(m =>
    `<button class="pill ${current === m ? "active" : ""}" onclick="setMonth('${m}')">${mLabel(m)}</button>`).join("") + `</div>`;
}

/* Zahlen-Count-up */
function animateCounts() {
  document.querySelectorAll("[data-count]").forEach(el => {
    const target = parseFloat(el.dataset.count); const dec = el.dataset.dec === "1";
    const start = performance.now(), dur = 700;
    function step(t) {
      const p = clamp((t - start) / dur, 0, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (dec ? EUR2 : EUR0).format(target * e);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

/* ================= Verdict (Haushaltsebene) ================= */
function verdict() {
  const T = terraces();
  if (T.liq < 0) return {
    cls: "poor",
    head: "Der Regen versickert: Deine liquiden Mittel sind negativ.",
    why: `${fmt(T.liq)} über alle Giro- & Tagesgeldkonten. In den Schutz-Becken liegen zwar ${fmt(T.protection.value)}, aber echtes Wasser hält die Terrasse erst, wenn die Konten über null sind.`
  };
  if (T.protection.progress < 1) return {
    cls: "fair",
    head: `Priorität: Schutz-Terrasse füllen — noch ${fmt(T.protection.goal - T.protection.value)} bis ${state.goals.factors.schutz} Monate Fixkosten gedeckt sind.`,
    why: `Ziel ${fmt(T.protection.goal)} = ${state.goals.factors.schutz} × ${fmt(T.fix)} Fixkosten. Angespart in Schutz-Zielen: ${fmt(T.protection.value)}.`
  };
  if (T.security.progress < 1) return {
    cls: "good",
    head: "Schutz steht ✓ — jetzt füllt sich die Sicherheits-Terrasse.",
    why: `${fmt(T.security.value)} von ${fmt(T.security.goal)} (${state.goals.factors.sicherheit} × Fixkosten) angespart.`
  };
  return { cls: "excellent", head: "Willkommen im Schöpfermodus — deine Terrassen tragen.", why: `Freiheits-Fortschritt: ${pct(T.freedom.progress)}.` };
}

function sparkline(values, w = 560, h = 120) {
  if (!values.length) return "";
  const min = Math.min(0, ...values), max = Math.max(0, ...values, 1);
  const x = i => 20 + i * (w - 40) / Math.max(values.length - 1, 1);
  const y = v => h - 22 - (v - min) / (max - min) * (h - 44);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = values.length - 1;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px">
    <line x1="20" x2="${w - 20}" y1="${y(0)}" y2="${y(0)}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4 4"/>
    <polyline points="${pts}" fill="none" stroke="url(#lg)" stroke-width="2" vector-effect="non-scaling-stroke"/>
    <circle cx="${x(last)}" cy="${y(values[last])}" r="4" fill="${values[last] >= 0 ? "var(--good)" : "var(--poor)"}"/>
    <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--accent2)"/><stop offset="1" stop-color="var(--accent)"/></linearGradient></defs>
    ${dataMonths().map((m, i) => `<text class="axis" x="${x(i)}" y="${h - 6}" text-anchor="middle">${mLabel(m)}</text>`).join("")}
  </svg>`;
}

/* Bucket-Abfluss (Allocation of Resources): Mini-Sankey.
   Links das verfügbare Einkommen als Quelle, daraus fließen Bänder proportional
   (€ und %) in die Buckets; der Rest fließt als „Übrig“ (grün) ab.
   Identität über direktes Label am Band, nie Farbe allein. */
function bucketFlow(month, g) {
  const t = bucketTotals(month, g);
  const order = [
    { key: "Business", color: "#9db3c7", label: "Business" },
    { key: "Needs", color: BUCKET_COLORS.Needs, label: "Needs" },
    { key: "Wants", color: BUCKET_COLORS.Wants, label: "Wants" },
    { key: "Savings", color: BUCKET_COLORS.Savings, label: "Savings" },
    { key: "Wealth", color: BUCKET_COLORS.Wealth, label: "Wealth" }
  ];
  const deficit = Math.max(0, -t.Cashflow);
  const flows = order.filter(o => t[o.key] > 0).map(o => ({ ...o, val: t[o.key] }));
  if (t.Cashflow > 0) flows.push({ key: "Rest", color: "var(--good)", label: "Übrig", val: t.Cashflow, rest: true });
  if (!flows.length) return `<div class="muted small">Keine Geldflüsse in diesem Monat.</div>`;

  const total = t.Income + deficit;           // Quelle = Einkommen (+ ggf. Substanz bei Defizit)
  const SRC_H = 180, GAP_S = 2, SLOT_MIN = 34, GAP_T = 8, TOP = 40;
  const px = v => v / total * SRC_H;
  const x0 = 34, x1 = 302, mx = (x0 + x1) / 2;

  // Quelle: Segmente übereinander · Ziele: Slots mit Mindesthöhe (Platz fürs Label)
  let sy = TOP, ty = TOP, shapes = "", labels = "";
  flows.forEach(f => {
    const h = Math.max(px(f.val), 3);
    const slot = Math.max(h, SLOT_MIN);
    const ty0 = ty + (slot - h) / 2;
    shapes += `<path class="band" d="M ${x0} ${sy} C ${mx} ${sy} ${mx} ${ty0} ${x1} ${ty0} l 0 ${h} C ${mx} ${ty0 + h} ${mx} ${sy + h} ${x0} ${sy + h} Z" fill="${f.color}">
      <title>${f.label}: ${fmt(f.val, true)} = ${pct(f.val / (t.Income || 1))} vom Einkommen</title></path>
      <rect x="${x1}" y="${ty0}" width="7" height="${h}" rx="2.5" fill="${f.color}"/>`;
    labels += `<text x="316" y="${ty + slot / 2 - 3}" fill="var(--text)" font-size="11.5" font-weight="700">${f.label}</text>
      <text x="316" y="${ty + slot / 2 + 11}" fill="var(--muted)" font-size="10.5">${fmt(f.val)} · ${pct(f.val / (t.Income || 1))}</text>`;
    sy += h + GAP_S; ty += slot + GAP_T;
  });

  const srcH = sy - GAP_S - TOP;
  const incH = deficit > 0 ? px(t.Income) : srcH;
  const H = Math.max(ty - GAP_T, sy) + 14;
  return `<div class="flow"><svg viewBox="0 0 420 ${H}" xmlns="http://www.w3.org/2000/svg">
    <text x="6" y="14" fill="var(--text)" font-size="11.5" font-weight="700">Einkommen</text>
    <text x="6" y="28" fill="var(--muted)" font-size="10.5">${fmt(t.Income)} verfügbar</text>
    <rect x="6" y="${TOP}" width="26" height="${Math.max(incH, 3)}" rx="4" fill="url(#flg)"/>
    ${deficit > 0 ? `<rect x="6" y="${TOP + incH + 2}" width="26" height="${Math.max(px(deficit) - 2, 3)}" rx="4" fill="var(--poor)"/>
      <text x="6" y="${H - 2}" fill="var(--poor)" font-size="10.5" font-weight="700">+ ${fmt(deficit)} aus Substanz</text>` : ""}
    ${shapes}${labels}
    <defs><linearGradient id="flg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--accent2)"/><stop offset="1" stop-color="var(--accent)"/>
    </linearGradient></defs>
  </svg></div>`;
}

/* ================= Dashboard ================= */
function rDashboard() {
  const g = group, T = terraces(g), v = verdict();
  const last = latestDataMonth();
  const t = bucketTotals(last, g);
  const cf = avgCashflow(g), liq = liquid(g), fix = fixMonthly(g);
  const cfs = dataMonths().map(m => bucketTotals(m, g).Cashflow);
  const netWorth = state.accounts.filter(a => inGroup(a.owner, g)).reduce((s, a) => s + a.balance, 0) + totalGoalSaved(g);

  app.innerHTML = `
  ${groupPills(g, "setGroup")}
  <div class="verdict ${v.cls}"><span class="headline">${v.head}</span><span class="why">${v.why}</span></div>
  <div class="grid">
    <div class="card s3 stat">
      <div class="label">Ø Cashflow / Monat</div>
      <div class="value ${cf >= 0 ? "pos" : "neg"}" data-count="${cf}">0</div>
      <div class="subline">Einnahmen minus alle Ausgaben, Ø über ${dataMonths().length} Monate (${groupLabel(g)})</div>
      <div class="note">Das ist dein monatlicher „Regen“ — er füllt die Terrassen.</div>
    </div>
    <div class="card s3 stat">
      <div class="label">Liquidität heute</div>
      <div class="value ${liq >= 0 ? "" : "neg"}" data-count="${liq}">0</div>
      <div class="subline">Giro-, Tagesgeld- & Gemeinschaftskonten</div>
      <div class="note">${fix > 0 ? `Deckt ${(liq / fix).toFixed(1)} Monate der Fixkosten von ${fmt(fix)}.` : "Keine Fixkosten erfasst."}</div>
    </div>
    <div class="card s3 stat">
      <div class="label">Net Worth</div>
      <div class="value" data-count="${netWorth}">0</div>
      <div class="subline">Kontostände + Sparziele</div>
      <div class="note">In Sparzielen angespart: ${fmt(totalGoalSaved(g))} (${groupLabel(g)}).</div>
    </div>
    <div class="card s3 stat">
      <div class="label">Verfügbar / Tag</div>
      <div class="value ${cf >= 0 ? "" : "neg"}">${fmt(cf / 30, true)}</div>
      <div class="subline">Ø Cashflow ÷ 30 Tage</div>
      <div class="note">So viel darf im Schnitt pro Tag zusätzlich fließen, ohne die Ziele zu bremsen.</div>
    </div>

    <div class="card s8">
      <div class="ct">Cashflow-Verlauf <span class="hint">pro Monat, ${groupLabel(g)}</span></div>
      ${sparkline(cfs)}
      <div class="legend">
        <span class="k"><span class="dot" style="background:var(--good)"></span>aktueller Wert</span>
        <span class="k">gestrichelte Linie = Nulllinie</span>
      </div>
    </div>
    <div class="card s4">
      <div class="ct">Wohin fließt dein Geld? <span class="hint">${mLabel(last)} — Abfluss vom verfügbaren Einkommen</span></div>
      ${t.Income || t.Expenses ? bucketFlow(last, g) : `<div class="muted small">Keine Geldflüsse in ${mLabel(last)} für diese Ansicht.</div>`}
      <div class="note small muted" style="border-top:1px solid var(--stroke);margin-top:10px;padding-top:8px;line-height:1.5">
        Bandbreite = Anteil am Einkommen. Richtwerte (adaptierte 50-30-20-Regel): Needs ≤ 50 %, Wants ≤ 30 %, Savings + Wealth ≥ 20 %. Das grüne Band „Übrig“ ist dein Regen für die Terrassen.
      </div>
    </div>

    <div class="card s12">
      <div class="ct">Die Reisterrassen <span class="hint">${groupLabel(g)} · dein Weg: Schutz → Sicherheit → Freiheit</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px">
        ${miniTerrace("1 · Finanzieller Schutz", T.protection.progress, `${fmt(T.protection.value)} von ${fmt(T.protection.goal)}`, PHASE_COPY.Schutz.lead)}
        ${miniTerrace("2 · Finanzielle Sicherheit", T.security.progress, `${fmt(T.security.value)} von ${fmt(T.security.goal)}`, PHASE_COPY.Sicherheit.lead)}
        ${miniTerrace("3 · Finanzielle Freiheit", T.freedom.progress, `${fmt(T.freedom.value)} von ${fmt(T.freedom.goal)}`, PHASE_COPY.Freiheit.lead)}
      </div>
      <div class="mt"><button class="btn" onclick="setView('terrassen')">Zu den Reisterrassen →</button></div>
    </div>
  </div>`;
}

function miniTerrace(name, p, val, why) {
  const cls = semClass(p);
  return `<div class="tile">
    <div style="font-size:var(--fs-label);text-transform:uppercase;letter-spacing:1.2px;color:var(--muted);font-weight:700">${name}</div>
    <div style="display:flex;align-items:baseline;gap:10px;margin:7px 0 8px">
      <span style="font-size:20px;font-weight:800;color:var(--${cls})">${pct(p)}</span>
      <span class="small muted">${val}</span>
    </div>
    <div class="hbar"><i class="${cls}" style="width:${p * 100}%"></i></div>
    <div class="small muted" style="margin-top:7px;line-height:1.5">${why}</div>
  </div>`;
}

/* ================= Reisterrassen ================= */
function terraceSVG(T) {
  const basins = [
    { x: 30, y: 250, w: 330, h: 120, p: T.protection.progress, name: "Schutz" },
    { x: 335, y: 145, w: 330, h: 120, p: T.security.progress, name: "Sicherheit" },
    { x: 640, y: 40, w: 330, h: 120, p: T.freedom.progress, name: "Freiheit" }
  ];
  let svg = `<svg viewBox="0 0 1000 420" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--accent2)" stop-opacity="0.9"/>
        <stop offset="1" stop-color="var(--accent)" stop-opacity="0.75"/>
      </linearGradient>
      <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="rgba(255,255,255,0.10)"/>
        <stop offset="1" stop-color="rgba(255,255,255,0.03)"/>
      </linearGradient>
    </defs>`;
  svg += `<path d="M 30 390 L 970 390 L 970 175 L 665 175 L 665 280 L 360 280 L 360 390 Z" fill="url(#soil)" stroke="var(--stroke)" stroke-width="1" opacity="0.5"/>`;
  basins.forEach((b, i) => {
    const wh = b.h * clamp(b.p, 0.02, 1);
    const cls = semClass(b.p);
    svg += `
    <g>
      <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="14" fill="url(#soil)" stroke="var(--stroke)"/>
      <clipPath id="clip${i}"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="14"/></clipPath>
      <rect class="water" clip-path="url(#clip${i})" x="${b.x}" y="${b.y + b.h - wh}" width="${b.w}" height="${wh}" fill="url(#water)"/>
      <path clip-path="url(#clip${i})" d="M ${b.x} ${b.y + b.h - wh} q 20 -5 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.6" vector-effect="non-scaling-stroke"/>
      <text x="${b.x + 16}" y="${b.y + 26}" fill="var(--text)" font-size="15" font-weight="700">${i + 1} · ${b.name}</text>
      <text x="${b.x + 16}" y="${b.y + 46}" fill="var(--${cls})" font-size="17" font-weight="800">${pct(b.p)}</text>
    </g>`;
    if (i < 2 && b.p >= 1) {
      svg += `<line class="cascade" x1="${b.x + b.w - 10}" y1="${b.y}" x2="${b.x + b.w + 10}" y2="${b.y + 40}" stroke="var(--accent2)" stroke-width="2"/>`;
    }
  });
  const target = basins.find(b => b.p < 1) || basins[2];
  const rainX = target.x + target.w / 2;
  if (T.cf > 0) {
    for (let i = 0; i < 5; i++) {
      svg += `<line x1="${rainX - 40 + i * 20}" y1="${target.y - 46 + (i % 2) * 8}" x2="${rainX - 44 + i * 20}" y2="${target.y - 26 + (i % 2) * 8}" stroke="var(--accent)" stroke-width="1.6" opacity="0.7"/>`;
    }
    svg += `<text x="${rainX}" y="${target.y - 56}" text-anchor="middle" fill="var(--muted)" font-size="11">Ø ${fmt(T.cf)}/Monat Regen</text>`;
  } else {
    svg += `<text x="${rainX}" y="${target.y - 40}" text-anchor="middle" fill="var(--poor)" font-size="11">Kein Regen: Ø Cashflow ${fmt(T.cf)}/Monat</text>`;
  }
  svg += `</svg>`;
  return svg;
}

function gauge(p, label) {
  const R = 70, C = 2 * Math.PI * R, arc = C * 0.75;
  const off = arc * (1 - clamp(p, 0, 1));
  const cls = semClass(p);
  return `<div style="text-align:center">
    <svg viewBox="0 0 200 180" style="width:190px">
      <g transform="rotate(135 100 100)">
        <circle cx="100" cy="100" r="${R}" fill="none" stroke="var(--glass-strong)" stroke-width="16" stroke-linecap="round" stroke-dasharray="${arc} ${C}"/>
        <circle cx="100" cy="100" r="${R}" fill="none" stroke="var(--${cls})" stroke-width="16" stroke-linecap="round"
          stroke-dasharray="${arc} ${C}" stroke-dashoffset="${off}" style="transition:stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)"/>
      </g>
      <text x="100" y="98" text-anchor="middle" fill="var(--text)" font-size="30" font-weight="800">${pct(p)}</text>
      <text x="100" y="120" text-anchor="middle" fill="var(--muted)" font-size="11">${label}</text>
    </svg>
    <div><span class="badge ${cls}">${cls === "poor" ? "Am Anfang" : cls === "fair" ? "Im Aufbau" : cls === "good" ? "Auf Kurs" : "Erreicht"}</span></div>
  </div>`;
}

function goalRow(s) {
  const saved = goalSaved(s);
  const p = s.target ? clamp(saved / s.target, 0, 1) : null;
  const statusCls = s.status === "erreicht" ? "excellent" : s.status === "aktiv" ? "good" : s.status === "pausiert" ? "fair" : "poor";
  const idx = state.savingGoals.indexOf(s);
  return `<div class="tile" style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap">
      <span style="font-weight:700">${esc(s.name)} <span class="small muted" style="font-weight:400">· ${esc(s.person || "Familie")}</span></span>
      <span class="small muted">${fmt(saved)}${s.target ? " / " + fmt(s.target) : ""}${s.rate ? ` · ${fmt(s.rate)}/M Sparrate` : ""}
        <span class="badge ${statusCls}" style="margin-left:6px">${esc(s.status)}</span>
        <button class="pill" style="padding:2px 9px;font-size:11px" onclick="delGoal(${idx})" title="Sparziel löschen">✕</button>
      </span>
    </div>
    ${p == null ? `<div class="small muted" style="margin-top:6px">kein Zielbetrag gesetzt</div>` : `<div class="hbar" style="margin-top:8px"><i class="${semClass(p)}" style="width:${p * 100}%"></i></div>`}
    ${s.intention ? `<div class="small" style="margin-top:7px;color:var(--accent2)">☼ ${esc(s.intention)}</div>` : `<div class="small muted" style="margin-top:7px">Kein „Mein Why“ hinterlegt — die Intention trägt das Ziel.</div>`}
  </div>`;
}

function terraceCard(key, T, sub) {
  const copy = PHASE_COPY[T[key].phase];
  const t = T[key];
  return `<div class="card s4">
    <div class="ct">${copy.icon} Terrasse · ${t.phase} <span class="hint">${copy.formula}</span></div>
    ${gauge(t.progress, t.phase)}
    <div class="tile mt">
      <div class="small" style="line-height:1.7">
        Angespart: <b>${fmt(t.value)}</b> · Ziel: <b>${fmt(t.goal)}</b><br>
        ${sub}
        Zeit bis Ziel: <b>${t.monthsTo == null ? (t.progress >= 1 ? "erreicht ✓" : "– (keine Sparrate)") : Math.ceil(t.monthsTo) + " Monate"}</b>
      </div>
    </div>
    <div class="small mt" style="line-height:1.55"><b>${copy.lead}</b> <span class="muted">${copy.body}</span></div>
    <div class="mt">${phaseGoals(t.phase, T.group).map(goalRow).join("") || `<div class="small muted">Noch kein Sparziel in dieser Phase — unten anlegen.</div>`}</div>
  </div>`;
}

function rTerraces() {
  const g = terraceGroup, T = terraces(g), v = verdict();
  const F = state.goals.factors;
  const unassigned = state.savingGoals.filter(s => !s.phase && inGroup(s.person, g));
  app.innerHTML = `
  ${groupPills(g, "setTerraceGroup")}
  <div class="verdict ${v.cls}"><span class="headline">${v.head}</span><span class="why">${v.why}</span></div>
  <div class="grid">
    <div class="card s12 terrace-wrap">
      <div class="ct">Reisterrassen <span class="hint">${groupLabel(g)} · Wasser = angespartes Kapital der Sparziele je Phase · der Cashflow ist dein Regen</span></div>
      ${terraceSVG(T)}
      <div class="legend">
        <span class="k"><span class="dot" style="background:var(--poor)"></span>&lt; 33 %</span>
        <span class="k"><span class="dot" style="background:var(--fair)"></span>33–66 %</span>
        <span class="k"><span class="dot" style="background:var(--good)"></span>66–99 %</span>
        <span class="k"><span class="dot" style="background:var(--excellent)"></span>voll</span>
      </div>
    </div>

    ${terraceCard("protection", T, `Formel: <b>${F.schutz} × ${fmt(T.fix)}</b> Fixkosten<br>
      Liquide Mittel aktuell: <b class="${T.liq < 0 ? "neg" : ""}">${fmt(T.liq)}</b> <span class="muted">(${T.protection.monthsCovered == null ? "–" : T.protection.monthsCovered.toFixed(1)} Monate gedeckt)</span><br>`)}
    ${terraceCard("security", T, `Formel: <b>${F.sicherheit} × ${fmt(T.fix)}</b> Fixkosten<br>`)}
    ${terraceCard("freedom", T, `Formel: <b>${F.freiheit} × ${fmt(T.wants)}</b> Ø Wunschausgaben<br>
      Passives Einkommen: <b>${fmt(T.passive)}/Monat</b> <span class="muted">vs. Lebenshaltung ${fmt(T.living)}/Monat</span><br>`)}

    <div class="card s12 input-surface">
      <div class="ct">Neues Sparziel <span class="hint">aus Notion „Saving Goals DB“ — mit Phase, Zielbetrag und deinem Why</span></div>
      <div class="formgrid">
        <label>Sparziel<input id="g-name" placeholder="z. B. Notgroschen"></label>
        <label>Zielbetrag €<input id="g-target" type="number" step="1" min="0" placeholder="optional"></label>
        <label>Start-Bestand €<input id="g-saved" type="number" step="0.01" min="0" placeholder="0"></label>
        <label>Sparrate €/Monat<input id="g-rate" type="number" step="1" min="0" placeholder="0"></label>
        <label>Phase<select id="g-phase"><option value="">– offen –</option>${PHASES.map(p => `<option>${p}</option>`).join("")}</select></label>
        <label>Person<select id="g-person">${personOptions(g !== "Gesamt" ? g : "Person A", false)}</select></label>
        <label>Intention — Mein Why<input id="g-why" placeholder="Warum dieses Ziel?"></label>
        <label>&nbsp;<button class="btn" onclick="addGoal()">Ziel anlegen</button></label>
      </div>
      ${unassigned.length ? `<div class="mt"><div class="ct">Ohne Phase</div>${unassigned.map(goalRow).join("")}</div>` : ""}
      <div class="small muted mt">Einzahlen auf ein Ziel geht über <a href="#" style="color:var(--accent)" onclick="setView('buchungen');return false">Buchungen → Einzahlung auf Ziel/Wunsch</a> — die Transaktion erhöht automatisch den Stand.</div>
    </div>
  </div>`;
}

/* ================= Cashflow ================= */
function rCashflow() {
  const g = group;
  const last = latestDataMonth();
  const rows = ["Income", "Business", "Needs", "Savings", "Wealth", "Wants"];
  const totals = ALL_MONTHS.map(m => bucketTotals(m, g));
  const t = bucketTotals(selMonth, g);

  const steps = [
    { label: "Einkommen", val: t.Income, sub: false },
    { label: "− Business", val: t.Business, sub: true },
    { label: "− Needs", val: t.Needs, sub: true },
    { label: "− Savings", val: t.Savings, sub: true },
    { label: "− Wealth", val: t.Wealth, sub: true },
    { label: "− Wants", val: t.Wants, sub: true }
  ];
  let run = 0; const maxW = Math.max(t.Income, 1);
  const wf = steps.map(s => {
    if (!s.sub) { run = s.val; return `<div style="display:grid;grid-template-columns:130px 1fr 110px;gap:10px;align-items:center;margin-bottom:8px">
      <span class="small">${s.label}</span>
      <div class="hbar" style="height:16px"><i style="width:${clamp(s.val / maxW, 0, 1) * 100}%"></i></div>
      <span class="small num" style="text-align:right">${fmt(s.val)}</span></div>`; }
    const start = run; run -= s.val;
    return `<div style="display:grid;grid-template-columns:130px 1fr 110px;gap:10px;align-items:center;margin-bottom:8px">
      <span class="small muted">${s.label}</span>
      <div class="hbar" style="height:16px"><i style="width:${clamp(start / maxW, 0, 1) * 100}%;background:var(--glass-strong)"></i>
        <i style="position:absolute;left:${clamp(run / maxW, 0, 1) * 100}%;width:${clamp(s.val / maxW, 0, 1) * 100}%;top:0;background:rgba(226,86,75,0.55);border-radius:999px"></i></div>
      <span class="small num muted" style="text-align:right">−${fmt(s.val)}</span></div>`;
  }).join("");

  app.innerHTML = `
  ${groupPills(g, "setGroup")}
  ${monthPills(selMonth)}
  <div class="grid">
    <div class="card s4 stat">
      <div class="label">Cashflow ${mLabel(selMonth)}</div>
      <div class="value ${t.Cashflow >= 0 ? "pos" : "neg"}" data-count="${t.Cashflow}">0</div>
      <div class="subline">${fmt(t.Income)} Einnahmen − ${fmt(t.Expenses)} Ausgaben</div>
      <div class="note">Nur echte Zu- und Abflüsse — interne Umbuchungen (Transfers) zählen nicht.</div>
    </div>
    <div class="card s8">
      <div class="ct">Monatsreport <span class="hint">Wasserfall: was vom Einkommen übrig bleibt (${mLabel(selMonth)}, ${groupLabel(g)})</span></div>
      ${t.Income || t.Expenses ? wf + `<div style="display:grid;grid-template-columns:130px 1fr 110px;gap:10px;align-items:center;border-top:1px solid var(--stroke);padding-top:8px;margin-top:4px">
        <span class="small" style="font-weight:700">= Cashflow</span>
        <div class="hbar" style="height:16px"><i class="${t.Cashflow >= 0 ? "good" : "poor"}" style="width:${clamp(Math.abs(t.Cashflow) / maxW, 0, 1) * 100}%"></i></div>
        <span class="small num ${t.Cashflow >= 0 ? "pos" : "neg"}" style="text-align:right;font-weight:700">${fmt(t.Cashflow)}</span></div>`
      : `<div class="muted small">Keine Buchungen in ${mLabel(selMonth)}.</div>`}
    </div>

    <div class="card s12">
      <div class="ct">Cashflow-Matrix <span class="hint">Buckets × Monate · Monate ohne Daten abgedunkelt</span></div>
      <div class="scroll-x"><table class="data">
        <tr><th>Bucket</th>${ALL_MONTHS.map(m => `<th class="num" style="${m === selMonth ? "color:var(--accent2)" : ""}">${mLabel(m)}</th>`).join("")}</tr>
        ${rows.map(b => `<tr><td><span class="dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${BUCKET_COLORS[b]};margin-right:7px"></span>${b}</td>` +
          totals.map((tt, i) => `<td class="num ${ALL_MONTHS[i] > last ? "past" : ""}">${tt[b] ? fmt(tt[b]) : "–"}</td>`).join("") + `</tr>`).join("")}
        <tr><td style="font-weight:700">Cashflow</td>${totals.map((tt, i) => {
          const c = tt.Cashflow;
          return `<td class="num ${ALL_MONTHS[i] > last ? "past" : ""}" style="font-weight:700;color:${!c ? "var(--muted)" : c > 0 ? "var(--good)" : "var(--poor)"}">${c ? fmt(c) : "–"}</td>`;
        }).join("")}</tr>
      </table></div>
    </div>
  </div>`;
}

/* ================= Budgets ================= */
function rBudgets() {
  const cats = Object.keys(state.budgets);
  const monthIst = (cat, m) => state.items.filter(i => i.cat === cat && i.month === m).reduce((s, i) => s + i.amount, 0);
  const totalSoll = cats.reduce((s, c) => s + budgetSoll(c, selMonth).value, 0);
  const totalIst = cats.reduce((s, c) => s + monthIst(c, selMonth), 0);
  const anyRolled = cats.some(c => budgetSoll(c, selMonth).rolled);
  const vcls = totalSoll === 0 ? "fair" : totalIst <= totalSoll ? "good" : "poor";
  const refl = state.reflections[selMonth] || { notes: "", reflection: "" };
  const SEGS = 8;
  const surplus = cats.reduce((s, c) => s + Math.max(budgetSoll(c, selMonth).value - monthIst(c, selMonth), 0), 0);
  const pots = [
    ...state.savingGoals.map(s => `<option value="goal:${esc(s.name)}">Sparziel · ${esc(s.name)}</option>`),
    ...state.wishlist.map(w => `<option value="wish:${esc(w.title)}">Wunsch · ${esc(w.title)}</option>`)
  ].join("");

  app.innerHTML = `
  ${monthPills(selMonth)}
  <div class="verdict ${vcls}">
    <span class="headline">${totalSoll === 0 ? `Für ${mLabel(selMonth)} sind keine Budgets gesetzt.` : totalIst <= totalSoll ? `Im Rahmen: ${fmt(totalIst)} von ${fmt(totalSoll)} Budget genutzt.` : `Über Budget: ${fmt(totalIst)} ausgegeben, geplant waren ${fmt(totalSoll)}.`}</span>
    <span class="why">Budgets sind keine Begrenzung, sondern ein Bewusstseins-Tool: sie lenken dein Geld dorthin, wo es am meisten Wirkung entfaltet.${anyRolled ? " · SOLL rollt automatisch aus dem letzten gesetzten Monat weiter." : ""}</span>
  </div>
  <div class="grid">
    <div class="card s12">
      <div class="ct">Budgets · ${mLabel(selMonth)} <span class="hint">Wasser = Ausgaben · grüner Luftraum = übrig · rot unter der Nulllinie = drüber · SOLL oben direkt editierbar</span></div>
      <div class="bcols">
        ${cats.map(cat => {
          const so = budgetSoll(cat, selMonth), s = so.value, i = monthIst(cat, selMonth);
          const unit = s > 0 ? s / SEGS : (i || 1);
          const fillSegs = s > 0 ? Math.min(SEGS, Math.round(i / unit)) : 0;
          const overSegs = i > s ? Math.min(6, Math.ceil((i - s) / unit)) : 0;
          const left = s - i;
          const segs = Array.from({ length: SEGS }, (_, k) =>
            `<div class="seg ${k < fillSegs ? "fill" : (left > 0 ? "air" : "")}"></div>`).join("");
          return `<div class="bcol" title="${esc(cat)}: ${fmt(i, true)} von ${fmt(s, true)}">
            <div class="name">${esc(cat)}</div>
            <div class="soll-edit"><input type="number" min="0" step="10" value="${s}" onchange="setBudget('${esc(cat)}', this.value)"><span class="small muted">€ SOLL${so.rolled ? "*" : ""}</span></div>
            <div class="vessel">${segs}</div>
            <div class="zero"></div>
            ${overSegs ? `<div class="below">${`<div class="seg over"></div>`.repeat(overSegs)}</div>` : ""}
            <div class="foot">
              <b>${fmt(i)}</b> ausgegeben<br>
              <span class="${left < 0 ? "neg" : left > 0 ? "pos" : "muted"}">${left >= 0 ? fmt(left) + " übrig" : fmt(-left) + " drüber"}</span>
            </div>
          </div>`;
        }).join("")}
      </div>
      <div class="legend" style="margin-top:24px">
        <span class="k"><span class="dot" style="background:var(--accent)"></span>Wasser = ausgegeben</span>
        <span class="k"><span class="dot" style="background:rgba(88,198,107,0.5)"></span>grüner Luftraum = übrig</span>
        <span class="k"><span class="dot" style="background:var(--poor)"></span>unter der Nulllinie = über Budget</span>
        <span class="k">* SOLL aus Vormonat übernommen</span>
      </div>
    </div>

    <div class="card s12">
      <div class="ct">Budget-Ampel · Jahresverlauf <span class="hint">wie liefen die Monate? Monat anklicken, um ihn oben zu öffnen</span></div>
      <div class="scroll-x"><table class="data">
        <tr>
          <th>Budget</th>
          <th class="num">IST ${mLabel(selMonth)}</th>
          ${ALL_MONTHS.slice(0, 12).map(m => `<th class="num" style="cursor:pointer;${m === selMonth ? "color:var(--accent2)" : ""}" onclick="setMonth('${m}')">${mLabel(m)}</th>`).join("")}
        </tr>
        ${cats.map(cat => `<tr>
          <td>${esc(cat)}</td>
          <td class="num"><b>${fmt(monthIst(cat, selMonth))}</b></td>
          ${ALL_MONTHS.slice(0, 12).map(m => {
            const sv = budgetSoll(cat, m).value, iv = monthIst(cat, m);
            const has = (sv || iv) && m <= latestDataMonth();
            return `<td class="num" title="${esc(cat)} · ${mLabel(m)}: ${fmt(iv)} ausgegeben / ${fmt(sv)} SOLL">
              <span class="d" style="display:inline-block;width:13px;height:13px;border-radius:4px;background:${has ? `var(--${budgetClass(iv, sv)})` : "var(--glass-strong)"}"></span></td>`;
          }).join("")}
        </tr>`).join("")}
      </table></div>
      <div class="legend">
        <span class="k"><span class="dot" style="background:var(--excellent)"></span>≤ 70 % genutzt</span>
        <span class="k"><span class="dot" style="background:var(--good)"></span>im Budget</span>
        <span class="k"><span class="dot" style="background:var(--fair)"></span>bis 120 %</span>
        <span class="k"><span class="dot" style="background:var(--poor)"></span>&gt; 120 % drüber</span>
        <span class="k"><span class="dot" style="background:var(--glass-strong);border:1px solid var(--stroke)"></span>kein Budget / keine Daten</span>
      </div>
    </div>

    ${surplus > 0 ? `<div class="card s6 input-surface">
      <div class="ct">Überschuss lenken <span class="hint">der guided Moment: Ersparnis wird zu Terrassen-Wasser</span></div>
      <div class="small" style="margin-bottom:12px;line-height:1.5">In ${mLabel(selMonth)} sind <b class="pos">${fmt(surplus)}</b> aus deinen Budgets übrig.
        Was davon darf in einen Spartopf fließen?</div>
      <div class="formgrid">
        <label>Betrag €<input id="sp-amount" type="number" step="0.01" min="0" value="${surplus.toFixed(2)}"></label>
        <label>Spartopf<select id="sp-pot">${pots}</select></label>
        <label>Konto<select id="sp-account">${state.accounts.map(a => `<option ${a.name === state.ui.lastAccount ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>
        <label>&nbsp;<button class="btn" onclick="surplusToPot()">In Spartopf legen</button></label>
      </div>
    </div>` : ""}

    <div class="card ${surplus > 0 ? "s6" : "s12"} input-surface">
      <div class="ct">Money Date · ${mLabel(selMonth)} <span class="hint">Notizen & Reflexion — aus deinem Notion-Ritual</span></div>
      <div class="formgrid" style="grid-template-columns:1fr 1fr;align-items:start">
        <label>Notizen<input id="r-notes" value="${esc(refl.notes)}" placeholder="z. B. Sprit, ÖPNV · Mode, Bücher"></label>
        <label>Reflexion<input id="r-refl" value="${esc(refl.reflection)}" placeholder="Was hat dieser Monat über dein Geld erzählt?"></label>
      </div>
      <div class="mt"><button class="btn" onclick="saveReflection()">Reflexion speichern</button></div>
    </div>
  </div>`;
}

function setBudget(cat, val) {
  const v = parseFloat(val) || 0;
  if (!state.budgets[cat]) state.budgets[cat] = {};
  state.budgets[cat][selMonth] = v;
  saveState(state);
  toast(`SOLL für ${cat} in ${mLabel(selMonth)}: ${fmt(v)}`);
  render();
}

/* Einzahlung in Sparziel oder Wunsch — gemeinsame Logik für Buchungsform & Überschuss-Flow */
function depositToPot(potValue, amount, person, account, month) {
  const [kind, name] = potValue.split(/:(.+)/);
  if (kind === "goal") {
    const goal = state.savingGoals.find(s => s.name === name);
    if (!goal) return false;
    goal.savedManual = (goal.savedManual || 0) + amount;
  } else {
    const wish = state.wishlist.find(w => w.title === name);
    if (!wish) return false;
    wish.saved += amount; wish.status = "saving";
  }
  state.transfers.push({ date: month + "-01", month, amount, fromAcc: account, toAcc: account, bucket: "Savings", person, purpose: "Einzahlung " + name, goal: name });
  return true;
}

function surplusToPot() {
  const amount = parseFloat(document.getElementById("sp-amount").value);
  if (!amount || amount <= 0) { toast("Bitte einen Betrag angeben."); return; }
  const pot = document.getElementById("sp-pot").value;
  const account = document.getElementById("sp-account").value;
  if (!depositToPot(pot, amount, state.ui.lastPerson || "Familie", account, selMonth)) { toast("Spartopf nicht gefunden."); return; }
  const ok = saveState(state);
  toast(ok ? `✓ ${fmt(amount, true)} in „${pot.split(/:(.+)/)[1]}“ gelegt — dein Überschuss arbeitet jetzt.` : "Speichern fehlgeschlagen.");
  render();
}

function saveReflection() {
  state.reflections[selMonth] = {
    notes: document.getElementById("r-notes").value,
    reflection: document.getElementById("r-refl").value
  };
  const ok = saveState(state);
  toast(ok ? "Money-Date-Reflexion gespeichert ✓" : "Speichern fehlgeschlagen.");
}

/* ================= Wishlist ================= */
function rWishlist() {
  app.innerHTML = `
  <div class="grid">
    ${state.wishlist.map((w, idx) => {
      const p = w.target ? clamp(w.saved / w.target, 0, 1) : 0;
      const cls = semClass(p);
      let host = "";
      try { host = w.url ? new URL(w.url).hostname.replace("www.", "") : ""; } catch (e) { host = ""; }
      return `<div class="card s3 stat">
        <div class="label" style="display:flex;justify-content:space-between;gap:8px">
          <span>${esc(w.title)}</span>
          <button class="pill" style="padding:1px 8px;font-size:11px" onclick="delWish(${idx})" title="Wunsch löschen">✕</button>
        </div>
        <div class="value" data-count="${w.saved}">0</div>
        <div class="subline">von ${fmt(w.target)} · <span class="delta ${w.status === "saving" ? "up" : "down"}">${w.status === "saving" ? "spart" : "wartet"}</span>
          ${w.timeframe ? `<span class="delta up" style="background:rgba(56,249,215,0.12);color:var(--accent2)">${esc(w.timeframe)}</span>` : ""}</div>
        <div class="hbar" style="margin-top:10px"><i class="${cls}" style="width:${p * 100}%"></i></div>
        ${w.intention ? `<div class="small" style="margin-top:8px;color:var(--accent2)">☼ ${esc(w.intention)}</div>` : ""}
        <div class="note">${p >= 1 ? "Bereit zum Kauf ✓" : fmt(w.target - w.saved) + " fehlen noch."}
          ${host ? ` · <a href="${esc(w.url)}" target="_blank" rel="noopener" style="color:var(--accent)">${esc(host)} ↗</a>` : ""}</div>
      </div>`;
    }).join("")}

    <div class="card s12 input-surface">
      <div class="ct">Neuer Wunsch <span class="hint">mit Link, Zeitrahmen und Intention — wie in deiner Notion-WishlistDB</span></div>
      <div class="formgrid">
        <label>Wunsch<input id="w-title" placeholder="z. B. E-Lastenrad"></label>
        <label>Zielbetrag €<input id="w-target" type="number" step="1" min="1" placeholder="0"></label>
        <label>Bereits gespart €<input id="w-saved" type="number" step="0.01" min="0" placeholder="0"></label>
        <label>Zeitrahmen<select id="w-time"><option value="">–</option><option>kurzfristig (6–18 Monate)</option><option>mittelfristig (1–3 Jahre)</option><option>langfristig (3+ Jahre)</option></select></label>
        <label>Produkt-URL<input id="w-url" type="url" placeholder="https://…"></label>
        <label>Intention<input id="w-why" placeholder="Warum dieser Wunsch?"></label>
        <label>&nbsp;<button class="btn" onclick="addWish()">Wunsch anlegen</button></label>
      </div>
      <div class="small muted mt">
        Die Wishlist entkoppelt Wünsche vom Impulskauf: Erst sparen (Einzahlung über Buchungen), dann kaufen —
        der Kauf wird als „Kauf aus Wishlist“ gebucht und belastet kein Monatsbudget. So verbindest du Geld mit Freude und Sinn.
      </div>
    </div>
  </div>`;
}

function addWish() {
  const $ = id => document.getElementById(id).value;
  const title = $("w-title").trim(), target = parseFloat($("w-target"));
  if (!title || !target || target <= 0) { toast("Bitte Wunsch und Zielbetrag angeben."); return; }
  state.wishlist.push({ title, target, saved: parseFloat($("w-saved")) || 0, status: "wartend", timeframe: $("w-time"), url: $("w-url").trim(), intention: $("w-why").trim() });
  saveState(state); toast("Wunsch angelegt ✓"); render();
}
function delWish(idx) {
  const w = state.wishlist[idx];
  state.wishlist.splice(idx, 1);
  saveState(state); toast(`„${w.title}“ gelöscht.`); render();
}

/* ================= Sparziele: Aktionen ================= */
function addGoal() {
  const $ = id => document.getElementById(id).value;
  const name = $("g-name").trim();
  if (!name) { toast("Bitte einen Namen für das Sparziel angeben."); return; }
  state.savingGoals.push({
    name, target: parseFloat($("g-target")) || null,
    savedManual: 0, savedAuto: parseFloat($("g-saved")) || 0,
    rate: parseFloat($("g-rate")) || 0,
    phase: $("g-phase") || null, person: $("g-person"),
    status: "offen", intention: $("g-why").trim()
  });
  saveState(state); toast("Sparziel angelegt ✓"); render();
}
function delGoal(idx) {
  const s = state.savingGoals[idx];
  state.savingGoals.splice(idx, 1);
  saveState(state); toast(`„${s.name}“ gelöscht.`); render();
}

/* ================= Buchungen ================= */
function accordion(id, title, hint, body) {
  return `<div class="acc" id="acc-${id}">
    <button onclick="this.parentElement.classList.toggle('open')">${title}<span class="hint">${hint}</span><span class="caret">▾</span></button>
    <div class="body">${body}</div>
  </div>`;
}

function rBookings() {
  const table = (heads, rows) => `<div class="scroll-x"><table class="data"><tr>${heads.map(h => `<th class="${h.n ? "num" : ""}">${h.t}</th>`).join("")}</tr>${rows}</table></div>`;

  const del = (kind, i) => `<td><button class="pill" style="padding:1px 8px" title="Buchung löschen" onclick="delRow('${kind}',${i})">✕</button></td>`;
  const incRows = state.incomes.map((r, i) => `<tr><td>${r.month}</td><td class="num">${fmt(r.amount, true)}</td><td>${esc(r.title)}</td><td>${esc(r.freq)}</td><td>${esc(personLabel(r.person))}</td><td class="muted">${esc(r.account)}</td>${del("incomes", i)}</tr>`).join("");
  const fixRows = state.fixed.map((r, i) => `<tr><td>${r.month}</td><td class="num">${fmt(r.amount, true)}</td><td>${esc(r.title)}</td><td>${esc(r.cat)}</td><td>${esc(r.bucket)}</td><td>${esc(r.freq)}</td><td class="num muted">${fmt(r.monthly, true)}</td><td>${esc(personLabel(r.person))}</td>${del("fixed", i)}</tr>`).join("");
  const itemRows = state.items.map((r, i) => `<tr><td>${r.month}</td><td class="num">${fmt(r.amount, true)}</td><td>${esc(r.title)}</td><td>${esc(r.cat)}</td><td>${esc(r.bucket)}</td><td class="muted">${esc(r.source || "–")}</td><td>${esc(personLabel(r.person))}</td>${del("items", i)}</tr>`).join("");
  const bizRows = state.business.map((r, i) => `<tr><td>${r.month}</td><td class="num">${fmt(r.amount, true)}</td><td>${esc(r.title)}</td><td>${esc(r.cat)}</td><td>${esc(r.freq)}</td><td>${esc(personLabel(r.person))}</td>${del("business", i)}</tr>`).join("");
  const trRows = state.transfers.map((r, i) => `<tr><td>${r.month || "–"}</td><td class="num">${fmt(r.amount, true)}</td><td class="muted">${esc(r.fromAcc)}</td><td>→ ${esc(r.toAcc)}</td><td>${esc(r.bucket)}</td><td>${esc(r.purpose)}${r.goal ? ` <span class="delta up">→ ${esc(r.goal)}</span>` : ""}</td>${del("transfers", i)}</tr>`).join("");
  const accRows = state.accounts.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.type)}</td><td>${esc(r.owner)}</td><td class="num ${r.balance < 0 ? "neg" : ""}">${fmt(r.balance, true)}</td></tr>`).join("");

  const cats = Object.keys(state.catMap);
  const accounts = state.accounts.map(a => a.name);
  const isGoal = formType === "goal";
  const goalOptions = [
    ...state.savingGoals.map(s => `<option value="goal:${esc(s.name)}">Sparziel · ${esc(s.name)}</option>`),
    ...state.wishlist.map(w => `<option value="wish:${esc(w.title)}">Wunsch · ${esc(w.title)}</option>`)
  ].join("");

  app.innerHTML = `
  <div class="grid">
    <div class="card s12 input-surface">
      <div class="ct">Neue Buchung <span class="hint">wird lokal gespeichert (localStorage) — kein Server, deine Daten bleiben bei dir</span></div>
      <div class="formgrid">
        <label>Typ<select id="f-type" onchange="setFormType(this.value)">
          <option value="item" ${formType === "item" ? "selected" : ""}>Variable Ausgabe</option>
          <option value="income" ${formType === "income" ? "selected" : ""}>Einnahme</option>
          <option value="fixed" ${formType === "fixed" ? "selected" : ""}>Fixkosten</option>
          <option value="goal" ${formType === "goal" ? "selected" : ""}>Einzahlung auf Ziel/Wunsch</option>
          <option value="transfer" ${formType === "transfer" ? "selected" : ""}>Transfer</option>
        </select></label>
        <label>Monat<input id="f-month" type="month" value="${NOW_MONTH}"></label>
        <label>Betrag €<input id="f-amount" type="number" step="0.01" min="0" placeholder="0,00"></label>
        ${isGoal
          ? `<label>Ziel / Wunsch<select id="f-goal">${goalOptions}</select></label>`
          : `<label>Titel<input id="f-title" placeholder="z. B. Lebensmittel"></label>
             <label>Kategorie<select id="f-cat">${cats.map(c => `<option>${esc(c)}</option>`).join("")}</select></label>`}
        <label>Person<select id="f-person">${personOptions(state.ui.lastPerson)}</select></label>
        <label>Konto<select id="f-account">${accounts.map(a => `<option>${esc(a)}</option>`).join("")}</select></label>
        <label>&nbsp;<button class="btn" onclick="addBooking()">Speichern</button></label>
      </div>
      <div class="small muted mt">${isGoal
        ? "Die Einzahlung wird als Transfer gebucht (kein Cashflow) und erhöht automatisch den Stand des Ziels — wie die Relationen in deinem Notion."
        : "Der Bucket (Needs/Savings/Wealth/Wants) wird automatisch aus der Kategorie gemappt — wie im Sheet. Jeder Eintrag ist eine bewusste Entscheidung."}</div>
    </div>

    <div class="card s12">
      <div class="ct">Alle Daten <span class="hint">die Eingabe-Schicht deines Sheets, 1:1 übernommen</span></div>
      ${accordion("inc", "Einnahmen", state.incomes.length + " Buchungen", table([{ t: "Monat" }, { t: "Betrag", n: 1 }, { t: "Titel" }, { t: "Frequenz" }, { t: "Person" }, { t: "Konto" }, { t: "" }], incRows))}
      ${accordion("fix", "Ausgaben fix", state.fixed.length + " Buchungen", table([{ t: "Monat" }, { t: "Betrag", n: 1 }, { t: "Titel" }, { t: "Kategorie" }, { t: "Bucket" }, { t: "Frequenz" }, { t: "Anteilig/Monat", n: 1 }, { t: "Person" }, { t: "" }], fixRows))}
      ${accordion("items", "Ausgaben Einzelposten", state.items.length + " Buchungen", table([{ t: "Monat" }, { t: "Betrag", n: 1 }, { t: "Titel" }, { t: "Kategorie" }, { t: "Bucket" }, { t: "Quelle" }, { t: "Person" }, { t: "" }], itemRows))}
      ${accordion("biz", "Business", state.business.length + " Buchungen", table([{ t: "Monat" }, { t: "Betrag", n: 1 }, { t: "Titel" }, { t: "Kategorie" }, { t: "Frequenz" }, { t: "Person" }, { t: "" }], bizRows))}
      ${accordion("tr", "Transfers", state.transfers.length + " Umbuchungen · kein Cashflow", table([{ t: "Monat" }, { t: "Betrag", n: 1 }, { t: "Von" }, { t: "Nach" }, { t: "Bucket" }, { t: "Zweck" }, { t: "" }], trRows))}
      ${accordion("acc", "Konten", state.accounts.length + " Konten", table([{ t: "Konto" }, { t: "Typ" }, { t: "Person" }, { t: "Saldo", n: 1 }], accRows))}
    </div>

    <div class="card s12" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <span class="small muted">Daten sichern, importieren oder neu starten? →</span>
      <button class="btn ghost" onclick="setView('daten')">Zur Daten-Seite</button>
    </div>
  </div>`;
}

/* Buchung löschen — bei Ziel-Transfers wird der Spartopf-Stand zurückgerechnet */
function delRow(kind, i) {
  const r = state[kind][i];
  if (!r) return;
  if (kind === "transfers" && r.goal) {
    const goal = state.savingGoals.find(s => s.name === r.goal);
    if (goal) goal.savedManual = Math.max(0, (goal.savedManual || 0) - r.amount);
    else {
      const wish = state.wishlist.find(w => w.title === r.goal);
      if (wish) wish.saved = Math.max(0, wish.saved - r.amount);
    }
  }
  state[kind].splice(i, 1);
  saveState(state);
  toast("Buchung gelöscht.");
  render();
}

function addBooking() {
  const $ = id => document.getElementById(id);
  const type = formType, month = $("f-month").value, amount = parseFloat($("f-amount").value);
  const person = $("f-person").value, account = $("f-account").value;
  if (!month || !amount || amount <= 0) { toast("Bitte Monat und Betrag angeben."); return; }

  if (type === "goal") {
    if (!depositToPot($("f-goal").value, amount, person, account, month)) { toast("Ziel nicht gefunden."); return; }
  } else {
    const title = $("f-title").value.trim(), cat = $("f-cat") ? $("f-cat").value : "Lebenshaltung";
    const bucket = state.catMap[cat] || "Wants";
    if (type === "income") state.incomes.push({ month, amount, title: title || "Einnahme", freq: "einmalig", person, account });
    else if (type === "fixed") state.fixed.push({ month, amount, title: title || cat, cat, bucket, freq: "monatlich", monthly: amount, account, person });
    else if (type === "transfer") state.transfers.push({ date: month + "-01", month, amount, fromAcc: account, toAcc: account, bucket: "Savings", person, purpose: title || "Umbuchung" });
    else state.items.push({ month, amount, title: title || cat, cat, bucket, source: "Einmalige Ausgabe", account, person });
  }
  const ok = saveState(state);
  toast(ok ? "Gespeichert ✓ — " + fmt(amount, true) + " in " + mLabel(month) : "Speichern fehlgeschlagen — Änderung nur in dieser Sitzung.");
  render();
}

function doReset() {
  state = resetState("demo");
  toast("Beispieldaten (Excel + Notion) wiederhergestellt.");
  render();
}

/* ================= Onboarding (geführtes Interview, Kurswoche 1+2) ================= */
let obStep = 0;
const OB_STEPS = ["Willkommen", "Haushalt", "Konten", "Einnahmen", "Fixkosten", "Ziele", "Deine Terrassen"];

function obNav(canNext, nextLabel) {
  return `<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
    ${obStep > 0 ? `<button class="btn ghost" onclick="obStep--;render()">← Zurück</button>` : ""}
    <button class="btn" ${canNext ? "" : "disabled style='opacity:0.4;pointer-events:none'"} onclick="obStep++;render()">${nextLabel || "Weiter →"}</button>
  </div>`;
}

function obList(rows, delFn) {
  if (!rows.length) return "";
  return `<div class="mt">${rows.map((r, i) => `<div class="tile" style="margin-bottom:8px;display:flex;justify-content:space-between;gap:10px;align-items:center">
    <span class="small">${r}</span><button class="pill" style="padding:2px 9px" onclick="${delFn}(${i})">✕</button></div>`).join("")}</div>`;
}

function rOnboarding() {
  const h = state.household;
  const progress = `<div class="selrow">${OB_STEPS.map((s, i) =>
    `<span class="pill ${i === obStep ? "active" : ""}" style="pointer-events:none;${i < obStep ? "color:var(--excellent)" : ""}">${i < obStep ? "✓ " : ""}${s}</span>`).join("")}</div>`;

  let body = "";
  if (obStep === 0) body = `
    <div class="ct">Willkommen bei Cohesively Cashflow</div>
    <p style="line-height:1.65;margin-bottom:12px"><b>Transparenz → Entscheidungsfähigkeit → finanzielle Souveränität.</b><br>
    Dieses Tool ist kein Tracker und kein Budget-Polizist. Es macht sichtbar, was bisher diffus war —
    <i>denn nur was du ansiehst, kannst du lenken.</i></p>
    <p class="small muted" style="line-height:1.6;margin-bottom:12px">In ~15 Minuten erfasst du deine IST-Situation (wie in Kurswoche 1):
    Haushalt → Konten → Einnahmen → Fixkosten. Danach öffnen wir den Raum für deine Ziele (Woche 2) —
    und du siehst zum ersten Mal deine Reisterrassen.</p>
    <p class="small" style="margin-bottom:4px">📺 Videolektion Woche 1: <a href="https://youtu.be/8ldlg0upwvE" target="_blank" rel="noopener" style="color:var(--accent)">Realität & Klarheit ↗</a></p>
    <div class="mt" style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn" onclick="obStep=1;render()">Los geht's →</button>
      <button class="btn ghost" onclick="loadDemo()">Erst mit Beispieldaten erkunden</button>
    </div>`;

  if (obStep === 1) body = `
    <div class="ct">Schritt 1 · Haushalt <span class="hint">für wen führst du hier die Finanzen?</span></div>
    <p class="small muted" style="margin-bottom:12px;line-height:1.6">Das Setup ist einmalig. Die Personen-Angabe pro Buchung ist optional,
    macht die Übersicht später aber durch Filter stark einfacher.</p>
    <div class="formgrid">
      <label>Dein Name (Person A)<input id="ob-pa" value="${esc(h.personA)}" placeholder="z. B. Michelle" onchange="state.household.personA=this.value.trim();saveState(state)"></label>
      <label>Partner:in (Person B, optional)<input id="ob-pb" value="${esc(h.personB)}" placeholder="leer lassen, wenn solo" onchange="state.household.personB=this.value.trim();saveState(state)"></label>
    </div>
    <p class="small muted mt">Die Ebene „Familie“ (Gemeinschaftskonten, Kindergeld …) gibt es zusätzlich — du nutzt sie nur, wenn du sie brauchst.</p>
    ${obNav(true)}`;

  if (obStep === 2) {
    const rows = state.accounts.map(a => `<b>${esc(a.name)}</b> · ${esc(a.type)} · ${esc(personLabel(a.owner))} · ${fmt(a.balance, true)}`);
    body = `
    <div class="ct">Schritt 2 · Konten <span class="hint">alles kommt auf den Tisch</span></div>
    <p class="small muted" style="margin-bottom:12px;line-height:1.6">Giro, Tagesgeld, Gemeinschaftskonto, Kreditkarte — mit aktuellem Saldo.
    So kannst du später Geldflüsse zwischen Konten beobachten und vorausschauend beeinflussen.</p>
    <div class="formgrid">
      <label>Konto<input id="ob-acc-name" placeholder="z. B. Sparkasse | Giro"></label>
      <label>Typ<select id="ob-acc-type"><option>Girokonto</option><option>Tagesgeld</option><option>Gemeinschaft</option><option>Kreditkarte</option><option>Depot</option></select></label>
      <label>Person<select id="ob-acc-person">${personOptions("Person A", false)}</select></label>
      <label>Saldo heute €<input id="ob-acc-bal" type="number" step="0.01" placeholder="0,00"></label>
      <label>&nbsp;<button class="btn ghost" onclick="obAddAccount()">+ Konto</button></label>
    </div>
    ${obList(rows, "obDelAccount")}
    ${obNav(state.accounts.length > 0)}`;
  }

  if (obStep === 3) {
    const rows = state.incomes.map(r => `<b>${esc(r.title)}</b> · ${fmt(r.amount, true)}/Monat · ${esc(personLabel(r.person))}`);
    body = `
    <div class="ct">Schritt 3 · Einnahmen <span class="hint">was fließt regelmäßig rein?</span></div>
    <p class="small muted" style="margin-bottom:12px;line-height:1.6">Gehalt, Kindergeld, Honorare … Wir buchen sie für den aktuellen Monat (${mLabel(NOW_MONTH)}) ein —
    in deinem monatlichen Money Date trägst du künftige Monate nach.</p>
    <div class="formgrid">
      <label>Titel<input id="ob-inc-title" placeholder="z. B. Gehalt"></label>
      <label>Betrag €/Monat<input id="ob-inc-amount" type="number" step="0.01" min="0"></label>
      <label>Person<select id="ob-inc-person">${personOptions("Person A", false)}</select></label>
      <label>Konto<select id="ob-inc-account">${state.accounts.map(a => `<option>${esc(a.name)}</option>`).join("")}</select></label>
      <label>&nbsp;<button class="btn ghost" onclick="obAddIncome()">+ Einnahme</button></label>
    </div>
    ${obList(rows, "obDelIncome")}
    ${obNav(true)}`;
  }

  if (obStep === 4) {
    const rows = state.fixed.map(r => `<b>${esc(r.title)}</b> · ${fmt(r.amount, true)} ${esc(r.freq)} (≈ ${fmt(r.monthly, true)}/M) · ${esc(r.cat)}`);
    body = `
    <div class="ct">Schritt 4 · Fixkosten <span class="hint">die Basis deiner Schutz-Formel</span></div>
    <p class="small muted" style="margin-bottom:12px;line-height:1.6">Miete, Versicherungen, Abos … Jahres- und Quartalsbeträge rechnen wir automatisch
    auf den Monat um. Aus der Summe entsteht gleich dein Schutz-Ziel (${state.goals.factors.schutz} × Fixkosten).</p>
    <div class="formgrid">
      <label>Titel<input id="ob-fix-title" placeholder="z. B. Miete"></label>
      <label>Betrag €<input id="ob-fix-amount" type="number" step="0.01" min="0"></label>
      <label>Frequenz<select id="ob-fix-freq"><option value="1">monatlich</option><option value="3">vierteljährlich</option><option value="6">halbjährlich</option><option value="12">jährlich</option></select></label>
      <label>Kategorie<select id="ob-fix-cat">${Object.keys(state.catMap).map(c => `<option ${c === "Lebenshaltung" ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
      <label>Person<select id="ob-fix-person">${personOptions("Familie", false)}</select></label>
      <label>&nbsp;<button class="btn ghost" onclick="obAddFixed()">+ Fixkosten</button></label>
    </div>
    ${obList(rows, "obDelFixed")}
    <div class="tile mt small">Monatliche Fixkosten bisher: <b>${fmt(fixMonthly("Gesamt"), true)}</b> → dein Schutz-Ziel: <b>${fmt(Math.max(100, Math.ceil(state.goals.factors.schutz * fixMonthly("Gesamt") / 100) * 100))}</b></div>
    ${obNav(true)}`;
  }

  if (obStep === 5) {
    const goalRows = state.savingGoals.map(s => `<b>${esc(s.name)}</b>${s.target ? " · Ziel " + fmt(s.target) : ""} · ${esc(s.phase || "offen")}${s.intention ? ` · ☼ ${esc(s.intention)}` : ""}`);
    const wishRows = state.wishlist.map(w => `<b>${esc(w.title)}</b> · ${fmt(w.target)}`);
    body = `
    <div class="ct">Schritt 5 · Träumen erlaubt <span class="hint">Kurswoche 2: von der Wahrheit zur Intention</span></div>
    <p class="small muted" style="margin-bottom:12px;line-height:1.6">„Träumen ist kein Luxus – es ist der erste Schritt zur Selbstführung.“
    Schreib auf, was dir spontan einfällt — nichts ist zu klein oder zu groß. Das <b>Warum</b> zeigt dir,
    welche Wünsche aus echtem Bedürfnis entstehen. (Alles optional, jederzeit erweiterbar.)</p>
    <div class="formgrid">
      <label>Sparziel<input id="ob-g-name" placeholder="z. B. Notgroschen"></label>
      <label>Zielbetrag €<input id="ob-g-target" type="number" min="0" placeholder="optional"></label>
      <label>Phase<select id="ob-g-phase"><option>Schutz</option><option>Sicherheit</option><option>Freiheit</option></select></label>
      <label>Warum? — Mein Why<input id="ob-g-why" placeholder="1 Satz"></label>
      <label>&nbsp;<button class="btn ghost" onclick="obAddGoal()">+ Sparziel</button></label>
    </div>
    ${obList(goalRows, "obDelGoal")}
    <div class="formgrid mt">
      <label>Wunsch<input id="ob-w-title" placeholder="z. B. neues Rad"></label>
      <label>Zielbetrag €<input id="ob-w-target" type="number" min="0"></label>
      <label>&nbsp;<button class="btn ghost" onclick="obAddWish()">+ Wunsch</button></label>
    </div>
    ${obList(wishRows, "obDelWish")}
    ${obNav(true, "Zeig mir meine Terrassen →")}`;
  }

  if (obStep === 6) {
    const T = terraces("Gesamt");
    body = `
    <div class="ct">Deine Reisterrassen</div>
    <p class="small muted" style="margin-bottom:12px;line-height:1.6">Aus deinen Angaben entstehen drei Meilensteine. Dein monatlicher Cashflow ist der Regen, der sie füllt.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px">
      ${miniTerrace("1 · Schutz", T.protection.progress, `${fmt(T.protection.value)} von ${fmt(T.protection.goal)}`, `${state.goals.factors.schutz} × ${fmt(T.fix)} Fixkosten — ${PHASE_COPY.Schutz.lead}`)}
      ${miniTerrace("2 · Sicherheit", T.security.progress, `${fmt(T.security.value)} von ${fmt(T.security.goal)}`, `${state.goals.factors.sicherheit} × Fixkosten — ${PHASE_COPY.Sicherheit.lead}`)}
      ${miniTerrace("3 · Freiheit", T.freedom.progress, `${fmt(T.freedom.value)} von ${fmt(T.freedom.goal)}`, `${state.goals.factors.freiheit} × Wunschausgaben — ${PHASE_COPY.Freiheit.lead}`)}
    </div>
    <p class="small muted mt" style="line-height:1.6">Nächste Schritte: Ausgaben erfasst du unterwegs mit <b>＋ Erfassen</b> (Taste „n“).
    Deine SOLL-Budgets setzt du auf der Budget-Seite — Woche 3 des Kurses: Ø der letzten Monate als Startwert, dann bewusst kalibrieren.</p>
    <div class="mt"><button class="btn" onclick="finishOnboarding()">Zur App →</button></div>`;
  }

  app.innerHTML = `${progress}<div class="grid"><div class="card s12 ${obStep > 0 && obStep < 6 ? "input-surface" : ""}" style="max-width:980px">${body}</div></div>`;
}

function obVal(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }
function obNum(id) { return parseFloat(obVal(id)) || 0; }

function obAddAccount() {
  const name = obVal("ob-acc-name");
  if (!name) { toast("Bitte einen Kontonamen angeben."); return; }
  state.accounts.push({ name, type: obVal("ob-acc-type"), owner: obVal("ob-acc-person"), balance: obNum("ob-acc-bal") });
  if (!state.ui.lastAccount) state.ui.lastAccount = name;
  saveState(state); render();
}
function obDelAccount(i) { state.accounts.splice(i, 1); saveState(state); render(); }
function obAddIncome() {
  const amount = obNum("ob-inc-amount");
  if (!amount) { toast("Bitte einen Betrag angeben."); return; }
  state.incomes.push({ month: NOW_MONTH, amount, title: obVal("ob-inc-title") || "Einnahme", freq: "monatlich", person: obVal("ob-inc-person"), account: obVal("ob-inc-account") });
  saveState(state); render();
}
function obDelIncome(i) { state.incomes.splice(i, 1); saveState(state); render(); }
function obAddFixed() {
  const amount = obNum("ob-fix-amount"), period = parseInt(obVal("ob-fix-freq")) || 1;
  if (!amount) { toast("Bitte einen Betrag angeben."); return; }
  const cat = obVal("ob-fix-cat");
  const freq = { 1: "monatlich", 3: "vierteljährlich", 6: "halbjährlich", 12: "jährlich" }[period];
  state.fixed.push({ month: NOW_MONTH, amount, title: obVal("ob-fix-title") || cat, cat, bucket: state.catMap[cat] || "Needs", freq, monthly: amount / period, period, account: "", person: obVal("ob-fix-person") });
  saveState(state); render();
}
function obDelFixed(i) { state.fixed.splice(i, 1); saveState(state); render(); }
function obAddGoal() {
  const name = obVal("ob-g-name");
  if (!name) { toast("Bitte einen Namen angeben."); return; }
  state.savingGoals.push({ name, target: obNum("ob-g-target") || null, savedManual: 0, savedAuto: 0, rate: 0, phase: obVal("ob-g-phase"), person: "Familie", status: "offen", intention: obVal("ob-g-why") });
  saveState(state); render();
}
function obDelGoal(i) { state.savingGoals.splice(i, 1); saveState(state); render(); }
function obAddWish() {
  const title = obVal("ob-w-title"), target = obNum("ob-w-target");
  if (!title || !target) { toast("Bitte Wunsch und Zielbetrag angeben."); return; }
  state.wishlist.push({ title, target, saved: 0, status: "wartend", timeframe: "", url: "", intention: "" });
  saveState(state); render();
}
function obDelWish(i) { state.wishlist.splice(i, 1); saveState(state); render(); }

function finishOnboarding() {
  state.onboarded = true;
  saveState(state);
  view = "dashboard";
  toast("Willkommen — dein System steht. 🌾");
  render();
}

function loadDemo() {
  state = resetState("demo");
  saveState(state);
  view = "dashboard";
  toast("Beispieldaten geladen — unter „Daten“ kannst du jederzeit neu starten.");
  render();
}

/* ================= Daten (Verwaltung, Export/Import) ================= */
function rData() {
  const h = state.household;
  app.innerHTML = `
  <div class="grid">
    <div class="card s6 input-surface">
      <div class="ct">Haushalt <span class="hint">Namen hinter Person A/B</span></div>
      <div class="formgrid">
        <label>Person A<input value="${esc(h.personA)}" onchange="state.household.personA=this.value.trim();saveState(state);render()"></label>
        <label>Person B<input value="${esc(h.personB)}" onchange="state.household.personB=this.value.trim();saveState(state);render()"></label>
      </div>
    </div>
    <div class="card s6 input-surface">
      <div class="ct">Terrassen-Formeln <span class="hint">Faktoren der Meilenstein-Ziele</span></div>
      <div class="formgrid">
        <label>Schutz × Fixkosten<input type="number" min="1" value="${state.goals.factors.schutz}" onchange="state.goals.factors.schutz=parseFloat(this.value)||6;saveState(state);render()"></label>
        <label>Sicherheit × Fixkosten<input type="number" min="1" value="${state.goals.factors.sicherheit}" onchange="state.goals.factors.sicherheit=parseFloat(this.value)||150;saveState(state);render()"></label>
        <label>Freiheit × Wants<input type="number" min="1" value="${state.goals.factors.freiheit}" onchange="state.goals.factors.freiheit=parseFloat(this.value)||150;saveState(state);render()"></label>
      </div>
    </div>

    <div class="card s12 input-surface">
      <div class="ct">Konten & Salden <span class="hint">Salden direkt editierbar — dein Money-Date-Moment</span></div>
      <div class="scroll-x"><table class="data">
        <tr><th>Konto</th><th>Typ</th><th>Person</th><th class="num">Saldo €</th><th></th></tr>
        ${state.accounts.map((a, i) => `<tr>
          <td>${esc(a.name)}</td><td>${esc(a.type)}</td><td>${esc(personLabel(a.owner))}</td>
          <td class="num"><input type="number" step="0.01" value="${a.balance}" style="width:110px;text-align:right" onchange="state.accounts[${i}].balance=parseFloat(this.value)||0;saveState(state)"></td>
          <td><button class="pill" style="padding:2px 9px" onclick="state.accounts.splice(${i},1);saveState(state);render()">✕</button></td>
        </tr>`).join("")}
      </table></div>
      <div class="formgrid mt">
        <label>Neues Konto<input id="d-acc-name" placeholder="z. B. N26 | Giro"></label>
        <label>Typ<select id="d-acc-type"><option>Girokonto</option><option>Tagesgeld</option><option>Gemeinschaft</option><option>Kreditkarte</option><option>Depot</option></select></label>
        <label>Person<select id="d-acc-person">${personOptions("Person A")}</select></label>
        <label>Saldo €<input id="d-acc-bal" type="number" step="0.01" placeholder="0,00"></label>
        <label>&nbsp;<button class="btn ghost" onclick="dataAddAccount()">+ Konto</button></label>
      </div>
    </div>

    <div class="card s12">
      <div class="ct">Deine Daten <span class="hint">alles bleibt lokal in diesem Browser — sichern nicht vergessen</span></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button class="btn" onclick="exportData()">⬇ Daten exportieren (JSON)</button>
        <label class="btn ghost" style="cursor:pointer">⬆ Daten importieren<input type="file" accept=".json,application/json" style="display:none" onchange="importData(event)"></label>
        <button class="btn ghost" onclick="if(confirm('Beispieldaten laden? Deine aktuellen Daten werden überschrieben.'))loadDemo()">Beispieldaten laden</button>
        <button class="btn ghost" style="border-color:rgba(226,86,75,0.45)" onclick="wipeData()">Alles löschen & neu starten</button>
      </div>
      <div class="small muted mt" style="line-height:1.6">Tipp für die Testphase: Exportiere deine Daten regelmäßig als Backup.
      Beim Feedback kannst du die JSON-Datei mitschicken — nur wenn du magst, es sind deine Finanzdaten.</div>
    </div>
  </div>`;
}

function dataAddAccount() {
  const name = document.getElementById("d-acc-name").value.trim();
  if (!name) { toast("Bitte einen Kontonamen angeben."); return; }
  state.accounts.push({ name, type: document.getElementById("d-acc-type").value, owner: document.getElementById("d-acc-person").value, balance: parseFloat(document.getElementById("d-acc-bal").value) || 0 });
  saveState(state); toast("Konto angelegt ✓"); render();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `cohesively-cashflow_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Export erstellt — liegt im Download-Ordner.");
}

function importData(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const s = JSON.parse(reader.result);
      if (!s.accounts || !s.catMap) throw new Error("kein Cashflow-Export");
      state = migrate(s);
      saveState(state);
      toast("Daten importiert ✓");
      render();
    } catch (e) { toast("Import fehlgeschlagen: " + e.message); }
  };
  reader.readAsText(file);
}

function wipeData() {
  if (!confirm("Wirklich ALLE Daten löschen und neu starten?")) return;
  state = resetState("empty");
  obStep = 0; view = "onboarding";
  render();
}

/* ================= Quick Capture =================
   Der 30-Sekunden-Weg: ＋-Button (oder Taste „n“) → Betrag, Kategorie-Chip, fertig.
   Merkt sich Person, Konto und Kategorie der letzten Erfassung. */

function topCategories(n = 5) {
  const count = {};
  state.items.forEach(i => count[i.cat] = (count[i.cat] || 0) + 1);
  const sorted = Object.keys(count).sort((a, b) => count[b] - count[a]);
  if (state.ui.lastCat && !sorted.slice(0, n).includes(state.ui.lastCat)) sorted.unshift(state.ui.lastCat);
  return [...new Set(sorted)].slice(0, n);
}

function openQA() {
  const qa = document.getElementById("qa");
  const cats = Object.keys(state.catMap);
  const accounts = state.accounts.map(a => a.name);
  qa.innerHTML = `
    <div class="ct" style="margin-bottom:10px">Ausgabe erfassen <span class="hint">bewusst, statt automatisch</span></div>
    <div class="row"><input id="qa-amount" class="amount" inputmode="decimal" placeholder="0,00 €" autocomplete="off"></div>
    <div class="chiprow">${topCategories().map(c =>
      `<button class="chipbtn ${c === state.ui.lastCat ? "active" : ""}" onclick="qaSetCat(this,'${esc(c)}')">${esc(c)}</button>`).join("")}</div>
    <div class="row"><select id="qa-cat" onchange="qaSetCat(null,this.value)">${cats.map(c =>
      `<option ${c === state.ui.lastCat ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
    <div class="row"><input id="qa-title" placeholder="Titel (optional)"></div>
    <div class="row">
      <select id="qa-person">${personOptions(state.ui.lastPerson, false)}</select>
      <input id="qa-month" type="month" value="${NOW_MONTH}">
    </div>
    <div class="row"><select id="qa-account">${accounts.map(a => `<option ${a === state.ui.lastAccount ? "selected" : ""}>${esc(a)}</option>`).join("")}</select></div>
    <div class="row" style="margin-bottom:0">
      <button class="btn" style="flex:1" onclick="saveQA()">Speichern ↵</button>
      <button class="btn ghost" onclick="closeQA()">Esc</button>
    </div>`;
  qa.classList.add("open");
  const amt = document.getElementById("qa-amount");
  amt.focus();
  qa.onkeydown = e => { if (e.key === "Enter") saveQA(); if (e.key === "Escape") closeQA(); };
}

function closeQA() { document.getElementById("qa").classList.remove("open"); }

function qaSetCat(btn, cat) {
  document.getElementById("qa-cat").value = cat;
  document.querySelectorAll("#qa .chipbtn").forEach(b => b.classList.toggle("active", b === btn || b.textContent === cat));
}

function saveQA() {
  const $ = id => document.getElementById(id);
  const raw = $("qa-amount").value.trim();
  // deutsches Zahlenformat: "1.234,56" oder "12,50" oder "12.50"
  const amount = parseFloat(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
  if (!amount || amount <= 0) { $("qa-amount").focus(); toast("Bitte einen Betrag eingeben."); return; }
  const cat = $("qa-cat").value, person = $("qa-person").value, account = $("qa-account").value, month = $("qa-month").value || NOW_MONTH;
  const title = $("qa-title").value.trim();
  state.items.push({ month, amount, title: title || cat, cat, bucket: state.catMap[cat] || "Wants", source: "Quick Capture", account, person });
  state.ui = { lastCat: cat, lastPerson: person, lastAccount: account };
  const ok = saveState(state);
  closeQA();
  toast(ok ? `✓ ${fmt(amount, true)} · ${cat} erfasst — bewusste Entscheidung.` : "Speichern fehlgeschlagen — Änderung nur in dieser Sitzung.");
  render();
}

document.body.insertAdjacentHTML("beforeend",
  `<div id="qa" class="qa"></div><button class="fab" onclick="openQA()" title="Taste n">＋ Erfassen</button>`);
document.addEventListener("keydown", e => {
  if (e.key === "n" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); openQA(); }
});

/* ================= Ambient Canvas ================= */
(function ambient() {
  const c = document.getElementById("ambient"), ctx = c.getContext("2d");
  let W, H, parts = [];
  function size() { W = c.width = innerWidth; H = c.height = innerHeight; }
  addEventListener("resize", size); size();
  for (let i = 0; i < 40; i++) parts.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2 + 0.5, s: Math.random() * 0.3 + 0.08, o: Math.random() * 0.25 + 0.05 });
  (function tick() {
    ctx.clearRect(0, 0, W, H);
    parts.forEach(p => {
      p.y -= p.s; if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7);
      ctx.fillStyle = `rgba(56,249,215,${p.o})`; ctx.fill();
    });
    requestAnimationFrame(tick);
  })();
})();

/* ================= Init ================= */
document.getElementById("nav").innerHTML = Object.entries(VIEWS).map(([k, l]) =>
  `<button class="pill" data-v="${k}" onclick="setView('${k}')">${l}</button>`).join("");
render();
