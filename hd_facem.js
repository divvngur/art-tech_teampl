let gameState = 'LOADING';

let videoHD;
let videoAI;

let facemesh;
let predictions = [];

let selfieSegmentation;
let segMaskCanvas;
let segReady = false;

let calibrationTimer = 0;
let guideX, guideY;

let player;
let pigeons = [];
let items = [];
let splatters = [];
let score = 0;

const HD_W = 1920;
const HD_H = 1080;
const AI_W = 640;
const AI_H = 360;

let modelsLoaded = 0;

// ★개선4: 게임 시작 시 기준 얼굴 크기 저장
let baseFaceScreenWidth = 0;
let showDistanceWarning = false;
let warningAlpha = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);

  // ★개선3: 가이드 박스를 화면 하단 정중앙으로
  guideX = width / 2;
  guideY = height * 0.75;

  videoHD = createCapture({
    video: { width: HD_W, height: HD_H }
  }, hdVideoReady);
  videoHD.size(HD_W, HD_H);
  videoHD.hide();

  videoAI = createCapture({
    video: { width: AI_W, height: AI_H }
  });
  videoAI.size(AI_W, AI_H);
  videoAI.hide();

  facemesh = ml5.facemesh(videoAI, () => {
    console.log('FaceMesh Ready!');
    modelsLoaded++;
    checkAllModelsReady();
  });
  facemesh.on('predict', results => {
    predictions = results;
  });

  segMaskCanvas = document.createElement('canvas');
  segMaskCanvas.width = HD_W;
  segMaskCanvas.height = HD_H;

  selfieSegmentation = new SelfieSegmentation({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
  });
  selfieSegmentation.setOptions({
    modelSelection: 1,
    selfieMode: false
  });
  selfieSegmentation.onResults(onSegResults);

  player = new Player();
  for (let i = 0; i < 3; i++) {
    pigeons.push(new Pigeon(random(width), random(50, 150)));
  }
}

function hdVideoReady() {
  console.log('HD Video Ready!');
  sendFrameToSegmentation();
}

async function sendFrameToSegmentation() {
  if (videoHD.elt.readyState >= 2) {
    await selfieSegmentation.send({ image: videoHD.elt });
  }
  requestAnimationFrame(sendFrameToSegmentation);
}

function onSegResults(results) {
  if (!segReady) {
    segReady = true;
    console.log('Selfie Segmentation Ready!');
    modelsLoaded++;
    checkAllModelsReady();
  }

  let ctx = segMaskCanvas.getContext('2d');
  ctx.save();
  ctx.clearRect(0, 0, HD_W, HD_H);
  ctx.drawImage(results.segmentationMask, 0, 0, HD_W, HD_H);
  ctx.globalCompositeOperation = 'source-in';
  ctx.drawImage(results.image, 0, 0, HD_W, HD_H);
  ctx.restore();
}

function checkAllModelsReady() {
  if (modelsLoaded >= 2) gameState = 'MAIN';
}

function draw() {
  background(240);
  switch (gameState) {
    case 'LOADING':     drawLoadingScreen(); break;
    case 'MAIN':        drawMainScreen(); break;
    case 'CALIBRATE':   drawCalibrateScreen(); break;
    case 'PLAYING':     playGame(); break;
    case 'STAGE_CLEAR': drawStageClearScreen(); break;
    case 'LEADERBOARD': drawLeaderboard(); break;
  }
}

