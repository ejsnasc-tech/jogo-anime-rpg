// Criaturas extras (mascote + montaria). Todas modeladas por código, viradas para +Z, com os pés no chão (y = 0).
import * as THREE from 'three';

const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75 }, o));
const sph = (r, m, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); o.position.set(x, y, z); o.scale.set(sx || 1, sy || 1, sz || 1); return o; };
const cone = (r, h, m, x, y, z, rx, rz) => { const o = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), m); o.position.set(x, y, z); o.rotation.set(rx || 0, 0, rz || 0); return o; };
const cyl = (r0, r1, h, m, x, y, z) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 10), m); o.position.set(x, y, z); return o; };
const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
const shadowAll = (g) => g.traverse(m => { if (m.isMesh) m.castShadow = true; });

function eyes(g, col, y, z, x, r) {
  const em = std(0x15151f), wm = std(0xffffff), im = std(col);
  [-1, 1].forEach(s => { g.add(sph(r * 1.25, wm, s * x, y, z, 1, 1.1, 0.5)); g.add(sph(r * 0.95, im, s * x, y, z + r * 0.35, 1, 1.1, 0.5)); g.add(sph(r * 0.5, em, s * x, y, z + r * 0.62, 1, 1.2, 0.5)); g.add(sph(r * 0.22, wm, s * x - r * 0.25, y + r * 0.3, z + r * 0.85)); });
}

// quadrúpede genérico (raposa/gato/cachorro/coelho/urso/lobo/tigre/panda/unicórnio)
function quad(o) {
  const root = new THREE.Group(), g = new THREE.Group(); root.add(g); g.scale.setScalar(o.size || 1);
  const body = std(o.body), belly = std(o.belly != null ? o.belly : o.body), dark = std(o.dark != null ? o.dark : o.body);
  const lh = o.legH || 0.5;
  g.add(sph(0.5, body, 0, lh + 0.05, 0, 0.9 * (o.fat || 1), 0.8, 1.3));
  g.add(sph(0.38, belly, 0, lh - 0.02, 0.12, 0.8 * (o.fat || 1), 0.6, 1.0));
  g.add(sph(0.4, body, 0, lh + 0.45, 0.62, 1, 0.95, 1));                    // cabeça
  g.add(sph(0.2, belly, 0, lh + 0.36, 0.95, 1.1, 0.8, 0.8));                // focinho
  g.add(sph(0.06, std(0x2a1a1a), 0, lh + 0.4, 1.12));                       // nariz
  eyes(g, o.eye, lh + 0.52, 0.93, 0.17, 0.085);
  [[-0.38, 0.6], [0.38, 0.6], [-0.38, -0.55], [0.38, -0.55]].forEach(([x, z]) => g.add(cyl(0.16, 0.19, lh, o.legDark ? dark : body, x * (o.fat || 1), lh / 2, z)));
  const ear = o.ear || 'cone', earM = o.earDark ? dark : body;
  [-1, 1].forEach(s => {
    if (ear === 'cone') { g.add(cone(0.15, 0.45, earM, s * 0.22, lh + 0.95, 0.55, 0, -s * 0.15)); g.add(cone(0.08, 0.3, std(0xffa0b0), s * 0.22, lh + 0.92, 0.6, 0, -s * 0.15)); }
    else if (ear === 'long') { g.add(cyl(0.1, 0.13, 0.75, earM, s * 0.17, lh + 1.12, 0.5)); g.add(cyl(0.05, 0.07, 0.6, std(0xffb6c8), s * 0.17, lh + 1.12, 0.55)); }
    else if (ear === 'round') g.add(sph(0.14, earM, s * 0.28, lh + 0.82, 0.5, 1, 1, 0.6));
    else if (ear === 'floppy') g.add(sph(0.14, earM, s * 0.38, lh + 0.55, 0.5, 0.7, 1.5, 0.8));
  });
  const tail = new THREE.Group(); tail.position.set(0, lh + 0.25, -0.65); g.add(tail);
  if (o.tail === 'fluff') tail.add(sph(0.28, body, 0, 0.1, -0.35, 0.7, 0.8, 1.8));
  else if (o.tail === 'thin') { tail.add(cyl(0.05, 0.09, 0.9, o.tailCol != null ? std(o.tailCol) : body, 0, 0.25, -0.1)); tail.children[0].rotation.x = -0.9; }
  else if (o.tail === 'ball') tail.add(sph(0.16, belly, 0, 0.05, -0.2));
  if (o.rainbowTail) [0xff6b8a, 0xffd23f, 0x6fe3ff, 0xb48aff].forEach((c, i) => tail.add(sph(0.22, std(c), (i - 1.5) * 0.1, 0.12 - i * 0.03, -0.3 - i * 0.12, 0.5, 0.5, 1.4)));
  if (o.horn) { g.add(cone(0.07, 0.55, std(0xffe08a, { emissive: 0xffd166, emissiveIntensity: 0.5 }), 0, lh + 1.0, 0.78, 0.35, 0)); }
  if (o.mane) [0xff6b8a, 0xffd23f, 0x6fe3ff, 0xb48aff, 0xff6b8a].forEach((c, i) => g.add(sph(0.16, std(c), 0, lh + 0.85 - i * 0.1, 0.35 - i * 0.18, 0.6, 1, 1)));
  if (o.stripes) [-0.3, 0, 0.3, -0.55].forEach((z, i) => { g.add(box(0.8, 0.05, 0.1, dark, 0, lh + 0.4 - (i === 3 ? 0.04 : 0), z)); });
  if (o.patches) { [-1, 1].forEach(s => { g.add(sph(0.1, dark, s * 0.16, lh + 0.54, 0.9, 1, 1.4, 0.4)); }); [[-0.38, 0.6], [0.38, 0.6], [-0.38, -0.55], [0.38, -0.55]].forEach(([x, z]) => g.add(cyl(0.17, 0.2, lh * 0.9, dark, x, lh * 0.45, z))); g.add(sph(0.46, dark, 0, lh + 0.2, 0.55, 1.1, 0.4, 0.5)); }
  root.userData = { tail }; shadowAll(root); return root;
}

