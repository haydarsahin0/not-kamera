// Credentials go only over the chosen USB port: no fetch/localStorage/URL use.
const el=id=>document.getElementById(id);
let port=null,reader=null,writer=null,waiting=null,verified=false,connected=false,received=0;
// Only Espressif USB JTAG/serial (camera firmware) or Seeed TinyUSB ports; hides Bluetooth/other COM ports.
const FILTERS=[{usbVendorId:0x303a},{usbVendorId:0x2886}];
const NO_REPLY='Kamera seçildi ama hiç veri gelmedi. Kamera yazılımı çalışmıyor olabilir (yükleme modunda kalmış olabilir). Kablo takılıyken BOOT’a basmadan RESET’e bir kez kısa bas, 5 saniye bekle ve tekrar “USB’den kamerayı bul” düğmesine bas.';
const NO_JSON='Kameradan veri geliyor ama NotCamera cevabı okunamadı. Yükleyicinin seri konsolunu ve başka sekmeleri kapat, RESET’e bir kez kısa bas, 5 saniye bekle ve tekrar dene.';
const limit=(promise,ms)=>Promise.race([promise,new Promise(r=>setTimeout(r,ms))]);
function message(text){el('usbState').textContent=text;}
function accept(line){let data;try{data=JSON.parse(line);}catch{return;}
 if(waiting&&waiting.match(data)){const w=waiting;waiting=null;clearTimeout(w.timer);w.resolve(data);}}
async function readLoop(){let buffer='';const decoder=new TextDecoder();try{while(connected){const {value,done}=await reader.read();if(done)break;received+=value.length;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){accept(buffer.slice(0,end).trim());buffer=buffer.slice(end+1);}if(buffer.length>10000)buffer='';}}catch{}
 const lost=connected;connected=false;verified=false;el('save').disabled=true;if(waiting){waiting.reject(Error(lost?'USB bağlantısı kapandı. Kamera yeniden başlamış veya kablo gevşemiş olabilir. Birkaç saniye bekleyip tekrar dene; sürekli kopuyorsa kablo/güç sorununu kontrol et.':'USB bağlantısı kapandı.'));clearTimeout(waiting.timer);waiting=null;}}
async function command(payload,match){if(waiting)throw Error('Önceki USB işlemini bekle.');return new Promise((resolve,reject)=>{waiting={resolve,reject,match,timer:setTimeout(()=>{waiting=null;reject(Error(received?NO_JSON:NO_REPLY));},10000)};writer.write(new TextEncoder().encode(JSON.stringify(payload)+'\n')).catch(e=>{if(waiting){clearTimeout(waiting.timer);waiting=null;reject(Error('USB yazma işlemi başarısız.'));}});});}
// A port that never accepts data must not leave the button disabled forever: every step is time-limited.
async function close(){connected=false;if(waiting){waiting.reject(Error('Bağlantı yenilendi.'));clearTimeout(waiting.timer);waiting=null;}try{if(reader){await limit(reader.cancel(),1000);reader.releaseLock();}}catch{}try{if(writer){if(writer.abort)await limit(writer.abort().catch(()=>{}),1000);writer.releaseLock();}}catch{}try{if(port)await limit(port.close(),2000);}catch{}reader=writer=port=null;verified=false;el('save').disabled=true;}
function openError(e){const text=String(e&&e.message||'');
 if(e&&e.name==='NotFoundError')return 'Kamera seçilmedi. Listede “USB JTAG/serial debug unit” görünmüyorsa: veri aktarabilen başka bir USB-C kablo ve başka bir USB portu dene, kamerayı çıkarıp yeniden tak. Hâlâ yoksa BOOT’u basılı tutup RESET’e kısa bas, BOOT’u bırak ve 1. adımdan yazılımı yeniden yükle.';
 if(e&&(e.name==='InvalidStateError'||e.name==='NetworkError')||/open/i.test(text))return 'Kamera bağlantı noktası başka bir pencere tarafından kullanılıyor. Yükleyici penceresini (Logs/Console) ve Arduino seri monitörünü kapat, bu sayfanın başka sekmelerini kapat. Sonra kabloyu çıkarıp yeniden tak, sayfayı yenile ve tekrar dene.';
 return text||'USB bağlantısı açılamadı.';}
