import * as THREE from 'three';
import { ULT_LV, ULT_EVO, CLASSES, CLASS_MODELS, REALMS, RARITY, HEROES, ACTS, INTRO, ENDING, PREMADE, buildPlayerHero, portraitUrl, BASE } from './data.js';
import { std, metal, glow, shadowAll } from './models.js';
import { makeHero, makeSkeleton, animateHero, playOnce, preloadModels } from './actors.js';
import { openCreator, CLASS_LIST } from './creator.js';
import { SKILLS, SKILL_MAX, skillById, rollChoices } from './skills.js';
import { initCraft } from './craft.js';
import { initShop } from './shop.js';
import { itemGemSum, SLOTS, SLOT_ORDER, EQUIP_KEYS, KINDS, WEAPON_KIND, OFF_KIND, RAR, MATS, FOREST_LV, MAX_PLUS, newItem, itemValue, itemStat, itemIcon, itemFmt, statFmt, itemName, itemLine, sellPrice, buyPrice, upgradeCost, rollDrop, migrateItems } from './items.js';
import { itemArt, ghostArt } from './itemart.js';
import { buildCity, CITY_R, CITY_SPAWN, PLOTS, DISTRICTS, drawCityBase, pushOutCity, cityPath, camClear } from './city.js';
import { createNet, nameTag, NET_URL } from './net.js';
import { makeBiome, groundTex, BIOME_INFO } from './biomes.js';
import { EXTRA_PETS } from './pets.js';
import { createAmbient } from './ambient.js';
import { buildCave } from './cave.js';
import { makeCreature, CREATURE_TYPES, hordeWeights, hordeTitle } from './creatures.js';
import { createVfx } from './vfx.js';
const IMG = ((import.meta.env && import.meta.env.BASE_URL) || './') + 'img/';
import { QUESTS, ACH, LOGIN_DAYS, ensureMeta, loginState, claimLogin, loginReward, questReward, offlineGain } from './meta.js';
import { initSocial } from './social.js';
import { openAuth, api, getSess, setSess } from './auth.js';
import { ROOMS, SZ_MAX, FLOOR_TINT, roomDims, FURN, furnByKey, makeFurniture, footprint, buildRoom } from './home.js';

const WORLD = 200;          // metade do tamanho do mapa
const PLAYER_SPEED = 7;
const CITY_CENTER = [0, 10];
const MAX_TEAM = 1;

const testing = new URLSearchParams(location.search).has('selftest');
const _q0 = new URLSearchParams(location.search);
const LOCAL = testing || _q0.has('local') || _q0.get('net') === '0' || _q0.has('nocreator');   // modo de teste/offline: sem conta
const sess = LOCAL ? null : getSess();
const needAuth = !LOCAL && !(sess && sess.cid);
const $ = (id) => document.getElementById(id);

// ===================== Save =====================
const defaults = () => ({
  gold: 0, gems: 80, cash: 500, level: 1, kills: 0,
  profs: {}, profOwned: [], gembag: {}, owned: ['kaito'], team: ['kaito'], upgrades: { atk: 0, hp: 0 }, stars: {},
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
  if (s.custom) { if (!s.owned.includes('player')) s.owned.push('player'); if (!s.owned.includes('kaito')) s.owned.push('kaito'); s.team = ['player']; if (!s.profs) s.profs = {}; if (!s.profOwned || !s.profOwned.length) s.profOwned = [s.custom.cls]; if (!s.profOwned.includes(s.custom.cls)) s.profOwned.push(s.custom.cls); }
  return s;
}
let cloudDirty = false, cloudBusy = false;
window.__flush = () => { try { save(state); } catch (e) {} };
const save = (s) => { if (testing) return; s.lastSeen = Date.now(); try { localStorage.setItem('acrpg', JSON.stringify(s)); } catch (e) {} cloudDirty = true; };
const state = load();
ensureMeta(state);
// save na nuvem (por personagem): a cada 12 s se houve mudança, e ao sair da página
async function cloudPush(force) {
  if (!sess || !sess.cid || !state.custom || cloudBusy || !(cloudDirty || force)) return;
  cloudBusy = true; cloudDirty = false;
  try { await api('char/put', { token: sess.token, id: sess.cid, name: state.custom.name, cls: state.custom.cls, level: state.level, kills: state.kills, bosses: (state.meta && state.meta.cnt.boss) || 0, save: JSON.stringify(state) }); }
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
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;   // cores de cinema, sem estourar o branco
$('game').appendChild(renderer.domElement);
{ const v = document.createElement('div'); v.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;background:radial-gradient(ellipse at 50% 46%,rgba(0,0,0,0) 58%,rgba(10,8,30,.38) 100%)'; $('game').appendChild(v); }   // vinheta suave

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe9ff, 35, 140);
const camera = new THREE.PerspectiveCamera(50, 1, 0.25, 420);
const CAM_OFFSET = new THREE.Vector3(0, 8.2, 10);
const _co = new THREE.Vector3(); let zoom = 1, zoomT = 1;
const setZoom = (f) => { zoomT = Math.min(decor.on ? 7 : inCity ? 4.2 : 2.8, Math.max(0.55, f)); };
const CAM_DECOR = new THREE.Vector3(0, 13, 5.2);
// camera imersiva: baixa, atras do heroi, com horizonte (alternativa a visao de cima). Gira com [ ] ou pelos botoes.
const CAM_LOW = new THREE.Vector3(0, 3.9, 10.5), LOW_LOOK = new THREE.Vector3(0, 2.6, -4);
let camGy = 0, camMode = 'top', camYaw = 0, camYawT = 0;
try { camMode = localStorage.getItem('cammode') === 'low' ? 'low' : 'top'; } catch (e) {}
const lowCam = () => camMode === 'low' && !decor.on && !inHome;
const yawNow = () => (lowCam() ? camYaw : 0);
const rotY = (v, a) => { const c = Math.cos(a), s = Math.sin(a), x = v.x * c + v.z * s, z = -v.x * s + v.z * c; v.x = x; v.z = z; return v; };
const camOffset = () => lowCam() ? rotY(_co.copy(CAM_LOW), camYaw) : _co.copy(CAM_OFFSET);

const hemi = new THREE.HemisphereLight(0xffffff, 0x4a7a3a, 0.85); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d6, 1.1);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 60 });
scene.add(sun, sun.target);

const ambient = createAmbient(scene);
const vfx = createVfx(scene);
const flashEl = (() => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;opacity:0'; $('game').appendChild(d); return d; })();
function screenFlash(color, a, ms) { flashEl.style.transition = 'none'; flashEl.style.background = 'radial-gradient(circle at 50% 60%,' + color + ' 0%,rgba(0,0,0,0) 75%)'; flashEl.style.opacity = a; void flashEl.offsetWidth; flashEl.style.transition = 'opacity ' + ms + 'ms ease-out'; flashEl.style.opacity = 0; }
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
const hillH = (x, z) => {   // morros grandes e vales: o campo tem relevo de verdade (comeco e rio ficam calmos)
  const d = Math.hypot(x, z), rz = Math.abs(z - riverZ(x));
  const calm = sstep(16, 60, d) * sstep(7, 24, rz) * (1 - 0.8 * (1 - sstep(LAKE.r, LAKE.r + 20, Math.hypot(x - LAKE.x, z - LAKE.z))));
  const big = Math.sin(x * 0.019 + 1.3) * Math.cos(z * 0.022 - 0.4) + 0.6 * Math.sin((x + z) * 0.013 + 2);
  const mid = Math.sin(x * 0.047 + z * 0.031) * Math.sin(z * 0.052 - x * 0.021);
  const small = Math.sin(x * 0.13 + 1) * Math.sin(z * 0.11);
  return 0.5 + calm * (3.6 * big + 1.5 * mid + 0.35 * small + 2.2);
};
function groundH(x, z) { const d = riverDepth(x, z); return hillH(x, z) * (1 - d) - d * 1.25; }
const BR = (() => { let z = -30, x = 0; for (let i = 0; i < 8; i++) { x = trailX(z); z = riverZ(x); } return { x, z, len: riverHW(x) + 5.5 }; })();
function walkY(x, z) { if (cave) return 0; if (Math.abs(x - BR.x) < 2.6 && Math.abs(z - BR.z) < BR.len) return 0.45; return groundH(x, z); }

const grassMap = grassTexture();
const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ map: grassMap, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);   // chão plano: só na cidade
const terrain = (() => {
  const g = new THREE.PlaneGeometry(520, 520, 260, 260); g.rotateX(-Math.PI / 2);
  const pa = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i); pa.setY(i, groundH(x, z)); uv.setXY(i, (x + 450) / 900, (450 - z) / 900); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, ground.material); m.receiveShadow = true; scene.add(m); return m;
})();
ground.visible = false;   // começa no campo; o chão plano só aparece na cidade

// ---- cenários por setor (cada reino tem o seu bioma) ----
let trailMat = null; const TRAIL = { mares: 0xd9b77a, sombras: 0x5d5070, arcana: 0x6c68a8, planalto: 0xcfa468, primeva: 0x8a6c48, vazio: 0x3c3150 };
const biomes = {}; let biomeNotify = false, curBiome = null, biomeFar = 140, baseTrees = [], baseRock = null, mtnMat = null, capMat = null, cloudMat = null;
function applyAct() {
  const key = ACTS[state.act].realm, r = REALMS[key], bi = BIOME_INFO[key];
  setSky(r.sky); scene.fog.color.set(r.fog);
  ambient.setRealm(key);
  skyGlow.material.color.setHex(SUN[key] || 0xfff1c0);
  if (trailMat) trailMat.color.setHex(TRAIL[key] || 0xd9b77a);
  ground.material.map = groundTex(key); ground.material.color.set(key === 'arcana' ? 0xaeb4d8 : key === 'vazio' ? 0xc8c0d8 : 0xe8e8e8); ground.material.needsUpdate = true;
  hemi.groundColor.set(bi.hemi); scene.fog.near = bi.fog[0]; biomeFar = bi.fog[1];
  if (mtnMat) { mtnMat.color.set(bi.mtn); capMat.color.set(bi.cap); cloudMat.color.set(bi.cloud); }
  baseTrees.forEach(m => { m.visible = key === 'primeva'; }); if (baseRock) baseRock.visible = key !== 'mares';
  Object.keys(biomes).forEach(k => { biomes[k].visible = k === key; });
  if (!biomes[key]) { biomes[key] = makeBiome(key, { groundH, riverDepth, trailX, WORLD }); fieldGroup.add(biomes[key]); }
  biomes[key].visible = true;
  if (curBiome && curBiome !== key && biomeNotify) toast(r.icon + ' Novo setor: ' + bi.title + ' — ' + bi.sub + '\n⚔ Horda: ' + HORDES[key].name + ' (' + HORDES[key].sub + ')');
  curBiome = key;
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
  baseTrees = [trunk, leaf]; baseRock = rock;
})();

// Cenário: montanhas, nuvens, torres, rio, trilha e flores
const farGroup = new THREE.Group(); scene.add(farGroup);
// sol/lua com halo suave no céu (cor por reino); fica longe e acompanha o herói
const skyGlow = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,.9)'); gr.addColorStop(0.22, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: 0xfff1c0, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
  sp.scale.setScalar(70); sp.position.set(-110, 62, -170); sp.renderOrder = -1; farGroup.add(sp); return sp;
})();
const SUN = { mares: 0xfff1c0, sombras: 0xb9a6ff, arcana: 0xd8c6ff, planalto: 0xffc46a, primeva: 0xeaffb0, vazio: 0x9a5cff };
let waterTex = null;
const RUINS = [], chestMeshes = [];
(function scenery() {
  const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 1, flatShading: true }, o));
  mtnMat = mat(0x8fa6bd); capMat = mat(0xffffff);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.random() * 0.2, r = 115 + Math.random() * 25, h = 30 + Math.random() * 28, w = 22 + Math.random() * 16;
    const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 6), mtnMat); m.position.set(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.34, h * 0.3, 6), capMat); cap.position.set(m.position.x, h * 0.85 - 1, m.position.z);
    farGroup.add(m, cap);
  }
  const cm = cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false });
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
  const dirt = (() => {   // trilha: terra com grão e borda macia (some no chão pintado), cor muda por reino
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 6, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); g.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 160; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.12)'; g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return (trailMat = new THREE.MeshStandardMaterial({ map: t, color: 0xd9b77a, roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  })(), dg = new THREE.CircleGeometry(1.7, 14);
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
  { id: 'fox',    perk: { gold: 0.10, txt: '+10% de ouro' }, name: 'Kitsune, Raposa de Gelo',    make: makeFox,    scale: 1,    mountScale: 1.7, seat: 1.6, speed: 1.3, dmg: 0.6, rate: 1.5, color: 0x7fdcff, weight: 50 },
  { id: 'rhino',  perk: { crit: 0.05, txt: '+5% de crítico' }, price: { gold: 3500 }, name: 'Rhino Lilás, Trovão Roxo',   make: makeRhino,  scale: 0.8,  mountScale: 1.4, seat: 2.1, speed: 1.6, dmg: 0.8, rate: 1.8, color: 0xc9a0ff, weight: 30 },
  { id: 'dragon', perk: { regen: 0.012, txt: 'Regenera 1,2% da vida por segundo' }, price: { cash: 500 }, name: 'Glaciar, Dragão de Cristal', make: makeDragon, scale: 0.55, mountScale: 1.1, seat: 2.2, speed: 1.9, dmg: 1.3, rate: 2.2, color: 0x6fe3ff, weight: 20 },
  ...EXTRA_PETS,
];

const bulletGeo = new THREE.SphereGeometry(0.2, 10, 10);

// ===================== Estado de jogo =====================
let T = 0;                                   // tempo de jogo em segundos (pausa junto com o jogo)
let activeIdx = 0, hero = HEROES.find(h => h.id === state.team[0]);
let player = null, facing = 0;
const sk = (id) => state.skills[id] || 0;
const petPerk = (k) => (petDef && petDef.perk && petDef.perk[k]) || 0;
const equippedAt = (key) => state.items.find(i => i.uid === state.equip[key]);
const isEquipped = (it) => EQUIP_KEYS.some(k => state.equip[k] === it.uid);
const statSum = (stat) => EQUIP_KEYS.reduce((a, k) => { const it = equippedAt(k); return a + (it ? (itemStat(it) === stat ? itemValue(it) : 0) + itemGemSum(it, stat) : 0); }, 0);
const mainCls = () => (state.custom && state.custom.cls) || 'warrior';
const slotType = (key) => key;
const slotLabel = (t) => t === 'weapon' ? KINDS[WEAPON_KIND[mainCls()] || 'sword'].label : t === 'offhand' ? KINDS[OFF_KIND[mainCls()] || 'shield'].label : SLOTS[t].name;
const slotIcon = (t) => t === 'weapon' ? KINDS[WEAPON_KIND[mainCls()] || 'sword'].icon : t === 'offhand' ? KINDS[OFF_KIND[mainCls()] || 'shield'].icon : SLOTS[t].icon;
const calcMaxHp = () => 100 + state.upgrades.hp * 20 + sk('vigor') * 25 + Math.round(statSum('hp'));
let maxHp = calcMaxHp(), hp = maxHp, shield = 0, shieldUntil = 0;
const enemies = [], dying = [], bullets = [], effects = [], zones = [], timers = [], eshots = [];
// sala compartilhada de monstros (mesma floresta + mesmo estagio): o anfitriao simula, os demais veem e ajudam
let rmCur = null, rmHost = null, rmN = 1, nidSeq = 0, snapAt = 0;
const isHost = () => !rmCur || !rmHost || rmHost === netId;
let lastShot = 0, invuln = 0, switchReady = 0, bearUntil = 0, overload = 0, shake = 0, walkT = 0, spawnTimer = 0;
const skillReady = {}, ultLen = {};
let ev = null, nextEvT = 150 + Math.random() * 100, dayT = 0.3, night = 0, weather = 'clear', weatherLeft = 200, rainPts = null, isNight = false;
let bossRef = null;
let panelOpen = false, dialogOpen = false, creatorOpen = false;
let cave = null;
let inCity = false, city = null, nearNpc = null, walkGoal = null, invOpen = false, mmT = 0;
let inHome = null, homeRoom = null, homeVisit = null, homeFloor = 0;
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
const zoneLv = () => dg ? dg.lv + (dg.floor - 1) * 2 : state.endless ? 36 + Math.floor(state.stageKills / 25) : FOREST_LV[state.act] + state.stage - 1;
const xpNeed = () => 6 + Math.round(state.level * 2.5);
const quota = () => (8 + state.stage * 3 + state.act * 2) * rmN;

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
  m *= 1 + sk('might') * 0.12 + homeBonus().atk;
  if (Date.now() < (state.rest || 0)) m *= 1.15;
  if (sk('bulwark') && hp < maxHp * 0.5) m *= 1 + sk('bulwark') * 0.1;
  m *= 1 + statSum('atk') + petPerk('atk');
  if (T < bearUntil) m *= 2;
  if (hero.cls === 'sorcerer') m *= 1 + overload / 100 * 0.6 * (1 + sk('overload') * 0.25);
  return Math.max(1, Math.round(hero.atk * m));
}
const petDmg = () => Math.max(1, Math.round(atkPower() * petDef.dmg * (1 + 0.1 * (state.petStars[petDef.id] || 0))));

// ---- equipamento visível: a cor da roupa segue o tier da armadura, o elmo aparece ao equipar e uma aura mostra a raridade ----
const TIER_COL = [0x3fa7c4, 0x8f96a3, 0x9a78ff, 0xb48a5a, 0x4fa85a, 0x3a2f66];
let lookSig = '';
const lookSignature = () => { const c = equippedAt('chest'), h = equippedAt('helm'); return (c ? c.tier : '-') + '|' + (h ? 1 : 0); };
function lookFor(h) {
  if (h.id !== 'player') return h;
  const c = equippedAt('chest'), hm = equippedAt('helm');
  return Object.assign({}, h, { outfit: c ? TIER_COL[Math.min(5, c.tier)] : h.outfit, hat: hm ? true : h.hat });
}
function refreshLook() { if (player && hero.id === 'player' && lookSignature() !== lookSig) setHero(); }
let eqAura = null;
function updateEqAura() {
  let r = 0; EQUIP_KEYS.forEach(k => { const it = equippedAt(k); if (it && it.rar > r) r = it.rar; });
  const cc = shop.auraColor();
  if ((r < 2 && !cc) || inHome) { if (eqAura) eqAura.visible = false; return; }
  if (!eqAura) { eqAura = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 40), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, side: THREE.DoubleSide })); eqAura.rotation.x = -Math.PI / 2; scene.add(eqAura); }
  eqAura.visible = true; eqAura.material.color.set(cc || (r === 3 ? 0xffc83d : 0xc77dff)); eqAura.position.set(player.position.x, (inCity ? 0 : player.position.y - (mounted ? 0 : 0)) + 0.1, player.position.z);
  eqAura.scale.setScalar(1 + Math.sin(T * 3) * 0.08);
}
function setHero() {
  hero = HEROES.find(h => h.id === state.team[activeIdx]) || HEROES[0];
  const pos = player ? player.position.clone() : new THREE.Vector3(0, 0, 0);
  if (player) scene.remove(player);
  player = makeHero(lookFor(hero)); player.position.copy(pos); scene.add(player); lookSig = lookSignature();
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
  updateHomeBtn();
  { const pu = portraitUrl(hero.model); const hn = $('hname'); hn.innerHTML = ''; if (pu) { const im = document.createElement('img'); im.src = pu; im.style.cssText = 'width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid #ffc933;vertical-align:middle;margin-right:6px'; hn.appendChild(im); } hn.appendChild(document.createTextNode(CLASSES[hero.cls].icon + ' Nv.' + state.level + ' ' + hero.name.split(' ')[0] + (state.meta && state.meta.title ? ' «' + state.meta.title + '»' : ''))); }
  { const n = questsClaimable(); setBtn('questbtn', '📜', 'MISSÕES', n); }
  $('hgems').innerHTML = CUR.gems + state.gems; $('hgold').innerHTML = CUR.gold + state.gold; $('hcash').innerHTML = CUR.cash + state.cash;
  const a = curAct();
  $('stage').textContent = dg && dg.cave ? '🐉 CAVERNA — ' + REALMS[dg.realm].icon + ' ' + ACTS[dg.ai].boss.name + (bossRef ? ' — CHEFE' : ' (siga o caminho)') : dg ? '🏰 MASMORRA — andar ' + dg.floor + '/5' + (dg.floor < 5 ? '  (' + dg.kills + '/' + dg.need + ')' : ' — CHEFE') : wb ? '🐉 CHEFE MUNDIAL — derrotem juntos!' : inHome ? '\u{1F3E0} ' + (homeVisit ? 'Visitando a casa de ' + homeVisit.name : inHome.name + ' \u2014 ' + ROOMS[inHome.kind].label) : inCity ? '🏰 Cidade de Aurora — fale com os moradores' : state.endless ? '♾ Aventura Infinita • abates ' + state.stageKills + (rmN > 1 ? '  👥 ' + rmN + ' jogadores (monstros ×' + rmN + ')' : '')
    : 'Ato ' + (state.act + 1) + ' (Nv.' + zoneLv() + ') • ' + a.name + ' — ' + (state.stage === 5 ? 'CHEFE' : 'Estágio ' + state.stage + '/5  (' + Math.min(state.stageKills, quota()) + '/' + quota() + ')') + (rmN > 1 ? '  👥 ' + rmN + ' jogadores (monstros ×' + rmN + ')' : '');
}

