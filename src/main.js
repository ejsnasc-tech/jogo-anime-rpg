import * as THREE from 'three';
import { CLASSES, CLASS_MODELS, REALMS, RARITY, HEROES, ACTS, INTRO, ENDING, PREMADE, buildPlayerHero } from './data.js';
import { std, metal, glow, shadowAll } from './models.js';
import { makeHero, makeSkeleton, animateHero, playOnce, preloadModels } from './actors.js';
import { openCreator, CLASS_LIST } from './creator.js';
import { SKILLS, SKILL_MAX, skillById, rollChoices } from './skills.js';
import { SLOTS, SLOT_ORDER, EQUIP_KEYS, KINDS, WEAPON_KIND, OFF_KIND, RAR, MATS, FOREST_LV, MAX_PLUS, newItem, itemValue, itemStat, itemIcon, itemFmt, statFmt, itemName, itemLine, sellPrice, buyPrice, upgradeCost, rollDrop, migrateItems } from './items.js';
import { itemArt, ghostArt } from './itemart.js';
import { buildCity, CITY_R, CITY_SPAWN, PLOTS } from './city.js';
import { createNet, nameTag, NET_URL } from './net.js';
import { QUESTS, ACH, LOGIN_DAYS, ensureMeta, loginState, claimLogin, loginReward, questReward, offlineGain } from './meta.js';
import { initSocial } from './social.js';
import { openAuth, api, getSess, setSess } from './auth.js';
import { ROOMS, FURN, furnByKey, makeFurniture, footprint, buildRoom } from './home.js';

const WORLD = 200;          // metade do tamanho do mapa
const PLAYER_SPEED = 7;
const MAX_TEAM = 3;

const testing = new URLSearchParams(location.search).has('selftest');
const _q0 = new URLSearchParams(location.search);
const LOCAL = testing || _q0.has('local') || _q0.get('net') === '0' || _q0.has('nocreator');   // modo de teste/offline: sem conta
const sess = LOCAL ? null : getSess();
const needAuth = !LOCAL && !(sess && sess.cid);
const $ = (id) => document.getElementById(id);

// ===================== Save =====================
const defaults = () => ({
  gold: 0, gems: 80, cash: 0, level: 1, kills: 0,
  owned: ['kaito'], team: ['kaito'], upgrades: { atk: 0, hp: 0 }, stars: {},
  pets: ['fox'], activePet: 'fox', petStars: {},
  skills: {}, xp: 0, skillPts: 0, items: [], equip: {}, mats: {}, homes: {}, stock: {}, maxAct: 0, storyDone: false,
  act: 0, stage: 1, stageKills: 0, endless: false, seen: {}, account: null, custom: null, lastSeen: Date.now(),
});
function upsertPlayer(c) {
  const h = buildPlayerHero(c), i = HEROES.findIndex(x => x.id === 'player');
  if (i >= 0) HEROES[i] = h; else HEROES.unshift(h);
}
function load() {
  let s = defaults();
  try { Object.assign(s, JSON.parse(localStorage.getItem('acrpg') || '{}')); } catch (e) { s = defaults(); }
  if (s.custom) upsertPlayer(s.custom);
  if (sess && sess.cid) { s.pid = sess.pid; if (sess.name) s.account = sess.name; }
  if (s.maxAct < s.act) s.maxAct = s.act;
  migrateItems(s);
  if (!s.pid) s.pid = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/-/g, '');
  if (s.endless) { s.storyDone = true; s.maxAct = 5; }
  const ids = HEROES.map(h => h.id);
  if (s.active && !s.team.length) s.team = [s.active];
  s.owned = s.owned.filter(id => ids.includes(id)); if (!s.owned.length) s.owned = ['kaito'];
  s.team = s.team.filter(id => s.owned.includes(id)).slice(0, MAX_TEAM); if (!s.team.length) s.team = [s.owned[0]];
  if (!s.pets.length) s.pets = ['fox'];
  if (s.custom) { if (!s.owned.includes('player')) s.owned.push('player'); if (!s.owned.includes('kaito')) s.owned.push('kaito'); s.team = ['player'].concat(s.team.filter(id => id !== 'player' && s.owned.includes(id))).slice(0, MAX_TEAM); if (s.team.length < 2) s.team.push('kaito'); }
  return s;
}
let cloudDirty = false, cloudBusy = false;
const save = (s) => { if (testing) return; s.lastSeen = Date.now(); try { localStorage.setItem('acrpg', JSON.stringify(s)); } catch (e) {} cloudDirty = true; };
const state = load();
ensureMeta(state);
// save na nuvem (por personagem): a cada 12 s se houve mudança, e ao sair da página
async function cloudPush(force) {
  if (!sess || !sess.cid || !state.custom || cloudBusy || !(cloudDirty || force)) return;
  cloudBusy = true; cloudDirty = false;
  try { await api('char/put', { token: sess.token, id: sess.cid, name: state.custom.name, cls: state.custom.cls, level: state.level, save: JSON.stringify(state) }); }
  catch (e) { cloudDirty = true; if (e.status === 401) { setSess(null); location.reload(); } }
  finally { cloudBusy = false; }
}
if (sess && sess.cid) {
  setInterval(() => cloudPush(), 12000);
  addEventListener('pagehide', () => cloudPush(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) cloudPush(true); });
}

// ===================== Cena 3D =====================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
$('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe9ff, 35, 140);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
const CAM_OFFSET = new THREE.Vector3(0, 8.2, 10);
const _co = new THREE.Vector3(); let zoom = 1, zoomT = 1;
const setZoom = (f) => { zoomT = Math.min(2.8, Math.max(0.55, f)); };

const hemi = new THREE.HemisphereLight(0xffffff, 0x4a7a3a, 0.85); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d6, 1.1);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 60 });
scene.add(sun, sun.target);

function setSky(colors) {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, colors[0]); gr.addColorStop(0.6, colors[1]); gr.addColorStop(1, colors[2]);
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (scene.background && scene.background.dispose) scene.background.dispose();
  scene.background = t;
}

function grassTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#4f9d3a'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) { g.fillStyle = Math.random() < 0.5 ? '#5fb348' : '#438a32'; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 5); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(235, 235); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// ---- relevo: colinas suaves, rio sinuoso e lago (o herói afunda na água) ----
const sstep = (a, b, v) => { const k = Math.min(1, Math.max(0, (v - a) / (b - a))); return k * k * (3 - 2 * k); };
const riverZ = (x) => -30 + Math.sin(x * 0.021) * 15 + Math.sin(x * 0.0073 + 1.3) * 11;
const riverHW = (x) => 5.5 + Math.sin(x * 0.045 + 0.6) * 1.4;
const LAKE = { x: 95, z: -70, r: 22 };
const trailX = (z) => Math.sin(z * 0.045) * 14;
const WATER_Y = -0.28;
function riverDepth(x, z) {
  const hw = riverHW(x), a = 1 - sstep(hw * 0.35, hw + 4, Math.abs(z - riverZ(x)));
  const b = 1 - sstep(LAKE.r * 0.45, LAKE.r, Math.hypot(x - LAKE.x, z - LAKE.z));
  return Math.max(a, b);
}
const hillH = (x, z) => 0.8 * (0.5 + 0.5 * (Math.sin(x * 0.031 + 0.5) * Math.sin(z * 0.027) + 0.5 * Math.sin(x * 0.07 + z * 0.05)) / 1.5);
function groundH(x, z) { const d = riverDepth(x, z); return hillH(x, z) * (1 - d) - d * 1.25; }
const BR = (() => { let z = -30, x = 0; for (let i = 0; i < 8; i++) { x = trailX(z); z = riverZ(x); } return { x, z, len: riverHW(x) + 5.5 }; })();
function walkY(x, z) { if (Math.abs(x - BR.x) < 2.6 && Math.abs(z - BR.z) < BR.len) return 0.45; return groundH(x, z); }

const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);   // chão plano: só na cidade
const terrain = (() => {
  const g = new THREE.PlaneGeometry(520, 520, 260, 260); g.rotateX(-Math.PI / 2);
  const pa = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i); pa.setY(i, groundH(x, z)); uv.setXY(i, (x + 450) / 900, (450 - z) / 900); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, ground.material); m.receiveShadow = true; scene.add(m); return m;
})();
ground.visible = false;   // começa no campo; o chão plano só aparece na cidade

function applyAct() {
  const r = REALMS[ACTS[state.act].realm];
  setSky(r.sky); scene.fog.color.set(r.fog); ground.material.color.set(r.ground);
}

const fieldGroup = new THREE.Group(); scene.add(fieldGroup);
// Árvores e pedras (instanciadas: 3 chamadas de desenho no total) + borda do mundo
(function decorate() {
  const N_TREE = 1500, N_ROCK = 380, N_EDGE = 420;
  const gh = (x, z) => x > 9000 ? 0 : groundH(x, z);
  const grove = (x, z) => Math.sin(x * 0.045 + 1) * Math.sin(z * 0.05) + 0.6 * Math.sin((x + z) * 0.03) > -0.25;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0x6b4423 }), N_TREE + N_EDGE);
  const leaf = new THREE.InstancedMesh(new THREE.ConeGeometry(1.4, 3, 7), new THREE.MeshStandardMaterial({ color: 0x2f7d32 }), N_TREE + N_EDGE);
  const rock = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.8), new THREE.MeshStandardMaterial({ color: 0x8a8f98, flatShading: true }), N_ROCK + N_EDGE);
  const d = new THREE.Object3D(); let ti = 0, ri = 0;
  const addTree = (x, z, sc) => {
    d.rotation.set(0, 0, 0); d.scale.setScalar(sc);
    const y0 = gh(x, z);
    d.position.set(x, 0.7 * sc + y0, z); d.updateMatrix(); trunk.setMatrixAt(ti, d.matrix);
    d.position.set(x, 2.7 * sc + y0, z); d.updateMatrix(); leaf.setMatrixAt(ti, d.matrix); ti++;
  };
  const addRock = (x, z, sx, sy, sz) => { d.rotation.set(0, Math.random() * 6, 0); d.scale.set(sx, sy, sz); d.position.set(x, 0.4 * sy + gh(x, z), z); d.updateMatrix(); rock.setMatrixAt(ri++, d.matrix); };
  const R = WORLD + 12;
  for (let i = 0; i < N_TREE; i++) {
    const x = (Math.random() * 2 - 1) * R, z = (Math.random() * 2 - 1) * R;
    if (Math.hypot(x, z) < 7 || riverDepth(x, z) > 0.02 || Math.abs(x - trailX(z)) < 3 || (!grove(x, z) && Math.random() < 0.85)) { addTree(9999, 9999, 1); continue; }
    addTree(x, z, 0.8 + Math.random() * 0.8);
  }
  for (let i = 0; i < N_ROCK; i++) {
    const x = (Math.random() * 2 - 1) * R, z = (Math.random() * 2 - 1) * R;
    if (Math.hypot(x, z) < 7 || Math.abs(x - trailX(z)) < 2.5) { addRock(9999, 9999, 1, 1, 1); continue; }
    addRock(x, z, 0.8 + Math.random(), 0.6 + Math.random() * 0.6, 0.8 + Math.random());
  }
  // borda visível: faixa densa de pinheiros e rochedos grandes em volta do mapa
  for (let i = 0; i < N_EDGE; i++) {
    const t = Math.random() * 4, side = Math.floor(t), u = (t - side) * 2 * WORLD - WORLD, off = WORLD + 1 + Math.random() * 7;
    const x = side < 2 ? u : (side === 2 ? off : -off), z = side < 2 ? (side === 0 ? off : -off) : u;
    if (i % 3 === 0) addRock(x, z, 2.5 + Math.random() * 2, 2 + Math.random() * 3, 2.5 + Math.random() * 2);
    else addTree(x, z, 1.6 + Math.random() * 1.0);
  }
  for (; ti < N_TREE + N_EDGE; ti++) addTree(9999, 9999, 1);
  for (; ri < N_ROCK + N_EDGE; ri++) addRock(9999, 9999, 1, 1, 1);
  [trunk, leaf, rock].forEach(m => { m.castShadow = m !== rock || true; m.frustumCulled = false; m.instanceMatrix.needsUpdate = true; fieldGroup.add(m); });
})();

// Cenário: montanhas, nuvens, torres, rio, trilha e flores
const farGroup = new THREE.Group(); scene.add(farGroup);
let waterTex = null;
const RUINS = [], chestMeshes = [];
(function scenery() {
  const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 1, flatShading: true }, o));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.random() * 0.2, r = 115 + Math.random() * 25, h = 30 + Math.random() * 28, w = 22 + Math.random() * 16;
    const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 6), mat(0x8fa6bd)); m.position.set(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.34, h * 0.3, 6), mat(0xffffff)); cap.position.set(m.position.x, h * 0.85 - 1, m.position.z);
    farGroup.add(m, cap);
  }
  const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false });
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(4 + Math.random() * 3, 10, 8), cm); s.position.set(k * 5 - 8, Math.random() * 2, Math.random() * 3); s.scale.y = 0.55; g.add(s); }
    g.position.set((Math.random() * 2 - 1) * 130, 38 + Math.random() * 18, (Math.random() * 2 - 1) * 130); farGroup.add(g);
  }
  const stone = mat(0xb9bec6), roof = mat(0xc0392b);
  const tower = (x, z) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 11, 12), stone); t.position.y = 5.5;
    const r = new THREE.Mesh(new THREE.ConeGeometry(3.1, 4.5, 12), roof); r.position.y = 13.2; t.castShadow = r.castShadow = true;
    const g = new THREE.Group(); g.add(t, r); g.position.set(x, groundH(x, z), z); fieldGroup.add(g);
  };
  tower(-12, -52); tower(12, -52); tower(-48, 30); tower(-48, 42); tower(90, 60); tower(-120, -90); tower(140, -140); tower(-150, 120);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(24, 2.4, 3), stone); bridge.position.set(0, 7, -52); bridge.castShadow = true; fieldGroup.add(bridge);
  // ---- água: rio sinuoso + lago, com ondulação animada ----
  const wc = document.createElement('canvas'); wc.width = wc.height = 128; const wg = wc.getContext('2d');
  wg.fillStyle = '#ffffff'; wg.fillRect(0, 0, 128, 128); wg.strokeStyle = 'rgba(110,190,240,.55)'; wg.lineWidth = 2;
  for (let i = 0; i < 26; i++) { const x = Math.random() * 128, y = Math.random() * 128; wg.beginPath(); wg.moveTo(x, y); wg.quadraticCurveTo(x + 10, y - 4, x + 22, y); wg.stroke(); }
  waterTex = new THREE.CanvasTexture(wc); waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterTex.colorSpace = THREE.SRGBColorSpace;
  const wmat = new THREE.MeshStandardMaterial({ color: 0x3fb4e8, map: waterTex, transparent: true, opacity: 0.74, roughness: 0.12, metalness: 0.1, depthWrite: false });
  {
    const N = 116, pos = [], uvs = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const x = -260 + i * (520 / N), zc = riverZ(x), w = riverHW(x) + 4.8;
      pos.push(x, WATER_Y, zc - w, x, WATER_Y, zc + w); uvs.push(x / 14, 0, x / 14, 1.4);
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); rg.setIndex(idx); rg.computeVertexNormals();
    const river = new THREE.Mesh(rg, wmat); river.renderOrder = 1; river.frustumCulled = false; fieldGroup.add(river);
    const lg = new THREE.CircleGeometry(LAKE.r + 1.5, 40); lg.rotateX(-Math.PI / 2);
    const lu = lg.attributes.uv; for (let i = 0; i < lu.count; i++) lu.setXY(i, lu.getX(i) * 5, lu.getY(i) * 5);
    const lake = new THREE.Mesh(lg, wmat); lake.position.set(LAKE.x, WATER_Y, LAKE.z); lake.renderOrder = 1; fieldGroup.add(lake);
  }
  // ponte de madeira onde a trilha cruza o rio
  {
    const wood = mat(0x8a5a2b, { flatShading: false }), deck = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.3, BR.len * 2), wood);
    deck.position.set(BR.x, 0.3, BR.z); deck.castShadow = deck.receiveShadow = true; fieldGroup.add(deck);
    [-2.5, 2.5].forEach(sx => { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, BR.len * 2), wood); rail.position.set(BR.x + sx, 0.9, BR.z); rail.castShadow = true; fieldGroup.add(rail); });
    for (let k = -3; k <= 3; k++) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.5), wood); post.position.set(BR.x, -0.3, BR.z + k * (BR.len / 3.2)); fieldGroup.add(post); }
  }
  // juncos nas margens
  {
    const reeds = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 1.0, 4), new THREE.MeshStandardMaterial({ color: 0x86b84c }), 320), dm = new THREE.Object3D();
    for (let i = 0; i < 320; i++) {
      const x = (Math.random() * 2 - 1) * WORLD, side = Math.random() < 0.5 ? -1 : 1, z = riverZ(x) + side * (riverHW(x) + 0.5 + Math.random() * 3);
      dm.position.set(x, groundH(x, z) + 0.7, z); dm.rotation.set((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3); dm.scale.setScalar(0.7 + Math.random() * 0.8); dm.updateMatrix(); reeds.setMatrixAt(i, dm.matrix);
    }
    reeds.frustumCulled = false; fieldGroup.add(reeds);
  }
  // ruínas antigas com fogueira (pontos de interesse espalhados)
  {
    let sd = 1234567; const rnd = () => { sd = (sd * 1664525 + 1013904223) % 4294967296; return sd / 4294967296; };
    const SITES = 9, pil = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.7, 4, 8), stone, SITES * 6), slab = new THREE.InstancedMesh(new THREE.BoxGeometry(2.8, 0.5, 1.8), stone, SITES), dm = new THREE.Object3D();
    const fireM = new THREE.MeshBasicMaterial({ color: 0xff8a2b }), fireG = new THREE.ConeGeometry(0.4, 1, 6);
    let n = 0;
    for (let i = 0; i < SITES; i++) {
      let x = 0, z = 0;
      for (let t = 0; t < 30; t++) { const a = rnd() * 6.283, r = 45 + rnd() * 130; x = Math.cos(a) * r; z = Math.sin(a) * r; if (riverDepth(x, z) < 0.01 && Math.hypot(x - LAKE.x, z - LAKE.z) > LAKE.r + 8 && Math.abs(x - trailX(z)) > 6) break; }
      const y0 = groundH(x, z); RUINS.push({ x: x - 2.8, z: z - 1.2, y: y0 });
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * 6.283, sc = 0.35 + rnd() * 0.65;
        dm.position.set(x + Math.cos(a) * 5.5, y0 + 2 * sc, z + Math.sin(a) * 5.5); dm.rotation.set((rnd() - 0.5) * 0.25, rnd() * 3, (rnd() - 0.5) * 0.25); dm.scale.set(1, sc, 1); dm.updateMatrix(); pil.setMatrixAt(n++, dm.matrix);
      }
      dm.position.set(x, y0 + 0.25, z); dm.rotation.set(0, rnd() * 3, 0); dm.scale.set(1, 1, 1); dm.updateMatrix(); slab.setMatrixAt(i, dm.matrix);
      const f = new THREE.Mesh(fireG, fireM); f.position.set(x + 2.6, y0 + 0.5, z + 1.4); fieldGroup.add(f);
    }
    [pil, slab].forEach(m => { m.castShadow = true; m.frustumCulled = false; fieldGroup.add(m); });
    // baús do tesouro nas ruínas (reabrem a cada 5 min)
    const wood = mat(0x7a4a1f, { flatShading: false }), gold = new THREE.MeshStandardMaterial({ color: 0xf2c230, metalness: 0.6, roughness: 0.35, emissive: 0x6a4a00 });
    RUINS.forEach((r, i) => {
      const g = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 0.9), wood), lid = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.4, 0.95), gold);
      body.position.y = 0.35; lid.position.set(0, 0.9, 0); const band = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.97), gold); band.position.y = 0.36;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: 0xfff08a })); gem.position.y = 2.1;
      g.add(body, lid, band, gem); g.position.set(r.x, r.y, r.z); g.rotation.y = i; g.traverse(o => { o.castShadow = true; }); fieldGroup.add(g);
      chestMeshes.push({ g, lid, gem, i, x: r.x, z: r.z });
    });
  }
  const dirt = mat(0xd9b77a, { flatShading: false }), dg = new THREE.CircleGeometry(1.5, 14);
  for (let z = 190; z > -190; z -= 1.6) {
    const d = new THREE.Mesh(dg, dirt); d.rotation.x = -Math.PI / 2; const tx = trailX(z); if (riverDepth(tx, z) > 0.02) continue; d.position.set(tx, groundH(tx, z) + 0.04, z); d.scale.set(1 + Math.random() * 0.3, 1, 1); fieldGroup.add(d);
  }
  const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.18, 6, 5), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 1400);
  const cols = [0xff7f2a, 0xffffff, 0xff8fb1, 0xffe14d, 0x9b7bff], dummy = new THREE.Object3D();
  for (let i = 0; i < 1400; i++) {
    const fx = (Math.random() * 2 - 1) * (WORLD + 5), fz = (Math.random() * 2 - 1) * (WORLD + 5), wet = riverDepth(fx, fz) > 0.02;
    dummy.position.set(wet ? 9999 : fx, groundH(fx, fz) + 0.15, fz); dummy.updateMatrix();
    fl.setMatrixAt(i, dummy.matrix); fl.setColorAt(i, new THREE.Color(cols[i % cols.length]));
  }
  fl.frustumCulled = false; fieldGroup.add(fl);
})();

// ===================== Modelos =====================
function makeEnemy(color, boss) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 18, 14), std(color)); body.scale.y = 0.85; body.position.y = 0.55;
  const wh = std(0xffffff), bl = std(0x111111);
  [-0.22, 0.22].forEach(x => {
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), wh); w.position.set(x, 0.75, 0.46);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), bl); p.position.set(x, 0.75, 0.59); g.add(w, p);
  });
  [-0.3, 0.3].forEach(x => { const h = new THREE.Mesh(new THREE.ConeGeometry(0.12, boss ? 0.6 : 0.35, 6), std(boss ? 0xffd45e : 0xeeeeee)); h.position.set(x, 1.15, 0); h.rotation.z = -x * 1.2; g.add(h); });
  g.add(body);
  if (boss) g.scale.setScalar(2.4);
  shadowAll(g); return g;
}

