/* =========================================================
   calving.js
   Doğum mini oyunu (4 aşama) ve doğum sonrası buzağı bakımı
   (sıralı 4 adım). Yanlış zamanlama/sıra doğum başarısızlığı
   veya buzağı kaybına yol açabilir (madde 36/37).
   ========================================================= */

const Calving = {
  STAGES: [
    { key: "kese1", label: "Birinci Su Kesesi", correctAction: "yarim_saat" },
    { key: "kese2", label: "İkinci Su Kesesi", correctAction: "yarim_saat" },
    { key: "ayaklar", label: "Buzağının Ayakları Görünüyor", correctAction: "bir_saat" },
    { key: "kafa", label: "Buzağının Kafası Görünüyor", correctAction: "mudahale" }
  ],

  CALF_CARE_CORRECT_ORDER: [
    "Buzağıyı yüksek yere as (solunumu rahatlat)",
    "Burnundaki ve ağzındaki doğum sıvılarını temizle",
    "Anneye yalatarak kurulanmasını sağla",
    "Kolostrum içir"
  ],

  /** Bir doğum aşamasında öğrencinin seçtiği eylemin uygunluğunu değerlendirir.
   *  action: 'yarim_saat' | 'bir_saat' | 'mudahale' */
  evaluateStage(stageIndex, action) {
    const stage = Calving.STAGES[stageIndex];
    const correct = action === stage.correctAction;
    // Aşırı erken müdahale veya gereğinden fazla bekleme ciddi risk taşır
    const critical = !correct && (action === "mudahale" && stage.correctAction !== "mudahale");
    return { correct, critical };
  },

  /** Tüm doğum sürecinin sonucunu (başarı/kayıp) aşama sonuçlarından hesaplar */
  resolveOutcome(stageResults) {
    const wrongCount = stageResults.filter(r => !r.correct).length;
    const criticalCount = stageResults.filter(r => r.critical).length;
    if (criticalCount >= 2 || wrongCount >= 3) {
      return { success: false, calfSurvives: false };
    }
    if (wrongCount >= 1) {
      return { success: true, calfSurvives: Math.random() < 0.6 };
    }
    return { success: true, calfSurvives: true };
  },

  /** Öğrencinin seçtiği buzağı bakım sırasını doğru sırayla karşılaştırır */
  evaluateCalfCareOrder(chosenOrder) {
    let correctSteps = 0;
    for (let i = 0; i < Calving.CALF_CARE_CORRECT_ORDER.length; i++) {
      if (chosenOrder[i] === Calving.CALF_CARE_CORRECT_ORDER[i]) correctSteps++;
    }
    return { correctSteps, total: Calving.CALF_CARE_CORRECT_ORDER.length, perfect: correctSteps === Calving.CALF_CARE_CORRECT_ORDER.length };
  },

  /** Doğum sonrası hayvanın durumunu sıfırlar (yeni laktasyon başlar) */
  applyCalvingResult(state, a, weekNow, outcome) {
    const preCalvingVKS = a.vks;

    a.calvings += 1;
    a.reproStatus = "bos";
    a.pregWeek = 0;
    a.barn = "start";
    a.isLactating = true;
    a.lactationWeek = 0;
    // Doğumu izleyen ilk 8 hafta gönüllü bekleme süresidir (VWP): bu sürede hayvan
    // tohumlanmaz. Bu nedenle doğumdan sonraki ilk kızgınlık laktasyonun 8. veya 9.
    // haftasında görülür (sonraki kızgınlıklar normal östrus döngüsüne döner).
    a.weeksSinceHeat = 0;
    a.inHeat = false;
    a.falseHeat = false;
    a.falseHeatStartedThisWeek = false;
    a.falseHeatProne = false;
    a.nextHeatWeek = Animals._rand(
      CONFIG.FIRST_HEAT_AFTER_CALVING_MIN_WEEKS,
      CONFIG.FIRST_HEAT_AFTER_CALVING_MAX_WEEKS
    );

    // Yeni laktasyon, hayvana özgü bir başlangıç verimiyle açılır (20-26 L/gün).
    // Geç/hiç kuruya çıkarılmayan hayvanda ceza verim KATSAYISINA yazılır; böylece
    // yalnızca ilk hafta değil, laktasyon boyunca hissedilir ve doğru beslemeyle
    // ancak yavaş yavaş toparlanır (madde 18).
    a.startMilk = Animals.randomStartMilk();
    a.milkFactor = (!a.dried || a.lateDryOffPenaltyApplied) ? CONFIG.LATE_DRY_OFF_MILK_FACTOR : 1;
    a.dailyMilk = +(a.startMilk * a.milkFactor).toFixed(2);
    a.dried = false;
    a.lateDryOffPenaltyApplied = false;

    if (outcome.success) {
      state.totals.successfulCalvings += 1;
    } else {
      state.totals.failedCalvings = (state.totals.failedCalvings || 0) + 1;
    }
    if (!outcome.calfSurvives) {
      state.totals.calfLosses = (state.totals.calfLosses || 0) + 1;
    } else {
      state.totals.calvesBorn = (state.totals.calvesBorn || 0) + 1;
      // Yaşayan buzağı doğumdan sonra satılır ve kasaya tek seferlik gelir yazar.
      state.cash += CONFIG.CALF_SALE_PRICE;
      state.totals.calfRevenue = (state.totals.calfRevenue || 0) + CONFIG.CALF_SALE_PRICE;
    }

    // Doğumdan hemen önce VKS 4'ün üzerindeyse %80 ihtimalle 4 hastalıktan biri hemen tetiklenir
    Health.maybeTriggerPreCalvingDisease(a, preCalvingVKS);
  }
};