function refreshTeam() {
  const box = $('team'); box.innerHTML = '';
  state.team.forEach((id, i) => {
    const h = HEROES.find(x => x.id === id); if (!h) return; const b = document.createElement('div');
    b.className = 'tbtn' + (i === activeIdx ? ' on' : ''); b.style.cursor = 'default'; b.style.pointerEvents = 'none';
    if (i !== activeIdx) { b.style.width = b.style.height = '48px'; b.style.opacity = '0.85'; }
    b.style.borderColor = '#' + h.color.toString(16).padStart(6, '0');
    { const pu = portraitUrl(h.model); b.innerHTML = (pu ? '<img src="' + pu + '" style="width:70%;height:70%;border-radius:50%;object-fit:cover">' : CLASSES[h.cls].icon) + '<small>' + (i === activeIdx ? 'VOCÊ' : h.name.split(' ')[0]) + '</small>'; }
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
  if (inHome || cave) { ov.style.opacity = 0; if (rainPts) rainPts.visible = false; }
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
    const fogFar = weather === 'fog' ? Math.min(62, biomeFar) : biomeFar; scene.fog.far += (fogFar - scene.fog.far) * Math.min(1, dt * 0.6);
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
  if (inCity || inHome || wb || dg) return;
  // eventos
  if (ev && T > ev.until) { ev.left = 0; ev = null; nextEvT = T + 200; toast('⌛ O evento terminou'); }
  if (!ev && !wb && !dg && isHost() && T > nextEvT && !(state.stage === 5 && !state.endless) && enemies.length < 10 && !isPaused()) startEvent();
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
  if (Math.random() < 0.4) craft.giveGem(null, 1);
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
  const label = cd > 0 ? String(Math.ceil(cd)) : CLASSES[hero.cls].icon + '<br>ULT' + (ultTier() ? '<br>' + '★'.repeat(ultTier()) : '');
  if (!force && label === skillLabel) return;
  skillLabel = label; $('skill').innerHTML = label;
}

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.style.opacity = 1;
  clearTimeout(toast.h); toast.h = setTimeout(() => { t.style.opacity = 0; }, 2600);
}

// ===================== Metajogo: missões, login diário, conquistas =====================
function track(key, n) {
  n = n || 1; const m = ensureMeta(state); m.cnt[key] = (m.cnt[key] || 0) + n; shop.passXp(key, n);
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
const rewTxt = (r) => [r.gold && '🪙' + r.gold, r.gems && '💎' + r.gems].filter(Boolean).join('  ');
const giveRew = (r) => { state.gold += r.gold || 0; state.gems += r.gems || 0; };
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

const craft = initCraft({ setPicker: (...a) => openSetPicker(...a), state, toast, openPanel, save, refreshHud, itemLine, isEquipped, giveItem, newItem, SLOT_ORDER, slotLabel, slotIcon, mainCls, track, recalcHp });

const shop = initShop({ state, toast, openPanel, save, refreshHud, giveItem, newItem, SLOT_ORDER, mainCls, craft });

// ---- Mercador andarilho: aparece de vez em quando na floresta por 2,5 minutos ----
let wander = null, nextWander = 200 + Math.random() * 200;
function spawnWander() {
  const a = Math.random() * 6.283, x = THREE.MathUtils.clamp(player.position.x + Math.cos(a) * 12, -WORLD + 6, WORLD - 6), z = THREE.MathUtils.clamp(player.position.z + Math.sin(a) * 12, -WORLD + 6, WORLD - 6);
  const mesh = makeHero(buildPlayerHero(Object.assign({}, PREMADE[3], { name: 'Mercador Andarilho' }))); mesh.position.set(x, walkY(x, z), z); scene.add(mesh);
  const tag = nameTag('🧙 Mercador Andarilho'); tag.position.set(x, walkY(x, z) + 3.4, z); scene.add(tag);
  const tier = Math.min(5, state.act), offers = [1, 1, 2].map(rar => { const it = newItem(SLOT_ORDER[Math.floor(Math.random() * SLOT_ORDER.length)], tier, rar, mainCls()); return { it, price: Math.round(buyPrice(tier, rar) * 0.75), sold: false }; });
  wander = { mesh, tag, life: 150, cool: 0, offers }; toast('🧙 Um Mercador Andarilho apareceu perto de você! Ele fica 2 minutos e meio.');
}
function dropWander() { if (!wander) return; scene.remove(wander.mesh); scene.remove(wander.tag); wander = null; nextWander = T + 240 + Math.random() * 240; }
function openWanderShop() {
  const rows = [{ head: true, text: '🧙 Mercador Andarilho\n“Preços especiais, só hoje!”   🪙' + state.gold }];
  wander.offers.forEach(o => rows.push({ text: itemLine(o.it) + (o.sold ? '\n(vendido)' : ''), btn: o.sold ? '✔' : '🪙' + o.price, enabled: !o.sold && state.gold >= o.price, fn: () => { state.gold -= o.price; o.sold = true; giveItem(o.it); save(state); refreshHud(); openWanderShop(); } }));
  rows.push({ text: '💎 2 gemas aleatórias (nível 1)', btn: '🪙400', enabled: state.gold >= 400, fn: () => { state.gold -= 400; craft.giveGem(null, 1); craft.giveGem(null, 1); save(state); refreshHud(); openWanderShop(); } });
  openPanel('🧙 MERCADOR', rows);
}
function updateWander(dt) {
  if (inCity || inHome || wb || dg) { if (wander) dropWander(); return; }
  if (!wander) { if (T > nextWander && !isPaused() && enemies.length < 6) spawnWander(); return; }
  wander.life -= dt; animateHero(wander.mesh, dt, {});
  const d = dist2(wander.mesh.position, player.position); wander.mesh.rotation.y = Math.atan2(player.position.x - wander.mesh.position.x, player.position.z - wander.mesh.position.z);
  if (wander.life <= 0) { dropWander(); toast('🧙 O mercador foi embora'); }
  else if (d < 3.2 && !isPaused() && T > wander.cool) { wander.cool = T + 8; openWanderShop(); }
}

// ---- Masmorra: 5 andares, chefe no último (3 entradas por dia) ----
let dg = null;
function dgLeft() { const m = ensureMeta(state); if (m.dgDay !== m.day) { m.dgDay = m.day; m.dgUsed = 0; m.cvUsed = 0; } return 3 - (m.dgUsed || 0); }
function openDungeon(back) {
  const left = dgLeft(), lv = FOREST_LV[Math.min(5, state.maxAct)] + 6;
  openPanel('🏰 MASMORRA', [
    { text: '◀ Voltar', btn: 'VOLTAR', fn: back },
    { head: true, text: '🏰 Masmorra Sombria\n5 andares com monstros nível ~' + lv + '+ (mais fortes que a floresta), elites frequentes e um chefe no último andar.\nSe você cair, perde a tentativa.' },
    { text: 'Entradas hoje: ' + left + '/3 (renovam à meia-noite)\nRecompensa: ouro, 💎, equipamento ÉPICO ou melhor, gemas e materiais.', btn: 'ENTRAR', enabled: left > 0, fn: enterDungeon },
    { text: '🐉 Cavernas dos Chefes\nSiga o caminho escuro até a câmara do chefe de cada reino.', btn: 'ABRIR', fn: () => openCaves(() => openDungeon(back)) },
  ]);
}
function enterDungeon() {
  if (dgLeft() <= 0) return; ensureMeta(state).dgUsed = (ensureMeta(state).dgUsed || 0) + 1;
  closePanel(); setCityMode(false); clearEnemies();
  dg = { lv: FOREST_LV[Math.min(5, state.maxAct)] + 6, floor: 1, kills: 0, need: 16 };
  save(state); toast('🏰 Andar 1: derrote ' + dg.need + ' monstros'); refreshHud();
}
// ---- Cavernas dos chefes: corredor fechado ate a camara do chefe de cada reino ----
function cvLeft() { dgLeft(); return 3 - (ensureMeta(state).cvUsed || 0); }
function openCaves(back) {
  const left = cvLeft();
  const rows = [{ text: '◀ Voltar', btn: 'VOLTAR', fn: back }, { head: true, text: '🐉 Cavernas dos Chefes\nSiga o caminho escuro, enfrente os monstros e chegue à câmara do chefe. Ao derrotá-lo você ganha prêmios e volta para a cidade.\nEntradas hoje: ' + left + '/3 (renovam à meia-noite). Se cair, perde a tentativa.' }];
  ACTS.forEach((a, i) => {
    const R = REALMS[a.realm];
    if (i > state.maxAct) rows.push({ text: '🔒 ' + R.icon + ' ' + a.boss.name + '\nChegue ao reino ' + R.name + ' para liberar.', btn: 'BLOQUEADA', enabled: false });
    else rows.push({ text: R.icon + ' ' + a.boss.name + ' — ' + R.name + '\nMonstros nível ~' + (FOREST_LV[i] + 4) + ' • chefe do reino', btn: 'ENTRAR', enabled: left > 0, fn: () => enterCave(i) });
  });
  openPanel('🐉 CAVERNAS DOS CHEFES', rows);
}
function enterCave(ai) {
  if (cvLeft() <= 0) return; const m = ensureMeta(state); m.cvUsed = (m.cvUsed || 0) + 1;
  closePanel(); setCityMode(false); clearEnemies();
  const a = ACTS[ai], c = buildCave(REALMS[a.realm].enemy, BOSSES[a.realm].fx);
  scene.add(c.group); c.ai = ai; c.realm = a.realm; c.bossSpawned = false; cave = c;
  dg = { cave: true, realm: a.realm, ai, lv: FOREST_LV[ai] + 4, floor: 1, kills: 0, need: 0 };
  fieldGroup.visible = false; terrain.visible = false; ground.visible = false; farGroup.visible = false;
  setSky(['#07060c', '#0d0a16', '#15101f']); scene.fog.color.set(0x0c0914); scene.fog.near = 18; scene.fog.far = 90; biomeFar = 90;
  hemi.intensity = 1.5; sun.intensity = 0.7; hemi.groundColor.set(0x2a2438);
  $('minimap').style.display = 'none';
  player.position.set(c.start.x, 0, c.start.z); facing = c.startYaw; setZoom(1.1); zoom = zoomT; syncCam();
  save(state); toast('🐉 ' + a.boss.name + ': siga o caminho até o fim'); refreshHud();
}
function leaveCave() {
  if (!cave) return; scene.remove(cave.group); cave.dispose(); cave = null;
  farGroup.visible = true; $('minimap').style.display = ''; hemi.intensity = 0.85; sun.intensity = 1.1;
}
function caveWave(st) {
  const w = hordeWeights(cave.realm, [1, 2, 3, 4, 4][st.i], cave.ai), keys = Object.keys(w).filter(k => w[k] > 0), tot = keys.reduce((a, k) => a + w[k], 0), j0 = cave.nearest(st.x, st.z).i;
  for (let i = 0; i < 4 + st.i; i++) {
    let r = Math.random() * tot, k = keys[0]; for (const kk of keys) { r -= w[kk]; if (r <= 0) { k = kk; break; } }
    const pp = cave.pts[Math.min(cave.pts.length - 1, j0 + 7 + i * 2)], q = { x: pp.x + (Math.random() - 0.5) * 5, z: pp.z + (Math.random() - 0.5) * 5 };
    cave.clamp(q, 1.2, false); spawnEnemy(false, null, k, q);
  }
}
function caveTick(p) {
  if (!cave) return;
  cave.clamp(p, 0.8, cave.sealed); cave.light.position.set(p.x, 3.2, p.z);
  if (cave.bossSpawned) return;
  cave.stations.forEach(st => { if (!st.done && dist2(st, p) < 36) { st.done = true; caveWave(st); } });
  if (cave.inArena(p.x, p.z, 4)) {
    cave.bossSpawned = true; cave.sealed = true; cave.seal.visible = true; clearEnemies();
    const b = ACTS[cave.ai].boss; spawnEnemy(true, { name: b.name, color: b.color }, null, { x: cave.arena.x, z: cave.arena.z - 5 });
    toast('⚠ A entrada se fechou! Derrote ' + b.name);
  }
}
function dgKill() {
  if (dg.cave) { refreshHud(); return; }
  dg.kills++;
  if (dg.floor < 5 && dg.kills >= dg.need) {
    dg.floor++; dg.kills = 0; dg.need = 12 + dg.floor * 4; clearEnemies(); state.gold += dg.lv * 12;
    if (dg.floor === 5) { toast('⚠ Andar 5: o chefe da masmorra!'); spawnEnemy(true, { name: 'Senhor da Masmorra', color: 0x8a2be2 }); }
    else toast('✅ Andar ' + (dg.floor - 1) + ' concluído! Andar ' + dg.floor + ': derrote ' + dg.need);
  }
  refreshHud();
}
function dgBossDone() {
  const d = dg; dg = null; clearEnemies(); track(d.cave ? 'boss' : 'dungeon'); track('boss');
  const gold = d.lv * (d.cave ? 220 : 160), tier = d.cave ? d.ai : Math.min(5, state.maxAct); state.gold += gold; state.gems += d.cave ? 30 + d.ai * 5 : 25; state.mats[Math.min(5, tier)] = (state.mats[Math.min(5, tier)] || 0) + 8;
  giveItem(newItem(SLOT_ORDER[Math.floor(Math.random() * SLOT_ORDER.length)], Math.min(6, tier + (d.cave && Math.random() < 0.3 ? 1 : 0)), Math.random() < 0.2 ? 3 : 2, mainCls()));
  if (d.cave) giveItem(newItem(SLOT_ORDER[Math.floor(Math.random() * SLOT_ORDER.length)], Math.min(6, tier), Math.random() < 0.3 ? 3 : 2, mainCls()));
  craft.giveGem(null, 2); craft.giveGem(null, Math.random() < 0.2 ? 3 : 1);
  toast((d.cave ? '🏆 Chefe derrotado! +🪙' + gold + ' +💎' + (30 + d.ai * 5) : '🏆 Masmorra concluída! +🪙' + gold + ' +💎25') + ' + equipamento e gemas\nVocê será levado de volta à cidade…'); save(state); refreshHud();
  timers.push({ at: T + 3, fn: () => { if (!inCity) setCityMode(true); } });
}

// ---- Pesca: perto da água, toque em PESCAR e depois em PUXAR quando o peixe morder ----
let fishing = null;
function catchFish() {
  const r = Math.random(), lv = state.level; let msg;
  if (r < 0.58) { const g = 20 + lv * 3; state.gold += g; msg = '🐟 Peixinho: +🪙' + g; }
  else if (r < 0.86) { const g = 60 + lv * 6, tier = Math.min(5, state.act); state.gold += g; state.mats[tier] = (state.mats[tier] || 0) + 1; msg = '🐠 Peixe grande: +🪙' + g + ' +' + MATS[tier].icon + '1'; }
  else if (r < 0.96) { const g = 160 + lv * 12; state.gold += g; msg = '🦈 Peixe raro: +🪙' + g; if (Math.random() < 0.3) craft.giveGem(null, 1); }
  else { const gm = 6 + Math.floor(Math.random() * 6); state.gems += gm; msg = '🦪 PÉROLA! +💎' + gm; }
  toast('🎣 ' + msg); track('fish'); save(state); refreshHud();
}
function updateFishing(dt) {
  const b = $('fish'), p = player.position;
  const near = !inCity && !inHome && !wb && !dg && riverDepth(p.x, p.z) > 0.12 && !isPaused() && !enemies.some(e => dist2(e.mesh.position, p) < 11);
  if (!near && !fishing) { b.style.display = 'none'; return; }
  b.style.display = 'block';
  if (fishing && (!near || Math.hypot(joy.dx, joy.dy) > 0.3)) { fishing = null; toast('🎣 Pesca cancelada'); }
  if (!fishing) { b.textContent = '🎣 PESCAR'; return; }
  fishing.t -= dt;
  if (fishing.st === 'wait') { b.textContent = '🎣 aguardando…'; if (fishing.t <= 0) { fishing.st = 'bite'; fishing.t = 1.3; ringFx({ x: p.x, z: p.z + 1.5 }, 0xd6f2ff, 2, 0.5, WATER_Y + 0.05); toast('❗ Fisgou! Toque em PUXAR!'); } }
  else { b.textContent = '❗ PUXAR!'; if (fishing.t <= 0) { fishing = null; toast('🐟 O peixe escapou…'); } }
}
$('fish').addEventListener('pointerdown', (e) => {
  e.stopPropagation(); if (isPaused()) return;
  if (!fishing) { fishing = { st: 'wait', t: 2 + Math.random() * 4 }; toast('🎣 Lançou a linha…'); }
  else if (fishing.st === 'bite') { fishing = null; catchFish(); }
  else { fishing = null; toast('🎣 Você puxou cedo demais'); }
});

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
$('panel').addEventListener('click', (e) => { if (e.target === $('panel') && !picking) closePanel(); });
// celular x PC: body.phone liga o layout compacto (?ui=phone / ?ui=pc forca um deles)
(function () {
  const forced = new URLSearchParams(location.search).get('ui');
  const mq = matchMedia('(max-width: 600px), (max-height: 520px) and (pointer: coarse)');
  const set = () => {
    const bc = document.body.classList, ph = forced ? forced === 'phone' : mq.matches, land = innerWidth > innerHeight;
    bc.toggle('phone', ph); bc.toggle('land', ph && land); bc.toggle('portrait', ph && !land);
  };
  set(); mq.addEventListener && mq.addEventListener('change', set); addEventListener('resize', set); addEventListener('orientationchange', set);
  // tela cheia (Android: trava em horizontal; iPhone nao permite -> orienta a instalar na tela inicial)
  const isStandalone = () => matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone;
  $('fsbtn').addEventListener('pointerdown', async (e) => {
    e.stopPropagation();
    const de = document.documentElement;
    if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch (_) {} return; }
    if (de.requestFullscreen) {
      try { await de.requestFullscreen({ navigationUI: 'hide' }); } catch (_) {}
      try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (_) {}
    } else if (!isStandalone()) toast('📲 No iPhone: toque em Compartilhar ▸ "Adicionar à Tela de Início" e abra por lá para jogar em tela cheia');
  });
  const fsSync = () => document.body.classList.toggle('fs', !!document.fullscreenElement || !!isStandalone());
  fsSync(); document.addEventListener('fullscreenchange', fsSync);
  let hid = false; try { hid = sessionStorage.getItem('rot_hide') === '1'; } catch (_) {}
  const rh = $('rothint'); if (!hid && !isStandalone()) rh.classList.add('show');
  $('rothide').addEventListener('click', () => { rh.classList.remove('show'); try { sessionStorage.setItem('rot_hide', '1'); } catch (_) {} });
})();
// menu da direita: recolhe os botoes secundarios (lembra a escolha)
(function () {
  const tb = $('topbtns'); let min;
  try { const v = localStorage.getItem('ui_min'); min = v == null ? (innerWidth < 520 || innerHeight < 520) : v === '1'; } catch (_) { min = innerWidth < 520 || innerHeight < 520; }
  const apply = () => { tb.classList.toggle('min', min); $('morebtn').querySelector('small').textContent = min ? 'MAIS' : 'MENOS'; $('morebtn').querySelector('.i').textContent = min ? '☰' : '✕'; };
  apply();
  $('morebtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); min = !min; try { localStorage.setItem('ui_min', min ? '1' : '0'); } catch (_) {} apply(); });
})();
// icones das moedas (desenhados, para nao virar "pedra" em celular antigo)
const CUR = {
  gold: '<svg class="cur" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#f5b800" stroke="#9a6a00" stroke-width="1.5"/><circle cx="10" cy="10" r="5.5" fill="none" stroke="#ffe27a" stroke-width="1.5"/></svg>',
  gems: '<svg class="cur" viewBox="0 0 20 20"><path d="M10 1.5 18 8 10 18.5 2 8Z" fill="#3fb6ff" stroke="#0b5f99" stroke-width="1.3"/><path d="M2 8h16M6 8l4-6.5L14 8l-4 10.5Z" fill="none" stroke="#bfeaff" stroke-width="1"/></svg>',
  cash: '<svg class="cur" viewBox="0 0 20 20"><path d="M10 1 16.5 6v8L10 19 3.5 14V6Z" fill="#a24bff" stroke="#4b1a8f" stroke-width="1.3"/><path d="M10 1v18M3.5 6l6.5 4 6.5-4" fill="none" stroke="#e3c4ff" stroke-width="1"/></svg>',
};
function openWallet() {
  if (dialogOpen || panelOpen) return;
  const n = (v) => v.toLocaleString('pt-BR');
  openPanel('💰 CARTEIRA', [
    { head: true, text: 'Cada moeda tem o seu uso no jogo:' },
    { text: `OURO  •  ${n(state.gold)}
É a moeda do dia a dia. Ganha: derrotando monstros, missões, venda e eventos.
Usa: melhorar e forjar equipamentos, treinos, lojas, gemas, aluguel e móveis.`, color: '#ffd166' },
    { text: `DIAMANTES  •  ${n(state.gems)}
É a moeda premium. Ganha: chefes, conquistas, missões, pérolas da pesca e o Passe.
Usa: criaturas e montarias comuns, trocar de classe, auras e títulos, móveis premium.`, color: '#7fd6ff' },
    { text: `VEON  •  ${n(state.cash)}
É a moeda rara, comprada com dinheiro real (a compra entra no lançamento; nos testes você recebe saldo).
Usa: montarias especiais (Glaciar, Ignis, Aurora), evoluir equipamento na hora, comprar casas, construir andares, ampliar a sala e o Passe Premium.`, color: '#c48bff' },
    { text: 'Toque no ✕ para voltar ao jogo.' },
  ]);
}
function openPanel(title, rows) {
  if (dialogOpen) return;
  panelOpen = true;
  const card = $('card'); card.innerHTML = '';
  const xb = document.createElement('button'); xb.className = 'pclose'; xb.textContent = '✕'; xb.onclick = () => { if (!picking) closePanel(); }; card.appendChild(xb);
  const h = document.createElement('h2'); h.textContent = title; card.appendChild(h);
  rows.forEach(r => {
    const row = document.createElement('div'); row.className = 'prow' + (r.head ? ' head' : '');
    if (r.img) { const im = document.createElement('img'); im.src = IMG + r.img; im.alt = ''; im.style.cssText = 'width:64px;height:64px;border-radius:12px;object-fit:cover;flex:none;margin-right:10px;border:2px solid #f5c542'; im.onerror = () => im.remove(); row.appendChild(im); }
    const t = document.createElement('span'); t.style.flex = '1'; t.textContent = r.text; if (r.color) t.style.color = r.color; row.appendChild(t);
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

// ---- Vocações: o personagem pode dominar todas as classes; cada uma tem nível, habilidades e equipamento próprios ----
const PROF_NEW = () => ({ level: 1, xp: 0, skillPts: 0, skills: {}, equip: {}, upgrades: { atk: 0, hp: 0 } });
const profCost = () => 100 + 80 * (state.profOwned.length - 1);
const profNow = () => ({ level: state.level, xp: state.xp, skillPts: state.skillPts, skills: state.skills, equip: state.equip, upgrades: state.upgrades });
const profData = (c) => c === mainCls() ? profNow() : (state.profs[c] || PROF_NEW());
let profReady = 0;
function changeProf(cls) {
  if (cls === mainCls() || !state.profOwned.includes(cls)) return;
  if (dg || wb) { toast('Saia da masmorra / chefe mundial antes de trocar de vocação'); return; }
  if (T < profReady) { toast('Aguarde um instante para trocar de novo'); return; }
  profReady = T + 3;
  state.profs[mainCls()] = profNow();
  const t = state.profs[cls] || PROF_NEW(); delete state.profs[cls];
  state.level = t.level; state.xp = t.xp; state.skillPts = t.skillPts; state.skills = t.skills; state.equip = t.equip; state.upgrades = t.upgrades;
  state.custom = Object.assign({}, state.custom, { cls, model: /^VRM_/.test((state.custom || {}).model || '') ? state.custom.model : undefined }); upsertPlayer(state.custom);
  skillReady.player = 0; clearEnemies(); setHero(); recalcHp(); hp = maxHp; renderSkillChips(); refreshHud();
  save(state); ringFx(player.position, hero.color, 4, 0.6); toast(CLASSES[cls].icon + ' Agora você é ' + CLASSES[cls].name + ' Nv.' + state.level);
}
function openProfs(msg) {
  const rows = [{ head: true, text: (msg ? msg + '\n' : '') + '🎓 VOCAÇÕES\nVocê pode dominar TODAS as vocações. Cada uma tem o próprio nível, habilidades e equipamento: ao trocar, a outra fica guardada e você volta exatamente de onde parou. Uma vocação nova começa do nível 1.\nPróxima vocação a desbloquear: 💎' + profCost() }];
  Object.keys(CLASSES).forEach(c => {
    const d = CLASSES[c], own = state.profOwned.includes(c), pd = profData(c), cur = c === mainCls();
    const text = d.icon + ' ' + d.name + ' — ' + d.role + '\n' + (own ? 'Nv.' + pd.level + (cur ? '   •   ATUAL' : '   •   ' + Object.keys(pd.skills).length + ' habilidade(s)') : d.desc);
    if (cur) rows.push({ img: 'classes/' + c + '.webp', text, btn: '✔ ATUAL', enabled: false });
    else if (own) rows.push({ img: 'classes/' + c + '.webp', text, btn: 'TROCAR', fn: () => { changeProf(c); openProfs(); } });
    else rows.push({ img: 'classes/' + c + '.webp', text, btn: '💎' + profCost(), enabled: state.gems >= profCost(), fn: () => { state.gems -= profCost(); state.profOwned.push(c); save(state); refreshHud(); openProfs('🔓 ' + d.name + ' desbloqueada! Toque em TROCAR para começar do nível 1.'); } });
  });
  rows.push({ head: true, text: '— Criaturas (mascote + montaria) —' });
  rows.push({ text: '🐾 Loja de Criaturas\n' + PETS.length + ' criaturas para comprar ou invocar. Você tem ' + state.pets.length + '.', btn: 'ABRIR', fn: () => openPets() });
  openPanel('🎓 VOCAÇÕES', rows);
}
const priceTxt = (pr) => pr.cash ? '🔮' + pr.cash : pr.gems ? '💎' + pr.gems : '🪙' + pr.gold;
const canPay = (pr) => pr.cash ? state.cash >= pr.cash : pr.gems ? state.gems >= pr.gems : state.gold >= pr.gold;
function openPets(msg, keep) {
  const st = keep ? $('card').scrollTop : 0;
  const rows = [{ head: true, text: (msg ? msg + '\n' : '') + '🐾 CRIATURAS\nCada criatura é mascote (ataca com você) e montaria. Compre a que quiser ou invoque uma surpresa. Repetida = +10% de dano.' }];
  rows.push({ text: '🎲 Invocar criatura surpresa\nPode vir qualquer uma da loja', btn: '💎40', enabled: state.gems >= 40, fn: summonPet });
  PETS.forEach(p => {
    const owned = state.pets.includes(p.id);
    const text = p.name + '\nDano ' + Math.round(p.dmg * 100) + '%  •  Velocidade montado x' + p.speed + (owned ? '  •  ★' + (state.petStars[p.id] || 0) : '') + '\nBônus: ' + p.perk.txt;
    if (owned) rows.push({ img: 'pets/' + p.id + '.webp', text, btn: state.activePet === p.id ? 'ATIVO' : 'USAR', enabled: state.activePet !== p.id, fn: () => { state.activePet = p.id; save(state); setPet(); openPets(null, true); } });
    else if (p.price) rows.push({ img: 'pets/' + p.id + '.webp', text, btn: priceTxt(p.price), enabled: canPay(p.price), fn: () => { if (p.price.cash) state.cash -= p.price.cash; else if (p.price.gems) state.gems -= p.price.gems; else state.gold -= p.price.gold; state.pets.push(p.id); state.activePet = p.id; save(state); refreshHud(); setPet(); openPets('🎉 ' + p.name.split(',')[0] + ' comprada e ativada!'); } });
    else rows.push({ img: 'pets/' + p.id + '.webp', text, btn: 'BLOQUEADO', enabled: false });
  });
  openPanel('🐾 CRIATURAS', rows);
  if (keep) $('card').scrollTop = st;
}
const openCrew = openProfs;

function openProfile(keep) {
  const st = keep ? $('card').scrollTop : 0;
  const again = () => openProfile(true), cost = (k) => 100 * (state.upgrades[k] + 1);
  const rows = [{ head: true, text: '🪙' + state.gold + '  💎' + state.gems + '  🔮' + state.cash + '  •  Abates: ' + state.kills + '\n' + MATS.map((m, i) => m.icon + (state.mats[i] || 0)).join('  ') }];
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
  rows.push({ img: 'acts/' + a.realm + '.webp', head: true, text: '📖 HISTÓRIA\n' + (state.endless ? 'Tomo restaurado! Aventura Infinita.' : 'Ato ' + (state.act + 1) + '/6 — ' + REALMS[a.realm].icon + ' ' + a.name + '\nEstágio ' + state.stage + '/5') });
  const er = a.realm;
  rows.push({ text: 'Inimigos deste reino: ' + REALMS[er].icon + ' ' + REALMS[er].name + '\nVantagem: heróis de ' + Object.keys(REALMS).filter(k => REALMS[k].strong === er).map(k => REALMS[k].name).join(', ') + ' (+25% dano)' });
  rows.push({ text: '🐾 Monstros por estágio neste reino:\n' + [1, 2, 3, 4, 5].map(i => (i === 5 ? 'Chefe' : 'Estágio ' + i) + ' — ' + hordeTitle(er, i)).join('\n') });
  rows.push({ head: true, text: '⚔️ CLASSES' });
  Object.entries(CLASSES).forEach(([k, c0]) => { const c = Object.assign({ k }, c0); rows.push({ text: c.icon + ' ' + c.name + ' — ' + c.role + '\n' + c.desc + '\nULT: ' + c.ult + '  →  Nv.' + ULT_LV[0] + ': ' + ULT_EVO[c.k][0].name + '  →  Nv.' + ULT_LV[1] + ': ' + ULT_EVO[c.k][1].name }); });
  rows.push({ head: true, text: '👹 MONSTROS E FRAQUEZAS' });
  rows.push({ text: 'Classes FÍSICAS (Guerreiro, Paladino, Assassino, Arqueiro) e MÁGICAS (Mago, Feiticeiro, Druida) causam dano diferente em cada monstro.\n💀 Esqueleto e Corredor: normais\n🛡 Guerreiro: resiste um pouco a físico\n🪨 Bruto: resiste MUITO a físico (-30%), fraco a mágico (+30%)\n🏹 Arqueiro: aguenta um pouco mais de físico\n🔮 Mago: fraco a físico (+30%), resiste a mágico (-30%)\n★ Elite: 4× vida e mais loot. Aparece mais à noite e nas masmorras.' });
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
  let r = Math.random() * PETS.reduce((a, p) => a + p.weight, 0), pick = PETS[0];
  for (const p of PETS) { r -= p.weight; if (r <= 0) { pick = p; break; } }
  if (state.pets.includes(pick.id)) state.petStars[pick.id] = (state.petStars[pick.id] || 0) + 1; else state.pets.push(pick.id);
  save(state); refreshHud(); openPets('🎁 ' + pick.name.split(',')[0] + (state.petStars[pick.id] ? ' (repetida, +10% de dano)' : ' obtida!'));
}

function unlockHero(id) {
  const h = HEROES.find(x => x.id === id); if (!h) return;
  if (!state.owned.includes(id)) state.owned.push(id);
  toast('✨ ' + h.name + ' entrou para a sua história (veja no INDEX)'); save(state);
}

function toggleMount() {
  if (isPaused()) return;
  mounted = !mounted;
  pet.scale.setScalar(mounted ? petDef.mountScale : petDef.scale);
  $('mount').innerHTML = mounted ? '<span class="i">⬇</span><small>DESMONTAR</small>' : '<span class="i">🐾</span><small>MONTAR</small>';
  toast(mounted ? 'Montado em ' + petDef.name.split(',')[0] + '!' : 'Você desmontou');
  if (!mounted) player.position.y = 0;
}

$('b-mount').onclick = () => { if (!dialogOpen && !picking && !invOpen) openPets(); };
$('b-crew').onclick = () => { if (!dialogOpen && !picking) openCrew(); };
$('b-bag').onclick = () => { if (!dialogOpen && !picking && !invOpen) openProfile(); };
$('b-index').onclick = () => { if (!dialogOpen && !picking) openIndex(); };
$('b-home').onclick = () => { if (!picking) { closePanel(); closeInv(); } };
$('mount').addEventListener('pointerdown', (e) => { e.stopPropagation(); toggleMount(); });
$('hr').addEventListener('pointerdown', (e) => { e.stopPropagation(); openWallet(); });
$('skill').addEventListener('pointerdown', (e) => { e.stopPropagation(); useSkill(); });

// ===================== Efeitos =====================
function addEffect(mesh, dur, tick, end) { scene.add(mesh); effects.push({ mesh, t: 0, dur, tick, end }); }
function disposeObj(o) { o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); }

function ringFx(pos, color, grow, dur, y) {
  vfx.shock(pos, color, 1 + grow, dur || 0.5, y);
  if (grow >= 3) vfx.ringSparks(pos, color, (1 + grow) * 0.35, Math.min(26, 8 + grow * 2));
}

function swingFx(pos, a, r, arc, color) { vfx.slash(pos, a, r * 1.15, arc, color, 0.28); }

function explode(pos, radius, dmg, color, exclude) {
  ringFx(pos, color, radius, 0.35); vfx.flash(pos, color, radius * 2.6, 0.3, 1); vfx.burst(pos, { color, n: Math.round(10 + radius * 5), speed: 3 + radius * 1.6, up: 0.8, size: 0.5, life: 0.65 });
  enemies.slice().forEach(x => { if (x !== exclude && dist2(x.mesh.position, pos) < radius + x.radius * 0.5) damageEnemy(x, dmg); });
}

// ===================== Inimigos / combate =====================
function clearEnemies() { clearDangers(); if (ev) { ev = null; nextEvT = T + 90; } eshots.forEach(s => { scene.remove(s.mesh); s.mesh.material.dispose(); }); eshots.length = 0; enemies.forEach(e => scene.remove(e.mesh)); enemies.length = 0; dying.forEach(d => scene.remove(d.mesh)); dying.length = 0; bossRef = null; $('bossbar').style.display = 'none'; }

// ---- monstros compartilhados (sala = floresta + estagio) ----
function roomAnchor() {
  const c = [player.position];
  if (rmCur) remotes.forEach(r => { if (r.rm === rmCur) c.push({ x: r.x, z: r.z }); });
  return c[Math.floor(Math.random() * c.length)];
}
function pickTarget(pos) {
  const p = player.position; let best = { x: p.x, z: p.z, id: null }, bd = dist2(pos, p);
  if (rmCur && rmN > 1) remotes.forEach(r => { if (r.rm !== rmCur) return; const d = Math.hypot(r.x - pos.x, r.z - pos.z); if (d < bd) { bd = d; best = { x: r.x, z: r.z, id: r.id }; } });
  return best;
}
const rl = (k, d, to) => { if (rmCur && net) net.send({ t: 'rl', k, d, to }); };
function hurtRemote(e, id) {
  e.hitR = e.hitR || {}; if (T < (e.hitR[id] || 0)) return;
  e.hitR[id] = T + 0.8; rl('hurt', { d: Math.round(e.dmg) }, id);
}
function spawnProxy(r) {
  const boss = !!(r[6] & 2), elite = !!(r[6] & 1), tk = boss ? 'warrior' : r[1], T0 = ETYPES[tk]; if (!T0) return null;
  const realm = REALMS[curAct().realm], info = curAct().boss;
  const tintBase = boss ? info.color : (T0.tint != null ? T0.tint : realm.enemy);
  const BS = boss ? BOSSES[curAct().realm] : null;
  const tint = new THREE.Color(BS ? BS.tint : tintBase).lerp(new THREE.Color(0xffffff), boss ? (BS ? 0 : 0.2) : (T0.tint != null ? 0.1 : 0.5)).getHex();
  const mesh = (!boss && T0.body && makeCreature(T0.body, T0.tint, T0.size)) || (BS && BS.proc && bossBody(curAct().realm)) || makeSkeleton(BS ? BS.model : T0.model, tint, boss, { size: T0.size, atk: T0.atk, run: T0.run, bsize: BS && BS.size }) || makeEnemy(boss ? info.color : realm.enemy, boss);
  if (BS && !BS.proc) bossLook(mesh, curAct().realm);
  mesh.position.set(r[2], 0, r[3]); scene.add(mesh);
  const e = { nid: r[0], remote: true, mesh, hp: Math.max(1, r[4]), maxHp: r[5], speed: 0, boss, kind: boss ? 'Skeleton_Warrior' : T0.loot, type: boss ? 'boss' : tk, radius: boss ? (BS ? BS.r : 1.4) : T0.r, t: Math.random() * 10, dmg: 0, stun: 0, slow: 0, flash: 0, ranged: null, res: boss ? null : T0.res || null, tx: r[2], tz: r[3], elite };
  if (elite) {
    e.radius *= 1.3; mesh.scale.multiplyScalar(1.35);
    mesh.traverse(o => { if (o.isMesh && o.material) { if (o.material.emissive) o.material.emissive.setHex(0x664400); if (o.material.color) o.material.color.setHex(0xffd36b); } });
  }
  enemies.push(e);
  if (boss) { { const bi = $('bossimg'); bi.src = BASE + 'img/monsters/' + curAct().realm + '.webp'; bi.style.display = 'block'; } bossRef = e; $('bossname').textContent = '👑 ' + (state.endless ? 'Eco do Apagador' : info.name); $('bossfill').style.width = '100%'; $('bossbar').style.display = 'block'; }
  return e;
}
function applySnap(d) {
  const seen = new Set();
  (d.e || []).forEach(r => {
    seen.add(r[0]);
    let e = enemies.find(x => x.remote && x.nid === r[0]);
    if (!e) e = spawnProxy(r); if (!e) return;
    e.tx = r[2]; e.tz = r[3]; e.hp = Math.max(1, r[4]); e.maxHp = r[5];
    if (e === bossRef) $('bossfill').style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
  });
  for (let i = enemies.length - 1; i >= 0; i--) { const e = enemies[i]; if (e.remote && !seen.has(e.nid)) { scene.remove(e.mesh); if (e === bossRef) { bossRef = null; $('bossbar').style.display = 'none'; } enemies.splice(i, 1); } }
  if (d.sk > state.stageKills) { state.stageKills = d.sk; refreshHud(); if (!state.endless && state.stage < 5 && state.stageKills >= quota()) stageClear(); }
}
function applyKill(d) {
  let e = enemies.find(x => x.remote && x.nid === d.n);
  if (e) {
    e.dead = true; const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1);
    if (e.mesh.userData.glb) { playOnce(e.mesh, 'death'); dying.push({ mesh: e.mesh, until: T + 1.1 }); } else scene.remove(e.mesh);
  } else { const T0 = ETYPES[d.k] || ETYPES.minion; e = { kind: d.b ? 'Skeleton_Warrior' : T0.loot, boss: !!d.b, elite: !!d.el, type: d.b ? 'boss' : d.k, mesh: { position: new THREE.Vector3(d.x, 0, d.z) } }; }
  onKill(e);
}
function visShot(d) {
  const m = new THREE.Mesh(bulletGeo, new THREE.MeshBasicMaterial({ color: d[5] }));
  m.position.set(d[0], 1.2, d[1]); m.scale.setScalar(d[6] || 1.2);
  const dir = new THREE.Vector3(d[2], 0, d[3]);
  if (d[7]) { m.scale.set(0.35, 0.35, 2.2); m.rotation.y = Math.atan2(dir.x, dir.z); }
  scene.add(m); eshots.push({ mesh: m, dir, speed: d[4], life: 2.2, dmg: 0, splash: 0, color: d[5], vis: true });
}
function onRelay(m) {
  if (!rmCur) return; const d = m.d || {};
  if (m.k === 'es' && !isHost() && m.from === rmHost) applySnap(d);
  else if (m.k === 'ek' && !isHost() && m.from === rmHost) applyKill(d);
  else if (m.k === 'ehit' && isHost()) { const e = enemies.find(x => !x.remote && x.nid === d.n); if (e) damageEnemy(e, Math.min(1e7, +d.d || 0), false, true); }
  else if (m.k === 'hurt' && m.from === rmHost) hitPlayer({ dmg: Math.min(1e6, +d.d || 0) });
  else if (m.k === 'esh' && !isHost() && m.from === rmHost) visShot(d);
}
const rmTxt = (rm) => { const mm = /^f(\d)s(\d)$/.exec(rm || ''); return rm === 'finf' ? '♾ Aventura Infinita' : mm ? '🌲 Ato ' + (+mm[1] + 1) + ' — ' + (+mm[2] === 5 ? 'CHEFE' : 'Estágio ' + mm[2] + '/5') : 'Na floresta'; };
function joinRoom(rm) {
  const mm = /^f(\d)s(\d)$/.exec(rm);
  if (inHome || dg || wb) { toast('Saia daqui primeiro (casa, masmorra ou chefe mundial)'); return; }
  if (rm === 'finf') { if (!state.storyDone) { toast('🔒 Aventura Infinita ainda não liberada'); return; } state.endless = true; }
  else if (mm) { const a = +mm[1], s = +mm[2]; if (a > state.maxAct) { toast('🔒 Você ainda não chegou nesse ato'); return; } state.endless = false; state.act = a; state.stage = s; applyAct(); }
  else return;
  closePanel(); state.stageKills = 0; clearEnemies(); if (inCity) setCityMode(false); save(state); refreshHud(); toast('➡ Você foi ajudar: ' + rmTxt(rm));
}

// Tipos de inimigo. ranged: atira de longe e mantém distância. Cada um tem vida/dano/velocidade próprios.
const ETYPES = {
  minion: { name: 'Esqueleto', model: 'Skeleton_Minion', loot: 'Skeleton_Minion', hp: 1, dmg: 1, spd: 1, size: 1.6, r: 0.7 },
  warrior: { name: 'Esqueleto Guerreiro', model: 'Skeleton_Warrior', loot: 'Skeleton_Warrior', hp: 1.5, dmg: 1.15, spd: 0.95, size: 1.9, r: 0.8, res: { p: 0.85, m: 1.15 } },
  runner: { name: 'Corredor', model: 'Skeleton_Minion', loot: 'runner', hp: 0.6, dmg: 0.85, spd: 1.75, size: 1.5, r: 0.65, tint: 0xffd0a0, run: 'Running_A' },
  brute: { name: 'Bruto', model: 'Skeleton_Warrior', loot: 'brute', hp: 3.2, dmg: 1.6, spd: 0.7, size: 2.7, r: 1.1, tint: 0xff9a8a, res: { p: 0.7, m: 1.3 } },
  archer: { name: 'Arqueiro', model: 'Skeleton_Rogue', loot: 'Skeleton_Rogue', hp: 0.75, dmg: 0.9, spd: 0.9, size: 1.7, r: 0.7, res: { p: 1.1, m: 0.9 }, ranged: { range: 11, keep: 7, cd: 2.2, speed: 11, color: 0xffe28a, arrow: true }, atk: '2H_Ranged_Shoot' },
  mage: { name: 'Mago', model: 'Skeleton_Mage', loot: 'Skeleton_Mage', hp: 0.8, dmg: 1.25, spd: 0.8, size: 1.7, r: 0.7, res: { p: 1.3, m: 0.7 }, ranged: { range: 13, keep: 9, cd: 3.0, speed: 7.5, color: 0xc17bff, size: 1.9, splash: 1.8 }, atk: 'Spellcast_Shoot' },
  // hordas especiais: cada uma ataca de um jeito proprio (ver behave)
  swarm: { name: 'Enxame', model: 'Skeleton_Minion', loot: 'runner', hp: 0.3, dmg: 0.55, spd: 1.55, size: 1.1, r: 0.5, tint: 0x7fd8ff, run: 'Running_A', beh: 'swarm' },
  stalker: { name: 'Espreitador', model: 'Skeleton_Rogue', loot: 'Skeleton_Rogue', hp: 0.7, dmg: 1.5, spd: 1.2, size: 1.7, r: 0.65, tint: 0x7a46b8, run: 'Running_A', beh: 'stalker' },
  charger: { name: 'Investida', model: 'Skeleton_Warrior', loot: 'brute', hp: 1.7, dmg: 1.8, spd: 0.85, size: 2.3, r: 0.95, tint: 0xff7a3a, beh: 'charger' },
  bomber: { name: 'Explosivo', model: 'Skeleton_Minion', loot: 'runner', hp: 0.5, dmg: 2.2, spd: 1.45, size: 1.5, r: 0.6, tint: 0xff4a3a, run: 'Running_A', beh: 'bomber' },
  summoner: { name: 'Invocador', model: 'Skeleton_Mage', loot: 'Skeleton_Mage', hp: 1.1, dmg: 0.8, spd: 0.7, size: 2.1, r: 0.8, tint: 0xa66bff, beh: 'summoner', atk: 'Spellcast_Shoot' },
  nova: { name: 'Mago da Nova', model: 'Skeleton_Mage', loot: 'Skeleton_Mage', hp: 0.9, dmg: 1.5, spd: 0.75, size: 1.8, r: 0.7, tint: 0x4fc3ff, beh: 'nova', atk: 'Spellcast_Shoot' },
  spitter: { name: 'Cuspidor', model: 'Skeleton_Rogue', loot: 'Skeleton_Rogue', hp: 0.8, dmg: 0.9, spd: 0.8, size: 1.7, r: 0.7, tint: 0x86d94a, beh: 'spitter', atk: 'Spellcast_Shoot' },
};
Object.assign(ETYPES, CREATURE_TYPES);
// cada floresta tem a sua horda (classe de monstros) com ataques diferentes
const HORDES = {
  mares: { name: 'Afogados', sub: 'enxames que cercam e cuspidores de poças', w: (st) => ({ swarm: 40, minion: 24, spitter: st >= 2 ? 18 : 0, archer: st >= 3 ? 8 : 0, brute: st >= 4 ? 5 : 0 }) },
  sombras: { name: 'Clã das Sombras', sub: 'espreitadores que surgem atrás de você', w: (st) => ({ stalker: 34, runner: 16, minion: 14, archer: st >= 2 ? 18 : 0, mage: st >= 4 ? 8 : 0 }) },
  arcana: { name: 'Magos Arcanos', sub: 'novas explosivas e invocadores', w: (st) => ({ nova: 28, mage: 20, summoner: st >= 2 ? 16 : 0, minion: 18, warrior: 8 }) },
  planalto: { name: 'Guerreiros do Planalto', sub: 'investidas em linha reta e brutos', w: (st) => ({ charger: 34, warrior: 22, archer: 14, minion: 10, brute: st >= 2 ? 14 : 0 }) },
  primeva: { name: 'Bestas da Floresta', sub: 'explosivos, enxames e veneno', w: (st) => ({ bomber: 28, swarm: 22, spitter: 20, minion: 12, brute: st >= 3 ? 8 : 0 }) },
  vazio: { name: 'Eco do Vazio', sub: 'tudo ao mesmo tempo', w: () => ({ stalker: 14, nova: 14, charger: 14, bomber: 12, summoner: 10, swarm: 14, spitter: 10, brute: 8 }) },
};

// ---- chefoes: cada reino tem o seu, com visual e ataques proprios ----
const BOSSES = {
  mares:    { proc: true, model: 'Skeleton_Warrior', size: 4.6, r: 1.5, spd: 1.4, tint: 0x9fe8ff, fx: 0x4fc3ff, moves: ['tide', 'cannon', 'sum:swarm', 'cannon'] },
  sombras:  { model: 'Skeleton_Rogue',   size: 3.9, r: 1.2, spd: 1.9, tint: 0x6a4aa0, fx: 0xb085ff, moves: ['blink', 'lines', 'sum:stalker', 'blink'] },
  arcana:   { proc: true, model: 'Skeleton_Mage',    size: 4.4, r: 1.3, spd: 1.1, tint: 0x9d8cff, fx: 0x9d8cff, moves: ['rain', 'rain', 'sum:nova', 'erase'] },
  planalto: { proc: true, model: 'Skeleton_Warrior', size: 5.6, r: 1.9, spd: 1.2, tint: 0xffd45e, fx: 0xffd45e, moves: ['slam', 'charge', 'charge', 'slam'] },
  primeva:  { proc: true, model: 'Skeleton_Minion',  size: 5.2, r: 1.7, spd: 1.0, tint: 0x7dff9b, fx: 0x7dff9b, moves: ['roots', 'poison', 'sum:bomber', 'roots'] },
  vazio:    { proc: true, model: 'Skeleton_Mage',    size: 5.6, r: 1.6, spd: 1.5, tint: 0xffffff, fx: 0xffffff, moves: ['erase', 'rain', 'blink', 'charge', 'slam', 'roots', 'sum:summoner'] },
};
const BNAME = { tide: '🌊 Maré!', cannon: '💣 Canhonaço!', blink: '👤 Sombra!', lines: '🗡 Lâminas!', rain: '☄ Chuva arcana!', erase: '⚪ Apagar!', slam: '💥 Pancada!', charge: '🐂 Investida!', roots: '🌿 Raízes!', poison: '☠ Veneno!' };
function bossLook(mesh, realm) {
  const B = BOSSES[realm]; if (!B) return;
  const bm = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o == null ? 0.9 : o, depthWrite: false });
  const add = (g, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const spin = new THREE.Group(); spin.position.y = B.size * 0.55; mesh.add(spin); mesh.userData.spinG = spin;
  const orbit = (n, R, mk) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, m = mk(i); m.position.set(Math.cos(a) * R, Math.sin(i * 2.1) * 0.5, Math.sin(a) * R); m.rotation.y = -a; spin.add(m); } };
  const S = B.size;
  if (realm === 'sombras') {
    add(mesh, new THREE.ConeGeometry(1.5, S * 0.95, 8, 1, true), bm(0x140828, 0.75), 0, S * 0.45, -0.4).material.side = THREE.DoubleSide;
    orbit(4, 2.4, () => new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.7, 0.08), bm(0xb085ff)));
  }
}
// corpos procedurais dos chefes que nao sao esqueletos (Rei Abissal, Serafim, Flor-Titã, Árvore-Mãe, Apagador)
function bossBody(realm) {
  const g = new THREE.Group(), U = g.userData; U.parts = {};
  const sm = (c, em, ei) => new THREE.MeshStandardMaterial({ color: c, emissive: em == null ? 0x000000 : em, emissiveIntensity: ei == null ? 0.7 : ei, roughness: 0.6, metalness: 0.1 });
  const mk = (geo, mat, x, y, z, par) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); (par || g).add(m); return m; };
  const grp = (x, y, z, par) => { const o = new THREE.Group(); o.position.set(x || 0, y || 0, z || 0); (par || g).add(o); return o; };
  const eye = (par, x, y, z, r, col) => { mk(new THREE.SphereGeometry(r, 12, 10), sm(0xffffff, 0xffffff, 0.5), x, y, z, par); mk(new THREE.SphereGeometry(r * 0.5, 10, 8), sm(col || 0x111111), x, y, z + r * 0.72, par); };
  const spin = grp(0, 2.6, 0); U.spinG = spin;
  const orbit = (n, R, mk2) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, m = mk2(i); m.position.set(Math.cos(a) * R, Math.sin(i * 2.1) * 0.5, Math.sin(a) * R); spin.add(m); } };

  if (realm === 'mares') {   // Rei Abissal: peixe-rei com coroa e tridente
    const body = mk(new THREE.SphereGeometry(1.5, 20, 16), sm(0x2f8fbf, 0x0a3a55, 0.5), 0, 2.4, 0); body.scale.set(1, 1.35, 0.85);
    const belly = mk(new THREE.SphereGeometry(1.2, 16, 12), sm(0xbfeaf2, 0x2a6a7a, 0.4), 0, 2.0, 0.55); belly.scale.set(0.9, 1.1, 0.6);
    [-0.65, 0.65].forEach(x => eye(g, x, 3.3, 1.05, 0.45, 0x111111));
    mk(new THREE.BoxGeometry(1.5, 0.22, 0.3), sm(0x1a0a14), 0, 2.55, 1.28);
    for (let i = 0; i < 7; i++) { const t = mk(new THREE.ConeGeometry(0.07, 0.24, 5), sm(0xffffff), -0.65 + i * 0.22, 2.42, 1.3); t.rotation.x = Math.PI; }
    const crest = mk(new THREE.ConeGeometry(0.6, 1.8, 4), sm(0xff6a3a, 0x7a2200, 0.6), 0, 4.2, -0.1); crest.scale.z = 0.25;
    [-1, 1].forEach(sd => { const f = mk(new THREE.ConeGeometry(0.45, 1.5, 4), sm(0xff6a3a, 0x7a2200, 0.5), sd * 1.75, 2.5, 0); f.rotation.z = -sd * 1.3; f.scale.z = 0.25; U.parts['fin' + sd] = f; });
    const tail = grp(0, 1.0, -1.1); U.parts.tail = tail; const tf = mk(new THREE.ConeGeometry(1.0, 1.9, 4), sm(0xff6a3a, 0x7a2200, 0.5), 0, -0.2, -0.3, tail); tf.rotation.x = -1.2; tf.scale.x = 0.3; tf.scale.z = 0.2;
    const crown = grp(0, 4.15, 0.55); mk(new THREE.CylinderGeometry(0.62, 0.55, 0.35, 10), sm(0xffc233, 0xaa7a00, 0.6), 0, 0, 0, crown);
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; mk(new THREE.ConeGeometry(0.12, 0.45, 5), sm(0xffc233, 0xaa7a00, 0.6), Math.cos(a) * 0.55, 0.35, Math.sin(a) * 0.55, crown); }
    [-0.55, 0.55].forEach(x => { mk(new THREE.CylinderGeometry(0.22, 0.28, 1.1, 8), sm(0x2f8fbf), x, 0.55, 0.1); const ft = mk(new THREE.ConeGeometry(0.5, 0.15, 3), sm(0x1d6f98), x, 0.08, 0.35); ft.scale.x = 1.4; });
    const tri = grp(2.35, 1.9, 0.5); U.parts.tri = tri;
    mk(new THREE.CylinderGeometry(0.07, 0.07, 3.8, 6), sm(0xffc233, 0xaa7a00, 0.5), 0, 0.6, 0, tri);
    [-0.35, 0, 0.35].forEach(x => mk(new THREE.ConeGeometry(0.1, 0.9, 5), sm(0xfff2a0, 0xaaaa33, 0.7), x, 2.9, 0, tri));
    orbit(5, 3.0, () => new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.8 })));
    U.tick = (t) => { tail.rotation.y = Math.sin(t * 3) * 0.5; [-1, 1].forEach(sd => { U.parts['fin' + sd].rotation.z = -sd * (1.3 + Math.sin(t * 5) * 0.25); }); tri.rotation.z = Math.sin(t * 2) * 0.08; };
  } else if (realm === 'arcana') {   // Serafim Vazio: anjo flutuante com asas e halo
    const float = grp(0, 0.9, 0); U.parts.fl = float;
    const robe = mk(new THREE.ConeGeometry(1.35, 3.0, 12, 1, true), sm(0xf4f0ff, 0x9d8cff, 0.35), 0, 1.5, 0, float); robe.material.side = THREE.DoubleSide;
    mk(new THREE.CylinderGeometry(0.55, 0.9, 1.3, 10), sm(0xffffff, 0x9d8cff, 0.35), 0, 2.9, 0, float);
    mk(new THREE.SphereGeometry(0.5, 14, 12), sm(0xffe8d6), 0, 3.85, 0, float);
    mk(new THREE.SphereGeometry(0.55, 12, 8, 0, 6.28, 0, 1.4), sm(0xc9b8ff, 0x7a5cff, 0.6), 0, 3.95, -0.05, float);
    [-0.2, 0.2].forEach(x => mk(new THREE.SphereGeometry(0.07, 8, 6), sm(0x7ad7ff, 0x3fc3ff, 1), x, 3.9, 0.45, float));
    const halo = mk(new THREE.TorusGeometry(0.6, 0.07, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffe9a0 }), 0, 4.65, 0, float); halo.rotation.x = Math.PI / 2 - 0.2;
    U.parts.wings = [];
    [-1, 1].forEach(sd => { const w = grp(sd * 0.5, 3.1, -0.3, float); for (let i = 0; i < 5; i++) { const f = mk(new THREE.BoxGeometry(0.34, 2.6 - i * 0.28, 0.05), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffffff : 0xd9ccff, transparent: true, opacity: 0.92 }), sd * (0.9 + i * 0.5), 0.4 - i * 0.18, 0, w); f.rotation.z = -sd * (0.9 + i * 0.12); } U.parts.wings.push([w, sd]); });
    [-1, 1].forEach(sd => { const a = mk(new THREE.CylinderGeometry(0.16, 0.12, 1.5, 6), sm(0xffffff, 0x9d8cff, 0.3), sd * 1.0, 2.9, 0.35, float); a.rotation.z = sd * 0.35; a.rotation.x = -0.5; });
    const sw = grp(1.35, 2.6, 0.9, float); mk(new THREE.BoxGeometry(0.16, 2.8, 0.06), new THREE.MeshBasicMaterial({ color: 0xcfe6ff }), 0, 0.9, 0, sw); mk(new THREE.BoxGeometry(0.7, 0.14, 0.1), sm(0xffc233, 0xaa7a00, 0.6), 0, -0.4, 0, sw);
    orbit(4, 2.9, () => new THREE.Mesh(new THREE.OctahedronGeometry(0.3), new THREE.MeshBasicMaterial({ color: 0xc9b8ff, transparent: true, opacity: 0.85 })));
    U.tick = (t) => { float.position.y = 0.9 + Math.sin(t * 2) * 0.25; U.parts.wings.forEach(([w, sd]) => { w.rotation.z = sd * (0.05 + Math.sin(t * 4) * 0.22); }); };
  } else if (realm === 'planalto') {   // Flor-Titã: planta carnívora gigante
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28, l = mk(new THREE.SphereGeometry(1, 10, 8), sm(0x2e9a3a, 0x0c3a10, 0.4), Math.cos(a) * 1.6, 0.5, Math.sin(a) * 1.6); l.scale.set(0.9, 0.18, 1.7); l.rotation.y = -a; l.rotation.z = 0.25; }
    const stem = grp(0, 0, 0); U.parts.stem = stem;
    mk(new THREE.CylinderGeometry(0.55, 0.9, 2.3, 10), sm(0x2f8f3a, 0x0c3a10, 0.4), 0, 1.15, 0, stem);
    const st2 = grp(0, 2.2, 0, stem); U.parts.st2 = st2; mk(new THREE.CylinderGeometry(0.45, 0.55, 2.0, 10), sm(0x37a843, 0x0c3a10, 0.4), 0, 1.0, 0, st2);
    const head = grp(0, 2.2, 0.2, st2); U.parts.head = head;
    const lower = mk(new THREE.SphereGeometry(1.5, 18, 10, 0, 6.28, Math.PI / 2, Math.PI / 2), sm(0xd8234a, 0x66101f, 0.6), 0, 0, 0, head); lower.material.side = THREE.DoubleSide;
    const up = grp(0, 0, -1.4, head); U.parts.up = up;
    const dome = mk(new THREE.SphereGeometry(1.5, 18, 10, 0, 6.28, 0, Math.PI / 2), sm(0x37a843, 0x0c3a10, 0.4), 0, 0, 1.4, up); dome.material.side = THREE.DoubleSide;
    mk(new THREE.SphereGeometry(1.35, 14, 8, 0, 6.28, 0, Math.PI / 2), sm(0xff4a6a, 0x881126, 0.7), 0, -0.05, 1.4, up).material.side = THREE.DoubleSide;
    for (let i = 0; i < 12; i++) { const a = Math.PI + i / 11 * Math.PI; [lower, dome].forEach((h, j) => { const t = mk(new THREE.ConeGeometry(0.11, 0.5, 5), sm(0xffffff), Math.cos(a) * 1.4, 0, Math.sin(a) * -1.4 + (j ? 1.4 : 0), j ? up : head); t.rotation.x = j ? 0 : Math.PI; }); }
    [-1, 1].forEach(sd => { const v = mk(new THREE.CylinderGeometry(0.1, 0.16, 3.2, 6), sm(0x2f8f3a), sd * 1.3, 1.6, 0.3); v.rotation.z = sd * 0.5; const fl = grp(sd * 2.1, 3.2, 0.3); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28, p = mk(new THREE.SphereGeometry(0.3, 8, 6), sm(0xffd23a, 0xaa7a00, 0.7), Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0, fl); p.scale.set(1, 1.5, 0.4); } mk(new THREE.SphereGeometry(0.22, 8, 6), sm(0xff8a1a, 0x883300, 0.7), 0, 0, 0.12, fl); });
    orbit(6, 3.0, () => new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.85 })));
    U.tick = (t) => { stem.rotation.z = Math.sin(t * 1.3) * 0.08; st2.rotation.x = 0.15 + Math.sin(t * 1.7) * 0.1; U.parts.up.rotation.x = -(0.25 + (Math.sin(t * 2.4) * 0.5 + 0.5) * 0.7); };
  } else if (realm === 'primeva') {   // Árvore-Mãe: arvore ancia com rosto e bracos de galho
    mk(new THREE.CylinderGeometry(1.1, 1.8, 4.2, 12), sm(0x6b4a26, 0x1a0f05, 0.3), 0, 2.4, 0);
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28, r = mk(new THREE.ConeGeometry(0.5, 2.2, 6), sm(0x5a3b1a), Math.cos(a) * 1.7, 0.5, Math.sin(a) * 1.7); r.rotation.z = Math.cos(a) * 1.0; r.rotation.x = -Math.sin(a) * 1.0; }
    [-0.5, 0.5].forEach(x => { mk(new THREE.SphereGeometry(0.24, 10, 8), sm(0x7dff9b, 0x3dff6b, 1.2), x, 3.5, 0.95); });
    mk(new THREE.BoxGeometry(0.9, 0.35, 0.3), sm(0x1a0f05), 0, 2.7, 1.05);
    mk(new THREE.SphereGeometry(0.2, 8, 6), sm(0x7dff9b, 0x3dff6b, 1), 0, 2.7, 1.2);
    const can = grp(0, 5.0, 0); [[0, 0, 0, 2.3], [-1.6, -0.3, 0.4, 1.7], [1.6, -0.2, -0.3, 1.8], [0.3, 0.8, -1.2, 1.6], [-0.2, 0.2, 1.4, 1.5]].forEach(c => mk(new THREE.SphereGeometry(c[3], 12, 10), sm(0x2f9a3a, 0x0c3a10, 0.4), c[0], c[1], c[2], can));
    U.parts.arms = [];
    [-1, 1].forEach(sd => { const arm = grp(sd * 1.1, 3.8, 0); const b = mk(new THREE.CylinderGeometry(0.2, 0.4, 3.2, 7), sm(0x6b4a26), sd * 1.5, -0.2, 0.3, arm); b.rotation.z = sd * 1.0; for (let i = 0; i < 3; i++) { const tw = mk(new THREE.ConeGeometry(0.1, 1.0, 5), sm(0x5a3b1a), sd * 3.1, -0.9 + i * 0.1, 0.3 + (i - 1) * 0.35, arm); tw.rotation.z = sd * 1.5; } U.parts.arms.push([arm, sd]); });
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28 + 0.4; mk(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 4), sm(0x2f8f3a), Math.cos(a) * 2.0, 4.5, Math.sin(a) * 2.0, can); }
    orbit(7, 3.2, () => new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0x9dff9b, transparent: true, opacity: 0.85 })));
    U.tick = (t) => { U.parts.arms.forEach(([a, sd]) => { a.rotation.z = sd * Math.sin(t * 1.6) * 0.18; }); can.rotation.z = Math.sin(t * 0.9) * 0.03; };
  } else if (realm === 'vazio') {   // O Apagador: entidade flutuante meio branca meio negra com um grande olho
    const core = grp(0, 3.3, 0); U.parts.core = core;
    mk(new THREE.SphereGeometry(1.7, 24, 18, 0, Math.PI), sm(0xf5f5f5, 0xffffff, 0.8), 0, 0, 0, core);
    mk(new THREE.SphereGeometry(1.7, 24, 18, Math.PI, Math.PI), sm(0x05050a, 0x2a1040, 0.5), 0, 0, 0, core);
    const ey = grp(0, 0.1, 1.55, core); mk(new THREE.SphereGeometry(0.75, 16, 12), sm(0xffffff, 0xffffff, 0.9), 0, 0, 0, ey); mk(new THREE.SphereGeometry(0.4, 12, 10), sm(0x000000), 0, 0, 0.55, ey); U.parts.eye = ey;
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, t = mk(new THREE.ConeGeometry(0.26, 3.2, 6), sm(i % 2 ? 0xffffff : 0x0a0a12, i % 2 ? 0xdddddd : 0x2a1040, 0.6), Math.cos(a) * 0.9, 1.3, Math.sin(a) * 0.9); t.rotation.x = Math.PI; t.rotation.z = Math.cos(a) * 0.35; t.rotation.x = Math.PI - Math.sin(a) * 0.35; (U.parts.tent = U.parts.tent || []).push([t, a]); }
    [0, 1, 2].forEach(i => { const t = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.05, 6, 44), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })); t.rotation.set(i * 1.05, i * 0.7, 0); spin.add(t); });
    orbit(5, 3.4, () => new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.9 })));
    U.tick = (t) => { core.position.y = 3.3 + Math.sin(t * 1.6) * 0.3; core.rotation.y = Math.sin(t * 0.7) * 0.4; U.parts.tent.forEach(([m, a]) => { m.rotation.z = Math.cos(a) * 0.35 + Math.sin(t * 2 + a) * 0.18; }); };
  } else return null;
  shadowAll(g); return g;
}
const BMOVES = {
  tide(e, p, ep) { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; addDanger(ep.x + Math.cos(a) * 7, ep.z + Math.sin(a) * 7, 2.6, 1.3, e.dmg * 0.8, 0x4fc3ff); } },
  cannon(e, p) { for (let i = 0; i < 3; i++) addDanger(p.x + (Math.random() - 0.5) * 6, p.z + (Math.random() - 0.5) * 6, 2.8, 0.8 + i * 0.45, e.dmg * 0.8, 0x9fe8ff); },
  slam(e, p, ep) { addDanger(ep.x, ep.z, 7, 1.2, e.dmg * 1.2, 0xffd45e); },
  charge(e, p, ep, c) {
    e.bst = 'wind'; e.bAt = T + 1.0; e.dx = c.vx / c.d; e.dz = c.vz / c.d; glowEnemy(e, 0xff2200);
    const t = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 16), new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    t.rotation.x = -Math.PI / 2; t.rotation.z = Math.atan2(e.dx, e.dz) + Math.PI; t.position.set(ep.x + e.dx * 8, walkY(ep.x, ep.z) + 0.15, ep.z + e.dz * 8); scene.add(t); e.tele = t;
  },
  blink(e, p, ep) { ringFx(ep, 0xb085ff, 3, 0.4); ep.x = p.x - Math.sin(facing) * 3; ep.z = p.z - Math.cos(facing) * 3; ringFx(ep, 0xb085ff, 3, 0.4); addDanger(ep.x, ep.z, 3.6, 0.55, e.dmg, 0xb085ff); },
  lines(e, p, ep, c) { for (let i = 1; i <= 5; i++) addDanger(ep.x + c.vx / c.d * i * 3.2, ep.z + c.vz / c.d * i * 3.2, 1.9, 0.5 + i * 0.22, e.dmg * 0.9, 0xb085ff); },
  rain(e, p) { for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28, r = Math.random() * 6; addDanger(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, 2.5, 0.9 + i * 0.25, e.dmg * 0.8, 0x9d8cff); } },
  erase(e, p) { addDanger(p.x, p.z, 5, 1.0, e.dmg * 1.3, 0xffffff); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; addDanger(p.x + Math.cos(a) * 8, p.z + Math.sin(a) * 8, 2.4, 1.4, e.dmg * 0.8, 0xdddddd); } },
  roots(e, p, ep, c) { for (let i = 1; i <= 5; i++) addDanger(ep.x + c.vx / c.d * i * 3.0, ep.z + c.vz / c.d * i * 3.0, 1.7, 0.4 + i * 0.25, e.dmg * 0.5, 0x7dff9b, 3.5); },
  poison(e, p) { addDanger(p.x, p.z, 3.6, 0.7, e.dmg * 0.4, 0x7bdc3a, 5); },
};
function bossBrain(e, o, vx, vz, d) {
  const B = BOSSES[e.bk]; if (!B) return;
  const ep = e.mesh.position, p = player.position, mad = e.hp < e.maxHp * 0.5;
  if (mad && !e.mad) { e.mad = true; e.speed *= 1.25; e.dmg *= 1.2; ringFx(ep, B.fx, 6, 0.6); shake = 0.5; screenFlash(B.fx, 0.35, 400); ftAt(ep, '🔥 ENFURECIDO!', '#ff4757', 3); }
  if (e.bst === 'wind') { o.mv = 0; o.melee = false; if (T >= e.bAt) { e.bst = 'dash'; e.bAt = T + 0.7; if (e.tele) { scene.remove(e.tele); e.tele = null; } } return; }
  if (e.bst === 'dash') { o.dir = { x: e.dx, z: e.dz }; o.spd = 5.5; o.melee = false; if (d < e.radius + 1) hitPlayer(e); if (T >= e.bAt) { e.bst = null; glowEnemy(e, 0); } return; }
  if (T >= e.cdAt && d < 32) {
    e.cdAt = T + (mad ? 2.2 : 3.4) + Math.random();
    const mv = B.moves[Math.floor(Math.random() * B.moves.length)];
    if (mv.startsWith('sum:')) { if (enemies.length < 30) { ringFx(ep, B.fx, 4, 0.6); for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28; spawnEnemy(false, null, mv.slice(4), { x: ep.x + Math.cos(a) * 3.5, z: ep.z + Math.sin(a) * 3.5 }); } ftAt(ep, '👥 Reforços!', '#ffd166', 3); } }
    else { BMOVES[mv](e, p, ep, { vx, vz, d }); ftAt(ep, BNAME[mv] || '', '#ff9f1c', 3); }
    if (e.mesh.userData.glb) playOnce(e.mesh, 'atk', 0.6);
  }
}
// quanto mais avançado o ato / estágio, mais variedade e mais atiradores
function pickEType() {
  const act = state.act, st = state.endless ? 5 : state.stage, H = HORDES[ACTS[act].realm];
  const w = H ? hordeWeights(ACTS[act].realm, st, act) : { minion: 60 };
  if (night > 0.55 && (st === 1 || state.endless)) { w.runner = (w.runner || 0) + 6; w.stalker = (w.stalker || 0) + 8; }
  let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
  for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return 'minion';
}

