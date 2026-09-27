/* =========================================================
   insemination.js
   Tohumlama mini oyunu: öğrenci 7 işlem adımını doğru sırayla
   uygulamalıdır (sıcaklık/süre girişi YOKTUR). Yanlış sırayla
   tıklama puan kaybettirir. Öğrenci başarısız olduğunu anında
   öğrenmez; sonuç gebelik muayenesi veya tekrar kızgınlık ile
   ortaya çıkar (madde 24).
   ========================================================= */

const Insemination = {
  /** Kanonik (doğru) sıra - dizideki index sırası doğru sırayı temsil eder. */
  STEPS: [
    "Sperma payetini tanktan al",
    "Payeti sıcak suya at",
    "Payeti kurula",
    "Payetin ucunu kes",
    "Payeti pistoleye yerleştir",
    "Kılıfı tak",
    "Hayvanı tohumla"
  ],

  /** Bir tohumlama denemesinin başarısını, o oturumda yapılan yanlış sıralama
   *  sayısına göre belirler. Hatasız tamamlanan tohumlama başarılı sayılır. */
  evaluateAttempt(errorCount) {
    return { success: errorCount === 0 };
  }
};
