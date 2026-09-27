/* =========================================================
   farm3d.js
   İzometrik çiftlik sahnesi (Three.js + Blender'da üretilen GLB'ler).

   BU KATMAN OYUN MANTIĞINI DEĞİŞTİRMEZ.
   Tek yönlü bağımlılık: 3B sahne Game.state'i OKUR.
   Oyun tarafı yalnızca üç haber verir:
     Farm3D.mount(el) / Farm3D.sync() / Farm3D.onFeed(barn) / Farm3D.onWeekEnd()
   ========================================================= */
import * as THREE from "../../vendor/three/three.module.js";
import { GLTFLoader } from "../../vendor/three/GLTFLoader.js";
import { Cow3D, bxz } from "./cow3d.js?v=202609271248";
import { Worker3D } from "./worker3d.js?v=202609271248";
import { Vet3D } from "./vet3d.js?v=202609271248";
import { SeasonManager, seasonForWeek } from "./season.js?v=202609271248";

const ASSET_BASE = "assets/3d/";

/* Oyunun klasik script'leri `const Game = {...}` ile tanimlaniyor. Ust duzey
   `const`, window uzerinde OZELLIK OLUSTURMAZ; yalnizca global sozcuksel
   ortama yazar. Bu yuzden modul icinden `window.Game` degil, dogrudan
   tanimlayici uzerinden erisiyoruz. */
function G() { return (typeof Game !== "undefined") ? Game : null; }
function U() { return (typeof UI !== "undefined") ? UI : null; }

