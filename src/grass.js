// Grama de verdade: tufos de laminas finas (gradiente escuro na raiz -> claro na ponta) que balancam com o vento.
// Um unico InstancedMesh que acompanha o jogador: so nasce em volta dele, entao e leve. Cada reino tem cor/densidade proprias.
import * as THREE from 'three';
import { REALMS, baseRealm } from './data.js';

const hash2 = (ix, iz, s) => { const x = Math.sin(ix * 127.1 + iz * 311.7 + s * 74.7) * 43758.5453; return x - Math.floor(x); };

// tufo: 3 grupos de laminas cruzadas, cada lamina um triangulo fino e curvo (so 3 vertices extras na ponta)
function tuftGeo() {
  const pos = [], col = [], idx = [], blades = 5;
  for (let b = 0; b < blades; b++) {
    const a = b / blades * Math.PI + 0.3 * b, h = 0.7 + 0.5 * ((b * 37) % 7) / 7, w = 0.07, ox = Math.cos(b * 2.4) * 0.12, oz = Math.sin(b * 2.4) * 0.12, bend = 0.12 + 0.06 * (b % 3);
    const cx = Math.cos(a), cz = Math.sin(a), n = pos.length / 3;
    // base (2 vertices), meio (2), ponta (1)
    pos.push(ox - cx * w, 0, oz - cz * w, ox + cx * w, 0, oz + cz * w);
    pos.push(ox - cx * w * 0.7 + cz * bend * 0.4, h * 0.55, oz - cz * w * 0.7 - cx * bend * 0.4, ox + cx * w * 0.7 + cz * bend * 0.4, h * 0.55, oz + cz * w * 0.7 - cx * bend * 0.4);
    pos.push(ox + cz * bend, h, oz - cx * bend);
    col.push(0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1, 1);
    idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2, n + 2, n + 3, n + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('t', new THREE.Float32BufferAttribute(col.filter((_, i) => i % 3 === 0), 1)); g.setIndex(idx);
  g.computeVertexNormals();
  // normais todas para cima: a grama pega luz como o chao e nao fica escura nas costas
  const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, 0, 1, 0);
  return g;
}

const REALM = {
  primeva:  { base: 0x1f5a22, tip: 0x8fd24e, dens: 1.0, h: 0.8 },
  mares:    { base: 0x8a7a3a, tip: 0xe6dc9c, dens: 0.3, h: 0.7 },
  planalto: { base: 0x8a6a2a, tip: 0xe8c872, dens: 0.55, h: 0.75 },
  sombras:  { base: 0x1c1626, tip: 0x6a5a82, dens: 0.55, h: 0.7 },
  arcana:   { base: 0x262a7a, tip: 0xa89cff, dens: 0.6, h: 0.75 },
  vazio:    { base: 0x120f1c, tip: 0x7a3fd0, dens: 0.25, h: 0.6 },
};

export function createGrass(scene, ctx) {
  const { groundH, riverDepth, trailX } = ctx;
  const CELL = 0.75, RAD = 30, NMAX = 5200;
  const geo = tuftGeo();
  const uni = { uTime: { value: 0 }, uBase: { value: new THREE.Color() }, uTip: { value: new THREE.Color() }, uFade: { value: 1 } };
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float t; uniform float uTime; uniform vec3 uBase; uniform vec3 uTip; varying vec3 vGC;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
      float wv = sin(uTime * 1.7 + ip.x * 0.35 + ip.z * 0.27) + 0.5 * sin(uTime * 3.1 + ip.x * 0.9 - ip.z * 0.6);
      transformed.x += wv * 0.11 * t * t; transformed.z += cos(uTime * 1.3 + ip.z * 0.4) * 0.07 * t * t;
      vGC = mix(uBase, uTip, t) * (0.85 + 0.3 * fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453));`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGC;').replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( vGC, opacity );');
  };
  const mesh = new THREE.InstancedMesh(geo, mat, NMAX); mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.count = 0; mesh.visible = false;
  scene.add(mesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let ax = 1e9, az = 1e9, cfg = null, realm = '', densK = 1;
  function rebuild(px, pz) {
    ax = px; az = pz; let n = 0;
    const ix0 = Math.floor((px - RAD) / CELL), ix1 = Math.floor((px + RAD) / CELL), iz0 = Math.floor((pz - RAD) / CELL), iz1 = Math.floor((pz + RAD) / CELL);
    for (let ix = ix0; ix <= ix1 && n < NMAX; ix++) for (let iz = iz0; iz <= iz1 && n < NMAX; iz++) {
      const h0 = hash2(ix, iz, 1); if (h0 > cfg.dens * 0.6 * densK) continue;
      const x = (ix + hash2(ix, iz, 2)) * CELL, z = (iz + hash2(ix, iz, 3)) * CELL, d = Math.hypot(x - px, z - pz);
      if (d > RAD) continue;
      if (riverDepth(x, z) > 0.03 || Math.abs(x - trailX(z)) < 1.6 || Math.hypot(x, z) < 6) continue;
      const fade = Math.min(1, (RAD - d) / 7), s = (0.7 + hash2(ix, iz, 4) * 0.8) * cfg.h * fade;
      if (s < 0.08) continue;
      q.setFromAxisAngle(up, hash2(ix, iz, 5) * 6.283); pv.set(x, groundH(x, z) - 0.03, z); sv.set(s * 1.2, s, s * 1.2);
      m4.compose(pv, q, sv); mesh.setMatrixAt(n++, m4);
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
  }
  return {
    mesh,
    setRealm(key) { realm = key; const bk = baseRealm(key), rv = REALMS[key]; cfg = REALM[bk] || null; mesh.visible = !!cfg; ax = 1e9; if (cfg) { uni.uBase.value.setHex(cfg.base); uni.uTip.value.setHex(cfg.tip); if (rv && rv.base) { const t = new THREE.Color(rv.tint); uni.uBase.value.multiply(t); uni.uTip.value.lerp(t, 0.5); } } },
    // on = false esconde (cidade, casa, caverna, mini-mundos); low = menos grama (celular fraco)
    update(dt, px, pz, T, on, low) {
      mesh.visible = !!cfg && on; if (!mesh.visible) return;
      const dk = low ? 0.4 : 1; if (dk !== densK) { densK = dk; ax = 1e9; }
      uni.uTime.value = T;
      if (Math.hypot(px - ax, pz - az) > 2.5) rebuild(px, pz);
    },
  };
}
