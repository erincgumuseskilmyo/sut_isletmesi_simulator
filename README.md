# LVS 2005 – Süt Sığırı İşletmesi Eğitim Oyunu

Eskil Meslek Yüksekokulu, Laborant ve Veteriner Sağlık Programı, **LVS 2005 – Yem Bilgisi ve Hayvan
Besleme** dersi için hazırlanmış, tarayıcıda çalışan HTML5 + CSS3 + Vanilla JavaScript eğitim/değerlendirme
oyunu. Öğrenci 20 başlık bir süt sığırcılığı işletmesini 56 hafta boyunca yönetir; rasyon hazırlar, üreme ve
sağlık süreçlerini takip eder, doğumları ve buzağı bakımını yönetir; sonunda 100 üzerinden bir performans
puanı alır.

## 1. Klasör Yapısı ve Dosyaların Görevi

```
project/
├── index.html              Uygulamanın tek HTML giriş noktası, tüm script'leri sırayla yükler
├── style.css                "Çiftlik Defteri" temalı tüm görsel tasarım (renk, tipografi, kart/tab stilleri)
├── GEMINI_GORSEL_PROMPTLARI.md   Gemini ile üretilecek tüm görseller için hazır promptlar
├── GEMINI_VIDEO_PROMPTLARI.md    Final ekranı için Gemini (Veo) video promptları
├── README.md                 Bu dosya
│
├── js/
│   ├── config.js       Tüm sabitler, yem veritabanı (KM/HP/HS/ME/fiyat), ahır ihtiyaçları, asset yolları
│   ├── animals.js      İnek veri modeli, başlangıç sürüsü üretimi, süt verim eğrisi
│   ├── ration.js       Rasyon besin değeri (%HP, %HS, KM, ME) ve maliyet hesaplama, eksiklik tespiti
│   ├── reproduction.js Kızgınlık döngüsü, gebelik ilerlemesi, kuruya çıkarma, ahır taşıma, kist
│   ├── health.js        Hastalık tetikleme (zamanlama pencereleri, enerji açığı çarpanı), muayene, tedavi
│   ├── insemination.js Tohumlama mini oyunu değerlendirme mantığı (7 adımlı sıralama)
│   ├── calving.js       Doğum mini oyunu (4 aşama), buzağı bakım sırası, doğum öncesi yüksek VKS riski
│   ├── economy.js       Haftalık süt geliri (ilaç arınma süresi dahil) ve sabit gider işlemleri
│   ├── scoring.js        100 üzerinden final puan hesaplama
│   ├── storage.js        Tarayıcı localStorage otomatik kayıt/yükleme
│   ├── csv.js            Final sonuçların CSV olarak indirilmesi
│   ├── sheets.js          Google Apps Script Web App'e sonuç gönderimi (kurulum talimatı dosya içinde)
│   ├── game.js            Merkezi oyun durumu (state) ve haftalık tur motoru (turn engine)
│   ├── ui.js              Tüm ekran render işlemleri, sekmeler, modallar, mini oyun arayüzleri, 3 farklı son
│   ├── main.js            Uygulama giriş noktası
│   └── iso/               İZOMETRİK 3B ÇİFTLİK KATMANI (bkz. madde 14) – oyun mantığını değiştirmez
│       ├── farm3d.js      Sahne, izometrik kamera, model yükleme, tıklama/seçim, oyun durumu köprüsü
│       ├── cow3d.js       İnek görünüm çeşitliliği + davranış durum makinesi + prosedürel animasyon
│       ├── worker3d.js    İşçi, traktör, yem karma makinesi, mobil sağım ünitesi ve iş sırası
│       ├── season.js      4 mevsim: renkler, ışık, gökyüzü ve yaprak/kar/polen parçacıkları
│       └── vet3d.js       Veteriner sağlık teknikeri: muayene, doğum takibi, sürü kontrolü
│   ├── sfx.js             Ses sistemi (kayıtlar + Web Audio ile üretilen arayüz sesleri)
│   └── intro.js           Tanıtıcı karakter "İşçi Ahmet": mekanikleri anlatır (yardım etmez)
│
├── tools/
│   └── surum_damgala.py    Tarayıcı önbelleğini kıran sürüm damgası aracı (bkz. madde 15)
│
├── blender/                3B modelleri üreten headless Blender script'leri (bkz. madde 14.3)
│   ├── lib_iso.py          Ortak yardımcılar: palet, kutu/silindir/çatı üretimi, GLB dışa aktarma
│   ├── build_farm.py       Çiftlik yerleşimi -> assets/3d/farm.glb + farm_layout.json
│   ├── build_cow.py        Holstein inek -> assets/3d/cow.glb
│   ├── build_props.py      İşçi + traktör/romork/sağım arabası -> worker.glb, machines.glb
│   └── preview.py          Üretilen GLB'yi izometrik açıdan render eder (kontrol amaçlı)
│
├── vendor/three/           Three.js r169 ve GLTFLoader (yerel kopya; CDN bağımlılığı yok)
│
└── assets/                  Gemini ile üretilecek görsel/video dosyaları buraya yerleştirilir (bkz. madde 4)
    ├── cows/  ├── barns/  ├── feed/  ├── diseases/
    ├── minigames/  ├── ui/  ├── icons/  ├── background/  ├── videos/
    ├── 3d/          farm.glb, cow.glb, worker.glb (işçi + veteriner), machines.glb, farm_layout.json
    └── audio/       inek/çan/traktör kayıtları + KAYNAKLAR.md (lisans ve atıflar)
```