// ---- Criaturas: mascotes que também servem de montaria ----
function makeFox() {
  const g = new THREE.Group(), white = std(0xffffff), pink = std(0xff7b7b);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), white); body.scale.set(0.9, 0.8, 1.3); body.position.y = 0.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), white); head.position.set(0, 0.95, 0.55);
  const eyeM = std(0x2aa8ff);
  [-0.15, 0.15].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), eyeM); e.position.set(x, 1.0, 0.88); g.add(e); });
  [-0.2, 0.2].forEach(x => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 6), white); ear.position.set(x, 1.4, 0.5);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 6), pink); inner.position.set(x, 1.37, 0.54); g.add(ear, inner);
  });
  const tail = new THREE.Group();
  for (let i = -1; i <= 1; i++) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), std(i === 0 ? 0xffffff : 0xcfe6ff)); t.scale.set(0.6, 0.6, 1.8); t.position.set(i * 0.3, 0, -0.5); t.rotation.y = i * 0.5; tail.add(t); }
  tail.position.set(0, 0.8, -0.7);
  g.add(body, head, tail); g.userData = { tail }; shadowAll(g); return g;
}

function makeRhino() {
  const g = new THREE.Group(), body = std(0xb9a2e8), light = std(0xf3e8ff), pink = std(0xf3a6c8);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), body); torso.scale.set(1, 0.85, 1.4); torso.position.y = 0.9;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), body); head.position.set(0, 1.0, 0.95);
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 8), light); horn.position.set(0, 1.4, 1.35); horn.rotation.x = 0.9;
  const eyeM = std(0x222222);
  [-0.22, 0.22].forEach(x => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), eyeM); e.position.set(x, 1.1, 1.38);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.45, 6), pink); ear.position.set(x * 1.6, 1.5, 0.85); ear.rotation.z = -x * 1.5; g.add(e, ear);
  });
  [[-0.4, 0.6], [0.4, 0.6], [-0.4, -0.6], [0.4, -0.6]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.5, 8), light); l.position.set(x, 0.25, z); g.add(l); });
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), light); tail.position.set(0, 0.95, -1.0);
  g.add(torso, head, horn, tail); g.userData = {}; shadowAll(g); return g;
}

function makeDragon() {
  const g = new THREE.Group(), ice = std(0xdff3ff), crystal = std(0x5ec8ff), wingM = std(0x9fe3ff);
  wingM.transparent = true; wingM.opacity = 0.85;
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), ice); torso.scale.set(0.9, 0.8, 1.5); torso.position.y = 1.3;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 12), ice); head.position.set(0, 1.9, 1.4);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 8), std(0xffe08a)); beak.position.set(0, 1.85, 1.95); beak.rotation.x = Math.PI / 2;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.9, 8), ice); neck.position.set(0, 1.65, 1.05); neck.rotation.x = 0.7;
  [-0.18, 0.18].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), std(0xffd400)); e.position.set(x, 2.0, 1.75); g.add(e); });
  [-0.6, 0, 0.6].forEach(z => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 5), crystal); c.position.set(0, 2.15, z); g.add(c); });
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.7, 8), std(0x4aa8e8)); tail.position.set(0, 1.2, -1.9); tail.rotation.x = -Math.PI / 2;
  const mkWing = (side) => { const w = new THREE.Group(); w.position.set(side * 0.7, 1.7, 0); const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 1.2), wingM); m.position.x = side * 1.1; w.add(m); return w; };
  const wingL = mkWing(-1), wingR = mkWing(1);
  [-0.45, 0.45].forEach(x => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.7, 8), ice); l.position.set(x, 0.35, 0.3); g.add(l); });
  g.add(torso, head, beak, neck, tail, wingL, wingR);
  g.userData = { wings: [wingL, wingR] }; shadowAll(g); return g;
}

// seat = altura do assento montado; speed = bônus de velocidade montado
const PETS = [
  { id: 'fox',    name: 'Kitsune, Raposa de Gelo',    make: makeFox,    scale: 1,    mountScale: 1.7, seat: 1.6, speed: 1.3, dmg: 0.6, rate: 1.5, color: 0x7fdcff, weight: 50 },
  { id: 'rhino',  name: 'Rhino Lilás, Trovão Roxo',   make: makeRhino,  scale: 0.8,  mountScale: 1.4, seat: 2.1, speed: 1.6, dmg: 0.8, rate: 1.8, color: 0xc9a0ff, weight: 30 },
  { id: 'dragon', name: 'Glaciar, Dragão de Cristal', make: makeDragon, scale: 0.55, mountScale: 1.1, seat: 2.2, speed: 1.9, dmg: 1.3, rate: 2.2, color: 0x6fe3ff, weight: 20 },
];

const bulletGeo = new THREE.SphereGeometry(0.2, 10, 10);

// ===================== Estado de jogo =====================
let T = 0;                                   // tempo de jogo em segundos (pausa junto com o jogo)
let activeIdx = 0, hero = HEROES.find(h => h.id === state.team[0]);
let player = null, facing = 0;
const sk = (id) => state.skills[id] || 0;
const equippedAt = (key) => state.items.find(i => i.uid === state.equip[key]);
const isEquipped = (it) => EQUIP_KEYS.some(k => state.equip[k] === it.uid);
const statSum = (stat) => EQUIP_KEYS.reduce((a, k) => { const it = equippedAt(k); return a + (it && itemStat(it) === stat ? itemValue(it) : 0); }, 0);
const mainCls = () => (state.custom && state.custom.cls) || 'warrior';
const slotType = (key) => key;
const slotLabel = (t) => t === 'weapon' ? KINDS[WEAPON_KIND[mainCls()] || 'sword'].label : t === 'offhand' ? KINDS[OFF_KIND[mainCls()] || 'shield'].label : SLOTS[t].name;
const slotIcon = (t) => t === 'weapon' ? KINDS[WEAPON_KIND[mainCls()] || 'sword'].icon : t === 'offhand' ? KINDS[OFF_KIND[mainCls()] || 'shield'].icon : SLOTS[t].icon;
const calcMaxHp = () => 100 + state.upgrades.hp * 20 + sk('vigor') * 25 + Math.round(statSum('hp'));
let maxHp = calcMaxHp(), hp = maxHp, shield = 0, shieldUntil = 0;
const enemies = [], dying = [], bullets = [], effects = [], zones = [], timers = [], eshots = [];
let lastShot = 0, invuln = 0, switchReady = 0, bearUntil = 0, overload = 0, shake = 0, walkT = 0, spawnTimer = 0;
const skillReady = {};
let ev = null, nextEvT = 150 + Math.random() * 100, dayT = 0.3, night = 0, weather = 'clear', weatherLeft = 200, rainPts = null, isNight = false;
let bossRef = null;
let panelOpen = false, dialogOpen = false, creatorOpen = false;
let inCity = false, city = null, nearNpc = null, walkGoal = null, invOpen = false, mmT = 0;
let inHome = null, homeRoom = null, homeVisit = null;
const owners = {}; let myOid = ''; const recover = new Set();
const decor = { on: false, sel: null, drag: false, mark: null };
const isPaused = () => panelOpen || dialogOpen || creatorOpen || invOpen;
const joy = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
const keys = {};
let pet = null, petDef = PETS[0], mounted = false, petT = 0, petLast = 0;

const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angDiff = (a, b) => Math.abs(((a - b + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
function angleLerp(a, b, t) { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; }
const curAct = () => ACTS[state.act];
const zoneLv = () => state.endless ? 36 + Math.floor(state.stageKills / 25) : FOREST_LV[state.act] + state.stage - 1;
const xpNeed = () => 6 + Math.round(state.level * 2.5);
const quota = () => 8 + state.stage * 3 + state.act * 2;

function realmMult() {
  const er = curAct().realm, hr = hero.realm;
  if (REALMS[hr].strong === er) return 1.25;
  if (REALMS[er].strong === hr) return 0.85;
  return 1;
}
function atkPower() {
  let m = 1 + state.upgrades.atk * 0.25 + (state.stars[hero.id] || 0) * 0.1;
  m *= 1 + (state.level - 1) * 0.05;
  m *= realmMult();
  m *= 1 + sk('might') * 0.12;
  m *= 1 + statSum('atk');
  if (T < bearUntil) m *= 2;
  if (hero.cls === 'sorcerer') m *= 1 + overload / 100 * 0.6;
  return Math.max(1, Math.round(hero.atk * m));
}
const petDmg = () => Math.max(1, Math.round(atkPower() * petDef.dmg * (1 + 0.1 * (state.petStars[petDef.id] || 0))));

function setHero() {
  hero = HEROES.find(h => h.id === state.team[activeIdx]) || HEROES[0];
  const pos = player ? player.position.clone() : new THREE.Vector3(0, 0, 0);
  if (player) scene.remove(player);
  player = makeHero(hero); player.position.copy(pos); scene.add(player);
  overload = 0; bearUntil = 0;
  refreshHud(); refreshTeam(); updateSkillLabel(true);
}

function setPet() {
  petDef = PETS.find(p => p.id === state.activePet) || PETS[0];
  const pos = pet ? pet.position.clone() : player.position.clone().add(new THREE.Vector3(-1.6, 0, 1.2));
  if (pet) scene.remove(pet);
  pet = petDef.make(); pet.position.copy(pos); pet.scale.setScalar(mounted ? petDef.mountScale : petDef.scale); scene.add(pet);
}

function switchHero(i) {
  if (isPaused() || i === activeIdx || i >= state.team.length || T < switchReady) return;
  activeIdx = i; switchReady = T + 0.8;
  ringFx(player.position, HEROES.find(h => h.id === state.team[i]).color, 3, 0.4);
  setHero();
}

// ===================== HUD =====================
function refreshHud() {
  $('hname').textContent = 'Nv.' + state.level + ' ' + hero.name.split(' ')[0] + (state.meta && state.meta.title ? ' «' + state.meta.title + '»' : '');
  { const n = questsClaimable(); $('questbtn').textContent = '📜 MISSÕES' + (n ? ' ❗' + n : ''); }
  $('hgems').textContent = '💎' + state.gems; $('hgold').textContent = '🪙' + state.gold; $('hcash').textContent = '💵' + state.cash;
  const a = curAct();
  $('stage').textContent = wb ? '🐉 CHEFE MUNDIAL — derrotem juntos!' : inHome ? '\u{1F3E0} ' + (homeVisit ? 'Visitando a casa de ' + homeVisit.name : inHome.name + ' \u2014 ' + ROOMS[inHome.kind].label) : inCity ? '🏰 Cidade de Aurora — fale com os moradores' : state.endless ? '♾ Aventura Infinita • abates ' + state.stageKills
    : 'Ato ' + (state.act + 1) + ' (Nv.' + zoneLv() + ') • ' + a.name + ' — ' + (state.stage === 5 ? 'CHEFE' : 'Estágio ' + state.stage + '/5  (' + state.stageKills + '/' + quota() + ')');
}

function refreshTeam() {
  const box = $('team'); box.innerHTML = '';
  state.team.forEach((id, i) => {
    const h = HEROES.find(x => x.id === id); if (!h) return; const b = document.createElement('div');
    b.className = 'tbtn' + (i === activeIdx ? ' on' : ''); b.style.cursor = 'default'; b.style.pointerEvents = 'none';
    if (i !== activeIdx) { b.style.width = b.style.height = '48px'; b.style.opacity = '0.85'; }
    b.style.borderColor = '#' + h.color.toString(16).padStart(6, '0');
    b.innerHTML = CLASSES[h.cls].icon + '<small>' + (i === activeIdx ? 'VOCÊ' : h.name.split(' ')[0]) + '</small>';
    box.appendChild(b);
  });
  syncAllies();
}

// ---- aliados: os outros heróis da equipe lutam sozinhos ao seu lado (você controla só o seu personagem) ----
const allies = [];
function syncAllies() {
  allies.forEach(a => scene.remove(a.mesh)); allies.length = 0;
  if (!player) return;
  state.team.forEach((id, i) => {
    if (i === activeIdx) return;
    const h = HEROES.find(x => x.id === id); if (!h) return;
    const mesh = makeHero(h); mesh.position.copy(player.position).add(new THREE.Vector3(i % 2 ? 2 : -2, 0, 1.6)); scene.add(mesh);
    allies.push({ h, mesh, next: 0, melee: ['warrior', 'paladin', 'assassin'].includes(h.cls) });
  });
}
// ---- eventos aleatórios na floresta ----
function startEvent() {
  const k = Math.random(), n0 = enemies.length;
  if (k < 0.4) { ev = { name: 'INVASÃO de atiradores', left: 10, until: T + 150, rew: 1 }; for (let i = 0; i < 6; i++) spawnEnemy(false, null, 'archer'); for (let i = 0; i < 4; i++) spawnEnemy(false, null, 'mage'); }
  else if (k < 0.75) { ev = { name: 'HORDA de corredores', left: 14, until: T + 120, rew: 1 }; for (let i = 0; i < 14; i++) spawnEnemy(false, null, 'runner'); }
  else { ev = { name: 'CAÇADA ao Bruto', left: 3, until: T + 150, rew: 2 }; for (let i = 0; i < 3; i++) spawnEnemy(false, null, 'brute'); }
  enemies.slice(n0).forEach(e => { e.ev = ev; });
  toast('⚠ EVENTO: ' + ev.name + '! Derrote todos (' + ev.left + ') para ganhar recompensa');
}
function finishEvent() {
  const r = ev.rew, gold = state.level * 70 * r, gems = 5 * r + 2; state.gold += gold; state.gems += gems; ev = null; nextEvT = T + 220 + Math.random() * 150;
  track('event'); toast('🏆 Evento vencido! +🪙' + gold + ' +💎' + gems); save(state); refreshHud();
}

// ---- dia e noite, clima, baús ----
const EMOTES = ['👋', '😂', '👍', '❤️', '😡', '🎉'];
function updateWorld(dt) {
  const ov = $('nightov');
  if (inHome) { ov.style.opacity = 0; if (rainPts) rainPts.visible = false; }
  else {
    dayT = (dayT + dt / 420) % 1;
    const light = 0.5 + 0.5 * Math.sin((dayT - 0.25) * Math.PI * 2);
    night = 1 - sstep(0.1, 0.4, light);
    weatherLeft -= dt;
    if (weatherLeft <= 0) {
      const r = Math.random(), old = weather; weather = r < 0.55 ? 'clear' : r < 0.8 ? 'fog' : 'rain'; weatherLeft = weather === 'clear' ? 150 + Math.random() * 150 : 70 + Math.random() * 70;
      if (weather !== old && !inCity) toast(weather === 'fog' ? '🌫️ Neblina densa — visão reduzida' : weather === 'rain' ? '🌧️ Começou a chover' : '☀️ O tempo abriu');
    }
    const rainy = weather === 'rain' ? 1 : 0;
    hemi.intensity = 0.85 - 0.45 * night - 0.1 * rainy; sun.intensity = 1.1 - 0.8 * night - 0.35 * rainy;
    ov.style.opacity = Math.min(0.62, night * 0.5 + rainy * 0.12).toFixed(3);
    const fogFar = weather === 'fog' ? 62 : 140; scene.fog.far += (fogFar - scene.fog.far) * Math.min(1, dt * 0.6);
    if (isNight !== night > 0.55) { isNight = night > 0.55; refreshHud(); if (!inCity) toast(isNight ? '🌙 A noite caiu: magos e elites aparecem mais!' : '🌅 Amanheceu'); }
    if (rainy) {
      if (!rainPts) {
        const N = 380, g = new THREE.BufferGeometry(), arr = new Float32Array(N * 3), off = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) { off[i * 3] = (Math.random() - 0.5) * 44; off[i * 3 + 1] = Math.random() * 26; off[i * 3 + 2] = (Math.random() - 0.5) * 44; }
        g.setAttribute('position', new THREE.BufferAttribute(arr, 3)); rainPts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbcdcff, size: 0.2, transparent: true, opacity: 0.75, depthWrite: false })); rainPts.userData.off = off; rainPts.frustumCulled = false; scene.add(rainPts);
      }
      rainPts.visible = true; const off = rainPts.userData.off, pa = rainPts.geometry.attributes.position, p = player.position;
      for (let i = 0; i < off.length; i += 3) { off[i + 1] -= 24 * dt; if (off[i + 1] < 0) off[i + 1] += 26; pa.array[i] = p.x + off[i]; pa.array[i + 1] = off[i + 1]; pa.array[i + 2] = p.z + off[i + 2]; }
      pa.needsUpdate = true;
    } else if (rainPts) rainPts.visible = false;
  }
  if (inCity || inHome) return;
  // eventos
  if (ev && T > ev.until) { ev.left = 0; ev = null; nextEvT = T + 200; toast('⌛ O evento terminou'); }
  if (!ev && !wb && T > nextEvT && !(state.stage === 5 && !state.endless) && enemies.length < 10 && !isPaused()) startEvent();
  // baús
  const p = player.position, now = Date.now(), m = ensureMeta(state);
  chestMeshes.forEach(c => {
    const ready = now >= (m.chests[c.i] || 0);
    c.lid.rotation.x = ready ? 0 : -0.9; c.lid.position.y = ready ? 0.9 : 1.05; c.gem.visible = ready; if (ready) c.gem.position.y = 2.1 + Math.sin(T * 3 + c.i) * 0.15, c.gem.rotation.y = T * 2;
    if (ready && Math.hypot(p.x - c.x, p.z - c.z) < 2.4) openChest(c);
  });
}
function openChest(c) {
  const m = ensureMeta(state); m.chests[c.i] = Date.now() + 5 * 60 * 1000;
  const gold = Math.round((60 + state.level * 30) * (1 + Math.random() * 0.6)), gems = 2 + Math.floor(Math.random() * 5), tier = Math.min(5, state.act);
  state.gold += gold; state.gems += gems; state.mats[tier] = (state.mats[tier] || 0) + 3; ringFx(player.position, 0xffd54f, 4, 0.7);
  toast('🎁 Baú aberto! +🪙' + gold + ' +💎' + gems + ' +' + MATS[tier].icon + '3');
  if (Math.random() < 0.35) giveItem(newItem(SLOT_ORDER[Math.floor(Math.random() * SLOT_ORDER.length)], tier, Math.random() < 0.2 ? 2 : 1, mainCls()));
  track('chest'); save(state); refreshHud();
}

// ---- emotes (reaparecem para os outros jogadores) ----
{
  const bar = $('emobar');
  EMOTES.forEach((em, i) => { const b = document.createElement('button'); b.textContent = em; b.onpointerdown = (e) => { e.stopPropagation(); doEmote(i); }; bar.appendChild(b); });
  $('emobtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); bar.style.display = bar.style.display === 'flex' ? 'none' : 'flex'; });
}
let emoteAt = 0;
function doEmote(i) {
  if (T < emoteAt) return; emoteAt = T + 1.0;
  ftAt(player.position, EMOTES[i], '#fff', 3.2); if (net) net.send({ t: 'chat', text: '§e' + i }); track('emote'); save(state);
}

function updateAllies(dt) {
  const p = player.position;
  allies.forEach((a, i) => {
    const m = a.mesh, mp = m.position; m.visible = !inHome;
    let foe = null, bd = 12; if (!inCity) enemies.forEach(e => { const d = dist2(e.mesh.position, mp); if (d < bd) { bd = d; foe = e; } });
    let gx = p.x + (i % 2 ? 2.2 : -2.2), gz = p.z + 1.8, hold = 0.9;
    if (foe && a.melee) { gx = foe.mesh.position.x; gz = foe.mesh.position.z; hold = 1.5; }
    else if (foe) hold = 5;
    const vx = gx - mp.x, vz = gz - mp.z, d = Math.hypot(vx, vz);
    if (d > 16 && !foe) { mp.x = gx; mp.z = gz; }
    const moving = d > hold;
    if (moving) { const sp = Math.min(d, 7.5 * dt); mp.x += vx / d * sp; mp.z += vz / d * sp; }
    mp.y = inCity ? 0 : walkY(mp.x, mp.z);
    if (foe) m.rotation.y = angleLerp(m.rotation.y, Math.atan2(foe.mesh.position.x - mp.x, foe.mesh.position.z - mp.z), Math.min(1, dt * 12));
    else if (moving) m.rotation.y = angleLerp(m.rotation.y, Math.atan2(vx, vz), Math.min(1, dt * 10));
    animateHero(m, dt, { moving });
    const range = a.melee ? 2.6 : 9;
    if (foe && bd < range && T > a.next) {
      a.next = T + Math.max(0.5, a.h.rate / 1000);
      const dmg = Math.max(1, Math.round(a.h.atk * (1 + (state.stars[a.h.id] || 0) * 0.1) * (1 + (state.level - 1) * 0.05) * 0.65));
      playOnce(m, 'atk', 0.4);
      if (a.melee) { swingFx(mp, Math.atan2(foe.mesh.position.x - mp.x, foe.mesh.position.z - mp.z), 2.4, Math.PI * 0.8, a.h.color); enemies.slice().forEach(e => { if (dist2(e.mesh.position, mp) < range + e.radius) damageEnemy(e, dmg); }); }
      else fire(mp, foe.mesh.position, a.h.color, dmg, { size: 1.1 });
    }
  });
}

let skillLabel = '';
function updateSkillLabel(force, cd) {
  const label = cd > 0 ? String(Math.ceil(cd)) : CLASSES[hero.cls].icon + '<br>ULT';
  if (!force && label === skillLabel) return;
  skillLabel = label; $('skill').innerHTML = label;
}

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.style.opacity = 1;
  clearTimeout(toast.h); toast.h = setTimeout(() => { t.style.opacity = 0; }, 2600);
}

