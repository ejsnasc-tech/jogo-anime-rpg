import json, urllib.request, os, sys
OUT = os.environ.get('GEN_OUT', 'tools/_raw')   # pasta de saída; o servidor do Unirall deve estar em 127.0.0.1:8799 (python imagegen/server.py 8799)
PET = "cute chibi anime game art, creature portrait, centered, big shiny eyes, soft cel shading, vibrant colors, simple soft pastel gradient background, no text, no watermark, "
CLS = "anime fantasy RPG character portrait, chibi proportions, big shiny eyes, bust shot, cel shaded, vibrant colors, simple gradient background, no text, "
LAND = "anime style fantasy landscape painting, wide scenic view, vibrant colors, soft glow, detailed, no text, no characters, "
jobs = {
 'pet_fox': PET + "white and ice-blue fox with fluffy three tails and blue eyes",
 'pet_rhino': PET + "cute lilac purple rhinoceros with a glowing horn and tiny pink ears",
 'pet_dragon': PET + "baby crystal ice dragon with cyan crystals on its back and translucent wings",
 'pet_cat': PET + "dark blue magical cat with golden eyes and a crescent moon mark on forehead",
 'pet_dog': PET + "friendly golden retriever puppy with a red bandana",
 'pet_bunny': PET + "fluffy white bunny with long ears and pink nose, holding a tiny carrot",
 'pet_panda': PET + "round chubby panda cub with a bamboo leaf",
 'pet_owl': PET + "wise little brown owl with big round golden eyes and a tiny scholar hat",
 'pet_wolf': PET + "silver moon wolf with glowing blue eyes and a crescent moon on its chest",
 'pet_slime': PET + "a cute green jelly slime monster blob, round gooey body, happy face, tiny golden crown, no human, no girl",
 'pet_turtle': PET + "ancient turtle with a mossy shell carrying a tiny tree",
 'pet_phoenix': PET + "golden phoenix bird made of flames with glowing feathers",
 'pet_unicorn': PET + "pastel unicorn with a rainbow mane and a sparkling horn",
 'pet_golem': PET + "adorable small stone golem creature made of rocks with moss and glowing yellow eyes, no human",
 'pet_bear': PET + "honey brown bear cub holding a honey pot",
 'pet_tiger': PET + "purple shadow tiger cub with dark stripes and glowing eyes",
 'cls_warrior': CLS + "brave warrior with spiky hair, steel armor and a sword",
 'cls_paladin': CLS + "holy paladin with golden armor, halo and a shield",
 'cls_assassin': CLS + "stealthy assassin with a dark hood, scarf and twin daggers",
 'cls_mage': CLS + "wise mage with a big pointed hat and a magic staff",
 'cls_sorcerer': CLS + "unstable sorcerer with glowing purple eyes and floating energy orbs",
 'cls_druid': CLS + "gentle druid with antlers, leaf crown and wooden staff",
 'cls_archer': CLS + "agile archer with green tunic, quiver and a longbow",
 'act_mares': LAND + "tropical sea coast, sandy beach, palm trees, coral, turquoise water",
 'act_sombras': LAND + "moonlit haunted graveyard with dead trees, fog, glowing wisps, purple night",
 'act_arcana': LAND + "magical academy with floating glowing crystals and rune stones, blue purple sky",
 'act_planalto': LAND + "golden desert plateau with sandstone mesas and cacti, warm sunset",
 'act_primeva': LAND + "ancient dense forest with giant glowing mushrooms and ferns, green light",
 'act_vazio': LAND + "dark void realm with floating shards, broken pillars, glowing purple cracks",
 'title': LAND + "epic fantasy world with floating islands, sea, forest and a glowing sky, adventure mood",
}
only = sys.argv[1:] 
for k, p in jobs.items():
    if only and k not in only: continue
    sz = (1024, 576) if k.startswith('act_') or k == 'title' else (768, 768)
    req = {"prompt": p, "negative_prompt": "blurry, deformed, text, watermark, realistic photo, extra limbs, ugly, nsfw", "width": sz[0], "height": sz[1], "steps": 26, "out_dir": OUT + '/raw_' + k}
    try:
        r = json.load(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8799/generate', json.dumps(req).encode(), {'Content-Type': 'application/json'}), timeout=900))
        os.replace(r['path'], OUT + '/' + k + '.png'); print(k, r['seconds'], flush=True)
    except Exception as e:
        print('ERR', k, e, flush=True)
