// Arena PvP: um coliseu circular aberto. Devolve um objeto com a mesma interface da caverna (clamp, camPull, dispose...)
// para o jogo reaproveitar o modo "lugar fechado" (chao plano, sem floresta, camera que nao atravessa a parede).
import * as THREE from 'three';

export const ARENA_R = 30, WALL_H = 3.4;

export function buildArena() {
  const g = new THREE.Group();
  const sand = new THREE.MeshStandardMaterial({ color: 0xa8935f, roughness: 1 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x8d8579, roughness: 1, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 1, flatShading: true });
  const red = new THREE.MeshBasicMaterial({ color: 0xff5a4f, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const gold = new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const flame = new THREE.MeshBasicMaterial({ color: 0xff9a3c });
  const gc = document.createElement('canvas'); gc.width = gc.height = 64; { const x = gc.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,190,110,1)'); gr.addColorStop(0.35, 'rgba(255,140,60,.45)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }
  const glowTex = new THREE.CanvasTexture(gc);
  const spriteMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });

  // chao: areia com aneis pintados
  const fl = new THREE.Mesh(new THREE.CircleGeometry(ARENA_R, 64), sand); fl.rotation.x = -Math.PI / 2; fl.position.y = 0.01; g.add(fl);
  const ring = (r0, r1, m, y) => { const r = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 72), m); r.rotation.x = -Math.PI / 2; r.position.y = y; g.add(r); };
  ring(ARENA_R * 0.5, ARENA_R * 0.53, red, 0.05); ring(ARENA_R * 0.17, ARENA_R * 0.2, gold, 0.06); ring(ARENA_R - 1.4, ARENA_R - 1.1, gold, 0.05);
  { const star = new THREE.Mesh(new THREE.RingGeometry(ARENA_R * 0.3, ARENA_R * 0.32, 8), red); star.rotation.x = -Math.PI / 2; star.position.y = 0.055; g.add(star); }

  // muro baixo de pedra em volta, com pilares e tochas
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R + 0.3, ARENA_R + 1.2, WALL_H, 64, 1, true), stone); wall.material = stone.clone(); wall.material.side = THREE.DoubleSide; wall.position.y = WALL_H / 2; g.add(wall);
  const cap = new THREE.Mesh(new THREE.TorusGeometry(ARENA_R + 0.3, 0.35, 6, 64), dark); cap.rotation.x = Math.PI / 2; cap.position.y = WALL_H; g.add(cap);
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2, qx = Math.sin(a) * (ARENA_R - 0.6), qz = Math.cos(a) * (ARENA_R - 0.6);
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, WALL_H + 1.2, 7), dark); pil.position.set(qx, (WALL_H + 1.2) / 2, qz); g.add(pil);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), flame); f.position.set(qx, WALL_H + 1.5, qz); g.add(f);
    const sp = new THREE.Sprite(spriteMat); sp.scale.set(4, 4, 1); sp.position.set(qx, WALL_H + 1.5, qz); g.add(sp);
  }
  // arquibancada simples: degraus fora do muro (so visuais)
  for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R + 3 + i * 2.6, ARENA_R + 1.5 + i * 2.6, 1 + i * 1.1, 64, 1, true), i % 2 ? dark : stone); st.material = st.material.clone(); st.material.side = THREE.DoubleSide; st.position.y = (1 + i * 1.1) / 2 + 0.6 + i * 0.1; g.add(st); }

  const light = new THREE.PointLight(0xffc27a, 90, 70, 1.5); light.position.set(0, 9, 0); g.add(light);
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  const API = {
    group: g, light, pvp: true, sealed: false, hw: ARENA_R, arena: { x: 0, z: 0, R: ARENA_R }, stations: [], bossSpawned: true,
    realm: 'forest', ai: 0, start: { x: 0, z: 0 }, startYaw: 0,
    inArena(x, z, pad) { return Math.hypot(x, z) <= ARENA_R - (pad || 0); },
    // mantem o ponto dentro do circulo
    clamp(p, pad) { pad = pad == null ? 0.8 : pad; const d = Math.hypot(p.x, p.z), lim = ARENA_R - pad; if (d > lim) { p.x *= lim / d; p.z *= lim / d; } },
    // a camera nao passa do muro: encurta a linha heroi->camera se ela sair do circulo
    camPull(hx, hz, cx, cy, cz) {
      for (let i = 1; i <= 24; i++) { const t = i / 24, x = hx + (cx - hx) * t, z = hz + (cz - hz) * t; if (Math.hypot(x, z) > ARENA_R + 0.5) return Math.max(0.25, (i - 1.5) / 24); }
      return 1;
    },
    // lugares de nascimento: em volta do centro, longe uns dos outros
    spawnPoint() { const a = Math.random() * Math.PI * 2, r = ARENA_R * (0.45 + Math.random() * 0.3); return { x: Math.sin(a) * r, z: Math.cos(a) * r }; },
    dispose() { g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== spriteMat && o.material !== flame && o.material !== red && o.material !== gold) o.material.dispose(); }); spriteMat.dispose(); glowTex.dispose(); flame.dispose(); red.dispose(); gold.dispose(); },
  };
  return API;
}

// barrinha de vida que fica acima do rival (so aparece na arena)
export function hpTag() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 20; const x = c.getContext('2d');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false, transparent: true, depthTest: false }));
  s.scale.set(2.2, 0.34, 1); s.renderOrder = 11; s.visible = false; let last = -1;
  s.userData.set = (pct) => {
    pct = Math.max(0, Math.min(100, Math.round(pct))); if (pct === last) return; last = pct;
    x.clearRect(0, 0, 128, 20); x.fillStyle = 'rgba(0,0,0,.7)'; x.fillRect(0, 0, 128, 20);
    x.fillStyle = pct > 50 ? '#5fdc6a' : pct > 25 ? '#ffc933' : '#ff5a4f'; x.fillRect(3, 3, 122 * pct / 100, 14);
    x.strokeStyle = '#fff'; x.lineWidth = 2; x.strokeRect(1, 1, 126, 18); t.needsUpdate = true;
  };
  s.userData.set(100); return s;
}

// ---- Regras de dano do PvP (separadas do dano contra monstros) ----
// O golpe que voce da num monstro NAO e o que o outro jogador recebe. O jogador atingido calcula o proprio dano:
//   base = 4,5% da vida maxima dele; o poder do atacante (dano bruto / poder do atingido) ajusta de x0.5 ate x2.2;
//   nenhum golpe tira mais que 12% da vida maxima. Defesa e armadura de quem recebe reduzem como de costume.
export const PVP = { BASE: 0.045, LO: 0.5, HI: 2.2, CAP: 0.12, MIN_GAP: 0.12, INVULN: 3 };
export function pvpDamage(raw, victimPower, victimMaxHp, mitigation) {
  const ratio = Math.min(PVP.HI, Math.max(PVP.LO, (+raw || 0) / Math.max(1, victimPower)));
  const d = victimMaxHp * Math.min(PVP.CAP, PVP.BASE * ratio) * (mitigation == null ? 1 : mitigation);
  return Math.max(1, d);
}
