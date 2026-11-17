// Dados do jogo: classes, reinos, heróis e história. Tudo original.

// taken = multiplicador de dano recebido; spd = velocidade de movimento; ultCd = recarga do ULT (s)
export const CLASSES = {
  warrior:  { name: 'Guerreiro',  icon: '⚔️', role: 'Tanque',          ult: 'Grito de Guerra',     ultCd: 9,  taken: 0.6,  spd: 0.95, desc: 'Golpe em arco, empurra inimigos. ULT atordoa e cria escudo.' },
  assassin: { name: 'Assassino',  icon: '🗡️', role: 'Dano explosivo',  ult: 'Dança das Sombras',   ultCd: 8,  taken: 1.25, spd: 1.25, desc: 'Salta no alvo, crítico 35%. ULT golpeia vários inimigos.' },
  mage:     { name: 'Mago',       icon: '🔮', role: 'Dano em área',    ult: 'Meteoro',             ultCd: 11, taken: 1.15, spd: 1.0,  desc: 'Bola de fogo explosiva. ULT derruba um meteoro.' },
  sorcerer: { name: 'Feiticeiro', icon: '🌀', role: 'Dano caótico',    ult: 'Liberar Sobrecarga',  ultCd: 10, taken: 1.1,  spd: 1.0,  desc: 'Elemento aleatório (fogo, gelo, raio). Sobrecarga = mais dano, mas se fere.' },
  druid:    { name: 'Druida',     icon: '🌿', role: 'Cura / suporte',  ult: 'Forma de Urso',       ultCd: 12, taken: 0.9,  spd: 1.0,  desc: 'Cura a equipe sozinha. ULT vira um urso gigante.' },
  paladin:  { name: 'Paladino',   icon: '🛡️', role: 'Tanque / suporte', ult: 'Luz Sagrada',        ultCd: 11, taken: 0.7,  spd: 0.95, desc: 'Golpe sagrado que cura a equipe. ULT cura muito e queima inimigos ao redor.' },
  archer:   { name: 'Arqueiro',   icon: '🏹', role: 'Dano contínuo',   ult: 'Chuva de Flechas',    ultCd: 10, taken: 1.1,  spd: 1.1,  desc: 'Flechas perfurantes que atravessam inimigos. ULT chove flechas.' },
};

// strong = reino contra o qual tem vantagem (+25% de dano; o alvo sofre -15% ao contra-atacar)
export const REALMS = {
  mares:    { name: 'Mar das Marés',     icon: '🌊', strong: 'sombras', sky: ['#2d8fe0', '#8fe3ff', '#e8fbff'], ground: 0xb8ffe6, fog: 0xcfeeff, enemy: 0x2c8fb5 },
  sombras:  { name: 'Clã das Sombras',   icon: '🌑', strong: 'arcana',  sky: ['#1b1440', '#5b3a8a', '#c98ab0'], ground: 0x9a8fc0, fog: 0x7a5a9f, enemy: 0x5a3a7a },
  arcana:   { name: 'Academia Arcana',   icon: '🔮', strong: 'planalto', sky: ['#2b3a8f', '#7f6bd6', '#e6d6ff'], ground: 0xa8b0ff, fog: 0xb6a8f0, enemy: 0x6c63ff },
  planalto: { name: 'Planalto Dourado',  icon: '☀️', strong: 'mares',   sky: ['#e8863a', '#ffc66b', '#fff0c9'], ground: 0xf0d890, fog: 0xffe2a8, enemy: 0xd98c1f },
  primeva:  { name: 'Floresta Primeva',  icon: '🌿', strong: null,      sky: ['#1f7a4a', '#7fd69a', '#eaffea'], ground: 0x9ee89e, fog: 0xbfe8c8, enemy: 0x3d9a4a },
  vazio:    { name: 'O Vazio',           icon: '🕳️', strong: 'primeva', sky: ['#05050a', '#2a2140', '#6a5a8a'], ground: 0x666677, fog: 0x3c3160, enemy: 0x30303a },
  // ---- reinos novos (mapas 7 a 20): usam o cenário de um reino-base (base), o chão de outro (gbase) e a horda de outro (horde), com cores próprias (tint = cenário, gtint = chão) ----
  gelo:     { name: 'Tundra Cristalina',   icon: '❄️', strong: null, base: 'arcana',   gbase: 'mares',    horde: 'planalto', tint: 0xbfeaff, gtint: 0xc4e4ff, sky: ['#3a78b8', '#a8dcff', '#f2fbff'], ground: 0xdff4ff, fog: 0xd4ecfa, enemy: 0x8fd8ff },
  carmesim: { name: 'Deserto Carmesim',    icon: '🏜️', strong: null, base: 'planalto', gbase: 'planalto', horde: 'sombras',  tint: 0xff9a7a, gtint: 0xff9a80, sky: ['#7a1f2a', '#e0603a', '#ffd2a8'], ground: 0xe08a60, fog: 0xf0a888, enemy: 0xc8452a },
  pantano:  { name: 'Pântano Venenoso',    icon: '🐸', strong: null, base: 'primeva',  gbase: 'primeva',  horde: 'mares',    tint: 0xc4cc6a, gtint: 0xa8b050, sky: ['#2a3a1a', '#7a9a3a', '#d8e8a0'], ground: 0x8a9a4a, fog: 0x9aaa6a, enemy: 0x7a9a2a },
  coral:    { name: 'Recife de Coral',     icon: '🪸', strong: null, base: 'mares',    gbase: 'mares',    horde: 'arcana',   tint: 0xffc4e0, gtint: 0xffd0e4, sky: ['#d05a9a', '#ffa8c8', '#fff0f6'], ground: 0xffd0e0, fog: 0xffd8ea, enemy: 0xe0508a },
  vulcao:   { name: 'Montanhas Vulcânicas', icon: '🌋', strong: null, base: 'sombras',  gbase: 'planalto', horde: 'planalto', tint: 0xff8a50, gtint: 0xc86a48, sky: ['#2a0a0a', '#c8401a', '#ffa060'], ground: 0x8a4a38, fog: 0x7a3a2a, enemy: 0xe0501a },
  catacumba:{ name: 'Catacumbas Reais',    icon: '⚰️', strong: null, base: 'sombras',  gbase: 'sombras',  horde: 'sombras',  tint: 0xd4d8e0, gtint: 0xb8bcc8, sky: ['#14161f', '#3a4258', '#8a94b0'], ground: 0x8a90a0, fog: 0x5a6078, enemy: 0x9aa4b8 },
  outono:   { name: 'Floresta Outonal',    icon: '🍂', strong: null, base: 'primeva',  gbase: 'planalto', horde: 'primeva',  tint: 0xffb050, gtint: 0xe0a060, sky: ['#9a4a1a', '#e8943a', '#ffe4b0'], ground: 0xe0a860, fog: 0xf0c890, enemy: 0xc87a1a },
  esmeralda:{ name: 'Bosque Esmeralda',    icon: '💚', strong: null, base: 'arcana',   gbase: 'primeva',  horde: 'arcana',   tint: 0x8affc0, gtint: 0x70e8c0, sky: ['#0a5a4a', '#3ac8a0', '#d0fff0'], ground: 0x70e0b0, fog: 0x90ecc8, enemy: 0x2ac88a },
  solar:    { name: 'Ruínas Solares',      icon: '🏛️', strong: null, base: 'planalto', gbase: 'planalto', horde: 'arcana',   tint: 0xfff0a0, gtint: 0xfff0b0, sky: ['#c8780a', '#ffd04a', '#fffbd0'], ground: 0xf8e090, fog: 0xfff0b8, enemy: 0xe8b81a },
  tempestade:{ name: 'Cume das Tempestades', icon: '⛈️', strong: null, base: 'arcana', gbase: 'arcana',   horde: 'arcana',   tint: 0x9a9ae8, gtint: 0x8a8ac8, sky: ['#10122a', '#3a3f7a', '#8a90c8'], ground: 0x6a70b0, fog: 0x5a60a0, enemy: 0x5a62e0 },
  abismo:   { name: 'Abismo Submerso',     icon: '🐙', strong: null, base: 'mares',    gbase: 'mares',    horde: 'mares',    tint: 0x6a9ad8, gtint: 0x5a80b8, sky: ['#02102a', '#0a3a7a', '#3a80b8'], ground: 0x4a78a8, fog: 0x1a4a7a, enemy: 0x1a5aa8 },
  fantasma: { name: 'Mata Fantasma',       icon: '👻', strong: null, base: 'sombras',  gbase: 'primeva',  horde: 'sombras',  tint: 0xa0ffe0, gtint: 0x5a9a88, sky: ['#061a1a', '#1a5a58', '#7ac8b8'], ground: 0x4a8a80, fog: 0x2a6a68, enemy: 0x4ad8b8 },
  obsidiana:{ name: 'Planície de Obsidiana', icon: '🖤', strong: null, base: 'vazio',  gbase: 'vazio',    horde: 'vazio',    tint: 0xff7a9a, gtint: 0xb88098, sky: ['#0a0a12', '#4a1a3a', '#c8607a'], ground: 0x6a5a68, fog: 0x4a2a42, enemy: 0xc82a5a },
  trono:    { name: 'Trono do Esquecimento', icon: '👑', strong: null, base: 'vazio',  gbase: 'vazio',    horde: 'vazio',    tint: 0xffe08a, gtint: 0xd8c8f0, sky: ['#000000', '#201838', '#a89ad0'], ground: 0x8a80a8, fog: 0x4a4068, enemy: 0xf0d070 },
};
// reino-base de um reino (cenário/chefe), de onde vem o chão e de onde vem a horda de monstros
export const baseRealm = (k) => (REALMS[k] && REALMS[k].base) || k;
export const groundRealm = (k) => (REALMS[k] && (REALMS[k].gbase || REALMS[k].base)) || k;
export const hordeRealm = (k) => (REALMS[k] && (REALMS[k].horde || REALMS[k].base)) || k;
export const isVariant = (k) => !!(REALMS[k] && REALMS[k].base);

