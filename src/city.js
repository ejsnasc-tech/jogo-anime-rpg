// Cidade de Aurora: portão ao sul, avenida até a praça com a fonte, feira com os NPCs em arco ao norte e o Grande Salão no fundo.
import * as THREE from 'three';
import { PREMADE, buildPlayerHero, BASE } from './data.js';
import { makeHero, animateHero } from './actors.js';

export const CITY_R = 56;
export const CITY_SPAWN = [0, CITY_R - 5];
// Terrenos: casas no anel interno e predios de apartamentos no anel externo (cada um tem uma porta que leva ao interior).
export const PLOTS = (() => {
  const out = [];
  const ring = (r, n, off, kind, price, w, d) => {
    for (let i = 0; i < n; i++) {
      const a = (off + i * 360 / n) * Math.PI / 180, x = Math.round(r * Math.cos(a) * 10) / 10, z = Math.round(r * Math.sin(a) * 10) / 10;
      if (Math.abs(x) < 10 && z > 0) continue;                       // avenida do portao
      if (kind === 'house' && z < -18 && Math.abs(x) < 14) continue; // Grande Salao
      const len = Math.hypot(x, z), fx = -x / len, fz = -z / len;
      out.push({ id: 'p' + out.length, kind, x, z, w, d, price, ry: Math.atan2(fx, fz), door: [Math.round((x + fx * (d / 2 + 2.4)) * 10) / 10, Math.round((z + fz * (d / 2 + 2.4)) * 10) / 10] });
    }
  };
  ring(28, 12, 15, 'house', 3000, 7, 6);
  ring(46, 16, 11.25, 'apt', 1200, 9, 7);
  let h = 0, a = 0; out.forEach(p => { p.name = p.kind === 'house' ? 'Casa ' + (++h) : 'Apto ' + (++a); });
  return out;
})();

const arc = (deg, r) => [Math.round(r * Math.cos(deg * Math.PI / 180) * 10) / 10, -Math.round(r * Math.sin(deg * Math.PI / 180) * 10) / 10];
// feira em arco (da esquerda para a direita, de frente para a praça)
export const NPC_DEFS = [
  { role: 'smith', icon: '🔨', color: '#ff8a65', title: 'Gorim, o Ferreiro', pos: arc(155, 15), premade: 0, talk: 'Armas fortes vencem qualquer floresta! Traga ouro e materiais e eu deixo sua lâmina afiada.' },
  { role: 'armor', icon: '🛡️', color: '#4fc3f7', title: 'Mara, a Armeira', pos: arc(122, 15), premade: 7, talk: 'Uma boa armadura salva vidas. Já vi muito herói bonito cair por economizar no peitoral.' },
  { role: 'map', icon: '🗺️', color: '#ffd54f', title: 'Shiro, Guia dos Mapas', pos: arc(90, 15), premade: 2, talk: 'Cada floresta tem seus perigos e seus tesouros. Eu conheço todas. Para onde vamos, viajante?' },
  { role: 'merchant', icon: '💰', color: '#81c784', title: 'Ilyra, Mercadora', pos: arc(58, 15), premade: 3, talk: 'Amuletos raros e bons preços! E compro tudo o que você coletou nas florestas.' },
  { role: 'deco', icon: '\u{1FA91}', color: '#ffb74d', title: 'Lia, a Decoradora', pos: arc(188, 15), premade: 5, talk: 'Casa bonita \u00E9 casa feliz! Compre os m\u00F3veis aqui e depois coloque onde quiser dentro da sua casa.' },
  { role: 'market', icon: '🏪', color: '#4db6ac', title: 'Bento, o Negociante', pos: arc(352, 15), premade: 1, talk: 'Aqui os aventureiros negociam entre si! Compre equipamentos de outros jogadores ou ponha os seus à venda.' },
  { role: 'herald', icon: '📯', color: '#e57373', title: 'Vênia, a Arauta', pos: arc(322, 15), premade: 6, talk: 'Ouçam, ouçam! Rankings, o Chefe Mundial, guildas e as missões do dia. Tudo começa comigo!' },
  { role: 'craft', icon: '⚒️', color: '#a1887f', title: 'Tessa, a Artesã', pos: arc(212, 15), premade: 3, talk: 'Forjo armas do zero e lapido gemas que fazem seu equipamento brilhar. Traga materiais!' },
  { role: 'summoner', icon: '🔮', color: '#ba68c8', title: 'Orin, o Mestre das Vocações', pos: arc(25, 15), premade: 4, talk: 'Todo aventureiro pode dominar muitas vocações. Cada uma evolui no seu ritmo. Quer aprender uma nova?' },
];

