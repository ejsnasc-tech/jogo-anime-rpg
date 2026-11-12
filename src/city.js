// Cidade de Aurora (10x maior): portao ao sul, avenida ate a praca da fonte, Mercado a leste, bairro das casas a oeste,
// predios de apartamentos a sudeste, parque com lago a nordeste, Academia a noroeste e o Castelo ao norte.
// Toda a geometria estatica e fundida por "chunks" (uma malha por material e por quadrado do mapa) para ficar leve.
import * as THREE from 'three';
import { PREMADE, buildPlayerHero, BASE } from './data.js';
import { makeHero, animateHero } from './actors.js';

export const CITY_R = 180;
export const CITY_SPAWN = [0, CITY_R - 5];
const D2R = Math.PI / 180, INNER = 28;
const SPOKES = [[0, 9, 176], [90, 11, 180], [180, 9, 176], [270, 11, 131], [45, 6, 165], [135, 6, 165], [225, 6, 165]];   // [angulo, largura, ate que raio]
const RINGS = [[70, 6], [112, 6]];
const MARKET = { x0: 31, x1: 112, hw: 15 };                  // Rua do Mercado ao longo do eixo leste
const LAKE = { x: 63.6, z: -63.6, r: 18 };
const ACAD = { x: -30, z: -92 };
const DECO_SQ = { x: -90, z: 0 };
const GATE_SQ = { x: 0, z: 150 };
const COURT = { x: 0, z: -128 };
const CASTLE = { x: 0, z: -160 };
const FARM = { x: 148, z: 78 };
const LAND = [{ k: 'tavern', x: 21, z: 41, r: 12, t: '🍺 Taverna do Dragão', s: 'Comida • Música • Boatos' }, { k: 'chapel', x: -44.5, z: 18, r: 11, t: '⛪ Capela de Aurora', s: 'Paz e bênçãos' }, { k: 'clock', x: -13, z: -40, r: 6, t: '🕰️ Torre do Relógio', s: 'Hora oficial da cidade' }, { k: 'guild', x: 29, z: -43, r: 11, t: '🏛️ Guilda dos Aventureiros', s: 'Reunião de heróis' }];
const rnd = (() => { let a = 20240611; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
const P1 = (v) => Math.round(v * 10) / 10;

// distancia (da borda) ate a rua em espiral mais proxima: so as avenidas radiais
function spokeDist(x, z) {
  const r = Math.hypot(x, z); let d = 1e9;
  SPOKES.forEach(([a, w, re]) => {
    const ux = Math.cos(a * D2R), uz = Math.sin(a * D2R), t = x * ux + z * uz;
    if (t < INNER - 2 || t > re) return;
    d = Math.min(d, Math.abs(-x * uz + z * ux) - w / 2);
  });
  return d;
}
function roadDist(x, z) { const r = Math.hypot(x, z); let d = spokeDist(x, z); RINGS.forEach(([R, w]) => { d = Math.min(d, Math.abs(r - R) - w / 2); }); return d; }
// areas especiais onde casas e arvores nao entram
function blocked(x, z, pad = 0) {
  const r = Math.hypot(x, z);
  if (r < INNER + 4 + pad) return true;
  if (Math.hypot(x - GATE_SQ.x, z - GATE_SQ.z) < 19 + pad) return true;
  if (Math.hypot(x - COURT.x, z - COURT.z) < 22 + pad) return true;
  if (Math.abs(x - CASTLE.x) < 40 + pad && z < -118 - pad) return true;
  if (x > MARKET.x0 - 4 - pad && x < MARKET.x1 + 6 + pad && Math.abs(z) < 26 + pad) return true;
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 5 + pad) return true;
  if (Math.hypot(x - ACAD.x, z - ACAD.z) < 20 + pad) return true;
  if (Math.hypot(x - DECO_SQ.x, z - DECO_SQ.z) < 16 + pad) return true;
  if (Math.hypot(x - FARM.x, z - FARM.z) < 34 + pad) return true;
  if (LAND.some(l => Math.hypot(x - l.x, z - l.z) < l.r + 4 + pad)) return true;
  return false;
}

// ---- terrenos: casas a oeste, predios a sudeste, em quatro fileiras que acompanham as ruas em anel ----
export const PLOTS = (() => {
  const H = [], A = [];
  const rows = [[70, 1], [70, -1], [112, 1], [112, -1]];   // [raio da rua em anel, +1 = casa por dentro da rua olhando para fora / -1 = por fora olhando para dentro]
  const hh = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const HT = [{ w: 6, d: 5.5, fl: 1, v: 0 }, { w: 9, d: 6, fl: 1, v: 1 }, { w: 6.5, d: 9, fl: 1, v: 2 }, { w: 8, d: 7, fl: 2, v: 3 }, { w: 5.6, d: 5.6, fl: 3, v: 0 }, { w: 10, d: 7, fl: 2, v: 4 }, { w: 7, d: 6.5, fl: 2, v: 2 }];
  const AT = [{ w: 7, d: 6, fl: 4 }, { w: 12, d: 7, fl: 3 }, { w: 9, d: 7, fl: 4 }, { w: 8, d: 8, fl: 5 }, { w: 10.5, d: 6.5, fl: 3 }];
  const lay = (list, kind, a0, a1, sp, T, base) => rows.forEach(([R, dir]) => {
    const rr = R - dir * 8, n = Math.floor((a1 - a0) * D2R * rr / sp);
    for (let i = 0; i < n; i++) {
      const t = T[Math.floor(hh(list.length * 1.7 + R * 0.31 + dir + (kind === 'apt' ? 50 : 0)) * T.length)], off = 4.5 + t.d / 2, r = R - dir * off;
      const a = (a0 + (i + 0.5) * (a1 - a0) / n) * D2R, x = r * Math.cos(a), z = r * Math.sin(a);
      if (spokeDist(x, z) < 7.5 || blocked(x, z, -2)) continue;
      const fx = dir * Math.cos(a), fz = dir * Math.sin(a), big = kind === 'house' ? (t.fl > 1 && t.w * t.d >= 56) : t.w * t.d * t.fl >= 190;
      list.push({ kind, top: kind === 'house' ? 0.7 + t.fl * 3.1 + Math.min(4.4, (t.d + 1.7) * 0.42) + 2.4 : 1.7 + t.fl * 3.3 + 5.5, x: P1(x), z: P1(z), w: t.w, d: t.d, fl: t.fl, v: t.v || 0, price: base + (big ? Math.round(base * 0.5) : 0), ry: Math.atan2(fx, fz), door: [P1(x + fx * (t.d / 2 + 2.4)), P1(z + fz * (t.d / 2 + 2.4))] });
    }
  });
  lay(H, 'house', 100, 226, 14.5, HT, 3000);
  lay(A, 'apt', 12, 87, 17.5, AT, 1200);
  const byDist = (a, b) => Math.hypot(a.x, a.z - 40) - Math.hypot(b.x, b.z - 40);
  H.sort(byDist); A.sort(byDist);
  // os 22 primeiros ids mantem o tipo antigo (8 casas e 14 apartamentos) para nao quebrar quem ja comprou
  const out = [...H.slice(0, 8), ...A.slice(0, 14), ...H.slice(8), ...A.slice(14)];
  let h = 0, a = 0; out.forEach((p, i) => { p.id = 'p' + i; p.name = p.kind === 'house' ? 'Casa ' + (++h) : 'Apto ' + (++a); });
  return out;
})();

// NPCs: pos = onde o NPC fica, ry = para onde olha (a barraca fica atras dele)
export const NPC_DEFS = [
  { role: 'smith', icon: '🔨', color: '#ff8a65', title: 'Gorim, o Ferreiro', pos: [42, -6], ry: 0, premade: 0, talk: 'Armas fortes vencem qualquer floresta! Traga ouro e materiais e eu deixo sua lâmina afiada.' },
  { role: 'armor', icon: '🛡️', color: '#4fc3f7', title: 'Mara, a Armeira', pos: [56, -6], ry: 0, premade: 7, talk: 'Uma boa armadura salva vidas. Já vi muito herói bonito cair por economizar no peitoral.' },
  { role: 'map', icon: '🗺️', color: '#ffd54f', title: 'Shiro, Guia dos Mapas', pos: [99, 6], ry: Math.PI, premade: 2, talk: 'Cada floresta tem seus perigos e seus tesouros. Eu conheço todas. Para onde vamos, viajante?' },
  { role: 'merchant', icon: '💰', color: '#81c784', title: 'Ilyra, Mercadora', pos: [49, 6], ry: Math.PI, premade: 3, talk: 'Amuletos raros e bons preços! E compro tudo o que você coletou nas florestas.' },
  { role: 'deco', icon: '\u{1FA91}', color: '#ffb74d', title: 'Lia, a Decoradora', pos: [38, 6], ry: Math.PI, premade: 5, talk: 'Casa bonita é casa feliz! Compre os móveis aqui e depois coloque onde quiser dentro da sua casa.' },
  { role: 'market', icon: '🏪', color: '#4db6ac', title: 'Bento, o Negociante', pos: [63, 6], ry: Math.PI, premade: 1, talk: 'Aqui os aventureiros negociam entre si! Compre equipamentos de outros jogadores ou ponha os seus à venda.' },
  { role: 'herald', icon: '📯', color: '#e57373', title: 'Vênia, a Arauta', pos: [98, -6], ry: 0, premade: 6, talk: 'Ouçam, ouçam! Rankings, o Chefe Mundial, guildas e as missões do dia. Tudo começa comigo!' },
  { role: 'craft', icon: '⚒️', color: '#a1887f', title: 'Tessa, a Artesã', pos: [82, -6], ry: 0, premade: 3, talk: 'Forjo armas do zero e lapido gemas que fazem seu equipamento brilhar. Traga materiais!' },
  { role: 'summoner', icon: '🔮', color: '#ba68c8', title: 'Orin, o Mestre das Vocações', pos: [86, 6], ry: Math.PI, premade: 4, talk: 'Todo aventureiro pode dominar muitas vocações. Cada uma evolui no seu ritmo. Quer aprender uma nova?' },
];

// bairros (para o aviso ao entrar e para o mapa)
export const DISTRICTS = [
  { id: 'portao', name: 'Praça do Portão', icon: '🚪', x: 0, z: 150, test: (x, z) => Math.hypot(x, z - 150) < 24 },
  { id: 'castelo', name: 'Castelo de Aurora', icon: '🏰', x: 0, z: -135, test: (x, z) => z < -108 && Math.abs(x) < 46 },
  { id: 'mercado', name: 'Mercado Real', icon: '🏪', x: 72, z: 0, test: (x, z) => x > 28 && x < 118 && Math.abs(z) < 24 },
  { id: 'academia', name: 'Academia das Vocações', icon: '🔮', x: ACAD.x, z: ACAD.z, test: (x, z) => Math.hypot(x - ACAD.x, z - ACAD.z) < 26 },
  { id: 'parque', name: 'Parque do Lago', icon: '🌳', x: LAKE.x, z: LAKE.z, test: (x, z) => Math.hypot(x - LAKE.x, z - LAKE.z) < 36 },
  { id: 'praca', name: 'Praça das Casas', icon: '🪑', x: DECO_SQ.x, z: DECO_SQ.z, test: (x, z) => Math.hypot(x - DECO_SQ.x, z - DECO_SQ.z) < 20 },
  { id: 'campo', name: 'Campos e Moinho', icon: '🌾', x: FARM.x, z: FARM.z, test: (x, z) => Math.hypot(x - FARM.x, z - FARM.z) < 40 },
  { id: 'centro', name: 'Praça Central', icon: '⛲', x: 0, z: 0, test: (x, z) => Math.hypot(x, z) < 34 },
  { id: 'casas', name: 'Bairro das Casas', icon: '🏡', x: -80, z: 25, test: (x, z) => { const a = (Math.atan2(z, x) / D2R + 360) % 360, r = Math.hypot(x, z); return r > 34 && r < 135 && a > 92 && a < 232; } },
  { id: 'predios', name: 'Bairro dos Prédios', icon: '🏢', x: 78, z: 82, test: (x, z) => { const a = (Math.atan2(z, x) / D2R + 360) % 360, r = Math.hypot(x, z); return r > 34 && r < 135 && a > 8 && a < 92; } },
];

// ---- colisao: casas, predios, lojas, barracas, castelo etc. sao solidos (o heroi contorna) ----
const SOLIDS = [];   // retangulos girados {x,z,c,s,hw,hd} ou circulos {x,z,r}
const addBox = (x, z, ry, lx, lz, hw, hd) => { const c = Math.cos(ry), s = Math.sin(ry); SOLIDS.push({ x: x + lx * c + lz * s, z: z - lx * s + lz * c, c, s, hw, hd }); };
const addCirc = (x, z, r) => SOLIDS.push({ x, z, r });
(() => {
  PLOTS.forEach(p => {
    addBox(p.x, p.z, p.ry, 0, 0, p.w / 2 + 0.7, p.d / 2 + 0.7);
    if (p.v === 4) addBox(p.x, p.z, p.ry, p.w / 2 + 1.8, -0.5, 2, p.d * 0.35 + 0.2);
    if (p.v === 3) addCirc(p.x + (-p.w / 2) * Math.cos(p.ry) + (p.d / 2 - 0.2) * Math.sin(p.ry), p.z + (p.w / 2) * Math.sin(p.ry) + (p.d / 2 - 0.2) * Math.cos(p.ry), 1.8);
  });
  [[42, -17.5, 0], [56, -17.5, 0], [82, -17.5, 0], [98, -17.5, 0], [49, 17.5, Math.PI], [60, 17.5, Math.PI], [99, 17.5, Math.PI], [38, 17.5, Math.PI], [86, 17.5, Math.PI]].forEach(([x, z, ry]) => addBox(x, z, ry, 0, 0, 5.4, 3.9));
  NPC_DEFS.forEach(d => addBox(d.pos[0] - Math.sin(d.ry) * 2.4, d.pos[1] - Math.cos(d.ry) * 2.4, d.ry, 0, 0, 2.5, 1));
  [[92, 8.3, Math.PI], [105, 8.3, Math.PI], [70, -8.4, 0]].forEach(([x, z, ry]) => addBox(x, z, ry, 0, 0, 2.5, 1));
  LAND.forEach(l => {
    const ry = Math.atan2(-l.x, -l.z);
    if (l.k === 'tavern') addBox(l.x, l.z, ry, 0, 0, 7.7, 5.4);
    else if (l.k === 'chapel') { addBox(l.x, l.z, ry, 0, 1, 4.7, 6.7); addBox(l.x, l.z, ry, 0, 8.2, 2.7, 2.7); }
    else if (l.k === 'clock') addBox(l.x, l.z, ry, 0, 0, 3.4, 3.4);
    else if (l.k === 'guild') addBox(l.x, l.z, ry, 0, 0, 9.2, 4.7);
  });
  addBox(CASTLE.x, CASTLE.z, 0, 0, 0, 24.5, 12.5); addBox(CASTLE.x, CASTLE.z, 0, 0, 5, 31.5, 6.5); addBox(CASTLE.x, CASTLE.z, 0, 0, -17, 30, 5); addBox(CASTLE.x, CASTLE.z, 0, 0, 13, 8.5, 4.7);
  addCirc(ACAD.x, ACAD.z, 7); addBox(ACAD.x, ACAD.z, 0, 0, 10, 8.7, 4.7);
  addCirc(FARM.x, FARM.z, 5); addBox(FARM.x, FARM.z, 0, -12, 12, 4.5, 4);
  addCirc(0, 0, 7.2); addCirc(GATE_SQ.x, GATE_SQ.z, 3.3); addCirc(LAKE.x, LAKE.z, LAKE.r - 0.5); addCirc(108, 0, 2);
  [[-14, 14], [14, 14], [-14, -14], [14, -14]].forEach(([x, z]) => addCirc(x, z, 1.7));
  addCirc(82, -44, 3.9);
})();
export function pushOutCity(p, R = 0.6) {
  for (let it = 0; it < 2; it++) for (let i = 0; i < SOLIDS.length; i++) {
    const s = SOLIDS[i];
    if (s.r !== undefined) { const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz), lim = s.r + R; if (d < lim) { const k = d > 1e-6 ? lim / d : 0; if (k) { p.x = s.x + dx * k; p.z = s.z + dz * k; } else p.x += lim; } continue; }
    const ox = p.x - s.x, oz = p.z - s.z; if (Math.abs(ox) > s.hw + s.hd + R + 1 && Math.abs(oz) > s.hw + s.hd + R + 1) continue;
    const lx = ox * s.c - oz * s.s, lz = ox * s.s + oz * s.c;
    if (Math.abs(lx) > s.hw + R || Math.abs(lz) > s.hd + R) continue;
    const cx = Math.max(-s.hw, Math.min(s.hw, lx)), cz = Math.max(-s.hd, Math.min(s.hd, lz)), ddx = lx - cx, ddz = lz - cz, d = Math.hypot(ddx, ddz);
    let nx, nz;
    if (d > 1e-6) { if (d >= R) continue; nx = lx + ddx / d * (R - d); nz = lz + ddz / d * (R - d); }
    else { const px = s.hw - Math.abs(lx), pz = s.hd - Math.abs(lz); if (px < pz) { nx = Math.sign(lx || 1) * (s.hw + R); nz = lz; } else { nz = Math.sign(lz || 1) * (s.hd + R); nx = lx; } }
    p.x = s.x + nx * s.c + nz * s.s; p.z = s.z - nx * s.s + nz * s.c;
  }
}
const insideSolid = (x, z, pad) => SOLIDS.some(s => {
  if (s.r !== undefined) return Math.hypot(x - s.x, z - s.z) < s.r + pad;
  const ox = x - s.x, oz = z - s.z, lx = ox * s.c - oz * s.s, lz = ox * s.s + oz * s.c; return Math.abs(lx) < s.hw + pad && Math.abs(lz) < s.hd + pad;
});
// camera: devolve ate onde (0..1) da linha heroi->camera da pra ir sem entrar num predio (teto ~12 m; acima disso a camera enxerga por cima)
export function camClear(hx, hz, cx, cy, cz) {
  const H = 1.2, ROOF = 12, N = 36;
  for (let i = 1; i <= N; i++) {
    const t = i / N, y = H + (cy - H) * t;
    if (y > ROOF) return 1;
    if (insideSolid(hx + (cx - hx) * t, hz + (cz - hz) * t, 0.4)) return Math.max(0.18, (i - 1.5) / N);
  }
  return 1;
}
// caminho ate o destino contornando os predios (A* numa grade de 2 m + suavizacao); devolve lista de pontos {x,z}
const NG = 2, NH = Math.ceil((CITY_R + 4) / NG), NW = NH * 2 + 1;
let navBlock = null;
const cellOf = (v) => Math.round(v / NG) + NH;
const navFree = (ix, iz) => ix >= 0 && iz >= 0 && ix < NW && iz < NW && !navBlock[iz * NW + ix];
export function cityPath(fx, fz, tx, tz) {
  if (!navBlock) {
    navBlock = new Uint8Array(NW * NW);
    for (let iz = 0; iz < NW; iz++) for (let ix = 0; ix < NW; ix++) {
      const x = (ix - NH) * NG, z = (iz - NH) * NG, r = Math.hypot(x, z), gate = Math.abs(x) < 6 && z > 0;
      navBlock[iz * NW + ix] = ((!gate && r > CITY_R - 3) || (r > CITY_R + 3) || insideSolid(x, z, 1.1)) ? 1 : 0;
    }
  }
  const nearest = (x, z) => { let ix = cellOf(x), iz = cellOf(z); if (navFree(ix, iz)) return [ix, iz]; for (let r = 1; r < 12; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue; if (navFree(ix + a, iz + b)) return [ix + a, iz + b]; } return null; };
  const s0 = nearest(fx, fz), g0 = nearest(tx, tz); if (!s0 || !g0) return [{ x: tx, z: tz }];
  const N = NW * NW, gS = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  const heap = []; const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top[1]; };
  const sk = s0[1] * NW + s0[0], gk = g0[1] * NW + g0[0]; gS[sk] = 0; push(sk, 0);
  const hq = (k) => Math.hypot((k % NW) - g0[0], ((k / NW) | 0) - g0[1]);
  let found = false;
  while (heap.length) {
    const k = pop(); if (done[k]) continue; done[k] = 1; if (k === gk) { found = true; break; }
    const ix = k % NW, iz = (k / NW) | 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      if (!a && !b) continue; const jx = ix + a, jz = iz + b; if (!navFree(jx, jz)) continue;
      if (a && b && (!navFree(ix + a, iz) || !navFree(ix, iz + b))) continue;
      const j = jz * NW + jx, c = gS[k] + (a && b ? 1.414 : 1); if (c < gS[j]) { gS[j] = c; from[j] = k; push(j, c + hq(j)); }
    }
  }
  if (!found) return [{ x: tx, z: tz }];
  let cells = []; for (let k = gk; k !== -1; k = from[k]) cells.push({ x: ((k % NW) - NH) * NG, z: (((k / NW) | 0) - NH) * NG }); cells.reverse();
  // suavizacao: pula pontos intermediarios quando da para ir em linha reta sem bater em nada
  const clear = (a, b) => { const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.8); for (let i = 1; i < n; i++) { const t = i / n; if (insideSolid(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.9)) return false; } return true; };
  const out = []; let cur = { x: fx, z: fz }, i = 0;
  while (i < cells.length) { let j = cells.length - 1; while (j > i && !clear(cur, cells[j])) j--; out.push(cells[j]); cur = cells[j]; i = j + 1; }
  out.push({ x: tx, z: tz }); return out;
}