const bossRealm = () => (cave ? cave.realm : curAct().realm);
function spawnEnemy(boss, info, forceType, at) {
  const a = Math.random() * Math.PI * 2, d = boss ? 16 : 20, anc = roomAnchor();
  const x = THREE.MathUtils.clamp(at ? at.x : anc.x + Math.cos(a) * d, -WORLD, WORLD), z = THREE.MathUtils.clamp(at ? at.z : anc.z + Math.sin(a) * d, -WORLD, WORLD);
  const realm = REALMS[curAct().realm];
  const tk = boss ? 'warrior' : (forceType || pickEType()), T0 = ETYPES[tk];
  const BS = boss ? BOSSES[bossRealm()] : null;
  const tintBase = boss ? (BS ? BS.tint : info.color) : (T0.tint != null ? T0.tint : realm.enemy);
  const tint = new THREE.Color(tintBase).lerp(new THREE.Color(0xffffff), boss ? (BS ? 0 : 0.2) : (T0.tint != null ? 0.1 : 0.5)).getHex();
  const kind = BS ? BS.model : T0.model;
  const mesh = (!boss && T0.body && makeCreature(T0.body, T0.tint, T0.size)) || (BS && BS.proc && bossBody(bossRealm())) || makeSkeleton(kind, tint, boss, { size: T0.size, atk: T0.atk, run: T0.run, bsize: BS && BS.size }) || makeEnemy(boss ? info.color : realm.enemy, boss);
  if (BS && !BS.proc) bossLook(mesh, bossRealm());
  mesh.position.set(x, 0, z); scene.add(mesh);
  const lv = zoneLv();
  // o mundo acompanha o jogador: passar do nível da zona deixa os bichos mais fortes
  const over = Math.max(0, state.level - lv), catchup = 1 + over * 0.1, catchD = 1 + over * 0.05;
  const base = (18 + lv * 7) * (1 + state.act * 0.3) * 2.4 * catchup;
  const hpv = boss ? base * 14 * (state.endless ? 1.5 : 1) * 1.3 * rmN : base * T0.hp;
  const dmgBase = ((6 + lv * 0.8) * (1 + state.act * 0.12)) * 1.6 * catchD;
  const e = { nid: ++nidSeq, mesh, hp: hpv, maxHp: hpv, speed: boss ? 1.5 * (BS ? BS.spd / 1.2 : 1) : (1.9 + Math.random() * 1.0) * T0.spd, boss: !!boss, bk: boss ? bossRealm() : null, kind: boss ? 'Skeleton_Warrior' : T0.loot, type: boss ? 'boss' : tk, radius: boss ? (BS ? BS.r : 1.4) : T0.r, t: Math.random() * 10, dmg: dmgBase * (boss ? 1.6 : T0.dmg), stun: 0, slow: 0, flash: 0, ranged: boss ? null : T0.ranged || null, res: boss ? null : T0.res || null, shotAt: T + 1 + Math.random() * 2, beh: boss ? (BS ? 'boss' : null) : T0.beh || null, cdAt: T + 1 + Math.random() * 3 };
  if (dg) { e.hp = e.maxHp = e.hp * 1.35; e.dmg *= 1.3; }
  if (!boss && !forceType && Math.random() < 0.04 + state.act * 0.01 + (night > 0.55 ? 0.03 : 0) + (dg ? 0.12 : 0)) {
    e.elite = true; e.hp = e.maxHp = e.hp * 4; e.dmg *= 1.4; e.radius *= 1.3; mesh.scale.multiplyScalar(1.35);
    mesh.traverse(o => { if (o.isMesh && o.material) { if (o.material.emissive) o.material.emissive.setHex(0x664400); if (o.material.color) o.material.color.setHex(0xffd36b); } });
    ftAt(mesh.position, '★ ELITE', '#ffd166', 3);
  }
  enemies.push(e);
  if (tk === 'swarm' && !at && !forceType) for (let i = 0; i < 4; i++) spawnEnemy(false, null, 'swarm', { x: x + (Math.random() - 0.5) * 5, z: z + (Math.random() - 0.5) * 5 });
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
  if (rmCur && rmN > 1 && isHost()) rl('esh', [+from.x.toFixed(1), +from.z.toFixed(1), +dir.x.toFixed(2), +dir.z.toFixed(2), r.speed, r.color, r.size || 1.2, r.arrow ? 1 : 0]);
}

