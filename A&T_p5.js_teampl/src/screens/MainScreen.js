window.updateMainLoginBtn = function() {
  const area = document.getElementById('main-user-area');
  if (!area) return;

  if (APP.currentUser) {
    area.innerHTML = `
      <button id="main-user-btn" class="user-pill" title="로그아웃">
        <span class="user-avatar">${(APP.displayName || '?').slice(0, 1)}</span>
        <strong>${APP.displayName || 'Player'}</strong>
      </button>
    `;
    document.getElementById('main-user-btn').onclick = () => {
      showModal(
        `현재 로그인 상태입니다.<br/><b>${APP.displayName}</b>`,
        [
          { label:'로그아웃', cls:'btn-danger', cb:() => MockAuth.signOut() },
          { label:'닫기', cls:'btn-muted' }
        ]
      );
    };
  } else {
    area.innerHTML = `<button id="main-login-btn" class="btn btn-purple">로그인</button>`;
    document.getElementById('main-login-btn').onclick = () => {
      LoginScreen.init();
      showScreen('login-screen');
    };
  }
};

window.MainScreen = {
  init() {
    const screen = document.getElementById('main-screen');

    screen.innerHTML = `
      <div class="ui-screen bg-main">
        <div class="bg-clouds">
          <div class="bg-cloud" style="top:12%; left:8%;">☁️</div>
          <div class="bg-cloud" style="bottom:14%; right:8%; animation-delay:1.4s;">☁️</div>
        </div>

        <header class="top-header">
          <div class="brand-mark">
            <div class="brand-icon">🕊️</div>
            <div class="brand-title">
              <div style="font-size:22px;">PIGEON ATTACK!</div>
              <div style="font-size:12px; opacity:.9;">입벌려! 비둘기 똥 들어간다~</div>
            </div>
          </div>
          <div id="main-user-area"></div>
        </header>

        <button id="main-back" class="btn btn-muted bottom-back">← 처음으로</button>

        <main class="screen-center">
          <div class="title-stack">
            <div style="display:flex; justify-content:center; gap:22px; margin-bottom:20px;">
              <span class="big-icon" style="font-size:clamp(54px,9vw,82px);">🐦</span>
              <span class="big-icon" style="font-size:clamp(54px,9vw,82px); animation-delay:.4s;">💩</span>
              <span class="big-icon" style="font-size:clamp(54px,9vw,82px); animation-delay:.8s;">🥚</span>
            </div>
            <h1 class="section-title gradient-text">모드 선택</h1>
            <p class="support-copy">원하는 게임 모드를 선택하세요</p>
          </div>

          <section class="mode-grid">
            <button id="main-stage" class="mode-card mode-stage">
              <div class="mode-icon">🎯</div>
              <h3>스테이지 모드</h3>
              <p>단계별 도전</p>
              <span class="mode-pill">8개 레벨</span>
            </button>
            <button id="main-comp" class="mode-card mode-comp">
              <div class="mode-icon">🏆</div>
              <h3>경쟁 모드</h3>
              <p>최고 기록 도전</p>
              <span class="mode-pill">로컬 순위표 기록</span>
            </button>
          </section>

          <button id="main-rank" class="btn btn-muted" style="font-size:22px; padding:16px 42px;">
            <span>🏅</span><span>순위표 보기</span>
          </button>
        </main>

        <div id="login-warning" style="display:none;"></div>
      </div>
    `;

    updateMainLoginBtn();

    const startMode = (mode) => {
      APP.mode = mode;
      if (mode === 'stage') {
        StageSelectScreen.init();
        showScreen('stage-select-screen');
      } else {
        LoadingScreen.init(() => {
          showScreen('game-screen');
          GameScreen.init();
        });
        showScreen('loading-screen');
      }
    };

    const warnIfNeeded = (mode) => {
      if (APP.currentUser) {
        startMode(mode);
        return;
      }

      const warning = document.getElementById('login-warning');
      warning.style.display = 'flex';
      warning.className = 'modal-shade';
      warning.innerHTML = `
        <div class="modal-card">
          <div style="font-size:52px; margin-bottom:8px;">⚠️</div>
          <h2>알림</h2>
          <p>로그인하지 않으면 경쟁 기록이 계정에 연결되지 않습니다.<br/>현재 버전에서는 브라우저 로컬 기록으로만 저장됩니다.</p>
          <div class="modal-actions">
            <button id="warn-cancel" class="btn btn-muted">메인으로</button>
            <button id="warn-continue" class="btn btn-primary">계속 진행</button>
          </div>
        </div>
      `;
      document.getElementById('warn-cancel').onclick = () => warning.style.display = 'none';
      document.getElementById('warn-continue').onclick = () => startMode(mode);
    };

    document.getElementById('main-stage').onclick = () => startMode('stage');
    document.getElementById('main-comp').onclick = () => warnIfNeeded('competitive');
    document.getElementById('main-rank').onclick = () => {
      LeaderboardScreen.init();
      showScreen('leaderboard-screen');
    };
    document.getElementById('main-back').onclick = () => {
      IntroScreen.init();
      showScreen('intro-screen');
    };
  }
};
