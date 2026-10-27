import test from 'node:test';
import assert from 'node:assert/strict';
import {deepseekRequest,deepseekAnswer} from '../functions/not-kamera-api/deepseek.ts';
import {modelRequest} from '../functions/not-kamera-api/index.ts';
test('DeepSeek carries original photos in order and the complete graph schema',()=>{
 const source=modelRequest({course:'Makroökonomie',rules:''},{mime:'image/jpeg',image_base64:'YQ=='},[{mime:'image/png',image_base64:'Yg=='}]);
 const r=deepseekRequest(source);
 assert.equal(r.model,source.model);
 assert.deepEqual(r.messages[1].content.filter(p=>p.type==='image_url').map(p=>p.image_url.url),['data:image/png;base64,Yg==','data:image/jpeg;base64,YQ==']);
 assert(r.messages[0].content.includes(JSON.stringify(source.text.format.schema)));
 assert.equal(r.reasoning_effort,'high');
 source.reasoning.effort='medium';assert.equal(deepseekRequest(source).reasoning_effort,'low');
});
test('DeepSeek never forwards reasoning, empty or incomplete answers',()=>{
 assert.equal(deepseekAnswer({choices:[{finish_reason:'stop',message:{content:'{}',reasoning_content:'private'}}]}),'{}');
 for(const finish_reason of ['length','content_filter',undefined])assert.throws(()=>deepseekAnswer({choices:[{finish_reason,message:{content:'{}'}}]}));
 assert.throws(()=>deepseekAnswer({choices:[{finish_reason:'stop',message:{content:''}}]}));
});
