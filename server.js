const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let roles = {
  PIGEON: null,
  TARGET: null
};

let calibrated = {
  PIGEON: false,
  TARGET: false
};

function resetCalibration() {
  calibrated.PIGEON = false;
  calibrated.TARGET = false;
}

function clearAllRoles() {
  roles.PIGEON = null;
  roles.TARGET = null;
  for (const s of io.of('/').sockets.values()) {
    s.role = null;
  }
}

function broadcastRoles() {
  io.emit('roleStatus', {
    pigeonTaken: roles.PIGEON !== null,
    targetTaken: roles.TARGET !== null
  });
}

function broadcastCalibration() {
  io.emit('calibrationStatus', {
    PIGEON: calibrated.PIGEON,
    TARGET: calibrated.TARGET
  });
}

io.on('connection', (socket) => {
  console.log('유저 접속:', socket.id);

  socket.emit('roleStatus', {
    pigeonTaken: roles.PIGEON !== null,
    targetTaken: roles.TARGET !== null
  });
  socket.emit('calibrationStatus', {
    PIGEON: calibrated.PIGEON,
    TARGET: calibrated.TARGET
  });

  socket.on('selectRole', (role) => {
    if (socket.role) {
      socket.emit('roleAssigned', socket.role);
      return;
    }

    if (role !== 'PIGEON' && role !== 'TARGET') return;
    if (roles[role]) {
      broadcastRoles();
      return;
    }

    roles[role] = socket.id;
    socket.role = role;
    socket.emit('roleAssigned', role);

    broadcastRoles();

    if (roles.PIGEON && roles.TARGET) {
      resetCalibration();
      broadcastCalibration();
      io.emit('gameReady');
    }
  });

  socket.on('calibrationComplete', () => {
    const role = socket.role;
    if (!role) return;
    if (!roles.PIGEON || !roles.TARGET) return;

    calibrated[role] = true;
    console.log(`${role} 역할 인식 완료!`);
    broadcastCalibration();

    if (calibrated.PIGEON && calibrated.TARGET) {
      console.log('둘 다 인식 완료! 게임 동시 시작!');
      io.emit('gameStart');
    }
  });

  socket.on('restartToRoleSelection', () => {
    clearAllRoles();
    resetCalibration();
    broadcastRoles();
    broadcastCalibration();
    io.emit('goRoleSelection');
  });

  socket.on('hostSync', (state) => socket.broadcast.emit('gameStateUpdate', state));
  socket.on('targetSync', (data) => socket.broadcast.emit('targetDataUpdate', data));
  socket.on('faceImageSync', (base64) => socket.broadcast.emit('faceImageSync', base64));
  socket.on('gameOverTrigger', (result) => io.emit('gameOverSync', result));

  socket.on('disconnect', () => {
    let roleLost = false;

    if (roles.PIGEON === socket.id) {
      roles.PIGEON = null;
      roleLost = true;
    }
    if (roles.TARGET === socket.id) {
      roles.TARGET = null;
      roleLost = true;
    }

    console.log('유저 퇴장:', socket.id);

    if (roleLost) {
      resetCalibration();
      broadcastRoles();
      broadcastCalibration();
      io.emit('opponentLeft');
    }
  });
});

const PORT = 3000;
http.listen(PORT, () => {
  console.log(`서버가 열렸습니다! http://localhost:${PORT}`);
});
