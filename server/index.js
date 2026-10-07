import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// 1. База данных в памяти (Профили, Рейтинг, Глобальная битва)
const playersDB = new Map(); // id/username -> profile
const globalStats = {
  FOOTY: { wins: 0, points: 0, matches: 0 },
  HOOPS: { wins: 0, points: 0, matches: 0 }
};

// Очереди матчмейкинга
const queues = {
  football: [],
  basketball: []
};

// Активные комнаты матчей
const rooms = new Map();

function getOrCreateProfile(tgUser, chosenTeam) {
  const uid = tgUser?.id ? String(tgUser.id) : 'guest_' + Math.random().toString(36).substring(7);
  if (!playersDB.has(uid)) {
    playersDB.set(uid, {
      id: uid,
      username: tgUser?.username || tgUser?.first_name  (chosenTeam === 'FOOTY' ? 'FootyStriker' : 'HoopsBaller'),
      team: chosenTeam,
      rating: 1000,
      wins: 0,
      losses: 0,
      draws: 0,
      matches: 0,
      coins: 250,
      selectedSkin: 'default',
      referrals: 0
    });
  }
  return playersDB.get(uid);
}

io.on('connection', (socket) => {
  let playerProfile = null;
  let currentRoomId = null;

  // Авторизация / Регистрация
  socket.on('auth_player', ({ tgUser, team }) => {
    playerProfile = getOrCreateProfile(tgUser, team);
    if (team) playerProfile.team = team;
    socket.emit('auth_success', {
      profile: playerProfile,
      globalStats
    });
  });

  // Запрос лидерборда
  socket.on('get_leaderboard', () => {
    const list = Array.from(playersDB.values())
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 20);
    socket.emit('leaderboard_data', { list, globalStats });
  });

  // Поиск 1v1 соперника
  socket.on('find_match', ({ mode }) => {
    if (!playerProfile) return;
    
    // Исключаем из очередей, если уже искал
    queues.football = queues.football.filter(p => p.socket.id !== socket.id);
    queues.basketball = queues.basketball.filter(p => p.socket.id !== socket.id);

    const queue = queues[mode];
    // Ищем доступного реального игрока
    const opponentIdx = queue.findIndex(p => p.socket.id !== socket.id);

    if (opponentIdx !== -1) {
      const opp = queue.splice(opponentIdx, 1)[0];
      const roomId = 'room_' + socket.id + '_' + opp.socket.id;
      currentRoomId = roomId;
      opp.currentRoomId = roomId;

      socket.join(roomId);
      opp.socket.join(roomId);

      const room = {
        id: roomId,
        mode,
        state: 'countdown',
        duration: 90, // 90 секунд
        p1: {
          id: socket.id,
          uid: playerProfile.id,
          username: playerProfile.username,
          team: playerProfile.team,
          side: 'left',
          x: -8, z: 0, rotY: Math.PI / 2
        },
        p2: {
          id: opp.socket.id,
          uid: opp.profile.id,
          username: opp.profile.username,
          team: opp.profile.team,
          side: 'right',
          x: 8, z: 0, rotY: -Math.PI / 2
        },
        scores: { left: 0, right: 0 },
        ball: {
          x: 0, y: 0.5, z: 0,
          vx: 0, vy: 0, vz: 0,
          carrierId: null
        }
      };

      rooms.set(roomId, room);

      // Оповещаем обоих: Соперник найден
      io.to(roomId).emit('match_found', {
        roomId,
        mode,
        p1: room.p1,
        p2: room.p2
      });

      // Обратный отсчет 3, 2, 1, GO
      let cd = 3;
      const countTimer = setInterval(() => {
        if (!rooms.has(roomId)) {
          clearInterval(countTimer);
          return;
        }
        if (cd > 0) {
          io.to(roomId).emit('countdown_tick', cd);
          cd--;
        } else {
          clearInterval(countTimer);
          room.state = 'playing';
          io.to(roomId).emit('match_start');
        }
      }, 1000);

    } else {
      queue.push({ socket, profile: playerProfile, currentRoomId: null });
      socket.emit('matchmaking_waiting');
    }
  });
  socket.on('cancel_search', () => {
    queues.football = queues.football.filter(p => p.socket.id !== socket.id);
    queues.basketball = queues.basketball.filter(p => p.socket.id !== socket.id);
  });

  // Получение действий игрока (Server-Authoritative)
  socket.on('client_input', (input) => {
    if (!currentRoomId || !rooms.has(currentRoomId)) return;
    const room = rooms.get(currentRoomId);
    if (room.state !== 'playing') return;

    const p = room.p1.id === socket.id ? room.p1 : (room.p2.id === socket.id ? room.p2 : null);
    if (!p) return;

    const speed = input.turbo ? 9.5 : 6.0;
    p.x += input.dx * speed * 0.05;
    p.z += input.dz * speed * 0.05;

    // Границы игрового поля
    p.x = Math.max(-17, Math.min(17, p.x));
    p.z = Math.max(-11, Math.min(11, p.z));

    if (input.dx !== 0 || input.dz !== 0) {
      p.rotY = Math.atan2(input.dx, input.dz);
    }

    // Подбор мяча
    const ball = room.ball;
    const distToBall = Math.hypot(p.x - ball.x, p.z - ball.z);
    if (distToBall < 1.25 && !ball.carrierId) {
      ball.carrierId = socket.id;
    }

    // Удар / Бросок
    if (input.shoot && ball.carrierId === socket.id) {
      ball.carrierId = null;
      const fwdX = Math.sin(p.rotY);
      const fwdZ = Math.cos(p.rotY);

      if (room.mode === 'football') {
        ball.vx = fwdX * 24;
        ball.vz = fwdZ * 24;
        ball.vy = 2.0;
      } else {
        ball.vx = fwdX * 19;
        ball.vz = fwdZ * 19;
        ball.vy = 10.0; // Высокая параболическая траектория в кольцо
      }
    }
  });

  // Отключение игрока / Потеря соединения
  socket.on('disconnect', () => {
    queues.football = queues.football.filter(p => p.socket.id !== socket.id);
    queues.basketball = queues.basketball.filter(p => p.socket.id !== socket.id);

    if (currentRoomId && rooms.has(currentRoomId)) {
      io.to(currentRoomId).emit('opponent_disconnected');
      rooms.delete(currentRoomId);
    }
  });
});

