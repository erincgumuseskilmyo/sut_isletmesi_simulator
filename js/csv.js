/* =========================================================
   csv.js
   Final sonuçların CSV olarak indirilmesi (madde 47).
   ========================================================= */

const CSV = {
  buildRow(state, score) {
    const t = state.totals;
    const fields = [
      state.student.no,
      state.student.ad,
      state.student.soyad,
      score.total,
      score.netProfit,
      round1(t.milkRevenue),
      round1(t.calfRevenue),
      round1(t.feedCost),
      round1(t.medCost),
      t.deaths || 0,
      state.animals.filter(a => a.reproStatus === "gebe").length,
      t.calvesBorn || 0,
      t.successfulInsem || 0,
      t.successfulCalvings || 0,
      (t.miniGameErrors || 0) + (t.wrongTreatments || 0)
    ];
    return fields;
  },

  headers: [
    "Ogrenci No", "Ad", "Soyad", "Final Puani", "Net Kar",
    "Toplam Sut Geliri", "Buzagi Satis Geliri", "Toplam Yem Gideri", "Toplam Ilac Gideri",
    "Olen Hayvan Sayisi", "Gebe Hayvan Sayisi", "Dogan Buzagi Sayisi",
    "Basarili Tohumlama Sayisi", "Basarili Dogum Sayisi", "Mini Oyun Hata Sayisi"
  ],

  download(state, score) {
    const row = CSV.buildRow(state, score);
    const csvContent = CSV.headers.join(";") + "\n" + row.join(";");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sonuc_${state.student.no || "ogrenci"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

function round1(v) { return Math.round((v || 0) * 10) / 10; }
