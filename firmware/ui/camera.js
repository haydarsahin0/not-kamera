'use strict';
const $=id=>document.getElementById(id);
let selected=null,busy=false,uploading=false,paired=false,previewUrl=null,selection=0,statusTimer=null,resetContext=false,resetQueued=false;
function notice(message,error=false){$('notice').textContent=message;$('notice').classList.toggle('error',error)}
function controls(){$('send').disabled=!paired||busy||!selected;$('file').disabled=busy;$('connectButton').disabled=busy;$('newStudy').disabled=busy;}
async function device(path,options={}){
 const response=await fetch(path,{...options,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(path==='/api/photo'?120000:15000)});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(body.detail||'Cihaz isteği başarısız ('+response.status+'). Sayfayı yenile.');return body;
}
function contextLabel(count){$('newStudy').textContent=resetContext?'Sonraki fotoğraf yeni çalışma başlatacak':'Yeni çalışma başlat';$('contextStatus').textContent=resetContext?'Sonraki fotoğraf önceki sayfalar kullanılmadan çözülecek.':Number.isInteger(count)&&count>=0?'Son analizde modele '+count+' önceki fotoğraf sunuldu; hangi verilerin gerekli olduğuna model karar verir.':'Önceki sayfaların bağlantısı otomatik değerlendirilir.';}
$('newStudy').onclick=()=>{if(busy)return;resetContext=!resetContext;try{sessionStorage.setItem('not-study-reset',resetContext?'1':'0')}catch{}contextLabel();};
function profileHeader(){const p={course:$('course').value.trim(),rules:$('rules').value.trim()};try{sessionStorage.setItem('not-study-profile',JSON.stringify(p))}catch{}return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(p))));}
async function refresh(){
 try{const state=await device('/api/photo/status');paired=state.paired;busy=state.busy||uploading;
 if(resetQueued&&['processing','received','rendered'].includes(state.state)){resetContext=false;resetQueued=false;try{sessionStorage.removeItem('not-study-reset')}catch{}}
 contextLabel(state.context_pages);
 if(typeof state.version==='string')$('firmwareVersion').textContent=state.version;
 $('settings').open=!paired;$('connection').textContent=(paired?'Eşleştirme kayıtlı. ':'Eşleştirme gerekli. ')+(state.wifi?'Wi-Fi bağlı. ':'İnternet Wi-Fi bağlantısı bekleniyor. ')+'Bulut: '+state.cloud;
 if(state.healthy===false){$('screenStatus').textContent='Ekran sürücüsü hata bildirdi; aktarım tamamlandı sayılmadı.';notice('Ekran yanıt vermiyor. Cihazı ve V2 sürümünü kontrol et.',true);}
 else if(state.screen_hidden){$('screenStatus').textContent='Ekran kapalı; pil göstergesi açık. PWR tuşuna kısa basınca kaldığın sayfa açılır; yeni cevap varsa açıldıktan sonra ekrana alınır.';notice(state.busy?'Fotoğraf işlemi sürüyor; cevabı göstermek için PWR ile ekranı aç.':'Ekran kapalı; okuma sayfası korunuyor.');}
 else if(state.state==='rendered'){$('screenStatus').textContent='Cevap ekranda: '+state.pages+' sayfa. Tek basış ileri, çift basış geri.';notice('Cevap cihaz ekranına geldi.');}
 else if(state.state==='error')notice(state.detail,true);
 else if(state.busy){$('screenStatus').textContent=state.detail;notice('Fotoğraf cihazda. Tek iPhone kullanıyorsan NotEkran ağından çık, kişisel erişim noktasını aç ve cihazı açık bırak. Cevap otomatik ekrana gelir.');}
 else notice(paired?'Hazır. Fotoğraf çek veya seç.':'Önce uygulama erişim koduyla eşleştir.');controls();
 }catch(e){if(busy)notice('Cihaz fotoğrafı aldı. NotEkran ağından çıkıp kişisel erişim noktasını açtıysan sayfanın bağlantısı kesilir; cihaz işlemi sürdürür.');else notice(e.message,true);}
}
$('connect').onsubmit=async e=>{e.preventDefault();try{await device('/api/cloud',{method:'POST',body:new URLSearchParams({csrf:window.NOT_CSRF,token:$('appToken').value.trim()})});$('appToken').value='';await refresh();}catch(e){notice(e.message,true);}};
async function send(){if(!selected||!paired||busy)return;busy=true;uploading=true;controls();notice('Fotoğraf cihaza yükleniyor; bu adım bitene kadar ağ değiştirme.');try{
 const form=new FormData();form.append('photo',selected,'question.jpg');
 const result=await device('/api/photo',{method:'POST',headers:{'X-CSRF':window.NOT_CSRF,'X-Study-Profile':profileHeader(),'X-Study-Reset':resetContext?'1':'0'},body:form});
 if(!result.queued)throw Error('Cihaz fotoğrafı kaydetmedi.');
 resetQueued=resetContext;if(resetQueued)try{sessionStorage.setItem('not-study-reset','queued')}catch{}contextLabel();
 $('screenStatus').textContent='Fotoğraf cihazın belleğinde; internet geldiğinde işlenecek.';
 notice('Fotoğraf cihaz tarafından alındı. Şimdi NotEkran ağından çıkıp iPhone kişisel erişim noktasını aç. Cihaz açık kaldığı sürece cevabı otomatik alır; başka site gerekmez.');
 }catch(e){busy=false;notice(e.message,true);}finally{uploading=false;controls();}}
$('send').onclick=send;
$('file').onchange=async()=>{
 if(busy)return;const file=$('file').files[0];if(!file)return;const generation=++selection;selected=null;controls();
 try{if(file.size>25*1024*1024)throw Error('25 MB’den küçük bir fotoğraf seç.');const src=URL.createObjectURL(file),img=new Image();
 try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Fotoğraf açılamadı.'));img.src=src;});
 const scale=Math.min(1,2200/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));if(generation!==selection)return;
 if(!blob||blob.size>4*1024*1024)throw Error('Fotoğraf küçültülemedi. Daha küçük bir fotoğraf seç.');selected=blob;
 }finally{URL.revokeObjectURL(src);}
 if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(selected);$('photo').src=previewUrl;$('photo').hidden=false;controls();
 if(paired&&$('autoSend').checked)await send();else notice('Fotoğraf hazır. Cihaza yükle düğmesine dokun.');
 }catch(e){notice(e.message,true);controls();}
};
try{const p=JSON.parse(sessionStorage.getItem('not-study-profile')||'{}');$('course').value=p.course??'Makroökonomie';$('rules').value=p.rules||'';}catch{}
try{const saved=sessionStorage.getItem('not-study-reset');resetContext=saved==='1'||saved==='queued';resetQueued=saved==='queued'}catch{}contextLabel();
async function start(){
 try{if(location.hash.startsWith('#setup=')){
 const p=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(location.hash.slice(7)),c=>c.charCodeAt(0))));history.replaceState(null,'',location.pathname+location.search);
 if(p.url!=='https://jckoovsocynnxbrsalld.supabase.co/functions/v1/not-kamera-api'||typeof p.token!=='string')throw Error('Eşleştirme bağlantısı geçersiz.');
 await device('/api/cloud',{method:'POST',body:new URLSearchParams({csrf:window.NOT_CSRF,token:p.token})});
 }await refresh();}catch(e){notice(e.message,true);}
 statusTimer=setInterval(refresh,5000);
}
controls();start();
