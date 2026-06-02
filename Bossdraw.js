let bossState    = 'idle';
let stateTimer   = 0;
let patternIndex = 0; // 순서: 0=빔, 1=교차똥, 2=돌진, 반복
 
// ── 빔 패턴
let beamActive = false;
 
// ── 교차 똥 패턴
let crossPoops   = [];
let crossWarning = [];
 
// ── 돌진 패턴
let bossX    = 400;  // 보스 현재 X (돌진 시 중앙 고정)
let bossY    = 0;    // 보스 현재 Y 오프셋 (돌진 시 이동)
let diveTargetY = 0; // 돌진 목표 Y
 
// ── 타이밍 상수 (프레임, 60fps)
const IDLE_DURATION  = 80;
const BEAM_CHARGE    = 40;
const BEAM_ATTACK    = 70;
const BEAM_COOL      = 80;
const CROSS_WARN     = 120;
const CROSS_FIRE     = 90;
const CROSS_COOL     = 80;
const DIVE_WARN      = 80;   // 떨림 + 빨간 눈 경고
const DIVE_CHARGE    = 40;   // 몸 뒤로 젖히기
const DIVE_ATTACK    = 35;   // 돌진 (빠름!)
const DIVE_RETURN    = 50;   // 제자리 복귀
const DIVE_COOL      = 70;   // 쿨타임
 
// 날개 끝 좌표
const LEFT_WING_TIP  = { x: 155, y: 100 };
const RIGHT_WING_TIP = { x: 645, y: 100 };
 
const CROSS_DIRS = [
  [ {wx:'left',  angle: 30}, {wx:'left',  angle: 50}, {wx:'left',  angle: 70} ],
  [ {wx:'right', angle: 150},{wx:'right', angle: 130},{wx:'right', angle: 110} ],
];
 
// ══════════════════════════════════════════════════════════
//  p5 기본
// ══════════════════════════════════════════════════════════
function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);
  diveTargetY = windowHeight * 0.6;
}
 
function draw() {
  Bossdraw();
  BossAttack();
  PooBeam();
  CrossPoopDraw();
  DiveDraw();
  drawStateDebug();
}
 
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  diveTargetY = windowHeight * 0.6;
}
 
