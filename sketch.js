let gameState = 'MAIN';
let video;
let facemesh;
let predictions = [];

let player;
let pigeons = [];
let items = [];
let splatters = []; // 화면에 묻은 똥 자국들을 저장할 배열
let score = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  // 1. 웹캠 세팅
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide(); // 비디오 요소는 숨기고 캔버스에 직접 그릴 예정

  // 2. ml5 FaceMesh 초기화
  facemesh = ml5.facemesh(video, modelReady);
  facemesh.on('predict', results => {
    predictions = results;
  });

  // 3. 객체 초기화
  player = new Player();
  
  // 비둘기 3마리 생성 (화면 위쪽에 무작위 배치)
  for (let i = 0; i < 3; i++) {
    pigeons.push(new Pigeon(random(width), random(50, 150)));
  }
}

function modelReady() {
  console.log('FaceMesh Model Ready!');
}

function draw() {
  background(240);
  
  // 상태에 따른 화면 분기
  switch(gameState) {
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
  // 1. 웹캠 영상 반전(거울 모드) 렌더링
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();

  // 2. FaceMesh 데이터로 플레이어 위치 업데이트 (보이지 않는 좌표 계산)
  if (predictions.length > 0) {
    let keypoints = predictions[0].scaledMesh;
    player.update(keypoints);
  }
  
  // 3. 비둘기 이동 및 그리기
  for (let pigeon of pigeons) {
    pigeon.update();
    pigeon.show();
  }

  // 4. 아이템 낙하 및 충돌 판정 (배열을 뒤에서부터 순회)
  // 아이템 충돌 판정은 플레이어의 "인식 마커"가 그려지기 전에 처리됩니다.
  for (let i = items.length - 1; i >= 0; i--) {
    let item = items[i];
    item.update();
    item.show();

    // ★수정됨: 추측이 아닌 '정확한 입술 좌표'를 가져와서 거리 계산
    let dFace = dist(item.x, item.y, player.x, player.y); 
    let dMouth = dist(item.x, item.y, player.mouthX, player.mouthY); 

    if (!item.isDead) {
      if (item.type === 'EGG') {
        // 알: 입과 충돌 반경(60) 내에 있고 입을 벌렸을 때 획득 (+10점)
        if (dMouth < 60 && player.mouthOpen) {
          score += 10;
          item.isDead = true; 
        }
      } else if (item.type === 'POOP') {
        // 똥: 얼굴(머리 전체) 반경(100) 내에 닿았을 때 피격 (-5점)
        // 충돌 반경 100은 사람 머리 전체를 덮는 넉넉한 크기입니다.
        if (dFace < 100) {
          score -= 5;
          item.isDead = true;
          // 화면에 똥 자국 추가 (맞은 위치에 무작위 크기로 생성)
          splatters.push({ x: item.x, y: item.y, size: random(100, 250) });
        }
      }
    }

    // 바닥에 떨어졌거나 먹은 아이템은 배열에서 제거
    if (item.isDead) {
      items.splice(i, 1);
    }
  }

  // ★5. 플레이어 그리기 (디버깅 마커 활성화)
  // 이제 내부에 '인식 마커'를 그려서 나를 인식하는지 눈으로 확인합니다.
  player.show(); 

  // 6. 화면을 가리는 똥 자국들 그리기
  for (let s of splatters) {
    fill(101, 67, 33, 220); // 짙은 갈색, 약간 투명하게
    noStroke();
    ellipse(s.x, s.y, s.size, s.size * 0.8);
    ellipse(s.x + 20, s.y - 10, s.size * 0.6, s.size * 0.6);
  }
  
  // 7. 점수 UI 표시
  fill(255); // 글씨가 잘 보이게 흰색 테두리 추가
  stroke(0);
  strokeWeight(4);
  textAlign(LEFT, TOP);
  textSize(40);
  text(`Score: ${score}`, 20, 20);
  noStroke(); // 다른 도형에 영향 안 주게 초기화
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
  }

  update(keypoints) {
    // [좌표 매핑 알고리즘]
    // ml5 원본 데이터(keypoints)는 반전되지 않은 비디오 기준입니다.
    // 사용자가 거울처럼 느끼게 하려면 x좌표를 (width - 원본X)로 매핑해야 합니다.

    // 1. 코끝 (1번 키포인트) - 얼굴의 중심으로 사용 (똥 충돌용)
    this.x = width - keypoints[1][0]; 
    this.y = keypoints[1][1];

    // 2. 정확한 입 위치 계산 (윗입술 13번, 아랫입술 14번의 중간 지점)
    let upperLip = keypoints[13];
    let lowerLip = keypoints[14];
    
    // 입 위치 또한 거울 모드 매핑 적용
    this.mouthX = width - ((upperLip[0] + lowerLip[0]) / 2);
    this.mouthY = (upperLip[1] + lowerLip[1]) / 2;

    // 3. 입 벌림 상태 감지
    let mouthDist = dist(upperLip[0], upperLip[1], lowerLip[0], lowerLip[1]);
    
    // 입을 벌렸는지 판단하는 기준치 (임계값을 15에서 10으로 낮춰서 살짝만 벌려도 인식되게 수정)
    this.mouthOpen = mouthDist > 10; 
  }

  show() {
    // ★디버깅 마커 그리기★
    // 이 코드는 사용자님의 얼굴 위치를 게임이 어떻게 인식하고 있는지 보여줍니다.
    noStroke();
    
    // 1. 몸(얼굴 중심/코끝) 인식 마커 - magenta (자홍색)
    fill(255, 0, 255, 150); // 짙은 자홍색, 약간 투명
    ellipse(this.x, this.y, 40, 40); 
    // 실제 똥 충돌 반경(100)을 시각화하려면 아래 주석을 해제하세요.
    // noFill(); stroke(255, 0, 255, 100); strokeWeight(2); ellipse(this.x, this.y, 200, 200); noStroke(); fill(255);

    // 2. 입 인식 마커 - cyan (청록색)
    if (this.mouthOpen) {
      fill(0, 255, 255); // 입 벌렸을 때: 밝은 청록색 (꽉 찬 원)
      ellipse(this.mouthX, this.mouthY, 60, 60); // 원 크기 키움
    } else {
      noFill(); 
      stroke(0, 255, 255, 150); // 입 다물었을 때: 청록색 테두리 원
      strokeWeight(3);
      ellipse(this.mouthX, this.mouthY, 30, 30);
      noStroke(); // 다른 그래픽 영향 안 주게 초기화
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
    
    // 화면 밖으로 나가면 반대편에서 재등장
    if (this.x > width + 50) this.x = -50;
    if (this.x < -50) this.x = width + 50;

    // 1.5% 확률로 알 또는 똥 투하
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
function drawMainScreen() {
  background(200, 250, 200); 
  fill(0);
  textAlign(CENTER, CENTER);
  textSize(40);
  text("입벌려! 비둘기 똥 들어간다~", width / 2, height / 2 - 50);
  
  textSize(20);
  text("화면을 클릭하면 게임이 시작됩니다", width / 2, height / 2 + 50);
}

function drawLoginScreen() {
  background(255);
  text("로그인 화면", width / 2, height / 2);
}

function drawCalibrateScreen() {
  background(255);
  text("웹캠 설정 화면", width / 2, height / 2);
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
    gameState = 'PLAYING';
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}