// Personagem estilo anime/chibi: corpo, cabeça, rosto, cabelo e roupas suaves (sombreamento "toon" + contorno)
// encaixados nos ossos do esqueleto KayKit (as animações continuam as mesmas).
import * as THREE from 'three';

export const SEXES = [['m', '👨 Homem'], ['f', '👩 Mulher']];
export const BUILDS = [['slim', 'Magro'], ['normal', 'Normal'], ['strong', 'Forte'], ['chubby', 'Gordinho']];
export const HEIGHTS = [['short', 'Baixo'], ['mid', 'Médio'], ['tall', 'Alto']];
export const HAIR_STYLES = [['short', 'Curto'], ['spiky', 'Espetado'], ['undercut', 'Topete'], ['slick', 'Para trás'], ['shaggy', 'Desgrenhado'], ['topknot', 'Samurai'], ['afro', 'Black power'], ['mohawk', 'Moicano'], ['bald', 'Careca'], ['long', 'Longo'], ['wavy', 'Ondulado'], ['ponytail', 'Rabo'], ['highpony', 'Rabo alto'], ['twin', 'Maria-chiquinha'], ['bob', 'Chanel'], ['bun', 'Coque'], ['braid', 'Trança'], ['sidebraid', 'Trança lateral'], ['curly', 'Cacheado']];
export const FACES = [['calm', 'Calmo'], ['smile', 'Sorriso'], ['fierce', 'Feroz'], ['happy', 'Alegre'], ['sleepy', 'Sonolento'], ['stern', 'Sério'], ['smirk', 'Sorriso de lado'], ['cool', 'Olhar frio'], ['shy', 'Tímida'], ['wink', 'Piscadinha'], ['doll', 'Olhos grandes']];
export const MALE_FACES = ['calm', 'smile', 'fierce', 'happy', 'sleepy', 'stern', 'smirk', 'cool'], FEMALE_FACES = ['calm', 'smile', 'fierce', 'happy', 'sleepy', 'shy', 'wink', 'doll'];
export const ACCS = [['none', 'Nenhum'], ['catears', 'Orelhas de gato'], ['horns', 'Chifrinhos'], ['glasses', 'Óculos'], ['flower', 'Flor'], ['band', 'Faixa'], ['beard', 'Barba'], ['mustache', 'Bigode'], ['stubble', 'Barba rala'], ['ribbon', 'Laço']];
export const MALE_ACCS = ['none', 'glasses', 'band', 'horns', 'catears', 'beard', 'mustache', 'stubble'], FEMALE_ACCS = ['none', 'glasses', 'band', 'horns', 'catears', 'flower', 'ribbon'];
export const BODIES = SEXES;
export const OUTFIT_STYLES = [['auto', 'Da classe'], ['tunic', 'Túnica'], ['armor', 'Armadura'], ['robe', 'Manto longo'], ['coat', 'Casaco'], ['vest', 'Colete'], ['dress', 'Vestido'], ['ninja', 'Traje ninja']];
const autoStyle = (cls, female) => ({ warrior: 'armor', paladin: 'armor', assassin: 'ninja', archer: 'vest', mage: female ? 'robe' : 'coat', sorcerer: female ? 'dress' : 'coat', druid: 'robe' }[cls] || 'tunic');
export const MALE_HAIR = ['short', 'spiky', 'undercut', 'slick', 'shaggy', 'topknot', 'afro', 'mohawk', 'bald'], FEMALE_HAIR = ['long', 'wavy', 'ponytail', 'highpony', 'twin', 'bob', 'bun', 'braid', 'sidebraid', 'curly'];

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);
const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');
const shade = (n, k) => '#' + new THREE.Color(n).multiplyScalar(k).getHexString();