function label(text, border, big) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 112;
  const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const draw = (tx, bd) => {
    g.clearRect(0, 0, 512, 112);
    g.fillStyle = 'rgba(10,16,30,.8)'; g.beginPath(); g.roundRect(6, 10, 500, 92, 28); g.fill();
    g.strokeStyle = bd || '#f5c542'; g.lineWidth = 5; g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tx, 256, 58); t.needsUpdate = true;
  };
  draw(text, border);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false, transparent: true }));
  s.scale.set(big ? 6.4 : 5.2, big ? 1.4 : 1.14, 1); s.userData.draw = draw; return s;
}

// ---- gerador de geometria fundida (so posicao + cor por vertice; o sombreado e "flat", entao nao precisa de normais) ----
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
class Batch {
  constructor() { this.buckets = {}; this.units = {}; this.fx = 0; this.fz = 0; this.fy = 0; this.cs = 1; this.sn = 0; this.k = 'm'; }
  frame(x, z, ry = 0) { this.fx = x; this.fz = z; this.fy = ry; this.cs = Math.cos(ry); this.sn = Math.sin(ry); return this; }
  unit(key, make) { return this.units[key] || (this.units[key] = (() => { let g = make(); if (g.index) g = g.toNonIndexed(); return g.attributes.position.array; })()); }
  put(pos, sx, sy, sz, x, y, z, col, ry, rx, rz) {
    const c = this.cs, s = this.sn, wx = this.fx + x * c + z * s, wz = this.fz - x * s + z * c;
    _m.compose(_p.set(wx, y, wz), _q.setFromEuler(_e.set(rx || 0, (ry || 0) + this.fy, rz || 0, 'YXZ')), _s.set(sx, sy, sz));
    const e = _m.elements; _c.set(col);
    const cx = Math.floor(wx / 44), cz = Math.floor(wz / 44), key = this.k + '|' + cx + '|' + cz;
    const b = this.buckets[key] || (this.buckets[key] = { p: [], c: [], k: this.k });
    for (let i = 0; i < pos.length; i += 3) {
      const X = pos[i], Y = pos[i + 1], Z = pos[i + 2];
      b.p.push(e[0] * X + e[4] * Y + e[8] * Z + e[12], e[1] * X + e[5] * Y + e[9] * Z + e[13], e[2] * X + e[6] * Y + e[10] * Z + e[14]);
      b.c.push(_c.r, _c.g, _c.b);
    }
  }
  box(w, h, d, x, y, z, col, ry, rx, rz) { this.put(this.unit('box', () => new THREE.BoxGeometry(1, 1, 1)), w, h, d, x, y + h / 2, z, col, ry, rx, rz); }
  cyl(rt, rb, h, seg, x, y, z, col, ry, rx, rz) { this.put(this.unit('cyl' + rt + '_' + rb + '_' + seg, () => new THREE.CylinderGeometry(rt, rb, 1, seg)), 1, h, 1, x, y + h / 2, z, col, ry, rx, rz); }
  cone(r, h, seg, x, y, z, col, ry) { this.put(this.unit('cone' + seg, () => new THREE.ConeGeometry(1, 1, seg)), r, h, r, x, y + h / 2, z, col, ry); }
  pyr(w, d, h, x, y, z, col, ry) { this.put(this.unit('pyr', () => new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4)), w, h, d, x, y + h / 2, z, col, ry); }
  sph(r, x, y, z, col, sy = 1, seg = 8) { this.put(this.unit('sph' + seg, () => new THREE.SphereGeometry(1, seg, Math.max(4, seg * 0.7 | 0))), r, r * sy, r, x, y, z, col); }
  // prisma de telhado: cumeeira ao longo de x (comprimento len), vao em z (span), altura h
  gable(len, span, h, x, y, z, col, ry) {
    this.put(this.unit('gable', () => { const sh = new THREE.Shape(); sh.moveTo(-0.5, 0); sh.lineTo(0.5, 0); sh.lineTo(0, 1); const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); g.rotateY(Math.PI / 2); return g; }),
      len, h, span, x, y, z, col, ry);
  }
  finish(group, mats) {
    Object.values(this.buckets).forEach(b => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mats[b.k]); m.castShadow = b.k === 'm'; m.receiveShadow = true; m.matrixAutoUpdate = false; m.userData.noOutline = true; group.add(m);
    });
    this.buckets = {};
  }
}

const WALL = [0xf1e6cf, 0xe8d4b0, 0xdde6ee, 0xf2d8d0, 0xdfe9cf], ROOF = [0xc0392b, 0x2e86c1, 0x8b5a2b, 0x2a9d8f, 0xd9822b], TIM = 0x5a3b1e, WOOD = 0x8a5a2b, STONE = 0xa9afb8, DSTONE = 0x7d8591, GLASS = 0x8fdcff;

