/*
let gameState = 'LOADING';
let video;
let facemesh;
let predictions = [];

// MediaPipe Selfie Segmentation (직접 사용)
let selfieSegmentation;
let segMaskCanvas; // 세그멘테이션 결과를 그릴 오프스크린 캔버스
let segReady = false;

let player;
let pigeons = [];
let items = [];
let splatters = [];
let score = 0;

const WEBCAM_SOURCE_WIDTH = 640;
const WEBCAM_SOURCE_HEIGHT = 480;

let modelsLoaded = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);

  video = createCapture(VIDEO, videoReady);
  video.size(WEBCAM_SOURCE_WIDTH, WEBCAM_SOURCE_HEIGHT);
  video.hide();

  // FaceMesh 초기화
  facemesh = ml5.facemesh(video, () => {
    console.log('FaceMesh Ready!');
    modelsLoaded++;
    checkAllModelsReady();
  });
  facemesh.on('predict', results => {
    predictions = results;
  });

  // 누끼용 오프스크린 캔버스 (세그멘테이션 마스크 합성용)
  segMaskCanvas = document.createElement('canvas');
  segMaskCanvas.width = WEBCAM_SOURCE_WIDTH;
  segMaskCanvas.height = WEBCAM_SOURCE_HEIGHT;

  // MediaPipe Selfie Segmentation 초기화
  selfieSegmentation = new SelfieSegmentation({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
    }
  });
  selfieSegmentation.setOptions({
    modelSelection: 1, // 0: General, 1: Landscape (더 빠름)
    selfieMode: false,
  });
  selfieSegmentation.onResults(onSegResults);

  // 객체 초기화
  player = new Player();
  for (let i = 0; i < 3; i++) {
    pigeons.push(new Pigeon(random(width), random(50, 150)));
  }
}

function videoReady() {
  console.log('Video Ready!');
  // 비디오 준비되면 세그멘테이션 루프 시작
  sendFrameToSegmentation();
}

// 세그멘테이션에 프레임 전송 (비동기 루프)
async function sendFrameToSegmentation() {
  if (video.elt.readyState >= 2) {
    await selfieSegmentation.send({ image: video.elt });
  }
  requestAnimationFrame(sendFrameToSegmentation);
}

// 세그멘테이션 결과 콜백
function onSegResults(results) {
  if (!segReady) {
    segReady = true;
    console.log('Selfie Segmentation Ready!');
    modelsLoaded++;
    checkAllModelsReady();
  }

  // 오프스크린 캔버스에 누끼 합성
  let ctx = segMaskCanvas.getContext('2d');
  ctx.save();
  ctx.clearRect(0, 0, WEBCAM_SOURCE_WIDTH, WEBCAM_SOURCE_HEIGHT);

  // 1. 세그멘테이션 마스크를 먼저 그림 (사람=흰색 영역)
  ctx.drawImage(results.segmentationMask, 0, 0, WEBCAM_SOURCE_WIDTH, WEBCAM_SOURCE_HEIGHT);

  // 2. source-in: 마스크 영역 안쪽에만 원본 비디오를 덮어씌움
  ctx.globalCompositeOperation = 'source-in';
  ctx.drawImage(results.image, 0, 0, WEBCAM_SOURCE_WIDTH, WEBCAM_SOURCE_HEIGHT);

  ctx.restore();
}

function checkAllModelsReady() {
  if (modelsLoaded >= 2) {
    gameState = 'MAIN';
  }
}

function draw() {
  background(240);
  switch (gameState) {
    case 'LOADING':  drawLoadingScreen(); break;
    case 'MAIN':     drawMainScreen(); break;
    case 'LOGIN':    drawLoginScreen(); break;
    case 'CALIBRATE': drawCalibrateScreen(); break;
    case 'PLAYING':  playGame(); break;
    case 'STAGE_CLEAR': drawStageClearScreen(); break;
    case 'LEADERBOARD': drawLeaderboard(); break;
  }
}

// ==========================================
// 핵심 게임 플레이 로직
// ==========================================
function playGame() {
  background(100, 180, 240);
  noTint();

  if (predictions.length > 0) {
    let keypoints = predictions[0].scaledMesh;
    player.update(keypoints);
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
    let hitHead = dFace < 130;

    if (!item.isDead) {
      if (item.type === 'EGG') {
        if (dMouth < 50 && player.mouthOpen) {
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

  fill(255);
  stroke(0);
  strokeWeight(4);
  textAlign(LEFT, TOP);
  textSize(40);
  text(`Score: ${score}`, 20, 20);
  noStroke();
}


// ==========================================
// Player 클래스 - 누끼 합성 방식
// ==========================================
class Player {
  constructor() {
    this.x = width / 2;
    this.y = height / 2;
    this.mouthX = width / 2;
    this.mouthY = height / 2 + 20;
    this.mouthOpen = false;
    this.faceSrcX = 0;
    this.faceSrcY = 0;
    this.faceSize = 0;
  }

  update(keypoints) {
    this.x = map(keypoints[1][0], 0, WEBCAM_SOURCE_WIDTH, width, 0);
    this.y = map(keypoints[1][1], 0, WEBCAM_SOURCE_HEIGHT, 0, height);

    let upperLip = keypoints[13];
    let lowerLip = keypoints[14];
    let mouthRawX = (upperLip[0] + lowerLip[0]) / 2;
    let mouthRawY = (upperLip[1] + lowerLip[1]) / 2;
    this.mouthX = map(mouthRawX, 0, WEBCAM_SOURCE_WIDTH, width, 0);
    this.mouthY = map(mouthRawY, 0, WEBCAM_SOURCE_HEIGHT, 0, height);

    let mouthDist = dist(upperLip[0], upperLip[1], lowerLip[0], lowerLip[1]);
    this.mouthOpen = mouthDist > 10;

    let minX = WEBCAM_SOURCE_WIDTH, minY = WEBCAM_SOURCE_HEIGHT;
    let maxX = 0, maxY = 0;
    for (let i = 0; i < keypoints.length; i++) {
      let px = keypoints[i][0], py = keypoints[i][1];
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    let maxSide = max(maxX - minX, maxY - minY);
    this.faceSize = maxSide + 80;
    this.faceSrcX = (minX + maxX) / 2 - this.faceSize / 2;
    this.faceSrcY = (minY + maxY) / 2 - this.faceSize / 2 - 15;
  }

  show(mode) {
    if (mode === 'CALIBRATE') {
      // 캘리브레이션: 누끼 미리보기
      if (segReady) {
        this._drawSegmented();
      }

      if (this.mouthOpen) {
        fill(0, 255, 255);
        noStroke();
        ellipse(this.mouthX, this.mouthY, 60, 60);
      } else {
        noFill(); stroke(0, 255, 255, 150); strokeWeight(3);
        ellipse(this.mouthX, this.mouthY, 30, 30);
        noStroke();
      }
    } else {
      // 게임 플레이: 누끼 합성
      if (segReady) {
        this._drawSegmented();
      }

      fill(0, 255, 255, 150);
      noStroke();
      ellipse(this.mouthX, this.mouthY, 10, 10);
    }
  }

  // ★핵심: segMaskCanvas (이미 배경 제거된 이미지)를 화면에 그리기
  _drawSegmented() {
    push();
    translate(width, 0);
    scale(-1, 1); // 거울 모드
    drawingContext.drawImage(segMaskCanvas, 0, 0, width, height);
    pop();
  }
}


// ==========================================
// Pigeon, Item 클래스 (변경 없음)
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
      let type = random() > 0.7 ? 'EGG' : 'POOP';
      items.push(new Item(this.x, this.y, type));
    }
  }
  show() {
    textSize(60);
    textAlign(CENTER, CENTER);
    text("🕊️", this.x, this.y);
  }
}

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
    textSize(50);
    textAlign(CENTER, CENTER);
    text(this.type === 'EGG' ? "🥚" : "💩", this.x, this.y);
  }
}


// ==========================================
// 화면 렌더링 및 이벤트 함수들
// ==========================================
function drawLoadingScreen() {
  background(30);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(32);
  text("AI 카메라 시스템 로딩 중...", width / 2, height / 2 - 20);
  textSize(18);
  fill(150);
  text("FaceMesh + 누끼 모델 로딩 중... 잠시만 기다려주세요!", width / 2, height / 2 + 30);
  fill(100, 255, 100);
  textSize(16);
  text(`(${modelsLoaded}/2 모델 로드 완료)`, width / 2, height / 2 + 60);
}

function drawMainScreen() {
  background(200, 250, 200);
  fill(0);
  textAlign(CENTER, CENTER);
  textSize(40);
  text("입벌려! 비둘기 똥 들어간다~", width / 2, height / 2 - 50);
  textSize(20);
  text("스테이지 모드를 시작하려면 화면을 클릭하세요", width / 2, height / 2 + 50);
}

function drawLoginScreen() {
  background(255);
  text("로그인 화면", width / 2, height / 2);
}

function drawCalibrateScreen() {
  background(50);

  // 배경에 원본 웹캠 (반투명)
  push();
  tint(255, 80);
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();
  noTint();

  if (predictions.length > 0) {
    let keypoints = predictions[0].scaledMesh;
    player.update(keypoints);
  }

  player.show('CALIBRATE');

  fill(255);
  stroke(0);
  strokeWeight(4);
  textAlign(CENTER, CENTER);
  textSize(32);
  text("누끼가 잘 잡히는지 확인하세요!", width / 2, height - 120);
  textSize(24);
  text("준비되었으면 화면을 클릭하여 게임을 시작합니다.", width / 2, height - 70);
  noStroke();
}

function drawStageClearScreen() {
  background(255);
  text("스테이지 클리어!", width / 2, height / 2);
}

function drawLeaderboard() {
  background(255);
  text("순위표", width / 2, height / 2);
}

function mousePressed() {
  if (gameState === 'MAIN') {
    gameState = 'CALIBRATE';
  } else if (gameState === 'CALIBRATE') {
    gameState = 'PLAYING';
    score = 0;
    splatters = [];
    items = [];
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
*/