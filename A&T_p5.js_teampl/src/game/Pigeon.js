// ── Pigeon.js ─────────────────────────────────────────

class Pigeon {
  constructor(sk, type = 'normal', cfg = {}) {
    this.sk   = sk;
    this.type = type; // 'normal' | 'miniboss' | 'boss'

    // 크기
    const sizes = { normal:48, miniboss:80, boss:110 };
    this.size = sizes[type] || 48;

    // 초기 위치
    this.x  = sk.random(80, sk.width - 80);
    this.y  = sk.random(sk.height * .08, sk.height * .38);
    this.vx = (sk.random() > .5 ? 1 : -1) * (cfg.speed || 2.5);
    this.vy = 0;

    // HP
    const hps = { normal:1, miniboss:5, boss:15 };
    this.maxHp = hps[type];
    this.hp    = this.maxHp;

    // 투사체 드롭
    this.dropInterval = cfg.dropInterval || 2000;
    this.lastDrop     = sk.millis() + sk.random(500, 2000);
    this.poopRate     = cfg.poopRate || .3;

    // 보스 스킬
    this.skillIndex    = 0;
    this.lastSkill     = sk.millis();
    this.skillCfg      = window.BOSS_CONFIG[type] || null;
    this.skillInterval = this.skillCfg ? this.skillCfg.skillInterval : 99999;

    // 애니메이션
    this.wingAngle = 0;
    this.wingDir   = 1;
    this.frameOff  = sk.random(0, 100);

    this.active   = true;
    this.hitFlash = 0;
  }

  update(projectiles) {
    const sk  = this.sk;
    const dt  = sk.deltaTime / 16.67;
    const now = sk.millis();

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 벽 반사
    if (this.x < this.size/2)            { this.x = this.size/2;            this.vx *= -1; }
    if (this.x > sk.width - this.size/2) { this.x = sk.width - this.size/2; this.vx *= -1; }

    // 날개 애니메이션
    this.wingAngle += 0.18 * dt;

    // 히트 플래시 감소
    if (this.hitFlash > 0) this.hitFlash -= dt * 2;

    // 투사체 드롭
    if (now - this.lastDrop > this.dropInterval) {
      this.lastDrop = now;
      this._dropProjectile(projectiles);
    }

    // 보스 스킬
    if (this.skillCfg && now - this.lastSkill > this.skillInterval) {
      this.lastSkill = now;
      this._fireSkill(projectiles);
    }
  }

  _dropProjectile(projectiles) {
    const sk   = this.sk;
    const type = sk.random() < this.poopRate ? 'poop' : 'egg';
    projectiles.push(new Projectile(sk, this.x, this.y + this.size/2, type, { speed: 3 + this.size/40 }));
  }

