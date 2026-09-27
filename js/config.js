/* =========================================================
   config.js
   Oyunun tüm sabitleri, yem veritabanı, ahır ihtiyaçları ve
   görsel (asset) dosya yolları burada merkezi olarak tutulur.
   Gerçek görsel dosyaları eklenene kadar sistem placeholder
   (yer tutucu) grafiklerle çalışmaya devam eder (bkz. ui.js
   -> resolveAsset()).
   ========================================================= */

const CONFIG = {
  TOTAL_WEEKS: 56,
  HERD_SIZE: 20,
  START_CASH: 100000,
  WEEKLY_LABOR_COST: 10500,
  WEEKLY_FUEL_ELECTRIC_COST: 500,
  MILK_PRICE_PER_LITER: 15.5,
  /* ---- LAKTASYON EĞRİSİ ----
     Doğumdan hemen sonraki günlük verim hayvana göre değişir (bireysel farklılık);
     eğri buradan başlayıp pik haftasına kadar yükselir, plato boyunca pikte kalır,
     sonra haftalık sabit oranda düşer. Pik değere ancak rasyon yeterliyse ulaşılır;
     enerji açığı olan haftalarda verim UNDERFED_MILK_DROP_WEEKLY kadar düşer. */
  CALVING_MILK_MIN: 20,          // doğum sonrası en düşük başlangıç verimi (L/gün)
  CALVING_MILK_MAX: 26,          // doğum sonrası en yüksek başlangıç verimi (L/gün)
  PEAK_MILK: 40,                 // doğru beslemede görülebilecek pik verim (L/gün)
  PEAK_LACTATION_WEEK: 8,        // pikin görüldüğü laktasyon haftası
  PEAK_PLATEAU_END_WEEK: 12,     // pik platosunun bittiği hafta
  MILK_DECLINE_PER_WEEK: 1.4,    // platodan sonra haftalık düşüş (L/gün)
  MIN_DAILY_MILK: 10,            // laktasyon sonundaki taban verim (L/gün)
  LATE_DRY_OFF_MILK_FACTOR: 0.5, // geç/hiç kuruya çıkarmama cezası (madde 18)
  /* Verim katsayısı (a.milkFactor): hayvanın eğri üzerindeki potansiyelinin ne
     kadarını verdiğini gösterir. Enerji açığı olan her hafta UNDERFED_MILK_DROP_WEEKLY
     kadar düşer ve BİRİKİR; rasyon düzeltilince MILK_FACTOR_RECOVERY_WEEKLY kadar
     yavaşça toparlanır. Kaybedilen süt hızlı geri gelmediği için toparlanma,
     düşüşten belirgin biçimde yavaştır. */
  MIN_MILK_FACTOR: 0.4,             // verimin düşebileceği taban katsayı
  MILK_FACTOR_RECOVERY_WEEKLY: 0.03, // doğru beslemede haftalık toparlanma oranı
  GESTATION_WEEKS: 39,
  DRY_OFF_WEEK_THRESHOLD: 31, // 31. gebelik haftasından sonra kuruya çıkarılmalı
  HEAT_CYCLE_MIN_WEEKS: 3,
  HEAT_CYCLE_MAX_WEEKS: 4,
  /* Doğumdan sonraki İLK kızgınlık: laktasyonun 8. veya 9. haftasında görülür.
     Doğumu izleyen ilk 8 hafta gönüllü bekleme süresidir (VWP); bu sürede
     hayvan tohumlanmaz, bu yüzden ilk gözlenen kızgınlık da 8. haftadan önce
     olmaz. Sonraki kızgınlıklar normal östrus döngüsüne (HEAT_CYCLE_*) döner.
     Not: premiks verilmeyen ahırda kızgınlık yine gözlenmez (madde 33). */
  FIRST_HEAT_AFTER_CALVING_MIN_WEEKS: 8,
  FIRST_HEAT_AFTER_CALVING_MAX_WEEKS: 9,
  /* Gönüllü bekleme süresi (VWP): doğumdan sonra ineğin tohumlanabildiği
     en erken laktasyon haftası. Başlangıç sürüsündeki gebe hayvanların
     laktasyon haftası bu değer üzerinden türetilir (bkz. animals.js). */
  FIRST_SERVICE_LACTATION_WEEK: 8,
  /* Doğan buzağı doğumdan sonra satılır ve işletmeye tek seferlik gelir yazar. */
  CALF_SALE_PRICE: 40000,
  /* Oyun başındaki gebe hayvanların gebelik haftaları. Dizinin uzunluğu
     aynı zamanda başlangıçtaki gebe hayvan sayısıdır. Değerler, kuruya
     çıkarma ve doğum olayları 56 haftaya yayılacak şekilde seçilmiştir. */
  INITIAL_PREGNANT_SEED: [6, 10, 12, 16, 20, 28],
  /* Oyun başındaki boş (gebe olmayan) hayvanların laktasyon haftası:
     bu iki değerden biri. */
  EMPTY_COW_START_LACTATION_WEEKS: [5, 8],
  STUDENT_NO_LENGTH: 9,
  STUDENT_NO_FIXED_SEGMENT: "14030", // soldan 3-7. karakterler bu olmalı
  STUDENT_NO_FIXED_SEGMENT_START: 2, // 0-indeks: 3. karakterden başlar
  INSEMINATION_TO_PREG_TEST_MIN_DAYS: 45,
  INSEMINATION_TO_PREG_TEST_MAX_DAYS: 60,
  PREGNANCY_CHANCE_ON_SUCCESSFUL_AI: 1 / 3,
  /* YALANCI KIZGINLIK (gebe hayvanda atlama davranışı):
     Tohumlanıp gebe kalan hayvanların 1/12'si, östrus döngüsü zamanı geldiğinde
     diğer hayvanlara atlar. Ahır ekranındaki davranış ipucu gerçek kızgınlıkla
     AYNI görünür ("Hareketli / Huzursuz"); ayrımı yalnızca MUAYENE ET ortaya
     koyar: gebe hayvanda durma refleksi, sağrıda yatmış kıl ve olgun folikül
     BULUNMAZ. Amaç, öğrencinin muayene etmeden tohumlama yapmasını önlemektir.
     Oran saha verileriyle uyumludur (gebe ineklerin yaklaşık %8'i). */
  PREGNANT_FALSE_HEAT_RATIO: 1 / 12,
  /* Gebe hayvan yanlışlıkla tohumlanırsa gebeliğin kaybedilme ihtimali. */
  AI_ON_PREGNANT_PREGNANCY_LOSS_CHANCE: 1 / 3,
  MASTITIS_WEEKLY_CHANCE: 1 / 50,
  CYST_CHANCE_GOOD_FEEDING: 1 / 20,
  CYST_CHANCE_BAD_FEEDING: 1 / 5,
  VKS_MIN_ALIVE: 1.5,
  VKS_MAX: 5.0,
  VKS_START_MIN: 2.5,
  VKS_START_MAX: 3.5,
  UNDERFED_PREG_CHANCE: 1 / 10,
  UNDERFED_MILK_DROP_WEEKLY: 0.05,
  HIGH_VKS_DISEASE_MULTIPLIER: 3.0, // "%200 daha yüksek" = normalin 3 katı
  UNDERFED_CYST_MULTIPLIER: 3.0,

  /* ---------------------------------------------------------
     ENERJİ DENGESİ VE VKS DİNAMİĞİ
     Kaynak: NRC (2021) "Nutrient Requirements of Dairy Cattle",
     8. Baskı, Bölüm 3 "Energy" (s. 28-30).
     - NELbakım = 0.10 × CA^0.75 (Denklem 3-13, s.29)
     - NEL_DM = 0.66 × ME_DM  (Denklem 3-12, s.28)
     - "1 VKS birimi ≈ canlı ağırlığın %10'u" (s.30)
     - "VKS değişimi başlangıç VKS'den bağımsızdır; kg CA başına
        gereken enerji sabittir" (s.28) → VKS değişimi, enerji
        fazlası/açığının BÜYÜKLÜĞÜYLE ORANTILI olmalıdır (sabit
        haftalık artış/azalış yerine).
     Bu committee bulgularına dayanarak: ~620 kg bir inek için
     1 VKS birimi ≈ 62 kg doku ≈ ~430 Mcal biriktirilmiş enerjiye
     karşılık gelir (doku enerji yoğunluğu ~7 Mcal/kg, vücut
     rezervlerinin çoğunlukla yağ+su karışımı olduğu varsayımıyla).
  --------------------------------------------------------- */
  ENERGY_PER_BCS_POINT_MCAL: 430,
  ME_TO_RE_EFF_LACT: 0.74,   // Tablo 3-2: laktasyonda ME→RE verimliliği
  ME_TO_RE_EFF_DRY: 0.60,    // Tablo 3-2: kuru dönemde ME→RE verimliliği
  MAX_WEEKLY_VKS_GAIN: 0.03, // fizyolojik tavan: aşırı fazla enerji bile VKS'yi sınırsız hızlı yükseltemez
  MAX_WEEKLY_VKS_LOSS: 0.06, // doku mobilizasyonu birikimden biraz daha hızlı olabilir
  ENERGY_DEFICIENT_RATIO: 0.9,  // rasyon ME'si ihtiyacın %90'ının altındaysa "yetersiz" sınıflandırılır
  ENERGY_EXCESS_RATIO: 1.5,     // rasyon ME'si ihtiyacın %150'sinin üzerindeyse "fazla" sınıflandırılır

  // --- Doğum öncesi/sonrası hastalık ve VKS kuralları ---
  PRE_CALVING_HIGH_VKS_THRESHOLD: 4.0,        // doğumdan hemen önce VKS bu değerin üzerindeyse
  PRE_CALVING_HIGH_VKS_DISEASE_CHANCE: 0.8,   // %80 ihtimalle 4 hastalıktan biri hemen tetiklenir
  KETOZIS_TREATMENT_WEEKS: 3,                 // ketozis tedavisi en az 3 hafta sürer
  KETOZIS_TREATMENT_MILK_DROP: 0.5,           // tedavi süresince süt verimi yarı yarıya azalır
  KETOZIS_TREATMENT_VKS_DROP: 0.5,            // tedavi başlangıcında tek seferlik VKS düşüşü
  ABOMAZUM_MAX_LACTATION_WEEK: 10,            // 11. haftadan itibaren (>10) görülmez
  ABOMAZUM_MILK_BLOCK_WEEKS: 1,               // (bkz. DISEASE_MILK_WITHDRAWAL_WEEKS ile aynı süre)
  RETENSIYO_MAX_LACTATION_WEEK: 3,            // yalnızca doğumdan sonraki ilk 3 hafta
  METRITIS_MAX_LACTATION_WEEK: 6,             // doğumdan sonraki ilk 6 hafta
  FAILED_AI_METRITIS_RISK_WEEKS: 4,           // başarısız tohumlama sonrası kalıntı metritis riski süresi
  /* Yanlış tohumlama (işlem adımları hatalı uygulanmış ya da gebe hayvana
     tohum atılmış) hâlinde uterus kontamine olur: hayvanda 4/5 ihtimalle
     metritis gelişir. Hastalık hemen tetiklenir, öğrenci bunu muayene ile görür. */
  WRONG_AI_METRITIS_CHANCE: 4 / 5,

  /* ---------------------------------------------------------
     TEDAVİ SONRASI ANTİBİYOTİK ARINMA SÜRESİ (SÜT SATIŞ KESİNTİSİ)
     Gerçek süt sığırcılığında tedavide kullanılan antibiyotik/ilaçların
     sütte kalıntı bırakmaması için bir "arınma süresi" (withdrawal
     period) uygulanır ve bu süre boyunca süt insan tüketimine
     satılamaz. Oyunda:
     - Mastitis: memede lokal tedavi edildiği ve arınma süresi daha
       kısa olduğu için yalnızca üç günlük süt üretiminin 1/4'ü
       satılamaz (tam hafta değil, kısmi miktar).
     - Diğer tüm hastalıklar (hipokalsemi, retensiyo sekundinarum,
       metritis, ketozis, abomazum deplasmanı): sistemik tedavi
       gerektirdiğinden doğru tedavi sonrası 1 TAM HAFTA süt satılamaz.
  --------------------------------------------------------- */
  MASTITIS_MILK_WITHDRAWAL_DAYS: 3,
  MASTITIS_MILK_WITHDRAWAL_FRACTION: 0.25,
  DISEASE_MILK_WITHDRAWAL_WEEKS: 1,

  KETOZIS_MAX_LACTATION_WEEK: 10,             // negatif enerji dengesi (NEB) penceresiyle uyumlu
  ENERGY_DEFICIENT_DISEASE_MULTIPLIER: 1.7,   // hipokalsemi/abomazum/ketozis için %70 fazla risk

  /* ---------------------------------------------------------
     DOĞUM SONRASI NEGATİF ENERJİ DENGESİ (NEB) EĞRİSİ
     Kaynaklar:
     - NRC (2021) "Nutrient Requirements of Dairy Cattle", 8. Baskı,
       Bölüm 2 "Dry Matter Intake" (s.11-12): "Milk production
       (energy expenditure) usually peaks 4 to 8 weeks postpartum,
       and peak DMI (energy intake) lags until about 10 weeks
       postpartum" (NRC, 1989) ve "In the immediate postpartum
       period, cows are in negative energy balance, but neither
       the filling effect nor the energy content of rations can be
       altered to eliminate this."
     - Butler, W.R. (2005) "Nutrition, negative energy balance and
       fertility in the postpartum dairy cow": NEB doğumdan sonra
       10-12 hafta sürer.
     - Genel derleme çalışmaları (ör. Suadsong ve ark. çalışmalarının
       derlendiği literatür taramaları): NEB'in en şiddetli olduğu
       nokta (nadir) doğumdan sonraki ~9-20. gün (~1.5-3. hafta)
       civarında olup şiddeti ~ -3.7 ile -5 Mcal/gün arasında
       değişir; enerji dengesi tipik olarak ~5-7. haftada tekrar
       nötr/pozitife döner.

     Bu nedenle NEB, öğrencinin rasyon kalitesinden BAĞIMSIZ olarak
     var olan fizyolojik bir olgudur (süt verimi hızla artarken yem
     tüketimi kademeli artar) ve aşağıdaki haftalık Mcal/gün açık
     eğrisiyle modellenir. Değer, o haftaki rasyon dengesine
     (game.js) EKLENEREK uygulanır - yani en iyi rasyonla bile
     ilk haftalarda hafif bir VKS baskısı oluşur; yetersiz rasyon
     bu baskıyı derinleştirir.
     İndeks = laktasyon haftası (0 = doğum haftası). 10. haftadan
     sonra dizide değer yoktur (NEB sona ermiş kabul edilir).
  --------------------------------------------------------- */
  NEB_DEFICIT_CURVE_MCAL_PER_DAY: [
    -3.0,  // hafta 0 (doğum)
    -4.4,  // hafta 1
    -5.0,  // hafta 2 (nadir)
    -4.7,  // hafta 3
    -4.0,  // hafta 4
    -3.2,  // hafta 5
    -2.4,  // hafta 6
    -1.7,  // hafta 7
    -1.1,  // hafta 8
    -0.6,  // hafta 9
    -0.2   // hafta 10 (neredeyse dengede)
  ],
  POSTPARTUM_NEB_WEEKS: 10,                   // doğum sonrası negatif enerji dengesi penceresi (NRC: ~10 hafta)

  // --- Final ekranı eşikleri ---
  ENDING_HIGH_SCORE: 75,
  ENDING_LOW_SCORE: 40
};

