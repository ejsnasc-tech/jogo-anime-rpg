// Monstros alem dos esqueletos: corpos procedurais (sem modelos externos) e as hordas de cada estagio de cada reino.
import * as THREE from 'three';
import { hordeRealm } from './data.js';

const M = (c, em, ei, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.65, metalness: 0.05, emissive: em == null ? 0x000000 : em, emissiveIntensity: ei == null ? 0.5 : ei }, o || {}));
const W = M(0xffffff, 0xffffff, 0.35), K = M(0x111111);
const mk = (par, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; par.add(m); return m; };
const eyes = (par, y, z, x, r) => [-x, x].forEach(ex => { mk(par, new THREE.SphereGeometry(r, 10, 8), W, ex, y, z); mk(par, new THREE.SphereGeometry(r * 0.5, 8, 6), K, ex, y, z + r * 0.75); });
const dark = (c) => new THREE.Color(c).multiplyScalar(0.55).getHex();

// cada corpo mede ~1.2 de altura e olha para +z; o tamanho final vem do "size" do tipo
const BODIES = {
  slime(g, c) {
    const b = mk(g, new THREE.SphereGeometry(0.6, 18, 14), M(c, c, 0.25, { transparent: true, opacity: 0.88 }), 0, 0.45, 0); b.scale.set(1.1, 0.78, 1.1);
    mk(g, new THREE.SphereGeometry(0.22, 12, 10), M(c, c, 0.35, { transparent: true, opacity: 0.9 }), 0.2, 0.85, -0.1);
    eyes(g, 0.62, 0.5, 0.22, 0.13);
  },
  crab(g, c) {
    const b = mk(g, new THREE.SphereGeometry(0.62, 16, 12), M(c), 0, 0.42, 0); b.scale.set(1.25, 0.55, 0.95);
    [-1, 1].forEach(s => {
      mk(g, new THREE.CylinderGeometry(0.07, 0.07, 0.5, 6), M(dark(c)), s * 0.75, 0.55, 0.45).rotation.x = 1.1;
      const cl = mk(g, new THREE.SphereGeometry(0.26, 10, 8), M(c, 0x330000, 0.2), s * 0.85, 0.6, 0.78); cl.scale.set(1.1, 0.7, 1.3);
      mk(g, new THREE.ConeGeometry(0.1, 0.3, 6), M(0xffffff), s * 0.85, 0.62, 1.05).rotation.x = Math.PI / 2;
      for (let i = 0; i < 3; i++) mk(g, new THREE.BoxGeometry(0.5, 0.07, 0.07), M(dark(c)), s * 0.85, 0.22, -0.25 + i * 0.3).rotation.z = s * -0.5;
      mk(g, new THREE.CylinderGeometry(0.03, 0.03, 0.3, 5), M(dark(c)), s * 0.25, 0.9, 0.4);
      mk(g, new THREE.SphereGeometry(0.09, 8, 6), W, s * 0.25, 1.07, 0.4);
    });
  },
  jelly(g, c) {
    const dome = mk(g, new THREE.SphereGeometry(0.6, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), M(c, c, 0.55, { transparent: true, opacity: 0.8, side: THREE.DoubleSide }), 0, 0.95, 0);
    dome.scale.set(1, 0.95, 1);
    mk(g, new THREE.SphereGeometry(0.2, 10, 8), M(0xffffff, c, 0.7, { transparent: true, opacity: 0.7 }), 0, 1.0, 0);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; mk(g, new THREE.CylinderGeometry(0.035, 0.015, 0.8, 5), M(c, c, 0.5, { transparent: true, opacity: 0.75 }), Math.cos(a) * 0.35, 0.55, Math.sin(a) * 0.35); }
    eyes(g, 0.95, 0.5, 0.2, 0.1);
  },
  wolf(g, c) {
    const b = mk(g, new THREE.BoxGeometry(0.55, 0.5, 1.15), M(c), 0, 0.7, 0);
    mk(g, new THREE.BoxGeometry(0.4, 0.4, 0.42), M(c), 0, 0.85, 0.72);
    mk(g, new THREE.BoxGeometry(0.22, 0.2, 0.34), M(dark(c)), 0, 0.78, 1.02);
    [-0.14, 0.14].forEach(x => { mk(g, new THREE.ConeGeometry(0.09, 0.22, 4), M(c), x, 1.15, 0.65); mk(g, new THREE.SphereGeometry(0.05, 6, 6), M(0xffe040, 0xffe040, 1), x, 0.93, 0.92); });
    mk(g, new THREE.ConeGeometry(0.1, 0.55, 5), M(c), 0, 0.85, -0.78).rotation.x = -1.2;
    [[-0.2, 0.4], [0.2, 0.4], [-0.2, -0.4], [0.2, -0.4]].forEach(([x, z]) => mk(g, new THREE.BoxGeometry(0.14, 0.5, 0.14), M(dark(c)), x, 0.25, z));
  },
  bat(g, c) {
    mk(g, new THREE.SphereGeometry(0.3, 12, 10), M(c), 0, 1.0, 0);
    [-0.12, 0.12].forEach(x => { mk(g, new THREE.ConeGeometry(0.07, 0.22, 4), M(c), x, 1.32, 0.02); mk(g, new THREE.SphereGeometry(0.06, 8, 6), M(0xff3030, 0xff3030, 1), x, 1.05, 0.26); });
    [-1, 1].forEach(s => { const w = mk(g, new THREE.BoxGeometry(0.85, 0.04, 0.5), M(dark(c), c, 0.15, { side: THREE.DoubleSide }), s * 0.6, 1.05, -0.05); w.rotation.z = s * 0.35; w.rotation.y = s * -0.25; });
  },
  spider(g, c) {
    const ab = mk(g, new THREE.SphereGeometry(0.4, 14, 10), M(c), 0, 0.55, -0.35); ab.scale.set(1, 0.85, 1.25);
    mk(g, new THREE.SphereGeometry(0.26, 12, 10), M(dark(c)), 0, 0.5, 0.3);
    [-0.1, 0.1].forEach(x => mk(g, new THREE.SphereGeometry(0.06, 6, 6), M(0xff3030, 0xff3030, 1), x, 0.58, 0.52));
    [-1, 1].forEach(s => { for (let i = 0; i < 4; i++) { const l = mk(g, new THREE.CylinderGeometry(0.03, 0.03, 0.8, 5), M(dark(c)), s * 0.5, 0.35, 0.3 - i * 0.28); l.rotation.z = s * 1.0; l.rotation.y = (i - 1.5) * 0.18 * s; } });
  },
  golem(g, c) {
    const rock = M(c, 0x000000, 0, { roughness: 0.95 }), glowM = M(0xffd27a, 0xffb040, 1.2);
    mk(g, new THREE.BoxGeometry(0.85, 0.8, 0.55), rock, 0, 0.9, 0);
    mk(g, new THREE.BoxGeometry(0.45, 0.4, 0.42), rock, 0, 1.55, 0.05);
    [-0.1, 0.1].forEach(x => mk(g, new THREE.BoxGeometry(0.09, 0.06, 0.05), glowM, x, 1.58, 0.28));
    mk(g, new THREE.BoxGeometry(0.3, 0.25, 0.05), glowM, 0, 0.95, 0.29);
    [-1, 1].forEach(s => { mk(g, new THREE.BoxGeometry(0.3, 0.9, 0.3), rock, s * 0.62, 0.85, 0); mk(g, new THREE.BoxGeometry(0.4, 0.35, 0.4), rock, s * 0.62, 0.3, 0.05); mk(g, new THREE.BoxGeometry(0.32, 0.5, 0.34), rock, s * 0.24, 0.3, 0); });
  },
  wisp(g, c) {
    const core = mk(g, new THREE.SphereGeometry(0.42, 16, 12), M(c, c, 1.0, { transparent: true, opacity: 0.8 }), 0, 0.85, 0);
    mk(g, new THREE.ConeGeometry(0.34, 0.9, 12), M(c, c, 0.8, { transparent: true, opacity: 0.55 }), 0, 0.35, -0.05).rotation.x = Math.PI;
    eyes(g, 0.9, 0.34, 0.15, 0.09);
    core.scale.set(1, 1.15, 1);
  },
  shroom(g, c) {
    mk(g, new THREE.CylinderGeometry(0.22, 0.28, 0.6, 10), M(0xf2e6c8), 0, 0.4, 0);
    const cap = mk(g, new THREE.SphereGeometry(0.62, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M(c), 0, 0.68, 0); cap.scale.set(1, 0.9, 1);
    [[0.3, 1.05, 0.2], [-0.25, 1.1, 0.1], [0.05, 1.18, -0.25], [-0.35, 0.95, -0.2]].forEach(([x, y, z]) => mk(g, new THREE.SphereGeometry(0.09, 8, 6), M(0xfff2d0), x, y, z));
    eyes(g, 0.48, 0.24, 0.1, 0.07);
    [-0.14, 0.14].forEach(x => mk(g, new THREE.BoxGeometry(0.1, 0.18, 0.1), M(0xf2e6c8), x, 0.1, 0));
  },
  imp(g, c) {
    mk(g, new THREE.SphereGeometry(0.38, 14, 10), M(c), 0, 0.75, 0).scale.set(1, 1.1, 0.9);
    mk(g, new THREE.SphereGeometry(0.3, 14, 10), M(c), 0, 1.25, 0.05);
    [-1, 1].forEach(s => {
      mk(g, new THREE.ConeGeometry(0.07, 0.3, 5), M(0xffe8c0), s * 0.18, 1.55, 0.02).rotation.z = -s * 0.3;
      mk(g, new THREE.SphereGeometry(0.06, 8, 6), M(0xffe040, 0xffe040, 1), s * 0.11, 1.28, 0.3);
      const wg = mk(g, new THREE.BoxGeometry(0.55, 0.04, 0.4), M(dark(c), c, 0.2, { side: THREE.DoubleSide }), s * 0.5, 0.95, -0.2); wg.rotation.z = s * 0.5;
      mk(g, new THREE.BoxGeometry(0.12, 0.35, 0.12), M(dark(c)), s * 0.12, 0.2, 0);
    });
    mk(g, new THREE.CylinderGeometry(0.02, 0.05, 0.55, 5), M(c), 0, 0.5, -0.4).rotation.x = -0.9;
  },
};

