/* =========================================================
   game.js
   Oyunun merkezi durumu (state) ve haftalık tur motoru.
   ========================================================= */

const Game = {
  state: null,

  newGame(student) {
    Game.state = {
      student,
      week: 1,
      phase: "market", // market -> ration -> feeding -> review -> (end week)
      cash: CONFIG.START_CASH,
      rations: {
        start: Ration.emptyRation(),
        end: Ration.emptyRation(),
        dry: Ration.emptyRation()
      },
      feedCostChargedThisWeek: { start: 0, end: 0, dry: 0 },
      fedThisWeek: { start: false, end: false, dry: false },
      // O hafta fiilen verilen rasyonun kopyası (besleme anında alınır).
      // Maliyet, besin değerlendirmesi ve VKS etkisi hep bu kopyadan okunur.
      fedRationThisWeek: { start: null, end: null, dry: null },
      animals: Animals.createInitialHerd(),
      pendingCalvings: [],
      totals: {
        milkRevenue: 0,
        calfRevenue: 0,
        feedCost: 0,
        medCost: 0,
        deaths: 0,
        successfulInsem: 0,
        aiOnPregnant: 0,
        pregnancyLossesFromAI: 0,
        confirmedPregnancies: 0,
        successfulCalvings: 0,
        failedCalvings: 0,
        calvesBorn: 0,
        calfLosses: 0,
        correctTreatments: 0,
        wrongTreatments: 0,
        miniGameErrors: 0,
        milkLiters: 0
      },
      log: [],
      lastWeeklyReport: null,
      showWeeklyReport: false,
      gameOver: false
    };
    Storage.save(Game.state);
    return Game.state;
  },

  loadGame() {
    const saved = Storage.load();
    if (saved) {
      Game.state = saved;
      return true;
    }
    return false;
  },

  addLog(msg) {
    Game.state.log.unshift(`Hafta ${Game.state.week}: ${msg}`);
    if (Game.state.log.length > 200) Game.state.log.pop();
  },

  /** Rasyonu kaydeder. Kayıt tek başına PARA HARCATMAZ; yalnızca o ahırın
   *  rasyonunu günceller. Kaydedilen rasyon haftadan haftaya korunur, öğrenci
   *  değiştirmediği sürece her hafta aynen uygulanır - yani her tur yeniden
   *  kaydetmek gerekmez. Maliyet, hayvanlar fiilen beslendiğinde düşülür
   *  (bkz. Game.feedBarnNow). */
  saveRation(barnKey) {
    const state = Game.state;
    const headcount = state.animals.filter(a => a.alive && a.barn === barnKey).length;
    const cost = Ration.weeklyCost(state.rations[barnKey], headcount);
    Storage.save(state);
    return { cost, headcount };
  },

  /** "Hayvanları Besle" - kayıtlı rasyonu o ahırdaki hayvanlara fiilen uygular ve
   *  haftalık yem maliyetini bu anda kasadan düşer. Verilen rasyonun kopyası
   *  saklanır; hafta sonu besin/VKS değerlendirmesi bu kopyadan yapılır. */
  feedBarnNow(barnKey) {
    const state = Game.state;
    if (!state.fedRationThisWeek) {
      state.fedRationThisWeek = { start: null, end: null, dry: null };
    }
    if (state.fedThisWeek[barnKey]) {
      return { ok: false, msg: "Bu ahır bu hafta zaten beslendi." };
    }

    const headcount = state.animals.filter(a => a.alive && a.barn === barnKey).length;
    const ration = state.rations[barnKey];
    const totals = Ration.computeTotals(ration);

    if (headcount > 0 && totals.km <= 0) {
      return { ok: false, msg: "Bu ahır için kayıtlı bir rasyon yok. Rasyon sekmesinden yem miktarlarını girip kaydedin." };
    }

    const cost = Ration.weeklyCost(ration, headcount);
    state.cash -= cost;
    state.totals.feedCost += cost;
    state.feedCostChargedThisWeek[barnKey] = cost;
    state.fedRationThisWeek[barnKey] = Object.assign({}, ration);
    state.fedThisWeek[barnKey] = true;

    Game.addLog(`${BARN_LABELS[barnKey]} beslendi: ${headcount} hayvan, ${cost.toFixed(2)} TL yem gideri.`);
    Storage.save(state);
    return { ok: true, cost, headcount };
  },

  allBarnsFed() {
    return Game.state.fedThisWeek.start && Game.state.fedThisWeek.end && Game.state.fedThisWeek.dry;
  },

  /** Rasyon bazlı besin yeterlilik haritasını (VKS/kist/premiks için) hesaplar */
  nutritionSnapshot() {
    const snap = {};
    ["start", "end", "dry"].forEach(barnKey => {
      // Hafta içinde beslendiyse fiilen verilen rasyon, beslenmediyse kayıtlı rasyon
      const fedRation = Game.state.fedRationThisWeek && Game.state.fedRationThisWeek[barnKey];
      const totals = Ration.computeTotals(fedRation || Game.state.rations[barnKey]);
      snap[barnKey] = {
        totals,
        adequate: Ration.isNutritionallyAdequate(barnKey, totals),
        energyStatus: Ration.energyStatus(barnKey, totals),
        premiksVerildi: totals.premiksVerildi
      };
    });
    return snap;
  },

  /** Haftayı sonlandırır: tüm biyolojik ve ekonomik süreçleri işler, yeni haftaya geçer. */
  endWeek() {
    const state = Game.state;
    if (!Game.allBarnsFed()) {
      return { ok: false, msg: "Tüm ahırlar beslenmeden hafta kapatılamaz." };
    }

    const nutrition = Game.nutritionSnapshot();

    state.animals.forEach(a => {
      if (!a.alive) return;

      // Başarısız tohumlama sonrası metritis risk penceresinin haftalık azalması
      if (a.failedAiRiskWeeks && a.failedAiRiskWeeks > 0) a.failedAiRiskWeeks -= 1;

      // Laktasyon haftası ilerlemesi (VKS hesaplamasından ÖNCE, aynı haftaya ait olsun diye).
      // Günlük verim, verim katsayısı güncellendikten SONRA hesaplanır (aşağıda).
      if (a.isLactating && a.barn !== "dry") {
        a.lactationWeek += 1;
      }

      // VKS güncelleme: NRC (2021) Bölüm 3 esas alınarak, enerji fazlası/açığının
      // BÜYÜKLÜĞÜYLE ORANTILI ve fizyolojik bir tavanla sınırlı şekilde hesaplanır
      // (sabit haftalık artış/azalış yerine - bkz. CONFIG.ENERGY_PER_BCS_POINT_MCAL açıklaması).
      // Doğum sonrası ilk 10 haftada, rasyon ne kadar iyi olursa olsun, süt veriminin hızla
      // artması ve yem tüketiminin ancak kademeli artabilmesi nedeniyle FİZYOLOJİK bir negatif
      // enerji dengesi (NEB) eklenir (bkz. CONFIG.NEB_DEFICIT_CURVE_MCAL_PER_DAY kaynakları).
      const barnInfo = nutrition[a.barn];
      if (barnInfo) {
        const req = BARN_REQUIREMENTS[a.barn].me;
        const isFreshLactating = a.isLactating && a.barn !== "dry";
        const nebCurve = CONFIG.NEB_DEFICIT_CURVE_MCAL_PER_DAY;
        const nebDeficitToday = (isFreshLactating && a.lactationWeek >= 0 && a.lactationWeek < nebCurve.length)
          ? nebCurve[a.lactationWeek]
          : 0;

        const dailyBalance = (barnInfo.totals.me - req) + nebDeficitToday; // Mcal/gün, + fazla / - açık
        const weeklyBalance = dailyBalance * 7;
        const reEff = a.barn === "dry" ? CONFIG.ME_TO_RE_EFF_DRY : CONFIG.ME_TO_RE_EFF_LACT;

        if (weeklyBalance > 0) {
          const retained = weeklyBalance * reEff;
          const gain = Math.min(CONFIG.MAX_WEEKLY_VKS_GAIN, retained / CONFIG.ENERGY_PER_BCS_POINT_MCAL);
          a.vks = +(Math.min(CONFIG.VKS_MAX, a.vks + gain)).toFixed(2);
        } else if (weeklyBalance < 0) {
          const mobilized = -weeklyBalance * reEff;
          const loss = Math.min(CONFIG.MAX_WEEKLY_VKS_LOSS, mobilized / CONFIG.ENERGY_PER_BCS_POINT_MCAL);
          a.vks = +(a.vks - loss).toFixed(2);
          if (barnInfo.energyStatus === "deficient" && a.isLactating) {
            // Yetersiz besleme cezası BİRİKİR: her açık haftası katsayıyı bir tık daha düşürür
            a.milkFactor = Math.max(
              CONFIG.MIN_MILK_FACTOR,
              (a.milkFactor == null ? 1 : a.milkFactor) * (1 - CONFIG.UNDERFED_MILK_DROP_WEEKLY)
            );
          }
        }

        // Rasyon yeterliyse kaybedilen verim yavaşça toparlanır (düşüşten daha yavaş)
        if (barnInfo.adequate && (a.milkFactor == null ? 1 : a.milkFactor) < 1) {
          a.milkFactor = Math.min(1, a.milkFactor * (1 + CONFIG.MILK_FACTOR_RECOVERY_WEEKLY));
        }
      }

      // Güncel günlük verim: eğri potansiyeli x verim katsayısı.
      // Ketozis gibi geçici düşüşler bunun üzerine Health.weeklyProgress'te uygulanır.
      if (a.isLactating && a.barn !== "dry") {
        const potansiyel = Animals.milkYieldForLactationWeek(a.lactationWeek, a.startMilk);
        a.dailyMilk = +(potansiyel * (a.milkFactor == null ? 1 : a.milkFactor)).toFixed(2);
      }
      if (a.vks < CONFIG.VKS_MIN_ALIVE) {
        a.alive = false;
        state.totals.deaths += 1;
        Game.addLog(`${a.id} aşırı düşük VKS nedeniyle öldü.`);
        return;
      }

      // Üreme güncellemesi
      Reproduction.weeklyUpdate(state, a, nutrition);
      Reproduction.clearExpiredHeat(a);
      const adequate = nutrition[a.barn] ? nutrition[a.barn].adequate : true;
      Reproduction.maybeDevelopCyst(a, adequate);

      // Hastalık kontrolü ve ilerleyişi
      Health.weeklyDiseaseCheck(state, a, nutrition);
      Health.weeklyProgress(state, a);
    });

    // Ekonomi
    const weekFeedCost = Object.values(state.feedCostChargedThisWeek).reduce((s, v) => s + v, 0);
    const milk = Economy.processMilkSales(state);
    const fixedCost = Economy.processFixedCosts(state);
    const totalExpense = +(weekFeedCost + fixedCost).toFixed(2);
    const netResult = +(milk.revenue - totalExpense).toFixed(2);
    Game.addLog(`Süt geliri: ${milk.revenue.toFixed(2)} TL (${milk.liters} L). Gider: ${totalExpense.toFixed(2)} TL. Net: ${netResult.toFixed(2)} TL.`);

    const closedWeek = state.week;

    // Sıradaki haftaya geçiş
    state.week += 1;
    // state.rations bilinçli olarak SIFIRLANMAZ: kayıtlı rasyon bir sonraki
    // haftaya aynen taşınır, öğrenci değiştirmedikçe yeniden kaydetmesi gerekmez.
    state.fedThisWeek = { start: false, end: false, dry: false };
    state.feedCostChargedThisWeek = { start: 0, end: 0, dry: 0 };
    state.fedRationThisWeek = { start: null, end: null, dry: null };

    if (state.week > CONFIG.TOTAL_WEEKS) {
      state.gameOver = true;
    }

    // Yeni hafta başında gösterilecek haftalık kâr/gider özeti (madde: her yeni hafta başında)
    state.lastWeeklyReport = {
      week: closedWeek,
      milkLiters: milk.liters,
      milkRevenue: milk.revenue,
      feedCost: +weekFeedCost.toFixed(2),
      laborCost: CONFIG.WEEKLY_LABOR_COST,
      fuelCost: CONFIG.WEEKLY_FUEL_ELECTRIC_COST,
      totalExpense,
      netResult
    };
    state.showWeeklyReport = !state.gameOver;

    Storage.save(state);
    return { ok: true, milk, fixedCost, gameOver: state.gameOver };
  }
};
