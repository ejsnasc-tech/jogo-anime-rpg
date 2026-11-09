# Blender headless: tira as animacoes (o jogo usa as do KayKit, mesmo esqueleto) e troca a textura por WebP. Uso:
#   blender.exe -b -P tools/slim_glb.py -- entrada.glb saida.glb
import bpy, sys
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a[0])
for ac in list(bpy.data.actions): bpy.data.actions.remove(ac)
for o in bpy.data.objects:
    if o.animation_data: o.animation_data_clear()
bpy.ops.export_scene.gltf(filepath=a[1], export_format='GLB', export_animations=False, export_image_format='WEBP', export_image_quality=80)