// ==========================================
// 게임 플레이
// ==========================================
function playGame() {
  background(100, 180, 240);
  noTint();

  if (predictions.length > 0) {
    player.update(predictions[0].scaledMesh);
  }

  // ★개선4: 거리 경고 판정
  if (baseFaceScreenWidth > 0 && player.faceScreenWidth > 0) {
    if (player.faceScreenWidth > baseFaceScreenWidth * 1.25) {
      showDistanceWarning = true;
      warningAlpha = min(warningAlpha + 8, 255);
    } else {
      showDistanceWarning = false;
      warningAlpha = max(warningAlpha - 8, 0);
    }
  }

  player.show('PLAYING');

  for (let pigeon of pigeons) {
    pigeon.update();
    pigeon.show();
  }

  for (let i = items.length - 1; i >= 0; i--) {
    let item = items[i];
    item.update();
    item.show();

    let dMouth = dist(item.x, item.y, player.mouthX, player.mouthY);
    let dFace = dist(item.x, item.y, player.x, player.y);
    let hitHead = dFace < player.faceScreenWidth * 0.55;

    if (!item.isDead) {
      if (item.type === 'EGG') {
        if (dMouth < player.mouthRadius * 0.7 && player.mouthOpen) {
          score += 10;
          item.isDead = true;
        }
      } else if (item.type === 'POOP') {
        if (hitHead) {
          score -= 5;
          item.isDead = true;
          splatters.push({ x: item.x, y: item.y, size: random(100, 250) });
        }
      }
    }
    if (item.isDead) items.splice(i, 1);
  }

  for (let s of splatters) {
    fill(101, 67, 33, 220);
    noStroke();
    ellipse(s.x, s.y, s.size, s.size * 0.8);
    ellipse(s.x + 20, s.y - 10, s.size * 0.6, s.size * 0.6);
  }

  // 점수 UI
  fill(255);
  stroke(0);
  strokeWeight(4);
  textAlign(LEFT, TOP);
  textSize(min(width, height) * 0.05);
  text(`Score: ${score}`, 20, 20);
  noStroke();

  // ★개선4: 거리 경고 오버레이
  if (warningAlpha > 0) {
    // 빨간 비네트
    noStroke();
    fill(255, 0, 0, warningAlpha * 0.3);
    rect(0, 0, width, height);

    // 경고 메시지
    fill(255, 255, 255, warningAlpha);
    stroke(200, 0, 0, warningAlpha);
    strokeWeight(3);
    textAlign(CENTER, CENTER);
    textSize(min(width, height) * 0.045);
    text("\u26a0 \ub108\ubb34 \uac00\uae4c\uc6cc\uc694! \ub4a4\ub85c \uc774\ub3d9\ud574\uc8fc\uc138\uc694", width / 2, height * 0.12);

    // 깜빡임 효과
    if (frameCount % 30 < 15) {
      noStroke();
      fill(255, 60, 60, warningAlpha * 0.15);
      rect(0, 0, width, 8);
      rect(0, height - 8, width, 8);
      rect(0, 0, 8, height);
      rect(width - 8, 0, 8, height);
    }
    noStroke();
  }
}

// ==========================================
// Player 클래스
// ==========================================
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
    this.faceScreenHeight = 0;

    // ★개선1: 얼굴 표시 크기를 고정하기 위한 스무딩된 크기
    this.lockedDisplaySize = 0;
  }

  update(keypoints) {
    // 바운딩 박스 계산
    let minX = AI_W, minY = AI_H;
    let maxX = 0, maxY = 0;
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

    // 화면 좌표
    let targetX = map(this.faceCenterX, 0, AI_W, width, 0);
    let targetY = map(this.faceCenterY, 0, AI_H, 0, height);
    this.x = lerp(this.x, targetX, 0.18);
    this.y = lerp(this.y, targetY, 0.18);

    this.faceScreenWidth = this.faceWidth * width / AI_W;
    this.faceScreenHeight = this.faceHeight * height / AI_H;

    // ★개선1: 표시 크기를 매우 느리게 추종 → 입 벌림에 의한 순간 변동 무시
    let targetDisplaySize = this.faceScreenWidth * 1.35;
    if (this.lockedDisplaySize <= 0) {
      this.lockedDisplaySize = targetDisplaySize;
    } else {
      this.lockedDisplaySize = lerp(this.lockedDisplaySize, targetDisplaySize, 0.03);
    }

    // 입 좌표 & 벌림 판정
    let upperLip = keypoints[13];
    let lowerLip = keypoints[14];
    let mouthRawX = (upperLip[0] + lowerLip[0]) / 2;
    let mouthRawY = (upperLip[1] + lowerLip[1]) / 2;

    let targetMX = map(mouthRawX, 0, AI_W, width, 0);
    let targetMY = map(mouthRawY, 0, AI_H, 0, height);
    this.mouthX = lerp(this.mouthX, targetMX, 0.18);
    this.mouthY = lerp(this.mouthY, targetMY, 0.18);

    let mouthDist = dist(upperLip[0], upperLip[1], lowerLip[0], lowerLip[1]);
    this.mouthOpen = mouthDist > 10;

    let mouthAmount = constrain(mouthDist, 5, 45);
    this.mouthRadius = map(mouthAmount, 5, 45, width * 0.03, width * 0.09);
  }

  show(mode) {
    if (mode === 'CALIBRATE') {
      if (segReady) this._drawFaceOnly();

      if (this.mouthOpen) {
        fill(0, 255, 255, 120);
        noStroke();
        let pulse = sin(frameCount * 0.15) * 4;
        ellipse(this.mouthX, this.mouthY, this.mouthRadius + pulse, this.mouthRadius + pulse);
        noFill();
        stroke(0, 255, 255, 200);
        strokeWeight(2);
        ellipse(this.mouthX, this.mouthY, this.mouthRadius + pulse, this.mouthRadius + pulse);
        noStroke();
      } else {
        noFill();
        stroke(0, 255, 255, 150);
        strokeWeight(3);
        ellipse(this.mouthX, this.mouthY, 30, 30);
        noStroke();
      }
    } else {
      if (segReady) this._drawFaceOnly();

      if (this.mouthOpen) {
        fill(0, 255, 255, 80);
        noStroke();
        let pulse = sin(frameCount * 0.15) * 4;
        ellipse(this.mouthX, this.mouthY, this.mouthRadius + pulse, this.mouthRadius + pulse);
      } else {
        fill(0, 255, 255, 100);
        noStroke();
        ellipse(this.mouthX, this.mouthY, 12, 12);
      }
    }
  }

  _drawFaceOnly() {
    if (!segReady || this.faceWidth <= 0) return;

    let scaleX = HD_W / AI_W;
    let scaleY = HD_H / AI_H;

    // ★개선2: 크롭 배율을 1.8 → 1.3으로 줄여서 목·쇄골 제거
    // 그리고 크롭 중심을 눈 높이 쪽으로 올림 (이마 포함, 턱 아래 최소화)
    let cropBase = max(this.faceWidth, this.faceHeight) * 1.3;

    let sx = this.faceCenterX * scaleX - cropBase * scaleX / 2;
    // 크롭 영역을 위쪽으로 올려서 이마 확보 + 턱 아래(목) 제거
    let sy = this.faceCenterY * scaleY - cropBase * scaleY * 0.6;
    let sw = cropBase * scaleX;
    let sh = cropBase * scaleY;

    // ★개선1: 고정된 표시 크기 사용 (입 벌림으로 인한 변동 방지)
    let drawSize = this.lockedDisplaySize;

    push();
    translate(width, 0);
    scale(-1, 1);

    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.arc(
      width - this.x,
      this.y,
      drawSize * 0.52,
      0,
      TWO_PI
    );
    drawingContext.clip();

    drawingContext.drawImage(
      segMaskCanvas,
      sx, sy, sw, sh,
      width - this.x - drawSize / 2,
      this.y - drawSize / 2,
      drawSize, drawSize
    );

    drawingContext.restore();
    pop();
  }
}

