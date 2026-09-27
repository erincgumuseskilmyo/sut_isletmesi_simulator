/* =========================================================
   intro.js — Tanıtıcı karakter: İŞÇİ AHMET

   Ahmet oyunun başında gelir, işletmeyi ve ekranı tanıtır:
   "ne nerede yapılıyor" anlatır. DİKKAT: Ahmet YARDIM ETMEZ.
   Hangi yemi kaç kilo vereceğini, hangi hayvanı ne zaman
   tohumlayacağını, neyin hastalık olduğunu SÖYLEMEZ; bunlar
   öğrencinin değerlendirilecek kararlarıdır. Ahmet yalnızca
   düğmelerin ve ekranların ne işe yaradığını gösterir.

   Oyuncuya hitap: girişte yazılan ada göre "ağbii" / "abula".
   ========================================================= */

const Intro = {
  PHOTO: "assets/ui/ahmet.webp",

  /* Yaygın Türkçe kadın adları. Liste tanımadığı adda "ağbii" der;
     öğretim elemanı gerekirse buraya ad ekleyebilir. */
  KADIN_ADLARI: [
    "ayse","fatma","emine","hatice","zeynep","elif","meryem","sultan","hanife","havva",
    "zehra","merve","busra","esra","seda","sevgi","sevim","selma","semra","serpil",
    "nur","nurcan","nuray","nurgul","gul","gulsum","gulay","gulcan","gulten","gulsen",
    "ozlem","ozge","pinar","rabia","rukiye","sibel","songul","sengul","tugba","tugce",
    "yasemin","yildiz","zeliha","zubeyde","aysel","aynur","asli","aslihan","aysenur",
    "bahar","banu","basak","belgin","berna","betul","beyza","bilge","buket","burcu",
    "canan","ceren","cigdem","damla","deniz","derya","dilek","dilan","duygu","ebru",
    "eda","ela","elvan","emel","ece","ekin","eylul","ezgi","feride","figen","filiz",
    "funda","gamze","gizem","gonca","gonul","hacer","halime","handan","hilal","hulya",
    "ilknur","ilayda","irem","isil","kader","kevser","kubra","lale","leyla","melek",
    "melike","meltem","mine","muazzez","munevver","naz","nazli","nazmiye","nesrin",
    "nihal","nilgun","nilufer","nesibe","oya","perihan","pelin","rana","reyhan","ruya",
    "saadet","sacide","sadiye","sare","sebnem","secil","sedef","selin","sema","sena",
    "serap","sevda","sevil","sevinc","sila","simge","sinem","sueda","suheyla","tuba",
    "tulay","tulin","ulku","umran","vildan","yaren","yesim","zahide","zerrin","zeliha",
    "cansu","cemile","dudu","emsal","esma","ferhan","gulizar","hayriye","huriye","ipek",
    "kamile","kiymet","medine","mukaddes","munire","nebahat","nefise","nermin","nevin",
    "ozden","rahime","remziye","saliha","sariye","sevgul","seyma","tuncay","ummuhan",
    "yurdanur","zekiye","zeyneb","zeynep","beren","defne","duru","elif","ela","zara"
  ],

  /** Girişte yazılan ada göre hitap seçer. */
  hitap(ad) {
    const t = String(ad || "")
      .trim().split(/\s+/)[0]
      .toLocaleLowerCase("tr-TR")
      .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
      .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u");
    return Intro.KADIN_ADLARI.includes(t) ? "abula" : "ağbii";
  },

  /** Anlatım kartları. Her biri Ahmet'in ağzından, sadece MEKANİK anlatır. */
  kartlar(h) {
    const H = h.charAt(0).toLocaleUpperCase("tr-TR") + h.slice(1);
    return [
      {
        b: "Selamünaleyküm",
        t: `Hoş geldin ${h}. Ben Ahmet, bu çiftlikte işçiyim. Sen patronsun, ben elimden
            geleni yaparım. 56 hafta beraberiz, yani dört mevsim.<br><br>
            Sana burayı bi gezdireyim de neyin nerede olduğunu bil. Ama şunu baştan
            söyliyim: <b>kararları ben vermem</b>. Hangi yemi ne kadar vereceksin,
            hangi hayvanı ne zaman tohumlayacaksın — ona sen karar vereceksin.`
      },
      {
        b: "Burası bizim işletme",
        t: `Ortada gördüğün uzun yer laktasyon ahırı. Ortasından geçen yol var ya,
            oradan traktörle yem dağıtıyorum. Yolun iki yanı yemleme yeri, arkaları da
            duraklar — inekler orada yatıp dinlenir.<br><br>
            Karşıda kuru ineklerin ahırı, yanında yem deposu, onun da yanında traktörü
            park ettiğim yer. Sağda ofis, süt soğutma tankı, bir de doğumhaneyle
            tedavi bölümü var.`
      },
      {
        b: "Ekranı nasıl çevirirsin",
        t: `Sağ üstteki oklarla çiftliği <b>dört bir yandan</b> görebilirsin: güney, batı,
            kuzey, doğu. Klavyeden sağ-sol ok tuşları da aynı işi yapar.<br><br>
            <b>＋ −</b> ile yaklaşıp uzaklaşırsın, yukarı-aşağı ok tuşları da olur.
            <b>Çatı</b> düğmesine basarsan ahırın çatısı kalkar, içerisi görünür.`
      },
      {
        b: "Soldaki üç defter",
        t: `Sol taraftaki düğmeler senin işlerin:<br>
            <b>🏚️ Ahırlar</b> — hayvanları buradan besliyorsun, listeyi buradan görüyorsun.<br>
            <b>🌾 Rasyon Hazırlama</b> — her ahır için yem miktarlarını buraya yazıyorsun.<br>
            <b>📒 İşletme Defteri</b> — kasa, gelir, gider hepsi burada.<br><br>
            İstersen düğmeye basma; doğrudan <b>binaya tıkla</b> da olur. Yem deposuna
            tıklarsan rasyon, ofise tıklarsan defter açılır.`
      },
      {
        b: "Yem işi sende",
        t: `Rasyon ekranında yemlerin kuru maddesi, proteini, selülozu ve enerjisi yazılı.
            Sen kaç kilo vereceğini yazacaksın, <b>baş başına günlük</b>.<br><br>
            Kaydettiğin an parası kasadan düşer. Ahırları beslemeden hafta kapanmaz,
            onu söyliyim. Ne kadar vereceğini sorma bana ${h}, benim işim taşımak. 😊`
      },
      {
        b: "Hayvanı tanımak",
        t: `Bir ineğin üstüne tıkla; künyesi açılır. Orada muayene edersin, tohumlarsın,
            gebelik muayenesi yaparsın, kuruya çıkarırsın, ilaç verirsin.<br><br>
            Bazı hayvanların başında <b>?</b> çıkar. O demek ki bir şey var — ama ne
            olduğunu <b>muayene etmeden anlayamazsın</b>. Gebe olanların başında ayrı
            bir işaret olur, o kadar. Gerisi senin gözüne kalmış.`
      },
      {
        b: "Ben ve tekniker",
        t: `Yeşil işaretli olan benim. Yem deposundan balyayı alır, karma makinesine
            atarım; traktörle yolu dolaşıp yemliklere yem bırakırım. Sonra mobil
            üniteyle sağarım, sütü tanka boşaltırım, bir de kızgınlık gözlemi yaparım.<br><br>
            Mavi işaretli beyaz önlüklü olan <b>veteriner sağlık teknikeri</b>.
            O da hasta hayvanları muayene eder, doğum olursa başında bekler.`
      },
      {
        b: "Hafta kapanınca",
        t: `Bütün ahırları besledikten sonra <b>Haftayı Kapat</b> düğmesi yanıp söner.
            Bastın mı hafta biter; sütün satılır, giderin düşer, önüne haftanın hesabı gelir.<br><br>
            Haftalar geçtikçe mevsim döner — yaz, sonbahar, kış, ilkbahar. 56 hafta
            dolunca işletmenin kârına ve yaptığın işlere göre notun çıkar.`
      },
      {
        b: "Kolay gelsin",
        t: `${H}, işletme sana emanet. Bir daha anlatmamı istersen soldaki
            <b>👋 Ahmet</b> düğmesine basman yeter.<br><br>
            Hadi hayırlısı olsun. Ben tarafa geçiyorum, hayvanlar aç. 🐄`
      }
    ];
  },

  step: 0,

  start(force) {
    if (!force) {
      try {
        if (localStorage.getItem("lvs_intro_gorüldu") === "1") return;
      } catch (e) {}
    }
    Intro.step = 0;
    Intro.render();
  },

  render() {
    const g = (typeof Game !== "undefined") ? Game : null;
    const ad = (g && g.state && g.state.student && g.state.student.ad) || "";
    const h = Intro.hitap(ad);
    const cards = Intro.kartlar(h);
    const i = Math.max(0, Math.min(cards.length - 1, Intro.step));
    const c = cards[i];
    const son = i === cards.length - 1;

    UI.openModal(`
      <div class="ahmet-wrap">
        <div class="ahmet-foto">
          <img src="${Intro.PHOTO}" alt="İşçi Ahmet">
          <div class="ahmet-ad">İŞÇİ AHMET</div>
        </div>
        <div class="ahmet-soz">
          <div class="ahmet-bubble">
            <h3>${c.b}</h3>
            <p>${c.t}</p>
          </div>
          <div class="ahmet-alt">
            <div class="ahmet-nokta">
              ${cards.map((_, k) => `<span class="${k === i ? "on" : ""}"></span>`).join("")}
            </div>
            <div class="ahmet-btn">
              ${i > 0 ? `<button class="btn-ghost btn-sm" onclick="Intro.go(-1)">‹ Geri</button>` : ""}
              ${son
                ? `<button class="btn-primary btn-sm" onclick="Intro.bitir()">Anladım, başlayalım</button>`
                : `<button class="btn-ghost btn-sm" onclick="Intro.bitir()">Geç</button>
                   <button class="btn-primary btn-sm" onclick="Intro.go(1)">Devam ›</button>`}
            </div>
          </div>
        </div>
      </div>
    `);
  },

  go(d) {
    Intro.step += d;
    Intro.render();
  },

  bitir() {
    try { localStorage.setItem("lvs_intro_gorüldu", "1"); } catch (e) {}
    UI.closeModal();
  }
};

window.Intro = Intro;