Kod, `config.js` içindeki merkezi veritabanından okuduğu için yeni bir yem eklemek, fiyat/besin değeri
değiştirmek veya bir hastalığı düzenlemek için yalnızca `config.js` dosyasının güncellenmesi yeterlidir.

## 2. Oyunun Nasıl Çalıştırılacağı

1. `project/` klasörünü bir bütün olarak indirin.
2. Herhangi bir statik dosya sunucusuyla açın (çift tıklayarak `index.html` açmak da tarayıcıda çalışır,
   ancak bazı tarayıcılarda yerel dosya kısıtlamaları olabileceğinden basit bir sunucu önerilir):
   ```bash
   cd project
   python3 -m http.server 8000
   ```
   ardından tarayıcıda `http://localhost:8000` adresini açın.
3. Kurulum/derleme adımı yoktur; saf HTML/CSS/JS'dir.

## 3. GitHub Pages'e Yükleme

1. `project/` klasörünün içeriğini bir GitHub deposunun kök dizinine (veya `docs/` klasörüne) yükleyin.
2. Depo **Settings → Pages** bölümünden yayın kaynağını ilgili dal/klasör olarak seçin.
3. Birkaç dakika içinde `https://<kullanici-adi>.github.io/<depo-adi>/` adresinden oyun erişilebilir olur.
4. API anahtarı veya gizli bir kimlik bilgisi GERÇEKLEŞTİRİLMEZ; yalnızca herkese açık bir Google Apps
   Script Web App URL'si kullanılacaktır (bkz. madde 5).

## 4. Gemini Görsellerinin Entegrasyonu

`GEMINI_GORSEL_PROMPTLARI.md` dosyasındaki her görsel için Gemini'de üretim yapıp, belirtilen dosya adıyla
ilgili `assets/` alt klasörüne kaydedin (örn. `assets/feed/misir_silaji.png`). Kod artık bu dosyaları
doğrudan `<img>` etiketiyle yüklemeye çalışır (inek kartları/modalı, rasyon tablosundaki yem satırları,
ahır başlıkları); dosya mevcut değilse veya yüklenemezse otomatik olarak emoji/placeholder'a döner, kod
asla çökmez.

**Görsellerin görünmesi için dosya adlarının BİREBİR eşleşmesi gerekir:**
- İnekler: `assets/cows/cow_01.png` … `assets/cows/cow_20.png` (2 haneli, sıfırla dolgulu numara)
- Yemler: `js/config.js` içindeki `FEEDS` tanımındaki `icon` alanıyla birebir aynı dosya adı
  (örn. `assets/feed/soya_kuspesi.png`)
- Ahırlar: `assets/barns/lactation_start.png`, `assets/barns/lactation_end.png`, `assets/barns/dry_barn.png`

Görsel görünmüyorsa önce dosya adının ve klasörünün yukarıdaki listeyle birebir aynı olduğunu, ardından
büyük/küçük harf duyarlılığını (GitHub Pages büyük/küçük harfe duyarlıdır) kontrol edin.

## 5. Google Sheets Bağlantısının Kurulması

`js/sheets.js` dosyasının başındaki yorum satırlarında adım adım talimat bulunur, özetle:

1. Bir Google E-Tablo oluşturun.
2. **Uzantılar → Apps Script** ile `sheets.js` içinde verilen `doPost` fonksiyonunu yapıştırın.
3. **Dağıt → Yeni Dağıtım → Web Uygulaması**, erişim: "Herkes".
4. Verilen Web App URL'sini `js/sheets.js` içindeki `Sheets.WEB_APP_URL` alanına yapıştırın.
5. Hiçbir API anahtarı GitHub Pages'te saklanmaz; yalnızca herkese açık uç nokta URL'si kullanılır.
6. Gönderim başarısız olursa (URL girilmemişse veya ağ hatası olursa) öğrenci otomatik olarak
   **CSV İNDİR** seçeneğine yönlendirilir.

## 6. Test Senaryoları

Aşağıdaki senaryolar oyunun temel akışlarını doğrulamak için manuel olarak (veya bir otomasyon betiğiyle)
çalıştırılabilir. Proje ekibi, `game.js`/`ui.js` içermeyen saf mantık katmanını (config→scoring) Node.js
`vm` modülü ile yükleyip 56 haftalık bir simülasyonu programatik olarak koşan bir test betiğiyle bu
senaryoları doğrulamıştır (sıfır çalışma zamanı hatasıyla tüm hafta döngüsü tamamlanmıştır).

