# Not Ekran V2 — 0.10.1

## 0.10.1: veritabanı düzeltmesi ve matematik gösterimi

Canlı hata kaydı: PostgreSQL 21000, “DELETE requires a WHERE clause”. Bağlam sıfırlama yalnızca mevcut generation değerine ait sayfaları temizler; güvenlik koruması veya roller değiştirilmez. Supabase düzeltmesi mevcut cihaza yeniden yükleme gerektirmeden etkilidir. Açık kullanıcı temizleme işlemi mevcut kayıt zamanını hedefler.

Yeni cihaz yazılımı eski/yeniden gelen metindeki y^2 → y², x^{a+b} → xᵃ⁺ᵇ, Y_{t+1} → Yₜ₊₁ ve x_i → xᵢ gösterimini destekler. 1506 font karakteri; aynı 16 px grafik metrikleri sunucuda da kullanılır. Tam LaTeX, matris veya üst üste kesir çizimi değildir. Desteklenmeyen ifadeler değiştirilmez; mevcut geçmiş dosyaları yeniden yazılmaz.

Doğrulama: gerçek veritabanında yalnızca pg_temp tablolarıyla, service_role altında 1,5 MB ilk/ikinci sayfa, request-id tekrarı, sıfırlama ve temizleme; API teslim testleri; ortak sunucu/cihaz matematik örnekleri; her font karakterinin gerçek piksel sınırları; NVS/LittleFS korumalı derleme. Fiziksel cihazda USB yüklemesi sonrası görüntü kontrolü gerekir.


## 0.10.0: önceki sayfalara koşullu bağlantı

Her fotoğraf tek istek UUID’siyle gönderilir; aynı upload’ın ağ yeniden denemeleri aynı kimliği taşır. Yeni çalışma seçimi `X-Study-Reset` olarak fotoğrafla birlikte internete çıkana kadar kuyrukta korunur. Supabase son 7 orijinal fotoğrafı özel erişimle tutar, yeni soruya en fazla 6 önceki başarılı sayfayı gönderir. Model bağımsız/önceki veriye bağlı/eksik bağlam kararını ayrı JSON alanında verir; bu alan cihaz cevabına dahil edilmez. Kullanıcıdan her fotoğrafta bağlantı seçmesi istenmez. Profil değişimi, yeni çalışma veya 2 saatlik aradan sonra gelen yeni analiz eski bağlamı temizler. Yenileme cihazdaki cevap geçmişini silmez.

Modelin bağlantı kararının her soruda doğru olması garanti edilemez. Hafızadaki 6 önceki fotoğraf dışında kalan veya okunamayan değerler için eksik bilgi belirtilir; sayısal sonuç uydurulmaması istenir. Yerel arayüz USB ile firmware yüklendikten sonra güncellenir.

## 0.9.0: cevap geçmişi, güç kesintisinden sonra devam, soru başlıkları

