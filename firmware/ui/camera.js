'use strict';
const DEFAULT_API='https://jckoovsocynnxbrsalld.supabase.co/functions/v1/not-kamera-api';
let importedSetup=false;

const $=id=>document.getElementById(id);
let cfg={},connected=false,busy=false,selected=null,previewUrl=null,pendingId='',answer='',answerJobId='',controller=null,selection=0;
try{cfg=JSON.parse(sessionStorage.getItem('not-ekran-cloud')||'{}')}catch{}

try {if(location.hash.startsWith('#setup=')){const p=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(location.hash.slice(7)),c=>c.charCodeAt(0))));if(p.url===DEFAULT_API&&typeof p.token==='string'&&p.token.length>=32){cfg=p;sessionStorage.setItem('not-ekran-cloud',JSON.stringify(p));importedSetup=true;}history.replaceState(null,'',location.pathname+location.search);}}catch{}
$('apiUrl').value=cfg.url||DEFAULT_API;$('appToken').value=cfg.token||'';pendingId=cfg.pending||'';$('resume').hidden=!pendingId;

let savedProfile={};try{savedProfile=JSON.parse(sessionStorage.getItem('not-study-profile')||'{}')}catch{}
$('course').value=savedProfile.course??'Makroökonomie';$('rules').value=savedProfile.rules||'';
function profileHeader(){const profile={course:$('course').value.trim(),rules:$('rules').value.trim()};sessionStorage.setItem('not-study-profile',JSON.stringify(profile));return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(profile))));}
$('course').onchange=profileHeader;$('rules').onchange=profileHeader;