// ---- material "toon" (3 tons, como desenho) ----
let gradMap = null;
const grad = () => gradMap || (gradMap = (() => { const t = new THREE.DataTexture(new Uint8Array([70, 120, 170, 215, 255]), 5, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })());
const toon = (c, o) => new THREE.MeshToonMaterial(Object.assign({ color: c, gradientMap: grad() }, o));

// ---- rosto: decalque curvo (só os traços, sem "máscara") ----
const faceCache = new Map();
function faceTexture(face, eyeHex, female) {
  const key = [face, eyeHex, female].join('|');
  if (faceCache.has(key)) return faceCache.get(key);
  const W = 512, H = 300, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), lash = '#241626', ex = [150, 362], ey = 140;
  g.lineCap = 'round'; g.lineJoin = 'round';
  ex.forEach((x, i) => {
    const s = i === 0 ? -1 : 1, closed = face === 'happy' || face === 'sleepy' || (face === 'wink' && i === 0);
    if (closed) {
      g.strokeStyle = lash; g.lineWidth = 13; g.beginPath();
      if (face === 'happy' || face === 'wink') g.arc(x, ey + 26, 44, Math.PI * 1.12, Math.PI * 1.88); else g.arc(x, ey - 14, 44, Math.PI * 0.12, Math.PI * 0.88);
      g.stroke();
    } else {
      const rx = female ? 46 : 41, ry = (female ? 62 : 54) * ({ fierce: 0.78, stern: 0.74, cool: 0.64, doll: 1.14 }[face] || 1);
      g.save(); g.beginPath(); g.ellipse(x, ey, rx + 6, ry + 4, 0, 0, 7); g.clip();
      g.fillStyle = '#ffffff'; g.fillRect(x - 70, ey - 90, 140, 180);
      const gr = g.createLinearGradient(0, ey - ry, 0, ey + ry); gr.addColorStop(0, shade(eyeHex, 0.45)); gr.addColorStop(0.5, hex(eyeHex)); gr.addColorStop(1, shade(eyeHex, 1.7));
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, ey + 4, rx - 4, ry - 2, 0, 0, 7); g.fill();
      g.fillStyle = '#0c0c16'; g.beginPath(); g.ellipse(x, ey + 4, 17, 27, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x - 70, ey - ry - 4, 140, 26);   // sombra da pálpebra
      g.restore();
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x - 14, ey - 18, 12, 14, 0, 0, 7); g.fill(); g.beginPath(); g.arc(x + 14, ey + 24, 6, 0, 7); g.fill();
      g.strokeStyle = lash; g.lineWidth = female ? 15 : 12; g.beginPath();
      if (face === 'fierce' || face === 'stern') { g.moveTo(x - s * 48, ey - ry * 0.5 + (s < 0 ? 6 : -6) * -1); g.lineTo(x + s * 50, ey - ry + 4); } else g.ellipse(x, ey, rx + 7, ry + 5, 0, Math.PI * 1.04, Math.PI * 1.96);
      g.stroke();
      if (female) { g.lineWidth = 8; g.beginPath(); g.moveTo(x + s * 46, ey - ry * 0.45); g.lineTo(x + s * 66, ey - ry * 0.62); g.stroke(); }
    }
    g.strokeStyle = 'rgba(60,36,30,0.95)'; g.lineWidth = female ? 8 : (face === 'stern' ? 18 : 13); g.beginPath();
    const by = ey - 96;
    if (face === 'smirk' && s > 0) { g.moveTo(x - 40, by - 6); g.quadraticCurveTo(x, by - 22, x + 40, by - 2); }
    else if (face === 'fierce' || face === 'stern') { g.moveTo(x - s * 46, by - 14); g.lineTo(x + s * 40, by + 12); }
    else if (face === 'happy' || (face === 'wink' && i === 0)) { g.moveTo(x - 40, by + 8); g.quadraticCurveTo(x, by - 12, x + 40, by + 8); }
    else { g.moveTo(x - 40, by + 4); g.quadraticCurveTo(x, by - 8, x + 40, by + 4); }
    g.stroke();
  });
  g.fillStyle = face === 'shy' ? 'rgba(255,90,110,0.6)' : (female ? 'rgba(255,100,120,0.32)' : 'rgba(255,100,120,0.12)'); [92, 420].forEach(x => { g.beginPath(); g.ellipse(x, 226, 34, 17, 0, 0, 7); g.fill(); });
  g.strokeStyle = '#8a3040'; g.lineWidth = 9; g.beginPath();
  if (face === 'stern') { g.moveTo(226, 260); g.lineTo(286, 260); }
  else if (face === 'smirk') { g.moveTo(224, 262); g.quadraticCurveTo(262, 268, 298, 238); }
  else if (face === 'shy') { g.moveTo(236, 256); g.quadraticCurveTo(246, 268, 256, 256); g.quadraticCurveTo(266, 268, 276, 256); }
  else if (face === 'smile' || face === 'happy' || face === 'wink' || face === 'doll') { g.moveTo(208, 232); g.quadraticCurveTo(256, 280, 304, 232); }
  else if (face === 'fierce') { g.moveTo(214, 262); g.quadraticCurveTo(256, 238, 298, 262); }
  else if (face === 'sleepy') { g.ellipse(256, 258, 17, 13, 0, 0, 7); }
  else { g.moveTo(222, 256); g.quadraticCurveTo(256, 272, 290, 256); }
  g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; faceCache.set(key, t); return t;
}

