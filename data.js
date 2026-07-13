/* Cohesively Cashflow — Datenschicht
   Beispieldaten (SEED): fiktive Namen, Banken und Salden — Struktur wie das Excel-Template.
   Seed-Daten: Excel-Master (Engine) + Notion Cashflow-Dashboard (Ziele, Wishlist, Intentionen)
   Persistenz: localStorage (Key: cohesively-cashflow-v2) */

const SEED = {
  accounts: [
    { name: "Bank A | Geschäftskonto", type: "Girokonto", owner: "Business A", balance: -250 },
    { name: "Bank A | Tagesgeld", type: "Tagesgeld", owner: "Business A", balance: 300.0 },
    { name: "Bank A | Kreditkarte", type: "Kreditkarte", owner: "Business A", balance: 0 },
    { name: "Bank B | Kreditkarte", type: "Kreditkarte", owner: "Person A", balance: 0 },
    { name: "Bank B | Privat A (TG)", type: "Tagesgeld", owner: "Person A", balance: 0 },
    { name: "Bank B | Privat A", type: "Girokonto", owner: "Person A", balance: -380 },
    { name: "Sparkonto | Kinder", type: "Tagesgeld", owner: "Familie", balance: 0 },
    { name: "Bank D | Haushalt", type: "Gemeinschaft", owner: "Familie", balance: 1480 },
    { name: "Bank D | Haushalt (TG)", type: "Tagesgeld", owner: "Familie", balance: 200.0 },
    { name: "Bank A | Freelance B", type: "Girokonto", owner: "Business B", balance: -1900 },
    { name: "Bank C | Privat B", type: "Girokonto", owner: "Person B", balance: -1450 },
    { name: "Bank C | Privat B (TG)", type: "Tagesgeld", owner: "Person B", balance: 0 },
    { name: "Paypal", type: "Girokonto", owner: "Person A", balance: 0 },
    { name: "Depot", type: "Depot", owner: "Person A", balance: 0 }
  ],

  incomes: [
    { month: "2025-08", amount: 2500, title: "Lohn", freq: "monatlich", person: "Person A", account: "Bank A | Geschäftskonto" },
    { month: "2025-08", amount: 510, title: "Kindergeld", freq: "monatlich", person: "Familie", account: "Bank D | Haushalt" },
    { month: "2025-09", amount: 2500, title: "Lohn", freq: "monatlich", person: "Person A", account: "Bank A | Geschäftskonto" },
    { month: "2025-09", amount: 510, title: "Kindergeld", freq: "monatlich", person: "Familie", account: "Bank D | Haushalt" },
    { month: "2025-09", amount: 3900, title: "Gehalt", freq: "monatlich", person: "Person B", account: "Bank A | Freelance B" },
    { month: "2025-10", amount: 2500, title: "Lohn", freq: "monatlich", person: "Person A", account: "Bank A | Geschäftskonto" },
    { month: "2025-10", amount: 510, title: "Kindergeld", freq: "monatlich", person: "Familie", account: "Bank D | Haushalt" },
    { month: "2025-11", amount: 2500, title: "Lohn", freq: "monatlich", person: "Person A", account: "Bank A | Geschäftskonto" },
    { month: "2025-11", amount: 510, title: "Kindergeld", freq: "monatlich", person: "Familie", account: "Bank D | Haushalt" }
  ],

  fixed: [
    { month: "2025-08", amount: 17, title: "Haftpflicht", cat: "Versicherungen", bucket: "Needs", freq: "jährlich", monthly: 1.42, account: "Bank B | Privat A", person: "Person A" },
    { month: "2025-08", amount: 17.99, title: "Handy", cat: "Handy/Internet", bucket: "Needs", freq: "monatlich", monthly: 17.99, account: "Bank B | Privat A", person: "Person A" },
    { month: "2025-08", amount: 1600, title: "Miete", cat: "Lebenshaltung", bucket: "Needs", freq: "monatlich", monthly: 1600, account: "Bank D | Haushalt", person: "Familie" },
    { month: "2025-09", amount: 1600, title: "Miete", cat: "Lebenshaltung", bucket: "Needs", freq: "monatlich", monthly: 1600, account: "Bank D | Haushalt", person: "Familie" },
    { month: "2025-09", amount: 360, title: "ÖPNV-Abo", cat: "Mobilität", bucket: "Needs", freq: "jährlich", monthly: 30, account: "Bank B | Privat A", person: "Person A" },
    { month: "2025-09", amount: 50, title: "Rücklagen", cat: "Rücklagen", bucket: "Savings", freq: "monatlich", monthly: 50, account: "Bank B | Privat A", person: "Person A" },
    { month: "2025-11", amount: 95, title: "Deko Weihnachten", cat: "Shopping", bucket: "Wants", freq: "einmalig", monthly: 0, account: "Bank D | Haushalt", person: "Familie" }
  ],

  items: [
    { month: "2025-08", amount: 482.28, title: "Lebensmittel", cat: "Lebenshaltung", bucket: "Needs", source: "Budgetblock", account: "Bank D | Haushalt", person: "Familie" },
    { month: "2025-08", amount: 482.28, title: "Lebensmittel", cat: "Lebenshaltung", bucket: "Needs", source: "Budgetblock", account: "Bank B | Privat A", person: "Person A" },
    { month: "2025-08", amount: 547.65, title: "Benzin", cat: "Mobilität", bucket: "Needs", source: "Budgetblock", account: "Bank C | Privat B", person: "Person B" },
    { month: "2025-08", amount: 16.97, title: "Kinder Anschaffungen", cat: "Shopping", bucket: "Wants", source: "Budgetblock", account: "Bank B | Privat A", person: "Person A" },
    { month: "2025-08", amount: 133.41, title: "Drogerie", cat: "Drogerie & Pflege", bucket: "Wants", source: "Budgetblock", account: "Bank D | Haushalt", person: "Familie" },
    { month: "2025-08", amount: 60.3, title: "Restaurant", cat: "Freizeit & Genuss", bucket: "Wants", source: "Budgetblock", account: "Bank B | Privat A", person: "Person A" },
    { month: "2025-08", amount: 189, title: "Shopping", cat: "Shopping", bucket: "Wants", source: "Budgetblock", account: "Bank B | Privat A", person: "Person A" },
    { month: "2025-08", amount: 19, title: "Aufschnitt", cat: "Lebenshaltung", bucket: "Needs", source: "Einmalige Ausgabe", account: "Bank B | Privat A", person: "Person A" },
    { month: "2025-08", amount: 100, title: "Drogerie", cat: "Drogerie & Pflege", bucket: "Wants", source: "Budgetblock", account: "Bank B | Privat A", person: "Person A" },
    { month: "2025-08", amount: 25, title: "Betreuung", cat: "Betreuung", bucket: "Needs", source: "Budgetblock", account: "Bank B | Privat A", person: "Person A" },
    { month: "2025-09", amount: 332.05, title: "Lebensmittel", cat: "Lebenshaltung", bucket: "Needs", source: "Budgetblock", account: "Bank D | Haushalt", person: "Familie" },
    { month: "2025-09", amount: 168.61, title: "Benzin", cat: "Mobilität", bucket: "Needs", source: "Budgetblock", account: "Bank D | Haushalt", person: "Familie" },
    { month: "2025-09", amount: 317.87, title: "Wohnen & Deko", cat: "Anschaffungen", bucket: "Wants", source: "Budgetblock", account: "Bank D | Haushalt", person: "Familie" },
    { month: "2025-09", amount: 157.85, title: "Drogerie", cat: "Drogerie & Pflege", bucket: "Wants", source: "Budgetblock", account: "Bank D | Haushalt", person: "Familie" },
    { month: "2025-09", amount: 32.4, title: "Restaurant", cat: "Freizeit & Genuss", bucket: "Wants", source: "Budgetblock", account: "Bank B | Privat A", person: "Person A" },
    { month: "2025-09", amount: 111, title: "Drogerie", cat: "Drogerie & Pflege", bucket: "Wants", source: "Budgetblock", account: "Bank B | Privat A", person: "Person A" },
    { month: "2025-10", amount: 45, title: "Brezel", cat: "Lebenshaltung", bucket: "Needs", source: "Einmalige Ausgabe", account: "Bank B | Privat A", person: "Person A" },
    { month: "2025-11", amount: 55.99, title: "Brötchen", cat: "Lebenshaltung", bucket: "Needs", source: "Einmalige Ausgabe", account: "Bank D | Haushalt", person: "Familie" }
  ],

  business: [
    { month: "2025-09", amount: 13, title: "Bankgebühren", cat: "Bankgebühren", bucket: "Needs", freq: "monatlich", monthly: 13, account: "Bank A | Geschäftskonto", person: "Business A" },
    { month: "2025-09", amount: 150, title: "Bankgebühren", cat: "Bankgebühren", bucket: "Needs", freq: "vierteljährlich", monthly: 50, account: "Bank A | Freelance B", person: "Business B" }
  ],

  transfers: [
    { date: "2025-08-28", month: "2025-08", amount: 1100, fromAcc: "Bank A | Freelance B", toAcc: "Bank B | Privat A", bucket: "Needs", person: "Business B", purpose: "Lohn Person A" },
    { date: "2025-09-01", month: "2025-09", amount: 300, fromAcc: "Bank A | Geschäftskonto", toAcc: "Bank A | Tagesgeld", bucket: "Savings", person: "Person A", purpose: "Rücklagen Geschäftskonto", goal: "Liquiditätsreserve" },
    { date: "2025-09-01", month: "2025-09", amount: 200, fromAcc: "Bank D | Haushalt", toAcc: "Bank D | Haushalt (TG)", bucket: "Savings", person: "Familie", purpose: "Rücklagen Haushaltskonto" },
    { date: "2025-11-07", month: "2025-11", amount: 1750, fromAcc: "Bank A | Freelance B", toAcc: "Bank D | Haushalt", bucket: "Needs", person: "Business B", purpose: "Haushaltsanteil Person A" },
    { date: "2025-11-07", month: "2025-11", amount: 1500, fromAcc: "Bank C | Privat B", toAcc: "Bank D | Haushalt", bucket: "Needs", person: "Person B", purpose: "Haushaltsanteil Person B" },
    { date: "2026-02-02", month: "2026-02", amount: 1000, fromAcc: "Bank B | Privat A", toAcc: "Bank B | Privat A (TG)", bucket: "Savings", person: "Person A", purpose: "Rücklage", goal: "Liquiditätsreserve" }
  ],

  budgets: {
    "Lebenshaltung":          { "2025-08": 460, "2025-09": 460 },
    "Drogerie & Pflege":      { "2025-08": 50,  "2025-09": 50 },
    "Mobilität":              { "2025-08": 150, "2025-09": 150 },
    "Betreuung":              { "2025-08": 100, "2025-09": 100 },
    "Freizeit & Genuss":      { "2025-08": 120, "2025-09": 120 },
    "Shopping":               { "2025-08": 80,  "2025-09": 80 },
    "Kultur & Entertainment": { "2025-08": 100, "2025-09": 100 },
    "Wohnen & Deko":          { "2025-08": 10,  "2025-09": 10 }
  },

  /* Money-Date-Notizen & Reflexionen je Monat (aus Notion: Spalten „Notizen“ / „Reflexion“) */
  reflections: {
    "2025-09": { notes: "Sprit, ÖPNV · Mode, Bücher", reflection: "" }
  },

  catMap: {
    "Lebenshaltung": "Needs", "Mobilität": "Needs", "Versicherungen": "Needs",
    "Handy/Internet": "Needs", "Gesundheit": "Needs", "Betreuung": "Needs", "Haustiere": "Needs",
    "Sparen": "Savings", "Rücklagen": "Savings", "Tilgung": "Savings", "Vorsorge": "Savings",
    "Bildung": "Wealth", "Investments": "Wealth", "Spenden": "Wealth",
    "Shopping": "Wants", "Freizeit & Genuss": "Wants", "Kultur & Entertainment": "Wants",
    "Anschaffungen": "Wants", "Hobbies": "Wants", "Geschenke": "Wants",
    "Drogerie & Pflege": "Wants", "Wohnen & Deko": "Wants"
  },

  bizCatMap: {
    "Büro Miete": "Needs", "Versicherungen": "Needs", "Buchhaltung & Steuerberatung": "Needs",
    "Bankgebühren": "Needs", "Hosting & Domains": "Needs", "Software & Tools": "Needs",
    "Techn. Infrastruktur": "Needs", "Team & Freelancer": "Needs", "Konnektivität (Handy & Internet)": "Needs",
    "Steuerrückstellungen": "Savings", "KV & RV": "Savings", "Weiterbildung & Coaching": "Savings",
    "Liquiditätsreserve": "Savings", "Tilgung": "Savings",
    "Werbung & Marketing": "Wants", "Branding & Webdesign": "Wants", "Product Development": "Wants",
    "Netzwerken & Reisen": "Wants", "Events": "Wants", "Innovation & Entwicklung": "Wants", "Spesen": "Wants",
    "Investition (Equipment & Assets)": "Wealth", "Rücklagen für Re-Invest & Wachstum": "Wealth", "Rendite Investments": "Wealth"
  },

  /* Wishlist — Stand & Felder aus dem Notion-Dashboard (WishlistDB Main) */
  wishlist: [
    { title: "Trockner", target: 899, saved: 400, status: "saving", timeframe: "", url: "https://www.otto.de", intention: "" },
    { title: "MacBook Pro", target: 2505, saved: 2000, status: "saving", timeframe: "", url: "", intention: "" },
    { title: "Kühlschrank", target: 1100, saved: 80, status: "wartend", timeframe: "", url: "https://www.mediamarkt.de", intention: "" },
    { title: "Höhenverstellbarer Schreibtisch", target: 1000, saved: 0, status: "wartend", timeframe: "kurzfristig (6–18 Monate)", url: "", intention: "" }
  ],

  /* Sparziele — aus Notion „Saving Goals DB“ + Excel C_Reisterrassen
     savedManual = Einzahlungen aus Transaktionen · savedAuto = Bestand (z. B. Depotwert)
     person = wem das Ziel gehört (Person A/B, Familie — wie die Kontenspalten im Excel) */
  savingGoals: [
    { name: "Liquiditätsreserve", person: "Person A", target: 33000, savedManual: 300, savedAuto: 1000, rate: 0, phase: "Schutz", status: "offen", intention: "Private Needs 6 Monate absichern" },
    { name: "Investitionen Business", person: "Person A", target: 20000, savedManual: 0, savedAuto: 2000, rate: 0, phase: "Sicherheit", status: "offen", intention: "" },
    { name: "Krypto", person: "Person A", target: null, savedManual: 0, savedAuto: 2025, rate: 0, phase: "Sicherheit", status: "offen", intention: "" },
    { name: "ETF-Sparplan", person: "Person A", target: null, savedManual: 0, savedAuto: 629.99, rate: 50, phase: "Sicherheit", status: "aktiv", intention: "" },
    { name: "Kinder ETF", person: "Familie", target: null, savedManual: 0, savedAuto: 2000, rate: 0, phase: "Sicherheit", status: "offen", intention: "" },
    { name: "Ferienhäuschen", person: "Familie", target: 85000, savedManual: 0, savedAuto: 0, rate: 0, phase: "Sicherheit", status: "offen", intention: "Stressless Familien-Getaway" },
    { name: "Philippinen 2026", person: "Familie", target: null, savedManual: 0, savedAuto: 0, rate: 0, phase: null, status: "offen", intention: "" }
  ],

  /* UI-Gedächtnis für schnelles Erfassen (zuletzt genutzte Auswahl) */
  ui: { lastCat: "Lebenshaltung", lastPerson: "Person A", lastAccount: "Bank B | Privat A" },

  /* Haushalt: echte Namen hinter den internen Personen-Schlüsseln */
  household: { personA: "Mia", personB: "Ben", familie: true },
  onboarded: true,

  /* Meilenstein-Formeln (aus Notion „Meilensteine“): Ziel = Faktor × Basis */
  goals: {
    factors: { schutz: 6, sicherheit: 150, freiheit: 150 },
    passiveIncome: 0
  }
};