// janela de frente (plano z = zf): vidro + moldura + peitoril + venezianas
function win(B, x, y, zf, w, h, shut) {
  B.box(w + 0.35, h + 0.35, 0.12, x, y - 0.17, zf, TIM);
  B.k = 'g'; B.box(w, h, 0.2, x, y, zf + 0.02, GLASS); B.k = 'm';
  B.box(w + 0.7, 0.18, 0.45, x, y - 0.3, zf + 0.12, STONE);
  if (shut) [-1, 1].forEach(s => B.box(0.38, h + 0.1, 0.1, x + s * (w / 2 + 0.55), y - 0.05, zf + 0.04, shut));
}
function flowerBox(B, x, y, z, w) {
  B.box(w, 0.32, 0.45, x, y, z, WOOD);
  for (let i = 0; i < 4; i++) B.sph(0.17, x - w / 2 + 0.2 + i * (w - 0.4) / 3, y + 0.42, z, [0xff7f9f, 0xffd166, 0xffffff, 0xb28dff][i], 1, 5);
}
function house(B, i, p) {
  const { w, d, fl, v } = p, fh = 3.1;
  const wc = WALL[i % 5], wc2 = WALL[(i + 2) % 5], rc = ROOF[(i * 3 + 1) % 5], shut = [0x2e86c1, 0x2a9d8f, 0xc0392b, 0x6a4c93][i % 4];
  B.box(w + 0.5, 0.7, d + 0.5, 0, 0, 0, STONE);
  for (let f = 0; f < fl; f++) {
    const ww = w + (f ? 0.5 : 0), dd = d + (f ? 0.5 : 0), y = 0.7 + f * fh;
    B.box(ww, fh, dd, 0, y, 0, f ? wc2 : wc);
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => B.box(0.4, fh, 0.4, sx * ww / 2, y, sz * dd / 2, TIM));
    B.box(ww + 0.25, 0.28, dd + 0.25, 0, y + fh - 0.14, 0, TIM);
    const zf = dd / 2 + 0.02;
    if (f === 0) { for (let x = 1.9; x < w / 2 - 0.6; x += 2.4) [-1, 1].forEach(s => { win(B, s * x, 2.5, zf, 1.2, 1.2, shut); flowerBox(B, s * x, 1.55, zf + 0.15, 1.5); }); }
    else { const n = Math.floor((w / 2 - 0.9) / 2.4); for (let k = -n; k <= n; k++) { win(B, k * 2.4, y + 1.5, zf, 1.1, 1.1, shut); if (k % 2 === 0) flowerBox(B, k * 2.4, y + 0.6, zf + 0.15, 1.5); } }
    [-1, 1].forEach(s => { B.k = 'g'; B.box(0.2, 1.2, 1.2, s * (ww / 2 + 0.03), y + 1.5, 0, GLASS); B.k = 'm'; });
  }
  const top = 0.7 + fl * fh, rh = Math.min(4.4, (d + 1.7) * 0.42);
  B.gable(w + 1.1, d + 1.7, rh, 0, top, 0, rc); B.box(w + 1.2, 0.25, 0.25, 0, top + rh, 0, DSTONE);
  B.box(0.95, rh + 1.4, 0.95, w / 2 - 1.2, top + 0.2, -d / 4, DSTONE); B.box(1.15, 0.22, 1.15, w / 2 - 1.2, top + rh + 1.6, -d / 4, STONE);
  const zd = d / 2 + 0.05;
  B.box(1.45, 2.4, 0.25, 0, 0.7, zd, 0x6b4423); B.box(1.9, 0.28, 0.4, 0, 3.2, zd + 0.1, TIM); B.sph(0.09, 0.45, 1.8, zd + 0.15, 0xffd54f, 1, 4);
  B.box(2.2, 0.28, 1.3, 0, 0.7, zd + 0.75, STONE); B.box(2.6, 0.22, 1.7, 0, 0.5, zd + 0.85, DSTONE);
  if (v === 1) { [-1.7, 1.7].forEach(x => B.cyl(0.14, 0.14, 2.7, 6, x, 0.7, zd + 1.7, 0xf2eee3)); B.box(4.2, 0.25, 2.2, 0, 3.4, zd + 0.9, rc, 0, 0.1); }
  if (v === 2) { B.gable(2.8, 2.8, 1.8, 0, top + rh * 0.12, d / 2 - 0.9, rc, 1.5708); B.k = 'g'; B.box(1.1, 0.9, 0.2, 0, top + 0.8, d / 2 + 0.55, GLASS); B.k = 'm'; }
  if (v === 3) { const h = fl * fh + 1.4; B.cyl(1.5, 1.6, h, 10, -w / 2, 0, d / 2 - 0.2, wc2); B.cone(2.1, 3.2, 10, -w / 2, h, d / 2 - 0.2, rc); B.k = 'g'; B.box(0.8, 1.1, 0.2, -w / 2, h - 1.8, d / 2 + 1.3, GLASS); B.k = 'm'; }
  if (v === 4) { B.box(3.6, 2.8, d * 0.7, w / 2 + 1.8, 0, -0.5, wc2); B.gable(4.2, d * 0.7 + 1, 1.5, w / 2 + 1.8, 2.8, -0.5, rc, 1.5708); win(B, w / 2 + 1.8, 1.6, d * 0.35 - 0.5 + 0.02, 1.1, 1.1, shut); }
  // jardim da frente: caminho, cerquinha e um detalhe que muda de casa para casa
  const hs = Math.abs(Math.sin(i * 12.9898 + 4.1)) * 5 | 0, zg = d / 2 + 3.3;
  B.box(1.7, 0.06, 3.2, 0, 0.02, d / 2 + 2.3, 0xd9c9a6);
  if (i % 4 !== 3) { const L = w / 2 + 1.2 - 1.1; [-1, 1].forEach(s => { B.box(L, 0.6, 0.1, s * (1.1 + L / 2), 0.1, zg, 0xefe6d2); for (let k = 0; k <= Math.floor(L / 1.5); k++) B.box(0.14, 0.8, 0.14, s * (1.1 + k * 1.5), 0, zg, 0xd9cfba); }); }
  [-1, 1].forEach(s => { B.sph(0.55, s * (w / 2 - 0.2), 0.7, d / 2 + 1.3, 0x3a8a3a, 0.9, 6); B.sph(0.15, s * (w / 2 - 0.1), 1.1, d / 2 + 1.7, [0xff8fb0, 0xffd166][(i + (s > 0 ? 1 : 0)) % 2], 1, 4); });
  const sx = i % 2 ? 1 : -1, px = sx * (w / 2 + 2.6 + (v === 4 && sx > 0 ? 3.6 : 0)), pz = d / 2 + 0.6;
  if (hs === 0) tree(B, px, pz - 0.5, 0.85, i % 3 ? 'round' : 'blossom');
  else if (hs === 1) { barrel(B, px, pz); barrel(B, px + 0.2, pz + 1.1); crate(B, px - 1.1, pz + 0.2, 0.3); }
  else if (hs === 2) bench(B, px, pz + 1, 0);
  else if (hs === 3) for (let k = 0; k < 4; k++) B.box(2.4, 0.4, 0.5, px, 0.04, pz - 0.6 + k * 0.85, [0x6aa84f, 0x8cc152, 0xe5c75a, 0x6aa84f][k]);
  else { B.box(2.2, 0.55, 1.2, px, 0.55, pz, WOOD); [-0.9, 0.9].forEach(x => B.cyl(0.42, 0.42, 0.12, 8, px + x, 0, pz + 0.7, TIM, 0, 0, 1.5708)); B.sph(0.4, px, 1.4, pz, 0xe5a13a, 1, 6); }
}
function apt(B, i, p) {
  const { w, d, fl } = p, fh = 3.3, wc = [0xe3d2b8, 0xcfdae4, 0xe9cdb7, 0xd7dfc6, 0xe6c9d0][i % 5], ac = [0xc0392b, 0x2e86c1, 0x2a9d8f, 0xd9822b, 0x8e44ad][i % 5];
  B.box(w + 0.4, 1.2, d + 0.4, 0, 0, 0, DSTONE);
  B.box(w, fl * fh + 0.5, d, 0, 1.2, 0, wc);
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => B.box(0.6, fl * fh + 0.5, 0.6, sx * w / 2, 1.2, sz * d / 2, STONE));
  for (let f = 1; f <= fl; f++) B.box(w + 0.6, 0.25, d + 0.6, 0, 1.2 + f * fh - 0.1, 0, STONE);
  const H = 1.2 + fl * fh + 0.5, zf = d / 2 + 0.02, nx = Math.max(2, Math.floor((w - 1.5) / 3));
  for (let f = 0; f < fl; f++) for (let k = 0; k < nx; k++) {
    const x = (k - (nx - 1) / 2) * (w - 2.4) / Math.max(1, nx - 1) * (nx > 1 ? 1 : 0);
    if (f === 0 && Math.abs(x) < 1.2) continue;
    win(B, x, 2.6 + f * fh, zf, 1.3, 1.5, f % 2 ? ac : 0x6a4c93);
    if (f > 0) { if ((f + k) % 2) { B.box(1.9, 0.2, 1, x, 1.9 + f * fh, zf + 0.5, STONE); B.box(1.9, 0.7, 0.08, x, 2.1 + f * fh, zf + 1, 0x3b3f4a); } else flowerBox(B, x, 1.9 + f * fh, zf + 0.2, 1.7); }
  }
  B.box(1.9, 2.7, 0.25, 0, 1.2, zf + 0.03, 0x6b4423); B.box(3.8, 0.28, 1.8, 0, 4.1, zf + 0.9, ac, 0, 0.18); [-1.8, 1.8].forEach(x => B.cyl(0.08, 0.08, 3, 5, x, 1.2, zf + 1.7, WOOD)); B.box(3, 0.3, 1.6, 0, 1.2, zf + 1.1, STONE);
  [-1, 1].forEach(s => { B.k = 'g'; B.box(0.2, 1.5, 1.4, s * (w / 2 + 0.03), 1.2 + fh * 1.5, 0, GLASS); B.k = 'm'; });
  B.box(w + 0.8, 0.7, d + 0.8, 0, H, 0, 0x6b5a4a);
  if (i % 3 === 0) { B.pyr(w + 0.8, d + 0.8, 3.2 + (fl > 4 ? 1.5 : 0), 0, H + 0.7, 0, ac); }
  else { B.box(w + 0.4, 0.9, d + 0.4, 0, H + 0.7, 0, ac); [-1, 1].forEach(sx => [-1, 1].forEach(sz => B.box(0.55, 0.9, 0.55, sx * (w / 2 + 0.1), H + 1.6, sz * (d / 2 + 0.1), STONE))); B.box(2.2, 1.5, 2.2, w / 4, H + 1.6, -d / 4, WOOD); B.cyl(1.0, 1.0, 1.1, 8, w / 4, H + 3.1, -d / 4, DSTONE); }
  if (fl >= 5) { B.cyl(0.1, 0.1, 3, 4, 0, H + 3.5, 0, 0x333333); B.box(1.6, 0.9, 0.1, 0.8, H + 5.2, 0, 0xf5c542); }
}
function shop(B, i, ac, rf) {   // loja de dois andares do Mercado (frente +z)
  const wc = [0xf0dcc0, 0xe6d3b3, 0xd9e4ec][i % 3];
  B.box(10.4, 0.6, 7.4, 0, 0, 0, STONE); B.box(10, 4.2, 7, 0, 0.6, 0, wc); B.box(10.6, 3.6, 7.6, 0, 4.8, 0, wc);
  [-5, 5].forEach(x => [-3.5, 3.5].forEach(z => B.box(0.45, 8.4, 0.45, x, 0.6, z, TIM)));
  B.box(10.7, 0.3, 7.7, 0, 4.6, 0, TIM);
  B.gable(11.4, 8.6, 3.4, 0, 8.4, 0, rf); B.box(1, 3, 1, 3, 9.8, -1.5, DSTONE);
  for (let k = 0; k < 6; k++) B.box(10.4 / 6, 0.2, 2.2, -5.2 + (k + 0.5) * 10.4 / 6, 3.35, 4.3, k % 2 ? 0xffffff : ac, 0, 0.35);
  B.box(3, 2.6, 0.2, -2.6, 0.7, 3.5, 0x6b4423); B.k = 'g'; B.box(2.6, 2.2, 0.2, 2.4, 1.2, 3.5, GLASS); B.k = 'm';
  B.box(10.3, 0.2, 0.9, 0, 1.7, 3.9, WOOD);
  [-3, 0, 3].forEach(x => win(B, x, 5.7, 3.8, 1.3, 1.4, ac));
}
const steel = 0xb8c2cf, gold = 0xe6b93c;
// o que cada comerciante mostra na frente da sua loja (frente +z)
function shopProps(B, role) {
  if (role === 'smith') {
    B.box(1.7, 7, 1.7, -3.6, 8.2, -1.2, DSTONE); B.box(2.1, 0.3, 2.1, -3.6, 15.2, -1.2, STONE); B.k = 'l'; B.box(1.5, 0.8, 0.3, -2.6, 1.2, 3.62, 0xff7a2a); B.sph(0.5, -3.6, 15.9, -1.2, 0xff9a4a, 0.7, 5); B.k = 'm';
    B.cyl(0.5, 0.6, 0.8, 7, 3.6, 0, 5.2, WOOD); B.box(1.3, 0.4, 0.6, 3.6, 0.8, 5.2, 0x333b45); B.box(0.5, 0.3, 0.4, 4.4, 0.85, 5.2, 0x333b45);
    [-1.5, 0, 1.5].forEach((x, k) => { B.box(0.14, 1.9, 0.06, x + 0.5, 1.6, 3.65, steel); B.box(0.6, 0.12, 0.08, x + 0.5, 2.0, 3.66, gold); });
    B.box(3.8, 0.15, 0.3, 0.5, 1.5, 3.7, TIM); barrel(B, -4.6, 5.4); [0, 1, 2].forEach(k => B.sph(0.3, -2.3 + k * 0.5, 0.3, 5.6, 0x23272e, 0.8, 5));
  } else if (role === 'armor') {
    [-3.4, 3.4].forEach(x => { B.cyl(0.08, 0.08, 1.8, 5, x, 0, 5.2, TIM); B.box(0.9, 1.0, 0.5, x, 1.3, 5.2, steel); B.box(1.5, 0.3, 0.5, x, 2.05, 5.2, steel); B.sph(0.3, x, 2.7, 5.2, steel, 1, 6); B.box(0.12, 0.5, 0.4, x, 3.0, 5.2, 0xc0392b); });
    [[-3, 0x2e86c1], [0, gold], [3, 0xc0392b]].forEach(([x, c]) => { B.cyl(0.85, 0.85, 0.14, 12, x, 3.2, 3.66, c, 0, 1.5708); B.sph(0.25, x, 3.2, 3.78, steel, 1, 5); });
    B.box(3.2, 0.9, 1, 0, 0, 5.3, WOOD); [-1, 0, 1].forEach(x => B.sph(0.34, x, 1.1, 5.3, steel, 0.8, 6));
  } else if (role === 'craft') {
    B.box(3.4, 0.9, 1.2, 3.2, 0, 5.2, WOOD); [0xff4f7a, 0x4fc3f7, 0x66e08a, 0xc9a7ff, 0xffd54f].forEach((c, k) => B.sph(0.22, 2.1 + k * 0.5, 1.2, 5.2, c, 1.3, 4));
    B.box(1.2, 0.4, 0.6, -3.6, 0.8, 5.2, 0x333b45); B.cyl(0.5, 0.6, 0.8, 7, -3.6, 0, 5.2, WOOD); for (let k = 0; k < 4; k++) B.box(0.8, 0.22, 0.4, -2.2, k * 0.22, 5.6, gold);
    B.k = 'l'; B.sph(1.0, 0, 13.4, 0, 0xc9a7ff, 1.8, 4); B.k = 'm'; B.cyl(0.4, 0.4, 1.6, 6, 0, 11.8, 0, DSTONE);
    [-1, 1].forEach(s => { B.box(0.12, 1.3, 0.06, s * 1.3, 1.7, 3.65, steel); B.sph(0.2, s * 1.3, 2.5, 3.65, [0xff4f7a, 0x4fc3f7][s > 0 ? 1 : 0], 1.3, 4); });
  } else if (role === 'merchant') {
    [[-3.6, 5.3], [-2.6, 5.6], [3.6, 5.3]].forEach(([x, z], k) => { B.sph(0.55, x, 0.5, z, 0xd9c8a0, 0.9, 6); B.box(0.5, 0.15, 0.3, x, 1.0, z, 0x8a5a2b); });
    B.box(2.6, 0.9, 1, 2.2, 0, 5.4, WOOD); [0xff7043, 0xffd54f, 0xa5d66b, 0xff7043].forEach((c, k) => B.sph(0.25, 1.4 + k * 0.5, 1.15, 5.4, c, 1, 5));
    B.box(0.14, 3.4, 0.14, 4.7, 0, 5.8, TIM); B.cyl(0.8, 0.8, 0.14, 12, 4.7, 3.6, 5.8, gold, 0, 1.5708); B.k = 'l'; B.sph(0.3, 4.7, 3.6, 5.95, 0xfff0a0, 1, 5); B.k = 'm';
    B.box(3.4, 1.6, 0.3, -0.4, 1.0, 3.7, TIM); [0, 1].forEach(r => [0, 1, 2, 3, 4].forEach(k => B.cyl(0.14, 0.14, 0.4, 5, -1.8 + k * 0.7, 1.3 + r * 0.7, 3.95, [0xe74c3c, 0x3498db, 0x2ecc71, 0x9b59b6, 0xf1c40f][(k + r) % 5])));
  } else if (role === 'market') {
    B.box(2.8, 0.5, 1.6, -3.4, 0.7, 5.4, WOOD); [-4.3, -2.5].forEach(x => B.cyl(0.5, 0.5, 0.12, 8, x, 0.2, 6.3, TIM, 0, 0, 1.5708)); B.box(0.12, 0.7, 0.12, -5.0, 0.7, 5.4, TIM); [0, 1, 2].forEach(k => B.box(0.7, 0.5, 0.7, -4 + k * 0.9, 1.2, 5.4, [0xb98a4f, 0xe5a13a, 0x6aa84f][k]));
    B.box(3.6, 2.2, 0.16, 3.2, 0.9, 5.6, TIM); [0, 1, 2, 3].forEach(k => [0, 1].forEach(r => B.box(0.7, 0.55, 0.06, 1.9 + k * 0.85, 1.2 + r * 1.0, 5.72, [0xfff3b0, 0xffd9d9, 0xd9f0ff, 0xe6ffd9][(k + r) % 4])));
    [-1, 1].forEach(s => { B.cyl(0.08, 0.08, 4.4, 5, s * 5.1, 0, 4.4, TIM); }); for (let k = 0; k < 9; k++) B.cone(0.3, 0.5, 3, -5 + k * 1.25, 4.2 + Math.sin(k / 8 * Math.PI) * -0.5, 4.5, [0xe74c3c, 0xf1c40f, 0x3498db, 0x2ecc71][k % 4], 0);
  } else if (role === 'deco') {
    B.box(2.6, 0.6, 1.1, -3.4, 0.2, 5.4, 0xc0584a); B.box(2.6, 0.9, 0.3, -3.4, 0.6, 4.95, 0xc0584a); [-1.4, 1.4].forEach(s => B.box(0.3, 0.8, 1.1, -3.4 + s, 0.2, 5.4, 0xa84a3f));
    B.box(3.4, 0.05, 2.2, 0, 0.03, 6, 0xd9a05b); B.box(1.4, 0.8, 1.0, 1.4, 0, 6, WOOD); [0.4, 2.4].forEach(x => B.box(0.6, 0.55, 0.6, x, 0, 7.0, 0x8a5a2b));
    B.cyl(0.05, 0.05, 2.6, 5, 4.2, 0, 5.6, 0x353b46); B.k = 'l'; B.sph(0.4, 4.2, 2.8, 5.6, 0xffe9a0, 1, 6); B.k = 'm'; B.cyl(0.3, 0.2, 0.5, 6, 4.2, 0, 5.6, 0x8a5a2b);
    [-4.8, 4.9].forEach(x => { B.cyl(0.35, 0.28, 0.6, 7, x, 0, 6.6, 0xb5652f); B.sph(0.5, x, 1.1, 6.6, 0x3a8a3a, 1, 6); });
    B.box(1.3, 0.1, 0.9, 0, 3.5, 3.7, 0xffffff); B.box(1.3, 2.0, 0.1, 3.6, 1.4, 3.65, 0x8a5a2b); B.k = 'g'; B.box(1.0, 1.7, 0.1, 3.6, 1.5, 3.72, GLASS); B.k = 'm';
  } else if (role === 'map') {
    B.box(2.8, 0.9, 1.5, -3.2, 0, 5.3, WOOD); B.box(2.4, 0.05, 1.2, -3.2, 0.95, 5.3, 0xf3e2b8); B.box(0.4, 0.04, 0.4, -3.6, 1.0, 5.3, 0xc0392b);
    B.cyl(0.12, 0.2, 0.9, 6, 3.4, 0, 5.2, TIM); B.sph(0.6, 3.4, 1.7, 5.2, 0x3a8fd9, 1, 8); B.sph(0.25, 3.7, 1.9, 5.7, 0x6aa84f, 1, 5);
    for (let k = 0; k < 3; k++) B.cyl(0.14, 0.14, 1.1, 6, 1.4 + k * 0.3, 0.1, 5.6 + k * 0.2, 0xe8d6a8, 0, 0, 1.5708);
    B.cyl(0.1, 0.1, 3.8, 5, 5, 0, 5.5, TIM); [[3.4, 0.3, 0xe74c3c], [2.8, -0.3, 0x3498db], [2.2, 0.15, 0x2ecc71]].forEach(([y, r, c]) => B.box(1.7, 0.4, 0.1, 5.8, y, 5.5, c, r));
    B.cyl(1.7, 1.7, 0.04, 14, 0, 0.1, 6.4, gold); B.cyl(0.15, 0.15, 0.06, 6, 0, 0.12, 6.4, 0xc0392b);
  } else if (role === 'summoner') {
    B.cyl(1.2, 1.2, 0.2, 10, 0, 0.02, 6.4, 0x7b4fd6); B.k = 'l'; B.sph(0.5, 0, 1.6, 6.4, 0xc9a7ff, 1, 6); B.k = 'm'; B.cyl(0.25, 0.4, 1.0, 6, 0, 0.2, 6.4, DSTONE);
    [-1, 1].forEach(s => { B.cyl(0.1, 0.1, 5.5, 5, s * 5.2, 0, 4.4, TIM); B.box(1.5, 2.6, 0.1, s * 5.2 + s * 0.8, 3.4, 4.4, 0x7b4fd6); });
    B.box(2.8, 0.9, 1.1, 3.2, 0, 5.4, WOOD); [0xff4f7a, 0x4fc3f7, 0x66e08a].forEach((c, k) => B.cyl(0.2, 0.2, 0.5, 6, 2.4 + k * 0.8, 0.9, 5.4, c));
  } else if (role === 'herald') {
    [-1, 1].forEach(s => { B.cyl(0.1, 0.1, 6.5, 5, s * 5.2, 0, 4.2, TIM); B.box(1.7, 3, 0.1, s * 5.2 + s * 0.9, 3.4, 4.2, s > 0 ? 0xc0392b : 0xf5c542); });
    B.box(4.2, 2.6, 0.2, -2.2, 0.9, 5.2, TIM); for (let k = 0; k < 6; k++) B.box(0.9, 1.0, 0.05, -3.8 + (k % 3) * 1.4, 1.2 + Math.floor(k / 3) * 1.2, 5.34, [0xfff3b0, 0xffd9d9, 0xd9f0ff][k % 3], k * 0.05);
    B.cone(0.7, 2.6, 8, 3.4, 3.3, 5.4, gold, 0); B.sph(0.35, 3.4, 3.1, 5.4, gold, 1, 6);
    B.box(2.4, 1.2, 1.2, 1.6, 0, 5.8, 0xc0392b); B.box(2.6, 0.15, 1.4, 1.6, 1.2, 5.8, gold);
  }
}
// placa de madeira com nome e o que a loja vende (sprite que olha para a camera)
function signLabel(title, sub, border) {
  const c = document.createElement('canvas'); c.width = 768; c.height = 190; const g = c.getContext('2d');
  g.fillStyle = 'rgba(40,24,10,.92)'; g.beginPath(); g.roundRect(6, 8, 756, 174, 30); g.fill(); g.strokeStyle = border || '#f5c542'; g.lineWidth = 8; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff3c4'; g.font = 'bold 66px sans-serif'; g.fillText(title, 384, 76); g.fillStyle = '#ffd89a'; g.font = '40px sans-serif'; g.fillText(sub, 384, 140);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false, transparent: true })); s.scale.set(9.6, 2.38, 1); return s;
}
function tavern(B) {
  B.box(15, 0.6, 10.4, 0, 0, 0, STONE); B.box(14.4, 4.4, 9.8, 0, 0.6, 0, 0xe9d3a8); B.box(15, 3.6, 10.4, 0, 5, 0, 0xd9bf8e);
  [-7.4, 7.4].forEach(x => [-5, 5].forEach(z => B.box(0.5, 8, 0.5, x, 0.6, z, TIM))); B.box(15.2, 0.35, 10.6, 0, 4.8, 0, TIM);
  B.gable(16, 12, 4.6, 0, 8.6, 0, 0x8a3b2a); B.box(1.3, 4.5, 1.3, -4.5, 9.6, -2, DSTONE); B.box(1.3, 4.5, 1.3, 4.5, 9.6, -2, DSTONE);
  B.box(2.6, 3, 0.25, 0, 0.6, 5.0, 0x5a3b1e); [-4.6, 4.6, -2.6, 2.6].forEach((x, k) => { if (Math.abs(x) > 3) win(B, x, 2.3, 4.95, 1.5, 1.4, 0xc0392b); });
  [-5.2, -2.2, 2.2, 5.2].forEach(x => win(B, x, 5.9, 5.25, 1.3, 1.4, 0x6a4c93));
  B.box(0.14, 0.14, 2.2, 0, 7.4, 6.5, 0x333b45); B.box(2.4, 1.5, 0.12, 0, 6.2, 6.5, 0xb98a4f); B.cyl(0.55, 0.55, 0.9, 8, 0, 6.2, 6.62, gold, 0, 1.5708);
  [[-6.2, 6.4], [-5.2, 6.8], [6.2, 6.4]].forEach(([x, z]) => barrel(B, x, z)); B.box(3.2, 0.2, 1.1, 5.8, 0.9, 7, WOOD); [4.6, 7.0].forEach(x => B.box(0.8, 0.9, 0.8, x, 0, 7, 0x8a5a2b));
  B.k = 'l'; [-4.6, 4.6].forEach(x => B.box(1.2, 1.0, 0.1, x, 1.8, 5.05, 0xffcf7a)); B.k = 'm';
}
function chapel(B) {
  const S = 0xefeadf; B.box(9, 0.5, 13, 0, 0, 1, STONE); B.box(8, 7.5, 12, 0, 0.5, 1, S); B.gable(13, 9.4, 4.4, 0, 8, 1, 0x9a4a37, 1.5708);
  B.box(4.6, 15, 4.6, 0, 0.5, 8.2, S); B.pyr(5.6, 5.6, 6.5, 0, 15.5, 8.2, 0x2e5d9a); B.box(0.2, 2.2, 0.2, 0, 21.8, 8.2, gold); B.box(1.2, 0.2, 0.2, 0, 22.8, 8.2, gold);
  B.k = 'g'; B.box(1.5, 2.8, 0.2, 0, 10.5, 10.55, GLASS); B.box(2.6, 4.2, 0.2, 0, 2.8, 10.55, 0xffd9a8); [-1, 1].forEach(s => [-2.5, 2.5].forEach(z => B.box(0.2, 3.4, 1.1, s * 4.03, 3.4, z + 1, GLASS))); B.k = 'm';
  B.box(2.6, 3.8, 0.3, 0, 0.5, 10.5, 0x6b4423); B.cyl(1.3, 1.3, 0.3, 10, 0, 4.3, 10.5, 0x6b4423, 0, 1.5708);
  for (let i = 0; i < 3; i++) B.box(4.4 + i, 0.3, 1.2, 0, i * 0.3, 11.6 + (2 - i) * 1.2, i % 2 ? DSTONE : STONE);
}
function clocktower(B) {
  B.box(6.4, 0.6, 6.4, 0, 0, 0, STONE); B.box(5.4, 14, 5.4, 0, 0.6, 0, 0xd6cdbb); B.box(6.2, 0.6, 6.2, 0, 14.6, 0, DSTONE); B.box(5.6, 5.2, 5.6, 0, 15.2, 0, 0xd6cdbb); B.pyr(7, 7, 6.5, 0, 20.4, 0, 0x2e5d9a);
  [[0, 2.8, 0], [0, -2.8, 0], [2.8, 0, 1.5708], [-2.8, 0, 1.5708]].forEach(([x, z, r]) => { B.k = 'l'; B.cyl(2, 2, 0.2, 18, x, 17.8, z, 0xfff6d9, r, r ? 0 : 1.5708, r ? 1.5708 : 0); B.k = 'm'; });
  [-1, 1].forEach(s => B.box(0.18, 1.6, 0.1, 0, 17.8, s * 2.95, 0x23272e)); B.box(1.3, 0.14, 0.1, 0.5, 17.8, 3.0, 0x23272e);
  B.cyl(0.1, 0.1, 3, 4, 0, 26.9, 0, 0x333333); B.box(1.6, 0.9, 0.1, 0.8, 29, 0, 0xf5c542); B.box(1.6, 2.6, 0.2, 0, 0.6, 2.75, 0x5a3b1e);
}
function guild(B) {
  B.box(18, 0.6, 9, 0, 0, 0, STONE); B.box(17.4, 6, 8.4, 0, 0.6, 0, 0xe2d7c1); B.box(18, 0.5, 9, 0, 6.6, 0, DSTONE);
  for (let i = 0; i < 8; i++) B.box(1.6, 1.4, 1.2, -7.7 + i * 2.2, 7.1, 4, DSTONE);
  [-7, 7].forEach(x => { B.cyl(2.2, 2.4, 11, 10, x, 0, 0, 0xcfc6b2); B.cone(3, 4.5, 10, x, 11, 0, 0xc0392b); });
  B.box(3, 4, 0.3, 0, 0.6, 4.3, 0x5a3b1e); [-4.5, 4.5].forEach(x => win(B, x, 2.8, 4.25, 1.6, 1.8, 0x2e86c1)); [-6, -3, 3, 6].forEach((x, k) => { B.box(1.8, 5, 0.12, x, 1.8, 4.35, [0xc0392b, 0xf5c542, 0x2e86c1, 0x2a9d8f][k]); });
  B.cyl(0.1, 0.1, 5, 4, 0, 7.1, 0, 0x333333); B.box(2.2, 1.3, 0.1, 1.1, 10.4, 0, 0xf5c542);
}

