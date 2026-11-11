// Herois anime prontos no formato VRM (VRoid, licenca CC0). As animacoes sao as do KayKit, convertidas (retarget) para o esqueleto VRM.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const MAP = { hips: 'hips', spine: 'spine', chest: 'chest', head: 'head', 'upperarm.l': 'leftUpperArm', 'lowerarm.l': 'leftLowerArm', 'hand.l': 'leftHand', 'upperarm.r': 'rightUpperArm', 'lowerarm.r': 'rightLowerArm', 'hand.r': 'rightHand',
  'upperleg.l': 'leftUpperLeg', 'lowerleg.l': 'leftLowerLeg', 'foot.l': 'leftFoot', 'toes.l': 'leftToes', 'upperleg.r': 'rightUpperLeg', 'lowerleg.r': 'rightLowerLeg', 'foot.r': 'rightFoot', 'toes.r': 'rightToes' };
const SAN = (n) => n.replace(/\./g, '');   // o GLTFLoader tira os pontos dos nomes de osso nas trilhas
for (const k of Object.keys(MAP)) { MAP[SAN(k)] = MAP[k]; }
const SLOT = { 'handslotl': 'leftHand', 'handslotr': 'rightHand' };   // nomes ja sem ponto (GLTFLoader)

const bufs = {};
export const fetchVrm = (url) => bufs[url] || (bufs[url] = fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }));
// cada heroi na tela precisa da propria copia (ossos proprios): le o mesmo arquivo em cache de novo
export async function parseVrm(url, base) {
  const buf = await fetchVrm(url);
  const ld = new GLTFLoader(); ld.register((p) => new VRMLoaderPlugin(p));
  const g = await new Promise((res, rej) => ld.parse(buf.slice(0), base || '', res, rej));
  const vrm = g.userData.vrm; if (!vrm) throw new Error('sem VRM');
  VRMUtils.removeUnnecessaryVertices(g.scene); VRMUtils.combineSkeletons(g.scene);
  const v0 = vrm.meta && vrm.meta.metaVersion === '0'; if (v0) VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse(o => { o.frustumCulled = false; if (o.isMesh) o.castShadow = true; });
  const nr = vrm.humanoid.normalizedHumanBonesRoot; if (nr && !nr.parent) vrm.scene.add(nr);
  const box = new THREE.Box3().setFromObject(vrm.scene);
  return { vrm, v0, height: box.max.y - box.min.y, minY: box.min.y };
}

// converte os clipes do KayKit (ref = cena do KayKit em repouso) para ossos normalizados do VRM
export function retargetClips(ref, clips, vrm, v0) {
  ref.updateMatrixWorld(true);
  const restQ = {}, parQ = {}; ref.traverse(o => { if (o.isBone) { restQ[SAN(o.name)] = o.getWorldQuaternion(new THREE.Quaternion()); parQ[SAN(o.name)] = o.parent ? o.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion(); } });
  const hipsK = ref.getObjectByName('hips'), kh = hipsK ? Math.abs(hipsK.position.y) || 1 : 1;   // altura local do quadril em repouso (mesma unidade das trilhas)
  const vh = vrm.humanoid.getNormalizedBoneNode('hips').getWorldPosition(new THREE.Vector3()).y, sc = vh / kh;
  const out = [], q = new THREE.Quaternion();
  clips.forEach(c => {
    const tracks = [];
    c.tracks.forEach(t => {
      const [bone, prop] = [t.name.slice(0, t.name.lastIndexOf('.')), t.name.slice(t.name.lastIndexOf('.') + 1)], vb = MAP[bone]; if (!vb) return;
      const node = vrm.humanoid.getNormalizedBoneNode(vb); if (!node) return;
      if (prop === 'quaternion') {
        const v = new Float32Array(t.values.length);
        for (let i = 0; i < v.length; i += 4) {
          q.fromArray(t.values, i); q.premultiply(parQ[bone]).multiply(restQ[bone].clone().invert());
          v[i] = v0 ? -q.x : q.x; v[i + 1] = q.y; v[i + 2] = v0 ? -q.z : q.z; v[i + 3] = q.w;
        }
        tracks.push(new THREE.QuaternionKeyframeTrack(node.name + '.quaternion', t.times, v));
      } else if (prop === 'position' && vb === 'hips') {
        const v = new Float32Array(t.values.length);
        for (let i = 0; i < v.length; i += 3) { v[i] = t.values[i] * sc * (v0 ? -1 : 1); v[i + 1] = t.values[i + 1] * sc; v[i + 2] = t.values[i + 2] * sc * (v0 ? -1 : 1); }
        tracks.push(new THREE.VectorKeyframeTrack(node.name + '.position', t.times, v));
      }
    });
    out.push(new THREE.AnimationClip(c.name, c.duration, tracks));
  });
  return out;
}