function makeSlime() {
  const g = new THREE.Group(), jelly = std(0x7be08a, { transparent: true, opacity: 0.82, roughness: 0.2 });
  g.add(sph(0.7, jelly, 0, 0.55, 0, 1.15, 0.85, 1.15), sph(0.35, std(0xb6f5bf, { transparent: true, opacity: 0.7 }), 0, 0.5, 0.1));
  eyes(g, 0x1b6b3a, 0.65, 0.68, 0.24, 0.1);
  g.add(cone(0.22, 0.3, std(0xffd23f, { metalness: 0.5 }), 0, 1.28, 0, 0, 0)); [-1, 1].forEach(s => g.add(cone(0.1, 0.2, std(0xffd23f), s * 0.18, 1.25, 0, 0, -s * 0.4)));
  g.userData = {}; shadowAll(g); return g;
}
function makeOwl() {
  const g = new THREE.Group(), br = std(0x9a6a3a), cream = std(0xf3e2c0);
  g.add(sph(0.55, br, 0, 0.75, 0, 1, 1.15, 0.95), sph(0.38, cream, 0, 0.7, 0.28, 1, 1.1, 0.7), sph(0.45, br, 0, 1.35, 0.05));
  eyes(g, 0xffc83d, 1.4, 0.4, 0.2, 0.14);
  g.add(cone(0.07, 0.18, std(0xff9a3d), 0, 1.28, 0.5, Math.PI / 2, 0));
  [-1, 1].forEach(s => { g.add(cone(0.1, 0.3, br, s * 0.28, 1.75, 0, 0, -s * 0.3)); g.add(cyl(0.05, 0.05, 0.25, std(0xff9a3d), s * 0.2, 0.12, 0.1)); });
  const mk = (s) => { const w = new THREE.Group(); w.position.set(s * 0.5, 0.85, 0); const m = sph(0.4, std(0x7a5128), s * 0.18, -0.1, 0, 0.35, 1.2, 0.8); w.add(m); return w; };
  const wl = mk(-1), wr = mk(1); g.add(wl, wr); g.userData = { wings: [wl, wr] };
  g.add(box(0.8, 0.06, 0.8, std(0x2a2d6a), 0, 1.78, 0)); g.add(cone(0.3, 0.4, std(0x2a2d6a), 0, 1.98, 0)); // chapéu de sábio
  shadowAll(g); return g;
}
function makeTurtle() {
  const g = new THREE.Group(), skin = std(0x8fc46a), shell = std(0x5a8a3a), moss = std(0x3e6a2a);
  g.add(sph(0.8, shell, 0, 0.55, 0, 1.1, 0.7, 1.3), sph(0.82, moss, 0, 0.5, 0, 1.12, 0.5, 1.32));
  [[-0.35, 0.2], [0.35, 0.2], [-0.2, -0.45]].forEach(([x, z], i) => g.add(sph(0.2, std(0xd2b46a), x, 0.95 + (i === 2 ? 0 : 0.05), z, 1, 0.5, 1)));
  g.add(sph(0.32, skin, 0, 0.55, 1.05, 1, 0.9, 1.1)); eyes(g, 0x1a2a1a, 0.62, 1.3, 0.14, 0.07);
  [[-0.55, 0.6], [0.55, 0.6], [-0.55, -0.6], [0.55, -0.6]].forEach(([x, z]) => g.add(cyl(0.2, 0.22, 0.35, skin, x, 0.18, z)));
  g.add(cone(0.07, 0.3, std(0x3e6a2a), 0, 1.15, -0.1)); g.add(sph(0.3, std(0x4fae4a), 0, 1.4, -0.1));  // arvorezinha
  g.userData = {}; shadowAll(g); return g;
}
function makePhoenix() {
  const g = new THREE.Group(), fire = std(0xff9a2e, { emissive: 0xff5a1a, emissiveIntensity: 0.55 }), gold = std(0xffd23f, { emissive: 0xffb300, emissiveIntensity: 0.6 }), red = std(0xe8452e, { emissive: 0xc02010, emissiveIntensity: 0.5 });
  g.add(sph(0.7, fire, 0, 1.0, 0, 0.85, 0.85, 1.3), sph(0.42, gold, 0, 1.6, 0.85, 1, 1, 1));
  eyes(g, 0xff3a1a, 1.68, 1.18, 0.17, 0.08); g.add(cone(0.12, 0.35, std(0xffe08a), 0, 1.55, 1.3, Math.PI / 2, 0));
  [-0.2, 0, 0.2].forEach((x, i) => g.add(cone(0.08, 0.5 - Math.abs(x), red, x, 2.05, 0.8, -0.3, 0)));
  for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.35; g.add(cone(0.14, 1.3, i % 2 ? gold : red, Math.sin(a) * 0.6, 1.1 + Math.cos(a) * 0.2, -1.1, -Math.PI / 2 - 0.3, a * 0.6)); }
  [-0.25, 0.25].forEach(x => g.add(cyl(0.06, 0.09, 0.5, std(0xffb300), x, 0.25, 0.2)));
  const mk = (s) => { const w = new THREE.Group(); w.position.set(s * 0.6, 1.2, 0); const m = box(1.8, 0.07, 1.0, fire, s * 0.9, 0, 0); const t = box(1.2, 0.06, 0.6, gold, s * 1.1, 0.02, -0.3); w.add(m, t); return w; };
  const wl = mk(-1), wr = mk(1); g.add(wl, wr); g.userData = { wings: [wl, wr] }; shadowAll(g); return g;
}
function makeGolem() {
  const g = new THREE.Group(), st = std(0x8a8f98, { roughness: 0.95 }), dk = std(0x6a6f78, { roughness: 0.95 }), moss = std(0x4f8f3a);
  g.add(box(1.0, 0.9, 0.8, st, 0, 0.95, 0), box(0.7, 0.6, 0.6, dk, 0, 1.75, 0.1), box(1.05, 0.2, 0.85, moss, 0, 1.45, 0));
  [-1, 1].forEach(s => { g.add(box(0.35, 0.85, 0.4, dk, s * 0.72, 1.0, 0.05), box(0.4, 0.4, 0.4, st, s * 0.72, 0.5, 0.1), box(0.38, 0.5, 0.45, st, s * 0.3, 0.25, 0)); });
  [-1, 1].forEach(s => g.add(box(0.14, 0.1, 0.05, std(0xffd23f, { emissive: 0xffc000, emissiveIntensity: 1 }), s * 0.17, 1.8, 0.42)));
  g.add(box(0.25, 0.1, 0.25, moss, 0.2, 2.1, 0.1)); g.userData = {}; shadowAll(g); return g;
}

