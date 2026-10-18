import test from 'node:test';
import assert from 'node:assert/strict';
import {geminiRequest,geminiAnswer,geminiSchema} from '../functions/not-kamera-api/gemini.ts';
import {modelRequest,MODEL} from '../functions/not-kamera-api/index.ts';
test('Gemini preserves ordered original images, strict schema and thinking level without credentials',()=>{
 const base=modelRequest({course:'Makroökonomie',rules:''},{mime:'image/jpeg',image_base64:'YQ=='},[{mime:'image/png',image_base64:'Yg=='}]);
 const request=geminiRequest(base);
 assert.equal(base.model,MODEL);
 assert.deepEqual(request.contents[0].parts.filter(x=>x.inlineData).map(x=>x.inlineData),[{mimeType:'image/png',data:'Yg=='},{mimeType:'image/jpeg',data:'YQ=='}]);
 assert.deepEqual(request.generationConfig.responseFormat.text.schema,geminiSchema(base.text.format.schema));
 assert.equal(request.generationConfig.thinkingConfig.thinkingLevel,'HIGH');
 assert(!JSON.stringify(request).includes('api-key'));
});
test('only completed visible Gemini text is delivered, never thoughts or partial output',()=>{
 const content={parts:[{thought:true,text:'private reasoning'},{text:'{"ok":true}'}]};
 assert.equal(geminiAnswer({candidates:[{finishReason:'STOP',content}]}),'{"ok":true}');
 for(const finishReason of ['MAX_TOKENS','SAFETY','CONTINUATION'])assert.throws(()=>geminiAnswer({candidates:[{finishReason,content}]}));
 assert.throws(()=>geminiAnswer({promptFeedback:{blockReason:'SAFETY'}}));
});

test('provider schema drops unsupported constraints without modifying the original device contract',()=>{
 const source={type:'array',minItems:1,maxItems:3,items:{type:'number',minimum:0,maximum:100}};
 assert.deepEqual(geminiSchema(source),{type:'array',items:{type:'number'}});
 assert.equal(source.maxItems,3);assert.equal(source.items.maximum,100);
});