// ---- Criador de personagem ----
export const CLASS_BASE = {
  warrior:  { atk: 13, rate: 700,  range: 3.2, look: 'Cavaleiro de armadura de aço, ombreiras, escudo e espada.' },
  paladin:  { atk: 12, rate: 750,  range: 3.2, look: 'Armadura branca e dourada, halo de luz, escudo sagrado.' },
  assassin: { atk: 16, rate: 600,  range: 7,   look: 'Roupa escura, lenço e duas adagas. Silhueta fina e veloz.' },
  mage:     { atk: 20, rate: 1100, range: 7.5, look: 'Chapéu pontudo, manto longo e cajado com orbe mágico.' },
  sorcerer: { atk: 18, rate: 700,  range: 7,   look: 'Olhos brilhantes, espinhos de energia e orbes flutuando.' },
  druid:    { atk: 7,  rate: 900,  range: 6,   look: 'Chifres de galho, coroa de folhas e cajado de madeira viva.' },
  archer:   { atk: 9,  rate: 450,  range: 8,   look: 'Túnica de couro verde, aljava nas costas e arco longo.' },
};
// modelo 3D permitido por classe: [arquivo, nome da aparência]
export const CLASS_MODELS = {
  warrior:  [['Knight', 'Cavaleiro'], ['Barbarian', 'Bárbaro']],
  paladin:  [['Knight', 'Cavaleiro']],
  assassin: [['Rogue_Hooded', 'Encapuzado'], ['Rogue', 'Ladino']],
  archer:   [['Rogue', 'Ladino'], ['Rogue_Hooded', 'Encapuzado']],
  mage:     [['Mage', 'Mago']],
  sorcerer: [['Mage', 'Mago']],
  druid:    [['Mage', 'Mago']],
};
export const SKINS = [0xffe0bd, 0xf1c27d, 0xd9a066, 0xb87a4b, 0x8d5524, 0x5a3a22];
export const HAIR_COLORS = [0x1b1b1b, 0x4a2c17, 0x8b5a2b, 0xe2c275, 0xc0392b, 0xf5f5f5, 0x3498db, 0x9b59b6, 0x27ae60, 0xff69b4];
export const EYE_COLORS = [0x111111, 0x2f6fdb, 0x2e9d57, 0x8b5a2b, 0xd62839, 0xa04cff, 0xf1c40f];
export const OUTFIT_COLORS = [0xf2efe9, 0x2b2d42, 0x9aa3ad, 0x3a4fb8, 0x4f7f3a, 0x6b3a1f, 0x7a1f3d, 0xd9a441, 0x1f6f78, 0x555577];
export const CAPE_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xff7f50, 0x1abc9c, 0xffffff, 0x2c3e50, 0xff69b4];
export const HAIR_STYLES = [['spiky', 'Espetado'], ['short', 'Curto'], ['long', 'Longo'], ['ponytail', 'Rabo'], ['bun', 'Coque'], ['mohawk', 'Moicano'], ['bald', 'Careca']];
export const FACES = [['calm', 'Calmo'], ['smile', 'Sorriso'], ['fierce', 'Feroz']];
export const ORIGINS = ['mares', 'sombras', 'arcana', 'planalto', 'primeva'];

