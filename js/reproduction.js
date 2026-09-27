/* =========================================================
   reproduction.js
   Kızgınlık döngüsü, gebelik ilerlemesi, kuruya çıkarma,
   kist oluşumu. Sperma stoğu YOKTUR - tohumlama sırasında
   doğrudan kullanılır (madde 7).
   ========================================================= */

const Reproduction = {

  /** Haftalık üreme durumu güncellemesi (her hayvan için çağrılır) */
  weeklyUpdate(state, a, nutritionOkByBarn) {
    if (!a.alive) return;

    // Gebelik ilerlemesi
    if (a.reproStatus === "gebe") {
      a.pregWeek += 1;
      if (a.pregWeek >= CONFIG.GESTATION_WEEKS) {
        state.pendingCalvings = state.pendingCalvings || [];
        if (!state.pendingCalvings.includes(a.id)) state.pendingCalvings.push(a.id);
      }
      // Kuruya çıkarma gecikme cezası kontrolü zamanı geldiğinde ui/economy tarafında değerlendirilir.
      return;
    }

    // Premiks verilmeyen hayvanlarda kızgınlık görülmez (madde 33)
    const barnOk = nutritionOkByBarn ? nutritionOkByBarn[a.barn] : null;
    const premiksVerildi = barnOk ? barnOk.premiksVerildi : false;

    if (a.reproStatus === "tohumlandi") {
      // Kızgınlığa geri dönüş (return to estrus): tohumlama tutmadıysa hayvan bir
      // östrus döngüsü sonra (3-4 hafta) yeniden kızgınlığa gelir. Öğrenci bunu
      // ahır ekranındaki "Hareketli / Huzursuz" davranışından fark eder ve gebelik
      // muayenesini beklemeden tekrar tohumlayabilir. Gebe kalmış hayvanda görülmez.
      a.weeksSinceHeat = (a.weeksSinceHeat || 0) + 1;
      const ai = a.pendingAIResult;
      const gebeKalmadi = ai && !ai.pregnant;
      const dongudeMi = !a.cystic && a.weeksSinceHeat >= a.nextHeatWeek && premiksVerildi;
      if (gebeKalmadi && dongudeMi) {
        if (!a.inHeat) a.heatStartedThisWeek = true;
        a.inHeat = true;
      } else if (ai && ai.pregnant && a.falseHeatProne && dongudeMi) {
        // Yalancı kızgınlık: gebe hayvan diğer hayvanlara atlar. Ahır ekranındaki
        // davranış ipucu gerçek kızgınlıkla aynıdır; öğrenci muayene etmeden
        // tohumlarsa gebeliği riske atar (bkz. registerInsemination).
        if (!a.falseHeat) a.falseHeatStartedThisWeek = true;
        a.falseHeat = true;
      }
      return;
    }

    // 'bos' durumundaki hayvanlar için kızgınlık döngüsü
    if (a.cystic) return; // tedavi edilmeden kızgınlığa gelmez (madde 28)

    a.weeksSinceHeat = (a.weeksSinceHeat || 0) + 1;
    if (a.weeksSinceHeat >= a.nextHeatWeek && premiksVerildi) {
      if (!a.inHeat) a.heatStartedThisWeek = true;
      a.inHeat = true;
    }
  },

  /** Kızgınlık geçince (öğrenci tohumlamazsa) döngüyü sıfırlar - haftalık çağrılır.
   *  Bu fonksiyon weeklyUpdate'ten hemen sonra çalıştığı için, o hafta YENİ başlayan
   *  kızgınlık dokunulmadan bırakılır; aksi halde kızgınlık öğrenciye hiç gösterilmeden
   *  aynı tur içinde silinebiliyordu. Kızgınlık en az bir hafta ekranda kalır. */
  clearExpiredHeat(a) {
    // Yalancı kızgınlık da gerçek kızgınlık gibi bir süre sonra geçer ve
    // döngü sıfırlanır; böylece sonraki döngüde yeniden görülebilir.
    if (a.falseHeat) {
      if (a.falseHeatStartedThisWeek) {
        a.falseHeatStartedThisWeek = false;
      } else if (Math.random() < 0.5) {
        a.falseHeat = false;
        a.weeksSinceHeat = 0;
        a.nextHeatWeek = Animals._rand(CONFIG.HEAT_CYCLE_MIN_WEEKS, CONFIG.HEAT_CYCLE_MAX_WEEKS);
      }
    }
    if (!a.inHeat) return;
    if (a.heatStartedThisWeek) {
      a.heatStartedThisWeek = false; // bu hafta yeni başladı, bir tur görünür kalsın
      return;
    }
    if (Math.random() < 0.5) {
      a.inHeat = false;
      a.weeksSinceHeat = 0;
      a.nextHeatWeek = Animals._rand(CONFIG.HEAT_CYCLE_MIN_WEEKS, CONFIG.HEAT_CYCLE_MAX_WEEKS);
    }
  },

  /** Kist oluşma ihtimalini değerlendirir (madde 28) */
  maybeDevelopCyst(a, nutritionAdequate) {
    if (a.reproStatus !== "bos" || a.cystic) return;
    const chance = nutritionAdequate ? CONFIG.CYST_CHANCE_GOOD_FEEDING : CONFIG.CYST_CHANCE_BAD_FEEDING;
    if (Math.random() < chance) {
      a.cystic = true;
      a.inHeat = false;
    }
  },

  /** Tohumlama sonucunu işler (insemination.js tarafından başarı/başarısızlık belirlendikten sonra çağrılır) */
  registerInsemination(state, a, weekNow, success) {
    // Gebe bir hayvanın (henüz muayene edilmemiş de olsa) tohumlanması hatalı bir
    // uygulamadır: sperma boşa gider ve gebelik kaybı riski doğar. Öğrenci bunu
    // anında öğrenmez; sonuç gebelik muayenesinde ortaya çıkar.
    const gebeydi = a.reproStatus === "gebe" || !!(a.pendingAIResult && a.pendingAIResult.pregnant);
    if (gebeydi) {
      a.falseHeat = false;
      a.falseHeatStartedThisWeek = false;
      a.inHeat = false;
      a.weeksSinceHeat = 0;
      a.nextHeatWeek = Animals._rand(CONFIG.HEAT_CYCLE_MIN_WEEKS, CONFIG.HEAT_CYCLE_MAX_WEEKS);
      a.inseminations.push({ week: weekNow, success, onPregnant: true });
      state.totals.aiOnPregnant = (state.totals.aiOnPregnant || 0) + 1;
      const lost = Math.random() < CONFIG.AI_ON_PREGNANT_PREGNANCY_LOSS_CHANCE;
      if (lost) {
        a.reproStatus = "bos";
        a.pregWeek = 0;
        a.pendingAIResult = null;
        a.falseHeatProne = false;
        state.totals.pregnancyLossesFromAI = (state.totals.pregnancyLossesFromAI || 0) + 1;
      }
      // Yanlış tohumlama uterusu kontamine eder: 4/5 ihtimalle metritis.
      const metritis = Reproduction._maybeWrongAiMetritis(a);
      return { onPregnant: true, pregnancyLost: lost, metritis };
    }

    a.reproStatus = "tohumlandi";
    a.inHeat = false;
    a.weeksSinceHeat = 0;
    // Tohumlama tutmazsa bir östrus döngüsü sonra (3-4 hafta) tekrar kızgınlık beklenir
    a.nextHeatWeek = Animals._rand(CONFIG.HEAT_CYCLE_MIN_WEEKS, CONFIG.HEAT_CYCLE_MAX_WEEKS);
    const pregnant = success && Math.random() < CONFIG.PREGNANCY_CHANCE_ON_SUCCESSFUL_AI;
    a.pendingAIResult = {
      aiWeek: weekNow,
      success,
      pregnant,
      testableFromWeek: weekNow + Math.ceil(CONFIG.INSEMINATION_TO_PREG_TEST_MIN_DAYS / 7),
      testableToWeek: weekNow + Math.ceil(CONFIG.INSEMINATION_TO_PREG_TEST_MAX_DAYS / 7),
      tested: false
    };
    a.falseHeat = false;
    a.falseHeatStartedThisWeek = false;
    // Gebe kalan hayvanların 1/5'i, döngü zamanı geldiğinde yalancı kızgınlık
    // (atlama) gösterecek gruba girer.
    a.falseHeatProne = pregnant && Math.random() < CONFIG.PREGNANT_FALSE_HEAT_RATIO;
    a.inseminations.push({ week: weekNow, success });
    if (success) {
      state.totals.successfulInsem += 1;
    } else {
      // Yanlış uygulanan tohumlamada uterus kontaminasyonu nedeniyle 4/5 ihtimalle
      // metritis gelişir; hastalık oluşmazsa da bir süre risk yüksek kalır.
      if (!Reproduction._maybeWrongAiMetritis(a)) {
        a.failedAiRiskWeeks = CONFIG.FAILED_AI_METRITIS_RISK_WEEKS;
      }
    }
  },

  /** Yanlış tohumlama sonrası metritis oluşumu (4/5). Hayvanda zaten aktif bir
   *  hastalık varsa yenisi eklenmez. Metritis oluştuysa true döner. */
  _maybeWrongAiMetritis(a) {
    if (a.diseases.length > 0) return false;
    if (Math.random() >= CONFIG.WRONG_AI_METRITIS_CHANCE) return false;
    Health.triggerDisease(a, "metritis");
    return true;
  },

  /** Gebelik muayenesi yapılabilir mi? */
  canPregnancyTest(a, weekNow) {
    return a.reproStatus === "tohumlandi" && a.pendingAIResult &&
      weekNow >= a.pendingAIResult.testableFromWeek;
  },

  /** Gebelik muayenesini gerçekleştirir */
  performPregnancyTest(state, a, weekNow) {
    const res = a.pendingAIResult;
    res.tested = true;
    a.falseHeat = false;
    a.falseHeatStartedThisWeek = false;
    a.falseHeatProne = false;
    if (res.pregnant) {
      a.reproStatus = "gebe";
      a.pregWeek = weekNow - res.aiWeek;
      a.pendingAIResult = null;
      state.totals.confirmedPregnancies = (state.totals.confirmedPregnancies || 0) + 1;
      return { pregnant: true };
    } else {
      a.reproStatus = "bos";
      a.pendingAIResult = null;
      a.weeksSinceHeat = 0;
      a.nextHeatWeek = Animals._rand(CONFIG.HEAT_CYCLE_MIN_WEEKS, CONFIG.HEAT_CYCLE_MAX_WEEKS);
      return { pregnant: false };
    }
  },

  /** Öğrenci, laktasyon aşamasına göre hayvanı Başlangıç <-> Bitiş ahırı arasında taşıyabilir.
   *  Kuru İnek Ahırı'na geçiş/çıkış yalnızca doğum ve kuruya çıkarma olaylarıyla otomatik olur. */
  moveBarn(a, targetBarn) {
    if (a.barn === "dry" || targetBarn === "dry") {
      return { ok: false, msg: "Kuru İnek Ahırı'na geçiş yalnızca kuruya çıkarma işlemiyle, çıkış ise doğumla olur." };
    }
    if (!a.alive) return { ok: false, msg: "Hayvan hayatta değil." };
    a.barn = targetBarn;
    return { ok: true };
  },

  /** Kuruya çıkarma işlemi */
  dryOff(a) {
    if (a.reproStatus !== "gebe") return { ok: false, msg: "Sadece gebe hayvanlar kuruya çıkarılabilir." };
    a.barn = "dry";
    a.dried = true;
    a.isLactating = false;
    a.dailyMilk = 0;
    const late = a.pregWeek > CONFIG.DRY_OFF_WEEK_THRESHOLD;
    if (late) a.lateDryOffPenaltyApplied = true;
    return { ok: true, late };
  }
};
