window.IntroScreen = {
  init() {
    const screen = document.getElementById('intro-screen');

    screen.innerHTML = `
      <div class="ui-screen bg-sky ui-scroll">
        <div class="bg-clouds">
          <div class="bg-cloud" style="top:12%; left:8%;">☁️</div>
          <div class="bg-cloud" style="top:27%; right:12%; animation-delay:1s;">☁️</div>
          <div class="bg-cloud" style="bottom:20%; left:24%; animation-delay:2s;">☁️</div>
        </div>
        <div class="bg-pigeons">
          <div class="fly-bird" style="top:15%;">🐦</div>
          <div class="fly-bird slow" style="top:36%;">🐦</div>
          <div class="fly-bird delay" style="top:58%;">🐦</div>
        </div>

        <main class="screen-center">
          <div class="title-stack">
            <div class="big-icon">🕊️</div>
            <h1 class="hero-title gradient-text">입벌려!</h1>
            <h2 class="hero-title" style="font-size:clamp(32px,6vw,56px);">비둘기 똥 들어간다~</h2>
            <p class="support-copy">PIGEON ATTACK!</p>
          </div>

          <section class="panel info-grid" aria-label="게임 방법">
            <div class="info-item">
              <span class="info-num">1</span>
              <div><strong>웹캠 허용</strong><p>카메라 권한을 허용하고 얼굴을 화면 중앙에 맞추세요.</p></div>
            </div>
            <div class="info-item">
              <span class="info-num">2</span>
              <div><strong>입 벌려서 알 받기</strong><p>떨어지는 알을 입으로 받으면 점수가 올라갑니다.</p></div>
            </div>
            <div class="info-item">
              <span class="info-num">3</span>
              <div><strong>위험한 투사체 피하기</strong><p>맞으면 하트가 줄어드니 얼굴을 잘 움직이세요.</p></div>
            </div>
            <div class="info-item">
              <span class="info-num">4</span>
              <div><strong>최고 점수 도전</strong><p>경쟁 모드 기록은 현재 이 브라우저에 저장됩니다.</p></div>
            </div>
          </section>

          <button id="intro-start" class="btn btn-primary btn-large">
            <span>🎮</span><span>시작하기</span>
          </button>

          <div class="panel" style="width:min(430px,100%); margin:18px auto 0; padding:14px 18px; background:rgba(15,23,42,.22); color:white;">
            <strong>Interactive Media Game Project</strong>
            <div style="font-size:14px; opacity:.86; margin-top:4px;">2026년 5월</div>
          </div>
        </main>
      </div>
    `;

    document.getElementById('intro-start').onclick = () => {
      enterFullscreen();
      MainScreen.init();
      showScreen('main-screen');
    };
  }
};
