// ─────────────────────────────────────────────
// Projectile.js
// 투사체 클래스
// ─────────────────────────────────────────────

class Projectile {
  constructor(sk, x, y, type, options = {}) {

    this.sk = sk;

    this.x = x;
    this.y = y;

    this.type = type;

    this.active = true;

    this.spawnTime = sk.millis();

    // 기본값
    this.vx = 0;
    this.vy = 0;

    this.radius = 10;

    // ─────────────────────────
    // 타입별 설정
    // ─────────────────────────

    switch(type) {

      // ───── 알 ─────
      case "egg":

        this.radius = 14;

        this.vy = options.speed || 4;

        break;


      // ───── 기본 똥 ─────
      case "poop":

        this.radius = 12;

        this.vx = sk.random(-1, 1);

        this.vy = options.speed || 4;

        this.wobble = sk.random(1000);

        break;


      // ───── 곡선 똥 ─────
      case "curve":

        this.radius = 12;

        this.vy = options.speed || 4;

        this.waveAmp = options.waveAmp || 4;

        this.waveSpeed = options.waveSpeed || 0.08;

        this.t = 0;

        break;


      // ───── 레이저 ─────
      case "laser":

        this.radius = 10;

        this.vx = options.vx || 10;

        this.vy = options.vy || 0;

        this.lifeTime = 2500;

        break;


      // ───── 거대 똥 ─────
      case "giant_poop":

        this.radius = 38;

        this.vy = options.speed || 2.5;

        this.warningTime = 1500;

        this.warning = true;

        break;


      // ───── 소나기 ─────
      case "rain":

        this.radius = 11;

        this.vx = sk.random(-0.5, 0.5);

        this.vy = options.speed || sk.random(5, 8);

        break;
    }
  }

  // ─────────────────────────────────────────
  // update
  // ─────────────────────────────────────────

  update() {

    const sk = this.sk;

    const dt = sk.deltaTime / 16.67;

    switch(this.type) {

      case "egg":

        this.y += this.vy * dt;

        break;


      case "poop":

        this.wobble += 0.08;

        this.x += Math.sin(this.wobble) * 0.8 * dt;

        this.x += this.vx * dt;

        this.y += this.vy * dt;

        break;


      case "curve":

        this.t += this.waveSpeed;

        this.x += Math.sin(this.t) * this.waveAmp * dt;

        this.y += this.vy * dt;

        break;


      case "laser":

        this.x += this.vx * dt;

        this.y += this.vy * dt;

        if (sk.millis() - this.spawnTime > this.lifeTime) {
          this.active = false;
        }

        break;


      case "giant_poop":

        // 경고 단계
        if (this.warning) {

          if (sk.millis() - this.spawnTime > this.warningTime) {

            this.warning = false;

            this.spawnTime = sk.millis();
          }

        } else {

          this.y += this.vy * dt;
        }

        break;


      case "rain":

        this.x += this.vx * dt;

        this.y += this.vy * dt;

        break;
    }

    // 화면 밖 제거
    if (
      this.y > sk.height + 100 ||
      this.x < -100 ||
      this.x > sk.width + 100
    ) {
      this.active = false;
    }
  }

  // ─────────────────────────────────────────
  // draw
  // ─────────────────────────────────────────

  draw() {

    const sk = this.sk;

    sk.push();

    switch(this.type) {

      // ─────────────────────
      // EGG
      // ─────────────────────
      case "egg":

        sk.fill(255, 250, 235);

        sk.stroke(220);

        sk.strokeWeight(1.5);

        sk.ellipse(
          this.x,
          this.y,
          this.radius * 1.5,
          this.radius * 2
        );

        sk.noStroke();

        sk.fill(255);

        sk.ellipse(
          this.x - 3,
          this.y - 5,
          5,
          7
        );

        break;


      // ─────────────────────
      // POOP
      // ─────────────────────
      case "poop":
      case "rain":

        sk.fill(101, 67, 33);

        sk.stroke(70, 45, 20);

        sk.strokeWeight(1);

        sk.ellipse(
          this.x,
          this.y,
          this.radius * 2,
          this.radius * 2.2
        );

        sk.ellipse(
          this.x,
          this.y - this.radius,
          this.radius * 1.2,
          this.radius * 1.2
        );

        sk.ellipse(
          this.x,
          this.y - this.radius * 1.7,
          this.radius * 0.7,
          this.radius * 0.7
        );

        break;


      // ─────────────────────
      // CURVE
      // ─────────────────────
      case "curve":

        sk.fill(130, 80, 40);

        sk.stroke(80, 50, 20);

        sk.strokeWeight(1);

        sk.ellipse(
          this.x,
          this.y,
          this.radius * 2,
          this.radius * 2.2
        );

        sk.ellipse(
          this.x,
          this.y - this.radius,
          this.radius,
          this.radius
        );

        break;


      // ─────────────────────
      // LASER
      // ─────────────────────
      case "laser":

        sk.stroke(255, 60, 60);

        sk.strokeWeight(6);

        sk.line(
          this.x,
          this.y,
          this.x + this.vx * 4,
          this.y + this.vy * 4
        );

        sk.stroke(255, 180, 180);

        sk.strokeWeight(2);

        sk.line(
          this.x,
          this.y,
          this.x + this.vx * 4,
          this.y + this.vy * 4
        );

        break;


      // ─────────────────────
      // GIANT POOP
      // ─────────────────────
      case "giant_poop":

        // 경고
        if (this.warning) {

          const alpha = sk.map(
            Math.sin(sk.frameCount * 0.2),
            -1,
            1,
            80,
            255
          );

          sk.noFill();

          sk.stroke(255, 0, 0, alpha);

          sk.strokeWeight(5);

          sk.ellipse(
            this.x,
            sk.height - 80,
            this.radius * 4,
            this.radius * 2
          );

        } else {

          sk.fill(70, 40, 10);

          sk.stroke(40, 20, 5);

          sk.strokeWeight(2);

          sk.ellipse(
            this.x,
            this.y,
            this.radius * 2,
            this.radius * 2.4
          );

          sk.ellipse(
            this.x,
            this.y - this.radius * 1.2,
            this.radius * 1.3,
            this.radius * 1.3
          );

          sk.ellipse(
            this.x,
            this.y - this.radius * 2,
            this.radius * 0.8,
            this.radius * 0.8
          );
        }

        break;
    }

    sk.pop();
  }
}

// 전역 등록
window.Projectile = Projectile;