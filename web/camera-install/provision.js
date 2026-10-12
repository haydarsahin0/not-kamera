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
async function readLoop(){let buffer='';const decoder=new TextDecoder();try{while(connected){const {value,done}=await reader.read();if(done)break;received+=value.length;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){accept(buffer.slice(0,end).trim());buffer=buffer.slice(end+1);}if(buffer.length>4000000){noise=(noise+buffer.slice(-500)+'\n').slice(-2000);buffer='';}}}catch{}
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
 if(s.networks_seen===0)return 'kamera hiçbir Wi-Fi ağı görmüyor. Wi-Fi anteni yerine oturmamış olabilir: anten kablosunun küçük yuvarlak ucunu kartın üstündeki yuvaya “klik” diye bastır.';
 if([201,210,211,212].includes(r))return '“'+s.ssid+'” bulunamadı. iPhone’da Kişisel Erişim Noktası ekranını açık tut ve “Uyumluluğu En Üst Düzeye Çıkar”ı aç. Ad tam aynı olmalı (aşağıdaki listeden seç).';
 if([2,15,202,204].includes(r))return 'hotspot şifresi yanlış görünüyor. Şifreyi yeniden yazıp kaydet.';
 return r?'bağlanamadı (kod '+r+'); hotspotu açık tut, kamera tekrar deniyor':'bağlanıyor…';}