export function makeCreature(body, color, size) {
  const g = new THREE.Group();
  (BODIES[body] || BODIES.slime)(g, color);
  g.traverse(o => { if (o.isMesh) o.material = o.material.clone(); });   // materiais proprios (piscar/brilho nao vaza para os outros)
  g.scale.setScalar((size || 1.6) / 1.25);
  g.userData = {};
  return g;
}

// ---- tipos de monstro (usam os mesmos comportamentos dos esqueletos: beh / ranged) ----
const T = (name, body, tint, hp, dmg, spd, size, r, o) => Object.assign({ name, body, tint, hp, dmg, spd, size, r, loot: size > 2.2 ? 'brute' : size < 1.5 ? 'runner' : 'Skeleton_Warrior' }, o || {});
const SHOOT = (color, o) => Object.assign({ range: 11, keep: 7, cd: 2.6, speed: 9, color, size: 1.5, splash: 1.4 }, o || {});
// gm = modelo 3D animado (Quaternius, CC0) e gt = cor que tinge a textura; fx = cor dos golpes/ataques; body = corpo procedural de reserva.
// Ataques: beh 'leap' (pula em cima), 'slam' (pancada em area), 'lob' (bomba em arco), 'beam' (raio), 'charger', 'bomber', 'stalker', 'swarm'...
// e ranged.pat 'fan' (leque), 'burst' (rajada), 'ring' (anel de tiros).
export const CREATURE_TYPES = {
  // mares
  mares_s1: T('Grumete Caranguejo', 'crab', 0xffb08a, 1.6, 1.1, 0.9, 1.6, 0.8, { gm: 'Crab', gt: 0xffb08a, fx: 0xff8a5a, beh: 'leap', res: { p: 0.8, m: 1.2 } }),
  mares_2a: T('Pirata Espadachim', 'imp', 0x8ac8ff, 1.8, 1.5, 1, 1.5, 0.8, { gm: 'R_Warrior', gt: 0x8ac8ff, fx: 0x7fd8ff, beh: 'charger' }),
  mares_2b: T('Pirata Atirador', 'imp', 0xffe0a0, 0.8, 1.3, 1, 1.5, 0.65, { gm: 'R_Ranger', gt: 0xffe0a0, fx: 0xffd36b, ranged: SHOOT(0xffd36b, { pat: 'fan', arrow: true, speed: 12, cd: 2.4, splash: 0 }) }),
  mares_2c: T('Slime Marujo', 'slime', 0x9fe8ff, 0.9, 0.8, 1, 1.4, 0.65, { gm: 'Q_Slime', gt: 0x9fe8ff, fx: 0x7fe3ff, beh: 'leap' }),
  mares_3a: T('Polvo Corsário', 'jelly', 0xffb0ec, 0.8, 1, 0.8, 1.7, 0.7, { gm: 'Cthulhu', gt: 0xffb0ec, fx: 0xff8ad8, ranged: SHOOT(0xff8ad8, { pat: 'fan' }) }),
  mares_3b: T('Vigia da Tempestade', 'jelly', 0x9fe0ff, 0.9, 1.4, 0.75, 1.9, 0.7, { gm: 'Alien_Tall', gt: 0x9fe0ff, fx: 0x7fd8ff, beh: 'lob' }),
  mares_3c: T('Pirata Fantasma', 'wisp', 0xa8f0ff, 0.8, 1.5, 1.1, 1.9, 0.7, { gm: 'Ghost', gt: 0xa8f0ff, fx: 0x7fe3ff, beh: 'stalker' }),
  mares_4a: T('Colosso do Recife', 'golem', 0xff9ab8, 3, 1.5, 0.65, 2.8, 1.1, { gm: 'Cyclops', gt: 0xff9ab8, fx: 0xff7aa0, beh: 'slam', res: { p: 0.7, m: 1.3 } }),
  mares_4b: T('Capitão Caveira', 'golem', 0xffd0a0, 3.2, 1.8, 0.65, 3, 1.15, { gm: 'Skull', gt: 0xffd0a0, fx: 0xffa060, beh: 'charger', res: { p: 0.7, m: 1.3 } }),
  mares_4c: T('Serpente do Abismo', 'bat', 0x7fe3ff, 1.3, 1.5, 1, 2.2, 0.8, { gm: 'Q_Dragon', gt: 0x7fe3ff, fx: 0x4fc3ff, ranged: SHOOT(0x4fc3ff, { pat: 'ring', range: 12, keep: 8, speed: 8, cd: 3.4, splash: 1.6 }) }),
  // sombras
  sombras_s1: T('Ninja-Morcego', 'bat', 0xb08aff, 0.35, 0.6, 1.6, 1.3, 0.5, { gm: 'Bat', gt: 0xb08aff, fx: 0xb08aff, beh: 'swarm' }),
  sombras_2a: T('Ninja Sombra', 'imp', 0x8a7aff, 0.8, 1.4, 1.6, 1.4, 0.6, { gm: 'R_Rogue', gt: 0x8a7aff, fx: 0xb085ff, beh: 'stalker' }),
  sombras_2b: T('Monge das Sombras', 'imp', 0xa890d8, 1.4, 1.5, 1.2, 1.5, 0.7, { gm: 'R_Monk', gt: 0xa890d8, fx: 0xb08aff, beh: 'leap' }),
  sombras_2c: T('Ninja Rastejante', 'spider', 0xa070d8, 0.9, 1, 0.85, 1.8, 0.75, { gm: 'Alien', gt: 0xa070d8, fx: 0xb04aff, beh: 'spitter' }),
  sombras_3a: T('Ninja Explosivo', 'imp', 0xff9a8a, 0.5, 2, 1.4, 1.6, 0.6, { gm: 'Demon', gt: 0xff9a8a, fx: 0xff7a2a, beh: 'bomber' }),
  sombras_3b: T('Espectro Ninja', 'wisp', 0xc9b8ff, 0.8, 1.5, 1.1, 1.9, 0.7, { gm: 'Ghost', gt: 0xc9b8ff, fx: 0x9b7bff, beh: 'stalker' }),
  sombras_3c: T('Ninja Caveira', 'golem', 0x8a6aa8, 3.2, 1.8, 0.65, 3, 1.15, { gm: 'Skull', gt: 0x8a6aa8, fx: 0x9a6aff, beh: 'charger', res: { p: 0.7, m: 1.3 } }),
  sombras_4a: T('Ninja Vampiro', 'bat', 0xff8aa8, 0.7, 1.4, 1.3, 1.6, 0.6, { gm: 'Q_Bat', gt: 0xff8aa8, fx: 0xff3a6a, beh: 'stalker' }),
  sombras_4b: T('Mestre das Facas', 'imp', 0xc08aff, 0.9, 1.5, 0.8, 1.7, 0.65, { gm: 'GreenDemon', gt: 0xc08aff, fx: 0xc77dff, ranged: SHOOT(0xc77dff, { pat: 'burst', range: 12, keep: 8, speed: 9.5, cd: 3.0, size: 1.2 }) }),
  sombras_4c: T('Sacerdote Sombrio', 'imp', 0x9a7ac8, 1, 1, 0.8, 1.5, 0.65, { gm: 'R_Cleric', gt: 0x9a7ac8, fx: 0xb085ff, beh: 'summoner' }),
  // arcana
  arcana_s1: T('Espírito Amaldiçoado', 'slime', 0xb8a8ff, 0.9, 0.8, 1, 1.4, 0.65, { gm: 'Q_Slime', gt: 0xb8a8ff, fx: 0x8a7bff, beh: 'leap' }),
  arcana_2a: T('Feiticeiro de Selos', 'imp', 0x9ab8ff, 0.8, 1.4, 0.85, 1.5, 0.65, { gm: 'R_Wizard', gt: 0x9ab8ff, fx: 0x6c9bff, ranged: SHOOT(0x6c9bff, { pat: 'burst', range: 12, keep: 8, speed: 9.5, cd: 3.0, size: 1.3 }) }),
  arcana_2b: T('Mestre das Maldições', 'imp', 0xd9a8ff, 1, 1, 0.8, 1.5, 0.65, { gm: 'R_Cleric', gt: 0xd9a8ff, fx: 0xc77dff, beh: 'summoner' }),
  arcana_2c: T('Maldição Menor', 'imp', 0x9ab8ff, 0.9, 1.5, 0.8, 1.7, 0.65, { gm: 'GreenDemon', gt: 0x9ab8ff, fx: 0x6c9bff, ranged: SHOOT(0x6c9bff, { pat: 'burst', range: 12, keep: 8, speed: 9.5, cd: 3.0, size: 1.2 }) }),
  arcana_3a: T('Maldição de Cristal', 'golem', 0x9fd8ff, 3, 1.6, 0.65, 2.8, 1.1, { gm: 'Yeti', gt: 0x9fd8ff, fx: 0x9fd8ff, beh: 'slam', res: { p: 0.6, m: 1.4 } }),
  arcana_3b: T('Olho Amaldiçoado', 'jelly', 0xc8a8ff, 0.9, 1.4, 0.75, 1.9, 0.7, { gm: 'Alien_Tall', gt: 0xc8a8ff, fx: 0xb6a8ff, beh: 'lob' }),
  arcana_3c: T('Espírito Rúnico', 'jelly', 0xb89aff, 0.8, 1, 0.8, 1.7, 0.7, { gm: 'Cthulhu', gt: 0xb89aff, fx: 0xb6a8ff, ranged: SHOOT(0xb6a8ff, { pat: 'fan' }) }),
  arcana_4a: T('Maldição Explosiva', 'imp', 0xff9ae6, 0.5, 2, 1.4, 1.6, 0.6, { gm: 'Demon', gt: 0xff9ae6, fx: 0xff7bd8, beh: 'bomber' }),
  arcana_4b: T('Maldição Parasita', 'shroom', 0xa88aff, 0.6, 2, 1.4, 1.5, 0.6, { gm: 'Mushroom', gt: 0xa88aff, fx: 0x9a6aff, beh: 'bomber' }),
  arcana_4c: T('Maldição Alada', 'bat', 0xb8a8ff, 0.7, 1.4, 1.3, 1.6, 0.6, { gm: 'Q_Bat', gt: 0xb8a8ff, fx: 0x8a7bff, beh: 'stalker' }),
  // planalto
  planalto_s1: T('Guerreiro Vespa', 'crab', 0xffd070, 1.8, 1.7, 0.85, 2, 0.85, { gm: 'Bee', gt: 0xffd070, fx: 0xffc030, beh: 'charger', res: { p: 0.65, m: 1.3 } }),
  planalto_2a: T('Lutador de Aura', 'imp', 0xffe0a0, 1.4, 1.5, 1.2, 1.5, 0.7, { gm: 'R_Monk', gt: 0xffe0a0, fx: 0xffd36b, beh: 'leap' }),
  planalto_2b: T('Brutamontes de Aura', 'imp', 0xffc070, 1.8, 1.5, 1, 1.5, 0.8, { gm: 'R_Warrior', gt: 0xffc070, fx: 0xff9a3c, beh: 'charger' }),
  planalto_2c: T('Lutador Cervo', 'wolf', 0xffd36b, 0.8, 1.1, 1.5, 1.8, 0.7, { gm: 'Deer', fx: 0xffd36b, beh: 'leap' }),
  planalto_3a: T('Atirador de Aura', 'spider', 0xd8f06a, 1, 1.2, 0.85, 1.9, 0.75, { gm: 'Cactus', fx: 0xd8f06a, ranged: SHOOT(0xd8f06a, { pat: 'fan', arrow: true, speed: 12, cd: 2.4, splash: 0 }) }),
  planalto_3b: T('Gigante de Aura', 'golem', 0xd8c8a0, 3, 1.5, 0.65, 2.8, 1.1, { gm: 'Cyclops', gt: 0xd8c8a0, fx: 0xc9a46a, beh: 'slam', res: { p: 0.7, m: 1.3 } }),
  planalto_3c: T('Mestre Panda', 'wolf', 0xffe0b0, 0.8, 1.3, 1.4, 1.9, 0.7, { gm: 'Panda', gt: 0xffe0b0, fx: 0xffd36b, beh: 'leap' }),
  planalto_4a: T('Dragão de Aura', 'bat', 0xffa030, 1.4, 1.5, 0.9, 2.3, 0.85, { gm: 'YellowDragon', fx: 0xffa030, ranged: SHOOT(0xffa030, { pat: 'burst', range: 13, keep: 9, speed: 9, cd: 3.0, size: 1.7, splash: 1.8 }) }),
  planalto_4b: T('Titã de Aura', 'golem', 0xffe0a0, 3, 1.6, 0.65, 2.8, 1.1, { gm: 'Yeti', gt: 0xffe0a0, fx: 0xffd36b, beh: 'slam', res: { p: 0.6, m: 1.4 } }),
  planalto_4c: T('Mestre Veloz', 'imp', 0xffd070, 0.8, 1.4, 1.6, 1.4, 0.6, { gm: 'R_Rogue', gt: 0xffd070, fx: 0xffc030, beh: 'stalker' }),
  // primeva
  primeva_s1: T('Caçador Cogumelo', 'shroom', 0xff6a3a, 0.6, 2, 1.4, 1.5, 0.6, { gm: 'Mushroom', fx: 0xff6a3a, beh: 'bomber' }),
  primeva_2a: T('Caçador Arqueiro', 'imp', 0x9adf7a, 0.8, 1.3, 1, 1.5, 0.65, { gm: 'R_Ranger', gt: 0x9adf7a, fx: 0x8adf6a, ranged: SHOOT(0x8adf6a, { pat: 'fan', arrow: true, speed: 12, cd: 2.4, splash: 0 }) }),
  primeva_2b: T('Caçador Panda', 'wolf', 0xb8e8a8, 0.8, 1.3, 1.4, 1.9, 0.7, { gm: 'Panda', gt: 0xb8e8a8, fx: 0x8adf6a, beh: 'leap' }),
  primeva_2c: T('Guardião Ancestral', 'golem', 0x8adf6a, 3.4, 1.6, 0.6, 3.1, 1.2, { gm: 'Tree', fx: 0x8adf6a, beh: 'slam', res: { p: 0.7, m: 1.3 } }),
  primeva_3a: T('Caçador Abelha', 'crab', 0xc8ffa0, 1.8, 1.7, 0.85, 2, 0.85, { gm: 'Bee', gt: 0xc8ffa0, fx: 0xc8ff6a, beh: 'charger', res: { p: 0.65, m: 1.3 } }),
  primeva_3b: T('Caçador Cervo', 'wolf', 0x9adf7a, 0.8, 1.1, 1.5, 1.8, 0.7, { gm: 'Deer', gt: 0x9adf7a, fx: 0x8adf6a, beh: 'leap' }),
  primeva_3c: T('Caçador Espinhoso', 'spider', 0xc8f0a0, 1, 1.2, 0.85, 1.9, 0.75, { gm: 'Cactus', gt: 0xc8f0a0, fx: 0xd8f06a, ranged: SHOOT(0xd8f06a, { pat: 'fan', arrow: true, speed: 12, cd: 2.4, splash: 0 }) }),
  primeva_4a: T('Caçador de Raízes', 'spider', 0x9adf7a, 0.9, 1, 0.85, 1.8, 0.75, { gm: 'Alien', gt: 0x9adf7a, fx: 0x7dff9b, beh: 'spitter' }),
  primeva_4b: T('Gosma Caçadora', 'slime', 0x7ddf5a, 0.9, 0.8, 1, 1.4, 0.65, { gm: 'Q_Slime', gt: 0x7ddf5a, fx: 0x7ddf5a, beh: 'leap' }),
  primeva_4c: T('Druida Caçador', 'imp', 0x8adf9a, 0.8, 1.4, 0.85, 1.5, 0.65, { gm: 'R_Wizard', gt: 0x8adf9a, fx: 0x7dff9b, ranged: SHOOT(0x7dff9b, { pat: 'burst', range: 12, keep: 8, speed: 9.5, cd: 3.0, size: 1.3 }) }),
  // vazio
  vazio_s1: T('Caveira do Portal', 'golem', 0x7a6a9a, 3.2, 1.8, 0.65, 3, 1.15, { gm: 'Skull', gt: 0x7a6a9a, fx: 0xa88aff, beh: 'charger', res: { p: 0.7, m: 1.3 } }),
  vazio_2a: T('Invocador do Portal', 'imp', 0x8a7aa8, 0.5, 2, 1.4, 1.6, 0.6, { gm: 'Demon', gt: 0x8a7aa8, fx: 0xa88aff, beh: 'bomber' }),
  vazio_2b: T('Sombra do Portal', 'wisp', 0x6a6a88, 0.8, 1.5, 1.1, 1.9, 0.7, { gm: 'Ghost', gt: 0x6a6a88, fx: 0x8a8aff, beh: 'stalker' }),
  vazio_2c: T('Dragão do Portal', 'bat', 0x6a5a9a, 1.3, 1.5, 1, 2.2, 0.8, { gm: 'Q_Dragon', gt: 0x6a5a9a, fx: 0x8a6aff, ranged: SHOOT(0x8a6aff, { pat: 'ring', range: 12, keep: 8, speed: 8, cd: 3.4, splash: 1.6 }) }),
  vazio_3a: T('Olho do Portal', 'golem', 0x8a7ab8, 3, 1.5, 0.65, 2.8, 1.1, { gm: 'Cyclops', gt: 0x8a7ab8, fx: 0xc8c8ff, beh: 'beam', res: { p: 0.7, m: 1.3 } }),
  vazio_3b: T('Vigia do Portal', 'jelly', 0x8a7ab8, 0.9, 1.4, 0.75, 1.9, 0.7, { gm: 'Alien_Tall', gt: 0x8a7ab8, fx: 0x8a8aff, beh: 'lob' }),
  vazio_3c: T('Polvo do Vazio', 'jelly', 0x8a7ab8, 0.8, 1, 0.8, 1.7, 0.7, { gm: 'Cthulhu', gt: 0x8a7ab8, fx: 0xa88aff, ranged: SHOOT(0xa88aff, { pat: 'fan' }) }),
  vazio_4a: T('Cavaleiro Rank S', 'imp', 0x7a6a9a, 1.8, 1.5, 1, 1.5, 0.8, { gm: 'R_Warrior', gt: 0x7a6a9a, fx: 0xa88aff, beh: 'charger' }),
  vazio_4b: T('Monge do Vazio', 'imp', 0x7a6a9a, 1.4, 1.5, 1.2, 1.5, 0.7, { gm: 'R_Monk', gt: 0x7a6a9a, fx: 0xc8c8ff, beh: 'leap' }),
  vazio_4c: T('Morcego do Portal', 'bat', 0x6a5a9a, 0.7, 1.4, 1.3, 1.6, 0.6, { gm: 'Q_Bat', gt: 0x6a5a9a, fx: 0x8a6aff, beh: 'stalker' }),
};

