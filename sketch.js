let socket;
let myRole = 'WAITING';

const GAME_W = 1920;
const GAME_H = 1080;
const CAM_W = 640;
const CAM_H = 360;

let video;
let facemesh;
let predictions = [];

let selfieSegmentation;
let segMaskCanvas;
let segReady = false;
let modelsLoaded = 0;

let gameState = 'LOADING';
let calibrationTimer = 0;
let guideX, guideY;

let player;
let poopCooldown = 0;

let rolesStatus = { pigeonTaken: false, targetTaken: false };
let syncStatus = { PIGEON: false, TARGET: false };
let lastSyncEmitMs = 0;

let gameResult = '';
let opponentFaceImg = new Image();

let tempCanvas;
let tCtx;
let faceSendSize = 100;

let uiHit = {};
let menuOrbs = [];

const THEME = {
  bgA: [18, 24, 44],
  bgB: [39, 78, 134],
  bgC: [90, 62, 161],
  card: [14, 20, 34],
  text: [236, 243, 255],
  sub: [173, 194, 226],
  accent: [104, 232, 215],
  accent2: [129, 120, 255],
  success: [111, 235, 140],
  danger: [255, 120, 133],
  warning: [255, 212, 108]
};

let globalState = {
  pigeonX: GAME_W / 2,
  items: [],
  splatters: [],
  eggsEaten: 0,
  poopHits: 0
};

let targetData = {
  x: GAME_W / 2, y: GAME_H * 0.8,
  mouthX: GAME_W / 2, mouthY: GAME_H * 0.8 + 20,
  mouthOpen: false, mouthRadius: 20, faceWidth: 150
};

function setup() {
  let canvasMain = createCanvas(GAME_W, GAME_H);
  frameRate(30);
  canvasMain.style('object-fit', 'fill');
  textFont('Arial');

  guideX = width / 2;
  guideY = height * 0.75;

  player = new Player();
  initMenuOrbs();

  tempCanvas = document.createElement('canvas');
  tempCanvas.width = faceSendSize;
  tempCanvas.height = faceSendSize;
  tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

  socket = io();

  socket.on('roleStatus', (status) => {
    rolesStatus = status;
  });

  socket.on('calibrationStatus', (status) => {
    syncStatus = status;
    if (gameState === 'WAITING_SYNC' && syncStatus.PIGEON && syncStatus.TARGET) {
      gameState = 'PLAYING';
    }
  });

  socket.on('goRoleSelection', () => {
    myRole = 'WAITING';
    gameResult = '';
    resetGameState();
    syncStatus = { PIGEON: false, TARGET: false };
    opponentFaceImg.src = '';
    gameState = 'ROLE_SELECTION';
  });

  socket.on('roleAssigned', (role) => {
    myRole = role;
    gameState = 'WAITING_OPPONENT';
  });

  socket.on('gameReady', () => {
    resetGameState();
    syncStatus = { PIGEON: false, TARGET: false };
    if (myRole !== 'WAITING') gameState = 'MAIN';
  });

  socket.on('gameStart', () => {
    gameState = 'PLAYING';
    syncStatus = { PIGEON: true, TARGET: true };
  });

  socket.on('opponentLeft', () => {
    if (gameState === 'GAME_OVER') {
      myRole = 'WAITING';
      gameResult = '';
      resetGameState();
      syncStatus = { PIGEON: false, TARGET: false };
      gameState = 'ROLE_SELECTION';
      return;
    }
    if (gameState === 'PLAYING' || gameState === 'MAIN' || gameState === 'CALIBRATE' || gameState === 'WAITING_SYNC') {
      gameState = 'WAITING_OPPONENT';
      resetGameState();
      syncStatus = { PIGEON: false, TARGET: false };
    }
  });

  socket.on('gameOverSync', (result) => {
    gameResult = result;
    gameState = 'GAME_OVER';
  });

  video = createCapture({ audio: false, video: { width: CAM_W, height: CAM_H } }, videoReady);
  video.size(CAM_W, CAM_H);
  video.hide();

  facemesh = ml5.facemesh(video, () => {
    modelsLoaded++;
    checkAllModelsReady();
  });
  facemesh.on('predict', results => { predictions = results; });

  segMaskCanvas = document.createElement('canvas');
  segMaskCanvas.width = CAM_W;
  segMaskCanvas.height = CAM_H;

  selfieSegmentation = new SelfieSegmentation({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
  });
  selfieSegmentation.setOptions({ modelSelection: 1, selfieMode: false });
  selfieSegmentation.onResults(onSegResults);

  socket.on('targetDataUpdate', (data) => { if (myRole === 'PIGEON') targetData = data; });
  socket.on('gameStateUpdate', (state) => { if (myRole === 'TARGET') globalState = state; });
  socket.on('faceImageSync', (base64) => { opponentFaceImg.src = base64; });
}

