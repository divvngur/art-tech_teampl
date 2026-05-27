window.LoadingScreen = {
  init(onComplete) {
    const screen = document.getElementById('loading-screen');
    const tips = [
      '알을 받으면 점수가 올라가요. 입을 크게 벌리세요.',
      '위험한 투사체를 맞으면 하트가 줄어듭니다.',
      '보스 스테이지에서는 특별한 공격 패턴이 나옵니다.',
      '카메라 앞에서 얼굴을 화면 중앙에 두면 인식이 더 안정적입니다.',
    ];
    const tip = tips[Math.floor(Math.random() * tips.length)];

    screen.innerHTML = `
      <div class="ui-screen bg-sky">
        <main class="loading-wrap">
          <div class="loading-bird" style="--progress:0%;">
            <span>🐦</span>
          </div>
          <h1 class="section-title" style="font-size:clamp(34px,6vw,58px); margin-bottom:18px;">Loading... <span id="loading-percent">0</span>%</h1>
          <div class="loading-track">
            <div id="loading-bar" class="loading-fill" style="width:0%;"></div>
          </div>
          <div class="tip-box">💡 ${tip}</div>
        </main>
      </div>
    `;

    let progress = 0;
    const interval = setInterval(() => {
      progress = Math.min(100, progress + 3);
      document.getElementById('loading-bar').style.width = `${progress}%`;
      document.querySelector('.loading-bird').style.setProperty('--progress', `${progress}%`);
      document.getElementById('loading-percent').textContent = Math.floor(progress);

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => onComplete && onComplete(), 350);
      }
    }, 45);
  }
};
