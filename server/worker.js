// Servidor da cidade online: uma sala (Durable Object) recebe posições por WebSocket e repassa aos outros.
const MAX_PLAYERS = 60;
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').slice(0, n);
const PLOT_RE = /^p\d{1,3}$/, FURN_RE = /^[a-z]{2,14}$/;
async function oidOf(pid) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('oid:' + pid)); return [...new Uint8Array(h)].slice(0, 5).map(b => b.toString(16).padStart(2, '0')).join(''); }
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const J = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: Object.assign({ 'content-type': 'application/json' }, CORS) });
const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha = async (s) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const rndHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const ITEM_SLOTS = ['helm', 'chest', 'legs', 'boots', 'weapon', 'offhand', 'amulet', 'ring'];
const okItem = (it) => !!it && typeof it === 'object' && ITEM_SLOTS.includes(it.slot) && Number.isInteger(it.tier) && it.tier >= 0 && it.tier <= 5 && Number.isInteger(it.rar) && it.rar >= 0 && it.rar <= 3 && Number.isInteger(it.plus || 0) && (it.plus || 0) >= 0 && (it.plus || 0) <= 10 && typeof it.uid === 'string' && it.uid.length <= 24;
const cleanItem = (it) => { const o = { uid: it.uid.replace(/[^a-z0-9]/gi, ''), slot: it.slot, tier: it.tier, rar: it.rar, plus: it.plus | 0 }; if (it.kind && /^[a-z]{3,12}$/.test(it.kind)) o.kind = it.kind; if (Array.isArray(it.gems)) o.gems = it.gems.slice(0, 3).map(g => ({ t: String(g.t || '').replace(/[^a-z]/g, '').slice(0, 8), l: Math.max(1, Math.min(3, g.l | 0)) })); return o; };
const WB_PERIOD = 3600e3, WB_LIFE = 30 * 60e3;
const WB_BOSSES = [{ name: 'Kraken Espectral', icon: '🐙', color: 0x2c8fb5 }, { name: 'Dragão das Brasas', icon: '🐉', color: 0xe8572a }, { name: 'Titã de Cristal', icon: '💎', color: 0x6c63ff }, { name: 'Rainha Sombria', icon: '👑', color: 0x7a3a9a }, { name: 'Colosso Primevo', icon: '🌳', color: 0x3d9a4a }, { name: 'Devorador do Vazio', icon: '🕳️', color: 0x30303a }];
const num = (v, lim) => (Number.isFinite(v) ? Math.max(-lim, Math.min(lim, v)) : 0);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Use WebSocket', { status: 426 });
      return env.ROOM.get(env.ROOM.idFromName('aurora-v4')).fetch(req);
    }
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname.startsWith('/api/')) return env.ACCTS.get(env.ACCTS.idFromName('main')).fetch(req);
    if (url.pathname === '/online') {
      const r = await env.ROOM.get(env.ROOM.idFromName('aurora-v4')).fetch(new Request('https://room/count'));
      return new Response(await r.text(), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
    }
    return new Response('jogo-anime-online ok', { headers: { 'access-control-allow-origin': '*' } });
  },
};

export class Zone {
  constructor(state) {
    this.state = state; this.plots = {};
    state.blockConcurrencyWhile(async () => { this.plots = (await state.storage.get('plots')) || {}; });
  }
  savePlots() { return this.state.storage.put('plots', this.plots); }
  pub() { const o = {}; for (const id in this.plots) o[id] = { oid: this.plots[id].oid, name: this.plots[id].name }; return o; }

