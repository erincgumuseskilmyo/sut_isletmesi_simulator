# -*- coding: utf-8 -*-
"""
preview.py - Uretilen GLB dosyalarini izometrik acidan render eder (kontrol amacli).
Kullanim:
  blender --background --python blender/preview.py -- <girdi.glb> <cikti.png> [ortho_scale] [azimut_derece]
"""
import bpy, sys, os, math

argv = sys.argv[sys.argv.index("--") + 1:]
SRC = argv[0]
OUT = argv[1]
SCALE = float(argv[2]) if len(argv) > 2 else 90.0
AZI = float(argv[3]) if len(argv) > 3 else 45.0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

# 5. argüman "noroof" ise catilar gizlenir (ahir ici kontrolu icin)
if len(argv) > 4 and argv[4] == "noroof":
    for ob in list(bpy.data.objects):
        if ob.name.startswith("Roofs"):
            bpy.data.objects.remove(ob, do_unlink=True)
if len(argv) > 5:
    keep = argv[5]
    for ob in list(bpy.data.objects):
        if ob.name.startswith("Spots_") and not ob.name.startswith(keep):
            bpy.data.objects.remove(ob, do_unlink=True)

# ---- izometrik ortografik kamera (45 derece azimut, 35.264 derece yukseklik)
cam_data = bpy.data.cameras.new("IsoCam")
cam_data.type = 'ORTHO'
cam_data.ortho_scale = SCALE
cam = bpy.data.objects.new("IsoCam", cam_data)
bpy.context.collection.objects.link(cam)

elev = math.radians(35.264)
azi = math.radians(AZI)
dist = 140.0
cam.location = (dist * math.cos(elev) * math.cos(azi),
                dist * math.cos(elev) * math.sin(azi),
                dist * math.sin(elev))
# hedefe bakmasi icin Track To kisiti (manuel Euler hesabindan daha guvenli)
# sahnenin sinir kutusunu bulup kamerayi otomatik cerceveler
import mathutils
mins = [1e9, 1e9, 1e9]
maxs = [-1e9, -1e9, -1e9]
for ob in bpy.data.objects:
    if ob.type != 'MESH':
        continue
    for corner in ob.bound_box:
        w = ob.matrix_world @ mathutils.Vector(corner)
        for i in range(3):
            mins[i] = min(mins[i], w[i])
            maxs[i] = max(maxs[i], w[i])
center = [(mins[i] + maxs[i]) / 2 for i in range(3)]
if SCALE <= 0:
    span = max(maxs[0] - mins[0], maxs[1] - mins[1], maxs[2] - mins[2])
    cam_data.ortho_scale = span * 1.5
target = bpy.data.objects.new("CamTarget", None)
target.location = tuple(center)
bpy.context.collection.objects.link(target)
con = cam.constraints.new('TRACK_TO')
con.target = target
con.track_axis = 'TRACK_NEGATIVE_Z'
con.up_axis = 'UP_Y'
bpy.context.scene.camera = cam

# ---- isik
sun_data = bpy.data.lights.new("Sun", type='SUN')
sun_data.energy = 4.5
sun_data.angle = math.radians(8)
sun = bpy.data.objects.new("Sun", sun_data)
sun.rotation_euler = (math.radians(50), 0, math.radians(35))
bpy.context.collection.objects.link(sun)

world = bpy.data.worlds.new("W")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.70, 0.80, 0.92, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.30
bpy.context.scene.world = world

sc = bpy.context.scene
for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'BLENDER_WORKBENCH'):
    try:
        sc.render.engine = eng
        break
    except TypeError:
        continue
sc.render.resolution_x = 1400
sc.render.resolution_y = 900
sc.render.film_transparent = False
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("PREVIEW_OK", sc.render.engine, os.path.getsize(OUT))