// Серверный физический цикл: 20 тиков в секунду (50ms)
setInterval(() => {
  for (const [roomId, room] of rooms.entries()) {
    if (room.state !== 'playing') continue;

    // 1. Таймер (90 сек)
    room.duration -= 0.05;
    if (room.duration <= 0) {
      finishMatch(roomId, room);
      continue;
    }

    // 2. Физика мяча
    const b = room.ball;
    if (b.carrierId) {
      const carrier = room.p1.id === b.carrierId ? room.p1 : room.p2;
      if (carrier) {
        b.x = carrier.x + Math.sin(carrier.rotY) * 0.95;
        b.z = carrier.z + Math.cos(carrier.rotY) * 0.95;
        b.y = room.mode === 'basketball' ? 0.75 : 0.45;
        b.vx = 0; b.vy = 0; b.vz = 0;
      } else {
        b.carrierId = null;
      }
    } else {
      b.x += b.vx * 0.05;
      b.z += b.vz * 0.05;
      b.y += b.vy * 0.05;

      if (b.y > 0.45) {
        b.vy -= 18.0 * 0.05; // Гравитация
      } else {
        b.y = 0.45;
        b.vy = 0;
      }

      b.vx *= 0.97;
      b.vz *= 0.97;

      // Отскок от бортов поля
      if (Math.abs(b.x) > 17.5) { b.vx *= -0.7; b.x = Math.sign(b.x) * 17.4; }
      if (Math.abs(b.z) > 11.5) { b.vz *= -0.7; b.z = Math.sign(b.z) * 11.4; }

      // 3. Проверка взятия ворот / попадания в корзину
      let goalSide = null;
      if (room.mode === 'football') {
        if (b.x >= 17.2 && Math.abs(b.z) < 3.2 && b.y < 3.2) goalSide = 'left';
        else if (b.x <= -17.2 && Math.abs(b.z) < 3.2 && b.y < 3.2) goalSide = 'right';
      } else {
        // Баскетбол (2 очка при траектории падения сверху вниз)
        if (b.x >= 14.5 && b.x <= 17.5 && Math.abs(b.z) < 1.6 && b.y <= 3.8 && b.vy < 0) goalSide = 'left';
        else if (b.x <= -14.5 && b.x >= -17.5 && Math.abs(b.z) < 1.6 && b.y <= 3.8 && b.vy < 0) goalSide = 'right';
      }

      if (goalSide) {
        const pts = room.mode === 'football' ? 1 : 2;
        room.scores[goalSide] += pts;

        // Сброс мяча в центр
        b.x = 0; b.y = 0.5; b.z = 0;
        b.vx = 0; b.vy = 0; b.vz = 0;
        b.carrierId = null;
        // Сброс позиций игроков
        room.p1.x = -8; room.p1.z = 0; room.p1.rotY = Math.PI / 2;
        room.p2.x = 8; room.p2.z = 0; room.p2.rotY = -Math.PI / 2;

        io.to(roomId).emit('goal_celebration', {
          scores: room.scores,
          side: goalSide
        });
      }
    }

    // Рассылка синхронизации состояния обоим клиентам
    io.to(roomId).emit('sync_state', {
      p1: room.p1,
      p2: room.p2,
      ball: room.ball,
      scores: room.scores,
      timeLeft: Math.max(0, Math.ceil(room.duration))
    });
  }
}, 50);

