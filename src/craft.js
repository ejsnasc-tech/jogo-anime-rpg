// Ofício: forjar equipamentos, lapidar/fundir gemas e encaixá-las nos itens.
import { GEMS, GEM_KEYS, gemFmt, MATS, RAR, MAX_PLUS, upgradeCost, itemFmt } from './items.js';

export function initCraft(c) {
  const { state, toast, openPanel, save, refreshHud, itemLine, isEquipped, giveItem, newItem, SLOT_ORDER, slotLabel, slotIcon, mainCls, track, recalcHp } = c;
  const bag = () => (state.gembag = state.gembag || {});
  const key = (t, l) => t + ':' + l;
  const have = (t, l) => bag()[key(t, l)] || 0;
  const add = (t, l, n) => { bag()[key(t, l)] = Math.max(0, have(t, l) + (n || 1)); };
  const bagList = () => Object.keys(bag()).filter(k => bag()[k] > 0).map(k => { const [t, l] = k.split(':'); return { t, l: +l, n: bag()[k] }; }).sort((a, b) => a.t < b.t ? -1 : a.t > b.t ? 1 : a.l - b.l);
  const giveGem = (t, l) => { t = t || GEM_KEYS[Math.floor(Math.random() * GEM_KEYS.length)]; l = l || 1; add(t, l, 1); toast('💎 Gema: ' + gemFmt(t, l)); };
  const maxTier = () => Math.min(5, state.maxAct);

  const menu = (back) => () => openCraft(back);
  function openCraft(back) {
    const rows = back ? [{ text: '◀ Voltar', btn: 'VOLTAR', fn: back }] : [];
    rows.push({ text: '⭐ Melhorar equipamento\nEscolha uma peça que você usa: veja o que precisa para refinar ou evoluir de nível (1 a 10)', btn: 'ABRIR', fn: () => openEquipUp(menu(back), SLOT_ORDER) });
    rows.push({ text: '💎 Lapidar e fundir gemas\nCrie gemas e una 3 iguais para subir de nível', btn: 'ABRIR', fn: () => openGems(back) });
    rows.push({ text: '🔧 Encaixar gemas\nColoque gemas nos seus itens (raro 1, épico 2, lendário 3 encaixes)', btn: 'ABRIR', fn: () => openSocket(back) });
    openPanel('⚒ OFÍCIO', rows);
  }

  // ---- melhorar equipamento: escolhe a peça que você usa e vê o que precisa ----
  const MAXLV = 10;                                            // níveis 1..10 (tier 0..9)
  const matIdx = (it) => Math.min(5, it.tier);
  const evoNeed = (it) => (it.tier < 2 ? 3 : it.tier < 6 ? 4 : 5);   // quantas peças iguais (contando a sua)
  const evoCost = (it) => ({ gold: Math.round(150 * Math.pow(it.tier + 1, 1.45)), mats: 6 + it.tier * 2, ky: 12 + it.tier * 10 });
  const refineKy = (c) => Math.max(5, Math.round(c.gold / 40) + c.mat * 2);
  const fodder = (it) => state.items.filter(i => i.uid !== it.uid && i.slot === it.slot && (i.kind || '') === (it.kind || '') && i.tier === it.tier && !isEquipped(i))
    .sort((a, b) => a.rar - b.rar || a.plus - b.plus);
  const worn = (slot) => state.items.find(i => i.uid === state.equip[slot]);
  const lvTxt = (it) => 'Nível ' + (it.tier + 1) + '/' + MAXLV;

  function openEquipUp(back, slots, slot, msg) {
    const rows = [{ text: '◀ Voltar', btn: 'VOLTAR', fn: slot ? () => openEquipUp(back, slots) : back }];
    const it = slot && worn(slot);
    if (!it) {
      rows.push({ head: true, text: 'Escolha a peça que você está usando para melhorar:' });
      slots.forEach(sl => { const w = worn(sl); rows.push(w ? { text: itemLine(w) + '\n' + lvTxt(w), color: undefined, btn: 'ABRIR', fn: () => openEquipUp(back, slots, sl) } : { text: slotIcon(sl) + ' ' + slotLabel(sl) + '\n(nada equipado)' }); });
      openPanel('⬆ MELHORAR', rows); return;
    }
    const again = (m) => openEquipUp(back, slots, slot, m);
    rows.push({ head: true, text: (msg ? msg + '\n' : '') + itemLine(it) + '\n' + lvTxt(it) + '  •  refino +' + it.plus + '/' + MAX_PLUS + '\n🪙' + state.gold + '  ' + MATS[matIdx(it)].icon + (state.mats[matIdx(it)] || 0) + '  🔮' + state.cash });
    // refinar (+1)
    if (it.plus >= MAX_PLUS) rows.push({ text: '🔨 Refino no máximo (+' + MAX_PLUS + ') ✔' });
    else {
      const c = upgradeCost(it), ky = refineKy(c), ok = state.gold >= c.gold && (state.mats[matIdx(it)] || 0) >= c.mat;
      rows.push({ text: '🔨 Refinar para +' + (it.plus + 1) + '\nPrecisa: 🪙' + c.gold + ' + ' + MATS[matIdx(it)].icon + c.mat + (ok ? '' : '  (faltam recursos)'), btns: [
        { label: 'REFINAR', enabled: ok, fn: () => { state.gold -= c.gold; state.mats[matIdx(it)] -= c.mat; it.plus++; recalcHp(); save(state); refreshHud(); again('🔨 Refinado!'); } },
        { label: '⚡🔮' + ky, enabled: state.cash >= ky, fn: () => { state.cash -= ky; it.plus++; recalcHp(); save(state); refreshHud(); again('🔨 Refinado!'); } },
      ] });
    }
    // evoluir de nível (junta peças iguais)
    if (it.tier >= MAXLV - 1) rows.push({ text: '⭐ Nível máximo (10) ✔' });
    else {
      const need = evoNeed(it), fod = fodder(it), have = fod.length + 1, c = evoCost(it), nxt = Object.assign({}, it, { tier: it.tier + 1 });
      const okItems = have >= need, okRes = state.gold >= c.gold && (state.mats[matIdx(it)] || 0) >= c.mats;
      const hard = it.tier + 1 >= 7 ? '\nNíveis 8 a 10 só se conseguem forjando (não caem dos monstros).' : it.tier + 1 >= 5 ? '\nNível ' + (it.tier + 2) + ' é raro: cai de chefes ou se forja.' : '';
      rows.push({ text: '⭐ Evoluir para o Nível ' + (it.tier + 2) + '\n' + itemFmt(it) + '  →  ' + itemFmt(nxt) +
        '\nPrecisa: ' + need + ' peças iguais (mesmo tipo e nível ' + (it.tier + 1) + ')  —  você tem ' + have + '/' + need +
        '\n+ 🪙' + c.gold + ' + ' + MATS[matIdx(it)].icon + c.mats + (okItems ? '' : '  (faltam peças)') + hard, btns: [
        { label: 'EVOLUIR', enabled: okItems && okRes, fn: () => evolve(it, need, fod, c, false, again) },
        { label: '⚡🔮' + c.ky, enabled: okItems && state.cash >= c.ky, fn: () => evolve(it, need, fod, c, true, again) },
      ] });
      if (fod.length) rows.push({ text: 'Peças que serão gastas: ' + fod.slice(0, need - 1).map(f => RAR[f.rar].name + (f.plus ? ' +' + f.plus : '')).join(', ') + '\nA sua peça fica equipada e sobe de nível.' });
    }
    openPanel('⬆ ' + slotLabel(slot).toUpperCase(), rows);
  }
  function evolve(it, need, fod, c, withKy, again) {
    if (fod.length + 1 < need) return;
    if (withKy) state.cash -= c.ky; else { state.gold -= c.gold; state.mats[matIdx(it)] -= c.mats; }
    const used = fod.slice(0, need - 1); state.items = state.items.filter(i => !used.includes(i));
    const best = Math.max(it.rar, ...used.map(u => u.rar)); it.rar = Math.min(3, best + (Math.random() < 0.12 ? 1 : 0));
    it.tier++; it.gems = it.gems || []; recalcHp(); track('craft'); save(state); refreshHud(); again('⭐ Evoluiu para o Nível ' + (it.tier + 1) + '!');
  }

  // ---- forja ----
  const forgeCost = (tier) => ({ gold: Math.round(150 * Math.pow(tier + 1, 1.35)), mats: 10 + tier * 2 });
  function openForge(back, slot) {
    const rows = [{ text: '◀ Voltar', btn: 'VOLTAR', fn: slot ? () => openForge(back) : menu(back) }];
    if (!slot) {
      rows.push({ head: true, text: 'Escolha o tipo de equipamento.\nChance: Comum 35% • Raro 45% • Épico 16% • Lendário 4%' });
      SLOT_ORDER.forEach(sl => rows.push({ text: slotIcon(sl) + ' ' + slotLabel(sl), btn: 'ESCOLHER', fn: () => openForge(back, sl) }));
    } else {
      rows.push({ head: true, text: slotIcon(slot) + ' ' + slotLabel(slot) + ' — escolha o material (tier das florestas que você já alcançou)\n🪙' + state.gold });
      for (let t = 0; t <= maxTier(); t++) {
        const k = forgeCost(t), ok = state.gold >= k.gold && (state.mats[t] || 0) >= k.mats;
        rows.push({ text: MATS[t].icon + ' Tier ' + (t + 1) + '\nCusto: 🪙' + k.gold + ' + ' + MATS[t].icon + k.mats + '  (você tem ' + (state.mats[t] || 0) + ')', btn: 'FORJAR', enabled: ok, fn: () => {
          state.gold -= k.gold; state.mats[t] -= k.mats;
          const r = Math.random() * 100, rar = r < 4 ? 3 : r < 20 ? 2 : r < 65 ? 1 : 0;
          giveItem(newItem(slot, t, rar, mainCls())); track('craft'); save(state); refreshHud(); openForge(back, slot);
        } });
      }
    }
    openPanel('⚒ FORJA', rows);
  }

  // ---- gemas ----
  function openGems(back) {
    const tier = Math.min(5, state.act), rows = [{ text: '◀ Voltar', btn: 'VOLTAR', fn: menu(back) }];
    rows.push({ head: true, text: '🪙' + state.gold + '   ' + MATS[tier].icon + (state.mats[tier] || 0) });
    rows.push({ text: '✨ Lapidar uma gema aleatória (nível 1)\nCusto: 🪙250 + ' + MATS[tier].icon + '5', btn: 'LAPIDAR', enabled: state.gold >= 250 && (state.mats[tier] || 0) >= 5, fn: () => {
      state.gold -= 250; state.mats[tier] -= 5; giveGem(null, 1); track('craft'); save(state); refreshHud(); openGems(back);
    } });
    rows.push({ head: true, text: '🎒 SUAS GEMAS (3 iguais = 1 de nível maior)' });
    const list = bagList();
    if (!list.length) rows.push({ text: 'Você ainda não tem gemas. Elites, chefes, baús e masmorras dão gemas!' });
    list.forEach(g => rows.push({ text: gemFmt(g.t, g.l) + '  ×' + g.n, btn: g.l < 3 ? 'FUNDIR 3→1' : 'MÁX.', enabled: g.l < 3 && g.n >= 3, fn: () => { add(g.t, g.l, -3); add(g.t, g.l + 1, 1); track('craft'); save(state); toast('💎 ' + gemFmt(g.t, g.l + 1)); openGems(back); } }));
    openPanel('💎 GEMAS', rows);
  }

  // ---- encaixe ----
  function openSocket(back, it) {
    const rows = [{ text: '◀ Voltar', btn: 'VOLTAR', fn: it ? () => openSocket(back) : menu(back) }];
    if (!it) {
      const list = state.items.filter(i => i.rar >= 1).sort((a, b) => (isEquipped(b) ? 1 : 0) - (isEquipped(a) ? 1 : 0));
      rows.push({ head: true, text: 'Escolha um item com encaixes (raro ou melhor).' });
      if (!list.length) rows.push({ text: 'Nenhum item raro ou melhor na mochila.' });
      list.forEach(i => rows.push({ text: (isEquipped(i) ? '✔ equipado  ' : '') + itemLine(i), btn: 'ABRIR', fn: () => openSocket(back, i) }));
    } else {
      it.gems = it.gems || [];
      rows.push({ head: true, text: itemLine(it) + '\nEncaixes: ' + it.gems.length + '/' + it.rar });
      it.gems.forEach((g, idx) => rows.push({ text: gemFmt(g.t, g.l), btn: 'REMOVER 🪙100', enabled: state.gold >= 100, fn: () => { state.gold -= 100; it.gems.splice(idx, 1); add(g.t, g.l, 1); recalcHp(); save(state); refreshHud(); openSocket(back, it); } }));
      if (it.gems.length < it.rar) {
        rows.push({ head: true, text: 'Escolha uma gema para encaixar:' });
        const list = bagList(); if (!list.length) rows.push({ text: 'Sem gemas. Lapide ou ganhe em elites/chefes/baús.' });
        list.forEach(g => rows.push({ text: gemFmt(g.t, g.l) + '  ×' + g.n, btn: 'ENCAIXAR', fn: () => { add(g.t, g.l, -1); it.gems.push({ t: g.t, l: g.l }); recalcHp(); save(state); toast('🔧 Encaixada!'); openSocket(back, it); } }));
      }
    }
    openPanel('🔧 ENCAIXES', rows);
  }

  return { openCraft, openEquipUp, openForge, openGems, openSocket, giveGem };
}
