// Sample data + deterministic helpers for the prototype's charts & tables.
// This is the demo's content layer — edit these to change what renders.

/* per-chart palette used by the VIVID theme (each chart a distinct colour) */
export const PALETTE = { otd:'#6366f1', touch:'#10b981', blocks:'#f59e0b', rej:'#ec4899', dots:'#06b6d4', po:'#a78bfa', po2:'#14b8a6' };

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
