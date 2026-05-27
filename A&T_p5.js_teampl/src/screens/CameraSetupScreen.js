window.CameraSetupScreen = {
  async init() {
    const screen = document.getElementById('camera-screen');

    screen.innerHTML = `
      <div class="ui-screen bg-camera">
        <button id="camera-back-btn" class="btn btn-muted" style="position:absolute; top:18px; left:18px; z-index:30;">← 뒤로가기</button>
        <div class="camera-layout">
          <main class="camera-panel">
            <div id="camera-container">
              <div class="camera-corner corner-tl"></div>
              <div class="camera-corner corner-tr"></div>
              <div class="camera-corner corner-bl"></div>
              <div class="camera-corner corner-br"></div>
            </div>
            <div id="camera-status" class="camera-status-card">카메라 준비 중...</div>
            <button id="camera-start-btn" class="btn btn-green btn-large">🎮 게임 시작하기</button>
          </main>
        </div>
      </div>
    `;

    const sketch = (sk) => {
      let videoEl = null;
      let cameraReady = false;
      let cameraError = '';
      let faceReady = false;

      sk.setup = () => {
        const canvas = sk.createCanvas(640, 480);
        canvas.parent('camera-container');

        setupCamera();
      };

      async function setupCamera() {
        try {
          if (!APP.cameraStream) {
            APP.cameraStream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
              },
              audio: false
            });
          }

          videoEl = APP.videoEl || document.createElement('video');
          videoEl.srcObject = APP.cameraStream;
          videoEl.muted = true;
          videoEl.autoplay = true;
          videoEl.playsInline = true;
          videoEl.width = 640;
          videoEl.height = 480;
          videoEl.style.display = 'none';

          if (!videoEl.parentNode) {
            document.body.appendChild(videoEl);
          }

          APP.videoEl = videoEl;
          APP.video = videoEl;

          await videoEl.play();
          cameraReady = true;

          FaceController.init(videoEl, sk, () => {
            faceReady = true;
            console.log('FaceMesh Ready');
          });
        } catch (err) {
          console.error(err);
          cameraError = '카메라를 열 수 없습니다. 브라우저 권한과 HTTPS/localhost 접속 여부를 확인해주세요.';
        }
      }

      sk.draw = () => {
        sk.background(0);

        if (cameraReady && videoEl && videoEl.readyState >= 2) {
          sk.push();
          sk.translate(sk.width, 0);
          sk.scale(-1, 1);
          sk.drawingContext.drawImage(videoEl, 0, 0, sk.width, sk.height);
          sk.pop();
        } else {
          sk.noStroke();
          sk.fill(255);
          sk.textAlign(sk.CENTER, sk.CENTER);
          sk.textSize(28);
          sk.text(cameraError || '카메라 준비 중...', sk.width / 2, sk.height / 2);
        }

        FaceController.update(sk);
        FaceController.drawDebug(sk);

        sk.noFill();
        sk.stroke(255);
        sk.strokeWeight(4);
        sk.rect(160, 80, 320, 320, 24);

        const ok = FaceController.isFaceInBox(160, 80, 320, 320);

        sk.noStroke();
        sk.fill(ok ? '#4CAF50' : '#FF6B6B');
        sk.textAlign(sk.CENTER);
        sk.textSize(28);
        sk.text(
          ok ? '얼굴 인식 완료' : (faceReady ? '얼굴을 중앙에 맞춰주세요' : '얼굴 인식 모델 준비 중...'),
          sk.width / 2,
          40
        );

        const status = document.getElementById('camera-status');
        if (status) {
          status.textContent = cameraError || (ok ? '완벽합니다! 이 자세를 유지하세요' : '얼굴을 화면 중앙에 맞춰주세요');
        }
      };
    };

    APP.p5Instance = new p5(sketch);

    document.getElementById('camera-start-btn').onclick = () => {
      showScreen('game-screen');
      GameScreen.init();
    };

    document.getElementById('camera-back-btn').onclick = () => {
      MainScreen.init();
      showScreen('main-screen');
    };
  }
};
