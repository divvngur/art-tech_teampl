window.GameScreen = {
  init() {
    if (window.bgm) {
  window.bgm.pause();
  window.bgm.currentTime = 0;
}
    const hud = document.getElementById('game-hud');
    hud.style.display = 'flex';

    const pauseOverlay = document.getElementById('pause-overlay');
    if (pauseOverlay) pauseOverlay.style.display = 'none';

    const finishGame = ({ cleared, score, lives, survivalTime, stage, quit = false }) => {
      /*
      if (APP.mode === 'competitive' && !quit) {
        MockLeaderboard.add({
          uid: APP.currentUser ? APP.currentUser.uid : 'guest',
          displayName: APP.displayName || 'Guest',
          score,
          survivalTime,
        });
      }
      */

      APP.lastResult = {
        cleared,
        score,
        hp: lives,
        survivalTime,
        mode: APP.mode,
        stage,
        quit,
      };

      ResultScreen.init();
      showScreen('result-screen');
    };

    if (window.bgm) {
  window.bgm.pause();
  window.bgm.currentTime = 0;
  window.bgm = null;
}

    APP.p5Instance = HDFaceGame({
      containerId: 'game-screen',
      mode: APP.mode,
      selectedStage: APP.selectedStage,
      onHudUpdate({ score, lives, elapsed }) {
        document.getElementById('hud-hearts').textContent =
          lives > 0 ? '❤️'.repeat(lives) : '🖤';
        document.getElementById('hud-center').textContent =
          `🥚 ${score}점 | ${formatTime(elapsed)}`;
      },
      onQuit(score, lives, survivalTime) {
        finishGame({
          cleared: false,
          score,
          lives,
          survivalTime,
          quit: true,
        });
      },
      onFinish(result) {
        finishGame(result);
      },
    });
  }
};
