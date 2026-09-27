/* =========================================================
   season.js
   56 haftalık oyun 4 mevsime bölünür (her biri 14 hafta):

     Hafta  1-14  YAZ        Hafta 15-28  SONBAHAR
     Hafta 29-42  KIŞ        Hafta 43-56  İLKBAHAR

   Mevsim; çimin/ağaçların rengini, gökyüzünü, güneşin rengini ve
   açısını, çatı/zemin tonunu ve havada uçuşan parçacıkları
   (sonbaharda yaprak, kışta kar, ilkbaharda polen) değiştirir.

   ÖNEMLİ: Bu katman yalnızca GÖRSELDİR. Oyunun hiçbir kuralı,
   verimi veya olasılığı mevsime göre değişmez; Game.state'e
   dokunulmaz. Mevsim sadece hafta numarasından hesaplanır.
   ========================================================= */
import * as THREE from "../../vendor/three/three.module.js";

export const SEASONS = [
  {
    key: "yaz", name: "YAZ", icon: "☀️",
    grass: 0x7a8f3c, leaf: 0x2f5424, trunk: 0x53381f,
    sky: 0x9fc7e8, fog: 0xb8d6ee,
    sun: 0xfff2d0, sunPower: 2.0, sunPos: [40, 62, 26], hemi: 1.15,
    roofTint: 1.0, groundTint: 1.0,
    particle: null
  },
  {
    key: "sonbahar", name: "SONBAHAR", icon: "🍂",
    grass: 0x8c8340, leaf: 0xa9601f, trunk: 0x4a3119,
    sky: 0xc9b98f, fog: 0xd6c9a6,
    sun: 0xffd9a0, sunPower: 1.5, sunPos: [34, 42, 34], hemi: 1.0,
    roofTint: 0.96, groundTint: 0.98,
    particle: { kind: "leaf", count: 300, color: 0x9e4a13, size: 1.05, fall: 1.6, sway: 1.5 }
  },
  {
    key: "kis", name: "KIŞ", icon: "❄️",
    grass: 0xd0dae2, leaf: 0x6b6554, trunk: 0x3d2c1c,
    sky: 0xa6bccf, fog: 0xc0d2e0,
    sun: 0xe6f0ff, sunPower: 1.45, sunPos: [26, 34, 40], hemi: 1.15,
    roofTint: 1.22, groundTint: 1.18,
    particle: { kind: "snow", count: 900, color: 0xffffff, size: 1.15, fall: 1.2, sway: 0.7 }
  },
  {
    key: "ilkbahar", name: "İLKBAHAR", icon: "🌱",
    grass: 0x63a03f, leaf: 0x4f8c33, trunk: 0x53381f,
    sky: 0xa8cdea, fog: 0xc3ddf2,
    sun: 0xfff6e0, sunPower: 1.8, sunPos: [36, 54, 30], hemi: 1.2,
    roofTint: 1.0, groundTint: 1.0,
    particle: { kind: "pollen", count: 240, color: 0xfff3b0, size: 0.6, fall: 0.2, sway: 2.2 }
  }
];

/** Hafta numarasından mevsim (1-14 yaz, 15-28 sonbahar, 29-42 kış, 43-56 ilkbahar). */
export function seasonForWeek(week, totalWeeks = 56) {
  const per = Math.max(1, Math.round(totalWeeks / 4));
  const i = Math.min(3, Math.floor((Math.max(1, week) - 1) / per));
  return SEASONS[i];
}