/* ---------------------------------------------------------
   YEM VERİTABANI
   km   : kuru madde oranı (kg KM / kg yem, "as fed")
   hp   : kuru maddedeki ham protein oranı (%)
   hs   : kuru maddedeki ham selüloz oranı (%)
   me   : kuru madde kg başına metabolik enerji (Mcal/kg KM)
   price: TL / kg (yem, olduğu gibi)
--------------------------------------------------------- */
const FEEDS = {
  misir_silaji:   { name: "Mısır Silajı",            group: "kaba",    km: 0.33, hp: 8,  hs: 22, me: 2.6, price: 2.5,  icon: "assets/feed/misir_silaji.png" },
  yonca_kuru_ot:  { name: "Yonca Kuru Otu",           group: "kaba",    km: 0.88, hp: 18, hs: 28, me: 2.2, price: 6.0,  icon: "assets/feed/yonca.png" },
  bugday_samani:  { name: "Buğday Samanı",            group: "kaba",    km: 0.90, hp: 3.5,hs: 40, me: 1.5, price: 3.0,  icon: "assets/feed/bugday_samani.png" },
  tane_arpa:      { name: "Tane Arpa",                group: "enerji",  km: 0.88, hp: 11, hs: 5,  me: 3.0, price: 8.0,  icon: "assets/feed/tane_arpa.png" },
  misir_tanesi:   { name: "Mısır Tanesi",             group: "enerji",  km: 0.88, hp: 9,  hs: 2.5,me: 3.3, price: 9.0,  icon: "assets/feed/misir_tanesi.png" },
  pancar_posasi:  { name: "Şeker Pancarı Posası",     group: "enerji",  km: 0.90, hp: 9,  hs: 20, me: 2.7, price: 5.0,  icon: "assets/feed/pancar_posasi.png" },
  melas:          { name: "Melas",                    group: "enerji",  km: 0.75, hp: 6,  hs: 0,  me: 2.9, price: 7.0,  icon: "assets/feed/melas.png" },
  soya_kuspesi:   { name: "Soya Küspesi",             group: "protein", km: 0.90, hp: 44, hs: 7,  me: 2.9, price: 14.0, icon: "assets/feed/soya_kuspesi.png" },
  bugday_kepegi:  { name: "Buğday Kepeği",            group: "protein", km: 0.88, hp: 15, hs: 10, me: 2.4, price: 6.0,  icon: "assets/feed/bugday_kepegi.png" },
  fabrika_yemi:   { name: "Fabrika Süt Yemi",         group: "karma",   km: 0.88, hp: 18, hs: 8,  me: 2.8, price: 11.0, icon: "assets/feed/fabrika_yemi.png" },
  premiks:        { name: "Vitamin-Mineral Premiksi", group: "mineral", km: 0.95, hp: 0,  hs: 0,  me: 0,   price: 20.0, icon: "assets/feed/premiks.png" }
};

