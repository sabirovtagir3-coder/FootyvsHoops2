import * as THREE from 'three';

export function renderArena(scene, mode) {
  // Удаляем старую сцену
  const toRemove = [];
  scene.traverse(o => { if (o.userData.isEnv) toRemove.push(o); });
  toRemove.forEach(o => scene.remove(o));

  const root = new THREE.Group();
  root.userData.isEnv = true;
  const w = 36, d = 24;

  if (mode === 'football') {
    // ⚽️ Футбольный стадион
    const pitch = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ color: 0x1d7c34, roughness: 0.8 })
    );
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    root.add(pitch);

    // Разметка поля
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const midLine = new THREE.Mesh(new THREE.PlaneGeometry(0.15, d), lineMat);
    midLine.rotation.x = -Math.PI / 2;
    midLine.position.y = 0.02;
    root.add(midLine);

    // Ворота
    root.add(buildGoal(-w / 2, 0x00d2ff));
    root.add(buildGoal(w / 2, 0xff3366, true));

  } else {
    // 🏀 Баскетбольная арена
    const court = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ color: 0xba6024, roughness: 0.4 })
    );
    court.rotation.x = -Math.PI / 2;
    court.receiveShadow = true;
    root.add(court);

    // Кольца с щитами
    root.add(buildHoop(-w / 2 + 2, 0x00d2ff));
    root.add(buildHoop(w / 2 - 2, 0xff3366, true));
  }

  // Ограждающие барьеры вокруг поля
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0x111622 });
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 1, 0.5), barrierMat);
  b1.position.set(0, 0.5, d / 2);
  const b2 = b1.clone();
  b2.position.set(0, 0.5, -d / 2);
  root.add(b1, b2);

  scene.add(root);
}

function buildGoal(x, color, isRot) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color });
  const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3), mat);
  p1.position.set(0, 1.5, -3);
  const p2 = p1.clone();
  p2.position.set(0, 1.5, 3);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6.2), mat);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(0, 3, 0);
  g.add(p1, p2, bar);
  g.position.x = x;
  if (isRot) g.rotation.y = Math.PI;
  return g;
}

function buildHoop(x, color, isRot) {
  const h = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 4.5), new THREE.MeshStandardMaterial({ color }));
  pole.position.set(0, 2.25, 0);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 2.4), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  board.position.set(0.6, 4, 0);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 8, 24), new THREE.MeshBasicMaterial({ color: 0xff3300 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(1.3, 3.6, 0);
  h.add(pole, board, rim);
  h.position.x = x;
  if (isRot) h.rotation.y = Math.PI;
  return h;
}