function resetGameState() {
  globalState = {
    pigeonX: GAME_W / 2,
    items: [],
    splatters: [],
    eggsEaten: 0,
    poopHits: 0
  };
  poopCooldown = 0;
}

function initMenuOrbs() {
  menuOrbs = [];
  for (let i = 0; i < 24; i++) {
    menuOrbs.push({
      x: random(width),
      y: random(height),
      r: random(60, 180),
      vx: random(-0.28, 0.28),
      vy: random(-0.18, 0.18),
      c: random() > 0.5 ? 'a' : 'b'
    });
  }
}

function drawGradientBg(c1, c2) {
  for (let y = 0; y < height; y += 4) {
    let t = y / height;
    let r = lerp(c1[0], c2[0], t);
    let g = lerp(c1[1], c2[1], t);
    let b = lerp(c1[2], c2[2], t);
    noStroke();
    fill(r, g, b);
    rect(0, y, width, 4);
  }
}

function drawMenuOrbs() {
  noStroke();
  for (let o of menuOrbs) {
    o.x += o.vx;
    o.y += o.vy;
    if (o.x < -o.r) o.x = width + o.r;
    if (o.x > width + o.r) o.x = -o.r;
    if (o.y < -o.r) o.y = height + o.r;
    if (o.y > height + o.r) o.y = -o.r;

    if (o.c === 'a') fill(THEME.accent[0], THEME.accent[1], THEME.accent[2], 22);
    else fill(THEME.accent2[0], THEME.accent2[1], THEME.accent2[2], 20);
    ellipse(o.x, o.y, o.r, o.r);
  }
}

function drawGlassCard(cx, cy, w, h, alpha = 150, strokeA = 70, radius = 28) {
  push();
  rectMode(CENTER);
  drawingContext.shadowColor = 'rgba(0,0,0,0.35)';
  drawingContext.shadowBlur = 20;
  fill(THEME.card[0], THEME.card[1], THEME.card[2], alpha);
  stroke(255, 255, 255, strokeA);
  strokeWeight(1.5);
  rect(cx, cy, w, h, radius);
  drawingContext.shadowBlur = 0;
  pop();
}

function pointInCenteredRect(px, py, b) {
  return px >= b.cx - b.w / 2 && px <= b.cx + b.w / 2 && py >= b.cy - b.h / 2 && py <= b.cy + b.h / 2;
}

function drawButton(cx, cy, w, h, label, enabled = true, hue = 'accent') {
  let hover = enabled && pointInCenteredRect(mouseX, mouseY, { cx, cy, w, h });
  let s = hover ? 1.03 : 1.0;

  push();
  translate(cx, cy);
  scale(s);
  rectMode(CENTER);
  noStroke();

  let col = hue === 'danger' ? THEME.danger : hue === 'success' ? THEME.success : THEME.accent2;
  fill(col[0], col[1], col[2], enabled ? 230 : 90);
  rect(0, 0, w, h, 18);

  fill(255, 255, 255, enabled ? 34 : 15);
  rect(0, -h * 0.18, w * 0.96, h * 0.36, 14);

  fill(255, enabled ? 255 : 150);
  textAlign(CENTER, CENTER);
  textSize(28);
  textStyle(BOLD);
  text(label, 0, 1);
  textStyle(NORMAL);
  pop();

  return { cx, cy, w, h, enabled };
}

function drawScreenTitle(main, sub) {
  textAlign(CENTER, CENTER);
  fill(THEME.text[0], THEME.text[1], THEME.text[2]);
  textStyle(BOLD);
  textSize(76);
  text(main, width / 2, 120);
  textStyle(NORMAL);
  fill(THEME.sub[0], THEME.sub[1], THEME.sub[2]);
  textSize(30);
  text(sub, width / 2, 180);
}

function videoReady() { sendFrameToSegmentation(); }

