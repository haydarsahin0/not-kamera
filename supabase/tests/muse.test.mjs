import test from 'node:test';
import assert from 'node:assert/strict';
import {museRequest,museAnswer} from '../functions/not-kamera-api/muse.ts';
import {modelRequest} from '../functions/not-kamera-api/index.ts';
test('Muse Wonder carries original photos in order and the complete graph schema',()=>{
 const source=modelRequest({course:'Makroökonomie',rules:''},{mime:'image/jpeg',image_base64:'YQ=='},[{mime:'image/png',image_base64:'Yg=='}]);
 const r=museRequest(source);
 assert.equal(r.model,'muse-wonder-1.0');assert.equal(r.store,false);assert.equal(r.thinking,undefined);assert.equal(r.max_completion_tokens,16384);
 assert.deepEqual(r.messages[1].content.filter(p=>p.type==='image_url').map(p=>p.image_url.url),['data:image/png;base64,Yg==','data:image/jpeg;base64,YQ==']);
 assert(r.messages[0].content.includes(JSON.stringify(source.text.format.schema)));
 assert.equal(r.reasoning_effort,'high');
 source.reasoning.effort='medium';assert.equal(museRequest(source).reasoning_effort,'medium');
});
test('Muse Wonder never forwards reasoning, empty or incomplete answers',()=>{
 assert.equal(museAnswer({choices:[{finish_reason:'stop',message:{content:'{}',reasoning_content:'private'}}]}),'{}');
 for(const finish_reason of ['length','content_filter',undefined])assert.throws(()=>museAnswer({choices:[{finish_reason,message:{content:'{}'}}]}));
 assert.throws(()=>museAnswer({choices:[{finish_reason:'stop',message:{content:''}}]}));
});
