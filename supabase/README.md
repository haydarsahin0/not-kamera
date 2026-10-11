# Canlı Not Kamera Supabase hizmeti

Proje: jckoovsocynnxbrsalld (Dijitalarsam), fonksiyon: not-kamera-api. Kod burada tutulur; oyun reposunun dağıtımına bağlı değildir. Yeni fonksiyon bağımsızdır ve ödeme kodunu kullanmaz.

Secret: NOT_KAMERA_OPENAI_API_KEY. Model yalnızca gpt-6.1-sol. Servis rolü değeri Edge Function ortamından alınır; istemciye verilmez. Kullanıcı erişim kodunun SHA-256 özeti, id=1 satırında not_kamera_access içinde bulunur. Gerçek erişim kodu bu repoda bulunmaz. Yeni bir projede, kodu güvenli ortamda üretip sadece özetini bu tabloya eklemek gerekir.

RLS açık ve anon/authenticated yetkileri kaldırılmış olduğundan policy bulunmaması kasıtlıdır: tablolara yalnızca service_role erişir. JWT gateway kapalıdır, fakat fonksiyon her API çağrısında ayrı bearer kodunu doğrular. SQL RPC'ler SECURITY INVOKER ve yalnızca service_role için EXECUTE yetkisine sahiptir.

Test: node --test supabase/tests/api.test.mjs

Kaynak index.ts tek dosyadır; JS uyumlu sözdizimi Node 24 testlerinde kullanılır. Supabase Edge Runtime gerçek dağıtımda derler. Gerçek model testi bir Makroökonomie görseliyle tamamlandı; test kaydı silindi.


0.4.0: not_kamera_device tablosu seçili job, teslimat UUID'si, son cihaz kontrolü ve ekran onayını tutar. RLS ve service_role yetkisi diğer çalışma tablolarıyla aynıdır. /api/device/poll düz metin ve SHA-256 döndürür; /api/device/ack yalnızca güncel teslimatı onaylar. /api/device/select önceki cevabı yeniden gönderir. Tüm uçlar aynı özel bearer doğrulamasını kullanır. Ekran onayı yalnızca cihaz firmware'inin sağlıklı ekran yenilemesinden sonra gönderilir; sunucu bu onayı donanımdan bağımsız olarak doğrulayamaz. Anahtar fiziksel cihaz NVS'sinde tutulur, derlenmiş firmware'e gömülmez.


## 0.8.0 grafik belgeleri

`index.ts`, `answer.ts`, `font-metrics.ts` birlikte deploy edilir. Üç dosya da sır içermeyen uygulama kaynaklarıdır; OpenAI anahtarı mevcut Supabase secret olarak kalır. Responses strict JSON Schema, grafik geometrisi/etiket sınırları, görev sırası ve 64 KiB belge sınırı doğrulanır. Yeni cihaz `format=not-ekran-answer-v1` ile çizim belgesi alır; eski cihaz/siteye düz metin korunur. Fotoğraf cache anahtarı yeni şema ve grafik yönergesini kapsar. Auth/RLS/veritabanı şeması değişmez. Model `gpt-6.1-sol` korunur.

## 0.10.0: koşullu sayfa bağlamı

`context.ts` de deploy edilir. Yeni `not_kamera_claim_frame` RPC, tek transaction/advisory lock ile işi ve orijinal görüntüyü kaydeder; önceki başarılı sayfaların değişmez sıralı anlık görüntüsünü modele verir. `X-Request-Id` aynı upload’ın tekrarını tek işte tutar; yanlış fotoğrafla aynı kimlik 409 alır. Eski firmware için yalnız son sayfa/profil/çalışma eşleşmesi cache sayılır; farklı bağlamdaki aynı görüntü global cache’den alınmaz. Profil değişimi, `X-Study-Reset: 1` veya 2 saatlik hareketsizlikten sonra kabul edilen yeni analiz bağlamı yeniler. Snapshot yalnız son 6 başarılı fotoğrafı içerir; tabloda en fazla 7 fotoğraf tutulur. Fotoğraflar ayrı özel Storage bucket yerine RLS açık, anon/authenticated erişimi kaldırılmış çalışma tablosunda Base64 tutulur. Hareketsizlik sınırı önceki görüntüleri bir sonraki kabul edilen istekte temizler; zamanlanmış silici yoktur. İşler 24 saat sonra sonraki erişimde temizlenir. `DELETE /api/jobs` fotoğraf bağlamını da siler. `preview=1` tek görüntüyle çalışır ve canlı bağlamı/cihaz seçimini değiştirmez.

Responses strict schema dışarıda `{context,answer}` kullanır; bağımlılık kararı ve gerçekten kullanılan önceki sayfa indeksleri doğrulanır. Cihaz ve eski istemci yalnız `answer` içindeki aynı `not-ekran-answer-v1` belgesini alır. Sorunun bağlantısını model değerlendirir; bu bir doğruluk garantisi değildir. Önceki çözümler yeniden girdi yapılmaz, orijinal veriler yeniden değerlendirilir. API istemciye önceki fotoğrafları geri vermez. Görselleri yeniden göndermek API maliyetini ve gecikmeyi artırır.

Canlı SQL transaction/rollback kontrolleri: orijinal fotoğraf sırası, UUID tekrarı, yanlış UUID kullanımı, yeni çalışma, profil ayrımı, preview izolasyonu, 6 önceki / 7 saklı sayfa sınırı ve 2 saatlik aradan sonra sıfırlama. RLS açık; servis dışında tablo ve RPC izinleri kapalı. Security advisor’ın politika yok INFO kaydı bu servis modelinde kasıtlıdır.