// ===================== Metajogo: missões, login diário, conquistas =====================
function track(key, n) {
  n = n || 1; const m = ensureMeta(state); m.cnt[key] = (m.cnt[key] || 0) + n;
  [m.dq, m.wq].forEach((list, wi) => list.forEach(q => {
    if (q.key !== key || q.claimed) return; const was = q.have >= q.need; q.have = Math.min(q.need, q.have + n);
    if (!was && q.have >= q.need) toast('📜 ' + (wi ? 'Missão semanal' : 'Missão') + ' completa: ' + q.label + ' — abra MISSÕES!');
  }));
  checkAch();
}
function checkAch() {
  const m = ensureMeta(state);
  ACH.forEach(a => { if (!m.ach[a.id] && a.ok(state)) { m.ach[a.id] = 1; state.gems += a.gems; toast('🏆 Conquista: ' + a.title + '  +' + a.gems + '💎'); if (!m.title) m.title = a.title; } });
}
const rewTxt = (r) => [r.gold && '🪙' + r.gold, r.gems && '💎' + r.gems, r.cash && '💵' + r.cash].filter(Boolean).join('  ');
const giveRew = (r) => { state.gold += r.gold || 0; state.gems += r.gems || 0; state.cash += r.cash || 0; };
function questsClaimable() { const m = ensureMeta(state); return [].concat(m.dq, m.wq).filter(q => !q.claimed && q.have >= q.need).length + (loginState(state).got ? 0 : 1); }
function openQuests() {
  const m = ensureMeta(state), ls = loginState(state);
  const rows = [{ head: true, text: '🎁 LOGIN DIÁRIO — sequência: ' + ls.streak + ' dia(s)' }];
  rows.push({ text: 'Dia ' + (ls.day + 1) + ' de 7: ' + rewTxt(loginReward(ls.day, state.level)) + (LOGIN_DAYS[ls.day].big ? '   ⭐ PRÊMIO GRANDE' : '') + '\nVolte todo dia sem falhar para chegar ao dia 7.', btn: ls.got ? '✔ HOJE' : 'COLETAR', enabled: !ls.got, fn: () => { const r = claimLogin(state); giveRew(r); save(state); refreshHud(); toast('🎁 ' + rewTxt(r)); openQuests(); } });
  rows.push({ head: true, text: '📜 MISSÕES DIÁRIAS (renovam à meia-noite)' });
  const addQ = (q, weekly) => { const rw = questReward(state.level, weekly); rows.push({ text: q.label + '   (' + q.have + '/' + q.need + ')\nRecompensa: ' + rewTxt(rw), btn: q.claimed ? '✔' : q.have >= q.need ? 'COLETAR' : '…', enabled: !q.claimed && q.have >= q.need, fn: () => { q.claimed = true; giveRew(rw); save(state); refreshHud(); toast('✅ ' + rewTxt(rw)); openQuests(); } }); };
  m.dq.forEach(q => addQ(q, false));
  rows.push({ head: true, text: '📅 MISSÕES SEMANAIS (renovam toda segunda)' });
  m.wq.forEach(q => addQ(q, true));
  rows.push({ head: true, text: '🏆 CONQUISTAS E TÍTULOS  (' + Object.keys(m.ach).length + '/' + ACH.length + ')' });
  ACH.forEach(a => { const got = !!m.ach[a.id]; rows.push({ text: (got ? '✔ ' : '🔒 ') + a.title + '\n' + a.desc + '  •  +' + a.gems + '💎', btn: got ? (m.title === a.title ? 'EM USO' : 'USAR') : '', enabled: got && m.title !== a.title, fn: () => { m.title = a.title; save(state); refreshHud(); openQuests(); } }); });
  openPanel('📜 MISSÕES', rows);
}

const social = initSocial({ state, sess, toast, openPanel, closePanel, save, refreshHud, itemLine, sellPrice, isEquipped, giveItem, newItem, SLOT_ORDER, mainCls, track });

// ---- Chefe mundial: todos os jogadores ferem o mesmo chefe (a vida fica no servidor) ----
let wb = null;
function enterWBoss(v) {
  closePanel(); setCityMode(false); clearEnemies();
  wb = { cycle: v.cycle, pending: 0, t: 0, busy: false, nextAdd: T + 8 };
  const e = spawnEnemy(true, { name: v.name, color: v.color }); e.hp = e.maxHp = 1e9; e.wb = true; e.dmg = (8 + state.level * 1.3) * 2.1; e.mesh.scale.multiplyScalar(1.35); e.radius = 1.9;
  $('bossname').textContent = v.icon + ' ' + v.name + '  ' + Math.round(v.hp).toLocaleString('pt-BR'); $('bossfill').style.width = Math.max(0, v.hp / v.maxhp * 100) + '%';
  toast('🐉 Chefe Mundial! Cada golpe seu fere o chefe de TODOS os jogadores.'); refreshHud();
}
function endWB() { if (!wb) return; const d = wb.pending; wb = null; if (d > 0) social.hit(d); if (!inCity) { clearEnemies(); setCityMode(true); } refreshHud(); }
function updateWB(dt) {
  if (!wb) return;
  wb.t += dt;
  if (T > wb.nextAdd) { wb.nextAdd = T + 12; if (enemies.length < 7) { spawnEnemy(false, null, 'archer'); spawnEnemy(false, null, 'runner'); } }
  if (wb.t >= 2.5 && !wb.busy) {
    wb.t = 0; const d = wb.pending; wb.pending = 0; wb.busy = true;
    social.hit(d).then(r => {
      if (wb) wb.busy = false; if (!r || !wb) return;
      $('bossfill').style.width = Math.max(0, r.hp / r.maxhp * 100) + '%'; $('bossname').textContent = r.icon + ' ' + r.name + '  ' + Math.round(r.hp).toLocaleString('pt-BR');
      if (r.killed || !r.active) { toast(r.killed ? '🏆 A comunidade derrotou o Chefe Mundial! Colete o prêmio com a Arauta.' : '⌛ O tempo do chefe acabou. Colete o prêmio com a Arauta.'); endWB(); }
    });
  }
}

const _v = new THREE.Vector3();
function floatText(pos, str, color) {
  _v.copy(pos).project(camera);
  if (_v.z > 1) return;
  const r = renderer.domElement.getBoundingClientRect();
  const d = document.createElement('div'); d.className = 'float'; d.textContent = str; d.style.color = color || '#ffd166';
  d.style.left = ((_v.x * 0.5 + 0.5) * r.width + r.left) + 'px'; d.style.top = ((-_v.y * 0.5 + 0.5) * r.height + r.top) + 'px';
  document.body.appendChild(d); setTimeout(() => d.remove(), 800);
}
const ftAt = (obj, str, color, y) => floatText(new THREE.Vector3(obj.x, y == null ? 1.8 : y, obj.z), str, color);

// ===================== Diálogos =====================
const dlg = { queue: [], done: null };
function showDialog(lines, done) {
  if (testing) { if (done) done(); return; }
  dlg.queue = lines.slice(); dlg.done = done || null; dialogOpen = true;
  $('dialog').classList.add('open'); nextLine();
}
function nextLine() {
  const l = dlg.queue.shift();
  if (!l) { dialogOpen = false; $('dialog').classList.remove('open'); const d = dlg.done; dlg.done = null; if (d) d(); return; }
  const h = HEROES.find(x => x.name.split(' ')[0] === l[0]);
  $('dname').textContent = l[0]; $('dname').style.color = h ? '#' + h.color.toString(16).padStart(6, '0') : '#f5c542';
  $('dtext').textContent = l[1].replace('{nome}', state.custom ? state.custom.name : 'viajante');
}
$('dialog').addEventListener('pointerdown', (e) => { e.stopPropagation(); nextLine(); });

// ===================== Painéis =====================
function closePanel() { $('panel').classList.remove('open'); panelOpen = false; }
function openPanel(title, rows) {
  if (dialogOpen) return;
  panelOpen = true;
  const card = $('card'); card.innerHTML = '';
  const h = document.createElement('h2'); h.textContent = title; card.appendChild(h);
  rows.forEach(r => {
    const row = document.createElement('div'); row.className = 'prow' + (r.head ? ' head' : '');
    const t = document.createElement('span'); t.textContent = r.text; if (r.color) t.style.color = r.color; row.appendChild(t);
    const bl = r.btns || (r.btn ? [{ label: r.btn, fn: r.fn, enabled: r.enabled }] : []);
    if (bl.length) {
      const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px';
      bl.forEach(x => {
        const b = document.createElement('button'); b.textContent = x.label; b.disabled = x.enabled === false;
        if (!b.disabled) b.onclick = (e) => { e.stopPropagation(); x.fn(); };
        wrap.appendChild(b);
      });
      row.appendChild(wrap);
    }
    card.appendChild(row);
  });
  $('panel').classList.add('open');
}

function toggleTeam(id) {
  const curId = hero.id, i = state.team.indexOf(id);
  if (i >= 0) { if (state.team.length > 1) state.team.splice(i, 1); }
  else if (state.team.length < MAX_TEAM) state.team.push(id);
  const ni = state.team.indexOf(curId);
  activeIdx = ni >= 0 ? ni : 0;
  save(state); setHero(); openCrew();
}

function openCrew(msg) {
  const rows = [{ head: true, text: (msg ? msg + '\n' : '') + 'SEU PERSONAGEM + até ' + (MAX_TEAM - 1) + ' ALIADOS. Os aliados lutam sozinhos ao seu lado; você só controla o seu personagem.' }];
  rows.push({ text: 'Invocar herói\nRaro 55% • Épico 35% • Lendário 10%\nRepetido = +10% ATK', btn: '💎30', enabled: state.gems >= 30, fn: summon });
  HEROES.forEach(h => {
    const c = CLASSES[h.cls], r = REALMS[h.realm], owned = state.owned.includes(h.id), inTeam = state.team.includes(h.id);
    const text = c.icon + ' ' + h.name + '  [' + RARITY[h.rar].name + ']\n' + r.icon + ' ' + r.name + ' • ' + c.name + ' • ATK ' + h.atk + (owned ? '  •  ★' + (state.stars[h.id] || 0) : '');
    if (!owned) {
      if (h.cost > 0) rows.push({ text, btn: '🪙' + h.cost, enabled: state.gold >= h.cost, fn: () => { state.gold -= h.cost; state.owned.push(h.id); if (state.team.length < MAX_TEAM) state.team.push(h.id); save(state); refreshHud(); refreshTeam(); openCrew(); } });
      else rows.push({ text: text + '\n🔒 Conquiste na história ou invoque', btn: '🔒', enabled: false });
    } else if (h.id === 'player') rows.push({ text, btn: 'VOCÊ', enabled: false });
    else rows.push({ text, btn: inTeam ? (state.team.length > 1 ? 'REMOVER' : 'NA EQUIPE') : 'ADICIONAR', enabled: inTeam ? state.team.length > 1 : state.team.length < MAX_TEAM, fn: () => toggleTeam(h.id) });
  });
  rows.push({ head: true, text: '— Criaturas (mascote + montaria) —' });
  rows.push({ text: 'Invocar criatura\nRepetida = +10% dano', btn: '💎40', enabled: state.gems >= 40, fn: summonPet });
  PETS.forEach(p => {
    const owned = state.pets.includes(p.id);
    const text = p.name + '\nDano ' + Math.round(p.dmg * 100) + '%  •  Velocidade montado x' + p.speed + (owned ? '  •  ★' + (state.petStars[p.id] || 0) : '');
    if (!owned) rows.push({ text, btn: 'BLOQUEADO', enabled: false });
    else rows.push({ text, btn: state.activePet === p.id ? 'ATIVO' : 'USAR', enabled: state.activePet !== p.id, fn: () => { state.activePet = p.id; save(state); setPet(); openCrew(); } });
  });
  openPanel('CREW', rows);
}

function openProfile(keep) {
  const st = keep ? $('card').scrollTop : 0;
  const again = () => openProfile(true), cost = (k) => 100 * (state.upgrades[k] + 1);
  const rows = [{ head: true, text: '🪙' + state.gold + '  💎' + state.gems + '  💵' + state.cash + '  •  Abates: ' + state.kills + '\n' + MATS.map((m, i) => m.icon + (state.mats[i] || 0)).join('  ') }];
  rows.push({ text: '🎒 Mochila e equipamento\nUse os botões 🧍 EQUIP e 🎒 BAG no canto superior esquerdo.' });
  rows.push({ text: 'Aparência do personagem\nMude nome e visual (a classe não muda)', btn: 'EDITAR', fn: editCharacter });
  if (sess && sess.cid) {
    const leave = async (full) => { toast('Salvando...'); await cloudPush(true); if (full) { try { await api('logout', { token: sess.token }); } catch (e) {} setSess(null); } else setSess(Object.assign({}, sess, { cid: null })); location.reload(); };
    rows.push({ text: '👤 Conta: ' + sess.name + '\nSeus personagens ficam salvos na conta.', btn: 'TROCAR', fn: () => leave(false) });
    rows.push({ text: 'Sair da conta\nVolta para a tela de entrada', btn: 'SAIR', fn: () => leave(true) });
  } else rows.push({ text: '🔑 Código da conta (guarde!)\n' + state.pid + '\nÉ ele que prova que suas casas são suas. Use o mesmo código em outro aparelho ou navegador.', btn: 'COPIAR', fn: () => { try { navigator.clipboard.writeText(state.pid); toast('🔑 Código copiado'); } catch (e) { window.prompt('Copie seu código:', state.pid); } } });
  if (!(sess && sess.cid)) rows.push({ text: 'Entrar com um código de conta\nRecupera suas casas neste aparelho', btn: 'USAR', fn: () => { const c = (window.prompt('Cole o código da conta:') || '').trim().replace(/[^a-zA-Z0-9]/g, ''); if (c.length >= 16) { state.pid = c; state.homes = {}; save(state); location.reload(); } else if (c) toast('Código inválido'); } });
  rows.push({ text: 'Treino de ataque +25%\nNível ' + state.upgrades.atk, btn: '🪙' + cost('atk'), enabled: state.gold >= cost('atk'), fn: () => { state.gold -= cost('atk'); state.upgrades.atk++; save(state); refreshHud(); again(); } });
  rows.push({ text: 'Treino de vitalidade +20 HP\nNível ' + state.upgrades.hp, btn: '🪙' + cost('hp'), enabled: state.gold >= cost('hp'), fn: () => { state.gold -= cost('hp'); state.upgrades.hp++; maxHp = calcMaxHp(); hp = maxHp; save(state); refreshHud(); again(); } });
  openPanel('👤 PERFIL', rows);
  if (keep) $('card').scrollTop = st;
}

function openIndex() {
  const rows = [];
  const a = curAct();
  rows.push({ head: true, text: '📖 HISTÓRIA\n' + (state.endless ? 'Tomo restaurado! Aventura Infinita.' : 'Ato ' + (state.act + 1) + '/6 — ' + REALMS[a.realm].icon + ' ' + a.name + '\nEstágio ' + state.stage + '/5') });
  const er = a.realm;
  rows.push({ text: 'Inimigos deste reino: ' + REALMS[er].icon + ' ' + REALMS[er].name + '\nVantagem: heróis de ' + Object.keys(REALMS).filter(k => REALMS[k].strong === er).map(k => REALMS[k].name).join(', ') + ' (+25% dano)' });
  rows.push({ head: true, text: '⚔️ CLASSES' });
  Object.values(CLASSES).forEach(c => rows.push({ text: c.icon + ' ' + c.name + ' — ' + c.role + '\n' + c.desc + '\nULT: ' + c.ult }));
  rows.push({ head: true, text: '🧑‍🤝‍🧑 HERÓIS' });
  HEROES.forEach(h => rows.push({ text: (state.owned.includes(h.id) ? '✔  ' : '✖  ') + h.name + ' [' + RARITY[h.rar].name + ']\n' + (state.owned.includes(h.id) ? h.bio : '???') }));
  rows.push({ head: true, text: '🐾 CRIATURAS' });
  PETS.forEach(p => rows.push({ text: (state.pets.includes(p.id) ? '✔  ' : '✖  ') + p.name }));
  openPanel('INDEX', rows);
}

function summon() {
  if (state.gems < 30) return;
  state.gems -= 30;
  let r = Math.random() * 100, rar = 'R';
  for (const k of ['R', 'E', 'L']) { r -= RARITY[k].weight; if (r <= 0) { rar = k; break; } }
  const pool = HEROES.filter(h => h.rar === rar && h.id !== 'player'), h = pool[Math.floor(Math.random() * pool.length)];
  let msg;
  if (state.owned.includes(h.id)) { state.stars[h.id] = (state.stars[h.id] || 0) + 1; msg = h.name.split(' ')[0] + ' repetido! +1★'; }
  else { state.owned.push(h.id); if (state.team.length < MAX_TEAM) state.team.push(h.id); msg = '✨ ' + h.name + ' [' + RARITY[h.rar].name + '] obtido!'; }
  save(state); refreshHud(); refreshTeam(); openCrew(msg);
}

function summonPet() {
  if (state.gems < 40) return;
  state.gems -= 40;
  let r = Math.random() * 100, pick = PETS[0];
  for (const p of PETS) { r -= p.weight; if (r <= 0) { pick = p; break; } }
  if (state.pets.includes(pick.id)) state.petStars[pick.id] = (state.petStars[pick.id] || 0) + 1; else state.pets.push(pick.id);
  save(state); refreshHud(); openCrew(pick.name.split(',')[0] + ' obtido!');
}

function unlockHero(id) {
  const h = HEROES.find(x => x.id === id); if (!h) return;
  if (!state.owned.includes(id)) state.owned.push(id);
  if (!state.team.includes(id) && state.team.length < MAX_TEAM) state.team.push(id);
  toast('✨ ' + h.name + ' se juntou à equipe!'); refreshTeam(); save(state);
}

function toggleMount() {
  if (isPaused()) return;
  mounted = !mounted;
  pet.scale.setScalar(mounted ? petDef.mountScale : petDef.scale);
  $('mount').textContent = mounted ? '⬇ DESMONTAR' : '🐾 MONTAR';
  toast(mounted ? 'Montado em ' + petDef.name.split(',')[0] + '!' : 'Você desmontou');
  if (!mounted) player.position.y = 0;
}

$('b-crew').onclick = () => { if (!dialogOpen && !picking) openCrew(); };
$('b-bag').onclick = () => { if (!dialogOpen && !picking && !invOpen) openProfile(); };
$('b-index').onclick = () => { if (!dialogOpen && !picking) openIndex(); };
$('b-home').onclick = () => { if (!picking) { closePanel(); closeInv(); } };
$('mount').addEventListener('pointerdown', (e) => { e.stopPropagation(); toggleMount(); });
$('skill').addEventListener('pointerdown', (e) => { e.stopPropagation(); useSkill(); });

// ===================== Efeitos =====================
function addEffect(mesh, dur, tick, end) { scene.add(mesh); effects.push({ mesh, t: 0, dur, tick, end }); }
function disposeObj(o) { o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); }

function ringFx(pos, color, grow, dur, y) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, y || 0.15, pos.z);
  addEffect(m, dur || 0.5, (k) => { m.scale.setScalar(1 + k * grow); m.material.opacity = 0.9 * (1 - k); });
}

function swingFx(pos, a, r, arc, color) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20, -arc / 2, arc), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; g.add(m); g.position.set(pos.x, 0.35, pos.z); g.rotation.y = a - Math.PI / 2;
  addEffect(g, 0.25, (k) => { m.material.opacity = 0.6 * (1 - k); });
}

function explode(pos, radius, dmg, color, exclude) {
  ringFx(pos, color, radius, 0.35);
  enemies.slice().forEach(x => { if (x !== exclude && dist2(x.mesh.position, pos) < radius + x.radius * 0.5) damageEnemy(x, dmg); });
}

// ===================== Inimigos / combate =====================
function clearEnemies() { if (ev) { ev = null; nextEvT = T + 90; } eshots.forEach(s => { scene.remove(s.mesh); s.mesh.material.dispose(); }); eshots.length = 0; enemies.forEach(e => scene.remove(e.mesh)); enemies.length = 0; dying.forEach(d => scene.remove(d.mesh)); dying.length = 0; bossRef = null; $('bossbar').style.display = 'none'; }

// Tipos de inimigo. ranged: atira de longe e mantém distância. Cada um tem vida/dano/velocidade próprios.
const ETYPES = {
  minion: { name: 'Esqueleto', model: 'Skeleton_Minion', loot: 'Skeleton_Minion', hp: 1, dmg: 1, spd: 1, size: 1.6, r: 0.7 },
  warrior: { name: 'Esqueleto Guerreiro', model: 'Skeleton_Warrior', loot: 'Skeleton_Warrior', hp: 1.5, dmg: 1.15, spd: 0.95, size: 1.9, r: 0.8 },
  runner: { name: 'Corredor', model: 'Skeleton_Minion', loot: 'runner', hp: 0.6, dmg: 0.85, spd: 1.75, size: 1.5, r: 0.65, tint: 0xffd0a0, run: 'Running_A' },
  brute: { name: 'Bruto', model: 'Skeleton_Warrior', loot: 'brute', hp: 3.2, dmg: 1.6, spd: 0.7, size: 2.7, r: 1.1, tint: 0xff9a8a },
  archer: { name: 'Arqueiro', model: 'Skeleton_Rogue', loot: 'Skeleton_Rogue', hp: 0.75, dmg: 0.9, spd: 0.9, size: 1.7, r: 0.7, ranged: { range: 11, keep: 7, cd: 2.2, speed: 11, color: 0xffe28a, arrow: true }, atk: '2H_Ranged_Shoot' },
  mage: { name: 'Mago', model: 'Skeleton_Mage', loot: 'Skeleton_Mage', hp: 0.8, dmg: 1.25, spd: 0.8, size: 1.7, r: 0.7, ranged: { range: 13, keep: 9, cd: 3.0, speed: 7.5, color: 0xc17bff, size: 1.9, splash: 1.8 }, atk: 'Spellcast_Shoot' },
};
// quanto mais avançado o ato / estágio, mais variedade e mais atiradores
function pickEType() {
  const act = state.act, st = state.endless ? 5 : state.stage;
  const w = { minion: Math.max(18, 60 - act * 8 - st * 4), warrior: act > 0 ? 16 + act * 2 : 6, runner: st >= 2 || act > 0 ? 14 : 0, archer: st >= 2 || act > 0 ? 16 + act * 3 : 0, mage: act >= 1 || st >= 4 ? 8 + act * 4 : 0, brute: act >= 1 || st >= 4 ? 4 + act * 3 : 0 };
  if (night > 0.55) { w.mage += 10; w.archer += 8; w.runner += 6; }
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return 'minion';
}

