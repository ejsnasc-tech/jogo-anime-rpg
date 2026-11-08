// Personagens e inimigos 3D com esqueleto e animações (modelos KayKit, licença CC0).
// Se os modelos não carregarem, cai para o boneco simples feito por código.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CLASS_MODELS } from './data.js';
import { makeHeroProcedural } from './models.js';
import { decorate, addOutline } from './looks.js';

const BASE = (import.meta.env && import.meta.env.BASE_URL) || './';
const FILES = {
  Knight: 'models/chars/Knight.glb', Barbarian: 'models/chars/Barbarian.glb', Mage: 'models/chars/Mage.glb',
  Rogue: 'models/chars/Rogue.glb', Rogue_Hooded: 'models/chars/Rogue_Hooded.glb',
  Skeleton_Minion: 'models/enemies/Skeleton_Minion.glb', Skeleton_Warrior: 'models/enemies/Skeleton_Warrior.glb',
  Skeleton_Mage: 'models/enemies/Skeleton_Mage.glb', Skeleton_Rogue: 'models/enemies/Skeleton_Rogue.glb',
};
const loaded = {};
const HERO_HEIGHT = 2.1;

// tamanho/posição da cabeça (no referencial do osso) para encaixar cabelo, rosto e acessórios
function headInfo(scene) {
  try {
    const bone = scene.getObjectByName('head'), hips = scene.getObjectByName('hips'); let hm = null;
    scene.traverse(o => { if (o.isSkinnedMesh && /head/i.test(o.name) && !hm) hm = o; });
    if (!bone || !hm) return null;
    hm.geometry.computeBoundingBox(); const box = hm.geometry.boundingBox.clone().applyMatrix4(hm.matrixWorld), sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const inv = bone.matrixWorld.clone().invert();
    const out = { hb: { w: sz.x, h: sz.y, d: sz.z }, headM: inv.multiply(new THREE.Matrix4().makeTranslation(c.x, c.y, c.z)) };
    if (hips) { out.hipsM = hips.matrixWorld.clone().invert().multiply(new THREE.Matrix4().makeTranslation(hips.getWorldPosition(new THREE.Vector3()).x, hips.getWorldPosition(new THREE.Vector3()).y, hips.getWorldPosition(new THREE.Vector3()).z)); }
    return out;
  } catch (e) { return null; }
}
export const modelsLoaded = () => Object.keys(loaded).length > 0;

