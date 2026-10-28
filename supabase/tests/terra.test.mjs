import test from 'node:test';
import assert from 'node:assert/strict';
import {terraRequest,terraAnswer} from '../functions/not-kamera-api/terra.ts';
import {modelRequest} from '../functions/not-kamera-api/index.ts';
test('GPT-6.1 Terra carries original photos in order and the complete graph schema',()=>{
 const source=modelRequest({course:'Makroökonomie',rules:''},{mime:'image/jpeg',image_base64:'YQ=='},[{mime:'image/png',image_base64:'Yg=='}]);
 source.model='gpt-6.1-terra';const r=terraRequest(source);
 assert.equal(r.model,'gpt-6.1-terra');assert.equal(r.store,false);assert.equal(r.thinking,undefined);assert.equal(r.max_completion_tokens,16384);
 assert.deepEqual(r.messages[1].content.filter(p=>p.type==='image_url').map(p=>p.image_url.url),['data:image/png;base64,Yg==','data:image/jpeg;base64,YQ==']);
 assert(r.messages[0].content.includes(JSON.stringify(source.text.format.schema)));
 assert.equal(r.reasoning_effort,'high');
 source.reasoning.effort='medium';assert.equal(terraRequest(source).reasoning_effort,'medium');
});
test('GPT-6.1 Terra never forwards reasoning, empty or incomplete answers',()=>{
 assert.equal(terraAnswer({choices:[{finish_reason:'stop',message:{content:'{}',reasoning_content:'private'}}]}),'{}');
 for(const finish_reason of ['length','content_filter',undefined])assert.throws(()=>terraAnswer({choices:[{finish_reason,message:{content:'{}'}}]}));
 assert.throws(()=>terraAnswer({choices:[{finish_reason:'stop',message:{content:''}}]}));
});