function spawnEnemy(boss, info, forceType) {
  const a = Math.random() * Math.PI * 2, d = boss ? 16 : 20;
  const x = THREE.MathUtils.clamp(player.position.x + Math.cos(a) * d, -WORLD, WORLD), z = THREE.MathUtils.clamp(player.position.z + Math.sin(a) * d, -WORLD, WORLD);
  const realm = REALMS[curAct().realm];
  const tk = boss ? 'warrior' : (forceType || pickEType()), T0 = ETYPES[tk];
  const tintBase = boss ? info.color : (T0.tint != null ? T0.tint : realm.enemy);
  const tint = new THREE.Color(tintBase).lerp(new THREE.Color(0xffffff), boss ? 0.2 : (T0.tint != null ? 0.1 : 0.5)).getHex();
  const kind = T0.model;
  const mesh = makeSkeleton(kind, tint, boss, { size: T0.size, atk: T0.atk, run: T0.run }) || makeEnemy(boss ? info.color : realm.enemy, boss);
  mesh.position.set(x, 0, z); scene.add(mesh);
  const lv = zoneLv();
  // o mundo acompanha o jogador: passar do nível da zona deixa os bichos mais fortes
  const over = Math.max(0, state.level - lv), catchup = 1 + over * 0.07, catchD = 1 + over * 0.035;
  const base = (18 + lv * 7) * (1 + state.act * 0.3) * 1.6 * catchup;
  const hpv = boss ? base * 14 * (state.endless ? 1.5 : 1) * 1.3 : base * T0.hp;
  const dmgBase = ((6 + lv * 0.8) * (1 + state.act * 0.12)) * 1.35 * catchD;
  const e = { mesh, hp: hpv, maxHp: hpv, speed: boss ? 1.5 : (1.9 + Math.random() * 1.0) * T0.spd, boss: !!boss, kind: boss ? 'Skeleton_Warrior' : T0.loot, type: boss ? 'boss' : tk, radius: boss ? 1.4 : T0.r, t: Math.random() * 10, dmg: dmgBase * (boss ? 1.6 : T0.dmg), stun: 0, slow: 0, flash: 0, ranged: boss ? null : T0.ranged || null, shotAt: T + 1 + Math.random() * 2 };
  if (!boss && !forceType && Math.random() < 0.04 + state.act * 0.01 + (night > 0.55 ? 0.03 : 0)) {
    e.elite = true; e.hp = e.maxHp = e.hp * 4; e.dmg *= 1.4; e.radius *= 1.3; mesh.scale.multiplyScalar(1.35);
    mesh.traverse(o => { if (o.isMesh && o.material) { if (o.material.emissive) o.material.emissive.setHex(0x664400); if (o.material.color) o.material.color.setHex(0xffd36b); } });
    ftAt(mesh.position, '★ ELITE', '#ffd166', 3);
  }
  enemies.push(e);
  if (boss) {
    bossRef = e; $('bossname').textContent = '👑 ' + info.name; $('bossfill').style.width = '100%'; $('bossbar').style.display = 'block';
    ftAt(player.position, '⚠ CHEFE!', '#ff4757', 2.8);
  }
  return e;
}

// disparo inimigo (esquiva-se andando)
function enemyShoot(e, p) {
  const r = e.ranged, from = e.mesh.position;
  const dir = new THREE.Vector3(p.x - from.x, 0, p.z - from.z).normalize();
  const m = new THREE.Mesh(bulletGeo, new THREE.MeshBasicMaterial({ color: r.color }));
  m.position.set(from.x, 1.2, from.z); m.scale.setScalar(r.size || 1.2);
  if (r.arrow) { m.scale.set(0.35, 0.35, 2.2); m.rotation.y = Math.atan2(dir.x, dir.z); }
  scene.add(m);
  eshots.push({ mesh: m, dir, speed: r.speed, life: 2.2, dmg: e.dmg, splash: r.splash || 0, color: r.color });
  if (e.mesh.userData.glb) playOnce(e.mesh, 'atk', 0.6);
}

function spawnBoss() { const b = curAct().boss; spawnEnemy(true, { name: state.endless ? 'Eco do Apagador' : b.name, color: b.color }); }

function autoSpawn() {
  if (inCity || wb) return;
  const bossStage = state.stage === 5 && !state.endless;
  if (bossStage) { if (enemies.length < 8) spawnEnemy(false); return; }
  const cap = state.endless ? 25 : Math.min(25, quota() - state.stageKills + 2);
  if (enemies.length < cap) spawnEnemy(false);
}

function damageEnemy(e, dmg, crit) {
  if (e.dead) return;
  const cc = Math.min(0.8, sk('crit') * 0.08 + statSum('crit'));
  if (!crit && cc > 0 && Math.random() < cc) { dmg = Math.round(dmg * 1.8); crit = true; }
  e.hp -= dmg; ftAt(e.mesh.position, (crit ? '💥' : '') + dmg, crit ? '#ff9f1c' : '#ffd166', 1.6 * (e.boss ? 2 : 1));
  e.flash = 0.08;
  if (e.wb && wb) wb.pending += dmg;
  if (e === bossRef && !e.wb) $('bossfill').style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
  if (e.hp > 0) return;
  e.dead = true;
  if (e.mesh.userData.glb) { playOnce(e.mesh, 'death'); dying.push({ mesh: e.mesh, until: T + 1.1 }); } else scene.remove(e.mesh);
  const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1);
  onKill(e);
}

function onKill(e) {
  dropLoot(e); track('kill');
  if (e.elite) { track('elite'); dropLoot(e); dropLoot(e); state.gold += 40 + state.level * 8; state.gems += Math.random() < 0.4 ? 2 : 1; ftAt(e.mesh.position, '★ +elite', '#ffd166', 2.4); }
  if (e.ev && ev === e.ev) { ev.left--; if (ev.left <= 0) finishEvent(); else toast('⚔ ' + ev.name + ': faltam ' + ev.left); }
  state.kills++; state.gold += Math.round((5 + state.level + state.act * 2) * (1 + sk('greed') * 0.2));
  if (Math.random() < 0.05 + sk('greed') * 0.01) state.gems++;
  if (sk('vamp')) heal(maxHp * 0.01 * sk('vamp'));
  if (Math.random() < 0.1) state.cash += 10;
  state.xp++;
  if (state.xp >= xpNeed()) { state.xp = 0; state.level++; state.skillPts++; ftAt(player.position, 'LEVEL UP!', '#7CFC00', 2.8); }
  if (e.boss) {
    if (state.endless) { track('boss'); bossRef = null; $('bossbar').style.display = 'none'; state.gems += 5; state.gold += 200 * state.level; toast('🏆 Chefe derrotado! +5💎'); }
    else bossDefeated();
  } else if (wb) {
    /* adversários do chefe mundial não avançam estágios */
  } else {
    state.stageKills++;
    if (state.endless) { if (state.stageKills % 30 === 0) spawnBoss(); }
    else if (state.stage < 5 && state.stageKills >= quota()) stageClear();
  }
  save(state); refreshHud();
}

function recalcHp() { const r = hp / maxHp; maxHp = calcMaxHp(); hp = Math.min(maxHp, Math.max(1, maxHp * r)); if (invOpen) renderInv(); }
function keyFor(it) { return it.slot; }
function equipItem(it, key) {
  EQUIP_KEYS.forEach(k => { if (state.equip[k] === it.uid) delete state.equip[k]; });
  state.equip[key || keyFor(it)] = it.uid; recalcHp(); save(state);
}
function unequipItem(it) { EQUIP_KEYS.forEach(k => { if (state.equip[k] === it.uid) delete state.equip[k]; }); recalcHp(); save(state); }
function giveItem(it) {
  track('drop');
  if (state.items.length >= 60) { const g = sellPrice(it); state.gold += g; toast('Mochila cheia: ' + itemName(it) + ' vendido por 🪙' + g); return; }
  state.items.push(it);
  const cur = equippedAt(keyFor(it)), better = !cur || itemValue(it) > itemValue(cur);
  if (better) equipItem(it);
  toast('🎁 ' + itemLine(it) + (better ? ' — equipado!' : ''));
  if (invOpen) renderInv();
}
function dropLoot(e) {
  const tier = Math.min(5, state.act), r = rollDrop(e.kind, tier, e.boss, mainCls());
  if (r.mat) { state.mats[tier] = (state.mats[tier] || 0) + r.mat; ftAt(e.mesh.position, MATS[tier].icon + '+' + r.mat, '#9be3ff', 1.2); }
  if (r.item) giveItem(r.item);
}

function stageClear() {
  track('stage'); state.stage++; state.stageKills = 0; clearEnemies();
  state.gold += 20 * state.level;
  if (state.stage >= 5) { toast('⚠ O chefe se aproxima!'); showDialog(curAct().bossIntro, spawnBoss); }
  else toast('✅ Estágio ' + (state.stage - 1) + ' concluído!');
  save(state); refreshHud();
}

function bossDefeated() {
  track('boss'); const act = curAct(); clearEnemies();
  const replay = state.act < state.maxAct || state.storyDone;
  state.gold += 300 * (state.act + 1); state.gems += replay ? 4 : 10; state.cash += replay ? 30 : 100;
  toast('🏆 Chefe derrotado! +' + (replay ? 4 : 10) + '💎');
  save(state); refreshHud();
  if (replay) { state.stage = 1; state.stageKills = 0; save(state); refreshHud(); return; }
  showDialog(act.outro, () => {
    unlockHero(act.reward);
    if (state.act < ACTS.length - 1) {
      state.act++; state.maxAct = Math.max(state.maxAct, state.act); state.stage = 1; state.stageKills = 0; applyAct(); save(state); refreshHud();
      showDialog(curAct().intro);
    } else {
      state.endless = true; state.storyDone = true; state.stageKills = 0; save(state); refreshHud(); showDialog(ENDING);
    }
  });
}

function hitPlayer(e) {
  if (T < invuln) return;
  invuln = T + 0.6;
  let dmg = e.dmg * (1 - sk('armor') * 0.07) * (1 - Math.min(0.6, statSum('def'))) * CLASSES[hero.cls].taken * (mounted ? 0.5 : 1) * (T < bearUntil ? 0.35 : 1);
  shake = 0.25; playOnce(player, 'hit');
  if (shield > 0) { const ab = Math.min(shield, dmg); shield -= ab; dmg -= ab; }
  hp -= dmg;
  if (hp <= 0) {
    hp = maxHp; state.gold = Math.floor(state.gold * 0.9);
    clearEnemies(); ftAt(player.position, 'DERROTADO!', '#ff6b6b', 2.5); invuln = T + 3;
    timers.push({ at: T + 1.1, fn: () => { if (!inCity) { setCityMode(true); toast('☠ Você foi derrotado e levado de volta à cidade 🏰 (perdeu 10% do ouro)'); } } });
    refreshHud(); save(state);
  }
}

function nearestEnemy(pos, maxR) {
  let best = null, bd = maxR;
  enemies.forEach(e => { const d = dist2(e.mesh.position, pos); if (d < bd) { bd = d; best = e; } });
  return best;
}

function fire(from, to, color, dmg, opt) {
  opt = opt || {};
  const b = new THREE.Mesh(bulletGeo, new THREE.MeshBasicMaterial({ color }));
  b.position.copy(from).setY(1.2); b.scale.setScalar(opt.size || 1);
  const dir = to.clone().sub(from).setY(0).normalize();
  if (opt.arrow) { b.scale.set(0.35, 0.35, 2.4); b.rotation.y = Math.atan2(dir.x, dir.z); }
  scene.add(b);
  bullets.push({ mesh: b, dir, life: opt.life || 1.1, dmg, speed: opt.speed || 16, kind: opt.kind, pierce: !!opt.pierce, splash: opt.splash || 0, color, hit: new Set() });
}

function onBulletHit(b, e) {
  damageEnemy(e, b.dmg);
  if (b.kind === 'ice') e.slow = 1.8;
  if (b.kind === 'fire') explode(e.mesh.position, 1.8, Math.round(b.dmg * 0.5), 0xff6a2f, e);
  if (b.kind === 'bolt') {
    enemies.filter(x => x !== e && dist2(x.mesh.position, e.mesh.position) < 4.5).slice(0, 2).forEach(x => { ringFx(x.mesh.position, 0xffe94d, 1.5, 0.25); damageEnemy(x, Math.round(b.dmg * 0.6)); });
  }
  if (b.splash) explode(b.mesh.position, b.splash, Math.round(b.dmg * 0.7), b.color, e);
}

function meleeArc(target, range, arc, dmg, kb) {
  const p = player.position, a = Math.atan2(target.mesh.position.x - p.x, target.mesh.position.z - p.z);
  swingFx(p, a, range, arc, hero.color);
  enemies.slice().forEach(e => {
    const dx = e.mesh.position.x - p.x, dz = e.mesh.position.z - p.z, d = Math.hypot(dx, dz);
    if (d > range + e.radius || angDiff(Math.atan2(dx, dz), a) > arc / 2) return;
    damageEnemy(e, dmg);
    if (!e.boss && !e.dead) { e.mesh.position.x += dx / (d || 1) * kb; e.mesh.position.z += dz / (d || 1) * kb; }
  });
}

const ELEMENTS = [{ k: 'fire', c: 0xff6a2f }, { k: 'ice', c: 0x7fdcff }, { k: 'bolt', c: 0xffe94d }];

function doAttack(target) {
  const p = player.position, cls = hero.cls, dmg = atkPower(), tp = target.mesh.position, bear = T < bearUntil;
  if (bear) meleeArc(target, 3.6, Math.PI * 0.8, dmg, 1.5);
  else if (cls === 'warrior') meleeArc(target, hero.range + 0.6, Math.PI * 0.67, dmg, 1.3);
  else if (cls === 'paladin') { meleeArc(target, hero.range + 0.6, Math.PI * 0.67, dmg, 1.0); heal(1.5 + state.level * 0.15); }
  else if (cls === 'assassin') {
    if (dist2(tp, p) > 1.8) {
      const dx = p.x - tp.x, dz = p.z - tp.z, d = Math.hypot(dx, dz) || 1;
      ringFx(p, hero.color, 1.5, 0.3);
      p.x = THREE.MathUtils.clamp(tp.x + dx / d * 1.2, -WORLD, WORLD); p.z = THREE.MathUtils.clamp(tp.z + dz / d * 1.2, -WORLD, WORLD);
    }
    facing = Math.atan2(tp.x - p.x, tp.z - p.z);
    const crit = Math.random() < 0.35, v = Math.round(dmg * (crit ? 2 : 1));
    swingFx(p, facing, 1.8, Math.PI * 0.6, hero.color);
    damageEnemy(target, v, crit);
    enemies.slice().forEach(e => { if (e !== target && dist2(e.mesh.position, tp) < 1.6) damageEnemy(e, Math.round(v * 0.5)); });
  }
  else if (cls === 'mage') fire(p, tp, 0xff7a2f, dmg, { splash: 2.6, speed: 14, size: 1.5 });
  else if (cls === 'sorcerer') {
    const el = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
    overload = Math.min(100, overload + 7);
    if (overload > 70) { hp = Math.max(1, hp - 1.2); }
    fire(p, tp, el.c, dmg, { kind: el.k, size: 1.2 });
  }
  else if (cls === 'druid') {
    fire(p, tp, 0x7CFC00, dmg, { size: 1.1 });
    heal(2 + state.level * 0.2);
  }
  else if (cls === 'archer') fire(p, tp, 0xfff3a0, dmg, { arrow: true, pierce: true, speed: 22, life: 1.1 });
  playOnce(player, 'atk', Math.min(0.9, hero.rate / 1000 * 0.9));
}

function heal(v) {
  if (hp >= maxHp) return;
  hp = Math.min(maxHp, hp + v); ftAt(player.position, '+' + Math.round(v), '#7CFC00', 2.4);
}

function useSkill() {
  if (isPaused() || T < (skillReady[hero.id] || 0)) return;
  const cls = hero.cls, def = CLASSES[cls], p = player.position, dmg = atkPower();
  skillReady[hero.id] = T + def.ultCd; playOnce(player, 'ult', 1.0);
  const fwd = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
  if (cls === 'warrior') {
    ringFx(p, hero.color, 7, 0.5); shake = 0.35;
    enemies.slice().forEach(e => { if (dist2(e.mesh.position, p) < 7) { e.stun = 2.5; damageEnemy(e, dmg * 2); } });
    shield = Math.round(maxHp * 0.25); shieldUntil = T + 6; toast('🛡️ Grito de Guerra!');
  } else if (cls === 'paladin') {
    ringFx(p, 0xffe08a, 7, 0.6); shake = 0.3; heal(maxHp * 0.35); shield = Math.round(maxHp * 0.15); shieldUntil = T + 5;
    enemies.slice().forEach(e => { if (dist2(e.mesh.position, p) < 6.5) damageEnemy(e, Math.round(dmg * 2.5)); });
    toast('✨ Luz Sagrada!');
  } else if (cls === 'assassin') {
    invuln = T + 1.3; toast('🗡️ Dança das Sombras!');
    for (let i = 0; i < 6; i++) timers.push({ at: T + i * 0.18, fn: () => {
      const pool = enemies.filter(e => dist2(e.mesh.position, player.position) < 14); if (!pool.length) return;
      const t = pool[Math.floor(Math.random() * pool.length)], tp = t.mesh.position, pp = player.position;
      ringFx(pp, hero.color, 1.5, 0.3);
      pp.x = THREE.MathUtils.clamp(tp.x + 1.1, -WORLD, WORLD); pp.z = THREE.MathUtils.clamp(tp.z, -WORLD, WORLD);
      const crit = Math.random() < 0.35; damageEnemy(t, Math.round(dmg * 1.6 * (crit ? 2 : 1)), crit); ringFx(tp, 0xffffff, 2, 0.25);
    } });
  } else if (cls === 'mage') {
    const t = nearestEnemy(p, 14), tp = t ? t.mesh.position.clone() : p.clone().addScaledVector(fwd, 5);
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 12), glow(0xff5a1f)); m.position.set(tp.x, 22, tp.z);
    addEffect(m, 0.8, (k) => { m.position.y = 22 * (1 - k) + 0.5; }, () => { explode(tp, 6.5, dmg * 6, 0xff5a1f); shake = 0.5; });
    ringFx(tp, 0xff5a1f, 6.5, 0.8); toast('☄️ Meteoro!');
  } else if (cls === 'sorcerer') {
    const mult = 3 + overload / 20; ringFx(p, hero.color, 9, 0.6); shake = 0.4;
    enemies.slice().forEach(e => { if (dist2(e.mesh.position, p) < 9) damageEnemy(e, Math.round(dmg * mult)); });
    overload = 0; toast('🌀 Sobrecarga liberada!');
  } else if (cls === 'druid') {
    bearUntil = T + 6; toast('🐻 Forma de Urso!'); heal(maxHp * 0.15); ringFx(p, 0x7CFC00, 5, 0.6);
  } else if (cls === 'archer') {
    const t = nearestEnemy(p, 14), tp = t ? t.mesh.position.clone() : p.clone().addScaledVector(fwd, 5);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), new THREE.MeshBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(tp.x, 0.15, tp.z); ring.scale.setScalar(5); scene.add(ring);
    zones.push({ x: tp.x, z: tp.z, r: 5, until: T + 4, next: T, dmg: Math.round(dmg * 1.2), ring }); toast('🏹 Chuva de Flechas!');
  }
}