// ---- cabelo ----
const ball = (r, mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat); m.position.set(x, y, z); m.scale.set(sx || 1, sy || 1, sz || 1); return m; };
const cone = (r, h, mat, x, y, z, rx, rz) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mat); m.position.set(x, y, z); m.rotation.set(rx || 0, 0, rz || 0); return m; };
const lock = (r, len, mat, x, y, z, rx, rz) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat); m.position.set(x, y, z); m.rotation.set(rx || 0, 0, rz || 0); return m; };
function dome(hb, mat, k, openFront, thetaLen) {
  const phiLen = openFront ? Math.PI * 2 - 1.6 : Math.PI * 2, phiStart = openFront ? Math.PI / 2 + 0.8 : 0;
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18, phiStart, phiLen, 0, Math.PI * thetaLen), mat);
  m.scale.set(hb.w * 0.57 * k, hb.h * 0.56 * k, hb.d * 0.57 * k); m.position.y = hb.h * 0.04; return m;
}
function fringe(hb, mat, n, spread) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : i / (n - 1) - 0.5; const a = t * (spread || 1.5); g.add(cone(hb.w * 0.17, hb.h * 0.34, mat, Math.sin(a) * hb.w * 0.55, hb.h * 0.36, Math.cos(a) * hb.d * 0.5, Math.PI + 0.32, -t * 0.7)); }
  return g;
}
// mode: 'free' | 'hat' (chapéu/elmo cobre o topo: só aparece o que sai por baixo)
export function buildHair(style, hb, color, mode) {
  const g = new THREE.Group(), mat = toon(color), w = hb.w, h = hb.h, d = hb.d, hat = mode === 'hat';
  if (style === 'bald') return g;
  if (!hat) { g.add(dome(hb, mat, 1.06, true, style === 'bob' ? 0.82 : 0.7)); g.add(dome(hb, mat, 1.07, false, 0.34)); if (!['mohawk', 'slick', 'topknot', 'afro'].includes(style)) g.add(fringe(hb, mat, style === 'spiky' ? 7 : (style === 'undercut' ? 3 : (style === 'shaggy' ? 8 : 5)), style === 'spiky' ? 1.9 : 1.4)); }
  else {   // com chapéu/elmo: aparece só o cabelo que sai por baixo (nuca e laterais)
    const ext = (style === 'long' || style === 'bob' || style === 'twin' || style === 'ponytail' || style === 'braid') ? 0.34 : 0.2;
    const back = new THREE.Mesh(new THREE.SphereGeometry(1, 26, 12, Math.PI / 2 + 0.9, Math.PI * 2 - 1.8, Math.PI * 0.5, Math.PI * ext), mat);
    back.scale.set(w * 0.58, h * 0.58, d * 0.58); back.position.y = h * 0.04; g.add(back);
  }
  if (!hat && !['mohawk', 'undercut', 'slick', 'topknot'].includes(style)) { [-1, 1].forEach(s => g.add(lock(w * 0.09, h * 0.22, mat, s * w * 0.5, h * 0.0, d * 0.1, 0, s * 0.12))); g.add(lock(w * 0.16, h * 0.2, mat, 0, -h * 0.08, -d * 0.5)); }
  if (style === 'spiky' && !hat) { for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.5; g.add(cone(w * 0.15, h * 0.7, mat, Math.sin(a) * w * 0.34, h * 0.6, -d * 0.06 - Math.abs(i - 3) * d * 0.03, 0, -a * 0.9)); } [-1, 1].forEach(s => g.add(cone(w * 0.12, h * 0.55, mat, s * w * 0.42, h * 0.2, -d * 0.25, 0.3, -s * 1.1))); }
  if (style === 'long') { const b = new THREE.Mesh(new THREE.CapsuleGeometry(w * 0.42, h * 1.2, 5, 14), mat); b.scale.z = 0.55; b.position.set(0, -h * 0.55, -d * 0.34); g.add(b); [-1, 1].forEach(s => g.add(lock(w * 0.09, h * 0.85, mat, s * w * 0.52, -h * 0.25, d * 0.04))); }
  if (style === 'ponytail') { g.add(ball(w * 0.11, toon(0xffffff), 0, h * 0.34, -d * 0.55)); g.add(lock(w * 0.16, h * 0.95, mat, 0, -h * 0.1, -d * 0.78, -0.3, 0)); }
  if (style === 'twin') [-1, 1].forEach(s => { g.add(ball(w * 0.1, toon(0xff5577), s * w * 0.55, h * 0.18, -d * 0.12)); g.add(lock(w * 0.13, h * 0.95, mat, s * w * 0.7, -h * 0.34, -d * 0.12, 0, s * 0.12)); });
  if (style === 'bob') { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 26, 14, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, Math.PI * 0.42, Math.PI * 0.3), mat); b.scale.set(w * 0.66, h * 0.64, d * 0.66); b.position.y = -h * 0.06; g.add(b); }
  if (style === 'bun' && !hat) { g.add(ball(w * 0.27, mat, 0, h * 0.66, -d * 0.1)); g.add(ball(w * 0.08, toon(0xffffff), 0, h * 0.5, -d * 0.1)); }
  if (style === 'braid') for (let i = 0; i < 6; i++) g.add(ball(w * (0.15 - i * 0.012), mat, 0, -h * (0.02 + i * 0.2), -d * (0.5 + i * 0.03), 1, 1.25, 1));
  if (style === 'mohawk' && !hat) for (let i = 0; i < 7; i++) g.add(cone(w * 0.1, h * 0.6, mat, 0, h * 0.52 - Math.abs(i - 3) * h * 0.04, d * (0.4 - i * 0.14), -0.12, 0));
  if (!hat && style === 'undercut') { g.add(ball(w * 0.3, mat, 0, h * 0.52, d * 0.12, 1.15, 0.7, 1.3)); g.add(cone(w * 0.2, h * 0.5, mat, 0, h * 0.58, d * 0.34, 1.1, 0)); }
  if (!hat && style === 'slick') { g.add(ball(w * 0.34, mat, 0, h * 0.42, -d * 0.04, 1.1, 0.55, 1.25)); g.add(lock(w * 0.3, h * 0.35, mat, 0, -h * 0.05, -d * 0.46)); }
  if (!hat && style === 'shaggy') [-1, 1].forEach(s => { g.add(lock(w * 0.1, h * 0.5, mat, s * w * 0.53, -h * 0.22, d * 0.02, 0, s * 0.1)); g.add(lock(w * 0.12, h * 0.4, mat, s * w * 0.3, -h * 0.28, -d * 0.45, 0, s * 0.15)); });
  if (!hat && style === 'topknot') { g.add(ball(w * 0.2, mat, 0, h * 0.64, -d * 0.12)); g.add(ball(w * 0.07, toon(0x222222), 0, h * 0.5, -d * 0.12, 1.6, 0.6, 1.6)); }
  if (!hat && style === 'afro') { g.add(ball(w * 0.62, mat, 0, h * 0.3, -d * 0.2, 1, 0.9, 1)); g.add(dome(hb, mat, 1.06, true, 0.5)); }
  if (style === 'wavy') { const b = new THREE.Mesh(new THREE.CapsuleGeometry(w * 0.46, h * 1.05, 5, 14), mat); b.scale.z = 0.55; b.position.set(0, -h * 0.5, -d * 0.34); g.add(b); [-1, 1].forEach(s => { for (let i = 0; i < 3; i++) g.add(ball(w * 0.15, mat, s * (w * 0.5 + (i % 2) * w * 0.07), -h * (0.1 + i * 0.3), d * 0.02 - i * d * 0.02, 1, 1.3, 1)); }); }
  if (style === 'highpony') { g.add(ball(w * 0.12, toon(0xff5577), 0, h * 0.5, -d * 0.3)); g.add(lock(w * 0.17, h * 1.1, mat, 0, h * 0.0, -d * 0.95, -0.55, 0)); }
  if (style === 'sidebraid') for (let i = 0; i < 6; i++) g.add(ball(w * (0.13 - i * 0.01), mat, w * (0.52 + i * 0.02), -h * (0.05 + i * 0.2), d * 0.1, 1, 1.25, 1));
  if (!hat && style === 'curly') for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283, y = (i % 3) * 0.2 - 0.1; g.add(ball(w * 0.17, mat, Math.cos(a) * w * 0.55, h * (0.18 - y), Math.sin(a) * d * 0.45 - d * 0.1)); }
  return g;
}
export function buildAcc(acc, hb, color) {
  const g = new THREE.Group(), w = hb.w, h = hb.h, d = hb.d, m = toon(color);
  if (acc === 'catears') [-1, 1].forEach(s => g.add(cone(w * 0.19, h * 0.42, m, s * w * 0.32, h * 0.56, 0, 0, -s * 0.3)));
  else if (acc === 'horns') [-1, 1].forEach(s => g.add(cone(w * 0.1, h * 0.46, toon(0xf2e6c8), s * w * 0.3, h * 0.56, 0, 0, -s * 0.5)));
  else if (acc === 'glasses') { const f = toon(0x20202c); [-1, 1].forEach(s => { const r = new THREE.Mesh(new THREE.TorusGeometry(w * 0.17, w * 0.017, 6, 22), f); r.position.set(s * w * 0.23, -h * 0.02, d * 0.5); g.add(r); }); const br = new THREE.Mesh(new THREE.BoxGeometry(w * 0.14, w * 0.02, w * 0.02), f); br.position.set(0, 0, d * 0.5); g.add(br); }
  else if (acc === 'flower') { g.add(ball(w * 0.07, toon(0xffd23f), w * 0.36, h * 0.34, d * 0.34)); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; g.add(ball(w * 0.07, m, w * 0.36 + Math.cos(a) * w * 0.1, h * 0.34 + Math.sin(a) * w * 0.1, d * 0.36)); } }
  else if (acc === 'band') { const b = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.58, w * 0.58, h * 0.1, 24, 1, true), toon(color, { side: THREE.DoubleSide })); b.scale.z = d / w; b.position.y = h * 0.3; g.add(b); }
  else if (acc === 'ribbon') { const rm = toon(color); [-1, 1].forEach(s => g.add(cone(w * 0.16, h * 0.34, rm, s * w * 0.2, h * 0.58, d * 0.1, 0, -s * 1.5))); g.add(ball(w * 0.07, rm, 0, h * 0.58, d * 0.1)); }
  else if (acc === 'beard') { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, Math.PI / 2 - 1.35, 2.7, Math.PI * 0.72, Math.PI * 0.26), m); b.scale.set(w * 0.6, h * 0.6, d * 0.6); b.position.y = h * 0.04; g.add(b); g.add(lock(w * 0.17, h * 0.1, m, 0, -h * 0.5, d * 0.28, 1.3, 0)); }
  else if (acc === 'mustache') { [-1, 1].forEach(s => g.add(lock(w * 0.05, w * 0.15, m, s * w * 0.09, -h * 0.26, d * 0.53, 0, Math.PI / 2 + s * 0.25))); }
  else if (acc === 'stubble') { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, Math.PI / 2 - 1.3, 2.6, Math.PI * 0.72, Math.PI * 0.2), toon(0x3a2c28, { transparent: true, opacity: 0.55 })); b.scale.set(w * 0.585, h * 0.585, d * 0.585); b.position.y = h * 0.04; g.add(b); }
  return g;
}

