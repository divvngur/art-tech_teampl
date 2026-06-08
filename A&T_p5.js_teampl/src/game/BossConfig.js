// ─────────────────────────────────────────────
// BossConfig.js
// 경쟁 모드 난이도 스케줄 + 보스 설정
// ─────────────────────────────────────────────
window.COMPETITIVE_SCHEDULE = [
  { time:   0, pigeons:3, poopRate:0.25, speed:2.5, boss:null },
  { time:  60, pigeons:4, poopRate:0.32, speed:3.2, boss:null },
  { time: 120, pigeons:5, poopRate:0.40, speed:4,   boss:'miniboss' },
  { time: 180, pigeons:6, poopRate:0.46, speed:4.6, boss:null },
  { time: 240, pigeons:7, poopRate:0.50, speed:5,   boss:'miniboss' },
  { time: 300, pigeons:8, poopRate:0.55, speed:5.5, boss:'boss' },
  { time: 420, pigeons:9, poopRate:0.60, speed:6,   boss:'boss2' },
];

// ─────────────────────────────────────────────
// 보스 설정
// ─────────────────────────────────────────────
window.BOSS_CONFIG = {
  miniboss: {
    label: "🐦 뚱보 비둘기",
    hp: 6,
    speed: 3,
    size: 90,
    skills: ["curve", "scatter"],
    skillInterval: 3000,
  },
  boss: {
    label: "👑 비둘기 킹",
    hp: 18,
    speed: 4,
    size: 120,
    skills: ["laser", "giant_poop", "rain"],
    skillInterval: 4200,
    // sketch.js의 Bossdraw() 사용 — 패턴 2개 (빔 + 교차똥)
    useBossdraw: true,
    bossType: 'boss',
  },
  boss2: {
    label: "💀 비둘기 황제",
    hp: 30,
    speed: 5,
    size: 140,
    skills: ["laser", "giant_poop", "rain"],
    skillInterval: 3000,
    // sketch.js의 Bossdraw() 사용 — 패턴 3개 (빔 + 교차똥 + 돌진)
    useBossdraw: true,
    bossType: 'boss2',
  },
};