| # | Senaryo | Beklenen Sonuç |
|---|---------|-----------------|
| 1 | Öğrenci bilgilerini doldurmadan / onay kutusunu işaretlemeden "OYUNA BAŞLA" | Buton pasif kalır, oyun başlamaz |
| 2 | Bir ahırın rasyonu kaydedilmeden "HAYVANLARI BESLE" denenmesi | Uyarı verilir, besleme gerçekleşmez |
| 3 | Bir ahır için rasyon kaydedilmesi | O ahırdaki hayvan sayısına göre haftalık yem maliyeti anında kasadan düşülür (yem marketi/stoğu yoktur) |
| 3b | Aynı hafta içinde bir rasyonun yeniden kaydedilmesi | Önceki maliyet iade edilip yeni rasyona göre tekrar hesaplanır (çift ücretlendirme yapılmaz) |
| 4 | Tüm ahırlar beslenmeden "HAFTAYI KAPAT" denenmesi | Buton pasif/uyarı verir, hafta kapanmaz |
| 5 | Kuru madde/protein/selüloz/enerjiden en az biri eksik bir rasyon hazırlanması | Yalnızca ilgili eksiklik etiketleri gösterilir, çözüm önerilmez |
| 6 | Vitamin-mineral premiksi hiç verilmeyen bir ahırdaki boş hayvan | Hayvan kızgınlığa gelmez (inHeat hiç true olmaz) |
| 7 | Doğumdan sonraki ilk 2 hafta premiks verilmeyen hayvan | %100 hipokalsemi tetiklenir |
| 8 | Kızgın (inHeat=true) bir hayvanın süt verimi | O hafta günlük verim %50 azalır |
| 9 | Tohumlama mini oyununda 7 adımın hepsi hatasız (doğru sırayla) tamamlanması | Tohumlama "başarılı" sayılır; öğrenciye anında bildirilmez |
| 9b | Tohumlama mini oyununda en az bir adımın yanlış sırayla tıklanması | `miniGameErrors` artar ve tohumlama teknik olarak "başarısız" sayılır; öğrenciye anında bildirilmez |
| 10 | Başarılı tohumlamadan 45–60 gün sonra gebelik muayenesi | Muayene seçeneği aktif olur, sonuç gebe/boş olarak görünür |
| 11 | Gebelik 39. haftaya ulaşması | Hayvan "doğum bekleyenler" listesine düşer, doğum mini oyunu tetiklenebilir |
| 12 | 31. gebelik haftasından sonra kuruya çıkarma | Uyarı verilir; bir sonraki laktasyonda süt verimi %50 düşük başlar |
| 13 | Doğum mini oyununda 4 aşamanın hepsinde doğru zamanlama | Doğum ve buzağı başarılı sayılır, ek puan |
| 14 | Doğum mini oyununda yanlış/erken müdahale | Doğum başarısızlığı veya buzağı kaybı riski oluşur, ceza puanı |
| 15 | Buzağı bakım adımlarının yanlış sırayla uygulanması | Doğru adım sayısı düşük çıkar, tam puan alınmaz |
| 16 | VKS değerinin 1.5'in altına düşmesi | Hayvan ölür, ölüm sayacı artar |
| 17 | Aşırı enerjili rasyonla haftalar geçirilmesi | VKS, enerji fazlasının büyüklüğüyle orantılı ve haftalık bir tavanla sınırlı şekilde YAVAŞÇA yükselir (bkz. bölüm 7); hastalık riski katlanır |
| 18 | Hastalık muayenesi sonrası yanlış tedavi seçimi | Hastalık devam eder, tedavi maliyeti yine de düşer, ceza puanı |
| 19 | 56. haftanın tamamlanması | "OYUN TAMAMLANDI" ekranı, final puanı ve tüm özet istatistikler gösterilir |
| 20 | "CSV İNDİR" butonuna basılması | Öğrenci bilgileri ve tüm performans verilerini içeren bir .csv dosyası iner |
| 21 | Tarayıcı kapatılıp yeniden açılması | "Kaldığım Yerden Devam Et" seçeneğiyle son kaydedilen haftadan devam edilir |

## 7. Enerji Dengesi ve VKS Modeli (NRC 2021 kaynaklı)

VKS (Vücut Kondisyon Skoru) değişimi, **NRC (2021) "Nutrient Requirements of Dairy Cattle", 8. Baskı,
Bölüm 3 "Energy"** (s. 28-30) esas alınarak yeniden kalibre edilmiştir:

- Ahır enerji ihtiyaçları (`BARN_REQUIREMENTS.me`), NRC'nin bakım gereksinimi denklemi
  **NELbakım = 0.10 × CA^0.75** (Denklem 3-13) ve ME↔NEL dönüşüm verimliliği
  **NEL = 0.66 × ME** (Denklem 3-12) kullanılarak ~620 kg'lık bir inek için hesaplanmıştır.
- NRC'nin belirttiği gibi *"VKS değişiminin bileşimi başlangıç VKS'den bağımsızdır, dolayısıyla kg
  canlı ağırlık başına gereken enerji sabittir"* (s.28) ve *"1 VKS birimi canlı ağırlığın yaklaşık
  %10'una eşittir"* (s.30) bulgularından hareketle, VKS artışı/azalışı artık **sabit haftalık bir
  miktar DEĞİL**, rasyonun ihtiyacın ne kadar üzerinde/altında olduğuyla **orantılı** hesaplanır
  (`js/game.js`, `CONFIG.ENERGY_PER_BCS_POINT_MCAL` ve ilgili sabitler). Ayrıca gerçekçi bir üst sınır
  (`MAX_WEEKLY_VKS_GAIN` / `MAX_WEEKLY_VKS_LOSS`) eklenmiştir; böylece aşırı zengin bir rasyon bile
  VKS'yi sınırsız hızda yükseltemez - gerçek bir ineğin vücut kondisyonu birkaç ayda kademeli olarak
  değişir, bir iki haftada değil.
- Bu değişiklikten önce oyun, ihtiyacın %125'ini aşan HER rasyonda (fazlalığın büyüklüğüne
  bakılmaksızın) sabit +0.05 VKS/hafta uyguluyordu; bu hem gerçek dışıydı hem de VKS'nin oyunun büyük
  kısmında hızla tavana (5.0) ulaşmasına yol açıyordu. Yeni modelde "fazla" sınıflandırması ihtiyacın
  %150'sine yükseltilmiş ve artış/azalış tamamen enerji dengesinin büyüklüğüne bağlı hale getirilmiştir.

