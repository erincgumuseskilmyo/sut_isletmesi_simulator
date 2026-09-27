/* =========================================================
   health.js
   Hastalık tetikleme, muayene bulguları ve tedavi mantığı.
   Öğrenciye asla doğrudan teşhis verilmez (madde 30/42);
   yalnızca klinik bulgular gösterilir.
   ========================================================= */

const Health = {

  /** Haftalık hastalık riskini değerlendirir. Her hastalığın kendi zamanlama
   *  penceresi vardır (doğum sonrası hafta sayısına göre) ve enerji açığı olan
   *  rasyonlarda hipokalsemi/abomazum/ketozis riski %70 artar (ENERGY_DEFICIENT_DISEASE_MULTIPLIER). */
  weeklyDiseaseCheck(state, a, nutritionByBarn) {
    if (!a.alive || a.diseases.length > 0) return;

    const highVKS = a.vks >= 4.0;
    const vksMult = highVKS ? CONFIG.HIGH_VKS_DISEASE_MULTIPLIER : 1;
    const barnInfo = nutritionByBarn ? nutritionByBarn[a.barn] : null;
    const energyDeficient = barnInfo ? barnInfo.energyStatus === "deficient" : false;
    const energyMult = energyDeficient ? CONFIG.ENERGY_DEFICIENT_DISEASE_MULTIPLIER : 1;
    const premiksVerildi = barnInfo ? barnInfo.premiksVerildi : false;
    const lw = a.lactationWeek;
    const activeMilking = a.isLactating && a.barn !== "dry";

    // Mastitis - sadece sağılan (laktasyondaki) hayvanlarda, madde 32
    if (activeMilking) {
      if (Math.random() < CONFIG.MASTITIS_WEEKLY_CHANCE * vksMult) {
        Health.triggerDisease(a, "mastitis");
        return;
      }
    }

    // Hipokalsemi: doğumdan sonraki ilk 2 hafta premiks verilmezse KESİN (madde 33).
    // Premiks verilse bile küçük bir taban risk vardır; enerji açığında bu risk %70 artar.
    if (lw >= 0 && lw <= 2 && activeMilking) {
      if (!premiksVerildi && !a._hipokalsemiChecked) {
        a._hipokalsemiChecked = true;
        Health.triggerDisease(a, "hipokalsemi");
        return;
      }
      if (premiksVerildi && Math.random() < (1 / 60) * energyMult * vksMult) {
        Health.triggerDisease(a, "hipokalsemi");
        return;
      }
    }

    // Retensiyo Sekundinarum: yalnızca doğumdan sonraki ilk 3 hafta.
    if (activeMilking && lw >= 0 && lw <= CONFIG.RETENSIYO_MAX_LACTATION_WEEK) {
      if (Math.random() < (1 / 40) * vksMult) {
        Health.triggerDisease(a, "retensiyo");
        return;
      }
    }

    // Metritis: doğumdan sonraki ilk 6 hafta VEYA tohumlama mini oyununda
    // başarısız olunduktan sonraki risk penceresinde.
    const metritisWindow = (lw >= 0 && lw <= CONFIG.METRITIS_MAX_LACTATION_WEEK) || (a.failedAiRiskWeeks > 0);
    if (activeMilking && metritisWindow) {
      const base = (lw >= 0 && lw <= CONFIG.METRITIS_MAX_LACTATION_WEEK) ? 1 / 40 : 1 / 60;
      if (Math.random() < base * vksMult) {
        Health.triggerDisease(a, "metritis");
        return;
      }
    }

    // Ketozis: doğum sonrası ilk 8 hafta (negatif enerji dengesi dönemi), enerji açığında %70 fazla.
    if (activeMilking && lw >= 0 && lw <= CONFIG.KETOZIS_MAX_LACTATION_WEEK) {
      if (Math.random() < (1 / 45) * vksMult * energyMult) {
        Health.triggerDisease(a, "ketozis");
        return;
      }
    }

    // Abomazum Deplasmanı: yalnızca laktasyonun ilk 10 haftasında görülür (11. haftadan itibaren görülmez).
    if (activeMilking && lw >= 0 && lw <= CONFIG.ABOMAZUM_MAX_LACTATION_WEEK) {
      if (Math.random() < (1 / 70) * vksMult * energyMult) {
        Health.triggerDisease(a, "abomazum");
        return;
      }
    }
  },

  triggerDisease(a, code) {
    a.diseases.push({ code, weeksActive: 0, treated: false, curing: false, curingWeeksRemaining: 0 });
  },

  /** Doğumdan hemen önce VKS 4'ün üzerindeyse %80 ihtimalle 4 hastalıktan
   *  biri doğumla birlikte hemen ortaya çıkar (metritis, retensiyo, ketozis, abomazum). */
  maybeTriggerPreCalvingDisease(a, preCalvingVKS) {
    if (a.diseases.length > 0) return;
    if (preCalvingVKS <= CONFIG.PRE_CALVING_HIGH_VKS_THRESHOLD) return;
    if (Math.random() >= CONFIG.PRE_CALVING_HIGH_VKS_DISEASE_CHANCE) return;
    const candidates = ["metritis", "retensiyo", "ketozis", "abomazum"];
    const code = candidates[Math.floor(Math.random() * candidates.length)];
    Health.triggerDisease(a, code);
  },

  /** Muayene bulgularını döndürür (teşhis adı verilmeden).
   *  Hastalık, kist şüphesi ve kızgınlık bulguları birleştirilerek gösterilir;
   *  öğrenci ahır ekranında bunları göremez, yalnızca MUAYENE ET ile öğrenir. */
  examine(a) {
    const symptoms = [];
    if (a.diseases.length > 0) {
      const d = a.diseases[0];
      const info = DISEASES[d.code];
      if (d.curing) {
        symptoms.push(`Tedavi sürüyor (kalan süre: ${d.curingWeeksRemaining} hafta).`);
      } else {
        symptoms.push(...info.symptoms);
      }
    }
    if (a.cystic) {
      symptoms.push(...CYST_INFO.symptoms);
    }
    if (a.inHeat) {
      symptoms.push("Çara akıntısı gözlendi.", "Olgun folikül palpe edildi.", "Sağrıda yatmış kıllar mevcut.");
    } else if (a.falseHeat) {
      // Gebe hayvanın yalancı kızgınlığı: atlama var, kızgınlığın kesin
      // bulguları YOK. Bu tabloyu gören öğrenci tohumlama yapmamalıdır.
      symptoms.push(
        "Diğer hayvanların üzerine atladığı gözlendi.",
        "Durma (stand-by) refleksi yok; üzerine atlanınca kaçıyor.",
        "Sağrıda yatmış kıl saptanmadı.",
        "Palpasyonda olgun folikül yok."
      );
    }
    if (symptoms.length === 0) {
      symptoms.push("Belirgin patolojik bulgu saptanmadı, davranış normal.");
    }
    return { hasFindings: symptoms.length > 0, symptoms };
  },

  /** Öğrencinin seçtiği tedavi kodu ile hastalık/kist eşleşirse başarı.
   *  code: DISEASES anahtarlarından biri veya "kist" olabilir.
   *  Ketozis özel durumdur: anında iyileşmez, en az 3 hafta süren bir tedavi
   *  sürecine girer (bu süre boyunca süt verimi yarı yarıya azalır ve tedavi
   *  başlangıcında VKS'de tek seferlik 0.5 puanlık düşüş olur).
   *  Antibiyotik/ilaç arınma süresi nedeniyle doğru tedavi sonrası süt satışı
   *  kısıtlanır: mastitiste 3 günlük üretimin 1/4'ü, diğer hastalıklarda ise
   *  1 tam hafta boyunca süt satılamaz (bkz. CONFIG.DISEASE_MILK_WITHDRAWAL_WEEKS). */
  applyTreatment(state, a, chosenCode) {
    const hasDisease = a.diseases.length > 0;
    const hasCyst = a.cystic;
    if (!hasDisease && !hasCyst) return { ok: false, msg: "Tedavi gerektiren bir durum yok." };
    if (hasDisease && a.diseases[0].curing) return { ok: false, msg: "Bu hayvan zaten tedavi sürecinde." };

    // Gerçek durum: önce aktif hastalık, yoksa kist kabul edilir.
    const actualCode = hasDisease ? a.diseases[0].code : "kist";
    const info = actualCode === "kist" ? CYST_INFO : DISEASES[actualCode];
    state.cash -= info.treatmentCost;
    state.totals.medCost += info.treatmentCost;

    if (chosenCode === actualCode) {
      if (actualCode === "kist") {
        a.cystic = false;
        a.weeksSinceHeat = 0;
        a.nextHeatWeek = Animals._rand(CONFIG.HEAT_CYCLE_MIN_WEEKS, CONFIG.HEAT_CYCLE_MAX_WEEKS);
      } else if (actualCode === "mastitis") {
        a.diseases.shift();
        // Yalnızca 3 günlük üretimin 1/4'ü satılamaz (tam hafta değil)
        a.milkPartialBlockLiters = (a.milkPartialBlockLiters || 0) +
          a.dailyMilk * CONFIG.MASTITIS_MILK_WITHDRAWAL_DAYS * CONFIG.MASTITIS_MILK_WITHDRAWAL_FRACTION;
      } else if (actualCode === "ketozis") {
        const d = a.diseases[0];
        d.curing = true;
        d.curingWeeksRemaining = CONFIG.KETOZIS_TREATMENT_WEEKS;
        a.vks = +Math.max(0, a.vks - CONFIG.KETOZIS_TREATMENT_VKS_DROP).toFixed(2);
        a.milkSaleBlockedWeeks = (a.milkSaleBlockedWeeks || 0) + CONFIG.DISEASE_MILK_WITHDRAWAL_WEEKS;
      } else {
        // hipokalsemi, retensiyo sekundinarum, metritis, abomazum deplasmanı:
        // anında iyileşir, ancak sistemik tedavi nedeniyle 1 tam hafta süt satılamaz.
        a.diseases.shift();
        a.milkSaleBlockedWeeks = (a.milkSaleBlockedWeeks || 0) + CONFIG.DISEASE_MILK_WITHDRAWAL_WEEKS;
      }
      state.totals.correctTreatments = (state.totals.correctTreatments || 0) + 1;
      return { ok: true, correct: true };
    } else {
      if (hasDisease) a.diseases[0].weeksActive += 1;
      state.totals.wrongTreatments = (state.totals.wrongTreatments || 0) + 1;
      return { ok: true, correct: false };
    }
  },

  /** Haftalık ilerleme: tedavi görmeyen hastalıklar kötüleşip ölüm riski doğurabilir;
   *  tedavi (curing) sürecindeki hastalıklar (yalnızca ketozis) süt verimini yarıya
   *  indirmeye devam eder ve süre dolunca kendiliğinden iyileşir. */
  weeklyProgress(state, a) {
    const stillActive = [];
    a.diseases.forEach(d => {
      if (d.curing) {
        if (a.isLactating && a.barn !== "dry") {
          a.dailyMilk = +(a.dailyMilk * (1 - CONFIG.KETOZIS_TREATMENT_MILK_DROP)).toFixed(2);
        }
        d.curingWeeksRemaining -= 1;
        if (d.curingWeeksRemaining > 0) stillActive.push(d);
        // 0'a ulaşınca hastalık listeden düşer (iyileşme tamamlandı)
      } else {
        d.weeksActive += 1;
        if (d.weeksActive >= 4 && Math.random() < 0.15) {
          a.alive = false;
          state.totals.deaths += 1;
        }
        stillActive.push(d);
      }
    });
    a.diseases = stillActive;
  }
};
