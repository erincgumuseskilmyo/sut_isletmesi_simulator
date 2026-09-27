# -*- coding: utf-8 -*-
"""
build_props.py - Isci, traktor, yem karma makinesi ve mobil sagim unitesi.

Inek modelinde oldugu gibi animasyon bake EDILMEZ: her hareketli parca
adlandirilmis bir pivot (Empty) altindadir, js/iso/* bunlari dondurur.

Cikti:
  assets/3d/worker.glb    -> Worker (yuruyus, egilme, sagim, kizginlik gozlemi)
  assets/3d/machines.glb  -> Tractor + Mixer (yem karma romorku) + MilkTrolley
"""
import bpy, sys, os, math

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from lib_iso import *

OUT_WORKER = None
OUT_MACHINES = None


# ------------------------------------------------------------------ isci
def build_worker():
    reset_scene()
    skin = mat("Skin", PALETTE["skin"])
    shirt = mat("Shirt", PALETTE["shirt"])
    denim = mat("Denim", PALETTE["denim"])
    boot = mat("Boot", (0.22, 0.20, 0.18))
    cap = mat("Cap", PALETTE["cap"])

    root = empty("Worker", (0, 0, 0))
    hips = empty("Hips", (0, 0, 0.92), root)

    box("Pelvis", (0, 0, 0.06), (0.30, 0.22, 0.20), denim, parent=hips)
    torso = empty("Torso", (0, 0, 0.16), hips)
    box("TorsoMesh", (0, 0, 0.26), (0.34, 0.24, 0.52), shirt, parent=torso)
    # is yelegi (gorunurluk icin turuncu serit)
    box("Vest", (0, 0, 0.30), (0.355, 0.252, 0.14), mat("Orange", PALETTE["orange"]), parent=torso)

    neck = empty("Neck", (0, 0, 0.54), torso)
    box("HeadMesh", (0, 0, 0.12), (0.20, 0.19, 0.23), skin, parent=neck)
    box("CapMesh", (0, 0, 0.25), (0.22, 0.21, 0.06), cap, parent=neck)
    box("CapPeak", (0.14, 0, 0.23), (0.10, 0.19, 0.03), cap, parent=neck)

    for sgn, tag in ((1, "L"), (-1, "R")):
        sh = empty("Arm_" + tag, (0, sgn * 0.22, 0.46), torso)
        cyl("UpperArm_" + tag, (0, 0, -0.16), 0.055, 0.32, shirt, parent=sh, verts=8)
        el = empty("Elbow_" + tag, (0, 0, -0.32), sh)
        cyl("Forearm_" + tag, (0, 0, -0.14), 0.05, 0.30, skin, parent=el, verts=8)
        box("Hand_" + tag, (0, 0, -0.32), (0.09, 0.07, 0.10), skin, parent=el)

        hp = empty("Leg_" + tag, (0, sgn * 0.11, 0.0), hips)
        cyl("Thigh_" + tag, (0, 0, -0.22), 0.075, 0.44, denim, parent=hp, verts=8)
        kn = empty("Knee_" + tag, (0, 0, -0.44), hp)
        cyl("Calf_" + tag, (0, 0, -0.21), 0.065, 0.42, denim, parent=kn, verts=8)
        box("Boot_" + tag, (0.04, 0, -0.46), (0.22, 0.11, 0.12), boot, parent=kn)

    # elde tasinabilir esyalar: JS gerektiginde gorunur yapar
    bucket = empty("Prop_Bucket", (0.30, 0.30, 0.55), root)
    cyl("BucketMesh", (0, 0, 0), 0.13, 0.26, mat("steel", PALETTE["steel"]), parent=bucket, verts=10)
    clip = empty("Prop_Clipboard", (0.28, -0.26, 0.95), root)
    b = box("ClipMesh", (0, 0, 0), (0.22, 0.02, 0.30), mat("wood", PALETTE["wood"]), parent=clip)
    b.rotation_euler = (0, 0.5, 0)
    fork = empty("Prop_Fork", (0.34, 0.24, 0.70), root)
    cyl("ForkShaft", (0, 0, 0.30), 0.03, 1.40, mat("wood", PALETTE["wood"]), parent=fork, verts=6)
    for i in (-1, 0, 1):
        cyl("ForkTine_%d" % i, (0, i * 0.09, -0.48), 0.018, 0.34,
            mat("steel_d", PALETTE["steel_d"]), parent=fork, verts=6)

    build_vet()
    size = export_glb(OUT_WORKER)
    print("WORKER_OK", size, len(bpy.data.objects))


