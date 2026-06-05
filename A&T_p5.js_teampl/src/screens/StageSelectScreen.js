window.StageSelectScreen = {
  init() {
    const screen = document.getElementById('stage-select-screen');

    const getClass = (stage) => {
      if (stage <= 2) return 'stage-easy';
      if (stage <= 4) return 'stage-mid';
      if (stage <= 6) return 'stage-hard';
      return 'stage-boss';
    };

    let cards = '';
    for (let i = 1; i <= STAGE_COUNT; i++) {
      const stage = STAGES[i];
      cards += `
        <button class="stage-card ${getClass(i)}" data-stage="${i}">
          <h3>Stage ${i}</h3>
          <div class="stage-stars">${'⭐'.repeat(Math.min(i, 5))}</div>
          <div class="stage-stat">목표: ${stage.goal}개 🥚</div>
          <div class="stage-stat">비둘기: ${stage.pigeons}마리 🐦</div>
          ${stage.hasBoss ? '<div class="stage-stat" style="background:rgba(220,38,38,.78);">⚠️ 보스 등장</div>' : ''}
        </button>
      `;
    }

    screen.innerHTML = `
      <div class="ui-screen bg-purple">
        <div class="bg-clouds">
          <div class="bg-cloud" style="top:12%; left:10%;">🎯</div>
          <div class="bg-cloud" style="bottom:12%; right:12%; animation-delay:1s;">🏆</div>
        </div>
        <main class="stage-wrap">
          <div class="title-stack">
            <div class="big-icon" style="font-size:58px;">🎯</div>
            <h1 class="section-title" style="color:#fde68a;">스테이지 선택</h1>
            <p class="support-copy">원하는 레벨을 선택하세요</p>
          </div>
          <section class="stage-grid">${cards}</section>
          <button id="stage-back-btn" class="btn btn-muted">뒤로가기</button>
        </main>
        <div id="stage-confirm" style="display:none;"></div>
      </div>
    `;

    document.querySelectorAll('.stage-card').forEach(card => {
      card.onclick = () => {
        const stageNum = Number(card.dataset.stage);
        const confirm = document.getElementById('stage-confirm');
        confirm.style.display = 'flex';
        confirm.className = 'modal-shade';
        confirm.innerHTML = `
          <div class="modal-card">
            <div style="font-size:52px; margin-bottom:8px;">ℹ️</div>
            <h2>안내</h2>
            <p>스테이지 모드는 순위표에 기록되지 않습니다.<br/>Stage ${stageNum}을 시작할까요?</p>
            <div class="modal-actions">
              <button id="stage-cancel" class="btn btn-muted">취소</button>
              <button id="stage-start" class="btn btn-green">시작하기</button>
            </div>
          </div>
        `;
        document.getElementById('stage-cancel').onclick = () => confirm.style.display = 'none';
        document.getElementById('stage-start').onclick = () => {
          APP.selectedStage = stageNum;
          LoadingScreen.init(() => {
            showScreen('game-screen');
            GameScreen.init();
          });
          showScreen('loading-screen');
        };
      };
    });

    document.getElementById('stage-back-btn').onclick = () => {
      MainScreen.init();
      showScreen('main-screen');
    };
  }
};
