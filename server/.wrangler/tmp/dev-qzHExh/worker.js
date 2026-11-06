var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var MAX_PLAYERS = 60;
var clean = /* @__PURE__ */ __name((s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").slice(0, n), "clean");
var PLOT_RE = /^p\d{1,3}$/;
var FURN_RE = /^[a-z]{2,14}$/;
async function oidOf(pid) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("oid:" + pid));
  return [...new Uint8Array(h)].slice(0, 5).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(oidOf, "oidOf");
var num = /* @__PURE__ */ __name((v, lim) => Number.isFinite(v) ? Math.max(-lim, Math.min(lim, v)) : 0, "num");
var worker_default = {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      if (req.headers.get("Upgrade") !== "websocket") return new Response("Use WebSocket", { status: 426 });
      return env.ROOM.get(env.ROOM.idFromName("aurora-v3")).fetch(req);
    }
    if (url.pathname === "/online") {
      const r = await env.ROOM.get(env.ROOM.idFromName("aurora-v3")).fetch(new Request("https://room/count"));
      return new Response(await r.text(), { headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
    }
    return new Response("jogo-anime-online ok", { headers: { "access-control-allow-origin": "*" } });
  }
};
var City = class {
  static {
    __name(this, "City");
  }
  constructor(state) {
    this.state = state;
    this.plots = {};
    state.blockConcurrencyWhile(async () => {
      this.plots = await state.storage.get("plots") || {};
    });
  }
  savePlots() {
    return this.state.storage.put("plots", this.plots);
  }
  pub() {
    const o = {};
    for (const id in this.plots) o[id] = { oid: this.plots[id].oid, name: this.plots[id].name };
    return o;
  }
  players() {
    return this.state.getWebSockets().map((ws) => ws.deserializeAttachment()).filter((p) => p && p.name);
  }
  pubP(p) {
    return { id: p.id, name: p.name, look: p.look, x: p.x, z: p.z, f: p.f, w: p.w, mv: p.mv };
  }
  send(ws, o) {
    try {
      ws.send(JSON.stringify(o));
    } catch (e) {
    }
  }
  broadcast(o, except) {
    const m = JSON.stringify(o);
    this.state.getWebSockets().forEach((ws) => {
      if (ws !== except) {
        try {
          ws.send(m);
        } catch (e) {
        }
      }
    });
  }
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/count") {
      const ps = this.players();
      return new Response(JSON.stringify({ online: ps.length, names: ps.map((p) => p.name) }));
    }
    if (this.state.getWebSockets().length >= MAX_PLAYERS) return new Response("Sala cheia", { status: 503 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ id: crypto.randomUUID().slice(0, 8), name: "", t: 0 });
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws, raw) {
    if (typeof raw !== "string" || raw.length > 4e3) return;
    let m;
    try {
      m = JSON.parse(raw);
    } catch (e) {
      return;
    }
    const me = ws.deserializeAttachment() || {};
    if (m.t === "join") {
      me.name = clean(m.name, 16) || "Viajante";
      me.look = m.look && JSON.stringify(m.look).length < 2500 ? m.look : null;
      me.x = 0;
      me.z = 0;
      me.f = 0;
      me.w = "field";
      me.mv = 0;
      ws.serializeAttachment(me);
      const others = this.players().filter((p) => p.id !== me.id);
      me.pid = clean(m.pid, 40);
      me.oid = me.pid ? await oidOf(me.pid) : "";
      ws.serializeAttachment(me);
      this.send(ws, { t: "hello", id: me.id, oid: me.oid, players: others.map((p) => this.pubP(p)), plots: this.pub() });
      this.broadcast({ t: "join", p: this.pubP(me) }, ws);
    } else if (!me.name) {
      return;
    } else if (m.t === "move") {
      me.x = num(m.x, 400);
      me.z = num(m.z, 400);
      me.f = num(m.f, 7);
      me.mv = m.mv ? 1 : 0;
      me.w = m.w === "city" ? "city" : /^(home:p\d{1,3}|field:(\d|inf))$/.test(String(m.w)) ? m.w : "other";
      ws.serializeAttachment(me);
      this.broadcast({ t: "move", id: me.id, x: me.x, z: me.z, f: me.f, mv: me.mv, w: me.w }, ws);
    } else if (m.t === "buy") {
      const id = String(m.plot || "");
      if (!PLOT_RE.test(id) || !me.oid) return;
      const cur = this.plots[id];
      if (cur && cur.oid !== me.oid) {
        this.send(ws, { t: "buyfail", plot: id });
        return;
      }
      if (!cur) {
        this.plots[id] = { oid: me.oid, name: me.name, furn: [] };
        await this.savePlots();
        this.broadcast({ t: "plot", id, oid: me.oid, name: me.name });
      }
    } else if (m.t === "furn") {
      const id = String(m.plot || ""), pl = this.plots[id];
      if (!pl || pl.oid !== me.oid || !Array.isArray(m.furn)) return;
      pl.furn = m.furn.slice(0, 80).filter((f) => f && FURN_RE.test(String(f.k))).map((f) => ({ k: String(f.k), x: num(f.x, 20), z: num(f.z, 20), r: (f.r | 0) & 3 }));
      await this.savePlots();
      this.broadcast({ t: "furn", plot: id, furn: pl.furn }, ws);
    } else if (m.t === "sell") {
      const id = String(m.plot || ""), pl = this.plots[id];
      if (pl && pl.oid === me.oid) {
        delete this.plots[id];
        await this.savePlots();
        this.broadcast({ t: "plot", id, oid: "", name: "" });
        this.send(ws, { t: "plot", id, oid: "", name: "" });
      }
    } else if (m.t === "visit") {
      const pl = this.plots[String(m.plot || "")];
      if (pl) this.send(ws, { t: "home", plot: String(m.plot), name: pl.name, furn: pl.furn || [] });
    } else if (m.t === "chat") {
      const now = Date.now();
      if (now - (me.t || 0) < 900) return;
      me.t = now;
      ws.serializeAttachment(me);
      const text = clean(m.text, 120);
      if (text) this.broadcast({ t: "chat", id: me.id, name: me.name, text });
    }
  }
  async webSocketClose(ws) {
    const me = ws.deserializeAttachment();
    try {
      ws.close();
    } catch (e) {
    }
    if (me && me.name) this.broadcast({ t: "leave", id: me.id }, ws);
  }
  async webSocketError(ws) {
    return this.webSocketClose(ws);
  }
};

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-JaqvRW/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-JaqvRW/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  City,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
