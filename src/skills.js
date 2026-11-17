// Skills de evolução: a cada nível o jogador escolhe 1 entre 3 opções (estilo roguelike).
// Cada CLASSE tem as suas 15 skills (5 ativas + 10 passivas), com nomes, ícones, cores e efeitos próprios.
// Cada skill vai até o nível 5. 'fx' é o motor do efeito (o código do jogo lê o nível por fx).
export const SKILL_MAX = 5;

const P = (id, fx, icon, name, desc) => ({ id, fx, kind: 'passive', icon, name, desc });
const A = (id, fx, icon, name, color, desc) => ({ id, fx, kind: 'active', icon, name, color, desc });
const f1 = (n) => n.toFixed(1);

// recarga (s) de cada motor ativo, por nível
export const PERIOD_FX = {
  lightning: (l) => 3.6 - l * 0.4, volley: (l) => 4.2 - l * 0.4, nova: (l) => 7 - l * 0.7, frost: (l) => 8 - l * 0.8,
  slam: (l) => 9 - l * 0.8, meteor: (l) => 8.5 - l * 0.8, pulse: (l) => 12 - l * 1.2, ward: (l) => 14 - l * 1.2, shadow: (l) => 6 - l * 0.6,
};

export const CLASS_SKILLS = {
  warrior: [
    A('w_quake', 'slam', '🌋', 'Terremoto', 0xc9a26a, (l) => `Pisada que racha o chão a cada ${f1(PERIOD_FX.slam(l))}s: dano e atordoa inimigos por perto`),
    A('w_shock', 'nova', '💥', 'Onda de Choque', 0xffb04a, (l) => `Explosão ao seu redor a cada ${f1(PERIOD_FX.nova(l))}s (raio ${f1(3.5 + l * 0.7)})`),
    A('w_axes', 'orbs', '🪓', 'Machados Giratórios', 0xe07b39, (l) => `${l + 1} machados giram em volta de você ferindo quem tocar`),
    A('w_iron', 'aura', '⛓️', 'Aura de Ferro', 0xb8c2cc, (l) => `Fere quem chega perto (raio ${f1(2.2 + l * 0.4)}) continuamente`),
    A('w_cry', 'pulse', '📯', 'Grito Revigorante', 0xff9d5c, (l) => `A cada ${f1(PERIOD_FX.pulse(l))}s recupera ${8 + l * 4}% da vida (se estiver ferido)`),
    P('w_rage', 'might', '💪', 'Fúria de Batalha', (l) => `+${l * 12}% de dano em tudo`),
    P('w_skin', 'armor', '🛡️', 'Couraça Pesada', (l) => `-${l * 7}% de dano recebido`),
    P('w_vit', 'vigor', '❤️', 'Vitalidade de Touro', (l) => `+${l * 25} de vida máxima`),
    P('w_breath', 'regen', '🌬️', 'Segundo Fôlego', (l) => `Recupera ${f1(l * 1.2)} de vida por segundo`),
    P('w_fort', 'bulwark', '🏰', 'Fortaleza', (l) => `+${l * 10}% de dano quando sua vida está abaixo de 50%`),
    P('w_counter', 'thorns', '⚔️', 'Contra-Ataque', (l) => `Quem te acerta recebe ${l * 35}% do seu dano de volta`),
    P('w_blood', 'vamp', '🩸', 'Sede de Batalha', (l) => `Cura ${l}% da vida máxima a cada abate`),
    P('w_heavy', 'crit', '🔨', 'Golpe Pesado', (l) => `${l * 8}% de chance de golpe crítico (x1.8)`),
    P('w_loot', 'greed', '💰', 'Espólios de Guerra', (l) => `+${l * 20}% de ouro e mais chance de 💎`),
    P('w_combat', 'haste', '🌀', 'Frenesi de Combate', (l) => `+${l * 9}% de velocidade de ataque`),
  ],
  assassin: [
    A('a_step', 'shadow', '👤', 'Passo Sombrio', 0x8e44ad, (l) => `Some e reaparece no inimigo mais próximo a cada ${f1(PERIOD_FX.shadow(l))}s, ferindo e ficando intocável por instantes`),
    A('a_knives', 'volley', '🗡️', 'Chuva de Adagas', 0xdfe6ee, (l) => `Adagas caem em ${l + 2} inimigos a cada ${f1(PERIOD_FX.volley(l))}s`),
    A('a_blades', 'orbs', '🌀', 'Lâminas Giratórias', 0xc9d6ff, (l) => `${l + 1} lâminas giram em volta de você ferindo quem tocar`),
    A('a_venom', 'aura', '☠️', 'Veneno Letal', 0x7bd34a, (l) => `Envenena quem chega perto (raio ${f1(2.2 + l * 0.4)}) continuamente`),
    A('a_fog', 'frost', '🌫️', 'Névoa Sombria', 0x7a5cff, (l) => `Fumaça a cada ${f1(PERIOD_FX.frost(l))}s: dano e lentidão em todos por perto`),
    P('a_crit', 'crit', '🎯', 'Ponto Cego', (l) => `${l * 8}% de chance de golpe crítico (x1.8)`),
    P('a_deadly', 'deadly', '💀', 'Golpe Mortal', (l) => `Críticos causam +${l * 20}% de dano extra`),
    P('a_haste', 'haste', '⚡', 'Mãos Velozes', (l) => `+${l * 9}% de velocidade de ataque`),
    P('a_swift', 'swift', '👟', 'Passos de Gato', (l) => `+${l * 6}% de velocidade de movimento`),
    P('a_might', 'might', '🔪', 'Lâmina Afiada', (l) => `+${l * 12}% de dano em tudo`),
    P('a_vamp', 'vamp', '🩸', 'Banquete Sombrio', (l) => `Cura ${l}% da vida máxima a cada abate`),
    P('a_reach', 'eagle', '🦘', 'Salto Longo', (l) => `+${l * 8}% de alcance de ataque`),
    P('a_loot', 'greed', '💰', 'Mão Leve', (l) => `+${l * 20}% de ouro e mais chance de 💎`),
    P('a_regen', 'regen', '🌑', 'Cura nas Sombras', (l) => `Recupera ${f1(l * 1.2)} de vida por segundo`),
    P('a_vit', 'vigor', '❤️', 'Corpo Treinado', (l) => `+${l * 25} de vida máxima`),
  ],
  mage: [
    A('m_meteor', 'meteor', '☄️', 'Meteoro Arcano', 0xff7a3a, (l) => `Um meteoro cai no inimigo mais próximo a cada ${f1(PERIOD_FX.meteor(l))}s (raio ${f1(3 + l * 0.4)})`),
    A('m_orbs', 'orbs', '🔮', 'Orbes Arcanos', 0xb28dff, (l) => `${l + 1} orbes giram em volta de você ferindo quem tocar`),
    A('m_ice', 'frost', '❄️', 'Onda Gélida', 0x7fdcff, (l) => `Pulso de gelo a cada ${f1(PERIOD_FX.frost(l))}s: dano e lentidão em todos por perto`),
    A('m_nova', 'nova', '✨', 'Nova Arcana', 0xc77dff, (l) => `Explosão arcana a cada ${f1(PERIOD_FX.nova(l))}s (raio ${f1(3.5 + l * 0.7)})`),
    A('m_ward', 'ward', '🔰', 'Barreira Arcana', 0x6ec6ff, (l) => `Escudo de ${10 + l * 5}% da vida a cada ${f1(PERIOD_FX.ward(l))}s (com inimigos por perto)`),
    P('m_arcane', 'arcane', '🌌', 'Mente Arcana', (l) => `-${l * 8}% de recarga do ULT`),
    P('m_power', 'might', '📖', 'Grimório Antigo', (l) => `+${l * 12}% de dano em tudo`),
    P('m_haste', 'haste', '🌀', 'Conjuração Rápida', (l) => `+${l * 9}% de velocidade de ataque`),
    P('m_crit', 'crit', '🎯', 'Foco Absoluto', (l) => `${l * 8}% de chance de golpe crítico (x1.8)`),
    P('m_sight', 'eagle', '👁️', 'Visão Arcana', (l) => `+${l * 8}% de alcance de ataque`),
    P('m_vit', 'vigor', '❤️', 'Essência Vital', (l) => `+${l * 25} de vida máxima`),
    P('m_regen', 'regen', '🌿', 'Mana em Vida', (l) => `Recupera ${f1(l * 1.2)} de vida por segundo`),
    P('m_mind', 'armor', '🧠', 'Escudo Mental', (l) => `-${l * 7}% de dano recebido`),
    P('m_loot', 'greed', '💎', 'Alquimia', (l) => `+${l * 20}% de ouro e mais chance de 💎`),
    P('m_swift', 'swift', '👟', 'Levitação', (l) => `+${l * 6}% de velocidade de movimento`),
  ],
  sorcerer: [
    A('s_chain', 'lightning', '⚡', 'Cadeia Caótica', 0xfff27a, (l) => `Raios caem em ${l + 1} inimigos a cada ${f1(PERIOD_FX.lightning(l))}s`),
    A('s_nova', 'nova', '🔥', 'Nova Flamejante', 0xff6a2f, (l) => `Explosão de fogo ao seu redor a cada ${f1(PERIOD_FX.nova(l))}s (raio ${f1(3.5 + l * 0.7)})`),
    A('s_spark', 'volley', '🎇', 'Chuva de Faíscas', 0xff4fd8, (l) => `Faíscas atingem ${l + 2} inimigos a cada ${f1(PERIOD_FX.volley(l))}s`),
    A('s_shard', 'frost', '🧊', 'Estilhaço Gélido', 0x9fe8ff, (l) => `Cristais de gelo a cada ${f1(PERIOD_FX.frost(l))}s: dano e lentidão em todos por perto`),
    A('s_entropy', 'aura', '🌀', 'Campo de Entropia', 0xd63af9, (l) => `Fere quem chega perto (raio ${f1(2.2 + l * 0.4)}) continuamente`),
    P('s_over', 'overload', '☢️', 'Sobrecarga', (l) => `Sobrecarga rende +${l * 25}% de dano a mais`),
    P('s_chaos', 'might', '🎲', 'Poder Caótico', (l) => `+${l * 12}% de dano em tudo`),
    P('s_haste', 'haste', '🌪️', 'Magia Instável', (l) => `+${l * 9}% de velocidade de ataque`),
    P('s_crit', 'crit', '💫', 'Surto Aleatório', (l) => `${l * 8}% de chance de golpe crítico (x1.8)`),
    P('s_deadly', 'deadly', '💥', 'Detonação', (l) => `Críticos causam +${l * 20}% de dano extra`),
    P('s_vamp', 'vamp', '🩸', 'Pacto de Sangue', (l) => `Cura ${l}% da vida máxima a cada abate`),
    P('s_regen', 'regen', '💜', 'Cura Instável', (l) => `Recupera ${f1(l * 1.2)} de vida por segundo`),
    P('s_vit', 'vigor', '❤️', 'Alma Resistente', (l) => `+${l * 25} de vida máxima`),
    P('s_loot', 'greed', '💰', 'Maldição da Fortuna', (l) => `+${l * 20}% de ouro e mais chance de 💎`),
    P('s_swift', 'swift', '👟', 'Passo Errático', (l) => `+${l * 6}% de velocidade de movimento`),
  ],
  druid: [
    A('d_roots', 'frost', '🌱', 'Raízes Prendedoras', 0x6fcf5a, (l) => `Raízes a cada ${f1(PERIOD_FX.frost(l))}s: dano e lentidão em todos por perto`),
    A('d_bless', 'pulse', '🍃', 'Bênção da Floresta', 0x7CFC00, (l) => `A cada ${f1(PERIOD_FX.pulse(l))}s recupera ${8 + l * 4}% da vida (se estiver ferido)`),
    A('d_thorn', 'aura', '🌵', 'Espinheira', 0x9be37b, (l) => `Fere quem chega perto (raio ${f1(2.2 + l * 0.4)}) continuamente`),
    A('d_fly', 'orbs', '🧚', 'Vaga-lumes', 0xd6ff7a, (l) => `${l + 1} vaga-lumes giram em volta de você ferindo quem tocar`),
    A('d_wrath', 'lightning', '🌩️', 'Fúria da Natureza', 0x8dffb0, (l) => `Raios da floresta caem em ${l + 1} inimigos a cada ${f1(PERIOD_FX.lightning(l))}s`),
    P('d_thorns', 'thorns', '🌹', 'Espinhos Vivos', (l) => `Quem te acerta recebe ${l * 35}% do seu dano de volta`),
    P('d_regen', 'regen', '🌿', 'Seiva Curativa', (l) => `Recupera ${f1(l * 1.2)} de vida por segundo`),
    P('d_vit', 'vigor', '🌳', 'Raiz Profunda', (l) => `+${l * 25} de vida máxima`),
    P('d_bark', 'armor', '🪵', 'Casca de Carvalho', (l) => `-${l * 7}% de dano recebido`),
    P('d_vamp', 'vamp', '🍂', 'Ciclo da Vida', (l) => `Cura ${l}% da vida máxima a cada abate`),
    P('d_swift', 'swift', '🦌', 'Passos do Cervo', (l) => `+${l * 6}% de velocidade de movimento`),
    P('d_might', 'might', '🐻', 'Força Selvagem', (l) => `+${l * 12}% de dano em tudo`),
    P('d_haste', 'haste', '🐆', 'Instinto Felino', (l) => `+${l * 9}% de velocidade de ataque`),
    P('d_crit', 'crit', '🦅', 'Garra Afiada', (l) => `${l * 8}% de chance de golpe crítico (x1.8)`),
    P('d_loot', 'greed', '🍄', 'Colheita Farta', (l) => `+${l * 20}% de ouro e mais chance de 💎`),
  ],
  paladin: [
    A('p_hand', 'pulse', '🙏', 'Mão Curativa', 0xfff0a0, (l) => `A cada ${f1(PERIOD_FX.pulse(l))}s recupera ${8 + l * 4}% da vida (se estiver ferido)`),
    A('p_shield', 'ward', '🛡️', 'Escudo Divino', 0xffe08a, (l) => `Escudo de ${10 + l * 5}% da vida a cada ${f1(PERIOD_FX.ward(l))}s (com inimigos por perto)`),
    A('p_burst', 'nova', '☀️', 'Explosão Sagrada', 0xffd166, (l) => `Luz ao seu redor a cada ${f1(PERIOD_FX.nova(l))}s (raio ${f1(3.5 + l * 0.7)})`),
    A('p_judge', 'slam', '⚖️', 'Julgamento', 0xfff6c9, (l) => `Martelada de luz a cada ${f1(PERIOD_FX.slam(l))}s: dano e atordoa inimigos por perto`),
    A('p_hammers', 'orbs', '🔨', 'Martelos Sagrados', 0xffe27a, (l) => `${l + 1} martelos de luz giram em volta de você ferindo quem tocar`),
    P('p_holy', 'holy', '✨', 'Luz Sagrada', (l) => `Cada golpe cura ${f1(l * 0.3)}% da vida máxima`),
    P('p_faith', 'bulwark', '🕊️', 'Fé Inabalável', (l) => `+${l * 10}% de dano quando sua vida está abaixo de 50%`),
    P('p_armor', 'armor', '🛡', 'Armadura Abençoada', (l) => `-${l * 7}% de dano recebido`),
    P('p_vit', 'vigor', '❤️', 'Coração Puro', (l) => `+${l * 25} de vida máxima`),
    P('p_regen', 'regen', '🌅', 'Graça Divina', (l) => `Recupera ${f1(l * 1.2)} de vida por segundo`),
    P('p_might', 'might', '⚔️', 'Espada da Justiça', (l) => `+${l * 12}% de dano em tudo`),
    P('p_thorns', 'thorns', '🔥', 'Ira Justa', (l) => `Quem te acerta recebe ${l * 35}% do seu dano de volta`),
    P('p_vamp', 'vamp', '🩸', 'Comunhão', (l) => `Cura ${l}% da vida máxima a cada abate`),
    P('p_crit', 'crit', '🎯', 'Golpe Divino', (l) => `${l * 8}% de chance de golpe crítico (x1.8)`),
    P('p_loot', 'greed', '💰', 'Dízimo', (l) => `+${l * 20}% de ouro e mais chance de 💎`),
  ],
  archer: [
    A('r_volley', 'volley', '🏹', 'Salva de Flechas', 0xd9f2a0, (l) => `Flechas atingem ${l + 2} inimigos a cada ${f1(PERIOD_FX.volley(l))}s`),
    A('r_boom', 'meteor', '🎯', 'Flecha Explosiva', 0xff9a3a, (l) => `Flecha explode no inimigo mais próximo a cada ${f1(PERIOD_FX.meteor(l))}s (raio ${f1(3 + l * 0.4)})`),
    A('r_ice', 'frost', '🧊', 'Flecha Congelante', 0x9fe8ff, (l) => `Flechas de gelo a cada ${f1(PERIOD_FX.frost(l))}s: dano e lentidão em todos por perto`),
    A('r_hawks', 'orbs', '🦅', 'Falcões Guardiões', 0xe8d9a8, (l) => `${l + 1} falcões voam em volta de você ferindo quem tocar`),
    A('r_trap', 'nova', '🪤', 'Armadilha Explosiva', 0xffb04a, (l) => `Armadilha explode ao seu redor a cada ${f1(PERIOD_FX.nova(l))}s (raio ${f1(3.5 + l * 0.7)})`),
    P('r_eagle', 'eagle', '🦅', 'Olho de Águia', (l) => `+${l * 8}% de alcance de ataque`),
    P('r_crit', 'crit', '🎯', 'Mira Perfeita', (l) => `${l * 8}% de chance de golpe crítico (x1.8)`),
    P('r_deadly', 'deadly', '💀', 'Tiro Mortal', (l) => `Críticos causam +${l * 20}% de dano extra`),
    P('r_haste', 'haste', '🌀', 'Disparo Rápido', (l) => `+${l * 9}% de velocidade de ataque`),
    P('r_swift', 'swift', '👟', 'Pés de Vento', (l) => `+${l * 6}% de velocidade de movimento`),
    P('r_might', 'might', '💪', 'Arco Reforçado', (l) => `+${l * 12}% de dano em tudo`),
    P('r_vamp', 'vamp', '🩸', 'Caçada Sangrenta', (l) => `Cura ${l}% da vida máxima a cada abate`),
    P('r_loot', 'greed', '💰', 'Troféus de Caça', (l) => `+${l * 20}% de ouro e mais chance de 💎`),
    P('r_regen', 'regen', '🌲', 'Descanso na Mata', (l) => `Recupera ${f1(l * 1.2)} de vida por segundo`),
    P('r_vit', 'vigor', '❤️', 'Fôlego de Caçador', (l) => `+${l * 25} de vida máxima`),
  ],
};

