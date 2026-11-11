// Efeitos visuais de combate: particulas brilhantes (aditivas), ondas de choque, flashes, cortes, raios e colunas de luz.
// Tudo usa mistura aditiva (brilha mais que o cenario) e geometrias/texturas compartilhadas para ficar leve no celular.
import * as THREE from 'three';

const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const ease = (k) => 1 - (1 - k) * (1 - k);

export function createVfx(scene) {
  // ---- texturas ----
  const GLOW = tex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.7)'); r.addColorStop(0.6, 'rgba(255,255,255,.18)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  const RING = tex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.55, 'rgba(255,255,255,.04)'); r.addColorStop(0.82, 'rgba(255,255,255,.55)'); r.addColorStop(0.92, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
  const COLUMN = tex(64, 128, (g) => { const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(255,255,255,0)'); h.addColorStop(0.5, 'rgba(255,255,255,1)'); h.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = h; g.fillRect(0, 0, 64, 128); g.globalCompositeOperation = 'destination-in'; const v = g.createLinearGradient(0, 0, 0, 128); v.addColorStop(0, 'rgba(0,0,0,.0)'); v.addColorStop(0.15, 'rgba(0,0,0,.8)'); v.addColorStop(0.8, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = v; g.fillRect(0, 0, 64, 128); });
  const SLASH = tex(256, 256, (g) => {   // meia-lua: borda externa forte, afinando para dentro
    const gr = g.createRadialGradient(128, 128, 60, 128, 128, 126); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,.35)'); gr.addColorStop(0.9, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(128 - 46, 128, 112, 0, Math.PI * 2); g.fill();
  });
  const PLANE = new THREE.PlaneGeometry(1, 1);
  const addMat = (map, color, op) => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity: op == null ? 1 : op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });

  // ---- particulas (um unico Points) ----
  const MAXP = 1600;
  const pos = new Float32Array(MAXP * 3), col = new Float32Array(MAXP * 4), siz = new Float32Array(MAXP);
  const vel = new Float32Array(MAXP * 3), life = new Float32Array(MAXP), maxL = new Float32Array(MAXP), s0 = new Float32Array(MAXP), s1 = new Float32Array(MAXP), grav = new Float32Array(MAXP), drag = new Float32Array(MAXP), a0 = new Float32Array(MAXP);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('col', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('size', new THREE.BufferAttribute(siz, 1).setUsage(THREE.DynamicDrawUsage));
  const pmat = new THREE.ShaderMaterial({
    uniforms: { map: { value: GLOW }, uScale: { value: 500 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'attribute vec4 col; attribute float size; varying vec4 vC; uniform float uScale; void main(){ vC = col; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(1.0, size * uScale / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec4 vC; uniform sampler2D map; void main(){ float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vC.rgb, vC.a * a); }',
  });
  const points = new THREE.Points(geo, pmat); points.frustumCulled = false; points.renderOrder = 5; scene.add(points);
  let cur = 0; const _c = new THREE.Color();
  function emit(x, y, z, vx, vy, vz, lf, sa, sb, color, alpha, g, d) {
    const i = cur; cur = (cur + 1) % MAXP;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    life[i] = maxL[i] = lf; s0[i] = sa; s1[i] = sb; _c.set(color); col[i * 4] = _c.r; col[i * 4 + 1] = _c.g; col[i * 4 + 2] = _c.b; a0[i] = alpha == null ? 1 : alpha; grav[i] = g || 0; drag[i] = d || 0;
  }
  const R = () => Math.random() - 0.5;

  // explosao de particulas: n particulas em todas as direcoes (up = tendencia para cima)
  function burst(p, o) {
    o = o || {}; const n = o.n || 18, sp = o.speed || 5, up = o.up == null ? 0.4 : o.up, y0 = (o.y == null ? 1 : o.y) + (p.y || 0);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, u = (Math.random() - 0.3) * 2 * up, f = 0.35 + Math.random() * 0.65, s = sp * f;
      emit(p.x, y0, p.z, Math.cos(a) * s, u * sp * 0.8, Math.sin(a) * s, (o.life || 0.7) * (0.6 + Math.random() * 0.6), (o.size || 0.5) * (0.7 + Math.random() * 0.6), 0.04, o.color == null ? 0xffffff : o.color, 1, o.grav == null ? 6 : o.grav, o.drag == null ? 1.2 : o.drag);
    }
  }
  // particulas que sobem em espiral/colunas (cura, bencao)
  function rise(p, color, n, radius, height, size) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius; emit(p.x + Math.cos(a) * r, 0.1, p.z + Math.sin(a) * r, 0, 1.5 + Math.random() * 2.2, 0, (height || 2.4) / 2.5 * (0.7 + Math.random() * 0.6), (size || 0.35) * (0.7 + Math.random() * 0.6), 0.05, color, 1, -0.3, 0.3); }
  }
  // anel de particulas que se expande no chao
  function ringSparks(p, color, radius, n, size) {
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + Math.random() * 0.2, s = radius * 2.4; emit(p.x, 0.3, p.z, Math.cos(a) * s, 0.8 + Math.random() * 1.2, Math.sin(a) * s, 0.45 + Math.random() * 0.2, size || 0.5, 0.05, color, 1, 3, 3.2); }
  }
  function spiral(p, color, radius, n) {   // vortice: particulas girando para fora
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 6, k = i / n, r0 = 0.6 + k * radius * 0.25; emit(p.x + Math.cos(a) * r0, 0.4 + k * 2.2, p.z + Math.sin(a) * r0, Math.cos(a + 1.4) * radius * 1.5, 0.8 + Math.random(), Math.sin(a + 1.4) * radius * 1.5, 0.7 + Math.random() * 0.3, 0.55, 0.05, color, 1, -0.4, 1.0); }
  }
  function trail(p, color, size, y) { emit(p.x + R() * 0.15, (y == null ? p.y : y) + R() * 0.15, p.z + R() * 0.15, R() * 0.6, R() * 0.6 + 0.3, R() * 0.6, 0.35 + Math.random() * 0.15, size || 0.45, 0.02, color, 0.9, 0, 2); }

  // ---- efeitos de malha ----
  const list = [];
  const add = (obj, dur, tick, end) => { scene.add(obj); list.push({ obj, t: 0, dur, tick, end }); };
  const glowMats = new Map();
  function glowSprite(color, scale, op) {   // sprite que acompanha projeteis/orbes (material compartilhado por cor)
    let m = glowMats.get(color); if (!m) { m = new THREE.SpriteMaterial({ map: GLOW, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }); glowMats.set(color, m); }
    const s = new THREE.Sprite(m); s.scale.setScalar(scale); s.renderOrder = 6; return s;
  }
  function flash(p, color, size, dur, y) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.position.set(p.x, y == null ? 1.2 : y, p.z); s.renderOrder = 7;
    add(s, dur || 0.3, (k) => { s.scale.setScalar(size * (0.35 + 0.9 * ease(k))); s.material.opacity = (1 - k) * (1 - k); }, () => s.material.dispose());
  }
  function shock(p, color, radius, dur, y) {
    const m = new THREE.Mesh(PLANE, addMat(RING, color, 1)); m.rotation.x = -Math.PI / 2; m.position.set(p.x, y || 0.18, p.z); m.renderOrder = 4;
    add(m, dur || 0.5, (k) => { m.scale.setScalar(2 * radius * (0.12 + 0.88 * ease(k))); m.material.opacity = Math.pow(1 - k, 1.4); }, () => m.material.dispose());
  }
  function column(p, color, h, w, dur) {   // coluna de luz (duas faces cruzadas)
    const g = new THREE.Group();
    for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(PLANE, addMat(COLUMN, color, 1)); m.rotation.y = i * Math.PI / 2; m.scale.set(w, h, 1); m.position.y = h / 2; g.add(m); }
    g.position.set(p.x, p.y || 0, p.z); g.renderOrder = 6;
    add(g, dur || 0.5, (k) => { const s = 1 - k * 0.5; g.scale.set(s, 1, s); g.children.forEach(m => { m.material.opacity = Math.pow(1 - k, 1.2); }); }, () => g.children.forEach(m => m.material.dispose()));
  }
  function slash(p, ang, r, arc, color, dur, y) {   // corte em meia-lua no ar
    const m = new THREE.Mesh(PLANE, addMat(SLASH, color, 1)); m.rotation.x = -Math.PI / 2; m.rotation.z = ang - Math.PI / 2; m.renderOrder = 5;
    const g = new THREE.Group(); g.add(m); g.position.set(p.x, y == null ? 0.9 : y, p.z);
    const wide = Math.max(0.6, arc / (Math.PI * 0.7));
    add(g, dur || 0.28, (k) => { const s = r * 2 * (0.7 + 0.45 * ease(k)); m.scale.set(s, s * wide, 1); m.material.opacity = Math.pow(1 - k, 1.1); g.rotation.y = (k - 0.5) * 0.5; }, () => m.material.dispose());
    for (let i = 0; i < 7; i++) { const a = ang + (Math.random() - 0.5) * arc, rr = r * (0.7 + Math.random() * 0.4); emit(p.x + Math.sin(a) * rr, (y == null ? 0.9 : y) + R() * 0.5, p.z + Math.cos(a) * rr, Math.sin(a) * 3, R() * 2, Math.cos(a) * 3, 0.3 + Math.random() * 0.2, 0.35, 0.03, color, 1, 2, 2.5); }
  }
  function scorch(p, r, dur) {   // marca queimada no chao
    const m = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({ map: GLOW, color: 0x1a0c05, transparent: true, opacity: 0.55, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.07, p.z); m.scale.setScalar(r * 2.2);
    add(m, dur || 2.5, (k) => { m.material.opacity = 0.55 * (1 - k); }, () => m.material.dispose());
  }
  function bolt(p, color, h) {   // raio serrilhado do ceu ate o alvo
    const pts = []; const H = h || 16, N = 9;
    for (let i = 0; i <= N; i++) { const t = i / N; pts.push(new THREE.Vector3(p.x + (i === 0 || i === N ? 0 : R() * 1.6), H * (1 - t), p.z + (i === 0 || i === N ? 0 : R() * 1.6))); }
    const grp = new THREE.Group();
    [[color, 1], [0xffffff, 1]].forEach(([c, w], j) => {
      const g = new THREE.BufferGeometry().setFromPoints(pts), l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      if (j === 0) { l.position.x += 0.06; } grp.add(l);
    });
    add(grp, 0.35, (k) => { grp.children.forEach(l => { l.material.opacity = (1 - k) * (Math.random() > 0.25 ? 1 : 0.3); }); }, () => grp.children.forEach(l => { l.geometry.dispose(); l.material.dispose(); }));
    column(p, color, H, 2.2, 0.4); flash(p, color, 5, 0.35, 0.8); burst(p, { color, n: 14, speed: 6, up: 0.8, size: 0.4, life: 0.5 });
  }
  function update(dt, camera, viewH) {
    pmat.uniforms.uScale.value = viewH * 0.5 / Math.tan(camera.fov * Math.PI / 360);
    for (let i = 0; i < MAXP; i++) {
      if (life[i] <= 0) { siz[i] = 0; continue; }
      life[i] -= dt; const k = 1 - Math.max(0, life[i]) / maxL[i];
      if (life[i] <= 0) { siz[i] = 0; col[i * 4 + 3] = 0; continue; }
      const dr = Math.max(0, 1 - drag[i] * dt);
      vel[i * 3] *= dr; vel[i * 3 + 2] *= dr; vel[i * 3 + 1] = vel[i * 3 + 1] * dr - grav[i] * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] = Math.max(0.05, pos[i * 3 + 1] + vel[i * 3 + 1] * dt); pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      siz[i] = s0[i] + (s1[i] - s0[i]) * k; col[i * 4 + 3] = a0[i] * (1 - k) * (k < 0.08 ? k / 0.08 : 1);
    }
    geo.attributes.position.needsUpdate = geo.attributes.col.needsUpdate = geo.attributes.size.needsUpdate = true;
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i]; f.t += dt; const k = Math.min(1, f.t / f.dur); f.tick(k);
      if (k >= 1) { scene.remove(f.obj); if (f.end) f.end(); list.splice(i, 1); }
    }
  }
  function clear() { list.forEach(f => { scene.remove(f.obj); if (f.end) f.end(); }); list.length = 0; life.fill(0); }
  return { emit, burst, rise, ringSparks, spiral, trail, flash, shock, column, slash, scorch, bolt, glowSprite, update, clear };
}