/* Emotionale Phasen-Texte — wörtlich aus dem Notion-Meilensteine-Board */
const PHASE_COPY = {
  Schutz: {
    icon: "⚓", formula: "mind. 6 × Fixkosten",
    lead: "Baut dein Fundament der Ruhe.",
    body: "Hiermit fühlst du dich sicher, machst dich weniger abhängig von Ungewissheit und äußeren Schwankungen."
  },
  Sicherheit: {
    icon: "🧭", formula: "150 × Fixkosten",
    lead: "Verankert deine Stabilität.",
    body: "Hier beginnst du, dein Geld für dich arbeiten zu lassen. Du gewinnst Gelassenheit, weil du weißt: du hast Reserven und Richtung."
  },
  Freiheit: {
    icon: "🌊", formula: "150 × Wunschausgaben / Monat",
    lead: "Eröffnet deinen Spielraum.",
    body: "Jetzt fließt dein Geld in Einklang mit deinen Werten – es nährt, was dich erfüllt, und lässt Raum für Wachstum und Wirkung. Willkommen im Schöpfermodus."
  }
};

const PHASES = ["Schutz", "Sicherheit", "Freiheit"];

/* ---------- Personen-Gruppen (wie im Sheet: privat + Business zusammen) ---------- */
const GROUPS = {
  "Gesamt":   { label: "Gesamt", persons: null },
  "Person A": { label: "Person A · Michelle", persons: ["Person A", "Michelle", "Business A"] },
  "Person B": { label: "Person B · Michael", persons: ["Person B", "Michael", "Business B"] },
  "Familie":  { label: "Familie", persons: ["Familie"] }
};