async function sendFrameToSegmentation() {
  if (video.elt.readyState >= 2) await selfieSegmentation.send({ image: video.elt });
  setTimeout(sendFrameToSegmentation, 33);
}

function onSegResults(results) {
  if (!segReady) {
    segReady = true;
    modelsLoaded++;
    checkAllModelsReady();
  }
  let ctx = segMaskCanvas.getContext('2d', { willReadFrequently: true });
  ctx.save();
  ctx.clearRect(0, 0, CAM_W, CAM_H);
  ctx.drawImage(results.segmentationMask, 0, 0, CAM_W, CAM_H);
  ctx.globalCompositeOperation = 'source-in';
  ctx.drawImage(results.image, 0, 0, CAM_W, CAM_H);
  ctx.restore();
}

function checkAllModelsReady() {
  if (modelsLoaded >= 2) gameState = 'ROLE_SELECTION';
}

function draw() {
  uiHit = {};
  switch (gameState) {
    case 'LOADING': drawLoadingScreen(); break;
    case 'ROLE_SELECTION': drawRoleSelectionScreen(); break;
    case 'WAITING_OPPONENT': drawWaitingScreen(); break;
    case 'MAIN': drawMainScreen(); break;
    case 'CALIBRATE': drawCalibrateScreen(); break;
    case 'WAITING_SYNC': drawWaitingSyncScreen(); break;
    case 'PLAYING': playGame(); break;
    case 'GAME_OVER': drawGameOverScreen(); break;
  }
}

function playGame() {
  background(100, 180, 240);
  noTint();

  if (poopCooldown > 0) poopCooldown--;

  if (predictions.length > 0) {
    player.update(predictions[0].scaledMesh);

    if (frameCount % 15 === 0) sendMyFaceImage();

    if (myRole === 'PIGEON') {
      globalState.pigeonX = lerp(globalState.pigeonX, player.x, 0.3);
      if (player.mouthOpen && poopCooldown === 0) {
        dropItem();
        poopCooldown = 15;
      }
      if (globalState.eggsEaten >= 5) socket.emit('gameOverTrigger', 'TARGET_WIN');
      else if (globalState.poopHits >= 5) socket.emit('gameOverTrigger', 'PIGEON_WIN');
    } else if (myRole === 'TARGET') {
      targetData = {
        x: player.x, y: player.y,
        mouthX: player.mouthX, mouthY: player.mouthY,
        mouthOpen: player.mouthOpen, mouthRadius: player.mouthRadius,
        faceWidth: player.faceScreenWidth
      };
      if (frameCount % 2 === 0) socket.emit('targetSync', targetData);
    }
  }

  if (myRole === 'PIGEON') {
    updatePhysics();
    if (frameCount % 2 === 0) socket.emit('hostSync', globalState);
  }

  drawSplatters();

  if (myRole === 'TARGET') {
    player.show('PLAYING');
    drawPigeonAvatar(globalState.pigeonX);
  } else if (myRole === 'PIGEON') {
    drawTargetAvatar();
    drawPigeonAvatar(globalState.pigeonX);
  }

  drawItems();
  drawUI();
}

function sendMyFaceImage() {
  if (!segReady || player.faceWidth <= 0) return;
  tCtx.clearRect(0, 0, faceSendSize, faceSendSize);
  let cropBase = max(player.faceWidth, player.faceHeight) * 1.3;
  let sx = player.faceCenterX - cropBase / 2;
  let sy = player.faceCenterY - cropBase * 0.6;

  tCtx.save();
  tCtx.translate(faceSendSize, 0);
  tCtx.scale(-1, 1);
  tCtx.beginPath();
  tCtx.arc(faceSendSize / 2, faceSendSize / 2, faceSendSize / 2, 0, Math.PI * 2);
  tCtx.clip();
  tCtx.drawImage(segMaskCanvas, sx, sy, cropBase, cropBase, 0, 0, faceSendSize, faceSendSize);
  tCtx.restore();

  let base64 = tempCanvas.toDataURL('image/webp', 0.3);
  socket.emit('faceImageSync', base64);
}

function dropItem() {
  let type = random() > 0.8 ? 'EGG' : 'POOP';
  globalState.items.push({ x: globalState.pigeonX, y: 160, type: type });
}

