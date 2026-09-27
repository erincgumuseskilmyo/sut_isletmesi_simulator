/* =========================================================
   worker3d.js
   İşçi + traktör + yem karma makinesi + mobil sağım ünitesi.

   İşçi, tur (hafta) boyunca çiftlikte sırayla iş yapar:
     yem hazırla -> traktörle yem dağıt -> mobil üniteyle sağ ->
     sütü tanka boşalt -> kızgınlık gözlemi -> gezinti
   Öğrenci "HAYVANLARI BESLE" veya "HAFTAYI KAPAT" dediğinde ilgili
   iş sıranın başına alınır; böylece animasyon oyunun gerçek
   olaylarını anlatır. Oyun mantığına müdahale etmez, sadece okur.
   ========================================================= */
import * as THREE from "../../vendor/three/three.module.js";

const WALK = 2.15;      // m/s (oyun temposu icin gercegin biraz ustunde)
const DRIVE = 4.6;      // m/s

export class Worker3D {
  constructor(workerProto, machinesProto, layout, scene) {
    this.L = layout;
    this.scene = scene;

    this.root = workerProto.clone(true);
    this.root.name = "Worker";
    this.root.position.set(0, 0, 0);
    this.parts = {};
    this.root.traverse(o => {
      // Blender ayni .blend icinde ayni adli iki nesneye izin vermedigi icin
      // veteriner modelinin parcalari "Leg_L.001" ekini alir; glTF disa
      // aktariminda nokta dusup "Leg_L001" olur. Sondaki 3 haneli eki atarak
      // iki karakterde de ayni parca adlarini kullaniyoruz.
      if (o.name) this.parts[o.name.replace(/\.?\d{3}$/, "")] = o;
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    ["Prop_Bucket", "Prop_Clipboard", "Prop_Fork"].forEach(n => {
      if (this.parts[n]) this.parts[n].visible = false;
    });
    scene.add(this.root);

    // makineler: machines.glb içindeki üç kökü ayır
    this.tractor = machinesProto.getObjectByName("Tractor").clone(true);
    this.mixer = machinesProto.getObjectByName("Mixer").clone(true);
    this.trolley = machinesProto.getObjectByName("MilkTrolley").clone(true);
    [this.tractor, this.mixer, this.trolley].forEach(o => {
      o.position.set(0, 0, 0);
      o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
      scene.add(o);
    });
    this.wheels = [];
    [this.tractor, this.mixer].forEach(m => m.traverse(o => {
      if (o.name && /Wheel/.test(o.name) && o.type === "Object3D") this.wheels.push(o);
    }));

    const A = layout.anchors;
    this.pos = new THREE.Vector3(A.tractorPark[0] + 3, 0, -A.tractorPark[1]);
    this.heading = 0;
    this.speed = 0;
    this.phase = 0;
    this.crouch = 0;
    this.carry = null;

    this.tractorPos = new THREE.Vector3(A.tractorPark[0], 0, -A.tractorPark[1]);
    this.tractorHeading = 0;
    this.tractorSpeed = 0;
    this.inCab = false;
    this.trolleyWith = false;

    this.hitched = false;                    // romork traktore bagli mi
    this.chute = 0;                          // bosaltma agzi acikligi (0-1)
    this.augerSpin = 0;
    this.tractor.position.copy(this.tractorPos);
    const mp = A.mixerPark || A.tractorPark;
    this.mixerPark = new THREE.Vector3(mp[0], 0, -mp[1]);
    this.mixer.position.copy(this.mixerPark);
    this.trolley.position.set(A.officeDoor[0] + 2, 0, -A.officeDoor[1]);

    this.queue = [];
    this.task = null;
    this.waypoints = [];
    this.timer = 0;
    this.status = "Hazır";
    this.feedPiles = [];
    this.onCowMilked = null;

    // Isci yem hazirlarken elinde tasidigi balya (JS tarafinda uretilir,
    // ayri bir model dosyasi gerekmez).
    const baleGeo = new THREE.BoxGeometry(0.95, 0.72, 0.78);
    const baleMat = new THREE.MeshLambertMaterial({ color: 0xc9a83f });
    this.carryBale = new THREE.Mesh(baleGeo, baleMat);
    this.carryBale.castShadow = true;
    this.carryBale.visible = false;
    scene.add(this.carryBale);

  }

  /* ---------------------------------------------------- yol bulma */
  _roadPoint(x) { return new THREE.Vector3(x, 0, -this.L.roadY); }

  /** Her yer dis servis yoluna baglidir; hedefe yol uzerinden gidilir. */
  _route(to) {
    const L = this.L;
    const A = L.alley;
    const tgt = this._accessPoint(to);
    const wps = [];
    const y = -tgt.z;
    const inAlley = tgt.x > A.x0 - 1 && tgt.x < A.x1 + 1 && y > L.barn.y0 && y < L.barn.y1;
    const nearRoad = Math.abs(-this.pos.z - L.roadY) < 2.6;
    if (!nearRoad) wps.push(this._roadPoint(this.pos.x));
    if (inAlley) {
      // ahira guneydeki yem yolu agzindan girilir
      const ax = (A.x0 + A.x1) / 2;
      wps.push(this._roadPoint(ax));
      wps.push(new THREE.Vector3(ax, 0, -(L.barn.y0 - 1.5)));
    } else {
      wps.push(this._roadPoint(tgt.x));
    }
    wps.push(tgt);
    return wps;
  }

  goTo(v3, direct = false) {
    // direct=true olsa bile padok icine girilmez, erisim noktasina gidilir
    this.waypoints = direct ? [this._accessPoint(v3)] : this._route(v3);
  }

  /* ---------------------------------------------------------------
     ERISIM NOKTASI (duvardan gecmeyi onler)
     Calisanlar padoklarin ICINE girmez: laktasyon ahirinda ortadaki
     servis/yem yolundan, kuru ahirda ise yemlik onundeki koridordan
     hayvana ulasirlar. Bu hem gercekci hem de karakterin duvarlarin
     icinden gecmesini engelliyor.
     --------------------------------------------------------------- */
  _accessPoint(v) {
    const L = this.L;
    const y = -v.z;
    const B = L.barn, A = L.alley, D = L.dryBarn;
    if (v.x > B.x0 && v.x < B.x1 && y > B.y0 && y < B.y1) {
      const ax = (A.x0 + A.x1) / 2;
      const cy = Math.min(Math.max(y, B.y0 + 2.0), B.y1 - 2.0);
      return new THREE.Vector3(ax, 0, -cy);
    }
    if (D && v.x > D.x0 && v.x < D.x1 && y > D.y0 && y < D.y1) {
      const cx = Math.min(Math.max(v.x, D.x0 + 2.0), D.x1 - 2.0);
      return new THREE.Vector3(cx, 0, -(D.y1 + 1.8));
    }
    return v.clone();
  }


  /** Yem deposundaki alim noktalari: saman gozu, yonca gozu, tahil gozu. */
  _feedPickSpots() {
    const S = this.L.store;
    const y = S.y0 + 3.2;
    const w = (S.x1 - S.x0) / 3;
    return [
      new THREE.Vector3(S.x0 + w * 0.5, 0, -y),
      new THREE.Vector3(S.x0 + w * 1.5, 0, -y),
      new THREE.Vector3(S.x0 + w * 2.5, 0, -y)
    ];
  }

  anchor(name) {
    const a = this.L.anchors[name];
    if (!Array.isArray(a)) {
      console.warn("worker3d: bilinmeyen ankraj", name);
      return new THREE.Vector3(0, 0, -this.L.roadY);
    }
    return new THREE.Vector3(a[0], 0, -a[1]);
  }

  /* ---------------------------------------------------- iş listesi */
  pushTask(t, front = false) {
    if (front) this.queue.unshift(t); else this.queue.push(t);
  }

  /** Öğrenci bir ahırı beslediğinde tetiklenir: yem hazırla + dağıt. */
  requestFeeding(barnKey) {
    this.queue = this.queue.filter(t => t.kind !== "prepFeed" && t.kind !== "feedRun");
    this.pushTask({ kind: "prepFeed" }, true);
    this.pushTask({ kind: "feedRun", barn: barnKey }, false);
    if (this.task && (this.task.kind === "idle" || this.task.kind === "heatCheck")) this.task = null;
  }

  /** Hafta kapanınca: sağım turu + kızgınlık gözlemi. */
  requestWeeklyRound() {
    this.pushTask({ kind: "milkRound" });
    this.pushTask({ kind: "milkToTank" });
    this.pushTask({ kind: "heatCheck" });
  }

  _nextTask(ctx) {
    this.task = this.queue.shift() || { kind: "idle" };
    this.timer = 0;
    const A = this.L.anchors;
    switch (this.task.kind) {
      case "prepFeed":
        this.status = "Yem deposunda rasyon hazırlıyor";
        this.goTo(this.anchor("storeMix"));
        break;
      case "feedRun":
        this.status = "Traktörle yem dağıtıyor";
        this.goTo(this.anchor("tractorPark"));
        break;
      case "milkRound": {
        this.status = "Mobil üniteyle sağım yapıyor";
        this.task.list = ctx.milkableCows().slice(0, 6);
        this.task.i = 0;
        this.trolleyWith = true;
        break;
      }
      case "milkToTank":
        this.status = "Sütü soğutma tankına boşaltıyor";
        this.trolleyWith = true;
        this.goTo(this.anchor("milkTank"));
        break;
      case "heatCheck":
        this.status = "Kızgınlık gözlemi yapıyor";
        if (this.parts["Prop_Clipboard"]) this.parts["Prop_Clipboard"].visible = true;
        this.task.list = ctx.heatWatchPoints();
        this.task.i = 0;
        break;
      default:
        this.status = "Çiftlikte dolaşıyor";
        this.goTo(this._wanderPoint());
    }
  }

  _wanderPoint() {
    const A = this.L.anchors;
    // Yalnizca yerlesim dosyasinda GERCEKTEN bulunan ankrajlar arasindan sec;
    // boylece build_farm.py'de isim degistiginde isci cokmez, sadece o nokta duser.
    const wanted = ["officeDoor", "dryGate", "storeDoor", "alleySouth", "roadWest", "chute", "milkTank"];
    const opts = wanted.filter(k => Array.isArray(this.L.anchors[k]));
    if (!opts.length) return new THREE.Vector3(0, 0, -this.L.roadY);
    return this.anchor(opts[Math.floor(Math.random() * opts.length)]);
  }

  /* ---------------------------------------------------- hareket */
  _stepWalk(dt, speed) {
    if (!this.waypoints.length) { this.speed = 0; return true; }
    const t = this.waypoints[0];
    const dx = t.x - this.pos.x, dz = t.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.35) { this.waypoints.shift(); return this.waypoints.length === 0; }
    const s = Math.min(d, speed * dt);
    this.pos.x += dx / d * s;
    this.pos.z += dz / d * s;
    const want = Math.atan2(-dz, dx);
    let diff = want - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += diff * Math.min(1, dt * 6);
    this.speed = speed;
    return false;
  }

  _driveTractor(dt, target, speed = DRIVE) {
    const dx = target.x - this.tractorPos.x, dz = target.z - this.tractorPos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.5) { this.tractorSpeed = 0; return true; }
    const s = Math.min(d, speed * dt);
    this.tractorPos.x += dx / d * s;
    this.tractorPos.z += dz / d * s;
    const want = Math.atan2(-dz, dx);
    let diff = want - this.tractorHeading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.tractorHeading += diff * Math.min(1, dt * 2.5);
    this.tractorSpeed = speed;
    return false;
  }

