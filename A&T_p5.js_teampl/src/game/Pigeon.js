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
    this.skillIndex   = 0;
    this.lastSkill    = sk.millis();
    this.skillCfg     = window.BOSS_CONFIG[type] || null;
    this.skillInterval = this.skillCfg ? this.skillCfg.skillInterval : 99999;

    // 애니메이션
    this.wingAngle = 0;
    this.wingDir   = 1;
    this.frameOff  = sk.random(0, 100);

    this.active = true;
    this.hitFlash = 0;
  }

  update(projectiles) {
    const sk  = this.sk;
    const dt  = sk.deltaTime / 16.67;
    const now = sk.millis();

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 벽 반사
    if (this.x < this.size/2)           { this.x = this.size/2;           this.vx *= -1; }
    if (this.x > sk.width - this.size/2){ this.x = sk.width - this.size/2; this.vx *= -1; }

    // 날개 애니메이션
    this.wingAngle += 0.18 * dt;

    // 히트 플래시 감소
    if (this.hitFlash > 0) this.hitFlash -= dt * 2;

    // ── 투사체 드롭 ─────────────────────────────────
    if (now - this.lastDrop > this.dropInterval) {
      this.lastDrop = now;
      this._dropProjectile(projectiles);
    }

    // ── 보스 스킬 ───────────────────────────────────
    if (this.skillCfg && now - this.lastSkill > this.skillInterval) {
      this.lastSkill = now;
      this._fireSkill(projectiles);
    }
  }

  _dropProjectile(projectiles) {
    const sk = this.sk;
    const type = sk.random() < this.poopRate ? 'poop' : 'egg';
    projectiles.push(new Projectile(sk, this.x, this.y + this.size/2, type, { speed: 3 + this.size/40 }));
  }

  _fireSkill(projectiles) {
    const sk     = this.sk;
    const skills = this.skillCfg.skills;
    const skill  = skills[this.skillIndex % skills.length];
    this.skillIndex++;

    switch (skill) {
      case 'curve': // 미니보스: sin 곡선 3발
        for (let i = -1; i <= 1; i++) {
          projectiles.push(new Projectile(sk, this.x + i*24, this.y + this.size/2,
            'curve', { speed:3.5, amp: 3 + i*1.5, freq:0.07 }));
        }
        break;
      case 'scatter': // 미니보스: 산탄 5방향
        for (let a = -60; a <= 60; a += 30) {
          const rad = (a * Math.PI) / 180;
          projectiles.push(new Projectile(sk, this.x, this.y + this.size/2,
            'poop', { vx: Math.sin(rad)*3, vy: Math.cos(rad)*3 + 2 }));
        }
        break;
      case 'laser': // 보스: 레이저
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            if (!this.active) return;
            const dir = this.vx > 0 ? 1 : -1;
            projectiles.push(new Projectile(sk, this.x, this.y + this.size/2 + i*14,
              'laser', { vx: dir*9, vy:0 }));
          }, i * 250);
        }
        break;
      case 'giant_poop': // 보스: 거대 똥 + 경고
        const gx = sk.random(100, sk.width - 100);
        // 경고 투사체 (즉시)
        const warn = new Projectile(sk, gx, sk.height - 80, 'giant_poop', { speed:0 });
        warn.spawnTime = sk.millis();
        projectiles.push(warn);
        // 실제 투사체 (1.5초 후)
        setTimeout(() => {
          if (!this.active) return;
          projectiles.push(new Projectile(sk, gx, this.y + this.size/2, 'giant_poop', { speed:2.5 }));
        }, 1500);
        break;
      case 'rain': // 보스: 똥 소나기
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
    sk.push();
    sk.translate(this.x, this.y);
    if (this.vx < 0) sk.scale(-1, 1);

    // 피격 시 빨간 틴트
    if (this.hitFlash > 0) {
      sk.drawingContext.globalAlpha = 1;
    }

    const s  = this.size;
    const wf = Math.sin(this.wingAngle) * 0.4; // 날개짓 계수

    // ── 몸체 색 ────────────────────────────────────
    const colors = {
      normal:   [160, 160, 180],
      miniboss: [200, 120, 60],
      boss:     [80,  30,  90],
    };
    const [r,g,b] = colors[this.type];

    if (this.hitFlash > 0) {
      sk.fill(255, 100 + r*.3, 100 + b*.2);
    } else {
      sk.fill(r, g, b);
    }
    sk.noStroke();

    // 몸통 (타원)
    sk.ellipse(0, 0, s*.65, s*.5);

    // 머리
    sk.ellipse(s*.25, -s*.15, s*.35, s*.3);

    // 날개 위
    sk.push();
    sk.rotate(-wf);
    sk.fill(r-20, g-20, b-20);
    sk.ellipse(-s*.05, -s*.15, s*.6, s*.22);
    sk.pop();
    // 날개 아래
    sk.push();
    sk.rotate(wf);
    sk.fill(r+20, g+20, b+20);
    sk.ellipse(-s*.05, s*.1, s*.55, s*.18);
    sk.pop();

    // 꼬리
    sk.fill(r-30, g-30, b-30);
    sk.triangle(-s*.3, s*.05, -s*.5, s*.15, -s*.3, s*.2);

    // 눈
    sk.fill(255);
    sk.ellipse(s*.32, -s*.18, s*.1, s*.1);
    sk.fill(20);
    sk.ellipse(s*.33, -s*.17, s*.05, s*.05);

    // 부리
    sk.fill(255, 200, 50);
    sk.triangle(s*.42, -s*.13, s*.52, -s*.1, s*.42, -s*.07);

    // 보스 왕관
    if (this.type === 'boss') {
      sk.fill(255, 215, 0);
      sk.noStroke();
      const cx = s*.22, cy = -s*.35;
      sk.rect(cx - s*.13, cy, s*.26, s*.12, 2);
      sk.triangle(cx - s*.13, cy, cx - s*.13 - s*.05, cy - s*.1, cx - s*.07, cy);
      sk.triangle(cx, cy, cx, cy - s*.12, cx + s*.07, cy);
      sk.triangle(cx + s*.13, cy, cx + s*.18, cy - s*.1, cx + s*.13 + s*.0, cy);
    }

    sk.pop();

    // HP 바 (보스/미니보스)
    if (this.type !== 'normal') {
      sk.push();
      const bw = this.size * 1.2;
      const bx = this.x - bw/2;
      const by = this.y - this.size/2 - 18;
      sk.fill(0, 0, 0, 100);
      sk.rect(bx, by, bw, 8, 4);
      const ratio = Math.max(0, this.hp / this.maxHp);
      sk.fill(this.type === 'boss' ? [220,50,50] : [220,140,50]);
      sk.rect(bx, by, bw * ratio, 8, 4);
      sk.pop();
    }
  }
}