// Personagens prontos para escolher (todos originais)
export const PREMADE = [
  // heróis 3D gerados por IA (Unirall): visual pintado e rico, sem troca de cor/penteado
  { name: 'Mira Folhaverde', body: 'f', model: 'UnirallArqueira', cls: 'archer', realm: 'primeva', skin: 0, hairStyle: 'ponytail', hair: 8, eye: 2, face: 'smile', outfit: 4, cape: 2, bio: 'Arqueira elfa de cabelo verde. Rápida, curiosa e sempre sorrindo.' },
  { name: 'Kuro Sombra', model: 'UnirallAssassino', cls: 'assassin', realm: 'sombras', skin: 1, hairStyle: 'short', hair: 0, eye: 4, face: 'fierce', outfit: 1, cape: 4, bio: 'Ninja de capuz roxo que some antes de você piscar.' },
  { name: 'Brenn Raiz', model: 'UnirallDruida', cls: 'druid', realm: 'primeva', skin: 1, hairStyle: 'short', hair: 1, eye: 3, face: 'smile', outfit: 5, cape: 2, bio: 'Jovem druida que fala com as folhas.' },
  { name: 'Lilith Rosa-Negra', body: 'f', model: 'UnirallFeiticeira', cls: 'sorcerer', realm: 'sombras', skin: 0, hairStyle: 'long', hair: 7, eye: 5, face: 'calm', outfit: 6, cape: 9, bio: 'Feiticeira de cabelo rosa e magia instável.' },
  { name: 'Rubi Chama-Viva', body: 'f', model: 'UnirallGuerreira', cls: 'warrior', realm: 'planalto', skin: 0, hairStyle: 'ponytail', hair: 4, eye: 1, face: 'fierce', outfit: 0, cape: 1, bio: 'Guerreira de armadura vermelha e coração de fogo.' },
  { name: 'Aster Estelar', model: 'UnirallMago', cls: 'mage', realm: 'arcana', skin: 0, hairStyle: 'short', hair: 5, eye: 1, face: 'calm', outfit: 3, cape: 4, bio: 'Jovem mago de chapéu pontudo que lê as estrelas.' },
  { name: 'Seren Alva', body: 'f', model: 'UnirallPaladino', cls: 'paladin', realm: 'arcana', skin: 0, hairStyle: 'short', hair: 5, eye: 6, face: 'calm', outfit: 0, cape: 3, bio: 'Paladina de armadura prata e dourada, luz que cura.' },
  { name: 'Kael Brasa', model: 'Unirall1', cls: 'warrior', realm: 'planalto', skin: 1, hairStyle: 'spiky', hair: 1, eye: 1, face: 'smile', outfit: 2, cape: 0, bio: 'Garoto de cabelo vermelho espetado e coração de herói.' },
  { name: 'Dante Casaco', model: 'Unirall2', cls: 'assassin', realm: 'sombras', skin: 1, hairStyle: 'short', hair: 0, eye: 4, face: 'calm', outfit: 1, cape: 4, bio: 'Viajante de casaco longo.' },
  { name: 'Aldric Muralha', model: 'Knight', hat: true,   cls: 'warrior',  realm: 'planalto', skin: 1, hairStyle: 'short',    hair: 1, eye: 1, face: 'fierce', outfit: 2, cape: 0, bio: 'Cavaleiro que jurou proteger quem não pode se proteger.' },
  { name: 'Seraphina Alva', body: 'f', model: 'Knight', hat: false,   cls: 'paladin',  realm: 'arcana',   skin: 0, hairStyle: 'long',     hair: 5, eye: 6, face: 'calm',   outfit: 0, cape: 3, bio: 'Paladina cuja luz cura aliados e queima a escuridão.' },
  { name: 'Shiro Kageri', model: 'Rogue_Hooded', hat: true,     cls: 'assassin', realm: 'sombras',  skin: 2, hairStyle: 'spiky',    hair: 0, eye: 4, face: 'fierce', outfit: 1, cape: 4, bio: 'Sombra silenciosa que age antes que você perceba.' },
  { name: 'Ilyra Folha-Lua', body: 'f', model: 'Rogue', hat: true,  cls: 'archer',   realm: 'primeva',  skin: 3, hairStyle: 'ponytail', hair: 8, eye: 2, face: 'smile',  outfit: 4, cape: 2, bio: 'Caçadora que nunca erra um alvo sob a luz da lua.' },
  { name: 'Orin Estelar', model: 'Mage', hat: true,     cls: 'mage',     realm: 'arcana',   skin: 1, hairStyle: 'long',     hair: 5, eye: 1, face: 'calm',   outfit: 3, cape: 4, bio: 'Mago sereno que lê as estrelas como livros.' },
  { name: 'Vexa Ruína', body: 'f', model: 'Mage', hat: false,       cls: 'sorcerer', realm: 'sombras',  skin: 0, hairStyle: 'mohawk',   hair: 7, eye: 5, face: 'fierce', outfit: 6, cape: 9, bio: 'Feiticeira de poder instável e sorriso perigoso.' },
  { name: 'Bram Raiz-Velha', model: 'Mage', hat: false,  cls: 'druid',    realm: 'primeva',  skin: 4, hairStyle: 'long',     hair: 1, eye: 3, face: 'smile',  outfit: 5, cape: 2, bio: 'Druida gentil que fala com árvores e animais.' },
  { name: 'Mara Vento-Sul', body: 'f', model: 'Barbarian', hat: false,   cls: 'warrior',  realm: 'mares',    skin: 3, hairStyle: 'ponytail', hair: 4, eye: 0, face: 'smile',  outfit: 0, cape: 1, bio: 'Capitã de navio que luta com a mesma alegria com que navega.' }
];

