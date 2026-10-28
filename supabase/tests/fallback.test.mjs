import test from 'node:test';import assert from 'node:assert/strict';
import {exhausted,haikuRequest,haikuAnswer,createModelRouter} from '../functions/not-kamera-api/fallback.ts';
const chat={max_completion_tokens:8192,messages:[{role:'system',content:'JSON schema and course text'},{role:'user',content:[{type:'text',text:'previous reference'},{type:'image_url',image_url:{url:'data:image/jpeg;base64,YQ=='}},{type:'text',text:'current'},{type:'image_url',image_url:{url:'data:image/png;base64,Yg=='}}]},{role:'assistant',content:'{"repair":true}'},{role:'user',content:'repair schema'}]};
test('quota detection excludes transient rate limit, authorization, server and malformed errors',()=>{
 for(const code of ['insufficient_quota','credit_balance_exhausted','organization_spend_limit_exceeded','project_spend_limit_exceeded','organization_usage_limit_exceeded','billing_hard_limit_reached','billing_not_active'])assert(exhausted(429,{error:{code}}));
 for(const status of [400,401,403,500])assert(!exhausted(status,{error:{code:'insufficient_quota'}}));
 for(const code of ['rate_limit_exceeded','invalid_api_key',undefined])assert(!exhausted(429,{error:{code}}));
 assert(!exhausted(429,null));
});
test('Haiku preserves full instructions, reference order, image bytes and repair turns',()=>{
 const h=haikuRequest(chat);assert.equal(h.model,'claude-haiku-5-5');assert.equal(h.output_config.effort,'high');assert.equal(h.max_tokens,8192);assert.match(h.system,/course text/);
 assert.deepEqual(h.messages[0].content.map(p=>p.type),['text','image','text','image']);assert.equal(h.messages[0].content[1].source.data,'YQ==');assert.equal(h.messages[0].content[3].source.media_type,'image/png');assert.equal(h.messages[1].content,'{"repair":true}');assert.equal(h.messages[2].content,'repair schema');
});
test('Haiku rejects truncation, refusal, tool use and empty output; thinking never reaches display',()=>{
 for(const stop_reason of ['max_tokens','refusal','tool_use',null])assert.throws(()=>haikuAnswer({stop_reason,content:[{type:'text',text:'partial'}]}));
 assert.throws(()=>haikuAnswer({stop_reason:'end_turn',content:[]}));
 assert.equal(haikuAnswer({stop_reason:'end_turn',content:[{type:'thinking',thinking:'private'},{type:'text',text:'{}'}]}).choices[0].message.content,'{}');
});
test('primary success and transient failures never call backup',async()=>{
 for(const status of [200,429,401,500]){let calls=0;const run=createModelRouter({terraKey:'t',haikuKey:'h',fetcher:async()=>{calls++;return Response.json({error:{code:'rate_limit_exceeded'}},{status});}});assert.equal((await run(chat,1000)).status,status);assert.equal(calls,1);}
});
test('quota fallback shares timeout, stays on Haiku for job, and resumes primary on new job',async()=>{
 const calls=[];const fetcher=async(url,opts)=>{calls.push({url,opts});return url.endsWith('/messages')?Response.json({stop_reason:'end_turn',content:[{type:'text',text:'{}'}]}):Response.json({error:{code:'insufficient_quota'}},{status:429});};
 const config={terraKey:'t',haikuKey:'h',fetcher};const run=createModelRouter(config);await run(chat,1000);await run(chat,1000);
 assert.equal(calls.length,3);assert.equal(calls[0].opts.signal,calls[1].opts.signal);assert(calls[2].url.endsWith('/messages'));assert.equal(calls[1].opts.headers.Authorization,undefined);assert.equal(calls[1].opts.headers['x-api-key'],'h');
 await createModelRouter(config)(chat,1000);assert(calls[3].url.endsWith('/chat/completions'));
});
test('missing backup and exhausted backup fail safely without loops or secret echo',async()=>{
 let calls=0;const run=createModelRouter({terraKey:'t',haikuKey:'h',fetcher:async()=>{calls++;return calls===1?Response.json({error:{code:'insufficient_quota'}},{status:429}):Response.json({error:{message:'private-key-and-photo'}},{status:400});}});
 const r=await run(chat,1000);assert.equal(calls,2);assert.equal(r.status,400);assert(!JSON.stringify(await r.json()).includes('private-key'));
 const missing=createModelRouter({terraKey:'t',fetcher:async()=>Response.json({error:{code:'insufficient_quota'}},{status:429})});assert.equal((await missing(chat,1000)).status,503);
});
