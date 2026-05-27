// ── main.js — 화면 라우터 & 전역 상태 ──────────────

window.APP = {
  currentUser: null,
  displayName: null,
  mode: null,          // 'stage' | 'competitive'
  selectedStage: 1,
  lastResult: null,
  p5Instance: null,
  faceMesh: null,
  video: null,
  paused:false,
};

const LOCAL_USER_KEY = 'pigeonAttackUser';
const LOCAL_LEADERBOARD_KEY = 'pigeonAttackLeaderboard';

window.MockAuth = {
  load() {
    try {
      const user = JSON.parse(localStorage.getItem(LOCAL_USER_KEY) || 'null');
      if (user) {
        APP.currentUser = user;
        APP.displayName = user.displayName;
      }
    } catch(e) {
      console.warn('local auth load failed', e);
    }
  },
  signIn(displayName) {
    const user = {
      uid: `local_${Date.now()}`,
      displayName,
    };
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
    APP.currentUser = user;
    APP.displayName = displayName;
    if (typeof window.updateMainLoginBtn === 'function') window.updateMainLoginBtn();
    return user;
  },
  signOut() {
    localStorage.removeItem(LOCAL_USER_KEY);
    APP.currentUser = null;
    APP.displayName = null;
    if (typeof window.updateMainLoginBtn === 'function') window.updateMainLoginBtn();
  }
};

window.MockLeaderboard = {
  defaults: [
    { displayName:'김철수', survivalTime:456000, score:234, timestamp:1 },
    { displayName:'이영희', survivalTime:432000, score:198, timestamp:2 },
    { displayName:'박민수', survivalTime:398000, score:176, timestamp:3 },
    { displayName:'최지원', survivalTime:345000, score:145, timestamp:4 },
    { displayName:'정수진', survivalTime:321000, score:132, timestamp:5 },
    { displayName:'강동현', survivalTime:298000, score:121, timestamp:6 },
    { displayName:'윤서아', survivalTime:276000, score:109, timestamp:7 },
    { displayName:'임태양', survivalTime:254000, score:98, timestamp:8 },
  ],
  all() {
    let records = [];
    try {
      records = JSON.parse(localStorage.getItem(LOCAL_LEADERBOARD_KEY) || '[]');
    } catch(e) {
      console.warn('local leaderboard load failed', e);
    }
    return [...records, ...this.defaults]
      .sort((a, b) => (b.survivalTime || 0) - (a.survivalTime || 0))
      .slice(0, 20);
  },
  add(record) {
    let records = [];
    try {
      records = JSON.parse(localStorage.getItem(LOCAL_LEADERBOARD_KEY) || '[]');
    } catch(e) {
      records = [];
    }
    records.push({ ...record, timestamp: Date.now() });
    localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(records));
  }
};

// ── showScreen ───────────────────────────────────────
window.showScreen = function(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.style.display = 'none';
    s.classList.remove('active');
  });
  const el = document.getElementById(id);
  if (el) { el.style.display = 'flex'; el.classList.add('active'); }

  // p5 인스턴스 정리
  if (window.APP.p5Instance) {
    window.APP.p5Instance.remove();
    window.APP.p5Instance = null;
  }
  // game HUD 숨기기
  const hud = document.getElementById('game-hud');
  if (hud) hud.style.display = 'none';
  const pauseOverlay = document.getElementById('pause-overlay');
  if (pauseOverlay) pauseOverlay.style.display = 'none';
  document.getElementById('boss-hp-bar') && (document.getElementById('boss-hp-bar').style.display = 'none');
};

// ── Modal ─────────────────────────────────────────────
window.showModal = function(msg, buttons) {
  document.getElementById('modal-msg').innerHTML = msg;
  const btnsEl = document.getElementById('modal-btns');
  btnsEl.innerHTML = '';
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'btn ' + (b.cls || 'btn-secondary');
    btn.textContent = b.label;
    btn.onclick = () => {
      document.getElementById('modal-overlay').style.display = 'none';
      b.cb && b.cb();
    };
    btnsEl.appendChild(btn);
  });
  document.getElementById('modal-overlay').style.display = 'flex';
};
window.closeModal = function() {
  document.getElementById('modal-overlay').style.display = 'none';
};

// ── Fullscreen ────────────────────────────────────────
window.enterFullscreen = function() {
  const el = document.documentElement;
  try {
    const request =
      el.requestFullscreen ? el.requestFullscreen() :
      el.webkitRequestFullscreen ? el.webkitRequestFullscreen() :
      el.mozRequestFullScreen ? el.mozRequestFullScreen() :
      null;
    if (request && typeof request.catch === 'function') {
      request.catch(err => console.warn('fullscreen denied', err));
    }
  } catch(e) { console.warn('fullscreen denied', e); }
};

// ── Utils ─────────────────────────────────────────────
window.formatTime = function(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
};

// ── 진입점 ────────────────────────────────────────────
function init() {
  MockAuth.load();

  // 게임 화면에 boss HP bar & hit flash 추가
  const gameScreen = document.getElementById('game-screen');
  if (!document.getElementById('boss-hp-bar')) {
    const hpBar = document.createElement('div');
    hpBar.id = 'boss-hp-bar';
    hpBar.innerHTML = `<div class="label">👑 보스 비둘기 킹</div>
      <div id="boss-hp-track"><div id="boss-hp-fill" style="width:100%"></div></div>`;
    gameScreen.appendChild(hpBar);
  }
  if (!document.getElementById('hit-flash')) {
    const flash = document.createElement('div');
    flash.id = 'hit-flash';
    gameScreen.appendChild(flash);
  }

  showScreen('intro-screen');
  IntroScreen.init();
}

document.addEventListener('DOMContentLoaded', init);
