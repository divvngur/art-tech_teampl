let gameState = 'LOADING'; // 처음 시작을 로딩 상태로 설정하여 렉 방지
let video;
let facemesh;
let predictions = [];

let player;
let pigeons = [];
let items = [];
let splatters = []; // 화면에 묻은 똥 자국들을 저장할 배열
let score = 0;

// 웹캠 원본 해상도
const WEBCAM_SOURCE_WIDTH = 640;
const WEBCAM_SOURCE_HEIGHT = 480;

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  // 1. 웹캠 세팅
  video = createCapture(VIDEO);
  video.size(WEBCAM_SOURCE_WIDTH, WEBCAM_SOURCE_HEIGHT); 
  video.hide(); 

  // 2. ml5 FaceMesh 초기화
  facemesh = ml5.facemesh(video, modelReady);
  facemesh.on('predict', results => {
    predictions = results;
  });

  // 3. 객체 초기화
  player = new Player();
  
  // 비둘기 3마리 생성
  for (let i = 0; i < 3; i++) {
    pigeons.push(new Pigeon(random(width), random(50, 150)));
  }
}

function modelReady() {
  console.log('FaceMesh Model Ready!');
  gameState = 'MAIN'; // 모델 로딩이 완벽히 끝나면 메인 화면으로 이동
}

function draw() {
  background(240);
  
  switch(gameState) {
    case 'LOADING':
      drawLoadingScreen();
      break;
    case 'MAIN':
      drawMainScreen();
      break;
    case 'LOGIN':
      drawLoginScreen();
      break;
    case 'CALIBRATE':
      drawCalibrateScreen();
      break;
    case 'PLAYING':
      playGame();
      break;
    case 'STAGE_CLEAR':
      drawStageClearScreen();
      break;
    case 'LEADERBOARD':
      drawLeaderboard();
      break;
  }
}

// ==========================================
// 핵심 게임 플레이 로직
// ==========================================
function playGame() {
  // ★수정됨: 배경색을 조금 더 선명한 파란색으로 변경 (연한 느낌 해소)
  background(100, 180, 240); 

  // 색상 꼬임 방지
  noTint(); 

  // FaceMesh 데이터 업데이트
  if (predictions.length > 0) {
    let keypoints = predictions[0].scaledMesh;
    player.update(keypoints);
  }
  
  // 캠 이미지를 다른 객체보다 먼저 그리기 (뒤로 가려지는 문제 해결)
  player.show('PLAYING'); 

  // 비둘기 이동 및 그리기
  for (let pigeon of pigeons) {
    pigeon.update();
    pigeon.show(); 
  }

  // 아이템 낙하 및 충돌 판정
  for (let i = items.length - 1; i >= 0; i--) {
    let item = items[i];
    item.update();
    item.show(); 

    // 알(EGG) 충돌 판정: 입 위치
    let dMouth = dist(item.x, item.y, player.mouthX, player.mouthY); 
    
    // ★수정됨: 원 크기를 줄였으므로 똥(POOP) 충돌 반경도 180에서 130으로 축소
    let dFace = dist(item.x, item.y, player.x, player.y);
    let hitHead = dFace < 130; 

    if (!item.isDead) {
      if (item.type === 'EGG') {
        if (dMouth < 50 && player.mouthOpen) {
          score += 10;
          item.isDead = true;   
        }
      } else if (item.type === 'POOP') {
        // 얼굴(머리) 영역에 똥이 닿았을 때만 피격
        if (hitHead) {
          score -= 5;
          item.isDead = true;
          splatters.push({ x: item.x, y: item.y, size: random(100, 250) });
        }
      }
    }

    if (item.isDead) {
      items.splice(i, 1);
    }
  }

  // 화면을 가리는 똥 자국들 그리기
  for (let s of splatters) {
    fill(101, 67, 33, 220); 
    noStroke();
    ellipse(s.x, s.y, s.size, s.size * 0.8);
    ellipse(s.x + 20, s.y - 10, s.size * 0.6, s.size * 0.6);
  }
  
  // 점수 UI 그리기
  fill(255); 
  stroke(0);
  strokeWeight(4);
  textAlign(LEFT, TOP);
  textSize(40);
  text(`Score: ${score}`, 20, 20);
  noStroke(); 
}