def build_vet():
    """Veteriner saglik teknikeri: beyaz onluk, lacivert kep, steteskop, ilac cantasi.

    Isci ile ayni pivot adlandirmasini kullanir (Hips/Torso/Arm_L/Leg_L...),
    boylece JS tarafi ayni yuruyus/egilme kodunu tekrar kullanabilir.
    Kok nesne "Vet" adiyla ayni GLB icinde disari aktarilir.
    """
    skin = mat("Skin", PALETTE["skin"])
    coat = mat("VetCoat", (0.94, 0.95, 0.96))
    navy = mat("VetNavy", (0.18, 0.26, 0.40))
    boot = mat("Boot", (0.22, 0.20, 0.18))
    steth = mat("Steth", (0.15, 0.55, 0.52))

    root = empty("Vet", (3.0, 0, 0))
    hips = empty("Hips", (0, 0, 0.90), root)
    box("Pelvis", (0, 0, 0.06), (0.29, 0.21, 0.20), navy, parent=hips)

    torso = empty("Torso", (0, 0, 0.16), hips)
    box("TorsoMesh", (0, 0, 0.26), (0.33, 0.23, 0.52), coat, parent=torso)
    # onlugun etek kismi (teknikeri isciden ayiran silüet)
    box("CoatSkirt", (0, 0, -0.02), (0.36, 0.26, 0.30), coat, parent=torso)
    # steteskop: boyunda U seklinde iki kol + gogus parcasi
    for sgn in (-1, 1):
        c = cyl("StethArm_%d" % sgn, (0.02, sgn * 0.10, 0.44), 0.022, 0.30, steth, parent=torso)
        c.rotation_euler = (sgn * 0.25, 0.1, 0)
    cyl("StethHead", (0.14, -0.08, 0.28), 0.05, 0.03, steth, parent=torso,
        rot=(math.pi / 2, 0, 0), verts=10)

    neck = empty("Neck", (0, 0, 0.54), torso)
    box("HeadMesh", (0, 0, 0.12), (0.20, 0.19, 0.23), skin, parent=neck)
    box("CapMesh", (0, 0, 0.25), (0.22, 0.21, 0.06), navy, parent=neck)
    box("CapPeak", (0.14, 0, 0.23), (0.10, 0.19, 0.03), navy, parent=neck)

    for sgn, tag in ((1, "L"), (-1, "R")):
        sh = empty("Arm_" + tag, (0, sgn * 0.21, 0.46), torso)
        cyl("UpperArm_" + tag, (0, 0, -0.16), 0.052, 0.32, coat, parent=sh, verts=8)
        el = empty("Elbow_" + tag, (0, 0, -0.32), sh)
        cyl("Forearm_" + tag, (0, 0, -0.14), 0.048, 0.30, skin, parent=el, verts=8)
        box("Hand_" + tag, (0, 0, -0.32), (0.09, 0.07, 0.10), skin, parent=el)

        hp = empty("Leg_" + tag, (0, sgn * 0.11, 0.0), hips)
        cyl("Thigh_" + tag, (0, 0, -0.22), 0.072, 0.44, navy, parent=hp, verts=8)
        kn = empty("Knee_" + tag, (0, 0, -0.44), hp)
        cyl("Calf_" + tag, (0, 0, -0.21), 0.062, 0.42, navy, parent=kn, verts=8)
        box("Boot_" + tag, (0.04, 0, -0.46), (0.22, 0.11, 0.12), boot, parent=kn)

    # tasidigi ekipman - JS gerektiginde gorunur yapar
    bag = empty("Prop_Bag", (0.26, 0.30, 0.55), root)
    box("BagMesh", (0, 0, 0), (0.34, 0.20, 0.26), mat("VetBag", (0.45, 0.16, 0.16)), parent=bag)
    box("BagCross1", (0, -0.11, 0.02), (0.14, 0.02, 0.05), coat, parent=bag)
    box("BagCross2", (0, -0.11, 0.02), (0.05, 0.02, 0.14), coat, parent=bag)
    glove = empty("Prop_Glove", (0.30, -0.26, 0.90), root)
    cyl("GloveMesh", (0, 0, 0), 0.05, 0.62, mat("VetGlove", (0.92, 0.55, 0.20)), parent=glove,
        rot=(0, math.pi / 2, 0), verts=8)
    syr = empty("Prop_Syringe", (0.30, 0.24, 0.92), root)
    cyl("SyringeBody", (0, 0, 0), 0.028, 0.26, mat("Syringe", (0.90, 0.92, 0.94)), parent=syr,
        rot=(0, math.pi / 2, 0), verts=8)
    cyl("SyringeNeedle", (0.18, 0, 0), 0.008, 0.12, mat("steel", PALETTE["steel"]), parent=syr,
        rot=(0, math.pi / 2, 0), verts=6)