/* ---------------------------------------------------------
   AHIR BAZLI GÜNLÜK BESİN İHTİYAÇLARI (baş başına / gün)
   km  : minimum kuru madde (kg)
   hp  : minimum ham protein (kuru maddede %)
   hs  : ham selüloz aralığı (kuru maddede %) [min,max]
   me  : minimum metabolik enerji (Mcal)
--------------------------------------------------------- */
/* ---------------------------------------------------------
   AHIR BAZLI GÜNLÜK BESİN İHTİYAÇLARI (baş başına / gün)
   km  : minimum kuru madde (kg)
   hp  : minimum ham protein (kuru maddede %)
   hs  : ham selüloz aralığı (kuru maddede %) [min,max]
   me  : minimum metabolik enerji (Mcal) - NRC (2021) Denklem 3-13
         (NELbakım = 0.10×CA^0.75) ve Denklem 3-12 (NEL=0.66×ME)
         kullanılarak ~620 kg bir inek için hesaplanmıştır:
         - Bakım: 0.10×620^0.75 ≈ 12.4 Mcal NEL → /0.66 ≈ 18.8 Mcal ME
         - Laktasyon: süt NEL'i (~0.70 Mcal/kg süt) /0.66 ile ME'ye çevrilip eklenir
--------------------------------------------------------- */
const BARN_REQUIREMENTS = {
  start: { label: "Laktasyon Başlangıç", km: 20, hpPercent: 16, hsPercentMin: 18, hsPercentMax: 26, me: 47 },
  end:   { label: "Laktasyon Bitiş",     km: 17, hpPercent: 14, hsPercentMin: 20, hsPercentMax: 28, me: 35 },
  dry:   { label: "Kuru Dönem",          km: 13, hpPercent: 11, hsPercentMin: 28, hsPercentMax: 40, me: 22 }
};

