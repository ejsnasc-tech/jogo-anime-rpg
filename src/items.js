// Equipamentos, materiais e drops. Cada floresta (ato) é um "tier" 0..5 com nível de força próprio.
export const MAX_PLUS = 10;
export const FOREST_LV = [1, 7, 14, 21, 28, 36];   // nível dos inimigos no início de cada floresta
export const MATS = [
  { icon: '🐚', name: 'Conchas do Mar' }, { icon: '🕸️', name: 'Essência Sombria' }, { icon: '🔷', name: 'Cristal Arcano' },
  { icon: '🪨', name: 'Minério do Planalto' }, { icon: '🌿', name: 'Seiva Primeva' }, { icon: '🌌', name: 'Fragmento do Vazio' },
];
const MATERIAL = ['Concha', 'Ferro', 'Cristal', 'Rocha', 'Raiz', 'Vazio'];   // "Espada de Ferro", "Elmo de Cristal"...

// Atributos que os equipamentos dão (somados no jogo todo)
export const STATS = {
  atk: { fmt: (v) => '+' + Math.round(v * 100) + '% de ataque' },
  hp: { fmt: (v) => '+' + Math.round(v) + ' de vida' },
  crit: { fmt: (v) => '+' + (v * 100).toFixed(1) + '% de crítico' },
  def: { fmt: (v) => '-' + (v * 100).toFixed(1) + '% de dano recebido' },
  spd: { fmt: (v) => '+' + (v * 100).toFixed(1) + '% de velocidade' },
};

// Gemas: encaixam nos equipamentos (raro = 1 encaixe, épico = 2, lendário = 3)
export const GEMS = {
  ruby: { icon: '🔴', name: 'Rubi', stat: 'atk', v: [0.03, 0.06, 0.10] },
  emerald: { icon: '🟢', name: 'Esmeralda', stat: 'hp', v: [15, 35, 60] },
  topaz: { icon: '🟡', name: 'Topázio', stat: 'crit', v: [0.015, 0.035, 0.06] },
  sapphire: { icon: '🔵', name: 'Safira', stat: 'def', v: [0.015, 0.035, 0.06] },
  amethyst: { icon: '🟣', name: 'Ametista', stat: 'spd', v: [0.015, 0.03, 0.05] },
};
export const GEM_KEYS = Object.keys(GEMS);
export const gemFmt = (t, l) => GEMS[t].icon + ' ' + GEMS[t].name + ' Nv.' + l + ' (' + STATS[GEMS[t].stat].fmt(GEMS[t].v[l - 1]) + ')';
export const itemGemSum = (it, stat) => (it.gems || []).reduce((a, g) => a + (GEMS[g.t] && GEMS[g.t].stat === stat ? GEMS[g.t].v[g.l - 1] : 0), 0);
const gemTail = (it) => it.rar ? '  ' + (it.gems || []).map(x => GEMS[x.t] ? GEMS[x.t].icon + x.l : '').join('') + '◇'.repeat(Math.max(0, it.rar - (it.gems || []).length)) : '';

// Espaços do boneco: 1 anel e 1 amuleto.
export const SLOT_ORDER = ['helm', 'chest', 'legs', 'boots', 'weapon', 'offhand', 'amulet', 'ring'];
export const EQUIP_KEYS = ['helm', 'chest', 'legs', 'boots', 'weapon', 'offhand', 'amulet', 'ring'];
export const SLOTS = {
  helm: { icon: '🪖', name: 'Elmo', noun: 'Elmo', stat: 'hp', base: 10 },
  chest: { icon: '🥋', name: 'Peitoral', noun: 'Armadura', stat: 'hp', base: 22 },
  legs: { icon: '👖', name: 'Calça', noun: 'Calça', stat: 'def', base: 0.02 },
  boots: { icon: '🥾', name: 'Botas', noun: 'Botas', stat: 'spd', base: 0.02 },
  weapon: { icon: '⚔️', name: 'Arma', noun: 'Arma', stat: 'atk', base: 0.12 },
  offhand: { icon: '🛡️', name: 'Secundária', noun: 'Escudo', stat: 'def', base: 0.03 },
  amulet: { icon: '📿', name: 'Amuleto', noun: 'Amuleto', stat: 'crit', base: 0.03 },
  ring: { icon: '💍', name: 'Anel', noun: 'Anel', stat: 'atk', base: 0.03 },
};

// Arma e mão secundária mudam conforme a classe do personagem principal.
export const WEAPON_KIND = { warrior: 'sword', paladin: 'mace', assassin: 'dagger', archer: 'bow', mage: 'staff', sorcerer: 'wand', druid: 'totem' };
export const OFF_KIND = { warrior: 'shield', paladin: 'shield', assassin: 'offdagger', archer: 'quiver', mage: 'tome', sorcerer: 'orb', druid: 'charm' };
export const KINDS = {
  sword: { icon: '⚔️', label: 'Espada' }, mace: { icon: '🔨', label: 'Maça' }, dagger: { icon: '🗡️', label: 'Adaga' },
  bow: { icon: '🏹', label: 'Arco' }, staff: { icon: '🪄', label: 'Cajado' }, wand: { icon: '✨', label: 'Varinha' }, totem: { icon: '🌿', label: 'Cajado Druida' },
  shield: { icon: '🛡️', label: 'Escudo', stat: 'def', base: 0.03 }, offdagger: { icon: '🗡️', label: 'Adaga Sombria', stat: 'crit', base: 0.02 },
  quiver: { icon: '🎯', label: 'Aljava', stat: 'crit', base: 0.02 }, tome: { icon: '📖', label: 'Grimório', stat: 'atk', base: 0.06 },
  orb: { icon: '🔮', label: 'Orbe', stat: 'atk', base: 0.06 }, charm: { icon: '🍀', label: 'Talismã', stat: 'hp', base: 18 },
};