// ══════════════════════════════════════════════════════════
//  보스 그리기
// ══════════════════════════════════════════════════════════
function Bossdraw() {
  background(255);
  noStroke();
 
  // 돌진 패턴 중엔 bossY 오프셋 적용
  let isDiving = bossState === 'dive_attack' || bossState === 'dive_return' || bossState === 'dive_charge';
 
  // 경고 떨림 (dive_warn)
  let shakeX = 0, shakeY = 0;
  if (bossState === 'dive_warn') {
    let intensity = map(stateTimer, 0, DIVE_WARN, 1, 6);
    shakeX = random(-intensity, intensity);
    shakeY = random(-intensity, intensity);
  }
 
  push();
  translate(shakeX, bossY + shakeY);
 
  // body
  fill(180);
  rect(300, 0, 200, 300);
  fill(150);
  rect(300, 100, 200, 200);
  arc(400, 300, 200, 300, 360, 180);
 
  // beak 글로우 — 빔 charge
  if (bossState === 'beam_charge') {
    let glowAlpha = map(sin(frameCount * 0.3), -1, 1, 80, 200);
    let glowSize  = map(stateTimer, 0, BEAM_CHARGE, 10, 50);
    noStroke();
    fill(180, 160, 0, glowAlpha);
    ellipse(400, 470, glowSize, glowSize);
  }
  fill('#ddcf4f');
  triangle(380, 440, 420, 440, 400, 490);
 
  // ── 눈 ──────────────────────────────────────────────────
  let isAboutToAttack = (bossState === 'idle' && stateTimer > IDLE_DURATION * 0.5);
  let eyeSpinSpeed = isAboutToAttack
    ? map(stateTimer, IDLE_DURATION * 0.5, IDLE_DURATION, 2, 18) : 0;
  let spinAngle = frameCount * eyeSpinSpeed;
 
  // 돌진 경고 중 눈 빨갛게
  let isDiveWarn = (bossState === 'dive_warn' || bossState === 'dive_charge');
  let eyeWhite   = isDiveWarn ? color(255, 80, 80) : color(255);
 
  fill(eyeWhite); noStroke();
  ellipse(330, 350, 50, 70);
  ellipse(470, 350, 50, 70);
 
  let orbitR   = 8;
  let lPupilX  = 320 + cos(spinAngle) * orbitR;
  let lPupilY  = 360 + sin(spinAngle) * orbitR;
  fill(isDiveWarn ? color(180, 0, 0) : color(55)); noStroke();
  ellipse(lPupilX, lPupilY, 30, 30);
  fill(255); ellipse(lPupilX + 5, lPupilY - 5, 8, 8);
 
  let rPupilX  = 480 + cos(-spinAngle) * orbitR;
  let rPupilY  = 340 + sin(-spinAngle) * orbitR;
  fill(isDiveWarn ? color(180, 0, 0) : color(55)); noStroke();
  ellipse(rPupilX, rPupilY, 30, 30);
  fill(255); ellipse(rPupilX + 5, rPupilY - 5, 8, 8);
 
  // ── 날개 ────────────────────────────────────────────────
  let flapAngle;
  if (bossState === 'cross_warn') {
    let t = stateTimer / CROSS_WARN;
    flapAngle = lerp(20, -40, t) * sin(frameCount * 1.5);
  } else if (bossState === 'dive_attack') {
    // 돌진 중 날개 뒤로 젖힘 (공기저항 느낌)
    flapAngle = 40;
  } else if (bossState === 'dive_charge') {
    // 찰나에 날개 크게 벌렸다가
    let t = stateTimer / DIVE_CHARGE;
    flapAngle = lerp(0, -50, t);
  } else {
    flapAngle = sin(frameCount * 1.5) * 20;
  }
 
  // 돌진/교차 패턴 날개 색
  let wingColor;
  if (bossState === 'cross_warn' || bossState === 'cross_fire') {
    wingColor = color(200, 100, 100);
  } else if (isDiveWarn || bossState === 'dive_attack' || bossState === 'dive_return') {
    wingColor = color(220, 80, 80);
  } else {
    wingColor = color(150);
  }
 
  // 왼쪽 날개
  push();
  translate(300, 150);
  rotate(flapAngle);
  fill(wingColor);
  triangle(50, 0, -60, 60, -60, -60);
  ellipse(-145, 50, 200, 30); ellipse(-130, 35, 200, 30);
  ellipse(-120, 20, 200, 30); ellipse(-110, 5,  200, 30);
  ellipse(-90, -10, 200, 30); ellipse(-60, -35, 200, 30);
  ellipse(-50, -45, 150, 10); ellipse(-40, -50, 70,  20);
  pop();
 
  // 오른쪽 날개
  push();
  translate(500, 150);
  scale(-1, 1);
  rotate(flapAngle);
  fill(wingColor);
  triangle(50, 0, -60, 60, -60, -60);
  ellipse(-145, 50, 200, 30); ellipse(-130, 35, 200, 30);
  ellipse(-120, 20, 200, 30); ellipse(-110, 5,  200, 30);
  ellipse(-90, -10, 200, 30); ellipse(-60, -35, 200, 30);
  ellipse(-50, -45, 150, 10); ellipse(-40, -50, 70,  20);
  pop();
 
  pop(); // translate(shakeX, bossY)
}
 
