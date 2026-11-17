// Cenários por setor: cada reino tem chão, vegetação/relevo, céu, névoa e atmosfera próprios.
import * as THREE from 'three';
import { kkMesh } from './kk.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const BIOME_INFO = {
  mares:    { title: 'Mar das Marés',    sub: 'praias, palmeiras, corais e poças de maré', fog: [60, 300], mtn: 0x6fb7d9, cap: 0xffffff, cloud: 0xffffff, hemi: 0xa8e6ff },
  sombras:  { title: 'Clã das Sombras',  sub: 'cemitério, árvores mortas e fogos-fátuos', fog: [30, 120], mtn: 0x3a3050, cap: 0x8a7aa8, cloud: 0x6a5a80, hemi: 0x6a5a90 },
  arcana:   { title: 'Academia Arcana',  sub: 'cristais mágicos e pedras de runas flutuantes', fog: [50, 260], mtn: 0x6f6fcf, cap: 0xe6d6ff, cloud: 0xe6d6ff, hemi: 0xb8a8ff },
  planalto: { title: 'Planalto Dourado', sub: 'deserto, cactos e mesas de arenito', fog: [70, 320], mtn: 0xc98a4b, cap: 0xffe2a8, cloud: 0xfff0c9, hemi: 0xffd89a },
  primeva:  { title: 'Floresta Primeva', sub: 'floresta densa, cogumelos gigantes', fog: [45, 260], mtn: 0x4f8f6a, cap: 0xeaffea, cloud: 0xeaffea, hemi: 0x9be3a8 },
  vazio:    { title: 'O Vazio',          sub: 'cacos flutuantes e pilares quebrados', fog: [25, 110], mtn: 0x1a1a26, cap: 0x4a3a6a, cloud: 0x3a3050, hemi: 0x6a5a8a },
};

