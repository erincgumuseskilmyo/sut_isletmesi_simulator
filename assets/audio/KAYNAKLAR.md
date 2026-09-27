# Ses Dosyalarının Kaynakları ve Lisansları

Oyundaki gerçek ses kayıtları **Wikimedia Commons**'tan alınmıştır. Aşağıdaki
atıflar, lisansların gerektirdiği şekilde verilmiştir. Oyun yayına alındığında
bu bilgilerin erişilebilir kalması gerekir (README'de de bağlantı verilmiştir).

| Dosya | Kaynak | Eser sahibi | Lisans |
|---|---|---|---|
| `inek_moo.ogg` | [File:Mudchute cow 1.ogg](https://commons.wikimedia.org/wiki/File:Mudchute_cow_1.ogg) | Secretlondon | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `canlar.ogg` | [File:Cowbell.ogg](https://commons.wikimedia.org/wiki/File:Cowbell.ogg) | Freddythehat | Kamu malı (Public domain) |
| `traktor.ogg` | [File:5 cylinder engine sound.ogg](https://commons.wikimedia.org/wiki/File:5_cylinder_engine_sound.ogg) | Jonas Tittmann | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

## Notlar

- **Yapılan değişiklik:** `traktor.ogg` (930 KB → 206 KB, ilk ~7 sn) ve
  `canlar.ogg` (190 KB → ~80 KB, ilk ~4 sn) dosyaları, web'de hızlı yüklenmeleri
  için Ogg sayfa sınırından **kırpılmıştır**; ses içeriği yeniden kodlanmamıştır.
  `inek_moo.ogg` olduğu gibidir. Oynatma sırasında ayrıca ses seviyesi, hız
  (perde) ve döngü aralığı ayarlanır.
- CC BY-SA lisansları **atıf** ve **aynı lisansla paylaşım** şartı taşır. Bu
  ses dosyalarını içeren bir dağıtım yaparken bu tablonun birlikte gitmesi yeterlidir.
- Arayüz sesleri (tık, onay, uyarı, kasa, hafta sonu melodisi) **dosya değildir**;
  `js/sfx.js` içinde Web Audio API ile anlık üretilir, dolayısıyla lisans gerektirmez.
- Ogg Vorbis biçimi Chrome, Edge ve Firefox'ta sorunsuz çalışır. Desteklenmeyen
  bir tarayıcıda ses sessizce devre dışı kalır, oyun normal çalışmaya devam eder.
