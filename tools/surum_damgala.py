# -*- coding: utf-8 -*-
"""
surum_damgala.py - Tarayici onbellegi sorununu bitirir.

SORUN: Tarayicilar js/css dosyalarini onbellege alir. Oyunda bir degisiklik
yapildiginda ogrenci (ya da ogretim elemani) sayfayi yenilese bile ESKI kodu
calistirmaya devam edebilir. "Animasyon calismiyor", "yeni ozellik yok" gibi
hayalet hatalarin cogunun sebebi budur.

COZUM: Butun yerel dosya baglantilarinin sonuna ?v=<zaman damgasi> eklenir.
Damga degisince tarayici dosyayi yeniden indirmek zorunda kalir.

Damgalanan yerler:
  1) index.html icindeki <script src="..."> ve <link href="...">
  2) ES modullerinin birbirini cagirdigi import satirlari (js/iso/*.js)
  3) farm3d.js icindeki model/JSON yollari (ASSET_BASE ile yuklenenler)

Kullanim (proje klasorunde):
    py tools/surum_damgala.py
Her kod degisikliginden sonra bir kez calistirmak yeterlidir.
"""
import io
import os
import re
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAMP = time.strftime("%Y%m%d%H%M")


def oku(p):
    return io.open(p, encoding="utf-8").read()


def yaz(p, s):
    io.open(p, "w", encoding="utf-8", newline="").write(s)


def damgala_yol(yol):
    """Yerel bir yola ?v=STAMP ekler; disaridaki adreslere dokunmaz.

    vendor/ altindaki dosyalar (Three.js, GLTFLoader) DAMGALANMAZ: GLTFLoader
    kendi icinden three.module.js'i damgasiz cagirir; bir tarafi damgalarsak
    Three.js iki ayri kopya olarak yuklenir ve sahne bozulur. Bu dosyalar zaten
    hic degismiyor.
    """
    if yol.startswith(("http://", "https://", "//", "data:")):
        return yol
    if "vendor/" in yol:
        return yol
    temiz = yol.split("?")[0]
    return temiz + "?v=" + STAMP


def index_html():
    p = os.path.join(ROOT, "index.html")
    s = oku(p)
    n = [0]

    def src(m):
        yeni = damgala_yol(m.group(2))
        if yeni == m.group(2):
            return m.group(0)
        n[0] += 1
        return m.group(1) + yeni + m.group(3)

    s = re.sub(r'(<script[^>]*\ssrc=")([^"]+)(")', src, s)
    s = re.sub(r'(<link[^>]*\shref=")([^"]+)(")', src, s)
    yaz(p, s)
    return n[0]


def moduller():
    """js/iso/*.js icindeki import ve ASSET_BASE yollarini damgalar."""
    toplam = 0
    kls = os.path.join(ROOT, "js", "iso")
    for ad in sorted(os.listdir(kls)):
        if not ad.endswith(".js"):
            continue
        p = os.path.join(kls, ad)
        s = oku(p)
        n = [0]

        def imp(m):
            yeni = damgala_yol(m.group(2))
            if yeni == m.group(2):
                return m.group(0)
            n[0] += 1
            return m.group(1) + yeni + m.group(3)

        s = re.sub(r'(from\s+")([^"]+\.js)(")', imp, s)
        # GLB / JSON yuklemeleri: ASSET_BASE + "dosya" + "?v=..."
        s = re.sub(r'(ASSET_BASE \+ f)( \+ "\?v=[^"]*")?', r'\1 + "?v=' + STAMP + '"', s)
        s = re.sub(r'(ASSET_BASE \+ "farm_layout\.json)(\?v=[^"]*)?(")',
                   r'\1?v=' + STAMP + r'\3', s)
        if n[0] or "?v=" + STAMP in s:
            yaz(p, s)
            toplam += n[0]
    return toplam


def ses_ve_gorseller():
    """sfx.js icindeki ses dosyasi yollarini damgalar."""
    p = os.path.join(ROOT, "js", "sfx.js")
    if not os.path.exists(p):
        return 0
    s = oku(p)
    s = re.sub(r'("assets/audio/[a-z_]+\.ogg)(\?v=[^"]*)?(")',
               r'\1?v=' + STAMP + r'\3', s)
    yaz(p, s)
    return 1


if __name__ == "__main__":
    a = index_html()
    b = moduller()
    c = ses_ve_gorseller()
    print("Surum damgasi: v=%s" % STAMP)
    print("  index.html          : %d bag guncellendi" % a)
    print("  js/iso/*.js import  : %d bag guncellendi" % b)
    print("  js/sfx.js ses yollari: %s" % ("guncellendi" if c else "atlandi"))
    print("\nTarayicida sayfayi yenilemek artik yeterli; eski dosya calistirilamaz.")