// arma do KayKit (no, em repouso) -> osso da mao do VRM, mantendo posicao/rotacao em relacao ao corpo
export function attachProp(ref, vrm, v0, node, scaleK, scaleV) {
  const slot = node.parent && SLOT[node.parent.name]; if (!slot) return;
  const hand = vrm.humanoid.getNormalizedBoneNode(slot); if (!hand) return;
  ref.updateMatrixWorld(true);
  const hk = ref.getObjectByName(node.parent.name === 'handslotl' ? 'handl' : 'handr'), k = scaleK / scaleV;
  const p = node.getWorldPosition(new THREE.Vector3()).sub(hk.getWorldPosition(new THREE.Vector3())).multiplyScalar(k), r = node.getWorldQuaternion(new THREE.Quaternion());
  if (v0) { p.x = -p.x; p.z = -p.z; r.x = -r.x; r.z = -r.z; }
  const c = node.clone(true); c.position.copy(p); c.quaternion.copy(r); c.scale.setScalar(k); c.visible = true;
  c.traverse(o => { o.visible = true; if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  hand.add(c);
}

// ---- cores: cabelo, olhos, roupa e pele mudam trocando as texturas (cache por modelo+material+cor) ----
const tcache = new Map();
const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
function processTex(src, key, fn) {
  if (!src || !src.image) return { tex: src, info: null };
  if (tcache.has(key)) return tcache.get(key);
  const im = src.image, c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
  const id = x.getImageData(0, 0, c.width, c.height), info = fn(id.data); x.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c); t.flipY = src.flipY; t.colorSpace = src.colorSpace; t.wrapS = src.wrapS; t.wrapT = src.wrapT; t.anisotropy = 4;
  const r = { tex: t, info }; tcache.set(key, r); return r;
}
const rgbOf = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
function tintFn(hex, ref) {   // pinta com a cor mantendo luz/sombra do desenho (cabelo, olhos)
  const rgb = rgbOf(hex);
  return (d) => {
    let s = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 8) { s += lum(d, i); n++; }
    const mean = (s / Math.max(1, n)) || 1, m = ref || mean;
    for (let i = 0; i < d.length; i += 4) { const f = lum(d, i) / m; d[i] = Math.min(255, rgb[0] * f); d[i + 1] = Math.min(255, rgb[1] * f); d[i + 2] = Math.min(255, rgb[2] * f); }
    return mean;
  };
}
function hueFn(deg) {         // roupa: cores vivas giram o matiz; cinza/branco/preto ganham o tom escolhido
  const hue2 = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return (d) => {
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dl = mx - mn;
      let h = 0, s = 0;
      if (dl > 0.0001) { s = l > 0.5 ? dl / (2 - mx - mn) : dl / (mx + mn); h = mx === r ? ((g - b) / dl + (g < b ? 6 : 0)) : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; h /= 6; }
      if (s > 0.22) h = (h + deg / 360) % 1; else { h = deg / 360; s = 0.55 * (1 - Math.pow(Math.abs(2 * l - 1), 4)); }
      if (s === 0) continue;
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      d[i] = hue2(p, q, h + 1 / 3) * 255; d[i + 1] = hue2(p, q, h) * 255; d[i + 2] = hue2(p, q, h - 1 / 3) * 255;
    }
    return 1;
  };
}
function skinFn(hex, ref) {   // leva a cor media da pele para o tom escolhido
  const t = rgbOf(hex);
  return (d) => {
    let f = ref;
    if (!f) { let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 8) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } n = Math.max(1, n); f = [t[0] / (r / n || 1), t[1] / (g / n || 1), t[2] / (b / n || 1)]; }
    for (let i = 0; i < d.length; i += 4) { d[i] = Math.min(255, d[i] * f[0]); d[i + 1] = Math.min(255, d[i + 1] * f[1]); d[i + 2] = Math.min(255, d[i + 2] * f[2]); }
    return f;
  };
}
// def: vHair/vEye/vSkin = cor 0xRRGGBB, vCloth = giro de matiz em graus (null = original)
export function recolorVrm(vrm, def, key) {
  if (def.vHair == null && def.vCloth == null && def.vSkin == null && def.vEye == null) return;
  vrm.scene.traverse((o) => {
    if (!o.isMesh) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      if (!m || m.userData._rc) return;
      const nm = m.name || ''; let mode = null, val = null;
      if (/_HAIR/i.test(nm) || nm === 'hair') { mode = 'hair'; val = def.vHair; }
      else if (/_CLOTH/.test(nm)) { mode = 'cloth'; val = def.vCloth; }
      else if (/_SKIN/.test(nm)) { mode = 'skin'; val = def.vSkin; }
      else if (/EyeIris/.test(nm)) { mode = 'eye'; val = def.vEye; }
      if (!mode || val == null) return;
      m.userData._rc = true; let info = null;
      ['map', 'shadeMultiplyTexture'].forEach((slot) => {
        if (!m[slot]) return;
        const fn = mode === 'cloth' ? hueFn(val) : mode === 'skin' ? skinFn(val, slot === 'map' ? null : info) : tintFn(val, slot === 'map' ? null : info);
        const r = processTex(m[slot], [key, nm, slot, mode, val].join('|'), fn);
        if (slot === 'map') info = r.info; m[slot] = r.tex;
      });
      m.needsUpdate = true;
    });
  });
}


