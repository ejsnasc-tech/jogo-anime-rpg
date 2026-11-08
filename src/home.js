// Interior das casas/apartamentos: sala + moveis comprados (catalogo procedural).
import * as THREE from 'three';

export const ROOMS = {
  house: { w: 18, d: 15, label: 'Casa', ew: 4, ed: 3, maxFl: 4 },
  apt: { w: 12, d: 10, label: 'Apartamento', ew: 3, ed: 2.5, maxFl: 2 },
};
export const SZ_MAX = 3;
export const roomDims = (kind, sz) => { const R = ROOMS[kind], n = Math.max(0, Math.min(SZ_MAX, sz | 0)); return { w: R.w + R.ew * n, d: R.d + R.ed * n }; };
export const FLOOR_TINT = [0xeadfc8, 0xdbe6f2, 0xf2dfe8, 0xdff0df];

const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.9, flatShading: true }, o));
function part(parent, geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// k, icone, nome, preco, largura (x), profundidade (z), construtor (frente = +z)
export const FURN = [
  { k: 'bed', icon: '\u{1F6CF}️', name: 'Cama', price: 400, w: 2.2, d: 3.4, build(g) {
    part(g, B(2.1, 0.5, 3.3), M(0x8a5a2b), 0, 0.25, 0); part(g, B(1.9, 0.35, 3), M(0xf4efe6), 0, 0.65, 0.05);
    part(g, B(1.9, 0.25, 1.4), M(0x4f86c6), 0, 0.85, 0.75); part(g, B(1.5, 0.22, 0.6), M(0xffffff), 0, 0.95, -1.1); part(g, B(2.1, 1.3, 0.2), M(0x6b4423), 0, 0.9, -1.6); } },
  { k: 'sofa', icon: '\u{1F6CB}️', name: 'Sofa', price: 300, w: 3, d: 1.4, build(g) {
    part(g, B(3, 0.6, 1.3), M(0xc0392b), 0, 0.3, 0); part(g, B(3, 0.9, 0.35), M(0xa93226), 0, 0.85, -0.5);
    part(g, B(0.35, 0.95, 1.3), M(0xa93226), -1.33, 0.55, 0); part(g, B(0.35, 0.95, 1.3), M(0xa93226), 1.33, 0.55, 0); part(g, B(2.2, 0.2, 0.9), M(0xd64a3b), 0, 0.7, 0.1); } },
  { k: 'table', icon: '\u{1FA91}', name: 'Mesa', price: 200, w: 2.2, d: 1.3, build(g) {
    part(g, B(2.2, 0.15, 1.3), M(0x9a6a35), 0, 0.9, 0);
    [[-0.95, -0.5], [0.95, -0.5], [-0.95, 0.5], [0.95, 0.5]].forEach(([x, z]) => part(g, B(0.15, 0.85, 0.15), M(0x6b4423), x, 0.42, z));
    part(g, new THREE.CylinderGeometry(0.22, 0.28, 0.3, 8), M(0xffffff), 0, 1.12, 0); part(g, new THREE.SphereGeometry(0.2, 8, 6), M(0xff7f9f), 0, 1.38, 0); } },
  { k: 'chair', icon: '\u{1F4BA}', name: 'Cadeira', price: 80, w: 0.9, d: 0.9, build(g) {
    part(g, B(0.8, 0.12, 0.8), M(0xb5793a), 0, 0.55, 0); part(g, B(0.8, 0.9, 0.12), M(0xb5793a), 0, 1.0, -0.35);
    [[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]].forEach(([x, z]) => part(g, B(0.1, 0.5, 0.1), M(0x6b4423), x, 0.25, z)); } },
  { k: 'shelf', icon: '\u{1F4DA}', name: 'Estante', price: 250, w: 2.2, d: 0.7, build(g) {
    part(g, B(2.2, 2.8, 0.6), M(0x5a3b1e), 0, 1.4, 0); const cols = [0xc0392b, 0x2e86c1, 0xf5c542, 0x27ae60, 0x8e44ad];
    [0.55, 1.35, 2.15].forEach((y, r) => { part(g, B(2, 0.5, 0.1), M(0x2a1a0c), 0, y, 0.2); for (let i = 0; i < 6; i++) part(g, B(0.22, 0.4 + (i % 2) * 0.1, 0.35), M(cols[(i + r) % 5]), -0.85 + i * 0.34, y, 0.28); }); } },
  { k: 'rug', icon: '\u{1F7E5}', name: 'Tapete', price: 120, w: 3.2, d: 3.2, build(g) {
    part(g, new THREE.CylinderGeometry(1.6, 1.6, 0.04, 28), M(0x7b3fa0), 0, 0.03, 0); part(g, new THREE.CylinderGeometry(1.2, 1.2, 0.05, 28), M(0xf5c542), 0, 0.045, 0); part(g, new THREE.CylinderGeometry(0.8, 0.8, 0.06, 28), M(0x7b3fa0), 0, 0.06, 0); } },
  { k: 'plant', icon: '\u{1FAB4}', name: 'Planta', price: 60, w: 0.9, d: 0.9, build(g) {
    part(g, new THREE.CylinderGeometry(0.3, 0.22, 0.5, 8), M(0xb5651d), 0, 0.25, 0); part(g, new THREE.SphereGeometry(0.55, 8, 6), M(0x2f9e44), 0, 0.95, 0); part(g, new THREE.SphereGeometry(0.38, 8, 6), M(0x40b455), 0.2, 1.4, 0.1); } },
  { k: 'lamp', icon: '\u{1F4A1}', name: 'Luminaria', price: 90, w: 0.7, d: 0.7, build(g) {
    part(g, new THREE.CylinderGeometry(0.25, 0.3, 0.1, 8), M(0x333333), 0, 0.05, 0); part(g, new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6), M(0x333333), 0, 0.95, 0);
    part(g, new THREE.CylinderGeometry(0.3, 0.45, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffc94d, emissiveIntensity: 0.9 }), 0, 2, 0); } },
  { k: 'wardrobe', icon: '\u{1F6AA}', name: 'Guarda-roupa', price: 300, w: 2, d: 0.9, build(g) {
    part(g, B(2, 3, 0.85), M(0x7a4e2a), 0, 1.5, 0); part(g, B(0.04, 2.7, 0.05), M(0x2a1a0c), 0, 1.5, 0.44);
    part(g, B(0.1, 0.3, 0.08), M(0xf5c542), -0.15, 1.5, 0.46); part(g, B(0.1, 0.3, 0.08), M(0xf5c542), 0.15, 1.5, 0.46); } },
  { k: 'fireplace', icon: '\u{1F525}', name: 'Lareira', price: 500, w: 2.8, d: 1.1, build(g) {
    part(g, B(2.8, 2.4, 1), M(0x8d939c), 0, 1.2, 0); part(g, B(1.4, 1.2, 0.2), M(0x1a1a1a), 0, 0.8, 0.45);
    part(g, new THREE.ConeGeometry(0.4, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0xff8a30, emissive: 0xff5a00, emissiveIntensity: 1.2 }), 0, 0.7, 0.42); part(g, B(3, 0.2, 1.2), M(0x5a3b1e), 0, 2.5, 0); } },
  { k: 'piano', icon: '\u{1F3B9}', name: 'Piano', price: 900, w: 2.4, d: 1.4, build(g) {
    part(g, B(2.3, 1.1, 1), M(0x15151a), 0, 0.95, -0.1); part(g, B(2.3, 0.12, 0.55), M(0xf4f4f4), 0, 1.0, 0.55); part(g, B(2.5, 0.08, 1.2), M(0x15151a), 0, 1.55, -0.1);
    [-1, 1].forEach(x => part(g, B(0.15, 0.6, 0.15), M(0x15151a), x, 0.3, 0.45)); part(g, B(0.8, 0.12, 0.5), M(0x8a5a2b), 0, 0.5, 1.1); } },
  { k: 'aquarium', icon: '\u{1F420}', name: 'Aquario', price: 600, w: 2.2, d: 1, build(g) {
    part(g, B(2.2, 0.9, 0.9), M(0x3a2a1a), 0, 0.45, 0);
    part(g, B(2, 1.1, 0.8), new THREE.MeshStandardMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.45, roughness: 0.1 }), 0, 1.45, 0);
    [[-0.5, 1.5, 0.1, 0xff8a30], [0.4, 1.3, -0.1, 0xffd54f], [0.1, 1.7, 0.1, 0xff5a7a]].forEach(([x, y, z, c]) => part(g, new THREE.SphereGeometry(0.14, 8, 6), M(c), x, y, z)); } },
  { k: 'painting', icon: '\u{1F5BC}️', name: 'Quadro', price: 150, w: 1.8, d: 0.3, build(g) {
    part(g, B(1.7, 1.2, 0.1), M(0x5a3b1e), 0, 2.2, 0); part(g, B(1.5, 1, 0.12), M(0x3a8fd9), 0, 2.2, 0.02); part(g, new THREE.CircleGeometry(0.28, 14), new THREE.MeshBasicMaterial({ color: 0xffd54f }), 0.3, 2.35, 0.09); part(g, B(1.5, 0.35, 0.13), M(0x2f9e44), 0, 1.92, 0.025); } },
  // ---- premium (compradas com gemas na Lia) ----
  { k: 'throne', icon: '👑', name: 'Trono Dourado', price: 0, prem: 60, w: 1.9, d: 1.7, build(g) {
    const gold = M(0xd4af37, { metalness: 0.6, roughness: 0.35 });
    part(g, B(1.7, 0.4, 1.5), M(0x7b1e1e), 0, 0.2, 0); part(g, B(1.4, 0.6, 1.2), M(0xb71c1c), 0, 0.7, 0.05); part(g, B(1.7, 2.6, 0.3), gold, 0, 1.5, -0.65);
    [-0.85, 0.85].forEach(x => part(g, B(0.25, 0.95, 1.3), gold, x, 0.85, 0)); part(g, new THREE.OctahedronGeometry(0.28), new THREE.MeshStandardMaterial({ color: 0x66e0ff, emissive: 0x2299cc, emissiveIntensity: 0.9 }), 0, 3, -0.65); } },
  { k: 'fountain', icon: '⛲', name: 'Chafariz de Cristal', price: 0, prem: 90, w: 3, d: 3, build(g) {
    part(g, new THREE.CylinderGeometry(1.4, 1.5, 0.5, 18), M(0xa9afb8), 0, 0.25, 0); part(g, new THREE.CylinderGeometry(1.2, 1.2, 0.1, 18), new THREE.MeshStandardMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.7 }), 0, 0.5, 0);
    part(g, new THREE.CylinderGeometry(0.2, 0.3, 1.6, 8), M(0xa9afb8), 0, 1.1, 0); part(g, new THREE.SphereGeometry(0.4, 12, 8), new THREE.MeshStandardMaterial({ color: 0x8fe3ff, emissive: 0x2a7fb0, emissiveIntensity: 0.8 }), 0, 2.1, 0); } },
  { k: 'dragonstatue', icon: '🐉', name: 'Estátua do Dragão', price: 0, prem: 120, w: 2.3, d: 1.9, build(g) {
    const st = M(0x8d939c), gold = M(0xd4af37, { metalness: 0.5, roughness: 0.4 });
    part(g, B(1.8, 0.5, 1.5), M(0x5a606b), 0, 0.25, 0); part(g, new THREE.SphereGeometry(0.7, 10, 8), st, 0, 1.2, 0).scale.set(1, 0.9, 1.4);
    const neck = part(g, new THREE.CylinderGeometry(0.2, 0.3, 1.2, 8), st, 0, 1.9, 0.6); neck.rotation.x = 0.5; part(g, new THREE.SphereGeometry(0.32, 10, 8), st, 0, 2.5, 1.0).scale.set(1, 0.8, 1.3);
    [-1, 1].forEach(x => { const w = part(g, B(1.3, 0.08, 1), gold, x * 0.95, 1.8, -0.2); w.rotation.z = -x * 0.5; });
    [-0.14, 0.14].forEach(x => part(g, new THREE.SphereGeometry(0.07, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff4040 }), x, 2.55, 1.25)); } },
  { k: 'chandelier', icon: '🕯️', name: 'Lustre Imperial', price: 0, prem: 50, w: 1.8, d: 1.8, build(g) {
    const gold = M(0xd4af37, { metalness: 0.6, roughness: 0.3 }); part(g, new THREE.CylinderGeometry(0.03, 0.03, 1, 6), gold, 0, 3.1, 0);
    part(g, new THREE.TorusGeometry(0.75, 0.06, 6, 20), gold, 0, 2.6, 0).rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; part(g, new THREE.SphereGeometry(0.1, 6, 6), new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffc94d, emissiveIntensity: 1.2 }), Math.cos(a) * 0.75, 2.75, Math.sin(a) * 0.75); } } },
];
export const furnByKey = (k) => FURN.find(f => f.k === k);

