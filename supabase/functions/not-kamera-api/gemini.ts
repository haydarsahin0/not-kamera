// Provider adapter: credentials are supplied only in server-side HTTP headers.
export const GEMINI_BASE='https://generativelanguage.googleapis.com/v1beta/models/';
// Gemini rejects the deeply constrained device schema. Keep transport types
// and required fields; the original device validator enforces all bounds.
export function geminiSchema(schema){
 if(Array.isArray(schema))return schema.map(geminiSchema);
 if(!schema||typeof schema!=='object')return schema;
 return Object.fromEntries(Object.entries(schema).filter(([key])=>!['minimum','maximum','minItems','maxItems','additionalProperties'].includes(key)).map(([key,value])=>[key,geminiSchema(value)]));
}
export function geminiRequest(request){
 return {
  systemInstruction:{parts:[{text:request.instructions}]},
  contents:request.input.map(message=>({role:message.role==='assistant'?'model':'user',parts:message.content.map(part=>{
   if(part.type==='input_image'){
    const match=/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(part.image_url);
    if(!match)throw Error('Geçersiz model görüntüsü.');
    return {inlineData:{mimeType:match[1],data:match[2]}};
   }
   if(typeof part.text!=='string')throw Error('Geçersiz model metni.');
   return {text:part.text};
  })})),
  generationConfig:{maxOutputTokens:16384,thinkingConfig:{thinkingLevel:request.reasoning.effort.toUpperCase()},responseFormat:{text:{mimeType:'APPLICATION_JSON',schema:geminiSchema(request.text.format.schema)}}}
 };
}
export function geminiAnswer(data){
 const candidate=data.candidates?.[0];
 if(candidate?.finishReason!=='STOP')throw Error('Gemini yanıtı tamamlanmadı; eksik çözüm gönderilmedi.');
 const text=(candidate.content?.parts||[]).filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('').trim();
 if(!text)throw Error('Gemini okunabilir cevap döndürmedi.');
 return text;
}
