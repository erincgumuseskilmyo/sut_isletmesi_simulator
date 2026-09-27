# -*- coding: utf-8 -*-
"""
build_farm.py - Ciftligin statik geometrisi (izometrik sahne).

Yerlesim (metre, +x dogu, +y kuzey, Blender'da +z yukari):

    y= 26  +--------------------------------+        +-----------+
           |  LAKTASYON AHIRI (acik sistem) |        |  OFIS +   |
           |   kuzey padok = BASLANGIC      |        | SUT TANKI |
    y= 16  |  ==== yem yolu (servis) ====   |        +-----------+
           |   guney padok = BITIS          |
    y=  6  +--------------------------------+
    y=  1  ======== DIS SERVIS YOLU =========================
    y= -6  +----------------+   +------------------+  +-----------+
           |   KURU AHIR    |   |   YEM DEPOSU     |  | DOGUMHANE |
           | (altlikli,     |   | saman/yonca/tahil|  | + TEDAVI  |
    y=-20  |  durak yok)    |   +------------------+  +-----------+

Cikti: assets/3d/farm.glb + assets/3d/farm_layout.json
JS tarafi (js/iso/*) bu JSON'daki koordinatlardan hayvan/isci/traktor yollarini
uretir; boylece model ile oyun mantigi tek kaynaktan beslenir.
"""
import bpy, sys, os, math, json

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from lib_iso import *

OUT_GLB = None
OUT_JSON = None

# Catilar ayri bir mesh'te toplanir: oyunda "Catilari gizle" ile ahirlarin ici gorulur.
ROOFS = []

# ------------------------------------------------------------------ olculer
# LAKTASYON AHIRI (yeniden duzenlendi):
#   Ahir ENLEMESINE ikiye bolunur: ortadan kuzey-guney dogrultusunda gecen
#   SERVIS/YEM YOLU iki padogu ayirir. Traktor bu yoldan girip her iki yandaki
#   yemliklere yem birakir. Her padokta duraklar KARSILIKLI (bas basa) iki sira
#   halindedir; hayvanlarin basi ortadaki bas bosluguna bakar.
#
#        x=-22        -5  -1        14
#   y=26  +------------+  +----------+
#         | BASLANGIC  |Y |  BITIS   |
#         | durak|durak|E | durak|durak
#         |  <-> |     |M |      |<->|
#   y= 6  +------------+  +----------+
#                       ^ yem yolu (traktor kuzeye dogru gecer)
BARN = dict(x0=-22, x1=14, y0=6, y1=26)           # laktasyon ahiri dis siniri
ALLEY = dict(axis="y", x0=-5.0, x1=-1.0, y0=6, y1=26)   # ENLEMESINE yem/servis yolu
PEN_START = dict(x0=-21, x1=-5.8, y0=6.8, y1=25.2)      # bati padok (laktasyon baslangic)
PEN_END = dict(x0=-0.2, x1=13, y0=6.8, y1=25.2)         # dogu padok (laktasyon bitis)
# Yemlik/kafa kilidi hatlari yem yolunun iki yaninda, y ekseni boyunca uzanir.
HL_START_X = -5.35
HL_END_X = -0.65
HL_Y0, HL_Y1 = 7.5, 24.5
DRY = dict(x0=-22, x1=-4, y0=-20, y1=-6)
PEN_DRY = dict(x0=-21, x1=-5, y0=-19, y1=-7)
STORE = dict(x0=4, x1=22, y0=-20, y1=-9)
# Traktor ve yem karma makinesinin bosta bekledigi makine parki (yem deposunun bati yani)
YARD = dict(x0=-2.0, x1=3.4, y0=-20.0, y1=-8.0)
OFFICE = dict(x0=18, x1=28, y0=8, y1=18)
CLINIC = dict(x0=18, x1=30, y0=-8, y1=2)
ROAD_Y = 1.0

WALL_H = 4.2
RIDGE_H = 6.4


