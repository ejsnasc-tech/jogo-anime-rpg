// Modelos 3D prontos (KayKit Medieval Hexagon Pack, Kay Lousberg, licenca CC0): casas, tavernas, igrejas, arvores, pedras...
// Todos compartilham uma unica textura (gradiente de cores), entao sao leves. Aqui so carregamos e entregamos copias.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BASE } from './data.js';

const NAMES = ['tree_single_A', 'tree_single_B', 'rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E', 'cloud_big', 'mountain_A', 'mountain_B', 'hill_single_A'];
const COLORS = ['blue', 'green', 'red', 'yellow'];
const BUILD = ['home_A', 'home_B', 'tavern', 'church', 'market', 'blacksmith', 'well', 'windmill', 'tower_A', 'castle'];
BUILD.forEach(b => COLORS.forEach(c => NAMES.push('building_' + b + '_' + c)));

const models = {};
export const kkReady = (async () => {
  const L = new GLTFLoader();
  await Promise.all(NAMES.map(n => new Promise((res) => L.load(BASE + 'models/kk/' + n + '.gltf', (g) => {
    g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) { o.material.roughness = 0.85; o.material.metalness = 0; if (o.material.map) o.material.map.anisotropy = 8; } } });
    models[n] = g.scene; res();
  }, undefined, () => res()))));
})();

export const kkHas = (n) => !!models[n];
// copia pronta para por na cena (geometria e material sao compartilhados)
export const kkClone = (n) => models[n] ? models[n].clone(true) : null;
// primeira malha do modelo (para InstancedMesh)
export function kkMesh(n) { let m = null; if (models[n]) models[n].traverse(o => { if (!m && o.isMesh) m = o; }); return m; }
export const kkBox = (n) => { if (!models[n]) return null; const b = new THREE.Box3().setFromObject(models[n]); return b; };
export const KK_COLORS = COLORS;
