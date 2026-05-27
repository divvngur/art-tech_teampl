window.LoginScreen = {
  init() {
    const screen = document.getElementById('login-screen');

    screen.innerHTML = `
      <div class="ui-screen bg-purple">
        <div class="bg-clouds">
          <div class="bg-cloud" style="top:14%; left:10%;">🕊️</div>
          <div class="bg-cloud" style="bottom:18%; right:12%; animation-delay:1s;">🕊️</div>
          <div class="bg-cloud" style="top:48%; left:24%; animation-delay:2s;">☁️</div>
        </div>

        <main class="panel form-card" style="position:relative; z-index:10;">
          <div style="text-align:center; margin-bottom:24px;">
            <div class="big-icon" style="font-size:56px;">🕊️</div>
            <h1 style="font-family:'Jua'; font-size:42px; margin-top:6px;">로그인</h1>
            <p class="hint" style="font-size:15px;">서버 연동 전까지 닉네임으로 로컬 로그인합니다.</p>
          </div>

          <div class="form-section">
            <label for="nickname-input">닉네임</label>
            <input id="nickname-input" class="input-field" maxlength="20" placeholder="예: 홍길동" />
            <p class="hint">순위표에 표시될 이름을 입력하세요.</p>
          </div>

          <div id="login-error" class="error-box" style="display:none; margin-top:14px;"></div>

          <div style="display:flex; flex-direction:column; gap:12px; margin-top:18px;">
            <button id="local-login-btn" class="btn btn-wide btn-primary">Google로 로그인</button>
            <button id="login-back-btn" class="btn btn-wide btn-muted">뒤로가기</button>
          </div>

          <p class="hint" style="text-align:center; margin-top:18px;">현재는 실제 Google 인증 대신 로컬 닉네임 로그인을 사용합니다.</p>
        </main>
      </div>
    `;

    const submit = () => {
      const nickname = document.getElementById('nickname-input').value.trim();
      const error = document.getElementById('login-error');

      if (!nickname) {
        error.textContent = '닉네임을 입력해주세요.';
        error.style.display = 'block';
        return;
      }

      MockAuth.signIn(nickname);
      MainScreen.init();
      showScreen('main-screen');
    };

    document.getElementById('local-login-btn').onclick = submit;
    document.getElementById('nickname-input').onkeydown = (event) => {
      if (event.key === 'Enter') submit();
    };
    document.getElementById('login-back-btn').onclick = () => {
      MainScreen.init();
      showScreen('main-screen');
    };
  }
};