// ══════════════════════════════════════════════════════════
//  상태 머신
// ══════════════════════════════════════════════════════════
function BossAttack() {
  stateTimer++;
 
  if (bossState === 'idle') {
    if (stateTimer > IDLE_DURATION) {
      stateTimer = 0;
      let p = patternIndex % 3;
      if (p === 0) {
        bossState = 'beam_charge';
      } else if (p === 1) {
        bossState = 'cross_warn';
        initCrossWarning();
      } else {
        bossState = 'dive_warn';
      }
    }
 
  // ── 빔 패턴 ──────────────────────────────────────────
  } else if (bossState === 'beam_charge') {
    if (stateTimer > BEAM_CHARGE) { bossState = 'beam_attack'; beamActive = true; stateTimer = 0; }
  } else if (bossState === 'beam_attack') {
    if (stateTimer > BEAM_ATTACK) { bossState = 'beam_cool'; beamActive = false; stateTimer = 0; }
  } else if (bossState === 'beam_cool') {
    if (stateTimer > BEAM_COOL) { bossState = 'idle'; patternIndex++; stateTimer = 0; }
 
  // ── 교차 똥 패턴 ─────────────────────────────────────
  } else if (bossState === 'cross_warn') {
    if (stateTimer > CROSS_WARN) { bossState = 'cross_fire'; fireCrossPoops(); stateTimer = 0; }
  } else if (bossState === 'cross_fire') {
    if (stateTimer > CROSS_FIRE) { bossState = 'cross_cool'; crossPoops = []; crossWarning = []; stateTimer = 0; }
  } else if (bossState === 'cross_cool') {
    if (stateTimer > CROSS_COOL) { bossState = 'idle'; patternIndex++; stateTimer = 0; }
 
  // ── 돌진 패턴 ─────────────────────────────────────────
  } else if (bossState === 'dive_warn') {
    // 떨림 + 빨간 눈 (Bossdraw에서 처리)
    if (stateTimer > DIVE_WARN) { bossState = 'dive_charge'; stateTimer = 0; }
 
  } else if (bossState === 'dive_charge') {
    // 위로 살짝 올라가며 날개 벌리기
    bossY = lerp(bossY, -40, 0.15);
    if (stateTimer > DIVE_CHARGE) { bossState = 'dive_attack'; stateTimer = 0; }
 
  } else if (bossState === 'dive_attack') {
    // 빠르게 아래로 돌진
    let t = stateTimer / DIVE_ATTACK;
    bossY = lerp(-40, diveTargetY, easeIn(t));
    if (stateTimer > DIVE_ATTACK) { bossState = 'dive_return'; stateTimer = 0; }
 
  } else if (bossState === 'dive_return') {
    // 천천히 제자리 복귀
    bossY = lerp(bossY, 0, 0.1);
    if (stateTimer > DIVE_RETURN) { bossState = 'dive_cool'; bossY = 0; stateTimer = 0; }
 
  } else if (bossState === 'dive_cool') {
    if (stateTimer > DIVE_COOL) { bossState = 'idle'; patternIndex++; stateTimer = 0; }
  }
}
 
// easeIn 곡선 (돌진 가속감)
function easeIn(t) {
  return t * t * t;
}
 
// ══════════════════════════════════════════════════════════
//  돌진 이펙트 그리기
// ══════════════════════════════════════════════════════════
function DiveDraw() {
  // dive_warn: 경고 화살표 + 텍스트
  if (bossState === 'dive_warn') {
    let blink     = floor(stateTimer / 6) % 2 === 0;
    let warnAlpha = blink ? 230 : 60;
 
    // 빨간 화살표 (보스 아래 → 아래쪽)
    stroke(255, 30, 30, warnAlpha);
    strokeWeight(5);
    let ax = 400;
    for (let i = 0; i < 3; i++) {
      let ay = 520 + i * 50;
      line(ax, ay, ax - 20, ay - 25);
      line(ax, ay, ax + 20, ay - 25);
    }
    noStroke();
 
    fill(255, 30, 30, warnAlpha);
    textSize(36);
    textAlign(CENTER, CENTER);
    textFont('monospace');
    text('⚠ 돌진 ⚠', 400, 580);
    textAlign(LEFT, BASELINE);
  }
 
  // dive_attack: 속도선 (잔상)
  if (bossState === 'dive_attack') {
    let alpha = map(stateTimer, 0, DIVE_ATTACK, 200, 50);
    stroke(200, 80, 80, alpha);
    strokeWeight(3);
    let trailLen = map(stateTimer, 0, DIVE_ATTACK, 20, 120);
    // 양쪽 날개 끝에서 잔상선
    for (let i = 0; i < 6; i++) {
      let tx = 280 + i * 30;
      line(tx, bossY + 150, tx + random(-5, 5), bossY + 150 - trailLen);
    }
    noStroke();
  }
}
 
// ══════════════════════════════════════════════════════════
//  패턴 1: 똥 빔
// ══════════════════════════════════════════════════════════
function PooBeam() {
  if (!beamActive) return;
  let progress  = stateTimer / BEAM_ATTACK;
  let beamWidth = lerp(40, 15, progress);
  let beamAlpha = lerp(255, 180, progress);
  let wobble    = sin(frameCount * 30) * 4;
 
  stroke(80, 50, 0, beamAlpha);   strokeWeight(beamWidth + 6);
  line(400 + wobble, 490, 400 + wobble, height);
  stroke(139, 90, 43, beamAlpha); strokeWeight(beamWidth);
  line(400 + wobble, 490, 400 + wobble, height);
  stroke(180, 130, 70, beamAlpha * 0.6); strokeWeight(beamWidth * 0.3);
  line(400 + wobble, 490, 400 + wobble, height);
  noStroke();
}
 