export const RAR = [
  { name: 'Comum', color: '#cfd8dc', mult: 1 }, { name: 'Raro', color: '#4fc3f7', mult: 1.4 },
  { name: 'Épico', color: '#c77dff', mult: 1.9 }, { name: 'Lendário', color: '#ffb703', mult: 2.6 },
];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export function newItem(slot, tier, rar, cls) {
  const it = { uid: uid(), slot, tier: Math.min(5, tier), rar, plus: 0 };
  if (slot === 'weapon') it.kind = WEAPON_KIND[cls] || 'sword';
  if (slot === 'offhand') it.kind = OFF_KIND[cls] || 'shield';
  return it;
}

export const itemStat = (it) => (it.kind && KINDS[it.kind] && KINDS[it.kind].stat) || SLOTS[it.slot].stat;
const itemBase = (it) => (it.kind && KINDS[it.kind] && KINDS[it.kind].base) || SLOTS[it.slot].base;
export const itemIcon = (it) => (it.kind && KINDS[it.kind] && KINDS[it.kind].icon) || SLOTS[it.slot].icon;
export const itemValue = (it) => itemBase(it) * (1 + it.tier * 0.5) * RAR[it.rar].mult * (1 + it.plus * 0.2);
export const statFmt = (stat, v) => STATS[stat].fmt(v);
export const itemFmt = (it) => STATS[itemStat(it)].fmt(itemValue(it));
export const itemName = (it) => ((it.kind && KINDS[it.kind] ? KINDS[it.kind].label : SLOTS[it.slot].noun) + ' de ' + MATERIAL[it.tier]) + (it.plus ? ' +' + it.plus : '');
export const itemLine = (it) => itemIcon(it) + ' ' + itemName(it) + ' [' + RAR[it.rar].name + ']  ' + itemFmt(it) + gemTail(it);
export const sellPrice = (it) => Math.round(12 * (1 + it.tier * 1.4) * (1 + it.rar * 1.6) * (1 + it.plus * 0.5));
export const buyPrice = (tier, rar) => Math.round(100 * (1 + tier * 1.5) * (1 + rar * 2.5));
export const upgradeCost = (it) => ({ gold: Math.round(40 * (it.plus + 1) * (1 + it.tier * 0.8)), mat: (it.plus + 1) * 2 });

// Saves antigos: 'armor' virou 'chest'
export function migrateItems(s) {
  (s.items || []).forEach(it => { if (it.slot === 'armor') it.slot = 'chest'; });
  if (s.equip && s.equip.armor) { s.equip.chest = s.equip.armor; delete s.equip.armor; }
  if (s.equip && (s.equip.ring1 || s.equip.ring2)) { s.equip.ring = s.equip.ring1 || s.equip.ring2; delete s.equip.ring1; delete s.equip.ring2; }
}

function rollRarity(boss) {
  const r = Math.random() * 100;
  if (boss) return r < 10 ? 3 : r < 50 ? 2 : 1;
  return r < 2 ? 3 : r < 12 ? 2 : r < 38 ? 1 : 0;
}

// Cada tipo de inimigo tem sua tabela de drops: chance de equipamento e quantidade de material.
export const LOOT = {
  Skeleton_Minion: { name: 'Esqueleto', item: 0.10, mat: 0.30, matN: 1 },
  Skeleton_Warrior: { name: 'Esqueleto Guerreiro', item: 0.20, mat: 0.55, matN: 2 },
  Skeleton_Rogue: { name: 'Arqueiro Esquelético', item: 0.18, mat: 0.45, matN: 2 },
  Skeleton_Mage: { name: 'Mago Esquelético', item: 0.22, mat: 0.55, matN: 2 },
  brute: { name: 'Bruto', item: 0.35, mat: 0.8, matN: 3 },
  runner: { name: 'Corredor', item: 0.12, mat: 0.35, matN: 1 },
  boss: { name: 'Chefe', item: 1, mat: 1, matN: 6 },
};

export function rollDrop(kind, tier, boss, cls) {
  const t = LOOT[boss ? 'boss' : kind] || LOOT.Skeleton_Minion;
  const res = { mat: 0, item: null };
  if (Math.random() < t.mat) res.mat = t.matN;
  if (Math.random() < t.item) res.item = newItem(SLOT_ORDER[Math.floor(Math.random() * SLOT_ORDER.length)], tier, rollRarity(boss), cls);
  return res;
}
