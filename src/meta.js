// Metajogo: missões diárias/semanais, login diário, conquistas/títulos e ganhos offline.

export const QUESTS = [
  { id: 'k30', key: 'kill', need: 30, label: 'Derrote 30 monstros' },
  { id: 'k80', key: 'kill', need: 80, label: 'Derrote 80 monstros' },
  { id: 'st2', key: 'stage', need: 2, label: 'Conclua 2 estágios' },
  { id: 'bs1', key: 'boss', need: 1, label: 'Derrote 1 chefe' },
  { id: 'dr3', key: 'drop', need: 3, label: 'Encontre 3 equipamentos' },
  { id: 'el2', key: 'elite', need: 2, label: 'Derrote 2 monstros elite' },
  { id: 'ct1', key: 'city', need: 1, label: 'Visite a cidade de Aurora' },
  { id: 'fn1', key: 'furn', need: 1, label: 'Compre 1 móvel' },
  { id: 'em3', key: 'emote', need: 3, label: 'Use 3 emotes' },
  { id: 'ch1', key: 'chest', need: 1, label: 'Abra 1 baú de ruínas' },
  { id: 'ev1', key: 'event', need: 1, label: 'Vença 1 evento da floresta' },
  { id: 'fi3', key: 'fish', need: 3, label: 'Pesque 3 peixes' },
];
export const WEEKLY = [
  { id: 'wk', key: 'kill', need: 400, label: 'Derrote 400 monstros' },
  { id: 'wb', key: 'boss', need: 6, label: 'Derrote 6 chefes' },
  { id: 'wd', key: 'drop', need: 20, label: 'Encontre 20 equipamentos' },
];
export const LOGIN_DAYS = [
  { gold: 200 }, { gems: 10 }, { gold: 500 }, { gems: 15 }, { gems: 20 }, { gold: 1000 }, { gems: 50, big: 1 },
];
export const ACH = [
  { id: 'k100', title: 'Caçador', desc: 'Derrote 100 monstros', ok: (s) => s.meta.cnt.kill >= 100, gems: 10 },
  { id: 'k1000', title: 'Exterminador', desc: 'Derrote 1.000 monstros', ok: (s) => s.meta.cnt.kill >= 1000, gems: 40 },
  { id: 'k10000', title: 'Lenda Viva', desc: 'Derrote 10.000 monstros', ok: (s) => s.meta.cnt.kill >= 10000, gems: 200 },
  { id: 'l10', title: 'Veterano', desc: 'Chegue ao nível 10', ok: (s) => s.level >= 10, gems: 15 },
  { id: 'l25', title: 'Herói', desc: 'Chegue ao nível 25', ok: (s) => s.level >= 25, gems: 40 },
  { id: 'l50', title: 'Imortal', desc: 'Chegue ao nível 50', ok: (s) => s.level >= 50, gems: 120 },
  { id: 'b10', title: 'Matador de Chefes', desc: 'Derrote 10 chefes', ok: (s) => s.meta.cnt.boss >= 10, gems: 30 },
  { id: 'a3', title: 'Explorador', desc: 'Alcance o Ato 3', ok: (s) => s.maxAct >= 2, gems: 20 },
  { id: 'sd', title: 'Salvador do Tomo', desc: 'Complete a história', ok: (s) => s.storyDone, gems: 100 },
  { id: 'd100', title: 'Colecionador', desc: 'Encontre 100 equipamentos', ok: (s) => s.meta.cnt.drop >= 100, gems: 30 },
  { id: 'e25', title: 'Caçador de Elites', desc: 'Derrote 25 elites', ok: (s) => s.meta.cnt.elite >= 25, gems: 40 },
  { id: 'c10', title: 'Caçador de Tesouros', desc: 'Abra 10 baús', ok: (s) => s.meta.cnt.chest >= 10, gems: 30 },
  { id: 'h1', title: 'Proprietário', desc: 'Compre uma casa ou apartamento', ok: (s) => s.meta.cnt.house >= 1, gems: 20 },
  { id: 'f10', title: 'Decorador', desc: 'Compre 10 móveis', ok: (s) => s.meta.cnt.furn >= 10, gems: 25 },
  { id: 'm20', title: 'Sociável', desc: 'Use 20 emotes', ok: (s) => s.meta.cnt.emote >= 20, gems: 15 },
  { id: 'p1', title: 'Pescador', desc: 'Pesque 25 peixes', ok: (s) => s.meta.cnt.fish >= 25, gems: 25 },
  { id: 'v1', title: 'Evento Vencido', desc: 'Vença 5 eventos da floresta', ok: (s) => s.meta.cnt.event >= 5, gems: 30 },
  { id: 'g1', title: 'Mestre do Ofício', desc: 'Fabrique 10 itens', ok: (s) => s.meta.cnt.craft >= 10, gems: 30 },
  { id: 'dg1', title: 'Explorador de Masmorras', desc: 'Conclua 3 masmorras', ok: (s) => s.meta.cnt.dungeon >= 3, gems: 40 },
];

const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d) => { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
export const weekKey = (d) => { d = d || new Date(); const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return dayKey(t); };
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export const questReward = (level, weekly) => weekly ? { gold: level * 220 + 400, gems: 40 } : { gold: 80 + level * 28, gems: 5 };
export const loginReward = (day, level) => { const r = Object.assign({}, LOGIN_DAYS[day % 7]); if (r.gold) r.gold = Math.round(r.gold * (1 + level * 0.12)); return r; };

// garante que s.meta exista e esteja no dia/semana certos
export function ensureMeta(s) {
  if (!s.meta) s.meta = {};
  const m = s.meta;
  m.cnt = m.cnt || {}; m.ach = m.ach || {}; m.login = m.login || { last: '', streak: 0, got: '' }; m.chests = m.chests || {}; m.title = m.title || '';
  const today = dayKey(), wk = weekKey();
  if (m.day !== today) {
    m.day = today;
    m.dq = QUESTS.map(q => ({ q, h: hash(q.id + today) })).sort((a, b) => a.h - b.h).slice(0, 3).map(x => ({ id: x.q.id, key: x.q.key, need: x.q.need, label: x.q.label, have: 0, claimed: false }));
  }
  if (m.week !== wk) { m.week = wk; m.wq = WEEKLY.map(q => ({ id: q.id, key: q.key, need: q.need, label: q.label, have: 0, claimed: false })); }
  if (m.login.last !== today) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    m.login.streak = m.login.last === dayKey(y) ? m.login.streak : 0;   // quebra a sequência se pulou um dia
  }
  return m;
}

// o dia de login que vale hoje (0..6) e se já foi coletado
export function loginState(s) { const m = ensureMeta(s); const today = dayKey(); return { day: m.login.streak % 7, streak: m.login.streak, got: m.login.got === today }; }
export function claimLogin(s) {
  const m = ensureMeta(s), today = dayKey(); if (m.login.got === today) return null;
  const r = loginReward(m.login.streak % 7, s.level);
  m.login.got = today; m.login.last = today; m.login.streak++;
  return r;
}

// ganhos enquanto estava fora: ouro por minuto, até 8 horas
export function offlineGain(s) {
  const away = (Date.now() - (s.lastSeen || Date.now())) / 60000;
  if (away < 10) return null;
  const mins = Math.min(away, 480);
  return { mins: Math.round(mins), gold: Math.round(mins * (2 + s.level * 1.1)) };
}