// ==========================================
// 클래스 정의 (Player, Pigeon, Item)
// ==========================================
class Player {
  constructor() {
    this.x = width / 2;
    this.y = height / 2;
    this.mouthX = width / 2;
    this.mouthY = height / 2 + 20;
    this.mouthOpen = false;
    
    // 얼굴 크롭용 변수
    this.faceSrcX = 0;
    this.faceSrcY = 0;
    this.faceSize = 0; // 이제 가로/세로 동일한 크기의 정사각형으로 자릅니다.

    // ★수정됨 (성능 최적화): 매 프레임 크기를 바꾸지 않고 고정된 크기(250x250)의 캔버스 버퍼 생성
    this.maskBuffer = createGraphics(250, 250); 
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
      let px = keypoints[i][0];
      let py = keypoints[i][1];
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    
    // ★수정됨: 찌그러진 타원형 방지! 가로/세로 중 더 긴 쪽을 기준으로 정사각형(Square) 바운딩 박스 생성
    let faceWidth = maxX - minX;
    let faceHeight = maxY - minY;
    let maxSide = max(faceWidth, faceHeight); 
    
    let padding = 40;
    this.faceSize = maxSide + padding * 2;
    
    let centerX = (minX + maxX) / 2;
    let centerY = (minY + maxY) / 2;
    
    this.faceSrcX = centerX - this.faceSize / 2;
    this.faceSrcY = centerY - this.faceSize / 2 - 15; // 이마를 위해 영역을 살짝 위로 올림
  }

  show(mode) {
    if (mode === 'CALIBRATE') {
      noFill(); 
      stroke(255, 255, 0, 180); 
      strokeWeight(4);
      ellipse(this.x, this.y, 260, 260); // 캘리브레이션 원 크기도 약간 축소
      
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
      if (this.faceSize > 0) {
        // 1. 고정된 마스크 버퍼 초기화
        this.maskBuffer.clear();
        this.maskBuffer.noStroke();
        this.maskBuffer.fill(255); 

        // 2. 마스크 영역 그리기 (크기를 90%로 줄여서 여백이 없는 깔끔한 정원 생성)
        let circleSize = this.maskBuffer.width * 0.9;
        this.maskBuffer.ellipse(this.maskBuffer.width / 2, this.maskBuffer.height / 2, circleSize, circleSize);

        // 3. 비디오 이미지를 원 안쪽에만 덮어씌우기
        this.maskBuffer.drawingContext.globalCompositeOperation = 'source-in';
        this.maskBuffer.image(video, 0, 0, this.maskBuffer.width, this.maskBuffer.height, this.faceSrcX, this.faceSrcY, this.faceSize, this.faceSize);
        this.maskBuffer.drawingContext.globalCompositeOperation = 'source-over';

        // 4. 화면에 렌더링
        push();
        translate(this.x, this.y); 
        scale(-1, 1); // 좌우 반전 (거울 모드)
        imageMode(CENTER);
        
        // ★수정됨: 화면 크기에 맞춰 동적으로 커지던 얼굴 스케일을 조금 줄임
        let displayScale = (height / WEBCAM_SOURCE_HEIGHT) * 0.85; 
        let finalDisplaySize = this.faceSize * displayScale;
        
        image(this.maskBuffer, 0, 0, finalDisplaySize, finalDisplaySize); 
        pop();
      }

      // 게임 중 입 위치 마커 (원치 않으면 주석 처리)
      fill(0, 255, 255, 150); 
      noStroke();
      ellipse(this.mouthX, this.mouthY, 10, 10);
    }
  }
}

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
    if (this.y > height + 50) {
      this.isDead = true;
    }
  }

  show() {
    textSize(50); 
    textAlign(CENTER, CENTER);
    if (this.type === 'EGG') {
      text("🥚", this.x, this.y);
    } else {
      text("💩", this.x, this.y);
    }
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
  text("잠시만 기다려주세요! (웹캠 권한 허용 필요)", width / 2, height / 2 + 30);
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
  background(255);
  
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();
  
  if (predictions.length > 0) {
    let keypoints = predictions[0].scaledMesh;
    player.update(keypoints);
  }
  
  player.show('CALIBRATE'); 

  fill(0);
  stroke(255);
  strokeWeight(4);
  textAlign(CENTER, CENTER);
  textSize(32);
  text("노란 원 안에 얼굴이 쏙 들어가게 위치를 맞추세요!", width / 2, height / 2 - 50);
  
  textSize(24);
  text("준비되었으면 화면을 클릭하여 게임을 시작합니다.", width / 2, height / 2 + 50);
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