function spawnBoss() {
  if (!isHost()) return; const b = curAct().boss; spawnEnemy(true, { name: state.endless ? 'Eco do Apagador' : b.name, color: b.color }); }

function autoSpawn() {
  if (inCity || wb) return;
  if (!isHost()) return;
  for (let i = 0; i < rmN; i++) autoSpawn1();
}
function autoSpawn1() {
  if (dg) { if (dg.cave) return; if (dg.floor === 5) { if (enemies.length < 7) spawnEnemy(false); } else if (enemies.length < Math.min(14, dg.need - dg.kills + 2)) spawnEnemy(false); return; }
  const bossStage = state.stage === 5 && !state.endless;
  if (bossStage) { if (enemies.length < 8 * rmN) spawnEnemy(false); return; }
  const cap = Math.min(60, state.endless ? 25 * rmN : Math.min(25 * rmN, quota() - state.stageKills + 2));
  if (enemies.length < cap) spawnEnemy(false);
}

function damageEnemy(e, dmg, crit, fromNet) {
  if (e.dead) return;
  if (e.res && !fromNet) { const k = ['mage', 'sorcerer', 'druid'].includes(hero.cls) ? e.res.m : e.res.p; if (k !== 1) { dmg = Math.max(1, Math.round(dmg * k)); if (Math.random() < 0.25) ftAt(e.mesh.position, k > 1 ? 'FRACO!' : 'RESISTE', k > 1 ? '#7CFC00' : '#9aa5b1', 2.3); } }
  const cc = Math.min(0.8, sk('crit') * 0.08 + statSum('crit') + petPerk('crit'));
  if (!fromNet && !crit && cc > 0 && Math.random() < cc) { dmg = Math.round(dmg * (1.8 + sk('deadly') * 0.2)); crit = true; }
  vfx.burst(e.mesh.position, { color: crit ? 0xffb020 : 0xfff4d0, n: crit ? 16 : 7, speed: crit ? 5.5 : 3.6, up: 0.6, size: crit ? 0.45 : 0.3, life: 0.35, y: 1.0 }); if (crit) vfx.flash(e.mesh.position, 0xffc040, 3, 0.2, 1.2);
  e.hp -= dmg; ftAt(e.mesh.position, (crit ? '💥' : '') + dmg, crit ? '#ff9f1c' : '#ffd166', 1.6 * (e.boss ? 2 : 1));
  e.flash = 0.08;
  if (e.remote) { rl('ehit', { n: e.nid, d: dmg }, rmHost); if (e.hp <= 0) e.hp = 1; if (e === bossRef) $('bossfill').style.width = Math.max(0, e.hp / e.maxHp * 100) + '%'; return; }
  if (e.wb && wb) wb.pending += dmg;
  if (e === bossRef && !e.wb) $('bossfill').style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
  if (e.hp > 0) return;
  e.dead = true;
  if (e.mesh.userData.glb) { playOnce(e.mesh, 'death'); dying.push({ mesh: e.mesh, until: T + 1.1 }); } else scene.remove(e.mesh);
  const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1);
  if (rmCur && rmN > 1 && isHost()) rl('ek', { n: e.nid, k: e.type, b: e.boss ? 1 : 0, el: e.elite ? 1 : 0, x: +e.mesh.position.x.toFixed(1), z: +e.mesh.position.z.toFixed(1) });
  onKill(e);
}