// ===================== Entrada =====================
const cv = renderer.domElement;
cv.addEventListener('pointerdown', (e) => {
  if (decor.on && !isPaused()) { decorDown(e); return; }
  if (isPaused() || joy.active) return;
  joy.t0 = performance.now(); joy.active = true; joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; cv.setPointerCapture(e.pointerId);
  const b = $('joy-base'), k = $('joy-knob');
  b.style.display = k.style.display = 'block'; b.style.left = k.style.left = e.clientX + 'px'; b.style.top = k.style.top = e.clientY + 'px';
});
cv.addEventListener('pointermove', (e) => {
  if (!joy.active || e.pointerId !== joy.id) return;
  const dx = e.clientX - joy.ox, dy = e.clientY - joy.oy, d = Math.min(60, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
  joy.dx = Math.cos(a) * d / 60; joy.dy = Math.sin(a) * d / 60;
  const k = $('joy-knob'); k.style.left = (joy.ox + Math.cos(a) * d) + 'px'; k.style.top = (joy.oy + Math.sin(a) * d) + 'px';
});
const endJoy = (e) => { if (e.pointerId !== joy.id) return;
  if (e.type === 'pointerup' && joy.active && performance.now() - joy.t0 < 350 && Math.hypot(e.clientX - joy.ox, e.clientY - joy.oy) < 12) handleTap(e.clientX, e.clientY); joy.active = false; joy.dx = joy.dy = 0; $('joy-base').style.display = $('joy-knob').style.display = 'none'; };
cv.addEventListener('pointerup', endJoy); cv.addEventListener('pointercancel', endJoy);
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase(); keys[k] = true;
  if (e.key === 'Escape') { if (invOpen) closeInv(); else if (panelOpen && !picking) closePanel(); else if (decor.on) toggleDecor(false); else if (inHome) leaveHome(); return; }
  if (k === ' ') useSkill(); if (k === 'm') toggleMount();
  if (k === 'e' && nearNpc && !isPaused()) openNpc(nearNpc);
  if (k === '+' || k === '=') setZoom(zoomT * 0.85); if (k === '-') setZoom(zoomT * 1.18);
  if (k === '1') switchHero(0); if (k === '2') switchHero(1); if (k === '3') switchHero(2);
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 62 : 50; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

// ===================== Skills de nível =====================
let picking = false, nextLightning = 2, nextNova = 4, nextFrost = 5, nextAura = 0, orbAngle = 0;
const orbMeshes = [];
let auraRing = null;

const skBtn = {};
function buildSkillBar() {
  const box = $('skillbar'); box.innerHTML = '';
  SKILLS.forEach(sd => {
    const b = document.createElement('button'); b.className = 'sk ' + sd.kind;
    b.innerHTML = '<i class="cd"></i><span class="ic">' + sd.icon + '</span><b class="lv"></b>';
    b.addEventListener('pointerdown', (e) => { e.stopPropagation(); skillTap(sd.id); });
    box.appendChild(b); skBtn[sd.id] = b;
  });
}
function renderSkillChips() {
  if (!skBtn.lightning) buildSkillBar();
  SKILLS.forEach(sd => { const b = skBtn[sd.id], l = sk(sd.id); b.classList.toggle('on', l > 0); b.querySelector('.lv').textContent = l || ''; });
}
function updateSkillCd() {
  for (const id of ['lightning', 'nova', 'frost']) {
    const l = sk(id), b = skBtn[id]; if (!b) continue;
    b.querySelector('.cd').style.height = (l && nx[id] > T ? Math.min(100, (nx[id] - T) / PERIOD[id](l) * 100) : 0) + '%';
  }
}
function skillTap(id) {
  if (isPaused()) return;
  const sd = skillById(id), l = sk(id);
  if (!l) { toast(sd.icon + ' ' + sd.name + ' — ainda não aprendida. Suba de nível para escolher!'); return; }
  if (nx[id] !== undefined) {
    if (T < nx[id]) { toast(sd.icon + ' ' + sd.name + ' recarregando: ' + Math.ceil(nx[id] - T) + 's'); return; }
    if (castSkill(id)) nx[id] = T + PERIOD[id](l); else toast('Sem inimigos por perto');
    return;
  }
  toast(sd.icon + ' ' + sd.name + ' Nv.' + l + ' — ' + sd.desc(l));
}

function openSkillPicker() {
  const choices = rollChoices(state.skills);
  if (!choices.length) { state.skillPts = 0; state.gold += 100 * state.level; toast('Todas as skills no máximo! +🪙'); return; }
  picking = true;
  const rows = [{ text: 'Nível ' + state.level + '! Escolha uma evolução (' + state.skillPts + ' pendente' + (state.skillPts > 1 ? 's' : '') + ')', head: true }];
  choices.forEach(c => {
    const cur = sk(c.id);
    rows.push({
      text: c.icon + ' ' + c.name + (c.kind === 'active' ? ' (ATIVA)' : '') + '  Nv.' + cur + ' → ' + (cur + 1) + '\n' + c.desc(cur + 1),
      btn: 'ESCOLHER', fn: () => pickSkill(c.id),
    });
  });
  openPanel('⬆ Evolução', rows);
}

function pickSkill(id) {
  state.skills[id] = Math.min(SKILL_MAX, sk(id) + 1); state.skillPts = Math.max(0, state.skillPts - 1);
  if (id === 'vigor') { maxHp = calcMaxHp(); hp = Math.min(maxHp, hp + 25); }
  picking = false; closePanel();
  const sd = skillById(id); toast(sd.icon + ' ' + sd.name + ' Nv.' + state.skills[id] + '!');
  renderSkillChips(); save(state);
}

const nx = { lightning: 2, nova: 4, frost: 5 };
const PERIOD = { lightning: (l) => 3.6 - l * 0.4, nova: (l) => 7 - l * 0.7, frost: (l) => 8 - l * 0.8 };
function castSkill(id) {
  const l = sk(id), p = player.position;
  if (id === 'lightning') {
    const tg = enemies.filter(e => dist2(e.mesh.position, p) < 16).sort((a, b) => dist2(a.mesh.position, p) - dist2(b.mesh.position, p)).slice(0, l + 1);
    if (!tg.length) return false;
    tg.forEach(e => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 14, 6), new THREE.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 1 }));
      m.position.set(e.mesh.position.x, 7, e.mesh.position.z);
      addEffect(m, 0.3, (k) => { m.material.opacity = 1 - k; });
      ringFx(e.mesh.position, 0xfff27a, 1.8, 0.3); damageEnemy(e, Math.round(atkPower() * (1.2 + l * 0.25)));
    });
    return true;
  }
  if (!enemies.length) return false;
  if (id === 'nova') { explode(p, 3.5 + l * 0.7, Math.round(atkPower() * (1.4 + l * 0.3)), 0xff6a2f); return true; }
  if (id === 'frost') {
    const r = 5 + l * 0.6; ringFx(p, 0x7fdcff, r, 0.5);
    enemies.slice().forEach(e => { if (dist2(e.mesh.position, p) < r) { e.slow = 2.5 + l * 0.4; damageEnemy(e, Math.round(atkPower() * (0.8 + l * 0.2))); } });
    return true;
  }
  return false;
}
function runSkills(dt) {
  const p = player.position;
  for (const id of ['lightning', 'nova', 'frost']) { const l = sk(id); if (l && T >= nx[id] && castSkill(id)) nx[id] = T + PERIOD[id](l); }
  updateSkillCd();
  const A = sk('aura');
  if (A) {
    const r = 2.2 + A * 0.4;
    if (!auraRing) { auraRing = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 48), new THREE.MeshBasicMaterial({ color: 0x9be37b, transparent: true, opacity: 0.55, side: THREE.DoubleSide })); auraRing.rotation.x = -Math.PI / 2; scene.add(auraRing); }
    auraRing.position.set(p.x, 0.12, p.z); auraRing.scale.setScalar(r);
    if (T >= nextAura) { nextAura = T + 0.5; const dmg = Math.round(atkPower() * (0.15 + A * 0.07)); enemies.slice().forEach(e => { if (dist2(e.mesh.position, p) < r + e.radius * 0.5) damageEnemy(e, dmg); }); }
  } else if (auraRing) { scene.remove(auraRing); auraRing = null; }
  const O = sk('orbs');
  orbMeshes.forEach((m, i) => { m.visible = O > 0 && i < O + 1; });
  if (O) {
    while (orbMeshes.length < O + 1) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), new THREE.MeshBasicMaterial({ color: 0xb28dff })); scene.add(m); orbMeshes.push(m); m.visible = true; }
    orbAngle += dt * 2.8; const n = O + 1;
    orbMeshes.forEach((m, i) => {
      if (i >= n) return;
      const a = orbAngle + i / n * Math.PI * 2; m.position.set(p.x + Math.cos(a) * 2.5, 1.2, p.z + Math.sin(a) * 2.5);
      enemies.slice().forEach(e => { if (T >= (e.orbCd || 0) && Math.hypot(e.mesh.position.x - m.position.x, e.mesh.position.z - m.position.z) < e.radius + 0.6) { e.orbCd = T + 0.5; damageEnemy(e, Math.round(atkPower() * 0.6)); } });
    });
  }
}

// ===================== Cidade, loja e mapa =====================
function setCityMode(on) {
  if (inHome) cleanupHome();
  if (on && wb) endWB();
  if (on && !inCity) track('city');
  inCity = on; fieldGroup.visible = !on; ground.visible = on; terrain.visible = !on; if (city) city.group.visible = on;
  clearEnemies(); nearNpc = null; walkGoal = null; $('talk').style.display = 'none';
  if (on) {
    setSky(['#6ec6ff', '#bfe6ff', '#fff1d6']); scene.fog.color.set(0xdff0ff); ground.material.color.set(0xb5d99c);
    player.position.set(CITY_SPAWN[0], 0, CITY_SPAWN[1]);
  } else {
    applyAct(); player.position.set(0, 0, 0);
    if (state.stage === 5 && !state.endless && !bossRef) spawnBoss();
  }
  setZoom(on ? 1.6 : 1); zoom = zoomT;
  pet.position.copy(player.position); camera.position.copy(player.position).add(_co.copy(CAM_OFFSET).multiplyScalar(zoom));
  $('citybtn').textContent = on ? '🌲 SAIR' : '🏰 CIDADE'; refreshHud();
}

function doUpgrade(it) {
  const c = upgradeCost(it), have = state.mats[it.tier] || 0;
  if (it.plus >= MAX_PLUS || state.gold < c.gold || have < c.mat) return false;
  state.gold -= c.gold; state.mats[it.tier] = have - c.mat; it.plus++; recalcHp(); save(state); refreshHud(); return true;
}

function openGear(title, slots, mode, back, keep) {
  const st = keep ? $('card').scrollTop : 0;
  const again = () => openGear(title, slots, mode, back, true);
  const rows = [];
  if (back) rows.push({ text: '◀ Voltar ao menu', btn: 'VOLTAR', fn: back });
  rows.push({ head: true, text: '🪙' + state.gold + '   ' + MATS.map((m, i) => m.icon + (state.mats[i] || 0)).join('  ') });
  slots.forEach(slot => {
    const list = state.items.filter(it => it.slot === slot).sort((a, b) => (isEquipped(b) ? 1 : 0) - (isEquipped(a) ? 1 : 0) || itemValue(b) - itemValue(a));
    rows.push({ head: true, text: slotIcon(slot) + ' ' + slotLabel(slot).toUpperCase() });
    if (mode === 'upgrade') {
      if (!list.length) rows.push({ text: 'Você ainda não tem peças desse tipo. Derrote monstros ou compre uma na loja.' });
      list.slice(0, 12).forEach(it => {
        const c = upgradeCost(it), maxed = it.plus >= MAX_PLUS;
        rows.push({ text: (isEquipped(it) ? '✅ ' : '') + itemLine(it), color: RAR[it.rar].color, btn: maxed ? 'MÁX' : '⬆ 🪙' + c.gold + ' ' + MATS[it.tier].icon + c.mat, enabled: !maxed && state.gold >= c.gold && (state.mats[it.tier] || 0) >= c.mat, fn: () => { doUpgrade(it); again(); } });
      });
    } else if (mode === 'sell') {
      const sellable = list.filter(it => !isEquipped(it));
      if (!sellable.length) rows.push({ text: 'Nada para vender aqui (itens equipados não são vendidos).' });
      sellable.forEach(it => rows.push({ text: itemLine(it), color: RAR[it.rar].color, btn: '🪙' + sellPrice(it), fn: () => { state.items.splice(state.items.indexOf(it), 1); state.gold += sellPrice(it); save(state); refreshHud(); again(); } }));
    } else if (mode === 'buy') {
      const t = Math.min(5, state.maxAct);
      for (const tt of t > 0 ? [t, t - 1] : [t]) [0, 1].forEach(rar => {
        const prev = newItem(slot, tt, rar, mainCls()), price = buyPrice(tt, rar);
        rows.push({ text: '🛒 ' + itemLine(prev), color: RAR[rar].color, btn: '🪙' + price, enabled: state.gold >= price, fn: () => { state.gold -= price; giveItem(newItem(slot, tt, rar, mainCls())); refreshHud(); again(); } });
      });
    }
  });
  if (mode === 'sell') {
    const junk = state.items.filter(it => it.rar === 0 && !isEquipped(it)), total = junk.reduce((a, it) => a + sellPrice(it), 0);
    rows.push({ head: true, text: '♻️ Vender todos os itens Comuns não equipados (' + junk.length + ')', btn: '🪙' + total, enabled: junk.length > 0, fn: () => { state.items = state.items.filter(it => !junk.includes(it)); state.gold += total; save(state); refreshHud(); again(); } });
  }
  openPanel(title, rows);
  if (keep) $('card').scrollTop = st;
}

const ROLE_DESC = { deco: 'Móveis e decoração para sua casa', smith: 'Melhora, compra e vende armas e escudos', armor: 'Melhora, compra e vende elmos, armaduras, calças e botas', merchant: 'Amuletos, anéis e compra de itens', summoner: 'Invoca heróis e criaturas', map: 'Mapa das florestas' };
const ROLE_SLOTS = { smith: ['weapon', 'offhand'], armor: ['helm', 'chest', 'legs', 'boots'], merchant: ['amulet', 'ring'] };
const ROLE_WHAT = { smith: 'armas e escudos', armor: 'armaduras', merchant: 'joias' };
function openNpcMenu(n) {
  if (isPaused()) return;
  walkGoal = null;
  const back = () => openNpcMenu(n), slots = ROLE_SLOTS[n.role];
  const rows = [{ head: true, text: n.icon + ' ' + n.title + '\n“' + n.talk + '”' }];
  if (slots) {
    const nm = ROLE_WHAT[n.role];
    rows.push({ text: '⬆ Melhorar ' + nm + '\nGaste ouro e materiais da floresta', btn: 'ABRIR', fn: () => openGear('⬆ Melhorar ' + nm, slots, 'upgrade', back) });
    rows.push({ text: '🛒 Comprar ' + nm + '\nEquipamentos da loja', btn: 'ABRIR', fn: () => openGear('🛒 Comprar ' + nm, slots, 'buy', back) });
    rows.push({ text: '💰 Vender itens\nO que você coletou dos monstros', btn: 'ABRIR', fn: () => openGear('💰 Vender itens', SLOT_ORDER, 'sell', back) });
  }
  if (n.role === 'deco') rows.push({ text: '🪑 Comprar móveis\nOs móveis vão para o seu baú. Depois, dentro da sua casa, toque em DECORAR para colocar.', btn: 'ABRIR', fn: () => openFurnShop(n) });
  if (n.role === 'market') {
    rows.push({ text: '🏪 Mercado de jogadores\nCompre e venda equipamentos com outros jogadores', btn: 'ABRIR', fn: () => social.openMarket('buy', back) });
    rows.push({ text: '🤝 Troca direta\nTroque itens e ouro com um amigo (os dois confirmam)', btn: 'ABRIR', fn: () => social.openTrade(back) });
  }
  if (n.role === 'herald') {
    rows.push({ text: '🐉 Chefe Mundial\nTodos os jogadores lutam juntos contra o mesmo chefe', btn: 'ABRIR', fn: () => social.openWBoss(back, enterWBoss) });
    rows.push({ text: '🏆 Ranking\nMaiores níveis, abates e chefes', btn: 'ABRIR', fn: () => social.openRank(back) });
    rows.push({ text: '🛡 Guilda\nCrie ou entre numa guilda e converse', btn: 'ABRIR', fn: () => social.openGuild(back) });
    rows.push({ text: '📜 Missões e conquistas\nDiárias, semanais e login', btn: 'ABRIR', fn: () => openQuests() });
  }
  if (n.role === 'summoner') rows.push({ text: '🔮 Invocar heróis e criaturas\nGaste 💎 para chamar aliados', btn: 'ABRIR', fn: () => openCrew() });
  if (n.role === 'map') {
    rows.push({ text: '🗺️ Mapa das florestas\nEscolha para onde viajar', btn: 'ABRIR', fn: () => openMap() });
    rows.push({ text: '🏰 Mapa da cidade\nVeja onde está cada morador', btn: 'ABRIR', fn: () => openCityMap() });
  }
  rows.push({ text: '👋 Até logo', btn: 'FECHAR', fn: closePanel });
  openPanel(n.icon + ' ' + n.title.split(',')[0], rows);
}
function openNpc(n) { openNpcMenu(n); }
function openFurnShop(n, keep) {
  const st = keep ? $('card').scrollTop : 0, again = () => openFurnShop(n, true);
  const rows = [{ text: '◀ Voltar ao menu', btn: 'VOLTAR', fn: () => openNpcMenu(n) }, { head: true, text: '🪙' + state.gold + '   Móveis no baú: ' + Object.values(state.stock).reduce((a, b) => a + b, 0) }];
  FURN.forEach(f => rows.push({ text: f.icon + ' ' + f.name + '\nNo baú: ' + (state.stock[f.k] || 0), btn: '🪙' + f.price, enabled: state.gold >= f.price, fn: () => { state.gold -= f.price; track('furn'); state.stock[f.k] = (state.stock[f.k] || 0) + 1; save(state); refreshHud(); again(); } }));
  openPanel('🪑 Comprar móveis', rows);
  if (keep) $('card').scrollTop = st;
}

function walkTo(n) { walkGoal = { x: n.pos[0], z: n.pos[1], npc: n }; toast('🚶 Indo falar com ' + n.title.split(',')[0] + '…'); }
function handleTap(x, y) {
  if (!inCity || !city || inHome || isPaused()) return;
  const r = renderer.domElement.getBoundingClientRect(); let best = null, bd = 70;
  const scr = (wx, wy, wz) => { const v = new THREE.Vector3(wx, wy, wz).project(camera); return v.z > 1 ? 1e9 : Math.hypot((v.x * 0.5 + 0.5) * r.width + r.left - x, (-v.y * 0.5 + 0.5) * r.height + r.top - y); };
  city.npcs.forEach(n => { const d = scr(n.pos[0], 2.2, n.pos[1]); if (d < bd) { bd = d; best = { npc: n }; } });
  PLOTS.forEach(p => { const d = scr(p.x, p.kind === 'house' ? 3 : 5, p.z); if (d < bd) { bd = d; best = { plot: p }; } });
  if (!best) return;
  if (best.npc) { const n = best.npc; if (dist2(player.position, { x: n.pos[0], z: n.pos[1] }) < 5.2) openNpcMenu(n); else walkTo(n); }
  else { const p = best.plot; if (dist2(player.position, { x: p.door[0], z: p.door[1] }) < 5.2) openPlotMenu(p); else { walkGoal = { x: p.door[0], z: p.door[1], plot: p }; toast('\u{1F6B6} Indo at\u00E9 ' + p.name + '\u2026'); } }
}

// ----- mapa da cidade e minimapa -----
function drawMap(cvs, full) {
  const c = cvs.getContext('2d'), S = cvs.width, h = S / 2, p = player.position;
  c.clearRect(0, 0, S, S); c.save(); c.beginPath(); c.arc(h, h, h - 2, 0, 7); c.clip();
  c.fillStyle = inCity ? '#79b85f' : '#2f5d2a'; c.fillRect(0, 0, S, S);
  let px = h, pz = h;
  if (inCity) {
    const k = (h - 8) / (CITY_R + 3), X = (x) => h + x * k, Z = (z) => h + z * k;
    px = X(p.x); pz = Z(p.z);
    c.fillStyle = '#cbbfa8'; c.beginPath(); c.arc(X(0), Z(0), 17.5 * k, 0, 7); c.fill();
    c.fillStyle = '#c9b48a'; c.fillRect(X(-3.2), Z(17), 6.4 * k, (CITY_R + 1 - 17) * k);
    c.fillStyle = '#ece5d6'; c.fillRect(X(-9), Z(-29), 18 * k, 7 * k);
    PLOTS.forEach(p => { c.save(); c.translate(X(p.x), Z(p.z)); c.rotate(-p.ry); c.fillStyle = state.homes[p.id] ? '#66e08a' : p.kind === 'house' ? '#d9c2a0' : '#b9a6c9'; c.fillRect(-p.w / 2 * k, -p.d / 2 * k, p.w * k, p.d * k); c.restore(); });
    c.fillStyle = '#4fc3f7'; c.beginPath(); c.arc(X(0), Z(0), 3 * k, 0, 7); c.fill();
    c.strokeStyle = '#b7bdc6'; c.lineWidth = full ? 6 : 3; c.beginPath(); c.arc(h, h, (CITY_R + 1.5) * k, Math.PI / 2 + 0.14, Math.PI / 2 - 0.14 + Math.PI * 2); c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = (full ? 22 : 11) + 'px sans-serif'; c.fillStyle = '#fff';
    c.fillText('🚪', X(0), Z(CITY_R + 1));
    city.npcs.forEach(n => {
      c.fillStyle = n.color; c.beginPath(); c.arc(X(n.pos[0]), Z(n.pos[1]), full ? 17 : 8.5, 0, 7); c.fill();
      c.font = (full ? 22 : 12) + 'px sans-serif'; c.fillStyle = '#000'; c.fillText(n.icon, X(n.pos[0]), Z(n.pos[1]) + 1);
    });
  } else {
    const k = (h - 8) / 32, X = (x) => h + (x - p.x) * k, Z = (z) => h + (z - p.z) * k;
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; for (let i = 1; i < 4; i++) { c.beginPath(); c.arc(h, h, h * i / 4, 0, 7); c.stroke(); }
    remotes.forEach(r => { if (r.w !== curW()) return; c.fillStyle = '#4fc3f7'; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(X(r.mesh.position.x), Z(r.mesh.position.z), full ? 8 : 5, 0, 7); c.fill(); c.stroke(); });
    enemies.forEach(e => { c.fillStyle = e.boss ? '#ff1744' : '#ff7043'; c.beginPath(); c.arc(X(e.mesh.position.x), Z(e.mesh.position.z), e.boss ? 7 : 3.5, 0, 7); c.fill(); });
  }
  c.restore();
  const f = facing, sz = full ? 13 : 8;
  c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath();
  [0, 2.5, -2.5].forEach((da, i) => { const a = f + da, x = px + Math.sin(a) * sz * (i ? 0.8 : 1.3), z = pz + Math.cos(a) * sz * (i ? 0.8 : 1.3); i ? c.lineTo(x, z) : c.moveTo(x, z); });
  c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = '#f5c542'; c.lineWidth = full ? 5 : 3; c.beginPath(); c.arc(h, h, h - 2, 0, 7); c.stroke();
}
function openCityMap() {
  if (!inCity || !city) { toast('O mapa da cidade só dentro da cidade 🏰'); return; }
  const rows = [{ head: true, text: 'Toque em IR para o personagem caminhar até o morador. Você também pode tocar direto no NPC na cidade.' }];
  city.npcs.forEach(n => rows.push({ text: n.icon + ' ' + n.title + '\n' + ROLE_DESC[n.role], btn: 'IR', fn: () => { closePanel(); walkTo(n); } }));
  PLOTS.filter(p => state.homes[p.id]).forEach(p => rows.push({ text: '🏠 ' + p.name + '\nSeu lar', btn: 'IR', fn: () => { closePanel(); walkGoal = { x: p.door[0], z: p.door[1], plot: p }; } }));
  rows.push({ text: '🏘️ Casas e prédios\nToque numa casa (🏠 à venda) ou prédio (🏢 aluguel) no mapa 3D para comprar e entrar.' });
  rows.push({ text: '🚪 Portão da cidade\nSair para a floresta', btn: 'SAIR', fn: () => { closePanel(); setCityMode(false); } });
  openPanel('🏰 MAPA DA CIDADE', rows);
  const cvm = document.createElement('canvas'); cvm.width = cvm.height = 360;
  cvm.style.cssText = 'width:100%;max-width:300px;display:block;margin:0 auto 10px';
  const card = $('card'); card.insertBefore(cvm, card.children[1]); drawMap(cvm, true);
}

// ===================== Casas e apartamentos =====================
const refreshPlots = () => { if (city) city.setOwned(state.homes, owners, myOid); };
function syncCam() { pet.position.copy(player.position); camera.position.copy(player.position).add(_co.copy(CAM_OFFSET).multiplyScalar(zoom)); }

