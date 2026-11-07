// Ofício: forjar equipamentos, lapidar/fundir gemas e encaixá-las nos itens.
import { GEMS, GEM_KEYS, gemFmt, MATS } from './items.js';

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
    rows.push({ text: '⚒ Forjar equipamento\nGaste materiais e ouro para criar um item com boa chance de raridade alta', btn: 'ABRIR', fn: () => openForge(back) });
    rows.push({ text: '💎 Lapidar e fundir gemas\nCrie gemas e una 3 iguais para subir de nível', btn: 'ABRIR', fn: () => openGems(back) });
    rows.push({ text: '🔧 Encaixar gemas\nColoque gemas nos seus itens (raro 1, épico 2, lendário 3 encaixes)', btn: 'ABRIR', fn: () => openSocket(back) });
    openPanel('⚒ OFÍCIO', rows);
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

  return { openCraft, openForge, openGems, openSocket, giveGem };
}
