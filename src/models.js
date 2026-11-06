import * as THREE from 'three';

export const std = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
export const metal = (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.6, roughness: 0.3 });
export const glow = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.8 });
export const shadowAll = (o) => o.traverse(m => { if (m.isMesh) m.castShadow = true; });

function limb(r, h, color, x, y) {
  const geo = new THREE.CylinderGeometry(r, r, h, 8); geo.translate(0, -h / 2, 0);
  const m = new THREE.Mesh(geo, std(color)); m.position.set(x, y, 0); return m;
}

function bladeMesh(len, w, tint) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.025), new THREE.MeshStandardMaterial({ color: tint || 0xcfeeff, metalness: 0.6, roughness: 0.25, emissive: tint ? 0x8a6a10 : 0x2a6f9a })); b.position.y = len / 2 + 0.1;
  const gd = new THREE.Mesh(new THREE.BoxGeometry(w * 3, 0.06, 0.06), std(0xc9a227)); gd.position.y = 0.05;
  const gr = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 6), std(0x5a3a1a)); gr.position.y = -0.08;
  g.add(b, gd, gr); return g;
}

// def: { cls, color(capa), outfit, skin, hairColor, hairStyle, eyeColor, face }
export function makeHeroProcedural(def) {
  const g = new THREE.Group(), color = def.color, outfit = def.outfit != null ? def.outfit : 0xf2efe9, cls = def.cls;
  const skin = def.skin != null ? def.skin : 0xffe0bd;
  const hairC = def.hairColor != null ? def.hairColor : new THREE.Color(color).multiplyScalar(0.45).getHex();
  const hairStyle = def.hairStyle || 'spiky', face = def.face || 'calm', eyeC = def.eyeColor != null ? def.eyeColor : 0x111111;
  const hairMat = std(hairC);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 4, 10), std(outfit)); body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), std(skin)); head.position.y = 1.65;
  const legL = limb(0.12, 0.6, 0x2c3e50, -0.16, 0.62), legR = limb(0.12, 0.6, 0x2c3e50, 0.16, 0.62);
  const armL = limb(0.1, 0.55, outfit, -0.43, 1.3), armR = limb(0.1, 0.55, outfit, 0.43, 1.3);
  // mãos na cor da pele
  [armL, armR].forEach(a => { const h = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), std(skin)); h.position.y = -0.56; a.add(h); });
  const capeGeo = new THREE.BoxGeometry(0.6, 1.0, 0.05); capeGeo.translate(0, -0.5, 0);
  const cape = new THREE.Mesh(capeGeo, std(color)); cape.position.set(0, 1.5, -0.34); cape.rotation.x = 0.12;
  g.add(body, head, legL, legR, armL, armR, cape);
  g.userData = { legL, legR, armL, armR, cape };

  // ---- cabelo ----
  if (hairStyle !== 'bald') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.37, 18, 14, 0, Math.PI * 2, 0, Math.PI * (hairStyle === 'short' ? 0.5 : 0.58)), hairMat); cap.position.y = 1.7; g.add(cap);
    const hasHat = cls === 'mage';
    if (hairStyle === 'spiky' && !hasHat) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 6), hairMat); s.position.set(0, 2.1, -0.05); g.add(s); }
    if (hairStyle === 'long') { const l = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.95, 0.14), hairMat); l.position.set(0, 1.4, -0.27); g.add(l); }
    if (hairStyle === 'ponytail') {
      const t = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), hairMat); t.position.set(0, 1.78, -0.38);
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.03, 0.75, 8), hairMat); tail.position.set(0, 1.35, -0.45); tail.rotation.x = -0.15; g.add(t, tail);
    }
    if (hairStyle === 'bun' && !hasHat) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), hairMat); b.position.set(0, 2.06, -0.08); g.add(b); }
    if (hairStyle === 'mohawk' && !hasHat) for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 5), hairMat); s.position.set(0, 2.0 - Math.abs(i - 2) * 0.05, -0.2 + i * 0.1); g.add(s); }
  }

  // ---- rosto ----
  const eyeW = std(0xffffff), eyeI = std(eyeC), brow = std(hairC);
  [-0.12, 0.12].forEach(x => {
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), eyeW); w.position.set(x, 1.68, 0.29); w.scale.set(1, face === 'fierce' ? 0.7 : 1, 0.6);
    const i = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), eyeI); i.position.set(x, 1.68, 0.33);
    if (cls === 'sorcerer') { i.material = glow(eyeC); }
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 0.02), brow); br.position.set(x, 1.78 + (face === 'smile' ? 0.01 : 0), 0.32);
    br.rotation.z = face === 'fierce' ? -Math.sign(x) * 0.4 : face === 'smile' ? Math.sign(x) * 0.12 : 0;
    g.add(w, i, br);
  });
  const mouthMat = std(0x7a2f2f);
  if (face === 'smile') { const m = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 12, Math.PI), mouthMat); m.rotation.z = Math.PI; m.position.set(0, 1.56, 0.33); g.add(m); }
  else if (face === 'fierce') { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), mouthMat); m.position.set(0, 1.54, 0.33); m.rotation.z = 0.15; g.add(m); }
  else { const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.016, 0.02), mouthMat); m.position.set(0, 1.55, 0.335); g.add(m); }

  // ---- equipamento e silhueta por classe ----
  const pauldrons = (col) => [-0.42, 0.42].forEach(x => { const p = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), metal(col)); p.position.set(x, 1.5, 0); g.add(p); });

  if (cls === 'warrior') {
    const sw = bladeMesh(0.95, 0.09); sw.position.set(0, -0.55, 0.05); sw.rotation.x = Math.PI / 2; armR.add(sw);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 16), metal(0x9aa3ad)); sh.rotation.z = Math.PI / 2; sh.position.set(-0.14, -0.3, 0.05); armL.add(sh);
    const em = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.07, 12), std(color)); em.rotation.z = Math.PI / 2; em.position.set(-0.18, -0.3, 0.05); armL.add(em);
    pauldrons(0x9aa3ad);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.1), metal(0x9aa3ad)); plate.position.set(0, 1.05, 0.28); g.add(plate);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 6), std(color)); plume.position.set(0, 2.15, -0.05); plume.rotation.x = -0.5; g.add(plume);
  } else if (cls === 'paladin') {
    const sw = bladeMesh(1.0, 0.1, 0xfff1b0); sw.position.set(0, -0.55, 0.05); sw.rotation.x = Math.PI / 2; armR.add(sw);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 6), metal(0xf2e6b0)); sh.rotation.z = Math.PI / 2; sh.position.set(-0.14, -0.3, 0.05); armL.add(sh);
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.08), glow(0xffd166)), c2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.3), glow(0xffd166));
    c1.position.set(-0.19, -0.3, 0.05); c2.position.set(-0.19, -0.24, 0.05); armL.add(c1, c2);
    pauldrons(0xf0d27a);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 8, 24), glow(0xffe08a)); halo.rotation.x = Math.PI / 2; halo.position.y = 2.2; g.add(halo); g.userData.halo = halo;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.1), metal(0xf0d27a)); plate.position.set(0, 1.05, 0.28); g.add(plate);
  } else if (cls === 'assassin') {
    [armR, armL].forEach(a => { const d = bladeMesh(0.45, 0.07); d.position.set(0, -0.55, 0.05); d.rotation.x = Math.PI / 2; a.add(d); });
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.08, 8, 16), std(color)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.4; g.add(scarf);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.07, 16), std(0x1a1a24)); band.position.y = 1.8; g.add(band);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.03), std(0x1a1a24)); tail.position.set(0.12, 1.55, -0.38); tail.rotation.z = 0.2; g.add(tail);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 12), std(0x1a1a24)); belt.position.y = 0.75; g.add(belt);
  } else if (cls === 'mage') {
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.7, 6), std(0x6b4423)); staff.position.set(0, -0.3, 0.1); armR.add(staff);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), glow(color)); orb.position.set(0, 0.6, 0.1); armR.add(orb);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.85, 12), std(0x2d3a8c)); hat.position.y = 2.28; hat.rotation.z = 0.12;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.04, 16), std(0x2d3a8c)); brim.position.y = 1.93;
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), glow(0xffe08a)); star.position.set(0, 1.98, 0.3);
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.55, 0.55, 12), std(outfit)); robe.position.y = 0.55;
    g.add(hat, brim, star, robe);
  } else if (cls === 'sorcerer') {
    const orbs = new THREE.Group(); orbs.position.y = 1.3;
    for (let i = 0; i < 3; i++) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), glow(color)); const a = i / 3 * Math.PI * 2; o.position.set(Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8); orbs.add(o); }
    g.add(orbs); g.userData.orbs = orbs;
    [-0.42, 0.42].forEach(x => { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 5), glow(color)); sp.position.set(x, 1.7, 0); sp.rotation.z = -Math.sign(x) * 0.6; g.add(sp); });
  } else if (cls === 'druid') {
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.6, 6), std(0x6b4423)); staff.position.set(0, -0.3, 0.1); armR.add(staff);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), glow(0x7CFC00)); orb.position.set(0, 0.55, 0.1); armR.add(orb);
    for (let i = 0; i < 6; i++) { const lf = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 5), std(0x3fae49)); const a = i / 6 * Math.PI * 2; lf.position.set(Math.cos(a) * 0.3, 2.0, Math.sin(a) * 0.3); lf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(lf); }
    [-0.2, 0.2].forEach(x => { const an = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.5, 5), std(0x8a6a3a)); an.position.set(x, 2.1, 0); an.rotation.z = -Math.sign(x) * 0.5; g.add(an); });
    const mantle = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 0.3, 10), std(0x5a7a3a)); mantle.position.y = 1.35; g.add(mantle);
  } else if (cls === 'archer') {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 6, 18, Math.PI), std(0x8a5a2b)); bow.rotation.set(0, Math.PI / 2, 0); bow.position.set(-0.1, -0.5, 0.25); armL.add(bow);
    const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8), std(0x7a4a22)); quiver.position.set(0.15, 1.45, -0.42); quiver.rotation.z = 0.3; g.add(quiver);
    for (let i = 0; i < 3; i++) { const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 5), std(0xeeeeee)); tip.position.set(0.15 + i * 0.03 - 0.03, 1.8, -0.42); g.add(tip); }
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.4, 5), std(color)); feather.position.set(0.25, 2.0, 0); feather.rotation.z = -0.5; g.add(feather);
    const tunic = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.25, 10), std(0x5a7a3a)); tunic.position.y = 0.72; g.add(tunic);
  }
  shadowAll(g); return g;
}