// ---- texturas de chão ----
const texCache = {};
export function groundTex(realm) {
  if (texCache[realm]) return texCache[realm];
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const P = {
    mares:    ['#e9d9a4', ['#f5e8b8', '#d9c68c', '#cdb97a'], 3, 3],
    sombras:  ['#645a7a', ['#74698a', '#4e4663', '#8a7a9c'], 2, 4],
    arcana:   ['#5b5fc4', ['#7478e0', '#4a4eb0', '#9a8cff'], 2, 3],
    planalto: ['#e2b866', ['#f0cb80', '#c99a4a', '#d9a95a'], 3, 3],
    primeva:  ['#3f9a3a', ['#4fb348', '#348030', '#5fc65a'], 2, 6],
    vazio:    ['#403c54', ['#524c68', '#2c2a3c', '#8a55c4'], 2, 3],
  }[realm] || ['#4f9d3a', ['#5fb348', '#438a32'], 2, 5];
  g.fillStyle = P[0]; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 300; i++) { g.fillStyle = P[1][i % P[1].length]; g.fillRect(Math.random() * 128, Math.random() * 128, P[2], P[3]); }
  if (realm === 'vazio') { g.strokeStyle = 'rgba(160,90,255,.55)'; g.lineWidth = 1.2; for (let i = 0; i < 6; i++) { g.beginPath(); let x = Math.random() * 128, y = Math.random() * 128; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(420, 420); t.colorSpace = THREE.SRGBColorSpace;
  // textura pintada gerada no Unirall (sem emenda); troca a de rabisco assim que carregar
  try {
    const im = new Image(); im.onload = () => { t.image = im; t.anisotropy = 8; t.needsUpdate = true; };
    im.src = ((import.meta.env && import.meta.env.BASE_URL) || './') + 'img/tex/' + realm + '.webp';
  } catch (e) { /* fica a textura de rabisco */ }
  return (texCache[realm] = t);
}

const DENS = 3.2;
const paint = (g, c) => { const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const strip = (g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; };
// cacto com bracos curvos (tronco + dois bracos), base em y = 0
function cactusGeo() {
  const parts = [new THREE.CapsuleGeometry(0.38, 2.2, 5, 10).translate(0, 1.5, 0)];
  [[1, 0.9, 1.3], [-1, 0.6, 1.9]].forEach(([sd, h0, h1]) => { parts.push(new THREE.CapsuleGeometry(0.2, 0.6, 4, 8).rotateZ(Math.PI / 2).translate(sd * 0.62, h0 + 0.5, 0)); parts.push(new THREE.CapsuleGeometry(0.2, h1 - h0 - 0.3, 4, 8).translate(sd * 0.95, h0 + 0.5 + (h1 - h0) / 2, 0)); });
  return mergeGeometries(parts.map(strip));
}
// palmeira: tronco curvo em segmentos + 8 folhas arqueadas
function palmGeo() {
  const parts = []; let x = 0, y = 0;
  for (let i = 0; i < 6; i++) { const t = new THREE.CylinderGeometry(0.2 - i * 0.012, 0.24 - i * 0.012, 0.85, 7); t.translate(0, 0.42, 0); t.rotateZ(-0.09); t.translate(x, y, 0); x += -Math.sin(0.09 * 1) * 0.85 * 0.9; y += 0.85 * 0.99; parts.push(paint(strip(t), 0x9a7448)); }
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2, f = new THREE.SphereGeometry(1, 7, 5); f.scale(1.7, 0.07, 0.38); f.translate(1.55, 0, 0); f.rotateZ(-0.35); f.rotateY(a); f.translate(x, y + 0.1, 0); parts.push(paint(strip(f), k % 2 ? 0x2fa84f : 0x3cbf5c));
  }
  parts.push(paint(strip(new THREE.SphereGeometry(0.26, 8, 6).translate(x, y + 0.05, 0)), 0x6b4a2a));
  return mergeGeometries(parts);
}
// cristal: feixe de tres prismas hexagonais com ponta
function crystalGeo() {
  const parts = []; [[0, 0, 1.0, 0.34], [0.5, 0.15, 0.62, 0.24], [-0.4, -0.2, 0.7, 0.26]].forEach(([x, z, h, r], i) => {
    const b = new THREE.CylinderGeometry(r, r * 1.05, h, 6).translate(0, h / 2, 0), t = new THREE.ConeGeometry(r, h * 0.45, 6).translate(0, h + h * 0.225, 0), g = mergeGeometries([strip(b), strip(t)]); g.rotateZ(i ? (i % 2 ? 0.25 : -0.3) : 0); g.translate(x, 0, z); parts.push(g); });
  return mergeGeometries(parts);
}
// pedra modelada (KayKit) no lugar do dodecaedro; cada chamada devolve um dos 5 formatos
let rockN = 0;
const rockGeo = (r) => { const m = kkMesh('rock_single_' + 'ABCDE'[rockN++ % 5]); if (!m) return new THREE.DodecahedronGeometry(r); const g = m.geometry.clone(); g.scale(r * 3.4, r * 3.4, r * 3.4); return g; };
const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.9 }, o));
const glow = (c, i) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i || 0.8 });