/** Yumuşak yuvarlak nokta dokusu (kar tanesi / yaprak / polen için). */
function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  // Yumusak kenarli ama ICI DOLU disk: cok yumusak bir gradyan, izometrik
  // uzaklikta tanecikleri neredeyse gorunmez yapiyordu.
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.72, "rgba(255,255,255,1)");
  grd.addColorStop(0.92, "rgba(255,255,255,0.65)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class SeasonManager {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Object3D} farmRoot  farm.glb sahnesi
   * @param {THREE.DirectionalLight} sun
   * @param {THREE.HemisphereLight} hemi
   */
  constructor(scene, farmRoot, sun, hemi) {
    this.scene = scene;
    this.sun = sun;
    this.hemi = hemi;
    this.current = null;

    // Malzemeleri ADINA göre topla: build_farm.py hepsini adlandırıyor
    // ("grass", "leaf", "wood_d", "roof", "concrete"...). Böylece tek tek
    // mesh aramadan mevsime göre renk değiştirebiliyoruz.
    this.mats = {};
    this.baseColors = {};
    farmRoot.traverse(o => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      list.forEach(m => {
        if (!m || !m.name || this.mats[m.name]) return;
        this.mats[m.name] = m;
        this.baseColors[m.name] = m.color.clone();
      });
    });

    this.particles = null;
    this.tex = dotTexture();
  }

  /** Hafta değiştiğinde çağrılır; aynı mevsimse hiçbir şey yapmaz. */
  applyWeek(week, totalWeeks) {
    const s = seasonForWeek(week, totalWeeks);
    if (this.current && this.current.key === s.key) return s;
    this.current = s;
    this._applyColors(s);
    this._buildParticles(s);
    return s;
  }

  _tint(name, hex) {
    const m = this.mats[name];
    if (m) m.color.setHex(hex);
  }

  /** Bir malzemeyi özgün renginden yola çıkarak açar/koyulaştırır. */
  _scale(name, k) {
    const m = this.mats[name];
    const b = this.baseColors[name];
    if (!m || !b) return;
    m.color.setRGB(
      Math.min(1, b.r * k),
      Math.min(1, b.g * k),
      Math.min(1, b.b * k)
    );
  }

  _applyColors(s) {
    this._tint("grass", s.grass);
    this._tint("leaf", s.leaf);
    this._tint("wood_d", s.trunk);
    // kışın çatılarda ve sert zeminde kar örtüsü hissi
    ["roof", "roof_red"].forEach(n => this._scale(n, s.roofTint));
    ["concrete", "concrete_d"].forEach(n => this._scale(n, s.groundTint));
    // kışın saman/altlık da soluklaşır, ilkbaharda tazelenir
    ["straw", "straw_d", "hay"].forEach(n => this._scale(n, s.key === "kis" ? 0.88 : 1.0));

    if (this.scene.background && this.scene.background.isColor) this.scene.background.setHex(s.sky);
    if (this.scene.fog) this.scene.fog.color.setHex(s.fog);
    if (this.sun) {
      this.sun.color.setHex(s.sun);
      this.sun.intensity = s.sunPower;
      this.sun.position.set(s.sunPos[0], s.sunPos[1], s.sunPos[2]);
    }
    if (this.hemi) this.hemi.intensity = s.hemi;
  }

  _buildParticles(s) {
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particles.material.dispose();
      this.particles = null;
    }
    const p = s.particle;
    if (!p) return;

    const n = p.count;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    // çiftliğin üzerini kaplayan bir hacim
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 80;
      pos[i * 3 + 1] = Math.random() * 26 + 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 74 - 2;
      seed[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));

    const mat = new THREE.PointsMaterial({
      color: p.color,
      size: p.size,
      map: this.tex,
      transparent: true,
      opacity: p.kind === "snow" ? 0.95 : 0.85,
      depthWrite: false,
      sizeAttenuation: true
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.userData.spec = p;
    this.scene.add(pts);
    this.particles = pts;
  }

  /** Her karede: parçacıkları düşür/sallandır, dibe inince yukarı sar. */
  update(dt, t) {
    if (!this.particles) return;
    const p = this.particles.userData.spec;
    const arr = this.particles.geometry.attributes.position.array;
    const seed = this.particles.geometry.attributes.aSeed.array;
    const n = seed.length;
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      arr[k + 1] -= p.fall * dt;
      arr[k] += Math.sin(t * 0.6 + seed[i]) * p.sway * dt;
      arr[k + 2] += Math.cos(t * 0.45 + seed[i]) * p.sway * 0.6 * dt;
      if (arr[k + 1] < 0.2) {
        arr[k + 1] = 24 + Math.random() * 4;
        arr[k] = (Math.random() - 0.5) * 80;
        arr[k + 2] = (Math.random() - 0.5) * 74 - 2;
      }
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
  }
}
