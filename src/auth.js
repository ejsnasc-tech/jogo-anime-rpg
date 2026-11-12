// Conta simples (nome + senha) e seleção de personagens. O save de cada personagem fica na nuvem.
import { CLASSES } from './data.js';

export const API = 'https://jogo-anime-online.ejsnasc.workers.dev/api/';
export async function api(path, body) {
  let r; try { r = await fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}), keepalive: path === 'char/put' && JSON.stringify(body).length < 60000 }); }
  catch (e) { throw Object.assign(new Error('Sem conexão com o servidor.'), { offline: true }); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.err || 'Erro ' + r.status), { status: r.status });
  return j;
}
export const getSess = () => { try { return JSON.parse(localStorage.getItem('acrpg_sess') || 'null'); } catch (e) { return null; } };
export const setSess = (s) => { try { if (s) localStorage.setItem('acrpg_sess', JSON.stringify(s)); else localStorage.removeItem('acrpg_sess'); } catch (e) {} };

const CSS = `
#auth{position:fixed;inset:0;z-index:150;display:flex;align-items:center;justify-content:center;background:linear-gradient(#22345c,#0b0f1a);color:#fff;font-family:inherit;padding:16px;overflow:auto}
#auth .box{width:min(420px,100%);background:rgba(16,25,43,.94);border:3px solid #f5c542;border-radius:18px;padding:20px 18px;display:flex;flex-direction:column;gap:10px;max-height:100%;overflow:auto}
#auth h1{margin:0;font-size:24px;color:#f5c542;text-align:center;text-shadow:0 2px 0 #000}
#auth h2{margin:0;font-size:18px;text-align:center}
#auth p.sub{margin:0;text-align:center;font-size:13px;opacity:.8}
#auth input{height:46px;border-radius:12px;border:2px solid #4a5c8a;background:#0b1224;color:#fff;font:inherit;font-size:16px;padding:0 12px}
#auth button{height:46px;border-radius:12px;border:2px solid #fff;background:#2e7d32;color:#fff;font:inherit;font-size:16px;cursor:pointer}
#auth button.sec{background:#26334f;border-color:#6d7fa8;font-size:14px;height:40px}
#auth button.red{background:#8a2b2b;border-color:#e57373}
#auth button:disabled{opacity:.5}
#auth .err{color:#ff8a8a;font-size:13px;min-height:16px;text-align:center}
#auth .row{display:flex;gap:8px}.row>*{flex:1}
#auth .chr{display:flex;align-items:center;gap:10px;background:#1a2540;border:2px solid #3b4d7a;border-radius:14px;padding:10px}
#auth .chr .ic{font-size:30px;width:42px;text-align:center}
#auth .chr .tx{flex:1;line-height:1.25}.chr .tx small{opacity:.7}
#auth .chr button{height:38px;padding:0 14px;font-size:14px}
`;

