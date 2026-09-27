# -*- coding: utf-8 -*-
"""
build_cow.py - Holstein inek modeli (low-poly, izometrik sahne icin).

TASARIM KARARI: animasyonlar Blender'da BAKE EDILMEZ. Model, adlandirilmis
pivot (Empty) hiyerarsisi olarak disari aktarilir; yurume/otlama/yatma/olum
hareketlerini js/iso/cow3d.js bu pivotlari dondurerek uretir. Boylece:
  - hiz, yorgunluk, hastalik gibi oyun degiskenleri animasyona dogrudan yansir,
  - GLB kucuk kalir (tek inek modeli 20 hayvan icin klonlanir),
  - 20 hayvanin her biri farkli benek seti + renk ile benzersiz olur.

Hiyerarsi:
  Cow
   |- Torso, Udder, Spots_A / Spots_B / Spots_C / Spots_D  (JS birini birakir)
   |- Neck  -> Head -> Muzzle, Ear_L, Ear_R, EarTag
   |- Tail  -> TailTuft
   |- Leg_FL -> Knee_FL -> Shin_FL (+ hoof), ayni sekilde FR / BL / BR

Inek +x yonune bakar. Omuz yuksekligi ~1.45 m, govde uzunlugu ~2.4 m.
"""
import bpy, sys, os, math, random

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from lib_iso import *

OUT_GLB = None

HIDE = None
SPOT = None


def ellipsoid(name, loc, scale, material, parent=None, segs=14, rings=9):
    ob = sphere(name, loc, 1.0, material, parent=parent, segs=segs, rings=rings)
    ob.scale = scale
    return ob


def leg(side_x, side_y, tag, root, front):
    """Bacak: kalca pivotu -> ust bacak, diz pivotu -> alt bacak + tirnak."""
    hip_z = 0.92 if front else 0.95
    hip = empty("Leg_" + tag, (side_x, side_y, hip_z), root)
    upper_len = 0.52
    cyl("Thigh_" + tag, (0, 0, -upper_len / 2), 0.105 if not front else 0.095, upper_len,
        HIDE, parent=hip, verts=8)
    knee = empty("Knee_" + tag, (0, 0, -upper_len), hip)
    shin_len = 0.46
    cyl("Shin_" + tag, (0, 0, -shin_len / 2), 0.072, shin_len, HIDE, parent=knee, verts=8)
    box("Hoof_" + tag, (0.01, 0, -shin_len - 0.05), (0.15, 0.15, 0.12),
        mat("Hoof", PALETTE["hoof"]), parent=knee)
    return hip


def spot_set(name, root, seed, count, radius_range):
    """Govde elipsoidinin yuzeyine oturan benek kumesi.

    Her benek, govdenin biraz ICINE yerlestirilmis bir kuredir; disari tasan
    kalotu leke olarak gorunur. Bu yontem yuzey normali hesabi gerektirmeden
    govdeye tam oturan, kenari yumusak lekeler verir.
    """
    rnd = random.Random(seed)
    parts = []
    cx, cy, cz = 0.0, 0.0, 1.02
    sx, sy, sz = 0.88, 0.44, 0.46
    inset = 0.86
    for i in range(count):
        u = rnd.uniform(0, math.pi * 2)
        v = math.acos(rnd.uniform(-0.8, 0.8))
        nx, ny, nz = math.sin(v) * math.cos(u), math.sin(v) * math.sin(u), math.cos(v)
        px = cx + nx * sx * inset
        py = cy + ny * sy * inset
        pz = cz + nz * sz * inset
        rr = rnd.uniform(*radius_range)
        ob = sphere("%s_b%d" % (name, i), (px, py, pz), rr, SPOT, segs=10, rings=6)
        ob.scale = (1.0, rnd.uniform(0.85, 1.2), rnd.uniform(0.85, 1.2))
        parts.append(ob)
    m = join(parts, name)
    m.parent = root
    return m