export function makeFurniture(k) {
  const def = furnByKey(k), g = new THREE.Group(); def.build(g); g.userData.k = k; return g;
}
// tamanho do espaco ocupado considerando a rotacao (0..3)
export const footprint = (k, r) => { const f = furnByKey(k); return r % 2 ? [f.d, f.w] : [f.w, f.d]; };

function plankTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#b58a55' : '#c39a63'; g.fillRect(0, i * 32, 256, 32); g.fillStyle = 'rgba(60,35,10,.35)'; g.fillRect(0, i * 32, 256, 2); g.fillRect((i * 83) % 256, i * 32, 2, 32); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildRoom(kind, sz) {
  const R = roomDims(kind, sz), hw = R.w / 2, hd = R.d / 2, g = new THREE.Group();
  const tex = plankTexture(); tex.repeat.set(R.w / 4, R.d / 4);
  const floor = part(g, B(R.w, 0.3, R.d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), 0, -0.15, 0); floor.castShadow = false;
  const wallM = M(kind === 'house' ? 0xeadfc8 : 0xdfe6ee), trim = M(0x6b4423), H = 5.6;
  part(g, B(R.w + 0.6, H, 0.4), wallM, 0, H / 2, -hd - 0.2);
  part(g, B(0.4, H, R.d + 0.4), wallM, -hw - 0.2, H / 2, 0); part(g, B(0.4, H, R.d + 0.4), wallM, hw + 0.2, H / 2, 0);
  part(g, B(R.w, 0.25, 0.2), trim, 0, 0.12, -hd + 0.1); part(g, B(0.2, 0.25, R.d), trim, -hw + 0.1, 0.12, 0); part(g, B(0.2, 0.25, R.d), trim, hw - 0.1, 0.12, 0);
  part(g, B(R.w, 1.4, 0.1), M(0xc8b896), 0, 0.7, -hd + 0.05);   // rodape de madeira clara
  // janela no fundo
  const win = M(0x9fe3ff, { emissive: 0x4fa8d8, emissiveIntensity: 0.7 });
  part(g, B(2.6, 1.8, 0.1), win, -hw * 0.45, 3, -hd + 0.06); part(g, B(2.9, 2.1, 0.08), trim, -hw * 0.45, 3, -hd + 0.03);
  part(g, B(0.1, 1.8, 0.12), trim, -hw * 0.45, 3, -hd + 0.1); part(g, B(2.6, 0.1, 0.12), trim, -hw * 0.45, 3, -hd + 0.1);
  // porta de saida na frente (arco)
  part(g, B(0.3, 3.4, 0.3), trim, -1.4, 1.7, hd); part(g, B(0.3, 3.4, 0.3), trim, 1.4, 1.7, hd);
  part(g, B(2.2, 0.06, 0.9), M(0xc0392b), 0, 0.03, hd - 0.7);
  [[0, 0], [-hw * 0.5, -hd * 0.45], [hw * 0.5, -hd * 0.45], [-hw * 0.5, hd * 0.45], [hw * 0.5, hd * 0.45]].forEach(([x, z]) => { const L = new THREE.PointLight(0xffe2b0, 22, Math.max(20, R.w * 1.1), 1.6); L.position.set(x, 4.6, z); g.add(L); });
  return { group: g, hw, hd, kind, wallM };
}