export function preloadModels(onProgress) {
  const loader = new GLTFLoader(), names = Object.keys(FILES); let done = 0;
  const tick = () => { done++; if (onProgress) onProgress(done / names.length); };
  return Promise.all(names.map(n => new Promise((res) => {
    loader.load(BASE + FILES[n], (gltf) => {
      let mat = null;
      gltf.scene.traverse(o => { if (o.isMesh && !mat) mat = o.material; });
      gltf.scene.updateMatrixWorld(true);
      const box = new THREE.Box3();
      gltf.scene.traverse(o => { if (o.isSkinnedMesh) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
      const h = box.isEmpty() ? 1.8 : Math.max(0.5, box.max.y - box.min.y);
      loaded[n] = { scene: gltf.scene, clips: gltf.animations, mat, img: mat && mat.map ? mat.map.image : null, height: h, head: headInfo(gltf.scene) };
      tick(); res();
    }, undefined, (err) => { console.warn('modelo nao carregou:', n, err); tick(); res(); });
  })));
}

// ---- recolor pela paleta (cada parte do modelo aponta para quadradinhos de cor da textura) ----
const CELLS = {
  Knight:       { skin: [[0, 0]],         hair: [[1, 0]], outfit: [[3, 0], [7, 0], [2, 1]], cape: [[0, 1]] },
  Barbarian:    { skin: [[0, 0]],         hair: [[1, 0]], outfit: [[0, 1]],                 cape: [[7, 0]] },
  Mage:         { skin: [[0, 0], [7, 2]], hair: [[1, 0]], outfit: [[0, 1], [1, 1]],         cape: [[2, 1]] },
  Rogue:        { skin: [[0, 0]],         hair: [[1, 0]], outfit: [[0, 1]],                 cape: [[1, 1]] },
  Rogue_Hooded: { skin: [[0, 0]],         hair: [[1, 0]], outfit: [[0, 1]],                 cape: [[1, 1]] },
};
const PROP_NODES = {
  Knight: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword'],
  Barbarian: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug'],
  Mage: ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'],
  Rogue: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'],
  Rogue_Hooded: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'],
};
const HEADGEAR = ['Knight_Helmet', 'Mage_Hat', 'Barbarian_Hat'];
const PROPS = {
  warrior:  { Knight: ['1H_Sword', 'Round_Shield'], Barbarian: ['1H_Axe', 'Barbarian_Round_Shield'] },
  paladin:  { Knight: ['1H_Sword', 'Badge_Shield'] },
  assassin: { Rogue_Hooded: ['Knife', 'Knife_Offhand'], Rogue: ['Knife', 'Knife_Offhand'] },
  archer:   { Rogue: ['2H_Crossbow'], Rogue_Hooded: ['2H_Crossbow'] },
  mage:     { Mage: ['2H_Staff'] },
  sorcerer: { Mage: ['1H_Wand', 'Spellbook'] },
  druid:    { Mage: ['2H_Staff'] },
};
const ANIM = {
  warrior:  { idle: 'Idle', run: 'Running_A', atk: '1H_Melee_Attack_Slice_Horizontal', ult: '2H_Melee_Attack_Spin' },
  paladin:  { idle: 'Idle', run: 'Running_A', atk: '1H_Melee_Attack_Chop',            ult: 'Spellcast_Raise' },
  assassin: { idle: 'Idle', run: 'Running_B', atk: 'Dualwield_Melee_Attack_Slice',    ult: 'Dualwield_Melee_Attack_Chop' },
  archer:   { idle: '2H_Ranged_Aiming', run: 'Running_A', atk: '2H_Ranged_Shoot',    ult: '2H_Ranged_Shooting' },
  mage:     { idle: 'Idle', run: 'Running_A', atk: 'Spellcast_Shoot',                 ult: 'Spellcast_Long' },
  sorcerer: { idle: 'Idle', run: 'Running_A', atk: 'Spellcast_Raise',                 ult: 'Spellcasting' },
  druid:    { idle: 'Idle', run: 'Running_A', atk: 'Spellcast_Shoot',                 ult: 'Cheer' },
};

const matCache = new Map();
function recolorMaterial(key, def) {
  const k = [key, def.skin, def.hairColor, def.outfit, def.color].join('|');
  if (matCache.has(k)) return matCache.get(k);
  const L = loaded[key], cm = CELLS[key];
  let map = L.mat.map;
  if (L.img && cm) {
    const c = document.createElement('canvas'); c.width = L.img.width; c.height = L.img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(L.img, 0, 0);
    const cw = c.width / 8, ch = c.height / 4;
    const paint = (cells, hex) => {
      if (hex == null || !cells) return;
      const tr = (hex >> 16) & 255, tg = (hex >> 8) & 255, tb = hex & 255;
      cells.forEach(([cx, cy]) => {
        const x = Math.floor(cx * cw), y = Math.floor(cy * ch), id = ctx.getImageData(x, y, Math.floor(cw), Math.floor(ch)), d = id.data;
        let sum = 0; for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const mean = sum / (d.length / 4) || 1;
        for (let i = 0; i < d.length; i += 4) {
          const f = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / mean;   // mantém o degradê de sombra
          d[i] = Math.min(255, tr * f); d[i + 1] = Math.min(255, tg * f); d[i + 2] = Math.min(255, tb * f);
        }
        ctx.putImageData(id, x, y);
      });
    };
    paint(cm.skin, def.skin); paint(cm.hair, def.hairColor); paint(cm.outfit, def.outfit); paint(cm.cape, def.color);
    map = new THREE.CanvasTexture(c); map.flipY = false; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  }
  const m = L.mat.clone(); m.map = map; matCache.set(k, m); return m;
}

const newUserData = (clips, anim, extra) => Object.assign({ glb: true, mixer: null, clips, actions: {}, cur: null, curAction: null, shot: null, shotEnd: 0, t: 0, dead: false, anim }, extra || {});

// ---- heróis ----
export function makeHero(def) {
  const wanted = def.model && loaded[def.model] ? def.model : (CLASS_MODELS[def.cls] || CLASS_MODELS.warrior)[0][0];
  const L = loaded[wanted];
  if (!L) return makeHeroProcedural(def);
  const key = wanted, root = skClone(L.scene), g = new THREE.Group();
  g.add(root); root.scale.setScalar(HERO_HEIGHT / L.height);
  const keep = (PROPS[def.cls] && PROPS[def.cls][key]) || [], propSet = PROP_NODES[key] || [];
  root.traverse(o => { if (propSet.includes(o.name)) o.visible = keep.includes(o.name); if (HEADGEAR.includes(o.name)) o.visible = def.hat !== false; });
  const mat = recolorMaterial(key, def);
  root.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = true; o.frustumCulled = false; } });
  if (def.hairStyle !== undefined) {
    let gear = false; root.traverse(o => { if (HEADGEAR.includes(o.name) && o.visible) gear = true; });
    try { decorate(root, L, def, gear || key === 'Rogue_Hooded'); addOutline(root); } catch (e) { console.warn('visual anime falhou', e); }
  }
  g.userData = newUserData(L.clips, ANIM[def.cls] || ANIM.warrior);
  g.userData.mixer = new THREE.AnimationMixer(root);
  if (def.cls === 'paladin') {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 8, 28), new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffd166, emissiveIntensity: 1 }));
    halo.rotation.x = Math.PI / 2; halo.position.y = HERO_HEIGHT + 0.25; g.add(halo); g.userData.halo = halo;
  }
  if (def.cls === 'sorcerer') {
    const orbs = new THREE.Group(); orbs.position.y = 1.2;
    for (let i = 0; i < 3; i++) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.9 })); const a = i / 3 * Math.PI * 2; o.position.set(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9); orbs.add(o); }
    g.add(orbs); g.userData.orbs = orbs;
  }
  setLoco(g.userData, 'idle', 1);
  return g;
}

