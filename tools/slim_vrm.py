# Reduz um .vrm/.glb: texturas para no maximo N px e PNG com paleta (a malha e o resto ficam iguais). Uso: python tools/slim_vrm.py entrada.vrm saida.vrm [N]
import sys, json, struct, io
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]; N = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
d = open(src, 'rb').read()
jl, _ = struct.unpack('<II', d[12:20]); j = json.loads(d[20:20 + jl]); bo = 20 + jl
bl, _ = struct.unpack('<II', d[bo:bo + 8]); b = d[bo + 8:bo + 8 + bl]
imgs = {im['bufferView']: im for im in j.get('images', []) if 'bufferView' in im}
out = bytearray(); views = []
for i, v in enumerate(j['bufferViews']):
    data = b[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
    if i in imgs:
        im = Image.open(io.BytesIO(data)); im.load()
        if max(im.size) > N: k = N / max(im.size); im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
        buf = io.BytesIO()
        if im.mode in ('RGBA', 'LA', 'P') and im.convert('RGBA').getchannel('A').getextrema()[0] < 255:
            im = im.convert('RGBA').quantize(256, method=Image.FASTOCTREE); im.save(buf, 'PNG', optimize=True)
        else: im.convert('RGB').save(buf, 'JPEG', quality=86); imgs[i]['mimeType'] = 'image/jpeg'
        if imgs[i].get('mimeType') != 'image/jpeg': imgs[i]['mimeType'] = 'image/png'
        data = buf.getvalue()
    while len(out) % 4: out.append(0)
    v['byteOffset'] = len(out); v['byteLength'] = len(data); out += data
while len(out) % 4: out.append(0)
j['buffers'][0]['byteLength'] = len(out)
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
r = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(out), b'BIN\0') + bytes(out)
open(dst, 'wb').write(r); print(src, len(d) // 1024, 'KB ->', len(r) // 1024, 'KB')