function show(s){verified=s.device==='NotCamera'&&s.version==='0.1.1';el('save').disabled=!verified||s.busy;
 if(!verified){message('Seçilen cihaz NotCamera 0.1.1 değil. Ayar gönderilmedi. Kamera kartını ve yüklemeyi kontrol et.');return;}
 for(const key of ['ssid','course','rules','interval'])if(s[key]!==undefined)el(key).value=s[key];el('automatic').checked=!!s.automatic;
 message('NotCamera '+s.version+'\n'+s.detail+'\nKamera testi: '+(s.camera_ready?'başarılı':(s.camera_error||'henüz yapılmadı'))+'\nSensör: '+(s.sensor_active?'çekim yapıyor':'beklemede')+'\nWi-Fi: '+(s.wifi?'bağlı':'bekleniyor')+(s.ip?'\nHotspot adresi: http://'+s.ip:'')+'\nKamera ağı: '+s.ap+'\nKamera ağ şifresi: '+s.code+'\nGönderilen: '+s.sent+' · Ekranda gösterilen: '+s.rendered);
}
el('usbConnect').onclick=async()=>{el('usbConnect').disabled=true;try{if(!navigator.serial)throw Error('USB kurulumu için Windows Chrome/Edge kullan.');
 if(!connected){await close();received=0;try{port=await navigator.serial.requestPort({filters:FILTERS});await port.open({baudRate:115200});}catch(e){port=null;throw Error(openError(e));}message('Kamera bağlantı noktası açıldı; cevap bekleniyor…');if(port.setSignals)await port.setSignals({dataTerminalReady:true,requestToSend:false});reader=port.readable.getReader();writer=port.writable.getWriter();connected=true;readLoop();await new Promise(r=>setTimeout(r,600));}
 let s;for(let attempt=0;attempt<2;++attempt){try{s=await command({cmd:'status'},j=>j.device!==undefined||j.version!==undefined);break;}catch(e){if(attempt===1)throw e;message('Kameranın başlaması bekleniyor; bağlantı tekrar kontrol ediliyor…');}}show(s);
 }catch(e){message(e.message||'USB bağlantısı açılamadı.');await close();}finally{el('usbConnect').disabled=false;}};
el('setup').addEventListener('submit',async event=>{event.preventDefault();if(!verified||!connected){message('Önce USB’den kamerayı bul.');return;}el('save').disabled=true;
 const data={cmd:'configure',automatic:el('automatic').checked,interval:Number(el('interval').value),edge_min:2,duplicate_max:8};for(const k of ['ssid','password','token','course','rules'])data[k]=el(k).value;
 try{const r=await command(data,j=>typeof j.ok==='boolean');if(!r.ok)throw Error(r.detail||'Ayarlar kaydedilemedi.');el('password').value=el('token').value='';message('Ayarlar kameraya kaydedildi. Kamera yeniden başlayacak. Hotspotu ve NotEkran’ı açık tut. Durumu yeniden okumak için USB’den kamerayı bul düğmesine bas.');verified=false;}
 catch(e){message(e.message);el('save').disabled=!verified;}
});

el('testCamera').onclick=async()=>{if(!verified||!connected){message('Önce USB’den kamerayı bul.');return;}try{const r=await command({cmd:'test_camera'},j=>typeof j.ok==='boolean');if(!r.ok)throw Error(r.detail);message('Tek kare testi istendi. Birkaç saniye sonra USB’den kamerayı bul ile sonucu oku. Isınma devam ediyorsa gücü çıkar.');}catch(e){message(e.message);}};