const Farm3D = {
  ready: false,
  loading: false,
  error: null,
  cows: new Map(),
  worker: null,
  layout: null,
  roofsVisible: false,
  _feedUntil: {},
  _stalls: null,          // padok -> durak listesi (rezervasyonlu)       // ahır -> yemin yemlikte kaldığı ana kadar (ms)
  _milkingId: null,

  /* ------------------------------------------------ kurulum */
  async mount(container) {
    this.container = container;
    if (this.error) { this._renderError(container); return; }
    if (!this.ready) {
      if (this.loading) return;
      this.loading = true;
      try {
        await this._load();
      } catch (e) {
        console.error(e);
        this.error = e;
        this.loading = false;
        this._renderError(container);
        return;
      }
      this.loading = false;
    }
    container.appendChild(this.renderer.domElement);
    container.appendChild(this.hud);
    this._resize();
    this.sync();
    this._running = true;
    if (window.Sfx) { Sfx.init(); Sfx.startAmbient(); }
    this._tick();
  },

  unmount() {
    this._running = false;
    if (window.Sfx) { Sfx.tractor(false); Sfx.stopAmbient(); }
    if (this.renderer && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    if (this.hud && this.hud.parentNode) this.hud.parentNode.removeChild(this.hud);
  },

  _renderError(container) {
    const u = U();
    if (u && u._farm3dUnavailableHTML) { container.innerHTML = u._farm3dUnavailableHTML(); return; }
    const local = location.protocol === "file:";
    container.innerHTML = `
      <div class="panel" style="text-align:center;">
        <h3>3B çiftlik görünümü açılamadı</h3>
        ${local
          ? `<p class="helper-text">Sayfa <b>dosya olarak</b> açılmış (file://). Tarayıcılar güvenlik gereği
             bu modda 3B model dosyalarının yüklenmesine izin vermez.<br>
             Oyunu GitHub Pages adresinden veya yerel bir sunucudan açın
             (örn. klasörde <code>python -m http.server</code>).</p>`
          : `<p class="helper-text">Model dosyaları yüklenemedi: ${this.error && this.error.message}</p>`}
        <p class="helper-text">Oyunun diğer tüm sekmeleri normal çalışmaya devam eder.</p>
      </div>`;
  },

  async _load() {
    // --- yerleşim koordinatları (Blender scripti ile aynı kaynaktan)
    const res = await fetch(ASSET_BASE + "farm_layout.json?v=202609271250");
    if (!res.ok) throw new Error("farm_layout.json okunamadı (" + res.status + ")");
    this.layout = await res.json();

    // --- sahne
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa8c4dd);
    scene.fog = new THREE.Fog(0xa8c4dd, 120, 260);
    this.scene = scene;

    const hemi = new THREE.HemisphereLight(0xcfe3f5, 0x6b6a52, 1.15);
    scene.add(hemi);
    this.hemi = hemi;
    const sun = new THREE.DirectionalLight(0xfff3dd, 1.75);
    sun.position.set(38, 52, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 180;
    sun.shadow.bias = -0.0009;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;

    // --- izometrik ortografik kamera
    this.camAngle = 0;                 // 0..3 arası 90° dönüş
    // Cerceveleme: yerlesim x -34..34, y -26..32 araliginda; tum cirtligi kapsar.
    this.camZoom = 33;                 // görüş yarı-yüksekliği (m) - SABIT
    this.camCenter = new THREE.Vector3(-1, 0, -3);
    this.camera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.5, 400);
    this._placeCamera();

    // --- renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "farm3d-canvas";
    this.renderer = renderer;

    // --- modeller
    const loader = new GLTFLoader();
    // Model dosyalari bazen yarim inebiliyor (zayif ag, yerel sunucu aksakligi).
    // Bu yuzden her dosya en fazla 3 kez denenir; ayrica dosyalar SIRAYLA
    // indirilir - tek is parcacikli yerel sunucularda es zamanli istekler
    // baglantinin kopmasina yol acabiliyor.
    const loadOnce = (f) => new Promise((ok, no) =>
      loader.load(ASSET_BASE + f + "?v=202609271250", g => ok(g.scene), undefined,
        e => no(new Error(f + " yüklenemedi"))));
    const load = async (f) => {
      let last;
      for (let i = 0; i < 3; i++) {
        try { return await loadOnce(f); }
        catch (e) { last = e; await new Promise(r => setTimeout(r, 250 * (i + 1))); }
      }
      throw last;
    };
    const farm = await load("farm.glb");
    const cow = await load("cow.glb");
    const worker = await load("worker.glb");
    const machines = await load("machines.glb");

    farm.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) o.material.side = THREE.DoubleSide;
      }
      if (o.name && o.name.startsWith("Roofs")) this.roofs = o;
    });
    scene.add(farm);
    if (this.roofs) this.roofs.visible = this.roofsVisible;

    // mevsim katmani: cim/agac/gokyuzu/isik renkleri + yaprak-kar-polen
    this.season = new SeasonManager(scene, farm, this.sun, this.hemi);

    this.cowProto = cow.getObjectByName("Cow") || cow;
    this.workerProto = worker.getObjectByName("Worker") || worker;
    this.vetProto = worker.getObjectByName("Vet");
    // DIKKAT: worker.glb icinde IKI kok var (Worker ve Vet). Isciye tum sahneyi
    // vermek, teknikerin ikinci bir kopyasinin isciyle birlikte dolasmasina ve
    // ayni adli pivotlarin (Hips, Arm_L...) birbirine karismasina yol aciyordu.
    // Bu yuzden her karaktere YALNIZCA kendi kok nesnesi veriliyor.
    this.worker = new Worker3D(this.workerProto, machines, this.layout, scene);
    this.worker.onCowMilked = (id) => { this._milkingId = id; };
    // veteriner saglik teknikeri: bakim / muayene / takip
    if (this.vetProto) {
      this.vet = new Vet3D(this.vetProto, this.layout, scene);
      this.vet.onExamine = (id) => { this._examId = id; };
    }
    // Calisanlar izometrik uzaklikta ineklerin arasinda kayboluyordu:
    // biraz buyutuldu ve baslarina kim olduklarini gosteren isaret konuldu.
    this.worker.root.scale.setScalar(1.14);
    this._staffPin(this.worker.root, "🧑‍🌾", 0x2f6b3a);
    if (this.vet) {
      this.vet.root.scale.setScalar(1.14);
      this._staffPin(this.vet.root, "🩺", 0x2a5d8f);
    }

    // --- etkileşim
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._bindInput(renderer.domElement);
    this._buildHud();
    this.clock = new THREE.Clock();
    this.ready = true;
    window.addEventListener("resize", () => this._resize());
  },

  /* Dort ana yon gorunumu. Kamera 45 derecelik izometrik acida sabittir;
     ogrenci yalnizca ok tuslari / oklarla ciftligi dondurur. */
  VIEW_NAMES: ["GÜNEY", "BATI", "KUZEY", "DOĞU"],

  /* Yakinlastirma: 10 m (tek hayvan) ile 42 m (tum ciftlik) arasi.
     Kamera acisi ve merkezi sabit kalir; yalnizca gorus alani degisir. */
  ZOOM_MIN: 10,
  ZOOM_MAX: 42,

  zoom(dir) {
    this.camZoom = Math.max(this.ZOOM_MIN, Math.min(this.ZOOM_MAX, this.camZoom + dir * 3.5));
    this._resize();
  },

  rotate(dir) {
    this.camAngle = (this.camAngle + dir + 4) % 4;
    this._placeCamera();
    const el = document.getElementById("farm3dCompass");
    if (el) el.textContent = this.VIEW_NAMES[this.camAngle];
  },

  _placeCamera() {
    // gerçek izometrik: 45° azimut, 35.264° yükseklik
    const elev = Math.atan(1 / Math.SQRT2);
    const azi = Math.PI / 4 + this.camAngle * Math.PI / 2;
    const d = 160;
    this.camera.position.set(
      this.camCenter.x + d * Math.cos(elev) * Math.cos(azi),
      d * Math.sin(elev),
      this.camCenter.z + d * Math.cos(elev) * Math.sin(azi)
    );
    this.camera.lookAt(this.camCenter);
  },

  _resize() {
    if (!this.renderer || !this.container) return;
    const w = this.container.clientWidth || 900;
    const h = Math.max(420, Math.round(Math.min(680, w * 0.58)));
    this.renderer.setSize(w, h);
    const aspect = w / h;
    const c = this.camera;
    c.top = this.camZoom; c.bottom = -this.camZoom;
    c.left = -this.camZoom * aspect; c.right = this.camZoom * aspect;
    c.updateProjectionMatrix();
  },

  /* ------------------------------------------------ HUD + girdi */
  _buildHud() {
    const el = document.createElement("div");
    el.className = "farm3d-hud";
    el.innerHTML = `
      <div class="farm3d-tools">
        <button class="btn-ghost btn-sm" data-act="rot-l" title="Sola döndür (← ok tuşu)">◀</button>
        <span class="compass" id="farm3dCompass">GÜNEY</span>
        <button class="btn-ghost btn-sm" data-act="rot-r" title="Sağa döndür (→ ok tuşu)">▶</button>
        <button class="btn-ghost btn-sm" data-act="zoom-in" title="Yakınlaştır (+ tuşu veya fare tekerleği)">＋</button>
        <button class="btn-ghost btn-sm" data-act="zoom-out" title="Uzaklaştır (− tuşu veya fare tekerleği)">－</button>
        <button class="btn-ghost btn-sm" data-act="roof" title="Çatıları göster/gizle">Çatı</button>
        <span class="season" id="farm3dSeason">☀️ YAZ</span>
      </div>
      <div class="farm3d-tip">Hayvana veya binaya tıkla · ← → döndür · ↑ ↓ veya tekerlek ile yakınlaş</div>
    `;
    el.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === "rot-l") this.rotate(-1);
      if (act === "rot-r") this.rotate(+1);
      if (act === "zoom-in") this.zoom(-1);
      if (act === "zoom-out") this.zoom(+1);
      if (act === "roof") {
        this.roofsVisible = !this.roofsVisible;
        if (this.roofs) this.roofs.visible = this.roofsVisible;
        btn.classList.toggle("on", this.roofsVisible);
      }
    });
    this.hud = el;

    const tip = document.createElement("div");
    tip.className = "farm3d-tooltip hidden";
    el.appendChild(tip);
    this.tooltip = tip;
  },

  _bindInput(dom) {
    // Kamera SABIT: kaydirma ve tekerlek yakinlastirma yok. Ogrenci yalnizca
    // dort ana yon arasinda dondurur; boylece kimse haritada kaybolmaz.
    let downXY = null;
    dom.addEventListener("pointerdown", e => { downXY = [e.clientX, e.clientY]; });
    dom.addEventListener("pointerup", e => {
      if (!downXY) return;
      const moved = Math.abs(e.clientX - downXY[0]) + Math.abs(e.clientY - downXY[1]);
      downXY = null;
      if (moved < 6) this._pick(e);
    });
    dom.addEventListener("pointermove", e => {
      const r = dom.getBoundingClientRect();
      this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      this._hoverXY = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    // fare tekerlegi ile yakinlastirma
    dom.addEventListener("wheel", e => {
      e.preventDefault();
      this.zoom(Math.sign(e.deltaY));
    }, { passive: false });
    // ok tuslariyla dondurme
    if (!this._keyBound) {
      this._keyBound = true;
      window.addEventListener("keydown", e => {
        if (!this._running) return;
        const t = e.target;
        if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
        if (e.key === "ArrowLeft") { this.rotate(-1); e.preventDefault(); }
        if (e.key === "ArrowRight") { this.rotate(+1); e.preventDefault(); }
        if (e.key === "+" || e.key === "=" || e.key === "ArrowUp") { this.zoom(-1); e.preventDefault(); }
        if (e.key === "-" || e.key === "_" || e.key === "ArrowDown") { this.zoom(+1); e.preventDefault(); }
      });
    }
  },

  /* Sahnedeki bina -> açılacak menü. Öğrenci çiftlikte "yürüyerek" menüye ulaşır. */
  BUILDING_PANELS: {
    FeedStore: "ration",
    OfficeAndTank: "ledger",
    LactationBarn: "barns",
    DryBarn: "barns",
    Clinic: "barns"
  },

  _pick(e) {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    for (const h of hits) {
      // 1) önce hayvan: mevcut muayene/tohumlama modalını açar
      let o = h.object;
      while (o) {
        if (o.userData && o.userData.cowId) {
          const u = U();
          if (window.Sfx) Sfx.moo(0.5);
          if (u && u.openAnimalModal) u.openAnimalModal(o.userData.cowId);
          return;
        }
        o = o.parent;
      }
      // 2) bina: ilgili menüyü sahnenin üzerinde açar
      o = h.object;
      while (o) {
        const base = (o.name || "").replace(/[._]\d+$/, "");
        const panel = this.BUILDING_PANELS[base];
        if (panel) {
          const u = U();
          if (u && u.openFarmPanel) u.openFarmPanel(panel);
          return;
        }
        o = o.parent;
      }
    }
  },

  /* ------------------------------------------------ oyun durumu -> sahne */
  _penFor(barn) {
    const p = this.layout.pens;
    return barn === "start" ? p.start : barn === "end" ? p.end : p.dry;
  },

  sync() {
    const g = G();
    if (!this.ready || !g || !g.state) return;
    if (this.season) {
      const s2 = this.season.applyWeek(g.state.week, (typeof CONFIG !== "undefined" ? CONFIG.TOTAL_WEEKS : 56));
      if (s2 && this._seasonKey !== s2.key) {
        this._seasonKey = s2.key;
        const el = document.getElementById("farm3dSeason");
        if (el) el.textContent = s2.icon + " " + s2.name;
      }
    }
    const animals = g.state.animals;
    const seen = new Set();
    animals.forEach((a, idx) => {
      seen.add(a.id);
      let c = this.cows.get(a.id);
      if (!c) {
        c = new Cow3D(this.cowProto, a, this._penFor(a.barn));
        this.scene.add(c.root);
        this.cows.set(a.id, c);
      }
      c.setPen(this._penFor(a.barn));
      c.slot = idx;
      c.applyCondition(a);
      c.syncState(a, this._ctx());
      // VKS belirgin degistiyse kartlardaki vesikalik yenilensin
      const vksKey = Math.round((a.vks || 3) * 2) + (a.alive ? "" : "X");
      if (this._portraits && c._vksKey !== undefined && c._vksKey !== vksKey) {
        delete this._portraits[a.id];
      }
      c._vksKey = vksKey;
      this._updateBadge(c, a);
    });
    for (const [id, c] of this.cows) {
      if (!seen.has(id)) { this.scene.remove(c.root); this.cows.delete(id); }
    }
    // Not: hayvanlar TÜM hafta yemlikte durmaz. Yem dağıtıldıktan sonra bir süre
    // yemlikte kalır (bkz. _feedUntil), sonra padoğa dağılır; kızgın olanlar
    // kümelenmeye başlar. Bu yüzden burada fedThisWeek'e bakılmaz.
  },

  /** Hayvanın üstündeki işaret.
   *  EĞİTİM KURALI: durumu ELE VEREN işaret yalnızca GEBE hayvanda görünür
   *  (gebelik zaten muayeneyle doğrulanmış bilgidir). Kızgın ya da hasta
   *  hayvanda yalnızca SORU İŞARETİ çıkar; öğrenci neyi olduğunu anlamak için
   *  hayvanı muayene etmek zorundadır. */
  _updateBadge(cow, a) {
    let icon = null, kind = null;
    if (a.alive) {
      if (a.reproStatus === "gebe") { icon = "🤰"; kind = "gebe"; }
      else if (a.diseases && a.diseases.length) { icon = "?"; kind = "soru"; }
      else if (a.inHeat || a.falseHeat) { icon = "?"; kind = "soru"; }
    }
    if (!icon) {
      if (cow.badge) cow.badge.visible = false;
      return;
    }
    if (!cow.badge) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 128;
      cow._badgeCv = cv;
      const tex = new THREE.CanvasTexture(cv);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      spr.scale.set(1.25, 1.25, 1);
      spr.position.set(0, 2.6, 0);
      spr.renderOrder = 10;
      cow.root.add(spr);
      cow.badge = spr;
    }
    if (cow._badgeIcon !== icon) {
      const cx = cow._badgeCv.getContext("2d");
      cx.clearRect(0, 0, 128, 128);
      if (kind === "soru") {
        // dikkat cekici baloncuk icinde soru isareti
        cx.beginPath();
        cx.arc(64, 60, 40, 0, Math.PI * 2);
        cx.fillStyle = "rgba(224,169,59,0.95)";
        cx.fill();
        cx.lineWidth = 6;
        cx.strokeStyle = "rgba(74,54,16,0.9)";
        cx.stroke();
        cx.fillStyle = "#4A3610";
        cx.font = "bold 62px Fredoka, system-ui, sans-serif";
        cx.textAlign = "center";
        cx.textBaseline = "middle";
        cx.fillText("?", 64, 64);
      } else {
        cx.font = "76px system-ui, 'Segoe UI Emoji'";
        cx.textAlign = "center";
        cx.textBaseline = "middle";
        cx.fillText(icon, 64, 68);
      }
      cow.badge.material.map.needsUpdate = true;
      cow._badgeIcon = icon;
    }
    cow.badge.visible = true;
  },

  /** Hayvan kartındaki (künye) vesikalık: ineğin 3B sahnedeki GÖRÜNÜMÜNÜN
   *  kendisi küçük bir sahnede ayrıca render edilir. Böylece karttaki resim ile
   *  ahırda gezen hayvan birebir aynı desene/renge sahip olur.
   *  Sonuç dataURL olarak önbelleğe alınır; hayvan başına bir kez üretilir. */
  getPortrait(id) {
    if (!this.ready) return null;
    this._portraits = this._portraits || {};
    if (this._portraits[id] !== undefined) return this._portraits[id];
    const g = G();
    const a = g && g.state && g.state.animals.find(x => x.id === id);
    if (!a) return null;
    try {
      if (!this._pRenderer) {
        const S = 192;
        this._pRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        this._pRenderer.setSize(S, S);
        this._pRenderer.outputColorSpace = THREE.SRGBColorSpace;
        this._pScene = new THREE.Scene();
        this._pScene.add(new THREE.HemisphereLight(0xdfeefc, 0x7a7358, 1.5));
        const dl = new THREE.DirectionalLight(0xfff4e2, 1.5);
        dl.position.set(3, 5, 4);
        this._pScene.add(dl);
        this._pCam = new THREE.OrthographicCamera(-1.75, 1.75, 1.35, -1.35, 0.1, 50);
        this._pCam.position.set(3.2, 2.3, 3.6);
        this._pCam.lookAt(0, 1.05, 0);
      }
      const cow = new Cow3D(this.cowProto, a, this._penFor(a.barn));
      cow.applyCondition(a);
      cow.pos.set(0, 0, 0);
      // 3/4 onden gorunum. Aci deneysel olarak secildi: bu degerde bas kameraya
      // en yakin (1.67 m fark) ve kadrajin hafif solunda kalir.
      cow.heading = 5.1;
      cow.speed = 0;
      cow._applyPose(0);
      cow.root.position.set(0, 0, 0);
      this._pScene.add(cow.root);
      this._pRenderer.render(this._pScene, this._pCam);
      const url = this._pRenderer.domElement.toDataURL("image/png");
      this._pScene.remove(cow.root);
      cow.root.traverse(o => {
        if (o.isMesh) { o.geometry.dispose && o.geometry.dispose(); o.material.dispose && o.material.dispose(); }
      });
      this._portraits[id] = url;
      return url;
    } catch (e) {
      console.warn("vesikalık üretilemedi", e);
      this._portraits[id] = null;
      return null;
    }
  },

  /* Davranış bağlamı: inek sınıfı buradan padok/yemlik/küme bilgisi alır. */
  _ctx() {
    const L = this.layout;
    const self = this;
    const now = performance.now();
    const feeding = {};
    for (const k of ["start", "end", "dry"]) feeding[k] = (this._feedUntil[k] || 0) > now;
    const g = G();
    const pending = (g && g.state && g.state.pendingCalvings) || [];
    const calvingIds = new Set(pending);
    return {
      feedingBarns: feeding,
      milkingId: this._milkingId,
      calvingIds,
      calvingSpot(id) {
        const i = pending.indexOf(id);
        const a = i <= 0 ? L.anchors.clinicPen1 : L.anchors.clinicPen2;
        return new THREE.Vector3(a[0], 0, -a[1]);
      },
      feedSlot(barn, i) {
        const h = L.headlocks[barn === "dry" ? "dry" : barn];
        if (!h) return null;
        const n = 18;
        const t = (i % n) / (n - 1);
        if (h.axis === "y") {
          // Yem yolunun iki yanindaki dikey kafa kilidi hatti
          const y = h.from + 0.9 + t * ((h.to - h.from) - 1.8);
          const x = h.x + h.face * 1.5;
          return { pos: new THREE.Vector3(x, 0, -y), heading: h.face > 0 ? Math.PI : 0 };
        }
        const x = h.from + 0.9 + t * ((h.to - h.from) - 1.8);
        const y = h.y + h.face * 1.5;
        return { pos: new THREE.Vector3(x, 0, -y), heading: h.face > 0 ? -Math.PI / 2 : Math.PI / 2 };
      },
      /* ---- DURAKLAR ----
         Gercek bir ahirda inekler gunun buyuk bolumunu duraklarda YATARAK
         gecirir. Asagidaki iki fonksiyon, bos bir durak "kiralayip" hayvan
         kalkinca geri birakmayi saglar; boylece iki inek ayni duraga girmez. */
      stallFor(cowId, barn) {
        if (!self._stalls) self._buildStalls();
        const list = self._stalls[barn];
        if (!list || !list.length) {
          // Kuru ahirda durak yok: altlikli zeminde rastgele bir yere yatar
          const p = self._penFor(barn);
          return {
            pos: new THREE.Vector3(
              p.x0 + 1.5 + Math.random() * Math.max(0.5, (p.x1 - p.x0) - 3),
              0,
              -(p.y0 + 1.5 + Math.random() * Math.max(0.5, (p.y1 - p.y0) - 3))),
            heading: Math.random() * Math.PI * 2,
            index: -1
          };
        }
        const free = list.filter(st => !st.by || st.by === cowId);
        if (!free.length) return null;
        const st = free[Math.floor(Math.random() * free.length)];
        st.by = cowId;
        return { pos: st.pos.clone(), heading: st.heading, index: st.i };
      },
      releaseStall(cowId, barn) {
        if (!self._stalls) return;
        const list = self._stalls[barn];
        if (!list) return;
        list.forEach(st => { if (st.by === cowId) st.by = null; });
      },
      heatCluster(barn) {
        const p = self._penFor(barn);
        return new THREE.Vector3((p.x0 + p.x1) / 2, 0, -((p.y0 + p.y1) / 2));
      },
      /** Atlama (mounting) eslesmesi: kizgin hayvanlardan biri digerinin
       *  sagrisina atlar. Ciftler birkac saniyede bir yenilenir. */
      mountInfo(id) {
        const o = self._mountOrder && self._mountOrder[id];
        if (!o || performance.now() > o.until) return null;
        const t = self.cows.get(o.targetId);
        if (!t) return null;
        return { pos: t.pos, heading: t.heading, targetId: o.targetId };
      },
      isMountedBy(id) {
        const m = self._mountOrder || {};
        for (const k of Object.keys(m)) {
          if (m[k].targetId === id && performance.now() <= m[k].until) return true;
        }
        return false;
      },
      milkableCows() {
        const out = [];
        for (const [id, c] of self.cows) {
          const a = c.animal;
          if (a && a.alive && a.isLactating && a.barn !== "dry") {
            out.push({ id, x: c.pos.x, z: c.pos.z });
          }
        }
        return out;
      },
      sickCows() {
        const out = [];
        for (const [id, c] of self.cows) {
          const a = c.animal;
          if (a && a.alive && a.diseases && a.diseases.length) out.push({ id, x: c.pos.x, z: c.pos.z });
        }
        return out;
      },
      calvingList() {
        const g2 = G();
        return (g2 && g2.state && g2.state.pendingCalvings) || [];
      },
      herdWatchPoints() {
        const pts = [];
        for (const k of ["start", "end", "dry"]) {
          const p = L.pens[k];
          if (!p) continue;
          pts.push(new THREE.Vector3(p.x0 + 2.5, 0, -(p.y0 + 3)));
          pts.push(new THREE.Vector3(p.x1 - 2.5, 0, -(p.y1 - 3)));
        }
        return pts;
      },
      heatWatchPoints() {
        const pts = [];
        for (const [id, c] of self.cows) {
          const a = c.animal;
          if (a && a.alive && (a.inHeat || a.falseHeat)) {
            pts.push(new THREE.Vector3(c.pos.x + 1.6, 0, c.pos.z + 1.6));
          }
        }
        if (!pts.length) {
          const p = self.layout.pens.start;
          pts.push(new THREE.Vector3(p.x0 + 4, 0, -(p.y0 + 1)), new THREE.Vector3(p.x1 - 4, 0, -(p.y0 + 1)));
        }
        return pts.slice(0, 6);
      }
    };
  },

  /** Kızgın hayvanlar arasında atlama (mounting) eşleşmelerini günceller.
   *  Gerçek sürüde kızgın inekler birbirine atlar; öğrencinin kızgınlığı
   *  uzaktan fark etmesini sağlayan en güçlü davranışsal işarettir. */
  _updateMounting(dt) {
    this._mountT = (this._mountT || 0) - dt;
    if (this._mountT > 0) return;
    this._mountT = 5 + Math.random() * 4;
    const order = {};
    const byBarn = {};
    for (const [id, c] of this.cows) {
      const a = c.animal;
      if (!a || !a.alive || !(a.inHeat || a.falseHeat)) continue;
      (byBarn[a.barn] = byBarn[a.barn] || []).push(c);
    }
    for (const barn of Object.keys(byBarn)) {
      const list = byBarn[barn];
      if (list.length < 2) continue;
      // rastgele bir cift: biri atlar, digeri durur (stand-by refleksi)
      const i = Math.floor(Math.random() * list.length);
      let j = Math.floor(Math.random() * list.length);
      if (j === i) j = (j + 1) % list.length;
      order[list[i].id] = { targetId: list[j].id, until: performance.now() + 3200 };
    }
    this._mountOrder = order;
  },

  /** Calisanin basinin uzerindeki kucuk tanitim isareti (hayvan rozetiyle
   *  karistirilmasin diye renkli damla bicimli, sabit). */
  _staffPin(root, emoji, color) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 96;
    const c = cv.getContext("2d");
    c.beginPath();
    c.arc(48, 40, 30, 0, Math.PI * 2);
    c.fillStyle = "#" + color.toString(16).padStart(6, "0");
    c.globalAlpha = 0.92;
    c.fill();
    c.globalAlpha = 1;
    c.lineWidth = 5;
    c.strokeStyle = "rgba(255,255,255,0.9)";
    c.stroke();
    c.font = "30px system-ui, 'Segoe UI Emoji'";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(emoji, 48, 42);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true
    }));
    spr.scale.set(1.15, 1.15, 1);
    spr.position.set(0, 2.5, 0);
    spr.renderOrder = 12;
    root.add(spr);
  },

  /** Yerlesim dosyasindaki durak siralarindan tek tek durak noktalari uretir.
   *  Her durak 1,22 m araliklidir; hayvan durakta bas ucuna doner. */
  _buildStalls() {
    this._stalls = { start: [], end: [], dry: [] };
    const S = this.layout.stalls || {};
    ["start", "end"].forEach(barn => {
      const rows = S[barn] || [];
      rows.forEach((row, ri) => {
        const n = Math.floor((row.y1 - row.y0) / 1.22);
        for (let i = 0; i < n; i++) {
          const y = row.y0 + 0.9 + i * 1.22;
          // gecis araligini (15-17 m) bos birak
          if (y > 14.8 && y < 17.2) continue;
          const x = row.xEntry + row.face * (row.depth * 0.5);
          this._stalls[barn].push({
            i: ri * 100 + i,
            pos: new THREE.Vector3(x, 0, -y),
            // hayvan durakta bas ucuna bakar (+x ya da -x)
            heading: row.face > 0 ? 0 : Math.PI,
            by: null
          });
        }
      });
    });
  },

  /* ------------------------------------------------ oyun olayları */
  onFeed(barnKey) {
    if (!this.ready) return;
    // yem dağıtımı + yemlikte kalma süresi (traktör turu ~35 sn, yeme ~75 sn)
    this._feedUntil[barnKey] = performance.now() + 110000;
    this.worker.requestFeeding(barnKey);
  },

  onWeekEnd() {
    if (!this.ready) return;
    this.worker.clearFeed();
    this._feedUntil = {};
    this.worker.requestWeeklyRound();
    this.sync();
  },

  /* ------------------------------------------------ döngü */
  _tick() {
    if (!this._running) return;
    requestAnimationFrame(() => this._tick());
    const dt = Math.min(0.05, this.clock.getDelta());
    this._autoQuality(dt);
    this._updateMounting(dt);
    if (this.season) this.season.update(dt, this.clock.elapsedTime);
    const ctx = this._ctx();
    for (const [, c] of this.cows) c.update(dt, ctx);
    this.worker.update(dt, ctx);
    if (this.vet) this.vet.update(dt, ctx);
    // traktor motoru yalnizca surerken duyulur
    if (window.Sfx) {
      const driving = this.worker.tractorSpeed > 0.1;
      if (driving !== this._engineOn) { this._engineOn = driving; Sfx.tractor(driving); }
    }
    this._hover();
    this.renderer.render(this.scene, this.camera);
  },

  /** Zayıf bilgisayarlarda akıcılığı korumak için kaliteyi kademeli düşürür.
   *  (Okul laboratuvarlarındaki tümleşik ekran kartları düşünülerek eklendi.) */
  _autoQuality(dt) {
    this._frameAcc = (this._frameAcc || 0) + dt;
    this._frameNum = (this._frameNum || 0) + 1;
    if (this._frameAcc < 2.5) return;
    const avg = this._frameAcc / this._frameNum;
    this._frameAcc = 0; this._frameNum = 0;
    this._qLevel = this._qLevel || 0;
    if (avg > 0.040 && this._qLevel < 2) {          // < 25 FPS
      this._qLevel++;
      if (this._qLevel === 1) {
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        this.scene.traverse(o => { if (o.isDirectionalLight) o.shadow.mapSize.set(1024, 1024); });
      } else {
        this.renderer.shadowMap.enabled = false;    // son çare: gölgeleri kapat
      }
      this.renderer.shadowMap.needsUpdate = true;
    }
  },

  _hover() {
    if (!this._hoverXY) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    let id = null;
    for (const h of hits) {
      let o = h.object;
      while (o) { if (o.userData && o.userData.cowId) { id = o.userData.cowId; break; } o = o.parent; }
      if (id) break;
    }
    if (!id) {
      this.tooltip.classList.add("hidden");
      // bina üzerindeyse de tıklanabilir olduğunu göster
      let over = null;
      for (const h of hits) {
        let o = h.object;
        while (o) {
          const base = (o.name || "").replace(/[._]\d+$/, "");
          if (this.BUILDING_PANELS[base]) { over = base; break; }
          o = o.parent;
        }
        if (over) break;
      }
      this.renderer.domElement.style.cursor = over ? "pointer" : "grab";
      return;
    }
    const g = G();
    if (!g || !g.state) return;
    const a = g.state.animals.find(x => x.id === id);
    if (!a) return;
    this.renderer.domElement.style.cursor = "pointer";
    this.tooltip.classList.remove("hidden");
    this.tooltip.style.left = (this._hoverXY.x + 14) + "px";
    this.tooltip.style.top = (this._hoverXY.y + 14) + "px";
    const durum = !a.alive ? "Öldü"
      : (a.diseases && a.diseases.length ? "Hasta" : (a.inHeat || a.falseHeat ? "Hareketli / Huzursuz" : "Sakin"));
    this.tooltip.innerHTML = `<b>${a.id}</b><br>${durum}<br>VKS ${a.vks} · ${a.isLactating && a.barn !== "dry" ? a.dailyMilk.toFixed(1) + " L/gün" : "kuruda"}`;
  }
};

window.Farm3D = Farm3D;
export default Farm3D;
