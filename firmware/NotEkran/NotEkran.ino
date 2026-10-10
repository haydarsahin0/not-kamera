#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <Adafruit_GFX.h>
#include <esp_system.h>
#include "epaper_driver_bsp.h"
#include "text_layout.h"

// Waveshare ESP32-S3-ePaper-1.54 V2 only. GPIOs from vendor V2 examples.
constexpr int EPD_POWER=6, AUDIO_POWER=42, BATTERY_HOLD=17, BOOT_KEY=0;
WebServer server(80);
Preferences prefs;
epaper_driver_display *panel=nullptr;
class Canvas: public Adafruit_GFX {
 public: Canvas():Adafruit_GFX(200,200){}
 void drawPixel(int16_t x,int16_t y,uint16_t color) override {
   if(x>=0&&x<200&&y>=0&&y<200) panel->EPD_DrawColorPixel(x,y,color?0xff:0x00);
 }
} canvas;
String apName, devicePassword, csrf, savedSsid, savedPassword;
std::vector<std::string> lines;
size_t currentPage=0;
int fontSize=2;
bool helpVisible=true, dirty=true, connectPending=false;
uint32_t lastPaint=0, receivedAt=0, lastRetry=0;
int previousStatus=-1;

String randomCode(){char b[17];snprintf(b,sizeof(b),"%08lx%08lx",(unsigned long)esp_random(),(unsigned long)esp_random());return String(b);}
String htmlEscape(String s){s.replace("&","&amp;");s.replace("<","&lt;");s.replace(">","&gt;");s.replace("\"","&quot;");s.replace("'","&#39;");return s;}
size_t rowsPerPage(){return fontSize==2?9:18;}
size_t pageCount(){return max((size_t)1,(lines.size()+rowsPerPage()-1)/rowsPerPage());}
bool authorized(){
 if(server.authenticate("admin",devicePassword.c_str()))return true;
 server.requestAuthentication(BASIC_AUTH,"Not Ekran","Ekrandaki kodla giris yap.");return false;
}
bool mutationAllowed(){
 if(!authorized())return false;
 if(server.arg("csrf")!=csrf){server.send(403,"text/plain; charset=utf-8","Oturum yenilendi. Ana sayfayi tekrar ac.");return false;}
 return true;
}
void redirect(){server.sendHeader("Location","/");server.send(303,"text/plain","");}
String formStart(const char* action){return String("<form method='post' action='")+action+"'><input type='hidden' name='csrf' value='"+csrf+"'>";}
void root(){
 if(!authorized())return;
 String h=R"HTML(<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not Ekran</title><style>
 body{font:17px system-ui;background:#f0f4f8;color:#173044;max-width:620px;margin:auto;padding:22px}h1{margin-bottom:6px}section{background:white;border-radius:18px;padding:20px;margin:18px 0}label{display:block;margin:12px 0}input,textarea,select,button{font:inherit;box-sizing:border-box;width:100%;padding:12px;border:1px solid #b9cbd6;border-radius:9px}textarea{min-height:170px}button{background:#185ed2;color:white;border:0;margin:8px 0;cursor:pointer}small{display:block;line-height:1.5;color:#526b7c}.buttons{display:flex;gap:8px}.buttons form{flex:1}code{overflow-wrap:anywhere}a{color:#185ed2}</style><h1>Not Ekran</h1><small>V2 · İlk donanım denemesi · Yerel metin ekranı</small><section><strong>Bağlantı</strong><p>)HTML";
 h+=WiFi.status()==WL_CONNECTED?"Wi-Fi bağlı. Yerel adres: <code>http://"+WiFi.localIP().toString()+"</code>":"Wi-Fi bağlı değil. Cihazın kendi ağı üzerinden kullanabilirsin.";
 if(!panel->healthy)h+="<p><strong>Ekran yanıt vermedi. Kurulumu durdur; V2 kartı ve bağlantıyı kontrol et.</strong></p>";
 h+="</p><small>Kurulum ağı: "+htmlEscape(apName)+" · http://192.168.4.1<br>Sayfa "+String(currentPage+1)+" / "+String(pageCount());
 if(receivedAt)h+=" · Son metin "+String((millis()-receivedAt)/1000)+" saniye önce alındı";
 h+="</small></section><section><h2>Metin gönder</h2>"+formStart("/text");
 h+=R"HTML(<label>Metin<textarea name="text" maxlength="4000" required placeholder="Merhaba"></textarea></label><label>Yazı boyutu<select name="size"><option value="2">Büyük</option><option value="1">Küçük</option></select></label><button>Metni ekrana gönder</button><small>En fazla 6000 UTF-8 bayt. Uzun metin sayfalara ayrılır. İlk sürümde Türkçe harfler sadeleştirilir: ş → s, ı → i. Metin yeniden başlatılınca silinir.</small></form><div class="buttons">)HTML";
 h+=formStart("/previous")+"<button>Önceki</button></form>"+formStart("/next")+"<button>Sonraki</button></form></div>";
 h+=formStart("/help")+"<button>Bağlantı bilgilerini göster</button></form>"+formStart("/read")+"<button>Metne dön</button></form>"+formStart("/clear")+"<button>Ekrandaki metni sil</button></form></section>";
 h+="<section><h2>Wi-Fi ayarı</h2>"+formStart("/wifi");
 h+="<label>Ağ adı<input name='ssid' maxlength='32' required value='"+htmlEscape(savedSsid)+"' autocomplete='off'></label>";
 h+=R"HTML(<label>Ağ şifresi<input name="password" type="password" minlength="8" maxlength="63" required autocomplete="new-password"></label><button>Kaydet ve bağlan</button><small>2,4 GHz, kişisel şifreli ağ kullan. iPhone erişim noktasında gerekirse “Uyumluluğu En Üst Düzeye Çıkar” seçeneğini aç. eduroam ve giriş sayfalı ağlar bu sürümde desteklenmez. Şifre yanlışsa cihazın kendi ağı açık kalır. Bağlanmayı denedikten sonra bu sayfayı yenile.</small></form></section><small>BOOT: kısa basış sonraki sayfa; 3 saniye basılı tut: bağlantı bilgileri. USB'yi takarken BOOT'a basılı tutma; bu yükleme moduna geçirir. Yalnızca güvendiğin yerel ağda kullan; bu HTTP arayüzünü internete açma.</small></html>)HTML";
 server.sendHeader("Cache-Control","no-store");server.sendHeader("X-Frame-Options","DENY");
 server.send(200,"text/html; charset=utf-8",h);
}
void paint(){
 panel->EPD_Clear();canvas.setTextColor(0);canvas.setTextWrap(false);canvas.setTextSize(1);canvas.setCursor(4,3);
 if(helpVisible){
  canvas.println("NOT EKRAN / V2");canvas.setCursor(4,23);canvas.println("Wi-Fi agi:");canvas.setCursor(4,35);canvas.println(apName);
  canvas.setCursor(4,55);canvas.println("Ag sifresi / giris kodu:");canvas.setCursor(4,67);canvas.println(devicePassword);
  canvas.setCursor(4,87);canvas.println("Kullanici: admin");canvas.setCursor(4,105);canvas.println("http://192.168.4.1");
  canvas.setCursor(4,125);canvas.println(WiFi.status()==WL_CONNECTED?"Diger agda adres:":"Diger ag: bagli degil");
  canvas.setCursor(4,137);if(WiFi.status()==WL_CONNECTED)canvas.println(WiFi.localIP().toString());
  canvas.setCursor(4,160);canvas.println("iPad: agi sec, Safari ac");canvas.setCursor(4,178);canvas.println("BOOT: metne don");
 } else {
  canvas.print("NOT ");canvas.print(currentPage+1);canvas.print("/");canvas.print(pageCount());canvas.print("  ");canvas.print(WiFi.status()==WL_CONNECTED?"WiFi":"Yerel AP");
  canvas.drawFastHLine(4,15,192,0);canvas.setTextSize(fontSize);
  size_t start=currentPage*rowsPerPage();
  for(size_t n=0;n<rowsPerPage()&&start+n<lines.size();++n){canvas.setCursor(4,21+n*8*fontSize);canvas.print(lines[start+n].c_str());}
  canvas.setTextSize(1);canvas.setCursor(4,188);canvas.print("BOOT: sonraki / uzun: bilgi");
 }
 if(panel->healthy){panel->EPD_Init();if(panel->healthy)panel->EPD_Display();}
 dirty=false;lastPaint=millis();
}
void setup(){
 pinMode(BATTERY_HOLD,OUTPUT);digitalWrite(BATTERY_HOLD,HIGH);
 pinMode(AUDIO_POWER,OUTPUT);digitalWrite(AUDIO_POWER,HIGH);
 pinMode(EPD_POWER,OUTPUT);digitalWrite(EPD_POWER,LOW);
 pinMode(BOOT_KEY,INPUT_PULLUP);Serial.begin(115200);
 delay(100);
 custom_lcd_spi_t pins={11,10,9,8,13,12,SPI2_HOST,5000};
 panel=new epaper_driver_display(200,200,pins);
 prefs.begin("not-ekran",false);
 devicePassword=prefs.getString("code","");if(devicePassword.length()!=16){devicePassword=randomCode();prefs.putString("code",devicePassword);}
 csrf=randomCode();savedSsid=prefs.getString("ssid","");savedPassword=prefs.getString("wifi-pass","");
 uint64_t mac=ESP.getEfuseMac();char suffix[5];snprintf(suffix,sizeof(suffix),"%04X",(unsigned)(mac&0xffff));apName="NotEkran-"+String(suffix);
 WiFi.mode(WIFI_AP_STA);WiFi.setAutoReconnect(true);WiFi.softAP(apName.c_str(),devicePassword.c_str());
 if(savedSsid.length())WiFi.begin(savedSsid.c_str(),savedPassword.c_str());
 server.on("/",HTTP_GET,root);
 server.on("/text",HTTP_POST,[]{
  if(!mutationAllowed())return;
  String t=server.arg("text"), size=server.arg("size");
  if(t.length()==0||t.length()>6000||(size!="1"&&size!="2")){server.send(400,"text/plain; charset=utf-8","Metin bos veya cok uzun; boyutu kontrol et.");return;}
  fontSize=size.toInt();lines=wrapText(normalizeText(std::string(t.c_str())),fontSize==2?16:32);
  currentPage=0;helpVisible=false;dirty=true;receivedAt=millis();redirect();
 });
 server.on("/wifi",HTTP_POST,[]{
  if(!mutationAllowed())return;String s=server.arg("ssid"),p=server.arg("password");
  if(s.length()==0||s.length()>32||p.length()<8||p.length()>63){server.send(400,"text/plain","Ag adi veya sifre uzunlugu gecersiz.");return;}
  savedSsid=s;savedPassword=p;prefs.putString("ssid",s);prefs.putString("wifi-pass",p);connectPending=true;redirect();
 });
 server.on("/next",HTTP_POST,[]{if(!mutationAllowed())return;currentPage=(currentPage+1)%pageCount();helpVisible=false;dirty=true;redirect();});
 server.on("/previous",HTTP_POST,[]{if(!mutationAllowed())return;currentPage=(currentPage+pageCount()-1)%pageCount();helpVisible=false;dirty=true;redirect();});
 server.on("/help",HTTP_POST,[]{if(!mutationAllowed())return;helpVisible=true;dirty=true;redirect();});
 server.on("/read",HTTP_POST,[]{if(!mutationAllowed())return;helpVisible=false;dirty=true;redirect();});
 server.on("/clear",HTTP_POST,[]{if(!mutationAllowed())return;lines.clear();currentPage=0;receivedAt=0;helpVisible=false;dirty=true;redirect();});
 server.onNotFound([]{server.send(404,"text/plain","Not found");});
 server.begin();paint();
}
void loop(){
 server.handleClient();
 if(connectPending){connectPending=false;WiFi.disconnect(false,false);WiFi.begin(savedSsid.c_str(),savedPassword.c_str());lastRetry=millis();}
 int status=WiFi.status();if(status!=previousStatus){previousStatus=status;if(helpVisible)dirty=true;}
 if(savedSsid.length()&&status!=WL_CONNECTED&&millis()-lastRetry>30000){WiFi.reconnect();lastRetry=millis();}
 static bool wasDown=false,longDone=false;static uint32_t pressedAt=0;
 bool down=digitalRead(BOOT_KEY)==LOW;
 if(down&&!wasDown){pressedAt=millis();longDone=false;}
 if(down&&!longDone&&millis()-pressedAt>=3000){helpVisible=true;dirty=true;longDone=true;}
 if(!down&&wasDown&&!longDone&&millis()-pressedAt>=40){if(helpVisible)helpVisible=false;else currentPage=(currentPage+1)%pageCount();dirty=true;}
 wasDown=down;
 if(dirty&&millis()-lastPaint>=3000)paint();
 delay(2);
}
