// Servidor da cidade online: uma sala (Durable Object) recebe posições por WebSocket e repassa aos outros.
const MAX_PLAYERS = 60;
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').slice(0, n);
const PLOT_RE = /^p\d{1,3}$/, FURN_RE = /^[a-z]{2,14}$/;
async function oidOf(pid) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('oid:' + pid)); return [...new Uint8Array(h)].slice(0, 5).map(b => b.toString(16).padStart(2, '0')).join(''); }
const num = (v, lim) => (Number.isFinite(v) ? Math.max(-lim, Math.min(lim, v)) : 0);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('Use WebSocket', { status: 426 });
      return env.ROOM.get(env.ROOM.idFromName('aurora-v3')).fetch(req);
    }
    if (url.pathname === '/online') {
      const r = await env.ROOM.get(env.ROOM.idFromName('aurora-v3')).fetch(new Request('https://room/count'));
      return new Response(await r.text(), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
    }
    return new Response('jogo-anime-online ok', { headers: { 'access-control-allow-origin': '*' } });
  },
};

export class Room {
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
      me.x = num(m.x, 400); me.z = num(m.z, 400); me.f = num(m.f, 7); me.mv = m.mv ? 1 : 0; me.w = m.w === 'city' ? 'city' : /^home:p\d{1,3}$/.test(String(m.w)) ? m.w : 'other';
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