const BARN_LABELS = {
  start: "Laktasyon Başlangıç Ahırı",
  end: "Laktasyon Bitiş Ahırı",
  dry: "Kuru İnek Ahırı"
};

const DISEASES = {
  mastitis: { name: "Mastitis", symptoms: ["Meme dokusunda sertlik ve hassasiyet", "Sütte pıhtı/renk değişikliği", "Sağım sırasında huzursuzluk"], treatmentCost: 450 },
  hipokalsemi: { name: "Hipokalsemi (Süt Humması)", symptoms: ["Ayakta duramama", "Kas titremesi", "Vücut ısısında düşüklük"], treatmentCost: 300 },
  ketozis: { name: "Ketozis", symptoms: ["Nefeste aseton kokusu", "İştah azalması", "Ani süt düşüşü"], treatmentCost: 350 },
  retensiyo: { name: "Retensiyo Sekundinarum", symptoms: ["Doğumdan sonra eş zarının atılamaması", "Kötü kokulu akıntı"], treatmentCost: 400 },
  abomazum: { name: "Abomazum Deplasmanı", symptoms: ["İştahsızlık", "Sol karın bölgesinde pinginli ses", "Geviş getirmede azalma"], treatmentCost: 15000 },
  metritis: { name: "Metritis", symptoms: ["Ateş", "Kötü kokulu uterus akıntısı", "Genel durgunluk"], treatmentCost: 400 }
};