def ground():
    parts = [box("Ground", (0, 2, -0.15), (86, 74, 0.3), mat("grass", PALETTE["grass"]))]
    parts.append(box("Road", (0, ROAD_Y, 0.02), (76, 6.0, 0.06), mat("concrete", PALETTE["concrete"])))
    parts.append(box("Apron_barn", (-4, 4.6, 0.02), (38, 3.4, 0.06), mat("concrete_d", PALETTE["concrete_d"])))
    parts.append(box("Apron_dry", (-13, -4.4, 0.02), (20, 3.4, 0.06), mat("concrete_d", PALETTE["concrete_d"])))
    parts.append(box("Apron_store", (13, -7.4, 0.02), (20, 3.4, 0.06), mat("concrete_d", PALETTE["concrete_d"])))
    parts.append(box("Apron_clinic", (24, 3.2, 0.02), (13, 3.0, 0.06), mat("concrete_d", PALETTE["concrete_d"])))
    parts.append(box("Apron_office", (23, 6.6, 0.02), (11, 3.0, 0.06), mat("concrete_d", PALETTE["concrete_d"])))
    return join(parts, "Ground")


def open_shed(name, x0, x1, y0, y1, wall_h=WALL_H, ridge_h=RIDGE_H, post_step=6.0,
              roof_mat="roof", kick_wall=0.0, overhang=0.8):
    """Acik sistem sundurma: kose/ara direkler + besik cati (+ istenirse alcak duvar)."""
    parts = []
    mst = mat("steel", PALETTE["steel"])
    mstd = mat("steel_d", PALETTE["steel_d"])
    n = max(2, int(round((x1 - x0) / post_step)) + 1)
    for i in range(n):
        x = x0 + (x1 - x0) * i / (n - 1)
        for y in (y0, y1):
            parts.append(cyl("%s_post" % name, (x, y, wall_h / 2), 0.14, wall_h, mst, verts=8))
    for y in (y0, y1):
        parts.append(box("%s_beam" % name, ((x0 + x1) / 2, y, wall_h + 0.12),
                         (x1 - x0 + 0.4, 0.22, 0.24), mstd))
    ROOFS.extend(gable_roof(name + "_roof", ((x0 + x1) / 2, (y0 + y1) / 2),
                            (x1 - x0) + overhang * 2, (y1 - y0) + overhang * 2,
                            wall_h, ridge_h, mat(roof_mat, PALETTE[roof_mat]), thickness=0.14))
    ROOFS.append(box("%s_ridge" % name, ((x0 + x1) / 2, (y0 + y1) / 2, ridge_h + 0.06),
                     (x1 - x0 + overhang * 2, 0.3, 0.16), mstd))
    if kick_wall > 0:
        mw = mat("concrete_d", PALETTE["concrete_d"])
        for y in (y0, y1):
            parts.append(box("%s_kick" % name, ((x0 + x1) / 2, y, kick_wall / 2),
                             (x1 - x0, 0.2, kick_wall), mw))
        for x in (x0, x1):
            parts.append(box("%s_kickE" % name, (x, (y0 + y1) / 2, kick_wall / 2),
                             (0.2, y1 - y0, kick_wall), mw))
    return parts


def headlock_line(name, axis, fixed, a0, a1, facing):
    """Yemleme alani: yemlik + kafa kilidi hatti.

    axis="x": hat x ekseni boyunca uzanir, y=fixed sabittir (kuru ahir).
    axis="y": hat y ekseni boyunca uzanir, x=fixed sabittir (laktasyon ahiri).
    facing: hayvanlarin hangi tarafta durdugu (+1 / -1).
    """
    parts = []
    mst = mat("steel", PALETTE["steel"])
    mcon = mat("concrete", PALETTE["concrete"])
    length = a1 - a0
    mid = (a0 + a1) / 2
    step = 0.76
    n = int(length / step)
    if axis == "x":
        parts.append(box(name + "_bunk", (mid, fixed, 0.28), (length, 0.55, 0.56), mcon))
        for h in (1.05, 1.62):
            parts.append(cyl(name + "_rail", (mid, fixed + facing * 0.42, h), 0.05, length,
                             mst, rot=(0, math.pi / 2, 0), verts=6))
        for i in range(n + 1):
            a = a0 + i * step
            parts.append(cyl(name + "_lock", (a, fixed + facing * 0.42, 1.33), 0.035, 0.62, mst, verts=6))
            parts.append(cyl(name + "_arm", (a + 0.17, fixed + facing * 0.42, 1.33), 0.03, 0.60, mst,
                             rot=(0, 0.28, 0), verts=6))
    else:
        parts.append(box(name + "_bunk", (fixed, mid, 0.28), (0.55, length, 0.56), mcon))
        for h in (1.05, 1.62):
            parts.append(cyl(name + "_rail", (fixed + facing * 0.42, mid, h), 0.05, length,
                             mst, rot=(math.pi / 2, 0, 0), verts=6))
        for i in range(n + 1):
            a = a0 + i * step
            parts.append(cyl(name + "_lock", (fixed + facing * 0.42, a, 1.33), 0.035, 0.62, mst, verts=6))
            parts.append(cyl(name + "_arm", (fixed + facing * 0.42, a + 0.17, 1.33), 0.03, 0.60, mst,
                             rot=(0.28, 0, 0), verts=6))
    return parts


