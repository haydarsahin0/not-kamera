export const DEEPSEEK_BASE='https://api.deepseek.com';

export function deepseekRequest(request){
 const schema=JSON.stringify(request.text.format.schema);
 return {
  model:request.model,
  messages:[{role:'system',content:request.instructions+'\nAntworte ausschließlich als JSON gemäß diesem Schema (alle Pflichtfelder und Grenzen einhalten):\n'+schema+'\nBeispielstruktur: {"context":{"decision":"independent","used_pages":[]},"answer":{"format":"not-ekran-answer-v1","sections":[{"task":"Aufgabe 1)","text":"4","graphs":[]}]}}'},
   ...request.input.map(message=>({role:message.role,content:message.role==='assistant'
    ?message.content.map(p=>p.text).join('')
    :message.content.map(part=>{
     if(part.type==='input_image'){
      if(!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(part.image_url))throw Error('Geçersiz model görseli.');
      return {type:'image_url',image_url:{url:part.image_url}};
     }
     if(typeof part.text!=='string')throw Error('Geçersiz model metni.');
     return {type:'text',text:part.text};
    })}))],
  thinking:{type:'enabled'},
  reasoning_effort:request.reasoning.effort==='high'?'high':'low',
  max_tokens:16384,
  response_format:{type:'json_object'},
  stream:false
 };
}

export function deepseekAnswer(data){
 const choice=data.choices?.[0];
 if(choice?.finish_reason!=='stop')throw Error('DeepSeek cevabı tamamlanmadı; eksik cevap gönderilmedi.');
 const answer=choice.message?.content;
 if(typeof answer!=='string'||!answer.trim())throw Error('DeepSeek okunabilir cevap döndürmedi.');
 return answer;
}