function mousePressed() {
  if (gameState === 'ROLE_SELECTION') {
    if (uiHit.rolePigeon && uiHit.rolePigeon.enabled && pointInCenteredRect(mouseX, mouseY, uiHit.rolePigeon)) {
      socket.emit('selectRole', 'PIGEON');
      return;
    }
    if (uiHit.roleTarget && uiHit.roleTarget.enabled && pointInCenteredRect(mouseX, mouseY, uiHit.roleTarget)) {
      socket.emit('selectRole', 'TARGET');
      return;
    }
  } else if (gameState === 'MAIN') {
    if (!uiHit.startBtn || pointInCenteredRect(mouseX, mouseY, uiHit.startBtn)) {
      gameState = 'CALIBRATE';
      calibrationTimer = 0;
      syncStatus = { PIGEON: false, TARGET: false };
      return;
    }
  } else if (gameState === 'PLAYING' && myRole === 'PIGEON' && poopCooldown === 0) {
    dropItem();
    poopCooldown = 15;
  } else if (gameState === 'GAME_OVER') {
    if (!uiHit.restartBtn || pointInCenteredRect(mouseX, mouseY, uiHit.restartBtn)) {
      socket.emit('restartToRoleSelection');
      return;
    }
  }
}

function updatePhysics() {
  for (let i = globalState.items.length - 1; i >= 0; i--) {
    let item = globalState.items[i];
    item.y += 23;

    let dMouth = dist(item.x, item.y, targetData.mouthX, targetData.mouthY);
    let dFace = dist(item.x, item.y, targetData.x, targetData.y);
    let headHitRadius = targetData.faceWidth * 0.45;
    let mouthHitRadius = targetData.mouthRadius * 1.5;

    if (item.type === 'EGG') {
      if (dMouth < mouthHitRadius && targetData.mouthOpen) {
        globalState.eggsEaten += 1;
        globalState.items.splice(i, 1);
        continue;
      }
    } else if (item.type === 'POOP') {
      if (dFace < headHitRadius) {
        globalState.poopHits += 1;
        globalState.splatters.push({ x: item.x, y: item.y, size: random(150, 350) });
        globalState.items.splice(i, 1);
        continue;
      }
    }

    if (item.y > GAME_H + 50) globalState.items.splice(i, 1);
  }
}

class Player {
  constructor() {
    this.x = width / 2;
    this.y = height / 2;
    this.mouthX = width / 2;
    this.mouthY = height / 2 + 20;
    this.mouthOpen = false;
    this.mouthRadius = width * 0.03;
    this.faceWidth = 0;
    this.faceHeight = 0;
    this.faceCenterX = 0;
    this.faceCenterY = 0;
    this.faceScreenWidth = 0;
    this.lockedDisplaySize = 0;
  }

  update(keypoints) {
    let minX = CAM_W, minY = CAM_H, maxX = 0, maxY = 0;
    for (let i = 0; i < keypoints.length; i++) {
      let px = keypoints[i][0], py = keypoints[i][1];
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }

    this.faceWidth = maxX - minX;
    this.faceHeight = maxY - minY;
    this.faceCenterX = (minX + maxX) * 0.5;
    this.faceCenterY = (minY + maxY) * 0.5;

    let targetX = map(this.faceCenterX, 0, CAM_W, width, 0);
    let targetY = map(this.faceCenterY, 0, CAM_H, 0, height);
    this.x = lerp(this.x, targetX, 0.18);
    this.y = lerp(this.y, targetY, 0.18);

    this.faceScreenWidth = this.faceWidth * width / CAM_W;

    let targetDisplaySize = this.faceScreenWidth * 0.9;
    if (this.lockedDisplaySize <= 0) this.lockedDisplaySize = targetDisplaySize;
    else this.lockedDisplaySize = lerp(this.lockedDisplaySize, targetDisplaySize, 0.03);

    let upperLip = keypoints[13], lowerLip = keypoints[14];
    let mouthRawX = (upperLip[0] + lowerLip[0]) / 2, mouthRawY = (upperLip[1] + lowerLip[1]) / 2;
    let targetMX = map(mouthRawX, 0, CAM_W, width, 0), targetMY = map(mouthRawY, 0, CAM_H, 0, height);
    this.mouthX = lerp(this.mouthX, targetMX, 0.18);
    this.mouthY = lerp(this.mouthY, targetMY, 0.18);

    let mouthDist = dist(upperLip[0], upperLip[1], lowerLip[0], lowerLip[1]);
    this.mouthOpen = mouthDist > 6;
    let mouthAmount = constrain(mouthDist, 3, 20);
    this.mouthRadius = map(mouthAmount, 3, 20, 20, 50);
  }

