// Aparência estilo anime: peças (cabelo, rosto, acessórios, corpo feminino) encaixadas nos modelos KayKit + contorno de desenho.
import * as THREE from 'three';

export const HAIR_STYLES = [['short', 'Curto'], ['spiky', 'Espetado'], ['long', 'Longo'], ['ponytail', 'Rabo'], ['twin', 'Maria-chiquinha'], ['bob', 'Chanel'], ['bun', 'Coque'], ['braid', 'Trança'], ['mohawk', 'Moicano'], ['bald', 'Careca']];
export const FACES = [['calm', 'Calmo'], ['smile', 'Sorriso'], ['fierce', 'Feroz'], ['happy', 'Alegre'], ['sleepy', 'Sonolento']];
export const ACCS = [['none', 'Nenhum'], ['catears', 'Orelhas de gato'], ['horns', 'Chifrinhos'], ['glasses', 'Óculos'], ['flower', 'Flor'], ['band', 'Faixa']];
export const BODIES = [['m', '♂ Masculino'], ['f', '♀ Feminino']];

const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');
const shade = (n, k) => { const c = new THREE.Color(n); c.multiplyScalar(k); return '#' + c.getHexString(); };

// ---- rosto (decalque 2D: olhos grandes de anime, sobrancelha, boca) ----
const faceCache = new Map();
function faceTexture(face, eyeHex, skinHex, female) {
  const key = [face, eyeHex, skinHex, female].join('|');
  if (faceCache.has(key)) return faceCache.get(key);
  const W = 256, H = 160, c = cv(W, H), g = c.getContext('2d');
  g.fillStyle = hex(skinHex); g.beginPath(); g.roundRect(0, 0, W, H, 60); g.fill();
  const lash = '#1c1424', ex = [64, 192], ey = 74;
  ex.forEach((x, i) => {
    const s = i === 0 ? -1 : 1;
    const closed = face === 'happy' || face === 'sleepy';
    if (closed) {
      g.strokeStyle = lash; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath();
      if (face === 'happy') g.arc(x, ey + 12, 24, Math.PI * 1.12, Math.PI * 1.88); else g.arc(x, ey - 8, 24, Math.PI * 0.12, Math.PI * 0.88);
      g.stroke();
    } else {
      const ry = face === 'fierce' ? 26 : 33, rx = 25;
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, ey, rx + 3, ry + 2, 0, 0, 7); g.fill();
      const gr = g.createLinearGradient(0, ey - ry, 0, ey + ry); gr.addColorStop(0, shade(eyeHex, 0.55)); gr.addColorStop(0.55, hex(eyeHex)); gr.addColorStop(1, shade(eyeHex, 1.6));
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, ey + 2, rx - 3, ry - 1, 0, 0, 7); g.fill();
      g.fillStyle = '#10101a'; g.beginPath(); g.ellipse(x, ey + 2, 10, 15, 0, 0, 7); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - 8, ey - 10, 7, 0, 7); g.fill(); g.beginPath(); g.arc(x + 8, ey + 12, 3.5, 0, 7); g.fill();
      // pálpebra superior grossa (cílios)
      g.strokeStyle = lash; g.lineWidth = face === 'fierce' ? 9 : 7; g.lineCap = 'round'; g.beginPath();
      if (face === 'fierce') { g.moveTo(x - s * 28, ey - 14 - (s < 0 ? 6 : -6) * -1); g.lineTo(x + s * 28, ey - 24 + (s < 0 ? 0 : 0)); }
      else g.ellipse(x, ey, rx + 4, ry + 3, 0, Math.PI * 1.05, Math.PI * 1.95);
      g.stroke();
      if (female) { g.lineWidth = 5; g.beginPath(); g.moveTo(x + s * 26, ey - 14); g.lineTo(x + s * 38, ey - 22); g.stroke(); }
    }
    // sobrancelha
    g.strokeStyle = shade(0x3a2a22, 1); g.lineWidth = 5; g.lineCap = 'round'; g.beginPath();
    const by = ey - 48; if (face === 'fierce') { g.moveTo(x - s * 26, by - 8); g.lineTo(x + s * 22, by + 6); } else if (face === 'happy') { g.moveTo(x - 22, by + 4); g.quadraticCurveTo(x, by - 6, x + 22, by + 4); } else { g.moveTo(x - 22, by + 2); g.quadraticCurveTo(x, by - 4, x + 22, by + 2); }
    g.stroke();
  });
  // bochechas e boca
  g.fillStyle = 'rgba(255,110,120,0.28)'; [38, 218].forEach(x => { g.beginPath(); g.ellipse(x, 118, 16, 9, 0, 0, 7); g.fill(); });
  g.strokeStyle = '#7a2f3a'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath();
  if (face === 'smile' || face === 'happy') { g.moveTo(106, 124); g.quadraticCurveTo(128, 148, 150, 124); }
  else if (face === 'fierce') { g.moveTo(108, 138); g.quadraticCurveTo(128, 126, 148, 138); }
  else if (face === 'sleepy') { g.ellipse(128, 134, 9, 7, 0, 0, 7); }
  else { g.moveTo(112, 134); g.quadraticCurveTo(128, 142, 144, 134); }
  g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; faceCache.set(key, t); return t;
}

