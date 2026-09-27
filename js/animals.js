/* =========================================================
   animals.js
   İnek veri modeli, başlangıç sürüsünün oluşturulması,
   süt verim eğrisi ve VKS güncelleme mantığı.
   ========================================================= */

const Animals = {

  /** 1..N arası rastgele tam sayı (dahil) */
  _rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /** Doğum sonrası başlangıç verimi: hayvandan hayvana değişen bireysel değer
   *  (CONFIG.CALVING_MILK_MIN - CALVING_MILK_MAX arası, L/gün). */
  randomStartMilk() {
    const min = CONFIG.CALVING_MILK_MIN;
    const max = CONFIG.CALVING_MILK_MAX;
    return +(min + Math.random() * (max - min)).toFixed(1);
  },

  /** Laktasyon haftasına göre günlük süt verimini hesaplar (litre/gün).
   *  Eğri hayvanın kendi başlangıç veriminden (startMilk) pik değere yükselir,
   *  plato boyunca pikte kalır, sonra sabit oranda düşer.
   *  Buradaki pik POTANSİYEL veridir; rasyonda enerji açığı olan haftalarda
   *  game.js verimi ayrıca düşürür (bkz. CONFIG.UNDERFED_MILK_DROP_WEEKLY). */
  milkYieldForLactationWeek(lw, startMilk) {
    const start = startMilk || CONFIG.CALVING_MILK_MIN;
    const peak = CONFIG.PEAK_MILK;
    if (lw <= 0) return start;
    if (lw <= CONFIG.PEAK_LACTATION_WEEK) {
      return start + (peak - start) * (lw / CONFIG.PEAK_LACTATION_WEEK);
    }
    if (lw <= CONFIG.PEAK_PLATEAU_END_WEEK) return peak;
    const weeksPast = lw - CONFIG.PEAK_PLATEAU_END_WEEK;
    return Math.max(CONFIG.MIN_DAILY_MILK, peak - weeksPast * CONFIG.MILK_DECLINE_PER_WEEK);
  },

  /** Yeni bir buzağı/inek nesnesi (kayıt) oluşturur */
  _createAnimal(idx, opts) {
    const id = "INEK-" + String(idx).padStart(2, "0");
    return Object.assign({
      id,
      tag: idx,
      barn: "start",
      alive: true,
      vks: +(CONFIG.VKS_START_MIN + Math.random() * (CONFIG.VKS_START_MAX - CONFIG.VKS_START_MIN)).toFixed(1),
      reproStatus: "bos",           // 'bos' | 'tohumlandi' | 'gebe'
      pregWeek: 0,                  // gebelik haftası
      lactationWeek: 0,             // doğumdan bu yana geçen hafta
      isLactating: false,
      dailyMilk: 0,
      inHeat: false,
      // Yalancı kızgınlık: gebe hayvanın atlama davranışı. falseHeatProne, hayvanın
      // bu davranışı gösteren 1/5'lik gruba girip girmediğini tutar.
      falseHeat: false,
      falseHeatStartedThisWeek: false,
      falseHeatProne: false,
      lastHeatWeek: 0,
      startMilk: Animals.randomStartMilk(),
      milkFactor: 1,          // eğri potansiyelinin ne kadarının verildiği (0.4 - 1)
      weeksSinceHeat: 0,
      nextHeatWeek: Animals._rand(CONFIG.HEAT_CYCLE_MIN_WEEKS, CONFIG.HEAT_CYCLE_MAX_WEEKS),
      cystic: false,
      milkSaleBlockedWeeks: 0,
      milkPartialBlockLiters: 0,
      failedAiRiskWeeks: 0,
      dried: false,
      lateDryOffPenaltyApplied: false,
      diseases: [],           // aktif hastalık kodları
      treatedThisWeek: false,
      inseminations: [],      // {week, success:bool, resultWeek}
      pendingAIResult: null,  // {aiWeek, success, testableFromWeek, testableToWeek, tested}
      calvings: 0,
      lastCalvingCalfCare: null,
      notes: [],
      imageSeed: idx
    }, opts || {});
  },

  /** Bir ineğin laktasyon haftasına göre kızgınlık sayaçlarını hesaplar.
   *  İlk kızgınlık doğumdan sonra 8. veya 9. haftada görülür (ilk 8 hafta
   *  gönüllü bekleme süresidir, hayvan tohumlanmaz); bu haftayı
   *  geçmiş bir hayvan zaten normal östrus döngüsündedir. Döndürülen değerler
   *  Reproduction.weeklyUpdate'in sayaç mantığıyla uyumludur
   *  (weeksSinceHeat >= nextHeatWeek olduğunda kızgınlık başlar). */
  _heatCountersForLactationWeek(lw) {
    const firstHeat = Animals._rand(
      CONFIG.FIRST_HEAT_AFTER_CALVING_MIN_WEEKS,
      CONFIG.FIRST_HEAT_AFTER_CALVING_MAX_WEEKS
    );
    if (lw < firstHeat) {
      // İlk kızgınlığını henüz görmedi: tam olarak firstHeat haftasında gelecek
      return { weeksSinceHeat: 0, nextHeatWeek: firstHeat - lw };
    }
    // İlk kızgınlığını görmüş: döngünün rastgele bir noktasında
    const cycle = Animals._rand(CONFIG.HEAT_CYCLE_MIN_WEEKS, CONFIG.HEAT_CYCLE_MAX_WEEKS);
    return { weeksSinceHeat: (lw - firstHeat) % cycle, nextHeatWeek: cycle };
  },

  /** Başlangıç 20 baş sürüsünü oluşturur (madde 9) */
  createInitialHerd() {
    const herd = [];
    // İlk 4 baş: belirli gebelik haftalarıyla.
    // Laktasyon haftası rastgele değil, gebelik haftasından türetilir: inek
    // doğumdan sonra gönüllü bekleme süresini tamamlayıp en erken 8. haftada
    // tohumlanabildiği için laktasyon haftası = ilk tohumlama haftası + gebelik
    // haftasıdır. Aksi halde (ör. 28 haftalık gebe, laktasyonun 6. haftasında)
    // fizyolojik olarak imkânsız hayvanlar oluşuyordu.
    const pregnantSeed = CONFIG.INITIAL_PREGNANT_SEED;
    for (let i = 0; i < pregnantSeed.length; i++) {
      const lw = CONFIG.FIRST_SERVICE_LACTATION_WEEK + pregnantSeed[i];
      const startMilk = Animals.randomStartMilk();
      herd.push(Animals._createAnimal(i + 1, {
        reproStatus: "gebe",
        pregWeek: pregnantSeed[i],
        lactationWeek: lw,
        isLactating: true,
        startMilk,
        dailyMilk: +Animals.milkYieldForLactationWeek(lw, startMilk).toFixed(1)
      }));
    }
    // Kalan baş: boş, sağmal. Laktasyon haftası EMPTY_COW_START_LACTATION_WEEKS
    // değerlerinden biri; kızgınlık sayaçları bu haftadan türetilir.
    const emptyWeeks = CONFIG.EMPTY_COW_START_LACTATION_WEEKS;
    for (let i = pregnantSeed.length; i < CONFIG.HERD_SIZE; i++) {
      const lw = emptyWeeks[Animals._rand(0, emptyWeeks.length - 1)];
      const heat = Animals._heatCountersForLactationWeek(lw);
      const startMilk = Animals.randomStartMilk();
      herd.push(Animals._createAnimal(i + 1, {
        reproStatus: "bos",
        lactationWeek: lw,
        isLactating: true,
        startMilk,
        dailyMilk: +Animals.milkYieldForLactationWeek(lw, startMilk).toFixed(1),
        weeksSinceHeat: heat.weeksSinceHeat,
        nextHeatWeek: heat.nextHeatWeek
      }));
    }
    return herd;
  },

  /** Ahır ekranında ve modalda gösterilecek TEK gözlemsel ipucu: davranış durumu.
   *  Öğrenci bunun dışında (hasta/kızgın/gebe/kist) hiçbir bilgiyi muayene etmeden göremez. */
  behaviorWord(a) {
    if (!a.alive) return "Öldü";
    if (a.diseases.length > 0) return "Durgun";
    // Gerçek kızgınlık ile gebe hayvanın yalancı kızgınlığı (atlama) ahır
    // ekranında bilerek AYNI görünür; ayrım muayene ile yapılır.
    if (a.inHeat || a.falseHeat) return "Hareketli / Huzursuz";
    return "Sakin";
  }
};
