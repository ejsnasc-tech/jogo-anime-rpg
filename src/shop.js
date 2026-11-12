// Passe da temporada, loja de aparências e (futura) compra de gemas com dinheiro real.
export const AURAS = [
  { id: 'gold', name: 'Aura Dourada', color: 0xffc83d, price: 120 },
  { id: 'violet', name: 'Aura Violeta', color: 0xc77dff, price: 90 },
  { id: 'cyan', name: 'Aura Glacial', color: 0x4fe3ff, price: 90 },
  { id: 'green', name: 'Aura Primeva', color: 0x6ee07a, price: 70 },
  { id: 'crimson', name: 'Aura Rubra', color: 0xff5a5a, price: 70 },
  { id: 'season', name: 'Aura da Temporada', color: 0xff9ff3, price: 0, pass: true },
];
export const TITLES_SHOP = [
  { id: 'Nobre', price: 60 }, { id: 'Sombra Silenciosa', price: 100 }, { id: 'Rei dos Mares', price: 150 },
];
export const PASS_LEVELS = 30, PASS_XP = 250;
// xp do passe por tipo de evento
const XP = { kill: 1, drop: 2, stage: 10, boss: 30, event: 40, chest: 20, fish: 4, dungeon: 100, craft: 6, wboss: 150, emote: 0 };

const mon = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const monthName = () => ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][new Date().getMonth()];

// recompensa de cada nível
export function passReward(lvl, prem) {
  if (!prem) {
    if (lvl === 30) return { gems: 120, gold: 5000, item: 3 };
    if (lvl % 5 === 0) return { gems: 15 };
    return lvl % 2 ? { gold: 150 * lvl } : { gems: 4 };
  }
  if (lvl === 30) return { gems: 300, aura: 'season', title: 'Lenda da Temporada' };
  if (lvl === 20) return { gems: 60, gem: 3, item: 3 };
  if (lvl === 10) return { gems: 40, gem: 2, item: 2 };
  if (lvl % 5 === 0) return { gems: 30 };
  return lvl % 2 ? { gems: 8 } : { gems: 4, gold: 100 * lvl };
}
const rewTxt = (r) => [r.gold && '🪙' + r.gold, r.gems && '💎' + r.gems, r.gem && '🔷gema Nv.' + r.gem, r.item && '🎁item ' + (r.item === 3 ? 'LENDÁRIO' : 'ÉPICO'), r.aura && '✨aura', r.title && '🏷título'].filter(Boolean).join(' ');

