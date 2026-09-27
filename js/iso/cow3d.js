/* =========================================================
   cow3d.js
   Tek bir ineğin 3B temsili: görünüm çeşitliliği, davranış
   durum makinesi ve prosedürel animasyon.

   Oyun mantığı BURADA DEĞİŞTİRİLMEZ. Bu sınıf yalnızca
   Game.state'teki hayvan nesnesini OKUR ve sahnede gösterir.
   ========================================================= */
import * as THREE from "../../vendor/three/three.module.js";

/* Blender'daki (x, y) zemin koordinatını Three.js dünyasına çevirir.
   GLB dışa aktarımı Y-up yaptığı için Blender +y (kuzey) => Three -z. */
export function bxz(x, y) { return new THREE.Vector3(x, 0, -y); }

/** Deterministik küçük rastgele üreteç: aynı kulak numarası her oturumda
 *  aynı ineği verir (öğrenci hayvanı görsel olarak tanısın diye). */
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const SPOT_SETS = ["Spots_A", "Spots_B", "Spots_C", "Spots_D"];
/* Holstein varyasyonları: siyah-alaca, kırmızı-alaca ve koyu kahve tonları. */
const SPOT_COLORS = [0x1b1a19, 0x1b1a19, 0x231f1d, 0x6b3a22, 0x7a4526, 0x3b2b22];
const HIDE_COLORS = [0xf2f0ec, 0xeae6de, 0xf6f4f0, 0xe4dfd4];

export class Cow3D {
  /**
   * @param {THREE.Object3D} proto  cow.glb kök nesnesi (klonlanır)
   * @param {object} animal         Game.state.animals[i]
   * @param {object} pen            {x0,x1,y0,y1} padok sınırı
   */
  constructor(proto, animal, pen) {
    const rnd = mulberry32(1000 + animal.tag * 7919);
    this.id = animal.id;
    this.tag = animal.tag;
    this.rnd = rnd;

    this.root = proto.clone(true);
    this.root.name = "Cow_" + animal.id;
    this.root.userData.cowId = animal.id;

    // --- görünüm çeşitliliği (20 hayvan birbirinin aynısı olmasın)
    const keep = SPOT_SETS[Math.floor(rnd() * SPOT_SETS.length)];
    const spotColor = new THREE.Color(SPOT_COLORS[Math.floor(rnd() * SPOT_COLORS.length)]);
    const hideColor = new THREE.Color(HIDE_COLORS[Math.floor(rnd() * HIDE_COLORS.length)]);
    this.parts = {};
    const drop = [];
    this.root.traverse(o => {
      if (o.name) this.parts[o.name] = o;
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.material = o.material.clone();
        o.userData.cowId = animal.id;
        const mn = o.material.name || "";
        if (mn === "Spot") o.material.color.copy(spotColor);
        else if (mn === "Hide") o.material.color.copy(hideColor);
      }
      if (o.name && o.name.startsWith("Spots_") && !o.name.startsWith(keep)) drop.push(o);
    });
    drop.forEach(o => o.parent && o.parent.remove(o));

    // --- gövde ölçüsü: yaş/ırk içi bireysel farklılık
    this.baseScale = 0.94 + rnd() * 0.14;
    this.root.scale.setScalar(this.baseScale);

    // --- vücut kondisyon skoru (VKS) ile şişip zayıflayan parçalar
    this.bodyParts = ["Torso", "Withers", "Rump"].map(n => this.parts[n]).filter(Boolean);
    this.bodyBase = this.bodyParts.map(p => p.scale.clone());
    this.udder = this.parts["Udder"];
    this.udderBase = this.udder ? this.udder.scale.clone() : null;

    // --- hareket durumu
    this.pen = pen;
    this.pos = new THREE.Vector3();
    this.heading = rnd() * Math.PI * 2;
    this.target = null;
    this.state = "roam";
    this.phase = rnd() * 10;
    this.speed = 0;
    this.lieAmount = 0;      // 0 ayakta, 1 tamamen yatmış
    this.headDown = 0;       // 0 baş yukarıda, 1 yemlikte
    this.deathT = -1;        // >=0 ise ölüm animasyonu ilerliyor
    this.animal = animal;
    this.slot = 0;

