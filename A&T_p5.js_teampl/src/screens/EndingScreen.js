window.EndingScreen = {
  init() {
    const screen = document.getElementById('ending-screen');

    screen.innerHTML = `
      <div class="ui-screen bg-dark ui-scroll">
        <div class="stars-bg"></div>
        <main class="credits-card">
          <div class="title-stack">
            <div style="font-size:clamp(48px,8vw,72px);">🏆 🎉 🏆</div>
            <h1 class="section-title" style="color:#fde68a; margin-top:12px;">감사합니다!</h1>
            <p class="support-copy">게임을 플레이해주셔서 감사합니다</p>
          </div>

          <section class="panel" style="margin:28px 0; padding:28px; background:rgba(255,255,255,.14); color:white;">
            <h2 style="font-family:'Jua'; font-size:42px; color:#93c5fd;">CREDITS</h2>
            <div class="credits-grid">
              <div class="credit-box">
                <h3>📋 기획</h3>
                <p>카메라 인터랙션 구상</p>
                <p>스토리보드 작성</p>
                <p>게임 컨셉 작성</p>
              </div>
              <div class="credit-box">
                <h3>💻 개발</h3>
                <p>게임 로직 & 스테이지 모드</p>
                <p>로컬 경쟁 모드 기록</p>
                <p>ml5.js FaceMesh 구현</p>
              </div>
              <div class="credit-box">
                <h3>🎨 디자인</h3>
                <p>피그마 기반 화면 구성</p>
                <p>로그인 & 순위표 화면</p>
                <p>게임 오브젝트 & 배경</p>
              </div>
            </div>
            <div style="border-top:1px solid rgba(255,255,255,.22); padding-top:20px;">
              <strong style="font-size:22px; color:#fdba74;">Interactive Media Game Project</strong>
              <div style="margin-top:6px; opacity:.8;">PIGEON ATTACK! · 2026년 5월</div>
            </div>
          </section>

          <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
            <button id="ending-home-btn" class="btn btn-primary">🎮 다시 시작</button>
            <button id="ending-intro-btn" class="btn btn-muted">처음으로</button>
          </div>
        </main>
      </div>
    `;

    const stars = screen.querySelector('.stars-bg');
    for (let i = 0; i < 90; i++) {
      const star = document.createElement('div');
      const size = 2 + Math.random() * 3;
      star.style.width = `${size}px`;
      star.style.height = `${size}px`;
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.animationDelay = `${Math.random() * 3}s`;
      stars.appendChild(star);
    }

    document.getElementById('ending-home-btn').onclick = () => {
      MainScreen.init();
      showScreen('main-screen');
    };
    document.getElementById('ending-intro-btn').onclick = () => {
      IntroScreen.init();
      showScreen('intro-screen');
    };
  }
};