function onKill(e) {
  dropLoot(e); track('kill');
  if (e.elite) { if (Math.random() < 0.3) craft.giveGem(null, Math.random() < 0.1 ? 2 : 1); }
  if (e.elite) { track('elite'); dropLoot(e); dropLoot(e); state.gold += 40 + state.level * 8; state.gems += Math.random() < 0.4 ? 2 : 1; ftAt(e.mesh.position, '★ +elite', '#ffd166', 2.4); }
  if (e.ev && ev === e.ev) { ev.left--; if (ev.left <= 0) finishEvent(); else toast('⚔ ' + ev.name + ': faltam ' + ev.left); }
  state.kills++; state.gold += Math.round((5 + state.level + state.act * 2) * (1 + sk('greed') * 0.2 + petPerk('gold') + homeBonus().gold));
  if (Math.random() < 0.05 + sk('greed') * 0.01) state.gems++;
  if (sk('vamp')) heal(maxHp * 0.01 * sk('vamp'));
  state.xp++;
  if (state.xp >= xpNeed()) { state.xp = 0; state.level++; state.skillPts++; ftAt(player.position, 'LEVEL UP!', '#7CFC00', 2.8); if (ULT_LV.includes(state.level)) timers.push({ at: T + 1.2, fn: () => { toast('🌟 Sua ULT evoluiu: ' + ultName() + '!'); updateSkillLabel(true, 0); } }); }
  if (e.boss && dg) dgBossDone();
  else if (e.boss) {
    if (state.endless) { track('boss'); bossRef = null; $('bossbar').style.display = 'none'; state.gems += 5; state.gold += 200 * state.level; toast('🏆 Chefe derrotado! +5💎'); }
    else bossDefeated();
  } else if (dg) {
    dgKill();
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
  state.equip[key || keyFor(it)] = it.uid; recalcHp(); save(state); refreshLook();
}
function unequipItem(it) { EQUIP_KEYS.forEach(k => { if (state.equip[k] === it.uid) delete state.equip[k]; }); recalcHp(); save(state); refreshLook(); }
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
  else toast('✅ Estágio ' + (state.stage - 1) + ' concluído!\n⚔ Estágio ' + state.stage + ': ' + hordeTitle(curAct().realm, state.stage));
  save(state); refreshHud();
}

function bossDefeated() {
  track('boss'); const act = curAct(); clearEnemies();
  const replay = state.act < state.maxAct || state.storyDone;
  state.gold += 300 * (state.act + 1); state.gems += replay ? 4 : 10;
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

// ---- ataques especiais das hordas ----
const dangers = [];
function addDanger(x, z, r, delay, dmg, color, linger) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, walkY(x, z) + 0.15, z); scene.add(m);
  dangers.push({ x, z, r, at: T + delay, dmg, color, linger: linger || 0, mesh: m, fired: false, next: 0, until: 0 });
}
function dropDanger(i) { const d = dangers[i]; if (!d) return; scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); dangers.splice(i, 1); }
function updateDangers() {
  if (!player) return;
  const p = player.position;
  for (let i = dangers.length - 1; i >= 0; i--) {
    const d = dangers[i]; if (!d) continue;   // (clearEnemies pode esvaziar a lista se o golpe matar o jogador)
    const inside = Math.hypot(p.x - d.x, p.z - d.z) < d.r;
    if (!d.fired) {
      d.mesh.material.opacity = 0.25 + 0.2 * Math.abs(Math.sin(T * 12));
      if (T >= d.at) {
        d.fired = true; ringFx({ x: d.x, z: d.z }, d.color, d.r * 0.5, 0.45);
        if (d.linger) { d.until = T + d.linger; d.mesh.material.opacity = 0.35; }
        else { if (inside) hitPlayer({ dmg: d.dmg }); dropDanger(i); }
      }
    } else if (T >= d.until) dropDanger(i);
    else if (inside && T >= d.next) { d.next = T + 0.6; hitPlayer({ dmg: d.dmg }); }
  }
}
function glowEnemy(e, hex) { e.mesh.traverse(o => { if (o.isMesh && o.material && o.material.emissive) o.material.emissive.setHex(hex); }); }
function clearDangers() { while (dangers.length) dropDanger(dangers.length - 1); enemies.forEach(e => { if (e.tele) { scene.remove(e.tele); e.tele = null; } }); }
// devolve { mv, spd, melee, dir }: como o monstro se move e se pode bater de perto neste instante
function behave(e, tg, vx, vz, d) {
  const o = { mv: 1, spd: 1, melee: true, dir: null }, ep = e.mesh.position, b = e.beh, p = player.position;
  const keep = (lo, hi) => { o.melee = false; o.mv = d > hi ? 1 : d < lo ? -0.8 : 0; };
  if (b === 'swarm') {   // enxame: cerca o jogador em vez de ir direto
    const a = d > 4 ? Math.sin(T * 1.2 + e.nid * 1.7) * 0.9 : 0, c = Math.cos(a), s = Math.sin(a);
    o.dir = { x: (vx * c - vz * s) / d, z: (vx * s + vz * c) / d };
  } else if (b === 'charger') {   // avisa, investe em linha reta e descansa
    e.st = e.st || 'chase';
    if (e.st === 'chase') {
      if (d < 11 && d > 3 && T >= e.cdAt) {
        e.st = 'wind'; e.stAt = T + 0.95; e.dx = vx / d; e.dz = vz / d; glowEnemy(e, 0xff2200);
        const t = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 12), new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
        t.rotation.x = -Math.PI / 2; t.rotation.z = Math.atan2(e.dx, e.dz) + Math.PI; t.position.set(ep.x + e.dx * 6, walkY(ep.x, ep.z) + 0.15, ep.z + e.dz * 6); scene.add(t); e.tele = t;
      }
    } else if (e.st === 'wind') { o.mv = 0; o.melee = false; if (T >= e.stAt) { e.st = 'dash'; e.stAt = T + 0.6; if (e.tele) { scene.remove(e.tele); e.tele = null; } } }
    else if (e.st === 'dash') { o.dir = { x: e.dx, z: e.dz }; o.spd = 5.2; o.melee = false; if (d < e.radius + 0.9) hitPlayer(e); if (T >= e.stAt) { e.st = 'rest'; e.stAt = T + 1.1; glowEnemy(e, e.elite ? 0x664400 : 0); } }
    else { o.mv = 0; o.melee = false; if (T >= e.stAt) { e.st = 'chase'; e.cdAt = T + 2.5 + Math.random() * 1.5; } }
  } else if (b === 'stalker') {   // some e reaparece atras do jogador
    o.spd = 1.15;
    if (T >= e.cdAt && d > 6) {
      e.cdAt = T + 5 + Math.random() * 2; ringFx(ep, 0x9b59ff, 2, 0.4);
      ep.x = p.x - Math.sin(facing) * 2.6; ep.z = p.z - Math.cos(facing) * 2.6; ringFx(ep, 0x9b59ff, 2, 0.4);
    }
  } else if (b === 'bomber') {   // corre e explode
    if (!e.fuse && d < 2.8) e.fuse = T + 0.8;
    if (e.fuse) {
      o.mv = 0; o.melee = false; glowEnemy(e, Math.sin(T * 30) > 0 ? 0xff2200 : 0xffcc00);
      if (T >= e.fuse) { ringFx({ x: ep.x, z: ep.z }, 0xff7a2a, 4, 0.5); shake = 0.3; if (Math.hypot(p.x - ep.x, p.z - ep.z) < 3.8) hitPlayer(e); e.fuse = 0; damageEnemy(e, e.maxHp * 10); }
    }
  } else if (b === 'summoner') {   // invoca esqueletos
    keep(9, 13);
    if (T >= e.cdAt && enemies.length < 34) { e.cdAt = T + 8; ringFx(ep, 0xa66bff, 3, 0.6); for (let i = 0; i < 2; i++) spawnEnemy(false, null, 'minion', { x: ep.x + (i ? 1.8 : -1.8), z: ep.z + 1.2 }); if (e.mesh.userData.glb) playOnce(e.mesh, 'atk', 0.6); }
  } else if (b === 'nova') {   // marca uma area no chao: saia de la
    keep(8, 12);
    if (T >= e.cdAt) { e.cdAt = T + 4.2 + Math.random(); addDanger(p.x, p.z, 3.4, 1.1, e.dmg * 1.3, 0x4fc3ff); if (e.mesh.userData.glb) playOnce(e.mesh, 'atk', 0.6); }
  } else if (b === 'boss') { bossBrain(e, o, vx, vz, d);
  } else if (b === 'spitter') {   // cospe uma poca que fica queimando
    keep(7, 11);
    if (T >= e.cdAt) { e.cdAt = T + 3.6 + Math.random(); addDanger(p.x, p.z, 2.6, 0.7, e.dmg * 0.4, 0x7bdc3a, 4.5); if (e.mesh.userData.glb) playOnce(e.mesh, 'atk', 0.6); }
  }
  return o;
}

function hitPlayer(e) {
  if (T < invuln) return;
  invuln = T + 0.6;
  let dmg = e.dmg * (1 - sk('armor') * 0.07) * (1 - Math.min(0.6, statSum('def'))) * CLASSES[hero.cls].taken * (mounted ? 0.5 : 1) * (T < bearUntil ? 0.35 : 1);
  shake = 0.25; playOnce(player, 'hit');
  if (shield > 0) { const ab = Math.min(shield, dmg); shield -= ab; dmg -= ab; }
  hp -= dmg;
  if (sk('thorns') && e.mesh && !e.wb) damageEnemy(e, Math.max(1, Math.round(atkPower() * 0.35 * sk('thorns'))));
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
  const gl = vfx.glowSprite(color, (opt.arrow ? 1.8 : 3.0) * (opt.size || 1)); gl.position.copy(b.position); scene.add(gl); vfx.flash(from, color, 2.6, 0.18, 1.2);
  bullets.push({ glow: gl, mesh: b, dir, life: opt.life || 1.1, dmg, speed: opt.speed || 16, kind: opt.kind, pierce: !!opt.pierce, splash: opt.splash || 0, color, hit: new Set() });
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
  if (bear) meleeArc(target, 3.6 + ultTier() * 1.2, Math.PI * (0.8 + ultTier() * 0.2), dmg, 1.5);
  else if (cls === 'warrior') meleeArc(target, hero.range + 0.6, Math.PI * 0.67, dmg, 1.3);
  else if (cls === 'paladin') { meleeArc(target, hero.range + 0.6, Math.PI * 0.67, dmg, 1.0); heal(1.5 + state.level * 0.15 + maxHp * 0.003 * sk('holy')); }
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
  hp = Math.min(maxHp, hp + v); ftAt(player.position, '+' + Math.round(v), '#7CFC00', 2.4); vfx.rise(player.position, 0x8cff8c, v > maxHp * 0.1 ? 26 : 5, 0.9, 2.4, 0.32);
}

const ultTier = () => (state.level >= ULT_LV[1] ? 2 : state.level >= ULT_LV[0] ? 1 : 0);
const ultName = () => { const t = ultTier(); return t ? ULT_EVO[hero.cls][t - 1].name : CLASSES[hero.cls].ult; };
function meteorAt(tp, r, d, big) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(big ? 1.2 : 0.9, 14, 12), glow(0xff5a1f)); m.position.set(tp.x, 22, tp.z); m.add(vfx.glowSprite(0xff8a2a, big ? 6 : 4.5));
  addEffect(m, 0.8, (k) => { m.position.y = 22 * (1 - k) + 0.5; for (let i = 0; i < 3; i++) vfx.trail(m.position, i ? 0xffc060 : 0xff5a1f, 1.5); }, () => { explode(tp, r, d, 0xff5a1f); if (big) shake = 0.5; vfx.flash(tp, 0xffd27a, big ? 18 : 10, 0.5, 1.5); vfx.shock(tp, 0xff6a1f, r * 1.2, 0.7); vfx.burst(tp, { color: 0xff7a2a, n: big ? 70 : 36, speed: 12, up: 1.3, size: 0.95, life: 1.0, grav: 9 }); vfx.scorch(tp, r * 0.8, 4); if (big) screenFlash('#ffb060', 0.45, 500); });
  ringFx(tp, 0xff5a1f, r, 0.8);
}
function useSkill() {
  if (isPaused() || T < (skillReady[hero.id] || 0)) return;
  const cls = hero.cls, def = CLASSES[cls], p = player.position, dmg = atkPower(), U = ultTier();
  ultLen[hero.id] = def.ultCd * (1 - sk('arcane') * 0.08); skillReady[hero.id] = T + ultLen[hero.id]; playOnce(player, 'ult', 1.0);
  { const c = '#' + new THREE.Color(hero.color).getHexString(); screenFlash(c, 0.4, 420); vfx.flash(p, hero.color, 7, 0.4, 1.3); }
  const fwd = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
  if (cls === 'warrior') {
    const R = [7, 9, 11][U], waves = [1, 2, 3][U], sd = [2.5, 3, 3.5][U];
    ringFx(p, hero.color, R, 0.5); shake = 0.35 + U * 0.1; vfx.shock(p, 0xffc36b, R + 1, 0.6); vfx.burst(p, { color: 0xffc36b, n: 44 + U * 30, speed: 10, up: 0.3, size: 0.75, life: 0.8 }); vfx.column(p, 0xffd28a, 6 + U * 2, 6, 0.5); vfx.scorch(p, 4 + U, 1.8);
    for (let w = 0; w < waves; w++) timers.push({ at: T + w * 0.35, fn: () => {
      if (w) { ringFx(player.position, 0xffa94d, R, 0.5); vfx.shock(player.position, 0xffc36b, R, 0.5); shake = 0.3; }
      enemies.slice().forEach(e => { if (dist2(e.mesh.position, player.position) < R) { e.stun = sd; damageEnemy(e, Math.round(dmg * (w ? 1.3 : 2))); } });
    } });
    shield = Math.round(maxHp * [0.25, 0.35, 0.5][U]); shieldUntil = T + 6 + U * 2; toast('🛡️ ' + ultName() + '!');
  } else if (cls === 'paladin') {
    const R = [6.5, 9, 12][U], pulses = [1, 2, 3][U];
    ringFx(p, 0xffe08a, R, 0.6); shake = 0.3 + U * 0.1; vfx.column(p, 0xffe9a0, 16 + U * 6, 6 + U * 2, 1.0); vfx.rise(p, 0xfff0a0, 40 + U * 30, 4, 5, 0.5); heal(maxHp * [0.35, 0.5, 0.7][U]); shield = Math.round(maxHp * [0.15, 0.25, 0.4][U]); shieldUntil = T + 5 + U * 2;
    for (let w = 0; w < pulses; w++) timers.push({ at: T + w * 0.5, fn: () => {
      const pp = player.position; if (w) { ringFx(pp, 0xffe08a, R, 0.5); vfx.column(pp, 0xffe9a0, 12, 5, 0.6); }
      enemies.slice().forEach(e => { if (dist2(e.mesh.position, pp) < R) { damageEnemy(e, Math.round(dmg * [2.5, 3, 3.6][U])); if (U) vfx.column(e.mesh.position, 0xfff0a0, 8, 2, 0.5); } });
    } });
    toast('✨ ' + ultName() + '!');
  } else if (cls === 'assassin') {
    invuln = T + [1.3, 1.9, 2.5][U]; toast('🗡️ ' + ultName() + '!');
    const N = [6, 9, 15][U], gap = [0.18, 0.16, 0.12][U];
    for (let i = 0; i < N; i++) timers.push({ at: T + i * gap, fn: () => {
      const pool = enemies.filter(e => dist2(e.mesh.position, player.position) < 14 + U * 3); if (!pool.length) return;
      const t = pool[Math.floor(Math.random() * pool.length)], tp = t.mesh.position, pp = player.position;
      ringFx(pp, hero.color, 1.5, 0.3); vfx.burst(pp, { color: 0x9b59ff, n: 16, speed: 4, size: 0.6, life: 0.5, grav: 0 });
      pp.x = THREE.MathUtils.clamp(tp.x + 1.1, -WORLD, WORLD); pp.z = THREE.MathUtils.clamp(tp.z, -WORLD, WORLD);
      const crit = Math.random() < 0.35; vfx.slash(tp, Math.random() * 6.28, 2.4, Math.PI * 1.1, 0xd9a6ff, 0.25, 1.1); vfx.slash(tp, Math.random() * 6.28, 2.0, Math.PI * 0.9, 0xffffff, 0.2, 1.0); damageEnemy(t, Math.round(dmg * [1.6, 1.9, 2.1][U] * (crit ? 2 : 1)), crit); ringFx(tp, 0xffffff, 2, 0.25);
    } });
  } else if (cls === 'mage') {
    const t = nearestEnemy(p, 14), tp = t ? t.mesh.position.clone() : p.clone().addScaledVector(fwd, 5);
    if (!U) { meteorAt(tp, 6.5, dmg * 6, true); toast('☄️ Meteoro!'); }
    else {
      const N = U === 1 ? 6 : 12, spread = U === 1 ? 6 : 9, r = U === 1 ? 5 : 5.5, d = dmg * (U === 1 ? 4.2 : 4.6);
      for (let i = 0; i < N; i++) timers.push({ at: T + i * (U === 1 ? 0.2 : 0.14), fn: () => {
        const a = Math.random() * 6.28, rr = i ? Math.sqrt(Math.random()) * spread : 0;
        meteorAt({ x: tp.x + Math.cos(a) * rr, z: tp.z + Math.sin(a) * rr }, r, Math.round(d), i % 3 === 0);
      } });
      toast('☄️ ' + ultName() + '!');
    }
  } else if (cls === 'sorcerer') {
    const mult = 3 + overload / 20, R = [9, 11.5, 14][U], pulses = [1, 2, 3][U];
    for (let w = 0; w < pulses; w++) timers.push({ at: T + w * 0.4, fn: () => {
      const pp = player.position; ringFx(pp, hero.color, R, 0.6); shake = 0.4; vfx.spiral(pp, hero.color, R, 60); vfx.spiral(pp, 0xffffff, R * 0.7, 30); vfx.shock(pp, hero.color, R + 1, 0.8);
      enemies.slice().forEach(e => { if (dist2(e.mesh.position, pp) < R) damageEnemy(e, Math.round(dmg * mult * (w ? 0.7 : 1))); });
    } });
    overload = 0; toast('🌀 ' + (U ? ultName() : 'Sobrecarga liberada') + '!');
  } else if (cls === 'druid') {
    bearUntil = T + [6, 9, 12][U]; toast('🐻 ' + (U ? ultName() : 'Forma de Urso') + '!'); heal(maxHp * [0.15, 0.3, 0.5][U]); ringFx(p, 0x7CFC00, 5 + U * 3, 0.6); if (U) enemies.forEach(e => { if (dist2(e.mesh.position, p) < 6 + U * 3) e.stun = 1.5 + U; }); vfx.rise(p, 0x7CFC00, 44, 3.5, 4, 0.5); vfx.burst(p, { color: 0xb6ff6a, n: 30, speed: 7, up: 0.9, size: 0.55, life: 0.9, grav: 2 }); vfx.column(p, 0x9bff6a, 8, 4, 0.7);
  } else if (cls === 'archer') {
    const t = nearestEnemy(p, 14), tp = t ? t.mesh.position.clone() : p.clone().addScaledVector(fwd, 5);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), new THREE.MeshBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    const ZR = [5, 7, 9.5][U];
    ring.rotation.x = -Math.PI / 2; ring.position.set(tp.x, 0.15, tp.z); ring.scale.setScalar(ZR); scene.add(ring);
    vfx.shock(tp, 0xfff3a0, ZR + 0.5, 0.6); vfx.flash(tp, 0xfff3a0, 8, 0.3, 1);
    zones.push({ x: tp.x, z: tp.z, r: ZR, until: T + [4, 5.5, 7][U], next: T, dmg: Math.round(dmg * [1.2, 1.6, 2.2][U]), ring }); toast('🏹 ' + ultName() + '!');
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
  if (k === '[') camYawT += 0.4; if (k === ']') camYawT -= 0.4;
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
  const choices = rollChoices(state.skills, 3, mainCls());
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
      vfx.bolt(e.mesh.position, 0xfff27a, 18);
      ringFx(e.mesh.position, 0xfff27a, 1.8, 0.3); damageEnemy(e, Math.round(atkPower() * (1.2 + l * 0.25)));
    });
    return true;
  }
  if (!enemies.length) return false;
  if (id === 'nova') { vfx.shock(p, 0xff8a3a, 4.5 + l * 0.7, 0.5); explode(p, 3.5 + l * 0.7, Math.round(atkPower() * (1.4 + l * 0.3)), 0xff6a2f); return true; }
  if (id === 'frost') {
    const r = 5 + l * 0.6; ringFx(p, 0x7fdcff, r, 0.5); vfx.burst(p, { color: 0xc4f4ff, n: 44, speed: r * 1.7, up: 0.3, size: 0.55, life: 0.9, grav: 2 }); vfx.flash(p, 0x9fe8ff, r * 1.8, 0.4, 0.8);
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
    while (orbMeshes.length < O + 1) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), new THREE.MeshBasicMaterial({ color: 0xb28dff })); m.add(vfx.glowSprite(0xb28dff, 1.9)); scene.add(m); orbMeshes.push(m); m.visible = true; }
    orbAngle += dt * 2.8; const n = O + 1;
    orbMeshes.forEach((m, i) => {
      if (i >= n) return;
      const a = orbAngle + i / n * Math.PI * 2; m.position.set(p.x + Math.cos(a) * 2.5, 1.2, p.z + Math.sin(a) * 2.5); vfx.trail(m.position, 0xb28dff, 0.5);
      enemies.slice().forEach(e => { if (T >= (e.orbCd || 0) && Math.hypot(e.mesh.position.x - m.position.x, e.mesh.position.z - m.position.z) < e.radius + 0.6) { e.orbCd = T + 0.5; damageEnemy(e, Math.round(atkPower() * 0.6)); } });
    });
  }
}

// ===================== Cidade, loja e mapa =====================
function setCityMode(on, at) {
  if (cave) leaveCave();
  if (inHome) cleanupHome();
  if (on && wb) endWB();
  if (on && dg) { dg = null; toast('🏰 Você saiu da masmorra'); }
  if (on && !inCity) track('city');
  curDistrict = ''; inCity = on; fieldGroup.visible = !on; ground.visible = on; terrain.visible = !on; if (city) city.group.visible = on;
  clearEnemies(); nearNpc = null; walkGoal = null; $('talk').style.display = 'none';
  if (on) {
    setSky(['#6ec6ff', '#bfe6ff', '#fff1d6']); scene.fog.color.set(0xdff0ff); ground.material.map = grassMap; ground.material.needsUpdate = true; ground.material.color.set(0xb5d99c); hemi.groundColor.set(0x4a7a3a); scene.fog.near = 70; biomeFar = 270;
    player.position.set(at ? at[0] : CITY_SPAWN[0], 0, at ? at[1] : CITY_SPAWN[1]); if (at) pushOutCity(player.position, 0.6);
  } else {
    applyAct(); player.position.set(0, 0, 0);
    if (state.stage === 5 && !state.endless && !bossRef) spawnBoss();
  }
  setZoom(on ? 1.6 : 1); zoom = zoomT;
  pet.position.copy(player.position); camera.position.copy(player.position).add(camOffset().multiplyScalar(zoom));
  if (on) setBtn('citybtn', '🌲', 'SAIR'); else setBtn('citybtn', '🏰', 'CIDADE'); refreshHud();
}

