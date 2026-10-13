import test from 'node:test';
import assert from 'node:assert/strict';
import {geminiRequest,geminiAnswer} from '../functions/not-kamera-api/gemini.ts';
import {modelRequest,MODEL} from '../functions/not-kamera-api/index.ts';
test('Gemini preserves ordered original images, strict schema and thinking level without credentials',()=>{
 const base=modelRequest({course:'Makroökonomie',rules:''},{mime:'image/jpeg',image_base64:'YQ=='},[{mime:'image/png',image_base64:'Yg=='}]);
 const request=geminiRequest(base);
 assert.equal(MODEL,'gemini-4-argon');
 assert.deepEqual(request.contents[0].parts.filter(x=>x.inlineData).map(x=>x.inlineData),[{mimeType:'image/png',data:'Yg=='},{mimeType:'image/jpeg',data:'YQ=='}]);
 assert.deepEqual(request.generationConfig.responseJsonSchema,base.text.format.schema);
 assert.equal(request.generationConfig.thinkingConfig.thinkingLevel,'high');
 assert(!JSON.stringify(request).includes('api-key'));
});
test('only completed visible Gemini text is delivered, never thoughts or partial output',()=>{
 const content={parts:[{thought:true,text:'private reasoning'},{text:'{"ok":true}'}]};
 assert.equal(geminiAnswer({candidates:[{finishReason:'STOP',content}]}),'{"ok":true}');
 for(const finishReason of ['MAX_TOKENS','SAFETY','CONTINUATION'])assert.throws(()=>geminiAnswer({candidates:[{finishReason,content}]}));
 assert.throws(()=>geminiAnswer({promptFeedback:{blockReason:'SAFETY'}}));
});