function label(text, border) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 112;
  const g = c.getContext('2d');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const draw = (tx, bd) => {
    g.clearRect(0, 0, 512, 112);
    g.fillStyle = 'rgba(10,16,30,.8)'; g.beginPath(); g.roundRect(6, 10, 500, 92, 28); g.fill();
    g.strokeStyle = bd || '#f5c542'; g.lineWidth = 5; g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tx, 256, 58); t.needsUpdate = true;
  };
  draw(text, border);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false, transparent: true }));
  s.scale.set(5.2, 1.14, 1); s.userData.draw = draw; return s;
}

export function buildCity() {
  const group = new THREE.Group();
  const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.95, flatShading: true }, o));
  const add = (geo, m, x, y, z, parent) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; (parent || group).add(o); return o; };
  const flat = (geo, c, y) => { const o = add(geo, mat(c), 0, y, 0); o.rotation.x = -Math.PI / 2; o.castShadow = false; return o; };
  // textura pintada (Unirall): material com a cor de antes até a imagem carregar
  const texMat = (c, name, rx, ry) => {
    const m = mat(c, { flatShading: false }), im = new Image();
    im.onload = () => { const t = new THREE.Texture(im); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; m.map = t; m.color.setHex(0xffffff); m.needsUpdate = true; };
    im.src = BASE + 'img/city/' + name + '.webp'; return m;
  };
  const stone = mat(0xa9afb8), darkStone = mat(0x7d8591), wood = mat(0x8a5a2b), darkWood = mat(0x5a3b1e);

  // ---- chão: calçada, anéis da praça e avenida ----
  { const o = add(new THREE.CircleGeometry(CITY_R + 2, 96), texMat(0x9fcf7a, 'grama', 44, 44), 0, 0.04, 0); o.rotation.x = -Math.PI / 2; o.castShadow = false; }   // grama dentro da muralha
  { const o = add(new THREE.CircleGeometry(17.5, 56), texMat(0xcbbfa8, 'praca', 9, 9), 0, 0.06, 0); o.rotation.x = -Math.PI / 2; o.castShadow = false; }   // praça
  flat(new THREE.RingGeometry(9.5, 10.2, 56), 0x8e8470, 0.07);
  flat(new THREE.RingGeometry(16.6, 17.5, 56), 0x8e8470, 0.07);
  flat(new THREE.CircleGeometry(9.5, 48), 0xe1d8c5, 0.075);
  const AL = CITY_R + 1 - 17, AZ = (17 + CITY_R + 1) / 2;
  const ave = add(new THREE.PlaneGeometry(6.4, AL), texMat(0xc9b48a, 'rua', 5, AL / 1.3), 0, 0.08, AZ); ave.rotation.x = -Math.PI / 2; ave.castShadow = false;
  [-3.4, 3.4].forEach(x => { const e = add(new THREE.PlaneGeometry(0.5, AL), mat(0x8e8470), x, 0.085, AZ); e.rotation.x = -Math.PI / 2; e.castShadow = false; });
  flat(new THREE.RingGeometry(21.8, 24.2, 80), 0xc9b48a, 0.065);              // ruas dos bairros
  flat(new THREE.RingGeometry(33.3, 35.7, 96), 0xc9b48a, 0.065);

  // ---- fonte central ----
  add(new THREE.CylinderGeometry(3.2, 3.4, 0.9, 24), stone, 0, 0.45, 0);
  add(new THREE.CylinderGeometry(2.7, 2.7, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.2 }), 0, 0.88, 0);
  add(new THREE.CylinderGeometry(0.5, 0.65, 1.8, 10), stone, 0, 1.7, 0);
  add(new THREE.CylinderGeometry(1.5, 0.5, 0.4, 14), stone, 0, 2.7, 0);
  add(new THREE.SphereGeometry(0.75, 14, 10), new THREE.MeshStandardMaterial({ color: 0x8fe3ff, emissive: 0x2a7fb0, roughness: 0.3 }), 0, 3.5, 0);
  // canteiros de flores em volta da fonte
  const flowerCols = [0xff7f9f, 0xffd166, 0xffffff, 0xb28dff, 0xff8a65];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2, r = 4.6 + (i % 2) * 0.5;
    add(new THREE.SphereGeometry(0.28, 6, 5), mat(flowerCols[i % 5]), Math.cos(a) * r, 0.3, Math.sin(a) * r);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 4), mat(0x3a8a3a), Math.cos(a) * r, 0.15, Math.sin(a) * r);
  }
  // bancos
  [[-6.5, 5, 0.6], [6.5, 5, -0.6], [-6.5, -5, 2.5], [6.5, -5, -2.5]].forEach(([x, z, ry]) => {
    const b = new THREE.Group();
    add(new THREE.BoxGeometry(2.4, 0.2, 0.7), wood, 0, 0.7, 0, b); add(new THREE.BoxGeometry(0.2, 0.7, 0.6), darkWood, -1, 0.35, 0, b); add(new THREE.BoxGeometry(0.2, 0.7, 0.6), darkWood, 1, 0.35, 0, b);
    b.position.set(x, 0, z); b.rotation.y = Math.atan2(-x, -z) + 0; group.add(b);
  });

  // ---- terrenos: casas e predios (tocar para comprar/alugar e entrar) ----
  const wall = [0xefe2c8, 0xe6d3b3, 0xd9e4ec, 0xf0d9c4], roof = [0xc0392b, 0x2e86c1, 0x8e5a2b, 0x27ae60];
  const glass = mat(0x7fd6ff, { emissive: 0x1a4a6a });
  const plotViews = PLOTS.map((p, i) => {
    const h = new THREE.Group();
    if (p.kind === 'house') {
      add(new THREE.BoxGeometry(7, 4.6, 6), mat(wall[i % 4]), 0, 2.3, 0, h);
      add(new THREE.BoxGeometry(7.3, 0.4, 6.3), darkWood, 0, 0.2, 0, h);
      const r = add(new THREE.ConeGeometry(5.8, 3.2, 4), mat(roof[i % 4]), 0, 6.2, 0, h); r.rotation.y = Math.PI / 4; r.scale.z = 0.85;
      add(new THREE.BoxGeometry(1.5, 2.5, 0.2), darkWood, 0, 1.25, 3.05, h);
      [-2.3, 2.3].forEach(wx => { add(new THREE.BoxGeometry(1.2, 1.2, 0.2), glass, wx, 2.8, 3.05, h); add(new THREE.BoxGeometry(1.5, 0.2, 0.4), darkWood, wx, 2.1, 3.15, h); });
      add(new THREE.BoxGeometry(0.9, 2, 0.9), stone, 2.4, 6.4, -1.2, h);
    } else {
      add(new THREE.BoxGeometry(9, 12, 7), mat([0xd9cdb8, 0xc9d3dc, 0xe3c9b2, 0xcfd8c0][i % 4]), 0, 6, 0, h);
      add(new THREE.BoxGeometry(9.5, 0.7, 7.5), mat(0x6b5a4a), 0, 12.2, 0, h);
      add(new THREE.BoxGeometry(9.3, 0.4, 7.3), darkWood, 0, 0.2, 0, h);
      for (let fl = 0; fl < 3; fl++) [-3, 0, 3].forEach(wx => { add(new THREE.BoxGeometry(1.5, 1.6, 0.2), glass, wx, 4.4 + fl * 3, 3.55, h); add(new THREE.BoxGeometry(1.9, 0.2, 0.45), darkWood, wx, 3.5 + fl * 3, 3.65, h); });
      add(new THREE.BoxGeometry(1.8, 2.6, 0.2), darkWood, 0, 1.3, 3.55, h);
      add(new THREE.BoxGeometry(3.6, 0.25, 1.6), mat(roof[i % 4]), 0, 3, 4.1, h).rotation.x = 0.15;
    }
    h.position.set(p.x, 0, p.z); h.rotation.y = p.ry; group.add(h);
    const tag = label('', '#f5c542'); tag.position.set(p.x, p.kind === 'house' ? 9.2 : 14.6, p.z); group.add(tag);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.2, 24), new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(p.door[0], 0.13, p.door[1]); group.add(ring);
    return { p, tag, ring };
  });
  const setOwned = (homes, owners, myOid) => plotViews.forEach(v => {
    const own = !!homes[v.p.id], o = owners && owners[v.p.id], other = !own && o && o.oid !== myOid, house = v.p.kind === 'house';
    const txt = own ? '\u{1F3E0} ' + v.p.name + ' \u2014 seu lar' : other ? (house ? '\u{1F3E0} Casa de ' : '\u{1F3E2} Apto de ') + o.name : (house ? '\u{1F3E0} \u00C0 venda \u{1FA99}' : '\u{1F3E2} Alugar \u{1FA99}') + v.p.price;
    v.tag.userData.draw(txt, own ? '#66e08a' : other ? '#7fb8ff' : '#f5c542');
    v.ring.material.color.set(own ? 0x66e08a : other ? 0x7fb8ff : 0xffd54f);
  });

  // ---- Grande Salão ao norte ----
  {
    const g = new THREE.Group();
    add(new THREE.BoxGeometry(18, 7, 7), mat(0xe9e2d4), 0, 3.5, 0, g);
    add(new THREE.BoxGeometry(18.6, 0.6, 7.6), darkStone, 0, 7.2, 0, g);
    add(new THREE.CylinderGeometry(1.8, 2, 11, 10), stone, -9.5, 5.5, 0, g); add(new THREE.CylinderGeometry(1.8, 2, 11, 10), stone, 9.5, 5.5, 0, g);
    add(new THREE.ConeGeometry(2.6, 4, 10), mat(0xc0392b), -9.5, 13, 0, g); add(new THREE.ConeGeometry(2.6, 4, 10), mat(0xc0392b), 9.5, 13, 0, g);
    const rf = add(new THREE.ConeGeometry(8.6, 4, 4), mat(0x8e3b2a), 0, 9.4, 0, g); rf.rotation.y = Math.PI / 4; rf.scale.z = 0.45;
    add(new THREE.BoxGeometry(3, 4.2, 0.3), darkWood, 0, 2.1, 3.6, g);
    [-5.5, 5.5].forEach(x => add(new THREE.BoxGeometry(1.6, 2.4, 0.3), mat(0x7fd6ff, { emissive: 0x1a4a6a }), x, 3.8, 3.6, g));
    [-4, 0, 4].forEach(x => { add(new THREE.BoxGeometry(0.15, 2.8, 1.2), mat([0xc0392b, 0xf5c542, 0x2e86c1][(x + 4) / 4]), x * 0.8, 5.3, 3.8, g); });
    g.position.set(0, 0, -25.5); group.add(g);
  }

  // ---- muralha contínua com portão ao sul + torres ----
  const gap = 0.15;
  const wallMesh = add(new THREE.CylinderGeometry(CITY_R + 1.5, CITY_R + 1.5, 3.2, 120, 1, true, gap, Math.PI * 2 - gap * 2), mat(0xb7bdc6, { side: THREE.DoubleSide }), 0, 1.6, 0);
  wallMesh.castShadow = false;
  for (let i = 0; i < 30; i++) {   // ameias
    const a = gap + 0.15 + (i / 30) * (Math.PI * 2 - gap * 2 - 0.3);
    add(new THREE.BoxGeometry(1.8, 1, 1), stone, Math.sin(a) * (CITY_R + 1.5), 3.6, Math.cos(a) * (CITY_R + 1.5)).rotation.y = a;
  }
  [-1, 1].forEach(sd => {
    const x = sd * 5.2, z = CITY_R + 1.5;
    add(new THREE.CylinderGeometry(1.9, 2.2, 9, 12), stone, x, 4.5, z);
    add(new THREE.ConeGeometry(2.7, 3.4, 12), mat(0xc0392b), x, 10.7, z);
    add(new THREE.BoxGeometry(0.15, 3, 1.6), mat(sd > 0 ? 0xf5c542 : 0x2e86c1), x, 8.5, z + 2.1);
  });
  add(new THREE.BoxGeometry(10.4, 1.2, 1.6), stone, 0, 8.6, CITY_R + 1.5);   // arco do portão

  // ---- horizonte pintado ao redor (Unirall): some no céu, dá profundidade fora da muralha ----
  { const im = new Image(); im.onload = () => {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d');
      g.drawImage(im, 0, 0); g.globalCompositeOperation = 'destination-in';
      const gr = g.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.32, 'rgba(0,0,0,0.9)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(150, 150, 70, 48, 1, true), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, transparent: true, depthWrite: false, fog: true }));
      m.position.y = 28; m.renderOrder = -1; m.userData.noOutline = true; group.add(m);
    };
    im.src = BASE + 'img/city/horizonte.webp'; }

  // ---- árvores fora e dentro da muralha ----
  const tt = new THREE.CylinderGeometry(0.25, 0.35, 1.4, 6), tl = new THREE.ConeGeometry(1.5, 3.2, 7), tm = mat(0x6b4423), lm = [mat(0x2f7d32), mat(0x3c9a3f)];
  const tree = (x, z, sc) => { const t = new THREE.Group(); add(tt, tm, 0, 0.7, 0, t); add(tl, lm[(Math.abs(x) | 0) % 2], 0, 2.9, 0, t); add(tl, lm[1], 0, 4.1, 0, t).scale.setScalar(0.72); t.scale.setScalar(sc); t.position.set(x, 0, z); group.add(t); };
  for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2 + 0.07, x = Math.cos(a) * 38.4, z = Math.sin(a) * 38.4; if (Math.abs(x) < 9 && z > 0) continue; tree(x, z, 1 + (i % 3) * 0.12); }
  [[-8, 14], [8, 14], [-12, 8], [12, 8]].forEach(([x, z]) => tree(x, z, 1.05));
  for (let i = 0; i < 44; i++) { const a = (i / 44) * Math.PI * 2 + 0.1; if (Math.abs(Math.sin(a - Math.PI / 2)) < 0.14 && Math.cos(a) < 0) continue; tree(Math.cos(a) * (CITY_R + 7 + (i % 3) * 3), Math.sin(a) * (CITY_R + 7 + (i % 3) * 3), 1.2 + (i % 4) * 0.2); }

  // ---- lanternas ao longo da avenida e da praça ----
  const lamp = (x, z) => { add(new THREE.CylinderGeometry(0.12, 0.16, 3.4, 6), mat(0x3b3b3b), x, 1.7, z); add(new THREE.SphereGeometry(0.36, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a0 }), x, 3.6, z); };
  [-4.2, 4.2].forEach(x => [14, 22, 30, 38, 46, 54].forEach(z => lamp(x, z)));
  [[-9, -3], [9, -3], [-12, 7], [12, 7]].forEach(([x, z]) => lamp(x, z));

  // ---- NPCs: barraca colorida + placa + nome ----
  const npcs = NPC_DEFS.map((d, i) => {
    const def = buildPlayerHero(Object.assign({}, PREMADE[d.premade], { name: d.title }));
    const mesh = makeHero(def); mesh.position.set(d.pos[0], 0, d.pos[1]);
    const len = Math.hypot(d.pos[0], d.pos[1]) || 1, nx = d.pos[0] / len, nz = d.pos[1] / len;
    const cc = new THREE.Color(d.color).getHex();
    const stall = new THREE.Group();
    add(new THREE.BoxGeometry(3.8, 1.1, 1.4), wood, 0, 0.55, 0, stall);
    add(new THREE.BoxGeometry(4, 0.12, 1.6), darkWood, 0, 1.15, 0, stall);
    [-1.8, 1.8].forEach(px => add(new THREE.CylinderGeometry(0.1, 0.1, 3.6, 6), darkWood, px, 1.8, -0.5, stall));
    add(new THREE.BoxGeometry(4.6, 0.25, 2.6), mat(cc), 0, 3.6, -0.2, stall).rotation.x = 0.18;
    add(new THREE.BoxGeometry(4.6, 0.4, 0.15), mat(0xffffff), 0, 3.35, 1.0, stall);
    add(new THREE.BoxGeometry(1.2, 0.8, 0.9), wood, -1.2, 1.6, 0, stall); add(new THREE.BoxGeometry(0.9, 0.5, 0.9), mat(cc), 0.9, 1.4, 0, stall);
    stall.position.set(d.pos[0] + nx * 2.3, 0, d.pos[1] + nz * 2.3); stall.rotation.y = Math.atan2(-d.pos[0], -d.pos[1]); group.add(stall);
    const tag = label(d.icon + ' ' + d.title.split(',')[0]); tag.position.set(d.pos[0], 4.7, d.pos[1]); group.add(tag);
    group.add(mesh); mesh.rotation.y = Math.atan2(-d.pos[0], -d.pos[1]);
    // anel brilhante no chão para indicar que dá para falar
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.6, 28), new THREE.MeshBasicMaterial({ color: cc, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(d.pos[0], 0.12, d.pos[1]); group.add(ring);
    return Object.assign({ mesh, tag, ring }, d);
  });

  group.visible = false;
  let tm2 = 0;
  return {
    group, npcs, setOwned,
    // anima NPCs e devolve o mais próximo do jogador (se perto o bastante)
    update(dt, p) {
      tm2 += dt; let best = null, bd = 4.8;
      npcs.forEach(n => {
        animateHero(n.mesh, dt, {});
        const dx = p.x - n.mesh.position.x, dz = p.z - n.mesh.position.z, d = Math.hypot(dx, dz);
        if (d < 9) n.mesh.rotation.y = Math.atan2(dx, dz);
        n.ring.scale.setScalar(1 + Math.sin(tm2 * 3) * 0.1);
        if (d < bd) { bd = d; best = n; }
      });
      return best;
    },
  };
}
