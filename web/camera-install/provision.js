// Credentials go only over the chosen USB port: no fetch/localStorage/URL use.
const el=id=>document.getElementById(id);
let port=null,reader=null,writer=null,waiting=null,verified=false,connected=false,received=0,noise='';
// Only Espressif USB JTAG/serial (camera firmware) or Seeed TinyUSB ports; hides Bluetooth/other COM ports.
const FILTERS=[{usbVendorId:0x303a},{usbVendorId:0x2886}];
const NO_REPLY='Kamera seçildi ama hiç veri gelmedi. Kamera yazılımı çalışmıyor olabilir (yükleme modunda kalmış olabilir). Kablo takılıyken BOOT’a basmadan RESET’e bir kez kısa bas, 5 saniye bekle ve tekrar “USB’den kamerayı bul” düğmesine bas.';
const NO_JSON='Kameradan veri geliyor ama NotCamera cevabı okunamadı. Yükleyicinin seri konsolunu ve başka sekmeleri kapat, RESET’e bir kez kısa bas, 5 saniye bekle ve tekrar dene.';
const limit=(promise,ms)=>Promise.race([promise,new Promise(r=>setTimeout(r,ms))]),wait=ms=>new Promise(r=>setTimeout(r,ms));
// Non-reply text (boot/crash log) is shown so the user can report it; the camera network code is masked.
function noReply(){if(!received)return NO_REPLY;const log=noise.replace(/"code":"[^"]*"?/g,'"code":"…"').slice(-600);
 const why=/waiting for download|DOWNLOAD\(/.test(log)?'Kamera yükleme modunda kalmış; kamera yazılımı çalışmıyor. Kabloyu çıkar, BOOT’a dokunmadan yeniden tak, 5 saniye bekle ve tekrar dene.':/Guru Meditation|Backtrace|abort\(\)|panic|Brownout|brownout/.test(log)?'Kamera yazılımı açılırken çöküp yeniden başlıyor. Aşağıdaki kaydı paylaş.':NO_JSON;
 return why+(log.trim()?'\n\nKameradan gelen son veri:\n'+log:'');}
function message(text){el('usbState').textContent=text;}
function accept(line){let data;try{data=JSON.parse(line);}catch{if(line)noise=(noise+line+'\n').slice(-2000);return;}
 if(waiting&&waiting.match(data)){const w=waiting;waiting=null;clearTimeout(w.timer);w.resolve(data);}}
async function readLoop(){let buffer='';const decoder=new TextDecoder();try{while(connected){const {value,done}=await reader.read();if(done)break;received+=value.length;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){accept(buffer.slice(0,end).trim());buffer=buffer.slice(end+1);}if(buffer.length>10000){noise=(noise+buffer.slice(-500)+'\n').slice(-2000);buffer='';}}}catch{}
 const lost=connected;connected=false;verified=false;el('save').disabled=true;if(waiting){waiting.reject(Error(lost?'USB bağlantısı kapandı. Kamera yeniden başlamış veya kablo gevşemiş olabilir. Birkaç saniye bekleyip tekrar dene; sürekli kopuyorsa kablo/güç sorununu kontrol et.':'USB bağlantısı kapandı.'));clearTimeout(waiting.timer);waiting=null;}}