function doUpgrade(it) {
  const c = upgradeCost(it), mi = Math.min(5, it.tier), have = state.mats[mi] || 0;
  if (it.plus >= MAX_PLUS || state.gold < c.gold || have < c.mat) return false;
  state.gold -= c.gold; state.mats[mi] = have - c.mat; it.plus++; recalcHp(); save(state); refreshHud(); return true;
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
        const ky = Math.max(5, Math.round(c.gold / 40) + c.mat * 2);
        const row = { text: (isEquipped(it) ? '✅ ' : '') + itemLine(it), color: RAR[it.rar].color };
        if (maxed) { row.btn = 'MÁX'; row.enabled = false; }
        else row.btns = [
          { label: '⬆ 🪙' + c.gold + ' ' + MATS[Math.min(5, it.tier)].icon + c.mat, enabled: state.gold >= c.gold && (state.mats[Math.min(5, it.tier)] || 0) >= c.mat, fn: () => { doUpgrade(it); again(); } },
          { label: '⚡🔮' + ky, enabled: state.cash >= ky, fn: () => { state.cash -= ky; it.plus++; recalcHp(); save(state); refreshHud(); again(); } },
        ];
        rows.push(row);
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
// tela do "set" (boneco) só com as peças que esse NPC melhora; tocar numa peça abre o que ela precisa
function openSetPicker(back, slots, pick) {
  openPanel('⬆ MELHORAR', [
    { text: '◀ Voltar', btn: 'VOLTAR', fn: back },
    { head: true, text: 'Toque na peça do seu set que você quer melhorar:' },
  ]);
  const man = el('div', 'mannequin', null, $('card')); man.style.cssText = 'height:300px;min-height:300px;margin:6px 0;--ss:58px';
  man.insertAdjacentHTML('beforeend', FIGURE('#' + hero.color.toString(16).padStart(6, '0')));
  let anyReady = false;
  Object.keys(DOLL_POS).filter(k => slots.includes(k)).forEach(key => {
    const it = equippedAt(key), b = el('button', 'slot', null, man);
    b.style.left = (slots.length <= 2 ? [30, 70][slots.indexOf(key)] : DOLL_POS[key][0]) + '%'; b.style.top = (slots.length <= 2 ? 50 : DOLL_POS[key][1]) + '%';
    if (it) {
      b.style.borderColor = RAR[it.rar].color; artImg(itemArt(it), b); if (it.plus) el('span', 'pl', '+' + it.plus, b); b.onclick = () => pick(key);
      const st = craft.improveState(it); if (st) { b.classList.add('ready'); el('span', 'rd', st === 'evo' ? '⭐' : '🔨', b); anyReady = true; }
    }
    else { artImg(ghostArt(ghostKey(key)), b); el('small', '', slotLabel(key), b); b.onclick = () => toast('Nada equipado em ' + slotLabel(key) + '. Equipe uma peça primeiro (botão EQUIP).'); }
  });
  el('div', 'prow', anyReady ? '✨ As peças que piscam podem ser melhoradas agora:  ⭐ evoluir de nível   🔨 refinar' : 'Nenhuma peça pode ser melhorada agora. Junte mais peças iguais, ouro e materiais.', $('card')).style.cssText = 'font-size:13px;opacity:.9;justify-content:center;text-align:center';
}
function openNpcMenu(n) {
  if (isPaused()) return;
  walkGoal = null;
  const back = () => { closePanel(); openNpcMenu(n); }, slots = ROLE_SLOTS[n.role];
  const rows = [{ head: true, text: n.icon + ' ' + n.title + '\n“' + n.talk + '”' }];
  if (slots) {
    const nm = ROLE_WHAT[n.role];
    rows.push({ text: '⬆ Melhorar ' + nm + '\nEscolha a peça que você usa e veja o que precisa', btn: 'ABRIR', fn: () => craft.openEquipUp(back, slots) });
    rows.push({ text: '🛒 Comprar ' + nm + '\nEquipamentos da loja', btn: 'ABRIR', fn: () => openGear('🛒 Comprar ' + nm, slots, 'buy', back) });
    rows.push({ text: '💰 Vender itens\nO que você coletou dos monstros', btn: 'ABRIR', fn: () => openGear('💰 Vender itens', SLOT_ORDER, 'sell', back) });
  }
  if (n.role === 'deco') rows.push({ text: '🪑 Comprar móveis\nOs móveis vão para o seu baú. Depois, dentro da sua casa, toque em DECORAR para colocar.', btn: 'ABRIR', fn: () => openFurnShop(n) });
  if (n.role === 'craft') rows.push({ text: '⚒ Ofício\nForjar equipamentos, lapidar e encaixar gemas', btn: 'ABRIR', fn: () => craft.openCraft(back) });
  if (n.role === 'market') {
    rows.push({ text: '🏪 Mercado de jogadores\nCompre e venda equipamentos com outros jogadores', btn: 'ABRIR', fn: () => social.openMarket('buy', back) });
    rows.push({ text: '🤝 Troca direta\nTroque itens e ouro com um amigo (os dois confirmam)', btn: 'ABRIR', fn: () => social.openTrade(back) });
  }
  if (n.role === 'herald') {
    rows.push({ text: '🐉 Chefe Mundial\nTodos os jogadores lutam juntos contra o mesmo chefe', btn: 'ABRIR', fn: () => social.openWBoss(back, enterWBoss) });
    rows.push({ text: '🏆 Ranking\nMaiores níveis, abates e chefes', btn: 'ABRIR', fn: () => social.openRank(back) });
    rows.push({ text: '🛡 Guilda\nCrie ou entre numa guilda e converse', btn: 'ABRIR', fn: () => social.openGuild(back) });
    rows.push({ text: '📜 Missões e conquistas\nDiárias, semanais e login', btn: 'ABRIR', fn: () => openQuests() });
    rows.push({ text: '🎟 Passe da Temporada\n30 níveis de prêmios todo mês', btn: 'ABRIR', fn: () => shop.openPass(back) });
    rows.push({ text: '🛍 Loja de aparências\nAuras e títulos (só cosméticos)', btn: 'ABRIR', fn: () => shop.openCosmetics(back) });
    rows.push({ text: '💎 Comprar gemas\nPacotes (pagamento real em breve)', btn: 'ABRIR', fn: () => shop.openGemPacks(back) });
  }
  if (n.role === 'summoner') rows.push({ text: '🎓 Vocações e criaturas\nDesbloqueie novas classes e invoque mascotes', btn: 'ABRIR', fn: () => openProfs() });
  if (n.role === 'map') {
    rows.push({ text: '🗺️ Mapa das florestas\nEscolha para onde viajar', btn: 'ABRIR', fn: () => openMap() });
    rows.push({ text: '🏰 Mapa da cidade\nVeja onde está cada morador', btn: 'ABRIR', fn: () => openCityMap() });
    rows.push({ text: '🕳 Masmorra Sombria\n5 andares com chefe • 3 entradas por dia', btn: 'ABRIR', fn: () => openDungeon(back) });
  }
  rows.push({ text: '👋 Até logo', btn: 'FECHAR', fn: closePanel });
  openPanel(n.icon + ' ' + n.title.split(',')[0], rows);
}
function openNpc(n) { openNpcMenu(n); }
function openFurnShop(n, keep) {
  const st = keep ? $('card').scrollTop : 0, again = () => openFurnShop(n, true);
  const rows = [{ text: '◀ Voltar ao menu', btn: 'VOLTAR', fn: () => openNpcMenu(n) }, { head: true, text: '🪙' + state.gold + '   Móveis no baú: ' + Object.values(state.stock).reduce((a, b) => a + b, 0) }];
  FURN.forEach(f => rows.push({ text: f.icon + ' ' + f.name + '\nNo baú: ' + (state.stock[f.k] || 0), btn: f.prem ? '💎' + f.prem : '🪙' + f.price, enabled: f.prem ? state.gems >= f.prem : state.gold >= f.price, fn: () => { if (f.prem) state.gems -= f.prem; else state.gold -= f.price; track('furn'); state.stock[f.k] = (state.stock[f.k] || 0) + 1; save(state); refreshHud(); again(); } }));
  openPanel('🪑 Comprar móveis', rows);
  if (keep) $('card').scrollTop = st;
}

let curDistrict = '';
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
    const ox = full ? 0 : p.x, oz = full ? 0 : p.z, k = (h - 8) / (full ? CITY_R + 3 : 62), X = (x) => h + (x - ox) * k, Z = (z) => h + (z - oz) * k;
    px = X(p.x); pz = Z(p.z);
    drawCityBase(c, X, Z, k, full);
    PLOTS.forEach(p => { c.save(); c.translate(X(p.x), Z(p.z)); c.rotate(-p.ry); c.fillStyle = state.homes[p.id] ? '#66e08a' : p.kind === 'house' ? '#d9c2a0' : '#b9a6c9'; c.fillRect(-p.w / 2 * k, -p.d / 2 * k, p.w * k, p.d * k); c.restore(); });
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = (full ? 22 : 11) + 'px sans-serif'; c.fillStyle = '#fff';
    c.fillText('🚪', X(0), Z(CITY_R - 3));
    city.npcs.forEach(n => {
      c.fillStyle = n.color; c.beginPath(); c.arc(X(n.pos[0]), Z(n.pos[1]), full ? 9 : 7, 0, 7); c.fill();
      c.font = (full ? 13 : 10) + 'px sans-serif'; c.fillStyle = '#000'; c.fillText(n.icon, X(n.pos[0]), Z(n.pos[1]) + 1);
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
  DISTRICTS.forEach(d => rows.push({ text: d.icon + ' ' + d.name, btn: 'IR', fn: () => { closePanel(); walkGoal = { x: d.x, z: d.z, spot: true }; toast('🚶 Indo para ' + d.name + '…'); } }));
  rows.push({ text: '🏘️ Casas e prédios\nToque numa casa (🏠 à venda) ou prédio (🏢 aluguel) no mapa 3D para comprar e entrar.' });
  rows.push({ text: '🚪 Portão da cidade\nSair para a floresta', btn: 'SAIR', fn: () => { closePanel(); setCityMode(false); } });
  openPanel('🏰 MAPA DA CIDADE', rows);
  const cvm = document.createElement('canvas'); cvm.width = cvm.height = 360;
  cvm.style.cssText = 'width:100%;max-width:300px;display:block;margin:0 auto 10px';
  const card = $('card'); card.insertBefore(cvm, card.children[1]); drawMap(cvm, true);
}

// ===================== Casas e apartamentos =====================
const refreshPlots = () => { if (city) city.setOwned(state.homes, owners, myOid); };
function syncCam() { pet.position.copy(player.position); camera.position.copy(player.position).add(camOffset().multiplyScalar(zoom)); }

const RENT = 180, WEEK = 7 * 864e5;
function homeBonus() { let h = 0, a = 0; Object.keys(state.homes).forEach(id => { const p = PLOTS.find(x => x.id === id); if (p) { if (p.kind === 'house') h++; else a++; } }); return { atk: Math.min(5, h) * 0.03, gold: Math.min(5, a) * 0.02 }; }
function loseHome(id, refund) {
  const h = state.homes[id]; if (!h) return; (h.furn || []).forEach(f => { state.stock[f.k] = (state.stock[f.k] || 0) + 1; });
  delete state.homes[id]; if (net) net.send({ t: 'sell', plot: id }); if (refund) state.gold += refund; save(state); refreshHud(); refreshPlots();
}
function sellHome(p) { loseHome(p.id, Math.round(p.price * 0.6)); closePanel(); toast('💰 ' + p.name + ' vendida por 🪙' + Math.round(p.price * 0.6)); }
function checkRent(quiet) {
  const now = Date.now(); let changed = false;
  Object.keys(state.homes).forEach(id => {
    const p = PLOTS.find(x => x.id === id); if (!p || p.kind !== 'apt') return;
    const h = state.homes[id]; if (!h.paid) { h.paid = now + WEEK; changed = true; return; }
    let n = 0; while (now > h.paid && state.gold >= RENT && n < 4) { state.gold -= RENT; h.paid += WEEK; n++; changed = true; }
    if (n && !quiet) toast('🏢 Aluguel de ' + p.name + ' pago: 🪙' + RENT * n);
    if (now > h.paid + 3 * 864e5) { loseHome(id, 0); toast('🏢 Você perdeu ' + p.name + ' por aluguel atrasado. Os móveis voltaram ao baú.'); }
    else if (now > h.paid && !quiet) toast('⚠ Aluguel de ' + p.name + ' atrasado! Pague no prédio ou perderá o apartamento.');
  });
  if (changed) { save(state); refreshHud(); }
}
function openPlotMenu(p) {
  if (isPaused()) return;
  walkGoal = null;
  const own = state.homes[p.id], o = owners[p.id], other = !own && o && o.oid !== myOid, house = p.kind === 'house', R = ROOMS[p.kind], again = () => openPlotMenu(p);
  const rows = [{ head: true, text: (house ? '🏠 ' : '🏢 ') + p.name + ' — ' + R.label + '\n' + (own ? 'Este lar é seu! Entre para decorar com móveis.' : other ? 'Morada de ' + o.name + '. ' + ({ open: 'Aberta: você pode entrar e olhar a decoração (sem mexer em nada).', invited: 'Só entra quem foi convidado.', private: 'Casa privada: só o dono entra.' }[o.acc || 'private']) : house ? 'Casa ampla para decorar do seu jeito.' : 'Apartamento aconchegante para morar e decorar.') }];
  if (other && o.name === meName()) rows.push({ head: true, text: '⚠ Esta casa tem o mesmo nome que o seu, mas foi comprada em outro navegador/aparelho, por isso você só pode visitar. Para ter acesso de dono, abra PERFIL → “Entrar com um código de conta” e use o código do navegador onde comprou.' });
  if (own) rows.push({ text: '🚪 Entrar\n' + (own.furn || []).length + ' móvel(is) • sala ' + roomDims(p.kind, own.sz).w + '×' + roomDims(p.kind, own.sz).d + ' m • ' + (own.fls || 1) + ' andar(es)', btn: 'ENTRAR', fn: () => { closePanel(); enterHome(p); } });
  if (own) rows.push({ text: '📐 Ampliar sala / 🏗 Novos andares\nMais espaço para decorar', btn: 'ABRIR', fn: () => openHomeUp(p) });
  if (own) {
    const acc = own.acc || 'private', LAB = { private: '🔒 Privada — só você entra', invited: '👥 Só convidados — entra quem você convidar', open: '🌐 Aberta — qualquer jogador entra e olha (ninguém mexe em nada)' };
    const pushAcc = () => { save(state); if (owners[p.id]) owners[p.id].acc = own.acc; if (net) net.send({ t: 'access', plot: p.id, mode: own.acc || 'private', guests: own.guests || [] }); again(); };
    rows.push({ text: '🔐 Quem pode entrar\n' + LAB[acc], btn: 'MUDAR', fn: () => { own.acc = { private: 'invited', invited: 'open', open: 'private' }[acc]; pushAcc(); } });
    if (acc === 'invited') {
      rows.push({ text: '➕ Convidar jogador\nDigite o nome exato dele no jogo', btn: 'CONVIDAR', fn: () => { const n = (prompt('Nome do jogador convidado:') || '').trim().toLowerCase().slice(0, 24); if (!n) return; own.guests = [...new Set([...(own.guests || []), n])].slice(0, 30); pushAcc(); } });
      (own.guests || []).forEach(g => rows.push({ text: '👤 ' + g + '\nConvidado', btn: 'REMOVER', fn: () => { own.guests = (own.guests || []).filter(x => x !== g); pushAcc(); } }));
    }
  }
  else if (other && (o.acc || 'private') === 'private') rows.push({ text: '🔒 Casa privada\nSó o dono ' + o.name + ' pode entrar', btn: 'TRANCADA', enabled: false, fn: () => {} });
  else if (other) rows.push({ text: (o.acc === 'invited' ? '🎟 Entrar (só convidados)\nSe o seu nome estiver na lista de ' + o.name : '👀 Visitar a casa de ' + o.name + '\nVeja os móveis dele — só olhar'), btn: 'ENTRAR', enabled: !!(net && net.connected), fn: () => { closePanel(); net.send({ t: 'visit', plot: p.id }); } });
  else {
    const vp = Math.round(p.price / 40), done = () => { state.homes[p.id] = p.kind === 'apt' ? { furn: [], paid: Date.now() + WEEK } : { furn: [] }; track('house'); save(state); refreshHud(); if (net) net.send({ t: 'buy', plot: p.id }); refreshPlots(); closePanel(); toast(house ? '🏠 Casa comprada!' : '🏢 Apartamento alugado!'); again(); };
    rows.push({ text: (house ? '🛒 Comprar ' : '🔑 Alugar ') + p.name + ' com ouro\nSala de ' + R.w + '×' + R.d + ' m (dá para ampliar e ter mais andares)', btn: '🪙' + p.price, enabled: state.gold >= p.price, fn: () => { state.gold -= p.price; done(); } });
    if (house) rows.push({ text: '💎 Comprar ' + p.name + ' com Veon\nVocê tem ' + state.cash + ' Veon', btn: 'Veon ' + vp, enabled: state.cash >= vp, fn: () => { state.cash -= vp; done(); } });
  }
  if (own) {
    if (!house) { const days = Math.max(0, Math.ceil(((own.paid || Date.now()) - Date.now()) / 864e5)); rows.push({ text: '💳 Aluguel semanal: 🪙' + RENT + '\nPróximo vencimento em ' + days + ' dia(s). Atrasou mais de 3 dias, perde o apartamento. O sistema desconta sozinho se você tiver ouro.', btn: 'PAGAR 🪙' + RENT, enabled: state.gold >= RENT && (own.paid || 0) < Date.now() + 3 * WEEK, fn: () => { state.gold -= RENT; own.paid = Math.max(own.paid || 0, Date.now()) + WEEK; save(state); refreshHud(); toast('🏢 Aluguel pago'); again(); } }); }
    rows.push({ text: '💰 Vender ' + p.name + '\nVocê recebe 🪙' + Math.round(p.price * 0.6) + ' e os móveis voltam para o seu baú.', btn: 'VENDER', fn: () => { if (confirm('Vender ' + p.name + '?')) sellHome(p); } });
  }
  rows.push({ head: true, text: '🎁 Bônus de imóveis: cada CASA dá +3% de dano (máx. 5), cada APARTAMENTO dá +2% de ouro (máx. 5). Dormir numa cama da sua casa dá +15% de dano por 10 min.' });
  rows.push({ text: '👋 Voltar', btn: 'FECHAR', fn: closePanel });
  openPanel((house ? '🏠 ' : '🏢 ') + p.name, rows);
}

function enterHome(p, visit) {
  if (!visit && !state.homes[p.id]) return;
  if (inHome) cleanupHome();
  const hd0 = visit || state.homes[p.id] || {};
  homeVisit = visit || null; inHome = p; homeRoom = buildRoom(p.kind, hd0.sz | 0); homeRoom.items = []; homeRoom.fls = Math.max(1, Math.min(ROOMS[p.kind].maxFl, hd0.fls | 0 || 1)); homeFloor = 0; scene.add(homeRoom.group);
  const mk = new THREE.Group();
  mk.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.28, depthWrite: false })));
  mk.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.1, 1)), new THREE.LineBasicMaterial({ color: 0xffe14d })));
  mk.visible = false; homeRoom.group.add(mk); decor.mark = mk; decor.sel = null;
  (visit ? visit.furn || [] : state.homes[p.id].furn || []).forEach(f => addFurn(f));
  if (city) city.group.visible = false;
  ground.position.y = -0.9;   // o chão do mundo ficava na mesma altura do piso da sala e piscava (z-fighting)
  setSky(['#2b2140', '#4a3a66', '#7a5f8f']); scene.fog.color.set(0x2b2140); ground.material.color.set(0x241c33);
  clearEnemies(); nearNpc = null; walkGoal = null; $('talk').style.display = 'none';
  player.position.set(0, 0, homeRoom.hd - 1.8); facing = Math.PI;
  setZoom(1.7 + (homeRoom.hw > 9 ? 0.4 : 0)); zoom = zoomT; syncCam(); showFloor(0, true);
  document.body.classList.add('inhome'); $('minimap').style.display = 'none'; $('decor').style.display = 'none'; updateHomeUi();
  setBtn('citybtn', '🚪', 'SAIR'); refreshHud(); toast(visit ? '👀 Visitando a casa de ' + visit.name : '🏠 ' + p.name + ' — toque em DECORAR para mobiliar');
}
function cleanupHome() {
  if (homeRoom) scene.remove(homeRoom.group);
  ground.position.y = 0; homeRoom = null; inHome = null; homeVisit = null; decor.on = false; decor.sel = null; decor.drag = false; decor.mark = null;
  document.body.classList.remove('inhome'); $('minimap').style.display = ''; $('homebar').style.display = 'none'; $('decor').style.display = 'none';
}
function leaveHome() {
  if (!inHome) return;
  const p = inHome, ownH = !homeVisit && state.homes[p.id]; cleanupHome(); setCityMode(true);
  if (ownH && (ownH.furn || []).some(f => f.k === 'bed')) { state.rest = Date.now() + 10 * 60e3; toast('😴 Descansado! +15% de dano por 10 minutos'); save(state); }
  player.position.set(p.door[0], 0, p.door[1]); facing = p.ry; syncCam(); refreshPlots();
}

// ---- andares, ampliação e interface da casa ----
function showFloor(n, quiet) {
  homeFloor = n; homeRoom.items.forEach(m => { m.visible = m.userData.fl === n; });
  homeRoom.wallM.color.setHex(FLOOR_TINT[n % 4]); decor.sel = null; updateMark(); if (decor.on) renderDecor();
  if (!quiet) toast('🪜 Andar ' + (n + 1) + ' de ' + homeRoom.fls);
  updateHomeUi();
}
function updateHomeUi() {
  if (!homeRoom) return;
  const fl = homeRoom.fls > 1, vis = !!homeVisit;
  $('flbtn').style.display = fl && !decor.on ? '' : 'none'; $('flbtn').textContent = '🪜 ANDAR ' + (homeFloor + 1) + '/' + homeRoom.fls;
  $('decfl').style.display = fl ? '' : 'none'; $('decfl').textContent = '🪜 ' + (homeFloor + 1) + '/' + homeRoom.fls;
  $('decbtn').style.display = vis ? 'none' : ''; $('upbtn').style.display = vis ? 'none' : '';
  $('homebar').style.display = decor.on || (vis && !fl) ? 'none' : 'flex';
}
const cycleFloor = () => { if (homeRoom && homeRoom.fls > 1) showFloor((homeFloor + 1) % homeRoom.fls); };
function openHomeUp(p, msg) {
  const h = state.homes[p.id]; if (!h) return;
  const R = ROOMS[p.kind], sz = h.sz | 0, fls = h.fls || 1, again = (m) => openHomeUp(p, m), after = () => { save(state); refreshHud(); if (net) net.send({ t: 'furn', plot: p.id, furn: h.furn || [], sz: h.sz | 0, fls: h.fls || 1 }); if (inHome && inHome.id === p.id) { const f0 = homeFloor; enterHome(p); showFloor(Math.min(f0, homeRoom.fls - 1), true); } };
  const rows = [{ text: '◀ Voltar', btn: 'VOLTAR', fn: () => { closePanel(); if (inHome) return; openPlotMenu(p); } }];
  rows.push({ head: true, text: (msg ? msg + '\n' : '') + '📐 AMPLIAR ' + p.name.toUpperCase() + '\nSala atual: ' + roomDims(p.kind, sz).w + '×' + roomDims(p.kind, sz).d + ' m  •  ' + fls + ' andar(es)\nSala: 🪙 ouro ou 🔮 Veon. Andares: só 🔮 Veon.' });
  if (sz < SZ_MAX) {
    const n = sz + 1, g = Math.round(p.price * 0.35 * n), gm = 30 * n, nd = roomDims(p.kind, n);
    rows.push({ text: '📐 Ampliar sala — nível ' + n + '/' + SZ_MAX + '\nNova sala: ' + nd.w + '×' + nd.d + ' m', btns: [
      { label: '🪙' + g, enabled: state.gold >= g, fn: () => { state.gold -= g; h.sz = n; after(); again('✅ Sala ampliada!'); } },
      { label: '🔮' + gm, enabled: state.cash >= gm, fn: () => { state.cash -= gm; h.sz = n; after(); again('✅ Sala ampliada!'); } },
    ] });
  } else rows.push({ text: '📐 Sala no tamanho máximo (' + roomDims(p.kind, SZ_MAX).w + '×' + roomDims(p.kind, SZ_MAX).d + ' m) ✔' });
  if (fls < R.maxFl) {
    const ca = 80 * fls;
    rows.push({ text: '🏗 Construir andar ' + (fls + 1) + '/' + R.maxFl + '\nMais um piso inteiro para mobiliar (use 🪜 para subir e descer)', btns: [
      { label: '🔮' + ca, enabled: state.cash >= ca, fn: () => { state.cash -= ca; h.fls = fls + 1; after(); again('✅ Novo andar construído!'); } },
    ] });
  } else rows.push({ text: '🏗 Número máximo de andares (' + R.maxFl + ') ✔' });
  openPanel('📐 AMPLIAR', rows);
}

