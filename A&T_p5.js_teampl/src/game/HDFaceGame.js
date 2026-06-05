window.HDFaceGame = function HDFaceGame(options) {
  const {
    containerId,
    mode,
    selectedStage,
    onHudUpdate,
    onQuit,
    onFinish,
  } = options;

  const HD_W = 1920;
  const HD_H = 1080;
  const AI_W = 640;
  const AI_H = 360;

  let p5Instance = null;

  const sketch = (sk) => {
    let gameState = 'LOADING';
    let videoHD = null;
    let videoAI = null;
    let facemesh = null;
    let predictions = [];
    let selfieSegmentation = null;
    let segMaskCanvas = null;
    let segReady = false;
    let modelsLoaded = 0;
    let calibrationTimer = 0;
    let guideX = 0;
    let guideY = 0;
    let player = null;
    let pigeons = [];
    let items = [];
    let splatters = [];
    let score = 0;
    let lives = 3;
    let paused = false;
    let startedAt = 0;
    let invincibleUntil = 0;
    let baseFaceScreenWidth = 0;
    let warningAlpha = 0;
    let segmentationRunning = false;
    let disposed = false;

    class HDPlayer {
      constructor() {
        this.x = sk.width / 2;
        this.y = sk.height / 2;
        this.mouthX = sk.width / 2;
        this.mouthY = sk.height / 2 + 20;
        this.mouthOpen = false;
        this.mouthRadius = sk.width * 0.03;
        this.faceWidth = 0;
        this.faceHeight = 0;
        this.faceCenterX = 0;
        this.faceCenterY = 0;
        this.faceScreenWidth = 0;
        this.faceScreenHeight = 0;
        this.lockedDisplaySize = 0;
      }

      update(keypoints) {
        if (!keypoints || keypoints.length === 0) return;

        let minX = AI_W;
        let minY = AI_H;
        let maxX = 0;
        let maxY = 0;

        keypoints.forEach(point => {
          const px = Array.isArray(point) ? point[0] : point.x;
          const py = Array.isArray(point) ? point[1] : point.y;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        });

        this.faceWidth = maxX - minX;
        this.faceHeight = maxY - minY;
        this.faceCenterX = (minX + maxX) * 0.5;
        this.faceCenterY = (minY + maxY) * 0.5;

        const targetX = sk.map(this.faceCenterX, 0, AI_W, sk.width, 0);
        const targetY = sk.map(this.faceCenterY, 0, AI_H, 0, sk.height);
        this.x = sk.lerp(this.x, targetX, 0.18);
        this.y = sk.lerp(this.y, targetY, 0.18);

        this.faceScreenWidth = this.faceWidth * sk.width / AI_W;
        this.faceScreenHeight = this.faceHeight * sk.height / AI_H;

        const targetDisplaySize = this.faceScreenWidth * 1.35;
        this.lockedDisplaySize = this.lockedDisplaySize <= 0
          ? targetDisplaySize
          : sk.lerp(this.lockedDisplaySize, targetDisplaySize, 0.03);

        const upperLip = keypoints[13];
        const lowerLip = keypoints[14];
        if (!upperLip || !lowerLip) return;

        const ux = Array.isArray(upperLip) ? upperLip[0] : upperLip.x;
        const uy = Array.isArray(upperLip) ? upperLip[1] : upperLip.y;
        const lx = Array.isArray(lowerLip) ? lowerLip[0] : lowerLip.x;
        const ly = Array.isArray(lowerLip) ? lowerLip[1] : lowerLip.y;

        const mouthRawX = (ux + lx) / 2;
        const mouthRawY = (uy + ly) / 2;
        this.mouthX = sk.lerp(this.mouthX, sk.map(mouthRawX, 0, AI_W, sk.width, 0), 0.18);
        this.mouthY = sk.lerp(this.mouthY, sk.map(mouthRawY, 0, AI_H, 0, sk.height), 0.18);

        const mouthDist = sk.dist(ux, uy, lx, ly);
        this.mouthOpen = mouthDist > 10;
        this.mouthRadius = sk.map(sk.constrain(mouthDist, 5, 45), 5, 45, sk.width * 0.03, sk.width * 0.09);
      }

      show(modeName) {
        if (segReady) this.drawFaceOnly();

        const pulse = sk.sin(sk.frameCount * 0.15) * 4;
        if (this.mouthOpen) {
          sk.fill(0, 255, 255, modeName === 'CALIBRATE' ? 120 : 80);
          sk.noStroke();
          sk.ellipse(this.mouthX, this.mouthY, this.mouthRadius + pulse, this.mouthRadius + pulse);
          if (modeName === 'CALIBRATE') {
            sk.noFill();
            sk.stroke(0, 255, 255, 200);
            sk.strokeWeight(2);
            sk.ellipse(this.mouthX, this.mouthY, this.mouthRadius + pulse, this.mouthRadius + pulse);
            sk.noStroke();
          }
        } else {
          sk.fill(0, 255, 255, 100);
          sk.noStroke();
          sk.ellipse(this.mouthX, this.mouthY, modeName === 'CALIBRATE' ? 30 : 12, modeName === 'CALIBRATE' ? 30 : 12);
        }
      }

      drawFaceOnly() {
        if (!segReady || this.faceWidth <= 0) return;

        const scaleX = HD_W / AI_W;
        const scaleY = HD_H / AI_H;
        const cropBase = sk.max(this.faceWidth, this.faceHeight) * 1.3;
        const sx = this.faceCenterX * scaleX - cropBase * scaleX / 2;
        const sy = this.faceCenterY * scaleY - cropBase * scaleY * 0.6;
        const sw = cropBase * scaleX;
        const sh = cropBase * scaleY;
        const drawSize = this.lockedDisplaySize;

        sk.push();
        sk.translate(sk.width, 0);
        sk.scale(-1, 1);

        sk.drawingContext.save();
        sk.drawingContext.beginPath();
        sk.drawingContext.arc(sk.width - this.x, this.y, drawSize * 0.52, 0, sk.TWO_PI);
        sk.drawingContext.clip();
        sk.drawingContext.drawImage(
          segMaskCanvas,
          sx, sy, sw, sh,
          sk.width - this.x - drawSize / 2,
          this.y - drawSize / 2,
          drawSize,
          drawSize
        );
        sk.drawingContext.restore();
        sk.pop();
      }
    }

    class HDPigeon {
      constructor(x, y, stageCfg) {
        this.x = x;
        this.y = y;
        this.speed = sk.random(3, 6) + (stageCfg ? stageCfg.speed * 0.25 : 0);
        this.direction = sk.random() > 0.5 ? 1 : -1;
        this.dropRate = stageCfg ? sk.constrain(0.012 + stageCfg.poopRate * 0.018, 0.01, 0.035) : 0.015;
        this.poopRate = stageCfg ? stageCfg.poopRate : 0.7;
      }

      update() {
        this.x += this.speed * this.direction;
        if (this.x > sk.width + 60) this.x = -60;
        if (this.x < -60) this.x = sk.width + 60;
        if (sk.random() < this.dropRate) {
          items.push(new HDItem(this.x, this.y, sk.random() > this.poopRate ? 'EGG' : 'POOP'));
        }
      }

      show() {
        sk.textSize(sk.min(sk.width, sk.height) * 0.085);
        sk.textAlign(sk.CENTER, sk.CENTER);
        sk.text('🕊️', this.x, this.y);
      }
    }

    class HDItem {
      constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.speed = sk.random(5, 9);
        this.isDead = false;
      }

      update() {
        this.y += this.speed;
        if (this.y > sk.height + 60) this.isDead = true;
      }

      show() {
        sk.textSize(sk.min(sk.width, sk.height) * 0.065);
        sk.textAlign(sk.CENTER, sk.CENTER);
        sk.text(this.type === 'EGG' ? '🥚' : '💩', this.x, this.y);
      }
    }

    sk.setup = () => {
      const canvas = sk.createCanvas(window.innerWidth, window.innerHeight);
      canvas.parent(containerId);
      canvas.style('z-index', '1');

      guideX = sk.width / 2;
      guideY = sk.height * 0.75;
      player = new HDPlayer();
      resetRound();
      setupButtons();
      setupCameraAndModels();
    };

    function setupButtons() {
      const pauseButton = document.getElementById('btn-pause');
      const resumeButton = document.getElementById('btn-resume');
      const quitButton = document.getElementById('btn-quit');
      const quitConfirmButton = document.getElementById('btn-quit-confirm');

      pauseButton.onclick = () => {
        paused = !paused;
        pauseButton.textContent = paused ? '▶' : '⏸';
        document.getElementById('pause-overlay').style.display = paused ? 'flex' : 'none';
      };
      resumeButton.onclick = () => {
        paused = false;
        pauseButton.textContent = '⏸';
        document.getElementById('pause-overlay').style.display = 'none';
      };
      quitButton.onclick = () => onQuit(score, lives, startedAt ? sk.millis() - startedAt : 0);
      quitConfirmButton.onclick = () => onQuit(score, lives, startedAt ? sk.millis() - startedAt : 0);
    }

    function setupCameraAndModels() {
      videoHD = sk.createCapture({ video: { width: HD_W, height: HD_H }, audio: false }, () => {
        sendFrameToSegmentation();
      });
      videoHD.size(HD_W, HD_H);
      videoHD.hide();

      videoAI = sk.createCapture({ video: { width: AI_W, height: AI_H }, audio: false });
      videoAI.size(AI_W, AI_H);
      videoAI.hide();

      const createFaceMesh = ml5.facemesh || ml5.faceMesh;
      facemesh = createFaceMesh(videoAI, () => {
        modelsLoaded++;
        checkAllModelsReady();
      });
      facemesh.on('predict', results => {
        predictions = results || [];
      });

      segMaskCanvas = document.createElement('canvas');
      segMaskCanvas.width = HD_W;
      segMaskCanvas.height = HD_H;

      selfieSegmentation = new SelfieSegmentation({
        locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      });
      selfieSegmentation.setOptions({ modelSelection: 1, selfieMode: false });
      selfieSegmentation.onResults(onSegResults);
    }

    async function sendFrameToSegmentation() {
      if (disposed || !selfieSegmentation || !videoHD || segmentationRunning) {
        if (!disposed) requestAnimationFrame(sendFrameToSegmentation);
        return;
      }

      if (videoHD.elt.readyState >= 2) {
        segmentationRunning = true;
        try {
          await selfieSegmentation.send({ image: videoHD.elt });
        } catch (err) {
          console.warn('segmentation frame skipped', err);
        } finally {
          segmentationRunning = false;
        }
      }
      if (!disposed) requestAnimationFrame(sendFrameToSegmentation);
    }

    function onSegResults(results) {
      if (!segReady) {
        segReady = true;
        modelsLoaded++;
        checkAllModelsReady();
      }

      const ctx = segMaskCanvas.getContext('2d');
      ctx.save();
      ctx.clearRect(0, 0, HD_W, HD_H);
      ctx.drawImage(results.segmentationMask, 0, 0, HD_W, HD_H);
      ctx.globalCompositeOperation = 'source-in';
      ctx.drawImage(results.image, 0, 0, HD_W, HD_H);
      ctx.restore();
    }

    function checkAllModelsReady() {
      if (modelsLoaded >= 2 && gameState === 'LOADING') {
        gameState = 'CALIBRATE';
      }
    }

    function resetRound() {
      const cfg = mode === 'stage' ? STAGES[selectedStage] : null;
      const pigeonCount = cfg ? cfg.pigeons : 3;
      pigeons = [];
      for (let i = 0; i < pigeonCount; i++) {
        pigeons.push(new HDPigeon(sk.random(sk.width), sk.random(70, sk.height * 0.22), cfg));
      }
      items = [];
      splatters = [];
      score = 0;
      lives = 3;
      startedAt = 0;
      baseFaceScreenWidth = 0;
      warningAlpha = 0;
      updateHud();
    }

    sk.draw = () => {
      if (paused) return;

      switch (gameState) {
        case 'LOADING':
          drawLoadingScreen();
          break;
        case 'CALIBRATE':
          drawCalibrateScreen();
          break;
        case 'PLAYING':
          playGame();
          break;
      }
    };

    function playGame() {
      drawSky();

      if (predictions.length > 0) {
        const face = predictions[0];
        player.update(face.scaledMesh || face.keypoints || face.landmarks);
      }

      if (baseFaceScreenWidth > 0 && player.faceScreenWidth > baseFaceScreenWidth * 1.25) {
        warningAlpha = sk.min(warningAlpha + 8, 255);
      } else {
        warningAlpha = sk.max(warningAlpha - 8, 0);
      }

      player.show('PLAYING');
      sk.fill(255,0,0);
      sk.noStroke();
      sk.circle(player.mouthX, player.mouthY, 20);

      pigeons.forEach(pigeon => {
        pigeon.update();
        pigeon.show();
      });

      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.update();
        item.show();

        const mouthDistance = sk.dist(item.x, item.y, player.mouthX, player.mouthY);
        const faceDistance = sk.dist(item.x, item.y, player.x, player.y);
        const hitHead = faceDistance < player.faceScreenWidth * 0.55;

        if (!item.isDead) {
          if (item.type === 'EGG' && mouthDistance < player.mouthRadius * 0.7 && player.mouthOpen) {
            score += 10;
            item.isDead = true;
          } else if (item.type === 'POOP' && hitHead && sk.millis() > invincibleUntil) {
            lives -= 1;
            invincibleUntil = sk.millis() + 900;
            item.isDead = true;
            splatters.push({ x: item.x, y: item.y, size: sk.random(100, 250), bornAt: sk.millis() });
            flashHit();
          }
        }

        if (item.isDead) items.splice(i, 1);
      }

      drawSplatters();
      drawDistanceWarning();
      updateHud();
      checkFinish();
    }

    function drawSky() {
      sk.background('#7dd3fc');
      sk.noStroke();
      for (let i = 0; i < 7; i++) {
        sk.fill(255, 255, 255, 145);
        sk.ellipse(i * 260 + 120, 110 + (i % 2) * 42, 180, 64);
      }
    }

    function drawSplatters() {
      for (let i = splatters.length - 1; i >= 0; i--) {
        const splatter = splatters[i];
        const age = sk.millis() - splatter.bornAt;
        const alpha = sk.map(age, 0, 2400, 220, 0);
        if (alpha <= 0) {
          splatters.splice(i, 1);
          continue;
        }
        sk.fill(101, 67, 33, alpha);
        sk.noStroke();
        sk.ellipse(splatter.x, splatter.y, splatter.size, splatter.size * 0.8);
        sk.ellipse(splatter.x + 20, splatter.y - 10, splatter.size * 0.6, splatter.size * 0.6);
      }
    }

    function drawDistanceWarning() {
      if (warningAlpha <= 0) return;

      sk.noStroke();
      sk.fill(255, 0, 0, warningAlpha * 0.25);
      sk.rect(0, 0, sk.width, sk.height);
      sk.fill(255, 255, 255, warningAlpha);
      sk.stroke(200, 0, 0, warningAlpha);
      sk.strokeWeight(3);
      sk.textAlign(sk.CENTER, sk.CENTER);
      sk.textSize(sk.min(sk.width, sk.height) * 0.045);
      sk.text('⚠ 너무 가까워요! 뒤로 이동해주세요', sk.width / 2, sk.height * 0.13);
      sk.noStroke();
    }

    function drawLoadingScreen() {
      sk.background(30);
      sk.fill(255);
      sk.textAlign(sk.CENTER, sk.CENTER);
      sk.textSize(32);
      sk.text('AI 카메라 시스템 로딩 중...', sk.width / 2, sk.height / 2 - 20);
      sk.textSize(18);
      sk.fill(170);
      sk.text('FaceMesh + 누끼 모델을 준비하고 있어요.', sk.width / 2, sk.height / 2 + 30);
      sk.fill(100, 255, 100);
      sk.textSize(16);
      sk.text(`(${modelsLoaded}/2 모델 로드 완료)`, sk.width / 2, sk.height / 2 + 62);
    }

    function drawCalibrateScreen() {
      sk.background(35);

      if (videoHD && videoHD.elt.readyState >= 2) {
        sk.push();
        sk.tint(255, 60);
        sk.translate(sk.width, 0);
        sk.scale(-1, 1);
        sk.image(videoHD, 0, 0, sk.width, sk.height);
        sk.pop();
        sk.noTint();
      }

      if (predictions.length > 0) {
        const face = predictions[0];
        player.update(face.scaledMesh || face.keypoints || face.landmarks);
      }

      player.show('CALIBRATE');

      const targetFaceWidth = sk.width / 8;
      const guideW = targetFaceWidth;
      const guideH = targetFaceWidth * 1.4;
      const sizeOk = player.faceScreenWidth > 0 &&
        sk.abs(player.faceScreenWidth - targetFaceWidth) < targetFaceWidth * 0.35;
      const posOk = sk.dist(player.x, player.y, guideX, guideY) < guideW * 0.8;
      const aligned = sizeOk && posOk && predictions.length > 0;

      calibrationTimer = aligned ? calibrationTimer + sk.deltaTime : 0;

      if (calibrationTimer >= 3000) {
        baseFaceScreenWidth = player.faceScreenWidth;
        warningAlpha = 0;
        gameState = 'PLAYING';
        score = 0;
        lives = 3;
        items = [];
        splatters = [];
        startedAt = sk.millis();
        calibrationTimer = 0;
        updateHud();
        return;
      }

      sk.rectMode(sk.CENTER);
      sk.noFill();
      sk.strokeWeight(4);
      sk.stroke(aligned ? sk.color(0, 255, 100) : sk.color(255, 255, 0, 190));
      sk.rect(guideX, guideY, guideW, guideH, 20);
      sk.rectMode(sk.CORNER);

      sk.noStroke();
      sk.fill(255);
      sk.textAlign(sk.CENTER, sk.CENTER);

      if (aligned) {
        const countdown = sk.max(0, sk.ceil((3000 - calibrationTimer) / 1000));
        sk.textSize(56);
        sk.fill(0, 255, 100);
        sk.text(countdown, guideX, guideY - guideH / 2 - 50);
        sk.textSize(20);
        sk.fill(220, 255, 220);
        sk.text('좋아요! 그대로 유지하세요', sk.width / 2, sk.height - 92);

        const progress = sk.constrain(calibrationTimer / 3000, 0, 1);
        sk.noStroke();
        sk.fill(50, 50, 50, 150);
        sk.rect(sk.width / 2 - 150, sk.height - 58, 300, 12, 6);
        sk.fill(0, 255, 100);
        sk.rect(sk.width / 2 - 150, sk.height - 58, 300 * progress, 12, 6);
      } else {
        sk.textSize(26);
        sk.fill(255);
        sk.text('얼굴을 가이드 안에 맞춰주세요', sk.width / 2, sk.height - 112);
        sk.textSize(16);
        sk.fill(190);
        sk.text(predictions.length === 0 ? '얼굴이 감지되지 않습니다' : '박스 중앙에서 적당한 거리를 유지해주세요', sk.width / 2, sk.height - 76);
      }
    }

    function flashHit() {
      const flash = document.getElementById('hit-flash');
      if (!flash) return;
      flash.style.display = 'block';
      setTimeout(() => {
        flash.style.display = 'none';
      }, 360);
    }

    function updateHud() {
      const elapsed = startedAt ? sk.millis() - startedAt : 0;
      onHudUpdate({ score, lives, elapsed });
    }

    function checkFinish() {
      const elapsed = startedAt ? sk.millis() - startedAt : 0;

      if (lives <= 0) {
        onFinish({ cleared: false, score, lives, survivalTime: elapsed });
        sk.noLoop();
        return;
      }

      if (mode === 'stage') {
        const goalScore = (STAGES[selectedStage].goal || 5) * 10;
        if (score >= goalScore) {
          onFinish({ cleared: true, score, lives, survivalTime: elapsed, stage: selectedStage });
          sk.noLoop();
        }
      }
    }

    sk.windowResized = () => {
      sk.resizeCanvas(window.innerWidth, window.innerHeight);
      guideX = sk.width / 2;
      guideY = sk.height * 0.75;
    };

    sk.disposeHDFaceGame = () => {
      disposed = true;
      [videoHD, videoAI].forEach(video => {
        if (!video || !video.elt || !video.elt.srcObject) return;
        video.elt.srcObject.getTracks().forEach(track => track.stop());
      });
      if (selfieSegmentation && selfieSegmentation.close) {
        selfieSegmentation.close();
      }
    };
  };

  p5Instance = new p5(sketch);
  return p5Instance;
};
