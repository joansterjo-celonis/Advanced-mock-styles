// Sample data + deterministic helpers for the prototype's charts & tables.
// This is the demo's content layer — edit these to change what renders.

/* per-chart palette used by the VIVID theme (each chart a distinct colour).
   This is the default ("Prism") combo — kept as a standalone export for back-compat. */
export const PALETTE = { otd:'#6366f1', touch:'#10b981', blocks:'#f59e0b', rej:'#ec4899', dots:'#06b6d4', po:'#a78bfa', po2:'#14b8a6' };

/* Selectable VIVID colour combos. Each combo carries:
   - swatch: the 4 hero hues shown in the picker + preset previews (and that drive
     the CSS legend/cstop tokens declared per combo in tokens.css)
   - chart:  the per-chart tint used by vividTint() in engine.js (one hue per chart key)
   The first entry (prism) mirrors PALETTE and is the default, so older presets that
   predate this feature (no vividPalette field) fall back to today's exact look. */
export const DEFAULT_VIVID_COMBO = 'prism';
export const VIVID_COMBOS = [
  { id:'prism',  label:'Prism',  swatch:['#6366f1','#10b981','#f59e0b','#ec4899'],
    chart:{ otd:'#6366f1', touch:'#10b981', blocks:'#f59e0b', rej:'#ec4899', dots:'#06b6d4', po:'#a78bfa', po2:'#14b8a6' } },
  { id:'ocean',  label:'Ocean',  swatch:['#2563eb','#06b6d4','#0ea5e9','#14b8a6'],
    chart:{ otd:'#2563eb', touch:'#06b6d4', blocks:'#0ea5e9', rej:'#14b8a6', dots:'#38bdf8', po:'#6366f1', po2:'#0d9488' } },
  { id:'sunset', label:'Sunset', swatch:['#f97316','#f59e0b','#ef4444','#ec4899'],
    chart:{ otd:'#f97316', touch:'#f59e0b', blocks:'#ef4444', rej:'#ec4899', dots:'#fb7185', po:'#fbbf24', po2:'#e11d48' } },
  { id:'forest', label:'Forest', swatch:['#16a34a','#0d9488','#65a30d','#ca8a04'],
    chart:{ otd:'#16a34a', touch:'#0d9488', blocks:'#65a30d', rej:'#ca8a04', dots:'#22c55e', po:'#84cc16', po2:'#15803d' } },
  { id:'berry',  label:'Berry',  swatch:['#8b5cf6','#d946ef','#ec4899','#6366f1'],
    chart:{ otd:'#8b5cf6', touch:'#d946ef', blocks:'#ec4899', rej:'#6366f1', dots:'#a855f7', po:'#c026d3', po2:'#7c3aed' } },
];
export const VIVID_COMBO_MAP = Object.fromEntries(VIVID_COMBOS.map(c => [c.id, c]));

/* deterministic pseudo-random */
export function rng(seed){ return function(){ seed=(seed*9301+49297)%233280; return seed/233280; }; }
export function series(seed, n, base, amp, trend){ const r=rng(seed), out=[]; for(let i=0;i<n;i++){ out.push(base + trend*i + (r()-0.5)*amp); } return out; }

export const N = 25; // months 2022-01 .. 2024-01

/* Rework & Quality — Countries and suppliers (horizontal bars) */
export const RQ_BARS = [
  ['ES – C.E.B. BARCELONA',50],['US – MOBILE Inc.',50],['US – SCT Inc.',44],['DE – PAQ Deutschland GmbH',43],
  ['US – C.E.B. New York',40],['DE – Unisono AG',38],['US – IDES Consumer Prod…',35],['US – SKF Americas',35],
  ['US – Gusswerk US',32],['DE – Umbrella Corporation',31],['US – Destec Office Supplies',30],['US – IDES Furnitures Inc.',30],
  ['US – EGS America',27],['US – Meyer Hardware Inc.',27],['DE – Walter & Schulz GmbH…',27],['US – Omnimum Inc.',26],
  ['DE – Wollner AG',26],['DE – Sunny Electronics G…',25],['US – Allfresh Inc.',24],['FR – SEC System SA',24],
  ['US – AluCast',22],['DE – ABC Dienstleistungs G…',18],['DE – KBB Schwarze Pumpe',18],['US – SMP',18]
];

/* Rework & Quality — Chart components (pie with leader-line labels) */
export const RQ_PIE = [
  {p:3.28,l:'ES - C.E.B. BARCELONA'},{p:3.28,l:'US - MOBILE Inc.'},{p:2.88,l:'US - SCT Inc.'},
  {p:2.82,l:'DE - PAQ Deu…'},{p:87.75,l:'Others (179)',other:true}
];

/* Rework & Quality — Case table */
export const RQ_CASES = [
  ['999999',7,'22 d','Create Purchase Requisition Item'],['999998',5,'21 d','Create Purchase Order Item'],
  ['999997',5,'27 d','Create Purchase Order Item'],['999996',6,'27 d','Create Purchase Order Item'],
  ['999995',5,'35 d','Create Purchase Order Item'],['999994',5,'28 d','Create Purchase Order Item'],
  ['999993',5,'26 d','Create Purchase Order Item'],['999992',7,'43 d','Create Purchase Requisition Item'],
  ['999991',7,'43 d','Create Purchase Requisition Item'],['999990',7,'37 d','Create Purchase Requisition Item'],
  ['999989',6,'31 d','Create Purchase Order Item'],['999988',5,'24 d','Create Purchase Order Item']
];

/* Rework & Quality — Per-case activities */
export const RQ_ACTIVITIES = {
  '999999':[
    ['Create Purchase Order Item','4/01/16 17:32:15','+2d'],['Send Purchase Order','4/02/16 17:32:15','+3d'],
    ['Receive Order Confirmation','4/06/16 17:32:15','+7d'],['Record Goods Receipt','4/12/16 17:32:15','+13d'],
    ['Record Invoice Receipt','4/19/16 17:32:15','+19d'],['Clear Invoice','4/22/16 17:32:15','+22d'],
    ['Remove Payment Block','4/23/16 17:32:15','+23d']
  ]
};