// The camera's USB receive queue holds only 256 bytes: long settings (token, rules) are sent in paced 64-byte packets.
async function send(bytes){for(let i=0;i<bytes.length;i+=64){await writer.write(bytes.slice(i,i+64));if(i+64<bytes.length)await wait(20);}}
async function command(payload,match,timeout){if(waiting)throw Error('Önceki USB işlemini bekle.');return new Promise((resolve,reject)=>{waiting={resolve,reject,match,timer:setTimeout(()=>{waiting=null;reject(Error(noReply()));},timeout||10000)};send(new TextEncoder().encode(JSON.stringify(payload)+'\n')).catch(e=>{if(waiting){clearTimeout(waiting.timer);waiting=null;reject(Error('USB yazma işlemi başarısız.'));}});});}
// A port that never accepts data must not leave the button disabled forever: every step is time-limited.
async function close(){connected=false;if(waiting){waiting.reject(Error('Bağlantı yenilendi.'));clearTimeout(waiting.timer);waiting=null;}try{if(reader){await limit(reader.cancel(),1000);reader.releaseLock();}}catch{}try{if(writer){if(writer.abort)await limit(writer.abort().catch(()=>{}),1000);writer.releaseLock();}}catch{}try{if(port)await limit(port.close(),2000);}catch{}reader=writer=port=null;verified=false;el('save').disabled=true;}
function openError(e){const text=String(e&&e.message||'');
 if(e&&e.name==='NotFoundError')return 'Kamera seçilmedi. Listede “USB JTAG/serial debug unit” görünmüyorsa: veri aktarabilen başka bir USB-C kablo ve başka bir USB portu dene, kamerayı çıkarıp yeniden tak. Hâlâ yoksa BOOT’u basılı tutup RESET’e kısa bas, BOOT’u bırak ve 1. adımdan yazılımı yeniden yükle.';
 if(e&&(e.name==='InvalidStateError'||e.name==='NetworkError')||/open/i.test(text))return 'Kamera bağlantı noktası başka bir pencere tarafından kullanılıyor. Yükleyici penceresini (Logs/Console) ve Arduino seri monitörünü kapat, bu sayfanın başka sekmelerini kapat. Sonra kabloyu çıkarıp yeniden tak, sayfayı yenile ve tekrar dene.';
 return text||'USB bağlantısı açılamadı.';}
// wifi_reason is ESP-IDF wifi_err_reason_t from the last station disconnect.
function wifiText(s){const r=Number(s.wifi_reason)||0;if(!s.ssid)return 'hotspot adı kaydedilmedi';
 if([201,210,211,212].includes(r))return '“'+s.ssid+'” bulunamadı. iPhone’da Kişisel Erişim Noktası ekranını açık tut ve “Uyumluluğu En Üst Düzeye Çıkar”ı aç. Ad tam aynı olmalı (aşağıdaki listeden seç).';
 if([2,15,202,204].includes(r))return 'hotspot şifresi yanlış görünüyor. Şifreyi yeniden yazıp kaydet.';
 return r?'bağlanamadı (kod '+r+'); hotspotu açık tut, kamera tekrar deniyor':'bağlanıyor…';}
