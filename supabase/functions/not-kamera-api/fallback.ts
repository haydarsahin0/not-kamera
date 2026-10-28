import {TERRA_BASE} from './terra.ts';
export const HAIKU_MODEL='claude-haiku-5-5';
export const HAIKU_BASE='https://api.anthropic.com/v1';

export function exhausted(status,data){
 if(![402,429].includes(status))return false;
 return ['insufficient_quota','credit_balance_exhausted','organization_spend_limit_exceeded','project_spend_limit_exceeded','organization_usage_limit_exceeded','billing_hard_limit_reached','billing_not_active'].includes(data?.error?.code)
  ||data?.error?.type==='insufficient_quota';
}
export function haikuRequest(chat){
 return {model:HAIKU_MODEL,max_tokens:chat.max_completion_tokens||16384,stream:false,
  output_config:{effort:'high'},
  system:chat.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n')+'\nGib nur das verlangte JSON zurück, ohne Markdown-Codeblock.',
  messages:chat.messages.filter(m=>m.role!=='system').map(m=>({role:m.role,content:typeof m.content==='string'?m.content:m.content.map(p=>{
   if(p.type==='text')return {type:'text',text:p.text};
   const match=/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(p.image_url?.url||'');
   if(!match)throw Error('Geçersiz yedek model görseli.');
   return {type:'image',source:{type:'base64',media_type:match[1],data:match[2]}};
  })}))};
}
export function haikuAnswer(data){
 if(data.stop_reason!=='end_turn')throw Error('Haiku cevabı tamamlanmadı; eksik cevap gönderilmedi.');
 const text=(data.content||[]).filter(p=>p.type==='text').map(p=>p.text).join('');
 if(!text.trim())throw Error('Haiku okunabilir cevap döndürmedi.');
 return {choices:[{finish_reason:'stop',message:{content:text}}]};
}
// One router per job: once quota is exhausted all remaining stages use Haiku.
// New jobs try Terra again, so a credit refill needs no deploy or manual reset.
export function createModelRouter({fetcher=fetch,terraKey,haikuKey}){
 let backup=false;
 return async(chat,timeoutMs)=>{
  const signal=AbortSignal.timeout(timeoutMs);
  if(!backup){
   const r=await fetcher(TERRA_BASE+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+terraKey,'Content-Type':'application/json'},body:JSON.stringify(chat),signal});
   if(r.ok)return r;
   let error;try{error=await r.clone().json();}catch{}
   if(!exhausted(r.status,error))return r;
   if(!haikuKey)return Response.json({error:{message:'OpenAI kredisi/kotası tükendi; notekran_haiku ayarı eksik.'}},{status:503});
   backup=true;
  }
  const r=await fetcher(HAIKU_BASE+'/messages',{method:'POST',headers:{'x-api-key':haikuKey,'anthropic-version':'2023-06-01','Content-Type':'application/json'},body:JSON.stringify(haikuRequest(chat)),signal});
  // Never forward raw provider error bodies (they may contain private input).
  if(!r.ok)return Response.json({error:{message:'Haiku yedek sağlayıcısı başarısız (HTTP '+r.status+'). Anahtar, bakiye ve model erişimini kontrol et.'}},{status:r.status});
  const data=await r.json();
  return Response.json(haikuAnswer(data));
 };
}
