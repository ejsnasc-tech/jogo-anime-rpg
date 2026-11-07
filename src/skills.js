// Skills de evolução: a cada nível o jogador escolhe 1 entre 3 opções (estilo roguelike).
// Cada skill vai até o nível 5. kind: 'passive' (bônus contínuo) ou 'active' (dispara sozinha).
export const SKILL_MAX = 5;

export const SKILLS = [
  // ---- Ativas ----
  { id: 'lightning', kind: 'active', icon: '⚡', name: 'Relâmpago', desc: (l) => `Raios caem em ${l + 1} inimigos a cada ${(3.6 - l * 0.4).toFixed(1)}s` },
  { id: 'nova', kind: 'active', icon: '🔥', name: 'Nova Flamejante', desc: (l) => `Explosão de fogo ao seu redor a cada ${(7 - l * 0.7).toFixed(1)}s (raio ${(3.5 + l * 0.7).toFixed(1)})` },
  { id: 'orbs', kind: 'active', icon: '🔮', name: 'Orbes Arcanos', desc: (l) => `${l + 1} orbes giram em volta de você ferindo quem tocar` },
  { id: 'aura', kind: 'active', icon: '🌵', name: 'Aura Espinhosa', desc: (l) => `Fere quem chega perto (raio ${(2.2 + l * 0.4).toFixed(1)}) continuamente` },
  { id: 'frost', kind: 'active', icon: '❄️', name: 'Onda Gélida', desc: (l) => `Pulso de gelo a cada ${(8 - l * 0.8).toFixed(1)}s: dano e lentidão em todos por perto` },
  // ---- Passivas ----
  { id: 'might', kind: 'passive', icon: '💪', name: 'Fúria', desc: (l) => `+${l * 12}% de dano em tudo` },
  { id: 'haste', kind: 'passive', icon: '🌀', name: 'Frenesi', desc: (l) => `+${l * 9}% de velocidade de ataque` },
  { id: 'vigor', kind: 'passive', icon: '❤️', name: 'Vigor', desc: (l) => `+${l * 25} de vida máxima` },
  { id: 'regen', kind: 'passive', icon: '🌿', name: 'Regeneração', desc: (l) => `Recupera ${(l * 1.2).toFixed(1)} de vida por segundo` },
  { id: 'armor', kind: 'passive', icon: '🛡️', name: 'Pele de Ferro', desc: (l) => `-${l * 7}% de dano recebido` },
  { id: 'swift', kind: 'passive', icon: '👟', name: 'Pés Alados', desc: (l) => `+${l * 6}% de velocidade de movimento` },
  { id: 'crit', kind: 'passive', icon: '🎯', name: 'Olho Letal', desc: (l) => `${l * 8}% de chance de golpe crítico (x1.8)` },
  { id: 'vamp', kind: 'passive', icon: '🩸', name: 'Sede de Sangue', desc: (l) => `Cura ${l}% da vida máxima a cada abate` },
  // ---- Exclusivas de classe (só aparecem para a sua classe) ----
  { id: 'bulwark', kind: 'passive', cls: 'warrior', icon: '🛡', name: 'Fortaleza', desc: (l) => `+${l * 10}% de dano quando sua vida está abaixo de 50%` },
  { id: 'holy', kind: 'passive', cls: 'paladin', icon: '✨', name: 'Luz Sagrada', desc: (l) => `Cada golpe cura ${(l * 0.3).toFixed(1)}% da vida máxima` },
  { id: 'deadly', kind: 'passive', cls: 'assassin', icon: '🗡️', name: 'Golpe Mortal', desc: (l) => `Críticos causam +${l * 20}% de dano extra` },
  { id: 'eagle', kind: 'passive', cls: 'archer', icon: '🦅', name: 'Olho de Águia', desc: (l) => `+${l * 8}% de alcance de ataque` },
  { id: 'arcane', kind: 'passive', cls: 'mage', icon: '🔮', name: 'Mente Arcana', desc: (l) => `-${l * 8}% de recarga do ULT` },
  { id: 'overload', kind: 'passive', cls: 'sorcerer', icon: '⚡', name: 'Sobrecarga', desc: (l) => `Sobrecarga rende +${l * 25}% de dano a mais` },
  { id: 'thorns', kind: 'passive', cls: 'druid', icon: '🌹', name: 'Espinhos Vivos', desc: (l) => `Quem te acerta recebe ${l * 35}% do seu dano de volta` },
  { id: 'greed', kind: 'passive', icon: '💰', name: 'Ganância', desc: (l) => `+${l * 20}% de ouro e mais chance de 💎` },
];

export const skillById = (id) => SKILLS.find(s => s.id === id);

// Sorteia até 3 skills que ainda não estão no máximo. Pelo menos 1 ativa quando houver.
export function rollChoices(owned, n = 3, cls) {
  const pool = SKILLS.filter(s => (owned[s.id] || 0) < SKILL_MAX && (!s.cls || s.cls === cls));
  const picks = [];
  const pull = (list) => { const i = Math.floor(Math.random() * list.length); const [x] = list.splice(i, 1); return x; };
  const mine = pool.filter(s => s.cls);
  if (mine.length && Math.random() < 0.55) { const a = pull(mine); pool.splice(pool.indexOf(a), 1); picks.push(a); }
  const act = pool.filter(s => s.kind === 'active');
  if (act.length && Math.random() < 0.6) { const a = pull(act); pool.splice(pool.indexOf(a), 1); picks.push(a); }
  while (picks.length < n && pool.length) picks.push(pull(pool));
  return picks;
}