  players() { return this.state.getWebSockets().map(ws => ws.deserializeAttachment()).filter(p => p && p.name); }
  pubP(p) { return { id: p.id, name: p.name, look: p.look, x: p.x, z: p.z, f: p.f, w: p.w, mv: p.mv }; }
  send(ws, o) { try { ws.send(JSON.stringify(o)); } catch (e) {} }
  broadcast(o, except) { const m = JSON.stringify(o); this.state.getWebSockets().forEach(ws => { if (ws !== except) { try { ws.send(m); } catch (e) {} } }); }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/count') { const ps = this.players(); return new Response(JSON.stringify({ online: ps.length, names: ps.map(p => p.name) })); }
    if (this.state.getWebSockets().length >= MAX_PLAYERS) return new Response('Sala cheia', { status: 503 });
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ id: crypto.randomUUID().slice(0, 8), name: '', t: 0 });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 4000) return;
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    const me = ws.deserializeAttachment() || {};
    if (m.t === 'join') {
      me.name = clean(m.name, 16) || 'Viajante'; me.look = m.look && JSON.stringify(m.look).length < 2500 ? m.look : null; me.x = 0; me.z = 0; me.f = 0; me.w = 'field'; me.mv = 0;
      ws.serializeAttachment(me);
      const others = this.players().filter(p => p.id !== me.id);
      me.pid = clean(m.pid, 40); me.oid = me.pid ? await oidOf(me.pid) : ''; ws.serializeAttachment(me);
      this.send(ws, { t: 'hello', id: me.id, oid: me.oid, players: others.map(p => this.pubP(p)), plots: this.pub() });
      this.broadcast({ t: 'join', p: this.pubP(me) }, ws);
    } else if (!me.name) { return; }
    else if (m.t === 'move') {
      me.x = num(m.x, 400); me.z = num(m.z, 400); me.f = num(m.f, 7); me.mv = m.mv ? 1 : 0; me.w = m.w === 'city' ? 'city' : /^(home:p\d{1,3}|field:(\d|inf|wb|dg))$/.test(String(m.w)) ? m.w : 'other';
      ws.serializeAttachment(me);
      this.broadcast({ t: 'move', id: me.id, x: me.x, z: me.z, f: me.f, mv: me.mv, w: me.w }, ws);
    } else if (m.t === 'buy') {
      const id = String(m.plot || '');
      if (!PLOT_RE.test(id) || !me.oid) return;
      const cur = this.plots[id];
      if (cur && cur.oid !== me.oid) { this.send(ws, { t: 'buyfail', plot: id }); return; }
      if (!cur) { this.plots[id] = { oid: me.oid, name: me.name, furn: [] }; await this.savePlots(); this.broadcast({ t: 'plot', id, oid: me.oid, name: me.name }); }
    } else if (m.t === 'furn') {
      const id = String(m.plot || ''), pl = this.plots[id];
      if (!pl || pl.oid !== me.oid || !Array.isArray(m.furn)) return;
      pl.furn = m.furn.slice(0, 80).filter(f => f && FURN_RE.test(String(f.k))).map(f => ({ k: String(f.k), x: num(f.x, 20), z: num(f.z, 20), r: (f.r | 0) & 3 }));
      await this.savePlots(); this.broadcast({ t: 'furn', plot: id, furn: pl.furn }, ws);
    } else if (m.t === 'sell') {
      const id = String(m.plot || ''), pl = this.plots[id];
      if (pl && pl.oid === me.oid) { delete this.plots[id]; await this.savePlots(); this.broadcast({ t: 'plot', id, oid: '', name: '' }); this.send(ws, { t: 'plot', id, oid: '', name: '' }); }
    } else if (m.t === 'visit') {
      const pl = this.plots[String(m.plot || '')];
      if (pl) this.send(ws, { t: 'home', plot: String(m.plot), name: pl.name, furn: pl.furn || [] });
    } else if (m.t === 'chat') {
      const now = Date.now(); if (now - (me.t || 0) < 900) return; me.t = now; ws.serializeAttachment(me);
      const text = clean(m.text, 120); if (text) this.broadcast({ t: 'chat', id: me.id, name: me.name, text });
    }
  }

  async webSocketClose(ws) { const me = ws.deserializeAttachment(); try { ws.close(); } catch (e) {} if (me && me.name) this.broadcast({ t: 'leave', id: me.id }, ws); }
  async webSocketError(ws) { return this.webSocketClose(ws); }
}

