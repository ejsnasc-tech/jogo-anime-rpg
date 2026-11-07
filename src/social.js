// Funções online entre jogadores: mercado, troca direta, guilda, ranking e chefe mundial.
import { api } from './auth.js';

export function initSocial(c) {
  const { state, sess, toast, openPanel, closePanel, save, refreshHud, itemLine, sellPrice, isEquipped, giveItem, newItem, SLOT_ORDER, mainCls, track } = c;
  const card = () => document.getElementById('card');
  const openTitle = () => { const h = document.querySelector('#card h2'), on = document.getElementById('panel').classList.contains('open'); return on && h ? h.textContent : ''; };
  const need = () => { if (!sess || !sess.token) { toast('🔒 Entre com uma conta (tela inicial) para usar o modo online'); return false; } return true; };
  const call = async (p, b) => {
    try { return await api(p, Object.assign({ token: sess && sess.token }, b || {})); }
    catch (e) { toast('⚠ ' + (e.message || 'Erro de rede')); if (e.status === 401) { setTimeout(() => location.reload(), 1200); } return null; }
  };
  const addRaw = (it) => { state.items.push(it); };
  const removeItem = (it) => { state.items = state.items.filter(i => i.uid !== it.uid); };
  const mm = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const loading = (title, back) => openPanel(title, [back ? { text: '◀ Voltar', btn: 'VOLTAR', fn: back } : { head: true, text: '' }, { head: true, text: 'Carregando...' }]);
  const backRow = (back) => back ? [{ text: '◀ Voltar', btn: 'VOLTAR', fn: back }] : [];
  const giveGot = (got) => {   // recebe ouro/itens de uma troca
    if (!got) return; state.gold += got.gold || 0; (got.items || []).forEach(addRaw);
  };

  // ================= Ranking =================
  async function openRank(back) {
    loading('🏆 RANKING', back);
    let r; try { r = await api('rank', {}); } catch (e) { toast('⚠ ' + e.message); return; }
    const rows = backRow(back), med = ['🥇', '🥈', '🥉'];
    const sec = (title, list, f) => { rows.push({ head: true, text: title }); list.forEach((x, i) => rows.push({ text: (med[i] || (i + 1) + '.') + ' ' + x.name + '\n' + f(x) })); if (!list.length) rows.push({ text: 'Ninguém ainda.' }); };
    sec('⭐ MAIOR NÍVEL', r.level, x => 'Nv.' + x.level);
    sec('⚔️ MAIS ABATES', r.kills, x => (x.kills || 0).toLocaleString('pt-BR') + ' monstros');
    sec('👑 MAIS CHEFES', r.bosses, x => (x.bosses || 0) + ' chefes');
    openPanel('🏆 RANKING', rows);
  }

  // ================= Mercado =================
  async function openMarket(view, back) {
    if (!need()) return; view = view || 'buy';
    const T = '🏪 MERCADO'; loading(T, back);
    const tabs = { text: '🪙 ' + state.gold + '   •   taxa de 5% sobre cada venda', btns: [
      { label: view === 'buy' ? '● COMPRAR' : 'COMPRAR', fn: () => openMarket('buy', back) },
      { label: view === 'sell' ? '● VENDER' : 'VENDER', fn: () => openMarket('sell', back) },
      { label: view === 'mine' ? '● MEUS ANÚNCIOS' : 'MEUS ANÚNCIOS', fn: () => openMarket('mine', back) }] };
    const rows = backRow(back); rows.push(tabs);
    if (view === 'buy') {
      const r = await call('market/list', {}); if (!r) return;
      if (!r.items.length) rows.push({ text: 'Nenhum anúncio no momento. Seja o primeiro a vender!' });
      r.items.forEach(x => rows.push({ text: itemLine(x.item) + '\nVendedor: ' + x.seller + (x.mine ? ' (você)' : ''), btn: '🪙' + x.price, enabled: !x.mine && state.gold >= x.price, fn: async () => {
        if (state.gold < x.price) return;
        const b = await call('market/buy', { id: x.id }); if (!b) { openMarket('buy', back); return; }
        state.gold -= b.price; giveItem(b.item); save(state); refreshHud(); toast('🛒 Comprou por 🪙' + b.price); openMarket('buy', back);
      } }));
    } else if (view === 'sell') {
      const list = state.items.filter(i => !isEquipped(i));
      rows.push({ head: true, text: 'Escolha um item da mochila (equipados não aparecem). Preço sugerido = 3× o valor de venda na loja.' });
      if (!list.length) rows.push({ text: 'Sua mochila não tem itens livres.' });
      list.forEach(it => rows.push({ text: itemLine(it) + '\nLoja paga 🪙' + sellPrice(it), btn: 'ANUNCIAR', fn: async () => {
        const p = parseInt(window.prompt('Preço em ouro (1 a 5.000.000):', String(sellPrice(it) * 3)) || '', 10); if (!(p >= 1)) return;
        const r = await call('market/sell', { item: it, price: p }); if (!r) return;
        removeItem(it); save(state); refreshHud(); toast('📢 Anunciado por 🪙' + p); openMarket('mine', back);
      } }));
    } else {
      const r = await call('market/mine', {}); if (!r) return;
      rows.push({ text: r.gold ? '💰 Vendas a receber: 🪙' + r.gold + ' (' + r.sold + ' venda(s))' : 'Nenhuma venda pendente.', btn: r.gold ? 'COLETAR' : '', enabled: !!r.gold, fn: async () => { const g = await call('market/collect', {}); if (!g) return; state.gold += g.gold; save(state); refreshHud(); toast('💰 +🪙' + g.gold); openMarket('mine', back); } });
      if (!r.items.length) rows.push({ text: 'Você não tem anúncios ativos.' });
      r.items.forEach(x => rows.push({ text: itemLine(x.item) + '\nPreço: 🪙' + x.price, btn: 'RETIRAR', fn: async () => { const b = await call('market/cancel', { id: x.id }); if (!b) return; addRaw(b.item); save(state); toast('↩ Item devolvido à mochila'); openMarket('mine', back); } }));
    }
    openPanel(T, rows);
  }

  // ================= Troca direta =================
  let tradeTimer = null;
  const offTxt = (o) => ((o.gold ? '🪙' + o.gold + '  ' : '') + (o.items || []).map(itemLine).join('\n')) || '(nada)';
  async function openTrade(back) {
    if (!need()) return; loading('🤝 TROCA', back);
    const r = await call('trade/list', {}); if (!r) return;
    const rows = backRow(back);
    rows.push({ text: 'Troque itens e ouro com outro jogador. Os dois precisam confirmar. O que você oferece fica guardado até a troca terminar ou ser cancelada.', btn: '➕ NOVA', fn: async () => {
      const nm = (window.prompt('Nome da conta do jogador:') || '').trim(); if (!nm) return;
      const t = await call('trade/open', { name: nm }); if (t) openTradeView(t.trade.id, back);
    } });
    if (!r.trades.length) rows.push({ text: 'Nenhuma troca aberta.' });
    r.trades.forEach(t => rows.push({ text: 'Troca com ' + t.other + (t.incoming ? '  (convite dele)' : '') + (t.theirOk ? '\n✔ ele já confirmou' : ''), btn: 'ABRIR', fn: () => openTradeView(t.id, back) }));
    openPanel('🤝 TROCA', rows);
  }
  async function openTradeView(id, back, picking) {
    clearInterval(tradeTimer); const T = '🤝 TROCA';
    const r = await call('trade/get', { id }); if (!r) return; const t = r.trade;
    if (t.st !== 'open') { toast('Troca encerrada.'); openTrade(back); return; }
    const rows = backRow(() => { clearInterval(tradeTimer); openTrade(back); });
    rows.push({ head: true, text: 'Troca com ' + t.other });
    rows.push({ text: '📤 VOCÊ OFERECE' + (t.myOk ? '  ✔ confirmado' : '') + '\n' + offTxt(t.mine), color: '#9be3ff' });
    rows.push({ text: '📥 ' + t.other.toUpperCase() + ' OFERECE' + (t.theirOk ? '  ✔ confirmou' : '') + '\n' + offTxt(t.theirs), color: '#ffd166' });
    const setOffer = async (offer) => {
      const need$ = offer.gold - (t.mine.gold || 0); if (need$ > state.gold) { toast('Ouro insuficiente'); return; }
      const oldUids = new Set((t.mine.items || []).map(i => i.uid)), added = offer.items.filter(i => !oldUids.has(i.uid));
      added.forEach(removeItem); state.gold -= offer.gold;
      const res = await call('trade/offer', { id, gold: offer.gold, items: offer.items });
      if (!res) { added.forEach(addRaw); state.gold += offer.gold; refreshHud(); return; }
      giveGot(res.refund); save(state); refreshHud(); openTradeView(id, back);
    };
    if (picking) {
      rows.push({ head: true, text: 'Escolha o item para oferecer (máx. 4):' });
      const used = new Set((t.mine.items || []).map(i => i.uid)), free = state.items.filter(i => !isEquipped(i) && !used.has(i.uid));
      if (!free.length) rows.push({ text: 'Sem itens livres na mochila.' });
      free.forEach(it => rows.push({ text: itemLine(it), btn: 'OFERECER', enabled: (t.mine.items || []).length < 4, fn: () => setOffer({ gold: t.mine.gold || 0, items: (t.mine.items || []).concat([it]) }) }));
      rows.push({ text: '◀ Cancelar escolha', btn: 'VOLTAR', fn: () => openTradeView(id, back) });
    } else {
      rows.push({ text: 'Adicionar um item', btn: '➕ ITEM', fn: () => openTradeView(id, back, true) });
      rows.push({ text: 'Definir ouro oferecido (você tem 🪙' + (state.gold + (t.mine.gold || 0)) + ')', btn: '🪙 OURO', fn: () => { const g = parseInt(window.prompt('Quanto ouro oferecer?', String(t.mine.gold || 0)) || '', 10); if (g >= 0) setOffer({ gold: g, items: t.mine.items || [] }); } });
      if ((t.mine.items || []).length) rows.push({ text: 'Retirar todos os itens da oferta', btn: 'LIMPAR', fn: () => setOffer({ gold: t.mine.gold || 0, items: [] }) });
      rows.push({ text: t.myOk ? 'Você confirmou. Aguardando ' + t.other + '…' : 'Confirme quando estiver satisfeito com os dois lados.', btn: t.myOk ? '✔' : '✅ CONFIRMAR', enabled: !t.myOk, fn: async () => {
        const o = await call('trade/ok', { id }); if (!o) return;
        if (o.done) { clearInterval(tradeTimer); toast('🤝 Troca concluída!'); pollMail(); setTimeout(() => openTrade(back), 600); } else openTradeView(id, back);
      } });
      rows.push({ text: 'Cancelar a troca (você recebe sua oferta de volta)', btn: '❌ CANCELAR', fn: async () => { const o = await call('trade/cancel', { id }); if (!o) return; clearInterval(tradeTimer); pollMail(); toast('Troca cancelada'); setTimeout(() => openTrade(back), 500); } });
    }
    const st = card().scrollTop; openPanel(T, rows); card().scrollTop = st;
    if (!picking) tradeTimer = setInterval(async () => {
      if (openTitle() !== T) { clearInterval(tradeTimer); return; }
      const n = await api('trade/get', { token: sess.token, id }).catch(() => null);
      if (n && n.trade && (n.trade.st !== 'open' || JSON.stringify(n.trade.theirs) !== JSON.stringify(t.theirs) || n.trade.theirOk !== t.theirOk || n.trade.myOk !== t.myOk)) { clearInterval(tradeTimer); if (n.trade.st !== 'open') { pollMail(); toast('Troca encerrada'); openTrade(back); } else openTradeView(id, back); }
    }, 3000);
  }
  // correio: recebe itens/ouro de trocas concluídas ou canceladas, e avisa convites
  const seenTrades = new Set();
  async function pollMail() {
    if (!sess || !sess.token) return;
    const m = await api('mail/take', { token: sess.token }).catch(() => null);
    if (m && m.mail.length) {
      m.mail.forEach(x => { giveGot(x.body.got); if (x.kind === 'trade') toast('🤝 Troca com ' + x.body.from + ' concluída: recebeu ' + offTxt(x.body.got).replace(/\n/g, ', ')); else toast('↩ Oferta devolvida'); });
      save(state); refreshHud();
    }
    const t = await api('trade/list', { token: sess.token }).catch(() => null);
    if (t) t.trades.filter(x => x.incoming && !seenTrades.has(x.id)).forEach(x => { seenTrades.add(x.id); toast('📨 ' + x.other + ' quer trocar com você! Fale com o Negociante.'); });
  }
  function startPolls() { if (!sess || !sess.token) return; setTimeout(pollMail, 4000); setInterval(pollMail, 20000); }

  // ================= Guilda =================
  let guildTimer = null, lastMsgId = -1;
  async function openGuild(back) {
    if (!need()) return; const T = '🛡 GUILDA'; clearInterval(guildTimer);
    const g = await call('guild/me', {}); if (!g) return;
    const rows = backRow(back);
    if (!g.guild) {
      const l = await call('guild/list', {}); if (!l) return;
      rows.push({ text: 'Crie uma guilda (🪙1000) ou entre em uma existente. Membros conversam no chat da guilda.', btn: '➕ CRIAR', enabled: state.gold >= 1000, fn: async () => {
        const name = (window.prompt('Nome da guilda (3 a 20 letras):') || '').trim(); if (!name) return;
        const tag = (window.prompt('Sigla (2 a 4 letras/números):') || '').trim(); if (!tag) return;
        const r = await call('guild/create', { name, tag }); if (!r) return;
        state.gold -= 1000; save(state); refreshHud(); toast('🛡 Guilda criada!'); openGuild(back);
      } });
      if (!l.guilds.length) rows.push({ text: 'Ainda não há guildas. Crie a primeira!' });
      l.guilds.forEach(x => rows.push({ text: '🛡 [' + x.tag + '] ' + x.name + '\n' + x.n + ' membro(s)', btn: 'ENTRAR', fn: async () => { const r = await call('guild/join', { id: x.id }); if (r) { toast('🛡 Você entrou na guilda!'); openGuild(back); } } }));
    } else {
      const G = g.guild; lastMsgId = g.msgs.length ? g.msgs[g.msgs.length - 1].id : 0;
      rows.push({ head: true, text: '🛡 [' + G.tag + '] ' + G.name + '\nVocê: ' + G.role + '  •  ' + G.members.length + ' membro(s)' });
      rows.push({ text: 'Membros: ' + G.members.map(m => (m.role === 'lider' ? '👑' : '') + m.name).join(', ') });
      rows.push({ head: true, text: '💬 CHAT DA GUILDA' });
      if (!g.msgs.length) rows.push({ text: 'Sem mensagens ainda.' });
      g.msgs.forEach(m => rows.push({ text: m.name + ': ' + m.text }));
      rows.push({ text: 'Escrever mensagem', btn: '✏ ESCREVER', fn: async () => { const t = (window.prompt('Mensagem para a guilda:') || '').trim(); if (!t) return; await call('guild/say', { text: t }); openGuild(back); } });
      rows.push({ text: 'Sair da guilda', btn: 'SAIR', fn: async () => { if (!confirm('Sair da guilda ' + G.name + '?')) return; const r = await call('guild/leave', {}); if (r) openGuild(back); } });
      guildTimer = setInterval(async () => {
        if (openTitle() !== T) { clearInterval(guildTimer); return; }
        const n = await api('guild/me', { token: sess.token }).catch(() => null);
        if (n && n.guild && n.msgs.length && n.msgs[n.msgs.length - 1].id !== lastMsgId) openGuild(back);
      }, 5000);
    }
    const st = card().scrollTop; openPanel(T, rows); if (g.guild) card().scrollTop = st;
  }

  // ================= Chefe mundial =================
  async function openWBoss(back, enter) {
    if (!need()) return; loading('🐉 CHEFE MUNDIAL', back);
    const v = await call('wboss/state', {}); if (!v) return;
    const rows = backRow(back);
    rows.push({ head: true, text: v.icon + ' ' + v.name + '\n' + (v.active ? (v.killed ? '☠ DERROTADO pela comunidade!' : 'Vida: ' + Math.round(v.hp).toLocaleString('pt-BR') + ' / ' + Math.round(v.maxhp).toLocaleString('pt-BR') + '  (' + Math.round(v.hp / v.maxhp * 100) + '%)\nTermina em ' + mm(v.left) + '  •  ' + v.players + ' jogador(es)') : 'O chefe aparece de hora em hora e dura 30 minutos.\nPróximo em ' + mm(v.next)) });
    rows.push({ text: 'Todos os jogadores ferem o MESMO chefe. A vida dele cresce com cada jogador que entra. Quem causar mais dano ganha mais recompensa; se a comunidade vencer, o prêmio dobra.', btn: v.active && !v.killed ? '⚔ ENTRAR' : '—', enabled: v.active && !v.killed, fn: () => enter(v) });
    if (v.my) rows.push({ text: 'Seu dano neste chefe: ' + Math.round(v.my).toLocaleString('pt-BR') });
    if (v.top.length) { rows.push({ head: true, text: '🏅 MAIORES DANOS' }); v.top.forEach((x, i) => rows.push({ text: (i + 1) + '. ' + x.name + ' — ' + Math.round(x.dmg).toLocaleString('pt-BR') })); }
    if (v.pend) rows.push({ text: '🎁 Recompensa do chefe anterior (seu dano: ' + Math.round(v.pend.dmg).toLocaleString('pt-BR') + (v.pend.killed ? ', vencido!' : '') + ')', btn: 'COLETAR', fn: async () => {
      const r = await call('wboss/claim', {}); if (!r) return;
      state.gold += r.gold; state.gems += r.gems; state.cash += r.cash;
      if (r.itemRar >= 0) giveItem(newItem(SLOT_ORDER[Math.floor(Math.random() * SLOT_ORDER.length)], Math.min(5, state.act), r.itemRar, mainCls()));
      track('wboss'); save(state); refreshHud(); toast('🎁 Posição #' + r.rank + ': +🪙' + r.gold + ' +💎' + r.gems + ' +💵' + r.cash); openWBoss(back, enter);
    } });
    openPanel('🐉 CHEFE MUNDIAL', rows);
  }
  const hit = (dmg) => (sess && sess.token ? api('wboss/hit', { token: sess.token, dmg: Math.round(dmg) }).catch(() => null) : Promise.resolve(null));

  return { openRank, openMarket, openTrade, openGuild, openWBoss, hit, startPolls };
}
