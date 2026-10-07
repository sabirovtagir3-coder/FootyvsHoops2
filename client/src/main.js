import * as THREE from 'three';
import { NetworkService } from './network.js';
import { InputController } from './input.js';
import { renderArena } from './arena.js';
import { createHumanAthlete } from './models.js';

// Инициализация Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  if (tg.setHeaderColor) tg.setHeaderColor('#0b0e14');
  if (tg.setBackgroundColor) tg.setBackgroundColor('#0b0e14');
}

// Укажите адрес вашего сервера
const SERVER_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:4000'
  : 'https://ВАШ-БЭКЕНД.onrender.com';

const net = new NetworkService(SERVER_URL);
const input = new InputController();

// 3D Engine Setup
const canvas = document.getElementById('webgl-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0e17);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 18, 22);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const ambient = new THREE.AmbientLight(0xffffff, 0.9);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
dirLight.position.set(12, 22, 10);
scene.add(ambient, dirLight);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Локальное состояние
let userProfile = null;
let currentMode = 'football';
let mySide = 'left'; // 'left' | 'right'

let p1Mesh = null;
let p2Mesh = null;
let ballMesh = null;

// UI Элементы
const screenReg = document.getElementById('screen-register');
const screenLobby = document.getElementById('screen-lobby');
const screenMM = document.getElementById('screen-matchmaking');
const screenCD = document.getElementById('screen-countdown');
const hud = document.getElementById('hud');
const screenRes = document.getElementById('screen-result');
const touchUI = document.getElementById('touch-controls');

// Авторизация при старте
net.onAuthSuccess = ({ profile, globalStats }) => {
  userProfile = profile;
  updateLobbyUI(profile, globalStats);
  screenReg.classList.add('hidden');
  screenLobby.classList.remove('hidden');
};

function updateLobbyUI(p, g) {
  document.getElementById('user-name').textContent = p.username;
  document.getElementById('user-rating').textContent = p.rating;
  document.getElementById('user-coins').textContent = p.coins;
  document.getElementById('user-team-badge').textContent = (p.team === 'FOOTY' ? '⚽️' : '🏀') + p.team;

  const totalWins = g.FOOTY.wins + g.HOOPS.wins || 1;
  const footyPct = Math.round((g.FOOTY.wins / totalWins) * 100);
  document.getElementById('bar-footy').style.width = footyPct + '%';
  document.getElementById('bar-hoops').style.width = (100 - footyPct) + '%';
  document.getElementById('stat-footy-wins').textContent = g.FOOTY.wins;
  document.getElementById('stat-hoops-wins').textContent = g.HOOPS.wins;
}

// Выбор стороны (Регистрация)
document.getElementById('btn-side-footy').onclick = () => selectSide('FOOTY');
document.getElementById('btn-side-hoops').onclick = () => selectSide('HOOPS');

function selectSide(team) {
  net.auth(tg?.initDataUnsafe?.user, team);
}

// Запуск матчмейкинга
document.getElementById('btn-play-football').onclick = () => startMatch('football');
document.getElementById('btn-play-basketball').onclick = () => startMatch('basketball');

function startMatch(mode) {
  currentMode = mode;
  screenLobby.classList.add('hidden');
  screenMM.classList.remove('hidden');
  net.findMatch(mode);
}

document.getElementById('btn-cancel-mm').onclick = () => {
  net.cancelSearch();
  screenMM.classList.add('hidden');
  screenLobby.classList.remove('hidden');
};

// Сетевые события матча
net.onMatchFound = ({ mode, p1, p2 }) => {
  const myId = net.getSocketId();
  mySide = p1.id === myId ? 'left' : 'right';
  screenMM.classList.add('hidden');
  screenCD.classList.remove('hidden');

  document.getElementById('cd-p1-name').textContent = p1.username;
  document.getElementById('cd-p1-team').textContent = p1.team === 'FOOTY' ? '⚽️' : '🏀';
  document.getElementById('cd-p2-name').textContent = p2.username;
  document.getElementById('cd-p2-team').textContent = p2.team === 'FOOTY' ? '⚽️' : '🏀';

  document.getElementById('hud-name-left').textContent = p1.username;
  document.getElementById('hud-name-right').textContent = p2.username;
  document.getElementById('hud-mode-label').textContent = mode.toUpperCase() + '1v1';

  // Подготовка 3D арены
  renderArena(scene, mode);

  // Спавн 3D моделей
  if (p1Mesh) scene.remove(p1Mesh);
  if (p2Mesh) scene.remove(p2Mesh);
  if (ballMesh) scene.remove(ballMesh);

  p1Mesh = createHumanAthlete(p1.team);
  p2Mesh = createHumanAthlete(p2.team);
  scene.add(p1Mesh, p2Mesh);

  // Мяч
  const bGeo = new THREE.SphereGeometry(mode === 'football' ? 0.45 : 0.55, 16, 16);
  const bMat = new THREE.MeshStandardMaterial({ color: mode === 'football' ? 0xffffff : 0xec610e });
  ballMesh = new THREE.Mesh(bGeo, bMat);
  scene.add(ballMesh);

  // Настройка ракурса камеры (всегда лицом к чужим воротам)
  if (mySide === 'left') {
    camera.position.set(-18, 16, 0);
    camera.lookAt(18, 0, 0);
  } else {
    camera.position.set(18, 16, 0);
    camera.lookAt(-18, 0, 0);
  }
};

net.onCountdownTick = (num) => {
  document.getElementById('cd-number').textContent = num;
};

net.onMatchStart = () => {
  screenCD.classList.add('hidden');
  hud.classList.remove('hidden');
  touchUI.classList.remove('hidden');
};

// Получение синхронизации от сервера (Server-Authoritative)
net.onSyncState = ({ p1, p2, ball, scores, timeLeft }) => {
  if (p1Mesh) {
    p1Mesh.position.set(p1.x, 0, p1.z);
    p1Mesh.rotation.y = p1.rotY;
  }
  if (p2Mesh) {
    p2Mesh.position.set(p2.x, 0, p2.z);
    p2Mesh.rotation.y = p2.rotY;
  }
  if (ballMesh) {
    ballMesh.position.set(ball.x, ball.y, ball.z);
  }

  document.getElementById('hud-score-left').textContent = scores.left;
  document.getElementById('hud-score-right').textContent = scores.right;

  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  document.getElementById('hud-timer').textContent = '0' + m + ':' + (s < 10 ? '0' : '') + s;
};

// Завершение матча
net.onMatchResult = ({ winnerTeam, winnerSide, scores, globalStats }) => {
  hud.classList.add('hidden');
  touchUI.classList.add('hidden');
  screenRes.classList.remove('hidden');

  const verdict = document.getElementById('res-verdict');
  if (winnerSide === 'draw') {
    verdict.textContent = 'DRAW!';
    verdict.style.color = '#ffcc00';
  } else if (winnerSide === mySide) {
    verdict.textContent = 'VICTORY!';
    verdict.style.color = '#00ff88';
  } else {
    verdict.textContent = 'DEFEAT';
    verdict.style.color = '#ff3366';
  }

  document.getElementById('res-score').textContent = scores.left + '-' + scores.right;
  updateLobbyUI(userProfile, globalStats);
};

// Кнопки после матча
document.getElementById('btn-rematch').onclick = () => {
  screenRes.classList.add('hidden');
  startMatch(currentMode);
};
document.getElementById('btn-back-lobby').onclick = () => {
  screenRes.classList.add('hidden');
  screenLobby.classList.remove('hidden');
};

// Отправка ввода на сервер (20 раз в сек)
setInterval(() => {
  net.sendInput(input.dx, input.dz, input.turbo, input.shoot);
}, 50);

// Лидерборд & Модалки
document.getElementById('btn-tab-leaderboard').onclick = () => {
  net.fetchLeaderboard();
};
net.onLeaderboard = ({ list }) => {
  const tbody = document.getElementById('lb-rows');
  tbody.innerHTML = '';
  list.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>#' + (idx + 1) + '</td><td>' + item.username + '</td><td>' + item.team === 'FOOTY' ? '⚽️' : '🏀' + '</td><td>' + item.rating + '</td>';
    tbody.appendChild(tr);
  });
  document.getElementById('modal-leaderboard').classList.remove('hidden');
};
document.getElementById('btn-close-lb').onclick = () => document.getElementById('modal-leaderboard').classList.add('hidden');

// Профиль
document.getElementById('btn-tab-profile').onclick = () => {
  if (!userProfile) return;
  document.getElementById('prof-name').textContent = userProfile.username;
  document.getElementById('prof-team').textContent = (userProfile.team === 'FOOTY' ? '⚽️ FOOTY' : '🏀 HOOPS') + 'CHAMPION';
  document.getElementById('prof-rating').textContent = userProfile.rating;
  document.getElementById('prof-wins').textContent = userProfile.wins;
  document.getElementById('prof-losses').textContent = userProfile.losses;
  document.getElementById('prof-matches').textContent = userProfile.matches;
  document.getElementById('modal-profile').classList.remove('hidden');
};
document.getElementById('btn-close-prof').onclick = () => document.getElementById('modal-profile').classList.add('hidden');

// Магазин
document.getElementById('btn-tab-shop').onclick = () => document.getElementById('modal-shop').classList.remove('hidden');
document.getElementById('btn-close-shop').onclick = () => document.getElementById('modal-shop').classList.add('hidden');

// Анимационный цикл рендеринга
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();