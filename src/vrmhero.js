// Herois anime prontos no formato VRM (VRoid, licenca CC0). As animacoes sao as do KayKit, convertidas (retarget) para o esqueleto VRM.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const MAP = { hips: 'hips', spine: 'spine', chest: 'chest', head: 'head', 'upperarm.l': 'leftUpperArm', 'lowerarm.l': 'leftLowerArm', 'hand.l': 'leftHand', 'upperarm.r': 'rightUpperArm', 'lowerarm.r': 'rightLowerArm', 'hand.r': 'rightHand',
  'upperleg.l': 'leftUpperLeg', 'lowerleg.l': 'leftLowerLeg', 'foot.l': 'leftFoot', 'toes.l': 'leftToes', 'upperleg.r': 'rightUpperLeg', 'lowerleg.r': 'rightLowerLeg', 'foot.r': 'rightFoot', 'toes.r': 'rightToes' };
const SAN = (n) => n.replace(/\./g, '');   // o GLTFLoader tira os pontos dos nomes de osso nas trilhas
for (const k of Object.keys(MAP)) { MAP[SAN(k)] = MAP[k]; }
const SLOT = { 'handslot.l': 'leftHand', 'handslot.r': 'rightHand' };

export function loadVrm(url) {
  const ld = new GLTFLoader(); ld.register((p) => new VRMLoaderPlugin(p));
  return new Promise((res, rej) => ld.load(url, (g) => {
    const vrm = g.userData.vrm; if (!vrm) return rej(new Error('sem VRM'));
    VRMUtils.removeUnnecessaryVertices(g.scene); VRMUtils.combineSkeletons(g.scene);
    const v0 = vrm.meta && vrm.meta.metaVersion === '0'; if (v0) VRMUtils.rotateVRM0(vrm);
    vrm.scene.traverse(o => { o.frustumCulled = false; if (o.isMesh) o.castShadow = true; });
    const nr = vrm.humanoid.normalizedHumanBonesRoot; if (nr && !nr.parent) vrm.scene.add(nr);
    const box = new THREE.Box3().setFromObject(vrm.scene);
    res({ vrm, v0, height: box.max.y - box.min.y });
  }, undefined, rej));
}

// converte os clipes do KayKit (ref = cena do KayKit em repouso) para ossos normalizados do VRM
export function retargetClips(ref, clips, vrm, v0) {
  ref.updateMatrixWorld(true);
  const restQ = {}, parQ = {}; ref.traverse(o => { if (o.isBone) { restQ[SAN(o.name)] = o.getWorldQuaternion(new THREE.Quaternion()); parQ[SAN(o.name)] = o.parent ? o.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion(); } });
  const hipsK = ref.getObjectByName('hips'), kh = hipsK ? hipsK.getWorldPosition(new THREE.Vector3()).y : 1;
  const vh = vrm.humanoid.getNormalizedBoneNode('hips').getWorldPosition(new THREE.Vector3()).y, sc = vh / kh;
  const out = [], q = new THREE.Quaternion();
  clips.forEach(c => {
    const tracks = [];
    c.tracks.forEach(t => {
      const [bone, prop] = [t.name.slice(0, t.name.lastIndexOf('.')), t.name.slice(t.name.lastIndexOf('.') + 1)], vb = MAP[bone]; if (!vb) return;
      const node = vrm.humanoid.getNormalizedBoneNode(vb); if (!node) return;
      if (prop === 'quaternion') {
        const v = new Float32Array(t.values.length);
        for (let i = 0; i < v.length; i += 4) {
          q.fromArray(t.values, i); q.premultiply(parQ[bone]).multiply(restQ[bone].clone().invert());
          v[i] = v0 ? -q.x : q.x; v[i + 1] = q.y; v[i + 2] = v0 ? -q.z : q.z; v[i + 3] = q.w;
        }
        tracks.push(new THREE.QuaternionKeyframeTrack(node.name + '.quaternion', t.times, v));
      } else if (prop === 'position' && vb === 'hips') {
        const v = new Float32Array(t.values.length);
        for (let i = 0; i < v.length; i += 3) { v[i] = t.values[i] * sc * (v0 ? -1 : 1); v[i + 1] = t.values[i + 1] * sc; v[i + 2] = t.values[i + 2] * sc * (v0 ? -1 : 1); }
        tracks.push(new THREE.VectorKeyframeTrack(node.name + '.position', t.times, v));
      }
    });
    out.push(new THREE.AnimationClip(c.name, c.duration, tracks));
  });
  return out;
}

// arma do KayKit (no, em repouso) -> osso da mao do VRM, mantendo posicao/rotacao em relacao ao corpo
export function attachProp(ref, vrm, v0, node, scaleK, scaleV) {
  const slot = node.parent && SLOT[node.parent.name]; if (!slot) return;
  const hand = vrm.humanoid.getNormalizedBoneNode(slot); if (!hand) return;
  ref.updateMatrixWorld(true);
  const hk = ref.getObjectByName(node.parent.name.startsWith('handslot.l') ? 'hand.l' : 'hand.r'), k = scaleK / scaleV;
  const p = node.getWorldPosition(new THREE.Vector3()).sub(hk.getWorldPosition(new THREE.Vector3())).multiplyScalar(k), r = node.getWorldQuaternion(new THREE.Quaternion());
  if (v0) { p.x = -p.x; p.z = -p.z; r.x = -r.x; r.z = -r.z; }
  const c = node.clone(true); c.position.copy(p); c.quaternion.copy(r); c.scale.setScalar(k); c.visible = true;
  c.traverse(o => { o.visible = true; if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  hand.add(c);
}
