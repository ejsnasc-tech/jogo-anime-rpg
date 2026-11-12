// Monstros alem dos esqueletos: corpos procedurais (sem modelos externos) e as hordas de cada estagio de cada reino.
import * as THREE from 'three';

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
export const CREATURE_TYPES = {
  // Mar das Marés
  crab: T('Caranguejo', 'crab', 0xe8643c, 1.6, 1.1, 0.9, 1.5, 0.8, { res: { p: 0.8, m: 1.2 } }),
  limo: T('Limo Marinho', 'slime', 0x3ccfd8, 0.9, 0.8, 1.0, 1.3, 0.65),
  jellyS: T('Água-viva Chocante', 'jelly', 0xff8ad8, 0.8, 1.0, 0.8, 1.6, 0.7, { ranged: SHOOT(0xff8ad8), atk: 'Spellcast_Shoot' }),
  jellyN: T('Água-viva Tempestade', 'jelly', 0x7fd8ff, 0.9, 1.4, 0.75, 1.7, 0.7, { beh: 'nova' }),
  coral: T('Golem de Coral', 'golem', 0xff7aa0, 3.0, 1.5, 0.65, 2.6, 1.1, { res: { p: 0.7, m: 1.3 } }),
  crabK: T('Caranguejo Gigante', 'crab', 0xff4a2a, 2.0, 1.8, 0.85, 2.2, 1.0, { beh: 'charger', res: { p: 0.75, m: 1.25 } }),
  // Clã das Sombras
  bat: T('Morcego Sombrio', 'bat', 0x5a3a7a, 0.35, 0.6, 1.6, 1.1, 0.5, { beh: 'swarm' }),
  batV: T('Morcego Vampiro', 'bat', 0x8a2a4a, 0.7, 1.4, 1.3, 1.4, 0.6, { beh: 'stalker' }),
  spiderD: T('Aranha das Trevas', 'spider', 0x2a1a3a, 0.9, 1.0, 0.85, 1.7, 0.75, { beh: 'spitter' }),
  spiderG: T('Aranha Gigante', 'spider', 0x4a2a6a, 2.2, 1.5, 1.0, 2.4, 1.0),
  wraith: T('Espectro', 'wisp', 0x9b7bff, 0.8, 1.5, 1.1, 1.7, 0.7, { beh: 'stalker' }),
  imp: T('Diabrete Explosivo', 'imp', 0xb02a5a, 0.5, 2.0, 1.4, 1.5, 0.6, { beh: 'bomber' }),
  // Academia Arcana
  slimeA: T('Slime Arcano', 'slime', 0x8a7bff, 1.0, 0.9, 0.9, 1.4, 0.7),
  slimeB: T('Slime Explosivo', 'slime', 0xff7bd8, 0.6, 2.0, 1.4, 1.3, 0.6, { beh: 'bomber' }),
  impA: T('Duende Arcano', 'imp', 0x6c9bff, 0.9, 1.5, 0.8, 1.5, 0.65, { beh: 'nova' }),
  impS: T('Duende Invocador', 'imp', 0xc77dff, 1.1, 0.8, 0.7, 1.7, 0.7, { beh: 'summoner' }),
  golemC: T('Golem de Cristal', 'golem', 0x9fd8ff, 3.0, 1.6, 0.65, 2.6, 1.1, { res: { p: 0.6, m: 1.4 } }),
  wispA: T('Fogo-fátuo Arcano', 'wisp', 0xb6a8ff, 0.8, 1.2, 0.8, 1.6, 0.65, { ranged: SHOOT(0xb6a8ff, { range: 12, keep: 8, speed: 8, cd: 2.8, splash: 1.6 }), atk: 'Spellcast_Shoot' }),
  // Planalto Dourado
  wolf: T('Lobo do Planalto', 'wolf', 0xd9a84a, 0.8, 1.1, 1.5, 1.6, 0.7),
  wolfA: T('Lobo Alfa', 'wolf', 0xa0701f, 2.0, 1.6, 1.1, 2.2, 0.95, { beh: 'charger' }),
  golemP: T('Golem de Pedra', 'golem', 0xb59a6a, 3.2, 1.6, 0.65, 2.7, 1.1, { res: { p: 0.7, m: 1.3 } }),
  scorp: T('Escorpião Dourado', 'spider', 0xe0b23a, 1.0, 1.2, 0.85, 1.8, 0.75, { beh: 'spitter' }),
  besouro: T('Besouro Blindado', 'crab', 0x8a6a2a, 1.8, 1.7, 0.85, 1.8, 0.85, { beh: 'charger', res: { p: 0.65, m: 1.3 } }),
  // Floresta Primeva
  shroom: T('Cogumelo Saltitante', 'shroom', 0xd0503a, 0.6, 2.0, 1.4, 1.4, 0.6, { beh: 'bomber' }),
  shroomV: T('Cogumelo Venenoso', 'shroom', 0x7a4aff, 0.9, 1.0, 0.8, 1.6, 0.7, { beh: 'spitter' }),
  wolfF: T('Lobo da Floresta', 'wolf', 0x4d7a3d, 0.8, 1.3, 1.4, 1.7, 0.7, { beh: 'stalker' }),
  spiderF: T('Aranha da Mata', 'spider', 0x3a8a2a, 0.35, 0.6, 1.5, 1.1, 0.5, { beh: 'swarm' }),
  ent: T('Ent Ancião', 'golem', 0x6a4a2a, 3.4, 1.6, 0.6, 2.9, 1.2, { res: { p: 0.7, m: 1.3 } }),
  gosma: T('Gosma Verde', 'slime', 0x7ddf5a, 1.0, 0.9, 0.9, 1.4, 0.7),
  // O Vazio
  voidW: T('Sombra do Vazio', 'wisp', 0x30303a, 0.8, 1.5, 1.3, 1.7, 0.7, { beh: 'stalker' }),
  voidS: T('Gosma do Vazio', 'slime', 0x1a1a2a, 1.0, 1.4, 0.9, 1.5, 0.7, { beh: 'nova' }),
  voidE: T('Olho do Vazio', 'jelly', 0xdddde8, 0.9, 1.2, 0.75, 1.7, 0.7, { ranged: SHOOT(0xe8e8ff, { speed: 10 }), atk: 'Spellcast_Shoot' }),
  voidG: T('Titã do Vazio', 'golem', 0x222233, 3.4, 1.8, 0.65, 2.8, 1.15, { beh: 'charger', res: { p: 0.7, m: 1.3 } }),
  voidI: T('Diabrete do Vazio', 'imp', 0x444466, 1.1, 0.8, 0.7, 1.7, 0.7, { beh: 'summoner' }),
};