// Estagio 1 de todo reino = esqueletos. Estagios 2, 3 e 4 = uma familia de monstros nova cada um. Estagio 5 (chefe) e Infinito = mistura.
export const STAGE_HORDES = {
  mares: [
    { name: 'Piratas e Marujos', w: { mares_2a: 34, mares_2b: 30, mares_2c: 28 } },
    { name: 'Polvos e Fantasmas do Mar', w: { mares_3a: 32, mares_3b: 28, mares_3c: 26 } },
    { name: 'Capitães do Abismo', w: { mares_4a: 26, mares_4b: 24, mares_4c: 24 } },
  ],
  sombras: [
    { name: 'Clã Ninja', w: { sombras_2a: 34, sombras_2b: 28, sombras_2c: 28 } },
    { name: 'Ninjas Explosivos e Espectros', w: { sombras_3a: 28, sombras_3b: 28, sombras_3c: 22 } },
    { name: 'Mestres das Sombras', w: { sombras_4a: 28, sombras_4b: 26, sombras_4c: 22 } },
  ],
  arcana: [
    { name: 'Feiticeiros e Maldições', w: { arcana_2a: 34, arcana_2b: 22, arcana_2c: 28 } },
    { name: 'Maldições de Cristal', w: { arcana_3a: 24, arcana_3b: 26, arcana_3c: 28 } },
    { name: 'Maldições Rúnicas', w: { arcana_4a: 28, arcana_4b: 26, arcana_4c: 26 } },
  ],
  planalto: [
    { name: 'Lutadores de Aura', w: { planalto_2a: 32, planalto_2b: 26, planalto_2c: 28 } },
    { name: 'Atiradores e Gigantes de Aura', w: { planalto_3a: 28, planalto_3b: 24, planalto_3c: 26 } },
    { name: 'Dragões e Titãs de Aura', w: { planalto_4a: 26, planalto_4b: 22, planalto_4c: 24 } },
  ],
  primeva: [
    { name: 'Caçadores da Mata', w: { primeva_2a: 34, primeva_2b: 28, primeva_2c: 20 } },
    { name: 'Caçadores Selvagens', w: { primeva_3a: 30, primeva_3b: 28, primeva_3c: 26 } },
    { name: 'Caçadores de Raízes', w: { primeva_4a: 28, primeva_4b: 28, primeva_4c: 26 } },
  ],
  vazio: [
    { name: 'Invocadores do Portal', w: { vazio_2a: 28, vazio_2b: 32, vazio_2c: 24 } },
    { name: 'Vigias do Portal', w: { vazio_3a: 28, vazio_3b: 26, vazio_3c: 28 } },
    { name: 'Cavaleiros Rank S', w: { vazio_4a: 26, vazio_4b: 24, vazio_4c: 24 } },
  ],
};
const STAGE1_EXTRA = { mares: { mares_s1: 30 }, sombras: { sombras_s1: 30 }, arcana: { arcana_s1: 30 }, planalto: { planalto_s1: 30 }, primeva: { primeva_s1: 30 }, vazio: { vazio_s1: 30 } };
export const SKEL_HORDE = (act) => ({ minion: 50, warrior: 22, runner: 14, archer: 14, mage: act >= 2 ? 8 : 0 });

// pesos de monstros do estagio (st 1..5; 5 e infinito = mistura de tudo do reino)
export function hordeWeights(realm, st, act) {
  const fam = STAGE_HORDES[hordeRealm(realm)];
  if (!fam) return SKEL_HORDE(act);
  if (st <= 1) return Object.assign(SKEL_HORDE(act), STAGE1_EXTRA[hordeRealm(realm)] || {});   // esqueletos + um monstrinho do reino, para nao ficar tudo igual
  if (st <= 4) return Object.assign({}, fam[st - 2].w);
  const w = { warrior: 8, archer: 6 };
  fam.forEach(f => { for (const k in f.w) w[k] = (w[k] || 0) + f.w[k] * 0.5; });
  return w;
}
export const hordeTitle = (realm, st) => {
  const fam = STAGE_HORDES[hordeRealm(realm)];
  return !fam || st <= 1 ? 'Esqueletos' : st <= 4 ? fam[st - 2].name : 'Todas as hordas do reino';
};