/* Over kisti - hayvanın gebe/hasta olmayan ama uzun süredir kızgınlığa gelmediği durum.
   Ayrı bir "hastalık" olarak değil, a.cystic bayrağı olarak tutulur; öğrenci ancak
   kızgınlıktan şüphelenip muayene ettiğinde belirtileri görebilir. */
const CYST_INFO = {
  name: "Kist (Over Kisti)",
  symptoms: ["Uzun süredir kızgınlık davranışı gözlenmedi", "Overde düzensiz/köpüksü yapı palpe edildi"],
  treatmentCost: 400
};

const ASSETS = {
  barn: {
    start: "assets/barns/lactation_start.png",
    end: "assets/barns/lactation_end.png",
    dry: "assets/barns/dry_barn.png"
  },
  icons: {
    money: "assets/icons/money.png",
    milk: "assets/icons/milk.png",
    health: "assets/icons/health.png",
    pregnancy: "assets/icons/pregnancy.png",
    heat: "assets/icons/heat.png",
    ration: "assets/icons/ration.png",
    exam: "assets/icons/exam.png",
    insemination: "assets/icons/insemination.png",
    calving: "assets/icons/calving.png",
    market: "assets/icons/market.png"
  },
  videos: {
    high: "assets/videos/pavyon_kutlama.mp4",
    mid: "assets/videos/mucadeleye_devam.mp4",
    low: "assets/videos/kasiyer.mp4"
  }
};

