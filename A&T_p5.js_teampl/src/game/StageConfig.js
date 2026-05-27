// ── StageConfig.js ───────────────────────────────────
window.STAGES = {
  1: { goal:5,  pigeons:2, speed:2,   dropInterval:2200, poopRate:.20, hasBoss:false },
  2: { goal:8,  pigeons:3, speed:2.5, dropInterval:2000, poopRate:.25, hasBoss:false },
  3: { goal:10, pigeons:3, speed:3,   dropInterval:1800, poopRate:.30, hasBoss:false },
  4: { goal:12, pigeons:4, speed:3.5, dropInterval:1600, poopRate:.35, hasBoss:false },
  5: { goal:15, pigeons:5, speed:4,   dropInterval:1400, poopRate:.40, hasBoss:false },
  6: { goal:20, pigeons:6, speed:5,   dropInterval:1200, poopRate:.45, hasBoss:'miniboss' },
  7: { goal:25, pigeons:7, speed:5.5, dropInterval:1000, poopRate:.50, hasBoss:'boss' },
  8: { goal:30, pigeons:8, speed:6,   dropInterval:900,  poopRate:.55, hasBoss:'boss2' },
};

window.STAGE_COUNT = Object.keys(window.STAGES).length;