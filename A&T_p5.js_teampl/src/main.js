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

// TODO: Firebase 콘솔에서 복사한 웹 앱 config로 바꿔주세요.
const firebaseConfig = {
  apiKey: "AIzaSyDkyVCuogtpjKY_BnAbaS1QG_CeDyBMrOc",
  authDomain: "pigeon-attack-game.firebaseapp.com",
  projectId: "pigeon-attack-game",
  storageBucket: "pigeon-attack-game.firebasestorage.app",
  messagingSenderId: "865578195094",
  appId: "1:865578195094:web:5ef6c87bbe69f17f90cab7",
  measurementId: "G-PKZ7KR74GS"
};

const LOCAL_USER_KEY = 'pigeonAttackUser';
const LOCAL_LEADERBOARD_KEY = 'pigeonAttackLeaderboard';

window.firebaseReady = false;

window.initFirebase = function() {
  if (window.firebaseReady) return;
  if (!window.firebase || !firebase.auth) return;

  firebase.initializeApp(firebaseConfig);
  window.firebaseReady = true;

  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      APP.currentUser = null;
      APP.displayName = null;
      if (typeof window.updateMainLoginBtn === 'function') window.updateMainLoginBtn();
      return;
    }

    const displayName = user.displayName || user.email?.split('@')[0] || 'Player';
    APP.currentUser = {
      uid: user.uid,
      email: user.email,
      displayName,
      photoURL: user.photoURL,
    };
    APP.displayName = displayName;
    if (typeof window.updateMainLoginBtn === 'function') window.updateMainLoginBtn();
  });
};

window.ensureFirebase = function() {
  if (!window.firebaseReady && window.firebase && firebase.auth) {
    window.initFirebase();
  }
};

window.MockAuth = {
  load() {
    window.ensureFirebase();
    if (window.firebaseReady) {
      return;
    }

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
  async signIn(displayName) {
    const nickname = displayName?.trim() || '';
    window.ensureFirebase();

    if (window.firebaseReady) {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await firebase.auth().signInWithPopup(provider);
      const user = result.user;
      const name = nickname || user.displayName || user.email?.split('@')[0] || 'Player';
      APP.currentUser = {
        uid: user.uid,
        email: user.email,
        displayName: name,
        photoURL: user.photoURL,
      };
      APP.displayName = name;
      if (typeof window.updateMainLoginBtn === 'function') window.updateMainLoginBtn();
      return APP.currentUser;
    }

    const user = {
      uid: `local_${Date.now()}`,
      displayName: nickname || 'Guest',
    };
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
    APP.currentUser = user;
    APP.displayName = user.displayName;
    if (typeof window.updateMainLoginBtn === 'function') window.updateMainLoginBtn();
    return user;
  },
  async signOut() {
    window.ensureFirebase();
    if (window.firebaseReady) {
      try {
        await firebase.auth().signOut();
      } catch (e) {
        console.warn('Firebase sign out failed', e);
      }
    } else {
      localStorage.removeItem(LOCAL_USER_KEY);
    }
    APP.currentUser = null;
    APP.displayName = null;
    if (typeof window.updateMainLoginBtn === 'function') window.updateMainLoginBtn();
  }
};

window.MockLeaderboard = {

  async all() {

    if (!window.firebaseReady) return [];

    const snapshot = await firebase
      .firestore()
      .collection("leaderboard")
      .orderBy("survivalTime", "desc")
      .limit(20)
      .get();

    return snapshot.docs.map(doc => doc.data());
  },

  async add(record) {

    if (!window.firebaseReady) return;

    await firebase
      .firestore()
      .collection("leaderboard")
      .add({
        displayName: record.displayName,
        score: record.score,
        survivalTime: record.survivalTime,
        createdAt: Date.now()
      });
  }
};

window.saveScoreToFirebase = async function(result) {
  try {
    const uid = APP.currentUser.uid;

    const docRef = firebase.firestore()
      .collection("leaderboard")
      .doc(uid);

    const doc = await docRef.get();

    // 기존 기록 확인
    if (doc.exists) {
      const oldData = doc.data();

      // 기존 기록보다 짧으면 저장 안 함
      if ((oldData.score || 0) >= result.score) {
        return;
      }
    }

    await docRef.set({
      uid,
      displayName: result.displayName,
      score: result.score,
      survivalTime: result.survivalTime,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log("최고 기록 저장 완료");

  } catch (err) {
    console.error("점수 저장 실패", err);
  }
};

window.getLeaderboard = async function() {
  try {
    const snapshot = await firebase.firestore()
      .collection("leaderboard")
      .orderBy("score", "desc")
      .limit(20)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

  } catch(err) {
    console.error(err);
    return [];
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
    if (typeof window.APP.p5Instance.disposeHDFaceGame === 'function') {
      window.APP.p5Instance.disposeHDFaceGame();
    }
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

window.saveScoreToFirebase = async function(result) {
  try {
    if (!window.firebaseReady || !APP.currentUser) return;

    await firebase.firestore()
      .collection("leaderboard")
      .add({
        uid: APP.currentUser.uid,
        displayName: APP.displayName || "Player",
        score: result.score || 0,
        survivalTime: result.survivalTime || 0,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

    console.log("점수 저장 완료");
  } catch(err) {
    console.error("점수 저장 실패", err);
  }
};