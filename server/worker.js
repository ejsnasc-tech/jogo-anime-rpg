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

export class City {
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
      me.x = num(m.x, 400); me.z = num(m.z, 400); me.f = num(m.f, 7); me.mv = m.mv ? 1 : 0; me.w = m.w === 'city' ? 'city' : /^(home:p\d{1,3}|field:(\d|inf))$/.test(String(m.w)) ? m.w : 'other';
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
  constructor(state) {
    this.sql = state.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS acct (key TEXT PRIMARY KEY, name TEXT, salt TEXT, hash TEXT, pid TEXT UNIQUE, created INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS tok (token TEXT PRIMARY KEY, key TEXT, ts INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS chr (id TEXT PRIMARY KEY, key TEXT, name TEXT, cls TEXT, level INTEGER, save TEXT, updated INTEGER)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS chr_key ON chr(key)');
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
      this.sql.exec('INSERT INTO chr (id, key, name, cls, level, save, updated) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, cls = excluded.cls, level = excluded.level, save = excluded.save, updated = excluded.updated', id, me.key, nm, cls, lv, save, Date.now());
      return J({ ok: 1 });
    }
    if (path === '/api/char/del') { this.sql.exec('DELETE FROM chr WHERE id = ? AND key = ?', String(b.id || ''), me.key); return J({ ok: 1, chars: this.chars(me.key) }); }
    return J({ err: 'rota inexistente' }, 404);
  }
}