/* ---------------------------------------------------------
   FİNAL EKRANI SENARYOLARI (madde: 3 farklı oyun sonu)
--------------------------------------------------------- */
const ENDINGS = {
  high: { title: "Paraları Pavyonda Ezmeyi Hakettin", emoji: "🥂", video: ASSETS.videos.high },
  mid:  { title: "Çabalamaya Devam", emoji: "🌙🐄", video: ASSETS.videos.mid },
  low:  { title: "Sen En İyisi Kasiyerlikte Şansını Dene", emoji: "🛒", video: ASSETS.videos.low }
};

/* ---------------------------------------------------------
   TOHUMLAMA MİNİ OYUNU ADIM GÖRSELLERİ
   Insemination.STEPS ile aynı sırada (index eşleşmesi).
--------------------------------------------------------- */
const INSEMINATION_STEP_ASSETS = [
  { icon: "assets/minigames/tank.png", emoji: "🧊" },
  { icon: "assets/minigames/water_cup.png", emoji: "🌡️" },
  { icon: "assets/minigames/straw.png", emoji: "🧻" },
  { icon: "assets/minigames/straw_cut.png", emoji: "✂️" },
  { icon: "assets/minigames/pistolet.png", emoji: "💉" },
  { icon: "assets/minigames/sheath.png", emoji: "🧤" },
  { icon: "assets/minigames/insemination_process.png", emoji: "🐄" }
];

/* ---------------------------------------------------------
   DOĞUM MİNİ OYUNU AŞAMA GÖRSELLERİ (Calving.STAGES ile aynı sırada)
--------------------------------------------------------- */
const CALVING_STAGE_ASSETS = [
  { icon: "assets/minigames/calving_stage1.png", emoji: "💧" },
  { icon: "assets/minigames/calving_stage2.png", emoji: "💧" },
  { icon: "assets/minigames/calving_stage3.png", emoji: "🦶" },
  { icon: "assets/minigames/calving_stage4.png", emoji: "🐮" }
];