- Son **12 ayrı cevap** LittleFS üzerinde kaynak UTF-8/JSON belgesi olarak saklanır; grafikler ve fontlar açılışta yeniden üretilir. Aynı içerik/font tekrar gelirse kopya kayıt oluşturulmaz, kendi sayfa konumu korunur. Yeni içerik otomatik açılır; kapasite dolunca en eski cevap kaldırılır. Fotoğraflar/API anahtarları bu geçmişe yazılmaz.
- Her cevabın okuma konumu fiziksel ekran yenilemesi başarılı olduktan sonra atomik indeks değişimiyle kaydedilir. Güç döngüsünde son **başarıyla kaydedilmiş** sayfa internet beklemeden geri gelir. Yenileme/kayıt sürerken güç kesilirse önceki kayıt dönebilir. Yeni cevap ve indeks CRC32/boyut doğrulamasıyla okunur; yarım geçici dosya önceki indeksi silmez. Değişmeyen konum yeniden yazılmaz. Ekranda gösterildiği kaydedilmiş teslimatın tekrar gelmesi okuma konumunu değiştirmez; yeni teslimat ise otomatik açılır.
- Her metin/grafik/legend sayfasında 16 px Unicode soru başlığı ve **o göreve ait** `3/7` sayacı vardır. Uzun başlık üst şeritte kısaltılır; tam başlık kaynak/metin sayfasında korunur. Gövde 18 px kalır. BOOT tek/çift/uzun, PWR pil ekranı ve 30 saniyelik otomatik geçiş aynıdır.
- Yerel `/` sayfasında cevap geçmişi vardır. `/history/select` ve `/clear` kimlik doğrulama ve CSRF gerektiren POST'lardır. Silme yalnızca açık cevabı geçmişten kaldırır; kalan son cevap açılır. Eski cevaba dönme dışında yeni cevapları okumak için dokunmak gerekmez. Bu sürüm kamera çekimini otomatikleştirmez.
- Mevcut `default_8MB` bölüm tablosu korunur; `spiffs` adlı 1.5 MiB veri bölümü LittleFS için kullanılır. İlk kullanımda **yalnız tamamen 0xFF olan** bölüm formatlanır; mevcut veride mount/CRC hatası varsa otomatik silme yapılmaz. Yeni cevap kayıt hatasında önceki cevap korunur, fiziksel teslimat onaylanmaz ve yerel durum sayfasında hata gösterilir. Yükleyicinin **erase seçeneğini kapalı bırak**: NVS ve yeni cevap geçmişi korunur. 0.8.0'daki yalnız RAM'de olan eski cevaplar geçmişe geriye dönük alınamaz; sonraki cevaplar saklanır.
- Native hata enjeksiyonu testleri: kaynak/indeks yazımı kesintisi, CRC/boyut bozulması, ayrı cevap konumları, tekrar teslimat, sınır/12 kayıt, 64 KiB ve Unicode/grafik başlıkları. Ekran/pil/tuş/fotoğraf ve API testleri ile ESP32-S3 derlemesi ayrıca çalıştırılır. Donanımda Flash/PWR/panel doğrulaması kullanıcı USB yüklemesi sonrası gereklidir.

```sh
g++ -std=c++17 -Wall -Wextra -Werror -I/path/to/cJSON firmware/tools/test_history.cpp /path/to/cJSON/cJSON.c -o /tmp/test-history
/tmp/test-history firmware/tests/graph-fixture.json
```

## Önceki 0.8.0: gerçek grafik sayfaları ve pil ekranı

- Sunucu OpenAI Responses `text.format` strict JSON Schema ile metin/grafik belgesi alır. Grafik gerekiyorsa normlanmış çizim verisi istenir; yalnız bir tarif çizim sayılmaz. Her grafik en fazla 3 eğri, 3 nokta, 3 ok, her eksende 3 tick; 2–24 destek noktası/eğri. Karmaşık çizimler en fazla 12 ayrı grafik, 4/alt görev ve 24 alt görev içinde bölünür. Bu sürüm 2D eğri/eksen grafiklerini destekler; bütün olası diyagram türleri veya modelin iktisadi doğruluğu garanti edilmez.
- Grafik eksenleri, eğrileri, denge noktaları, izdüşümleri, değişim okları ve 16 px Unicode etiketler cihazda çizilir. Aynı algoritma ve font ölçüleriyle etiket taşması/çakışması sunucuda kontrol edilir. Yakın denge noktaları için kısa işaret çizgileri kullanılır; uzun etiket sığmazsa okunabilir kod ve sonraki sayfada açıklaması korunur. Hatalı/eksik/aşırı büyük çizim başarılı cevap veya ekran ACK'i olmaz. Başlık ve açıklama ayrı 18 px metin sayfalarıdır.
- `/api/jobs/:id?format=not-ekran-answer-v1` ve `/api/device/poll?format=not-ekran-answer-v1` tam belge döndürür. Eski yazılımlar okunabilir metin ve grafik için 0.8.0 güncelleme notu alır, JSON göstermez. Eski düz metin cevapları yeni cihazda çalışır. NVS, auth, API key, 64 KiB sınırı ve fiziksel yenileme sonrası ACK korunur. Şema/yönerge değişimi fotoğraf önbelleği özetine dahildir.
- PWR artık beyaz ekran yerine gülen/uykulu pil resmi, büyük yaklaşık yüzde ve voltaj gösterir. Ekran rail'i yine kapatılır, cihaz/RAM/Wi-Fi açık kalır. BOOT ve otomatik geçiş bekleme ekranında durur; açılınca aynı okuma konumu ve yeni 30 saniye korunur. Bekleme resmi teslimat onayı sayılmaz.
- V2 pil ADC GPIO4 = ADC1 channel 3; 12-bit kalibre `analogReadMilliVolts`, 12 dB attenuation (Arduino `ADC_11db` alias), 1:2 bölücü. 24 örnekten ortadaki 12 değer ortalanır. Üreticinin V2 factory örneği gibi 3.00–4.12 V arası yüzde tahmini kullanılır. Kalibrasyon/doğruluk bir yakıt ölçer düzeyinde değildir; yük/USB şarjı tahmini değiştirir. Şarj var/yok pin ölçümü yoktur, USB'de şarj oluyor veya pil mevcut gibi kesin gösterge verilmez. Geçersiz 2.50–4.35 V dışı okumada `--%` gösterilir. 5 saniye ölçüm; gizliyken yüzde en az 2 değişirse en erken 60 saniyede e-paper yenilenir. Varsayılan değer veya sahte 100% yok.
- Üretici pil ölçüm kaynağı: sabit revizyondaki `02_Example/ESP-IDF/V2/01_ADC_Test/components/adc_bsp/adc_bsp.c` ve `11_FactoryProgram/components/port_bsp/port_adc.cpp`. V1 ADC/schematic kullanılmaz.
- Testler: gerçek production rasterizer ile IS-LM/AD-AS/arz-talep piksel sınırları; UTF-8, tam belge ve eski metin, geçersiz grafik reddi/korunan okuma verisi, pil monotonluk/sınırları, bekleme yenilemesi/geri dönüş/30 sn; Node API structured format/checksum/legacy/auth/no-ACK kontrolleri. Firmware gerçek ESP32-S3 derlemesi ayrıca yapılır. Donanımda gerçek ADC/PWR/grafik testi kullanıcı USB yüklemesi sonrası gereklidir.