  show(mode) {
    if (segReady) this._drawFaceOnly();

    if (this.mouthOpen) {
      fill(0, 255, 255, mode === 'CALIBRATE' ? 120 : 80);
      noStroke();
      let pulse = sin(frameCount * 0.15) * 4;
      let displayMouth = this.mouthRadius * 3;
      ellipse(this.mouthX, this.mouthY, displayMouth + pulse, displayMouth + pulse);

      if (mode === 'CALIBRATE') {
        noFill();
        stroke(0, 255, 255, 200);
        strokeWeight(2);
        ellipse(this.mouthX, this.mouthY, displayMouth + pulse, displayMouth + pulse);
        noStroke();
      }
    } else {
      if (mode === 'CALIBRATE') {
        noFill();
        stroke(0, 255, 255, 150);
        strokeWeight(3);
        ellipse(this.mouthX, this.mouthY, 30, 30);
        noStroke();
      } else {
        fill(0, 255, 255, 100);
        noStroke();
        ellipse(this.mouthX, this.mouthY, 15, 15);
      }
    }
  }

  _drawFaceOnly() {
    if (!segReady || this.faceWidth <= 0) return;

    let cropBase = max(this.faceWidth, this.faceHeight) * 1.3;
    let sx = this.faceCenterX - cropBase / 2, sy = this.faceCenterY - cropBase * 0.6;
    let drawSize = this.lockedDisplaySize;

    push();
    translate(width, 0);
    scale(-1, 1);
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.arc(width - this.x, this.y, drawSize * 0.52, 0, TWO_PI);
    drawingContext.clip();
    drawingContext.drawImage(
      segMaskCanvas,
      sx, sy, cropBase, cropBase,
      width - this.x - drawSize / 2, this.y - drawSize / 2, drawSize, drawSize
    );
    drawingContext.restore();
    pop();
  }
}

function drawPigeonAvatar(x) {
  if (opponentFaceImg.src && myRole === 'TARGET') {
    drawingContext.drawImage(opponentFaceImg, x - 80, 140 - 80, 160, 160);
  } else if (myRole === 'PIGEON') {
    player.x = x;
    player.y = 140;
    player.lockedDisplaySize = 160;
    player._drawFaceOnly();
  } else {
    push();
    fill(255);
    textSize(140);
    textAlign(CENTER, CENTER);
    text("🕊️", x, 140);
    pop();
  }
}

function drawTargetAvatar() {
  let drawSize = targetData.faceWidth * 0.9;
  if (opponentFaceImg.src) {
    drawingContext.drawImage(opponentFaceImg, targetData.x - drawSize / 2, targetData.y - drawSize / 2, drawSize, drawSize);
  } else {
    fill(255, 200, 200, 120);
    let headHitDiameter = targetData.faceWidth * 0.45 * 2;
    ellipse(targetData.x, targetData.y, headHitDiameter, headHitDiameter);
  }

  if (targetData.mouthOpen) {
    fill(0, 255, 255, 80);
    stroke(0, 255, 0, 150);
    strokeWeight(2);
    let pulse = sin(frameCount * 0.2) * 4;
    let mouthHitDiameter = targetData.mouthRadius * 3;
    ellipse(targetData.mouthX, targetData.mouthY, mouthHitDiameter + pulse, mouthHitDiameter + pulse);
    noStroke();
  } else {
    fill(0, 255, 255, 100);
    noStroke();
    ellipse(targetData.mouthX, targetData.mouthY, 15, 15);
  }
}

function drawItems() {
  push();
  fill(255);
  textSize(90);
  textAlign(CENTER, CENTER);
  for (let item of globalState.items) {
    text(item.type === 'EGG' ? "🥚" : "💩", item.x, item.y);
  }
  pop();
}

function drawSplatters() {
  for (let s of globalState.splatters) {
    fill(101, 67, 33, 220);
    noStroke();
    ellipse(s.x, s.y, s.size, s.size * 0.8);
    ellipse(s.x + 20, s.y - 10, s.size * 0.6, s.size * 0.6);
  }
}

