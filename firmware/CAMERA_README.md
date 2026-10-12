## 0.2.0 — shoot from NotEkran's PWR key

- NotEkran 0.10.3: holding PWR for 1.2 s broadcasts a UDP request (port 47123) on the shared hotspot with a hash of the shared app access code. The camera takes three full-size frames, uploads the sharpest at once and acknowledges to NotEkran (port 47124); the answer reaches NotEkran through the cloud as before. NotEkran says when the camera is not reached.
- A new shot (page, BOOT key or NotEkran) replaces a photo still waiting for upload, its answer or NotEkran's display; 0.1.9 silently ignored the press while such a photo was pending, so “Fotoğraf çekiliyor…” never finished. The setup page now shows the camera's state while it waits.

## 0.1.9 — manual shoot / send

- Without automatic capture, the photo rules no longer decide: the first press (setup page “Fotoğraf çek” or the board's BOOT key) takes three full-size frames and holds the sharpest; the page shows it. The second press (“Bu fotoğrafı gönder” or BOOT) uploads it; the answer goes to NotEkran as before. The orange user LED is on while a photo is held and blinks while it is being answered.
- Automatic capture stays available as an option and is no longer pre-ticked.

## 0.1.8 — full-resolution live view

- Live view defaults to the sensor's full size (OV3660 2048×1536, quality 8), like the photos; the setup page offers balanced 1024×768 and fast 640×480. A size change reopens the sensor. Frames the page already has are never resent, and the USB TX buffer is 16 KB, so large frames arrive as fast as USB allows.

## 0.1.7 — highest photo quality, less heat

- Photos: the sensor's largest JPEG size is detected once (OV2640 1600×1200, OV3660 2048×1536, OV5640 2592×1944) at JPEG quality 8 (was 10), up to 3 MB (server limit 4 MB). Each capture still takes three frames and sends the best one; white balance/AEC/gain/lens correction on, one more warm-up frame.
- Heat (board hot within 1–2 minutes): the camera's own access point now runs only before a hotspot is configured (an AP keeps the radio awake); station mode uses modem sleep and 13 dBm TX power; CPU runs at 80 MHz (160 MHz only during live view).
- Overheat guard: chip temperature is read every 5 s; at ≥72 °C the camera, capture and live view stop and TX power drops until it cools to 60 °C. Temperature is shown on the USB page.

## 0.1.6 — smooth live view

- Images were mirrored (text read backwards). Horizontal mirror is now on by default; USB `orient` (setup page buttons) toggles mirror/flip, saved in NVS and applied to live view and photos.
- 0.1.5's live view re-sent the last 1600×1200 check frame every few seconds. Now USB `live` requests make the camera stream 640×480 JPEG frames (two buffers, latest frame) and re-check the photo rules on every third frame at 1/4 scale (close to the 1/8 scale of real photos). Each request keeps live view on for 5 s; `live_stop` or a closed page ends it and normal capture resumes.

## 0.1.5 — live view on the setup page

- New USB `preview` command streams the latest checked JPEG; status adds `frame` and `spread`. The setup page's “Canlı görüntü” shows the frame and which photo rule (brightness, lit area, ink, sharpness, contrast) passed or failed, with a hint.
- Automatic capture is no longer switched off by every firmware update; only a device that never ran 0.1.1+ starts with it off.

## 0.1.4 — find the hotspot by what is on air

- 0.1.3 still reported “not found” for a typed `Haydar iPhone'u`. While offline the camera now scans every 20 s and joins the visible network whose name matches the saved one exactly, or else the only one equal ignoring quotes, spaces, punctuation and case; that broadcast spelling is then saved.
- USB status carries the last scan (up to 15 names with signal) and how many networks were seen; zero networks points to the antenna connector.

## 0.1.3 — hotspot connection help

- iPhone hotspot names use a typographic apostrophe (“Haydar iPhone’u”) while keyboards type `'`. When the saved name is not found, the camera alternately tries the other apostrophe and keeps the spelling that connects.
- USB status reports the last Wi-Fi disconnect reason; the setup page explains “not found” and “wrong password”, scans for the networks the camera can see and offers them as exact names.
- Automatic capture is pre-ticked on the setup page once the single-frame test has passed.

## 0.1.2 — USB setup reaches the camera

- Fix: 0.1.1 was built with `CDCOnBoot=cdc`, which on the XIAO_ESP32S3 board menu means **Disabled**. `Serial` went to the UART pins, so the USB setup page saw only the ROM boot text and never a reply. Now built with `CDCOnBoot=default` (Enabled, Hardware CDC); the install test rejects the wrong option.
- USB receive queue enlarged to 2048 bytes so a long access code or rules line is not cut off.
- No other behaviour change. Still not tested on real hardware.

## 0.1.1 — USB diagnosis and reduced capture duty

- First boot after upgrade switches automatic capture off, including previously configured devices. Wi-Fi configuration stays saved.
- Camera initialization is deferred until a local USB single-frame test or enabled/configured/online automatic capture. Setup, offline, paused, and cloud-wait states do not keep a capture window open.
- Each capture window stops camera DMA/clock with `esp_camera_deinit()` on exit. The board has no controllable camera PWDN pin: this is not complete electrical isolation and is not an overtemperature shutdown.
- Background observations are eight seconds apart; CPU runs at 160 MHz. Automatic capture is opt-in after checking hardware and a single frame. Initialization failures latch instead of retrying forever.
- USB opens with DTR asserted/RTS released and retries one timed-out status query. Test button requests one local frame, without uploading it.
- Real board temperature, USB recovery, sensor restart/image quality still require physical tests. If the device overheats while capture is paused, disconnect it and check hardware; software cannot certify it safe.

# NotCamera 0.2.0 — ilk deneme sürümü

Seeed Studio XIAO ESP32-S3 **Sense**, 8 MB Flash ve 8 MB PSRAM için hazırlanmıştır. Sensörün en büyük JPEG boyutunu kullanır: OV2640 1600×1200, OV3660 2048×1536, OV5640 2592×1944. Düz XIAO, ESP32-C3 ve Waveshare NotEkran için değildir. Kamera modülü ve üreticinin Wi-Fi anteni takılı olmalıdır.

## Yükleme

Windows Chrome/Edge'de `https://haydarsahin0.github.io/not-kamera/camera-install/?v=0.2.0` adresini aç. Kamera kartını veri aktarabilen USB-C kabloyla bağla. İlk bölümde kamera yazılımını yükle. NotEkran'a bu dosyayı yükleme.

Yükleyicinin seri konsolunu kapat. Gerekirse kameranın RESET tuşuna bir kez bas. İkinci bölümde USB bağlantısını seçip kamera bilgilerini oku. Hotspot adını/şifresini ve NotEkran'da zaten kullandığın **uygulama erişim kodunu** bir kez kaydet. OpenAI API anahtarını buraya girme. Kurulum bilgileri herkese açık siteye veya GitHub'a gönderilmez; tarayıcıdan USB üzerinden kameraya yazılır.

Kamera yeniden başladıktan sonra aynı bilgileri her açılışta kullanır. iPhone'un kişisel erişim noktası açık olmalıdır; gerekirse Uyumluluğu En Üst Düzeye Çıkar seçeneğini aç. NotEkran da internete bağlı ve aynı uygulama erişim koduyla eşleştirilmiş olmalıdır.

## Kullanım

Bu güncellemenin ilk açılışında otomatik çekim kapalıdır. Tek kare testi ve ısınma kontrolü sonrasında ayarlardan açılabilir. Açıldıktan sonra güç verildiğinde kayıtlı ayarla devam eder. İlk fotoğraf uygun yeni görüntü oluşunca alınır. Sonraki çekimler arasında varsayılan olarak en az 15 saniye vardır; her 15 saniyede koşulsuz fotoğraf göndermez. Karanlık, boş veya ayrıntısı yetersiz görüntüde bekler. Yaklaşık sekiz saniyelik aralıklarla görüntü kontrolünden sonra üç kare içinden daha uygun olanını seçer. Gönderilen fotoğrafın cevabı NotEkran tarafından gösterilene kadar yeni fotoğraf göndermez. Ekran pil görünümündeyse cevap için okuma ekranını açmak gerekebilir.

Hotspot kaydedildikten sonra kameranın kendi ağı ısınmayı azaltmak için kapanır; aşağıdaki NotCamera ağı yalnızca ilk kurulumda açıktır. Sonrasında kamera sayfası USB bölümünde görünen hotspot adresinden açılır.

USB bölümünde görünen NotCamera ağı ve koduyla telefondan `http://192.168.4.1` açılabilir. Kullanıcı adı `admin`, parola kameranın kendi kodudur. Bu kamera sayfasıdır; NotEkran'ın ağı farklıdır. İki cihazın kendi ağı da aynı yerel adresi kullanır: hangi Wi-Fi ağına bağlandıysan o cihaz açılır. Hotspot üzerinden aynı sayfa USB bölümünde gösterilen kamera IP adresinden açılabilir; iPhone hotspot erişimi ayrıca denenmelidir.

Bu sayfadan son görüntüyü, bağlantı durumunu, ders profilini ve deneme eşiklerini kontrol edebilirsin. Günlük kullanımda sayfayı açman veya tuşa basman gerekmez.

## Sınırlar ve test

Gerçek kamera henüz elde olmadığı için bu sürüm **donanımda test edilmedi**. Derleme ve yazılımsal testler donanım testinin yerine geçmez. Önce çalışma kâğıtlarıyla farklı ışık, mesafe ve el hareketlerinde dene. Netlik/benzerlik kontrolleri yaklaşık hesaplamalardır; kumaşı belge sanabilir, aynı sayfayı yeni sanabilir veya küçük bir alt soru farkını atlayabilir. Sayfa numarası okumaz ve metnin okunabilirliğini garanti etmez. Yapay zeka cevabının doğruluğu da ayrıca kontrol edilmelidir.

Son 8 teslim edilmiş görüntünün karşılaştırma kaydı yeniden başlatmada korunur. Büyük açı değişikliklerini kusursuz eşleştirmez. Bağlantı tekrarında aynı fotoğraf ve istek kimliği kullanılır. Gönderilmekte olan fotoğraf RAM'dedir: gücü kesersen yarım işlem ve fotoğraf kaldığı yerden devam etmeyebilir. Bekleme sırasında derin uyku kullanılmaz. Pil süresi gerçek kullanımda ölçülmelidir.

NotEkran yazılımı ve mevcut sunucu bu sürümde değiştirilmez. Sunucu ders/soru bağlamını mevcut çalışma içinde değerlendirmeye devam eder. Yeni ders/çalışma başlatırken mevcut uygulamadan bağlamı sıfırla; yalnızca kamera görüntü kayıtlarını temizlemek sunucu bağlamını sıfırlamaz.

## Kaynaktan derleme

Arduino ESP32 çekirdeği 3.3.0 gerekir. `python firmware/tools/build_camera.py` ayrı kamera dosyalarını oluşturur. `firmware/tests/test_capture.cpp` görüntü seçimi/bekleme/tekrar davranışlarını bilgisayarda sınar. PSRAM ve kamera modülü eksikse yazılım otomatik gönderime başlamaz.