def build():
    global HIDE, SPOT
    reset_scene()
    HIDE = mat("Hide", PALETTE["hide_w"], rough=0.78)
    SPOT = mat("Spot", PALETTE["hide_b"], rough=0.78)

    root = empty("Cow", (0, 0, 0))

    # ---- govde
    torso = ellipsoid("Torso", (0.0, 0, 1.02), (0.88, 0.44, 0.46), HIDE, parent=root)
    # omuz ve sagri hacmi (govdeyi inek silueti yapar)
    ellipsoid("Withers", (0.42, 0, 1.18), (0.34, 0.36, 0.30), HIDE, parent=root)
    ellipsoid("Rump", (-0.66, 0, 1.14), (0.32, 0.38, 0.34), HIDE, parent=root)

    # ---- meme (laktasyondaki hayvanlarda JS buyutur, kurudakinde kucultur)
    ellipsoid("Udder", (-0.42, 0, 0.62), (0.26, 0.22, 0.18), mat("Udder", PALETTE["udder"]), parent=root)
    for sgn_x in (-1, 1):
        for sgn_y in (-1, 1):
            cyl("Teat_%d%d" % (sgn_x, sgn_y), (-0.42 + sgn_x * 0.11, sgn_y * 0.09, 0.47),
                0.022, 0.13, mat("Udder", PALETTE["udder"]), parent=root, verts=6)

    # ---- boyun ve bas (pivotlar JS tarafindan dondurulur: otlama, bas sallama)
    neck = empty("Neck", (0.72, 0, 1.22), root)
    n = ellipsoid("NeckMesh", (0.22, 0, 0.02), (0.30, 0.20, 0.22), HIDE, parent=neck)
    n.rotation_euler = (0, math.radians(-12), 0)
    head = empty("Head", (0.48, 0, 0.06), neck)
    ellipsoid("HeadMesh", (0.16, 0, 0), (0.22, 0.13, 0.15), HIDE, parent=head)
    box("Muzzle", (0.36, 0, -0.03), (0.16, 0.16, 0.12), mat("Muzzle", (0.80, 0.63, 0.60)), parent=head)
    for sgn in (-1, 1):
        e = box("Ear_%s" % ("L" if sgn > 0 else "R"), (0.08, sgn * 0.17, 0.08), (0.14, 0.10, 0.05),
                HIDE, parent=head)
        e.rotation_euler = (sgn * 0.45, 0, 0)
    # kupe (sari) - hayvan numarasini cagristirir
    box("EarTag", (0.06, 0.22, 0.04), (0.08, 0.02, 0.08), mat("Tag", (0.92, 0.80, 0.20)), parent=head)

    # ---- kuyruk
    tail = empty("Tail", (-0.92, 0, 1.18), root)
    cyl("TailMesh", (0, 0, -0.30), 0.032, 0.62, HIDE, parent=tail, verts=6)
    ellipsoid("TailTuft", (0, 0, -0.66), (0.06, 0.06, 0.11), SPOT, parent=tail)

    # ---- bacaklar
    leg(0.52, 0.26, "FL", root, True)
    leg(0.52, -0.26, "FR", root, True)
    leg(-0.58, 0.28, "BL", root, False)
    leg(-0.58, -0.28, "BR", root, False)

    # ---- 4 farkli benek seti (JS bir tanesini birakip digerlerini gizler)
    spot_set("Spots_A", root, 11, 7, (0.24, 0.36))   # klasik holstein: orta-iri leke
    spot_set("Spots_B", root, 23, 13, (0.13, 0.21))  # kucuk, cok sayida benek
    spot_set("Spots_C", root, 37, 4, (0.32, 0.44))   # az sayida cok iri leke
    spot_set("Spots_D", root, 59, 9, (0.17, 0.29))   # orta yogunluk

    # ---- ciz im cagrisi optimizasyonu: birlikte hareket eden parcalari tek mesh yap.
    # 20 inek x parca sayisi dogrudan draw call demek; okul bilgisayarlarinda onemli.
    def merge(names, out_name):
        objs = [bpy.data.objects.get(n) for n in names]
        objs = [o for o in objs if o]
        if len(objs) > 1:
            join(objs, out_name)

    merge(["Udder"] + ["Teat_%d%d" % (a, b) for a in (-1, 1) for b in (-1, 1)], "Udder")
    merge(["HeadMesh", "Muzzle", "Ear_L", "Ear_R", "EarTag"], "HeadMesh")
    for t in ("FL", "FR", "BL", "BR"):
        merge(["Shin_" + t, "Hoof_" + t], "Shin_" + t)
    merge(["TailMesh", "TailTuft"], "TailMesh")

    size = export_glb(OUT_GLB)
    print("COW_OK", size, "nesne:", len(bpy.data.objects),
          "mesh:", len([o for o in bpy.data.objects if o.type == "MESH"]))


if __name__ == "__main__":
    OUT_GLB = sys.argv[sys.argv.index("--") + 1]
    build()