function homeSave() {
  if (homeVisit) return;
  const f = homeRoom.items.map(m => ({ k: m.userData.k, x: m.position.x, z: m.position.z, r: m.userData.r, fl: m.userData.fl | 0 })), h = state.homes[inHome.id];
  h.furn = f; save(state); if (net) net.send({ t: 'furn', plot: inHome.id, furn: f, sz: h.sz | 0, fls: h.fls || 1 });
}
function placeFurn(m, x, z) {
  const k = m.userData.k, [fw, fd] = footprint(k, m.userData.r), sn = (v) => Math.round(v * 2) / 2, C = THREE.MathUtils.clamp;
  m.position.x = C(sn(x), -homeRoom.hw + fw / 2, homeRoom.hw - fw / 2);
  m.position.z = k === 'painting' ? -homeRoom.hd + fd / 2 + 0.02 : C(sn(z), -homeRoom.hd + fd / 2, homeRoom.hd - fd / 2);
}
function addFurn(f) {
  const m = makeFurniture(f.k); m.userData.r = f.r || 0; m.userData.fl = (f.fl | 0) % homeRoom.fls; m.rotation.y = m.userData.r * Math.PI / 2; m.visible = m.userData.fl === homeFloor;
  homeRoom.group.add(m); homeRoom.items.push(m); placeFurn(m, f.x || 0, f.z || 0); return m;
}
function updateMark() {
  const s = decor.sel, mk = decor.mark; if (!mk) return;
  mk.visible = !!s; if (!s) return;
  const [fw, fd] = footprint(s.userData.k, s.userData.r); mk.scale.set(fw + 0.25, 1, fd + 0.25); mk.position.set(s.position.x, 0.06, s.position.z);
}
function buyFurn(f) {
  if (!inHome || homeVisit) return;
  if ((state.stock[f.k] || 0) > 0) state.stock[f.k]--; else if (!f.prem && state.gold >= f.price) { state.gold -= f.price; track('furn'); } else return;
  const m = addFurn({ k: f.k, x: 0, z: -1, r: 0, fl: homeFloor }); decor.sel = m; homeSave(); refreshHud(); updateMark(); renderDecor();
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
    const have = state.stock[f.k] || 0; if (f.prem && !have) return; const b = el('button', 'dcard', null, shop); el('div', 'dic', f.icon, b); el('div', 'dnm', f.name, b); el('div', 'dpr', have ? '📦 x' + have + ' grátis' : '🪙' + f.price, b);
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
  if (on) { renderDecor(); const t2 = Math.tan(camera.fov * Math.PI / 360), D = Math.max(homeRoom.hw * 2.15 / (2 * t2 * camera.aspect), homeRoom.hd * 1.55 / (2 * t2)); setZoom(D / CAM_DECOR.length()); zoom = zoomT; } else { setZoom(1.7 + (homeRoom.hw > 9 ? 0.4 : 0)); }
  updateHomeUi();
}
const _rc = new THREE.Raycaster(), _pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _pt = new THREE.Vector3(), _nd = new THREE.Vector2();
function floorPoint(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect(); _nd.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  _rc.setFromCamera(_nd, camera); return _rc.ray.intersectPlane(_pl, _pt);
}
function pickFurn(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect(); let best = null, bd = 64;
  homeRoom.items.forEach(m => {
    if (!m.visible) return;
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
$('decfl').addEventListener('pointerdown', (e) => { e.stopPropagation(); cycleFloor(); });
$('flbtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); cycleFloor(); });
$('upbtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (!isPaused() && inHome && !homeVisit) openHomeUp(inHome); });

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
  el('div', 'det-sub', RAR[sel.rar].name + ' • ' + slotLabel(sel.slot) + ' • Nível ' + (sel.tier + 1) + (on ? ' • ✔ equipado' : ''), info);
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
const setCamMode = (m) => { camMode = m; try { localStorage.setItem('cammode', m); } catch (e) {} if (m === 'low') setZoom(Math.min(zoomT, 1.3)); else setZoom(Math.max(zoomT, 1)); toast(m === 'low' ? '🎥 Câmera imersiva ([ ] ou ⟲ ⟳ giram)' : '🎥 Câmera de cima'); $('camb').querySelector('small').textContent = m === 'low' ? 'IMERSIVA' : 'DE CIMA'; };
$('camb').addEventListener('pointerdown', (e) => { e.stopPropagation(); setCamMode(camMode === 'low' ? 'top' : 'low'); });
$('camb').querySelector('small').textContent = camMode === 'low' ? 'IMERSIVA' : 'DE CIMA';
$('rotl').addEventListener('pointerdown', (e) => { e.stopPropagation(); camYawT += 0.5; });
$('rotr').addEventListener('pointerdown', (e) => { e.stopPropagation(); camYawT -= 0.5; });
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
  remotes.set(p.id, { id: p.id, name: p.name, mesh, x: p.x || 0, z: p.z || 0, f: p.f || 0, mv: 0, w: p.w || 'other', rm: p.rm || '' });
  refreshNet();
}
function dropRemote(id) { const r = remotes.get(id); if (!r) return; remoteGroup.remove(r.mesh); remotes.delete(id); refreshNet(); }
function chatLine(name, text, mine) {
  const log = $('chatlog'), d = document.createElement('div'); d.className = 'cl' + (mine ? ' me' : '');
  d.textContent = name + ': ' + text; log.appendChild(d); while (log.children.length > 6) log.removeChild(log.firstChild);
  setTimeout(() => d.remove(), 14000);
}
function myHomes() { return PLOTS.filter(p => state.homes[p.id]); }
function updateHomeBtn() { const b = $('homebtn'); if (b) b.style.display = inCity && !inHome && !cave && myHomes().length ? '' : 'none'; }
$('homebtn').addEventListener('pointerdown', (e) => {
  e.stopPropagation(); if (isPaused() || !inCity) return;
  const hs = myHomes(); if (!hs.length) return;
  if (hs.length === 1) enterHome(hs[0]);
  else openPanel('🏠 MINHAS CASAS', hs.map(p => ({ text: (p.kind === 'house' ? '🏠 ' : '🏢 ') + p.name + '\nIr direto para dentro', btn: 'IR', fn: () => { closePanel(); enterHome(p); } })));
});
function setBtn(id, icon, label, badge) { $(id).innerHTML = '<span class="i">' + icon + '</span><small>' + label + '</small>' + (badge ? '<b class="bdg">' + badge + '</b>' : ''); }
function refreshNet() { if (net && net.connected) setBtn('netbtn', '🟢', 'ONLINE', remotes.size + 1); else setBtn('netbtn', '🔴', 'OFFLINE'); }
function syncHomes() {
  Object.keys(owners).forEach(id => { if (owners[id].oid === myOid && !state.homes[id]) { state.homes[id] = { furn: [] }; recover.add(id); net && net.send({ t: 'visit', plot: id }); } });
  Object.keys(state.homes).forEach(id => {
    const o = owners[id];
    if (o && o.oid === myOid && net && state.homes[id].acc && state.homes[id].acc !== (o.acc || 'private')) net.send({ t: 'access', plot: id, mode: state.homes[id].acc, guests: state.homes[id].guests || [] });
    if (o && o.oid !== myOid) { delete state.homes[id]; toast('⚠ ' + id + ' já pertence a ' + o.name); }
    else if (!o && net) { net.send({ t: 'buy', plot: id }); net.send({ t: 'furn', plot: id, furn: state.homes[id].furn || [], sz: state.homes[id].sz | 0, fls: state.homes[id].fls || 1 }); }
  });
  save(state); refreshPlots();
}
function netEvent(m) {
  if (m.t === 'plot') { owners[m.id] = { oid: m.oid, name: m.name, acc: m.acc || 'private' }; refreshPlots(); }
  else if (m.t === 'denied') { toast(m.acc === 'invited' ? '🔒 Esta casa é só para convidados — peça um convite ao dono' : '🔒 Esta casa é privada: só o dono pode entrar'); }
  else if (m.t === 'buyfail') { delete state.homes[m.plot]; refreshPlots(); toast('⚠ Alguém comprou essa casa antes'); }
  else if (m.t === 'home' && recover.has(m.plot)) { recover.delete(m.plot); if (state.homes[m.plot]) { state.homes[m.plot].furn = m.furn || []; state.homes[m.plot].sz = m.sz | 0; state.homes[m.plot].fls = m.fls || 1; if (m.acc) { state.homes[m.plot].acc = m.acc; state.homes[m.plot].guests = m.guests || []; } save(state); } toast('🏠 Casa recuperada: ' + m.plot); }
  else if (m.t === 'home') { const p = PLOTS.find(x => x.id === m.plot); if (p && inCity && !inHome) enterHome(p, { name: m.name, furn: m.furn, sz: m.sz | 0, fls: m.fls || 1 }); }
  else if (m.t === 'hello') {
    myOid = m.oid || ''; Object.keys(owners).forEach(k => delete owners[k]); Object.assign(owners, m.plots || {}); syncHomes(); netId = m.id; remotes.forEach((r, id) => { if (id === netId) dropRemote(id); }); (m.players || []).forEach(addRemote); refreshNet(); }
  else if (m.t === 'join') addRemote(m.p);
  else if (m.t === 'leave') dropRemote(m.id);
  else if (m.t === 'furn') { if (homeVisit && homeRoom && inHome.id === m.plot) { const pl0 = inHome; enterHome(pl0, { name: homeVisit.name, furn: m.furn || [], sz: m.sz | 0, fls: m.fls || 1 }); } }
  else if (m.t === 'move') { const r = remotes.get(m.id); if (r) { r.x = m.x; r.z = m.z; r.f = m.f; r.mv = m.mv; r.w = m.w; r.rm = m.rm || ''; } }
  else if (m.t === 'host') { if (m.rm === rmCur) { const was = isHost(); rmHost = m.host; rmN = m.n || 1; if (was !== isHost()) { clearEnemies(); if (isHost() && !state.endless && state.stage === 5) spawnBoss(); } refreshHud(); } }
  else if (m.t === 'rl') onRelay(m);
  else if (m.t === 'chat') { if (String(m.text).startsWith('§e')) { const r = remotes.get(m.id), em = EMOTES[+String(m.text).slice(2)]; if (r && em && r.mesh.visible) ftAt(r.mesh.position, em, '#fff', 3.2); } else chatLine(m.name, m.text, false); }
}
function startNet() {
  const q = new URLSearchParams(location.search).get('net');
  if (testing || q === '0' || needAuth) { $('netbtn').style.display = $('chatbtn').style.display = 'none'; return; }
  net = createNet({ url: q && q.startsWith('ws') ? q : NET_URL, getMe: () => ({ name: meName(), look: state.custom || null, pid: state.pid }), onEvent: netEvent, onStatus: (ok) => { if (!ok) { remotes.forEach((r, id) => dropRemote(id)); netId = null; } refreshNet(); } });
  refreshNet();
}
const curW = () => inHome ? 'home:' + inHome.id : inCity ? 'city' : cave ? 'field:cave' : dg ? 'field:dg' : wb ? 'field:wb' : 'field:' + (state.endless ? 'inf' : state.act);
const whereTxt = (w) => w === 'city' ? 'Na cidade de Aurora' : w === 'field:wb' ? 'Lutando contra o Chefe Mundial' : w === 'field:dg' ? 'Em uma masmorra' : w.startsWith('home:') ? 'Dentro de uma casa' : w === 'field:inf' ? 'Na Aventura Infinita' : w.startsWith('field:') ? 'Na floresta do Ato ' + (+w.slice(6) + 1) + (w === curW() ? ' (com você!)' : '') : 'Em outra área';
function updateNet(dt) {
  const w = curW();
  const rkey = (!net || !net.connected || inCity || inHome || dg || wb) ? null : 'f' + (state.endless ? 'inf' : state.act + 's' + state.stage);
  if (rkey !== rmCur) { rmCur = rkey; rmHost = null; rmN = 1; if (enemies.some(e => e.remote)) clearEnemies(); refreshHud(); }
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
  if (rmCur && rmN > 1 && isHost()) {
    snapAt += dt;
    if (snapAt > 0.15) { snapAt = 0; rl('es', { sk: state.stageKills, e: enemies.filter(x => !x.remote).slice(0, 70).map(x => [x.nid, x.type, +x.mesh.position.x.toFixed(1), +x.mesh.position.z.toFixed(1), Math.max(1, Math.round(x.hp)), Math.round(x.maxHp), (x.elite ? 1 : 0) | (x.boss ? 2 : 0)]) }); }
  }
  netAt += dt;
  const p = player.position, moved = Math.hypot(p.x - netLast.x, p.z - netLast.z) > 0.05 || Math.abs(facing - netLast.f) > 0.1 || w !== netLast.w || (rmCur || '') !== (netLast.rm || '');
  if ((moved && netAt > 0.1) || netAt > 3) {
    netAt = 0; const mv = Math.hypot(p.x - netLast.x, p.z - netLast.z) > 0.05 ? 1 : 0;
    netLast = { x: p.x, z: p.z, f: facing, mv, w, rm: rmCur || '' }; net.send({ t: 'move', x: +p.x.toFixed(2), z: +p.z.toFixed(2), f: +facing.toFixed(2), mv, w, rm: rmCur || '' });
  }
}
function openOnline() {
  if (isPaused()) return;
  const rows = [{ head: true, text: net && net.connected ? '🟢 Conectado — ' + (remotes.size + 1) + ' jogador(es) online' : '🔴 Sem conexão com o servidor. Tentando reconectar…' }];
  rows.push({ text: '🧍 ' + meName() + ' (você)\n' + (inHome ? 'Em casa' : inCity ? 'Na cidade' : 'Nas florestas') });
  remotes.forEach(r => {
    const inField = r.rm && r.w.startsWith('field:');
    rows.push({ text: '🧍 ' + r.name + '\n' + (inField ? rmTxt(r.rm) + (r.rm === rmCur ? ' (com você! monstros ×' + rmN + ')' : '') : whereTxt(r.w)), btn: inField && r.rm !== rmCur ? '➡ AJUDAR' : undefined, fn: inField && r.rm !== rmCur ? () => joinRoom(r.rm) : undefined });
  });
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
    else {
      const wx = walkGoal.x - pp0.x, wz = walkGoal.z - pp0.z, wd = Math.hypot(wx, wz);
      if (wd < 3.2) { const g0 = walkGoal; walkGoal = null; if (g0.plot) openPlotMenu(g0.plot); else if (g0.npc) openNpcMenu(g0.npc); }
      else if (!inCity) { dx = wx / wd; dz = wz / wd; }
      else {
        // na cidade o heroi contorna casas e predios: segue os pontos do caminho
        if (!walkGoal.path) { walkGoal.path = cityPath(pp0.x, pp0.z, walkGoal.x, walkGoal.z); walkGoal.stuck = 0; }
        let wp = walkGoal.path[0];
        while (wp && walkGoal.path.length > 1 && Math.hypot(wp.x - pp0.x, wp.z - pp0.z) < 1.3) { walkGoal.path.shift(); wp = walkGoal.path[0]; }
        const ax = wp.x - pp0.x, az = wp.z - pp0.z, ad = Math.hypot(ax, az) || 1;
        dx = ax / ad; dz = az / ad;
        // preso (ficou parado): recalcula o caminho
        if (walkGoal.lx !== undefined && Math.hypot(pp0.x - walkGoal.lx, pp0.z - walkGoal.lz) < 0.01) { if (++walkGoal.stuck > 20) { walkGoal.path = null; } } else walkGoal.stuck = 0;
        walkGoal.lx = pp0.x; walkGoal.lz = pp0.z;
      }
    }
  }
  // camera imersiva acompanha o rumo: empurrar para o lado (ou para frente e de lado) gira a visao nessa direcao
  if (lowCam() && !walkGoal) { const m0 = Math.hypot(dx, dz); if (m0 > 0.2) { const fwd = Math.max(0, -dz / m0); camYawT -= (dx / m0) * Math.min(1, m0) * (0.5 + 0.9 * fwd) * 1.7 * dt; } }
  { const ya = yawNow(); if (ya && !walkGoal) { const c = Math.cos(ya), s = Math.sin(ya), x = dx * c + dz * s, z = -dx * s + dz * c; dx = x; dz = z; } }
  const m = Math.hypot(dx, dz); if (m > 1) { dx /= m; dz /= m; }
  const p = player.position, bear = T < bearUntil;
  const gyNow = inCity ? 0 : walkY(p.x, p.z), wet = gyNow < -0.35 && !mounted;
  const spd = (wet ? 0.62 : 1) * PLAYER_SPEED * (1 + sk('swift') * 0.06) * (1 + Math.min(0.5, statSum('spd'))) * CLASSES[hero.cls].spd * (mounted ? petDef.speed : 1) * (1 + petPerk('spd')) * (bear ? 0.9 : 1);
  p.x = THREE.MathUtils.clamp(p.x + dx * spd * dt, -WORLD, WORLD);
  p.z = THREE.MathUtils.clamp(p.z + dz * spd * dt, -WORLD, WORLD);
  if (inHome && homeRoom) {
    const zmax = Math.abs(p.x) < 1.2 ? homeRoom.hd + 0.7 : homeRoom.hd - 0.6;
    p.x = THREE.MathUtils.clamp(p.x, -homeRoom.hw + 0.7, homeRoom.hw - 0.7); p.z = THREE.MathUtils.clamp(p.z, -homeRoom.hd + 0.8, zmax);
    if (p.z > homeRoom.hd + 0.35) { leaveHome(); return; }
  } else if (inCity) {
    pushOutCity(p, 0.6);
    const gate = Math.abs(p.x) < 5.2 && p.z > 0, r = Math.hypot(p.x, p.z), lim = CITY_R - 1.2;
    if (!gate && r > lim) { p.x *= lim / r; p.z *= lim / r; }
    if (p.z > CITY_R + 0.5) { setCityMode(false); return; }
  }

  if (cave) caveTick(p);

  // alvo
  let target = null, best = hero.range * (1 + sk('eagle') * 0.08);
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
  updateEqAura();
  tmpScale.setScalar(bear ? 1.6 : 1); player.scale.lerp(tmpScale, Math.min(1, dt * 12));

  if (inCity && city && !inHome) {
    nearNpc = city.update(dt, p);
    { const dd = city.districtAt(p.x, p.z), id = dd ? dd.id : ''; if (id !== curDistrict) { curDistrict = id; if (dd) toast(dd.icon + ' ' + dd.name); } }
    const tb = $('talk');
    if (nearNpc) { tb.style.display = 'block'; const t = '💬 ' + nearNpc.icon + ' ' + nearNpc.title.split(',')[0]; if (tb.textContent !== t) tb.textContent = t; } else tb.style.display = 'none';
  }
  mmT += dt; if (mmT > 0.1) { mmT = 0; if (!inHome && !cave) drawMap($('minimap')); }
  // passivos
  if (hero.cls === 'druid' && hp < maxHp) hp = Math.min(maxHp, hp + (2 + state.level * 0.15) * dt);
  if (hero.cls === 'sorcerer') overload = Math.max(0, overload - 6 * dt);
  if (shield > 0 && T > shieldUntil) shield = 0;
  if (sk('regen') && hp < maxHp) hp = Math.min(maxHp, hp + sk('regen') * 1.2 * dt);
  if (petPerk('regen') && hp < maxHp) hp = Math.min(maxHp, hp + maxHp * petPerk('regen') * dt);
  runSkills(dt);
  if (state.skillPts > 0 && !testing && !isPaused()) openSkillPicker();

  // inimigos
  enemies.forEach(e => {
    if (e.remote) {   // monstro compartilhado: so acompanha o anfitriao
      const ep = e.mesh.position, ddx = e.tx - ep.x, ddz = e.tz - ep.z, k = Math.min(1, dt * 10), mvd = Math.hypot(ddx, ddz);
      if (mvd > 12) { ep.x = e.tx; ep.z = e.tz; } else { ep.x += ddx * k; ep.z += ddz * k; }
      const gR = walkY(ep.x, ep.z); e.t += dt * 6; ep.y = e.mesh.userData.glb ? gR : gR + Math.abs(Math.sin(e.t)) * 0.25;
      e.mesh.rotation.y = mvd > 0.05 ? Math.atan2(ddx, ddz) : Math.atan2(p.x - ep.x, p.z - ep.z);
      if (e.mesh.userData.glb) animateHero(e.mesh, dt, { moving: mvd > 0.15, spd: 1 });
      if (e.flash > 0) { e.flash -= dt; const on = e.flash > 0; e.mesh.traverse(o => { if (o.isMesh && o.material.emissive) o.material.emissive.setHex(on ? 0xffffff : (e.elite ? 0x664400 : 0x000000)); }); }
      return;
    }
    e.stun = Math.max(0, e.stun - dt); e.slow = Math.max(0, e.slow - dt);
    const gE = walkY(e.mesh.position.x, e.mesh.position.z), sm = (e.stun > 0 ? 0 : (e.slow > 0 ? 0.4 : 1)) * (gE < -0.35 ? 0.7 : 1);
    const ep = e.mesh.position, tg = pickTarget(ep), vx = tg.x - ep.x, vz = tg.z - ep.z, d = Math.hypot(vx, vz) || 1;
    let mv = 1;
    if (e.ranged) {
      // atiradores: aproximam até o alcance, recuam se você chega perto, e atiram
      if (d > e.ranged.range) mv = 1; else if (d < e.ranged.keep) mv = -0.8; else mv = 0;
      if (sm > 0 && d < e.ranged.range + 2 && T > e.shotAt) { e.shotAt = T + e.ranged.cd * (0.85 + Math.random() * 0.3); enemyShoot(e, tg); }
    }
    let melee = !e.ranged, ux = vx / d, uz = vz / d, sp = 1;
    if (e.beh && sm > 0) { const o = behave(e, tg, vx, vz, d); mv = o.mv; melee = o.melee; sp = o.spd; if (o.dir) { ux = o.dir.x; uz = o.dir.z; } }
    ep.x = THREE.MathUtils.clamp(ep.x + ux * e.speed * sm * mv * sp * dt, -WORLD, WORLD); ep.z = THREE.MathUtils.clamp(ep.z + uz * e.speed * sm * mv * sp * dt, -WORLD, WORLD);
    if (cave) cave.clamp(ep, 0.5, false);
    e.t += dt * 6;
    if (e.mesh.userData.glb) { ep.y = gE; animateHero(e.mesh, dt, { moving: sm > 0 && mv !== 0 && (mv < 0 || d > e.radius + 0.4), spd: sm }); }
    else ep.y = gE + Math.abs(Math.sin(e.t)) * 0.25;
    e.mesh.rotation.y = Math.atan2(vx, vz);
    if (e.flash > 0) { e.flash -= dt; const on = e.flash > 0; e.mesh.traverse(o => { if (o.isMesh && o.material.emissive) o.material.emissive.setHex(on ? 0xffffff : (e.elite ? 0x664400 : 0x000000)); }); }
    if (melee && d < e.radius + 0.5) { if (tg.id) hurtRemote(e, tg.id); else hitPlayer(e); if (e.mesh.userData.glb && T > (e.atkAt || 0)) { e.atkAt = T + 1.0; playOnce(e.mesh, 'atk', 0.6); } }
  });
  updateDangers();
  enemies.forEach(e => { const ud = e.mesh.userData; if (ud && ud.spinG) ud.spinG.rotation.y = T * 1.6; if (ud && ud.tick) ud.tick(T); });
  for (let i = dying.length - 1; i >= 0; i--) { const dd = dying[i]; animateHero(dd.mesh, dt, {}); if (T >= dd.until) { scene.remove(dd.mesh); dying.splice(i, 1); } }

  // ataque automático
  if (target && T - lastShot > hero.rate / 1000 * (1 - sk('haste') * 0.09)) { lastShot = T; doAttack(target); }

  updateAllies(dt);
  updateWorld(dt);
  updateWB(dt);
  updateFishing(dt);
  updateWander(dt);

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
    const b = eshots[i]; if (!b) continue;   // (clearEnemies pode esvaziar a lista se o tiro matar o jogador)
    b.mesh.position.addScaledVector(b.dir, b.speed * dt); b.life -= dt; vfx.trail(b.mesh.position, b.color, 0.55);
    const hit = !b.vis && Math.hypot(b.mesh.position.x - p.x, b.mesh.position.z - p.z) < 0.8;
    if (hit) { hitPlayer({ dmg: b.dmg }); if (b.splash) ringFx(b.mesh.position, b.color, b.splash, 0.35); }
    let hitR = false;
    if (!b.vis && !hit && rmCur && rmN > 1) remotes.forEach(r => { if (!hitR && r.rm === rmCur && Math.hypot(b.mesh.position.x - r.x, b.mesh.position.z - r.z) < 0.9) { hitR = true; rl('hurt', { d: Math.round(b.dmg) }, r.id); if (b.splash) ringFx(b.mesh.position, b.color, b.splash, 0.35); } });
    if (hit || hitR || b.life <= 0) { scene.remove(b.mesh); b.mesh.material.dispose(); eshots.splice(i, 1); }
  }

  // projéteis
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.mesh.position.addScaledVector(b.dir, b.speed * dt); b.life -= dt;
    if (b.glow) b.glow.position.copy(b.mesh.position); vfx.trail(b.mesh.position, b.color, b.splash ? 0.7 : 0.5); if (b.kind === 'bolt' || b.pierce) vfx.trail(b.mesh.position, 0xffffff, 0.25);
    const hits = enemies.filter(e => !b.hit.has(e) && Math.hypot(e.mesh.position.x - b.mesh.position.x, e.mesh.position.z - b.mesh.position.z) < e.radius + 0.25);
    let remove = b.life <= 0;
    if (hits.length) {
      if (b.pierce) { hits.forEach(e => { b.hit.add(e); onBulletHit(b, e); }); }
      else { b.hit.add(hits[0]); onBulletHit(b, hits[0]); remove = true; }
    } else if (remove && b.splash) explode(b.mesh.position, b.splash, Math.round(b.dmg * 0.7), b.color);
    if (remove) { scene.remove(b.mesh); if (b.glow) scene.remove(b.glow); b.mesh.material.dispose(); bullets.splice(i, 1); }
  }

  // efeitos, zonas e temporizadores
  for (let i = effects.length - 1; i >= 0; i--) {
    const f = effects[i]; f.t += dt; const k = Math.min(1, f.t / f.dur);
    f.tick(k);
    if (k >= 1) { scene.remove(f.mesh); disposeObj(f.mesh); effects.splice(i, 1); if (f.end) f.end(); }
  }
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    for (let q = 0; q < 2; q++) { const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * z.r; vfx.emit(z.x + Math.cos(a) * rr, 14, z.z + Math.sin(a) * rr, 0, -30, 0, 0.45, 0.5, 0.12, 0xfff3a0, 1, 0, 0); }
    if (T >= z.next) { z.next = T + 0.4; for (let q = 0; q < 4; q++) { const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * z.r; vfx.burst({ x: z.x + Math.cos(a) * rr, z: z.z + Math.sin(a) * rr, y: 0 }, { color: 0xfff3a0, n: 5, speed: 3, size: 0.3, life: 0.35, y: 0.2 }); } enemies.slice().forEach(e => { if (Math.hypot(e.mesh.position.x - z.x, e.mesh.position.z - z.z) < z.r) damageEnemy(e, z.dmg); }); ringFx({ x: z.x + (Math.random() - 0.5) * z.r, z: z.z + (Math.random() - 0.5) * z.r }, 0xfff3a0, 0.8, 0.25); }
    if (T >= z.until) { scene.remove(z.ring); disposeObj(z.ring); zones.splice(i, 1); }
  }
  for (let i = timers.length - 1; i >= 0; i--) { if (T >= timers[i].at) { const f = timers[i].fn; timers.splice(i, 1); f(); } }

  spawnTimer += dt; if (spawnTimer > 1.1) { spawnTimer = 0; autoSpawn(); }

  const cd = Math.max(0, (skillReady[hero.id] || 0) - T);
  $('skill').style.opacity = cd > 0 ? 0.45 : 1; updateSkillLabel(false, cd);
  $('hpbar').style.width = Math.max(0, hp / maxHp * 100) + '%';
  { const tx = Math.max(0, Math.ceil(hp)) + '/' + Math.round(maxHp), el_ = $('hptxt'); if (el_._v !== tx) { el_._v = tx; el_.textContent = tx; }
    const mp_ = $('mpbar'), pc = cd > 0 ? Math.max(0, Math.min(100, (1 - cd / (ultLen[hero.id] || cd)) * 100)) : 100; mp_.style.width = pc + '%'; mp_.classList.toggle('full', cd <= 0); }
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
  const dcm = decor.on && homeRoom, cx = dcm ? 0 : p.x, cz = dcm ? 1.2 : p.z;
  camGy += ((dcm || inCity || inHome ? 0 : walkY(p.x, p.z)) - camGy) * Math.min(1, dt * 5);
  { const tg = new THREE.Vector3(cx, camGy, cz).add((dcm ? _co.copy(CAM_DECOR) : camOffset()).multiplyScalar(zoom));
    if ((inCity || cave) && !dcm) { const k = cave ? cave.camPull(cx, cz, tg.x, tg.y, tg.z) : camClear(cx, cz, tg.x, tg.y, tg.z); if (k < 1) { tg.x = cx + (tg.x - cx) * k; tg.y = camGy + 1.2 + (tg.y - camGy - 1.2) * k; tg.z = cz + (tg.z - cz) * k; } }
    camera.position.lerp(tg, Math.min(1, dt * (dcm ? 9 : inCity || cave ? 9 : 6))); }
  if (shake > 0) { shake -= dt; camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; }
  { const lc = lowCam(); camYaw += (camYawT - camYaw) * Math.min(1, dt * 8);
    const f = lc ? 62 : 50; if (Math.abs(camera.fov - f) > 0.05) { camera.fov += (f - camera.fov) * Math.min(1, dt * 5); camera.updateProjectionMatrix(); }
    if (lc) { const l = rotY(_co.copy(LOW_LOOK), camYaw); camera.lookAt(cx + l.x, camGy + l.y, cz + l.z); } else camera.lookAt(cx, camGy + (dcm ? 0 : 0.8), cz);
    if (!inCity && !inHome && !dcm && !cave) { const gc = groundH(camera.position.x, camera.position.z) + 1.4; if (camera.position.y < gc) camera.position.y = gc; }
    const rb = $('camrot'); if (rb) rb.style.display = lc ? 'flex' : 'none'; }
  farGroup.position.set(p.x, 0, p.z);
  ambient.setVisible(!inCity && !cave && !decor.on); if (!inCity && !cave) ambient.update(dt, p);
  sun.position.set(p.x + 10, 18, p.z + 7); sun.target.position.copy(p);
  vfx.update(dt, camera, renderer.domElement.height);
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
if (qs.get('mount')) { mounted = true; $('mount').innerHTML = '<span class="i">⬇</span><small>DESMONTAR</small>'; }
if (qs.get('team')) { const ids = qs.get('team').split(',').filter(id => HEROES.some(h => h.id === id)).slice(0, MAX_TEAM); if (ids.length) { state.owned = Array.from(new Set(state.owned.concat(ids))); state.team = ids; activeIdx = 0; setHero(); } }
if (qs.get('act')) { state.act = Math.min(ACTS.length - 1, +qs.get('act') || 0); applyAct(); refreshHud(); }
setPet(); renderSkillChips();
if (qs.get('skills')) { qs.get('skills').split(',').forEach(x => { const [k, v] = x.split(':'); state.skills[k] = +v || 1; }); renderSkillChips(); }
if (qs.has('levelup')) state.skillPts = 1;
if (qs.has('city')) setCityMode(true);
if (qs.has('at')) { const [ax, az] = qs.get('at').split(',').map(Number); if (!qs.has('city')) setCityMode(true); player.position.set(ax, 0, az); syncCam(); }
if (qs.has('night')) dayT = +qs.get('night') || 0;
if (qs.has('quests')) setTimeout(() => openQuests(), 1500);
if (qs.has('dbg')) window.__g = { craft, enterCave, caveTick, get cave() { return cave; }, state, useSkill, castSkill, get camYaw() { return camYaw; }, spawnEnemy, dangers, social, openQuests, state, giveItem, newItem, player, walkY, riverZ, riverHW, groundH, scene, terrain, ground, get inCity() { return inCity; }, enemies, get rm() { return { cur: rmCur, host: rmHost, n: rmN, me: netId, isHost: isHost() }; } };
if (qs.get('pos')) { const iv = setInterval(() => { if (!gameStarted) return; clearInterval(iv); setTimeout(() => { const [px, pz] = qs.get('pos').split(',').map(Number); if (inCity) setCityMode(false); player.position.set(px || 0, 0, pz || 0); playerGy = walkY(px || 0, pz || 0); }, 600); }, 300); }
if (qs.get('cam') === 'low') { camMode = 'low'; $('camb').querySelector('small').textContent = 'IMERSIVA'; }
if (qs.has('yaw')) { camYaw = camYawT = +qs.get('yaw'); }
if (qs.has('zoom')) { setZoom(+qs.get('zoom')); zoom = zoomT; }
if (qs.has('fly')) { zoomT = zoom = +qs.get('fly'); }
if (qs.has('eq')) { setTimeout(() => openInv('eq'), 300); }
if (qs.has('bag')) { setTimeout(() => { openInv('bag'); const x = state.items.find(i => !isEquipped(i)); invSel = x && x.uid; renderInv(); }, 300); }
if (qs.has('citymap')) { setTimeout(() => openCityMap(), 300); }
if (qs.has('loot')) { for (let i = 0; i < 12; i++) giveItem(newItem(SLOT_ORDER[i % 8], i % 3, i % 4, mainCls())); state.gold = 900; state.mats[0] = 7; }
if (qs.get('npc')) { setCityMode(true); openNpc(city.npcs.find(n => n.role === qs.get('npc'))); }
if (qs.has('home')) {
  state.gold = 99999; setCityMode(true); const hp_ = PLOTS[+qs.get('home') || 0]; state.homes[hp_.id] = state.homes[hp_.id] || { furn: [{ k: 'bed', x: -3, z: -4, r: 0 }, { k: 'sofa', x: 2, z: 1, r: 0 }, { k: 'table', x: 5, z: -3, r: 0, fl: 1 }], sz: +qs.get('homesz') || 0, fls: +qs.get('homefl') || 1 }; refreshPlots();
  if (qs.has('plotview')) { player.position.set(hp_.door[0], 0, hp_.door[1] + 6); syncCam(); } else {
  enterHome(hp_); if (qs.has('furn')) ['bed', 'sofa', 'table', 'shelf', 'rug', 'plant', 'fireplace', 'painting'].forEach((k, i) => addFurn({ k, x: -4 + (i % 4) * 2.6, z: -3 + Math.floor(i / 4) * 3.4, r: 0 }));
  if (qs.has('decor')) toggleDecor(true); }
}
if (qs.has('visit')) setTimeout(() => { setCityMode(true); net && net.send({ t: 'visit', plot: PLOTS[+qs.get('visit') || 0].id }); }, 3500);
if (qs.get('edge')) { player.position.set(+qs.get('edge') - 0, 0, 0); }
camera.position.copy(player.position).add(camOffset().multiplyScalar(zoom));

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
  state.team = ['player']; if (!state.profs) state.profs = {};
  if (!state.profOwned || !state.profOwned.length) state.profOwned = [custom.cls];
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
  gameStarted = true; biomeNotify = true;
  if (!testing) {
    social.startPolls(); setTimeout(() => checkRent(), 3000); setInterval(() => checkRent(true), 300000);
    const og = offlineGain(state);
    if (og) { state.gold += og.gold; state.lastSeen = Date.now(); save(state); refreshHud(); setTimeout(() => toast('💤 Enquanto você estava fora (' + (og.mins >= 60 ? Math.floor(og.mins / 60) + 'h' + (og.mins % 60 ? ' ' + og.mins % 60 + 'min' : '') : og.mins + ' min') + '), seu personagem juntou 🪙' + og.gold), 1500); }
    if (!loginState(state).got) setTimeout(() => toast('🎁 Recompensa de login disponível! Abra 📜 MISSÕES'), og ? 5000 : 2000);
  }
  const goCity = !testing && !['pos', 'at', 'act', 'city', 'npc', 'home', 'visit'].some(k => qs.has(k));
  if (goCity) setCityMode(true, CITY_CENTER);   // sempre comeca no centro da cidade
  if (!state.seen.intro) { state.seen.intro = 1; save(state); showDialog(INTRO.concat(ACTS[0].intro)); }
  else if (!goCity && state.stage === 5 && !state.endless && !bossRef) spawnBoss();
}