// ---- inimigos (esqueletos) ----
export function makeSkeleton(kind, tint, boss, o) {
  o = o || {};
  const L = loaded[kind]; if (!L) return null;
  const root = skClone(L.scene), g = new THREE.Group(); g.add(root);
  root.scale.setScalar((boss ? 4.2 : (o.size || (kind === 'Skeleton_Warrior' ? 1.9 : 1.6))) / L.height);
  const mat = L.mat.clone(); if (tint != null) mat.color.setHex(tint);
  root.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = true; o.frustumCulled = false; } });
  g.userData = newUserData(L.clips, { idle: 'Idle_Combat', run: o.run || 'Walking_A', atk: o.atk || '1H_Melee_Attack_Chop', ult: 'Idle' }, { enemy: true });
  g.userData.mixer = new THREE.AnimationMixer(root);
  setLoco(g.userData, 'run', 1);
  if (g.userData.curAction) g.userData.curAction.time = Math.random() * 1.0;
  return g;
}

// ---- animação ----
function clipAction(u, name) {
  if (!(name in u.actions)) { const clip = u.clips.find(c => c.name === name); u.actions[name] = clip ? u.mixer.clipAction(clip) : null; }
  return u.actions[name];
}
function setLoco(u, want, spd) {
  const names = { idle: u.anim.idle, run: u.anim.run, sit: 'Sit_Chair_Idle' };
  const next = clipAction(u, names[want]) || clipAction(u, 'Idle');
  if (!next) return;
  next.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.15).play();
  if (u.curAction && u.curAction !== next) u.curAction.fadeOut(0.15);
  u.curAction = next; u.cur = want;
}

// o: { moving, mounted, spd }
export function animateHero(g, dt, o) {
  const u = g.userData; o = o || {};
  if (!u.glb) return animateProcedural(g, dt, o);
  if (u.dead) { u.mixer.update(dt); return; }
  u.t += dt;
  if (u.shot && u.t >= u.shotEnd) { u.shot.fadeOut(0.12); u.shot = null; u.cur = null; }
  const want = o.mounted ? 'sit' : (o.moving ? 'run' : 'idle');
  if (!u.shot && u.cur !== want) setLoco(u, want, o.spd || 1);
  if (u.cur === 'run' && u.curAction) u.curAction.timeScale = 0.8 + 0.5 * (o.spd || 1);
  if (u.orbs) u.orbs.rotation.y += dt * 2.5;
  if (u.halo) u.halo.rotation.z += dt * 2;
  u.mixer.update(dt);
}

// which: 'atk' | 'ult' | 'hit' | 'death' | nome de clipe; dur = duração desejada em segundos
export function playOnce(g, which, dur) {
  const u = g.userData;
  if (!u.glb) { if (which === 'atk') g.scale.set(1.12, 0.92, 1.12); return; }
  if (u.dead || (which === 'hit' && u.shot)) return;
  const name = which === 'atk' ? u.anim.atk : which === 'ult' ? u.anim.ult : which === 'hit' ? 'Hit_A' : which === 'death' ? 'Death_A' : which;
  const a = clipAction(u, name); if (!a) return;
  const cd = a.getClip().duration, ts = dur ? Math.max(0.6, Math.min(3, cd / dur)) : 1;
  if (u.shot && u.shot !== a) u.shot.fadeOut(0.05);
  if (u.curAction) u.curAction.fadeOut(0.08);
  a.reset().setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = ts; a.fadeIn(0.06).play();
  u.shot = a; u.shotEnd = u.t + cd / ts; u.cur = null;
  if (which === 'death') u.dead = true;
}

// fallback do boneco simples
function animateProcedural(g, dt, o) {
  const u = g.userData; if (!u.legL) return;
  u.wt = (u.wt || 0) + dt * (o.moving ? 12 : 0); u.at = (u.at || 0) + dt;
  const sw = o.moving ? Math.sin(u.wt) * 0.7 : 0;
  u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = -sw; u.armR.rotation.x = sw;
  if (o.mounted) u.legL.rotation.x = u.legR.rotation.x = -1.2;
  u.cape.rotation.x = 0.12 + (o.mounted ? 0.3 : 0) + (o.moving ? 0.35 + Math.sin(u.wt * 0.5) * 0.15 : Math.sin(u.at * 2) * 0.04);
  if (u.orbs) u.orbs.rotation.y += dt * 2.5;
  if (u.halo) u.halo.rotation.z += dt * 2;
  g.userData.bob = o.moving ? Math.abs(Math.sin(u.wt)) * 0.08 : 0;
}