function stall(B, x, z, ry, col) {   // barraca: NPC fica na frente (direcao +z local)
  B.frame(x, z, ry);
  B.box(4.4, 1.2, 1.5, 0, 0, 0, WOOD); B.box(4.6, 0.14, 1.8, 0, 1.2, 0.1, TIM);
  [-2, 2].forEach(px => B.cyl(0.1, 0.1, 3.7, 6, px, 0, -0.55, TIM));
  for (let k = 0; k < 6; k++) B.box(4.8 / 6, 0.12, 3, -2.4 + (k + 0.5) * 4.8 / 6, 3.5, 0.15, k % 2 ? 0xffffff : col, 0, 0.3);
  B.box(4.8, 0.45, 0.14, 0, 3.0, 1.55, col);
  B.box(3.9, 2.8, 0.15, 0, 1.2, -1.15, TIM);
  B.box(1.2, 0.8, 0.9, -1.4, 1.34, 0.1, WOOD); B.box(0.9, 0.6, 0.9, 0.3, 1.34, 0.1, col); B.sph(0.38, 1.4, 1.75, 0.1, [0xff7043, 0xffd54f, 0xa5d66b][((x + z) | 0) % 3 < 0 ? 0 : 1], 1, 6);
  B.frame(0, 0, 0);
}
function lamp(B, x, z) { B.cyl(0.13, 0.19, 3.6, 6, x, 0, z, 0x353b46); B.box(0.7, 0.14, 0.7, x, 3.6, z, 0x353b46); B.k = 'l'; B.sph(0.38, x, 4.0, z, 0xffe9a0, 1, 6); B.k = 'm'; B.pyr(0.8, 0.8, 0.45, x, 4.35, z, 0x353b46); }
function tree(B, x, z, sc, type) {
  const t = type || 'pine';
  if (t === 'pine') {
    B.cyl(0.25 * sc, 0.38 * sc, 1.5 * sc, 5, x, 0, z, 0x6b4423);
    [[1.8, 2.8, 1.1, 0x2f7d32], [1.45, 2.6, 2.5, 0x3c9a3f], [1.0, 2.3, 3.8, 0x4caf50]].forEach(([r, h, y, c]) => B.cone(r * sc, h * sc, 7, x, y * sc, z, c));
  } else {
    B.cyl(0.28 * sc, 0.4 * sc, 2.4 * sc, 5, x, 0, z, 0x6b4423);
    const cols = t === 'blossom' ? [0xffb7d5, 0xff9fc5] : t === 'autumn' ? [0xf08a24, 0xe5b023] : [0x4da84f, 0x3c9a3f];
    B.sph(2.0 * sc, x, 3.7 * sc, z, cols[0], 0.9, 8); B.sph(1.3 * sc, x + 0.9 * sc, 4.5 * sc, z + 0.4 * sc, cols[1], 0.9, 7); B.sph(1.2 * sc, x - 0.8 * sc, 4.2 * sc, z - 0.5 * sc, cols[1], 0.9, 7);
  }
}
function bush(B, x, z, flower) { B.sph(0.9, x, 0.6, z, 0x3a8a3a, 0.8, 6); if (flower) for (let i = 0; i < 4; i++) B.sph(0.16, x + Math.cos(i * 1.7) * 0.6, 0.9 + (i % 2) * 0.2, z + Math.sin(i * 1.7) * 0.6, flower, 1, 4); }
function bench(B, x, z, ry) { B.frame(x, z, ry); B.box(2.4, 0.18, 0.7, 0, 0.7, 0, WOOD); B.box(2.4, 0.6, 0.12, 0, 0.9, -0.3, WOOD); B.box(0.18, 0.7, 0.6, -1, 0, 0, TIM); B.box(0.18, 0.7, 0.6, 1, 0, 0, TIM); B.frame(0, 0, 0); }
function statue(B, x, z, ry, col) { B.frame(x, z, ry); B.box(2.2, 1.3, 2.2, 0, 0, 0, STONE); B.box(1.7, 0.5, 1.7, 0, 1.3, 0, DSTONE); B.cyl(0.4, 0.55, 1.9, 6, 0, 1.8, 0, col); B.sph(0.42, 0, 4.0, 0, col, 1, 7); B.box(0.12, 1.8, 0.12, 0.7, 2.0, 0.2, 0xdfe6ee); B.frame(0, 0, 0); }
function barrel(B, x, z) { B.cyl(0.55, 0.55, 1, 7, x, 0, z, 0x8a5a2b); B.cyl(0.58, 0.58, 0.1, 7, x, 0.2, z, 0x3b3b3b); B.cyl(0.58, 0.58, 0.1, 7, x, 0.7, z, 0x3b3b3b); }
function crate(B, x, z, ry) { B.box(0.9, 0.9, 0.9, x, 0, z, 0xb98a4f, ry); B.box(0.95, 0.12, 0.95, x, 0.4, z, 0x8a5a2b, ry); }

