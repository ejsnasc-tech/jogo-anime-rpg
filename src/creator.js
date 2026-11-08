import * as THREE from 'three';
import { makeHero, animateHero, playOnce } from './actors.js';
import { CLASSES, CLASS_BASE, CLASS_MODELS, REALMS, SKINS, HAIR_COLORS, EYE_COLORS, OUTFIT_COLORS, CAPE_COLORS, ORIGINS, PREMADE, buildPlayerHero } from './data.js';
import { HAIR_STYLES, FACES, ACCS, SEXES, BUILDS, HEIGHTS } from './looks.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

export const CLASS_LIST = Object.keys(CLASS_BASE);

export function randomLook(name) {
  const cls = pick(CLASS_LIST);
  return {
    name: name || '', cls, model: pick(CLASS_MODELS[cls])[0], hat: Math.random() < 0.25, realm: pick(ORIGINS),
    skin: Math.floor(Math.random() * SKINS.length), hair: Math.floor(Math.random() * HAIR_COLORS.length),
    outfit: Math.floor(Math.random() * OUTFIT_COLORS.length), cape: Math.floor(Math.random() * CAPE_COLORS.length),
    body: pick(['m', 'f']), build: pick(['slim', 'normal', 'normal', 'strong', 'chubby']), height: pick(['short', 'mid', 'mid', 'tall']), hairStyle: pick(HAIR_STYLES)[0], face: pick(FACES)[0], eye: Math.floor(Math.random() * EYE_COLORS.length), acc: Math.random() < 0.7 ? 'none' : pick(ACCS)[0],
  };
}

