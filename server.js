const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// 현재 선택된 역할 상태를 저장하는 객체
let roles = {
  PIGEON: null, // 비둘기를 선택한 유저의 socket.id
  TARGET: null  // 사람을 선택한 유저의 socket.id
};

// 현재 역할 선택 가능 상태를 모든 유저에게 방송
function broadcastRoles() {
  io.emit('roleStatus', {
    pigeonTaken: roles.PIGEON !== null,
    targetTaken: roles.TARGET !== null
  });
}

io.on('connection', (socket) => {
  console.log('유저 접속:', socket.id);

  // 접속하자마자 현재 남은 역할 현황을 알려줌
  socket.emit('roleStatus', {
    pigeonTaken: roles.PIGEON !== null,
    targetTaken: roles.TARGET !== null
  });

  // 유저가 역할을 선택했을 때
  socket.on('selectRole', (role) => {
    if (role === 'PIGEON' && !roles.PIGEON) {
      roles.PIGEON = socket.id;
      socket.emit('roleAssigned', 'PIGEON');
    } else if (role === 'TARGET' && !roles.TARGET) {
      roles.TARGET = socket.id;
      socket.emit('roleAssigned', 'TARGET');
    }
    
    broadcastRoles();

    // 두 역할이 모두 선택되었다면 게임 시작(Ready) 신호 전송
    if (roles.PIGEON && roles.TARGET) {
      io.emit('gameReady');
    }
  });

  // 게임 데이터 실시간 중계
  socket.on('hostSync', (state) => socket.broadcast.emit('gameStateUpdate', state));
  socket.on('targetSync', (data) => socket.broadcast.emit('targetDataUpdate', data));
  socket.on('faceImageSync', (base64) => socket.broadcast.emit('faceImageSync', base64));
  
  // 게임 종료 (승패 결정) 이벤트 중계
  socket.on('gameOverTrigger', (result) => io.emit('gameOverSync', result));

  // 유저가 나갔을 때 역할 초기화 및 남은 상대방 대기실로 이동
  socket.on('disconnect', () => {
    let roleLost = false;
    if (roles.PIGEON === socket.id) { roles.PIGEON = null; roleLost = true; }
    if (roles.TARGET === socket.id) { roles.TARGET = null; roleLost = true; }
    
    console.log('유저 퇴장:', socket.id);
    
    if (roleLost) {
      broadcastRoles();
      io.emit('opponentLeft'); // 남은 유저에게 상대방이 나갔음을 알림
    }
  });
});

const PORT = 3000;
http.listen(PORT, () => {
  console.log(`서버가 열렸습니다! http://localhost:${PORT}`);
});