function drawProgressBar(x, y, w, h, value, maxValue, col, label) {
  let r = constrain(value / maxValue, 0, 1);
  push();
  rectMode(CORNER);
  noStroke();
  fill(255, 255, 255, 40);
  rect(x, y, w, h, 999);
  fill(col[0], col[1], col[2], 220);
  rect(x, y, w * r, h, 999);
  fill(240);
  textAlign(CENTER, CENTER);
  textSize(22);
  text(`${label} ${value}/${maxValue}`, x + w / 2, y + h / 2 + 1);
  pop();
}

function drawUI() {
  drawGlassCard(250, 96, 430, 138, 125, 80, 24);
  fill(THEME.text[0], THEME.text[1], THEME.text[2]);
  textAlign(LEFT, TOP);
  textSize(30);
  textStyle(BOLD);
  text(`역할: ${myRole === 'PIGEON' ? '비둘기 🕊️' : '사람 😲'}`, 70, 52);
  textStyle(NORMAL);
  fill(THEME.sub[0], THEME.sub[1], THEME.sub[2]);
  textSize(22);
  text(`실시간 멀티 매치`, 70, 95);

  drawGlassCard(width - 300, 104, 560, 154, 125, 80, 24);
  drawProgressBar(width - 535, 70, 470, 34, globalState.poopHits, 5, THEME.danger, '사람이 맞은 똥');
  drawProgressBar(width - 535, 118, 470, 34, globalState.eggsEaten, 5, THEME.warning, '사람이 먹은 알');
}

function drawLoadingScreen() {
  drawGradientBg(THEME.bgA, THEME.bgC);
  drawMenuOrbs();

  drawScreenTitle("입벌려! 비둘기 똥 들어간다~", "AI 모델을 불러오는 중");

  drawGlassCard(width / 2, height / 2 + 50, 650, 260, 145, 85, 30);

  fill(THEME.text[0], THEME.text[1], THEME.text[2]);
  textAlign(CENTER, CENTER);
  textSize(44);
  text("모델 로딩 중...", width / 2, height / 2 - 5);

  let pct = constrain(modelsLoaded / 2, 0, 1);
  noStroke();
  fill(255, 255, 255, 45);
  rect(width / 2 - 220, height / 2 + 55, 440, 26, 999);
  fill(THEME.accent[0], THEME.accent[1], THEME.accent[2], 240);
  rect(width / 2 - 220, height / 2 + 55, 440 * pct, 26, 999);

  fill(THEME.sub[0], THEME.sub[1], THEME.sub[2]);
  textSize(26);
  text(`(${modelsLoaded}/2)`, width / 2, height / 2 + 112);

  push();
  translate(width / 2, height / 2 + 170);
  noFill();
  stroke(THEME.accent2[0], THEME.accent2[1], THEME.accent2[2], 230);
  strokeWeight(8);
  arc(0, 0, 46, 46, frameCount * 0.08, frameCount * 0.08 + PI * 1.4);
  pop();
}

function drawRoleCard(cfg) {
  let hover = cfg.enabled && pointInCenteredRect(mouseX, mouseY, cfg);
  let s = hover ? 1.03 : 1.0;
  let borderCol = cfg.enabled ? (cfg.type === 'PIGEON' ? THEME.accent2 : THEME.accent) : [140, 146, 160];

  push();
  translate(cfg.cx, cfg.cy);
  scale(s);

  drawGlassCard(0, 0, cfg.w, cfg.h, 152, 95, 24);

  noFill();
  stroke(borderCol[0], borderCol[1], borderCol[2], cfg.enabled ? 210 : 80);
  strokeWeight(3);
  rectMode(CENTER);
  rect(0, 0, cfg.w - 8, cfg.h - 8, 22);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(82);
  text(cfg.emoji, 0, -62);

  fill(THEME.text[0], THEME.text[1], THEME.text[2]);
  textSize(38);
  textStyle(BOLD);
  text(cfg.title, 0, 20);
  textStyle(NORMAL);

  fill(THEME.sub[0], THEME.sub[1], THEME.sub[2]);
  textSize(23);
  text(cfg.desc, 0, 72);

  if (!cfg.enabled) {
    fill(0, 0, 0, 120);
    rect(0, 0, cfg.w, cfg.h, 24);
    fill(255, 110, 110);
    textSize(30);
    textStyle(BOLD);
    text("선택 불가", 0, 0);
    textStyle(NORMAL);
  }

  pop();
}