const P = (id, name, make, o) => Object.assign({ id, name, make, scale: 1, mountScale: 1.7, seat: 1.6, speed: 1.3, dmg: 0.7, rate: 1.7, weight: 8 }, o);
export const EXTRA_PETS = [
  P('cat', 'Mimi, Gata Lunar', () => quad({ body: 0x2b3158, belly: 0x4a5598, eye: 0xffd23f, ear: 'cone', tail: 'thin', size: 0.9 }), { perk: { gold: 0.06, txt: '+6% de ouro' }, dmg: 0.7, speed: 1.35, color: 0xffe08a, price: { gold: 1200 } }),
  P('dog', 'Bolt, Cão Corajoso', () => quad({ body: 0xe0a847, belly: 0xf3d79a, dark: 0xb9782a, earDark: true, eye: 0x3a2a1a, ear: 'floppy', tail: 'thin', size: 1.05 }), { perk: { atk: 0.06, txt: '+6% de dano' }, dmg: 0.8, speed: 1.4, color: 0xffc36b, price: { gold: 1500 } }),
  P('bunny', 'Pipoca, Coelha Saltitante', () => quad({ body: 0xffffff, belly: 0xffe8ef, eye: 0xff6f91, ear: 'long', tail: 'ball', size: 0.9, legH: 0.45 }), { perk: { spd: 0.08, txt: '+8% de velocidade' }, dmg: 0.6, speed: 1.7, mountScale: 1.9, color: 0xffb6c8, price: { gold: 1800 } }),
  P('panda', 'Bambu, Panda Guardião', () => quad({ body: 0xf6f6f6, belly: 0xffffff, dark: 0x2a2a30, patches: true, ear: 'round', earDark: true, eye: 0x2a2a30, tail: 'ball', size: 1.1, fat: 1.15 }), { perk: { regen: 0.008, txt: 'Regenera 0,8% da vida por segundo' }, dmg: 0.7, speed: 1.3, color: 0x9be07a, price: { gems: 120 } }),
  P('owl', 'Hoo, Coruja Sábia', makeOwl, { perk: { crit: 0.04, txt: '+4% de crítico' }, dmg: 0.9, rate: 1.5, speed: 1.5, scale: 0.9, mountScale: 1.7, seat: 2.3, color: 0xffd23f, price: { gold: 3000 } }),
  P('wolf', 'Fenrir, Lobo da Lua', () => quad({ body: 0xaab4c8, belly: 0xe6ecf7, dark: 0x6a738a, eye: 0x7fdcff, ear: 'cone', tail: 'fluff', size: 1.15, legH: 0.6 }), { perk: { atk: 0.1, txt: '+10% de dano' }, dmg: 0.9, speed: 1.65, mountScale: 1.55, seat: 1.95, color: 0xbfe6ff, price: { gems: 160 } }),
  P('slime', 'Gelatina, Slime Real', makeSlime, { perk: { gold: 0.05, txt: '+5% de ouro' }, dmg: 0.5, rate: 1.4, speed: 1.2, scale: 0.9, mountScale: 1.6, seat: 1.5, color: 0x7be08a, price: { gold: 900 } }),
  P('turtle', 'Tortuga, Tartaruga Ancestral', makeTurtle, { perk: { regen: 0.015, txt: 'Regenera 1,5% da vida por segundo' }, dmg: 0.5, rate: 2.4, speed: 1.15, scale: 0.9, mountScale: 1.5, seat: 1.6, color: 0x8fc46a, price: { gold: 4000 } }),
  P('phoenix', 'Ignis, Fênix Dourada', makePhoenix, { perk: { atk: 0.12, regen: 0.006, txt: '+12% de dano e regenera 0,6%/s' }, dmg: 1.4, rate: 2.0, speed: 1.9, scale: 0.55, mountScale: 1.0, seat: 2.1, color: 0xff9a2e, price: { cash: 400 } }),
  P('unicorn', 'Aurora, Unicórnio', () => quad({ body: 0xffffff, belly: 0xf3e8ff, eye: 0xb48aff, ear: 'cone', horn: true, mane: true, rainbowTail: true, tail: 'none', size: 1.2, legH: 0.7 }), { perk: { spd: 0.1, gold: 0.05, txt: '+10% de velocidade e +5% de ouro' }, dmg: 1.0, speed: 1.8, mountScale: 1.4, seat: 2.1, color: 0xe6b3ff, price: { cash: 300 } }),
  P('golem', 'Pedrinha, Golem de Pedra', makeGolem, { perk: { crit: 0.06, txt: '+6% de crítico' }, dmg: 1.1, rate: 2.2, speed: 1.35, scale: 0.7, mountScale: 1.2, seat: 2.2, color: 0xd9d27a, price: { gold: 6000 } }),
  P('bear', 'Mel, Urso Dourado', () => quad({ body: 0x9a6a3a, belly: 0xc99a5e, eye: 0x2a1a10, ear: 'round', tail: 'ball', size: 1.15, fat: 1.2 }), { perk: { atk: 0.07, txt: '+7% de dano' }, dmg: 0.9, speed: 1.4, mountScale: 1.5, seat: 1.9, color: 0xffc36b, price: { gold: 2500 } }),
  P('tiger', 'Sombra, Tigre Roxo', () => quad({ body: 0x7a56c8, belly: 0xcbb6f0, dark: 0x2a1a55, stripes: true, eye: 0xffe08a, ear: 'round', tail: 'thin', tailCol: 0x7a56c8, size: 1.15, legH: 0.55 }), { perk: { crit: 0.07, txt: '+7% de crítico' }, dmg: 1.0, speed: 1.7, mountScale: 1.5, seat: 1.9, color: 0xc9a0ff, price: { gems: 200 } }),
];