// ---- heróis anime (modelos VRoid VRM): 30 de cada sexo = modelo base + cores (cabelo, olhos, roupa, pele) ----
export const VRM_BASES = { f: ['VRM_Vivi', 'VRM_Vita', 'VRM_Victoria', 'VRM_Shino', 'VRM_Shibu', 'VRM_Darkness', 'VRM_SampA', 'VRM_SampB', 'VRM_HairF'], m: ['VRM_Haruto', 'VRM_Fumiriya', 'VRM_Seed', 'VRM_SampC'] };
const VRM_VARIANTS = [{}, { vh: 6, vc: 200, ve: 1 }, { vh: 4, vc: 30, vs: 1, ve: 4 }, { vh: 9, vc: 300, ve: 5 }, { vh: 3, vc: 90, vs: 2, ve: 2 }, { vh: 8, vc: 150, vs: 3, ve: 3 }, { vh: 7, vc: 260, vs: 1, ve: 6 }, { vh: 5, vc: 330, vs: 4, ve: 1 }];
// fisicos: h = altura, w = barriga/tronco, sh = ombros/peito, ar = grossura dos bracos, lg = grossura das pernas, hd = tamanho da cabeca
export const VRM_BUILDS = [
  { n: 'Normal' },
  { n: 'Forte', h: 1.05, w: 1.08, sh: 1.12, ar: 1.2, lg: 1.1 },
  { n: 'Musculoso', h: 1.08, w: 1.06, sh: 1.28, ar: 1.45, lg: 1.22, hd: 0.94 },
  { n: 'Magro', h: 1.02, w: 0.84, sh: 0.94, ar: 0.82, lg: 0.84 },
  { n: 'Gordinho', h: 0.97, w: 1.36, sh: 1.0, ar: 1.25, lg: 1.2, hd: 1.05 },
  { n: 'Alto e magro', h: 1.14, w: 0.86, sh: 0.92, ar: 0.82, lg: 0.86, hd: 0.97 },
  { n: 'Baixinho', h: 0.88, w: 1.02, hd: 1.12 },
  { n: 'Grandalhão', h: 1.14, w: 1.3, sh: 1.2, ar: 1.4, lg: 1.3, hd: 0.96 },
  { n: 'Atlético', h: 1.06, w: 0.98, sh: 1.1, ar: 1.1, lg: 1.05 },
  { n: 'Cheinho', h: 1.0, w: 1.18, sh: 1.0, ar: 1.12, lg: 1.12 },
];
const VRM_BUILD_SET = { f: [0, 3, 8, 6, 5, 1, 9], m: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] };
const VRM_NAMES = {
  f: ['Vivi Campo-Verde', 'Vita Cristalina', 'Victoria Aurora', 'Shino Véu-Negro', 'Shibu Lâmina-Clara', 'Darkness Noturna', 'Aiko Brisa-Suave', 'Hana Pétala', 'Yuki Neve-Clara', 'Mei Lua-Nova', 'Rin Chama-Azul', 'Sakura Aurora', 'Akari Luz-do-Dia', 'Miyu Estrela', 'Nami Maré-Alta', 'Luna Prateada', 'Kaede Folha-Rubra', 'Himari Sol-Nascente', 'Saki Espinho', 'Emi Cantora', 'Nana Raio-Verde', 'Ayame Íris', 'Tsukiko Eclipse', 'Reiko Trovão', 'Misaki Cometa', 'Chiyo Sino-Dourado', 'Mio Coral', 'Haruka Horizonte', 'Natsu Verão', 'Suzu Sininho'],
  m: ['Haruto Capuz', 'Fumiriya Sakura', 'Seed Folha-Nova', 'Kenji Aço-Frio', 'Ryu Dragão-Branco', 'Akio Vento-Norte', 'Daichi Pedra-Firme', 'Hiro Faísca', 'Takumi Mestre-Forja', 'Ren Lâmina-Rubra', 'Sora Céu-Aberto', 'Yuto Sombra-Leve', 'Kaito Mar-Bravo', 'Itsuki Raiz-Velha', 'Naoki Chama-Viva', 'Shun Relâmpago', 'Riku Terra-Dourada', 'Tatsu Tempestade', 'Kazuki Lua-Cheia', 'Minato Porto-Seguro', 'Haku Neve-Eterna', 'Jiro Corvo', 'Ryota Falcão', 'Eiji Guardião', 'Satoru Sábio', 'Tsubasa Asa-Negra', 'Yamato Honra', 'Isamu Bravura', 'Kouki Esperança', 'Daisuke Andarilho'],
};
const VRM_CLS = { f: ['archer', 'sorcerer', 'paladin', 'assassin', 'warrior', 'mage', 'druid'], m: ['warrior', 'mage', 'druid', 'paladin', 'assassin', 'archer', 'sorcerer'] };
const VRM_REALMS = ['primeva', 'arcana', 'planalto', 'sombras', 'mares'];
const VRM_BIOS = ['Cheio de coragem e sempre pronto para a aventura.', 'Calmo por fora, determinado por dentro.', 'Treinou a vida toda para proteger o reino.', 'Viajante curioso que procura histórias novas.', 'Fala pouco, mas nunca abandona um amigo.', 'Sonha em ficar famoso em todos os reinos.'];
export const VRM_ROSTER = [];
['f', 'm'].forEach((sx) => {
  const bases = VRM_BASES[sx];
  for (let i = 0; i < 30; i++) {
    const v = VRM_VARIANTS[Math.floor(i / bases.length)] || {};
    VRM_ROSTER.push({ name: VRM_NAMES[sx][i], body: sx, model: bases[i % bases.length], cls: VRM_CLS[sx][i % 7], realm: VRM_REALMS[i % 5], vh: v.vh, vc: v.vc, vs: v.vs, ve: v.ve, vb: VRM_BUILD_SET[sx][(i * (sx === 'm' ? 7 : 3) + (sx === 'm' ? 3 : 1)) % VRM_BUILD_SET[sx].length], bio: VRM_BIOS[i % VRM_BIOS.length] });
  }
});
PREMADE.push(...VRM_ROSTER);