  _placeMixer(dt) {
    if (this.hitched) {
      // Traktore bagli: cekme okunun boyu kadar geride, ayni yone bakar.
      // (Servis yolunda tasinma bu sekilde gorunur.)
      const back = 5.4;
      this.mixer.position.set(
        this.tractorPos.x - Math.cos(this.tractorHeading) * back,
        0,
        this.tractorPos.z + Math.sin(this.tractorHeading) * back
      );
      this.mixer.rotation.y = this.tractorHeading;
    } else {
      // Bosta: makine parkinda duruyor
      this.mixer.position.lerp(this.mixerPark, Math.min(1, (dt || 0.016) * 3));
      this.mixer.rotation.y = Math.PI / 2;
    }
    // bosaltma agzi ve burgu animasyonu
    const tray = this.mixer.getObjectByName("Mx_chuteTray");
    if (tray) tray.rotation.x = 0.30 + this.chute * 0.85;
    const aug = this.mixer.getObjectByName("Mx_Auger");
    if (aug) aug.rotation.y += this.augerSpin * (dt || 0.016);
  }

  _dropFeed(ctx, mode) {
    // Traktor gecerken kafa kilidi hattinin onune yem birakir.
    const L = this.L;
    const lines = mode === "dry"
      ? [L.headlocks.dry]
      : [L.headlocks.start, L.headlocks.end];
    for (const h of lines) {
      if (!h) continue;
      let px, pz, w, d;
      if (h.axis === "y") {
        const y = -this.tractorPos.z;
        if (y < h.from || y > h.to) continue;
        px = h.x + h.face * 0.62;
        pz = -y;
        w = 0.55; d = 1.6;
      } else {
        const x = this.tractorPos.x;
        if (x < h.from || x > h.to) continue;
        px = x;
        pz = -(h.y + h.face * 0.62);
        w = 1.6; d = 0.55;
      }
      if (this.feedPiles.some(p => Math.abs(p.position.x - px) < 1.4 &&
                                   Math.abs(p.position.z - pz) < 1.4)) continue;
      const g = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.34, d),
        new THREE.MeshLambertMaterial({ color: 0x6f6a2a })
      );
      g.position.set(px, 0.42, pz);
      g.castShadow = true;
      g.userData.born = performance.now();
      this.scene.add(g);
      this.feedPiles.push(g);
    }
  }

  clearFeed() {
    this.feedPiles.forEach(p => this.scene.remove(p));
    this.feedPiles = [];
  }

  /* ---------------------------------------------------- ana döngü */
  update(dt, ctx) {
    this.phase += dt;
    if (!this.task) this._nextTask(ctx);
    const A = this.L.anchors;
    const T = this.task;

    switch (T.kind) {
      case "prepFeed": {
        // ISCININ YEM HAZIRLAMA ANIMASYONU
        // Depodaki uc gozden (saman / yonca / tahil) sirayla balya alir,
        // makine parkindaki karma romorkuna tasiyip icine atar. Her turda
        // burgu bir sure hizlanir; rasyonun "karildigi" gorulur.
        const spots = this._feedPickSpots();
        const loadPoint = new THREE.Vector3(
          this.mixerPark.x + 2.2, 0, this.mixerPark.z + 1.2);
        if (T.trip === undefined) { T.trip = 0; T.phase = "toBale"; this.waypoints = []; }

        if (T.phase === "toBale") {
          if (!T.moving) { this.goTo(spots[T.trip % spots.length]); T.moving = true; this.timer = 0; }
          if (this._stepWalk(dt, WALK)) {
            this.timer += dt;
            this._propFork(true);
            // egilip balyayi yukleniyor
            this.crouch = Math.min(0.7, this.timer * 1.4) * (1 - Math.max(0, this.timer - 1.4));
            if (this.timer > 1.8) {
              this._propFork(false);
              this.crouch = 0;
              this.carrying = true;
              T.phase = "toMixer"; T.moving = false; this.timer = 0;
            }
          }
        } else if (T.phase === "toMixer") {
          if (!T.moving) { this.goTo(loadPoint); T.moving = true; this.timer = 0; }
          if (this._stepWalk(dt, WALK * 0.85)) {
            this.timer += dt;
            // balyayi kazana kaldirip atma hareketi
            this.lift = Math.min(1, this.timer * 2.2);
            this.augerSpin = 4.2;
            if (this.timer > 1.1) {
              this.carrying = false;
              this.lift = 0;
              T.trip++; T.moving = false; T.phase = "toBale"; this.timer = 0;
              if (T.trip >= 3) { this.augerSpin = 0; this.task = null; }
            }
          }
        }
        break;
      }

      case "feedRun": {
        if (!T.phase) T.phase = "walkToTractor";
        if (T.phase === "walkToTractor") {
          if (this._stepWalk(dt, WALK)) {
            T.phase = "drive"; this.inCab = true; T.leg = 0;
            this.hitched = true;          // romorku tak
            this.augerSpin = 2.6;         // karistirma burgusu calisiyor
          }
        } else if (T.phase === "drive") {
          // Laktasyon ahiri: yem yoluna guneyden gir, kuzeye dogru yem birak,
          // kuzey ucundan cikip dogudan dolanarak yola don.
          const dryRun = T.barn === "dry";
          const P3 = (k) => new THREE.Vector3(A[k][0], 0, -A[k][1]);
          const legs = dryRun ? [
            this._roadPoint(A.dryGate[0] + 12),
            new THREE.Vector3(A.dryGate[0] - 9, 0, -(A.dryGate[1] - 0.5)),
            new THREE.Vector3(A.dryGate[0] + 9, 0, -(A.dryGate[1] - 0.5)),
            P3("tractorPark")
          ] : [
            this._roadPoint(A.alleySouth[0]),
            P3("alleySouth"),
            P3("alleyNorth"),
            P3("barnLoopNE"),
            P3("barnLoopSE"),
            P3("tractorPark")
          ];
          const dropLeg = 2;
          const tgt = legs[T.leg];
          const dropping = (T.leg === dropLeg);
          const slow = dropping ? 1.9 : DRIVE;   // yem dokerken yavaslar
          // bosaltma agzi yalnizca yem birakirken acilir
          this.chute += ((dropping ? 1 : 0) - this.chute) * Math.min(1, dt * 3);
          this.augerSpin = dropping ? 5.0 : 2.6;
          if (dropping) this._dropFeed(ctx, dryRun ? "dry" : "lact");
          if (this._driveTractor(dt, tgt, slow)) {
            T.leg++;
            if (T.leg >= legs.length) {
              this.inCab = false; this.task = null;
              this.hitched = false;       // romorku park yerine birak
              this.chute = 0; this.augerSpin = 0;
            }
          }
        }
        break;
      }

      case "milkRound": {
        const list = T.list || [];
        if (T.i >= list.length) { this.trolleyWith = false; this.task = null; break; }
        const c = list[T.i];
        if (!T.moving) { this.goTo(new THREE.Vector3(c.x + 1.3, 0, c.z)); T.moving = true; this.timer = 0; }
        if (this._stepWalk(dt, WALK)) {
          this.timer += dt;
          this.crouch = Math.min(0.8, this.timer * 2);
          if (this.onCowMilked) this.onCowMilked(c.id);
          if (this.timer > 3.0) {
            this.crouch = 0;
            T.i++; T.moving = false;
            if (this.onCowMilked) this.onCowMilked(null);
          }
        }
        break;
      }

      case "milkToTank": {
        if (this._stepWalk(dt, WALK)) {
          this.timer += dt;
          this.crouch = 0.25;
          if (this.timer > 2.5) { this.crouch = 0; this.trolleyWith = false; this.task = null; }
        }
        break;
      }

      case "heatCheck": {
        const list = T.list || [];
        if (T.i >= list.length) {
          if (this.parts["Prop_Clipboard"]) this.parts["Prop_Clipboard"].visible = false;
          this.task = null; break;
        }
        const p = list[T.i];
        if (!T.moving) { this.goTo(p, true); T.moving = true; this.timer = 0; }
        if (this._stepWalk(dt, WALK)) {
          this.timer += dt;
          if (this.timer > 1.8) { T.i++; T.moving = false; }
        }
        break;
      }

      default: {
        if (this._stepWalk(dt, WALK * 0.8)) {
          this.timer += dt;
          if (this.timer > 2.5) this.task = null;
        }
      }
    }

    this._applyPose(dt);
  }

  _propFork(on) {
    if (this.parts["Prop_Fork"]) this.parts["Prop_Fork"].visible = !!on;
  }

  _applyPose(dt) {
    const P = this.parts;
    // işçi kabine bindiyse traktörün üstünde taşınır
    if (this.inCab) {
      this.root.visible = false;
    } else {
      this.root.visible = true;
      this.root.position.set(this.pos.x, 0, this.pos.z);
      this.root.rotation.y = this.heading;
    }

    const gait = this.speed > 0.05 ? Math.sin(this.phase * 9) : 0;
    const sw = gait * 0.55;
    if (P["Leg_L"]) P["Leg_L"].rotation.z = sw;
    if (P["Leg_R"]) P["Leg_R"].rotation.z = -sw;
    if (P["Knee_L"]) P["Knee_L"].rotation.z = Math.max(0, -sw * 0.9);
    if (P["Knee_R"]) P["Knee_R"].rotation.z = Math.max(0, sw * 0.9);
    const lift = this.lift || 0;
    if (this.carrying) {
      // iki kol one uzanir, balya tasiniyor; kaldirirken yukari kalkar
      const a = -1.35 - lift * 0.8;
      if (P["Arm_L"]) P["Arm_L"].rotation.z = a;
      if (P["Arm_R"]) P["Arm_R"].rotation.z = a;
      if (P["Elbow_L"]) P["Elbow_L"].rotation.z = 0.5;
      if (P["Elbow_R"]) P["Elbow_R"].rotation.z = 0.5;
    } else {
      if (P["Arm_L"]) P["Arm_L"].rotation.z = -sw * 0.8 - this.crouch * 0.9;
      if (P["Arm_R"]) P["Arm_R"].rotation.z = sw * 0.8 - this.crouch * 0.9;
      if (P["Elbow_L"]) P["Elbow_L"].rotation.z = 0;
      if (P["Elbow_R"]) P["Elbow_R"].rotation.z = 0;
    }
    if (P["Hips"]) {
      P["Hips"].position.y = 0.92 - this.crouch * 0.45 + Math.abs(gait) * 0.03;
      P["Hips"].rotation.z = this.crouch * 0.5;
    }

    // tasinan balya: iscinin onunde, gogus hizasinda; atarken yukari kalkar
    if (this.carrying) {
      this.carryBale.visible = true;
      this.carryBale.position.set(
        this.pos.x + Math.cos(this.heading) * 0.62,
        1.05 + lift * 1.35,
        this.pos.z - Math.sin(this.heading) * 0.62
      );
      this.carryBale.rotation.y = this.heading;
    } else if (this.carryBale.visible) {
      this.carryBale.visible = false;
    }

    // traktör + romork
    this.tractor.position.copy(this.tractorPos);
    this.tractor.rotation.y = this.tractorHeading;
    this._placeMixer(dt);
    const spin = this.tractorSpeed * dt * 2.2;
    if (spin) this.wheels.forEach(w => { w.rotation.z -= spin; });

    // sağım arabası işçiyle birlikte gider
    if (this.trolleyWith) {
      this.trolley.visible = true;
      this.trolley.position.set(
        this.pos.x - Math.cos(this.heading) * 0.9,
        0,
        this.pos.z + Math.sin(this.heading) * 0.9
      );
      this.trolley.rotation.y = this.heading;
    }

    // yem yığınları zamanla azalır (hayvanlar yiyor)
    const now = performance.now();
    this.feedPiles = this.feedPiles.filter(p => {
      const age = (now - p.userData.born) / 1000;
      const k = Math.max(0, 1 - age / 90);
      p.scale.set(1, Math.max(0.08, k), 1);
      if (k <= 0.001) { this.scene.remove(p); return false; }
      return true;
    });
  }
}