`web/install/preview.html` gerçek cihaz renderer'ından alınmış **sentetik örneklerin** 200×200 raster görüntülerini içerir. Önizleme pil yüzdesi örnek 3.80 V girişidir, canlı cihaz ölçümü değildir.

## Önceki 0.7.0 sürümü

## 0.7.0: PWR ile ekranı kapat/aç, 18 px yazı

- **PWR kısa basış:** ekran beyaza temizlenir, sonra ekranın güç hattı kapatılır. Yeniden kısa basışta metin ve okuma sayfası RAM'den korunarak çizilir. E-paper güç kesilince son görüntüyü tuttuğundan yalnız güç hattını kesmek yeterli değildir.
- Bu işlem cihazı tümüyle kapatmaz: Wi-Fi, ağ işlemleri ve RAM açık kalır. Pili çıkarınca veya cihazı yeniden başlatınca bu okuma konumu korunmaz. Güç tasarrufu/süre garantisi verilmez.
- Ekran kapalıyken otomatik sayfa geçişi ve BOOT gezinmesi durur. Açılıp fiziksel yenileme tamamlandıktan sonra 30 saniyelik süre yeniden başlar. BOOT'un açık ekrandaki tek/çift/uzun basışları aynı kalır. Web arayüzünde de ekran aç/kapat düğmesi vardır; gizliyken web ileri/geri istekleri 409 verir.
- Varsayılan cevap fontu **18 px kalın Unicode** oldu; manuel 16 px seçeneği kalır. Her boyutta 1478 glif, Almanca/Türkçe/Yunanca ve yaygın matematik karakterleri korunur. 18 px fontta 6 satır/sayfa, daha çok karakter/satır vardır.
- Yeni bulut cevabı kapalı ekranı açmaz. Kuyrukta bekler; ekran açıldığında önce korunan sayfa çizilir, ardından yeni cevap normal biçimde alınır. Beyaz ekran yeni cevap teslimatı olarak onaylanmaz.
- PWR GPIO18, ekran güç GPIO6 ve batarya tutma GPIO17 üreticinin sabit V2 `07_BATT_PWR_Test/main/user_config.h` ve `board_power_bsp.cpp` örneklerine göre kullanılır. Açılış için zaten basılı PWR tuşunun bırakılması ilk ekranı kapatmaz; 35 ms debounce ve tek bırakış olayı kullanılır.
- Supabase cevap yönergesi kısaltıldı: yalnızca sorulan kapsam, operatöre göre yeterli uzunluk, doğal öğrenci dili, gereksiz giriş/tekrar/yorum olmadan. Hesap adımları ve istenen açıklamalar korunur. Yönerge fotoğraf özeti anahtarına dahildir, eski uzun cevap önbelleği yeni sorularda kullanılmaz.
- Unicode raster/taşma, ekran görünürlüğü/PWR debounce/30 sn duraklama/kuyruk sırası, yerel fotoğraf akışı ve Supabase API testleri ile gerçek firmware derlemesi kontrol edilir. Fiziksel PWR/panel testi USB yüklemesi sonrası kullanıcı cihazında yapılmalıdır.