    this._placeRandom();
  }

  _placeRandom() {
    const p = this.pen;
    this.pos.set(
      p.x0 + this.rnd() * (p.x1 - p.x0),
      0,
      -(p.y0 + this.rnd() * (p.y1 - p.y0))
    );
    this.root.position.copy(this.pos);
  }

  /** Padok değiştiğinde (doğum, kuruya çıkarma) hayvanı yeni padoğa ışınlar. */
  setPen(pen) {
    if (this.pen === pen) return;
    this.restSpot = null;
    if (this.state === "rest" || this.state === "rising") this.state = "roam";
    this.pen = pen;
    this._placeRandom();
    this.target = null;
  }

  _randomPointInPen(margin = 1.2) {
    const p = this.pen;
    return new THREE.Vector3(
      p.x0 + margin + this.rnd() * Math.max(0.1, (p.x1 - p.x0) - 2 * margin),
      0,
      -(p.y0 + margin + this.rnd() * Math.max(0.1, (p.y1 - p.y0) - 2 * margin))
    );
  }

  /** Game.state'ten okunan duruma göre davranış seçilir. */
  syncState(animal, ctx) {
    this.animal = animal;
    const d = animal.diseases && animal.diseases[0];
    // İleri hastalık: iki haftadır süren ve tedaviye alınmamış vaka -> hayvan yatar, kalkmaz
    const advanced = !!d && !d.curing && (d.weeksActive || 0) >= 2;

    if (!animal.alive) {
      if (this.state !== "dead") { this.state = "dead"; this.deathT = 0; }
      return;
    }
    if (advanced) { this.state = "down"; return; }
    // Doğumu gelen hayvan doğumhaneye alınır (oyundaki pendingCalvings listesi)
    if (ctx.calvingIds && ctx.calvingIds.has(animal.id)) { this.state = "calving"; return; }
    if (ctx.feedingBarns && ctx.feedingBarns[animal.barn]) { this.state = "feed"; return; }
    if (ctx.milkingId === animal.id) { this.state = "milked"; return; }
    if (animal.inHeat || animal.falseHeat) { this.state = "heat"; return; }
    if (d) { this.state = "sick"; return; }
    // Dinlenme (durakta yatma) sureci devam ediyorsa bozma; hayvan kendisi kalkar.
    if (this.state === "rest") return;
    this.state = "roam";
  }

  _seek(dt, target, speed) {
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.25) { this.speed = 0; return true; }
    const step = Math.min(dist, speed * dt);
    this.pos.x += (dx / dist) * step;
    this.pos.z += (dz / dist) * step;
    const want = Math.atan2(-dz, dx);
    let diff = want - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += diff * Math.min(1, dt * 3.5);
    this.speed = speed;
    return false;
  }

  update(dt, ctx) {
    const P = this.parts;
    this.phase += dt;

    switch (this.state) {
      case "dead": {
        this.deathT = Math.min(1, this.deathT + dt * 0.7);
        this.lieAmount = this.deathT;
        this.headDown = this.deathT;
        this.speed = 0;
        break;
      }
      case "down": {
        this.lieAmount = Math.min(1, this.lieAmount + dt * 0.8);
        this.headDown = Math.min(0.55, this.headDown + dt * 0.5);
        this.speed = 0;
        break;
      }
      case "sick": {
        // durgun: nadiren ve yavaş hareket, baş alçak
        this.lieAmount = Math.max(0, this.lieAmount - dt);
        this.headDown = 0.35 + Math.sin(this.phase * 0.5) * 0.05;
        if (!this.target || this.rnd() < dt * 0.05) this.target = this._randomPointInPen(2.0);
        if (this.target && this._seek(dt, this.target, 0.28)) this.target = null;
        break;
      }
      case "feed": {
        // yemliğe git, kafa kilidine gir, başını indir
        this.lieAmount = Math.max(0, this.lieAmount - dt * 2);
        const slot = ctx.feedSlot(this.animal.barn, this.slot);
        if (slot) {
          const done = this._seek(dt, slot.pos, 1.15);
          if (done) {
            this.headDown = Math.min(1, this.headDown + dt * 1.6);
            // çene hareketi
            this.heading += (slot.heading - this.heading) * Math.min(1, dt * 4);
          } else {
            this.headDown = Math.max(0, this.headDown - dt * 1.5);
          }
        }
        break;
      }
      case "calving": {
        // doğumhane bölmesine yürür, oraya varınca yatar
        const spot = ctx.calvingSpot(this.animal.id);
        if (spot && !this._seek(dt, spot, 0.9)) {
          this.lieAmount = Math.max(0, this.lieAmount - dt);
          this.headDown = 0;
        } else {
          this.lieAmount = Math.min(0.85, this.lieAmount + dt * 0.5);
          this.headDown = 0.3 + Math.sin(this.phase * 1.4) * 0.12;
        }
        break;
      }
      case "milked": {
        this.lieAmount = Math.max(0, this.lieAmount - dt * 2);
        this.headDown = 0.15;
        this.speed = 0;
        break;
      }
      case "heat": {
        // Kızgın hayvanlar bir araya toplanır; aralarından biri diğerinin
        // sağrısına atlar (mounting). Atlanan hayvan durur (stand-by refleksi).
        this.lieAmount = Math.max(0, this.lieAmount - dt * 2);
        this.headDown = 0;
        const mount = ctx.mountInfo && ctx.mountInfo(this.id);
        this.beingMounted = !!(ctx.isMountedBy && ctx.isMountedBy(this.id));
        if (mount) {
          // hedefin tam arkasına geç: hedef yönünün tersinde 1.35 m
          const bx = mount.pos.x - Math.cos(mount.heading) * 1.45;
          const bz = mount.pos.z + Math.sin(mount.heading) * 1.45;
          const arrived = this._seek(dt, new THREE.Vector3(bx, 0, bz), 1.5);
          this.heading += (mount.heading - this.heading) * Math.min(1, dt * 5);
          this.mountAmount = Math.min(1, (this.mountAmount || 0) + dt * (arrived ? 2.2 : 0));
        } else {
          this.mountAmount = Math.max(0, (this.mountAmount || 0) - dt * 2.4);
          const c = ctx.heatCluster(this.animal.barn);
          if (c && !this.beingMounted) {
            const ang = this.phase * 0.35 + this.tag;
            const t = new THREE.Vector3(c.x + Math.cos(ang) * 1.9, 0, c.z + Math.sin(ang) * 1.9);
            this._seek(dt, t, 0.8);
          } else {
            this.speed = 0;   // atlanan hayvan hareketsiz durur
          }
        }
        break;
      }
      case "rest": {
        // DURAKTA DINLENME
        // Hayvan once duraga yurur, sonra yatar ve bir sure gevis getirir;
        // sure dolunca kalkip gezmeye devam eder. Gercek bir surude ineklerin
        // gunde 12-14 saati yatarak gecer, bu yuzden padokta her zaman bir
        // kismi duraklarda olur.
        this.headDown = 0;
        if (!this.restSpot) { this.state = "roam"; break; }
        const arrived = this._seek(dt, this.restSpot.pos, 0.6);
        if (arrived) {
          this.heading += (this.restSpot.heading - this.heading) * Math.min(1, dt * 2.5);
          this.lieAmount = Math.min(1, this.lieAmount + dt * 0.7);
          if (this.lieAmount > 0.95) {
            this.restLeft -= dt;
            // yatarken gevis getirme: cene hafifce oynar
            this.headDown = 0.18 + Math.sin(this.phase * 2.4) * 0.06;
            if (this.restLeft <= 0) {
              this.state = "rising";
              this.riseT = 0;
            }
          }
        } else {
          this.lieAmount = Math.max(0, this.lieAmount - dt);
        }
        break;
      }

      case "rising": {
        // kalkma: once on govde, sonra arka; 1,5 saniyede ayaga kalkar
        this.riseT += dt;
        this.lieAmount = Math.max(0, 1 - this.riseT / 1.5);
        this.speed = 0;
        if (this.lieAmount <= 0) {
          if (ctx.releaseStall) ctx.releaseStall(this.id, this.animal.barn);
          this.restSpot = null;
          this.restCooldown = 45 + this.rnd() * 90;   // bir sure daha yatmaz
          this.state = "roam";
          this.target = null;
        }
        break;
      }

      default: { // roam
        this.lieAmount = Math.max(0, this.lieAmount - dt * 1.5);
        this.headDown = Math.max(0, this.headDown - dt);
        this.restCooldown = Math.max(0, (this.restCooldown || 0) - dt);
        if (!this.target) {
          // Gezinirken ara ara bir duraga cekilip yatar.
          if (!this.restCooldown && ctx.stallFor && this.rnd() < dt * 0.10) {
            const spot = ctx.stallFor(this.id, this.animal.barn);
            if (spot) {
              this.restSpot = spot;
              this.restLeft = 25 + this.rnd() * 55;   // 25-80 sn yatar
              this.state = "rest";
              break;
            }
          }
          if (this.rnd() < dt * 0.35) this.target = this._randomPointInPen();
          else this.speed = 0;
        } else if (this._seek(dt, this.target, 0.55)) {
          this.target = null;
        }
      }
    }

    this._applyPose(dt);
  }

  _applyPose(dt) {
    const P = this.parts;
    const r = this.root;
    r.position.set(this.pos.x, 0, this.pos.z);
    r.rotation.y = this.heading;

    // --- yatma / ölüm: gövde alçalır, ölümde YANA devrilir (x ekseni = yuvarlanma)
    const lie = this.lieAmount;
    const mount = this.mountAmount || 0;
    r.position.y = -0.55 * lie + 0.62 * mount;
    r.rotation.x = (this.state === "dead" ? 1.35 : 0) * lie;
    // atlama: ön gövde yukarı kalkar (yerel z ekseni = baş-kuyruk ekseninde eğim)
    r.rotation.z = 0.62 * mount;

    // --- yürüyüş: bacak salınımı hıza bağlı
    const gait = this.speed > 0.05 ? Math.sin(this.phase * this.speed * 7.5) : 0;
    const swing = gait * 0.42 * (1 - lie);
    const set = (leg, knee, s) => {
      if (P[leg]) P[leg].rotation.z = s;
      if (P[knee]) P[knee].rotation.z = Math.max(0, -s * 0.7);
    };
    if (mount > 0.3) {
      // ön bacaklar hedefin sağrısına uzanır, arka bacaklar yerde kalır
      ["FL", "FR"].forEach(t => {
        if (P["Leg_" + t]) P["Leg_" + t].rotation.z = -0.95 * mount;
        if (P["Knee_" + t]) P["Knee_" + t].rotation.z = 0.7 * mount;
      });
      ["BL", "BR"].forEach((t, i) => {
        if (P["Leg_" + t]) P["Leg_" + t].rotation.z = Math.sin(this.phase * 5 + i) * 0.12 * mount;
        if (P["Knee_" + t]) P["Knee_" + t].rotation.z = 0;
      });
    } else if (lie > 0.6) {
      // yatan hayvanda bacaklar katlanır
      ["FL", "FR", "BL", "BR"].forEach(t => {
        if (P["Leg_" + t]) P["Leg_" + t].rotation.z = 1.15 * lie;
        if (P["Knee_" + t]) P["Knee_" + t].rotation.z = -1.9 * lie;
      });
    } else {
      set("Leg_FL", "Knee_FL", swing);
      set("Leg_FR", "Knee_FR", -swing);
      set("Leg_BL", "Knee_BL", -swing);
      set("Leg_BR", "Knee_BR", swing);
    }

    // --- gövde salınımı (yürürken hafif zıplama)
    if (this.speed > 0.05 && lie < 0.3) r.position.y += Math.abs(gait) * 0.035;

    // --- baş: yemlikte aşağı, otlarken çene hareketi, tedirginken yukarı
    if (P["Neck"]) {
      const chew = this.headDown > 0.8 ? Math.sin(this.phase * 6) * 0.05 : 0;
      P["Neck"].rotation.z = -(0.95 * this.headDown + chew) - 0.35 * lie;
    }
    if (P["Head"]) {
      P["Head"].rotation.z = -0.25 * this.headDown;
      P["Head"].rotation.y = Math.sin(this.phase * 0.7 + this.tag) * 0.12 * (1 - this.headDown);
    }

    // --- kuyruk: sinek kovalar; kızgınlıkta daha hareketli
    if (P["Tail"]) {
      const amp = this.state === "heat" ? 0.5 : 0.22;
      P["Tail"].rotation.x = Math.sin(this.phase * (this.state === "heat" ? 4.5 : 2.0)) * amp;
      P["Tail"].rotation.z = 0.15 + 0.5 * lie;
    }

    // --- nefes alıp verme (canlıysa)
    if (this.state !== "dead") {
      const br = 1 + Math.sin(this.phase * 1.6) * 0.012;
      this.bodyParts.forEach((p, i) => {
        const b = this.bodyBase[i];
        p.scale.set(b.x, b.y * br, b.z * br * this.bcsY);
      });
    }
  }

  /** VKS ve laktasyon durumunu görsele yansıtır (zayıflayan/kilo alan hayvan). */
  applyCondition(animal) {
    // VKS 1.5 -> 0.80 (sırt çıkık, karın çökük) ... VKS 5.0 -> 1.16 (aşırı yağlı)
    const vks = Math.max(1.5, Math.min(5.0, animal.vks || 3));
    const f = 0.80 + (vks - 1.5) * (0.36 / 3.5);
    this.bcsY = f;
    this.bodyParts.forEach((p, i) => {
      const b = this.bodyBase[i];
      p.scale.set(b.x * (0.96 + f * 0.04), b.y * f, b.z * f);
    });
    // meme: sağmal hayvanda dolu, kurudaki hayvanda küçük
    if (this.udder && this.udderBase) {
      const milk = animal.isLactating && animal.barn !== "dry"
        ? 0.85 + Math.min(1, (animal.dailyMilk || 0) / 40) * 0.5
        : 0.55;
      this.udder.scale.copy(this.udderBase).multiplyScalar(milk);
      this.udder.visible = true;
    }
    // ölü hayvan soluklaşır
    const dead = !animal.alive;
    this.root.traverse(o => {
      if (o.isMesh && o.material) {
        o.material.opacity = dead ? 0.85 : 1;
        o.material.transparent = dead;
        if (dead && !o.userData._greyed) {
          o.material.color.lerp(new THREE.Color(0x6a6a68), 0.55);
          o.userData._greyed = true;
        }
      }
    });
  }
}

Cow3D.prototype.bcsY = 1;