// ---- cabelo ----
const ST = (col) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.05 });
function dome(hb, mat, k, openFront, thetaLen) {
  const phiLen = openFront ? Math.PI * 2 - 1.5 : Math.PI * 2, phiStart = openFront ? Math.PI / 2 + 0.75 : 0;
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16, phiStart, phiLen, 0, Math.PI * thetaLen), mat);
  m.scale.set(hb.w * 0.58 * k, hb.h * 0.58 * k, hb.d * 0.58 * k); m.position.y = hb.h * 0.04; return m;
}
const cone = (r, h, mat, x, y, z, rx, rz) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat); m.position.set(x, y, z); m.rotation.set(rx || 0, 0, rz || 0); return m; };
const ball = (r, mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat); m.position.set(x, y, z); m.scale.set(sx || 1, sy || 1, sz || 1); return m; };
function fringe(hb, mat, n) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : i / (n - 1) - 0.5; g.add(cone(hb.w * 0.15, hb.h * 0.3, mat, t * hb.w * 0.8, hb.h * 0.3, hb.d * 0.54, Math.PI + 0.35, -t * 0.4)); }
  return g;
}
export function buildHair(style, hb, color) {
  const g = new THREE.Group(), mat = ST(color), w = hb.w, h = hb.h, d = hb.d;
  if (style === 'bald') return g;
  g.add(dome(hb, mat, 1.07, true, style === 'bob' ? 0.84 : 0.7)); g.add(dome(hb, mat, 1.03, false, 0.34));
  g.add(fringe(hb, mat, style === 'mohawk' ? 0 : 5));
  if (style === 'spiky') { for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.55; g.add(cone(w * 0.12, h * 0.55, mat, Math.sin(a) * w * 0.3, h * 0.62, -d * 0.04 - Math.abs(i - 2) * d * 0.02, 0, -a * 0.8)); } g.add(cone(w * 0.1, h * 0.5, mat, w * 0.38, h * 0.3, -d * 0.2, 0, -1.0), cone(w * 0.1, h * 0.5, mat, -w * 0.38, h * 0.3, -d * 0.2, 0, 1.0)); }
  if (style === 'long') { const b = new THREE.Mesh(new THREE.CapsuleGeometry(w * 0.4, h * 1.1, 4, 12), mat); b.scale.z = 0.5; b.position.set(0, -h * 0.5, -d * 0.36); g.add(b); [-1, 1].forEach(s => g.add(ball(w * 0.11, mat, s * w * 0.5, -h * 0.12, d * 0.08, 0.8, 3.6, 0.9))); }
  if (style === 'ponytail') { g.add(ball(w * 0.12, mat, 0, h * 0.4, -d * 0.52)); const t = new THREE.Mesh(new THREE.CapsuleGeometry(w * 0.13, h * 0.85, 4, 10), mat); t.position.set(0, -h * 0.05, -d * 0.7); t.rotation.x = -0.25; g.add(t); }
  if (style === 'twin') [-1, 1].forEach(s => { g.add(ball(w * 0.1, mat, s * w * 0.55, h * 0.18, -d * 0.1)); const t = new THREE.Mesh(new THREE.CapsuleGeometry(w * 0.12, h * 0.75, 4, 10), mat); t.position.set(s * w * 0.68, -h * 0.28, -d * 0.1); t.rotation.z = s * 0.18; g.add(t); });
  if (style === 'bob') { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 14, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, Math.PI * 0.42, Math.PI * 0.32), mat); b.scale.set(w * 0.66, h * 0.62, d * 0.66); b.position.y = -h * 0.04; g.add(b); }
  if (style === 'bun') g.add(ball(w * 0.24, mat, 0, h * 0.62, -d * 0.1));
  if (style === 'braid') for (let i = 0; i < 5; i++) g.add(ball(w * (0.14 - i * 0.012), mat, 0, -h * (0.05 + i * 0.2), -d * (0.5 + i * 0.03), 1, 1.2, 1));
  if (style === 'mohawk') for (let i = 0; i < 6; i++) g.add(cone(w * 0.09, h * 0.5, mat, 0, h * 0.5 - Math.abs(i - 2.5) * h * 0.04, d * (0.3 - i * 0.12), -0.1, 0));
  return g;
}
export function buildAcc(acc, hb, color) {
  const g = new THREE.Group(), w = hb.w, h = hb.h, d = hb.d;
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  if (acc === 'catears') [-1, 1].forEach(s => g.add(cone(w * 0.17, h * 0.4, m, s * w * 0.3, h * 0.56, 0, 0, -s * 0.3)));
  else if (acc === 'horns') [-1, 1].forEach(s => g.add(cone(w * 0.1, h * 0.45, new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.4 }), s * w * 0.3, h * 0.56, 0, 0, -s * 0.5)));
  else if (acc === 'glasses') { const f = new THREE.MeshStandardMaterial({ color: 0x20202c, roughness: 0.4 }); [-1, 1].forEach(s => { const r = new THREE.Mesh(new THREE.TorusGeometry(w * 0.16, w * 0.016, 6, 20), f); r.position.set(s * w * 0.23, h * 0.02, d * 0.51); g.add(r); }); const br = new THREE.Mesh(new THREE.BoxGeometry(w * 0.14, w * 0.02, w * 0.02), f); br.position.set(0, h * 0.04, d * 0.51); g.add(br); }
  else if (acc === 'flower') { const c = ball(w * 0.07, new THREE.MeshStandardMaterial({ color: 0xffd23f }), w * 0.34, h * 0.36, d * 0.42); g.add(c); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; g.add(ball(w * 0.07, m, w * 0.34 + Math.cos(a) * w * 0.1, h * 0.36 + Math.sin(a) * w * 0.1, d * 0.43)); } }
  else if (acc === 'band') { const b = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.6, w * 0.6, h * 0.1, 22, 1, true), new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide })); b.scale.z = d / w; b.position.y = h * 0.28; g.add(b); }
  return g;
}