// ctx: { groundH, riverDepth, trailX, WORLD, rand }
export function makeBiome(realm, ctx) {
  const { groundH, riverDepth, trailX, WORLD } = ctx, R = WORLD + 10, grp = new THREE.Group(), d = new THREE.Object3D();
  const ok = (x, z, wet) => Math.hypot(x, z) > 8 && Math.abs(x - trailX(z)) > 3 && (wet || riverDepth(x, z) < 0.02);
  // espalha n instancias; place(i,x,z) devolve {y, sx, sy, sz, ry, col}
  function scatter(geo, mat, n, build, o) {
    o = o || {}; n = Math.round(n * (o.dens || DENS)); const m = new THREE.InstancedMesh(geo, mat, n); let k = 0;
    for (let tries = 0; k < n && tries < n * 6; tries++) {
      const x = (Math.random() * 2 - 1) * R, z = (Math.random() * 2 - 1) * R;
      if (!ok(x, z, o.wet)) continue;
      const b = build(x, z, k); d.position.set(x, groundH(x, z) + (b.y || 0), z); d.rotation.set(b.rx || 0, b.ry || 0, b.rz || 0); d.scale.set(b.sx || 1, b.sy || 1, b.sz || 1); d.updateMatrix();
      m.setMatrixAt(k, d.matrix); if (b.col != null) m.setColorAt(k, new THREE.Color(b.col)); k++;
    }
    for (; k < n; k++) { d.position.set(9999, 0, 9999); d.scale.setScalar(1); d.rotation.set(0, 0, 0); d.updateMatrix(); m.setMatrixAt(k, d.matrix); }
    m.frustumCulled = false; m.castShadow = o.shadow !== false; m.instanceMatrix.needsUpdate = true; grp.add(m); return m;
  }
  const rnd = (a, b) => a + Math.random() * (b - a), pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  if (realm === 'mares') {
    scatter(palmGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }), 320, () => { const s = rnd(0.8, 1.5); return { y: 0, sx: s, sy: s, sz: s, ry: rnd(0, 6) }; });
    const corals = [0xff7aa8, 0xff9a4a, 0xc77dff, 0xffd166];
    scatter(new THREE.DodecahedronGeometry(0.7), std(0xffffff), 420, () => { const s = rnd(0.5, 1.5); return { y: 0.4 * s, sx: s * 0.7, sy: s * rnd(0.8, 2), sz: s * 0.7, ry: rnd(0, 6), col: pick(corals) }; });
    // poças de maré
    const pool = new THREE.MeshStandardMaterial({ color: 0x3fb4e8, transparent: true, opacity: 0.7, roughness: 0.1 });
    scatter(new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2), pool, 70, () => { const s = rnd(2.2, 5.5); return { y: 0.06, sx: s, sz: s * rnd(0.6, 1) }; }, { shadow: false });
    scatter(new THREE.SphereGeometry(0.28, 8, 6), std(0xfff3e0), 160, () => ({ y: 0.15, sx: 1, sy: 0.6, sz: 1 }), { shadow: false });   // conchas/perolas
  } else if (realm === 'sombras') {
    scatter(new THREE.CylinderGeometry(0.12, 0.34, 3.6, 5), std(0x241d2e), 360, () => { const s = rnd(0.8, 1.7); return { y: 1.8 * s, sx: s, sy: s, sz: s, rz: rnd(-0.25, 0.25), ry: rnd(0, 6) }; });
    scatter(new THREE.ConeGeometry(0.35, 2, 4), std(0x241d2e), 360, () => { const s = rnd(0.8, 1.6); return { y: 3 * s, sx: s, sy: s, sz: s, rz: rnd(-0.9, 0.9), ry: rnd(0, 6) }; });
    scatter(new THREE.BoxGeometry(0.9, 1.5, 0.3), std(0x77708a), 260, () => ({ y: 0.7, ry: rnd(-0.4, 0.4), rz: rnd(-0.15, 0.15), sy: rnd(0.7, 1.3) }));
    scatter(rockGeo(0.8), std(0x3a3347), 260, () => { const s = rnd(0.6, 1.6); return { y: 0.3 * s, sx: s, sy: s * 0.7, sz: s }; });
    scatter(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0x9be8ff }), 90, () => ({ y: rnd(0.8, 2.6) }), { shadow: false });   // fogos-fatuos
  } else if (realm === 'arcana') {
    const cols = [0xb388ff, 0x4fe3ff, 0xff8fe0, 0x8fa4ff];
    scatter(crystalGeo(), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9a8cff, emissiveIntensity: 0.18, roughness: 0.25, metalness: 0.1 }), 300, () => { const s = rnd(0.6, 1.6); return { y: 0, sx: s, sy: s * rnd(0.8, 1.6), sz: s, ry: rnd(0, 6), col: pick(cols) }; });
    scatter(new THREE.BoxGeometry(1.6, 0.35, 1.6), glow(0x6a5acd, 0.5), 80, () => { const s = rnd(0.6, 1.4); return { y: rnd(2.2, 5), sx: s, sy: s, sz: s, ry: rnd(0, 6) }; });   // pedras de runa flutuantes
    scatter(rockGeo(0.8), std(0x4a4eb0), 220, () => { const s = rnd(0.6, 1.5); return { y: 0.3 * s, sx: s, sy: s * 0.7, sz: s }; });
  } else if (realm === 'planalto') {
    scatter(cactusGeo(), std(0x4f9a4a), 300, () => { const s = rnd(0.7, 1.6); return { y: 0, sx: s, sy: s, sz: s, ry: rnd(0, 6) }; });
    scatter(new THREE.CylinderGeometry(5, 6.5, 5, 7), std(0xc9833f), 26, () => { const s = rnd(0.7, 1.7); return { y: 2.2 * s, sx: s, sy: s * rnd(0.8, 1.6), sz: s, ry: rnd(0, 6) }; });   // mesas de arenito
    scatter(rockGeo(0.8), std(0xb98048), 300, () => { const s = rnd(0.6, 1.6); return { y: 0.3 * s, sx: s, sy: s * 0.7, sz: s }; });
    scatter(new THREE.SphereGeometry(0.3, 6, 5), std(0xe8c36a), 200, () => ({ y: 0.2, sy: 0.7 }), { shadow: false });   // tufos secos
  } else if (realm === 'vazio') {
    scatter(new THREE.OctahedronGeometry(1), glow(0x5a2d9a, 0.5), 300, () => { const s = rnd(0.4, 1.6); return { y: rnd(1, 7), sx: s * 0.6, sy: s * 1.3, sz: s * 0.6, rx: rnd(0, 3), rz: rnd(0, 3), ry: rnd(0, 6) }; });
    scatter(new THREE.CylinderGeometry(0.9, 1.1, 5, 6), std(0x2a2736), 90, () => { const s = rnd(0.6, 1.5); return { y: 2.2 * s, sx: s, sy: s * rnd(0.4, 1.4), sz: s, rz: rnd(-0.2, 0.2) }; });
    scatter(rockGeo(0.8), std(0x1c1a26), 220, () => { const s = rnd(0.7, 1.8); return { y: 0.3 * s, sx: s, sy: s * 0.7, sz: s }; });
  } else if (realm === 'primeva') {
    // pinheiros ja existem no cenario base; aqui entram cogumelos gigantes e samambaias
    const caps = [0xe0405a, 0xb06ae0, 0xf0a040];
    scatter(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 8), std(0xf3ead2), 200, () => { const s = rnd(0.7, 1.8); return { y: 1.1 * s, sx: s, sy: s, sz: s }; });
    const cap = new THREE.InstancedMesh(new THREE.SphereGeometry(1.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0xffffff), grp.children[0].count); cap.frustumCulled = false; cap.castShadow = true;
    const st = grp.children[0], mtx = new THREE.Matrix4(), pv = new THREE.Vector3(), qv = new THREE.Quaternion(), sv = new THREE.Vector3();
    for (let i = 0; i < st.count; i++) { st.getMatrixAt(i, mtx); mtx.decompose(pv, qv, sv); d.position.set(pv.x, pv.y + 1.05 * sv.y, pv.z); d.scale.set(sv.x * 1.1, sv.y * 0.8, sv.z * 1.1); d.rotation.set(0, 0, 0); d.updateMatrix(); cap.setMatrixAt(i, d.matrix); cap.setColorAt(i, new THREE.Color(pick(caps))); }
    grp.add(cap);
    scatter(new THREE.ConeGeometry(0.5, 1.4, 5), std(0x2f9e44), 420, () => { const s = rnd(0.6, 1.4); return { y: 0.6 * s, sx: s, sy: s, sz: s, rz: rnd(-0.5, 0.5), ry: rnd(0, 6) }; }, { shadow: false });
  }
  grp.visible = false;
  return grp;
}
