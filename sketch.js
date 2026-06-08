let socket;
let myRole = 'WAITING'; 

const GAME_W = 1280;
const GAME_H = 720;
const CAM_W = 320; 
const CAM_H = 240;

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
let gameResult = '';

let opponentFaceImg = new Image();

let tempCanvas;
let tCtx;
let faceSendSize = 100;

// 알 먹은 횟수와 똥 맞은 횟수로 상태 관리
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
  createCanvas(GAME_W, GAME_H);
  frameRate(30);

  guideX = width / 2;
  guideY = height * 0.75;

  player = new Player();

  tempCanvas = document.createElement('canvas');
  tempCanvas.width = faceSendSize; 
  tempCanvas.height = faceSendSize;
  tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

  socket = io();

  socket.on('roleStatus', (status) => {
    rolesStatus = status;
  });

  socket.on('roleAssigned', (role) => {
    myRole = role;
    console.log("나의 역할은:", myRole);
    gameState = 'WAITING_OPPONENT';
  });

  socket.on('gameReady', () => {
    resetGameState();
    if (gameState === 'WAITING_OPPONENT') {
      gameState = 'MAIN';
    }
  });

  socket.on('opponentLeft', () => {
    if (gameState === 'PLAYING' || gameState === 'MAIN' || gameState === 'CALIBRATE') {
      gameState = 'WAITING_OPPONENT';
      resetGameState();
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
    console.log('FaceMesh Ready!');
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

function videoReady() { sendFrameToSegmentation(); }
async function sendFrameToSegmentation() {
  if (video.elt.readyState >= 2) await selfieSegmentation.send({ image: video.elt });
  setTimeout(sendFrameToSegmentation, 33);
}
function onSegResults(results) {
  if (!segReady) { segReady = true; modelsLoaded++; checkAllModelsReady(); }
  let ctx = segMaskCanvas.getContext('2d', { willReadFrequently: true });
  ctx.save(); ctx.clearRect(0, 0, CAM_W, CAM_H);
  ctx.drawImage(results.segmentationMask, 0, 0, CAM_W, CAM_H);
  ctx.globalCompositeOperation = 'source-in'; ctx.drawImage(results.image, 0, 0, CAM_W, CAM_H);
  ctx.restore();
}

function checkAllModelsReady() { 
  if (modelsLoaded >= 2) gameState = 'ROLE_SELECTION'; 
}

function draw() {
  background(240);
  switch (gameState) {
    case 'LOADING': drawLoadingScreen(); break;
    case 'ROLE_SELECTION': drawRoleSelectionScreen(); break;
    case 'WAITING_OPPONENT': drawWaitingScreen(); break;
    case 'MAIN': drawMainScreen(); break;
    case 'CALIBRATE': drawCalibrateScreen(); break;
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
        dropItem(); poopCooldown = 15;
      }
      
      // === 승패 조건 체크 (비둘기가 관리) ===
      if (globalState.eggsEaten >= 5) {
        socket.emit('gameOverTrigger', 'TARGET_WIN');
      } else if (globalState.poopHits >= 5) {
        socket.emit('gameOverTrigger', 'PIGEON_WIN');
      }

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
  tCtx.save(); tCtx.translate(faceSendSize, 0); tCtx.scale(-1, 1);
  tCtx.beginPath(); tCtx.arc(faceSendSize/2, faceSendSize/2, faceSendSize/2, 0, Math.PI * 2); tCtx.clip();
  tCtx.drawImage(segMaskCanvas, sx, sy, cropBase, cropBase, 0, 0, faceSendSize, faceSendSize);
  tCtx.restore();
  let base64 = tempCanvas.toDataURL('image/webp', 0.3);
  socket.emit('faceImageSync', base64);
}

function dropItem() {
  let type = random() > 0.8 ? 'EGG' : 'POOP';
  globalState.items.push({ x: globalState.pigeonX, y: 120, type: type });
}

function mousePressed() {
  if (gameState === 'ROLE_SELECTION') {
    let midX = width / 2;
    let midY = height / 2;
    if (!rolesStatus.pigeonTaken && mouseX > midX - 280 && mouseX < midX - 120 && mouseY > midY - 80 && mouseY < midY + 80) {
      socket.emit('selectRole', 'PIGEON');
    }
    if (!rolesStatus.targetTaken && mouseX > midX + 120 && mouseX < midX + 280 && mouseY > midY - 80 && mouseY < midY + 80) {
      socket.emit('selectRole', 'TARGET');
    }
  }
  else if (gameState === 'MAIN') { gameState = 'CALIBRATE'; calibrationTimer = 0; } 
  else if (gameState === 'PLAYING' && myRole === 'PIGEON' && poopCooldown === 0) { dropItem(); poopCooldown = 15; }
}

function updatePhysics() {
  for (let i = globalState.items.length - 1; i >= 0; i--) {
    let item = globalState.items[i];
    item.y += 15; 
    let dMouth = dist(item.x, item.y, targetData.mouthX, targetData.mouthY);
    let dFace = dist(item.x, item.y, targetData.x, targetData.y);
    let headHitRadius = targetData.faceWidth * 0.45; 
    let mouthHitRadius = targetData.mouthRadius * 1.5;

    if (item.type === 'EGG') {
      if (dMouth < mouthHitRadius && targetData.mouthOpen) {
        globalState.eggsEaten += 1; // 알 먹음
        globalState.items.splice(i, 1); continue;
      }
    } else if (item.type === 'POOP') {
      if (dFace < headHitRadius) {
        globalState.poopHits += 1; // 똥 맞음
        globalState.splatters.push({ x: item.x, y: item.y, size: random(100, 250) }); 
        globalState.items.splice(i, 1); continue;
      }
    }
    if (item.y > GAME_H + 50) globalState.items.splice(i, 1);
  }
}

class Player {
  constructor() {
    this.x = width / 2; this.y = height / 2;
    this.mouthX = width / 2; this.mouthY = height / 2 + 20;
    this.mouthOpen = false; this.mouthRadius = width * 0.03;
    this.faceWidth = 0; this.faceHeight = 0;
    this.faceCenterX = 0; this.faceCenterY = 0;
    this.faceScreenWidth = 0; this.lockedDisplaySize = 0;
  }
  update(keypoints) {
    let minX = CAM_W, minY = CAM_H, maxX = 0, maxY = 0;
    for (let i = 0; i < keypoints.length; i++) {
      let px = keypoints[i][0], py = keypoints[i][1];
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (py < minY) minY = py; if (py > maxY) maxY = py;
    }
    this.faceWidth = maxX - minX; this.faceHeight = maxY - minY;
    this.faceCenterX = (minX + maxX) * 0.5; this.faceCenterY = (minY + maxY) * 0.5;

    let targetX = map(this.faceCenterX, 0, CAM_W, width, 0);
    let targetY = map(this.faceCenterY, 0, CAM_H, 0, height);
    this.x = lerp(this.x, targetX, 0.18); this.y = lerp(this.y, targetY, 0.18);

    this.faceScreenWidth = this.faceWidth * width / CAM_W;
    let targetDisplaySize = this.faceScreenWidth * 1.35;
    if (this.lockedDisplaySize <= 0) this.lockedDisplaySize = targetDisplaySize;
    else this.lockedDisplaySize = lerp(this.lockedDisplaySize, targetDisplaySize, 0.03);

    let upperLip = keypoints[13], lowerLip = keypoints[14];
    let mouthRawX = (upperLip[0] + lowerLip[0]) / 2, mouthRawY = (upperLip[1] + lowerLip[1]) / 2;
    let targetMX = map(mouthRawX, 0, CAM_W, width, 0), targetMY = map(mouthRawY, 0, CAM_H, 0, height);
    this.mouthX = lerp(this.mouthX, targetMX, 0.18); this.mouthY = lerp(this.mouthY, targetMY, 0.18);

    let mouthDist = dist(upperLip[0], upperLip[1], lowerLip[0], lowerLip[1]);
    this.mouthOpen = mouthDist > 6;
    let mouthAmount = constrain(mouthDist, 3, 20);
    this.mouthRadius = map(mouthAmount, 3, 20, width * 0.03, width * 0.09);
  }
  show(mode) {
    if (segReady) this._drawFaceOnly();
    if (this.mouthOpen) {
      fill(0, 255, 255, mode === 'CALIBRATE' ? 120 : 80); noStroke();
      let pulse = sin(frameCount * 0.15) * 4;
      ellipse(this.mouthX, this.mouthY, this.mouthRadius + pulse, this.mouthRadius + pulse);
      if (mode === 'CALIBRATE') { noFill(); stroke(0, 255, 255, 200); strokeWeight(2); ellipse(this.mouthX, this.mouthY, this.mouthRadius + pulse, this.mouthRadius + pulse); noStroke(); }
    } else {
      mode === 'CALIBRATE' ? (noFill(), stroke(0, 255, 255, 150), strokeWeight(3), ellipse(this.mouthX, this.mouthY, 30, 30), noStroke()) : (fill(0, 255, 255, 100), noStroke(), ellipse(this.mouthX, this.mouthY, 12, 12));
    }
  }
  _drawFaceOnly() {
    if (!segReady || this.faceWidth <= 0) return;
    let cropBase = max(this.faceWidth, this.faceHeight) * 1.3;
    let sx = this.faceCenterX - cropBase / 2, sy = this.faceCenterY - cropBase * 0.6;
    let drawSize = this.lockedDisplaySize;
    push(); translate(width, 0); scale(-1, 1); drawingContext.save(); drawingContext.beginPath();
    drawingContext.arc(width - this.x, this.y, drawSize * 0.52, 0, TWO_PI); drawingContext.clip();
    drawingContext.drawImage(segMaskCanvas, sx, sy, cropBase, cropBase, width - this.x - drawSize / 2, this.y - drawSize / 2, drawSize, drawSize);
    drawingContext.restore(); pop();
  }
}

function drawPigeonAvatar(x) { 
  if (opponentFaceImg.src && myRole === 'TARGET') {
    drawingContext.drawImage(opponentFaceImg, x - 60, 100 - 60, 120, 120);
  } else if (myRole === 'PIGEON') {
    player.x = x; player.y = 100;
    player.lockedDisplaySize = 120;
    player._drawFaceOnly();
  } else {
    push(); // 비둘기 이모지 투명도 리셋
    fill(255); 
    textSize(100); 
    textAlign(CENTER, CENTER); 
    text("🕊️", x, 100); 
    pop();
  }
}

function drawTargetAvatar() {
  let drawSize = targetData.faceWidth * 0.9; 
  if (opponentFaceImg.src) {
    drawingContext.drawImage(opponentFaceImg, targetData.x - drawSize/2, targetData.y - drawSize/2, drawSize, drawSize);
  } else {
    fill(255, 200, 200, 120);
    let headHitDiameter = targetData.faceWidth * 0.45 * 2;
    ellipse(targetData.x, targetData.y, headHitDiameter, headHitDiameter);
  }

  if (targetData.mouthOpen) {
    fill(0, 255, 255, 80); stroke(0, 255, 0, 150); strokeWeight(2);
    let pulse = sin(frameCount * 0.2) * 4;
    let mouthHitDiameter = targetData.mouthRadius * 1.5 * 2; 
    ellipse(targetData.mouthX, targetData.mouthY, mouthHitDiameter + pulse, mouthHitDiameter + pulse);
    noStroke();
  } else {
    fill(0, 255, 255, 100); noStroke();
    ellipse(targetData.mouthX, targetData.mouthY, 15, 15);
  }
}

function drawItems() {
  push(); // 아이템 이모지 투명도 리셋
  fill(255);
  textSize(60); 
  textAlign(CENTER, CENTER); 
  for (let item of globalState.items) { 
    text(item.type === 'EGG' ? "🥚" : "💩", item.x, item.y); 
  }
  pop();
}

function drawSplatters() {
  for (let s of globalState.splatters) { fill(101, 67, 33, 220); noStroke(); ellipse(s.x, s.y, s.size, s.size * 0.8); ellipse(s.x + 20, s.y - 10, s.size * 0.6, s.size * 0.6); }
}

function drawUI() {
  fill(255); stroke(0); strokeWeight(4); textAlign(LEFT, TOP); textSize(30);
  text(`나의 역할: ${myRole === 'PIGEON' ? '비둘기 🕊️' : '사람 😲'}`, 20, 20); 

  // 최대 5개, 맞거나 먹으면 하나씩 줄어들도록 설정
  let remainingHearts = max(0, 5 - globalState.poopHits);
  let remainingEggs = max(0, 5 - globalState.eggsEaten);

  text(`목숨: ${"❤️".repeat(remainingHearts)}`, 20, 60);
  text(`목표: ${"🥚".repeat(remainingEggs)}`, 20, 100);
  
  noStroke();
}

function drawLoadingScreen() { background(30); fill(255); textAlign(CENTER, CENTER); textSize(32); text("AI 로딩 중... 잠시만 기다려주세요", width / 2, height / 2 - 20); fill(100, 255, 100); textSize(16); text(`(${modelsLoaded}/2 모델 로드 완료)`, width / 2, height / 2 + 30); }

function drawRoleSelectionScreen() {
  background(200, 220, 255);
  fill(0); textAlign(CENTER, CENTER); textSize(40);
  text("플레이할 역할을 선택하세요", width/2, height/3);

  rectMode(CENTER);
  let midX = width / 2; let midY = height / 2;

  fill(rolesStatus.pigeonTaken ? 150 : 255);
  rect(midX - 200, midY, 160, 160, 20);
  fill(0); textSize(24); text("비둘기 🕊️", midX - 200, midY);
  if(rolesStatus.pigeonTaken) { textSize(16); fill(255,0,0); text("선택 불가", midX - 200, midY + 40); }

  fill(rolesStatus.targetTaken ? 150 : 255);
  rect(midX + 200, midY, 160, 160, 20);
  fill(0); textSize(24); text("사람 😲", midX + 200, midY);
  if(rolesStatus.targetTaken) { textSize(16); fill(255,0,0); text("선택 불가", midX + 200, midY + 40); }
  
  rectMode(CORNER);
}

function drawWaitingScreen() {
  background(40); fill(255); textAlign(CENTER, CENTER); textSize(35);
  text("상대방의 입장을 대기 중입니다...", width / 2, height / 2 - 20);
  textSize(22); fill(150, 255, 150);
  text(`내가 선택한 역할: ${myRole === 'PIGEON' ? '비둘기 🕊️' : '사람 😲'}`, width / 2, height / 2 + 50);
}

function drawMainScreen() { background(200, 250, 200); fill(0); textAlign(CENTER, CENTER); textSize(50); text("입벌려! 비둘기 똥 들어간다~", width / 2, height / 2 - 50); textSize(25); text("상대방과 매칭되었습니다! 화면을 클릭하여 시작하세요", width / 2, height / 2 + 50); }

function drawGameOverScreen() {
  background(40, 20, 40);
  fill(255); textAlign(CENTER, CENTER); 

  // 역할과 승리 조건이 일치하는지 확인 (자신이 이겼는지 여부)
  let isWinner = (gameResult === 'TARGET_WIN' && myRole === 'TARGET') || 
                 (gameResult === 'PIGEON_WIN' && myRole === 'PIGEON');

  textSize(120);
  if (isWinner) {
    fill(100, 255, 100);
    text("WIN", width/2, height/3 - 40);
  } else {
    fill(255, 100, 100);
    text("LOSE", width/2, height/3 - 40);
  }

  textSize(40);
  fill(255);
  if (gameResult === 'TARGET_WIN') {
    text("사람이 알 5개를 모두 먹었습니다! 😲", width/2, height/2 + 50);
  } else {
    text("사람이 비둘기 똥을 5번 맞았습니다! 🕊️", width/2, height/2 + 50);
  }
  
  textSize(25); fill(150, 200, 255);
  text("다시 플레이하려면 새로고침(F5)을 눌러주세요", width/2, height/2 + 130);
}

function drawCalibrateScreen() {
  background(50); push(); tint(255, 60); translate(width, 0); scale(-1, 1); image(video, 0, 0, width, height); pop();
  if (predictions.length > 0) player.update(predictions[0].scaledMesh);
  player.show('CALIBRATE');
  let targetFaceWidth = width / 8, guideW = targetFaceWidth, guideH = targetFaceWidth * 1.4;
  let sizeOk = player.faceScreenWidth > 0 && abs(player.faceScreenWidth - targetFaceWidth) < targetFaceWidth * 0.25;
  let posOk = dist(player.x, player.y, guideX, guideY) < guideW * 0.6;
  let aligned = sizeOk && posOk && predictions.length > 0;
  aligned ? calibrationTimer += deltaTime : calibrationTimer = 0;
  
  if (calibrationTimer >= 5000) { gameState = 'PLAYING'; calibrationTimer = 0; return; }
  
  rectMode(CENTER); noFill(); strokeWeight(4); stroke(aligned ? color(0, 255, 100) : color(255, 255, 0, 180)); rect(guideX, guideY, guideW, guideH, 20);
  noStroke(); fill(255); textAlign(CENTER, CENTER);
  if (aligned) { textSize(56); fill(0, 255, 100); text(max(0, ceil((5000 - calibrationTimer) / 1000)), guideX, guideY - guideH / 2 - 50); } else { textSize(26); text("얼굴을 가이드 안에 맞춰주세요", width / 2, height - 110); }
  rectMode(CORNER);
}