export function buildCity() {
  const group = new THREE.Group();
  const B = new Batch();
  const mats = {
    m: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, side: THREE.DoubleSide }),
    g: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, flatShading: true, emissive: 0x1a4a6a }),
    l: new THREE.MeshBasicMaterial({ vertexColors: true }),
  };
  const stdMat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.95 }, o));
  const loadTex = (m, name, rx, ry) => {
    const im = new Image();
    im.onload = () => { const t = new THREE.Texture(im); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; m.map = t; m.color.setHex(0xffffff); m.needsUpdate = true; };
    im.src = BASE + 'img/city/' + name + '.webp'; return m;
  };
  const worldUV = (g, s) => { const p = g.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) * s; uv[i * 2 + 1] = p.getZ(i) * s; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g; };
  const flatGeo = (g) => { g.rotateX(-Math.PI / 2); return g; };
  const mergeIdx = (gs) => {   // junta geometrias indexadas (posicao/normal/uv)
    let n = 0, ni = 0; gs.forEach(g => { n += g.attributes.position.count; ni += g.index.count; });
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), I = new Uint32Array(ni); let o = 0, oi = 0;
    gs.forEach(g => { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); U.set(g.attributes.uv.array, o * 2); for (let k = 0; k < g.index.count; k++) I[oi + k] = g.index.array[k] + o; o += g.attributes.position.count; oi += g.index.count; });
    const r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.BufferAttribute(P, 3)); r.setAttribute('normal', new THREE.BufferAttribute(N, 3)); r.setAttribute('uv', new THREE.BufferAttribute(U, 2)); r.setIndex(new THREE.BufferAttribute(I, 1)); return r;
  };
  const layer = (geo, mat, y, off) => { mat.polygonOffset = true; mat.polygonOffsetFactor = -off; mat.polygonOffsetUnits = -off * 2; const m = new THREE.Mesh(geo, mat); m.position.y = y; m.receiveShadow = true; m.userData.noOutline = true; group.add(m); return m; };

  // ---- chão: gramado, ruas (areia), praças e Rua do Mercado (calçada) ----
  { const o = new THREE.Mesh(new THREE.CircleGeometry(CITY_R + 3, 128).rotateX(-Math.PI / 2), loadTex(stdMat(0x9fcf7a), 'grama', 260, 260)); o.position.y = 0.03; o.receiveShadow = true; o.userData.noOutline = true; group.add(o); }
  const roadG = [], plazaG = [];
  RINGS.forEach(([R, w]) => roadG.push(worldUV(flatGeo(new THREE.RingGeometry(R - w / 2, R + w / 2, 160)), 0.5)));
  SPOKES.forEach(([a, w, re]) => { const len = re - INNER + 2, g = new THREE.PlaneGeometry(len, w).rotateX(-Math.PI / 2).rotateY(-a * D2R), mid = (INNER - 2 + re) / 2; g.translate(Math.cos(a * D2R) * mid, 0, Math.sin(a * D2R) * mid); roadG.push(worldUV(g, 0.5)); });
  layer(mergeIdx(roadG), loadTex(stdMat(0xc9b48a), 'rua', 1, 1), 0.05, 1);
  const disc = (x, z, r) => { const g = new THREE.CircleGeometry(r, 64).rotateX(-Math.PI / 2); g.translate(x, 0, z); plazaG.push(worldUV(g, 0.4)); };
  disc(0, 0, INNER); disc(GATE_SQ.x, GATE_SQ.z, 16); disc(COURT.x, COURT.z, 20); disc(DECO_SQ.x, DECO_SQ.z, 11); disc(ACAD.x, ACAD.z + 23, 12);
  { const g = new THREE.PlaneGeometry(MARKET.x1 - MARKET.x0, MARKET.hw * 2).rotateX(-Math.PI / 2); g.translate((MARKET.x0 + MARKET.x1) / 2, 0, 0); plazaG.push(worldUV(g, 0.4)); }
  layer(mergeIdx(plazaG), loadTex(stdMat(0xcbbfa8), 'calcada', 1, 1), 0.07, 2);
  // aneis decorativos da praca central
  [[9.5, 10.2], [18, 18.7], [26.6, 28]].forEach(([a, b]) => { const g = new THREE.RingGeometry(a, b, 64).rotateX(-Math.PI / 2); layer(g, new THREE.MeshStandardMaterial({ color: 0x8e8470, roughness: 1 }), 0.09, 3); });
  layer(new THREE.CircleGeometry(9.5, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: 1 }), 0.085, 3);
  { const g = new THREE.CircleGeometry(15, 40).rotateX(-Math.PI / 2); g.translate(ACAD.x, 0, ACAD.z + 23); layer(g, new THREE.MeshBasicMaterial({ color: 0x7b4fd6, transparent: true, opacity: 0.35 }), 0.1, 4).renderOrder = 1; }
  // lago do parque
  let waterTex;
  { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, '#3fb6e0'); gr.addColorStop(0.5, '#4fc9e8'); gr.addColorStop(1, '#38a9d8'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.lineCap = 'round';
    for (let i = 0; i < 70; i++) { const x = rnd() * 256, y = rnd() * 256, l = 14 + rnd() * 26; g.strokeStyle = rnd() < 0.7 ? 'rgba(255,255,255,0.28)' : 'rgba(20,110,170,0.22)'; g.lineWidth = 2 + rnd() * 2; for (const ox of [-256, 0, 256]) { g.beginPath(); g.moveTo(x + ox, y); g.quadraticCurveTo(x + ox + l / 2, y - 5, x + ox + l, y); g.stroke(); } }
    waterTex = new THREE.CanvasTexture(c); waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterTex.repeat.set(5, 5); waterTex.colorSpace = THREE.SRGBColorSpace; }
  { const wm = new THREE.MeshStandardMaterial({ map: waterTex, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.95 });
    const g = new THREE.CircleGeometry(LAKE.r, 56).rotateX(-Math.PI / 2); g.translate(LAKE.x, 0, LAKE.z); layer(g, wm, 0.12, 4);
    const s = new THREE.RingGeometry(LAKE.r - 0.3, LAKE.r + 2.4, 56).rotateX(-Math.PI / 2); s.translate(LAKE.x, 0, LAKE.z); layer(s, new THREE.MeshStandardMaterial({ color: 0xe5d4a6, roughness: 1 }), 0.07, 2); }

  // ---- praça central: fonte grande, canteiros, bancos e estátuas ----
  B.frame(0, 0, 0);
  B.cyl(6.4, 6.8, 1.3, 28, 0, 0, 0, STONE); B.cyl(5.7, 5.7, 0.2, 28, 0, 1.25, 0, 0x4fc3f7); B.cyl(0.9, 1.2, 3.2, 10, 0, 1.2, 0, STONE);
  B.cyl(3, 1, 0.6, 18, 0, 4.2, 0, STONE); B.cyl(2.7, 2.7, 0.12, 18, 0, 4.78, 0, 0x4fc3f7); B.cyl(0.4, 0.55, 1.6, 8, 0, 4.7, 0, STONE); B.cyl(1.5, 0.4, 0.4, 12, 0, 6.2, 0, STONE);
  B.k = 'l'; B.sph(0.95, 0, 7.4, 0, 0x8fe3ff, 1, 8); B.k = 'm';
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283, c = Math.cos(a), s = Math.sin(a); B.sph(0.45, c * 6.8, 1.4, s * 6.8, 0xdff6ff, 1, 5); B.cyl(0.14, 0.2, 1.0, 5, c * 6.8, 1.2, s * 6.8, STONE); }
  const FC = [0xff7f9f, 0xffd166, 0xffffff, 0xb28dff, 0xff8a65];
  for (let i = 0; i < 40; i++) { const a = i / 40 * 6.283, r = 8.4 + (i % 2) * 0.6; B.sph(0.3, Math.cos(a) * r, 0.34, Math.sin(a) * r, FC[i % 5], 1, 5); B.cyl(0.04, 0.04, 0.3, 4, Math.cos(a) * r, 0, Math.sin(a) * r, 0x3a8a3a); }
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * 6.283; bench(B, Math.cos(a) * 20, Math.sin(a) * 20, -a + Math.PI / 2); lamp(B, Math.cos(a) * 23.5, Math.sin(a) * 23.5); }
  [[-14, 14], [14, 14], [-14, -14], [14, -14]].forEach(([x, z], i) => { statue(B, x, z, Math.atan2(-x, -z), [0xd9b04a, 0xc0c8d4][i % 2]); });

  // ---- praça do portão ----
  B.cyl(2.6, 2.9, 0.9, 16, GATE_SQ.x, 0, GATE_SQ.z, STONE); B.cyl(2.2, 2.2, 0.1, 16, GATE_SQ.x, 0.85, GATE_SQ.z, 0x4fc3f7); B.cyl(0.4, 0.5, 1.8, 8, GATE_SQ.x, 0.9, GATE_SQ.z, STONE); B.k = 'l'; B.sph(0.5, GATE_SQ.x, 3.0, GATE_SQ.z, 0x8fe3ff, 1, 6); B.k = 'm';
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + 0.5; lamp(B, GATE_SQ.x + Math.cos(a) * 14, GATE_SQ.z + Math.sin(a) * 14); }
  bench(B, -8, 156, Math.PI); bench(B, 8, 156, Math.PI); bench(B, 11, 144, -1.6); bench(B, -11, 152, 1.6);
  B.frame(10, 144, 0.3); B.box(0.2, 2.2, 0.2, -1.1, 0, 0, TIM); B.box(0.2, 2.2, 0.2, 1.1, 0, 0, TIM); B.box(3, 1.4, 0.18, 0, 1.0, 0.05, 0xd9c28a); B.box(0.5, 0.6, 0.05, -0.8, 1.5, 0.15, 0xffffff); B.box(0.5, 0.6, 0.05, 0.1, 1.4, 0.15, 0xfff3b0); B.frame(0, 0, 0);

  // ---- Castelo de Aurora ----
  {
    const S = 0xdcd5c7, S2 = 0xb9b2a4, RD = 0xb83a2c;
    B.frame(CASTLE.x, CASTLE.z, 0);
    B.box(46, 14, 22, 0, 0, 0, S); B.box(48, 1.2, 24, 0, 14, 0, S2);
    for (let i = 0; i < 17; i++) { const x = -23 + i * 2.875; B.box(1.6, 1.7, 1.2, x, 15.2, 11.7, S2); B.box(1.6, 1.7, 1.2, x, 15.2, -11.7, S2); }
    B.box(22, 32, 20, 0, 0, -9, S); B.box(24, 1.4, 22, 0, 32, -9, S2); B.pyr(26, 24, 15, 0, 33.4, -9, RD);
    B.cyl(0.15, 0.15, 7, 4, 0, 48.4, -9, 0x333333); B.box(4.5, 2.4, 0.15, 2.3, 52.5, -9, 0xf5c542);
    [-1, 1].forEach(s => {
      B.cyl(5.4, 6, 30, 14, s * 25, 0, 5, S); B.cyl(6.4, 6.4, 1.4, 14, s * 25, 30, 5, S2); B.cone(7, 12, 14, s * 25, 31.4, 5, RD);
      B.cyl(0.12, 0.12, 5, 4, s * 25, 43.4, 5, 0x333333); B.box(3.2, 1.8, 0.12, s * 25 + 1.6, 46.4, 5, s > 0 ? 0xf5c542 : 0x2e86c1);
      B.cyl(4.2, 4.6, 20, 12, s * 25, 0, -17, S); B.cone(5.2, 8, 12, s * 25, 20, -17, RD);
      B.k = 'g'; [8, 14, 22].forEach(y => B.box(1.2, 2.2, 1.2, s * 25, y, 10.3, GLASS)); B.k = 'm';
    });
    B.box(16, 20, 9, 0, 0, 13, S); B.box(17.4, 1.2, 10.4, 0, 20, 13, S2);
    for (let i = 0; i < 6; i++) B.box(1.6, 1.7, 1.2, -7 + i * 2.8, 21.2, 17.7, S2);
    B.pyr(18, 11, 6, 0, 21.2, 13, RD);
    B.box(7, 10, 0.7, 0, 0, 17.4, 0x2b2118); B.cyl(3.5, 3.5, 0.7, 14, 0, 10, 17.4, 0x2b2118, 0, Math.PI / 2);
    B.k = 'l'; B.box(5.4, 8, 0.2, 0, 0, 17.65, 0xffcf7a); B.cyl(2.7, 2.7, 0.2, 12, 0, 8, 17.65, 0xffcf7a, 0, Math.PI / 2); B.k = 'm';
    [-2.6, 0, 2.6].forEach(x => B.box(0.14, 8.6, 0.3, x, 0, 17.75, 0x3b3b3b));
    B.k = 'g'; for (let i = 0; i < 6; i++) { const x = -19 + i * 7.6; if (Math.abs(x) < 9) continue; [4.5, 9.5].forEach(y => B.box(1.6, 2.6, 0.2, x, y, 11.05, GLASS)); } B.k = 'm';
    [[-14, 0xc0392b], [-9.6, 0xf5c542], [9.6, 0xf5c542], [14, 0x2e86c1]].forEach(([x, c]) => { B.box(2.2, 6.5, 0.14, x, 6, 11.15, c); B.pyr(2.2, 0.3, 1.1, x, 5, 11.15, c, 0, 0); });
    for (let i = 0; i < 6; i++) B.box(15 + (5 - i) * 1.4, 0.4, 1.7, 0, i * 0.4, 19.2 + (5 - i) * 1.5, i % 2 ? DSTONE : STONE);
    B.frame(0, 0, 0);
    // jardim: sebes, canteiros, estatuas e a Via Real
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < 6; i++) { B.box(4, 1.4, 1.2, s * (26 + i * 4.2), 0, -113, 0x2f7d32); B.box(4, 1.4, 1.2, s * (30 + i * 4.2), 0, -146, 0x2f7d32); }
      for (let i = 0; i < 6; i++) bush(B, s * (33 + i * 2.4), -119 + (i % 2) * 14, FC[i % 5]);
      statue(B, s * 10, -121, 0, s > 0 ? 0xd9b04a : 0xc0c8d4); lamp(B, s * 7, -111); lamp(B, s * 12, -127); lamp(B, s * 7, -138);
    }
  }

  // ---- Academia das Vocações ----
  {
    B.frame(ACAD.x, ACAD.z, 0); const S = 0xd4cfe6, S2 = 0x9d90c8, BL = 0x5b4bb2;
    B.cyl(5.8, 6.4, 26, 14, 0, 0, 0, S); B.cyl(7, 7, 1.2, 14, 0, 26, 0, S2); B.cone(7.4, 12, 14, 0, 27.2, 0, BL); B.k = 'l'; B.sph(1.1, 0, 41, 0, 0xc9a7ff, 1, 8); B.k = 'm';
    B.cyl(4.4, 4.4, 1, 12, 0, 18, 0, S2);
    B.box(17, 10, 9, 0, 0, 10, S); B.gable(18, 11, 4.2, 0, 10, 10, BL);
    B.k = 'g'; [-5, 0, 5].forEach(x => { B.box(1.8, 3.4, 0.2, x, 3.4, 14.55, GLASS); }); [8, 14, 20].forEach(y => B.box(1.1, 2, 0.2, 0, y, 6.1, GLASS)); B.k = 'm';
    B.box(2.6, 3.8, 0.25, 0, 0, 14.5, 0x4a2f70); B.box(5, 0.3, 2.2, 0, 4, 15.1, BL, 0, 0.2);
    [-1, 1].forEach(s => { B.cyl(0.35, 0.4, 5, 6, s * 3.8, 0, 16, S2); B.k = 'l'; B.sph(0.5, s * 3.8, 5.4, 16, 0xc9a7ff, 1, 6); B.k = 'm'; });
    for (let i = 0; i < 4; i++) B.box(7 + i, 0.4, 1.6, 0, i * 0.35, 16.4 + (3 - i) * 1.4, i % 2 ? DSTONE : STONE);
    B.frame(0, 0, 0);
  }
  // ---- Praça das Casas: poço e canteiros ----
  B.cyl(1.3, 1.5, 1.1, 10, DECO_SQ.x - 4, 0, DECO_SQ.z - 3, STONE); B.cyl(0.9, 0.9, 0.05, 10, DECO_SQ.x - 4, 1.05, DECO_SQ.z - 3, 0x4fc3f7);
  [-1.2, 1.2].forEach(s => B.cyl(0.1, 0.1, 2.4, 5, DECO_SQ.x - 4 + s, 1.1, DECO_SQ.z - 3, TIM)); B.box(3, 0.2, 1.8, DECO_SQ.x - 4, 3.4, DECO_SQ.z - 3, TIM); B.gable(3.4, 2.6, 0.9, DECO_SQ.x - 4, 3.6, DECO_SQ.z - 3, 0xc0392b);
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + 0.4; bench(B, DECO_SQ.x + Math.cos(a) * 8.5, DECO_SQ.z + Math.sin(a) * 8.5, -a + Math.PI / 2); }

  // ---- casas e predios (um por terreno) + aneis para tocar ----
  PLOTS.forEach((p, i) => { B.frame(p.x, p.z, p.ry); if (p.kind === 'house') house(B, i, p); else apt(B, i, p); });
  B.frame(0, 0, 0);

  // ---- Mercado Real: barracas, lojas, lanternas e cargas ----
  const stallCols = ['#ff8a65', '#4fc3f7', '#a1887f', '#81c784', '#4db6ac'];
  NPC_DEFS.forEach(d => { if (d.role === 'smith' || d.role === 'armor' || d.role === 'craft' || d.role === 'merchant' || d.role === 'market' || d.role === 'map' || d.role === 'deco' || d.role === 'herald' || d.role === 'summoner') { const c = new THREE.Color(d.color).getHex(); stall(B, d.pos[0] - Math.sin(d.ry) * 2.4, d.pos[1] - Math.cos(d.ry) * 2.4, d.ry, c); } });
  [[92, 8.3, Math.PI, 0xe57373], [105, 8.3, Math.PI, 0x4db6ac], [70, -8.4, 0, 0xffd54f]].forEach(([x, z, ry, c]) => { if (Math.abs(x - 70) < 4 && z > 0) return; stall(B, x, z, ry, c); barrel(B, x + 2.6, z + (z > 0 ? -1 : 1)); crate(B, x - 2.7, z + (z > 0 ? -1.2 : 1.2), 0.3); });
  // cada comerciante tem a sua loja atras da barraca, com as coisas que vende na frente e uma placa dizendo o que oferece
  const signs = [];
  const sign = (x, y, z, t, sb, bd) => { const sp = signLabel(t, sb, bd); sp.position.set(x, y, z); sp.userData.noOutline = true; signs.push(sp); };
  const PI = Math.PI, ROLE_SHOP = {
    smith: { x: 42, z: -17.5, ry: 0, ac: 0xff8a65, rf: 0x4a4f5a, t: '🔨 Forja do Gorim', s: 'Armas • Melhorias', y: 18 },
    armor: { x: 56, z: -17.5, ry: 0, ac: 0x4fc3f7, rf: 0x2e5d9a, t: '🛡️ Armaria da Mara', s: 'Armaduras • Escudos', y: 14.2 },
    craft: { x: 82, z: -17.5, ry: 0, ac: 0xa1887f, rf: 0x6a4c93, t: '⚒️ Ateliê da Tessa', s: 'Forja de armas • Gemas', y: 16.6 },
    merchant: { x: 49, z: 17.5, ry: PI, ac: 0x81c784, rf: 0x2a9d8f, t: '💰 Empório da Ilyra', s: 'Amuletos • Compra e venda', y: 14.2 },
    market: { x: 60, z: 17.5, ry: PI, ac: 0x4db6ac, rf: 0xd9822b, t: '🏪 Bazar do Bento', s: 'Troca entre jogadores', y: 14.2 },
    map: { x: 99, z: 17.5, ry: PI, ac: 0xffd54f, rf: 0x8b5a2b, t: '🗺️ Cartografia do Shiro', s: 'Viagem entre as florestas', y: 14.2 },
    deco: { x: 38, z: 17.5, ry: PI, ac: 0xffb74d, rf: 0xc0392b, t: '🪑 Móveis da Lia', s: 'Decoração para sua casa', y: 14.2 },
    summoner: { x: 86, z: 17.5, ry: PI, ac: 0xba68c8, rf: 0x2e5d9a, t: '🔮 Torre das Vocações', s: 'Aprenda novas vocações', y: 14.2 },
    herald: { x: 98, z: -17.5, ry: 0, ac: 0xe57373, rf: 0x8e3b2a, t: '📯 Arautos de Aurora', s: 'Rankings • Chefe • Missões', y: 14.2 },
  };
  Object.entries(ROLE_SHOP).forEach(([role, o], k) => { B.frame(o.x, o.z, o.ry); shop(B, k, o.ac, o.rf); shopProps(B, role); sign(o.x, o.y, o.z, o.t, o.s); });
  LAND.forEach(l => { B.frame(l.x, l.z, Math.atan2(-l.x, -l.z)); ({ tavern, chapel, clock: clocktower, guild })[l.k](B); sign(l.x, { tavern: 13.8, chapel: 25.5, clock: 32, guild: 14.8 }[l.k], l.z, l.t, l.s, '#c9a7ff'); });
  signs.forEach(sp => group.add(sp));
  B.frame(0, 0, 0);
  for (let x = 36; x < 112; x += 12) [-1, 1].forEach(s => { if (Math.abs(x - 70) > 4) lamp(B, x, s * 9.8); });
  for (let i = 0; i < 4; i++) { barrel(B, 33.5, -3 + i * 2); crate(B, 33.5, 5 + (i % 2), i); }
  B.cyl(1.6, 1.8, 0.9, 12, 108, 0, 0, STONE); B.cyl(1.2, 1.2, 0.1, 12, 108, 0.85, 0, 0x4fc3f7); B.cyl(0.25, 0.3, 2, 6, 108, 0.9, 0, STONE); B.k = 'l'; B.sph(0.35, 108, 3.1, 0, 0x8fe3ff, 1, 6); B.k = 'm';

  // ---- Parque do Lago: coreto, doca, juncos, flores e cerejeiras ----
  { const cx = 82, cz = -44;
    B.cyl(3.6, 3.8, 0.5, 8, cx, 0, cz, STONE); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; B.cyl(0.14, 0.14, 3.2, 5, cx + Math.cos(a) * 3.1, 0.5, cz + Math.sin(a) * 3.1, 0xf2eee3); }
    B.cone(4.6, 2.6, 8, cx, 3.7, cz, 0xc0392b); B.sph(0.3, cx, 6.5, cz, 0xf5c542, 1, 5);
    bench(B, cx - 1.4, cz, 1.57); bench(B, cx + 1.4, cz, -1.57);
    const dx = LAKE.x - 14, dz = LAKE.z + 14; B.frame(dx, dz, 3.93); for (let i = 0; i < 8; i++) B.box(1.7, 0.2, 1.1, 0, 0.35, i * 1.1, 0x9a6b3a); [0, 7.7].forEach(z => [-0.85, 0.85].forEach(x => B.cyl(0.1, 0.1, 1, 5, x, 0, z, TIM))); B.box(2, 0.45, 1, 0.3, 0.1, 9.2, 0xb98a4f); B.frame(0, 0, 0);
    for (let i = 0; i < 40; i++) { const a = rnd() * 6.283, r = LAKE.r + 0.5 + rnd() * 1.2, x = LAKE.x + Math.cos(a) * r, z = LAKE.z + Math.sin(a) * r; B.cone(0.08, 1.4 + rnd() * 0.8, 4, x, 0, z, 0x6aa84f); if (i % 4 === 0) B.sph(0.16, x, 1.8, z, 0x8a5a2b, 1.8, 4); }
    for (let i = 0; i < 12; i++) { const a = rnd() * 6.283, r = rnd() * (LAKE.r - 3); B.cyl(0.8, 0.8, 0.05, 8, LAKE.x + Math.cos(a) * r, 0.14, LAKE.z + Math.sin(a) * r, 0x4caf50); if (i % 3 === 0) B.sph(0.22, LAKE.x + Math.cos(a) * r, 0.25, LAKE.z + Math.sin(a) * r, 0xffb7d5, 1, 5); }
  }

  // ---- campos e moinho (sudeste distante) ----
  const mill = new THREE.Group(); let blades;
  { B.cyl(3.2, 4.6, 12, 8, FARM.x, 0, FARM.z, 0xece4d2); B.cone(4.6, 5, 8, FARM.x, 12, FARM.z, 0xb5452f); B.box(1.6, 2.6, 0.3, FARM.x, 0, FARM.z + 4.3, 0x6b4423); B.k = 'g'; B.box(1.2, 1.4, 0.2, FARM.x, 6, FARM.z + 3.5, GLASS); B.k = 'm';
    mill.position.set(FARM.x, 9.5, FARM.z + 3.5); blades = new THREE.Group(); mill.add(blades);
    const bm = new THREE.MeshStandardMaterial({ color: 0xe9dfc8, roughness: 1, flatShading: true }), wd = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1 });
    for (let i = 0; i < 4; i++) { const a = new THREE.Group(); a.rotation.z = i * Math.PI / 2; const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9, 0.2), wd); arm.position.y = 4.8; const sail = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 0.08), bm); sail.position.set(1.2, 5.4, 0); a.add(arm, sail); blades.add(a); }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), wd); mill.add(hub); group.add(mill);
    const cols = [0x8cc152, 0xe5c75a, 0x6aa84f, 0xc9d36b];
    for (let f = 0; f < 6; f++) { const fx = FARM.x - 28 + (f % 3) * 20, fz = FARM.z - 24 + Math.floor(f / 3) * 52 + (f % 3 === 1 ? 6 : 0); if (Math.hypot(fx - FARM.x, fz - FARM.z) < 9) continue; for (let r = 0; r < 7; r++) B.box(16, 0.55, 1.1, fx, 0.04, fz - 5 + r * 1.7, cols[(f + r) % 4]); for (let k = 0; k < 4; k++) { B.cyl(0.07, 0.07, 1.3, 4, fx - 8.2, 0, fz - 5 + k * 3.5, TIM); B.cyl(0.07, 0.07, 1.3, 4, fx + 8.2, 0, fz - 5 + k * 3.5, TIM); } }
    for (let i = 0; i < 5; i++) B.cyl(1.1, 1.1, 1.2, 8, FARM.x + 8 + i * 2.4, 0, FARM.z + 8 + (i % 2) * 2, 0xe5c75a, 0, 1.57);
    B.box(8, 4, 6, FARM.x - 12, 0, FARM.z + 12, 0xb5452f); B.gable(9, 8, 3, FARM.x - 12, 4, FARM.z + 12, 0x6b4423); }

  // ---- muralha, torres e o grande portão ----
  { const WR = CITY_R + 1.5, gap = 6.8 / WR;
    const wg = new THREE.CylinderGeometry(WR, WR, 7, 180, 1, true, gap, Math.PI * 2 - gap * 2); B.put(wg.attributes.position.array.length ? (wg.index ? wg.toNonIndexed() : wg).attributes.position.array : [], 1, 1, 1, 0, 3.5, 0, 0xb7bdc6);
    const wi = new THREE.CylinderGeometry(WR - 1.6, WR - 1.6, 7, 180, 1, true, gap, Math.PI * 2 - gap * 2); B.put(wi.toNonIndexed().attributes.position.array, 1, 1, 1, 0, 3.5, 0, 0xa4abb5);
    const top = new THREE.RingGeometry(WR - 1.6, WR, 180, 1, gap - Math.PI / 2, Math.PI * 2 - gap * 2); top.rotateX(-Math.PI / 2); B.put((top.index ? top.toNonIndexed() : top).attributes.position.array, 1, 1, 1, 0, 7, 0, 0x9aa1ab);
    for (let i = 0; i < 220; i++) { const a = gap + 0.02 + (i + 0.5) / 220 * (Math.PI * 2 - gap * 2 - 0.04), x = Math.sin(a) * (WR - 0.8), z = Math.cos(a) * (WR - 0.8); B.box(2.6, 1.6, 1.2, x, 7, z, 0xc9ced6, a - Math.PI / 2 + Math.PI / 2); }
    for (let i = 0; i < 24; i++) { const a = gap * 4 + i / 24 * (Math.PI * 2 - gap * 8), x = Math.sin(a) * WR, z = Math.cos(a) * WR; if (z > WR - 12 && Math.abs(x) < 20) continue; B.cyl(4.2, 4.8, 12, 10, x, 0, z, 0xaab0ba); B.cyl(5, 5, 1, 10, x, 12, z, 0x8e95a0); B.cone(5.4, 6.5, 10, x, 13, z, 0xb83a2c); }
    [-1, 1].forEach(sd => { const x = sd * 9.2, z = WR; B.cyl(5, 5.7, 20, 12, x, 0, z, 0xb7bdc6); B.cyl(6, 6, 1.4, 12, x, 20, z, 0x8e95a0); B.cone(6.6, 9, 12, x, 21.4, z, 0xb83a2c); B.cyl(0.14, 0.14, 5, 4, x, 30.4, z, 0x333333); B.box(3, 1.8, 0.12, x + 1.5, 33.4, z, sd > 0 ? 0xf5c542 : 0x2e86c1); B.k = 'g'; B.box(1.2, 2.2, 1.2, x, 11, z - 4.6, GLASS); B.box(1.2, 2.2, 1.2, x, 15, z - 4.6, GLASS); B.k = 'm'; });
    B.box(14, 5, 6, 0, 16, WR, 0xaab0ba); for (let i = 0; i < 7; i++) B.box(1.4, 1.4, 1.2, -6 + i * 2, 21, WR, 0xc9ced6);
    B.k = 'l'; B.box(5, 0.5, 0.2, 0, 15.2, WR - 3.1, 0xffcf7a); B.k = 'm';
    [-4.6, 4.6].forEach(x => { lamp(B, x, WR - 6); lamp(B, x, WR - 20); }); }

  // ---- lanternas ao longo das avenidas e dos aneis ----
  SPOKES.forEach(([a, w, re]) => {
    const ux = Math.cos(a * D2R), uz = Math.sin(a * D2R);
    for (let t = INNER + 6; t < re - 4; t += 15) [-1, 1].forEach(s => {
      const x = ux * t - uz * s * (w / 2 + 1.4), z = uz * t + ux * s * (w / 2 + 1.4), r = Math.hypot(x, z);
      if (blocked(x, z, -3) || RINGS.some(([R]) => Math.abs(r - R) < 6)) return; lamp(B, x, z);
    });
  });
  RINGS.forEach(([R, w]) => { const n = Math.floor(2 * Math.PI * R / 22); for (let i = 0; i < n; i++) { const a = i / n * 6.283, x = Math.cos(a) * (R + w / 2 + 0.9), z = Math.sin(a) * (R + w / 2 + 0.9); if (spokeDist(x, z) < 3 || blocked(x, z, -3)) continue; lamp(B, x, z); } });

  // ---- árvores: alamedas, parque (cerejeiras), jardins internos e floresta fora da muralha ----
  const placed = [];
  const free = (x, z, pad) => !blocked(x, z, 0) && roadDist(x, z) > pad && !PLOTS.some(p => Math.abs(p.x - x) < 7 && Math.abs(p.z - z) < 7) && !placed.some(q => Math.abs(q[0] - x) < 2.6 && Math.abs(q[1] - z) < 2.6);
  const plant = (x, z, sc, type) => { placed.push([x, z]); tree(B, x, z, sc, type); };
  SPOKES.forEach(([a, w, re]) => {
    const ux = Math.cos(a * D2R), uz = Math.sin(a * D2R);
    for (let t = INNER + 5; t < re - 5; t += 9.5) [-1, 1].forEach(s => { const o = w / 2 + 3.6 + rnd() * 0.6, x = ux * t - uz * s * o, z = uz * t + ux * s * o; if (blocked(x, z, 0) || roadDist(x, z) < 2.2) return; if (free(x, z, 1.8)) plant(x, z, 0.95 + rnd() * 0.25, a === 90 ? 'round' : (rnd() < 0.5 ? 'pine' : 'round')); });
  });
  for (let n = 0; n < 130; n++) { const a = rnd() * 6.283, r = 6 + Math.sqrt(rnd()) * 170, x = Math.cos(a) * r, z = Math.sin(a) * r; if (r > INNER + 2 && free(x, z, 3.2) && !(Math.abs(x - LAKE.x) < 40 && Math.abs(z - LAKE.z) < 40)) plant(x, z, 0.9 + rnd() * 0.5, rnd() < 0.5 ? 'pine' : 'round'); }
  for (let n = 0; n < 170; n++) { const a = (-90 + rnd() * 110) * D2R, r = 80 + rnd() * 85, x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 6) continue; if (free(x, z, 3)) plant(x, z, 1 + rnd() * 0.5, rnd() < 0.55 ? 'blossom' : 'round'); }
  for (let n = 0; n < 60; n++) { const a = rnd() * 6.283, r = LAKE.r + 3 + rnd() * 8, x = LAKE.x + Math.cos(a) * r, z = LAKE.z + Math.sin(a) * r; if (free(x, z, 2.5)) plant(x, z, 1 + rnd() * 0.5, 'blossom'); }
  for (let n = 0; n < 60; n++) { const a = rnd() * 6.283, r = 34 + rnd() * 24, x = Math.cos(a) * r, z = Math.sin(a) * r; if (free(x, z, 3)) { if (n % 3 === 0) bush(B, x, z, FC[n % 5]); else plant(x, z, 0.9 + rnd() * 0.4, n % 5 === 0 ? 'autumn' : 'round'); } }
  for (let n = 0; n < 340; n++) { const a = rnd() * 6.283, r = CITY_R + 6 + rnd() * 90, x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.abs(x) < 16 && z > 0) continue; tree(B, x, z, 1.2 + rnd() * 0.7, rnd() < 0.7 ? 'pine' : 'round'); }
  for (let n = 0; n < 70; n++) { const a = rnd() * 6.283, r = 40 + rnd() * 120, x = Math.cos(a) * r, z = Math.sin(a) * r; if (free(x, z, 3) && rnd() < 0.8) bush(B, x, z, rnd() < 0.6 ? FC[n % 5] : 0); }

  B.finish(group, mats);

  // ---- terrenos: marcador no chão (instanciado) + placas que aparecem só perto do jogador ----
  const ringMesh = new THREE.InstancedMesh(new THREE.RingGeometry(0.9, 1.2, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide }), PLOTS.length);
  PLOTS.forEach((p, i) => { _m.makeTranslation(p.door[0], 0.13, p.door[1]); ringMesh.setMatrixAt(i, _m); ringMesh.setColorAt(i, _c.set(0xffd54f)); });
  ringMesh.frustumCulled = false; ringMesh.userData.noOutline = true; group.add(ringMesh);
  let ctx = { homes: {}, owners: {}, myOid: '' };
  const plotText = (p) => {
    const own = !!ctx.homes[p.id], o = ctx.owners && ctx.owners[p.id], other = !own && o && o.oid !== ctx.myOid, house = p.kind === 'house';
    return {
      txt: own ? '\u{1F3E0} ' + p.name + ' — seu lar' : other ? (house ? '\u{1F3E0} Casa de ' : '\u{1F3E2} Apto de ') + o.name : (house ? '\u{1F3E0} À venda \u{1FA99}' : '\u{1F3E2} Alugar \u{1FA99}') + p.price,
      bd: own ? '#66e08a' : other ? '#7fb8ff' : '#f5c542', col: own ? 0x66e08a : other ? 0x7fb8ff : 0xffd54f,
    };
  };
  const setOwned = (homes, owners, myOid) => {
    ctx = { homes, owners, myOid };
    PLOTS.forEach((p, i) => ringMesh.setColorAt(i, _c.set(plotText(p).col))); ringMesh.instanceColor.needsUpdate = true;
    tags.forEach(t => { t.pid = null; }); tagT = 9;
  };
  const tags = []; for (let i = 0; i < 12; i++) { const s = label('', '#f5c542'); s.visible = false; s.pid = null; group.add(s); tags.push(s); }
  let tagT = 9;
  const refreshTags = (px, pz) => {
    const near = PLOTS.map(p => [Math.hypot(p.x - px, p.z - pz), p]).filter(a => a[0] < 46).sort((a, b) => a[0] - b[0]).slice(0, tags.length);
    tags.forEach((t, i) => {
      const it = near[i]; if (!it) { t.visible = false; t.pid = null; return; }
      const p = it[1], tx = plotText(p); t.visible = true; t.position.set(p.x, p.top, p.z);
      const key = p.id + tx.txt; if (t.pid !== key) { t.pid = key; t.userData.draw(tx.txt, tx.bd); }
    });
  };

  // ---- NPCs: o herói + placa com nome + anel brilhante (a barraca já foi desenhada acima) ----
  const npcs = NPC_DEFS.map((d) => {
    const def = buildPlayerHero(Object.assign({}, PREMADE[d.premade], { name: d.title }));
    const mesh = makeHero(def); mesh.position.set(d.pos[0], 0, d.pos[1]); mesh.rotation.y = d.ry;
    const cc = new THREE.Color(d.color).getHex();
    const tag = label(d.icon + ' ' + d.title.split(',')[0]); tag.position.set(d.pos[0], 4.7, d.pos[1]); group.add(tag);
    group.add(mesh);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.6, 28), new THREE.MeshBasicMaterial({ color: cc, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(d.pos[0], 0.14, d.pos[1]); group.add(ring);
    return Object.assign({ mesh, tag, ring }, d);
  });

  // ---- horizonte pintado (Unirall): acompanha o jogador; some no céu e dá profundidade fora da muralha ----
  let horizon = null;
  { const im = new Image(); im.onload = () => {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d');
      g.drawImage(im, 0, 0); g.globalCompositeOperation = 'destination-in';
      const gr = g.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.32, 'rgba(0,0,0,0.9)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(330, 330, 150, 48, 1, true), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false }));
      m.position.y = 55; m.renderOrder = -1; m.userData.noOutline = true; m.frustumCulled = false; group.add(m); horizon = m;
    };
    im.src = BASE + 'img/city/horizonte.webp'; }

  group.visible = false;
  let tm2 = 0;
  return {
    group, npcs, setOwned,
    districtAt(x, z) { return DISTRICTS.find(d => d.test(x, z)) || null; },
    // anima NPCs e devolve o mais próximo do jogador (se perto o bastante)
    update(dt, p) {
      tm2 += dt; let best = null, bd = 4.8;
      if (blades) blades.rotation.z += dt * 0.6;
      waterTex.offset.x += dt * 0.012; waterTex.offset.y += dt * 0.007;
      if (horizon) horizon.position.set(p.x, 55, p.z);
      if ((tagT += dt) > 0.3) { tagT = 0; refreshTags(p.x, p.z); }
      npcs.forEach(n => {
        const dx = p.x - n.mesh.position.x, dz = p.z - n.mesh.position.z, d = Math.hypot(dx, dz);
        if (d > 70) return;     // longe: nem anima
        animateHero(n.mesh, dt, {});
        if (d < 9) n.mesh.rotation.y = Math.atan2(dx, dz);
        else n.mesh.rotation.y = n.ry;
        n.ring.scale.setScalar(1 + Math.sin(tm2 * 3) * 0.1);
        if (d < bd) { bd = d; best = n; }
      });
      return best;
    },
  };
}