def stall_row_y(name, x_entry, depth, y0, y1, facing, gap=(15.0, 17.0)):
    """y ekseni boyunca uzanan durak sirasi.

    x_entry: hayvanin duraga girdigi kenar. facing=+1 ise durak +x yonune uzanir
    (hayvanin basi x_entry + depth tarafinda kalir).
    gap: siranin ortasinda birakilan gecis (cross-over) araligi.
    """
    parts = []
    mst = mat("steel", PALETTE["steel"])
    x_head = x_entry + facing * depth
    xm = (x_entry + x_head) / 2
    ym = (y0 + y1) / 2
    parts.append(box(name + "_bed", (xm, ym, 0.11), (depth, y1 - y0, 0.22),
                     mat("straw_d", PALETTE["straw_d"])))
    parts.append(box(name + "_curb", (x_entry, ym, 0.13), (0.18, y1 - y0, 0.26),
                     mat("concrete_d", PALETTE["concrete_d"])))
    # bas engeli (brisket board) ve bas borusu
    parts.append(cyl(name + "_neckrail", (x_head - facing * 0.45, ym, 1.18), 0.045, y1 - y0,
                     mst, rot=(math.pi / 2, 0, 0), verts=6))
    step = 1.22
    n = int((y1 - y0) / step)
    for i in range(n + 1):
        y = y0 + i * step
        if gap[0] < y < gap[1]:
            continue
        parts.append(cyl(name + "_div", (x_entry + facing * 0.25, y, 0.62), 0.05, 1.24, mst, verts=6))
        parts.append(cyl(name + "_divArm", (xm, y, 0.95), 0.045, depth * 0.9, mst,
                         rot=(0, math.pi / 2, 0), verts=6))
    return parts


