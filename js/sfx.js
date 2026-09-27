/* =========================================================
   sfx.js — Oyun sesleri

   İki kaynak kullanılır:
   1) Gerçek kayıtlar (assets/audio/, Wikimedia Commons, serbest lisans):
      inek sesi, çan, traktör motoru. Lisans bilgileri
      assets/audio/KAYNAKLAR.md dosyasındadır.
   2) Arayüz sesleri (tık, onay, uyarı, kasa) Web Audio API ile
      ANINDA ÜRETİLİR; dosya indirilmez, lisans sorunu olmaz.

   Tarayıcılar, kullanıcı sayfayla etkileşmeden ses çalmaya izin
   vermez; bu yüzden AudioContext ilk tıklamada başlatılır.
   ========================================================= */

const Sfx = {
  ctx: null,
  buffers: {},
  muted: false,
  _tractor: null,
  _ambientTimer: null,

  FILES: {
    moo: "assets/audio/inek_moo.ogg?v=202609271250",
    bell: "assets/audio/canlar.ogg?v=202609271250",
    tractor: "assets/audio/traktor.ogg?v=202609271250"
  },

  init() {
    if (this.ctx) return;
    try {
      this.muted = localStorage.getItem("lvs_muted") === "1";
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(this.ctx.destination);
      Object.keys(this.FILES).forEach(k => this._load(k, this.FILES[k]));
    } catch (e) {
      console.warn("Ses sistemi başlatılamadı:", e);
    }
  },

  async _load(key, url) {
    // Zayıf ağda/yerel sunucuda dosya yarım inebiliyor; 3 kez denenir.
    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch(url, i ? { cache: "reload" } : undefined);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const buf = await res.arrayBuffer();
        this.buffers[key] = await this.ctx.decodeAudioData(buf);
        return;
      } catch (e) {
        if (i === 2) {
          // Ogg desteklemeyen tarayıcıda (ör. eski Safari) sessizce geçilir.
          console.warn("ses yüklenemedi:", key, e.message);
        }
        await new Promise(r => setTimeout(r, 300 * (i + 1)));
      }
    }
  },

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem("lvs_muted", m ? "1" : "0"); } catch (e) {}
    if (this.master) this.master.gain.value = m ? 0 : 0.85;
    if (m) this.tractor(false);
  },

  _ready() {
    if (!this.ctx) this.init();
    if (!this.ctx) return false;
    if (this.ctx.state === "suspended") this.ctx.resume();
    return !this.muted;
  },

  /* ---------------- kayıttan çalanlar ---------------- */
  _play(key, { volume = 1, rate = 1, offset = 0, duration = null } = {}) {
    if (!this._ready() || !this.buffers[key]) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[key];
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.master);
    if (duration) src.start(0, offset, duration); else src.start(0, offset);
    return { src, g };
  },

  /** İnek sesi: her seferinde biraz farklı perdeden (sürü tek sesli olmasın). */
  moo(volume = 0.7) {
    this._play("moo", { volume, rate: 0.82 + Math.random() * 0.36 });
  },

  bell(volume = 0.25) {
    this._play("bell", { volume, offset: 1.2, duration: 2.2, rate: 0.9 + Math.random() * 0.2 });
  },

  /** Traktör motoru: dağıtım turu boyunca döngüde çalar. */
  tractor(on) {
    if (on) {
      if (this._tractor || !this._ready() || !this.buffers.tractor) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers.tractor;
      src.loop = true;
      src.loopStart = 1.0;
      src.loopEnd = Math.min(5.0, src.buffer.duration - 0.1);
      src.playbackRate.value = 0.75;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.28, this.ctx.currentTime + 0.8);
      src.connect(g).connect(this.master);
      src.start(0, 1.0);
      this._tractor = { src, g };
    } else if (this._tractor) {
      const { src, g } = this._tractor;
      this._tractor = null;
      try {
        g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.6);
        src.stop(this.ctx.currentTime + 0.7);
      } catch (e) {}
    }
  },

  /* ---------------- üretilen arayüz sesleri ---------------- */
  _tone(freqs, { dur = 0.12, type = "sine", volume = 0.18, slide = 0 } = {}) {
    if (!this._ready()) return;
    const t0 = this.ctx.currentTime;
    freqs.forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t0 + i * 0.06);
      if (slide) o.frequency.linearRampToValueAtTime(f + slide, t0 + i * 0.06 + dur);
      g.gain.setValueAtTime(0.0001, t0 + i * 0.06);
      g.gain.exponentialRampToValueAtTime(volume, t0 + i * 0.06 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.06 + dur);
      o.connect(g).connect(this.master);
      o.start(t0 + i * 0.06);
      o.stop(t0 + i * 0.06 + dur + 0.05);
    });
  },

  click() { this._tone([520], { dur: 0.07, type: "triangle", volume: 0.10 }); },
  ok() { this._tone([523, 659, 784], { dur: 0.16, type: "sine", volume: 0.16 }); },
  err() { this._tone([220, 165], { dur: 0.22, type: "sawtooth", volume: 0.12 }); },
  cash() { this._tone([880, 1175], { dur: 0.13, type: "triangle", volume: 0.14 }); },
  week() { this._tone([392, 523, 659, 784], { dur: 0.18, type: "sine", volume: 0.15 }); },

  /* ---------------- ortam sesi ---------------- */
  startAmbient() {
    if (this._ambientTimer) return;
    const tick = () => {
      if (!this.muted && document.visibilityState === "visible") {
        if (Math.random() < 0.65) this.moo(0.35 + Math.random() * 0.25);
        else this.bell(0.18);
      }
      this._ambientTimer = setTimeout(tick, 14000 + Math.random() * 22000);
    };
    this._ambientTimer = setTimeout(tick, 6000);
  },

  stopAmbient() {
    if (this._ambientTimer) { clearTimeout(this._ambientTimer); this._ambientTimer = null; }
  }
};

/* İlk kullanıcı etkileşiminde ses sistemini başlat (tarayıcı kuralı) ve
   tüm düğme tıklamalarına ince bir tık sesi ekle. */
document.addEventListener("pointerdown", function firstTouch() {
  Sfx.init();
  document.removeEventListener("pointerdown", firstTouch);
}, { once: true });

document.addEventListener("click", (e) => {
  if (e.target.closest("button")) Sfx.click();
});

/* Klasik script'te `const Sfx` yalnizca global SOZCUKSEL ortama yazilir;
   window uzerinde ozellik OLUSTURMAZ. ui.js ve farm3d.js `window.Sfx` ile
   kontrol ettigi icin bu satir olmadan tum ses cagrilari sessizce atlaniyordu. */
window.Sfx = Sfx;