export const skillsOf = (cls) => CLASS_SKILLS[cls] || CLASS_SKILLS.warrior;
export const SKILLS = Object.values(CLASS_SKILLS).flat();
export const skillById = (id) => SKILLS.find(s => s.id === id);

// fx -> ids de skills que têm esse motor (para somar o nível: sk('might') = nível da skill de dano da classe)
export const FX_IDS = {};
SKILLS.forEach(s => { (FX_IDS[s.fx] = FX_IDS[s.fx] || []).push(s.id); });
export const fxDefOf = (cls, fx) => skillsOf(cls).find(s => s.fx === fx);

// Saves antigos usavam ids genéricos ('might', 'aura'...): vira a skill equivalente da classe (nível preservado)
export function migrateSkills(skills, cls) {
  const out = {}, mine = skillsOf(cls);
  Object.keys(skills || {}).forEach(k => {
    const v = skills[k] | 0; if (v <= 0) return;
    if (mine.some(s => s.id === k)) { out[k] = Math.min(SKILL_MAX, (out[k] || 0) + v); return; }
    const t = mine.find(s => s.fx === k); if (t) out[t.id] = Math.min(SKILL_MAX, (out[t.id] || 0) + v);
  });
  return out;
}

// Sorteia até 3 skills da classe que ainda não estão no máximo. Pelo menos 1 ativa quando houver.
export function rollChoices(owned, n = 3, cls) {
  const pool = skillsOf(cls).filter(s => (owned[s.id] || 0) < SKILL_MAX);
  const picks = [];
  const pull = (list) => { const i = Math.floor(Math.random() * list.length); const [x] = list.splice(i, 1); return x; };
  const act = pool.filter(s => s.kind === 'active');
  if (act.length && Math.random() < 0.6) { const a = pull(act); pool.splice(pool.indexOf(a), 1); picks.push(a); }
  while (picks.length < n && pool.length) picks.push(pull(pool));
  return picks;
}