// ==========================================
// Pigeon
// ==========================================
class Pigeon {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.speed = random(3, 6);
    this.direction = random() > 0.5 ? 1 : -1;
  }

  update() {
    this.x += this.speed * this.direction;
    if (this.x > width + 50) this.x = -50;
    if (this.x < -50) this.x = width + 50;
    if (random() < 0.015) {
      items.push(new Item(this.x, this.y, random() > 0.7 ? 'EGG' : 'POOP'));
    }
  }

  show() {
    textSize(min(width, height) * 0.09);
    textAlign(CENTER, CENTER);
    text("\ud83d\udd4a\ufe0f", this.x, this.y);
  }
}

// ==========================================
// Item
// ==========================================
class Item {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.speed = random(5, 9);
    this.isDead = false;
  }

  update() {
    this.y += this.speed;
    if (this.y > height + 50) this.isDead = true;
  }

  show() {
    textSize(min(width, height) * 0.07);
    textAlign(CENTER, CENTER);
    text(this.type === 'EGG' ? "\ud83e\udd5a" : "\ud83d\udca9", this.x, this.y);
  }
}

// ==========================================
// 화면 렌더링
// ==========================================
function drawLoadingScreen() {
  background(30);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(32);
  text("AI \uce74\uba54\ub77c \uc2dc\uc2a4\ud15c \ub85c\ub529 \uc911...", width / 2, height / 2 - 20);
  textSize(18);
  fill(150);
  text("FaceMesh + \ub204\ub07c \ubaa8\ub378 \ub85c\ub529 \uc911... \uc7a0\uc2dc\ub9cc \uae30\ub2e4\ub824\uc8fc\uc138\uc694!", width / 2, height / 2 + 30);
  fill(100, 255, 100);
  textSize(16);
  text(`(${modelsLoaded}/2 \ubaa8\ub378 \ub85c\ub4dc \uc644\ub8cc)`, width / 2, height / 2 + 60);
}

function drawMainScreen() {
  background(200, 250, 200);
  fill(0);
  textAlign(CENTER, CENTER);
  textSize(40);
  text("\uc785\ubc8c\ub824! \ube44\ub458\uae30 \ub611 \ub4e4\uc5b4\uac04\ub2e4~", width / 2, height / 2 - 50);
  textSize(20);
  text("\ud654\uba74\uc744 \ud074\ub9ad\ud558\uc5ec \uc2dc\uc791\ud558\uc138\uc694", width / 2, height / 2 + 50);
}