// Converte as escolhas do criador em um herói jogável
export function buildPlayerHero(c) {
  const b = CLASS_BASE[c.cls] || CLASS_BASE.warrior, allowed = CLASS_MODELS[c.cls] || CLASS_MODELS.warrior;
  const model = (/^(Unirall|VRM_)/.test(c.model || '') || allowed.some(m => m[0] === c.model)) ? c.model : allowed[0][0];
  return {
    id: 'player', name: c.name || 'Aventureiro', realm: c.realm || 'mares', cls: c.cls, rar: 'E',
    model, hat: c.hat !== false,
    color: CAPE_COLORS[c.cape % CAPE_COLORS.length], outfit: OUTFIT_COLORS[c.outfit % OUTFIT_COLORS.length],
    skin: SKINS[c.skin % SKINS.length], hairColor: HAIR_COLORS[c.hair % HAIR_COLORS.length],
    body: c.body === 'f' ? 'f' : 'm', build: c.build || 'normal', height: c.height || 'mid', hairStyle: c.hairStyle || 'short', outfitStyle: c.outfitStyle || 'auto', face: c.face || 'calm', acc: c.acc || 'none',
    eyeColor: EYE_COLORS[(c.eye != null ? c.eye : 1) % EYE_COLORS.length],
    vHair: c.vh != null ? HAIR_COLORS[c.vh % HAIR_COLORS.length] : null, vEye: c.ve != null ? EYE_COLORS[c.ve % EYE_COLORS.length] : null, vSkin: c.vs ? SKINS[c.vs % SKINS.length] : null, vCloth: c.vc != null ? c.vc : null, vBuild: c.vb || 0,
    atk: b.atk, rate: b.rate, range: b.range, cost: 0, bio: c.bio || 'O Guardião da Pena.',
  };
}

export const RARITY = { R: { name: 'Raro', color: '#6ec6ff', weight: 55 }, E: { name: 'Épico', color: '#c77dff', weight: 35 }, L: { name: 'Lendário', color: '#ffb703', weight: 10 } };

// color = capa/acentos; outfit = roupa; atk base; rate em ms; range = alcance de ataque (m)
export const HEROES = [
  { id: 'kaito', model: 'Barbarian', hat: false, skin: 0xf1c27d, hairColor: 0x1b1b1b,  name: 'Kaito Maré-Viva',     realm: 'mares',    cls: 'warrior',  rar: 'R', color: 0xe74c3c, outfit: 0x3a5f8a, atk: 12, rate: 700,  range: 3.2, cost: 0,   bio: 'Capitão do menor barco do Mar das Marés, com sonhos enormes.' },
  { id: 'sora', model: 'Rogue', hat: true, skin: 0xd9a066, hairColor: 0x8b5a2b,   name: 'Sora Kazehana',       realm: 'sombras',  cls: 'archer',   rar: 'R', color: 0x27ae60, outfit: 0x2f7d4a, atk: 9,  rate: 450,  range: 8,   cost: 800, bio: 'Mensageira do vento, rápida e brincalhona.' },
  { id: 'ren', model: 'Rogue_Hooded', hat: true, skin: 0xf1c27d, hairColor: 0x1b1b1b,    name: 'Ren Yamikage',        realm: 'sombras',  cls: 'assassin', rar: 'E', color: 0x8e44ad, outfit: 0x2b2d42, atk: 16, rate: 600,  range: 7,   cost: 0,   bio: 'Último do clã. Frio por fora, procura o próprio nome.' },
  { id: 'lumen', model: 'Mage', hat: true, skin: 0xffe0bd, hairColor: 0xe2c275,  name: 'Lúmen Arcanis',       realm: 'arcana',   cls: 'mage',     rar: 'E', color: 0x3498db, outfit: 0x3a4fb8, atk: 20, rate: 1100, range: 7.5, cost: 0,   bio: 'Prodígio curiosa e orgulhosa; coleciona feitiços proibidos.' },
  { id: 'thalia', model: 'Mage', hat: false, skin: 0xb87a4b, hairColor: 0x8b5a2b, name: 'Thalia Raiz-Antiga',  realm: 'primeva',  cls: 'druid',    rar: 'E', color: 0x2ecc71, outfit: 0x3f8f4a, atk: 7,  rate: 900,  range: 6,   cost: 0,   bio: 'Guardiã calma e sábia; conversa com a raposa Kitsune.' },
  { id: 'akira', model: 'Knight', hat: false, skin: 0xd9a066, hairColor: 0xf1c40f,  name: 'Akira Sol-Dourado',   realm: 'planalto', cls: 'warrior',  rar: 'L', color: 0xf1c40f, outfit: 0xd9a441, atk: 20, rate: 800,  range: 3.4, cost: 0,   bio: 'Lutador honrado; ao chegar no limite, brilha em ouro.' },
  { id: 'nyx', model: 'Mage', hat: true, skin: 0xffe0bd, hairColor: 0x9b59b6,    name: 'Nyx Vazia',           realm: 'vazio',    cls: 'sorcerer', rar: 'L', color: 0xd63af9, outfit: 0x2a1b3d, atk: 18, rate: 700,  range: 7,   cost: 0,   bio: 'Tocada pelo Esquecimento, perdeu o controle do próprio poder.' },
];

// ---- História: 6 atos, cada um com 4 estágios + chefe ----
export const INTRO = [
  ['Narrador', 'Dizem que todas as aventuras do mundo estavam escritas num único livro: o Tomo das Mil Histórias.'],
  ['Narrador', 'Até que ele se estilhaçou. Cada fragmento virou um Reino, e os Reinos começaram a colidir.'],
  ['Narrador', 'Junto veio o Esquecimento, uma névoa que apaga nomes, rostos e histórias.'],
  ['Kaito', 'Ei, {nome}! Acordou! Achei você caído na praia, segurando essa pena brilhante.'],
  ['Kaito', 'Eu sou o Kaito, capitão do menor barco do Mar das Marés. Mas meu sonho é enorme!'],
  ['Kaito', 'Dizem que quem segura a Pena consegue reescrever o que o Esquecimento apagou. Que tal escrever uma aventura comigo?'],
  ['Narrador', 'Você é o Guardião da Pena. Recupere os fragmentos do Tomo antes que tudo seja esquecido.'],
  ['Narrador', 'Toque e arraste para mover. O herói ataca sozinho. Use o ULT e troque de herói quando tiver equipe.'],
];