export function openAuth(opts) {
  if (!document.getElementById('auth-css')) { const st = document.createElement('style'); st.id = 'auth-css'; st.textContent = CSS; document.head.appendChild(st); }
  const root = document.createElement('div'); root.id = 'auth'; document.body.appendChild(root);
  const box = document.createElement('div'); box.className = 'box'; root.appendChild(box);
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const lastName = (() => { try { return localStorage.getItem('acrpg_lastname') || ''; } catch (e) { return ''; } })();
  let sess = getSess(), busy = false;

  async function enter(id, saveStr) {
    const r = saveStr ? { save: saveStr } : await api('char/get', { token: sess.token, id });
    let s = {}; try { s = JSON.parse(r.save || '{}'); } catch (e) {}
    s.pid = sess.pid; s.account = sess.name;
    try { localStorage.setItem('acrpg', JSON.stringify(s)); localStorage.setItem('acrpg_imported', '1'); } catch (e) {}
    setSess(Object.assign({}, sess, { cid: id })); location.reload();
  }
  function fail(e, errEl) {
    if (e.status === 401 && sess && sess.token) { sess = null; setSess(null); viewLogin('Sessão expirada. Entre de novo.'); return; }
    errEl.textContent = e.message || 'Erro.';
  }
  function viewLogin(msg) {
    box.innerHTML = '';
    const name = el('input'); name.placeholder = 'Nome da conta'; name.maxLength = 16; name.value = lastName; name.autocomplete = 'username';
    const pass = el('input'); pass.type = 'password'; pass.placeholder = 'Senha'; pass.maxLength = 64; pass.autocomplete = 'current-password';
    const err = el('div', 'err', msg || '');
    const go = el('button', null, 'ENTRAR'), reg = el('button', 'sec', 'CRIAR CONTA NOVA');
    const submit = async (path) => {
      if (busy) return; busy = true; go.disabled = reg.disabled = true; err.textContent = '';
      try {
        const body = { name: name.value, pass: pass.value };
        if (path === 'register' && opts.legacy) { const lg = opts.legacy(); if (lg && lg.pid) body.legacyPid = lg.pid; }
        const r = await api(path, body); sess = { token: r.token, name: r.name, pid: r.pid };
        try { localStorage.setItem('acrpg_lastname', r.name); } catch (e) {}
        setSess(sess); viewChars(r.chars);
      } catch (e) { fail(e, err); } finally { busy = false; go.disabled = reg.disabled = false; }
    };
    go.onclick = () => submit('login'); reg.onclick = () => submit('register');
    pass.onkeydown = (e) => { if (e.key === 'Enter') submit('login'); };
    box.append(el('h1', null, 'Aldyveon'), el('p', 'sub', 'Entre com a sua conta ou crie uma. Só nome e senha, sem e-mail.'), name, pass, err, go, reg);
    if (opts.offline) { const off = el('button', 'sec', 'Jogar sem conta (só neste aparelho)'); off.onclick = opts.offline; box.append(off); }
  }
  function viewChars(chars) {
    box.innerHTML = '';
    const err = el('div', 'err', '');
    box.append(el('h2', null, '👤 ' + sess.name), el('p', 'sub', chars.length ? 'Escolha seu personagem' : 'Você ainda não tem personagens. Crie o primeiro!'));
    chars.forEach(c => {
      const row = el('div', 'chr'), k = CLASSES[c.cls];
      row.append(el('div', 'ic', k ? k.icon : '🧙'));
      const tx = el('div', 'tx'); tx.append(el('b', null, c.name), document.createElement('br'), el('small', null, (k ? k.name : '') + ' • Nv.' + c.level)); row.append(tx);
      const play = el('button', null, 'JOGAR'), del = el('button', 'sec red', '🗑');
      play.onclick = async () => { play.disabled = true; try { await enter(c.id); } catch (e) { play.disabled = false; fail(e, err); } };
      del.onclick = async () => { if (!confirm('Excluir ' + c.name + ' para sempre? Isso não pode ser desfeito.')) return; try { const r = await api('char/del', { token: sess.token, id: c.id }); viewChars(r.chars); } catch (e) { fail(e, err); } };
      row.append(play, del); box.append(row);
    });
    const lg = opts.legacy && opts.legacy();
    if (lg && !localStorage.getItem('acrpg_imported')) {
      const imp = el('button', 'sec', '📥 Trazer meu personagem deste aparelho: ' + lg.name + ' (Nv.' + lg.level + ')');
      imp.onclick = async () => {
        imp.disabled = true;
        try {
          const s = JSON.parse(lg.raw); s.pid = sess.pid; s.account = sess.name; const id = 'i' + Math.random().toString(36).slice(2, 12) + 'x';
          await api('char/put', { token: sess.token, id, name: lg.name, cls: lg.cls, level: lg.level, save: JSON.stringify(s) });
          try { localStorage.setItem('acrpg_imported', '1'); } catch (e) {}
          await enter(id, JSON.stringify(s));
        } catch (e) { imp.disabled = false; fail(e, err); }
      };
      box.append(imp);
    }
    if (chars.length < 6) {
      const nw = el('button', null, '➕ NOVO PERSONAGEM');
      nw.onclick = async () => {
        root.style.display = 'none';
        const r = await opts.newChar(sess.name);
        root.style.display = '';
        if (!r) return;
        nw.disabled = true;
        try {
          const id = 'c' + Math.random().toString(36).slice(2, 12) + 'x', s = { custom: r.custom, account: sess.name, pid: sess.pid, seen: {} };
          await api('char/put', { token: sess.token, id, name: r.custom.name, cls: r.custom.cls, level: 1, save: JSON.stringify(s) });
          await enter(id, JSON.stringify(s));
        } catch (e) { nw.disabled = false; fail(e, err); }
      };
      box.append(nw);
    }
    const out = el('button', 'sec', 'Sair da conta');
    out.onclick = async () => { try { await api('logout', { token: sess.token }); } catch (e) {} sess = null; setSess(null); viewLogin(); };
    box.append(err, out);
  }

  // sessão já salva: pula o login
  if (sess && sess.token) {
    box.append(el('p', 'sub', 'Entrando...'));
    api('me', { token: sess.token }).then(r => { sess.name = r.name; sess.pid = r.pid; delete sess.cid; setSess(sess); viewChars(r.chars); })
      .catch(e => { if (e.offline) { box.innerHTML = ''; viewLogin('Sem conexão com o servidor.'); } else { sess = null; setSess(null); viewLogin(); } });
  } else viewLogin();
  return { close() { root.remove(); } };
}