function openPlotMenu(p) {
  if (isPaused()) return;
  walkGoal = null;
  const own = state.homes[p.id], o = owners[p.id], other = !own && o && o.oid !== myOid, house = p.kind === 'house', R = ROOMS[p.kind], again = () => openPlotMenu(p);
  const rows = [{ head: true, text: (house ? '🏠 ' : '🏢 ') + p.name + ' — ' + R.label + '\n' + (own ? 'Este lar é seu! Entre para decorar com móveis.' : other ? 'Morada de ' + o.name + '. Você pode visitar e ver a decoração.' : house ? 'Casa ampla para decorar do seu jeito.' : 'Apartamento aconchegante para morar e decorar.') }];
  if (other && o.name === meName()) rows.push({ head: true, text: '⚠ Esta casa tem o mesmo nome que o seu, mas foi comprada em outro navegador/aparelho, por isso você só pode visitar. Para ter acesso de dono, abra PERFIL → “Entrar com um código de conta” e use o código do navegador onde comprou.' });
  if (own) rows.push({ text: '🚪 Entrar\n' + (own.furn || []).length + ' móvel(is) na sala', btn: 'ENTRAR', fn: () => { closePanel(); enterHome(p); } });
  else if (other) rows.push({ text: '👀 Visitar a casa de ' + o.name + '\nVeja os móveis dele', btn: 'VISITAR', enabled: !!(net && net.connected), fn: () => { closePanel(); net.send({ t: 'visit', plot: p.id }); } });
  else rows.push({
    text: (house ? '🛒 Comprar ' : '🔑 Alugar ') + p.name + '\nSala de ' + R.w + '×' + R.d + ' m para mobiliar', btn: '🪙' + p.price, enabled: state.gold >= p.price,
    fn: () => { state.gold -= p.price; state.homes[p.id] = { furn: [] }; track('house'); save(state); refreshHud(); if (net) net.send({ t: 'buy', plot: p.id }); refreshPlots(); closePanel(); toast(house ? '🏠 Casa comprada!' : '🏢 Apartamento alugado!'); again(); },
  });
  rows.push({ text: '👋 Voltar', btn: 'FECHAR', fn: closePanel });
  openPanel((house ? '🏠 ' : '🏢 ') + p.name, rows);
}

function enterHome(p, visit) {
  if (!visit && !state.homes[p.id]) return;
  if (inHome) cleanupHome();
  homeVisit = visit || null; inHome = p; homeRoom = buildRoom(p.kind); homeRoom.items = []; scene.add(homeRoom.group);
  const mk = new THREE.Group();
  mk.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.28, depthWrite: false })));
  mk.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.1, 1)), new THREE.LineBasicMaterial({ color: 0xffe14d })));
  mk.visible = false; homeRoom.group.add(mk); decor.mark = mk; decor.sel = null;
  (visit ? visit.furn || [] : state.homes[p.id].furn || []).forEach(f => addFurn(f));
  if (city) city.group.visible = false;
  setSky(['#2b2140', '#4a3a66', '#7a5f8f']); scene.fog.color.set(0x2b2140); ground.material.color.set(0x241c33);
  clearEnemies(); nearNpc = null; walkGoal = null; $('talk').style.display = 'none';
  player.position.set(0, 0, homeRoom.hd - 1.8); facing = Math.PI;
  setZoom(1.7); zoom = zoomT; syncCam();
  document.body.classList.add('inhome'); $('minimap').style.display = 'none'; $('homebar').style.display = visit ? 'none' : 'flex'; $('decor').style.display = 'none';
  $('citybtn').textContent = '🚪 SAIR'; refreshHud(); toast(visit ? '👀 Visitando a casa de ' + visit.name : '🏠 ' + p.name + ' — toque em DECORAR para mobiliar');
}
function cleanupHome() {
  if (homeRoom) scene.remove(homeRoom.group);
  homeRoom = null; inHome = null; homeVisit = null; decor.on = false; decor.sel = null; decor.drag = false; decor.mark = null;
  document.body.classList.remove('inhome'); $('minimap').style.display = ''; $('homebar').style.display = 'none'; $('decor').style.display = 'none';
}
function leaveHome() {
  if (!inHome) return;
  const p = inHome; cleanupHome(); setCityMode(true);
  player.position.set(p.door[0], 0, p.door[1]); facing = p.ry; syncCam(); refreshPlots();
}

function homeSave() {
  if (homeVisit) return;
  const f = homeRoom.items.map(m => ({ k: m.userData.k, x: m.position.x, z: m.position.z, r: m.userData.r }));
  state.homes[inHome.id].furn = f; save(state); if (net) net.send({ t: 'furn', plot: inHome.id, furn: f });
}
function placeFurn(m, x, z) {
  const k = m.userData.k, [fw, fd] = footprint(k, m.userData.r), sn = (v) => Math.round(v * 2) / 2, C = THREE.MathUtils.clamp;
  m.position.x = C(sn(x), -homeRoom.hw + fw / 2, homeRoom.hw - fw / 2);
  m.position.z = k === 'painting' ? -homeRoom.hd + fd / 2 + 0.02 : C(sn(z), -homeRoom.hd + fd / 2, homeRoom.hd - fd / 2);
}
function addFurn(f) {
  const m = makeFurniture(f.k); m.userData.r = f.r || 0; m.rotation.y = m.userData.r * Math.PI / 2;
  homeRoom.group.add(m); homeRoom.items.push(m); placeFurn(m, f.x || 0, f.z || 0); return m;
}
function updateMark() {
  const s = decor.sel, mk = decor.mark; if (!mk) return;
  mk.visible = !!s; if (!s) return;
  const [fw, fd] = footprint(s.userData.k, s.userData.r); mk.scale.set(fw + 0.25, 1, fd + 0.25); mk.position.set(s.position.x, 0.06, s.position.z);
}
function buyFurn(f) {
  if (!inHome || homeVisit) return;
  if ((state.stock[f.k] || 0) > 0) state.stock[f.k]--; else if (state.gold >= f.price) { state.gold -= f.price; track('furn'); } else return;
  const m = addFurn({ k: f.k, x: 0, z: -1, r: 0 }); decor.sel = m; homeSave(); refreshHud(); updateMark(); renderDecor();
}
function rotFurn() { const m = decor.sel; if (!m || m.userData.k === 'painting') return; m.userData.r = (m.userData.r + 1) % 4; m.rotation.y = m.userData.r * Math.PI / 2; placeFurn(m, m.position.x, m.position.z); homeSave(); updateMark(); }
function delFurn() {
  const m = decor.sel; if (!m) return;
  state.stock[m.userData.k] = (state.stock[m.userData.k] || 0) + 1; homeRoom.group.remove(m); homeRoom.items.splice(homeRoom.items.indexOf(m), 1); decor.sel = null;
  homeSave(); refreshHud(); updateMark(); renderDecor(); toast('📦 Móvel guardado no seu baú de móveis');
}
function renderDecor() {
  const shop = $('decshop'), keep = shop.scrollLeft; shop.innerHTML = '';
  FURN.forEach(f => {
    const have = state.stock[f.k] || 0, b = el('button', 'dcard', null, shop); el('div', 'dic', f.icon, b); el('div', 'dnm', f.name, b); el('div', 'dpr', have ? '📦 x' + have + ' grátis' : '🪙' + f.price, b);
    b.disabled = !have && state.gold < f.price; b.onclick = () => buyFurn(f);
  });
  shop.scrollLeft = keep;
  const s = decor.sel, d = s && furnByKey(s.userData.k);
  $('decname').textContent = s ? d.icon + ' ' + d.name + ' — toque no chão ou arraste para mover' : '🪑 Toque num móvel para escolher, ou compre um abaixo';
  $('decrot').disabled = !s || s.userData.k === 'painting'; $('decdel').disabled = !s;
}
function toggleDecor(on) {
  if (!inHome || homeVisit) return;
  decor.on = on; decor.sel = null; decor.drag = false; updateMark();
  $('decor').style.display = on ? 'block' : 'none'; $('homebar').style.display = on ? 'none' : 'flex';
  joy.active = false; joy.dx = joy.dy = 0; $('joy-base').style.display = $('joy-knob').style.display = 'none';
  if (on) { setZoom(1.9); renderDecor(); } else setZoom(1.7);
}
const _rc = new THREE.Raycaster(), _pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _pt = new THREE.Vector3(), _nd = new THREE.Vector2();
function floorPoint(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect(); _nd.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  _rc.setFromCamera(_nd, camera); return _rc.ray.intersectPlane(_pl, _pt);
}
function pickFurn(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect(); let best = null, bd = 64;
  homeRoom.items.forEach(m => {
    const v = new THREE.Vector3(m.position.x, m.userData.k === 'painting' ? 2.2 : 0.9, m.position.z).project(camera); if (v.z > 1) return;
    const d = Math.hypot((v.x * 0.5 + 0.5) * r.width + r.left - cx, (-v.y * 0.5 + 0.5) * r.height + r.top - cy); if (d < bd) { bd = d; best = m; }
  });
  return best;
}
function decorDown(e) {
  if (!homeRoom) return;
  const m = pickFurn(e.clientX, e.clientY);
  if (m) { decor.sel = m; decor.drag = true; try { renderer.domElement.setPointerCapture(e.pointerId); } catch (x) {} }
  else if (decor.sel) { const q = floorPoint(e.clientX, e.clientY); if (q) { placeFurn(decor.sel, q.x, q.z); homeSave(); } }
  updateMark(); renderDecor();
}
renderer.domElement.addEventListener('pointermove', (e) => { if (!decor.drag || !decor.sel) return; const q = floorPoint(e.clientX, e.clientY); if (q) { placeFurn(decor.sel, q.x, q.z); updateMark(); } });
const endDecor = () => { if (decor.drag) { decor.drag = false; if (inHome) homeSave(); } };
renderer.domElement.addEventListener('pointerup', endDecor); renderer.domElement.addEventListener('pointercancel', endDecor);
$('decbtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (!isPaused()) toggleDecor(true); });
$('decdone').addEventListener('pointerdown', (e) => { e.stopPropagation(); toggleDecor(false); });
$('decrot').addEventListener('pointerdown', (e) => { e.stopPropagation(); rotFurn(); });
$('decdel').addEventListener('pointerdown', (e) => { e.stopPropagation(); delFurn(); });

// ===================== Telas: EQUIPAMENTO (boneco) e MOCHILA =====================
let invSel = null, bagFilter = 'all', invMsg = '', invMode = 'eq';
function el(tag, cls, text, parent) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; }
function artImg(src, parent) { const i = document.createElement('img'); i.src = src; i.draggable = false; i.alt = ''; if (parent) parent.appendChild(i); return i; }
// posição (em %) de cada espaço em volta do bonequinho
const DOLL_POS = { helm: [50, 9], amulet: [20, 24], ring: [80, 24], weapon: [14, 50], chest: [50, 36], offhand: [86, 50], legs: [50, 62], boots: [50, 88] };
const BAG_FILTERS = [['all', 'Tudo', null], ['wpn', 'Armas', ['weapon', 'offhand']], ['arm', 'Armaduras', ['helm', 'chest', 'legs', 'boots']], ['jew', 'Joias', ['amulet', 'ring']]];
const ghostKey = (type) => type === 'weapon' ? (WEAPON_KIND[mainCls()] || 'sword') : type === 'offhand' ? (OFF_KIND[mainCls()] || 'shield') : type;

function openInv(mode) { invOpen = true; invMode = mode || 'eq'; invSel = null; invMsg = ''; $('inv').classList.add('open'); renderInv(); }
function closeInv() { invOpen = false; $('inv').classList.remove('open'); }
function toggleInv(mode) { if (invOpen && invMode === (mode || 'eq')) closeInv(); else openInv(mode); }
const closeBoxes = closeInv;
function renderEquipBox() { if (invOpen) renderInv(); }
function renderBagBox() { if (invOpen) renderInv(); }

const FIGURE = (c) => `<svg class="figure" viewBox="0 0 200 300" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="hl" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="${c}" stop-opacity=".45"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient><linearGradient id="bd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a4d7a"/><stop offset="1" stop-color="#1b2540"/></linearGradient></defs><ellipse cx="100" cy="150" rx="98" ry="140" fill="url(#hl)"/><g fill="url(#bd)" stroke="#6d84c4" stroke-width="2.5" stroke-linejoin="round" opacity=".95"><circle cx="100" cy="36" r="21"/><rect x="91" y="54" width="18" height="12" rx="4"/><path d="M60 66 Q100 56 140 66 L148 152 L52 152 Z"/><path d="M60 68 L38 128 L52 136 L70 90 Z"/><path d="M140 68 L162 128 L148 136 L130 90 Z"/><path d="M54 152 L98 152 L94 272 L64 272 Z"/><path d="M102 152 L146 152 L136 272 L106 272 Z"/><ellipse cx="78" cy="278" rx="22" ry="8"/><ellipse cx="122" cy="278" rx="22" ry="8"/></g><ellipse cx="100" cy="292" rx="70" ry="6" fill="#000" opacity=".35"/></svg>`;

// ---- arrastar e soltar ----
function startDrag(e, it, fromKey) {
  if (e.button > 0) return;
  const sx = e.clientX, sy = e.clientY; let ghost = null;
  const marks = () => document.querySelectorAll('.slot[data-key]').forEach(n => n.classList.toggle('target', !fromKey && n.dataset.key === it.slot));
  const move = (ev) => {
    if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 10) {
      ghost = artImg(itemArt(it), document.body); ghost.className = 'dragghost'; marks();
      if (fromKey) $('inv').classList.add('dragout');
    }
    if (ghost) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; ev.preventDefault(); }
  };
  const end = (ev, cancel) => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cx);
    if (!ghost) { if (!cancel) { invSel = it.uid; invMsg = ''; renderInv(); } return; }
    ghost.remove(); $('inv').classList.remove('dragout'); marks(); document.querySelectorAll('.slot.target').forEach(n => n.classList.remove('target'));
    if (cancel) return;
    const under = document.elementFromPoint(ev.clientX, ev.clientY), slotEl = under && under.closest('.slot[data-key]');
    if (fromKey) { if (!slotEl && under && under.closest('.tray')) { unequipItem(it); toast('Item guardado na mochila'); } return; }
    if (slotEl && slotEl.dataset.key === it.slot) { equipItem(it); toast('✔ Equipado: ' + itemName(it)); }
    else if (slotEl) toast('Esse item não vai nesse espaço. Brilha em verde onde ele encaixa.');
  };
  const up = (ev) => end(ev, false), cx = (ev) => end(ev, true);
  window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cx);
}

function buildDetail(det, sel) {
  if (!sel) { el('div', 'hint', invMsg || (invMode === 'eq' ? '👆 Arraste um item até o boneco (encaixa onde brilha em verde) ou toque nele e aperte EQUIPAR.' : '👆 Toque num item para ver os detalhes, equipar ou vender.'), det); return; }
  const on = isEquipped(sel), row = el('div', 'det-row', null, det);
  const art = el('div', 'det-art', null, row); art.style.borderColor = RAR[sel.rar].color; artImg(itemArt(sel), art);
  const info = el('div', 'det-info', null, row);
  el('div', 'det-name', itemName(sel), info).style.color = RAR[sel.rar].color;
  el('div', 'det-sub', RAR[sel.rar].name + ' • ' + slotLabel(sel.slot) + ' • Floresta ' + (sel.tier + 1) + (on ? ' • ✔ equipado' : ''), info);
  el('div', 'det-stat', itemFmt(sel), info);
  if (!on) {
    const cur = equippedAt(keyFor(sel)), cmp = el('div', 'det-cmp', null, info);
    if (!cur) { cmp.textContent = 'Espaço vazio: equipar dá ' + itemFmt(sel); cmp.style.color = '#8be28b'; }
    else if (itemStat(cur) === itemStat(sel)) { const d = itemValue(sel) - itemValue(cur); cmp.textContent = (d >= 0 ? '▲ ' : '▼ ') + statFmt(itemStat(sel), Math.abs(d)).replace(/^[+-]/, '') + (d >= 0 ? ' a mais' : ' a menos') + ' que o equipado'; cmp.style.color = d >= 0 ? '#8be28b' : '#ff8a80'; }
    else { cmp.textContent = 'Troca ' + statFmt(itemStat(cur), itemValue(cur)) + ' por ' + itemFmt(sel); cmp.style.color = '#ffd166'; }
  }
  const acts = el('div', 'det-acts', null, det);
  if (on) el('button', 'bigbtn off', 'Desequipar', acts).onclick = () => unequipItem(sel);
  else el('button', 'bigbtn', '✔ EQUIPAR', acts).onclick = () => { equipItem(sel); invMsg = ''; };
  if (!on && inCity) el('button', 'bigbtn sell', 'Vender 🪙' + sellPrice(sel), acts).onclick = () => { state.items.splice(state.items.indexOf(sel), 1); state.gold += sellPrice(sel); invSel = null; save(state); refreshHud(); renderInv(); };
  if (!inCity && invMode === 'bag') el('div', 'det-note', 'Vender e melhorar: só na cidade 🏰', det);
}

function filterList(onlyFree) {
  const isType = !BAG_FILTERS.some(f => f[0] === bagFilter);
  const allowed = isType ? [bagFilter] : BAG_FILTERS.find(f => f[0] === bagFilter)[2];
  return state.items.filter(it => (!allowed || allowed.includes(it.slot)) && (!onlyFree || !isEquipped(it))).sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || b.rar - a.rar || itemValue(b) - itemValue(a));
}
function buildTabs(parent) {
  const tabs = el('div', 'tabs', null, parent);
  BAG_FILTERS.forEach(([id, label]) => { el('button', 'tab' + (bagFilter === id ? ' on' : ''), label, tabs).onclick = () => { bagFilter = id; invMsg = ''; renderInv(); }; });
  if (!BAG_FILTERS.some(f => f[0] === bagFilter)) el('button', 'tab on', 'Só ' + slotLabel(bagFilter) + ' ✕', tabs).onclick = () => { bagFilter = 'all'; renderInv(); };
}

function renderInv() {
  const root = $('inv'), old = root.querySelector('.bgrid,.traygrid'), keepScroll = old ? [old.scrollTop, old.scrollLeft] : [0, 0];
  root.innerHTML = '';
  const wrap = el('div', 'invwrap', null, root); wrap.dataset.mode = invMode;
  const sel = state.items.find(i => i.uid === invSel);
  const hd = el('div', 'inv-hd', null, wrap);
  el('div', 'inv-title', invMode === 'eq' ? '🧍 EQUIPAMENTO' : '🎒 MOCHILA', hd);
  el('button', 'inv-x', '✕', hd).onclick = closeInv;

  if (invMode === 'eq') {
    // ---- bonequinho com os espaços ----
    const dollBox = el('div', 'inv-doll', null, wrap);
    el('div', 'inv-sec', (state.custom ? state.custom.name : hero.name.split(' ')[0]) + ' • Nv.' + state.level + '  (o equipamento vale para o time todo)', dollBox);
    const man = el('div', 'mannequin', null, dollBox);
    man.insertAdjacentHTML('beforeend', FIGURE('#' + hero.color.toString(16).padStart(6, '0')));
    const target = sel && !isEquipped(sel) ? keyFor(sel) : null;
    Object.keys(DOLL_POS).forEach(key => {
      const it = equippedAt(key), b = el('button', 'slot' + (sel && it && sel.uid === it.uid ? ' sel' : '') + (target === key ? ' target' : ''), null, man);
      b.dataset.key = key; b.style.left = DOLL_POS[key][0] + '%'; b.style.top = DOLL_POS[key][1] + '%';
      if (it) { b.style.borderColor = RAR[it.rar].color; artImg(itemArt(it), b); if (it.plus) el('span', 'pl', '+' + it.plus, b); b.addEventListener('pointerdown', (e) => startDrag(e, it, key)); }
      else {
        artImg(ghostArt(ghostKey(key)), b); el('small', '', slotLabel(key), b);
        b.onclick = () => { bagFilter = key; invSel = null; invMsg = '👆 Espaço vazio: arraste para cá um item de ' + slotLabel(key) + ' da lista.'; renderInv(); };
      }
    });
    const pct = (v) => Math.round(v * 100);
    el('div', 'tot', '⚔️ Dano ' + atkPower() + '   ❤️ Vida ' + Math.round(maxHp) + '   🎯 Crítico ' + pct(Math.min(0.8, sk('crit') * 0.08 + statSum('crit'))) + '%   🛡️ Defesa ' + pct(Math.min(0.6, statSum('def') + sk('armor') * 0.07)) + '%   👟 Veloc. +' + pct(Math.min(0.5, statSum('spd'))) + '%', dollBox);

    // ---- bandeja de itens para arrastar ----
    const tray = el('div', 'tray', null, wrap);
    el('div', 'tray-title', '🎒 SEUS ITENS — arraste até o boneco', tray);
    buildTabs(tray);
    const list = filterList(true), grid = el('div', 'traygrid', null, tray);
    list.forEach(it => {
      const c = el('button', 'cell' + (invSel === it.uid ? ' sel' : ''), null, grid); c.style.borderColor = RAR[it.rar].color; artImg(itemArt(it), c);
      if (it.plus) el('span', 'pl', '+' + it.plus, c);
      c.addEventListener('pointerdown', (e) => startDrag(e, it, null));
    });
    if (!list.length) el('div', 'bag-empty', state.items.length ? 'Nenhum item livre desse tipo (os equipados já estão no boneco).' : 'Sem itens ainda. Derrote monstros nas florestas!', tray);
    grid.scrollTop = keepScroll[0]; grid.scrollLeft = keepScroll[1];
  } else {
    // ---- mochila em forma de bolsa ----
    const bag = el('div', 'bag', null, wrap);
    const bh = el('div', 'bag-hd', null, bag);
    el('div', 'bag-title', '🎒 BOLSA DE ITENS', bh); el('div', 'bag-count', state.items.length + ' / 60', bh);
    buildTabs(bag);
    const list = filterList(false), grid = el('div', 'bgrid', null, bag), total = Math.max(60, Math.ceil(list.length / 5) * 5);
    for (let i = 0; i < total; i++) {
      const it = list[i], c = el('button', 'cell' + (it ? '' : ' empty') + (it && invSel === it.uid ? ' sel' : ''), null, grid);
      if (!it) continue;
      c.style.borderColor = RAR[it.rar].color; artImg(itemArt(it), c);
      if (it.plus) el('span', 'pl', '+' + it.plus, c);
      if (isEquipped(it)) el('span', 'eqd', '✔', c);
      c.onclick = () => { invSel = it.uid; invMsg = ''; renderInv(); };
    }
    if (!list.length) el('div', 'bag-empty', state.items.length ? 'Nenhum item desse tipo.' : 'Mochila vazia. Derrote monstros nas florestas para coletar equipamentos!', bag);
    grid.scrollTop = keepScroll[0];
  }
  buildDetail(el('div', 'inv-det', null, wrap), sel);
}
$('inv').addEventListener('pointerdown', (e) => { if (e.target === $('inv')) closeInv(); });
$('eqbtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (!panelOpen && !dialogOpen && !creatorOpen) toggleInv('eq'); });
$('bagbtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (!panelOpen && !dialogOpen && !creatorOpen) toggleInv('bag'); });
$('minimap').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (isPaused()) return; if (inCity) openCityMap(); else openMap(); });