```sh
g++ -std=c++17 -Wall -Wextra -Werror firmware/tools/test_screen_visibility.cpp -o /tmp/test-screen
/tmp/test-screen
```

## Önceki 0.6.0 ekran düzeltmeleri

- Bulut cevapları 8 px yerine varsayılan **20 px kalın DejaVu Sans Unicode** fontla gösterilir. Manuel metin için 16 px seçeneği de vardır. Büyük boyutta 6 satır/sayfa; satırlar piksel genişliğine göre bölünür, UTF-8 karakter ortasından kesilmez ve cevap kısaltılmaz.
- Türkçe/Almanca harfler, Yunan harfleri, matematik/aralık/para/ok işaretleri doğrudan çizilir. 1478 Unicode karakterin 16/20 px bitmapleri firmware'e dahildir. `?` üreten ASCII dönüşümü cevap akışından kaldırıldı. Nadir kapsam dışı karakterler kaybolmaz: örneğin emoji `[U+1F642]` olarak belirtilir. Kaynak cevapta zaten bulunan `?` değişmez; geçmişte kaybolmuş bilgi geri üretilemez.
- Çok sayfalı cevap 30 saniyede otomatik ilerler; son sayfadan ilk sayfaya döner. Süre fiziksel yenileme tamamlanınca başlar. Manuel ileri/geri geçişten sonra yeni sayfa 30 saniye kalır. Bilgi/fotoğraf işlem ekranında, tuşa basarken ve ekran hatasında otomatik geçiş olmaz. Tek sayfa gereksiz yenilenmez. BOOT tek/çift/uzun basış davranışı korunur.
- Wi-Fi, cihaz şifresi ve eşleştirme aynı NVS alanlarında kalır. Güncellemede erase seçilmemelidir. Sunucu/API değiştirilmedi.
- `firmware/tools/test_display.cpp`: gerçek rasterizer ile tüm font karakterlerinin çizim sınırları, Türkçe/Almanca/matematik, birleşik aksan, hatalı UTF-8, 64 KiB metin, 30 saniye/sıfırlama/duraklama/millis taşması testleri. Yeni sürüm derlendi; fiziksel cihazda yeni font/timer testi henüz yapılmadı. Önceki fotoğraf → cevap → ekran akışı kullanıcı tarafından doğrulandı.

Font lisansı: `firmware/FONT-LICENSE.txt`. Yeniden üretmek için Pillow/fontTools ile `python firmware/tools/prepare_font.py --font /path/to/DejaVuSans-Bold.ttf`; derleme checked-in header'ı kullanır.

```sh
g++ -std=c++17 -Wall -Wextra firmware/tools/test_display.cpp -o /tmp/test-display
/tmp/test-display
```

Aşağıdaki fotoğraf aktarım yolu 0.5.0 ile aynıdır.

## Tek iPhone, yalnızca cihaz sayfası

