/* =========================================================
   ration.js
   Rasyon hesaplama: seçilen yem miktarlarından toplam kuru
   madde (kg), kuru maddede ham protein (%), kuru maddede ham
   selüloz (%), metabolik enerji (Mcal) ve rasyon maliyeti (TL)
   hesaplanır. Öğrenciye SADECE eksiklikler bildirilir
   (madde 15/42) - yönlendirici bilgi verilmez.

   Yem marketi/stok sistemi KALDIRILMIŞTIR. Rasyon kaydedildiği
   anda, o ahırdaki hayvan sayısına göre haftalık yem maliyeti
   doğrudan işletme gideri olarak kasadan düşülür (bkz. game.js
   -> Game.saveRation).
   ========================================================= */

const Ration = {
  /** boş rasyon: her yem için 0 kg/baş/gün */
  emptyRation() {
    const r = {};
    Object.keys(FEEDS).forEach(k => (r[k] = 0));
    return r;
  },

  /** Verilen rasyonun (kg as-fed/baş/gün) toplam besin değerlerini ve maliyetini hesaplar */
  computeTotals(ration) {
    let km = 0, hpKg = 0, hsKg = 0, me = 0, premiksKg = 0, dailyCost = 0;
    Object.keys(ration).forEach(key => {
      const amount = ration[key] || 0;
      if (amount <= 0) return;
      const f = FEEDS[key];
      const kmKg = amount * f.km;
      km += kmKg;
      hpKg += kmKg * (f.hp / 100);
      hsKg += kmKg * (f.hs / 100);
      me += kmKg * f.me;
      dailyCost += amount * f.price;
      if (key === "premiks") premiksKg += amount;
    });
    const hpPercent = km > 0 ? (hpKg / km) * 100 : 0;
    const hsPercent = km > 0 ? (hsKg / km) * 100 : 0;
    return {
      km: +km.toFixed(2),
      hpPercent: +hpPercent.toFixed(1),
      hsPercent: +hsPercent.toFixed(1),
      me: +me.toFixed(1),
      dailyCost: +dailyCost.toFixed(2),
      premiksVerildi: premiksKg >= 0.08
    };
  },

  /** Baş sayısına göre haftalık toplam rasyon maliyetini hesaplar */
  weeklyCost(ration, headcount) {
    const totals = Ration.computeTotals(ration);
    return +(totals.dailyCost * 7 * headcount).toFixed(2);
  },

  /** Ahır ihtiyacına göre eksiklik listesi döner (madde 15) */
  evaluateDeficiencies(barnKey, totals) {
    const req = BARN_REQUIREMENTS[barnKey];
    const deficits = [];
    if (totals.km < req.km) deficits.push("Kuru madde eksik");
    if (totals.hpPercent < req.hpPercent) deficits.push("Ham protein eksik");
    if (totals.hsPercent < req.hsPercentMin) deficits.push("Ham selüloz eksik");
    if (totals.hsPercent > req.hsPercentMax) deficits.push("Ham selüloz fazla");
    if (totals.me < req.me) deficits.push("Metabolik enerji eksik");
    return deficits;
  },

  /** Rasyonun genel "doğru beslenme" durumunu (kist/hastalık riski için) belirler.
   *  Öğrenciye gösterilmez, yalnız oyun motoru tarafından kullanılır. */
  isNutritionallyAdequate(barnKey, totals) {
    const req = BARN_REQUIREMENTS[barnKey];
    return totals.km >= req.km && totals.hpPercent >= req.hpPercent &&
      totals.hsPercent >= req.hsPercentMin && totals.hsPercent <= req.hsPercentMax &&
      totals.me >= req.me * 0.97;
  },

  /** Enerji durumu: 'excess' | 'ok' | 'deficient' - VKS trendini yönetmek için */
  energyStatus(barnKey, totals) {
    const req = BARN_REQUIREMENTS[barnKey];
    if (totals.me < req.me * CONFIG.ENERGY_DEFICIENT_RATIO) return "deficient";
    if (totals.me > req.me * CONFIG.ENERGY_EXCESS_RATIO) return "excess";
    return "ok";
  }
};