if (qs.has('nocreator') && !state.custom) { state.account = 'Teste'; applyCustom(Object.assign({}, PREMADE[Number(qs.get('nocreator')) || 0], qs.get('ai') ? { model: qs.get('ai') } : {})); setHero(); }

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
    for (const md of ['upgrade', 'buy', 'sell']) { openGear('t', SLOT_ORDER, md, null); closePanel(); } openProfile(); closePanel(); openInv('eq'); renderInv(); invSel = state.items[0].uid; renderInv(); bagFilter = 'helm'; renderInv(); invMode = 'bag'; renderInv(); invMode = 'eq'; bagFilter = 'all'; const spare = newItem('helm', 0, 0); state.items.push(spare); invSel = spare.uid; renderInv(); closeInv(); invSel = null; openMap(); closePanel(); openCityMap(); closePanel(); renderEquipBox(); toggleInv("eq"); toggleInv("eq"); handleTap(215, 450); player.position.set(city.npcs[0].pos[0], 0, city.npcs[0].pos[1] + 20); walkTo(city.npcs[0]); for (let i = 0; i < 200 && walkGoal; i++) update(0.05); if (!panelOpen) throw new Error('NPC nao abriu menu ao chegar'); closePanel();
    if (!(calcMaxHp() > hp0 && atkPower() > at0)) throw new Error('equipamento nao aumentou status');
    // morte na floresta leva de volta a cidade
    setCityMode(false); clearEnemies(); hp = 1; maxHp = Math.max(maxHp, 10); hitPlayer({ dmg: 1e6 }); for (let i = 0; i < 40; i++) update(0.05); if (!inCity) throw new Error('morte nao levou a cidade'); setCityMode(false); if (inCity) throw new Error('nao voltou');
    state.gold = 1e6;
    // casas: comprar, entrar, mobiliar, sair
    { const pl = PLOTS[0], pa = PLOTS.find(x => x.kind === 'apt'); state.gold = 1e6; state.homes = {};
      openPlotMenu(pl); closePanel(); openPlotMenu(pa); closePanel();
      for (const q of [pl, pa]) {
        state.homes[q.id] = { furn: [] }; refreshPlots(); enterHome(q); toggleDecor(true);
        FURN.forEach(f => { if (f.prem) state.stock[f.k] = 1; }); for (const f of FURN) buyFurn(f); decor.sel = homeRoom.items[0]; rotFurn(); placeFurn(decor.sel, 99, 99); homeSave(); renderDecor();
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
      { // andar ate casas e NPCs de longe: tem que chegar sem atravessar predios
        const goals = [...PLOTS.filter((_, i) => i % 7 === 3).slice(0, 8).map(p => ({ x: p.door[0], z: p.door[1], plot: p })), ...city.npcs.map(n => ({ x: n.pos[0], z: n.pos[1], npc: n }))];
        let worst = 0, fails = [];
        goals.forEach((g, gi) => {   // o caminho planejado nao pode cruzar nenhum solido
          const pts = [{ x: CITY_SPAWN[0], z: CITY_SPAWN[1] }, ...cityPath(CITY_SPAWN[0], CITY_SPAWN[1], g.x, g.z)];
          for (let k = 1; k < pts.length; k++) for (let t = 0; t <= 1; t += 0.05) { const q = { x: pts[k - 1].x + (pts[k].x - pts[k - 1].x) * t, z: pts[k - 1].z + (pts[k].z - pts[k - 1].z) * t }, q0 = { x: q.x, z: q.z }; pushOutCity(q, 0.5); worst = Math.max(worst, Math.hypot(q.x - q0.x, q.z - q0.z)); }
        });
        goals.forEach((g, gi) => {
          player.position.set(gi % 2 ? 0 : CITY_SPAWN[0], 0, CITY_SPAWN[1] - (gi % 3) * 3); walkGoal = Object.assign({}, g); let n = 0;
          for (; n < 3000 && walkGoal; n++) { update(0.05); const q = { x: player.position.x, z: player.position.z }; pushOutCity(q, 0.55); worst = Math.max(worst, Math.hypot(q.x - player.position.x, q.z - player.position.z)); }
          if (walkGoal) fails.push((g.plot ? g.plot.id : g.npc.role) + '@' + Math.round(player.position.x) + ',' + Math.round(player.position.z)); walkGoal = null; closePanel();
        });
        if (fails.length) throw new Error('nao chegou: ' + fails.join(' ')); if (worst > 0.1) throw new Error('atravessou predio: ' + worst.toFixed(2));
      }
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
    const gi = newItem('weapon', 1, 2, 'warrior'); state.items.push(gi); gi.gems = [{ t: 'ruby', l: 3 }]; equipItem(gi); if (statSum('atk') < 0.1) throw new Error('gema nao somou');
    state.maxAct = 5; ensureMeta(state).dgUsed = 0; enterDungeon(); if (!dg) throw new Error('masmorra');
    { let g = 0; hp = 1e9; maxHp = 1e9; while (dg && g++ < 800) { enemies.slice().forEach(e => damageEnemy(e, 1e9)); autoSpawn(); autoSpawn(); } if (dg) throw new Error('masmorra nao terminou: andar ' + dg.floor); }
    if (!(state.meta.cnt.dungeon >= 1)) throw new Error('masmorra nao contou'); for (let i = 0; i < 80; i++) update(0.05); setCityMode(false);
    fishing = { st: 'bite', t: 1 }; const f0 = state.meta.cnt.fish || 0; catchFish(); if ((state.meta.cnt.fish || 0) !== f0 + 1) throw new Error('pesca');
    craft.giveGem('topaz', 1); craft.giveGem('topaz', 1); craft.giveGem('topaz', 1); craft.openCraft(null); craft.openGems(null); craft.openSocket(null, gi); craft.openForge(null, 'weapon');
    { const w0 = newItem('helm', 2, 0, 'warrior'); state.items.push(w0); state.equip.helm = w0.uid;
      for (let k = 0; k < 3; k++) state.items.push(newItem('helm', 2, 0, 'warrior'));
      state.gold += 99999; state.mats[2] = 99; const n0 = state.items.length;
      craft.openEquipUp(null, SLOT_ORDER); craft.openEquipUp(null, SLOT_ORDER, 'helm');
      const evb = [...document.querySelectorAll('#card button')].find(b => b.textContent === 'EVOLUIR'); if (!evb || evb.disabled) throw new Error('evoluir indisponivel');
      evb.click(); if (w0.tier !== 3 || state.items.length !== n0 - 3) throw new Error('evolucao falhou ' + w0.tier + ' ' + state.items.length);
      craft.openEquipUp(null, SLOT_ORDER, 'helm'); out.push('melhorar equipamento: ok'); }
    out.push('ofício/gemas/masmorra/pesca: ok');
    // passe, loja, imoveis, mercador
    state.gems = 5000; state.gold = 1e6; shop.passXp('boss', 40); if (!(state.pass.xp >= 1200)) throw new Error('passe xp'); shop.openPass(null); shop.openCosmetics(null); shop.openGemPacks(null);
    FURN.filter(f => f.prem).forEach(f => { const m = makeFurniture(f.k); if (!m.children.length) throw new Error('movel premium ' + f.k); });
    const AP = PLOTS.filter(x => x.kind === 'apt'); state.gold = 0; state.homes[AP[0].id] = { furn: [{ k: 'bed', x: 0, z: 0, r: 0 }], paid: Date.now() - 5 * 864e5 }; checkRent(true); if (state.homes[AP[0].id]) throw new Error('aluguel atrasado nao perdeu'); state.gold = 1e6; 
    state.homes[AP[1].id] = { furn: [], paid: Date.now() - 1000 }; const gg0 = state.gold; checkRent(true); if (!(state.gold < gg0)) throw new Error('aluguel nao debitou'); delete state.homes[AP[1].id];
    if (!(homeBonus().atk >= 0)) throw new Error('bonus casa'); spawnWander(); if (!wander) throw new Error('mercador'); openWanderShop(); dropWander();
    out.push('passe/loja/imoveis/mercador: ok');
    out.push('missoes/conquistas/login/eventos/clima/baus/emotes: ok (conquistas=' + Object.keys(state.meta.ach).length + ')');
    // vocacoes: cada classe guarda o proprio nivel/habilidades
    { const c0 = mainCls(), other = Object.keys(CLASSES).find(c => c !== c0); state.level = 7; state.skills = { might: 2 }; state.profOwned = [c0, other]; state.profs = {};
      profReady = 0; changeProf(other); if (state.level !== 1 || Object.keys(state.skills).length || mainCls() !== other || hero.cls !== other) throw new Error('vocacao nova nao comecou do zero');
      state.level = 3; profReady = 0; changeProf(c0); if (state.level !== 7 || state.skills.might !== 2) throw new Error('vocacao nao restaurou o progresso');
      profReady = 0; changeProf(other); if (state.level !== 3) throw new Error('segunda vocacao perdeu o progresso'); profReady = 0; changeProf(c0); openProfs(); closePanel(); }
    out.push('vocacoes: ok');
    // ULTs evoluidas (nivel 50 e 100) de todas as classes
    { const cls0 = hero.cls, lv0 = state.level; spawnEnemy(false); spawnEnemy(false);
      for (const c of Object.keys(CLASSES)) for (const lv of [1, 50, 100]) {
        hero.cls = c; state.level = lv; skillReady[hero.id] = 0; invuln = 0; shield = 0; bearUntil = 0;
        if (ultTier() !== (lv >= 100 ? 2 : lv >= 50 ? 1 : 0)) throw new Error('ultTier ' + c + lv);
        useSkill(); if (!(skillReady[hero.id] > T)) throw new Error('ult nao disparou ' + c + lv);
        if (lv >= 50 && ultName() === CLASSES[c].ult) throw new Error('ult sem nome evoluido ' + c);
        timers.splice(0).forEach(t => t.fn()); updateSkillLabel(true, 0);
      }
      hero.cls = cls0; state.level = lv0; skillReady[hero.id] = 0; bearUntil = 0; }
    out.push('ults evoluidas (7 classes x nv1/50/100): ok');
    // caverna do chefe: caminho fechado, ondas, chefe e volta para a cidade
    { state.maxAct = 5; const mm = ensureMeta(state); hp = 1e9; maxHp = 1e9;
      for (const ai of [0, 3, 5]) {
        dgLeft(); mm.cvUsed = 0; if (!inCity) setCityMode(true); enterCave(ai);
        if (!cave || !dg || !dg.cave || inCity) throw new Error('caverna nao abriu ' + ai);
        player.position.set(cave.start.x + 60, 0, cave.start.z); caveTick(player.position);
        if (!(cave.nearest(player.position.x, player.position.z).d <= cave.hw + 0.01)) throw new Error('parede da caverna nao segurou');
        for (let j = 0; j < cave.pts.length; j += 3) { player.position.set(cave.pts[j].x, 0, cave.pts[j].z); update(0.02); }
        if (!cave.stations.every(st => st.done)) throw new Error('ondas da caverna nao dispararam');
        if (!(enemies.length > 0)) throw new Error('sem monstros na caverna');
        enemies.forEach(e => { const q = { x: e.mesh.position.x, z: e.mesh.position.z }; cave.clamp(q, 0.4, false); if (Math.hypot(q.x - e.mesh.position.x, q.z - e.mesh.position.z) > 3) throw new Error('monstro fora da caverna'); });
        player.position.set(cave.arena.x, 0, cave.arena.z + 12); update(0.02);
        if (!bossRef || !cave.sealed) throw new Error('chefe da caverna nao acordou');
        if (bossRealm() !== ACTS[ai].realm) throw new Error('chefe do reino errado');
        const gold0 = state.gold; enemies.slice().forEach(e => damageEnemy(e, 1e12));
        if (dg) throw new Error('caverna nao terminou'); timers.splice(0).forEach(t => t.fn());
        if (!inCity || cave || !(state.gold > gold0)) throw new Error('nao voltou para a cidade com premio');
      } }
    out.push('cavernas dos chefes (3 reinos: caminho, ondas, chefe, volta): ok');
    // botao de teleporte para a casa
    { const pl = PLOTS.find(x => x.kind === 'house'); delete state.homes[pl.id]; setCityMode(true); refreshHud(); const hb = $('homebtn'); if (hb.style.display !== 'none') throw new Error('botao casa sem casa');
      state.homes[pl.id] = { furn: [], sz: 0, fls: 1 }; refreshHud(); if (hb.style.display === 'none') throw new Error('botao casa nao apareceu');
      hb.dispatchEvent(new Event('pointerdown')); if (!inHome) throw new Error('botao casa nao teleportou'); leaveHome(); delete state.homes[pl.id]; refreshHud(); }
    out.push('botao teleporte para casa: ok');
    // hordas por estagio: todos os tipos existem, nascem e variam entre estagios
    { const act0 = state.act, st0 = state.stage; let n = 0;
      for (let a = 0; a < ACTS.length; a++) { const realm = ACTS[a].realm, seen = [];
        for (let st = 1; st <= 5; st++) { const w = hordeWeights(realm, st, a); seen.push(Object.keys(w).filter(k => w[k] > 0).sort().join(','));
          for (const k in w) if (w[k] > 0) { if (!ETYPES[k]) throw new Error('tipo inexistente ' + k); const e = spawnEnemy(false, null, k); if (!e || !e.mesh) throw new Error('nao nasceu ' + k); n++; } }
        if (new Set(seen.slice(0, 4)).size < 4) throw new Error('estagios 1-4 repetem monstros em ' + realm);
        if (seen[0].includes('crab') || !/minion/.test(seen[0])) throw new Error('estagio 1 nao e de esqueletos em ' + realm); }
      clearEnemies(); state.act = act0; state.stage = st0; applyAct(); out.push('hordas por estagio (6 reinos x 5 estagios, ' + n + ' monstros): ok'); }

    // casa ampliada e andares
    { const pl = PLOTS.find(x => x.kind === 'house'); state.homes[pl.id] = { furn: [], sz: 0, fls: 1 }; enterHome(pl); const hw0 = homeRoom.hw; leaveHome();
      state.homes[pl.id].sz = 2; state.homes[pl.id].fls = 2; enterHome(pl); if (!(homeRoom.hw > hw0) || homeRoom.fls !== 2) throw new Error('casa nao ampliou');
      state.stock.bed = 1; buyFurn(furnByKey('bed')); showFloor(1, true); buyFurn(furnByKey('table')); if (!homeRoom.items.find(m => m.userData.k === 'table').visible) throw new Error('movel do andar 2 invisivel');
      if (homeRoom.items.find(m => m.userData.k === 'bed').visible) throw new Error('movel do andar 1 aparece no 2'); homeSave(); leaveHome();
      enterHome(pl); if (homeRoom.items.length !== 2) throw new Error('moveis por andar nao salvaram'); toggleDecor(true); if (!(zoomT > 2.5)) throw new Error('camera de decoracao'); toggleDecor(false); openHomeUp(pl); closePanel(); leaveHome(); }
    out.push('casas ampliadas/andares: ok');
    // cenarios por setor
    { ACTS.forEach((a, i) => { state.act = i; applyAct(); }); state.act = 0; state.stage = 1; applyAct(); }
    out.push('cenarios: ok');
    for (let i = 0; i < 120; i++) update(0.05);
    out.push('SELFTEST OK');
  } catch (err) { out.push('ERRO: ' + err.message + '\n' + (err.stack || '')); }
  document.title = out[out.length - 1].startsWith('SELFTEST OK') ? 'SELFTEST OK' : 'SELFTEST FAIL';
  const pre = document.createElement('pre'); pre.id = 'selftest'; pre.textContent = out.join('\n');
  pre.style.cssText = 'position:fixed;inset:0;z-index:999;background:#000;color:#0f0;font:12px monospace;padding:10px;white-space:pre-wrap;overflow:auto';
  document.body.appendChild(pre);
}