  _fireSkill(projectiles) {
    const sk     = this.sk;
    const skills = this.skillCfg.skills;
    const skill  = skills[this.skillIndex % skills.length];
    this.skillIndex++;

    switch (skill) {
      case 'curve':
        for (let i = -1; i <= 1; i++) {
          projectiles.push(new Projectile(sk, this.x + i*24, this.y + this.size/2,
            'curve', { speed:3.5, amp: 3 + i*1.5, freq:0.07 }));
        }
        break;
      case 'scatter':
        for (let a = -60; a <= 60; a += 30) {
          const rad = (a * Math.PI) / 180;
          projectiles.push(new Projectile(sk, this.x, this.y + this.size/2,
            'poop', { vx: Math.sin(rad)*3, vy: Math.cos(rad)*3 + 2 }));
        }
        break;
      case 'laser':
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            if (!this.active) return;
            const dir = this.vx > 0 ? 1 : -1;
            projectiles.push(new Projectile(sk, this.x, this.y + this.size/2 + i*14,
              'laser', { vx: dir*9, vy:0 }));
          }, i * 250);
        }
        break;
      case 'giant_poop':
        const gx   = sk.random(100, sk.width - 100);
        const warn = new Projectile(sk, gx, sk.height - 80, 'giant_poop', { speed:0 });
        warn.spawnTime = sk.millis();
        projectiles.push(warn);
        setTimeout(() => {
          if (!this.active) return;
          projectiles.push(new Projectile(sk, gx, this.y + this.size/2, 'giant_poop', { speed:2.5 }));
        }, 1500);
        break;
      case 'rain':
        for (let i = 0; i < 10; i++) {
          setTimeout(() => {
            if (!this.active) return;
            projectiles.push(new Projectile(sk, sk.random(40, sk.width-40), -20,
              'rain', { speed: sk.random(4, 7) }));
          }, i * 120);
        }
        break;
    }
  }

  takeDamage() {
    this.hp--;
    this.hitFlash = 1;
    if (this.hp <= 0) { this.active = false; return true; }
    return false;
  }

  draw() {
    const sk = this.sk;

    if (this.type === 'boss') {
      this._drawBoss();
    } else if (this.type === 'miniboss') {
      this._drawMiniboss();
    } else {
      this._drawNormal();
    }

    // HP 바 (보스/미니보스)
    if (this.type !== 'normal') {
      sk.push();
      const bw    = this.size * 1.2;
      const bx    = this.x - bw/2;
      const by    = this.y - this.size/2 - 18;
      sk.fill(0, 0, 0, 100);
      sk.rect(bx, by, bw, 8, 4);
      const ratio = Math.max(0, this.hp / this.maxHp);
      sk.fill(...(this.type === 'boss' ? [220,50,50] : [220,140,50]));
      sk.rect(bx, by, bw * ratio, 8, 4);
      sk.pop();
    }
  }

  // ══════════════════════════════════════════════════════
  //  공통 비둘기 그리기 (normal / miniboss 공유)
  //  normal   : fill(150) 회색
  //  miniboss : fill(200,120,60) 주황 + 크기 1.67배
  // ══════════════════════════════════════════════════════
  _drawPigeonShape(bodyColor, wingColor, scaleRatio) {
    const sk         = this.sk;
    const flapAngle  = Math.sin(this.wingAngle) * sk.radians(20);

    sk.push();
    sk.translate(this.x, this.y);
    sk.scale(scaleRatio);
    if (this.vx < 0) sk.scale(-1, 1);

    // 원점을 비둘기 중심 기준으로 맞추기 위해 offset
    // drawPigeon()은 (200,200) 기준 → 여기선 (0,0) 기준으로 -200, -200 이동
    sk.translate(-200, -200);

    sk.noStroke();

    // 머리
    sk.fill(bodyColor);
    sk.arc(200, 200, 70, 100, sk.PI, sk.TWO_PI);

    // 몸통
    sk.rect(165, 200, 70, 80);
    sk.fill(wingColor);
    sk.arc(165, 250, 200, 60, sk.HALF_PI, 3/2*sk.PI);
    sk.arc(165, 260, 200, 50, sk.HALF_PI, 3/2*sk.PI);
    sk.ellipse(195, 255, 110, 80);

    // 눈
    sk.fill(255);
    sk.ellipse(210, 180, 23, 23);
    sk.fill(55);
    sk.ellipse(205, 175, 10, 10);

    // 부리
    sk.fill('#ddcf4f');
    sk.triangle(230, 200, 230, 180, 260, 195);

    // 날개 (애니메이션)
    sk.push();
    sk.translate(190, 250);
    sk.rotate(flapAngle);
    sk.fill(bodyColor);
    sk.ellipse(-20,   0, 85, 45);
    sk.ellipse(-40,  15, 85, 20);
    sk.ellipse(-30,   0, 85, 20);
    sk.ellipse(-20, -10, 85, 20);
    sk.pop();

    sk.pop();
  }

  _drawNormal() {
    const bodyColor = this.hitFlash > 0
      ? this.sk.color(255, 120, 120)
      : this.sk.color(150);
    const wingColor = this.hitFlash > 0
      ? this.sk.color(255, 120, 120)
      : this.sk.color(180);
    this._drawPigeonShape(bodyColor, wingColor, 1);
  }

  // ══════════════════════════════════════════════════════
  //  미니보스 — 같은 디자인, 주황색 + 1.67배 크기
  // ══════════════════════════════════════════════════════
  _drawMiniboss() {
    const sk        = this.sk;
    const bodyColor = this.hitFlash > 0 ? sk.color(255,120,80) : sk.color(200,120,60);
    const wingColor = this.hitFlash > 0 ? sk.color(255,120,80) : sk.color(170,90,40);
    const s         = this.size / 48; // ≈ 1.67
    this._drawPigeonShape(bodyColor, wingColor, s);
  }

  // ══════════════════════════════════════════════════════
  //  보스 비둘기 (Bossdraw.js 디자인, sk. 모드 변환)
  //  ※ 보스는 화면 상단 고정이므로 x/y를 무시하고
  //    Bossdraw()가 직접 그림 — 여기선 HP바만 처리
  // ══════════════════════════════════════════════════════
  _drawBoss() {
    // 보스 몸체는 sketch.js의 Bossdraw()가 담당
    // 이 함수에서는 아무것도 그리지 않음
    // (HP바는 draw() 공통 처리에서 그려짐)
  }
}
