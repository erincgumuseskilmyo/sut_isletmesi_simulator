/* =========================================================
   scoring.js
   Final puanlama (100 üzerinden).
   Puanın %70'i net işletme kârından, %30'u ise diğer
   performans kriterlerinden (başarılı tohumlama, gebelik,
   başarılı doğum, hastalık yönetimi, mini oyun performansı,
   zamanında kuruya çıkarma, hayvan kayıpları) hesaplanır.
   ========================================================= */

const Scoring = {
  /** Kâr bileşeni: 0-70 arası. 0 kâr -> 35 puan (nötr orta nokta),
   *  CONFIG referans kâr bandına göre doğrusal ölçeklenir. */
  PROFIT_REFERENCE_BAND: 450000, // bu kadar kârda tam puan (70), bu kadar zararda 0 puan (56 haftalık oyun için ölçeklenmiştir)

  computeProfitScore(netProfit) {
    const score = 35 + (netProfit / Scoring.PROFIT_REFERENCE_BAND) * 35;
    return clamp(score, 0, 70);
  },

  /** Ek puan bileşeni: 0-30 arası. Başarılı tohumlama, gebelik ve başarılı doğum
   *  ödüllendirilir; ölüm, yanlış tedavi, mini oyun hataları ve geç kuruya
   *  çıkarma cezalandırılır. */
  computeBonusScore(state) {
    const t = state.totals;
    let bonus = 0;

    bonus += (t.successfulInsem || 0) * 1.5;      // her başarılı tohumlama
    bonus += (t.confirmedPregnancies || 0) * 2.5;  // her gebelik
    bonus += (t.successfulCalvings || 0) * 3.5;    // her başarılı doğum
    bonus += (t.correctTreatments || 0) * 1;       // doğru tedaviler

    bonus -= (t.aiOnPregnant || 0) * 2;          // muayene etmeden gebe hayvanı tohumlama
    bonus -= (t.pregnancyLossesFromAI || 0) * 3; // bunun yol açtığı gebelik kaybı
    bonus -= (t.deaths || 0) * 5;
    bonus -= (t.wrongTreatments || 0) * 1.5;
    bonus -= (t.miniGameErrors || 0) * 0.5;
    bonus -= (t.failedCalvings || 0) * 3;
    bonus -= (t.calfLosses || 0) * 2;

    const latePenalties = state.animals.filter(a => a.lateDryOffPenaltyApplied).length;
    bonus -= latePenalties * 2;

    return clamp(bonus, 0, 30);
  },

  compute(state) {
    const netProfit = state.cash - CONFIG.START_CASH;
    const profitScore = Scoring.computeProfitScore(netProfit);
    const bonusScore = Scoring.computeBonusScore(state);
    const total = clamp(profitScore + bonusScore, 0, 100);
    const aliveCount = state.animals.filter(a => a.alive).length;

    return {
      total: Math.round(total),
      breakdown: {
        profitScore: round1(profitScore),   // %70 ağırlık, 0-70 puan
        bonusScore: round1(bonusScore)       // %30 ağırlık, 0-30 puan
      },
      netProfit: round1(netProfit),
      aliveCount
    };
  }
};

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function round1(v) { return Math.round(v * 10) / 10; }