const BUCKETS = ["Needs", "Savings", "Wealth", "Wants"];
const BUCKET_COLORS = { Needs: "#43a0ff", Savings: "#22d3a6", Wealth: "#38f9d7", Wants: "#f0a63a", Business: "#9db3c7", Income: "#58c66b" };
// Adaptierte 50-30-20-Ziele (Ramit Sethi Conscious Spending, + Wealth-Bucket nach Kiyosaki)
const BUCKET_TARGETS = { Needs: 0.5, Wants: 0.3, Savings: 0.1, Wealth: 0.1 };

/* ---------- Storage ---------- */
const STORE_KEY = "cohesively-cashflow-v2";

/* Leerer Zustand für neue Nutzer: Struktur & Mappings aus dem SEED, aber ohne Daten */
function emptyState() {
  const s = JSON.parse(JSON.stringify(SEED));
  ["accounts", "incomes", "fixed", "items", "business", "transfers", "wishlist", "savingGoals"].forEach(k => s[k] = []);
  s.budgets = {}; s.reflections = {};
  s.ui = { lastCat: "Lebenshaltung", lastPerson: "Person A", lastAccount: "" };
  s.household = { personA: "", personB: "", familie: true };
  s.onboarded = false;
  return s;
}

function migrate(s) {
  if (!s.savingGoals) s.savingGoals = JSON.parse(JSON.stringify(SEED.savingGoals));
  if (!s.reflections) s.reflections = {};
  if (!s.goals || !s.goals.factors) s.goals = JSON.parse(JSON.stringify(SEED.goals));
  if (!s.ui) s.ui = JSON.parse(JSON.stringify(SEED.ui));
  if (!s.household) s.household = { personA: "Michelle", personB: "Michael", familie: true };
  if (s.onboarded === undefined) s.onboarded = true; // Bestandsdaten = bereits eingerichtet
  s.savingGoals.forEach(g => { if (!g.person) g.person = "Familie"; });
  s.wishlist.forEach(w => { if (w.url === undefined) { w.url = ""; w.timeframe = ""; w.intention = ""; } });
  return s;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { /* fällt auf leeren Start zurück */ }
  return emptyState();
}

function saveState(state) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    return true;
  } catch (e) { return false; }
}

/* kind: "demo" = Beispieldaten (Michelles Excel+Notion-Stand) · "empty" = neu starten */
function resetState(kind) {
  localStorage.removeItem(STORE_KEY);
  return kind === "empty" ? emptyState() : JSON.parse(JSON.stringify(SEED));
}
