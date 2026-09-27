/* =========================================================
   ui.js
   Tüm ekran render işlemleri ve kullanıcı etkileşimleri.
   Basit "template string + innerHTML" yaklaşımı kullanılır
   (derleyici/çatı gerektirmez, GitHub Pages'te doğrudan çalışır).
   ========================================================= */

const UI = {
  activeTab: "farm",   // oyun 3B çiftlik görünümüyle açılır
  farmPanel: null,     // 3B sahne üzerinde açık olan menü: barns | ration | ledger
  activeRationBarn: "start",

  /** Görsel + emoji yedekli (fallback) küçük yardımcı. Belirtilen dosya varsa gösterilir;
   *  yoksa (veya yüklenemezse) emoji otomatik olarak görünür kalır. Bu sayede assets/
   *  klasörüne konan Gemini görselleri hiçbir kod değişikliği gerekmeden devreye girer. */
  imgOrEmoji(src, emoji, objectPosition) {
    return `<span style="position:relative; display:flex; align-items:center; justify-content:center; width:100%; height:100%;">
      <span>${emoji}</span>
      <img src="${src}" alt="" loading="lazy"
        style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:${objectPosition || "center"}; border-radius:inherit;"
        onerror="this.remove()"
        onload="this.previousElementSibling.style.visibility='hidden'">
    </span>`;
  },

  /** Video + emoji yedekli yardımcı. assets/videos/ klasörüne Gemini (Veo) ile üretilmiş
   *  bir video konursa otomatik oynatılır; dosya yoksa/yüklenemezse emoji görünür kalır. */
  videoOrEmoji(src, emoji) {
    return `<div style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:56px;">
      <span>${emoji}</span>
      <video autoplay loop muted playsinline
        style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; border-radius:inherit;"
        onerror="this.remove()"
        onloadeddata="this.previousElementSibling.style.visibility='hidden'">
        <source src="${src}" type="video/mp4">
      </video>
    </div>`;
  },

  /* ---------------- ÖĞRENCİ NUMARASI DOĞRULAMA ----------------
     Kural: 9 karakter, tamamı rakam, soldan 3-7. karakterler (1-indeksli)
     "14030" olmalı. Aksi halde giriş reddedilir. */
  isValidStudentNo(no) {
    if (!no || no.length !== CONFIG.STUDENT_NO_LENGTH) return false;
    if (!/^\d{9}$/.test(no)) return false;
    const start = CONFIG.STUDENT_NO_FIXED_SEGMENT_START;
    const segment = no.substring(start, start + CONFIG.STUDENT_NO_FIXED_SEGMENT.length);
    return segment === CONFIG.STUDENT_NO_FIXED_SEGMENT;
  },

  /* ---------------- GİRİŞ EKRANI ---------------- */
  renderIntro() {
    const app = document.getElementById("app");
    const hasSave = Storage.hasSave();
    app.innerHTML = `
      <div class="intro-wrap">
        <div class="eyebrow">Eskil Meslek Yüksekokulu · Laborant ve Veteriner Sağlık Programı</div>
        <h1>LVS 2005 – Yem Bilgisi ve Hayvan Besleme</h1>
        <p>Bu oyun, LVS 2005 Yem Bilgisi ve Hayvan Besleme dersi kapsamında hazırlanmış bir eğitim ve
        değerlendirme oyunudur. Oyunda bir süt sığırcılığı işletmesinde <b>işletme müdürü</b> olarak görev
        yapacak ve 20 başlık işletmeyi <b>${CONFIG.TOTAL_WEEKS} hafta</b> boyunca yöneteceksiniz. Amacınız işletmeyi hem
        <b>sağlıklı</b> hem de <b>kârlı</b> şekilde yönetmektir. Oyunun sonunda elde edilen sonuç, ders ödev
        puanının %60'lık bölümünün değerlendirilmesinde kullanılacaktır.</p>

        <div class="divider"></div>

        <div class="field-row">
          <label>Öğrenci No</label>
          <input type="text" id="inpNo" placeholder="Örn. 201403001" maxlength="9">
          <div id="noError" class="warn-text" style="display:none; margin-top:4px;">Öğrenci Numaranızı Yanlış Girdiniz.</div>
        </div>
        <div class="field-row">
          <label>Ad</label>
          <input type="text" id="inpAd" placeholder="Adınız">
        </div>
        <div class="field-row">
          <label>Soyad</label>
          <input type="text" id="inpSoyad" placeholder="Soyadınız">
        </div>

        <div class="consent-box">
          <input type="checkbox" id="chkConsent">
          <label for="chkConsent">Bu ödevi kendi başıma gerçekleştireceğimi, oyun sırasında ikinci bir
          kişiden yardım almayacağımı ve oyun sonucunda oluşan puanı itiraz etmeden kabul edeceğimi
          onaylıyorum.</label>
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn-primary" id="btnStart" disabled>OYUNA BAŞLA</button>
          ${hasSave ? `<button class="btn-ghost" id="btnContinue">Kaldığım Yerden Devam Et</button>` : ""}
        </div>
        <p class="helper-text">Not: Oyun durumunuz tarayıcınızda otomatik olarak kaydedilir. Aynı tarayıcı
        ve cihazdan devam edebilirsiniz.</p>
      </div>
    `;

    const chk = document.getElementById("chkConsent");
    const btn = document.getElementById("btnStart");
    chk.addEventListener("change", () => { btn.disabled = !chk.checked; });
    document.getElementById("inpNo").addEventListener("input", () => {
      document.getElementById("noError").style.display = "none";
    });
    btn.addEventListener("click", () => {
      const noVal = document.getElementById("inpNo").value.trim();
      const noErrorEl = document.getElementById("noError");
      if (!UI.isValidStudentNo(noVal)) {
        noErrorEl.style.display = "block";
        return;
      }
      noErrorEl.style.display = "none";
      const student = {
        no: noVal,
        ad: document.getElementById("inpAd").value.trim() || "belirtilmedi",
        soyad: document.getElementById("inpSoyad").value.trim() || "belirtilmedi"
      };
      Game.newGame(student);
      UI.renderGame();
      // tanitici karakter: isci Ahmet, isletmeyi ve ekrani tanitir
      if (window.Intro) setTimeout(() => Intro.start(), 400);
    });
    const contBtn = document.getElementById("btnContinue");
    if (contBtn) {
      contBtn.addEventListener("click", () => {
        Game.loadGame();
        UI.renderGame();
        // Kaydi acan ogrenci tanitimi hic gormediyse Ahmet yine gelsin.
        if (window.Intro) setTimeout(() => Intro.start(), 400);
      });
    }
  },

  /* ---------------- OYUN ANA İSKELET ---------------- */
  renderGame() {
    const state = Game.state;
    if (state.gameOver) { UI.renderFinal(); return; }

    const app = document.getElementById("app");
    const aliveCount = state.animals.filter(a => a.alive).length;
    app.innerHTML = `
      <div class="topbar">
        <div class="brand">
          <div class="school">Eskil MYO · LVS Programı</div>
          <div class="course">Süt Sığırı İşletmesi – LVS 2005</div>
        </div>
        <div class="stat-strip">
          <div class="stat-pill">💰 <b>${state.cash.toFixed(0)} TL</b></div>
          <div class="stat-pill">🐄 <b>${aliveCount}</b> / 20 baş</div>
          <div class="stat-pill">👤 ${state.student.ad} ${state.student.soyad}</div>
        </div>
        <div class="week-stamp">HAFTA ${state.week} / ${CONFIG.TOTAL_WEEKS}</div>
      </div>

      ${UI._pendingCalvingBanner()}

      <!-- Menuler artik 3B sahnenin uzerinde (sol dock). Eski sekme cubugu kaldirildi. -->

      <div id="tabContent"></div>
    `;
    UI.renderTabContent();
    if (window.Farm3D && Farm3D.ready) Farm3D.sync();

    if (state.showWeeklyReport && state.lastWeeklyReport) {
      state.showWeeklyReport = false;
      Storage.save(state);
      UI.openWeeklyReport(state.lastWeeklyReport);
    }
  },

  /** Her yeni hafta başında, kapanan haftanın süt geliri/giderleri/net durumunu gösterir. */
  openWeeklyReport(r) {
    const netClass = r.netResult >= 0 ? "deficiency-ok" : "warn-text";
    UI.openModal(`
      <h2>Hafta ${r.week} Özeti</h2>
      <p class="helper-text">Kapanan haftanın finansal sonuçları:</p>
      <div class="final-grid">
        <div class="final-item"><div class="v mono">${r.milkLiters.toFixed(1)} L</div><div class="l">Satılan Çiğ Süt</div></div>
        <div class="final-item"><div class="v mono">${r.milkRevenue.toFixed(2)}</div><div class="l">Süt Geliri (TL)</div></div>
        <div class="final-item"><div class="v mono">${r.feedCost.toFixed(2)}</div><div class="l">Yem Gideri (TL)</div></div>
        <div class="final-item"><div class="v mono">${r.laborCost.toFixed(2)}</div><div class="l">İşçilik Gideri (TL)</div></div>
        <div class="final-item"><div class="v mono">${r.fuelCost.toFixed(2)}</div><div class="l">Mazot/Elektrik (TL)</div></div>
        <div class="final-item"><div class="v mono">${r.totalExpense.toFixed(2)}</div><div class="l">Toplam Gider (TL)</div></div>
      </div>
      <div class="divider"></div>
      <p style="text-align:center;" class="${netClass}" style="font-size:20px;">
        Net Durum: ${r.netResult >= 0 ? "+" : ""}${r.netResult.toFixed(2)} TL
      </p>
      <button class="btn-primary" style="display:block; margin: 10px auto 0;" onclick="UI.closeModal()">DEVAM ET</button>
    `);
  },

  _pendingCalvingBanner() {
    const pend = (Game.state.pendingCalvings || []).filter(id => {
      const a = Game.state.animals.find(x => x.id === id);
      return a && a.alive;
    });
    if (pend.length === 0) return "";
    return `<div class="pending-alert">🐮 Doğum zamanı gelen ${pend.length} hayvan var:
      ${pend.map(id => `<button class="btn-accent btn-sm" style="margin-left:6px" onclick="UI.openCalvingMinigame('${id}')">${id} – Doğuma Başla</button>`).join("")}
      </div>`;
  },

  /** Eski sekme sistemi kaldirildi; tum menuler 3B sahnenin uzerinde aciliyor.
   *  Fonksiyon geriye donuk uyumluluk icin duruyor (eski cagrilar panele yonlenir). */
  setTab(tab) {
    if (tab === "farm") { UI.farmPanel = null; }
    else { UI.farmPanel = tab; }
    UI.activeTab = "farm";
    UI.renderGame();
  },

  renderTabContent() {
    const el = document.getElementById("tabContent");
    if (!el) return;
    // 3B sahne DOM'dan koparilmadan once duzgun sokulur (WebGL baglami korunur)
    el.innerHTML = UI.farmTabHTML();
    if (UI.farmPanel === "ration") UI._wireRationInputs();
    UI._mountFarm3D();
  },

  /* ---------------- ÇİFTLİK (3B) SEKME ----------------
     Sahne yalnızca Game.state'i okur; oyun kuralları değişmez. */
  farmTabHTML() {
    const s = Game.state;
    // Not: kizgin/hasta hayvan SAYISI bilerek gosterilmiyor. Ogrenci bu bilgiyi
    // surunun icinde gozlem ve muayene ile bulmak zorunda.
    const canEndWeek = Game.allBarnsFed();
    const panel = UI.farmPanel;
    const PANELS = {
      barns: { title: "Ahırlar", icon: "🏚️" },
      ration: { title: "Rasyon Hazırlama", icon: "🌾" },
      ledger: { title: "İşletme Defteri", icon: "📒" }
    };

    return `
      <div class="farm3d-shell">
        <div id="farm3dHost" class="farm3d-host"></div>

        <div class="farm3d-dock">
          ${Object.keys(PANELS).map(k => `
            <button class="dock-btn ${panel === k ? "active" : ""}" onclick="UI.openFarmPanel('${k}')">
              <span class="ic">${PANELS[k].icon}</span><span class="lb">${PANELS[k].title}</span>
            </button>`).join("")}
          <button class="dock-btn ahmet" onclick="Intro.start(true)" title="İşçi Ahmet işletmeyi tanıtsın">
            <span class="ic">👋</span><span class="lb">Ahmet</span>
          </button>
          <button class="dock-btn sound" onclick="UI.toggleSound(this)" title="Sesi aç / kapat">
            <span class="ic">${(window.Sfx && Sfx.muted) ? "🔇" : "🔊"}</span><span class="lb">Ses</span>
          </button>
          <button class="dock-btn end-week ${canEndWeek ? "ready" : ""}" onclick="UI.endWeek()"
                  ${canEndWeek ? "" : "disabled"} title="${canEndWeek ? "Haftayı kapat" : "Önce tüm ahırları besleyin"}">
            <span class="ic">⏭</span><span class="lb">Haftayı Kapat</span>
          </button>
        </div>

        ${panel ? `
          <div class="farm3d-panel" id="farmPanel">
            <div class="fp-head">
              <h3>${PANELS[panel].icon} ${PANELS[panel].title}</h3>
              <button class="btn-ghost btn-sm" onclick="UI.closeFarmPanel()">Kapat ✕</button>
            </div>
            <div class="fp-body">
              ${panel === "barns" ? UI.barnsTabHTML(true)
                : panel === "ration" ? UI.rationTabHTML()
                : UI.ledgerTabHTML()}
            </div>
          </div>` : ""}
      </div>
      <p class="helper-text farm3d-help">
        Hayvana tıklayarak muayene/tohumlama menüsünü açabilirsiniz. Yem deposuna, ofise veya ahıra
        tıklarsanız ilgili menü açılır. İşçi; yem hazırlama, traktörle yem dağıtma, mobil üniteyle sağım
        ve kızgınlık gözlemi işlerini sırayla yapar.
      </p>`;
  },

  toggleSound(btn) {
    if (!window.Sfx) return;
    Sfx.init();
    Sfx.setMuted(!Sfx.muted);
    if (!Sfx.muted) { Sfx.startAmbient(); Sfx.ok(); } else { Sfx.stopAmbient(); }
    if (btn) btn.querySelector(".ic").textContent = Sfx.muted ? "🔇" : "🔊";
  },

  openFarmPanel(kind) {
    UI.farmPanel = (UI.farmPanel === kind) ? null : kind;
    UI.renderGame();
  },

  closeFarmPanel() {
    UI.farmPanel = null;
    UI.renderGame();
  },

  _mountFarm3D() {
    const host = document.getElementById("farm3dHost");
    if (!host) return;
    // 3B modul hic yuklenememisse (ornegin sayfa dosya olarak acilmissa
    // tarayici ES modullerini CORS gerekcesiyle engeller) kullaniciya
    // ne yapmasi gerektigini acikca anlat.
    if (!window.Farm3D) {
      host.innerHTML = UI._farm3dUnavailableHTML();
      return;
    }
    Farm3D.mount(host);
  },

  _farm3dUnavailableHTML() {
    const dosyaModu = location.protocol === "file:";
    return `
      <div class="farm3d-offline">
        <div class="f3o-icon">🏚️</div>
        <h3>3B çiftlik görünümü açılamadı</h3>
        ${dosyaModu ? `
          <p>Oyun <b>dosyaya çift tıklanarak</b> açılmış (adres çubuğunda
          <code>file:///...</code> yazıyor). Tarayıcılar bu modda 3B model
          dosyalarının yüklenmesine güvenlik gereği izin vermez.</p>
          <p><b>Çözüm – üç yoldan biri:</b></p>
          <ol>
            <li>Klasördeki <code>OYUNU BASLAT.bat</code> dosyasına çift tıklayın
                (oyunu küçük bir yerel sunucuyla açar).</li>
            <li>Veya oyunu GitHub Pages adresinden açın.</li>
            <li>Veya klasörde komut satırında: <code>py -m http.server 5183</code>
                yazıp tarayıcıda <code>http://localhost:5183</code> adresine gidin.</li>
          </ol>
          <p class="helper-text">Soldaki menüler (Ahırlar, Rasyon, İşletme Defteri)
          bu modda da normal çalışır; yalnızca 3B sahne görünmez.</p>
        ` : `
          <p>3B katman yüklenemedi. Tarayıcınız WebGL desteklemiyor olabilir
          veya model dosyalarına erişilemiyor.</p>
          <p class="helper-text">Oyunun diğer tüm bölümleri normal çalışmaya devam eder.</p>
        `}
      </div>`;
  },

  /* ---------------- AHIRLAR SEKME ---------------- */
  barnsTabHTML(inPanel) {
    const state = Game.state;
    const barnKeys = ["start", "end", "dry"];
    let html = "";
    barnKeys.forEach(bk => {
      const animals = state.animals.filter(a => a.barn === bk);
      const fed = state.fedThisWeek[bk];
      const headcount = state.animals.filter(a => a.alive && a.barn === bk).length;
      const barnWeeklyCost = Ration.weeklyCost(state.rations[bk], headcount);
      html += `
        <div class="panel barn-block">
          <div class="barn-banner">${UI.imgOrEmoji(ASSETS.barn[bk], "🏚️")}</div>
          <div class="panel-title-row">
            <div class="barn-header">
              <div class="barn-swatch ${bk}"></div>
              <h3 style="margin:0">${BARN_LABELS[bk]}</h3>
            </div>
            <div>
              ${fed
                ? `<span class="badge gebe">Bu hafta beslendi</span>`
                : `<button class="btn-primary btn-sm" onclick="UI.feedBarn('${bk}')">HAYVANLARI BESLE &middot; ${barnWeeklyCost.toFixed(2)} TL</button>`}
            </div>
          </div>
          <div class="animal-grid">
            ${animals.map(a => UI.cowCardHTML(a)).join("") || "<p class='helper-text'>Bu ahırda hayvan yok.</p>"}
          </div>
        </div>
      `;
    });

    const canEndWeek = Game.allBarnsFed();
    if (!inPanel) {
      html += `
        <div class="panel" style="text-align:center;">
          <button class="btn-accent" ${canEndWeek ? "" : "disabled"} onclick="UI.endWeek()">
            HAFTAYI KAPAT ➜ Hafta ${state.week + 1}
          </button>
          ${canEndWeek ? "" : `<p class="warn-text">Haftayı kapatmadan önce tüm ahırlar rasyonla beslenmelidir.</p>`}
        </div>`;
    } else if (!canEndWeek) {
      html += `<p class="warn-text" style="text-align:center;">Haftayı kapatmadan önce tüm ahırlar rasyonla beslenmelidir.</p>`;
    }
    return html;
  },

  /** Künye resmi: hayvanın 3B sahnedeki görüntüsünden üretilen vesikalık.
   *  3B katman yüklenmemişse (ör. WebGL yok) eski 2B fotoğrafa düşer. */
  cowPortrait(a) {
    const url = (window.Farm3D && Farm3D.getPortrait) ? Farm3D.getPortrait(a.id) : null;
    if (url) {
      return `<img class="cow-portrait" src="${url}" alt="${a.id}" title="${a.id}">`;
    }
    return UI.imgOrEmoji(`assets/cows/cow_${String(a.tag).padStart(2, "0")}.jpg`, "🐄");
  },

  cowCardHTML(a) {
    let statusClass = "status-bos";
    if (!a.alive) statusClass = "status-olu";
    else if (a.reproStatus === "gebe") statusClass = "status-gebe";
    else if (a.reproStatus === "tohumlandi") statusClass = "status-tohumlandi";

    const reproBadgeClass = a.reproStatus === "gebe" ? "gebe" : a.reproStatus === "tohumlandi" ? "tohumlandi" : "bos";
    const reproBadgeLabel = a.reproStatus === "gebe" ? "Gebe" : a.reproStatus === "tohumlandi" ? "Tohumlandı" : "Boş";

    return `
      <div class="cow-card ${statusClass}" onclick="${a.alive ? `UI.openAnimalModal('${a.id}')` : ""}">
        <div class="cow-avatar">${UI.cowPortrait(a)}</div>
        <div class="cow-id">${a.id}</div>
        <div class="cow-meta">
          ${a.isLactating && a.barn !== "dry" ? `Süt: ${a.dailyMilk.toFixed(1)} L/gün<br>` : ""}
          Laktasyon Hf: ${a.lactationWeek}<br>
          VKS: ${a.vks}
        </div>
        ${a.alive ? `<span class="badge ${reproBadgeClass}">${reproBadgeLabel}</span> <span class="badge bos">${Animals.behaviorWord(a)}</span>` : ""}
      </div>
    `;
  },

  feedBarn(barnKey) {
    const res = Game.feedBarnNow(barnKey);
    if (window.Sfx) { res.ok ? Sfx.cash() : Sfx.err(); }
    if (res.ok && window.Farm3D) Farm3D.onFeed(barnKey);
    UI.renderGame();
    if (!res.ok) {
      alert(res.msg);
      return;
    }
    alert(
      `${BARN_LABELS[barnKey]} beslendi.\n` +
      `${res.headcount} hayvan için ${res.cost.toFixed(2)} TL yem gideri kasadan düşüldü.`
    );
  },

  endWeek() {
    const res = Game.endWeek();
    if (!res.ok) { if (window.Sfx) Sfx.err(); alert(res.msg); return; }
    if (window.Sfx) Sfx.week();
    if (window.Farm3D) Farm3D.onWeekEnd();
    if (res.gameOver) { UI.renderFinal(); return; }
    UI.renderGame();
  },

  /* ---------------- RASYON SEKME ---------------- */
  rationTabHTML() {
    const bk = UI.activeRationBarn;
    const req = BARN_REQUIREMENTS[bk];
    const ration = Game.state.rations[bk];
    const totals = Ration.computeTotals(ration);
    const deficits = Ration.evaluateDeficiencies(bk, totals);
    const fed = Game.state.fedThisWeek[bk];
    const headcount = Game.state.animals.filter(a => a.alive && a.barn === bk).length;
    const weeklyCost = +(totals.dailyCost * 7 * headcount).toFixed(2);

    const rows = Object.keys(FEEDS).map(key => {
      const f = FEEDS[key];
      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="feed-thumb" style="width:40px; height:40px; border-radius:7px; overflow:hidden; flex-shrink:0; background:var(--cream-2); display:inline-flex; font-size:20px;">${UI.imgOrEmoji(f.icon, "🌾")}</span>
              <span>${f.name} <span class="helper-text">(${f.group})</span></span>
            </div>
          </td>
          <td class="mono">${(f.km * 100).toFixed(0)}%</td>
          <td class="mono">${f.hp}%</td>
          <td class="mono">${f.hs}%</td>
          <td class="mono">${f.me}</td>
          <td class="mono">${f.price.toFixed(2)} TL/kg</td>
          <td><input type="number" min="0" step="0.1" class="ration-input" data-feed="${key}" value="${ration[key]}"></td>
        </tr>
      `;
    }).join("");

    return `
      <div class="panel">
        <div class="panel-title-row">
          <h3>Rasyon Hazırlama</h3>
          <div class="tabs" style="border:none; margin:0;">
            ${["start","end","dry"].map(k => `<button class="tab-btn ${bk===k?"active":""}" onclick="UI.setRationBarn('${k}')">${BARN_LABELS[k]}</button>`).join("")}
          </div>
        </div>
        <p class="helper-text">Baş başına / günlük miktarları (kg olduğu gibi) girin. Rasyon kaydedildiği anda,
        bu ahırdaki <b>${headcount}</b> hayvan için haftalık yem maliyeti doğrudan kasadan düşülecektir.</p>

        <table class="ration-table">
          <thead>
            <tr><th>Yem</th><th>KM%</th><th>HP%</th><th>HS%</th><th>ME (Mcal/kgKM)</th><th>Fiyat</th><th>Miktar (kg/baş/gün)</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="nutrient-summary">
          <div><span>Kuru Madde</span>${totals.km} kg</div>
          <div><span>Ham Protein (KM'de)</span>${totals.hpPercent}%</div>
          <div><span>Ham Selüloz (KM'de)</span>${totals.hsPercent}%</div>
          <div><span>Metabolik Enerji</span>${totals.me} Mcal</div>
          <div><span>Rasyon Maliyeti (baş/gün)</span>${totals.dailyCost.toFixed(2)} TL</div>
          <div><span>Haftalık Toplam Maliyet</span>${weeklyCost.toFixed(2)} TL</div>
        </div>

        <div class="deficiency-list">
          ${deficits.length === 0
            ? `<span class="deficiency-ok">✓ Belirgin bir eksiklik bildirilmedi.</span>`
            : deficits.map(d => `<span class="deficiency-tag">${d}</span>`).join("")}
        </div>

        <div class="divider"></div>
        <button class="btn-primary" onclick="UI.saveRation('${bk}')">RASYONU KAYDET</button>
        ${fed
          ? `<span class="badge gebe" style="margin-left:10px;">Bu ahır bu hafta beslendi</span>`
          : `<span class="helper-text" style="margin-left:10px;">Kayıtlı rasyon her hafta korunur; değiştirmediğiniz sürece yeniden kaydetmeniz gerekmez.</span>`}
      </div>
    `;
  },

  setRationBarn(bk) {
    UI.activeRationBarn = bk;
    UI.renderTabContent();
  },

  _wireRationInputs() {
    document.querySelectorAll(".ration-input").forEach(inp => {
      inp.addEventListener("input", () => {
        const bk = UI.activeRationBarn;
        const key = inp.dataset.feed;
        const val = parseFloat(inp.value);
        Game.state.rations[bk][key] = isNaN(val) ? 0 : Math.max(0, val);
        // Sadece besin özetini/eksiklik listesini güncelle (input odağını kaybetmeden)
        UI._refreshRationSummaryOnly();
      });
    });
  },

  _refreshRationSummaryOnly() {
    const bk = UI.activeRationBarn;
    const totals = Ration.computeTotals(Game.state.rations[bk]);
    const deficits = Ration.evaluateDeficiencies(bk, totals);
    const headcount = Game.state.animals.filter(a => a.alive && a.barn === bk).length;
    const weeklyCost = +(totals.dailyCost * 7 * headcount).toFixed(2);
    const summaryEl = document.querySelector(".nutrient-summary");
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div><span>Kuru Madde</span>${totals.km} kg</div>
        <div><span>Ham Protein (KM'de)</span>${totals.hpPercent}%</div>
        <div><span>Ham Selüloz (KM'de)</span>${totals.hsPercent}%</div>
        <div><span>Metabolik Enerji</span>${totals.me} Mcal</div>
        <div><span>Rasyon Maliyeti (baş/gün)</span>${totals.dailyCost.toFixed(2)} TL</div>
        <div><span>Haftalık Toplam Maliyet</span>${weeklyCost.toFixed(2)} TL</div>
      `;
    }
    const defEl = document.querySelector(".deficiency-list");
    if (defEl) {
      defEl.innerHTML = deficits.length === 0
        ? `<span class="deficiency-ok">✓ Belirgin bir eksiklik bildirilmedi.</span>`
        : deficits.map(d => `<span class="deficiency-tag">${d}</span>`).join("");
    }
  },

  saveRation(bk) {
    const res = Game.saveRation(bk);
    UI.renderGame();
    alert(
      `Rasyon kaydedildi. ${res.headcount} hayvan için haftalık maliyeti ${res.cost.toFixed(2)} TL.\n` +
      `Bu tutar, ahırdaki hayvanları beslediğinizde kasadan düşülecek.\n` +
      `Rasyon değiştirmediğiniz sürece sonraki haftalarda aynen geçerli kalır.`
    );
  },

  /* ---------------- İŞLETME DEFTERİ SEKME ---------------- */
  ledgerTabHTML() {
    const t = Game.state.totals;
    const netProfit = Game.state.cash - CONFIG.START_CASH;
    return `
      <div class="grid-2">
        <div class="panel">
          <h3>Finansal Özet</h3>
          <div class="final-grid">
            <div class="final-item"><div class="v mono">${Game.state.cash.toFixed(0)}</div><div class="l">Kasa (TL)</div></div>
            <div class="final-item"><div class="v mono">${netProfit.toFixed(0)}</div><div class="l">Net Kâr (TL)</div></div>
            <div class="final-item"><div class="v mono">${t.milkRevenue.toFixed(0)}</div><div class="l">Toplam Süt Geliri</div></div>
            <div class="final-item"><div class="v mono">${(t.calfRevenue || 0).toFixed(0)}</div><div class="l">Buzağı Satış Geliri</div></div>
            <div class="final-item"><div class="v mono">${t.feedCost.toFixed(0)}</div><div class="l">Toplam Yem Gideri</div></div>
            <div class="final-item"><div class="v mono">${t.medCost.toFixed(0)}</div><div class="l">Toplam İlaç Gideri</div></div>
            <div class="final-item"><div class="v mono">${t.deaths}</div><div class="l">Hayvan Ölümü</div></div>
          </div>
        </div>
        <div class="panel">
          <h3>Olay Kaydı</h3>
          <div class="log-box">
            ${Game.state.log.map(l => `<div>${l}</div>`).join("") || "<div>Henüz kayıt yok.</div>"}
          </div>
        </div>
      </div>
    `;
  },

  /* ================= MODAL: HAYVAN DETAYI ================= */
  openModal(html) {
    const root = document.getElementById("modalRoot");
    root.innerHTML = `<div class="modal-card">${html}</div>`;
    root.classList.remove("hidden");
  },
  closeModal() {
    document.getElementById("modalRoot").classList.add("hidden");
  },

  openAnimalModal(id) {
    const a = Game.state.animals.find(x => x.id === id);
    if (!a) return;
    UI._currentAnimalId = id;
    UI.openModal(UI._animalModalBody(a));
  },

  _animalModalBody(a) {
    const canExamine = a.alive;
    // Boş hayvanlar tohumlanabilir; tohumlanmış ama gebe kalmayıp kızgınlığa geri
    // dönen hayvanlar da (gebelik muayenesi beklenmeden) yeniden tohumlanabilir.
    // Yalancı kızgınlık gösteren (gebe) hayvan da tohumlanabilir görünür: bu bilinçli
    // bir tuzaktır, öğrenci muayene ederse gebe olduğunu anlayıp vazgeçmelidir.
    const canInseminate = a.alive && !a.cystic &&
      (a.reproStatus === "bos" || (a.reproStatus === "tohumlandi" && (a.inHeat || a.falseHeat)));
    const canPregTest = a.alive && Reproduction.canPregnancyTest(a, Game.state.week);
    const canDryOff = a.alive && a.reproStatus === "gebe" && a.barn !== "dry";
    const canTreat = a.alive && (a.diseases.length > 0 || a.cystic);
    const canMoveBarn = a.alive && a.barn !== "dry";
    const otherBarn = a.barn === "start" ? "end" : "start";

    return `
      <div class="modal-close-row"><button class="btn-ghost btn-sm" onclick="UI.closeModal()">Kapat ✕</button></div>
      <div style="display:flex; gap:16px; align-items:center; margin-bottom: 10px;">
        <div class="cow-avatar" style="width:64px; flex-shrink:0; margin:0;">${UI.cowPortrait(a)}</div>
        <div>
          <h2 style="margin:0">${a.id}</h2>
          <div class="helper-text">${BARN_LABELS[a.barn]}</div>
        </div>
      </div>

      <div class="nutrient-summary">
        <div><span>Davranış</span>${Animals.behaviorWord(a)}</div>
        <div><span>Üreme Durumu</span>${a.reproStatus === "gebe" ? "Gebe (" + a.pregWeek + "/39 hf)" : a.reproStatus === "tohumlandi" ? "Tohumlandı" : "Boş"}</div>
      </div>
      <div class="nutrient-summary">
        <div><span>Süt Verimi</span>${a.isLactating && a.barn !== "dry" ? a.dailyMilk.toFixed(1) + " L/gün" : "-"}</div>
        <div><span>VKS</span>${a.vks}</div>
        <div><span>Laktasyon Haftası</span>${a.lactationWeek}</div>
      </div>

      <div class="divider"></div>
      <div id="examineResult"></div>

      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
        ${canExamine ? `<button class="btn-secondary" onclick="UI.examineAnimal('${a.id}')">MUAYENE ET</button>` : ""}
        ${canInseminate ? `<button class="btn-primary" onclick="UI.openInseminationMinigame('${a.id}')">TOHUMLA</button>` : ""}
        ${canPregTest ? `<button class="btn-gold" onclick="UI.doPregnancyTest('${a.id}')">GEBELİK MUAYENESİ YAP</button>` : ""}
        ${canDryOff ? `<button class="btn-accent" onclick="UI.doDryOff('${a.id}')">KURUYA ÇIKAR</button>` : ""}
        ${canTreat ? `<button class="btn-accent" id="treatTriggerBtn" onclick="UI.openTreatmentPanel('${a.id}')">TEDAVİ UYGULA</button>` : ""}
        ${canMoveBarn ? `<button class="btn-ghost" onclick="UI.moveAnimalBarn('${a.id}','${otherBarn}')">${BARN_LABELS[otherBarn]}'na Taşı</button>` : ""}
      </div>
    `;
  },

  examineAnimal(id) {
    const a = Game.state.animals.find(x => x.id === id);
    const exam = Health.examine(a);
    const pregText = a.reproStatus === "gebe"
      ? `Gebe (${a.pregWeek}/39. hafta)`
      : a.reproStatus === "tohumlandi"
        ? "Tohumlandı, gebelik durumu henüz test edilmedi"
        : "Gebe değil";
    document.getElementById("examineResult").innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
        <span style="width:44px; height:44px; border-radius:8px; overflow:hidden; flex-shrink:0; background:var(--cream-2); display:inline-flex; font-size:22px;">${UI.imgOrEmoji(ASSETS.icons.exam, "🩺")}</span>
        <h3 style="font-size:14px; margin:0;">Muayene Bulguları</h3>
      </div>
      <p style="font-size:13.5px; margin:0 0 8px 0;"><b>Gebelik durumu:</b> ${pregText}</p>
      <ul class="symptom-list">${exam.symptoms.map(s => `<li>${s}</li>`).join("")}</ul>
    `;
    // Tedavi paneli açıksa muayene bulguları onun yerini aldı; tetikleyici buton geri gelmeli
    UI._setTreatTriggerVisible(true);
  },

  doPregnancyTest(id) {
    const a = Game.state.animals.find(x => x.id === id);
    const res = Reproduction.performPregnancyTest(Game.state, a, Game.state.week);
    Storage.save(Game.state);
    alert(res.pregnant ? `${a.id}: Gebelik muayenesi sonucu GEBE.` : `${a.id}: Gebelik muayenesi sonucu BOŞ.`);
    UI.closeModal();
    UI.renderGame();
  },

  doDryOff(id) {
    const a = Game.state.animals.find(x => x.id === id);
    const res = Reproduction.dryOff(a);
    if (!res.ok) { alert(res.msg); return; }
    if (res.late) alert(`Uyarı: ${a.id} 31. gebelik haftasından sonra kuruya çıkarıldı. Sonraki laktasyonda süt kaybı yaşanacak.`);
    Storage.save(Game.state);
    UI.closeModal();
    UI.renderGame();
  },

  moveAnimalBarn(id, target) {
    const a = Game.state.animals.find(x => x.id === id);
    const res = Reproduction.moveBarn(a, target);
    if (!res.ok) { alert(res.msg); return; }
    Storage.save(Game.state);
    UI.closeModal();
    UI.renderGame();
  },

  /** Tedavi panelini açan buton ile panelin içindeki uygulama butonu aynı anda
   *  görünürse iki benzer "tedavi" butonu yan yana çıkıyordu. Panel açıkken
   *  tetikleyici buton gizlenir, panel kapanınca geri gelir. */
  _setTreatTriggerVisible(visible) {
    const btn = document.getElementById("treatTriggerBtn");
    if (btn) btn.hidden = !visible;
  },

  closeTreatmentPanel() {
    const box = document.getElementById("examineResult");
    if (box) box.innerHTML = "";
    UI._setTreatTriggerVisible(true);
  },

  openTreatmentPanel(id) {
    const options = Object.keys(DISEASES).map(code => `<option value="${code}">${DISEASES[code].name}</option>`).join("")
      + `<option value="kist">${CYST_INFO.name}</option>`;
    UI._setTreatTriggerVisible(false);
    document.getElementById("examineResult").innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
        <span style="width:44px; height:44px; border-radius:8px; overflow:hidden; flex-shrink:0; background:var(--cream-2); display:inline-flex; font-size:22px;">${UI.imgOrEmoji(ASSETS.icons.health, "💊")}</span>
        <h3 style="font-size:14px; margin:0;">Tedavi Seçimi</h3>
      </div>
      <p class="helper-text">Klinik bulgulara dayanarak uygun tedaviyi seçin.</p>
      <select id="treatSelect" style="padding:8px; border-radius:6px; border:1.5px solid var(--border); width:100%; margin-bottom:8px;">${options}</select>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn-accent" onclick="UI.applyTreatment('${id}')">SEÇİLEN TEDAVİYİ UYGULA</button>
        <button class="btn-ghost" onclick="UI.closeTreatmentPanel()">Vazgeç</button>
      </div>
    `;
  },

  applyTreatment(id) {
    const a = Game.state.animals.find(x => x.id === id);
    const code = document.getElementById("treatSelect").value;
    const res = Health.applyTreatment(Game.state, a, code);
    if (!res.ok) { alert(res.msg); return; }
    let msg = res.correct ? "Tedavi uygulandı. Hayvan iyileşme sürecine girdi." : "Tedavi uygulandı ancak klinik tablo devam ediyor.";
    if (res.correct && a.milkPartialBlockLiters > 0) {
      msg += `\n\nAntibiyotik arınma süresi nedeniyle önümüzdeki hafta sütünün ${a.milkPartialBlockLiters.toFixed(1)} litresi satılamayacak.`;
    } else if (res.correct && a.milkSaleBlockedWeeks > 0) {
      msg += `\n\nAntibiyotik/ilaç arınma süresi nedeniyle önümüzdeki ${a.milkSaleBlockedWeeks} hafta bu hayvanın sütü satılamayacak.`;
    }
    alert(msg);
    Storage.save(Game.state);
    UI.closeModal();
    UI.renderGame();
  },

  /* ================= MİNİ OYUN: TOHUMLAMA ================= */
  openInseminationMinigame(id) {
    UI._currentAnimalId = id;
    UI._aiStepOrder = UI._shuffle(Insemination.STEPS.map((s, i) => i));
    UI._aiDone = [];
    UI._aiNextExpected = 0;
    UI._aiSessionErrors = 0;
    UI._renderInseminationSteps();
  },

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  _renderInseminationSteps() {
    const id = UI._currentAnimalId;
    const remaining = UI._aiStepOrder.filter(idx => !UI._aiDone.includes(idx));
    if (remaining.length > 0) {
      UI.openModal(`
        <div class="modal-close-row"><button class="btn-ghost btn-sm" onclick="UI.closeModal()">İptal ✕</button></div>
        <h2>Tohumlama İşlemi – ${id}</h2>
        <p class="helper-text">İşlem adımlarını doğru sırayla tıklayın. Yanlış sırayla tıklarsanız puan kaybedersiniz.</p>
        <p class="mono" style="margin:8px 0;">Tamamlanan adım: ${UI._aiDone.length} / ${Insemination.STEPS.length}</p>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${remaining.map(idx => `
            <button class="btn-ghost" style="display:flex; align-items:center; gap:12px; text-align:left; padding:10px 14px;" onclick="UI.clickAiStep(${idx})">
              <span style="width:48px; height:48px; border-radius:8px; overflow:hidden; flex-shrink:0; background:var(--cream-2); display:inline-flex; font-size:24px;">${UI.imgOrEmoji(INSEMINATION_STEP_ASSETS[idx].icon, INSEMINATION_STEP_ASSETS[idx].emoji)}</span>
              <span>${Insemination.STEPS[idx]}</span>
            </button>
          `).join("")}
        </div>
      `);
      return;
    }
    // Tüm adımlar tamamlandı
    UI.openModal(`
      <h2>Tohumlama İşlemi – ${id}</h2>
      <div style="width:100%; aspect-ratio:16/9; max-height:240px; border-radius:10px; overflow:hidden; margin-bottom:12px; display:flex; align-items:center; justify-content:center; font-size:64px; background:var(--cream-2);">${UI.imgOrEmoji("assets/minigames/insemination_process.png", "🐄", "center 55%")}</div>
      <p class="helper-text">Tüm işlem adımları tamamlandı.</p>
      <button class="btn-primary" onclick="UI.performInsemination('${id}')">TOHUMLAMAYI ONAYLA</button>
    `);
  },

  clickAiStep(idx) {
    if (idx === UI._aiNextExpected) {
      UI._aiDone.push(idx);
      UI._aiNextExpected += 1;
    } else {
      UI._aiSessionErrors += 1;
      Game.state.totals.miniGameErrors = (Game.state.totals.miniGameErrors || 0) + 1;
      Storage.save(Game.state);
    }
    UI._renderInseminationSteps();
  },

  performInsemination(id) {
    const evalRes = Insemination.evaluateAttempt(UI._aiSessionErrors);
    const a = Game.state.animals.find(x => x.id === id);
    Reproduction.registerInsemination(Game.state, a, Game.state.week, evalRes.success);
    Storage.save(Game.state);
    alert(`${id} tohumlandı. Sonuç, ileriki haftalarda gebelik muayenesi veya kızgınlık takibiyle belli olacak.`);
    UI.closeModal();
    UI.renderGame();
  },

  /* ================= MİNİ OYUN: DOĞUM ================= */
  openCalvingMinigame(id) {
    UI._currentAnimalId = id;
    UI._calvingStageIndex = 0;
    UI._calvingResults = [];
    UI._calvingStageOrder = UI._shuffle(["yarim_saat", "bir_saat", "mudahale"]);
    UI._renderCalvingStage();
  },

  _renderCalvingStage() {
    const idx = UI._calvingStageIndex;
    const stage = Calving.STAGES[idx];
    const id = UI._currentAnimalId;
    const labels = { yarim_saat: "Yarım Saat Bekle", bir_saat: "Bir Saat Bekle", mudahale: "Müdahale Et" };
    const order = UI._calvingStageOrder || ["yarim_saat", "bir_saat", "mudahale"];
    const stageAsset = CALVING_STAGE_ASSETS[idx];
    UI.openModal(`
      <h2>Doğum Süreci – ${id}</h2>
      <div style="width:100%; aspect-ratio:16/9; max-height:240px; border-radius:10px; overflow:hidden; margin-bottom:12px; display:flex; align-items:center; justify-content:center; font-size:64px; background:var(--cream-2);">${UI.imgOrEmoji(stageAsset.icon, stageAsset.emoji, "center 68%")}</div>
      <div class="step-box">
        <h3 style="margin-top:0;">Aşama ${idx + 1}/4: ${stage.label}</h3>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
          ${order.map(action => `<button class="btn-ghost" onclick="UI.answerCalvingStage('${action}')">${labels[action]}</button>`).join("")}
        </div>
      </div>
    `);
  },

  answerCalvingStage(action) {
    const idx = UI._calvingStageIndex;
    const res = Calving.evaluateStage(idx, action);
    if (!res.correct) {
      Game.state.totals.miniGameErrors = (Game.state.totals.miniGameErrors || 0) + 1;
      Storage.save(Game.state);
    }
    UI._calvingResults.push(res);
    UI._calvingStageIndex += 1;
    UI._calvingStageOrder = UI._shuffle(["yarim_saat", "bir_saat", "mudahale"]);
    if (UI._calvingStageIndex < Calving.STAGES.length) {
      UI._renderCalvingStage();
    } else {
      UI._resolveCalving();
    }
  },

  _resolveCalving() {
    const outcome = Calving.resolveOutcome(UI._calvingResults);
    UI._calvingOutcome = outcome;
    if (!outcome.success) {
      const a = Game.state.animals.find(x => x.id === UI._currentAnimalId);
      Calving.applyCalvingResult(Game.state, a, Game.state.week, outcome);
      Game.state.pendingCalvings = (Game.state.pendingCalvings || []).filter(x => x !== a.id);
      Storage.save(Game.state);
      UI.openModal(`
        <h2>Doğum Sonucu</h2>
        <div style="width:100%; aspect-ratio:16/9; max-height:240px; border-radius:10px; overflow:hidden; margin-bottom:12px; display:flex; align-items:center; justify-content:center; font-size:64px; background:var(--cream-2);">${UI.imgOrEmoji("assets/minigames/calving_stage4.png", "😔", "center 68%")}</div>
        <p>Doğum süreci başarısız yönetildi. ${outcome.calfSurvives ? "" : "Buzağı kaybedildi."}</p>
        <button class="btn-primary" onclick="UI.closeModal(); UI.renderGame();">TAMAM</button>
      `);
      return;
    }
    UI._calfCareChoices = [];
    UI._calfCareShuffledOrder = UI._shuffle(Calving.CALF_CARE_CORRECT_ORDER.slice());
    UI._renderCalfCareStep();
  },

  _renderCalfCareStep() {
    const remaining = UI._calfCareShuffledOrder.filter(s => !UI._calfCareChoices.includes(s));
    UI.openModal(`
      <h2>Doğum Sonrası Buzağı Bakımı</h2>
      <div style="width:100%; aspect-ratio:16/9; max-height:240px; border-radius:10px; overflow:hidden; margin-bottom:12px; display:flex; align-items:center; justify-content:center; font-size:64px; background:var(--cream-2);">${UI.imgOrEmoji("assets/minigames/calf_care_scene.png", "🐮", "center 60%")}</div>
      <p class="helper-text">Uygulamak istediğiniz işlemi sırayla seçin (adım ${UI._calfCareChoices.length + 1}/4).
      Yanlış sırayla seçerseniz puan kaybedersiniz.</p>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${remaining.map(s => `<button class="btn-ghost" onclick="UI.chooseCalfCare('${s.replace(/'/g, "\\'")}')">${s}</button>`).join("")}
      </div>
    `);
  },

  chooseCalfCare(step) {
    const expectedNext = Calving.CALF_CARE_CORRECT_ORDER[UI._calfCareChoices.length];
    if (step !== expectedNext) {
      Game.state.totals.miniGameErrors = (Game.state.totals.miniGameErrors || 0) + 1;
      Storage.save(Game.state);
    }
    UI._calfCareChoices.push(step);
    if (UI._calfCareChoices.length < Calving.CALF_CARE_CORRECT_ORDER.length) {
      UI._renderCalfCareStep();
    } else {
      const evalRes = Calving.evaluateCalfCareOrder(UI._calfCareChoices);
      const a = Game.state.animals.find(x => x.id === UI._currentAnimalId);
      Calving.applyCalvingResult(Game.state, a, Game.state.week, UI._calvingOutcome);
      Game.state.pendingCalvings = (Game.state.pendingCalvings || []).filter(x => x !== a.id);
      Storage.save(Game.state);
      UI.openModal(`
        <h2>Doğum Tamamlandı</h2>
        <div style="width:100%; aspect-ratio:16/9; max-height:240px; border-radius:10px; overflow:hidden; margin-bottom:12px; display:flex; align-items:center; justify-content:center; font-size:64px; background:var(--cream-2);">${UI.imgOrEmoji("assets/minigames/calving_success.png", "🎉", "center 60%")}</div>
        <p>${a.id} başarıyla doğum yaptı ve yeni laktasyona başladı.</p>
        ${UI._calvingOutcome.calfSurvives ? `<p>Buzağı satıldı: <b>+${CONFIG.CALF_SALE_PRICE.toLocaleString("tr-TR")} TL</b> kasaya eklendi.</p>` : ""}
        <p class="helper-text">Buzağı bakım sırası doğruluğu: ${evalRes.correctSteps}/${evalRes.total}</p>
        <p class="helper-text">Gönüllü bekleme süresi: bu hayvan doğumdan sonraki ilk 8 hafta tohumlanmaz;
        ilk kızgınlık laktasyonun 8-9. haftasında beklenir.</p>
        <button class="btn-primary" onclick="UI.closeModal(); UI.renderGame();">TAMAM</button>
      `);
    }
  },

  /* ================= FİNAL EKRANI ================= */
  renderFinal() {
    const state = Game.state;
    const score = Scoring.compute(state);
    const t = state.totals;
    const app = document.getElementById("app");

    const tier = score.total >= CONFIG.ENDING_HIGH_SCORE ? "high"
      : score.total < CONFIG.ENDING_LOW_SCORE ? "low" : "mid";
    const ending = ENDINGS[tier];

    app.innerHTML = `
      <div class="panel" style="max-width:720px; margin: 30px auto;">
        <h1 style="text-align:center;">OYUN TAMAMLANDI</h1>
        <h2 style="text-align:center; color:var(--rust-dark);">${ending.emoji} ${ending.title}</h2>

        <div style="width:100%; aspect-ratio:16/9; border-radius:12px; overflow:hidden; border:1px solid var(--border); background:linear-gradient(135deg, #EDE6D3, #DDD2B4); margin: 14px 0;">
          ${UI.videoOrEmoji(ending.video, ending.emoji)}
        </div>

        <div class="final-score">${score.total}</div>
        <div class="final-score-label">/ 100 – Final Puanı</div>
        <p class="helper-text" style="text-align:center;">
          Kâr Puanı (%70 ağırlık): <b>${score.breakdown.profitScore}</b> / 70 &nbsp;·&nbsp;
          Ek Puan (%30 ağırlık): <b>${score.breakdown.bonusScore}</b> / 30
        </p>

        <div class="final-grid">
          <div class="final-item"><div class="v mono">${score.netProfit.toFixed(0)}</div><div class="l">Net İşletme Kârı (TL)</div></div>
          <div class="final-item"><div class="v mono">${t.milkRevenue.toFixed(0)}</div><div class="l">Toplam Süt Geliri</div></div>
          <div class="final-item"><div class="v mono">${(t.calfRevenue || 0).toFixed(0)}</div><div class="l">Buzağı Satış Geliri</div></div>
          <div class="final-item"><div class="v mono">${t.feedCost.toFixed(0)}</div><div class="l">Toplam Yem Gideri</div></div>
          <div class="final-item"><div class="v mono">${t.medCost.toFixed(0)}</div><div class="l">Toplam İlaç Gideri</div></div>
          <div class="final-item"><div class="v mono">${t.deaths}</div><div class="l">Hayvan Ölümü</div></div>
          <div class="final-item"><div class="v mono">${t.confirmedPregnancies || 0}</div><div class="l">Toplam Gebelik</div></div>
          <div class="final-item"><div class="v mono">${t.successfulInsem}</div><div class="l">Başarılı Tohumlama</div></div>
          <div class="final-item"><div class="v mono">${t.aiOnPregnant || 0}</div><div class="l">Gebe Hayvana Tohumlama</div></div>
          <div class="final-item"><div class="v mono">${t.pregnancyLossesFromAI || 0}</div><div class="l">Bundan Kaynaklı Gebelik Kaybı</div></div>
          <div class="final-item"><div class="v mono">${t.successfulCalvings}</div><div class="l">Başarılı Doğum</div></div>
          <div class="final-item"><div class="v mono">${(t.miniGameErrors||0)+(t.wrongTreatments||0)}</div><div class="l">Mini Oyun Hataları</div></div>
        </div>

        <div class="divider"></div>
        <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
          <button class="btn-secondary" onclick="UI.submitToSheets()">SONUCU GÖNDER</button>
          <button class="btn-primary" onclick="CSV.download(Game.state, Scoring.compute(Game.state))">CSV İNDİR</button>
        </div>
        <p class="helper-text" style="text-align:center;">Google E-Tablo bağlantısı yapılandırılmadıysa "Sonucu Gönder"
        başarısız olur; bu durumda CSV dosyasını indirip öğretim elemanınıza iletebilirsiniz.</p>
      </div>
    `;
  },

  async submitToSheets() {
    const score = Scoring.compute(Game.state);
    const res = await Sheets.submit(Game.state, score);
    if (res.ok) alert("Sonuç başarıyla gönderildi.");
    else alert("Gönderim başarısız oldu. Lütfen CSV İNDİR seçeneğini kullanıp dosyayı öğretim elemanınıza iletin.");
  }
};
