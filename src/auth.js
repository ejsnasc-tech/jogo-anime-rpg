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
#auth .pw{display:flex;gap:6px}#auth .pw input{flex:1;min-width:0}#auth .pw button{width:52px;height:46px;font-size:18px;background:#26334f;border-color:#6d7fa8}
#auth .code{font-family:ui-monospace,Consolas,monospace;font-size:22px;letter-spacing:1px;text-align:center;color:#f5c542;background:#0b1224;border:2px dashed #f5c542;border-radius:12px;padding:16px 6px;user-select:all;word-break:break-all}
#auth .warn{font-size:13px;line-height:1.35;background:#3a2a10;border:1px solid #f5c542;border-radius:10px;padding:8px 10px}
#auth label.chk{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.3;cursor:pointer}#auth label.chk input{height:auto;width:22px;flex:none;margin-top:1px}
#auth .ok{color:#8aff9b;font-size:13px;min-height:16px;text-align:center}
`;

export function openAuth(opts) {
  if (!document.getElementById('auth-css')) { const st = document.createElement('style'); st.id = 'auth-css'; st.textContent = CSS; document.head.appendChild(st); }
  const root = document.createElement('div'); root.id = 'auth'; document.body.appendChild(root);
  const box = document.createElement('div'); box.className = 'box'; root.appendChild(box);
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  let lastName = (() => { try { return localStorage.getItem('acrpg_lastname') || ''; } catch (e) { return ''; } })();
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
  // campo de senha com botao de mostrar/ocultar (no celular e facil errar a digitacao)
  function pwField(ph, ac) {
    const wrap = el('div', 'pw'), inp = el('input'); inp.type = 'password'; inp.placeholder = ph; inp.maxLength = 64; inp.autocomplete = ac;
    const eye = el('button', null, '👁'); eye.type = 'button'; eye.setAttribute('aria-label', 'Mostrar ou ocultar a senha');
    eye.onclick = () => { const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; eye.textContent = show ? '🙈' : '👁'; };
    wrap.append(inp, eye); return { wrap, inp };
  }
  // depois de entrar: quem ainda nao salvou o codigo de recuperacao vai para a tela dele (conta nova sempre passa por ela)
  function afterLogin(r) { if (r.rec) viewChars(r.chars); else viewRecovery(r.chars); }
  function viewLogin(msg) {
    box.innerHTML = '';
    const name = el('input'); name.placeholder = 'Nome da conta'; name.maxLength = 16; name.value = lastName; name.autocomplete = 'username';
    const pf = pwField('Senha', 'current-password'), pass = pf.inp;
    const err = el('div', 'err', msg || '');
    const go = el('button', null, 'ENTRAR'), reg = el('button', 'sec', 'CRIAR CONTA NOVA'), forgot = el('button', 'sec', '🔑 Esqueci minha senha');
    const submit = async (path) => {
      if (busy) return; busy = true; go.disabled = reg.disabled = true; err.textContent = '';
      try {
        const body = { name: name.value, pass: pass.value };
        if (path === 'register' && opts.legacy) { const lg = opts.legacy(); if (lg && lg.pid) body.legacyPid = lg.pid; }
        const r = await api(path, body); sess = { token: r.token, name: r.name, pid: r.pid };
        lastName = r.name; try { localStorage.setItem('acrpg_lastname', r.name); } catch (e) {}
        setSess(sess); afterLogin(r);
      } catch (e) { fail(e, err); } finally { busy = false; go.disabled = reg.disabled = false; }
    };
    go.onclick = () => submit('login'); reg.onclick = () => submit('register'); forgot.onclick = () => viewRecover(name.value);
    pass.onkeydown = (e) => { if (e.key === 'Enter') submit('login'); };
    box.append(el('h1', null, 'Aldyveon'), el('p', 'sub', 'Entre com a sua conta ou crie uma. Só nome e senha (mínimo 6 caracteres), sem e-mail.'), name, pf.wrap, err, go, reg, forgot);
    if (opts.offline) { const off = el('button', 'sec', 'Jogar sem conta (só neste aparelho)'); off.onclick = opts.offline; box.append(off); }
  }
  // esqueci a senha: nome + codigo de recuperacao + senha nova
  function viewRecover(prefill) {
    box.innerHTML = '';
    const name = el('input'); name.placeholder = 'Nome da conta'; name.maxLength = 16; name.value = prefill || lastName; name.autocomplete = 'username';
    const code = el('input'); code.placeholder = 'Código de recuperação (XXXX-XXXX-XXXX-XXXX)'; code.maxLength = 24; code.autocapitalize = 'characters'; code.autocomplete = 'off'; code.spellcheck = false;
    const pf = pwField('Senha nova (mínimo 6)', 'new-password'), err = el('div', 'err', '');
    const go = el('button', null, 'REDEFINIR SENHA'), back = el('button', 'sec', 'Voltar');
    go.onclick = async () => {
      if (busy) return; busy = true; go.disabled = true; err.textContent = '';
      try {
        const r = await api('recover', { name: name.value, code: code.value, pass: pf.inp.value }); sess = { token: r.token, name: r.name, pid: r.pid };
        lastName = r.name; try { localStorage.setItem('acrpg_lastname', r.name); } catch (e) {}
        setSess(sess); afterLogin(r);
      } catch (e) { err.textContent = e.message || 'Erro.'; } finally { busy = false; go.disabled = false; }
    };
    back.onclick = () => viewLogin();
    box.append(el('h2', null, '🔑 Recuperar conta'), el('p', 'sub', 'Digite o nome da conta, o código de recuperação que você salvou ao criar a conta e escolha uma senha nova.'), name, code, pf.wrap, err, go, back,
      el('p', 'sub', 'Sem o código não dá para recuperar por aqui. Fale com o suporte do jogo.'));
  }
  // codigo de recuperacao: aparece uma vez, o jogador compartilha/copia/baixa e confirma que salvou
  async function viewRecovery(chars, backFn) {
    box.innerHTML = ''; box.append(el('p', 'sub', 'Gerando o seu código de recuperação...'));
    let r;
    try { r = await api('recovery/new', { token: sess.token }); }
    catch (e) { box.innerHTML = ''; const er = el('div', 'err', e.message || 'Erro.'), rt = el('button', null, 'TENTAR DE NOVO'); rt.onclick = () => viewRecovery(chars, backFn); box.append(er, rt); return; }
    box.innerHTML = '';
    const err = el('div', 'err', ''), ok = el('div', 'ok', '');
    const text = 'Código de recuperação da conta Aldyveon "' + sess.name + '":\n' + r.code + '\n\nGuarde em um lugar seguro e não mostre a ninguém. Ele serve para recuperar a conta se você esquecer a senha.';
    const share = navigator.share ? el('button', null, '📤 COMPARTILHAR (WhatsApp, Notas, e-mail...)') : null, copy = el('button', 'sec', '📋 Copiar'), dl = el('button', 'sec', '💾 Baixar arquivo');
    if (share) share.onclick = async () => { try { await navigator.share({ title: 'Código de recuperação Aldyveon', text }); ok.textContent = 'Compartilhado. Confira se foi salvo.'; } catch (e) { /* cancelado */ } };
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(r.code); ok.textContent = 'Código copiado. Cole em um lugar seguro.'; }
      catch (e) { const ta = document.createElement('textarea'); ta.value = r.code; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok.textContent = 'Código copiado. Cole em um lugar seguro.'; } catch (x) { err.textContent = 'Não consegui copiar. Anote o código à mão.'; } ta.remove(); }
    };
    dl.onclick = () => { try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = 'aldyveon-codigo-recuperacao.txt'; document.body.appendChild(a); a.click(); a.remove(); ok.textContent = 'Arquivo baixado.'; } catch (e) { err.textContent = 'Não consegui baixar. Use Copiar.'; } };
    const lab = el('label', 'chk'), chk = document.createElement('input'); chk.type = 'checkbox'; lab.append(chk, el('span', null, 'Já salvei o código em um lugar seguro (e que não seja só este aparelho).'));
    const go = el('button', null, 'CONTINUAR'); go.disabled = true; chk.onchange = () => { go.disabled = !chk.checked; };
    go.onclick = async () => { go.disabled = true; try { await api('recovery/confirm', { token: sess.token }); (backFn || (() => viewChars(chars)))(); } catch (e) { go.disabled = false; fail(e, err); } };
    box.append(el('h2', null, '🔑 Código de recuperação'),
      el('p', 'sub', 'Se esquecer a senha, é este código que devolve a sua conta. Ele aparece só agora.'),
      el('div', 'code', r.code),
      el('div', 'warn', '⚠ Salve agora, de preferência no WhatsApp (mande para você mesmo), em Notas, e-mail ou Drive. Se perder o código e a senha, a conta não pode ser recuperada. Um novo código invalida o anterior.'));
    if (share) box.append(share);
    box.append(el('div', 'row'));
    box.lastChild.append(copy, dl);
    box.append(ok, err, lab, go);
  }
  // conta: trocar senha e gerar novo codigo
  function viewAccount(chars) {
    box.innerHTML = '';
    const o = pwField('Senha atual', 'current-password'), n = pwField('Senha nova (mínimo 6)', 'new-password'), err = el('div', 'err', ''), ok = el('div', 'ok', '');
    const ch = el('button', null, 'TROCAR SENHA'), nc = el('button', 'sec', '🔑 Gerar novo código de recuperação'), back = el('button', 'sec', 'Voltar');
    ch.onclick = async () => {
      err.textContent = ok.textContent = ''; ch.disabled = true;
      try { await api('pass/change', { token: sess.token, old: o.inp.value, pass: n.inp.value }); o.inp.value = n.inp.value = ''; ok.textContent = '✔ Senha trocada. Os outros aparelhos precisarão entrar de novo.'; }
      catch (e) { fail(e, err); } finally { ch.disabled = false; }
    };
    nc.onclick = () => { if (confirm('Gerar um código novo? O código antigo deixa de valer.')) viewRecovery(chars, () => viewAccount(chars)); };
    back.onclick = () => viewChars(chars);
    box.append(el('h2', null, '⚙ Conta: ' + sess.name), el('p', 'sub', 'Trocar a senha'), o.wrap, n.wrap, ok, err, ch, nc, back);
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
    const acc = el('button', 'sec', '⚙ Conta: trocar senha e código de recuperação'); acc.onclick = () => viewAccount(chars);
    const out = el('button', 'sec', 'Sair da conta');
    out.onclick = async () => { try { await api('logout', { token: sess.token }); } catch (e) {} sess = null; setSess(null); viewLogin(); };
    box.append(err, acc, out);
  }

  // sessão já salva: pula o login
  if (sess && sess.token) {
    box.append(el('p', 'sub', 'Entrando...'));
    api('me', { token: sess.token }).then(r => { sess.name = r.name; sess.pid = r.pid; delete sess.cid; setSess(sess); afterLogin(r); })
      .catch(e => { if (e.offline) { box.innerHTML = ''; viewLogin('Sem conexão com o servidor.'); } else { sess = null; setSess(null); viewLogin(); } });
  } else viewLogin();
  return { close() { root.remove(); } };
}