// ---- contorno (casca invertida) ----
let outlineMat = null;
function getOutlineMat() {
  if (outlineMat) return outlineMat;
  outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a1226, side: THREE.BackSide });
  outlineMat.onBeforeCompile = (s) => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * 0.018;'); };
  return outlineMat;
}
export function addOutline(root) {
  const list = [];
  root.traverse(o => { if (o.isMesh && !o.userData.outline) { let v = true, p = o; while (p) { if (!p.visible) { v = false; break; } p = p.parent; } if (v) list.push(o); } });
  const om = getOutlineMat();
  list.forEach(o => {
    let m; if (o.isSkinnedMesh) { m = new THREE.SkinnedMesh(o.geometry, om); m.bind(o.skeleton, o.bindMatrix); } else m = new THREE.Mesh(o.geometry, om);
    m.userData.outline = true; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; m.renderOrder = -1;
    m.position.copy(o.position); m.quaternion.copy(o.quaternion); m.scale.copy(o.scale);
    o.parent.add(m);
  });
}

// ---- monta tudo no herói ----
// L.head = { hb:{w,h,d}, headM (matriz osso→centro da cabeça), hipsM, hipsY }
export function decorate(root, L, def, hasGear) {
  if (!L.head) return;
  const hb = L.head.hb, headBone = root.getObjectByName('head'), hipsBone = root.getObjectByName('hips');
  const skin = def.skin != null ? def.skin : 0xffe0bd, hairC = def.hairColor != null ? def.hairColor : 0x4a2c17, female = def.body === 'f';
  if (headBone) {
    const piv = new THREE.Group(); piv.matrixAutoUpdate = false; piv.matrix.copy(L.head.headM); headBone.add(piv);
    // rosto
    const fw = hb.w * 0.84, fh = fw * 160 / 256;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshStandardMaterial({ map: faceTexture(def.face || 'calm', def.eyeColor != null ? def.eyeColor : 0x2f6fdb, skin, female), roughness: 0.8, transparent: true, alphaTest: 0.5 }));
    face.position.set(0, -hb.h * 0.1, hb.d * 0.5 + 0.004); piv.add(face);
    if (!hasGear) { piv.add(buildHair(def.hairStyle || 'short', hb, hairC)); }
    if (def.acc && def.acc !== 'none') piv.add(buildAcc(def.acc, hb, def.color != null ? def.color : 0xe74c3c));
  }
  if (female) {
    root.scale.x *= 0.93;
    if (hipsBone && L.head.hipsM) {
      const piv = new THREE.Group(); piv.matrixAutoUpdate = false; piv.matrix.copy(L.head.hipsM); hipsBone.add(piv);
      const u = hb.w, sk = new THREE.Mesh(new THREE.CylinderGeometry(u * 0.27, u * 0.46, u * 0.3, 18, 1, true), new THREE.MeshStandardMaterial({ color: def.outfit != null ? def.outfit : 0x3a4fb8, roughness: 0.7, side: THREE.DoubleSide }));
      sk.position.y = -u * 0.12; piv.add(sk);
    }
  }
}
