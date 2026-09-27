/* =========================================================
   storage.js
   Tarayıcı localStorage üzerinden otomatik oyun kaydı.
   ========================================================= */

const Storage = {
  KEY: "eskil_lvs2005_sut_sigiri_save_v1",

  save(state) {
    try {
      localStorage.setItem(Storage.KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn("Kayıt başarısız:", e);
      return false;
    }
  },

  load() {
    try {
      const raw = localStorage.getItem(Storage.KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("Kayıt okunamadı:", e);
      return null;
    }
  },

  clear() {
    localStorage.removeItem(Storage.KEY);
  },

  hasSave() {
    return !!localStorage.getItem(Storage.KEY);
  }
};