function openMap() {
  const rows = [{ head: true, text: '🗺️ Cada floresta tem inimigos mais fortes e drops melhores.\nSeu nível: ' + state.level }];
  ACTS.forEach((a, i) => {
    const r = REALMS[a.realm], lv = FOREST_LV[i], open = i <= state.maxAct, here = !state.endless && state.act === i;
    rows.push({
      text: (open ? '' : '🔒 ') + (i + 1) + '. ' + r.icon + ' ' + a.name + (here ? '   ← você está aqui' : '') + '\nInimigos Nv.' + lv + '–' + (lv + 4) + (state.level + 3 < lv ? '   ⚠ Perigoso' : '') + '\nDrops: equipamento T' + (i + 1) + ' • ' + MATS[i].icon + ' ' + MATS[i].name,
      btn: open ? (here ? 'AQUI' : 'IR') : '🔒', enabled: open && !here, fn: () => travelTo(i),
    });
  });
  if (state.storyDone) rows.push({ text: '♾ Aventura Infinita\nInimigos Nv.36+ • os melhores drops', btn: state.endless ? 'AQUI' : 'IR', enabled: !state.endless, fn: () => travelTo('endless') });
  openPanel('🗺️ MAPA', rows);
}

function travelTo(i) {
  closePanel(); clearEnemies();
  if (i === 'endless') { state.endless = true; state.act = ACTS.length - 1; } else { state.endless = false; state.act = i; }
  state.stage = 1; state.stageKills = 0;
  if (inCity) setCityMode(false); else { applyAct(); player.position.set(0, 0, 0); pet.position.copy(player.position); }
  save(state); refreshHud(); toast('🗺️ ' + (i === 'endless' ? 'Aventura Infinita' : ACTS[i].name));
}

$('questbtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (isPaused() || dialogOpen) return; openQuests(); });
$('citybtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (isPaused()) return; if (inHome) leaveHome(); else setCityMode(!inCity); });
$('mapbtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (!isPaused()) openMap(); });
$('zoomin').addEventListener('pointerdown', (e) => { e.stopPropagation(); setZoom(zoomT * 0.82); });
$('zoomout').addEventListener('pointerdown', (e) => { e.stopPropagation(); setZoom(zoomT * 1.22); });
$('talk').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (nearNpc) openNpc(nearNpc); });
window.addEventListener('wheel', (e) => { if (!isPaused()) setZoom(zoomT * (e.deltaY > 0 ? 1.1 : 0.9)); }, { passive: true });
let pinch = null;
const tdist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
cv.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) { pinch = { d: tdist(e.touches), z: zoomT }; joy.active = false; joy.dx = joy.dy = 0; $('joy-base').style.display = $('joy-knob').style.display = 'none'; }
}, { passive: true });
cv.addEventListener('touchmove', (e) => { if (pinch && e.touches.length === 2) setZoom(pinch.z * pinch.d / Math.max(10, tdist(e.touches))); }, { passive: true });
cv.addEventListener('touchend', (e) => { if (e.touches.length < 2) pinch = null; }, { passive: true });

// ===================== Online: outros jogadores =====================
const remoteGroup = new THREE.Group(); scene.add(remoteGroup);
const remotes = new Map();
let net = null, netLast = { x: 1e9, z: 1e9, f: 0, mv: 0, w: '' }, netAt = 0, netId = null;
const meName = () => ((state.custom && state.custom.name) || state.account || 'Viajante').toString().slice(0, 16);
function addRemote(p) {
  if (!p || p.id === netId || remotes.has(p.id)) return;
  let mesh; try { mesh = makeHero(buildPlayerHero(Object.assign({}, PREMADE[0], p.look || {}, { name: p.name }))); } catch (e) { mesh = makeHero(buildPlayerHero(PREMADE[0])); }
  const tag = nameTag(p.name || '?'); tag.position.set(0, 3.1, 0); mesh.add(tag);
  mesh.position.set(p.x || 0, 0, p.z || 0); remoteGroup.add(mesh);
  remotes.set(p.id, { id: p.id, name: p.name, mesh, x: p.x || 0, z: p.z || 0, f: p.f || 0, mv: 0, w: p.w || 'other' });
  refreshNet();
}
function dropRemote(id) { const r = remotes.get(id); if (!r) return; remoteGroup.remove(r.mesh); remotes.delete(id); refreshNet(); }
function chatLine(name, text, mine) {
  const log = $('chatlog'), d = document.createElement('div'); d.className = 'cl' + (mine ? ' me' : '');
  d.textContent = name + ': ' + text; log.appendChild(d); while (log.children.length > 6) log.removeChild(log.firstChild);
  setTimeout(() => d.remove(), 14000);
}
function refreshNet() { $('netbtn').textContent = (net && net.connected ? '🟢 ' + (remotes.size + 1) : '🔴 offline'); }
function syncHomes() {
  Object.keys(owners).forEach(id => { if (owners[id].oid === myOid && !state.homes[id]) { state.homes[id] = { furn: [] }; recover.add(id); net && net.send({ t: 'visit', plot: id }); } });
  Object.keys(state.homes).forEach(id => {
    const o = owners[id];
    if (o && o.oid !== myOid) { delete state.homes[id]; toast('⚠ ' + id + ' já pertence a ' + o.name); }
    else if (!o && net) { net.send({ t: 'buy', plot: id }); net.send({ t: 'furn', plot: id, furn: state.homes[id].furn || [] }); }
  });
  save(state); refreshPlots();
}
function netEvent(m) {
  if (m.t === 'plot') { owners[m.id] = { oid: m.oid, name: m.name }; refreshPlots(); }
  else if (m.t === 'buyfail') { delete state.homes[m.plot]; refreshPlots(); toast('⚠ Alguém comprou essa casa antes'); }
  else if (m.t === 'home' && recover.has(m.plot)) { recover.delete(m.plot); if (state.homes[m.plot]) { state.homes[m.plot].furn = m.furn || []; save(state); } toast('🏠 Casa recuperada: ' + m.plot); }
  else if (m.t === 'home') { const p = PLOTS.find(x => x.id === m.plot); if (p && inCity && !inHome) enterHome(p, { name: m.name, furn: m.furn }); }
  else if (m.t === 'hello') {
    myOid = m.oid || ''; Object.keys(owners).forEach(k => delete owners[k]); Object.assign(owners, m.plots || {}); syncHomes(); netId = m.id; remotes.forEach((r, id) => { if (id === netId) dropRemote(id); }); (m.players || []).forEach(addRemote); refreshNet(); }
  else if (m.t === 'join') addRemote(m.p);
  else if (m.t === 'leave') dropRemote(m.id);
  else if (m.t === 'furn') { if (homeVisit && homeRoom && inHome.id === m.plot) { homeRoom.items.forEach(x => homeRoom.group.remove(x)); homeRoom.items.length = 0; (m.furn || []).forEach(f => addFurn(f)); } }
  else if (m.t === 'move') { const r = remotes.get(m.id); if (r) { r.x = m.x; r.z = m.z; r.f = m.f; r.mv = m.mv; r.w = m.w; } }
  else if (m.t === 'chat') { if (String(m.text).startsWith('§e')) { const r = remotes.get(m.id), em = EMOTES[+String(m.text).slice(2)]; if (r && em && r.mesh.visible) ftAt(r.mesh.position, em, '#fff', 3.2); } else chatLine(m.name, m.text, false); }
}
function startNet() {
  const q = new URLSearchParams(location.search).get('net');
  if (testing || q === '0' || needAuth) { $('netbtn').style.display = $('chatbtn').style.display = 'none'; return; }
  net = createNet({ url: q && q.startsWith('ws') ? q : NET_URL, getMe: () => ({ name: meName(), look: state.custom || null, pid: state.pid }), onEvent: netEvent, onStatus: (ok) => { if (!ok) { remotes.forEach((r, id) => dropRemote(id)); netId = null; } refreshNet(); } });
  refreshNet();
}
const curW = () => inHome ? 'home:' + inHome.id : inCity ? 'city' : wb ? 'field:wb' : 'field:' + (state.endless ? 'inf' : state.act);
const whereTxt = (w) => w === 'city' ? 'Na cidade de Aurora' : w === 'field:wb' ? 'Lutando contra o Chefe Mundial' : w.startsWith('home:') ? 'Dentro de uma casa' : w === 'field:inf' ? 'Na Aventura Infinita' : w.startsWith('field:') ? 'Na floresta do Ato ' + (+w.slice(6) + 1) + (w === curW() ? ' (com você!)' : '') : 'Em outra área';
function updateNet(dt) {
  const w = curW();
  remoteGroup.visible = true;
  remotes.forEach(r => {
    const k = Math.min(1, dt * 9), m = r.mesh;
    const dx = r.x - m.position.x, dz = r.z - m.position.z, far = Math.hypot(dx, dz) > 8;
    m.position.x = far ? r.x : m.position.x + dx * k; m.position.z = far ? r.z : m.position.z + dz * k;
    m.rotation.y = angleLerp(m.rotation.y, r.f, k);
    m.position.y = r.w.startsWith('field') ? walkY(m.position.x, m.position.z) : 0;
    m.visible = r.w === w;
    if (m.visible) animateHero(m, dt, { moving: !!r.mv });
  });
  if (!net || !net.connected) return;
  netAt += dt;
  const p = player.position, moved = Math.hypot(p.x - netLast.x, p.z - netLast.z) > 0.05 || Math.abs(facing - netLast.f) > 0.1 || w !== netLast.w;
  if ((moved && netAt > 0.1) || netAt > 3) {
    netAt = 0; const mv = Math.hypot(p.x - netLast.x, p.z - netLast.z) > 0.05 ? 1 : 0;
    netLast = { x: p.x, z: p.z, f: facing, mv, w }; net.send({ t: 'move', x: +p.x.toFixed(2), z: +p.z.toFixed(2), f: +facing.toFixed(2), mv, w });
  }
}
function openOnline() {
  if (isPaused()) return;
  const rows = [{ head: true, text: net && net.connected ? '🟢 Conectado — ' + (remotes.size + 1) + ' jogador(es) online' : '🔴 Sem conexão com o servidor. Tentando reconectar…' }];
  rows.push({ text: '🧍 ' + meName() + ' (você)\n' + (inHome ? 'Em casa' : inCity ? 'Na cidade' : 'Nas florestas') });
  remotes.forEach(r => rows.push({ text: '🧍 ' + r.name + '\n' + (whereTxt(r.w)) }));
  if (!remotes.size) rows.push({ text: 'Ninguém mais por aqui agora. Chame um amigo para abrir o link! Na cidade 🏰 vocês aparecem juntos.' });
  rows.push({ text: '👋 Fechar', btn: 'FECHAR', fn: closePanel });
  openPanel('🌐 ONLINE', rows);
}
function sendChat() {
  const inp = $('chatinp'), t = inp.value.trim(); if (!t) return; inp.value = '';
  chatLine(meName(), t, true); if (net) net.send({ t: 'chat', text: t });
}
$('netbtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); openOnline(); });
$('chatbtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); const b = $('chatbar'), on = b.style.display !== 'flex'; b.style.display = on ? 'flex' : 'none'; if (on) $('chatinp').focus(); });
$('chatsend').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); sendChat(); });
$('chatinp').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') sendChat(); if (e.key === 'Escape') { $('chatbar').style.display = 'none'; $('chatinp').blur(); } });
$('chatinp').addEventListener('keyup', (e) => e.stopPropagation());

// ===================== Loop =====================
const tmpScale = new THREE.Vector3();
let playerGy = 0, splashAt = 0;

function update(dt) {
  T += dt;

  // movimento
  let dx = joy.dx + ((keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0));
  let dz = joy.dy + ((keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0));
  if (walkGoal) {
    const pp0 = player.position;
    if (Math.hypot(dx, dz) > 0.15) walkGoal = null;
    else { const wx = walkGoal.x - pp0.x, wz = walkGoal.z - pp0.z, wd = Math.hypot(wx, wz); if (wd < 3.2) { const g0 = walkGoal; walkGoal = null; if (g0.plot) openPlotMenu(g0.plot); else openNpcMenu(g0.npc); } else { dx = wx / wd; dz = wz / wd; } }
  }
  const m = Math.hypot(dx, dz); if (m > 1) { dx /= m; dz /= m; }
  const p = player.position, bear = T < bearUntil;
  const gyNow = inCity ? 0 : walkY(p.x, p.z), wet = gyNow < -0.35;
  const spd = (wet ? 0.62 : 1) * PLAYER_SPEED * (1 + sk('swift') * 0.06) * (1 + Math.min(0.5, statSum('spd'))) * CLASSES[hero.cls].spd * (mounted ? petDef.speed : 1) * (bear ? 0.9 : 1);
  p.x = THREE.MathUtils.clamp(p.x + dx * spd * dt, -WORLD, WORLD);
  p.z = THREE.MathUtils.clamp(p.z + dz * spd * dt, -WORLD, WORLD);
  if (inHome && homeRoom) {
    const zmax = Math.abs(p.x) < 1.2 ? homeRoom.hd + 0.7 : homeRoom.hd - 0.6;
    p.x = THREE.MathUtils.clamp(p.x, -homeRoom.hw + 0.7, homeRoom.hw - 0.7); p.z = THREE.MathUtils.clamp(p.z, -homeRoom.hd + 0.8, zmax);
    if (p.z > homeRoom.hd + 0.35) { leaveHome(); return; }
  } else if (inCity) {
    const gate = Math.abs(p.x) < 3.2 && p.z > 0, r = Math.hypot(p.x, p.z), lim = CITY_R - 1.2;
    if (!gate && r > lim) { p.x *= lim / r; p.z *= lim / r; }
    if (p.z > CITY_R + 0.5) { setCityMode(false); return; }
  }

  // alvo
  let target = null, best = hero.range;
  enemies.forEach(e => { const d = dist2(e.mesh.position, p); if (d < best) { best = d; target = e; } });
  const moving = m > 0.05;
  if (moving) facing = angleLerp(facing, Math.atan2(dx, dz), Math.min(1, dt * 14));
  else if (target) facing = angleLerp(facing, Math.atan2(target.mesh.position.x - p.x, target.mesh.position.z - p.z), Math.min(1, dt * 14));
  player.rotation.y = facing;

  // animação do herói
  animateHero(player, dt, { moving, mounted, spd: spd / PLAYER_SPEED });
  playerGy += (gyNow - playerGy) * Math.min(1, dt * 12);
  if (wet && moving && T > splashAt) { splashAt = T + 0.38; ringFx({ x: p.x, z: p.z }, 0xd6f2ff, 1.8, 0.7, WATER_Y + 0.03); }
  p.y = playerGy + (mounted ? petDef.seat - (player.userData.glb ? 0.9 : 0.55) : 0) + (player.userData.bob || 0);
  if (waterTex && !inCity) { waterTex.offset.x += dt * 0.03; waterTex.offset.y += dt * 0.011; }
  tmpScale.setScalar(bear ? 1.6 : 1); player.scale.lerp(tmpScale, Math.min(1, dt * 12));

  if (inCity && city && !inHome) {
    nearNpc = city.update(dt, p);
    const tb = $('talk');
    if (nearNpc) { tb.style.display = 'block'; const t = '💬 ' + nearNpc.icon + ' ' + nearNpc.title.split(',')[0]; if (tb.textContent !== t) tb.textContent = t; } else tb.style.display = 'none';
  }
  mmT += dt; if (mmT > 0.1) { mmT = 0; if (!inHome) drawMap($('minimap')); }
  // passivos
  if (hero.cls === 'druid' && hp < maxHp) hp = Math.min(maxHp, hp + (2 + state.level * 0.15) * dt);
  if (hero.cls === 'sorcerer') overload = Math.max(0, overload - 6 * dt);
  if (shield > 0 && T > shieldUntil) shield = 0;
  if (sk('regen') && hp < maxHp) hp = Math.min(maxHp, hp + sk('regen') * 1.2 * dt);
  runSkills(dt);
  if (state.skillPts > 0 && !testing && !isPaused()) openSkillPicker();

  // inimigos
  enemies.forEach(e => {
    e.stun = Math.max(0, e.stun - dt); e.slow = Math.max(0, e.slow - dt);
    const gE = walkY(e.mesh.position.x, e.mesh.position.z), sm = (e.stun > 0 ? 0 : (e.slow > 0 ? 0.4 : 1)) * (gE < -0.35 ? 0.7 : 1);
    const ep = e.mesh.position, vx = p.x - ep.x, vz = p.z - ep.z, d = Math.hypot(vx, vz) || 1;
    let mv = 1;
    if (e.ranged) {
      // atiradores: aproximam até o alcance, recuam se você chega perto, e atiram
      if (d > e.ranged.range) mv = 1; else if (d < e.ranged.keep) mv = -0.8; else mv = 0;
      if (sm > 0 && d < e.ranged.range + 2 && T > e.shotAt) { e.shotAt = T + e.ranged.cd * (0.85 + Math.random() * 0.3); enemyShoot(e, p); }
    }
    ep.x = THREE.MathUtils.clamp(ep.x + vx / d * e.speed * sm * mv * dt, -WORLD, WORLD); ep.z = THREE.MathUtils.clamp(ep.z + vz / d * e.speed * sm * mv * dt, -WORLD, WORLD);
    e.t += dt * 6;
    if (e.mesh.userData.glb) { ep.y = gE; animateHero(e.mesh, dt, { moving: sm > 0 && mv !== 0 && (mv < 0 || d > e.radius + 0.4), spd: sm }); }
    else ep.y = gE + Math.abs(Math.sin(e.t)) * 0.25;
    e.mesh.rotation.y = Math.atan2(vx, vz);
    if (e.flash > 0) { e.flash -= dt; const on = e.flash > 0; e.mesh.traverse(o => { if (o.isMesh && o.material.emissive) o.material.emissive.setHex(on ? 0xffffff : (e.elite ? 0x664400 : 0x000000)); }); }
    if (!e.ranged && d < e.radius + 0.5) { hitPlayer(e); if (e.mesh.userData.glb && T > (e.atkAt || 0)) { e.atkAt = T + 1.0; playOnce(e.mesh, 'atk', 0.6); } }
  });
  for (let i = dying.length - 1; i >= 0; i--) { const dd = dying[i]; animateHero(dd.mesh, dt, {}); if (T >= dd.until) { scene.remove(dd.mesh); dying.splice(i, 1); } }

  // ataque automático
  if (target && T - lastShot > hero.rate / 1000 * (1 - sk('haste') * 0.09)) { lastShot = T; doAttack(target); }

  updateAllies(dt);
  updateWorld(dt);
  updateWB(dt);

  // mascote
  const pp = pet.position, pu = pet.userData;
  petT += dt * 8;
  const pgy = inCity ? 0 : walkY(pp.x, pp.z);
  if (mounted) { pp.x = p.x; pp.z = p.z; pp.y = playerGy + (moving ? Math.abs(Math.sin(petT)) * 0.1 : 0); pet.rotation.y = facing; }
  else {
    pp.x += (p.x - 1.6 - pp.x) * Math.min(1, dt * 4); pp.z += (p.z + 1.2 - pp.z) * Math.min(1, dt * 4);
    pp.y = pgy + Math.abs(Math.sin(petT)) * (moving ? 0.14 : 0.04);
    pet.rotation.y = angleLerp(pet.rotation.y, facing, Math.min(1, dt * 6));
  }
  if (pu.tail) pu.tail.rotation.y = Math.sin(petT * 0.6) * 0.35;
  if (pu.wings) { const s = Math.sin(petT * 0.9) * 0.45; pu.wings[0].rotation.z = s; pu.wings[1].rotation.z = -s; }
  if (!mounted && T - petLast > petDef.rate) {
    const pt = nearestEnemy(pp, 8);
    if (pt) { petLast = T; fire(pp, pt.mesh.position, petDef.color, petDmg()); }
  }

  // projéteis inimigos
  for (let i = eshots.length - 1; i >= 0; i--) {
    const b = eshots[i];
    b.mesh.position.addScaledVector(b.dir, b.speed * dt); b.life -= dt;
    const hit = Math.hypot(b.mesh.position.x - p.x, b.mesh.position.z - p.z) < 0.8;
    if (hit) { hitPlayer({ dmg: b.dmg }); if (b.splash) ringFx(b.mesh.position, b.color, b.splash, 0.35); }
    if (hit || b.life <= 0) { scene.remove(b.mesh); b.mesh.material.dispose(); eshots.splice(i, 1); }
  }

  // projéteis
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.mesh.position.addScaledVector(b.dir, b.speed * dt); b.life -= dt;
    const hits = enemies.filter(e => !b.hit.has(e) && Math.hypot(e.mesh.position.x - b.mesh.position.x, e.mesh.position.z - b.mesh.position.z) < e.radius + 0.25);
    let remove = b.life <= 0;
    if (hits.length) {
      if (b.pierce) { hits.forEach(e => { b.hit.add(e); onBulletHit(b, e); }); }
      else { b.hit.add(hits[0]); onBulletHit(b, hits[0]); remove = true; }
    } else if (remove && b.splash) explode(b.mesh.position, b.splash, Math.round(b.dmg * 0.7), b.color);
    if (remove) { scene.remove(b.mesh); b.mesh.material.dispose(); bullets.splice(i, 1); }
  }

  // efeitos, zonas e temporizadores
  for (let i = effects.length - 1; i >= 0; i--) {
    const f = effects[i]; f.t += dt; const k = Math.min(1, f.t / f.dur);
    f.tick(k);
    if (k >= 1) { scene.remove(f.mesh); disposeObj(f.mesh); effects.splice(i, 1); if (f.end) f.end(); }
  }
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    if (T >= z.next) { z.next = T + 0.4; enemies.slice().forEach(e => { if (Math.hypot(e.mesh.position.x - z.x, e.mesh.position.z - z.z) < z.r) damageEnemy(e, z.dmg); }); ringFx({ x: z.x + (Math.random() - 0.5) * z.r, z: z.z + (Math.random() - 0.5) * z.r }, 0xfff3a0, 0.8, 0.25); }
    if (T >= z.until) { scene.remove(z.ring); disposeObj(z.ring); zones.splice(i, 1); }
  }
  for (let i = timers.length - 1; i >= 0; i--) { if (T >= timers[i].at) { const f = timers[i].fn; timers.splice(i, 1); f(); } }

  spawnTimer += dt; if (spawnTimer > 1.1) { spawnTimer = 0; autoSpawn(); }

  const cd = Math.max(0, (skillReady[hero.id] || 0) - T);
  $('skill').style.opacity = cd > 0 ? 0.45 : 1; updateSkillLabel(false, cd);
  $('hpbar').style.width = Math.max(0, hp / maxHp * 100) + '%';
  $('shieldbar').style.width = Math.min(100, shield / maxHp * 100) + '%';
}