// ---- contorno (casca invertida) ----
let outlineMat = null;
function getOutlineMat() {
  if (outlineMat) return outlineMat;
  outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a1226, side: THREE.BackSide });
  outlineMat.onBeforeCompile = (s) => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * 0.016;'); };
  return outlineMat;
}
export function addOutline(root) {
  const list = [];
  root.traverse(o => { if (o.isMesh && !o.userData.outline && !o.userData.noOutline) { let v = true, p = o; while (p) { if (!p.visible) { v = false; break; } p = p.parent; } if (v) list.push(o); } });
  const om = getOutlineMat();
  list.forEach(o => {
    let m; if (o.isSkinnedMesh) { m = new THREE.SkinnedMesh(o.geometry, om); m.bind(o.skeleton, o.bindMatrix); } else m = new THREE.Mesh(o.geometry, om);
    m.userData.outline = true; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false;
    if (o.matrixAutoUpdate) { m.position.copy(o.position); m.quaternion.copy(o.quaternion); m.scale.copy(o.scale); } else { m.matrixAutoUpdate = false; m.matrix.copy(o.matrix); }
    o.parent.add(m);
  });
}

// ---- encaixe de peças nos ossos (coordenadas do modelo em repouso) ----
function place(root, L, boneName, obj) {
  const b = root.getObjectByName(boneName), r = L.head.rest[boneName]; if (!b || !r) return null;
  obj.updateMatrix(); obj.matrix.premultiply(r.inv); obj.matrixAutoUpdate = false; b.add(obj); return obj;
}
function capsuleBetween(a, b, r, mat, sx) {
  const dir = b.clone().sub(a), len = dir.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, 14), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(Y, dir.normalize()); if (sx) m.scale.x = sx; return m;
}
const lathe = (pts, mat, sz) => { const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 24), mat); m.scale.z = sz || 0.8; return m; };
const BUILD = { slim: { t: 0.86, l: 0.86 }, normal: { t: 1, l: 1 }, strong: { t: 1.1, l: 1.22 }, chubby: { t: 1.32, l: 1.12 } };

