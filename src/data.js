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
  vazio:    { name: 'O Vazio',           icon: '🕳️', strong: 'primeva', sky: ['#05050a', '#2a2140', '#6a5a8a'], ground: 0x666677, fog: 0x2a2140, enemy: 0x30303a },
};

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
  { name: 'Mara Vento-Sul', body: 'f', model: 'Barbarian', hat: false,   cls: 'warrior',  realm: 'mares',    skin: 3, hairStyle: 'ponytail', hair: 4, eye: 0, face: 'smile',  outfit: 0, cape: 1, bio: 'Capitã de navio que luta com a mesma alegria com que navega.' },
];

// Converte as escolhas do criador em um herói jogável
export function buildPlayerHero(c) {
  const b = CLASS_BASE[c.cls] || CLASS_BASE.warrior, allowed = CLASS_MODELS[c.cls] || CLASS_MODELS.warrior;
  const model = (/^Unirall/.test(c.model || '') || allowed.some(m => m[0] === c.model)) ? c.model : allowed[0][0];
  return {
    id: 'player', name: c.name || 'Aventureiro', realm: c.realm || 'mares', cls: c.cls, rar: 'E',
    model, hat: c.hat !== false,
    color: CAPE_COLORS[c.cape % CAPE_COLORS.length], outfit: OUTFIT_COLORS[c.outfit % OUTFIT_COLORS.length],
    skin: SKINS[c.skin % SKINS.length], hairColor: HAIR_COLORS[c.hair % HAIR_COLORS.length],
    body: c.body === 'f' ? 'f' : 'm', build: c.build || 'normal', height: c.height || 'mid', hairStyle: c.hairStyle || 'short', outfitStyle: c.outfitStyle || 'auto', face: c.face || 'calm', acc: c.acc || 'none',
    eyeColor: EYE_COLORS[(c.eye != null ? c.eye : 1) % EYE_COLORS.length],
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
    boss: { name: 'Capitão Fantasma', color: 0x9fe8ff },
    intro: [
      ['Kaito', 'Esse mar está estranho... as ondas somem na névoa. Fiquem atrás de mim!'],
    ],
    bossIntro: [
      ['Capitão Fantasma', 'Quem ousa navegar em águas que eu já esqueci?'],
      ['Kaito', 'Um navio sem tripulação... o Esquecimento levou até o nome dele.'],
      ['Kaito', 'Vamos devolver o que é dele!'],
    ],
    outro: [
      ['Capitão Fantasma', 'Eu... lembro. Eu era Marcus, o Cartógrafo. Obrigado.'],
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
    boss: { name: 'Arquimago Vazio', color: 0x9d8cff },
    intro: [
      ['Narrador', 'A Academia Arcana flutua entre as nuvens. Os livros voam sozinhos, mas metade deles está em branco.'],
      ['Ren', 'Livros em branco... o Esquecimento chegou aqui primeiro.'],
    ],
    bossIntro: [
      ['Arquimago Vazio', 'Conhecimento é uma jaula. Eu abri todas as portas... e apaguei o que havia atrás.'],
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
    boss: { name: 'Titã de Ouro Velho', color: 0xffd45e },
    intro: [
      ['Narrador', 'No Planalto Dourado, guerreiros treinam desde o nascer do sol. Agora, os campos de treino estão vazios.'],
      ['Lúmen', 'Vazios... ou apagados?'],
    ],
    bossIntro: [
      ['Titã de Ouro Velho', 'Força é tudo que resta quando a memória se vai.'],
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
      ['Narrador', 'O último fragmento está no Vazio, onde nada tem cor, nome ou som.'],
      ['Ren', 'É daqui que o Esquecimento nasce.'],
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
    ],
  },
];