let lastT = performance.now();
function frame() {
  requestAnimationFrame(frame);
  const nowT = performance.now(), dt = Math.min((nowT - lastT) / 1000, 0.05); lastT = nowT;
  if (!isPaused()) update(dt);
  updateNet(dt);
  const p = player.position;
  zoom += (zoomT - zoom) * Math.min(1, dt * 8);
  camera.position.lerp(new THREE.Vector3(p.x, 0, p.z).add(_co.copy(CAM_OFFSET).multiplyScalar(zoom)), Math.min(1, dt * 6));
  if (shake > 0) { shake -= dt; camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; }
  camera.lookAt(p.x, 0.8, p.z);
  farGroup.position.set(p.x, 0, p.z);
  sun.position.set(p.x + 10, 18, p.z + 7); sun.target.position.copy(p);
  renderer.render(scene, camera);
}

// ===================== Início =====================
await preloadModels((f) => { $('lfill').style.width = Math.round(f * 100) + '%'; });
$('loading').style.display = 'none';
city = buildCity(); scene.add(city.group); refreshPlots();
applyAct();
setHero();
startNet();
const qs = new URLSearchParams(location.search);
if (qs.get('pet') && PETS.some(p => p.id === qs.get('pet'))) state.activePet = qs.get('pet');
if (qs.get('mount')) { mounted = true; $('mount').textContent = '⬇ DESMONTAR'; }
if (qs.get('team')) { const ids = qs.get('team').split(',').filter(id => HEROES.some(h => h.id === id)).slice(0, MAX_TEAM); if (ids.length) { state.owned = Array.from(new Set(state.owned.concat(ids))); state.team = ids; activeIdx = 0; setHero(); } }
if (qs.get('act')) { state.act = Math.min(ACTS.length - 1, +qs.get('act') || 0); applyAct(); refreshHud(); }
setPet(); renderSkillChips();
if (qs.get('skills')) { qs.get('skills').split(',').forEach(x => { const [k, v] = x.split(':'); state.skills[k] = +v || 1; }); renderSkillChips(); }
if (qs.has('levelup')) state.skillPts = 1;
if (qs.has('city')) setCityMode(true);
if (qs.has('night')) dayT = +qs.get('night') || 0;
if (qs.has('quests')) setTimeout(() => openQuests(), 1500);
if (qs.has('dbg')) window.__g = { social, openQuests, state, giveItem, newItem, player, walkY, riverZ, riverHW, groundH, scene, terrain, ground, get inCity() { return inCity; } };
if (qs.get('pos')) { const iv = setInterval(() => { if (!gameStarted) return; clearInterval(iv); setTimeout(() => { const [px, pz] = qs.get('pos').split(',').map(Number); if (inCity) setCityMode(false); player.position.set(px || 0, 0, pz || 0); playerGy = walkY(px || 0, pz || 0); }, 600); }, 300); }
if (qs.has('zoom')) { setZoom(+qs.get('zoom')); zoom = zoomT; }
if (qs.has('eq')) { setTimeout(() => openInv('eq'), 300); }
if (qs.has('bag')) { setTimeout(() => { openInv('bag'); const x = state.items.find(i => !isEquipped(i)); invSel = x && x.uid; renderInv(); }, 300); }
if (qs.has('citymap')) { setTimeout(() => openCityMap(), 300); }
if (qs.has('loot')) { for (let i = 0; i < 12; i++) giveItem(newItem(SLOT_ORDER[i % 8], i % 3, i % 4, mainCls())); state.gold = 900; state.mats[0] = 7; }
if (qs.get('npc')) { setCityMode(true); openNpc(city.npcs.find(n => n.role === qs.get('npc'))); }
if (qs.has('home')) {
  state.gold = 99999; setCityMode(true); const hp_ = PLOTS[+qs.get('home') || 0]; state.homes[hp_.id] = state.homes[hp_.id] || { furn: [] }; refreshPlots();
  if (qs.has('plotview')) { player.position.set(hp_.door[0], 0, hp_.door[1] + 6); syncCam(); } else {
  enterHome(hp_); if (qs.has('furn')) ['bed', 'sofa', 'table', 'shelf', 'rug', 'plant', 'fireplace', 'painting'].forEach((k, i) => addFurn({ k, x: -4 + (i % 4) * 2.6, z: -3 + Math.floor(i / 4) * 3.4, r: 0 }));
  if (qs.has('decor')) toggleDecor(true); }
}
if (qs.has('visit')) setTimeout(() => { setCityMode(true); net && net.send({ t: 'visit', plot: PLOTS[+qs.get('visit') || 0].id }); }, 3500);
if (qs.get('edge')) { player.position.set(+qs.get('edge') - 0, 0, 0); }
camera.position.copy(player.position).add(_co.copy(CAM_OFFSET).multiplyScalar(zoom));

(function offlineReward() {
  const mins = Math.min(480, Math.floor((Date.now() - (state.lastSeen || Date.now())) / 60000));
  if (mins < 1 || testing) return;
  const gold = mins * state.level * 3; state.gold += gold; save(state); refreshHud();
  toast('Offline ' + mins + ' min: +' + gold + ' 🪙');
})();

if (qs.has('skipintro')) state.seen.intro = 1;

function applyCustom(custom) {
  state.custom = custom; upsertPlayer(custom);
  if (!state.owned.includes('player')) state.owned.push('player');
  if (!state.owned.includes('kaito')) state.owned.push('kaito');
  const rest = state.team.filter(id => id !== 'player' && state.owned.includes(id));
  state.team = ['player'].concat(rest).slice(0, MAX_TEAM);
  if (state.team.length < 2 && !state.team.includes('kaito')) state.team.push('kaito');
  activeIdx = 0;
}

function runCreator() {
  creatorOpen = true;
  openCreator({
    account: state.account, initial: state.custom, lockClass: state.custom ? state.custom.cls : null,
    onDone: (res) => {
      if (!res) { creatorOpen = false; return; }
      const { account, custom } = res;
      creatorOpen = false; state.account = account; applyCustom(custom); save(state);
      setHero(); refreshHud(); refreshTeam();
      if (!gameStarted) startGame();
    },
  });
}
function editCharacter() { closePanel(); runCreator(); }

let gameStarted = false;
function startGame() {
  gameStarted = true;
  if (!testing) {
    social.startPolls();
    const og = offlineGain(state);
    if (og) { state.gold += og.gold; state.lastSeen = Date.now(); save(state); refreshHud(); setTimeout(() => toast('💤 Enquanto você estava fora (' + (og.mins >= 60 ? Math.floor(og.mins / 60) + 'h' + (og.mins % 60 ? ' ' + og.mins % 60 + 'min' : '') : og.mins + ' min') + '), seus aliados juntaram 🪙' + og.gold), 1500); }
    if (!loginState(state).got) setTimeout(() => toast('🎁 Recompensa de login disponível! Abra 📜 MISSÕES'), og ? 5000 : 2000);
  }
  if (!state.seen.intro) { state.seen.intro = 1; save(state); showDialog(INTRO.concat(ACTS[0].intro)); }
  else if (state.stage === 5 && !state.endless && !bossRef) spawnBoss();
}

if (qs.has('nocreator') && !state.custom) { state.account = 'Teste'; applyCustom(Object.assign({}, PREMADE[Number(qs.get('nocreator')) || 0])); setHero(); }

function legacySave() {
  try { const raw = localStorage.getItem('acrpg'); if (!raw) return null; const o = JSON.parse(raw); if (!o.custom) return null; return { raw, name: o.custom.name || 'Herói', cls: o.custom.cls, level: o.level || 1, pid: /^[a-f0-9]{32}$/.test(o.pid || '') ? o.pid : '' }; } catch (e) { return null; }
}
if (!testing) {
  frame();
  if (needAuth) {
    openAuth({
      legacy: legacySave,
      offline: () => { location.href = location.pathname + '?local=1'; },
      newChar: (acct) => new Promise(res => { creatorOpen = true; openCreator({ account: acct, initial: null, canCancel: true, onDone: (r) => { creatorOpen = false; res(r ? { custom: r.custom } : null); } }); }),
    });
  } else if (!state.account || !state.custom || qs.has('creator')) runCreator(); else startGame();
} else {
  runSelfTest();
}

// ===================== Autoteste (?selftest=1) =====================
function runSelfTest() {
  const out = [];
  try {
    state.owned = HEROES.map(h => h.id); state.pets = PETS.map(p => p.id);
    for (const h of HEROES) {
      state.team = [h.id]; activeIdx = 0; setHero(); player.position.set(0, 0, 0); clearEnemies();
      for (let i = 0; i < 8; i++) spawnEnemy(false);
      enemies.forEach((e, i) => e.mesh.position.set(Math.cos(i) * 3, 0, Math.sin(i) * 3));
      useSkill();
      for (let i = 0; i < 240; i++) { update(0.05); if (i === 80 || i === 160) { skillReady[h.id] = 0; useSkill(); if (enemies.length < 3) for (let k = 0; k < 6; k++) spawnEnemy(false); } }
      out.push('classe ' + h.cls + ' (' + h.id + '): ok  abates=' + state.kills);
    }
    for (const cls of CLASS_LIST) {
      applyCustom(Object.assign({}, PREMADE[0], { cls })); state.team = ['player']; activeIdx = 0; setHero(); player.position.set(0, 0, 0); clearEnemies();
      for (let i = 0; i < 8; i++) spawnEnemy(false);
      enemies.forEach((e, i) => e.mesh.position.set(Math.cos(i) * 3, 0, Math.sin(i) * 3));
      useSkill();
      for (let i = 0; i < 200; i++) { update(0.05); if (i === 80) { skillReady.player = 0; useSkill(); if (enemies.length < 3) for (let k = 0; k < 6; k++) spawnEnemy(false); } }
      out.push('criador/classe ' + cls + ': ok');
    }
    for (const pm of PREMADE) { makeHero(buildPlayerHero(pm)); }
    out.push('personagens prontos (' + PREMADE.length + '): ok');
    for (const cls of CLASS_LIST) for (const m of CLASS_MODELS[cls]) for (const hat of [true, false]) {
      const g = makeHero(buildPlayerHero(Object.assign({}, PREMADE[4], { cls, model: m[0], hat })));
      animateHero(g, 0.05, {}); playOnce(g, 'atk'); animateHero(g, 0.3, {}); playOnce(g, 'ult'); animateHero(g, 0.5, { moving: true }); animateHero(g, 0.5, { mounted: true });
    }
    out.push('modelos 3D x classes x elmo: ok (3D=' + (player.userData.glb ? 'sim' : 'NAO, fallback') + ')');
    state.owned = HEROES.map(h => h.id); state.owned.push('player');
    for (const p of PETS) { state.activePet = p.id; setPet(); toggleMount(); update(0.05); toggleMount(); update(0.05); }
    out.push('criaturas + montaria: ok');
    state.team = ['kaito', 'ren', 'thalia']; activeIdx = 0; setHero(); switchReady = 0; switchHero(2); switchReady = 0; switchHero(1);
    out.push('troca de herois: ok (ativo=' + hero.id + ')');
    // skills de nível
    state.skills = {}; SKILLS.forEach(x => { state.skills[x.id] = SKILL_MAX; }); renderSkillChips();
    state.team = ['kaito']; activeIdx = 0; setHero(); player.position.set(0, 0, 0); clearEnemies(); maxHp = calcMaxHp(); hp = maxHp;
    for (let i = 0; i < 10; i++) spawnEnemy(false);
    enemies.forEach((e, i) => e.mesh.position.set(Math.cos(i) * 4, 0, Math.sin(i) * 4));
    for (let i = 0; i < 160; i++) { update(0.05); if (enemies.length < 4) for (let k = 0; k < 6; k++) { const e = spawnEnemy(false); e.mesh.position.set(Math.cos(k) * 4, 0, Math.sin(k) * 4); } }
    const ch = rollChoices({}); if (ch.length !== 3) throw new Error('rollChoices');
    out.push('skills (' + SKILLS.length + ', todas Nv.5): ok  maxHp=' + maxHp);
    state.skills = {}; renderSkillChips();
    // cidade, equipamentos, drops e mapa
    state.items = []; state.equip = {}; state.mats = {}; state.gold = 1e6; state.maxAct = 5; state.act = 0; state.endless = false; state.stage = 1;
    setCityMode(true);
    for (let i = 0; i < 40; i++) update(0.05);
    for (const n of city.npcs) { openNpc(n); closePanel(); }
    closePanel();
    const hp0 = calcMaxHp(), at0 = atkPower();
    for (const slot of Object.keys(SLOTS)) {
      const it = newItem(slot, 2, 2); giveItem(it); state.mats[2] = 99;
      for (let k = 0; k < 3; k++) if (!doUpgrade(it)) throw new Error('upgrade falhou');
      if (itemValue(it) <= 0) throw new Error('valor');
    }
    for (const md of ['upgrade', 'buy', 'sell']) { openGear('t', SLOT_ORDER, md, null); closePanel(); } openProfile(); closePanel(); openInv('eq'); renderInv(); invSel = state.items[0].uid; renderInv(); bagFilter = 'helm'; renderInv(); invMode = 'bag'; renderInv(); invMode = 'eq'; bagFilter = 'all'; const spare = newItem('helm', 0, 0); state.items.push(spare); invSel = spare.uid; renderInv(); closeInv(); invSel = null; openMap(); closePanel(); openCityMap(); closePanel(); renderEquipBox(); toggleInv("eq"); toggleInv("eq"); handleTap(215, 450); walkTo(city.npcs[0]); for (let i = 0; i < 200 && walkGoal; i++) update(0.05); if (!panelOpen) throw new Error('NPC nao abriu menu ao chegar'); closePanel();
    if (!(calcMaxHp() > hp0 && atkPower() > at0)) throw new Error('equipamento nao aumentou status');
    // morte na floresta leva de volta a cidade
    setCityMode(false); clearEnemies(); hp = 1; maxHp = Math.max(maxHp, 10); hitPlayer({ dmg: 1e6 }); for (let i = 0; i < 40; i++) update(0.05); if (!inCity) throw new Error('morte nao levou a cidade'); setCityMode(false); if (inCity) throw new Error('nao voltou');
    state.gold = 1e6;
    // casas: comprar, entrar, mobiliar, sair
    { const pl = PLOTS[0], pa = PLOTS.find(x => x.kind === 'apt'); state.gold = 1e6; state.homes = {};
      openPlotMenu(pl); closePanel(); openPlotMenu(pa); closePanel();
      for (const q of [pl, pa]) {
        state.homes[q.id] = { furn: [] }; refreshPlots(); enterHome(q); toggleDecor(true);
        for (const f of FURN) buyFurn(f); decor.sel = homeRoom.items[0]; rotFurn(); placeFurn(decor.sel, 99, 99); homeSave(); renderDecor();
        if (homeRoom.items.length !== FURN.length) throw new Error('moveis');
        const n = homeRoom.items.length, k0 = decor.sel.userData.k, s0 = state.stock[k0] || 0; delFurn(); if (homeRoom.items.length !== n - 1 || (state.stock[k0] || 0) !== s0 + 1) throw new Error('guardar movel');
        toggleDecor(false); for (let i = 0; i < 20; i++) update(0.05);
        player.position.set(0, 0, homeRoom.hd + 0.5); update(0.05); if (inHome) throw new Error('nao saiu da casa');
        if (!inCity || state.homes[q.id].furn.length !== FURN.length - 1) throw new Error('moveis nao salvos');
        enterHome(q); if (homeRoom.items.length !== FURN.length - 1) throw new Error('recarregar moveis'); leaveHome();
      }
      enterHome(pl, { name: 'Amigo', furn: [{ k: 'bed', x: 0, z: 0, r: 1 }] }); if (homeRoom.items.length !== 1 || !homeVisit) throw new Error('visita'); toggleDecor(true); if (decor.on) throw new Error('visitante decorou'); leaveHome();
      owners.p3 = { oid: 'zz', name: 'Beto' }; refreshPlots(); openPlotMenu(PLOTS[3]); closePanel(); delete owners.p3; refreshPlots();
      openNpc(city.npcs.find(x => x.role === 'deco')); openFurnShop(city.npcs.find(x => x.role === 'deco')); closePanel();
      openCityMap(); closePanel(); drawMap($('minimap'));
      walkGoal = { x: pl.door[0], z: pl.door[1], plot: pl }; player.position.set(pl.door[0] + 6, 0, pl.door[1]); for (let i = 0; i < 200 && walkGoal; i++) update(0.05); if (!panelOpen) throw new Error('casa nao abriu ao chegar'); closePanel();
      out.push('casas/predios/moveis: ok'); }
    travelTo(2); if (inCity || state.act !== 2) throw new Error('viagem');
    setCityMode(true); if (!inCity) throw new Error('cidade'); travelTo(0);
    for (let i = 0; i < 20; i++) { const e = spawnEnemy(false); damageEnemy(e, 1e9); }
    out.push('cidade/NPCs/equipamento/mapa: ok  (itens=' + state.items.length + ', mochila, hp ' + hp0 + '→' + calcMaxHp() + ', atk ' + at0 + '→' + atkPower() + ')');
    state.items = []; state.equip = {}; state.mats = {}; state.gold = 0; state.maxAct = 0; state.storyDone = false; state.endless = false; state.act = 0; state.stage = 1; recalcHp();
    // história completa
    state.act = 0; state.stage = 1; state.stageKills = 0; state.endless = false; applyAct(); clearEnemies(); hp = 1e9; maxHp = 1e9; state.skills = {};
    let guard = 0;
    while (!state.endless && guard++ < 5000) {
      if (state.stage < 5) { const e = spawnEnemy(false); damageEnemy(e, 1e9); }
      else { const b = enemies.find(x => x.boss) || spawnEnemy(true, { name: 'x', color: 0xffffff }); damageEnemy(b, 1e9); }
    }
    out.push('historia completa: ' + (state.endless ? 'ok' : 'FALHOU') + ' (atos=' + (state.act + 1) + ', herois=' + state.owned.length + ', time=' + state.team.join(',') + ')');
    // metajogo, mundo, eventos
    state.endless = true; applyAct(); setCityMode(false); clearEnemies(); hp = 1e9; maxHp = 1e9;
    const mm = ensureMeta(state), k0 = mm.cnt.kill || 0; const e1 = spawnEnemy(false); damageEnemy(e1, 1e9); if ((state.meta.cnt.kill || 0) <= k0) throw new Error('track kill');
    mm.dq[0].have = mm.dq[0].need; if (questsClaimable() < 2) throw new Error('missao nao contou'); openQuests(); closePanel();
    track('kill', 20000); if (!state.meta.ach.k10000) throw new Error('conquista');
    const lr = claimLogin(state); if (!lr || claimLogin(state)) throw new Error('login diario');
    const el = spawnEnemy(false); el.elite = true; damageEnemy(el, 1e9);
    startEvent(); if (!ev) throw new Error('evento'); const evEn = enemies.filter(x => x.ev); evEn.forEach(x => damageEnemy(x, 1e9)); if (ev) throw new Error('evento nao terminou');
    dayT = 0; updateWorld(0.1); if (night < 0.8) throw new Error('noite'); dayT = 0.5; updateWorld(0.1); if (night > 0.2) throw new Error('dia');
    weather = 'rain'; weatherLeft = 99; updateWorld(0.1); if (!rainPts) throw new Error('chuva'); weather = 'clear';
    const ch0 = chestMeshes[0]; if (!ch0) throw new Error('sem bau'); player.position.set(ch0.x, 0, ch0.z); state.meta.chests = {}; updateWorld(0.1); if (!state.meta.chests[ch0.i]) throw new Error('bau nao abriu');
    doEmote(0);
    enterWBoss({ cycle: 1, name: 'Teste', icon: '🐉', color: 0xff3300, hp: 1000, maxhp: 2000 }); if (!wb || !bossRef || !bossRef.wb) throw new Error('arena do chefe mundial');
    for (let i = 0; i < 30; i++) { player.position.set(bossRef.mesh.position.x + 1, 0, bossRef.mesh.position.z); update(0.1); damageEnemy(bossRef, 500); }
    if (!(wb.pending > 1000)) throw new Error('dano do chefe mundial nao acumulou'); if (curW() !== 'field:wb') throw new Error('presenca wb');
    endWB(); if (wb || !inCity) throw new Error('saida do chefe mundial'); setCityMode(false);
    out.push('missoes/conquistas/login/eventos/clima/baus/emotes: ok (conquistas=' + Object.keys(state.meta.ach).length + ')');
    for (let i = 0; i < 120; i++) update(0.05);
    out.push('SELFTEST OK');
  } catch (err) { out.push('ERRO: ' + err.message + '\n' + (err.stack || '')); }
  document.title = out[out.length - 1].startsWith('SELFTEST OK') ? 'SELFTEST OK' : 'SELFTEST FAIL';
  const pre = document.createElement('pre'); pre.id = 'selftest'; pre.textContent = out.join('\n');
  pre.style.cssText = 'position:fixed;inset:0;z-index:999;background:#000;color:#0f0;font:12px monospace;padding:10px;white-space:pre-wrap;overflow:auto';
  document.body.appendChild(pre);
}