// Завершение матча, подсчет рейтинга и очков
function finishMatch(roomId, room) {
  room.state = 'ended';
  const prof1 = playersDB.get(room.p1.uid);
  const prof2 = playersDB.get(room.p2.uid);

  let winnerSide = 'draw';
  if (room.scores.left > room.scores.right) winnerSide = 'left';
  else if (room.scores.right > room.scores.left) winnerSide = 'right';

  let winnerTeam = 'DRAW';
  if (winnerSide === 'left') {
    winnerTeam = room.p1.team;
    if (prof1) { prof1.rating += 25; prof1.wins += 1; prof1.coins += 50; }
    if (prof2) { prof2.rating = Math.max(800, prof2.rating - 20); prof2.losses += 1; prof2.coins += 10; }
  } else if (winnerSide === 'right') {
    winnerTeam = room.p2.team;
    if (prof2) { prof2.rating += 25; prof2.wins += 1; prof2.coins += 50; }
    if (prof1) { prof1.rating = Math.max(800, prof1.rating - 20); prof1.losses += 1; prof1.coins += 10; }
  } else {
    if (prof1) { prof1.draws += 1; prof1.rating += 5; prof1.coins += 20; }
    if (prof2) { prof2.draws += 1; prof2.rating += 5; prof2.coins += 20; }
  }

  if (prof1) prof1.matches += 1;
  if (prof2) prof2.matches += 1;

  // Обновление глобального противостояния фракций
  if (winnerTeam !== 'DRAW') {
    globalStats[winnerTeam].wins += 1;
    globalStats[winnerTeam].points += Math.max(room.scores.left, room.scores.right);
  }
  globalStats.FOOTY.matches += 1;
  globalStats.HOOPS.matches += 1;

  io.to(roomId).emit('match_result', {
    winnerTeam,
    winnerSide,
    scores: room.scores,
    globalStats
  });

  rooms.delete(roomId);
}

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log('Authoritative Real-Time PvP server started on port' + PORT);
});