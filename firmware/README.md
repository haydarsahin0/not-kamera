# Not Ekran V2 — 0.4.0

**0.1.0 metin gönderimi kullanıcı tarafından fiziksel cihazda doğrulandı. Yeni 0.4.0 fotoğraf köprüsünün gerçek iPhone/API testi bekliyor.**

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
7. BOOT tek basış: sonraki; çift basış: önceki sayfa; uzun (3 saniye): bağlantı bilgileri. PWR yeniden atanmadı.

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
- ASCII font: Türkçe/Almanca harfler sadeleşir; diğer Unicode simgeler `?` olabilir.
- E-paper tam yenileme; değişiklikler en az 3 saniye aralıklı. Yenilemede kısa süreli
  siyah/beyaz geçiş normal. Yenileme sırasında HTTP isteği birkaç saniye bekleyebilir.
- Ekran BUSY sinyaline 10 saniye sınır; hata olursa ekran işlemleri durur, web hata gösterir.
- Pil yüzdesi/ölçümü, uyku, RTC, ses, yerleşik kamera, OTA yok. Cihaz eşleştirmeden sonra cevabı kendisi HTTPS üzerinden alır.
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
`web/install/not-ekran-v2.bin`, flash başlangıcı `0x0`. 0x10000'e yükleme!
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

0.4.0 cihaz sayfası Supabase fonksiyon adresini varsayılan doldurur ve HTTPS adresinde /functions/v1/not-kamera-api yolunu kabul eder. Kurulum fragment'i bağlantıyı doldurur; uygulama erişim kodu CSRF korumalı POST ile cihazın NVS alanına kaydedilir. Derlenmiş dosyada hiçbir kullanıcı sırrı bulunmaz. OpenAI modeli sunucuda GPT-6.1 Sol olarak sabittir. Ana README canlı kurulum ve test durumunu açıklar.

## 0.4.0 teslimat ve gezinme

Ana siteden gönderilen her fotoğraf cihaz için seçilir. Cihaz /api/device/poll ile tam metni alır, X-Text-Bytes ve X-Text-Sha256 başlıklarını doğrular. Ekran yenilendikten sonra delivery UUID'siyle /api/device/ack çağrılır. Eski onay yeni cevabı onaylayamaz. Cihaz internet erişimi olan Wi-Fi'de olmalıdır; internetsiz NotEkran ağı yalnızca kurulum içindir. iPhone hotspot + Uyumluluğu En Üst Düzeye Çıkar fiziksel olarak test edilmelidir.

Metin kısaltılmaz; 64 KiB sınırında hata verilir. Yeni cevap tüm soruları sırayla sayfalara böler. Eski fotoğraflar sitedeki geçmişten yeniden gönderilebilir. NVS Wi-Fi ve uygulama kodunu korur, cevap RAM'dedir ve yeniden açılınca son bulut cevabı yeniden alınır.

Testler: node --test supabase/tests/*.test.mjs; node firmware/tests/test_camera.cjs; g++ -std=c++17 firmware/tools/test_navigation.cpp -o /tmp/navigation && /tmp/navigation.
