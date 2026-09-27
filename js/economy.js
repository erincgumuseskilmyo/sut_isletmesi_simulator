/* =========================================================
   economy.js
   Haftalık ekonomik hesaplamalar: süt geliri, sabit giderler.
   ========================================================= */

const Economy = {
  /** Haftalık süt gelirini hesaplar ve nakde ekler.
   *  Tedavi sonrası antibiyotik/ilaç arınma süresi nedeniyle süt satışı kısıtlanabilir:
   *  - Tam hafta bloğu (a.milkSaleBlockedWeeks): hipokalsemi, retensiyo, metritis, ketozis,
   *    abomazum deplasmanı tedavisi sonrası 1 hafta boyunca sütün tamamı satılamaz.
   *  - Kısmi blok (a.milkPartialBlockLiters): mastitis tedavisi sonrası yalnızca 3 günlük
   *    üretimin 1/4'ü kadar bir miktar, satılabilir haftalık üretimden düşülür. */
  processMilkSales(state) {
    let liters = 0;
    state.animals.forEach(a => {
      if (!a.alive || !a.isLactating || a.barn === "dry") return;
      if (a.milkSaleBlockedWeeks && a.milkSaleBlockedWeeks > 0) {
        a.milkSaleBlockedWeeks -= 1;
        return; // bu haftanın sütü satılamaz
      }
      let daily = a.dailyMilk;
      if (a.inHeat) daily *= 0.5; // kızgınlıkta %50 düşüş (madde 20)
      let weekLiters = daily * 7;

      if (a.milkPartialBlockLiters && a.milkPartialBlockLiters > 0) {
        const blocked = Math.min(weekLiters, a.milkPartialBlockLiters);
        weekLiters -= blocked;
        a.milkPartialBlockLiters -= blocked;
      }

      liters += weekLiters;
    });
    const revenue = +(liters * CONFIG.MILK_PRICE_PER_LITER).toFixed(2);
    state.cash += revenue;
    state.totals.milkRevenue += revenue;
    state.totals.milkLiters = (state.totals.milkLiters || 0) + liters;
    return { liters: +liters.toFixed(1), revenue };
  },

  /** Haftalık sabit giderleri düşer (işçilik + mazot/elektrik) */
  processFixedCosts(state) {
    const total = CONFIG.WEEKLY_LABOR_COST + CONFIG.WEEKLY_FUEL_ELECTRIC_COST;
    state.cash -= total;
    return total;
  }
};