function buildBody(root, L, def) {
  const rp = (n) => (L.head.rest[n] ? L.head.rest[n].p : null);
  const female = def.body === 'f', K = BUILD[def.build] || BUILD.normal, cls = def.cls;
  const skin = def.skin != null ? def.skin : 0xffe0bd, outfit = def.outfit != null ? def.outfit : 0xf2efe9;
  const skinM = toon(skin), outM = toon(outfit), pantM = toon(new THREE.Color(outfit).lerp(new THREE.Color(0x2c3e50), 0.6).getHex()), bootM = toon(0x4a3326), metalM = toon(0xaab4c0), beltM = toon(0x3b2a1a);
  const tw = K.t * (female ? 0.94 : 1);
  // tronco (camisa) e quadril (calça)
  const up = [[0.001, 0.6], [0.25 * tw, 0.62], [(female ? 0.22 : 0.27) * tw, 0.78], [(female ? 0.27 : 0.31) * tw, 0.98], [0.3 * tw, 1.09], [0.18, 1.17], [0.001, 1.19]];
  place(root, L, 'spine', lathe(up, outM, 0.78));
  place(root, L, 'hips', lathe([[0.001, 0.36], [0.2 * tw, 0.38], [0.27 * tw, 0.5], [0.26 * tw, 0.63], [0.001, 0.63]], pantM, 0.8));
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.255 * tw, 0.03, 8, 24), beltM); belt.rotation.x = Math.PI / 2; belt.position.y = 0.62; belt.scale.set(1, 0.8, 1); place(root, L, 'spine', belt);
  const style = (def.outfitStyle && def.outfitStyle !== 'auto') ? def.outfitStyle : autoStyle(cls, female);
  const capeC = def.color != null ? def.color : 0x8e44ad, trimM = toon(capeC), dbl = { side: THREE.DoubleSide };
  const sleeves = { tunic: 'short', armor: 'armor', robe: 'wide', coat: 'long', vest: 'none', dress: 'none', ninja: 'long' }[style] || 'short';
  // bracos
  ['l', 'r'].forEach((sd) => {
    const sh = rp('upperarm' + sd), el = rp('lowerarm' + sd), wr = rp('wrist' + sd), hd = rp('hand' + sd);
    if (!sh || !el || !wr || !hd) return;
    const r1 = 0.105 * K.l, r2 = 0.085 * K.l;
    const upM = sleeves === 'none' ? skinM : (sleeves === 'armor' ? metalM : outM), loM = (sleeves === 'long' || sleeves === 'wide') ? outM : (sleeves === 'armor' ? metalM : skinM);
    place(root, L, 'upperarm' + sd, capsuleBetween(sh, el, r1 * (sleeves === 'wide' ? 1.25 : 1), upM));
    place(root, L, 'upperarm' + sd, ball(0.135 * K.l, sleeves === 'none' ? outM : upM, sh.x, sh.y, sh.z));
    place(root, L, 'lowerarm' + sd, capsuleBetween(el, wr, r2 * (sleeves === 'wide' ? 1.55 : 1), loM));
    if (sleeves === 'long' || sleeves === 'wide') place(root, L, 'lowerarm' + sd, ball(0.1 * K.l * (sleeves === 'wide' ? 1.5 : 1), trimM, wr.x, wr.y, wr.z, 1, 0.5, 1));
    place(root, L, 'hand' + sd, ball(0.115, sleeves === 'armor' ? metalM : skinM, hd.x, hd.y, hd.z));
  });
  // pernas e botas
  ['l', 'r'].forEach((sd) => {
    const hp = rp('upperleg' + sd), kn = rp('lowerleg' + sd), ft = rp('foot' + sd), to = rp('toes' + sd);
    if (!hp || !kn || !ft) return;
    place(root, L, 'upperleg' + sd, capsuleBetween(hp, kn, 0.125 * K.l, pantM));
    place(root, L, 'lowerleg' + sd, capsuleBetween(kn, ft, 0.108 * K.l, style === 'armor' ? metalM : pantM));
    if (style === 'armor') place(root, L, 'lowerleg' + sd, ball(0.13 * K.l, metalM, kn.x, kn.y, kn.z + 0.04, 1, 0.8, 1));
    place(root, L, 'foot' + sd, ball(1, bootM, ft.x, 0.085, (ft.z + (to ? to.z : 0.1)) / 2 + 0.03, 0.135, 0.095, 0.21));
  });
  // pecas da roupa
  const skirt = (r0, r1, y0, y1, mat, th0, thLen) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0 * tw, r1 * tw, y0 - y1, 24, 1, true, th0 || 0, thLen || Math.PI * 2), mat); m.position.y = (y0 + y1) / 2; m.scale.z = 0.85; return m; };
  const band = (r, y, mat, t) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r * tw, t || 0.025, 8, 28), mat); m.rotation.x = Math.PI / 2; m.position.y = y; m.scale.y = 0.85; return m; };
  if (style === 'tunic') { place(root, L, 'hips', skirt(0.27, female ? 0.42 : 0.34, 0.62, female ? 0.36 : 0.4, toon(outfit, dbl))); place(root, L, 'hips', band(female ? 0.42 : 0.34, female ? 0.37 : 0.41, trimM)); }
  else if (style === 'armor') {
    place(root, L, 'spine', ball(1, metalM, 0, 0.93, 0.15, 0.27 * tw, 0.2, 0.13)); place(root, L, 'spine', ball(1, metalM, 0, 0.9, -0.14, 0.26 * tw, 0.2, 0.1));
    ['l', 'r'].forEach(sd => { const sh = rp('upperarm' + sd); if (sh) place(root, L, 'upperarm' + sd, ball(0.2 * K.l, metalM, sh.x * 1.1, sh.y + 0.04, sh.z, 1, 0.75, 1)); });
    place(root, L, 'hips', skirt(0.27, 0.36, 0.62, 0.42, toon(0x8a93a0, dbl)));
  } else if (style === 'robe') { place(root, L, 'hips', skirt(0.27, 0.5, 0.62, 0.14, toon(outfit, dbl))); place(root, L, 'hips', band(0.5, 0.16, trimM, 0.03)); place(root, L, 'spine', band(0.26, 0.64, trimM, 0.035)); }
  else if (style === 'coat') {
    place(root, L, 'hips', skirt(0.27, 0.44, 0.62, 0.2, toon(outfit, dbl), Math.PI * 0.62, Math.PI * 1.76));
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.14, 18, 1, true), toon(capeC, dbl)); col.position.y = 1.15; col.scale.z = 0.85; place(root, L, 'spine', col);
    place(root, L, 'spine', band(0.3, 0.98, trimM, 0.02));
  } else if (style === 'vest') { place(root, L, 'spine', band(0.3, 0.98, trimM, 0.025)); place(root, L, 'spine', band(0.31, 1.06, trimM, 0.02)); if (female || cls === 'archer') place(root, L, 'hips', skirt(0.27, 0.36, 0.62, 0.4, toon(0x5a7a3a, dbl))); }
  else if (style === 'dress') { place(root, L, 'hips', skirt(0.25, 0.46, 0.64, 0.24, toon(outfit, dbl))); place(root, L, 'hips', band(0.46, 0.26, trimM, 0.025)); place(root, L, 'spine', ball(0.07, trimM, 0, 0.7, -0.22, 1.6, 1, 0.7)); }
  else if (style === 'ninja') {
    const sc = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.065, 8, 20), trimM); sc.rotation.x = Math.PI / 2; sc.position.y = 1.16; sc.scale.y = 0.8; place(root, L, 'spine', sc);
    place(root, L, 'spine', band(0.29, 0.72, trimM, 0.06)); place(root, L, 'hips', skirt(0.27, 0.3, 0.62, 0.5, toon(outfit, dbl)));
  }
  if (cls === 'druid' && style !== 'armor') { const mt = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.4, 0.2, 14, 1, true), toon(0x5a7a3a, dbl)); mt.position.y = 1.07; place(root, L, 'spine', mt); }
  // some o corpo quadrado original (armas, capa e elmo continuam)
  root.traverse(o => { if (o.isSkinnedMesh && /(_Body|_Head|_Arm|_Leg)/.test(o.name)) o.visible = false; });
}