// Fisico: escala os ossos reais (a animacao so mexe em rotacao/posicao, entao a escala fica).
// Os eixos locais dos ossos variam de modelo para modelo: a escala e dada em eixos do MUNDO (x lado, y cima, z frente)
// no pose de repouso e convertida para os eixos locais de cada osso. Ossos filhos levam a escala inversa para nao esticarem.
// Devolve a escala de altura (aplicada na cena inteira).
const _bq = new THREE.Quaternion(), _bm = new THREE.Matrix4();
export function applyBuild(vrm, b) {
  if (!b) return 1;
  vrm.scene.updateMatrixWorld(true);
  const raw = (n) => vrm.humanoid.getRawBoneNode(n);
  const ws = (n, X, Y, Z) => {   // escala em eixos do mundo
    const o = raw(n); if (!o) return; o.getWorldQuaternion(_bq); _bm.makeRotationFromQuaternion(_bq);
    const e = _bm.elements, W = [X, Y, Z], L = [1, 1, 1];
    for (let i = 0; i < 3; i++) { let j = 0, m = 0; for (let k = 0; k < 3; k++) { const v = Math.abs(e[i * 4 + k]); if (v > m) { m = v; j = k; } } L[i] = W[j]; }
    o.scale.set(L[0], L[1], L[2]);
  };
  const uni = (n, k) => { const o = raw(n); if (o) o.scale.setScalar(k); };
  const w = b.w || 1, sh = b.sh || 1, ar = b.ar || 1, lg = b.lg || 1, hd = b.hd || 1, tw = w * sh;
  if (w !== 1) ws('spine', w, 1, w);
  if (sh !== 1) ws('chest', sh, 1, sh);
  if (tw !== 1) ['neck', 'leftShoulder', 'rightShoulder'].forEach(n => ws(n, 1 / tw, 1, 1 / tw));
  if (hd !== 1) uni('head', hd);
  if (ar !== 1) ['left', 'right'].forEach(sd => { ws(sd + 'UpperArm', 1, ar, ar); uni(sd + 'Hand', 1 / ar); });
  if (lg !== 1) ['left', 'right'].forEach(sd => { ws(sd + 'UpperLeg', lg, 1, lg); uni(sd + 'Foot', 1 / lg); });
  return b.h || 1;
}