// opts: { account (string|null), initial (aparência|null), onDone({ account, custom }) }
export function openCreator(opts) {
  const root = document.getElementById('creator');
  root.className = 'open'; root.innerHTML = '';
  const prev = el('div'); prev.id = 'cprev';
  const body = el('div'); body.id = 'cbody';
  root.append(prev, body);

  // ---- prévia 3D ----
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  prev.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445577, 1.1));
  const key = new THREE.DirectionalLight(0xfff0d8, 1.4); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 0.9); rim.position.set(-4, 3, -3); scene.add(rim);
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.14, 40), new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 0.6 })); plat.position.y = -0.07; scene.add(plat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.03, 8, 48), new THREE.MeshBasicMaterial({ color: 0xf5c542 })); ring.rotation.x = Math.PI / 2; scene.add(ring);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);

  let model = null, rot = 0, dragging = false, moved = 0, lastX = 0, raf = 0, t = 0, alive = true, last = performance.now();
  function setModel(def) { if (model) scene.remove(model); model = makeHero(def); model.rotation.y = rot; scene.add(model); }
  // enquadra o boneco: no modo largo (PC) afasta um pouco mais
  function resize() {
    const w = prev.clientWidth || 300, h = prev.clientHeight || 300;
    renderer.setSize(w, h); camera.aspect = w / h;
    const dist = w / h > 1 ? 7.4 : 7.0;
    camera.position.set(0, 1.5, dist); camera.lookAt(0, 1.1, 0); camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  prev.addEventListener('pointerdown', (e) => { dragging = true; moved = 0; lastX = e.clientX; prev.setPointerCapture(e.pointerId); });
  prev.addEventListener('pointermove', (e) => { if (dragging) { const dx = e.clientX - lastX; moved += Math.abs(dx); rot += dx * 0.012; lastX = e.clientX; } });
  prev.addEventListener('pointerup', () => { dragging = false; if (moved < 6 && model) playOnce(model, Math.random() < 0.5 ? 'atk' : 'ult'); });
  function loop() {
    if (!alive) return; raf = requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (!dragging) rot += (Math.sin(t * 0.8) * 0.6 - rot) * 0.04;   // balança de frente; arraste para girar
    if (model) { model.rotation.y = rot; animateHero(model, dt, {}); }
    renderer.render(scene, camera);
  }
  function close() {
    alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize);
    renderer.dispose(); root.className = ''; root.innerHTML = '';
  }

  // ---- estado ----
  const lockCls = opts.lockClass || null;   // depois de criado, o personagem não troca de classe
  let account = opts.account || '';
  let c = opts.initial ? Object.assign({}, opts.initial) : randomLook('');
  let pre = 0;
  const fixModel = () => { if (!CLASS_MODELS[c.cls].some(m => m[0] === c.model)) c.model = CLASS_MODELS[c.cls][0][0]; };
  const showHero = (look) => { fixModel(); setModel(buildPlayerHero(look)); };

  function finish(look) {
    const custom = Object.assign({}, look); if (!custom.name) custom.name = account || 'Aventureiro';
    close(); opts.onDone({ account, custom });
  }

  // ---- telas ----
  function viewAccount() {
    body.innerHTML = '';
    const ban = el('img'); ban.src = ((import.meta.env && import.meta.env.BASE_URL) || './') + 'img/title.webp'; ban.alt = ''; ban.style.cssText = 'width:100%;max-height:130px;object-fit:cover;border-radius:14px;border:3px solid #f5c542;margin-bottom:8px'; ban.onerror = () => ban.remove(); body.append(ban);
    body.append(el('h1', null, 'Anime Crossover RPG'), el('p', 'sub', 'Crie sua conta para começar a aventura'));
    const inp = el('input'); inp.type = 'text'; inp.maxLength = 16; inp.placeholder = 'Seu nome de jogador'; inp.value = account;
    const err = el('div', 'err');
    const go = el('button', 'big', 'Criar conta');
    go.onclick = () => { const v = inp.value.trim(); if (v.length < 2) { err.textContent = 'Use pelo menos 2 letras.'; return; } account = v; if (!c.name) c.name = v; viewMode(); };
    inp.onkeydown = (e) => { if (e.key === 'Enter') go.onclick(); };
    body.append(inp, err, go, el('p', 'note', 'A conta fica salva neste aparelho. Contas online (na nuvem) chegam numa próxima versão.'));
    showHero(Object.assign({}, c, { cls: 'paladin', model: 'Knight', hat: false }));
  }

  function viewMode() {
    body.innerHTML = '';
    body.append(el('h2', null, 'Olá, ' + account + '!'), el('p', 'sub', 'Seu herói é...'));
    const sx = el('div', 'row'); SEXES.forEach(([k, lab]) => { const b = el('button', 'chip' + ((c.body || 'm') === k ? ' sel' : ''), lab); b.onclick = () => { c.body = k; viewMode(); }; sx.appendChild(b); }); body.append(sx, el('p', 'sub', 'Como você quer criar?'));
    const a = el('button', 'card', ''); a.innerHTML = '<b>🎨 Criar do zero</b><span>Escolha classe, aparência, pele, cabelo e roupas.</span>'; a.onclick = () => viewCustom();
    const b = el('button', 'card', ''); b.innerHTML = '<b>⭐ Personagens prontos</b><span>Escolha entre 8 heróis já montados.</span>'; b.onclick = () => viewPremade();
    const r = el('button', 'card', ''); r.innerHTML = '<b>🎲 Surpreenda-me</b><span>Um herói aleatório (dá para ajustar depois).</span>';
    r.onclick = () => { const sex = c.body; c = randomLook(c.name || account); c.body = sex || c.body; viewCustom(); };
    body.append(a, b, r);
    if (opts.canCancel) { const cn = el('button', 'sec', '✖ Cancelar'); cn.onclick = () => { close(); opts.onDone(null); }; body.append(cn); }
    showHero(Object.assign({}, c));
  }

  function swatches(list, cur, set) {
    const row = el('div', 'row');
    list.forEach((col, i) => { const s = el('button', 'sw' + (i === cur ? ' sel' : '')); s.style.background = hex(col); s.onclick = () => { set(i); refreshTab(); }; row.appendChild(s); });
    return row;
  }
  function chips(list, cur, set) {
    const row = el('div', 'row');
    list.forEach(([k, lab]) => { const b = el('button', 'chip' + (k === cur ? ' sel' : ''), lab); b.onclick = () => { set(k); refreshTab(); }; row.appendChild(b); });
    return row;
  }

  let tab = 'class', tabBox = null;
  const TABS = [['class', lockCls ? '🧙 Visual' : '⚔️ Classe'], ['body', '💪 Corpo'], ['hair', '💇 Cabelo'], ['face', '😊 Rosto'], ['outfit', '👕 Cores'], ['acc', '🎀 Extras'], ['origin', '🌍 Origem']];

  function refreshTab() {
    showHero(c);
    tabBox.innerHTML = '';
    if (tab === 'class') {
      if (lockCls) tabBox.appendChild(el('div', 'desc', '🔒 A classe é escolhida uma vez só. Para jogar com outra classe, crie um personagem novo.'));
      else tabBox.appendChild(chips(CLASS_LIST.map(k => [k, CLASSES[k].icon + ' ' + CLASSES[k].name]), c.cls, (v) => { c.cls = v; }));
      const models = CLASS_MODELS[c.cls];
      if (models.length > 1) { tabBox.appendChild(el('div', 'lbl', 'Aparência')); tabBox.appendChild(chips(models, c.model, (v) => { c.model = v; })); }
      tabBox.appendChild(el('div', 'lbl', 'Elmo / chapéu')); tabBox.appendChild(chips([[true, 'Com'], [false, 'Sem']], c.hat !== false, (v) => { c.hat = v; }));
      const d = el('div', 'desc'); const k = CLASSES[c.cls];
      d.innerHTML = '<b>' + k.icon + ' ' + k.name + ' — ' + k.role + '</b><br>' + CLASS_BASE[c.cls].look + '<br>' + k.desc + '<br><i>ULT: ' + k.ult + '</i>'; tabBox.appendChild(d);
    } else if (tab === 'body') { tabBox.appendChild(el('div', 'lbl', 'Porte físico')); tabBox.appendChild(chips(BUILDS, c.build || 'normal', (v) => { c.build = v; })); tabBox.appendChild(el('div', 'lbl', 'Altura')); tabBox.appendChild(chips(HEIGHTS, c.height || 'mid', (v) => { c.height = v; })); tabBox.appendChild(el('div', 'lbl', 'Tom de pele')); tabBox.appendChild(swatches(SKINS, c.skin, (i) => { c.skin = i; })); }
    else if (tab === 'hair') { tabBox.appendChild(el('div', 'lbl', 'Penteado')); tabBox.appendChild(chips(HAIR_STYLES, c.hairStyle || 'short', (v) => { c.hairStyle = v; })); tabBox.appendChild(el('div', 'lbl', 'Cor do cabelo')); tabBox.appendChild(swatches(HAIR_COLORS, c.hair, (i) => { c.hair = i; })); }
    else if (tab === 'face') { tabBox.appendChild(el('div', 'lbl', 'Expressão')); tabBox.appendChild(chips(FACES, c.face || 'calm', (v) => { c.face = v; })); tabBox.appendChild(el('div', 'lbl', 'Cor dos olhos')); tabBox.appendChild(swatches(EYE_COLORS, c.eye != null ? c.eye : 1, (i) => { c.eye = i; })); }
    else if (tab === 'acc') { tabBox.appendChild(el('div', 'lbl', 'Acessório (usa a cor da capa)')); tabBox.appendChild(chips(ACCS, c.acc || 'none', (v) => { c.acc = v; })); tabBox.appendChild(el('div', 'desc', 'Dica: com elmo, chapéu ou capuz o penteado fica escondido. Tire o elmo/chapéu na aba Classe (e para Ladino use a aparência "Ladino", sem capuz).')); }
    else if (tab === 'outfit') {
      tabBox.appendChild(el('div', 'lbl', 'Roupa / armadura')); tabBox.appendChild(swatches(OUTFIT_COLORS, c.outfit, (i) => { c.outfit = i; }));
      tabBox.appendChild(el('div', 'lbl', 'Capa e acentos')); tabBox.appendChild(swatches(CAPE_COLORS, c.cape, (i) => { c.cape = i; }));
    } else if (tab === 'origin') {
      tabBox.appendChild(chips(ORIGINS.map(k => [k, REALMS[k].icon + ' ' + REALMS[k].name]), c.realm, (v) => { c.realm = v; }));
      const r = REALMS[c.realm]; const strong = r.strong ? REALMS[r.strong].name : 'nenhum';
      tabBox.appendChild(el('div', 'desc', 'Seu Reino de origem define contra quem você tem vantagem (+25% de dano). ' + r.name + ' tem vantagem contra: ' + strong + '.'));
    }
  }

  function viewCustom() {
    body.innerHTML = '';
    fixModel();
    const nm = el('input'); nm.type = 'text'; nm.maxLength = 16; nm.placeholder = 'Nome do personagem'; nm.value = c.name || ''; nm.oninput = () => { c.name = nm.value.trim(); };
    const sxr = chips(SEXES, c.body || 'm', (v) => { c.body = v; });
    const tabs = el('div', 'tabs');
    TABS.forEach(([k, lab]) => { const b = el('button', 'tab' + (k === tab ? ' sel' : ''), lab); b.onclick = () => { tab = k; viewCustom(); }; tabs.appendChild(b); });
    tabBox = el('div', 'tabbox');
    const foot = el('div', 'foot');
    const back = el('button', 'sec', lockCls ? '✖ Cancelar' : '◀ Voltar'); back.onclick = lockCls ? () => { close(); opts.onDone(null); } : viewMode;
    const rnd = el('button', 'sec', '🎲'); rnd.onclick = () => { c = Object.assign(randomLook(c.name), { name: c.name, body: c.body }); if (lockCls) c.cls = lockCls; viewCustom(); };
    const ok = el('button', 'big', 'Confirmar'); ok.onclick = () => { if (!c.name) c.name = account; finish(c); };
    foot.append(back, rnd, ok);
    body.append(nm, sxr, tabs, tabBox, foot);
    refreshTab();
  }

  function viewPremade() {
    body.innerHTML = '';
    const PL = PREMADE.filter(x => (x.body || 'm') === (c.body || 'm')); const list = PL.length ? PL : PREMADE; pre = pre % list.length;
    const p = list[pre], look = Object.assign({}, p, { name: p.name });
    const k = CLASSES[p.cls], r = REALMS[p.realm];
    showHero(look);
    const nav = el('div', 'nav');
    const l = el('button', 'sec', '◀'); l.onclick = () => { pre = (pre + list.length - 1) % list.length; viewPremade(); };
    const rr = el('button', 'sec', '▶'); rr.onclick = () => { pre = (pre + 1) % list.length; viewPremade(); };
    const info = el('div', 'info'); info.innerHTML = '<b>' + p.name + '</b><br>' + k.icon + ' ' + k.name + ' • ' + r.icon + ' ' + r.name + '<br><span>' + p.bio + '</span><br><small>' + (pre + 1) + ' / ' + list.length + '  •  toque no boneco para ver um golpe</small>';
    nav.append(l, info, rr);
    const foot = el('div', 'foot');
    const back = el('button', 'sec', '◀ Voltar'); back.onclick = viewMode;
    const tw = el('button', 'sec', '🎨 Personalizar'); tw.onclick = () => { c = Object.assign({}, look); tab = 'class'; viewCustom(); };
    const ok = el('button', 'big', 'Escolher'); ok.onclick = () => finish(look);
    foot.append(back, tw, ok);
    body.append(el('h2', null, 'Personagens prontos'), nav, foot);
  }

  resize(); loop();
  const qp = new URLSearchParams(location.search), cview = qp.get('cview');   // atalhos de teste
  if (qp.get('ctab')) tab = qp.get('ctab');
  if (qp.get('cpre')) pre = Number(qp.get('cpre')) % PREMADE.length;
  if (lockCls) viewCustom(); else if (!account) viewAccount(); else if (cview === 'custom') viewCustom(); else if (cview === 'premade') viewPremade(); else viewMode();
  return { close };
}
