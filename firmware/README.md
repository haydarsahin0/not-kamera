# Not Ekran V2 — 0.1.0

**Derlenmiş ilk donanım denemesi. Fiziksel cihaz üzerinde henüz denenmedi.**

Yalnızca Waveshare ESP32-S3-ePaper-1.54 V2 (8 MB flash / 8 MB PSRAM).
V1, başka kart veya farklı panel için kullanılmaz. Kamera/Claude bağlantısı değil,
yerel Wi-Fi ile telefondan ekrana metin gönderme testidir.

## Kullanıcı kurulumu

Pages yayınlandıktan sonra: https://haydarsahin0.github.io/not-kamera/install/

1. Windows Chrome/Edge; USB veri kablosu. Kart üzerinde V2 işaretini kontrol et.
2. Yükleyici mevcut fabrika uygulamasının yerine geçer. İlk kurulumda eski ayarları sil.
3. Yükleme bitince BOOT'a basmadan USB'yi çıkar/tak.
4. Ekrandaki NotEkran-XXXX ağına, yine ekrandaki şifreyle bağlan.
5. Safari: **http://192.168.4.1**. Kullanıcı `admin`, şifre ekrandaki kod.
6. Merhaba gönder. Birkaç saniye sonra ekranın değiştiğini doğrula.
7. BOOT kısa: sonraki sayfa; uzun (3 saniye): bağlantı bilgileri. PWR yeniden atanmadı.

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
- En çok 6000 UTF-8 bayt; sözcük kaydırma, iki yazı boyutu, önceki/sonraki sayfa.
- ASCII font: Türkçe/Almanca harfler sadeleşir; diğer Unicode simgeler `?` olabilir.
- E-paper tam yenileme; değişiklikler en az 3 saniye aralıklı. Yenilemede kısa süreli
  siyah/beyaz geçiş normal. Yenileme sırasında HTTP isteği birkaç saniye bekleyebilir.
- Ekran BUSY sinyaline 10 saniye sınır; hata olursa ekran işlemleri durur, web hata gösterir.
- Pil yüzdesi/ölçümü, uyku, RTC, ses, kamera, Claude, OTA ve bulut takibi bu sürümde yok.
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
Metin testleri: Türkçe/Almanca dönüşümü, emoji, boş satırlar, uzun sözcük ve 6000 bayt.
Fiziksel ekran, Wi-Fi/AP, BOOT, Safari ve pil güç devresi henüz bu yazılımla denenmedi.
Başarılı derleme, donanım çalışmasının garantisi değildir.

Fabrika geri dönüşü: üretici reposundaki `03_Firmware/V2-FactoryProgram.bin` ve
üreticinin yükleme yöntemi. Sorunda önce log alın; rastgele farklı kart firmware'i yüklemeyin.
