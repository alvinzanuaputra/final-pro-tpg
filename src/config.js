export const MATERIAL = Object.freeze({ EMPTY: 0, SAND: 1, WATER: 2, STONE: 3, POWDER: 4 });

export const MATERIAL_INFO = [
  null,
  { name: 'Pasir', symbol: '◈', description: 'Menumpuk dan meluncur ke samping.' },
  { name: 'Air', symbol: '≈', description: 'Mengalir ke celah rendah.' },
  { name: 'Batu', symbol: '▪', description: 'Tetap di tempat setelah mendarat.' },
  { name: 'Mesiu', symbol: '✦', description: 'Meledak saat mendarat.' },
];

export const COLORS = [
  { name: 'Amber', hex: '#ffd071', rgb: [255, 208, 113] },
  { name: 'Toska', hex: '#68c8bc', rgb: [104, 200, 188] },
  { name: 'Ungu', hex: '#a487d8', rgb: [164, 135, 216] },
];

export const RULES = Object.freeze({
  width: 48, height: 72, tile: 4,
  tickMs: 1000 / 60, maxCatchUp: 3, maxSettleTicks: 72,
  fallTicks: 12, fallFactor: 0.9, softDropTicks: 2,
  moveDelayTicks: 11, moveRepeatTicks: 3,
  levelEvery: 4, chargeMax: 3,
  waterReach: 6, blastRadius: 6, dyeRadius: 6,
  materialWeights: [[100, 0, 0, 0], [75, 25, 0, 0], [60, 25, 15, 0], [55, 20, 15, 10]],
});

export const EFFECTS = { clearMs: 120, blastMs: 230, dyeMs: 230 };
