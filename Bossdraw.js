function setup() {
  createCanvas(800,800);
}
function draw(){
  
  Bossdraw();
}
function Bossdraw() {
  background(255);
  noStroke();
  //body
  fill(180);
  rect(300,0,200,300);
  fill(150);
  rect(300,100,200,200)
  arc(400,300,200,300,TWO_PI,PI);
  //beak
  fill('#ddcf4f');
  triangle(380,440,420,440,400,490);
  //eyes
  fill(255);
  ellipse(330,350,50,70);
  ellipse(470,350,50,70);
  fill(55);
  ellipse(480,340,30,30);
  ellipse(320,360,30,30);
  //wings
  push();
  translate(300,150);
  let flapAngle = sin(frameCount * 0.15) * radians(20); 
  rotate(flapAngle);
  fill(150);
  triangle(50,0,-60,60,-60,-60);
  ellipse(-145,50,200,30);
  ellipse(-130,35,200,30);
  ellipse(-120,20,200,30);
  ellipse(-110,5,200,30);
  ellipse(-90,-10,200,30);
  ellipse(-60,-35,200,30);
  ellipse(-50,-45,150,10);
  ellipse(-40,-50,70,20);
  pop();
  // 오른쪽 날개 (좌우 반전)
push();
translate(500, 150);
scale(-1, 1); // x축 반전
rotate(flapAngle);
fill(150);
triangle(50,0,-60,60,-60,-60);
ellipse(-145,50,200,30);
ellipse(-130,35,200,30);
ellipse(-120,20,200,30);
ellipse(-110,5,200,30);
ellipse(-90,-10,200,30);
ellipse(-60,-35,200,30);
ellipse(-50,-45,150,10);
ellipse(-40,-50,70,20);
pop();

  
}