function drawCalibrateScreen() {
  background(50);

  // 배경 웹캠 (반투명)
  push();
  tint(255, 60);
  translate(width, 0);
  scale(-1, 1);
  image(videoHD, 0, 0, width, height);
  pop();
  noTint();

  if (predictions.length > 0) {
    player.update(predictions[0].scaledMesh);
  }

  player.show('CALIBRATE');

  // ★개선3: 가이드 박스 - 하단 정중앙
  let targetFaceWidth = width / 8;
  let guideW = targetFaceWidth;
  let guideH = targetFaceWidth * 1.4;

  let sizeOk = player.faceScreenWidth > 0 &&
    abs(player.faceScreenWidth - targetFaceWidth) < targetFaceWidth * 0.25;
  let posOk = dist(player.x, player.y, guideX, guideY) < guideW * 0.6;
  let aligned = sizeOk && posOk && predictions.length > 0;

  if (aligned) {
    calibrationTimer += deltaTime;
  } else {
    calibrationTimer = 0;
  }

  let countdown = max(0, ceil((5000 - calibrationTimer) / 1000));

  if (calibrationTimer >= 5000) {
    // ★개선4: 게임 시작 시 기준 얼굴 크기 저장
    baseFaceScreenWidth = player.faceScreenWidth;
    showDistanceWarning = false;
    warningAlpha = 0;

    gameState = 'PLAYING';
    score = 0;
    splatters = [];
    items = [];
    calibrationTimer = 0;
    return;
  }

  // 가이드 박스
  rectMode(CENTER);
  noFill();
  strokeWeight(4);
  stroke(aligned ? color(0, 255, 100) : color(255, 255, 0, 180));
  rect(guideX, guideY, guideW, guideH, 20);

  strokeWeight(1);
  stroke(255, 255, 255, 40);
  line(guideX, guideY - guideH / 2, guideX, guideY + guideH / 2);
  line(guideX - guideW / 2, guideY, guideX + guideW / 2, guideY);

  noStroke();
  fill(255);
  textAlign(CENTER, CENTER);

  if (aligned) {
    textSize(56);
    fill(0, 255, 100);
    text(countdown, guideX, guideY - guideH / 2 - 50);

    textSize(20);
    fill(200, 255, 200);
    text("\uc88b\uc544\uc694! \uadf8\ub300\ub85c \uc720\uc9c0\ud558\uc138\uc694!", width / 2, height - 90);

    let progress = constrain(calibrationTimer / 5000, 0, 1);
    noStroke();
    fill(50, 50, 50, 150);
    rectMode(CENTER);
    rect(width / 2, height - 50, 300, 12, 6);
    fill(0, 255, 100);
    rectMode(CORNER);
    rect(width / 2 - 150, height - 56, 300 * progress, 12, 6);
  } else {
    textSize(26);
    fill(255);
    text("\uc5bc\uad74\uc744 \uac00\uc774\ub4dc \uc548\uc5d0 \ub9de\ucdb0\uc8fc\uc138\uc694", width / 2, height - 110);

    textSize(16);
    fill(180);
    if (predictions.length === 0) {
      text("\uc5bc\uad74\uc774 \uac10\uc9c0\ub418\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4", width / 2, height - 75);
    } else if (player.faceScreenWidth < targetFaceWidth * 0.75) {
      text("\uc880 \ub354 \uac00\uae4c\uc774 \uc640\uc8fc\uc138\uc694", width / 2, height - 75);
    } else if (player.faceScreenWidth > targetFaceWidth * 1.25) {
      text("\uc880 \ub354 \ub4a4\ub85c \uac00\uc8fc\uc138\uc694", width / 2, height - 75);
    } else if (!posOk) {
      text("\uc5bc\uad74\uc744 \ubc15\uc2a4 \uc911\uc559\uc73c\ub85c \uc774\ub3d9\ud574\uc8fc\uc138\uc694", width / 2, height - 75);
    }
  }
}

function drawStageClearScreen() {
  background(255);
  fill(0);
  textAlign(CENTER, CENTER);
  textSize(40);
  text("\uc2a4\ud14c\uc774\uc9c0 \ud074\ub9ac\uc5b4!", width / 2, height / 2);
}

function drawLeaderboard() {
  background(255);
  fill(0);
  textAlign(CENTER, CENTER);
  textSize(40);
  text("\uc21c\uc704\ud45c", width / 2, height / 2);
}

function mousePressed() {
  if (gameState === 'MAIN') {
    gameState = 'CALIBRATE';
    calibrationTimer = 0;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // ★개선3: 항상 하단 정중앙
  guideX = width / 2;
  guideY = height * 0.75;
}
