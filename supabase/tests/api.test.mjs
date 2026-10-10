import test from 'node:test';import assert from 'node:assert/strict';import {createHandler,parseProfile,validateImage,MODEL} from '../functions/not-kamera-api/index.ts';
const token='a'.repeat(48),tokenHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const jobId='12345678-1234-4321-1234-123456789012';
function setup({incomplete=false,answer='Aufgabe 1)\n2 + 2 = 4'}={}){
 const jobs=[],tasks=[],calls=[],device={id:1};
 const fetcher=async(url,opts={})=>{
  calls.push({url,opts});
  if(url.includes('not_kamera_access'))return Response.json([{token_hash:tokenHash}]);
  if(url.endsWith('/models/'+MODEL))return Response.json({id:MODEL});
  if(url.endsWith('/rpc/not_kamera_claim')){jobs.push({id:jobId,status:'processing',created:new Date().toISOString(),answer:'',error:''});return Response.json({id:jobId});}
  if(url.includes('not_kamera_device')){const q=new URL(url).searchParams;if(q.has('delivery_id')&&q.get('delivery_id')!=='eq.'+device.delivery_id)return Response.json([]);if(opts.method==='PATCH')Object.assign(device,JSON.parse(opts.body));return Response.json([device]);}
  if(url.includes('not_kamera_jobs')&&opts.method==='PATCH'){Object.assign(jobs[0],JSON.parse(opts.body));return Response.json(jobs);}
  if(url.includes('not_kamera_jobs'))return Response.json(jobs);
  if(url.endsWith('/responses')){const p=JSON.parse(opts.body);assert.equal(p.model,'gpt-6.1-sol');assert.equal(p.store,false);assert.match(p.instructions,/Aufgabe 1\)/);assert.match(p.instructions,/so kurz wie möglich und so ausführlich wie nötig/);assert.match(p.instructions,/Erkläre die Bedeutung des Ergebnisses nur, wenn gefragt oder fachlich nötig/);assert.match(p.instructions,/Jede Teilaufgabe erhält ihre eigene vollständige/);assert.match(p.input[0].content[0].text,/Statistik/);assert.equal(p.text.format.type,'json_schema');assert.equal(p.text.format.strict,true);assert.match(p.instructions,/liefere tatsächlich mindestens ein graphs-Objekt/);return Response.json({status:incomplete?'incomplete':'completed',output:[{type:'message',content:[{type:'output_text',text:typeof answer==='string'?JSON.stringify({format:'not-ekran-answer-v1',sections:[{task:'Aufgabe 1)',text:answer.replace(/^Aufgabe 1\)\n/,''),graphs:[]}]}):JSON.stringify(answer)}]}]});}
  throw Error('Unexpected '+url);
 };
 const env=name=>({SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private-service',NOT_KAMERA_OPENAI_API_KEY:'private-openai'})[name];
 return {handler:createHandler({env,fetcher,waitUntil:p=>tasks.push(p)}),tasks,calls,jobs,device};
}
function photo(){const bytes=new Uint8Array(30);bytes.set([137,80,78,71,13,10,26,10],0);bytes.set([73,72,68,82],12);const v=new DataView(bytes.buffer);v.setUint32(16,200);v.setUint32(20,200);return bytes;}
function req(path,opts={}){return new Request('https://project.supabase.co/functions/v1/not-kamera-api'+path,{...opts,headers:{Authorization:'Bearer '+token,...opts.headers}})}
test('authenticated upload, German profile, asynchronous exact-job retrieval',async()=>{
 const s=setup();const profile=btoa(JSON.stringify({course:'Statistik',rules:'100 Worte'}));
 const r=await s.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png','X-Study-Profile':profile}}));assert.equal(r.status,202);assert.equal((await r.json()).id,jobId);
 await Promise.all(s.tasks);const out=await s.handler(req('/api/jobs/'+jobId));assert.equal((await out.json()).answer,'Aufgabe 1)\n2 + 2 = 4');
 assert(s.calls.filter(x=>x.url.includes('api.openai.com')).every(x=>x.opts.headers.Authorization==='Bearer private-openai'));
});
test('authentication and CORS reject unauthorized callers',async()=>{
 const s=setup();assert.equal((await s.handler(new Request('https://project.supabase.co/functions/v1/not-kamera-api/api/status'))).status,401);
 assert.equal((await s.handler(req('/api/status',{headers:{Authorization:'Bearer '+'b'.repeat(48)}}))).status,401);
 assert.equal((await s.handler(req('/api/status',{headers:{Origin:'https://evil.example'}}))).status,403);
 const r=await s.handler(req('/api/status',{method:'OPTIONS',headers:{Origin:'http://192.168.4.1'}}));assert.equal(r.status,204);assert.match(r.headers.get('access-control-allow-headers'),/x-study-profile/);
});
test('incomplete output never becomes a successful answer',async()=>{
 const s=setup({incomplete:true});await s.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png','X-Study-Profile':btoa('{"course":"Statistik"}')}}));await Promise.all(s.tasks);assert.equal(s.jobs[0].status,'error');assert.equal(s.jobs[0].answer,'');
});
test('profile and image limits reject malformed input',()=>{
 assert.throws(()=>parseProfile('not-base64'));assert.throws(()=>parseProfile(btoa(JSON.stringify({course:'x'.repeat(121)}))));
 assert.throws(()=>validateImage(new Uint8Array([1,2,3]),'image/jpeg'));const b=photo();new DataView(b.buffer).setUint32(16,500000);assert.throws(()=>validateImage(b,'image/png'));
 assert.equal(parseProfile(null).course,'Makroökonomie');
});

test('whole answer is delivered, checked and acknowledged; stale ack cannot confirm new answer',async()=>{
 const answer='Aufgabe 1)\n'+('Begründung mit Zahlen. '.repeat(500))+'\nAufgabe 2)\nENDE';
 const s=setup({answer});
 await s.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png','X-Study-Profile':btoa('{"course":"Statistik"}')}}));
 await Promise.all(s.tasks);
 const result=await s.handler(req('/api/device/poll'));assert.equal(result.status,200);assert.equal(await result.text(),answer);
 assert.equal(Number(result.headers.get('X-Text-Bytes')),new TextEncoder().encode(answer).length);
 assert.equal(result.headers.get('X-Text-Sha256').length,64);
 const id=result.headers.get('X-Delivery-Id');assert.equal(s.device.ack_id,null);
 assert.equal((await s.handler(req('/api/device/poll?after='+id))).status,204);
 assert.equal((await s.handler(req('/api/device/ack?id='+id+'&pages=40',{method:'POST'}))).status,200);
 let status=await (await s.handler(req('/api/device/status'))).json();assert.equal(status.ack_id,id);assert.equal(status.pages,40);assert.equal(status.online,true);
 await s.handler(req('/api/device/select?job='+jobId,{method:'POST'}));assert.notEqual(s.device.delivery_id,id);assert.equal(s.device.ack_id,null);
 assert.equal((await s.handler(req('/api/device/ack?id='+id+'&pages=40',{method:'POST'}))).status,409);
 for(const path of ['/api/device/status','/api/device/poll','/api/device/ack','/api/device/select'])assert.equal((await s.handler(new Request('https://project.supabase.co/functions/v1/not-kamera-api'+path))).status,401);
});
test('oversized answers fail visibly instead of being silently shortened',async()=>{
 const s=setup({answer:'x'.repeat(65537)});await s.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png','X-Study-Profile':btoa('{"course":"Statistik"}')}}));await Promise.all(s.tasks);assert.equal(s.jobs[0].status,'error');assert.match(s.jobs[0].error,/metin kesilmedi/);assert.equal((await s.handler(req('/api/device/poll'))).status,204);
});


test('structured graphics reach new firmware intact; old clients retain readable text',async()=>{
 const fs=await import('node:fs/promises');const doc=JSON.parse(await fs.readFile(new URL('../../firmware/tests/graph-fixture.json',import.meta.url),'utf8'));const s=setup({answer:doc});
 await s.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png','X-Study-Profile':btoa('{"course":"Statistik"}')}}));await Promise.all(s.tasks);assert.equal(s.jobs[0].status,'done');
 const poll=await s.handler(req('/api/device/poll?format=not-ekran-answer-v1'));const raw=await poll.text();assert.deepEqual(JSON.parse(raw),doc);assert.equal(Number(poll.headers.get('X-Text-Bytes')),new TextEncoder().encode(raw).length);assert.equal(poll.headers.get('X-Text-Sha256'),[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(x=>x.toString(16).padStart(2,'0')).join(''));
 const job=await (await s.handler(req('/api/jobs/'+jobId+'?format=not-ekran-answer-v1'))).json();assert.deepEqual(JSON.parse(job.answer),doc);
 const old=await (await s.handler(req('/api/device/poll'))).text();assert.match(old,/IS-LM/);assert.match(old,/ab Version 0.8.0/);assert(!old.startsWith('{'));
 const history=await (await s.handler(req('/api/jobs'))).json();assert.deepEqual(history.jobs[0].document,doc);assert.match(history.jobs[0].answer,/Aufgabe 1/);
});
test('invalid graphic never becomes delivered or acknowledged',async()=>{
 const fs=await import('node:fs/promises');const doc=JSON.parse(await fs.readFile(new URL('../../firmware/tests/graph-fixture.json',import.meta.url),'utf8'));doc.sections[0].graphs[0].curves[0].points[0].x=-1;const s=setup({answer:doc});
 await s.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png','X-Study-Profile':btoa('{"course":"Statistik"}')}}));await Promise.all(s.tasks);assert.equal(s.jobs[0].status,'error');assert.equal(s.jobs[0].answer,'');assert.equal((await s.handler(req('/api/device/poll?format=not-ekran-answer-v1'))).status,204);
});
test('authenticated preview validates a real answer without replacing the device mailbox',async()=>{
 const s=setup();s.device.job_id='prior';s.device.delivery_id='prior-delivery';
 const r=await s.handler(req('/api/frames?preview=1',{method:'POST',body:photo(),headers:{'Content-Type':'image/png','X-Study-Profile':btoa('{"course":"Statistik"}')}}));assert.equal((await r.json()).device_queued,false);await Promise.all(s.tasks);
 assert.equal(s.jobs[0].status,'done');assert.equal(s.device.job_id,'prior');assert.equal(s.device.delivery_id,'prior-delivery');
});
