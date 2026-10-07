import * as THREE from 'three';

export function createHumanAthlete(team) {
  const root = new THREE.Group();
  const jerseyColor = team === 'FOOTY' ? 0x00d2ff : 0xff8c00;

  const matJersey = new THREE.MeshStandardMaterial({ color: jerseyColor, roughness: 0.4 });
  const matSkin = new THREE.MeshStandardMaterial({ color: 0xf0c299, roughness: 0.6 });
  const matPants = new THREE.MeshStandardMaterial({ color: 0x171f30 });

  // Торс
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.45), matJersey);
  torso.position.y = 1.35;
  root.add(torso);

  // Голова
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 14), matSkin);
  head.position.y = 2.05;
  root.add(head);

  // Руки
  const armGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.65, 8);
  const armL = new THREE.Mesh(armGeo, matSkin);
  armL.position.set(-0.48, 1.3, 0);
  const armR = new THREE.Mesh(armGeo, matSkin);
  armR.position.set(0.48, 1.3, 0);
  root.add(armL, armR);

  // Ноги
  const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.75, 8);
  const legL = new THREE.Mesh(legGeo, matPants);
  legL.position.set(-0.22, 0.55, 0);
  const legR = new THREE.Mesh(legGeo, matPants);
  legR.position.set(0.22, 0.55, 0);
  root.add(legL, legR);

  // Прицельный индикатор
  const arrowGeo = new THREE.ConeGeometry(0.25, 0.7, 3);
  arrowGeo.rotateX(Math.PI / 2);
  const arrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: jerseyColor }));
  arrow.position.set(0, 0.05, 1.2);
  root.add(arrow);

  root.userData = { legL, legR, armL, armR, arrow };
  return root;
}