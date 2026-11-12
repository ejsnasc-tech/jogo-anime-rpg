import * as THREE from 'three';
import { makeHero, animateHero, playOnce } from './actors.js';
import { CLASSES, CLASS_BASE, CLASS_MODELS, REALMS, SKINS, HAIR_COLORS, EYE_COLORS, OUTFIT_COLORS, CAPE_COLORS, ORIGINS, PREMADE, buildPlayerHero, PORTRAITS, VRM_ROSTER, VRM_BASES, VRM_BUILDS } from './data.js';
import { HAIR_STYLES, FACES, ACCS, SEXES, BUILDS, HEIGHTS, OUTFIT_STYLES, MALE_HAIR, FEMALE_HAIR, MALE_FACES, FEMALE_FACES, MALE_ACCS, FEMALE_ACCS } from './looks.js';
function applySex(c, v) { c.body = v; const bad = v === 'm' ? FEMALE_HAIR : MALE_HAIR; if (bad.includes(c.hairStyle || 'short')) c.hairStyle = v === 'm' ? 'short' : 'long'; c.outfitStyle = 'auto'; if (!(v === 'm' ? MALE_FACES : FEMALE_FACES).includes(c.face)) c.face = 'calm'; if (!(v === 'm' ? MALE_ACCS : FEMALE_ACCS).includes(c.acc || 'none')) c.acc = 'none'; }
const rndOutfit = (sex) => OUTFIT_STYLES.filter(x => sex === 'f' || x[0] !== 'dress')[Math.floor(Math.random() * (OUTFIT_STYLES.length - (sex === 'f' ? 0 : 1)))][0];

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
    body: 'm', build: pick(['slim', 'normal', 'normal', 'strong', 'chubby']), height: pick(['short', 'mid', 'mid', 'tall']), hairStyle: 'short', outfitStyle: 'auto', face: pick(FACES.filter(x => MALE_FACES.includes(x[0])))[0], eye: Math.floor(Math.random() * EYE_COLORS.length), acc: Math.random() < 0.7 ? 'none' : pick(ACCS.filter(x => MALE_ACCS.includes(x[0])))[0],
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
  const isV = (m) => /^VRM_/.test(m || '');
  const VRMS = PREMADE.filter(x => isV(x.model));
  const fixModel = () => { if (!isV(c.model) && !CLASS_MODELS[c.cls].some(m => m[0] === c.model)) c.model = CLASS_MODELS[c.cls][0][0]; };
  const showHero = (look) => { fixModel(); setModel(buildPlayerHero(look)); };

  function finish(look) {
    const custom = Object.assign({}, look); if (!custom.name) custom.name = account || 'Aventureiro';
    close(); opts.onDone({ account, custom });
  }

  // ---- telas ----
  function viewAccount() {
    body.innerHTML = '';
    const ban = el('img'); ban.src = ((import.meta.env && import.meta.env.BASE_URL) || './') + 'img/title.webp'; ban.alt = ''; ban.style.cssText = 'width:100%;max-height:130px;object-fit:cover;border-radius:14px;border:3px solid #f5c542;margin-bottom:8px'; ban.onerror = () => ban.remove(); body.append(ban);
    body.append(el('h1', null, 'Kyros Online'), el('p', 'sub', 'Crie sua conta para começar a aventura'));
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
    const sx = el('div', 'row'); SEXES.forEach(([k, lab]) => { const b = el('button', 'chip' + ((c.body || 'm') === k ? ' sel' : ''), lab); b.onclick = () => { applySex(c, k); viewMode(); }; sx.appendChild(b); }); body.append(sx, el('p', 'sub', 'Como você quer criar?'));
    const a = el('button', 'card', ''); a.innerHTML = '<b>🎨 Criar do zero</b><span>Escolha classe, aparência, pele, cabelo e roupas.</span>'; a.onclick = () => viewCustom();
    const b = el('button', 'card', ''); b.innerHTML = '<b>⭐ Heróis anime prontos</b><span>Personagens de anime bonitos, já com arma. Recomendado!</span>'; b.onclick = () => viewGallery();
    const r = el('button', 'card', ''); r.innerHTML = '<b>🎲 Surpreenda-me</b><span>Um herói aleatório (dá para ajustar depois).</span>';
    r.onclick = () => { const sex = c.body || 'm'; c = randomLook(c.name || account); applySex(c, sex); c.hairStyle = pick(sex === 'm' ? MALE_HAIR : FEMALE_HAIR); c.outfitStyle = rndOutfit(sex); viewCustom(); };
    body.append(b, a, r);
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


  // Corpo (homem/mulher) + modelos anime + modelos clássicos da classe: tudo da aba Personalizado
  function modelPicker() {
    const sex = c.body || 'm', box = document.createDocumentFragment();
    box.appendChild(el('div', 'lbl', 'Corpo'));
    box.appendChild(chips(SEXES, sex, (v) => { applySex(c, v); if (isV(c.model)) c.model = VRM_BASES[v][0]; queueMicrotask(viewCustom); }));
    box.appendChild(el('div', 'lbl', '✨ Modelos anime'));
    box.appendChild(chips(VRM_BASES[sex].map((m, i) => [m, 'Anime ' + (i + 1)]), c.model, (v) => { c.model = v; tab = 'vbase'; queueMicrotask(viewCustom); }));
    const cl = CLASS_MODELS[c.cls] || [];
    if (cl.length) { box.appendChild(el('div', 'lbl', 'Modelos clássicos')); box.appendChild(chips(cl, c.model, (v) => { c.model = v; tab = 'class'; queueMicrotask(viewCustom); })); }
    return box;
  }
  function applyHero(e) {
    c = Object.assign({}, c, { body: e.body, model: e.model, vh: e.vh, vc: e.vc, vs: e.vs, ve: e.ve, vb: e.vb, bio: e.bio });
    if (!lockCls) { c.cls = e.cls; c.realm = e.realm; }
    if (!c.realm) c.realm = e.realm;
  }
  // linha de cima: Homem | Mulher | Personalizado
  function modePicker(active) {
    const row = el('div', 'row');
    [['m', '👨 Homem'], ['f', '👩 Mulher']].forEach(([k, lab]) => {
      const b = el('button', 'chip' + (active === k ? ' sel' : ''), lab);
      b.onclick = () => { if (active === k) return; applyHero(VRM_ROSTER.find(x => x.body === k)); applySex(c, k); viewGallery(); };
      row.appendChild(b);
    });
    const pz = el('button', 'chip' + (active === 'custom' ? ' sel' : ''), '🎨 Personalizado');
    pz.onclick = () => { if (active === 'custom') return; tab = isV(c.model) ? 'vbase' : 'class'; viewCustom(); };
    row.appendChild(pz); return row;
  }

  let tab = 'class', tabBox = null;
  const VTABS = [['vbase', '🧍 Modelo'], ['vhair', '💇 Cabelo'], ['veye', '👁️ Olhos'], ['vcloth', '👕 Roupa'], ['vskin', '🧑 Pele'], ['vbuild', '💪 Físico'], ['class', '⚔️ Classe']];
  const TABS = [['class', lockCls ? '🧙 Visual' : '⚔️ Classe'], ['body', '💪 Corpo'], ['hair', '💇 Cabelo'], ['face', '😊 Rosto'], ['outfit', '👕 Roupa'], ['acc', '🎀 Extras']];

  function refreshTab() {
    showHero(c);
    tabBox.innerHTML = '';
    if (isV(c.model)) { vrmTab(); return; }
    if (tab === 'class') {
      if (lockCls) tabBox.appendChild(el('div', 'desc', '🔒 A classe é escolhida uma vez só. Para jogar com outra classe, crie um personagem novo.'));
      else tabBox.appendChild(chips(CLASS_LIST.map(k => [k, CLASSES[k].icon + ' ' + CLASSES[k].name]), c.cls, (v) => { c.cls = v; }));
      tabBox.appendChild(modelPicker());
      if (!isV(c.model)) { tabBox.appendChild(el('div', 'lbl', 'Elmo / chapéu')); tabBox.appendChild(chips([[true, 'Com'], [false, 'Sem']], c.hat !== false, (v) => { c.hat = v; })); }
      const d = el('div', 'desc'); const k = CLASSES[c.cls];
      d.innerHTML = '<b>' + k.icon + ' ' + k.name + ' — ' + k.role + '</b><br>' + CLASS_BASE[c.cls].look + '<br>' + k.desc + '<br><i>ULT: ' + k.ult + '</i>'; tabBox.appendChild(d);
    } else if (tab === 'body') { tabBox.appendChild(el('div', 'lbl', 'Porte físico')); tabBox.appendChild(chips(BUILDS, c.build || 'normal', (v) => { c.build = v; })); tabBox.appendChild(el('div', 'lbl', 'Altura')); tabBox.appendChild(chips(HEIGHTS, c.height || 'mid', (v) => { c.height = v; })); tabBox.appendChild(el('div', 'lbl', 'Tom de pele')); tabBox.appendChild(swatches(SKINS, c.skin, (i) => { c.skin = i; })); }
    else if (tab === 'hair') { tabBox.appendChild(el('div', 'lbl', 'Penteado')); tabBox.appendChild(chips(HAIR_STYLES.filter(x => ((c.body || 'm') === 'm' ? MALE_HAIR : FEMALE_HAIR).includes(x[0])), c.hairStyle || 'short', (v) => { c.hairStyle = v; })); tabBox.appendChild(el('div', 'lbl', 'Cor do cabelo')); tabBox.appendChild(swatches(HAIR_COLORS, c.hair, (i) => { c.hair = i; })); }
    else if (tab === 'face') { tabBox.appendChild(el('div', 'lbl', 'Expressão')); tabBox.appendChild(chips(FACES.filter(x => ((c.body || 'm') === 'm' ? MALE_FACES : FEMALE_FACES).includes(x[0])), c.face || 'calm', (v) => { c.face = v; })); tabBox.appendChild(el('div', 'lbl', 'Cor dos olhos')); tabBox.appendChild(swatches(EYE_COLORS, c.eye != null ? c.eye : 1, (i) => { c.eye = i; })); }
    else if (tab === 'acc') { tabBox.appendChild(el('div', 'lbl', 'Acessório (usa a cor da capa)')); tabBox.appendChild(chips(ACCS.filter(x => ((c.body || 'm') === 'm' ? MALE_ACCS : FEMALE_ACCS).includes(x[0])), c.acc || 'none', (v) => { c.acc = v; })); tabBox.appendChild(el('div', 'desc', 'Dica: com elmo, chapéu ou capuz o penteado fica escondido. Tire o elmo/chapéu na aba Classe (e para Ladino use a aparência "Ladino", sem capuz).')); }
    else if (tab === 'outfit') {
      tabBox.appendChild(el('div', 'lbl', 'Estilo da roupa')); tabBox.appendChild(chips(OUTFIT_STYLES.filter(x => (c.body || 'm') === 'f' || x[0] !== 'dress'), c.outfitStyle || 'auto', (v) => { c.outfitStyle = v; }));
      tabBox.appendChild(el('div', 'lbl', 'Cor da roupa')); tabBox.appendChild(swatches(OUTFIT_COLORS, c.outfit, (i) => { c.outfit = i; }));
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
    const sxr = modePicker('custom');
    if (isV(c.model) ? !VTABS.some(t => t[0] === tab) || (lockCls && tab === 'class') : !TABS.some(t => t[0] === tab)) tab = isV(c.model) ? 'vbase' : 'class';
    const tabs = el('div', 'tabs');
    (isV(c.model) ? VTABS.filter(t => !(lockCls && t[0] === 'class')) : TABS).forEach(([k, lab]) => { const b = el('button', 'tab' + (k === tab ? ' sel' : ''), lab); b.onclick = () => { tab = k; viewCustom(); }; tabs.appendChild(b); });
    tabBox = el('div', 'tabbox');
    const foot = el('div', 'foot');
    const back = el('button', 'sec', lockCls ? '✖ Cancelar' : '◀ Voltar'); back.onclick = lockCls ? () => { close(); opts.onDone(null); } : viewMode;
    const rnd = el('button', 'sec', '🎲'); rnd.onclick = () => { if (isV(c.model)) { c.vh = Math.floor(Math.random() * HAIR_COLORS.length); c.ve = Math.floor(Math.random() * EYE_COLORS.length); c.vc = HUES[1 + Math.floor(Math.random() * (HUES.length - 1))]; refreshTab(); return; } { const sex = c.body || 'm'; c = Object.assign(randomLook(c.name), { name: c.name }); applySex(c, sex); c.hairStyle = pick(sex === 'm' ? MALE_HAIR : FEMALE_HAIR); c.outfitStyle = rndOutfit(sex); } if (lockCls) c.cls = lockCls; viewCustom(); };
    const ok = el('button', 'big', 'Confirmar'); ok.onclick = () => { if (!c.name) c.name = account; finish(c); };
    foot.append(back, rnd, ok);
    body.append(nm, sxr, tabs, tabBox, foot);
    refreshTab();
  }


  // ---- galeria: 30 heróis anime por sexo (visual fixo) + botão Personalizar ----
  const sameLook = (e) => e.model === c.model && (e.vh == null) === (c.vh == null) && (e.vh == null || e.vh === c.vh) && (e.vc == null) === (c.vc == null) && (e.vc == null || e.vc === c.vc) && !e.vs === !c.vs && (!e.vs || e.vs === c.vs) && (e.ve == null) === (c.ve == null) && (e.ve == null || e.ve === c.ve) && (e.vb || 0) === (c.vb || 0);
  function viewGallery() {
    body.innerHTML = '';
    const sex = c.body || 'm', roster = VRM_ROSTER.filter(x => x.body === sex);
    if (!isV(c.model) && !lockCls) { const e = roster[0]; c = Object.assign({}, c, { body: e.body, model: e.model, vh: e.vh, vc: e.vc, vs: e.vs, ve: e.ve, bio: e.bio, cls: e.cls, realm: e.realm }); }
    const nm = el('input'); nm.type = 'text'; nm.maxLength = 16; nm.placeholder = 'Nome do personagem'; nm.value = c.name || ''; nm.oninput = () => { c.name = nm.value.trim(); };
    const sxr = modePicker(sex);
    body.append(nm, sxr, el('div', 'lbl', '✨ Escolha seu herói (' + roster.length + ' opções)'));
    const grid = el('div', 'grid'), btns = [];
    const info = el('div', 'desc'), clsBox = el('div', 'row');
    function paint() {
      btns.forEach((b, i) => b.classList.toggle('sel', sameLook(roster[i])));
      const k = CLASSES[c.cls]; info.innerHTML = '💪 Físico: <b>' + VRM_BUILDS[c.vb || 0].n + '</b><br><b>' + k.icon + ' ' + k.name + ' — ' + k.role + '</b><br>' + k.desc + '<br><i>ULT: ' + k.ult + '</i>';
      clsBox.innerHTML = '';
      if (!lockCls) CLASS_LIST.forEach(kk => { const b = el('button', 'chip' + (c.cls === kk ? ' sel' : ''), CLASSES[kk].icon + ' ' + CLASSES[kk].name); b.onclick = () => { c.cls = kk; showHero(c); paint(); }; clsBox.appendChild(b); });
    }
    function pickHero(e, redraw) {
      c = Object.assign({}, c, { body: e.body, model: e.model, vh: e.vh, vc: e.vc, vs: e.vs, ve: e.ve, vb: e.vb, bio: e.bio });
      if (!lockCls) { c.cls = e.cls; c.realm = e.realm; }
      if (!c.realm) c.realm = e.realm;
      showHero(c); if (redraw) viewGallery(); else paint();
    }
    roster.forEach((e, i) => { const b = el('button', 'hero', String(i + 1).padStart(2, '0') + ' ' + e.name.split(' ')[0]); b.onclick = () => pickHero(e, false); grid.appendChild(b); btns.push(b); });
    body.append(grid);
    if (lockCls) body.append(el('div', 'desc', '🔒 A classe (' + CLASSES[c.cls].name + ') é escolhida uma vez só. Só o visual muda.'));
    else body.append(el('div', 'lbl', 'Classe'), clsBox);
    body.append(info);
    const foot = el('div', 'foot');
    const back = el('button', 'sec', lockCls ? '✖ Cancelar' : '◀ Voltar'); back.onclick = lockCls ? () => { close(); opts.onDone(null); } : viewMode;
    const ok = el('button', 'big', 'Confirmar'); ok.onclick = () => { if (!c.name) c.name = account; finish(c); };
    foot.append(back, ok); body.append(foot);
    showHero(c);
    paint();
  }
  const HUES = [0, 30, 60, 120, 160, 200, 260, 300, 330];
  function vrmTab() {
    const sex = c.body || 'm', cur = (v) => v == null;
    const orig = (key) => { const b = el('button', 'chip' + (cur(c[key]) ? ' sel' : ''), 'Original'); b.onclick = () => { c[key] = undefined; refreshTab(); }; return b; };
    const sw = (key, list) => { const row = swatches(list, c[key] == null ? -1 : c[key], (i) => { c[key] = i; }); row.prepend(orig(key)); return row; };
    if (tab === 'vbase') {
      tabBox.appendChild(modelPicker());
      tabBox.appendChild(el('div', 'desc', 'Escolha o corpo e o modelo; depois ajuste cabelo, olhos, roupa e pele nas outras abas.'));
    } else if (tab === 'vhair') { tabBox.appendChild(el('div', 'lbl', 'Cor do cabelo')); tabBox.appendChild(sw('vh', HAIR_COLORS)); }
    else if (tab === 'veye') { tabBox.appendChild(el('div', 'lbl', 'Cor dos olhos')); tabBox.appendChild(sw('ve', EYE_COLORS)); }
    else if (tab === 'vbuild') { tabBox.appendChild(el('div', 'lbl', 'Físico do herói')); tabBox.appendChild(chips(VRM_BUILDS.map((b, i) => [i, b.n]), c.vb || 0, (v) => { c.vb = v; })); }
    else if (tab === 'vskin') { tabBox.appendChild(el('div', 'lbl', 'Tom de pele')); tabBox.appendChild(sw('vs', SKINS)); }
    else if (tab === 'vcloth') {
      tabBox.appendChild(el('div', 'lbl', 'Cor da roupa (gira o tom da roupa original)'));
      const row = el('div', 'row'); const o = el('button', 'chip' + (cur(c.vc) ? ' sel' : ''), 'Original'); o.onclick = () => { c.vc = undefined; refreshTab(); }; row.appendChild(o);
      HUES.slice(1).forEach(h => { const b = el('button', 'sw' + (c.vc === h ? ' sel' : '')); b.style.background = 'hsl(' + h + ',70%,50%)'; b.onclick = () => { c.vc = h; refreshTab(); }; row.appendChild(b); });
      tabBox.appendChild(row);
    } else if (tab === 'class') {
      if (lockCls) tabBox.appendChild(el('div', 'desc', '🔒 A classe é escolhida uma vez só. Para jogar com outra classe, crie um personagem novo.'));
      else tabBox.appendChild(chips(CLASS_LIST.map(k => [k, CLASSES[k].icon + ' ' + CLASSES[k].name]), c.cls, (v) => { c.cls = v; }));
      const d = el('div', 'desc'), k = CLASSES[c.cls]; d.innerHTML = '<b>' + k.icon + ' ' + k.name + ' — ' + k.role + '</b><br>' + k.desc + '<br><i>ULT: ' + k.ult + '</i>'; tabBox.appendChild(d);
    } else if (tab === 'origin') {
      tabBox.appendChild(chips(ORIGINS.map(k => [k, REALMS[k].icon + ' ' + REALMS[k].name]), c.realm, (v) => { c.realm = v; }));
      const r = REALMS[c.realm]; const strong = r.strong ? REALMS[r.strong].name : 'nenhum';
      tabBox.appendChild(el('div', 'desc', 'Seu Reino de origem define contra quem você tem vantagem (+25% de dano). ' + r.name + ' tem vantagem contra: ' + strong + '.'));
    }
  }

  function viewPremade() {
    body.innerHTML = '';
    const PL = PREMADE.filter(x => (x.body || 'm') === (c.body || 'm')).sort((a, b) => (isV(b.model) ? 1 : 0) - (isV(a.model) ? 1 : 0)); const list = PL.length ? PL : PREMADE; pre = pre % list.length;
    const p = list[pre], look = Object.assign({}, p, { name: p.name });
    const k = CLASSES[p.cls], r = REALMS[p.realm];
    showHero(look);
    const nav = el('div', 'nav');
    const l = el('button', 'sec', '◀'); l.onclick = () => { pre = (pre + list.length - 1) % list.length; viewPremade(); };
    const rr = el('button', 'sec', '▶'); rr.onclick = () => { pre = (pre + 1) % list.length; viewPremade(); };
    const info = el('div', 'info'); info.innerHTML = '<b>' + p.name + '</b><br>' + k.icon + ' ' + k.name + ' • ' + r.icon + ' ' + r.name + '<br><span>' + p.bio + '</span><br><small>' + (pre + 1) + ' / ' + list.length + '  •  toque no boneco para ver um golpe</small>';
    const pid = PORTRAITS[p.model];
    if (pid) { const im = document.createElement('img'); im.src = import.meta.env.BASE_URL + 'img/portraits/' + pid + '.webp'; im.alt = p.name; im.style.cssText = 'width:140px;height:140px;object-fit:cover;border-radius:16px;border:3px solid #ffc933;box-shadow:0 4px 14px #0008;flex:none'; info.style.display = 'flex'; info.style.gap = '10px'; info.style.alignItems = 'center'; const tx = el('div'); tx.innerHTML = info.innerHTML; info.innerHTML = ''; info.append(im, tx); }
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
  if (lockCls) viewGallery(); else if (!account) viewAccount(); else if (cview === 'custom') viewCustom(); else if (cview === 'premade') viewGallery(); else viewMode();
  return { close };
}