// ---- monta tudo no herói ----
// L.head = { hb:{w,h,d}, headM }; L.rest[osso] = { inv, p }
export function decorate(root, L, def, gear) {
  if (!L.head || !L.head.rest) return;
  const hb = L.head.hb, headBone = root.getObjectByName('head');
  const skin = def.skin != null ? def.skin : 0xffe0bd, hairC = def.hairColor != null ? def.hairColor : 0x4a2c17, female = def.body === 'f';
  buildBody(root, L, def);
  if (headBone) {
    const piv = new THREE.Group(); piv.matrixAutoUpdate = false; piv.matrix.copy(L.head.headM); headBone.add(piv);
    const R = hb.w * 0.5 * 0.97, hg = new THREE.Group(); hg.scale.set(female ? 1 : 1.04, 0.97, 1); piv.add(hg);
    const sk = toon(skin);
    hg.add(new THREE.Mesh(new THREE.SphereGeometry(R, 40, 28), sk));
    [-1, 1].forEach(s => hg.add(ball(R * 0.13, sk, s * R * 0.97, -R * 0.1, 0, 0.6, 1, 0.9)));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.006, 36, 24, Math.PI / 2 - 0.95, 1.9, Math.PI * 0.32, Math.PI * 0.44), new THREE.MeshBasicMaterial({ map: faceTexture(def.face || 'calm', def.eyeColor != null ? def.eyeColor : 0x2f6fdb, female), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    cap.userData.noOutline = true; hg.add(cap);
    if (gear === 'hood') { const hm = toon(def.outfit != null ? def.outfit : 0x2b2d42); const hd = new THREE.Group(); hd.add(dome(hb, hm, 1.12, true, 0.78)); hd.add(lock(hb.w * 0.3, hb.h * 0.5, hm, 0, -hb.h * 0.35, -hb.d * 0.42)); piv.add(hd); }
    else piv.add(buildHair(def.hairStyle || 'short', hb, hairC, gear === 'hat' ? 'hat' : 'free'));
    if (def.acc && def.acc !== 'none') piv.add(buildAcc(def.acc, hb, ['beard', 'mustache'].includes(def.acc) ? hairC : (def.color != null ? def.color : 0xe74c3c)));
  }
  root.scale.multiplyScalar({ short: 0.92, mid: 1, tall: 1.08 }[def.height] || 1);
}
