# -*- coding: utf-8 -*-
"""
lib_iso.py — Süt Sığırı İşletmesi izometrik sahnesi için ortak Blender yardımcıları.
Tüm modeller low-poly ve düz renkli (doku yok): oyun GitHub Pages'te çalıştığı için
GLB dosyalarının küçük kalması gerekiyor. Renkler oyunun mevcut sıcak/krem
paletiyle uyumlu seçildi (bkz. style.css).
"""
import bpy, math, bmesh
from mathutils import Vector

# ---------------------------------------------------------------- palet
PALETTE = {
    "concrete":   (0.78, 0.76, 0.71),
    "concrete_d": (0.62, 0.60, 0.56),
    "dirt":       (0.55, 0.47, 0.35),
    "grass":      (0.42, 0.55, 0.28),
    "straw":      (0.87, 0.73, 0.38),
    "straw_d":    (0.76, 0.61, 0.28),
    "hay":        (0.62, 0.66, 0.28),
    "steel":      (0.68, 0.70, 0.73),
    "steel_d":    (0.45, 0.47, 0.50),
    "roof":       (0.72, 0.74, 0.76),
    "roof_red":   (0.66, 0.27, 0.20),
    "wood":       (0.55, 0.38, 0.22),
    "wood_d":     (0.40, 0.27, 0.15),
    "wall":       (0.90, 0.87, 0.79),
    "milk":       (0.88, 0.90, 0.92),
    "green_m":    (0.22, 0.45, 0.22),   # traktör yeşili
    "tyre":       (0.13, 0.13, 0.14),
    "glass":      (0.55, 0.70, 0.78),
    "grain":      (0.80, 0.66, 0.35),
    "soy":        (0.72, 0.58, 0.33),
    "premix":     (0.85, 0.82, 0.70),
    "silage":     (0.40, 0.44, 0.22),
    "hide_w":     (0.93, 0.92, 0.89),
    "hide_b":     (0.12, 0.11, 0.11),
    "hide_r":     (0.45, 0.22, 0.13),
    "udder":      (0.88, 0.66, 0.62),
    "hoof":       (0.28, 0.24, 0.21),
    "skin":       (0.85, 0.66, 0.50),
    "denim":      (0.24, 0.35, 0.52),
    "shirt":      (0.30, 0.52, 0.62),
    "cap":        (0.35, 0.45, 0.28),
    "orange":     (0.85, 0.45, 0.15),
}

_mats = {}

def mat(name, color=None, rough=0.85, metal=0.0):
    """Adlandırılmış düz renk materyali (varsa yeniden kullanılır)."""
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    c = color if color else PALETTE.get(name, (0.8, 0.8, 0.8))
    bsdf.inputs["Base Color"].default_value = (c[0], c[1], c[2], 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    _mats[name] = m
    return m

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()

# ---------------------------------------------------------------- geometri
def box(name, loc, size, material, parent=None, rot=(0, 0, 0)):
    """Merkezi loc olan kutu. size = (x, y, z) tam kenar uzunlukları."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = (size[0], size[1], size[2])
    ob.rotation_euler = rot
    ob.data.materials.append(material if hasattr(material, "name") else mat(material))
    if parent:
        ob.parent = parent
    return ob

def cyl(name, loc, radius, depth, material, parent=None, rot=(0, 0, 0), verts=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.rotation_euler = rot
    ob.data.materials.append(material if hasattr(material, "name") else mat(material))
    if parent:
        ob.parent = parent
    return ob

def sphere(name, loc, radius, material, parent=None, segs=12, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=radius, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.data.materials.append(material if hasattr(material, "name") else mat(material))
    bpy.ops.object.shade_flat()
    if parent:
        ob.parent = parent
    return ob

def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.3
    e.location = loc
    bpy.context.collection.objects.link(e)
    if parent:
        e.parent = parent
    return e

def gable_roof(name, center, span_x, span_y, wall_h, ridge_h, material, parent=None, thickness=0.12):
    """İki eğimli (beşik) çatı: iki dikdörtgen levha."""
    cx, cy = center
    half = span_y / 2.0
    slope_len = math.sqrt(half**2 + (ridge_h - wall_h)**2)
    angle = math.atan2(ridge_h - wall_h, half)
    out = []
    for sgn in (1, -1):
        bpy.ops.mesh.primitive_cube_add(size=1)
        ob = bpy.context.object
        ob.name = "%s_%s" % (name, "N" if sgn > 0 else "S")
        ob.scale = (span_x, slope_len, thickness)
        ob.rotation_euler = (-sgn * angle, 0, 0)
        ob.location = (cx, cy + sgn * half / 2.0, (wall_h + ridge_h) / 2.0)
        ob.data.materials.append(material if hasattr(material, "name") else mat(material))
        if parent:
            ob.parent = parent
        out.append(ob)
    return out

def join(objs, name):
    """Nesneleri tek mesh'te birleştirir (draw-call azaltmak için)."""
    objs = [o for o in objs if o and o.type == 'MESH']
    if not objs:
        return None
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.object
    ob.name = name
    return ob

def export_glb(path, selected=False):
    import os
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_apply=True,
        export_yup=True,
        use_selection=selected,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_cameras=False,
        export_lights=False,
    )
    return os.path.getsize(path)