// ══════════════════════════════════════════════════════════
//  패턴 2: 교차 사선 똥 발사
// ══════════════════════════════════════════════════════════
function initCrossWarning() {
  crossWarning = [];
  let allDirs = [...CROSS_DIRS[0], ...CROSS_DIRS[1]];
  for (let d of allDirs) {
    let wx = d.wx === 'left' ? LEFT_WING_TIP.x : RIGHT_WING_TIP.x;
    let wy = d.wx === 'left' ? LEFT_WING_TIP.y : RIGHT_WING_TIP.y;
    crossWarning.push({ x1: wx, y1: wy, x2: wx + cos(d.angle) * 2000, y2: wy + sin(d.angle) * 2000 });
  }
}
 
function fireCrossPoops() {
  crossPoops = [];
  let allDirs = [...CROSS_DIRS[0], ...CROSS_DIRS[1]];
  for (let d of allDirs) {
    let wx  = d.wx === 'left' ? LEFT_WING_TIP.x : RIGHT_WING_TIP.x;
    let wy  = d.wx === 'left' ? LEFT_WING_TIP.y : RIGHT_WING_TIP.y;
    let spd = 8;
    crossPoops.push({ x: wx, y: wy, vx: cos(d.angle) * spd, vy: sin(d.angle) * spd, angle: d.angle });
  }
}
 
function CrossPoopDraw() {
  if (bossState === 'cross_warn' && crossWarning.length > 0) {
    let blink     = floor(stateTimer / (stateTimer > CROSS_WARN * 0.75 ? 4 : 8)) % 2 === 0;
    let warnAlpha = blink ? 220 : 80;
    for (let w of crossWarning) {
      stroke(255, 0, 0, warnAlpha); strokeWeight(4);
      line(w.x1, w.y1, w.x2, w.y2);
      stroke(255, 255, 255, warnAlpha * 0.5); strokeWeight(1);
      line(w.x1, w.y1, w.x2, w.y2);
    }
    noStroke();
    fill(255, 50, 50, 200);
    textSize(48); textAlign(CENTER, CENTER); textFont('monospace');
    text(ceil((CROSS_WARN - stateTimer) / 60), 400, 250);
    textAlign(LEFT, BASELINE);
  }
  if (bossState === 'cross_fire') {
    for (let p of crossPoops) {
      p.x += p.vx; p.y += p.vy;
      push(); translate(p.x, p.y); rotate(p.angle + 90); drawPoop(); pop();
    }
    crossPoops = crossPoops.filter(p =>
      p.x > -100 && p.x < width + 100 && p.y > -100 && p.y < height + 100
    );
  }
}
 
// ══════════════════════════════════════════════════════════
//  똥 모양
// ══════════════════════════════════════════════════════════
function drawPoop() {
  fill(130, 82, 28); noStroke();
  ellipse(0, 20, 38, 20); ellipse(0,  8, 30, 18);
  ellipse(0, -3, 23, 16); ellipse(0,-13, 17, 14);
  ellipse(0,-22, 11, 11); ellipse(0,-29,  6,  8);
  noFill(); stroke(80, 46, 12); strokeWeight(2);
  arc(0, 13, 28, 8, 0, 180); arc(0, 1, 20, 7, 0, 180); arc(0, -9, 14, 6, 0, 180);
  noStroke();
}
 
// ══════════════════════════════════════════════════════════
//  디버그
// ══════════════════════════════════════════════════════════
function drawStateDebug() {
  const patternNames = ['빔', '교차똥', '돌진'];
  noStroke(); fill(0, 0, 0, 140); rect(10, 10, 250, 80, 8);
  fill(255); textSize(14); textFont('monospace'); textAlign(LEFT, BASELINE);
  text(`상태: ${bossState}`,   20, 32);
  text(`타이머: ${stateTimer}`, 20, 52);
  text(`다음패턴: ${patternNames[(patternIndex + 1) % 3]}`, 20, 72);
  text(`bossY: ${nf(bossY, 1, 1)}`, 20, 92);
}