export function initShop(c) {
  const { state, toast, openPanel, save, refreshHud, giveItem, newItem, SLOT_ORDER, mainCls, craft } = c;
  const pass = () => {
    let p = state.pass; if (!p || p.season !== mon()) p = state.pass = { season: mon(), xp: 0, free: {}, prem: {}, premium: false };
    return p;
  };
  const cos = () => (state.cos = state.cos || { owned: {}, aura: '' });
  const level = () => Math.min(PASS_LEVELS, Math.floor(pass().xp / PASS_XP));
  function passXp(key, n) {
    const x = (XP[key] || 0) * (n || 1); if (!x) return; const p = pass(), before = level(); p.xp = Math.min(PASS_LEVELS * PASS_XP, p.xp + x);
    if (level() > before) toast('🎟 Passe da Temporada: nível ' + level() + '! Abra com a Arauta.');
  }
  function give(r) {
    state.gold += r.gold || 0; state.gems += r.gems || 0;
    if (r.gem) craft.giveGem(null, r.gem);
    if (r.item) giveItem(newItem(SLOT_ORDER[Math.floor(Math.random() * SLOT_ORDER.length)], Math.min(5, state.maxAct), r.item, mainCls()));
    if (r.aura) cos().owned[r.aura] = 1;
    if (r.title) { state.meta.title = r.title; }
  }

  function openPass(back) {
    const p = pass(), lv = level(), rows = back ? [{ text: '◀ Voltar', btn: 'VOLTAR', fn: back }] : [];
    rows.push({ head: true, text: '🎟 PASSE DA TEMPORADA — ' + monthName() + '\nNível ' + lv + '/' + PASS_LEVELS + '  •  ' + p.xp + ' XP (' + (lv >= PASS_LEVELS ? 'máximo!' : (PASS_XP - p.xp % PASS_XP) + ' para o próximo') + ')\nGanhe XP de passe abatendo monstros, chefes, masmorras, eventos, baús e pesca. Reinicia todo mês.' });
    rows.push({ text: p.premium ? '⭐ Passe PREMIUM ativo: você recebe os dois prêmios por nível.' : '⭐ Passe PREMIUM: libera a trilha de prêmios extra (mais 💎, itens épicos/lendários, gemas, aura e título exclusivos). Comprado com 🔮 Kyros.', btn: p.premium ? '✔' : '🔮300', enabled: !p.premium && state.cash >= 300, fn: () => { state.cash -= 300; p.premium = true; save(state); refreshHud(); toast('⭐ Passe Premium ativado!'); openPass(back); } });
    for (let i = 1; i <= PASS_LEVELS; i++) {
      const f = passReward(i, false), pr = passReward(i, true), reach = lv >= i;
      rows.push({ text: (reach ? '✅ ' : '🔒 ') + 'Nível ' + i + '\nGrátis: ' + rewTxt(f) + '\nPremium: ' + rewTxt(pr), btns: [
        { label: p.free[i] ? '✔ GRÁTIS' : 'GRÁTIS', enabled: reach && !p.free[i], fn: () => { p.free[i] = 1; give(f); save(state); refreshHud(); toast('🎁 ' + rewTxt(f)); openPass(back); } },
        { label: p.prem[i] ? '✔ PREMIUM' : '⭐ PREMIUM', enabled: reach && p.premium && !p.prem[i], fn: () => { p.prem[i] = 1; give(pr); save(state); refreshHud(); toast('🎁 ' + rewTxt(pr)); openPass(back); } },
      ] });
    }
    openPanel('🎟 PASSE', rows);
  }

  function openCosmetics(back) {
    const o = cos(), rows = back ? [{ text: '◀ Voltar', btn: 'VOLTAR', fn: back }] : [];
    rows.push({ head: true, text: '🛍 LOJA DE APARÊNCIAS   💎' + state.gems + '\nAuras brilham no chão em volta do seu personagem (só você vê por enquanto). Compras são só cosméticas: não dão força.' });
    rows.push({ text: 'Sem aura cosmética (mostra a aura da raridade do equipamento)', btn: o.aura ? 'USAR' : '✔', enabled: !!o.aura, fn: () => { o.aura = ''; save(state); openCosmetics(back); } });
    AURAS.forEach(a => {
      const have = !!o.owned[a.id];
      if (a.pass && !have) { rows.push({ text: '✨ ' + a.name + '\nExclusiva do Passe Premium (nível 30)', btn: '🔒', enabled: false }); return; }
      rows.push({ text: '✨ ' + a.name + (have ? '' : '\nPreço: 💎' + a.price), btn: have ? (o.aura === a.id ? '✔ EM USO' : 'USAR') : '💎' + a.price, enabled: have ? o.aura !== a.id : state.gems >= a.price, fn: () => {
        if (have) o.aura = a.id; else { state.gems -= a.price; o.owned[a.id] = 1; o.aura = a.id; toast('✨ ' + a.name + ' comprada!'); }
        save(state); refreshHud(); openCosmetics(back);
      } });
    });
    rows.push({ head: true, text: '🏷 TÍTULOS (aparecem ao lado do seu nome)' });
    TITLES_SHOP.forEach(t => {
      const have = !!o.owned['t:' + t.id];
      rows.push({ text: '🏷 «' + t.id + '»' + (have ? '' : '\nPreço: 💎' + t.price), btn: have ? (state.meta.title === t.id ? '✔ EM USO' : 'USAR') : '💎' + t.price, enabled: have ? state.meta.title !== t.id : state.gems >= t.price, fn: () => {
        if (!have) { state.gems -= t.price; o.owned['t:' + t.id] = 1; } state.meta.title = t.id; save(state); refreshHud(); openCosmetics(back);
      } });
    });
    openPanel('🛍 LOJA', rows);
  }

  function openGemPacks(back) {
    const rows = back ? [{ text: '◀ Voltar', btn: 'VOLTAR', fn: back }] : [];
    rows.push({ head: true, text: '💎 COMPRAR GEMAS\nA compra com dinheiro real ainda NÃO está ativa. Ela depende de uma conta na loja de pagamentos (Pix/cartão) e de termos de uso, e entra no lançamento oficial. Os valores abaixo são apenas uma prévia.' });
    [['Punhado', 100, 'R$ 5,00'], ['Bolsa', 550, 'R$ 25,00'], ['Baú', 1200, 'R$ 50,00'], ['Tesouro', 2600, 'R$ 100,00']].forEach(([n, g, p]) => rows.push({ text: '💎 ' + n + ' — ' + g + ' gemas\n' + p, btn: 'EM BREVE', enabled: false }));
    openPanel('💎 GEMAS', rows);
  }
  const auraColor = () => { const o = cos(); const a = AURAS.find(x => x.id === o.aura); return a ? a.color : null; };

  return { openPass, openCosmetics, openGemPacks, passXp, auraColor };
}