// desenha o fundo do mapa/minimapa (ruas, praças, castelo, lago, muralha) no contexto 2D; (X, Z) convertem metros em pixels
export function drawCityBase(c, X, Z, k, full) {
  c.fillStyle = '#79b85f'; c.beginPath(); c.arc(X(0), Z(0), (CITY_R + 3) * k, 0, 7); c.fill();
  c.strokeStyle = '#c9b48a'; c.lineCap = 'butt';
  RINGS.forEach(([R, w]) => { c.lineWidth = w * k; c.beginPath(); c.arc(X(0), Z(0), R * k, 0, 7); c.stroke(); });
  SPOKES.forEach(([a, w, re]) => { c.lineWidth = w * k; c.beginPath(); c.moveTo(X(Math.cos(a * D2R) * (INNER - 2)), Z(Math.sin(a * D2R) * (INNER - 2))); c.lineTo(X(Math.cos(a * D2R) * re), Z(Math.sin(a * D2R) * re)); c.stroke(); });
  c.fillStyle = '#cbbfa8';
  [[0, 0, INNER], [GATE_SQ.x, GATE_SQ.z, 16], [COURT.x, COURT.z, 20], [DECO_SQ.x, DECO_SQ.z, 11], [ACAD.x, ACAD.z + 23, 12]].forEach(([x, z, r]) => { c.beginPath(); c.arc(X(x), Z(z), r * k, 0, 7); c.fill(); });
  c.fillRect(X(MARKET.x0), Z(-MARKET.hw), (MARKET.x1 - MARKET.x0) * k, MARKET.hw * 2 * k);
  c.fillStyle = '#4fc3f7'; c.beginPath(); c.arc(X(LAKE.x), Z(LAKE.z), LAKE.r * k, 0, 7); c.fill();
  c.beginPath(); c.arc(X(0), Z(0), 6 * k, 0, 7); c.fill();
  c.fillStyle = '#ece5d6'; c.fillRect(X(-23), Z(CASTLE.z - 12), 46 * k, 24 * k);
  c.fillStyle = '#b83a2c'; [-25, 25].forEach(x => { c.beginPath(); c.arc(X(x), Z(CASTLE.z + 5), 5.5 * k, 0, 7); c.fill(); });
  c.fillStyle = '#d98b5f'; LAND.forEach(l => { c.beginPath(); c.arc(X(l.x), Z(l.z), 5 * k, 0, 7); c.fill(); });
  c.fillStyle = '#b9a6e6'; c.beginPath(); c.arc(X(ACAD.x), Z(ACAD.z), 6 * k, 0, 7); c.fill();
  c.fillStyle = '#e8cf6a'; c.beginPath(); c.arc(X(FARM.x), Z(FARM.z), 5 * k, 0, 7); c.fill();
  c.strokeStyle = '#b7bdc6'; c.lineWidth = Math.max(2, (full ? 6 : 3) * (full ? 1 : 0.7)); c.beginPath(); c.arc(X(0), Z(0), (CITY_R + 1.5) * k, Math.PI / 2 + 0.04, Math.PI / 2 - 0.04 + Math.PI * 2); c.stroke();
}
