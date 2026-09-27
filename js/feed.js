/* =========================================================
   feed.js
   Yem marketi (satın alma) ve stok yönetimi.
   Not: Sperma stok/market sistemi bilinçli olarak YOKTUR
   (madde 7 - sperma oyunun başından beri sınırsız stokta).
   ========================================================= */

const Feed = {
  /** Boş stok objesi üretir: her yem 0 kg */
  emptyStock() {
    const s = {};
    Object.keys(FEEDS).forEach(k => (s[k] = 0));
    return s;
  },

  /** Market: kg cinsinden yem satın alma. Nakit yetersizse false döner. */
  buy(state, feedKey, kg) {
    if (kg <= 0) return { ok: false, msg: "Miktar 0'dan büyük olmalı." };
    const feed = FEEDS[feedKey];
    const cost = +(feed.price * kg).toFixed(2);
    if (state.cash < cost) return { ok: false, msg: "Yetersiz bakiye." };
    state.cash -= cost;
    state.feedStock[feedKey] += kg;
    state.totals.feedCost += cost;
    return { ok: true, cost };
  },

  /** Belirli bir ahırdaki tüm hayvanları o haftanın rasyonuyla besler.
   *  Stoktan haftalık toplam tüketimi düşer; stok yetersizse kısmi/başarısız olur. */
  feedBarn(state, barnKey) {
    const ration = state.rations[barnKey];
    const animals = state.animals.filter(a => a.alive && a.barn === barnKey);
    if (animals.length === 0) return { ok: true, fed: 0, shortage: [] };

    const weeklyNeed = {};
    Object.keys(ration).forEach(k => {
      weeklyNeed[k] = ration[k] * 7 * animals.length;
    });

    const shortage = [];
    Object.keys(weeklyNeed).forEach(k => {
      if (weeklyNeed[k] > 0 && state.feedStock[k] + 1e-6 < weeklyNeed[k]) {
        shortage.push(FEEDS[k].name);
      }
    });

    if (shortage.length > 0) {
      return { ok: false, fed: 0, shortage };
    }

    Object.keys(weeklyNeed).forEach(k => {
      state.feedStock[k] -= weeklyNeed[k];
    });

    animals.forEach(a => (a.fedThisWeek = true));
    return { ok: true, fed: animals.length, shortage: [] };
  }
};
