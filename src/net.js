// Cliente online: conecta no servidor (Cloudflare Worker) e mostra os outros jogadores.
import * as THREE from 'three';

export const NET_URL = 'wss://jogo-anime-online.ejsnasc.workers.dev/ws';

export function createNet({ url, getMe, onEvent, onStatus }) {
  let ws = null, alive = true, retry = 0, timer = null, connected = false;
  function open() {
    if (!alive) return;
    try { ws = new WebSocket(url); } catch (e) { later(); return; }
    ws.onopen = () => { retry = 0; connected = true; ws.send(JSON.stringify(Object.assign({ t: 'join' }, getMe()))); onStatus && onStatus(true); };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } onEvent(m); };
    ws.onclose = () => { const was = connected; connected = false; ws = null; if (was || true) onStatus && onStatus(false); later(); };
    ws.onerror = () => { try { ws && ws.close(); } catch (x) {} };
  }
  function later() { if (!alive || timer) return; retry = Math.min(retry + 1, 6); timer = setTimeout(() => { timer = null; open(); }, 1500 * retry); }
  open();
  return {
    get connected() { return connected; },
    send(o) { if (connected && ws && ws.readyState === 1) ws.send(JSON.stringify(o)); },
    close() { alive = false; try { ws && ws.close(); } catch (e) {} },
  };
}

// etiqueta com o nome acima da cabeca do jogador
export function nameTag(text) {
  const c = document.createElement('canvas'); c.width = 384; c.height = 80; const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,16,30,.78)'; g.beginPath(); g.roundRect(4, 8, 376, 64, 22); g.fill();
  g.strokeStyle = '#4fc3f7'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#fff'; g.font = 'bold 36px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 192, 42, 350);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false, transparent: true, depthTest: false }));
  s.scale.set(3, 0.63, 1); s.renderOrder = 10; return s;
}