1. USB ile 0.10.1 yazılımını yükle. Silme seçeneğini kapalı bırak: Wi-Fi ve uygulama eşleştirmesi NVS’den korunur.
2. NotEkran ağına bağlanıp `http://192.168.4.1/camera` aç. Yerel kullanıcı `admin`; şifre cihazın bağlantı ekranındaki koddur. Önceki eşleştirme otomatik okunur. OpenAI anahtarı girilmez veya cihaz tarafından indirilmez; yalnızca Supabase fonksiyonu bu anahtarı kullanır.
3. Fotoğrafı çek/seç. Sayfa JPEG’e küçültüp CSRF korumalı multipart POST ile **yerel cihaza** yükler. Hiçbir tarayıcı isteği buluta gitmez.
4. “Fotoğraf cihaz tarafından alındı” mesajından sonra NotEkran ağından çıkıp iPhone kişisel erişim noktasını aç. Cihaz önceden kaydedilen ağa tekrar bağlanır, saati NTP ile doğrular, TLS üzerinden fotoğrafı Supabase’e gönderir.
5. Cihaz kendi işinin sonucunu takip eder; tüm cevabı sayfalara ayırıp e-paper ekrana yazar. Sayfayı kapatmak işlemi durdurmaz. BOOT tek basış ileri, çift basış geri.

Aynı iPhone kendi erişim noktasını sunarken NotEkran ağına bağlanamaz. Bu yüzden tek telefonla ağ değişimi gerekir; `192.168.4.1` internet adresi değildir. Cihaz başka bir internetli Wi-Fi ağına bağlıysa yerel sayfa ve işlem aynı anda kullanılabilir. Yerel LAN adresi de aynı arayüzü açar; iPhone erişim noktası üzerinden client IP erişimi fiziksel olarak doğrulanmadı.

Fotoğraf en fazla 4 MB, PSRAM’de tek işlem olarak tutulur. Güç kesilirse henüz gönderilmeyen fotoğraf kaybolur. Tamamlanan fotoğraf buffer’ı serbest bırakılır. İkinci fotoğraf önceki işlem bitmeden reddedilir. Oversize, eksik aktarım, yanlış CSRF, geçersiz JPEG ve bellek yetersizliği açık hata verir. 0.5.0’da yerel sayfa `/api/photo/status` ile eşleştirme, Wi-Fi, saat, bulut hata metni ve fiziksel ekran durumunu gösterir. Uygulama token’ı tarayıcıya geri verilmez. Cevap yalnızca gerçek e-paper yenilemesi başarıyla bitince “rendered” durumuna geçer. Eski bulut yanıtı yeni fotoğraf işlemini geçersiz kılamaz; iletiler işlem nesliyle kontrol edilir.

Doğrulama: V2 firmware derlendi; offline eşleştirme, yalnızca yerel multipart yükleme, çift gönderim önleme, ekran durumu ve buffer sınırları test edildi. Önceki 0.1.0 metin aktarımı kullanıcı cihazında çalıştı; gerçek OpenAI analizi sunucuda geçti. **0.5.0 fotoğraf → fiziksel cihaz akışı kullanıcı donanımında henüz doğrulanmadı.**


**0.1.0 metin gönderimi kullanıcı tarafından fiziksel cihazda doğrulandı. Yeni 0.4.1 fotoğraf köprüsünün gerçek iPhone/API testi bekliyor.**

Yalnızca Waveshare ESP32-S3-ePaper-1.54 V2 (8 MB flash / 8 MB PSRAM).
V1, başka kart veya farklı panel için kullanılmaz. Telefon fotoğrafını HTTPS sunucuya gönderip OpenAI yanıtını ekrana aktaran yerel arayüz içerir.

## Kullanıcı kurulumu

Pages yayınlandıktan sonra: https://haydarsahin0.github.io/not-kamera/install/

1. Windows Chrome/Edge; USB veri kablosu. Kart üzerinde V2 işaretini kontrol et.
2. Yükleyici mevcut fabrika uygulamasının yerine geçer. İlk kurulumda eski ayarları sil. 0.1.0 sürümünden güncellemede Wi-Fi ve cihaz şifresini korumak için “erase” seçme.
3. Yükleme bitince BOOT'a basmadan USB'yi çıkar/tak.
4. Ekrandaki NotEkran-XXXX ağına, yine ekrandaki şifreyle bağlan.
5. Safari: **http://192.168.4.1**. Kullanıcı `admin`, şifre ekrandaki kod.
6. Merhaba gönder. Birkaç saniye sonra ekranın değiştiğini doğrula.
7. BOOT tek basış: sonraki; çift basış: önceki sayfa; uzun (3 saniye): bağlantı bilgileri. PWR kısa basış ekranı kapatır/açar; metin ve sayfa korunur.

