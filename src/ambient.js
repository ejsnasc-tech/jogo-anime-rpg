// Partículas de ambiente por reino (poeira de luz, vagalumes, brasas...) que acompanham o herói. Barato: 160 pontos, 1 draw call.
import * as THREE from 'three';

const N = 160, BOX = { x: 44, y: 11, z: 44 };
const STYLE = {   // cor, tamanho, velocidade subindo, deriva lateral, brilho piscando
  mares:    { c: 0xffffff, s: 0.7, up: 0.35, drift: 0.5, tw: 0.4, o: 0.75 },
  sombras:  { c: 0x8fe8ff, s: 0.8, up: 0.25, drift: 0.35, tw: 0.9, o: 0.9 },
  arcana:   { c: 0xc9a6ff, s: 0.8, up: 0.55, drift: 0.3, tw: 0.8, o: 0.95 },
  planalto: { c: 0xffd98a, s: 0.55, up: 0.05, drift: 2.2, tw: 0.2, o: 0.6 },
  primeva:  { c: 0xd6ff7a, s: 0.8, up: 0.15, drift: 0.7, tw: 1.0, o: 0.95 },
  vazio:    { c: 0xb05cff, s: 0.8, up: 0.9, drift: 0.2, tw: 0.7, o: 0.95 },
};

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createAmbient(scene) {
  const pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * BOX.x; pos[i * 3 + 1] = Math.random() * BOX.y; pos[i * 3 + 2] = (Math.random() - 0.5) * BOX.z; seed[i] = Math.random() * 6.28; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: dotTexture(), size: 0.35, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, color: 0xffffff, opacity: 0.8 });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
  let st = STYLE.mares, t = 0; const rel = new Float32Array(N * 3);   // posições relativas ao herói
  for (let i = 0; i < pos.length; i++) rel[i] = pos[i];
  return {
    setRealm(key) { st = STYLE[key] || STYLE.mares; mat.color.setHex(st.c); mat.size = st.s; },
    setVisible(v) { pts.visible = v; },
    update(dt, p) {
      t += dt; const wx = Math.sin(t * 0.3) * st.drift, wz = Math.cos(t * 0.23) * st.drift;
      for (let i = 0; i < N; i++) {
        let x = rel[i * 3] + (wx + Math.sin(t * 0.9 + seed[i]) * 0.4) * dt, y = rel[i * 3 + 1] + st.up * dt, z = rel[i * 3 + 2] + (wz + Math.cos(t * 0.7 + seed[i]) * 0.4) * dt;
        if (y > BOX.y) y = 0.2; if (x > BOX.x / 2) x -= BOX.x; else if (x < -BOX.x / 2) x += BOX.x; if (z > BOX.z / 2) z -= BOX.z; else if (z < -BOX.z / 2) z += BOX.z;
        rel[i * 3] = x; rel[i * 3 + 1] = y; rel[i * 3 + 2] = z;
        pos[i * 3] = p.x + x; pos[i * 3 + 1] = y + 0.2; pos[i * 3 + 2] = p.z + z;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = st.o * (0.78 + 0.22 * Math.sin(t * (1 + st.tw * 3)));
    },
  };
}