// ---- Contas: nome + senha, vários personagens por conta, save na nuvem (SQLite do Durable Object) ----
export class Accounts {
  constructor(state, env) {
    this.env = env; this.sql = state.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS acct (key TEXT PRIMARY KEY, name TEXT, salt TEXT, hash TEXT, pid TEXT UNIQUE, created INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS tok (token TEXT PRIMARY KEY, key TEXT, ts INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS chr (id TEXT PRIMARY KEY, key TEXT, name TEXT, cls TEXT, level INTEGER, save TEXT, updated INTEGER)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS chr_key ON chr(key)');
    try { this.sql.exec('ALTER TABLE chr ADD COLUMN kills INTEGER DEFAULT 0'); } catch (e) {}
    try { this.sql.exec('ALTER TABLE chr ADD COLUMN bosses INTEGER DEFAULT 0'); } catch (e) {}
    this.sql.exec('CREATE TABLE IF NOT EXISTS mkt (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT, seller TEXT, item TEXT, price INTEGER, created INTEGER, status TEXT, buyer TEXT)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS wallet (key TEXT PRIMARY KEY, gold INTEGER, sold INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS wb (cycle INTEGER PRIMARY KEY, hp REAL, maxhp REAL, players INTEGER, killed INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS wbh (cycle INTEGER, key TEXT, name TEXT, dmg REAL, last INTEGER, claimed INTEGER DEFAULT 0, PRIMARY KEY (cycle, key))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS guild (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, tag TEXT, leader TEXT, created INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS gmem (key TEXT PRIMARY KEY, name TEXT, gid INTEGER, role TEXT, joined INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS gmsg (id INTEGER PRIMARY KEY AUTOINCREMENT, gid INTEGER, name TEXT, text TEXT, ts INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS trade (id INTEGER PRIMARY KEY AUTOINCREMENT, a TEXT, an TEXT, b TEXT, bn TEXT, ao TEXT, bo TEXT, aok INTEGER, bok INTEGER, st TEXT, ts INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS mail (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT, kind TEXT, body TEXT, ts INTEGER)');
    this.lastSay = {};
  }
  rows(q, ...a) { return this.sql.exec(q, ...a).toArray(); }
  chars(key) { return this.rows('SELECT id, name, cls, level, updated FROM chr WHERE key = ? ORDER BY updated DESC', key); }
  auth(token) { const r = this.rows('SELECT a.key, a.name, a.pid FROM tok t JOIN acct a ON a.key = t.key WHERE t.token = ?', String(token || '')); return r[0] || null; }
  async session(key, name, pid) {
    const token = rndHex(24); this.sql.exec('INSERT INTO tok (token, key, ts) VALUES (?, ?, ?)', token, key, Date.now());
    this.sql.exec('DELETE FROM tok WHERE key = ? AND token NOT IN (SELECT token FROM tok WHERE key = ? ORDER BY ts DESC LIMIT 8)', key, key);
    return { token, name, pid, chars: this.chars(key) };
  }
  async fetch(req) {
    const url = new URL(req.url), path = url.pathname;
    if (req.method !== 'POST') return J({ err: 'use POST' }, 405);
    let b; try { b = await req.json(); } catch (e) { return J({ err: 'json inválido' }, 400); }
    if (path === '/api/register') {
      const name = String(b.name || '').trim().replace(/\s+/g, ' '), pass = String(b.pass || '');
      if (!/^[\p{L}\p{N}_ -]{3,16}$/u.test(name)) return J({ err: 'Nome: 3 a 16 letras ou números.' }, 400);
      if (pass.length < 4 || pass.length > 64) return J({ err: 'Senha: mínimo 4 caracteres.' }, 400);
      const key = name.toLowerCase();
      if (this.rows('SELECT 1 FROM acct WHERE key = ?', key).length) return J({ err: 'Esse nome já existe. Escolha outro ou entre.' }, 409);
      let pid = /^[a-f0-9]{32}$/.test(String(b.legacyPid || '')) ? String(b.legacyPid) : '';
      if (pid && this.rows('SELECT 1 FROM acct WHERE pid = ?', pid).length) pid = '';
      if (!pid) pid = rndHex(16);
      const salt = rndHex(8);
      this.sql.exec('INSERT INTO acct (key, name, salt, hash, pid, created) VALUES (?, ?, ?, ?, ?, ?)', key, name, salt, await sha(salt + pass), pid, Date.now());
      return J(await this.session(key, name, pid));
    }
    if (path === '/api/login') {
      const key = String(b.name || '').trim().replace(/\s+/g, ' ').toLowerCase(), a = this.rows('SELECT * FROM acct WHERE key = ?', key)[0];
      if (!a || a.hash !== await sha(a.salt + String(b.pass || ''))) return J({ err: 'Nome ou senha incorretos.' }, 401);
      return J(await this.session(a.key, a.name, a.pid));
    }
    if (path === '/api/admin/purge-tests') {
      if (!this.env.ADMIN || req.headers.get('x-admin') !== this.env.ADMIN) return J({ err: 'no' }, 403);
      const keys = this.rows('SELECT key FROM acct').map(r => r.key).filter(k => /^(t[a-z0-9]{6}|tst[a-z0-9]{6}|zz teste)$/.test(k));
      const q = keys.map(() => '?').join(',');
      if (keys.length) {
        this.sql.exec('DELETE FROM chr WHERE key IN (' + q + ')', ...keys); this.sql.exec('DELETE FROM tok WHERE key IN (' + q + ')', ...keys);
        this.sql.exec('DELETE FROM mkt WHERE key IN (' + q + ')', ...keys); this.sql.exec('DELETE FROM wallet WHERE key IN (' + q + ')', ...keys);
        this.sql.exec('DELETE FROM mail WHERE key IN (' + q + ')', ...keys); this.sql.exec('DELETE FROM trade WHERE a IN (' + q + ') OR b IN (' + q + ')', ...keys, ...keys);
        this.sql.exec('DELETE FROM gmem WHERE key IN (' + q + ')', ...keys); this.sql.exec('DELETE FROM guild WHERE id NOT IN (SELECT gid FROM gmem)'); this.sql.exec('DELETE FROM gmsg WHERE gid NOT IN (SELECT id FROM guild)');
        this.sql.exec('DELETE FROM acct WHERE key IN (' + q + ')', ...keys);
      }
      this.sql.exec('DELETE FROM wb'); this.sql.exec('DELETE FROM wbh');
      return J({ purged: keys.length });
    }
    if (path === '/api/rank') {
      const top = (col) => this.rows('SELECT name, cls, level, kills, bosses FROM chr ORDER BY ' + col + ' DESC, updated ASC LIMIT 15');
      return J({ level: top('level'), kills: top('kills'), bosses: top('bosses') });
    }
    const me = this.auth(b.token);
    if (!me) return J({ err: 'sessão expirada' }, 401);
    if (path === '/api/me') return J({ name: me.name, pid: me.pid, chars: this.chars(me.key) });
    if (path === '/api/logout') { this.sql.exec('DELETE FROM tok WHERE token = ?', String(b.token)); return J({ ok: 1 }); }
    if (path === '/api/char/get') {
      const r = this.rows('SELECT save FROM chr WHERE id = ? AND key = ?', String(b.id || ''), me.key)[0];
      return r ? J({ save: r.save }) : J({ err: 'personagem não encontrado' }, 404);
    }
    if (path === '/api/char/put') {
      const id = String(b.id || ''), save = String(b.save || '');
      if (!/^[a-z0-9]{8,32}$/.test(id) || save.length > 400000) return J({ err: 'dados inválidos' }, 400);
      const own = this.rows('SELECT key FROM chr WHERE id = ?', id)[0];
      if (own && own.key !== me.key) return J({ err: 'não é seu' }, 403);
      if (!own && this.rows('SELECT COUNT(*) AS n FROM chr WHERE key = ?', me.key)[0].n >= 6) return J({ err: 'Limite de 6 personagens por conta.' }, 400);
      const nm = clean(b.name, 16) || 'Herói', cls = clean(b.cls, 12), lv = Math.max(1, Math.min(999, b.level | 0));
      this.sql.exec('INSERT INTO chr (id, key, name, cls, level, save, updated, kills, bosses) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, cls = excluded.cls, level = excluded.level, save = excluded.save, updated = excluded.updated, kills = excluded.kills, bosses = excluded.bosses', id, me.key, nm, cls, lv, save, Date.now(), Math.max(0, Math.min(1e8, b.kills | 0)), Math.max(0, Math.min(1e6, b.bosses | 0)));
      return J({ ok: 1 });
    }
    if (path === '/api/char/del') { this.sql.exec('DELETE FROM chr WHERE id = ? AND key = ?', String(b.id || ''), me.key); return J({ ok: 1, chars: this.chars(me.key) }); }

    // ---------- Mercado entre jogadores ----------
    if (path.startsWith('/api/market/')) return this.market(path.slice(12), b, me);
    if (path.startsWith('/api/wboss/')) return this.wboss(path.slice(11), b, me);
    if (path.startsWith('/api/guild/')) return this.guild(path.slice(11), b, me);
    if (path.startsWith('/api/trade/')) return this.trade(path.slice(11), b, me);
    if (path === '/api/mail/take') {
      const r = this.rows('SELECT id, kind, body FROM mail WHERE key = ? ORDER BY id LIMIT 50', me.key);
      r.forEach(m => this.sql.exec('DELETE FROM mail WHERE id = ?', m.id));
      return J({ mail: r.map(m => ({ kind: m.kind, body: JSON.parse(m.body) })) });
    }
    return J({ err: 'rota inexistente' }, 404);
  }

  lvOf(key) { const r = this.rows('SELECT MAX(level) AS l FROM chr WHERE key = ?', key)[0]; return (r && r.l) || 1; }
  mail(key, kind, body) { this.sql.exec('INSERT INTO mail (key, kind, body, ts) VALUES (?, ?, ?, ?)', key, kind, JSON.stringify(body), Date.now()); }

  market(op, b, me) {
    if (op === 'list') {
      const slot = ITEM_SLOTS.includes(b.slot) ? b.slot : '';
      const r = this.rows("SELECT id, key, seller, item, price FROM mkt WHERE status = 'open' ORDER BY id DESC LIMIT 200");
      const out = r.map(x => ({ id: x.id, seller: x.seller, price: x.price, mine: x.key === me.key, item: JSON.parse(x.item) })).filter(x => !slot || x.item.slot === slot).slice(0, 60);
      return J({ items: out });
    }
    if (op === 'mine') {
      const r = this.rows("SELECT id, item, price FROM mkt WHERE key = ? AND status = 'open' ORDER BY id DESC", me.key).map(x => ({ id: x.id, price: x.price, item: JSON.parse(x.item) }));
      const w = this.rows('SELECT gold, sold FROM wallet WHERE key = ?', me.key)[0] || { gold: 0, sold: 0 };
      return J({ items: r, gold: w.gold, sold: w.sold });
    }
    if (op === 'sell') {
      if (!okItem(b.item)) return J({ err: 'Item inválido.' }, 400);
      const price = b.price | 0; if (price < 1 || price > 5000000) return J({ err: 'Preço inválido (1 a 5.000.000).' }, 400);
      if (this.rows("SELECT COUNT(*) AS n FROM mkt WHERE key = ? AND status = 'open'", me.key)[0].n >= 20) return J({ err: 'Limite de 20 anúncios.' }, 400);
      this.sql.exec("INSERT INTO mkt (key, seller, item, price, created, status) VALUES (?, ?, ?, ?, ?, 'open')", me.key, me.name, JSON.stringify(cleanItem(b.item)), price, Date.now());
      return J({ ok: 1 });
    }
    if (op === 'cancel') {
      const x = this.rows("SELECT id, item FROM mkt WHERE id = ? AND key = ? AND status = 'open'", b.id | 0, me.key)[0];
      if (!x) return J({ err: 'Anúncio não encontrado.' }, 404);
      this.sql.exec("UPDATE mkt SET status = 'gone' WHERE id = ?", x.id); return J({ item: JSON.parse(x.item) });
    }
    if (op === 'buy') {
      const x = this.rows("SELECT * FROM mkt WHERE id = ? AND status = 'open'", b.id | 0)[0];
      if (!x) return J({ err: 'Já foi vendido ou removido.' }, 404);
      if (x.key === me.key) return J({ err: 'É o seu próprio anúncio.' }, 400);
      this.sql.exec("UPDATE mkt SET status = 'sold', buyer = ? WHERE id = ?", me.name, x.id);
      this.sql.exec('INSERT INTO wallet (key, gold, sold) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET gold = gold + excluded.gold, sold = sold + 1', x.key, Math.floor(x.price * 0.95));
      return J({ item: JSON.parse(x.item), price: x.price });
    }
    if (op === 'collect') {
      const w = this.rows('SELECT gold, sold FROM wallet WHERE key = ?', me.key)[0] || { gold: 0, sold: 0 };
      this.sql.exec('DELETE FROM wallet WHERE key = ?', me.key); return J({ gold: w.gold, sold: w.sold });
    }
    return J({ err: 'rota inexistente' }, 404);
  }

  // ---------- Chefe mundial cooperativo (a vida é compartilhada por todos os jogadores) ----------
  wbView(me) {
    const now = Date.now(), cycle = Math.floor(now / WB_PERIOD), start = cycle * WB_PERIOD, active = now - start < WB_LIFE;
    let row = this.rows('SELECT * FROM wb WHERE cycle = ?', cycle)[0];
    if (!row && active) { this.sql.exec('INSERT INTO wb (cycle, hp, maxhp, players, killed) VALUES (?, 40000, 40000, 0, 0)', cycle); row = this.rows('SELECT * FROM wb WHERE cycle = ?', cycle)[0]; }
    const B = WB_BOSSES[cycle % WB_BOSSES.length];
    const top = row ? this.rows('SELECT name, dmg FROM wbh WHERE cycle = ? ORDER BY dmg DESC LIMIT 5', cycle) : [];
    const mine = row ? this.rows('SELECT dmg FROM wbh WHERE cycle = ? AND key = ?', cycle, me.key)[0] : null;
    // recompensa pendente: ciclo anterior (ou atual já derrotado) em que participei e ainda não coletei
    const pend = this.rows('SELECT h.cycle, h.dmg, w.killed, w.players FROM wbh h JOIN wb w ON w.cycle = h.cycle WHERE h.key = ? AND h.claimed = 0 AND (w.killed = 1 OR h.cycle < ?) ORDER BY h.cycle DESC LIMIT 1', me.key, cycle)[0];
    return { active, cycle, name: B.name, icon: B.icon, color: B.color, hp: row ? row.hp : 0, maxhp: row ? row.maxhp : 40000, players: row ? row.players : 0, killed: row ? !!row.killed : false,
      left: active ? WB_LIFE - (now - start) : 0, next: active ? WB_PERIOD - (now - start) : WB_PERIOD - (now - start), top, my: mine ? mine.dmg : 0,
      pend: pend ? { cycle: pend.cycle, dmg: pend.dmg, killed: !!pend.killed } : null };
  }
  wboss(op, b, me) {
    if (op === 'state') return J(this.wbView(me));
    const v = this.wbView(me);
    if (op === 'hit') {
      if (!v.active || v.killed) return J(v);
      const now = Date.now(), cur = this.rows('SELECT dmg, last FROM wbh WHERE cycle = ? AND key = ?', v.cycle, me.key)[0], lv = this.lvOf(me.key);
      const sec = Math.max(1, Math.min(15, ((now - (cur ? cur.last : now - 3000)) / 1000)));
      const d = Math.max(0, Math.min(b.dmg || 0, (lv * 450 + 2500) * sec));
      if (!cur) { this.sql.exec('INSERT INTO wbh (cycle, key, name, dmg, last) VALUES (?, ?, ?, 0, ?)', v.cycle, me.key, me.name, now); this.sql.exec('UPDATE wb SET players = players + 1, maxhp = MIN(600000, maxhp + 15000), hp = MIN(600000, hp + 15000) WHERE cycle = ?', v.cycle); }
      this.sql.exec('UPDATE wbh SET dmg = dmg + ?, last = ? WHERE cycle = ? AND key = ?', d, now, v.cycle, me.key);
      this.sql.exec('UPDATE wb SET hp = MAX(0, hp - ?) WHERE cycle = ?', d, v.cycle);
      this.sql.exec('UPDATE wb SET killed = 1 WHERE cycle = ? AND hp <= 0', v.cycle);
      return J(this.wbView(me));
    }
    if (op === 'claim') {
      const p = v.pend; if (!p) return J({ err: 'Nada para coletar.' }, 400);
      const rank = this.rows('SELECT COUNT(*) AS n FROM wbh WHERE cycle = ? AND dmg > ?', p.cycle, p.dmg)[0].n + 1, lv = this.lvOf(me.key), k = p.killed ? 2 : 1;
      const r = { gold: (500 + lv * 120) * k, gems: (10 + (rank === 1 ? 80 : rank <= 3 ? 40 : rank <= 10 ? 20 : 0)) * k, cash: p.killed ? 60 : 10, itemRar: rank <= 3 ? 2 : (Math.random() < 0.35 ? 1 : -1), rank, killed: p.killed };
      this.sql.exec('UPDATE wbh SET claimed = 1 WHERE cycle = ? AND key = ?', p.cycle, me.key);
      return J(r);
    }
    return J({ err: 'rota inexistente' }, 404);
  }

  // ---------- Guildas ----------
  gView(me) {
    const m = this.rows('SELECT gid, role FROM gmem WHERE key = ?', me.key)[0]; if (!m) return null;
    const g = this.rows('SELECT * FROM guild WHERE id = ?', m.gid)[0]; if (!g) return null;
    return { id: g.id, name: g.name, tag: g.tag, role: m.role, members: this.rows('SELECT name, role FROM gmem WHERE gid = ? ORDER BY joined', g.id) };
  }
  guild(op, b, me) {
    if (op === 'me') { const g = this.gView(me); return J({ guild: g, msgs: g ? this.rows('SELECT id, name, text FROM gmsg WHERE gid = ? ORDER BY id DESC LIMIT 40', g.id).reverse() : [] }); }
    if (op === 'list') return J({ guilds: this.rows('SELECT g.id, g.name, g.tag, COUNT(m.key) AS n FROM guild g JOIN gmem m ON m.gid = g.id GROUP BY g.id ORDER BY n DESC LIMIT 20') });
    const cur = this.gView(me);
    if (op === 'create') {
      if (cur) return J({ err: 'Você já está em uma guilda.' }, 400);
      const name = clean(b.name, 20).trim(), tag = clean(b.tag, 4).trim().toUpperCase();
      if (!/^[\p{L}\p{N} _-]{3,20}$/u.test(name) || !/^[A-Z0-9]{2,4}$/.test(tag)) return J({ err: 'Nome 3-20 letras e tag 2-4 letras/números.' }, 400);
      if (this.rows('SELECT 1 FROM guild WHERE lower(name) = lower(?)', name).length) return J({ err: 'Já existe uma guilda com esse nome.' }, 409);
      this.sql.exec('INSERT INTO guild (name, tag, leader, created) VALUES (?, ?, ?, ?)', name, tag, me.key, Date.now());
      const gid = this.rows('SELECT last_insert_rowid() AS id')[0].id;
      this.sql.exec("INSERT INTO gmem (key, name, gid, role, joined) VALUES (?, ?, ?, 'lider', ?)", me.key, me.name, gid, Date.now());
      return J({ ok: 1 });
    }
    if (op === 'join') {
      if (cur) return J({ err: 'Você já está em uma guilda.' }, 400);
      const g = this.rows('SELECT id FROM guild WHERE id = ?', b.id | 0)[0]; if (!g) return J({ err: 'Guilda não existe.' }, 404);
      if (this.rows('SELECT COUNT(*) AS n FROM gmem WHERE gid = ?', g.id)[0].n >= 30) return J({ err: 'Guilda cheia (30).' }, 400);
      this.sql.exec("INSERT INTO gmem (key, name, gid, role, joined) VALUES (?, ?, ?, 'membro', ?)", me.key, me.name, g.id, Date.now()); return J({ ok: 1 });
    }
    if (!cur) return J({ err: 'Você não está em uma guilda.' }, 400);
    if (op === 'leave') {
      this.sql.exec('DELETE FROM gmem WHERE key = ?', me.key);
      const rest = this.rows('SELECT key FROM gmem WHERE gid = ? ORDER BY joined LIMIT 1', cur.id)[0];
      if (!rest) { this.sql.exec('DELETE FROM guild WHERE id = ?', cur.id); this.sql.exec('DELETE FROM gmsg WHERE gid = ?', cur.id); }
      else if (cur.role === 'lider') { this.sql.exec("UPDATE gmem SET role = 'lider' WHERE key = ?", rest.key); this.sql.exec('UPDATE guild SET leader = ? WHERE id = ?', rest.key, cur.id); }
      return J({ ok: 1 });
    }
    if (op === 'say') {
      const now = Date.now(); if (now - (this.lastSay[me.key] || 0) < 1200) return J({ err: 'Devagar!' }, 429); this.lastSay[me.key] = now;
      const text = clean(b.text, 140).trim(); if (!text) return J({ ok: 1 });
      this.sql.exec('INSERT INTO gmsg (gid, name, text, ts) VALUES (?, ?, ?, ?)', cur.id, me.name, text, now);
      this.sql.exec('DELETE FROM gmsg WHERE gid = ? AND id NOT IN (SELECT id FROM gmsg WHERE gid = ? ORDER BY id DESC LIMIT 100)', cur.id, cur.id);
      return J({ ok: 1 });
    }
    return J({ err: 'rota inexistente' }, 404);
  }

  // ---------- Troca direta com confirmação dos dois lados ----------
  tView(t, me) {
    const a = t.a === me.key, parse = (x) => { try { return JSON.parse(x); } catch (e) { return { gold: 0, items: [] }; } };
    return { id: t.id, other: a ? t.bn : t.an, mine: parse(a ? t.ao : t.bo), theirs: parse(a ? t.bo : t.ao), myOk: !!(a ? t.aok : t.bok), theirOk: !!(a ? t.bok : t.aok), st: t.st, incoming: !a };
  }
  trade(op, b, me) {
    if (op === 'list') return J({ trades: this.rows("SELECT * FROM trade WHERE (a = ? OR b = ?) AND st = 'open' ORDER BY id DESC LIMIT 10", me.key, me.key).map(t => this.tView(t, me)) });
    if (op === 'open') {
      const name = String(b.name || '').trim().replace(/\s+/g, ' '), o = this.rows('SELECT key, name FROM acct WHERE key = ?', name.toLowerCase())[0];
      if (!o) return J({ err: 'Jogador não encontrado.' }, 404); if (o.key === me.key) return J({ err: 'Você não pode trocar consigo mesmo.' }, 400);
      let t = this.rows("SELECT * FROM trade WHERE st = 'open' AND ((a = ? AND b = ?) OR (a = ? AND b = ?))", me.key, o.key, o.key, me.key)[0];
      if (!t) { if (this.rows("SELECT COUNT(*) AS n FROM trade WHERE st = 'open' AND a = ?", me.key)[0].n >= 5) return J({ err: 'Muitas trocas abertas.' }, 400);
        this.sql.exec("INSERT INTO trade (a, an, b, bn, ao, bo, aok, bok, st, ts) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'open', ?)", me.key, me.name, o.key, o.name, '{"gold":0,"items":[]}', '{"gold":0,"items":[]}', Date.now());
        t = this.rows('SELECT * FROM trade WHERE id = last_insert_rowid()')[0]; }
      return J({ trade: this.tView(t, me) });
    }
    const t = this.rows("SELECT * FROM trade WHERE id = ? AND (a = ? OR b = ?)", b.id | 0, me.key, me.key)[0];
    if (!t) return J({ err: 'Troca não encontrada.' }, 404);
    const isA = t.a === me.key;
    if (op === 'get') return J({ trade: this.tView(t, me) });
    if (t.st !== 'open') return J({ err: 'Troca encerrada.', trade: this.tView(t, me) }, 400);
    if (op === 'offer') {
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 4);
      if (!items.every(okItem)) return J({ err: 'Item inválido.' }, 400);
      const gold = Math.max(0, Math.min(5000000, b.gold | 0)), old = JSON.parse(isA ? t.ao : t.bo);
      this.sql.exec('UPDATE trade SET ' + (isA ? 'ao' : 'bo') + ' = ?, aok = 0, bok = 0 WHERE id = ?', JSON.stringify({ gold, items: items.map(cleanItem) }), t.id);
      return J({ refund: old, trade: this.tView(this.rows('SELECT * FROM trade WHERE id = ?', t.id)[0], me) });
    }
    if (op === 'ok') {
      this.sql.exec('UPDATE trade SET ' + (isA ? 'aok' : 'bok') + ' = 1 WHERE id = ?', t.id);
      const n = this.rows('SELECT * FROM trade WHERE id = ?', t.id)[0];
      if (n.aok && n.bok) {
        this.sql.exec("UPDATE trade SET st = 'done' WHERE id = ?", t.id);
        this.mail(n.a, 'trade', { from: n.bn, got: JSON.parse(n.bo) }); this.mail(n.b, 'trade', { from: n.an, got: JSON.parse(n.ao) });
        return J({ done: 1, trade: this.tView(this.rows('SELECT * FROM trade WHERE id = ?', t.id)[0], me) });
      }
      return J({ trade: this.tView(n, me) });
    }
    if (op === 'cancel') {
      this.sql.exec("UPDATE trade SET st = 'cancel' WHERE id = ?", t.id);
      this.mail(t.a, 'refund', { got: JSON.parse(t.ao) }); this.mail(t.b, 'refund', { got: JSON.parse(t.bo) });
      return J({ ok: 1 });
    }
    return J({ err: 'rota inexistente' }, 404);
  }
}