Cihazın kendi Wi-Fi ağı internetsizdir ve açık kalır. Başka bir ağa bağlamak için
cihazın sayfasında ağ adını/şifresini gir. Sadece 2,4 GHz kişisel şifreli ağlar;
eduroam/kurumsal EAP/giriş sayfalı ağ desteklenmez. Yanlış şifrede yerel ağ üzerinden düzelt.
Yeni IP'yi BOOT uzun basışla gör. LAN erişimi için telefon aynı ağa erişebilmeli;
iPhone'un kendi hotspot istemcisine erişimi donanımda ayrıca test edilecek.

## Özellikler ve sınırlar

- Cihaza özel rastgele 16 karakter WPA2 ağ şifresi; aynı kodla HTTP Basic giriş.
- Ağ ayarları ve kod NVS'de kalıcı; metin yalnızca RAM'de. Yeniden açılınca metin silinir.
- POST formlarında rastgele CSRF kodu. Dış servis/CDN yok; kontrol sayfası cihazda.
- HTTP yerel ağda şifresiz taşınır. Port yönlendirmesiyle internete açma.
- En çok 65536 UTF-8 bayt; sözcük kaydırma, iki yazı boyutu, önceki/sonraki sayfa.
- Cevaplar 16/18 px Unicode fontla çizilir; desteklenmeyen nadir karakterler açık `[U+XXXX]` koduyla gösterilir.
- E-paper tam yenileme; değişiklikler en az 3 saniye aralıklı. Yenilemede kısa süreli
  siyah/beyaz geçiş normal. Yenileme sırasında HTTP isteği birkaç saniye bekleyebilir.
- Ekran BUSY sinyaline 10 saniye sınır; hata olursa ekran işlemleri durur, web hata gösterir.
- Yaklaşık pil yüzdesi/voltaj ölçümü vardır; tam cihaz uykusu, RTC, ses, yerleşik kamera, OTA yok. Cihaz eşleştirmeden sonra cevabı kendisi HTTPS üzerinden alır.
- Açılış ekranındaki kodu başkalarıyla paylaşma. Fiziksel erişimi olan kişi kodu görebilir.
- Pil kasaya sığmıyorsa kapağı bastırma. İlk test USB ile yapılmalı.

## Kaynaklar / pinler

Üretici: https://docs.waveshare.com/ESP32-S3-ePaper-1.54

Referans repo: https://github.com/waveshareteam/ESP32-S3-ePaper-1.54
Sabit revizyon: `aaf395c1bbd86f7c5b7a2f9f0401241ff5c44956`.
V2 ESP-IDF FactoryProgram ve Arduino örnekleri ile eşleştirildi:

| İşlev | GPIO |
|---|---:|
| EPD DC / CS / CLK / MOSI | 10 / 11 / 12 / 13 |
| EPD RESET / BUSY | 9 / 8 |
| EPD güç (aktif düşük) | 6 |
| Ses güç (kapalı yüksek) | 42 |
| Batarya güç tutma (yüksek) | 17 |
| BOOT | 0 |
| PWR (ekran kapat/aç) | 18 |
| Pil ADC (ADC1 channel 3, 1:2 bölücü) | 4 |

`prepare_driver.py` üreticinin ekran sürücüsünü sabit revizyondan indirir.
Bellek ayırma 5000 bayt normal RAM'e çevrilir; BUSY beklemesine zaman sınırı eklenir.
Üçüncü taraf sürücünün mülkiyeti/lisansı üreticisine aittir; kodumuza ait lisans
iddiasında bulunulmaz. Adafruit GFX ve Arduino bağımlılıklarının kendi lisansları geçerlidir.

## Yeniden derleme

Arduino CLI kurulu bir geliştirme bilgisayarında:

```sh
arduino-cli core update-index --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core install esp32:esp32@3.3.0 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli lib install 'Adafruit GFX Library@1.12.1' 'Adafruit BusIO@1.17.4'
python3 firmware/tools/build.py
```