function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error)}
function controls(){ $('send').disabled=!connected||!selected||busy; $('file').disabled=busy; $('course').disabled=busy; $('rules').disabled=busy; $('stop').disabled=!busy; $('connectButton').disabled=busy; $('disconnect').disabled=busy; $('resume').disabled=busy||!connected; $('retryScreen').disabled=busy||!answer; }
function save(){try{sessionStorage.setItem('not-ekran-cloud',JSON.stringify({...cfg,pending:pendingId}))}catch{}}
function checkUrl(value){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('HTTPS API adresini gir; kullanıcı, şifre veya sorgu ekleme.');return url.origin+url.pathname.replace(/\/$/,'');}
async function cloud(path,options={}){const r=await fetch(cfg.url+path,{...options,credentials:'omit',cache:'no-store',headers:{...options.headers,Authorization:'Bearer '+cfg.token},signal:AbortSignal.timeout(30000)});const body=await r.json().catch(()=>({}));if(!r.ok)throw Error(typeof body.detail==='string'?body.detail:'Sunucu isteği başarısız ('+r.status+').');return body;}
async function device(path,options={}){const r=await fetch(path,{...options,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});const b=await r.json().catch(()=>({}));if(!r.ok)throw Error(typeof b.detail==='string'?b.detail:'Cihaza gönderim başarısız ('+r.status+'). Sayfayı yenileyip giriş yap.');return b;}
function wait(ms,signal){return new Promise((resolve,reject)=>{if(signal.aborted)return reject(new DOMException('Takip durduruldu','AbortError'));const abort=()=>{clearTimeout(timer);reject(new DOMException('Takip durduruldu','AbortError'))};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve()},ms);signal.addEventListener('abort',abort,{once:true});});}
async function sendScreen(reselect=false){
 if(!answerJobId)throw Error('Önce bir cevap hazırla.');
 if(reselect)await cloud('/api/device/select?job='+encodeURIComponent(answerJobId),{method:'POST'});
 $('screenStatus').textContent='Cihaz cevabı buluttan alıyor…';
 const end=Date.now()+90000;
 while(Date.now()<end){
  const state=await cloud('/api/device/status');
  if(state.job_id!==answerJobId)throw Error('Başka bir cevap seçilmiş. Bu cevabı yeniden gönderebilirsin.');
  if(state.delivery_id&&state.ack_id===state.delivery_id){$('screenStatus').textContent='Ekran yenilendi. '+state.pages+' sayfa; tek basış ileri, çift basış geri.';return;}
  if(!state.online)$('screenStatus').textContent='Cihazın internet bağlantısı bekleniyor; cevap sunucuda hazır.';
  await new Promise(r=>setTimeout(r,2500));
 }
 throw Error('Cevap hazır; cihaz henüz ekran onayı vermedi. Cihazın internet bağlantısını kontrol et.');
}
async function follow(id,signal){const end=Date.now()+150000;while(Date.now()<end){if(signal.aborted)throw new DOMException('Takip durduruldu','AbortError');const job=await cloud('/api/jobs/'+encodeURIComponent(id));if(signal.aborted)throw new DOMException('Takip durduruldu','AbortError');if(job.status==='error'){pendingId='';save();throw Error(job.error||'Analiz tamamlanamadı.');}if(job.status==='done'){answer=job.answer;answerJobId=id;$('answer').textContent=answer;pendingId='';save();notice('Açıklama hazır; ekrana gönderiliyor.');await sendScreen();notice('Açıklama cihazına gönderildi. Sayıları ve çözümü kontrol et.');return;}notice('Fotoğraf okunuyor, açıklama hazırlanıyor…');await wait(2500,signal);}throw Error('Cevap henüz alınamadı. “Bekleyen cevabı kontrol et” ile yeni fotoğraf göndermeden devam edebilirsin.');}
async function run(resume=false){if(busy||!connected||(!resume&&!selected))return;busy=true;controller=new AbortController();controls();try{let id=pendingId;if(!resume){answer='';$('answer').textContent='Fotoğraf gönderiliyor…';$('screenStatus').textContent='Yeni cevap bekleniyor; ekranda önceki metin kalabilir.';notice('Fotoğraf sunucuya gönderiliyor…');const result=await cloud('/api/frames',{method:'POST',headers:{'Content-Type':'image/jpeg','X-Study-Profile':profileHeader()},body:selected});id=result.id;if(!id)throw Error('Sunucu işlem kimliği döndürmedi.');pendingId=id;save();}if(!id)throw Error('Bekleyen işlem yok.');await follow(id,controller.signal);}catch(e){notice(e.name==='AbortError'?'Takip durduruldu. Bekleyen cevabı daha sonra kontrol edebilirsin.':e.message+(e instanceof TypeError?' İnterneti ve sunucunun CORS ayarını kontrol et.':''),true);}finally{busy=false;controller=null;$('resume').hidden=!pendingId;controls();}}
$('connect').onsubmit=async e=>{e.preventDefault();if(busy)return;try{const url=checkUrl($('apiUrl').value.trim());const token=$('appToken').value.trim();if(token.length<32)throw Error('Uygulama erişim kodu en az 32 karakter olmalı.');const changed=cfg.url!==url||cfg.token!==token;cfg={url,token};if(changed)pendingId='';connected=false;controls();const s=await cloud('/api/status');if(!s.ready)throw Error(s.detail||'Sunucuda OpenAI API veya model ayarı eksik.');await device('/api/cloud',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:window.NOT_CSRF,token:cfg.token})});connected=true;save();$('settings').open=false;notice(pendingId?'Bağlantı hazır; bekleyen cevabı kontrol edebilirsin.':'Bağlantı hazır. Cihaz eşleştirildi; ana siteden gönderdiğin cevapları da otomatik alacak.');$('resume').hidden=!pendingId;controls();}catch(e){connected=false;controls();notice(e.message+(e instanceof TypeError?' Telefonun internetini ve sunucunun CORS ayarını kontrol et.':''),true)}};
$('disconnect').onclick=async()=>{if(busy)return;try{await device('/api/cloud',{method:'POST',body:new URLSearchParams({csrf:window.NOT_CSRF,token:''})});}catch(e){notice(e.message,true);return;}cfg={};connected=false;pendingId='';sessionStorage.removeItem('not-ekran-cloud');$('appToken').value='';$('resume').hidden=true;notice('Sunucu bağlantısı kaldırıldı.');controls();};
$('file').onchange=async()=>{if(busy)return;const file=$('file').files[0];if(!file)return;const generation=++selection;selected=null;controls();try{if(file.size>25*1024*1024)throw Error('25 MB’den küçük bir fotoğraf seç.');const src=URL.createObjectURL(file),img=new Image();try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Fotoğraf açılamadı. JPEG veya PNG kullan.'));img.src=src;});const scale=Math.min(1,2200/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.9));if(generation!==selection)return;if(!blob||blob.size>4*1024*1024)throw Error('Fotoğraf küçültülemedi. Daha küçük bir fotoğraf seç.');selected=blob;}finally{URL.revokeObjectURL(src);}if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(selected);$('photo').src=previewUrl;$('photo').hidden=false;controls();if(connected&&$('autoSend').checked){if(pendingId){notice('Önce bekleyen cevabı kontrol et. Yeni fotoğraf için “Analizi başlat”a dokun.');return;}await run();}else notice(connected?'Fotoğraf hazır. Analizi başlatabilirsin.':'Fotoğraf hazır. Önce sunucuya bağlan.');}catch(e){notice(e.message,true);controls();}};
$('send').onclick=()=>run();$('resume').onclick=()=>run(true);$('stop').onclick=()=>controller?.abort();
$('retryScreen').onclick=async()=>{if(busy||!answer)return;busy=true;controls();try{await sendScreen(true);notice('Cevap cihazına yeniden gönderildi.');}catch(e){notice(e.message,true);}finally{busy=false;controls();}};
controls();

if(importedSetup)$('connect').requestSubmit();