def lactation_barn():
    """Enlemesine (kuzey-guney) yem yolu ile ikiye bolunmus, karsilikli durakli ahir."""
    parts = []
    B = BARN
    mcon = mat("concrete", PALETTE["concrete"])
    mcond = mat("concrete_d", PALETTE["concrete_d"])
    mst = mat("steel", PALETTE["steel"])

    # yem/servis yolu: yukseltilmis beton, ahrin iki ucundan disari tasar (traktor girisi)
    parts.append(box("Barn_alley", ((ALLEY["x0"] + ALLEY["x1"]) / 2, (B["y0"] + B["y1"]) / 2, 0.12),
                     (ALLEY["x1"] - ALLEY["x0"], (B["y1"] - B["y0"]) + 10.0, 0.24), mcon))
    # padok zeminleri
    for pen, tag in ((PEN_START, "W"), (PEN_END, "E")):
        parts.append(box("Barn_floor_" + tag,
                         ((pen["x0"] + pen["x1"]) / 2, (pen["y0"] + pen["y1"]) / 2, 0.03),
                         (pen["x1"] - pen["x0"] + 0.8, pen["y1"] - pen["y0"] + 0.8, 0.06), mcond))

    parts += open_shed("Barn", B["x0"], B["x1"], B["y0"], B["y1"], WALL_H, RIDGE_H, 6.0, "roof")

    # --- yemleme alani: yem yolunun iki yani
    parts += headlock_line("HL_W", "y", HL_START_X, HL_Y0, HL_Y1, -1)   # bati padok, hayvan x<hat
    parts += headlock_line("HL_E", "y", HL_END_X, HL_Y0, HL_Y1, +1)     # dogu padok, hayvan x>hat

    # --- KARSILIKLI (bas basa) durak siralari
    # Bati padok: giris kenarlari -9.0 (dogudan) ve -14.4 (batidan); basler ortada bulusur.
    parts += stall_row_y("ST_W1", -9.0, 2.4, 8.0, 24.0, -1)
    parts += stall_row_y("ST_W2", -14.4, 2.4, 8.0, 24.0, +1)
    # Dogu padok: giris kenarlari 3.0 (batidan) ve 8.4 (dogudan)
    parts += stall_row_y("ST_E1", 3.0, 2.4, 8.0, 24.0, +1)
    parts += stall_row_y("ST_E2", 8.4, 2.4, 8.0, 24.0, -1)

    # --- padok disini cevreleyen parmaklik
    for x in (B["x0"] + 0.4, B["x1"] - 0.4):
        for h in (0.8, 1.4):
            parts.append(cyl("Barn_fence", (x, (B["y0"] + B["y1"]) / 2, h), 0.05,
                             B["y1"] - B["y0"], mst, rot=(math.pi / 2, 0, 0), verts=6))
    for y in (B["y0"] + 0.4, B["y1"] - 0.4):
        for (xa, xb) in ((B["x0"], ALLEY["x0"]), (ALLEY["x1"], B["x1"])):
            for h in (0.8, 1.4):
                parts.append(cyl("Barn_fenceEnd", ((xa + xb) / 2, y, h), 0.05, xb - xa,
                                 mst, rot=(0, math.pi / 2, 0), verts=6))

    # --- padok isaret levhalari (ogrenci hangi bolme oldugunu gorsun)
    parts.append(box("Tag_start", (PEN_START["x1"] - 3.0, B["y0"] + 0.5, 2.3), (3.6, 0.14, 0.8),
                     mat("pasture", (0.35, 0.58, 0.32))))
    parts.append(box("Tag_end", (PEN_END["x0"] + 3.0, B["y0"] + 0.5, 2.3), (3.6, 0.14, 0.8),
                     mat("sky", (0.32, 0.52, 0.68))))

    # --- su yalaklari (her padokta, gecis araliginin yaninda)
    for pen in (PEN_START, PEN_END):
        wx = pen["x0"] + 2.2 if pen is PEN_END else pen["x1"] - 2.2
        parts.append(box("Trough", (wx, 16.0, 0.3), (0.9, 2.4, 0.6), mcon))
        parts.append(box("Trough_w", (wx, 16.0, 0.52), (0.74, 2.2, 0.1), mat("water", (0.40, 0.58, 0.68))))

    return join(parts, "LactationBarn")


def dry_barn():
    parts = []
    D = DRY
    parts.append(box("Dry_pack", ((D["x0"] + D["x1"]) / 2, (D["y0"] + D["y1"]) / 2, 0.16),
                     (D["x1"] - D["x0"] - 1.0, D["y1"] - D["y0"] - 1.0, 0.32),
                     mat("straw", PALETTE["straw"])))
    parts += open_shed("Dry", D["x0"], D["x1"], D["y0"], D["y1"], 3.9, 5.7, 6.0, "roof", kick_wall=1.0)
    parts += headlock_line("HL_D", "x", D["y1"] - 0.6, D["x0"] + 1.5, D["x1"] - 1.5, -1)
    parts.append(box("Dry_trough", (D["x0"] + 3, D["y0"] + 3, 0.3), (2.2, 0.8, 0.6),
                     mat("concrete", PALETTE["concrete"])))
    for i in range(3):
        parts.append(box("Dry_bale", (D["x1"] - 2.0, D["y0"] + 2.0 + i * 1.3, 0.6), (1.2, 1.1, 1.1),
                         mat("straw_d", PALETTE["straw_d"])))
    return join(parts, "DryBarn")