FQBN, sürücü revizyonu ve paketleme işlemi build.py içindedir. Çıktı
0.9.0'dan itibaren yükleyici **ayrı parçalar** yazar: `bootloader.bin` → `0x0`, `partitions.bin` → `0x8000`, `boot-app0.bin` → `0xe000`, `not-ekran-v2.bin` (yalnız uygulama) → `0x10000`. Birleşik görüntü NVS aralığını da kapladığından artık kullanılmaz. `not-ekran-v2.bin` tek başına `0x0`'a yüklenmez. Bölüm tablosu önceki sürümle aynıdır; eraseAll kapalıyken NVS ve LittleFS sektörlerine yazılmaz.
Arduino'nun birleştirilmiş çıktısında yalnızca tam uygulama sonrasındaki boş dolgu kesilir.
`build-info.json` SHA-256 değerini içerir. Derleme sırrı/Wi-Fi şifresi gerektirmez.

Metin sınır testleri:

```sh
g++ -std=c++17 -Wall -Wextra firmware/tools/test_layout.cpp -o /tmp/test-layout
/tmp/test-layout
```

## Doğrulama

ESP32 Arduino 3.3.0 için gerçek derleme yapıldı; yalnızca sözdizimi kontrolü değildir.
Metin testleri: Türkçe/Almanca dönüşümü, emoji, boş satırlar, uzun sözcük ve 65536 bayt.
Yeni fotoğraf akışı fiziksel cihaz/Safari ve gerçek OpenAI çağrısı ile henüz denenmedi.
Başarılı derleme, donanım çalışmasının garantisi değildir.

Fabrika geri dönüşü: üretici reposundaki `03_Firmware/V2-FactoryProgram.bin` ve
üreticinin yükleme yöntemi. Sorunda önce log alın; rastgele farklı kart firmware'i yüklemeyin.

## Canlı Supabase bağlantısı

0.4.1 cihaz sayfası Supabase fonksiyon adresini varsayılan doldurur ve HTTPS adresinde /functions/v1/not-kamera-api yolunu kabul eder. Kurulum fragment'i bağlantıyı doldurur; uygulama erişim kodu CSRF korumalı POST ile cihazın NVS alanına kaydedilir. Derlenmiş dosyada hiçbir kullanıcı sırrı bulunmaz. OpenAI modeli sunucuda GPT-6.1 Sol olarak sabittir. Ana README canlı kurulum ve test durumunu açıklar.

## 0.4.1 teslimat ve gezinme

Ana siteden gönderilen her fotoğraf cihaz için seçilir. Cihaz /api/device/poll ile tam metni alır, X-Text-Bytes ve X-Text-Sha256 başlıklarını doğrular. Ekran yenilendikten sonra delivery UUID'siyle /api/device/ack çağrılır. Eski onay yeni cevabı onaylayamaz. Cihaz internet erişimi olan Wi-Fi'de olmalıdır; internetsiz NotEkran ağı yalnızca kurulum içindir. iPhone hotspot + Uyumluluğu En Üst Düzeye Çıkar fiziksel olarak test edilmelidir.

Metin kısaltılmaz; 64 KiB sınırında hata verilir. Yeni cevap tüm soruları sırayla sayfalara böler. Eski fotoğraflar sitedeki geçmişten yeniden gönderilebilir. NVS Wi-Fi ve uygulama kodunu korur, cevap RAM'dedir ve yeniden açılınca son bulut cevabı yeniden alınır.

Testler: node --test supabase/tests/*.test.mjs; node firmware/tests/test_camera.cjs; g++ -std=c++17 firmware/tools/test_navigation.cpp -o /tmp/navigation && /tmp/navigation.


0.4.1 düzeltmesi: Cihazın yerel /camera sayfasındaki eşleştirme yalnızca CSRF korumalı /api/cloud POST yapar. İnternetsiz NotEkran kurulum ağında önce sunucu/model kontrolü yapılmaz. Kayıt başarılıysa eşleştirme tamamlandı mesajı gösterilir; ağ hatasında kaydedildi denmez. İlk fotoğraf ve gerçek model kontrolü HTTPS ana sitede internet bağlantısıyla yapılır. Telefon kendi internetini paylaşırken cihaz ayarları iPad üzerinden yapılabilir.