// Estagio 1 de todo reino = esqueletos. Estagios 2, 3 e 4 = uma familia de monstros nova cada um. Estagio 5 (chefe) e Infinito = mistura.
export const STAGE_HORDES = {
  mares: [
    { name: 'Caranguejos e Limos', w: { crab: 40, limo: 36, jellyS: 10 } },
    { name: 'Águas-vivas', w: { jellyS: 32, jellyN: 24, crab: 18, limo: 10 } },
    { name: 'Gigantes do Abismo', w: { coral: 24, crabK: 24, jellyN: 20, jellyS: 14 } },
  ],
  sombras: [
    { name: 'Morcegos Sombrios', w: { bat: 56, batV: 30 } },
    { name: 'Aranhas das Trevas', w: { spiderD: 36, spiderG: 16, bat: 20 } },
    { name: 'Espectros e Diabretes', w: { wraith: 30, imp: 22, spiderG: 18, batV: 14 } },
  ],
  arcana: [
    { name: 'Slimes Arcanos', w: { slimeA: 50, slimeB: 26 } },
    { name: 'Duendes e Fogos-fátuos', w: { impA: 30, impS: 18, slimeA: 20, wispA: 16 } },
    { name: 'Golems de Cristal', w: { golemC: 26, wispA: 24, impA: 18, slimeB: 14 } },
  ],
  planalto: [
    { name: 'Lobos do Planalto', w: { wolf: 58, wolfA: 14 } },
    { name: 'Escorpiões e Golems', w: { golemP: 26, scorp: 30, wolf: 18 } },
    { name: 'Alfas e Besouros', w: { wolfA: 24, besouro: 26, golemP: 20, scorp: 14 } },
  ],
  primeva: [
    { name: 'Cogumelos e Gosmas', w: { shroom: 40, gosma: 36, shroomV: 16 } },
    { name: 'Lobos e Aranhas da Mata', w: { wolfF: 36, spiderF: 30, shroomV: 18 } },
    { name: 'Ents da Floresta', w: { ent: 24, wolfF: 22, shroomV: 20, shroom: 14 } },
  ],
  vazio: [
    { name: 'Sombras do Vazio', w: { voidW: 46, voidS: 30 } },
    { name: 'Olhos e Diabretes', w: { voidE: 30, voidI: 20, voidS: 20, voidW: 16 } },
    { name: 'Titãs do Vazio', w: { voidG: 26, voidE: 22, voidW: 20, voidI: 16 } },
  ],
};
export const SKEL_HORDE = (act) => ({ minion: 50, warrior: 22, runner: 14, archer: 14, mage: act >= 2 ? 8 : 0 });

// pesos de monstros do estagio (st 1..5; 5 e infinito = mistura de tudo do reino)
export function hordeWeights(realm, st, act) {
  const fam = STAGE_HORDES[realm];
  if (!fam || st <= 1) return SKEL_HORDE(act);
  if (st <= 4) return Object.assign({}, fam[st - 2].w);
  const w = { warrior: 8, archer: 6 };
  fam.forEach(f => { for (const k in f.w) w[k] = (w[k] || 0) + f.w[k] * 0.5; });
  return w;
}
export const hordeTitle = (realm, st) => {
  const fam = STAGE_HORDES[realm];
  return !fam || st <= 1 ? 'Esqueletos' : st <= 4 ? fam[st - 2].name : 'Todas as hordas do reino';
};