### Doğum Sonrası Negatif Enerji Dengesi (NEB)

Süt ineklerinde doğumdan sonraki ilk haftalarda, **süt verimi hızla artarken yem tüketimi (KMT) ancak
kademeli olarak artabildiği** için, rasyon ne kadar iyi formüle edilirse edilsin fizyolojik bir enerji
açığı (NEB) oluşur. Bu oyunda `CONFIG.NEB_DEFICIT_CURVE_MCAL_PER_DAY` ile modellenmiştir:

- **Kaynak (NRC 2021, Bölüm 2 "Dry Matter Intake", s.11-12):** *"Milk production (energy expenditure)
  usually peaks 4 to 8 weeks postpartum, and peak DMI (energy intake) lags until about 10 weeks
  postpartum"* ve *"In the immediate postpartum period, cows are in negative energy balance, but
  neither the filling effect nor the energy content of rations can be altered to eliminate this."*
- **Kaynak (Butler, W.R., 2005, "Nutrition, negative energy balance and fertility in the postpartum
  dairy cow"):** NEB doğumdan sonra tipik olarak 10-12 hafta sürer.
- **Kaynak (güncel literatür derlemeleri):** NEB'in en şiddetli olduğu nokta (nadir) doğumdan sonraki
  ~1.5-3. hafta civarında olup şiddeti yaklaşık **-3.7 ile -5 Mcal/gün** arasındadır; enerji dengesi
  tipik olarak ~5-7. haftada tekrar nötr/pozitife döner.

Bu doğrultuda oyun, laktasyonun ilk **10 haftasında** (`lactationWeek` 0-10) rasyonun sağladığı enerji
dengesine, haftaya özgü ek bir açık (nadir ~2. hafta'da -5.0 Mcal/gün, 10. haftada ~0'a yaklaşır) ekler.
Bu sayede öğrenci mükemmel bir rasyon hazırlasa bile doğum sonrası ilk haftalarda VKS'de hafif bir düşüş
(gerçek "V" eğrisi) gözlemler; bu düşüş NEB penceresi kapandıkça kendiliğinden toparlanır. Yetersiz
rasyon bu doğal açığı derinleştirir. Ketozis hastalık penceresi de (`KETOZIS_MAX_LACTATION_WEEK`) bu
10 haftalık NEB dönemiyle eşleştirilmiştir, çünkü ketozis klinik olarak doğrudan NEB'in bir sonucudur.

## 8. Ekonomi Modeli

- Başlangıç sermayesi: **100.000 TL** (`CONFIG.START_CASH`).
- Yem marketi/stoğu yoktur. Bir ahır için rasyon **RASYONU KAYDET** ile kaydedildiği anda, o ahırdaki
  hayvan sayısına göre haftalık toplam yem maliyeti doğrudan kasadan düşülür ve gider (`totals.feedCost`)
  olarak biriktirilir. Aynı hafta içinde rasyon yeniden kaydedilirse önceki masraf iade edilip yeni
  rasyona göre tekrar hesaplanır.
- Haftalık sabit giderler: **işçilik (10.500 TL) + mazot/elektrik (500 TL)**.
- Tek gelir kaynağı çiğ süt satışıdır.
- Her yeni hafta başında, kapanan haftanın süt geliri/giderleri/net durumunu özetleyen bir bilgi
  penceresi otomatik olarak gösterilir.

## 9. Ahır Ekranı ve Muayene Bilgileri

Ahır ekranındaki hayvan kartlarında artık iki rozet birlikte gösterilir: **Gebe / Tohumlandı / Boş**
(üreme durumu) ve **Sakin / Durgun / Hareketli-Huzursuz** (davranış). Bu sayede öğrenci, tohumlanmış
(henüz gebelik testi yapılmamış) ile gebeliği onaylanmış hayvanları ahır ekranından ayırt edebilir.
Hastalık, kızgınlık ve kist şüphesi bilgileri ise hâlâ ahır ekranında gösterilmez; bunlara yalnızca
**MUAYENE ET** ile ulaşılır. Hayvan muayene edildiğinde artık gebelik durumu da (Gebe/Tohumlandı/Gebe
değil) muayene sonuçlarıyla birlikte açıkça belirtilir.

## 10. Mini Oyunlarda Sıralama ve Puanlama

- **Tohumlama mini oyunu**: Sıcaklık/süre girişi YOKTUR. Öğrenci 7 işlem adımını (payet alma, sıcak suya
  atma, kurulama, ucunu kesme, pistoleye yerleştirme, kılıfı takma, hayvanı tohumlama) her seferinde
  rastgele sırayla listeler ve doğru sırayla tıklamalıdır; yanlış sırayla tıklama `totals.miniGameErrors`
  sayacını artırır (final puanına eksi olarak yansır). Oturum boyunca hiç hata yapılmadan tamamlanan
  tohumlama başarılı sayılır.
- **Doğum mini oyunu**: Her aşamada "Yarım Saat Bekle / Bir Saat Bekle / Müdahale Et" seçenekleri her
  seferinde rastgele sırada gösterilir; yanlış seçim de `miniGameErrors` sayacını artırır.
- **Buzağı bakım sırası**: 4 bakım adımı rastgele sırada listelenir; yanlış sırayla seçim yapılması
  aynı sayaca eklenir.

## 11. Puanlama Formülü (100 üzerinden)

Final puanı iki bileşenden oluşur (`js/scoring.js`):

- **%70 – Kâr Puanı (0-70 puan):** Net işletme kârına göre doğrusal ölçeklenir (0 TL kâr ≈ 35 puan,
  referans kâr bandı `Scoring.PROFIT_REFERENCE_BAND`).
- **%30 – Ek Puan (0-30 puan):** Her başarılı tohumlama, her onaylanmış gebelik ve her başarılı doğum
  ek puan kazandırır; hayvan ölümü, yanlış tedavi, mini oyun hataları, başarısız doğum/buzağı kaybı ve
  geç kuruya çıkarma puan kaybettirir. Ağırlıklar `scoring.js` içinde tek yerden ayarlanabilir.

## 12. Doğum Öncesi/Sonrası Hastalık Kuralları ve 3 Farklı Oyun Sonu

- Doğumdan hemen önce **VKS > 4.0** olan ineklerde **%80 ihtimalle** metritis, retensiyo sekundinarum,
  ketozis veya abomazum deplasmanından biri doğumla birlikte hemen ortaya çıkar.
- **Ketozis** tedavisi anında iyileşmez: en az **3 hafta** sürer, bu süre boyunca süt verimi her hafta
  **yarı yarıya azalır** ve tedavi başlangıcında VKS'de **tek seferlik 0.5 puanlık düşüş** olur.
- **Abomazum deplasmanı** yalnızca laktasyonun **ilk 10 haftasında** görülür (11. haftadan itibaren
  görülmez); tedavisi **15.000 TL**'dir.
- **Retensiyo sekundinarum** yalnızca doğumdan sonraki **ilk 3 hafta** içinde görülür.
- **Metritis** doğumdan sonraki **ilk 6 hafta** içinde VEYA tohumlama mini oyununda **başarısız**
  olunduktan sonraki risk penceresinde görülebilir.
- Doğumdan sonraki **ilk 8 hafta**, negatif enerji dengesi nedeniyle VKS doğal olarak hafifçe azalır;
  rasyon enerji bakımından yetersizse bu düşüş daha hızlıdır. Enerji açığı olan ineklerde hipokalsemi,
  abomazum deplasmanı ve ketozis görülme ihtimali diğer ineklere göre **%70 daha fazladır**.

### Tedavi Sonrası Antibiyotik/İlaç Arınma Süresi (Süt Satış Kesintisi)

Gerçek süt sığırcılığında olduğu gibi, doğru tedavi uygulandıktan sonra ilaç kalıntısının sütte
bulunmaması için bir "arınma süresi" boyunca süt satılamaz (`js/economy.js`, `CONFIG.DISEASE_MILK_WITHDRAWAL_WEEKS`
ve `CONFIG.MASTITIS_MILK_WITHDRAWAL_*`):

- **Mastitis**: memede lokal tedavi edildiği için yalnızca **3 günlük süt üretiminin 1/4'ü** kadar bir
  miktar satılabilir haftalık üretimden düşülür (tam hafta bloklanmaz).
- **Diğer tüm hastalıklar** (hipokalsemi, retensiyo sekundinarum, metritis, ketozis, abomazum
  deplasmanı): sistemik tedavi gerektirdiğinden doğru tedavi sonrası **1 tam hafta** boyunca o
  hayvanın sütünün tamamı satılamaz.

Final ekranında puana göre 3 farklı son gösterilir (`js/config.js` → `ENDINGS`, eşikler
`ENDING_HIGH_SCORE` / `ENDING_LOW_SCORE`):

| Puan aralığı | Son | 
|---|---|
| ≥ 75 | "Paraları Pavyonda Ezmeyi Hakettin" (kutlama videosu) |
| 40-74 | "Çabalamaya Devam" (gece doğum videosu) |
| < 40 | "Sen En İyisi Kasiyerlikte Şansını Dene" (kasiyer videosu) |

Bu videolar için Gemini (Veo) promptları `GEMINI_VIDEO_PROMPTLARI.md` dosyasında hazırdır. Video dosyaları
`assets/videos/` klasörüne konana kadar sistem otomatik olarak emoji ile çalışmaya devam eder.

## 13. Tasarım İlkesi Hatırlatması

Oyun hiçbir aşamada öğrenciye doğrudan doğru cevabı söylemez (örn. "bu inek kızgın, tohumlayın" veya "bu
rasyona soya küspesi ekleyin" gibi ifadeler kullanılmaz). Öğrenci yalnızca gözlem, muayene bulguları ve
rasyon eksiklik etiketleri üzerinden kendi kararını vermelidir. `config.js` içindeki fiyat ve besin değerleri
ders sorumlusu tarafından dersin zorluk seviyesine göre serbestçe ayarlanabilir.

---

## 14. İzometrik 3B Çiftlik Görünümü

Oyuna, mevcut sekmelerin yanına **"Çiftlik (3B)"** sekmesi eklendi. Bu sekme, işletmenin izometrik bir
3B canlandırmasını gösterir: hayvanlar padokta serbest gezer, yem dağıtıldığında kafa kilitlerine gelir,
kızgın olanlar kümelenir, hasta olanlar durgunlaşır, işçi traktörle yem dağıtır ve mobil üniteyle sağım yapar.

### 14.0 Arayüz: oyun artık tek ekran

Eski sekme çubuğu **kaldırıldı**. Oyun doğrudan izometrik çiftlik görünümüyle açılır;
Ahırlar, Rasyon ve İşletme Defteri menüleri sahnenin **üzerinde** açılan panellerdir:

- Sol taraftaki dock düğmeleriyle (🏚️ 🌾 📒) açılır/kapanır.
- Ya da doğrudan **binaya tıklanarak**: yem deposu → Rasyon, ofis → İşletme Defteri,
  ahır/doğumhane → Ahırlar.
- "Haftayı Kapat" düğmesi de dock'tadır ve tüm ahırlar beslendiğinde yanıp söner.

**Kamera sabittir**; öğrenci yalnızca dört ana yön arasında döndürür
(◀ ▶ düğmeleri veya ← → ok tuşları; pusula GÜNEY/BATI/KUZEY/DOĞU yazar) ve
yakınlaştırır (＋ − düğmeleri, ↑ ↓ tuşları veya fare tekerleği). Serbest kaydırma
yoktur, böylece kimse haritada kaybolmaz.

### 14.1 Temel ilke: oyun mantığı değişmedi

3B katman **tek yönlü** çalışır: `Game.state`'i yalnızca **okur**. Hiçbir kural, olasılık, ekonomi veya
puanlama kodu bu katmandan etkilenmez; sekme hiç açılmasa da oyun eskisi gibi çalışır. Oyun tarafından
3B katmana yalnızca üç haber gider:

| Olay | Çağrı | Sahnedeki karşılığı |
|---|---|---|
| Ahır beslendi | `Farm3D.onFeed(ahır)` | İşçi yem hazırlar, traktör+romork yem yolundan geçip yem bırakır, hayvanlar kafa kilidine gelir |
| Hafta kapandı | `Farm3D.onWeekEnd()` | Sağım turu, sütün tanka boşaltılması, kızgınlık gözlemi |
| Ekran yenilendi | `Farm3D.sync()` | Hayvanların padok/sağlık/VKS/üreme durumu sahneye yansır |

### 14.1b Çiftlikteki iki çalışan

**İşçi** (turuncu yelekli): yem deposunda rasyon hazırlar → traktörü **makine parkından**
alıp yem karma romorkunu takar → servis yolundan yem yoluna girer → boşaltma ağzını
açıp yemlikleri doldurur → romorku parka bırakır → mobil üniteyle sağım yapar → sütü
tanka boşaltır → kızgınlık gözlemi yapar.

**Veteriner sağlık teknikeri** (beyaz önlük, steteskop, ilaç çantası): doğumu gelen
hayvanın başında bekler → hasta hayvanları tek tek muayene edip gerekirse enjeksiyon
yapar → sürü sağlık turu atar → ofiste kayıtları günceller. Durum çubuğunda ikisinin
o an ne yaptığı ayrı ayrı yazar.

### 14.2 Hayvan davranışları (hepsi `Game.state`'ten okunur)

| Oyundaki durum | Sahnedeki davranış |
|---|---|
| Normal | Padokta serbest dolaşır, rastgele duraklar, kuyruk sallar |
| Yem dağıtıldı | Kafa kilidine yürür, başını yemliğe indirir, çene hareketi yapar (~2 dk sonra padoğa dağılır) |
| Kızgın (`inHeat`) veya yalancı kızgınlık | Diğer kızgın hayvanlarla **kümelenir**; aralarından biri diğerinin sağrısına **atlar** (mounting), atlanan hayvan durur; başında **?** işareti belirir |
| Hasta (`diseases[0]`) | Durgunlaşır, yavaş hareket eder, başı alçalır; başında **?** işareti belirir |
| İleri hastalık (2+ haftadır tedavi edilmemiş) | **Yatar ve kalkmaz** |
| Ölü (`alive=false`) | Yana devrilme animasyonu oynar ve rengi solar (işaret gerekmez, açıkça görünür) |
| Doğumu gelen (`pendingCalvings`) | **Doğumhane bölmesine** yürür ve yatar |
| VKS düşük/yüksek | Gövde hacmi **küçülür/büyür** (VKS 1.5 → %80, VKS 5.0 → %116) |
| Laktasyonda | Meme dolgunluğu günlük süt verimine göre büyür; kurudaki hayvanda küçülür |

20 hayvanın her biri kulak numarasından türetilen sabit bir tohumla üretilir: 4 farklı benek deseni,
6 farklı benek rengi (siyah-alaca, kırmızı-alaca, koyu kahve), 4 farklı zemin tonu ve %±7 gövde
ölçüsü farkı. Aynı hayvan her oturumda aynı görünür.

**İşaret kuralı (eğitim amaçlı):** hayvanın üzerinde durumu ELE VEREN simge yalnızca
**gebe** hayvanlarda (🤰) görünür — gebelik zaten muayeneyle doğrulanmış bir bilgidir.
Kızgın ya da hasta hayvanda yalnızca **soru işareti** çıkar; öğrenci neyi olduğunu
anlamak için hayvanı **muayene etmek zorundadır**. Bu, yalancı kızgınlık tuzağını
(bkz. madde 14.2) da korur.

**Künye resmi:** hayvan kartlarındaki fotoğraf artık hazır bir 2B görsel değil;
ineğin 3B sahnedeki modelinin küçük bir sahnede ayrıca render edilmiş hâlidir
(`Farm3D.getPortrait`). Karttaki hayvan ile ahırda gezen hayvan birebir aynı
desene, renge ve vücut kondisyonuna sahiptir; VKS değişince vesikalık yenilenir.
3B katman yüklenemezse eski `assets/cows/cow_NN.jpg` görsellerine düşülür.

### 14.3 3B modellerin yeniden üretilmesi (Blender)

Modeller elle çizilmedi; **Blender script'leriyle** üretiliyor. Yerleşimi değiştirmek isterseniz
`blender/build_farm.py` içindeki ölçüleri düzenleyip script'i yeniden çalıştırmanız yeterli:

```bash
BL="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
"$BL" --background --python blender/build_farm.py  -- "$PWD/assets/3d/farm.glb" "$PWD/assets/3d/farm_layout.json"
"$BL" --background --python blender/build_cow.py   -- "$PWD/assets/3d/cow.glb"
"$BL" --background --python blender/build_props.py -- "$PWD/assets/3d/worker.glb" "$PWD/assets/3d/machines.glb"
```

Kontrol amaçlı izometrik render almak için:

```bash
"$BL" --background --python blender/preview.py -- "$PWD/assets/3d/farm.glb" onizleme.png 0 225 noroof
```

**Önemli:** `build_farm.py` hem `farm.glb`'yi hem de `farm_layout.json`'u üretir. JS tarafı padok
sınırlarını, kafa kilidi hatlarını ve traktör güzergâhını bu JSON'dan okur; böylece model ile davranış
kodu **tek kaynaktan** beslenir ve birbirinden kopmaz.

Animasyonlar Blender'da bake **edilmez**. Modeller adlandırılmış pivot (Empty) hiyerarşisi olarak
aktarılır (`Neck`, `Head`, `Tail`, `Leg_FL`, `Knee_FL`, `Wheel_RL` …); yürüme, otlama, yatma, ölüm ve
tekerlek dönüşü JS tarafında hesaplanır. Böylece hız/hastalık/VKS gibi oyun değişkenleri animasyona
doğrudan yansır ve GLB dosyaları küçük kalır.

### 14.4 Çalıştırma koşulu (önemli)

3B sekmesi model dosyalarını `fetch` ile yüklediği için **`file://` ile açıldığında çalışmaz** —
tarayıcı güvenlik kuralı. GitHub Pages adresinden veya yerel bir sunucudan açılmalıdır:

```bash
python -m http.server 5183
```

Sayfa `file://` ile açılmışsa 3B sekmesi bunu tespit eder ve öğrenciye açıklayıcı bir uyarı gösterir;
oyunun diğer tüm sekmeleri normal çalışmaya devam eder.

### 14.5 Başarım

Sahne ~600 çizim çağrısı ve ~73 bin üçgen içerir. Kare süresi 2,5 saniyelik ortalamada 40 ms'yi geçerse
(≈25 FPS altı) kalite otomatik olarak kademeli düşürülür: önce piksel oranı ve gölge çözünürlüğü,
gerekirse gölgeler tamamen kapatılır. Sekmeden çıkıldığında render döngüsü durur, CPU/GPU boşa çalışmaz.

### 14.6 Sesler

Ses sistemi `js/sfx.js` dosyasındadır ve iki kaynaktan beslenir:

- **Gerçek kayıtlar** (`assets/audio/`): inek sesi, çan ve traktör motoru. Üçü de
  Wikimedia Commons'tan alınmış serbest lisanslı kayıtlardır; eser sahipleri,
  lisanslar ve yapılan kırpma işlemi `assets/audio/KAYNAKLAR.md` dosyasında belgelidir.
  İnek sesi her çalışta rastgele perdeden oynatılır, böylece sürü tek sesli olmaz.
- **Arayüz sesleri** (tık, onay, uyarı, kasa, hafta sonu melodisi) dosya değildir;
  Web Audio API ile anlık üretilir. Lisans gerektirmez, ek indirme yapmaz.

Traktör motoru yalnızca araç hareket hâlindeyken duyulur; ortam sesi (uzaktan böğürme,
çan) 14-36 saniyede bir rastgele çalar ve sekme görünür değilken susar. Dock'taki
**🔊 Ses** düğmesi sesi açıp kapatır; tercih `localStorage`'da saklanır.

Tarayıcılar kullanıcı sayfayla etkileşene kadar ses çalmaya izin vermediği için ses
sistemi ilk tıklamada başlatılır.

### 14.7 Görsel dil

Tipografi daha sıcak ve okunur yazı tipleriyle yenilendi: **Fredoka** (başlık ve
düğmeler), **Nunito** (gövde), **Space Mono** (rakam/veri). Renk paleti
doygunlaştırıldı; üst şeritte hareketli renk bandı, düğmelerde basılma hissi,
kartlarda yükselme, "Haftayı Kapat" düğmesinde nabız efekti eklendi.
`prefers-reduced-motion` tercihi açık olan kullanıcılarda tüm animasyonlar kapanır.

### 14.8 Dört mevsim

56 haftalık oyun 14'er haftalık dört mevsime bölünür:

| Hafta | Mevsim | Çiftlikte görünen |
|---|---|---|
| 1-14 | ☀️ **Yaz** | Kurumaya yüz tutmuş sarımsı çim, koyu yeşil ağaçlar, yüksek ve sıcak güneş |
| 15-28 | 🍂 **Sonbahar** | Altın rengi çim, turuncu ağaçlar, kehribar gökyüzü, **savrulan yapraklar** |
| 29-42 | ❄️ **Kış** | Karla kaplı zemin ve çatılar, yapraksız gri ağaçlar, soğuk mavi ışık, **kar yağışı** |
| 43-56 | 🌱 **İlkbahar** | Taze yeşil çim, açık yeşil ağaçlar, berrak gökyüzü, **havada uçuşan polen** |

Mevsim yalnızca hafta numarasından hesaplanır (`seasonForWeek`) ve sağ üstteki
rozette yazar. Değişen şeyler: çim/yaprak/gövde renkleri, gökyüzü ve sis, güneşin
rengi-şiddeti-açısı, çatı ve sert zeminlerin tonu, bir de havadaki parçacık sistemi.

**Bu katman tamamen görseldir.** Süt verimi, hastalık olasılıkları, yem maliyetleri
veya üreme kuralları mevsimden **etkilenmez**; `Game.state`'e hiç dokunulmaz.
İleride "yazın sıcak stresi" gibi bir kural eklemek isterseniz bunu oyun mantığı
tarafında ayrıca tanımlamak gerekir.

### 14.9 İşçinin yem hazırlama animasyonu

"HAYVANLARI BESLE" denince işçi önce yem deposuna gider ve **üç gözden sırayla**
(saman → yonca → tahıl/küspe) balya alıp makine parkındaki karma romorkuna taşır:
eğilip yükler, balya elinde görünür hâlde taşınır, romorkun yanında kollarını
kaldırıp kazana atar, her seferinde karıştırma burgusu hızlanır. Üç tur bittikten
sonra traktöre biner, romorku takar ve dağıtım turuna çıkar.

### 14.10 Tanıtıcı karakter: İşçi Ahmet

Oyun ilk açıldığında çiftliğin işçisi **Ahmet** gelir ve dokuz kartlık kısa bir
tanıtım yapar: ekranın nasıl döndürüleceği, soldaki üç menünün ne işe yaradığı,
hayvana nasıl tıklanacağı, sorunun (?) ne anlama geldiği, haftanın nasıl kapatılacağı.

**Ahmet bilerek yardım etmez.** Hangi yemi kaç kilo vereceğini, hangi hayvanın ne
zaman tohumlanacağını, bir hayvanın neyi olduğunu söylemez — bunlar öğrencinin
değerlendirilecek kararlarıdır. Ahmet yalnızca "ne nerede yapılıyor" anlatır.

Oyuncuya girişte yazılan **ada göre** hitap eder: kadın adlarında *"abula"*,
diğerlerinde *"ağbii"*. Ad listesi `js/intro.js` içindeki `KADIN_ADLARI` dizisidir;
tanınmayan adda "ağbii" denir, gerekirse listeye ekleme yapılabilir.

Tanıtım bir kez otomatik çıkar (`localStorage`'da işaretlenir); soldaki
**👋 Ahmet** düğmesinden istendiği zaman tekrar açılır.

### 14.11 İneklerin dinlenmesi

Gerçek bir sürüde inekler günün 12-14 saatini yatarak geçirir. Bu yüzden padokta
gezinen hayvanlar ara ara boş bir **duraga çekilip yatar**, 25-80 saniye gevişini
getirir, sonra kalkıp gezmeye devam eder. Duraklar rezervasyonludur: iki inek aynı
duraga giremez (`Farm3D._buildStalls` / `ctx.stallFor`). Kuru ahırda durak olmadığı
için hayvanlar altlıklı zeminde rastgele bir yere yatar.

Kalkma hareketi ayrı bir aşamadır (`rising`): hayvan 1,5 saniyede doğrulur, sonra
duragı serbest bırakır ve bir süre tekrar yatmaz.

### 14.12 Çalışanların yol bulması

İşçi ve tekniker padokların **içine girmez**; laktasyon ahırında ortadaki servis/yem
yolundan, kuru ahırda yemlik önündeki koridordan hayvana ulaşırlar
(`_accessPoint` / `_route`). Bu hem gerçekçidir hem de karakterlerin duvarların
içinden geçmesini engeller. Başlarındaki küçük renkli işaret (🧑‍🌾 yeşil = işçi,
🩺 mavi = tekniker) kalabalık padokta kim olduklarını belli eder.

---

## 15. Tarayıcı önbelleği ve sürüm damgası

Tarayıcılar `js` ve `css` dosyalarını önbelleğe alır. Oyunda bir değişiklik
yapıldığında sayfa yenilense bile **eski kod** çalışmaya devam edebilir;
"animasyon çalışmıyor", "yeni özellik görünmüyor" şikâyetlerinin çoğunun
sebebi budur.

Bunu kalıcı olarak çözmek için:

1. `index.html` artık `no-cache` meta etiketleri taşır (HTML'in kendisi
   önbelleğe takılmasın diye).
2. Bütün yerel `js`/`css` bağlantıları `?v=<zaman damgası>` taşır.
3. `OYUNU BASLAT.bat` her açılışta adrese rastgele bir damga ekler.

**Kod değiştirdiğinizde** proje klasöründe bir kez şunu çalıştırın:

```bash
py tools/surum_damgala.py
```

Araç `index.html` içindeki script/link etiketlerini, `js/iso/*.js` içindeki
ES modül `import` satırlarını ve `js/sfx.js` içindeki ses yollarını yeni damgayla
günceller. `vendor/` altındaki Three.js dosyaları bilerek damgalanmaz: GLTFLoader
kendi içinden `three.module.js`'i damgasız çağırdığı için bir tarafı damgalamak
Three.js'in iki ayrı kopya olarak yüklenmesine ve sahnenin bozulmasına yol açar.