function drawRoleSelectionScreen() {
  drawGradientBg(THEME.bgA, THEME.bgB);
  drawMenuOrbs();

  drawScreenTitle("역할 선택", "원하는 캐릭터를 선택하세요");

  let cy = height * 0.56;
  let cardW = 420;
  let cardH = 360;
  let leftX = width / 2 - 280;
  let rightX = width / 2 + 280;

  let pCard = { cx: leftX, cy, w: cardW, h: cardH, enabled: !rolesStatus.pigeonTaken, emoji: "🕊️", title: "비둘기", desc: "입을 벌려 똥/알 투척", type: 'PIGEON' };
  let tCard = { cx: rightX, cy, w: cardW, h: cardH, enabled: !rolesStatus.targetTaken, emoji: "😲", title: "사람", desc: "똥을 피하고 알을 먹기", type: 'TARGET' };

  drawRoleCard(pCard);
  drawRoleCard(tCard);

  uiHit.rolePigeon = pCard;
  uiHit.roleTarget = tCard;
}

function drawWaitingScreen() {
  drawGradientBg(THEME.bgA, THEME.bgC);
  drawMenuOrbs();
  drawScreenTitle("매칭 대기 중", "상대가 들어오면 자동으로 다음 단계로 이동");

  drawGlassCard(width / 2, height / 2 + 80, 860, 260, 145, 85, 30);

  fill(THEME.text[0], THEME.text[1], THEME.text[2]);
  textAlign(CENTER, CENTER);
  textSize(42);
  text("상대방 접속을 기다리는 중...", width / 2, height / 2 + 30);

  fill(THEME.sub[0], THEME.sub[1], THEME.sub[2]);
  textSize(30);
  text(`내 역할: ${myRole === 'PIGEON' ? '비둘기 🕊️' : '사람 😲'}`, width / 2, height / 2 + 95);

  let dotX = width / 2 - 54;
  for (let i = 0; i < 3; i++) {
    let a = 90 + 130 * max(0, sin(frameCount * 0.09 - i * 0.8));
    fill(THEME.accent[0], THEME.accent[1], THEME.accent[2], a);
    ellipse(dotX + i * 54, height / 2 + 152, 20, 20);
  }
}

function drawMainScreen() {
  drawGradientBg(THEME.bgA, THEME.bgB);
  drawMenuOrbs();
  drawScreenTitle("게임 시작 준비", "클릭 후 3초 얼굴 정렬을 완료하면 시작");

  drawGlassCard(width / 2, height / 2 + 36, 1020, 300, 150, 90, 30);

  fill(THEME.text[0], THEME.text[1], THEME.text[2]);
  textAlign(CENTER, CENTER);
  textSize(52);
  text("입벌려! 비둘기 똥 들어간다~", width / 2, height / 2 - 18);

  fill(THEME.sub[0], THEME.sub[1], THEME.sub[2]);
  textSize(30);
  text("가이드 박스에 얼굴을 맞추고 잠시 유지하세요", width / 2, height / 2 + 45);

  uiHit.startBtn = drawButton(width / 2, height / 2 + 140, 360, 78, "캘리브레이션 시작", true, 'success');
}

function drawGameOverScreen() {
  let win = (gameResult === 'TARGET_WIN' && myRole === 'TARGET') || (gameResult === 'PIGEON_WIN' && myRole === 'PIGEON');

  drawGradientBg(win ? [18, 40, 34] : [44, 18, 26], win ? [34, 90, 66] : [110, 45, 65]);
  drawMenuOrbs();

  drawGlassCard(width / 2, height / 2, 980, 540, 155, 95, 32);

  fill(win ? THEME.success[0] : THEME.danger[0], win ? THEME.success[1] : THEME.danger[1], win ? THEME.success[2] : THEME.danger[2]);
  textAlign(CENTER, CENTER);
  textSize(170);
  textStyle(BOLD);
  text(win ? "WIN" : "LOSE", width / 2, height / 2 - 120);
  textStyle(NORMAL);

  fill(THEME.text[0], THEME.text[1], THEME.text[2]);
  textSize(40);
  if (gameResult === 'TARGET_WIN') text("사람이 알 5개를 먹었습니다! 😲", width / 2, height / 2 + 10);
  else text("사람이 똥을 5번 맞았습니다! 🕊️", width / 2, height / 2 + 10);

  fill(THEME.sub[0], THEME.sub[1], THEME.sub[2]);
  textSize(26);
  text("다시하기를 누르면 역할 선택으로 돌아갑니다", width / 2, height / 2 + 72);

  uiHit.restartBtn = drawButton(width / 2, height / 2 + 164, 290, 74, "다시하기", true, win ? 'success' : 'danger');
}