export const ENDING = [
  ['Narrador', 'Com o último fragmento, o Tomo das Mil Histórias voltou a brilhar, inteiro, sobre todos os Reinos.'],
  ['Kaito', 'E agora? A aventura acabou?'],
  ['Sora', 'Bobo. Um livro novo começa com a primeira página em branco!'],
  ['Narrador', 'O Esquecimento ainda ronda as bordas do mundo. Aventura Infinita liberada: continue lutando e ficando mais forte.'],
];

export const ACTS = [
  {
    realm: 'mares', name: 'Mar das Marés', reward: 'sora',
    boss: { name: 'Rei Abissal', color: 0x9fe8ff },
    intro: [
      ['Kaito', 'Esse mar está estranho... as ondas somem na névoa. Fiquem atrás de mim!'],
    ],
    bossIntro: [
      ['Rei Abissal', 'Quem ousa nadar em águas que eu já esqueci?'],
      ['Kaito', 'Um rei-peixe sem reino... o Esquecimento levou até o nome dele.'],
      ['Kaito', 'Vamos devolver o que é dele!'],
    ],
    outro: [
      ['Rei Abissal', 'Eu... lembro. Eu era Marcus, o Cartógrafo. Obrigado.'],
      ['Narrador', 'O primeiro fragmento do Tomo brilhou na Pena.'],
      ['Sora', 'Uau, que luz! Eu sou a Sora, do Clã das Sombras. Segui esse brilho por três Reinos. Posso ir com vocês?'],
      ['Kaito', 'Claro! Quanto mais gente na tripulação, melhor!'],
    ],
  },
  {
    realm: 'sombras', name: 'Clã das Sombras', reward: 'ren',
    boss: { name: 'Mestre Sem-Nome', color: 0xb085ff },
    intro: [
      ['Sora', 'Chegamos ao Clã das Sombras. Cuidado: aqui até as sombras têm ouvidos.'],
      ['Sora', 'Um amigo meu, o Ren, sumiu quando a névoa chegou.'],
    ],
    bossIntro: [
      ['Mestre Sem-Nome', 'Nomes são fardos. Eu libertei todos eles.'],
      ['Sora', 'Ele apagou até o próprio nome!'],
    ],
    outro: [
      ['Mestre Sem-Nome', 'Meu nome era Haru... e eu tinha um discípulo.'],
      ['Ren', '...Haru-sensei?'],
      ['Ren', 'Meu nome é Ren Yamikage. A Pena me devolveu a memória. Eu vou com vocês.'],
      ['Sora', 'Ren! Eu sabia que você estava vivo!'],
    ],
  },
  {
    realm: 'arcana', name: 'Academia Arcana', reward: 'lumen',
    boss: { name: 'Serafim Vazio', color: 0x9d8cff },
    intro: [
      ['Narrador', 'A Academia Arcana flutua entre as nuvens. Os livros voam sozinhos, mas metade deles está em branco.'],
      ['Ren', 'Livros em branco... o Esquecimento chegou aqui primeiro.'],
    ],
    bossIntro: [
      ['Serafim Vazio', 'Conhecimento é uma jaula. Eu abri todas as portas... e apaguei o que havia atrás.'],
      ['Kaito', 'Isso não é libertar, é destruir!'],
    ],
    outro: [
      ['Lúmen', 'Você derrotou o diretor?! Eu sou a Lúmen. Estudei feitiços proibidos para entender a névoa.'],
      ['Lúmen', 'Deixa eu ajudar. Eu prometo não explodir nada. Muito.'],
      ['Kaito', 'Uma maga! Bem-vinda à tripulação!'],
    ],
  },
  {
    realm: 'planalto', name: 'Planalto Dourado', reward: 'akira',
    boss: { name: 'Flor-Titã Dourada', color: 0xffd45e },
    intro: [
      ['Narrador', 'No Planalto Dourado, guerreiros treinam desde o nascer do sol. Agora, os campos de treino estão vazios.'],
      ['Lúmen', 'Vazios... ou apagados?'],
    ],
    bossIntro: [
      ['Flor-Titã Dourada', 'Força é tudo que resta quando a memória se vai.'],
      ['Kaito', 'Então vamos mostrar que a memória também é uma força!'],
    ],
    outro: [
      ['Akira', 'Impressionante. Eu sou Akira. Enfrentei esse titã sozinho por anos e nunca o derrubei.'],
      ['Akira', 'Dívida de honra: minha força é de vocês.'],
    ],
  },
  {
    realm: 'primeva', name: 'Floresta Primeva', reward: 'thalia',
    boss: { name: 'Árvore-Mãe Corrompida', color: 0x7dff9b },
    intro: [
      ['Narrador', 'A Floresta Primeva é tão antiga que as árvores conversam. Hoje, estão todas em silêncio.'],
      ['Kaito', 'A Kitsune está nervosa... ela sente alguma coisa.'],
    ],
    bossIntro: [
      ['Árvore-Mãe', 'Eu guardei as histórias por mil anos... e a névoa me esvaziou.'],
      ['Akira', 'Ela sofre. Vamos libertá-la, sem ódio.'],
    ],
    outro: [
      ['Thalia', 'Vocês a libertaram. Eu sou Thalia, guardiã destas raízes. A Kitsune nunca erra: ela confia em vocês.'],
      ['Thalia', 'A floresta vai curar quem vocês protegerem.'],
    ],
  },
  {
    realm: 'vazio', name: 'O Vazio', reward: 'nyx',
    boss: { name: 'O Apagador', color: 0xffffff },
    intro: [
      ['Narrador', 'Um dos fragmentos mais perigosos está no Vazio, onde nada tem cor, nome ou som.'],
      ['Ren', 'É daqui que o Esquecimento nasce... ou pelo menos parte dele.'],
    ],
    bossIntro: [
      ['O Apagador', 'Eu fui o primeiro leitor do Tomo. Li todas as histórias... e nenhuma terminava.'],
      ['O Apagador', 'Apaguei tudo para dar descanso a todos.'],
      ['Kaito', 'Histórias não precisam terminar para valerem a pena!'],
    ],
    outro: [
      ['O Apagador', '...Nenhuma terminava. Mas esta... tem amigos.'],
      ['Nyx', 'Eu ouvi tudo, de dentro da névoa. Sou Nyx. Perdi o controle do meu poder... quero me lembrar de mim.'],
      ['Thalia', 'Você não está sozinha. Venha.'],
      ['Narrador', 'Mas o Tomo ainda tem páginas rasgadas em reinos que ninguém visita há séculos. A jornada continua.'],
    ],
  },
  // ---- mapas 7 a 20: cada um com chefe próprio (moves = ataques do chefe, tirados dos que já existem) ----
  { realm: 'gelo', name: 'Tundra Cristalina', boss: { name: 'Rainha do Gelo Eterno', color: 0xbfeaff, moves: ['rain', 'slam', 'sum:nova', 'erase'] },
    intro: [['Narrador', 'Além do Vazio, uma tundra de cristais congelados brilha sob um céu sem sol.'], ['Lúmen', 'Cada cristal guarda uma lembrança congelada. Cuidado onde pisam!']],
    bossIntro: [['Rainha do Gelo Eterno', 'Congelei o tempo para que nada mais fosse esquecido.'], ['Kaito', 'Parar o tempo também é perder tudo!']],
    outro: [['Rainha do Gelo Eterno', '...O gelo derrete. Eu lembro do calor.'], ['Narrador', 'Outro fragmento do Tomo brilhou na Pena.']] },
  { realm: 'carmesim', name: 'Deserto Carmesim', boss: { name: 'Escorpião Rubro-Rei', color: 0xff6a4a, moves: ['charge', 'slam', 'poison', 'sum:bomber'] },
    intro: [['Narrador', 'As dunas daqui são vermelhas como brasa e o vento carrega sussurros de nomes esquecidos.'], ['Akira', 'Conheço este calor. Mantenham a água e a coragem.']],
    bossIntro: [['Escorpião Rubro-Rei', 'Nas minhas dunas, até as memórias viram areia.'], ['Akira', 'Então vamos fazer vento!']],
    outro: [['Narrador', 'As dunas se acalmaram e um novo caminho se abriu entre as rochas.']] },
  { realm: 'pantano', name: 'Pântano Venenoso', boss: { name: 'Hidra do Lodo', color: 0xa8c040, moves: ['poison', 'roots', 'sum:swarm', 'poison'] },
    intro: [['Narrador', 'O ar do pântano é pesado e cheira a ervas amargas. Algo grande se move sob a lama.'], ['Thalia', 'Esta água está doente. Podemos curá-la.']],
    bossIntro: [['Hidra do Lodo', 'Cada cabeça que cortam esquece uma lição!'], ['Ren', 'Então acertamos todas de uma vez.']],
    outro: [['Thalia', 'A água voltou a ficar clara. Obrigada, de coração.']] },
  { realm: 'coral', name: 'Recife de Coral', boss: { name: 'Leviatã de Coral', color: 0xff7ab4, moves: ['tide', 'cannon', 'sum:swarm', 'rain'] },
    intro: [['Narrador', 'Um recife colorido emerge da névoa, cheio de corais que cantam baixinho.'], ['Kaito', 'Eu conheço essa canção! Minha mãe cantava no barco.']],
    bossIntro: [['Leviatã de Coral', 'Ninguém atravessa o meu recife sem pagar o tributo!'], ['Sora', 'Tributo? Só se for um golpe bem dado!']],
    outro: [['Kaito', 'A canção voltou inteira. Acho que ela estava só com saudade.']] },
  { realm: 'vulcao', name: 'Montanhas Vulcânicas', boss: { name: 'Titã de Magma', color: 0xff6a2a, moves: ['slam', 'charge', 'rain', 'slam'] },
    intro: [['Narrador', 'A terra treme e rios de lava cortam as montanhas negras.'], ['Akira', 'Aqui até a pedra tem raiva. Fiquem juntos.']],
    bossIntro: [['Titã de Magma', 'Eu queimei minha história para nunca mais ser esquecido.'], ['Akira', 'Queimar não é lembrar!']],
    outro: [['Narrador', 'O vulcão adormeceu e a Pena guardou um brilho alaranjado.']] },
  { realm: 'catacumba', name: 'Catacumbas Reais', boss: { name: 'Rei Lich', color: 0xd4d8e0, moves: ['blink', 'lines', 'sum:stalker', 'erase'] },
    intro: [['Narrador', 'Sob um castelo esquecido, salões de pedra guardam os túmulos de reis sem nome.'], ['Ren', 'Silêncio. Os mortos aqui têm sono leve.']],
    bossIntro: [['Rei Lich', 'Eu governei mil anos e ninguém lembra meu nome.'], ['Kaito', 'Então vamos devolver o título a quem merece.']],
    outro: [['Rei Lich', 'Meu nome... era Aurelius. Obrigado, viajantes.']] },
  { realm: 'outono', name: 'Floresta Outonal', boss: { name: 'Guardião Rubro', color: 0xffa040, moves: ['roots', 'charge', 'sum:bomber', 'slam'] },
    intro: [['Narrador', 'Folhas douradas caem sem parar numa floresta onde o outono nunca acaba.'], ['Thalia', 'Ela esqueceu como é a primavera. Vamos ajudar.']],
    bossIntro: [['Guardião Rubro', 'Se a primavera vier, eu terei de partir!'], ['Thalia', 'Todo guardião precisa descansar.']],
    outro: [['Narrador', 'Brotos verdes nasceram entre as folhas caídas.']] },
  { realm: 'esmeralda', name: 'Bosque Esmeralda', boss: { name: 'Dríade de Esmeralda', color: 0x4affb0, moves: ['roots', 'rain', 'sum:nova', 'poison'] },
    intro: [['Narrador', 'Árvores de cristal verde brilham como joias, e o ar zumbe de magia viva.'], ['Lúmen', 'Quanta energia! Isto aqui é um tesouro arcano.']],
    bossIntro: [['Dríade de Esmeralda', 'Quem toma da minha luz, leva também a minha sombra.'], ['Lúmen', 'Só queremos que ela volte a brilhar por inteiro.']],
    outro: [['Narrador', 'O bosque inteiro acendeu em agradecimento.']] },
  { realm: 'solar', name: 'Ruínas Solares', boss: { name: 'Colosso do Sol', color: 0xffe05a, moves: ['slam', 'charge', 'rain', 'erase'] },
    intro: [['Narrador', 'Templos dourados de uma civilização antiga repousam sob um sol eterno.'], ['Akira', 'Eles adoravam a luz... e esqueceram da sombra.']],
    bossIntro: [['Colosso do Sol', 'Eu sou a última chama! Quem apaga o sol, apaga a si mesmo!'], ['Nyx', 'Então vou ensinar a ele o valor da sombra.']],
    outro: [['Narrador', 'O colosso se ajoelhou e o sol finalmente se pôs, devagar.']] },
  { realm: 'tempestade', name: 'Cume das Tempestades', boss: { name: 'Senhor dos Raios', color: 0x9a9aff, moves: ['rain', 'blink', 'sum:nova', 'rain'] },
    intro: [['Narrador', 'No topo do mundo, raios riscam o céu e ilhas de pedra flutuam entre nuvens negras.'], ['Sora', 'Eu amo o vento, mas isto é demais até para mim!']],
    bossIntro: [['Senhor dos Raios', 'Quem sobe até aqui merece o trovão!'], ['Sora', 'Eu corro mais rápido que o trovão!']],
    outro: [['Narrador', 'As nuvens se abriram e uma estrela apareceu no céu limpo.']] },
  { realm: 'abismo', name: 'Abismo Submerso', boss: { name: 'Kraken Ancião', color: 0x3a7ad8, moves: ['tide', 'cannon', 'sum:swarm', 'slam'] },
    intro: [['Narrador', 'No fundo do oceano, ruínas afundadas brilham com algas luminosas.'], ['Kaito', 'Segurem o fôlego... brincadeira, o Tomo cuida disso!']],
    bossIntro: [['Kraken Ancião', 'Eu guardo o que o mar engoliu. Ninguém leva nada daqui.'], ['Kaito', 'Só queremos o que pertence ao Tomo.']],
    outro: [['Narrador', 'O mar se acalmou e uma bolha dourada subiu até a superfície.']] },
  { realm: 'fantasma', name: 'Mata Fantasma', boss: { name: 'Banshee Anciã', color: 0x7affd8, moves: ['blink', 'lines', 'rain', 'sum:stalker'] },
    intro: [['Narrador', 'Uma floresta pálida onde cada árvore tem um rosto e cada sombra tem uma voz.'], ['Nyx', 'Eu reconheço estas vozes. São histórias sem dono.']],
    bossIntro: [['Banshee Anciã', 'Ouçam o meu lamento! Ninguém lembra de mim!'], ['Nyx', 'Eu lembro. Vamos libertar você.']],
    outro: [['Banshee Anciã', 'Obrigada por me ouvirem... finalmente.']] },
  { realm: 'obsidiana', name: 'Planície de Obsidiana', boss: { name: 'Cavaleiro de Obsidiana', color: 0xff5a8a, moves: ['charge', 'slam', 'blink', 'sum:summoner'] },
    intro: [['Narrador', 'Vidro vulcânico negro cobre o chão até onde a vista alcança. O Esquecimento está perto.'], ['Ren', 'Sinto o peso dele. O fim da jornada se aproxima.']],
    bossIntro: [['Cavaleiro de Obsidiana', 'Sou a última muralha do Esquecimento. Não passarão.'], ['Kaito', 'Já passamos por muita coisa. Passamos por você também!']],
    outro: [['Narrador', 'A muralha de obsidiana rachou, e uma luz fraca vazou pela fenda.']] },
  { realm: 'trono', name: 'Trono do Esquecimento', reward: null, boss: { name: 'O Esquecimento', color: 0xffe08a, moves: ['erase', 'rain', 'blink', 'charge', 'slam', 'roots', 'sum:summoner'] },
    intro: [['Narrador', 'No coração do Vazio, um trono de sombras guarda a última página do Tomo.'], ['Kaito', 'É aqui. Tudo o que vivemos nos trouxe até aqui.']],
    bossIntro: [['O Esquecimento', 'Eu sou o fim de todas as histórias. Descansem.'], ['Kaito', 'Nossa história ainda está sendo escrita. E não é você quem vai apagar!']],
    outro: [['O Esquecimento', '...Uma história que não termina. Talvez... valha a pena.']] },
];

