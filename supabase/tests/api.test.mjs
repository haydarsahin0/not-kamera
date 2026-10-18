import test from 'node:test';import assert from 'node:assert/strict';import {createHandler,parseProfile,validateImage,MODEL} from '../functions/not-kamera-api/index.ts';
const token='a'.repeat(48),tokenHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const jobId='12345678-1234-4321-1234-123456789012';
function setup({incomplete=false,answer='Aufgabe 1)\n2 + 2 = 4',previous=[],decision={decision:'independent',used_pages:[]},claim={},databaseError=null,answers=null,firstTimeout=false}={}){
 const jobs=[],tasks=[],calls=[],device={id:1};let modelCalls=0;
 const fetcher=async(url,opts={})=>{
  if(url.endsWith('/chat/completions')){
   const raw=JSON.parse(opts.body);
   assert.equal(opts.headers.Authorization,'Bearer private-deepseek');
   assert.equal(raw.response_format.type,'json_object');
   const normalized={model:raw.model,store:false,instructions:raw.messages[0].content,reasoning:{effort:raw.reasoning_effort==='low'?'medium':'high'},text:{verbosity:'low',format:{type:'json_schema',strict:true}},input:raw.messages.slice(1).map(m=>({role:m.role,content:typeof m.content==='string'?[{type:'output_text',text:m.content}]:m.content.map(p=>p.type==='image_url'?{type:'input_image',image_url:p.image_url.url,detail:'high'}:{type:'input_text',text:p.text})}))};
   opts={...opts,body:JSON.stringify(normalized)};
  }
  calls.push({url,opts});
  if(url.includes('not_kamera_access'))return Response.json([{token_hash:tokenHash}]);
  if(url.endsWith('/models'))return Response.json({data:[{id:MODEL}]});
  if(url.endsWith('/rpc/not_kamera_claim_frame')){if(databaseError)return Response.json(databaseError,{status:400});jobs.push({id:jobId,status:'processing',created:new Date().toISOString(),answer:'',error:''});return Response.json({id:jobId,previous,context_pages:previous.length,...claim});}
  if(url.includes('not_kamera_device')){const q=new URL(url).searchParams;if(q.has('delivery_id')&&q.get('delivery_id')!=='eq.'+device.delivery_id)return Response.json([]);if(opts.method==='PATCH')Object.assign(device,JSON.parse(opts.body));return Response.json([device]);}
  if(url.includes('not_kamera_jobs')&&opts.method==='PATCH'){Object.assign(jobs[0],JSON.parse(opts.body));return Response.json(jobs);}
  if(url.includes('not_kamera_jobs'))return Response.json(jobs);
  if(url.endsWith('/chat/completions')){if(firstTimeout&&modelCalls++===0)throw new DOMException('Timed out','TimeoutError');const answerValue=answers?answers[Math.min(modelCalls++,answers.length-1)]:answer;const p=JSON.parse(opts.body);assert.equal(p.model,'deepseek-flash');assert.equal(p.store,false);assert.match(p.instructions,/Aufgabe 1\)/);assert.match(p.instructions,/so kurz wie möglich und so ausführlich wie nötig/);assert.match(p.instructions,/Erkläre die Bedeutung des Ergebnisses nur, wenn gefragt oder fachlich nötig/);assert.match(p.instructions,/Jede Teilaufgabe erhält ihre eigene vollständige/);assert.match(p.input[0].content[0].text,/Statistik/);assert.equal(p.text.verbosity,'low');assert.match(p.instructions,/LÄNGENREGEL FÜR JEDE TEILAUFGABE/);assert.match(p.instructions,/kompakten Gleichungskette/);assert.match(p.instructions,/ausdrücklich verlangte Herleitungen/);assert.equal(p.text.format.type,'json_schema');assert.equal(p.text.format.strict,true);assert.match(p.instructions,/liefere tatsächlich mindestens ein graphs-Objekt/);return Response.json({choices:[{finish_reason:incomplete?'length':'stop',message:{content:JSON.stringify({context:decision,answer:typeof answerValue==='string'?{format:'not-ekran-answer-v1',sections:[{task:'Aufgabe 1)',text:answerValue.replace(/^Aufgabe 1\)\n/,''),graphs:[]}]}:answerValue})}}]});}
  throw Error('Unexpected '+url);
 };
 const env=name=>({SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private-service','deepseek':'private-deepseek'})[name];
 return {handler:createHandler({env,fetcher,waitUntil:p=>tasks.push(p)}),tasks,calls,jobs,device};
}
function photo(){const bytes=new Uint8Array(30);bytes.set([137,80,78,71,13,10,26,10],0);bytes.set([73,72,68,82],12);const v=new DataView(bytes.buffer);v.setUint32(16,200);v.setUint32(20,200);return bytes;}
function req(path,opts={}){return new Request('https://project.supabase.co/functions/v1/not-kamera-api'+path,{...opts,headers:{Authorization:'Bearer '+token,...opts.headers}})}
test('standalone camera JPEG/UTF8 profile contract reaches existing API and waits for exact screen acknowledgement',async()=>{
 const s=setup(),id='83a9ff9c-3979-48e3-8b23-a13a1a30915e';
 // Structural JPEG SOF fixture: this test exercises the protocol, not lens/OCR quality.
 const jpeg=Uint8Array.from([255,216,255,192,0,11,8,4,176,6,64,1,1,17,0,255,217]);
 const profile=Buffer.from(JSON.stringify({course:'Statistik',rules:'Kurze Antworten mit ä, ö und Einheiten.'}),'utf8').toString('base64');
 const r=await s.handler(req('/api/frames',{method:'POST',body:jpeg,headers:{'Content-Type':'image/jpeg','X-Study-Profile':profile,'X-Request-Id':id,'X-Study-Reset':'0'}}));
 assert.equal(r.status,202);assert.equal((await r.json()).device_queued,true);
 const claim=JSON.parse(s.calls.find(x=>x.url.endsWith('/rpc/not_kamera_claim_frame')).opts.body);assert.equal(claim.p_request_id,id);assert.equal(claim.p_mime,'image/jpeg');assert.equal(claim.p_reset,false);
 await Promise.all(s.tasks);const job=await (await s.handler(req('/api/jobs/'+jobId+'?format=not-ekran-answer-v1'))).json();assert.equal(job.status,'done');
 let state=await (await s.handler(req('/api/device/status'))).json();assert.equal(state.job_id,jobId);assert.equal(state.ack_id,null);
 const delivery=state.delivery_id;await s.handler(req('/api/device/ack?id='+delivery+'&pages=3',{method:'POST'}));
 state=await (await s.handler(req('/api/device/status'))).json();assert.equal(state.job_id,jobId);assert.equal(state.delivery_id,state.ack_id);assert.equal(state.pages,3);
});
test('authenticated upload, German profile, asynchronous exact-job retrieval',async()=>{
 const s=setup();const profile=btoa(JSON.stringify({course:'Statistik',rules:'100 Worte'}));
 const r=await s.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png','X-Study-Profile':profile}}));assert.equal(r.status,202);assert.equal((await r.json()).id,jobId);
 await Promise.all(s.tasks);const out=await s.handler(req('/api/jobs/'+jobId));assert.equal((await out.json()).answer,'Aufgabe 1)\n2 + 2 = 4');
 assert(s.calls.filter(x=>x.url.includes('generativelanguage.googleapis.com')).every(x=>x.opts.headers['x-goog-api-key']==='private-gemini'));
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
test('database failures expose only a bounded code, never SQL/photos/secrets or a queued job',async()=>{
 const s=setup({databaseError:{code:'21000',message:'private SQL or photo details'}});
 const logs=[],original=console.error;console.error=(...args)=>logs.push(args);
 try{
  const r=await s.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png'}}));
  assert.equal(r.status,503);const body=await r.text();assert.match(body,/21000/);assert(!body.includes('private'));
  assert.deepEqual(logs,[['not-kamera database error',400,'21000']]);assert.equal(s.tasks.length,0);assert.equal(s.device.job_id,undefined);
 }finally{console.error=original;}
});
test('mathematical notation reaches device delivery as actual superscripts and subscripts',async()=>{
 const s=setup({answer:'y^2 + x^{a+b} = 25; Y_{t+1} = 120; x_i = 3.'});
 await s.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png','X-Study-Profile':btoa('{"course":"Statistik"}')}}));await Promise.all(s.tasks);
 const r=await s.handler(req('/api/device/poll?format=not-ekran-answer-v1'));assert.equal(r.status,200);
 assert.equal(JSON.parse(await r.text()).sections[0].text,'y² + xᵃ⁺ᵇ = 25; Yₜ₊₁ = 120; xᵢ = 3.');
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


test('original earlier photos are ordered and current page is explicitly isolated',async()=>{
 const previous=[{job_id:'earlier-1',mime:'image/jpeg',image_base64:'b3JpZ2luYWwtMQ=='},{job_id:'earlier-2',mime:'image/png',image_base64:'b3JpZ2luYWwtMg=='}];
 const doc={format:'not-ekran-answer-v1',sections:[{task:'Aufgabe 1) c)',text:'Y = 120.',graphs:[]}]};
 const s=setup({previous,answer:doc,decision:{decision:'uses_previous',used_pages:[1]}});
 const response=await s.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png','X-Study-Profile':btoa('{"course":"Statistik"}')}}));
 const accepted=await response.json();assert.equal(accepted.context_pages,2);assert.equal(accepted.previous,undefined);assert(!JSON.stringify(accepted).includes('b3Jp'));await Promise.all(s.tasks);
 const call=JSON.parse(s.calls.find(x=>x.url.endsWith('/chat/completions')).opts.body),content=call.input[0].content;
 const images=content.filter(x=>x.type==='input_image');assert.equal(images.length,3);assert.match(images[0].image_url,/b3JpZ2luYWwtMQ==$/);assert.match(images[1].image_url,/b3JpZ2luYWwtMg==$/);assert.match(content.at(-2).text,/AKTUELLE SEITE/);
 assert.match(call.instructions,/Gleiche Buchstaben/);assert.match(call.instructions,/Bei einer eigenständigen Aufgabe/);assert.match(call.instructions,/Lokale neue Angaben/);assert.match(call.instructions,/Wiederhole frühere a\/b-Lösungen nicht/);assert.match(call.instructions,/keine erfundene Zahlenlösung oder Grafik/);
 assert.equal(s.jobs[0].context_decision,'uses_previous');assert.deepEqual(s.jobs[0].context_used,[1]);assert.deepEqual(JSON.parse(s.jobs[0].answer),doc);assert(!s.jobs[0].answer.includes('used_pages'));
});
test('independent and missing-context decisions remain separate from the display answer',async()=>{
 for(const decision of ['independent','missing_context']){
  const s=setup({previous:[{mime:'image/png',image_base64:'cHJpb3I='}],decision:{decision,used_pages:[]}});
  await s.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png','X-Study-Profile':btoa('{"course":"Statistik"}')}}));await Promise.all(s.tasks);assert.equal(s.jobs[0].status,'done');assert.equal(s.jobs[0].context_decision,decision);assert.deepEqual(s.jobs[0].context_used,[]);
 }
});
test('invented context references never become deliverable answers',async()=>{
 for(const decision of [{decision:'uses_previous',used_pages:[2]},{decision:'independent',used_pages:[1]},{decision:'uses_previous',used_pages:[]}]){
  const s=setup({previous:[{mime:'image/png',image_base64:'cHJpb3I='}],decision});
  await s.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png','X-Study-Profile':btoa('{"course":"Statistik"}')}}));await Promise.all(s.tasks);assert.equal(s.jobs[0].status,'error');assert.equal(s.jobs[0].answer,'');
 }
});
test('reset and idempotency identity reach the atomic claim; retries do not start another model task',async()=>{
 const s=setup({claim:{duplicate:true}}),id='83a9ff9c-3979-48e3-8b23-a13a1a30915e';
 const result=await s.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png','X-Study-Profile':btoa('{"course":"Statistik"}'),'X-Request-Id':id,'X-Study-Reset':'1'}}));assert.equal(result.status,202);assert.equal(s.tasks.length,0);
 const claim=JSON.parse(s.calls.find(x=>x.url.endsWith('/rpc/not_kamera_claim_frame')).opts.body);assert.equal(claim.p_request_id,id);assert.equal(claim.p_reset,true);assert.equal(claim.p_preview,false);assert.equal(claim.p_profile.length,64);assert.equal(claim.p_fingerprint.length,64);
 for(const headers of [{'X-Request-Id':'wrong'},{'X-Study-Reset':'oops'}])assert.equal((await s.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png',...headers}}))).status,400);
});


test('graph repair is bounded and retains current/original previous photos and context before exact device delivery',async()=>{
 const fs=await import('node:fs/promises');const good=JSON.parse(await fs.readFile(new URL('../../firmware/tests/graph-fixture.json',import.meta.url),'utf8'));
 const bad=structuredClone(good);bad.sections[0].graphs[0].curves[0].points[0].x=-1;
 const s=setup({answers:[bad,good],previous:[{mime:'image/png',image_base64:'cHJpb3I='}],decision:{decision:'uses_previous',used_pages:[1]}});
 await s.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png','X-Study-Profile':btoa('{"course":"Statistik"}')}}));await Promise.all(s.tasks);
 const calls=s.calls.filter(x=>x.url.endsWith('/chat/completions')).map(x=>JSON.parse(x.opts.body));assert.equal(calls.length,2);
 assert.deepEqual(calls[0].input,calls[1].input.slice(0,1));assert.equal(calls[1].input[1].role,'assistant');assert.deepEqual(JSON.parse(calls[1].input[1].content[0].text).answer,bad);assert.equal(calls[1].reasoning.effort,'medium');assert.match(calls[1].instructions,/DARSTELLUNGSREPARATUR/);assert.match(calls[1].instructions,/coordinate_0_100/);
 assert.equal(s.jobs[0].status,'done');assert.equal(s.jobs[0].context_decision,'uses_previous');assert.deepEqual(s.jobs[0].context_used,[1]);
 const delivered=await s.handler(req('/api/device/poll?format=not-ekran-answer-v1'));assert.deepEqual(JSON.parse(await delivered.text()),good);assert.equal(s.device.ack_id,null);
 const failed=setup({answers:[bad,bad]});await failed.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png','X-Study-Profile':btoa('{"course":"Statistik"}')}}));await Promise.all(failed.tasks);
 assert.equal(failed.calls.filter(x=>x.url.endsWith('/chat/completions')).length,2);assert.equal(failed.jobs[0].status,'error');assert.match(failed.jobs[0].error,/coordinate_0_100/);assert.equal((await failed.handler(req('/api/device/poll'))).status,204);
});

test('long ticks and off-curve label anchors are adapted without needing a second model call',async()=>{
 const fs=await import('node:fs/promises');const doc=JSON.parse(await fs.readFile(new URL('../../firmware/tests/graph-fixture.json',import.meta.url),'utf8'));
 const g=doc.sections[0].graphs[0];g.y_ticks=[{label:'1200',value:45},{label:'1400',value:50}];g.curves[0].label_at={x:90,y:90};
 const s=setup({answer:doc});await s.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png','X-Study-Profile':btoa('{"course":"Statistik"}')}}));await Promise.all(s.tasks);
 assert.equal(s.jobs[0].status,'done');assert.equal(s.calls.filter(x=>x.url.endsWith('/chat/completions')).length,1);
 const result=JSON.parse(s.jobs[0].answer);assert.match(result.sections[0].text,/y1 = 1200/);assert.match(result.sections[0].text,/y2 = 1400/);
 assert.equal(result.sections[0].graphs.length,2);assert.deepEqual(result.sections[0].graphs.flatMap(x=>x.y_ticks.map(t=>t.value)),[45,50]);
 for(const graph of result.sections[0].graphs)assert.deepEqual(graph.curves.map(c=>c.points),g.curves.map(c=>c.points));
});
test('model request uses high reasoning and the direction/sign self-check',async()=>{
 const {modelRequest,VERIFY_INSTRUCTIONS,REASONING_EFFORT}=await import('../functions/not-kamera-api/index.ts');
 const request=modelRequest({course:'Makroökonomie',rules:''},{mime:'image/jpeg',image_base64:'AA=='});
 assert.equal(REASONING_EFFORT,'high');assert.deepEqual(request.reasoning,{effort:'high'});
 assert(request.instructions.includes(VERIFY_INSTRUCTIONS));
 for(const word of ['Verteilungs','Verschärfung','über vs. unter','Phillipskurve'])assert(VERIFY_INSTRUCTIONS.includes(word),word);
});

test('unreadable claim gets one original-image review before delivery, without inventing a graph',async()=>{
 const good={format:'not-ekran-answer-v1',sections:[{task:'Aufgabe 9)',text:'Die höhere Risikoprämie verteuert Kredite. Investitionen und Produktion sinken.',graphs:[]}]};
 const s=setup({answers:['Die Richtung der Risikoprämienänderung ist nicht lesbar.',good],previous:[{mime:'image/png',image_base64:'cHJpb3I='}]});
 await s.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png','X-Study-Profile':btoa('{"course":"Statistik"}')}}));await Promise.all(s.tasks);
 const calls=s.calls.filter(x=>x.url.endsWith('/chat/completions')).map(x=>JSON.parse(x.opts.body));
 assert.equal(calls.length,2);assert.deepEqual(calls[0].input,calls[1].input);
 assert.match(calls[1].instructions,/LESBARKEITSPRÜFUNG/);assert.doesNotMatch(calls[1].instructions,/DARSTELLUNGSREPARATUR/);
 assert.equal(s.jobs[0].status,'done');assert.deepEqual(JSON.parse(s.jobs[0].answer),good);
 assert.match(calls[0].instructions,/Ein genanntes Modell ist keine fehlende Abbildung/);
 assert.match(calls[0].instructions,/Zinssteuerung/);
});
test('genuinely unreadable data remains uncertain after the bounded review',async()=>{
 const s=setup({answer:'Der Zahlenwert ist nicht lesbar.',decision:{decision:'missing_context',used_pages:[]}});
 await s.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png','X-Study-Profile':btoa('{"course":"Statistik"}')}}));await Promise.all(s.tasks);
 assert.equal(s.calls.filter(x=>x.url.endsWith('/chat/completions')).length,2);
 assert.equal(s.jobs[0].status,'done');assert.equal(s.jobs[0].context_decision,'missing_context');
 assert.match(JSON.parse(s.jobs[0].answer).sections[0].text,/nicht lesbar/);
});

 test('slow initial analysis retries once with the original context and a smaller reasoning budget',async()=>{
 const s=setup({firstTimeout:true,previous:[{mime:'image/png',image_base64:'cHJpb3I='}]});
 await s.handler(req('/api/frames',{method:'POST',body:photo(),headers:{'Content-Type':'image/png','X-Study-Profile':btoa('{"course":"Statistik"}')}}));await Promise.all(s.tasks);
 const calls=s.calls.filter(x=>x.url.endsWith('/chat/completions')).map(x=>JSON.parse(x.opts.body));
 assert.equal(calls.length,2);assert.deepEqual(calls[0].input,calls[1].input);
 assert.equal(calls[0].reasoning.effort,'high');assert.equal(calls[1].reasoning.effort,'medium');
 assert.doesNotMatch(calls[1].instructions,/DARSTELLUNGSREPARATUR/);assert.equal(s.jobs[0].status,'done');
 });
