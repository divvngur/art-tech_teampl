function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  clear();
  push(); translate(200, 300); scale(2); drawPigeon(); pop();
  push(); translate(500, 300); scale(2); drawEgg(); pop();
  push(); translate(700, 300); scale(2); drawPoop(); pop();
}

function setup() {
  createCanvas(400, 400);
}

function draw() {
  drawPigeon()
}

function drawPigeon() {
  background(220);
  
  noStroke();
  fill(150);
  arc(200, 200, 70, 100, PI, TWO_PI);
 
  rect(165, 200, 70, 80);
  fill(180);
  arc(165, 250, 200, 60, HALF_PI, 3/2*PI);
  arc(165, 260, 200, 50, HALF_PI, 3/2*PI);
  ellipse(195, 255, 110, 80); // body
  
  fill(255);
  ellipse(210, 180, 23, 23);
  fill(55);
  ellipse(205, 175, 10, 10); // eyes
  
  fill('#ddcf4f');
  triangle(230, 200, 230, 180, 260, 195); // beak
  
  // --- 여기서부터 날개 애니메이션 영역입니다 ---
  push(); 
  // 1. 날개가 몸에 붙어있는 중심점(어깨 위치)으로 기준점을 이동합니다.
  translate(190, 250); 
  
  // 2. sin 함수를 이용해 -20도에서 +20도 사이를 부드럽게 왕복하는 회전 각도를 만듭니다.
  // frameCount 뒤의 곱하기 숫자가 커질수록 날개짓이 빨라집니다.
  let flapAngle = sin(frameCount * 0.15) * radians(20); 
  rotate(flapAngle);
  
  // 3. 원래 날개 그리던 코드를 넣되, translate(170, 250)만큼 이동했으므로 
  // 모든 x 좌표에서 170을 빼고, y 좌표에서 250을 빼서 가상 중심점(0, 0) 기준으로 맞춰줍니다.
  fill(150);
  ellipse(-20, 0, 85, 45);          // 원래 (170, 255) -> 대략 (0, 0) 기준으로 정렬
  ellipse(-40, 15, 85, 20);       // 원래 (150, 265) -> (-20, 15)
  ellipse(-30, 0, 85, 20);        // 원래 (160, 250) -> (-10, 0)
  ellipse(-20, -10, 85, 20);        // 원래 (170, 240) -> (0, -10)
  
  //translate(185, 250);
  
  //let flapAngle = sin(frameCount * 0.15) * radians(20); 
  //rotate(flapAngle);
  
  pop(); 
  // ----------------------------------------
}
  


function drawEgg() {
 
  stroke(215); strokeWeight(1);
  fill(252, 252, 248);
  ellipse(0, 0, 24, 34);
  noStroke();
  fill(255, 255, 255, 150);
  ellipse(-6, -10, 9, 14);
}

function drawPoop() {
  // 소프트콘: 아래→위로 크기 줄어들며 좌우 교차 오프셋 = 배배 꼬인 효과
  fill(130, 82, 28); noStroke();
  ellipse(  0, 20, 38, 20);  // L1 (base)
  ellipse(  0,  8, 30, 18);  // L2
  ellipse(  0, -3, 23, 16);  // L3
  ellipse(  0,-13, 17, 14);  // L4
  ellipse(  0,-22, 11, 11);  // L5
  ellipse(  0,-29,  6,  8);  // L6 (top)

  // 층 사이 골 → 꼬임 강조
  noFill(); stroke(80, 46, 12); strokeWeight(2);
  arc( 0, 13, 28,  8, 0, PI);
  arc( 0,  1, 20,  7, 0, PI);
  arc( 0, -9, 14,  6, 0, PI);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
