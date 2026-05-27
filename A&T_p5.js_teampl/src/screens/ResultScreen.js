window.ResultScreen = {
  init() {
    const screen = document.getElementById('result-screen');
    const result = APP.lastResult || {
      cleared: false,
      score: 0,
      survivalTime: 0,
      mode: APP.mode,
    };
    const isCleared = Boolean(result.cleared);
    const bgClass = isCleared ? 'bg-sky' : 'bg-dark';
    const title = isCleared ? 'STAGE CLEAR!' : (result.quit ? 'GAME ENDED' : 'GAME OVER');

    screen.innerHTML = `
      <div class="ui-screen ${bgClass}">
        <div class="confetti-bg" id="result-particles"></div>
        <main class="panel result-card" style="position:relative; z-index:10;">
          <div style="font-size:clamp(58px,10vw,86px);">
            ${isCleared ? '🎉 🏆 🎉' : '💀'}
          </div>
          <h1 class="result-title gradient-text">${title}</h1>
          <div class="result-stat">
            <span>🥚</span>
            <span>${result.score || 0}개</span>
          </div>
          ${result.mode === 'competitive' ? `
            <div style="font-size:24px; font-weight:900; margin-bottom:22px;">
              ⏱️ ${formatTime(result.survivalTime || 0)}
            </div>
          ` : ''}
          <div class="result-actions">
            <button id="result-retry" class="btn btn-green btn-wide">🔄 다시 하기</button>
            ${isCleared && APP.mode === 'stage' ? `
              <button id="result-next" class="btn btn-primary btn-wide">다음 스테이지</button>
            ` : ''}
            <div class="result-actions-row">
              <button id="result-main" class="btn btn-muted">🏠 메인으로</button>
              ${result.mode === 'competitive' ? `<button id="result-rank" class="btn btn-purple">🏅 순위표</button>` : ''}
            </div>
          </div>
        </main>
      </div>
    `;

    const particles = document.getElementById('result-particles');
    if (isCleared && particles) {
      for (let i = 0; i < 28; i++) {
        const el = document.createElement('div');
        el.textContent = ['🎉','🎊','⭐','✨','🏆'][Math.floor(Math.random() * 5)];
        el.style.position = 'absolute';
        el.style.left = `${Math.random() * 100}%`;
        el.style.top = `${Math.random() * 100}%`;
        el.style.fontSize = `${22 + Math.random() * 14}px`;
        el.style.animation = `float ${3 + Math.random() * 2}s ease-in-out infinite`;
        el.style.animationDelay = `${Math.random() * 2}s`;
        particles.appendChild(el);
      }
    }

    const startCurrentMode = () => {
      LoadingScreen.init(() => {
        showScreen('camera-screen');
        CameraSetupScreen.init();
      });
      showScreen('loading-screen');
    };

    document.getElementById('result-retry').onclick = () => {
      if (APP.mode === 'stage') {
        StageSelectScreen.init();
        showScreen('stage-select-screen');
      } else {
        startCurrentMode();
      }
    };

    const nextBtn = document.getElementById('result-next');
    if (nextBtn) {
      nextBtn.onclick = () => {
        APP.selectedStage++;
        if (APP.selectedStage > STAGE_COUNT) {
          EndingScreen.init();
          showScreen('ending-screen');
        } else {
          startCurrentMode();
        }
      };
    }

    document.getElementById('result-main').onclick = () => {
      MainScreen.init();
      showScreen('main-screen');
    };

    const rankBtn = document.getElementById('result-rank');
    if (rankBtn) {
      rankBtn.onclick = () => {
        LeaderboardScreen.init();
        showScreen('leaderboard-screen');
      };
    }
  }
};
