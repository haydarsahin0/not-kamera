# Canlı Not Kamera Supabase hizmeti

Proje: jckoovsocynnxbrsalld (Dijitalarsam), fonksiyon: not-kamera-api. Kod burada tutulur; oyun reposunun dağıtımına bağlı değildir. Yeni fonksiyon bağımsızdır ve ödeme kodunu kullanmaz.

Secret: NOT_KAMERA_OPENAI_API_KEY. Model yalnızca gpt-6.1-sol. Servis rolü değeri Edge Function ortamından alınır; istemciye verilmez. Kullanıcı erişim kodunun SHA-256 özeti, id=1 satırında not_kamera_access içinde bulunur. Gerçek erişim kodu bu repoda bulunmaz. Yeni bir projede, kodu güvenli ortamda üretip sadece özetini bu tabloya eklemek gerekir.

RLS açık ve anon/authenticated yetkileri kaldırılmış olduğundan policy bulunmaması kasıtlıdır: tablolara yalnızca service_role erişir. JWT gateway kapalıdır, fakat fonksiyon her API çağrısında ayrı bearer kodunu doğrular. SQL RPC'ler SECURITY INVOKER ve yalnızca service_role için EXECUTE yetkisine sahiptir.

Test: node --test supabase/tests/api.test.mjs

Kaynak index.ts tek dosyadır; JS uyumlu sözdizimi Node 24 testlerinde kullanılır. Supabase Edge Runtime gerçek dağıtımda derler. Gerçek model testi bir Makroökonomie görseliyle tamamlandı; test kaydı silindi.
