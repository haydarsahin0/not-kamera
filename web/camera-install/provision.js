// Credentials go only over the chosen USB port: no fetch/localStorage/URL use.
const el=id=>document.getElementById(id);
let port=null,reader=null,writer=null,waiting=null,verified=false,connected=false;
function message(text){el('usbState').textContent=text;}
function accept(line){let data;try{data=JSON.parse(line);}catch{return;}
 if(waiting&&waiting.match(data)){const w=waiting;waiting=null;clearTimeout(w.timer);w.resolve(data);}}
async function readLoop(){let buffer='';const decoder=new TextDecoder();try{while(connected){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){accept(buffer.slice(0,end).trim());buffer=buffer.slice(end+1);}if(buffer.length>10000)buffer='';}}catch{}
 connected=false;verified=false;el('save').disabled=true;if(waiting){waiting.reject(Error('USB bağlantısı kapandı.'));clearTimeout(waiting.timer);waiting=null;}}
async function command(payload,match){if(waiting)throw Error('Önceki USB işlemini bekle.');return new Promise((resolve,reject)=>{waiting={resolve,reject,match,timer:setTimeout(()=>{waiting=null;reject(Error('Kamera cevap vermedi. Yükleyici konsolunu kapat, RESET’e kısa bas ve tekrar bağlan.'));},10000)};writer.write(new TextEncoder().encode(JSON.stringify(payload)+'\n')).catch(e=>{if(waiting){clearTimeout(waiting.timer);waiting=null;reject(Error('USB yazma işlemi başarısız.'));}});});}
async function close(){connected=false;if(waiting){waiting.reject(Error('Bağlantı yenilendi.'));clearTimeout(waiting.timer);waiting=null;}try{if(reader){await reader.cancel();reader.releaseLock();}}catch{}try{if(writer)writer.releaseLock();if(port)await port.close();}catch{}reader=writer=port=null;verified=false;el('save').disabled=true;}
function show(s){verified=s.device==='NotCamera'&&s.version==='0.1.1';el('save').disabled=!verified||s.busy;
 if(!verified){message('Seçilen cihaz NotCamera 0.1.1 değil. Ayar gönderilmedi. Kamera kartını ve yüklemeyi kontrol et.');return;}
 for(const key of ['ssid','course','rules','interval'])if(s[key]!==undefined)el(key).value=s[key];el('automatic').checked=!!s.automatic;
 message('NotCamera '+s.version+'\n'+s.detail+'\nKamera testi: '+(s.camera_ready?'başarılı':(s.camera_error||'henüz yapılmadı'))+'\nSensör: '+(s.sensor_active?'çekim yapıyor':'beklemede')+'\nWi-Fi: '+(s.wifi?'bağlı':'bekleniyor')+(s.ip?'\nHotspot adresi: http://'+s.ip:'')+'\nKamera ağı: '+s.ap+'\nKamera ağ şifresi: '+s.code+'\nGönderilen: '+s.sent+' · Ekranda gösterilen: '+s.rendered);
}
el('usbConnect').onclick=async()=>{el('usbConnect').disabled=true;try{if(!navigator.serial)throw Error('USB kurulumu için Windows Chrome/Edge kullan.');
 if(!connected){await close();port=await navigator.serial.requestPort();await port.open({baudRate:115200});if(port.setSignals)await port.setSignals({dataTerminalReady:true,requestToSend:false});reader=port.readable.getReader();writer=port.writable.getWriter();connected=true;readLoop();await new Promise(r=>setTimeout(r,600));}
 let s;for(let attempt=0;attempt<2;++attempt){try{s=await command({cmd:'status'},j=>j.device!==undefined||j.version!==undefined);break;}catch(e){if(attempt===1)throw e;message('Kameranın başlaması bekleniyor; bağlantı tekrar kontrol ediliyor…');}}show(s);
 }catch(e){message(e.message||'USB bağlantısı açılamadı.');await close();}finally{el('usbConnect').disabled=false;}};
el('setup').addEventListener('submit',async event=>{event.preventDefault();if(!verified||!connected){message('Önce USB’den kamerayı bul.');return;}el('save').disabled=true;
 const data={cmd:'configure',automatic:el('automatic').checked,interval:Number(el('interval').value),edge_min:2,duplicate_max:8};for(const k of ['ssid','password','token','course','rules'])data[k]=el(k).value;
 try{const r=await command(data,j=>typeof j.ok==='boolean');if(!r.ok)throw Error(r.detail||'Ayarlar kaydedilemedi.');el('password').value=el('token').value='';message('Ayarlar kameraya kaydedildi. Kamera yeniden başlayacak. Hotspotu ve NotEkran’ı açık tut. Durumu yeniden okumak için USB’den kamerayı bul düğmesine bas.');verified=false;}
 catch(e){message(e.message);el('save').disabled=!verified;}
});

el('testCamera').onclick=async()=>{if(!verified||!connected){message('Önce USB’den kamerayı bul.');return;}try{const r=await command({cmd:'test_camera'},j=>typeof j.ok==='boolean');if(!r.ok)throw Error(r.detail);message('Tek kare testi istendi. Birkaç saniye sonra USB’den kamerayı bul ile sonucu oku. Isınma devam ediyorsa gücü çıkar.');}catch(e){message(e.message);}};
