window.GameScreen = {
  init() {
    const hud = document.getElementById('game-hud');
    hud.style.display = 'flex';

    const sketch = (sk) => {

      let pigeons = [];
      let projectiles = [];

      let hp = 3;
      let score = 0;

      let paused = false;
      let invincible = 0;

      let startTime = 0;

      sk.setup = () => {
        const canvas = sk.createCanvas(
          window.innerWidth,
          window.innerHeight
        );

        canvas.parent('game-screen');

        startTime = sk.millis();

        spawnStage();

        setupButtons();
      };

      function setupButtons() {
        document.getElementById('btn-pause').onclick = () => {
          paused = !paused;

          document.getElementById('pause-overlay').style.display =
            paused ? 'flex' : 'none';
        };

        document.getElementById('btn-resume').onclick = () => {
          paused = false;
          document.getElementById('pause-overlay').style.display = 'none';
        };

        document.getElementById('btn-quit').onclick = quitGame;
        document.getElementById('btn-quit-confirm').onclick = quitGame;
      }

      function quitGame() {
        APP.lastResult = {
          cleared: false,
          score,
          hp,
          survivalTime: sk.millis() - startTime,
          mode: APP.mode,
          quit: true,
        };
        ResultScreen.init();
        showScreen('result-screen');
      }

      function spawnStage() {
        pigeons = [];

        if (APP.mode === 'stage') {
          const cfg = STAGES[APP.selectedStage];

          for (let i = 0; i < cfg.pigeons; i++) {
            pigeons.push(
              new Pigeon(sk, 'normal', cfg)
            );
          }

          if (cfg.hasBoss) {
            pigeons.push(
              new Pigeon(sk, cfg.hasBoss)
            );
          }

        } else {
          for (let i = 0; i < 3; i++) {
            pigeons.push(
              new Pigeon(sk, 'normal')
            );
          }
        }
      }

      sk.draw = () => {

        sk.background('#87CEEB');

        if (paused) return;

        drawSky();

        FaceController.update(sk);

        pigeons.forEach(pigeon => {
          pigeon.update(projectiles);
          pigeon.draw();
        });

        projectiles.forEach(proj => {
          proj.update();
          proj.draw();
        });

        collisionCheck();

        pigeons = pigeons.filter(p => p.active);
        projectiles = projectiles.filter(p => p.active);

        if (invincible > 0) {
          invincible -= sk.deltaTime;
        }

        updateHud();

        checkClear();
      };

      function drawSky() {

        sk.noStroke();

        for (let i = 0; i < 8; i++) {
          sk.fill(255, 255, 255, 180);

          sk.ellipse(
            i * 250 + 100,
            100,
            180,
            70
          );
        }
      }

      function collisionCheck() {

        projectiles.forEach(proj => {

          if (!proj.active) return;

          // 알 먹기
          if (proj.type === 'egg') {

            if (FaceController.isMouthCatch(proj)) {

              score++;
              proj.active = false;
            }

          } else {

            // 똥 피격
            if (
              FaceController.isFaceHit(proj) &&
              invincible <= 0
            ) {

              hp--;
              invincible = 1000;

              proj.active = false;

              flashHit();

              if (hp <= 0) {
                gameOver();
              }
            }
          }
        });
      }

      function flashHit() {

        const flash = document.getElementById('hit-flash');

        flash.style.display = 'block';

        setTimeout(() => {
          flash.style.display = 'none';
        }, 400);
      }

      async function gameOver() {
        const survivalTime = sk.millis() - startTime;

        if (APP.mode === 'competitive') {
          MockLeaderboard.add({
            uid: APP.currentUser ? APP.currentUser.uid : 'guest',
            displayName: APP.displayName || 'Guest',
            score,
            survivalTime,
          });
        }

        APP.lastResult = {
          cleared: false,
          score,
          hp,
          survivalTime,
          mode: APP.mode,
        };
        ResultScreen.init();
        showScreen('result-screen');
        sk.noLoop();
      }

      function checkClear() {

        if (APP.mode !== 'stage') return;

        const goal =
          STAGES[APP.selectedStage].goal;

        if (score >= goal) {
          APP.lastResult = {
            cleared: true,
            score,
            hp,
            survivalTime: sk.millis() - startTime,
            mode: APP.mode,
            stage: APP.selectedStage,
          };
          ResultScreen.init();
          showScreen('result-screen');
          sk.noLoop();
        }
      }

      function updateHud() {

        document.getElementById('hud-hearts').textContent =
          '❤️'.repeat(hp);

        const elapsed =
          sk.millis() - startTime;

        document.getElementById('hud-center').textContent =
          `🥚 ${score}개 | ${formatTime(elapsed)}`;
      }
    };

    APP.p5Instance = new p5(sketch);
  }
};
