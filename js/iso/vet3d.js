/* =========================================================
   vet3d.js
   Veteriner sağlık teknikeri (LVS programının kendi mesleği).

   İşçiden farkı: hayvan bakımı, muayene ve takip işlerini yapar.
   Öncelik sırası:
     1) Doğumu gelen hayvanın başında bekler (doğumhane)
     2) Hasta hayvanları tek tek muayene eder (steteskop)
     3) Tedavi gerekeni travaya alıp enjeksiyon yapar
     4) Sürü takibi: padokları dolaşıp kayıt tutar

   İşçide olduğu gibi animasyon bake edilmez; model adlandırılmış
   pivotlardan oluşur ve hareket burada hesaplanır.
   ========================================================= */
import * as THREE from "../../vendor/three/three.module.js";

const WALK = 2.0;

export class Vet3D {
  constructor(proto, layout, scene) {
    this.L = layout;
    this.scene = scene;
    this.root = proto.clone(true);
    this.root.name = "Vet";
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
    ["Prop_Bag", "Prop_Glove", "Prop_Syringe"].forEach(n => {
      if (this.parts[n]) this.parts[n].visible = false;
    });
    scene.add(this.root);

    const A = layout.anchors;
    this.pos = new THREE.Vector3(A.officeDoor[0] - 3, 0, -A.officeDoor[1]);
    this.heading = Math.PI;
    this.speed = 0;
    this.phase = 0;
    this.crouch = 0;
    this.waypoints = [];
    this.task = null;
    this.timer = 0;
    this.status = "Hazır";
    this.onExamine = null;     // (cowId|null) -> farm3d bunu sahneye yansıtır
  }

  /* ------------------------------------------------ yol */
  _roadPoint(x) { return new THREE.Vector3(x, 0, -this.L.roadY); }

  goTo(v3, direct = false) {
    this.waypoints = direct ? [this._accessPoint(v3)] : this._route(v3);
  }

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


  anchor(name) {
    const a = this.L.anchors[name];
    if (!Array.isArray(a)) return new THREE.Vector3(0, 0, -this.L.roadY);
    return new THREE.Vector3(a[0], 0, -a[1]);
  }

  _step(dt, speed) {
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

  _prop(name, on) {
    const p = this.parts[name];
    if (p) p.visible = !!on;
  }

  _allProps(on) {
    ["Prop_Bag", "Prop_Glove", "Prop_Syringe"].forEach(n => this._prop(n, on));
  }

  /* ------------------------------------------------ iş seçimi */
  _chooseTask(ctx) {
    this.timer = 0;
    this._allProps(false);

    // 1) doğum önceliklidir
    const calving = ctx.calvingList && ctx.calvingList();
    if (calving && calving.length) {
      this.task = { kind: "calving", id: calving[0] };
      this.status = "Doğum takibi yapıyor";
      const a = this.L.anchors.clinicPen1;
      this.goTo(new THREE.Vector3(a[0] + 1.6, 0, -(a[1] + 1.0)));
      this._prop("Prop_Glove", true);
      return;
    }

    // 2) hasta hayvanları muayene et
    const sick = ctx.sickCows ? ctx.sickCows() : [];
    if (sick.length) {
      this.task = { kind: "exam", list: sick.slice(0, 5), i: 0 };
      this.status = "Hasta hayvanları muayene ediyor";
      this._prop("Prop_Bag", true);
      return;
    }

    // 3) rutin sürü takibi
    const round = ctx.herdWatchPoints ? ctx.herdWatchPoints() : [];
    if (round.length && Math.random() < 0.7) {
      this.task = { kind: "round", list: round, i: 0 };
      this.status = "Sürü sağlık takibi yapıyor";
      this._prop("Prop_Bag", true);
      return;
    }

    // 4) ofiste kayıt
    this.task = { kind: "office" };
    this.status = "Kayıtları güncelliyor";
    this.goTo(this.anchor("officeDoor"));
  }

  /* ------------------------------------------------ döngü */
  update(dt, ctx) {
    this.phase += dt;
    if (!this.task) this._chooseTask(ctx);
    const T = this.task;

    switch (T.kind) {
      case "calving": {
        if (this._step(dt, WALK)) {
          this.timer += dt;
          this.crouch = 0.45 + Math.sin(this.phase * 2.2) * 0.2;
          if (this.timer > 8) { this.crouch = 0; this.task = null; }
        }
        break;
      }

      case "exam": {
        const list = T.list || [];
        if (T.i >= list.length) { this.task = null; break; }
        const c = list[T.i];
        if (!T.moving) { this.goTo(new THREE.Vector3(c.x - 1.4, 0, c.z + 0.6)); T.moving = true; this.timer = 0; }
        if (this._step(dt, WALK)) {
          this.timer += dt;
          this.crouch = Math.min(0.65, this.timer * 1.6);
          if (this.onExamine) this.onExamine(c.id);
          if (this.timer > 3.4) {
            // muayene bitti: gerekiyorsa enjeksiyon
            this._prop("Prop_Syringe", true);
            if (this.timer > 4.6) {
              this._prop("Prop_Syringe", false);
              this.crouch = 0;
              T.i++; T.moving = false;
              if (this.onExamine) this.onExamine(null);
            }
          }
        }
        break;
      }

      case "round": {
        const list = T.list || [];
        if (T.i >= list.length) { this.task = null; break; }
        if (!T.moving) { this.goTo(list[T.i], true); T.moving = true; this.timer = 0; }
        if (this._step(dt, WALK * 0.85)) {
          this.timer += dt;
          this.crouch = 0.12;
          if (this.timer > 2.2) { this.crouch = 0; T.i++; T.moving = false; }
        }
        break;
      }

      default: {
        if (this._step(dt, WALK)) {
          this.timer += dt;
          if (this.timer > 3.5) this.task = null;
        }
      }
    }

    this._pose(dt);
  }

  _pose() {
    const P = this.parts;
    this.root.position.set(this.pos.x, 0, this.pos.z);
    this.root.rotation.y = this.heading;
    const gait = this.speed > 0.05 ? Math.sin(this.phase * 8.5) : 0;
    const sw = gait * 0.52;
    if (P["Leg_L"]) P["Leg_L"].rotation.z = sw;
    if (P["Leg_R"]) P["Leg_R"].rotation.z = -sw;
    if (P["Knee_L"]) P["Knee_L"].rotation.z = Math.max(0, -sw * 0.9);
    if (P["Knee_R"]) P["Knee_R"].rotation.z = Math.max(0, sw * 0.9);
    // muayene ederken kollar öne uzanır
    if (P["Arm_L"]) P["Arm_L"].rotation.z = -sw * 0.7 - this.crouch * 1.25;
    if (P["Arm_R"]) P["Arm_R"].rotation.z = sw * 0.7 - this.crouch * 1.25;
    if (P["Hips"]) {
      P["Hips"].position.y = 0.90 - this.crouch * 0.42 + Math.abs(gait) * 0.03;
      P["Hips"].rotation.z = this.crouch * 0.55;
    }
  }
}