let seen=[];const plain=t=>String(t).replace(/[’‘`´]/g,"'").trim();
// Apostrophe style differs between keyboards and iPhone names: use the camera's exact spelling when it sees the network.
function exactSsid(name){return seen.find(n=>n===name)||seen.find(n=>plain(n)===plain(name))||name.trim();}
async function scan(){try{const r=await command({cmd:'scan'},j=>Array.isArray(j.networks),15000);seen=r.networks.map(n=>n.ssid);
 const list=el('ssidList');if(list&&document.createElement)list.replaceChildren(...seen.map(n=>{const o=document.createElement('option');o.value=n;return o;}));
 if(el('ssid').value)el('ssid').value=exactSsid(el('ssid').value);return seen;}catch{return null;}}
function show(s){verified=s.device==='NotCamera'&&s.version==='0.1.3';el('save').disabled=!verified||s.busy;
 if(!verified){message(s.device==='NotCamera'?'Kamerada eski NotCamera '+s.version+' var. Ayar gönderilmedi. Önce 1. adımdan 0.1.3 yazılımını yükle.':'Seçilen cihaz NotCamera 0.1.3 değil. Ayar gönderilmedi. Kamera kartını ve yüklemeyi kontrol et.');return;}
 for(const key of ['ssid','course','rules','interval'])if(s[key]!==undefined)el(key).value=s[key];// The user wants unattended capture: once the single-frame test passed, offer it pre-ticked.
 el('automatic').checked=!!s.automatic||!!s.camera_ready;
 message('NotCamera '+s.version+'\n'+s.detail+'\nKamera testi: '+(s.camera_ready?'başarılı':(s.camera_error||'henüz yapılmadı'))+'\nSensör: '+(s.sensor_active?'çekim yapıyor':'beklemede')+'\nWi-Fi: '+(s.wifi?'bağlı':wifiText(s))+(s.ip?'\nHotspot adresi: http://'+s.ip:'')+'\nKamera ağı: '+s.ap+'\nKamera ağ şifresi: '+s.code+'\nGönderilen: '+s.sent+' · Ekranda gösterilen: '+s.rendered);
}
el('usbConnect').onclick=async()=>{el('usbConnect').disabled=true;try{if(!navigator.serial)throw Error('USB kurulumu için Windows Chrome/Edge kullan.');
 if(!connected){await close();received=0;noise='';try{port=await navigator.serial.requestPort({filters:FILTERS});await port.open({baudRate:115200});}catch(e){port=null;throw Error(openError(e));}message('Kamera bağlantı noktası açıldı; cevap bekleniyor…');if(port.setSignals)await port.setSignals({dataTerminalReady:true,requestToSend:false});reader=port.readable.getReader();writer=port.writable.getWriter();connected=true;readLoop();await new Promise(r=>setTimeout(r,600));}
 const status=ms=>command({cmd:'status'},j=>j.device!==undefined||j.version!==undefined,ms);let s;
 try{s=await status(4000);}catch(e){if(!connected||!port.setSignals)throw e;
  // Same USB JTAG/serial reset esptool uses after flashing (DTR low, RTS pulse): boots the camera program, not download mode.
  message('Kamera cevap vermedi; USB üzerinden yeniden başlatılıyor. Yaklaşık 10 saniye bekle…');received=0;noise='';
  await port.setSignals({dataTerminalReady:false,requestToSend:true});await wait(200);await port.setSignals({dataTerminalReady:false,requestToSend:false});await wait(6000);
  if(!connected)throw Error('Kamera yeniden başlatıldı. Şimdi “USB’den kamerayı bul” düğmesine tekrar bas ve listeden kamerayı yeniden seç.');
  for(let attempt=0;;++attempt){try{s=await status(5000);break;}catch(e2){if(attempt===1||!connected)throw e2;message('Kameranın başlaması bekleniyor; bağlantı tekrar kontrol ediliyor…');}}}
 show(s);
 if(verified&&!s.wifi){const names=await scan();if(names)message(el('usbState').textContent+'\n\nKameranın gördüğü ağlar: '+(names.length?names.join(' · '):'hiç ağ yok (hotspot kapalı veya yalnızca 5 GHz)'));}
 }catch(e){message(e.message||'USB bağlantısı açılamadı.');await close();}finally{el('usbConnect').disabled=false;}};
el('setup').addEventListener('submit',async event=>{event.preventDefault();if(!verified||!connected){message('Önce USB’den kamerayı bul.');return;}el('save').disabled=true;
 el('ssid').value=exactSsid(el('ssid').value);
 const data={cmd:'configure',automatic:el('automatic').checked,interval:Number(el('interval').value),edge_min:2,duplicate_max:8};for(const k of ['ssid','password','token','course','rules'])data[k]=el(k).value;
 try{const r=await command(data,j=>typeof j.ok==='boolean');if(!r.ok)throw Error(r.detail||'Ayarlar kaydedilemedi.');el('password').value=el('token').value='';message('Ayarlar kameraya kaydedildi. Kamera yeniden başlayacak. Hotspotu ve NotEkran’ı açık tut. Durumu yeniden okumak için USB’den kamerayı bul düğmesine bas.');verified=false;}
 catch(e){message(e.message);el('save').disabled=!verified;}
});

el('testCamera').onclick=async()=>{if(!verified||!connected){message('Önce USB’den kamerayı bul.');return;}try{const r=await command({cmd:'test_camera'},j=>typeof j.ok==='boolean');if(!r.ok)throw Error(r.detail);message('Tek kare testi istendi. Birkaç saniye sonra USB’den kamerayı bul ile sonucu oku. Isınma devam ediyorsa gücü çıkar.');}catch(e){message(e.message);}};