export const PORTRAITS = { UnirallArqueira: 'mira', UnirallAssassino: 'kuro', UnirallDruida: 'brenn', UnirallFeiticeira: 'lilith', UnirallGuerreira: 'rubi', UnirallMago: 'aster', UnirallPaladino: 'seren', Unirall1: 'kael', Unirall2: 'dante' };
export const BASE = (import.meta.env && import.meta.env.BASE_URL) || './';
export const portraitUrl = (model) => PORTRAITS[model] ? BASE + 'img/portraits/' + PORTRAITS[model] + '.webp' : null;

// Evolucao das ULTs: nivel 50 e nivel 100 viram magias mais fortes (nome, icone, descricao)
export const ULT_LV = [50, 100];
export const ULT_EVO = {
  warrior:  [{ name: 'Grito Titânico', desc: 'Onda dupla, área maior, atordoa por mais tempo e escudo de 35%.' }, { name: 'Fúria do Colosso', desc: 'Três ondas de impacto enormes, atordoamento longo e escudo de 50%.' }],
  paladin:  [{ name: 'Julgamento Divino', desc: 'Pilares de luz caem sobre os inimigos, cura 50% e escudo maior.' }, { name: 'Ascensão Celestial', desc: 'Três pulsos de luz gigantes: cura 70%, escudo forte e muito dano em área.' }],
  assassin: [{ name: 'Tempestade de Lâminas', desc: '9 golpes críticos, fica invulnerável por mais tempo.' }, { name: 'Dança da Morte', desc: '15 golpes devastadores em enxame, quase 2,5 s de invulnerabilidade.' }],
  mage:     [{ name: 'Chuva de Meteoros', desc: 'Vários meteoros caem numa área bem maior.' }, { name: 'Apocalipse Flamejante', desc: 'Uma tempestade de 10 meteoros destrói tudo numa área enorme.' }],
  sorcerer: [{ name: 'Sobrecarga Total', desc: 'Explosão arcana maior, com onda extra.' }, { name: 'Colapso Arcano', desc: 'Três explosões em cadeia numa área gigante.' }],
  druid:    [{ name: 'Urso Ancestral', desc: 'Urso por mais tempo, ataque maior, prende os inimigos e cura 30%.' }, { name: 'Espírito da Natureza', desc: 'Urso colossal por 12 s, enraíza tudo por perto e cura 50%.' }],
  archer:   [{ name: 'Tempestade de Flechas', desc: 'Chuva maior, mais longa e com mais dano.' }, { name: 'Eclipse de Flechas', desc: 'Chuva enorme por 7 s que varre a área toda.' }],
};