let seen=[];const plain=t=>String(t).replace(/[’‘`´]/g,"'").trim();
// Apostrophe style differs between keyboards and iPhone names: use the camera's exact spelling when it sees the network.
function exactSsid(name){return seen.find(n=>n===name)||seen.find(n=>plain(n)===plain(name))||name.trim();}
async function scan(){try{const r=await command({cmd:'scan'},j=>Array.isArray(j.networks),15000);seen=r.networks.map(n=>n.ssid);
 const list=el('ssidList');if(list&&document.createElement)list.replaceChildren(...seen.map(n=>{const o=document.createElement('option');o.value=n;return o;}));
 if(el('ssid').value)el('ssid').value=exactSsid(el('ssid').value);return seen;}catch{return null;}}
let orient={hmirror:true,vflip:false};
function show(s){if(typeof s.hmirror==='boolean')orient={hmirror:s.hmirror,vflip:!!s.vflip};verified=s.device==='NotCamera'&&s.version==='0.2.0';el('save').disabled=!verified||s.busy;
 if(!verified){message(s.device==='NotCamera'?'Kamerada eski NotCamera '+s.version+' var. Ayar gönderilmedi. Önce 1. adımdan 0.2.0 yazılımını yükle.':'Seçilen cihaz NotCamera 0.2.0 değil. Ayar gönderilmedi. Kamera kartını ve yüklemeyi kontrol et.');return;}
 for(const key of ['ssid','course','rules','interval'])if(s[key]!==undefined)el(key).value=s[key];el('automatic').checked=!!s.automatic;if(el('sendPhoto'))el('sendPhoto').disabled=!s.held;
 message('NotCamera '+s.version+'\n'+s.detail+'\nKamera testi: '+(s.camera_ready?'başarılı':(s.camera_error||'henüz yapılmadı'))+'\nSensör: '+(s.sensor_active?'çekim yapıyor':'beklemede')+(s.temp?'\nKart sıcaklığı: '+Math.round(s.temp)+' °C'+(s.hot?' · ÇOK SICAK, kamera durduruldu':''):'')+'\nWi-Fi: '+(s.wifi?'bağlı':wifiText(s))+(s.ip?'\nHotspot adresi: http://'+s.ip:'')+(s.ap_active===false?'\nKamera ağı: kapalı (ısınmayı azaltmak için; hotspot adresinden açılır)\nKamera sayfası şifresi: '+s.code:'\nKamera ağı: '+s.ap+'\nKamera ağ şifresi: '+s.code)+'\nGönderilen: '+s.sent+' · Ekranda gösterilen: '+s.rendered);
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
 if(verified&&!s.wifi){const names=await scan()||(Array.isArray(s.networks)?(seen=s.networks.map(n=>n.ssid)):null);if(names)message(el('usbState').textContent+'\n\nKameranın gördüğü ağlar: '+(names.length?names.join(' · '):'hiç ağ yok (hotspot kapalı, anten takılı değil veya yalnızca 5 GHz)'));}
 }catch(e){message(e.message||'USB bağlantısı açılamadı.');await close();}finally{el('usbConnect').disabled=false;}};
el('setup').addEventListener('submit',async event=>{event.preventDefault();if(!verified||!connected){message('Önce USB’den kamerayı bul.');return;}el('save').disabled=true;
 el('ssid').value=exactSsid(el('ssid').value);
 const data={cmd:'configure',automatic:el('automatic').checked,interval:Number(el('interval').value),edge_min:2,duplicate_max:8};for(const k of ['ssid','password','token','course','rules'])data[k]=el(k).value;
 try{const r=await command(data,j=>typeof j.ok==='boolean');if(!r.ok)throw Error(r.detail||'Ayarlar kaydedilemedi.');el('password').value=el('token').value='';message('Ayarlar kameraya kaydedildi. Kamera yeniden başlayacak. Hotspotu ve NotEkran’ı açık tut. Durumu yeniden okumak için USB’den kamerayı bul düğmesine bas.');verified=false;}
 catch(e){message(e.message);el('save').disabled=!verified;}
});

el('testCamera').onclick=async()=>{if(!verified||!connected){message('Önce USB’den kamerayı bul.');return;}try{const r=await command({cmd:'test_camera'},j=>typeof j.ok==='boolean');if(!r.ok)throw Error(r.detail);message('Tek kare testi istendi. Birkaç saniye sonra USB’den kamerayı bul ile sonucu oku. Isınma devam ediyorsa gücü çıkar.');}catch(e){message(e.message);}};

// Live view over USB: shows the latest frame the camera checked and why it passed or failed the photo rules.
function metrics(s){if(!s.frame)return 'Henüz görüntü yok.';const e=Number(s.edge_min)||2,r=(ok,t)=>(ok?'✓ ':'✗ ')+t,tips=[];
 if(s.mean<70||s.light<.5)tips.push('Daha fazla ışık ver: lambayı aç veya kâğıdı ışığa çevir; gölge düşürme.');
 if(s.edge<e)tips.push('Görüntü bulanık veya soru çok küçük: kamerayı kâğıda yaklaştır (yaklaşık 20–30 cm), sabit tut.');
 if(s.ink<.006)tips.push('Kadrajda yazı yok gibi: kamerayı soruya çevir.');if(s.ink>.48)tips.push('Kadraj çok koyu/dolu: kâğıdın tamamı beyaz zeminde görünsün.');
 if(s.spread<35)tips.push('Kontrast düşük: beyaz kâğıt ve koyu yazı, düz ışık kullan.');
 return [r(s.mean>=70,'Parlaklık '+Math.round(s.mean)+' (en az 70)'),r(s.light>=.5,'Aydınlık alan %'+Math.round(s.light*100)+' (en az %50)'),
  r(s.ink>=.006&&s.ink<=.48,'Yazı oranı %'+(s.ink*100).toFixed(1)+' (%0,6–%48)'),r(s.edge>=e,'Netlik/ayrıntı '+Number(s.edge).toFixed(1)+' (en az '+e+')'),
  r((s.spread??99)>=35,'Kontrast '+Math.round(s.spread??0)+' (en az 35)')].join('\n')+(tips.length?'\n\n'+tips.join('\n'):'\n\nGörüntü uygun.');}
let live=false;
// Streams frames (sensor maximum by default, smaller on request) one request at a time; the rules are re-checked on the live frames while aiming.
el('livePreview').onclick=async()=>{if(live){live=false;return;}if(!verified||!connected){message('Önce USB’den kamerayı bul.');return;}
 live=true;el('livePreview').textContent='Canlı görüntüyü durdur';let last=-1,shown=0,since=Date.now();const img=el('preview');
 try{while(live&&connected){const r=await command({cmd:'live',size:Number(el('liveSize').value)||0},j=>j.live===true,20000);
  if(r.hot){el('metrics').textContent='Kart çok ısındı ('+Math.round(r.temp)+' °C). Soğuyunca canlı görüntü kendiliğinden açılır; gerekirse gücü çıkar.';await wait(2000);continue;}
  if(r.busy){el('metrics').textContent='Kamera şu an bir fotoğrafı işliyor; canlı görüntü cevap gelince açılır.';await wait(1000);continue;}
  if(r.error){el('metrics').textContent='Kamera açılamadı: '+r.error;await wait(1000);continue;}
  if(r.image&&r.seq!==last){img.src='data:image/jpeg;base64,'+r.image;if(img.style)img.style.display='block';last=r.seq;++shown;}
  if(r.valid){const fps=shown/Math.max(1,(Date.now()-since)/1000);el('metrics').textContent=metrics({...r,frame:1})+'\n\nCanlı: saniyede '+fps.toFixed(1)+' kare'+(r.temp?' · kart '+Math.round(r.temp)+' °C':'');}
  if(!r.image)await wait(30);}}
 catch(e){message(e.message);}
 finally{live=false;el('livePreview').textContent='Canlı görüntü · kameranın gördüğünü göster';if(connected)command({cmd:'live_stop'},j=>j.ok===true,3000).catch(()=>{});}};
// Mirror/flip are saved on the camera and apply to live view and real photos alike.
async function turn(key){if(!verified||!connected){message('Önce USB’den kamerayı bul.');return;}
 const next={...orient,[key]:!orient[key]};
 const send=()=>command({cmd:'orient',...next},j=>j.ok===true&&typeof j.hmirror==='boolean',5000);
 // The live loop may be waiting for a frame: retry briefly instead of failing with "wait for the previous USB task".
 for(let i=0;;++i){try{const r=await send();orient={hmirror:r.hmirror,vflip:r.vflip};return;}catch(e){if(i>=20||!/Önceki USB/.test(e.message)){message(e.message);return;}await wait(150);}}}
el('mirrorH').onclick=()=>turn('hmirror');el('mirrorV').onclick=()=>turn('vflip');
// Manual photo: “Fotoğraf çek” takes a full-size photo and shows it; “Gönder” uploads it and follows it to NotEkran.
// The board's BOOT key does the same without the computer.
async function ask(payload,match,timeout){for(let i=0;;++i){try{return await command(payload,match,timeout);}catch(e){if(i>=40||!/Önceki USB/.test(e.message))throw e;await wait(150);}}}
const statusOf=()=>ask({cmd:'status'},j=>j.device!==undefined,5000);
el('shoot').onclick=async()=>{if(!verified||!connected){message('Önce USB’den kamerayı bul.');return;}
 live=false;el('shoot').disabled=true;el('sendPhoto').disabled=true;
 try{const before=await statusOf();await ask({cmd:'shoot'},j=>j.ok===true,5000);message('Fotoğraf çekiliyor…');let s;
  for(let i=0;i<60;++i){await wait(500);s=await statusOf();if(s.held&&s.frame!==before.frame)break;if(s.phase==='camera_error')throw Error(s.detail);if(s.phase==='too_hot')throw Error(s.detail);message('Fotoğraf çekiliyor… (kamera: '+s.detail+')');}
  if(!s||!s.held)throw Error('Fotoğraf 30 saniyede çekilemedi. Kameranın son durumu: '+(s?s.detail:'bilinmiyor')+'\nRESET’e basıp tekrar dene.');
  message('Fotoğraf çekildi; görüntü yükleniyor…');const r=await ask({cmd:'preview'},j=>typeof j.preview==='string',60000);
  if(r.preview){const img=el('preview');img.src='data:image/jpeg;base64,'+r.preview;if(img.style)img.style.display='block';}
  el('metrics').textContent='';el('sendPhoto').disabled=false;el('shoot').textContent='↺ Yeniden çek';
  message('Fotoğraf çekildi. Yazı okunuyorsa “Bu fotoğrafı gönder”e bas; değilse yeniden çek.');}
 catch(e){message(e.message);}finally{el('shoot').disabled=false;}};
el('sendPhoto').onclick=async()=>{if(!verified||!connected){message('Önce USB’den kamerayı bul.');return;}el('sendPhoto').disabled=true;
 try{const r=await ask({cmd:'send'},j=>typeof j.ok==='boolean',5000);if(!r.ok)throw Error(r.detail||'Gönderilemedi.');el('shoot').textContent='📷 Fotoğraf çek';
  for(let i=0;i<300;++i){await wait(1000);const s=await statusOf();message('Gönderim: '+s.detail+(s.wifi?'':'\nWi-Fi: '+wifiText(s)));
   if(s.phase==='delivered'||s.phase==='superseded'){message('✓ Cevap NotEkran’da gösterildi. Yeni soru için tekrar “Fotoğraf çek”e bas.');return;}
   if(['upload_error','analysis_error','access_error'].includes(s.phase))return;}}
 catch(e){message(e.message);el('sendPhoto').disabled=false;}};
