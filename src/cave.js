// Caverna do chefe: um corredor sinuoso fechado que termina numa camara circular onde mora o chefe do reino.
import * as THREE from 'three';

const PATH = [[0, 120], [0, 98], [-26, 78], [-26, 48], [14, 26], [16, -6], [-18, -30], [-20, -60], [8, -82], [10, -100]];
export const CAVE_HW = 6.5, ARENA_R = 24, WALL_H = 4.2;
const GAP = 0.36;   // abertura da camara do chefe (radianos)

const hash = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

export function buildCave(rockColor, glowColor) {
  const curve = new THREE.CatmullRomCurve3(PATH.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.5);
  const N = Math.round(curve.getLength() / 2.5);
  const pts = curve.getSpacedPoints(N);
  const g = new THREE.Group(), hw = CAVE_HW;
  const arena = { x: pts[N].x, z: pts[N].z - ARENA_R + 3, R: ARENA_R };
  const base = new THREE.Color(rockColor).lerp(new THREE.Color(0x8a8296), 0.55);
  const rock = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true, side: THREE.DoubleSide });
  const floorM = new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(0.75), roughness: 1, side: THREE.DoubleSide });

  // normais do caminho
  const nrm = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)]; const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1; return { x: -tz / l, z: tx / l }; });
  const side = (s, i, w) => ({ x: pts[i].x + nrm[i].x * hw * s * w, z: pts[i].z + nrm[i].z * hw * s * w });

  // chao do corredor
  { const pos = [], idx = [];
    for (let i = 0; i <= N; i++) { const L = side(1, i, 1.15), R = side(-1, i, 1.15); pos.push(L.x, 0, L.z, R.x, 0, R.z); if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, floorM); m.receiveShadow = false; g.add(m); }
  // paredes irregulares (mais escuras no topo)
  [1, -1].forEach((s, si) => {
    const pos = [], col = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const jag = 0.85 + hash(i, si) * 0.5, out = 1.05 + hash(i, si + 7) * 0.25;
      const b = side(s, i, 1.0), t = side(s, i, out);
      const h = WALL_H * jag;
      pos.push(b.x, 0, b.z, t.x, h, t.z);
      const c0 = base.clone().multiplyScalar(0.85 + hash(i, 3) * 0.2), c1 = base.clone().multiplyScalar(0.35);
      col.push(c0.r, c0.g, c0.b, c1.r, c1.g, c1.b);
      if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, rock));
  });
  // camara circular
  { const fl = new THREE.Mesh(new THREE.CircleGeometry(arena.R, 56), floorM); fl.rotation.x = -Math.PI / 2; fl.position.set(arena.x, 0.01, arena.z); g.add(fl);
    const wallG = new THREE.CylinderGeometry(arena.R, arena.R * 1.04, WALL_H * 1.25, 56, 1, true, GAP, Math.PI * 2 - GAP * 2);
    const cols = []; const p = wallG.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = p.getY(i) > 0 ? 0.35 : 0.9; const c = base.clone().multiplyScalar(k * (0.9 + hash(i, 5) * 0.2)); cols.push(c.r, c.g, c.b); }
    wallG.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const w = new THREE.Mesh(wallG, rock); w.position.set(arena.x, WALL_H * 0.62, arena.z); g.add(w);
    const gl = new THREE.Color(glowColor);
    const rune = new THREE.Mesh(new THREE.RingGeometry(arena.R * 0.42, arena.R * 0.46, 64), new THREE.MeshBasicMaterial({ color: gl, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); rune.rotation.x = -Math.PI / 2; rune.position.set(arena.x, 0.05, arena.z); g.add(rune);
    const rune2 = new THREE.Mesh(new THREE.RingGeometry(arena.R * 0.18, arena.R * 0.2, 6), new THREE.MeshBasicMaterial({ color: gl, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })); rune2.rotation.x = -Math.PI / 2; rune2.position.set(arena.x, 0.06, arena.z); g.add(rune2);
  }
  // estalagmites e tochas
  const stone = new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(1.1), roughness: 1, flatShading: true });
  const flame = new THREE.MeshBasicMaterial({ color: glowColor });
  const spriteMat = new THREE.SpriteMaterial({ color: glowColor, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 3; i < N; i += 2) for (const s of [1, -1]) {
    if (hash(i, s + 11) < 0.55) continue;
    const q = side(s, i, 0.88 + hash(i, s) * 0.08), h = 0.8 + hash(i, s + 3) * 1.6;
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.35 + hash(i, s + 5) * 0.4, h, 5), stone); c.position.set(q.x, h / 2, q.z); g.add(c);
  }
  for (let i = 8; i < N; i += 9) {
    const s = (i / 9) % 2 ? 1 : -1, q = side(s, i, 0.93);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.5, 5), stone); pole.position.set(q.x, 0.75, q.z); g.add(pole);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), flame); f.position.set(q.x, 1.7, q.z); g.add(f);
    const sp = new THREE.Sprite(spriteMat); sp.scale.set(4, 4, 1); sp.position.set(q.x, 1.7, q.z); g.add(sp);
  }
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2 + 0.2; if (Math.abs(a - Math.PI * 2) < GAP * 1.4 || a < GAP * 1.4) continue;
    const qx = arena.x + Math.sin(a) * (arena.R - 1.6), qz = arena.z + Math.cos(a) * (arena.R - 1.6);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2.2, 6), stone); pole.position.set(qx, 1.1, qz); g.add(pole);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), flame); f.position.set(qx, 2.5, qz); g.add(f);
    const sp = new THREE.Sprite(spriteMat); sp.scale.set(6, 6, 1); sp.position.set(qx, 2.5, qz); g.add(sp);
  }
  // pedra que fecha a entrada quando o chefe acorda
  const seal = new THREE.Mesh(new THREE.BoxGeometry(hw * 2.6, WALL_H * 1.25, 1.6), rock); seal.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(24 * 3).fill(0.3), 3));
  seal.position.set(arena.x, WALL_H * 0.62, arena.z + arena.R - 0.4); seal.visible = false; g.add(seal);
  const light = new THREE.PointLight(glowColor, 220, 46, 1.6); light.position.set(0, 3.2, 0); g.add(light);
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  const stations = [0.1, 0.26, 0.42, 0.58, 0.76].map((f, i) => { const j = Math.round(N * f); return { x: pts[j].x, z: pts[j].z, i, done: false }; });
  const API = {
    group: g, light, seal, sealed: false, pts, hw, arena, stations,
    start: { x: pts[0].x, z: pts[0].z }, startYaw: Math.atan2(pts[3].x - pts[0].x, pts[3].z - pts[0].z),
    // distancia ao eixo do corredor e indice mais proximo
    nearest(x, z) { let d = 1e9, bi = 0; for (let i = 0; i <= N; i++) { const dd = Math.hypot(x - pts[i].x, z - pts[i].z); if (dd < d) { d = dd; bi = i; } } return { d, i: bi }; },
    inArena(x, z, pad) { return Math.hypot(x - arena.x, z - arena.z) <= arena.R - (pad || 0); },
    // empurra o ponto para dentro do corredor ou da camara
    clamp(p, pad, sealed) {
      pad = pad == null ? 0.8 : pad;
      const dA = Math.hypot(p.x - arena.x, p.z - arena.z), okA = dA <= arena.R - pad;
      if (okA) return;
      const n = API.nearest(p.x, p.z), okC = !sealed && n.d <= hw - pad;
      if (okC) return;
      const q = pts[n.i], k = n.d > 1e-6 ? (hw - pad) / n.d : 0;
      const c = { x: q.x + (p.x - q.x) * k, z: q.z + (p.z - q.z) * k }, a = { x: arena.x + (p.x - arena.x) * (arena.R - pad) / (dA || 1), z: arena.z + (p.z - arena.z) * (arena.R - pad) / (dA || 1) };
      const dc = Math.hypot(c.x - p.x, c.z - p.z), da = Math.hypot(a.x - p.x, a.z - p.z);
      const r = (!sealed && dc < da) ? c : a; p.x = r.x; p.z = r.z;
    },
    // camera: ate onde (0..1) da linha heroi->camera nao atravessa a rocha
    camPull(hx, hz, cx, cy, cz) {
      const N2 = 30;
      for (let i = 1; i <= N2; i++) {
        const t = i / N2, y = 1.2 + (cy - 1.2) * t, x = hx + (cx - hx) * t, z = hz + (cz - hz) * t;
        if (y > WALL_H * 1.1) return 1;
        if (!API.inArena(x, z, -0.3) && API.nearest(x, z).d > hw + 0.3) return Math.max(0.2, (i - 1.5) / N2);
      }
      return 1;
    },
    dispose() { g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== spriteMat && o.material !== flame) o.material.dispose(); }); spriteMat.dispose(); flame.dispose(); },
  };
  return API;
}