function drawWaitingSyncScreen() {
  drawGradientBg(THEME.bgA, THEME.bgC);
  drawMenuOrbs();

  drawScreenTitle("인식 완료", "상대방 인식 완료를 기다리는 중");

  drawGlassCard(width / 2, height / 2 + 40, 860, 320, 150, 90, 30);

  textAlign(CENTER, CENTER);
  fill(THEME.text[0], THEME.text[1], THEME.text[2]);
  textSize(44);
  text("동기화 중...", width / 2, height / 2 - 48);

  let pReady = syncStatus.PIGEON;
  let tReady = syncStatus.TARGET;

  fill(pReady ? THEME.success[0] : 255, pReady ? THEME.success[1] : 255, pReady ? THEME.success[2] : 255);
  textSize(34);
  text(`비둘기: ${pReady ? '완료' : '대기중'}`, width / 2, height / 2 + 20);

  fill(tReady ? THEME.success[0] : 255, tReady ? THEME.success[1] : 255, tReady ? THEME.success[2] : 255);
  text(`사람: ${tReady ? '완료' : '대기중'}`, width / 2, height / 2 + 72);

  noStroke();
  fill(255, 255, 255, 45);
  rect(width / 2 - 220, height / 2 + 122, 440, 22, 999);
  let syncCount = (pReady ? 1 : 0) + (tReady ? 1 : 0);
  fill(THEME.accent[0], THEME.accent[1], THEME.accent[2], 230);
  rect(width / 2 - 220, height / 2 + 122, 440 * (syncCount / 2), 22, 999);

  if (millis() - lastSyncEmitMs > 1000) {
    socket.emit('calibrationComplete');
    lastSyncEmitMs = millis();
  }
}

function drawCalibrateScreen() {
  background(28, 34, 52);
  push();
  tint(255, 80);
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();

  fill(8, 10, 18, 110);
  rect(0, 0, width, height);

  if (predictions.length > 0) player.update(predictions[0].scaledMesh);
  player.show('CALIBRATE');

  let targetFaceWidth = width / 8;
  let guideW = targetFaceWidth;
  let guideH = targetFaceWidth * 1.4;

  let sizeOk = player.faceScreenWidth > 0 && abs(player.faceScreenWidth - targetFaceWidth) < targetFaceWidth * 0.25;
  let posOk = dist(player.x, player.y, guideX, guideY) < guideW * 0.6;
  let aligned = sizeOk && posOk && predictions.length > 0;

  aligned ? calibrationTimer += deltaTime : calibrationTimer = 0;

  if (calibrationTimer >= 3000) {
    gameState = 'WAITING_SYNC';
    calibrationTimer = 0;
    lastSyncEmitMs = 0;
    socket.emit('calibrationComplete');
    return;
  }

  drawGlassCard(width / 2, 86, 760, 112, 140, 75, 20);
  textAlign(CENTER, CENTER);
  fill(THEME.text[0], THEME.text[1], THEME.text[2]);
  textSize(34);
  text("얼굴을 가이드 박스에 맞춰 3초 유지하세요", width / 2, 72);

  let remain = max(0, ceil((3000 - calibrationTimer) / 1000));
  fill(aligned ? THEME.success[0] : THEME.warning[0], aligned ? THEME.success[1] : THEME.warning[1], aligned ? THEME.success[2] : THEME.warning[2]);
  textSize(46);
  text(aligned ? remain : "정렬 중...", width / 2, 108);

  rectMode(CENTER);
  noFill();
  strokeWeight(6);
  stroke(aligned ? color(95, 245, 135, 255) : color(255, 223, 118, 230));
  rect(guideX, guideY, guideW, guideH, 22);

  noStroke();
  fill(255, 255, 255, 55);
  rect(guideX, guideY, guideW * 0.95, guideH * 0.95, 18);

  rectMode(CORNER);
}