def feed_store():
    """Yem deposu: saman, yonca, tahil gozleri + silaj yigini."""
    parts = []
    S = STORE
    parts.append(box("Store_floor", ((S["x0"] + S["x1"]) / 2, (S["y0"] + S["y1"]) / 2, 0.06),
                     (S["x1"] - S["x0"], S["y1"] - S["y0"], 0.12), mat("concrete", PALETTE["concrete"])))
    parts += open_shed("Store", S["x0"], S["x1"], S["y0"], S["y1"], 4.6, 6.6, 6.0, "roof_red")
    mw = mat("wall", PALETTE["wall"])
    parts.append(box("Store_back", ((S["x0"] + S["x1"]) / 2, S["y0"] + 0.15, 2.3),
                     (S["x1"] - S["x0"], 0.3, 4.6), mw))
    for x in (S["x0"] + 0.15, S["x1"] - 0.15):
        parts.append(box("Store_side", (x, (S["y0"] + S["y1"]) / 2, 2.3), (0.3, S["y1"] - S["y0"], 4.6), mw))
    bw = (S["x1"] - S["x0"]) / 3.0
    for i in (1, 2):
        parts.append(box("Store_div", (S["x0"] + i * bw, (S["y0"] + S["y1"]) / 2 - 1.0, 1.1),
                         (0.25, S["y1"] - S["y0"] - 2.0, 2.2), mat("wood_d", PALETTE["wood_d"])))
    for r in range(3):
        for c in range(3):
            parts.append(box("Bale_straw", (S["x0"] + 1.6 + c * 1.5, S["y0"] + 2.0 + r * 1.35, 0.6),
                             (1.3, 1.2, 1.1), mat("straw_d", PALETTE["straw_d"])))
    for c in range(2):
        parts.append(box("Bale_straw2", (S["x0"] + 2.3 + c * 1.5, S["y0"] + 3.0, 1.7), (1.3, 1.2, 1.1),
                         mat("straw", PALETTE["straw"])))
    for r in range(3):
        for c in range(3):
            parts.append(box("Bale_hay", (S["x0"] + bw + 1.6 + c * 1.5, S["y0"] + 2.0 + r * 1.35, 0.6),
                             (1.3, 1.2, 1.1), mat("hay", PALETTE["hay"])))
    for c in range(2):
        parts.append(box("Bale_hay2", (S["x0"] + bw + 2.3 + c * 1.5, S["y0"] + 3.0, 1.7), (1.3, 1.2, 1.1),
                         mat("hay", PALETTE["hay"])))
    gx = S["x0"] + 2 * bw + 0.4
    bins = [("grain", PALETTE["grain"]), ("soy", PALETTE["soy"]), ("premix", PALETTE["premix"])]
    for i, (nm, col) in enumerate(bins):
        y = S["y0"] + 1.8 + i * 2.6
        parts.append(box("Bin_wall_" + nm, (gx + 2.4, y, 0.55), (4.6, 2.2, 1.1), mat("wood", PALETTE["wood"])))
        parts.append(box("Bin_fill_" + nm, (gx + 2.4, y, 1.18), (4.2, 1.9, 0.5), mat(nm, col)))
    parts.append(box("Silage_pile", (S["x1"] + 4.5, S["y0"] + 4.0, 0.9), (7.0, 9.0, 1.8),
                     mat("silage", PALETTE["silage"])))
    parts.append(box("Silage_cover", (S["x1"] + 4.5, S["y0"] + 4.0, 1.86), (7.2, 9.2, 0.12),
                     mat("cover", (0.15, 0.15, 0.17))))
    for i in range(6):
        parts.append(cyl("Silage_tyre", (S["x1"] + 1.8 + (i % 3) * 2.6, S["y0"] + 1.0 + (i // 3) * 6.0, 2.0),
                         0.45, 0.25, mat("tyre", PALETTE["tyre"]), verts=10))
    return join(parts, "FeedStore")


def machine_yard():
    """Makine parki: traktor + yem karma romorku kullanilmadiginda burada durur."""
    parts = []
    Y = YARD
    parts.append(box("Yard_floor", ((Y["x0"] + Y["x1"]) / 2, (Y["y0"] + Y["y1"]) / 2, 0.05),
                     (Y["x1"] - Y["x0"], Y["y1"] - Y["y0"], 0.10),
                     mat("concrete_d", PALETTE["concrete_d"])))
    # park yeri cizgileri
    for i in range(2):
        parts.append(box("Yard_line_%d" % i, ((Y["x0"] + Y["x1"]) / 2, Y["y0"] + 3.0 + i * 6.0, 0.11),
                         (Y["x1"] - Y["x0"] - 1.0, 0.16, 0.02), mat("line", (0.92, 0.90, 0.80))))
    # ust sundurma (makineleri gunesten korur)
    parts += open_shed("Yard", Y["x0"] + 0.3, Y["x1"] - 0.3, Y["y0"] + 0.6, Y["y1"] - 0.6,
                       4.4, 5.6, 6.0, "roof")
    # yakit tanki ve alet rafi
    parts.append(cyl("Yard_fuel", (Y["x0"] + 1.0, Y["y0"] + 1.4, 0.75), 0.55, 1.5,
                     mat("Orange", PALETTE["orange"]), verts=12, rot=(math.pi / 2, 0, 0)))
    parts.append(box("Yard_rack", (Y["x1"] - 0.8, Y["y0"] + 2.6, 0.9), (0.5, 2.6, 1.8),
                     mat("steel_d", PALETTE["steel_d"])))
    return join(parts, "MachineYard")


def office_and_tank():
    """Ofis binasi + sut sogutma tanki (sundurma altinda; sagimhane yok)."""
    parts = []
    O = OFFICE
    mw = mat("wall", PALETTE["wall"])
    parts.append(box("Office_floor", ((O["x0"] + O["x1"]) / 2, (O["y0"] + O["y1"]) / 2, 0.08),
                     (O["x1"] - O["x0"] + 1.0, O["y1"] - O["y0"] + 1.0, 0.16),
                     mat("concrete", PALETTE["concrete"])))
    ox0, ox1 = O["x0"], O["x0"] + 5.4
    parts.append(box("Office_body", ((ox0 + ox1) / 2, (O["y0"] + O["y1"]) / 2, 1.7),
                     (ox1 - ox0, O["y1"] - O["y0"], 3.4), mw))
    ROOFS.extend(gable_roof("Office_roof", ((ox0 + ox1) / 2, (O["y0"] + O["y1"]) / 2),
                            (ox1 - ox0) + 0.8, (O["y1"] - O["y0"]) + 0.8, 3.4, 4.5,
                            mat("roof_red", PALETTE["roof_red"])))
    parts.append(box("Office_door", (ox0 + 2.4, O["y0"] - 0.02, 1.05), (1.1, 0.12, 2.1),
                     mat("wood_d", PALETTE["wood_d"])))
    for i in range(2):
        parts.append(box("Office_win", (ox0 - 0.02, O["y0"] + 3.0 + i * 3.5, 2.0), (0.12, 1.4, 1.1),
                         mat("glass", PALETTE["glass"])))
    tx0, tx1 = O["x0"] + 5.8, O["x1"]
    parts += open_shed("Tank", tx0, tx1, O["y0"] + 0.5, O["y1"] - 0.5, 3.2, 4.2, 4.2, "roof")
    ty = (O["y0"] + O["y1"]) / 2
    parts.append(cyl("MilkTank", ((tx0 + tx1) / 2, ty, 1.5), 1.45, 5.2,
                     mat("milk", PALETTE["milk"], rough=0.25, metal=0.7),
                     rot=(math.pi / 2, 0, 0), verts=16))
    for sgn in (1, -1):
        for dx in (-1.0, 1.0):
            parts.append(cyl("Tank_foot", ((tx0 + tx1) / 2 + dx, ty + sgn * 1.8, 0.4), 0.1, 0.8,
                             mat("steel_d", PALETTE["steel_d"]), verts=6))
    parts.append(box("Tank_panel", ((tx0 + tx1) / 2 + 1.5, ty - 2.6, 1.6), (0.6, 0.25, 0.8),
                     mat("steel_d", PALETTE["steel_d"])))
    return join(parts, "OfficeAndTank")


def clinic():
    """Dogumhane + tedavi alani: iki bireysel bolme, saman zemin, travay."""
    parts = []
    C = CLINIC
    parts.append(box("Clinic_floor", ((C["x0"] + C["x1"]) / 2, (C["y0"] + C["y1"]) / 2, 0.06),
                     (C["x1"] - C["x0"], C["y1"] - C["y0"], 0.12), mat("concrete", PALETTE["concrete"])))
    parts += open_shed("Clinic", C["x0"], C["x1"], C["y0"], C["y1"], 3.6, 5.2, 6.0, "roof")
    mw = mat("wall", PALETTE["wall"])
    parts.append(box("Clinic_back", ((C["x0"] + C["x1"]) / 2, C["y0"] + 0.15, 1.8),
                     (C["x1"] - C["x0"], 0.3, 3.6), mw))
    parts.append(box("Clinic_side", (C["x1"] - 0.15, (C["y0"] + C["y1"]) / 2, 1.8),
                     (0.3, C["y1"] - C["y0"], 3.6), mw))
    mst = mat("steel", PALETTE["steel"])
    for i in range(2):
        bx = C["x0"] + 3.0 + i * 5.2
        parts.append(box("Calving_bed", (bx, C["y0"] + 3.0, 0.2), (4.4, 4.6, 0.4), mat("straw", PALETTE["straw"])))
        for h in (0.6, 1.15, 1.7):
            parts.append(cyl("Calving_rail", (bx, C["y0"] + 5.4, h), 0.045, 4.4, mst,
                             rot=(0, math.pi / 2, 0), verts=6))
        for sgn in (-1, 1):
            parts.append(cyl("Calving_post", (bx + sgn * 2.2, C["y0"] + 5.4, 0.9), 0.07, 1.8, mst, verts=6))
    tx = C["x1"] - 3.2
    for sgn in (-1, 1):
        parts.append(cyl("Chute_post", (tx + sgn * 0.6, C["y1"] - 2.0, 1.0), 0.09, 2.0, mst, verts=6))
        parts.append(cyl("Chute_post2", (tx + sgn * 0.6, C["y1"] - 4.4, 1.0), 0.09, 2.0, mst, verts=6))
        for h in (0.7, 1.35):
            parts.append(cyl("Chute_rail", (tx + sgn * 0.6, C["y1"] - 3.2, h), 0.04, 2.4, mst,
                             rot=(math.pi / 2, 0, 0), verts=6))
    parts.append(box("MedCabinet", (C["x1"] - 1.2, C["y0"] + 1.2, 1.0), (0.8, 1.6, 2.0), mw))
    parts.append(box("MedCross", (C["x1"] - 1.62, C["y0"] + 1.2, 1.4), (0.06, 0.5, 0.16),
                     mat("red", (0.72, 0.2, 0.18))))
    parts.append(box("MedCross2", (C["x1"] - 1.62, C["y0"] + 1.2, 1.4), (0.06, 0.16, 0.5),
                     mat("red", (0.72, 0.2, 0.18))))
    return join(parts, "Clinic")


def fences_and_props():
    parts = []
    mw = mat("wood", PALETTE["wood"])
    for (x0, x1, y) in [(-34, 34, 32), (-34, 34, -26)]:
        for i in range(int((x1 - x0) / 4) + 1):
            parts.append(cyl("Fence_post", (x0 + i * 4, y, 0.7), 0.09, 1.4, mw, verts=6))
        for h in (0.6, 1.15):
            parts.append(box("Fence_rail", ((x0 + x1) / 2, y, h), (x1 - x0, 0.08, 0.14), mw))
    for (y0, y1, x) in [(-26, 32, -34), (-26, 32, 34)]:
        for i in range(int((y1 - y0) / 4) + 1):
            parts.append(cyl("Fence_post", (x, y0 + i * 4, 0.7), 0.09, 1.4, mw, verts=6))
        for h in (0.6, 1.15):
            parts.append(box("Fence_rail", (x, (y0 + y1) / 2, h), (0.08, y1 - y0, 0.14), mw))
    for (tx, ty) in [(-30, 28), (-28, -22), (30, 28), (31, -22), (-31, 10), (32, 12), (0, 30), (-16, 30)]:
        parts.append(cyl("Tree_trunk", (tx, ty, 1.1), 0.25, 2.2, mat("wood_d", PALETTE["wood_d"]), verts=6))
        parts.append(sphere("Tree_crown", (tx, ty, 3.0), 1.8, mat("leaf", (0.28, 0.44, 0.24)), segs=8, rings=5))
    return join(parts, "Props")


def build():
    reset_scene()
    ground()
    lactation_barn()
    dry_barn()
    feed_store()
    machine_yard()
    office_and_tank()
    clinic()
    fences_and_props()
    join(ROOFS, "Roofs")

    size = export_glb(OUT_GLB)

    layout = {
        "_comment": "build_farm.py tarafindan uretildi; js/iso/* bu koordinatlari kullanir.",
        "unit": "metre",
        "barn": BARN, "alley": ALLEY,
        "pens": {"start": PEN_START, "end": PEN_END, "dry": PEN_DRY},
        "dryBarn": DRY, "store": STORE, "office": OFFICE, "clinic": CLINIC, "yard": YARD,
        "roadY": ROAD_Y,
        # Kafa kilidi hatlari. axis="y": hat y boyunca uzanir, x sabittir.
        # face: hayvanin hatta gore hangi tarafta durdugu.
        "headlocks": {
            "start": {"axis": "y", "x": HL_START_X, "from": HL_Y0, "to": HL_Y1, "face": -1},
            "end": {"axis": "y", "x": HL_END_X, "from": HL_Y0, "to": HL_Y1, "face": 1},
            "dry": {"axis": "x", "y": DRY["y1"] - 0.6, "from": DRY["x0"] + 1.5,
                    "to": DRY["x1"] - 1.5, "face": -1}
        },
        # Duraklar (karsilikli iki sira). JS bunlari yatma/dinlenme noktasi olarak kullanir.
        "stalls": {
            "start": [{"xEntry": -9.0, "depth": 2.4, "face": -1, "y0": 8.0, "y1": 24.0},
                      {"xEntry": -14.4, "depth": 2.4, "face": 1, "y0": 8.0, "y1": 24.0}],
            "end": [{"xEntry": 3.0, "depth": 2.4, "face": 1, "y0": 8.0, "y1": 24.0},
                    {"xEntry": 8.4, "depth": 2.4, "face": -1, "y0": 8.0, "y1": 24.0}]
        },
        "anchors": {
            "storeDoor": [STORE["x0"] + 3.0, STORE["y1"] + 1.5],
            "storeMix": [STORE["x0"] + 14.0, STORE["y1"] - 3.0],
            "tractorPark": [(YARD["x0"] + YARD["x1"]) / 2, YARD["y0"] + 3.0],
            "mixerPark": [(YARD["x0"] + YARD["x1"]) / 2, YARD["y0"] + 9.0],
            "yardExit": [(YARD["x0"] + YARD["x1"]) / 2, YARD["y1"] + 2.5],
            "officeDoor": [OFFICE["x0"] + 2.4, OFFICE["y0"] - 1.6],
            "milkTank": [OFFICE["x0"] + 8.0, (OFFICE["y0"] + OFFICE["y1"]) / 2 - 3.2],
            "clinicPen1": [CLINIC["x0"] + 3.0, CLINIC["y0"] + 3.0],
            "clinicPen2": [CLINIC["x0"] + 8.2, CLINIC["y0"] + 3.0],
            "chute": [CLINIC["x1"] - 3.2, CLINIC["y1"] - 3.2],
            # Traktor yem yoluna guneyden girer, kuzeye dogru yem birakir,
            # kuzey ucundan cikip dogudan dolanarak yola doner.
            "alleySouth": [(ALLEY["x0"] + ALLEY["x1"]) / 2, BARN["y0"] - 4.0],
            "alleyNorth": [(ALLEY["x0"] + ALLEY["x1"]) / 2, BARN["y1"] + 4.0],
            "barnLoopNE": [BARN["x1"] + 5.0, BARN["y1"] + 4.0],
            "barnLoopSE": [BARN["x1"] + 5.0, ROAD_Y],
            "roadEast": [26.0, ROAD_Y],
            "roadWest": [-26.0, ROAD_Y],
            "dryGate": [(DRY["x0"] + DRY["x1"]) / 2, DRY["y1"] + 1.5]
        }
    }
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)
    print("FARM_OK", size, len(bpy.data.objects))


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:]
    OUT_GLB, OUT_JSON = argv[0], argv[1]
    build()
