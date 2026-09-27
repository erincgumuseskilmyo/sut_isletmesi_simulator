/* =========================================================
   sheets.js
   Sonuçların bir Google Apps Script Web App uç noktasına
   gönderilmesi. GitHub Pages üzerinde HİÇBİR API anahtarı
   veya özel kimlik bilgisi saklanmaz - yalnızca herkese açık
   "Web App URL" kullanılır.

   KURULUM (öğretim elemanı tarafından bir kere yapılır):
   1) Bir Google E-Tablo oluşturun.
   2) Uzantılar > Apps Script açın, aşağıdaki gibi bir script yazın:

      function doPost(e) {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
        const data = JSON.parse(e.postData.contents);
        sheet.appendRow([
          new Date(), data.ogrenciNo, data.ad, data.soyad, data.finalPuani,
          data.netKar, data.sutGeliri, data.yemGideri, data.ilacGideri,
          data.olenHayvan, data.gebeHayvan, data.doganBuzagi,
          data.basariliTohumlama, data.basariliDogum, data.miniOyunHata
        ]);
        return ContentService.createTextOutput("OK");
      }

   3) Dağıt > Yeni Dağıtım > Web Uygulaması: "Herkes" erişebilsin.
   4) Verilen Web App URL'sini aşağıdaki SHEETS_WEB_APP_URL alanına
      (index.html'de veya burada) girin.
   ========================================================= */

const Sheets = {
  WEB_APP_URL: "", // <-- Öğretim elemanı burayı kendi Apps Script Web App URL'si ile doldurmalı

  async submit(state, score) {
    if (!Sheets.WEB_APP_URL) {
      return { ok: false, reason: "no_url" };
    }
    const t = state.totals;
    const payload = {
      ogrenciNo: state.student.no,
      ad: state.student.ad,
      soyad: state.student.soyad,
      finalPuani: score.total,
      netKar: score.netProfit,
      sutGeliri: t.milkRevenue,
      buzagiGeliri: t.calfRevenue || 0,
      yemGideri: t.feedCost,
      ilacGideri: t.medCost,
      olenHayvan: t.deaths || 0,
      gebeHayvan: state.animals.filter(a => a.reproStatus === "gebe").length,
      doganBuzagi: t.calvesBorn || 0,
      basariliTohumlama: t.successfulInsem || 0,
      basariliDogum: t.successfulCalvings || 0,
      miniOyunHata: (t.miniGameErrors || 0) + (t.wrongTreatments || 0)
    };
    try {
      await fetch(Sheets.WEB_APP_URL, {
        method: "POST",
        mode: "no-cors", // Apps Script Web App CORS kısıtlaması nedeniyle
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      // no-cors modunda yanıt okunamaz; gönderim varsayılan olarak başarılı kabul edilir.
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: "network_error", error: e };
    }
  }
};