# ------------------------------------------------------------------ makineler
def wheel(name, loc, radius, width, parent, rim=True):
    w = empty(name, loc, parent)
    cyl(name + "_tyre", (0, 0, 0), radius, width, mat("tyre", PALETTE["tyre"]),
        parent=w, rot=(math.pi / 2, 0, 0), verts=14)
    if rim:
        cyl(name + "_rim", (0, 0, 0), radius * 0.45, width * 1.05,
            mat("rim", (0.80, 0.78, 0.72)), parent=w, rot=(math.pi / 2, 0, 0), verts=10)
        # jant cubugu: tekerin dondugu gorulsun diye
        box(name + "_spoke", (0, 0, 0), (radius * 1.7, width * 1.1, 0.06),
            mat("rim", (0.80, 0.78, 0.72)), parent=w)
    return w


def build_machines():
    reset_scene()
    green = mat("TractorGreen", PALETTE["green_m"])
    dark = mat("steel_d", PALETTE["steel_d"])
    glass = mat("glass", PALETTE["glass"])

    # ---------------- traktor (+x yonune bakar)
    tr = empty("Tractor", (0, 0, 0))   # JS konumu ezer; onizleme icin ayri dururlar
    box("Tr_body", (0.10, 0, 0.95), (2.30, 0.95, 0.60), green, parent=tr)
    box("Tr_hood", (1.05, 0, 1.12), (1.20, 0.80, 0.50), green, parent=tr)
    box("Tr_grille", (1.66, 0, 1.05), (0.10, 0.70, 0.40), dark, parent=tr)
    box("Tr_cabin", (-0.35, 0, 1.85), (1.10, 1.00, 1.10), glass, parent=tr)
    for sgn in (-1, 1):
        box("Tr_cabPost", (-0.35 + sgn * 0.52, 0, 1.85), (0.08, 1.02, 1.10), dark, parent=tr)
    box("Tr_roof", (-0.35, 0, 2.44), (1.30, 1.10, 0.10), green, parent=tr)
    box("Tr_seat", (-0.45, 0, 1.45), (0.40, 0.44, 0.30), dark, parent=tr)
    cyl("Tr_exhaust", (0.95, 0.34, 1.85), 0.06, 1.10, dark, parent=tr, verts=8)
    box("Tr_hitch", (-1.20, 0, 0.60), (0.40, 0.30, 0.18), dark, parent=tr)
    wheel("Wheel_RL", (-0.55, 0.62, 0.72), 0.72, 0.34, tr)
    wheel("Wheel_RR", (-0.55, -0.62, 0.72), 0.72, 0.34, tr)
    wheel("Wheel_FL", (1.15, 0.55, 0.46), 0.46, 0.26, tr)
    wheel("Wheel_FR", (1.15, -0.55, 0.46), 0.46, 0.26, tr)

    # ---------------- yem karma romorku: DIKEY (vertical) tek burgulu tip
    # Referans: AK Ziraat 6 m3 dikey yem karma makinesi - kirmizi konik kazan,
    # yan tarafta siyah bosaltma agzi, on yuzde merdiven, tek dingil, PTO mili.
    red = mat("MixerRed", (0.72, 0.16, 0.12))
    blk = mat("MixerBlack", (0.14, 0.14, 0.15))
    rim = mat("MixerRim", (0.86, 0.86, 0.84))
    mx = empty("Mixer", (-7.0, 0, 0))

    # sasi + dingil
    box("Mx_chassis", (0, 0, 0.55), (3.30, 1.55, 0.26), red, parent=mx)
    box("Mx_axle", (-0.35, 0, 0.50), (0.35, 2.05, 0.18), blk, parent=mx)

    # konik kazan (altta dar, ustte genis) - konus kesiti
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=1.02, radius2=1.48, depth=1.85,
                                    location=(0, 0, 1.62))
    tub = bpy.context.object
    tub.name = "Mx_tub"
    tub.data.materials.append(red)
    tub.parent = mx
    bpy.ops.object.shade_flat()
    # kazan ust cemberi
    cyl("Mx_rim", (0, 0, 2.55), 1.52, 0.10, rim, parent=mx, verts=24)
    # alt tabla
    cyl("Mx_base", (0, 0, 0.72), 1.05, 0.14, red, parent=mx, verts=24)

    # dikey burgu (kazanin icinde, ustten gorunur)
    aug = empty("Mx_Auger", (0, 0, 1.70), mx)
    cyl("Mx_augerCone", (0, 0, 0), 0.34, 1.70, rim, parent=aug, verts=14)
    for i in range(3):
        bl = box("Mx_augerFlight_%d" % i, (0, 0, -0.55 + i * 0.55), (1.30, 1.30, 0.07), rim, parent=aug)
        bl.rotation_euler = (0.16, 0, i * 2.1)

    # yan bosaltma agzi (siyah) + acilir tabla
    box("Mx_chuteBody", (0.30, -1.55, 1.35), (1.45, 0.75, 0.80), blk, parent=mx)
    ch = box("Mx_chuteTray", (0.30, -2.25, 1.02), (1.40, 0.95, 0.10), blk, parent=mx)
    ch.rotation_euler = (0.30, 0, 0)
    cyl("Mx_chuteRam", (0.95, -1.35, 1.85), 0.07, 0.95, rim, parent=mx,
        rot=(0.9, 0, 0), verts=8)
    empty("Mx_OutPoint", (0.30, -2.60, 0.85), mx)

    # on yuzde merdiven (iki dikme + basamaklar)
    for sgn in (-1, 1):
        cyl("Mx_ladderRail_%d" % sgn, (1.15, sgn * 0.32, 1.70), 0.045, 2.10, rim, parent=mx, verts=6)
    for i in range(5):
        cyl("Mx_ladderStep_%d" % i, (1.15, 0, 0.85 + i * 0.42), 0.035, 0.64, rim, parent=mx,
            rot=(math.pi / 2, 0, 0), verts=6)

    # cekme oku + PTO mili
    box("Mx_drawbar", (2.35, 0, 0.52), (1.90, 0.28, 0.22), red, parent=mx)
    cyl("Mx_pto", (2.55, 0, 0.78), 0.075, 1.60, blk, parent=mx, rot=(0, math.pi / 2, 0), verts=8)
    cyl("Mx_ptoJoint", (3.30, 0, 0.78), 0.11, 0.30, blk, parent=mx, rot=(0, math.pi / 2, 0), verts=8)
    box("Mx_hitch", (3.35, 0, 0.52), (0.34, 0.30, 0.30), blk, parent=mx)
    # hidrolik kutusu (sag on)
    box("Mx_hydraulic", (1.55, 0.62, 1.35), (0.40, 0.40, 0.55), rim, parent=mx)

    wheel("Mx_WheelL", (-0.35, 1.05, 0.56), 0.56, 0.36, mx)
    wheel("Mx_WheelR", (-0.35, -1.05, 0.56), 0.56, 0.36, mx)

    # ---------------- mobil sagim unitesi (sagimhane yok, hayvan yaninda sagim)
    mt = empty("MilkTrolley", (6.0, 0, 0))
    box("Mt_frame", (0, 0, 0.55), (0.70, 0.55, 0.12), dark, parent=mt)
    cyl("Mt_can", (0, 0, 0.36), 0.28, 0.62, mat("milk", PALETTE["milk"], rough=0.3, metal=0.6),
        parent=mt, verts=14)
    box("Mt_pump", (0.02, 0, 0.78), (0.34, 0.30, 0.30), mat("steel_d", PALETTE["steel_d"]), parent=mt)
    cyl("Mt_handle", (-0.34, 0, 0.90), 0.03, 0.55, dark, parent=mt, rot=(math.pi / 2, 0, 0), verts=6)
    for i, sgn in enumerate((-1, 1)):
        wheel("Mt_Wheel%d" % i, (-0.22, sgn * 0.30, 0.16), 0.16, 0.08, mt, rim=False)
    # sagim baslikları (JS memeye dogru uzatir)
    clu = empty("Mt_Cluster", (0.30, 0, 0.45), mt)
    box("Mt_clusterMesh", (0, 0, 0), (0.18, 0.16, 0.14), mat("steel", PALETTE["steel"]), parent=clu)
    for i in range(4):
        cyl("Mt_teatcup_%d" % i, ((i % 2) * 0.08 - 0.04, (i // 2) * 0.08 - 0.04, 0.10),
            0.024, 0.14, mat("rubber", (0.25, 0.25, 0.27)), parent=clu, verts=6)

    size = export_glb(OUT_MACHINES)
    print("MACHINES_OK", size, len(bpy.data.objects))


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:]
    OUT_WORKER, OUT_MACHINES = argv[0], argv[1]
    build_worker()
    build_machines()
