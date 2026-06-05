window.LeaderboardScreen = {
  async init() {
    const screen = document.getElementById('leaderboard-screen');
    const docs = await getLeaderboard();
    const topThree = docs.slice(0, 3);
    const others = docs.slice(3);

    const podiumCard = (rank, item, cls, icon) => `
      <div class="podium-card rank-${rank} ${cls || ''}">
        <div class="rank-icon">${icon}</div>
        <div style="font-family:'Jua'; font-size:34px;">${rank}위</div>
        <div class="rank-name">${item ? item.displayName : '-'}</div>
        <div class="rank-time">
          <div>${item ? item.score : 0}점 🥚</div>
          <div style="font-size:14px; margin-top:4px;">
            ⏱ ${formatTime(item ? item.survivalTime : 0)}
          </div>
        </div>
      </div>
    `;

    const rows = others.map((d, i) => `
      <div class="lb-row ${APP.displayName === d.displayName ? 'me' : ''}">
        <div class="lb-rank">#${i + 4}</div>
        <div class="lb-name">${d.displayName}</div>

        <div class="lb-time">
          
          <!-- 점수 먼저 (강조) -->
          <div style="font-size:14px; font-weight:900;">
            ${d.score}점 🥚
          </div>

          <!-- 시간은 보조 -->
          <div style="font-size:12px; color:#64748b; margin-top:2px;">
            ⏱ ${formatTime(d.survivalTime)}
          </div>

        </div>
      </div>
    `).join('');

    screen.innerHTML = `
      <div class="ui-screen bg-rank ui-scroll">
        <div class="bg-clouds">
          <div class="bg-cloud" style="top:8%; left:10%;">⭐</div>
          <div class="bg-cloud" style="top:18%; right:12%; animation-delay:1s;">⭐</div>
          <div class="bg-cloud" style="bottom:12%; left:32%; animation-delay:2s;">⭐</div>
        </div>
        <main class="rank-wrap">
          <div class="title-stack" style="width:100%; text-align:center;">
            <h1 class="section-title" style="color:#fde68a;">
              🏆 순위표 🏆
            </h1>

            <p class="support-copy">
              경쟁 모드 최고 기록
            </p>
          </div>

          <section class="podium">
            ${podiumCard(2, topThree[1], '', '🥈')}
            ${podiumCard(1, topThree[0], '', '👑')}
            ${podiumCard(3, topThree[2], '', '🥉')}
          </section>

          <section class="lb-list">
            ${rows || '<p style="text-align:center; padding:18px; font-weight:900;">아직 추가 기록이 없습니다.</p>'}
          </section>

          <div style="display:flex; gap:12px; margin-top:22px; flex-wrap:wrap; justify-content:center;">
            <button id="leaderboard-back" class="btn btn-muted">메인으로</button>
            <button id="leaderboard-ending" class="btn btn-danger">종료</button>
          </div>
        </main>
      </div>
    `;

    document.getElementById('leaderboard-back').onclick = () => {
      MainScreen.init();
      showScreen('main-screen');
    };
    document.getElementById('leaderboard-ending').onclick = () => {
      EndingScreen.init();
      showScreen('ending-screen');
    };
  }
};
