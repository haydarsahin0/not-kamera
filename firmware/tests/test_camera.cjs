const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=new Map();
function node(id){if(!nodes.has(id))nodes.set(id,{value:'',disabled:false,hidden:false,textContent:'',classList:{toggle(){}},files:[]});return nodes.get(id)}
const calls=[],storage=new Map();let failDisplay=false;
const ctx={TextDecoder,atob,location:{hash:''},history:{},console,btoa:s=>Buffer.from(s,'binary').toString('base64'),TextEncoder,URLSearchParams,AbortController,AbortSignal,DOMException,Blob,Date,
 document:{getElementById:node,createElement:()=>({getContext:()=>({drawImage(){}}),toBlob:fn=>fn(new Blob(['jpeg'],{type:'image/jpeg'}))})},
 sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
 URL:class extends URL {static createObjectURL(){return 'blob:mock'}static revokeObjectURL(){}},
 Image:class{constructor(){this.width=400;this.height=400}set src(v){queueMicrotask(()=>this.onload())}},
 window:{NOT_CSRF:'csrf-test'},setTimeout:fn=>setTimeout(fn,0),clearTimeout,
 fetch:async(url,opts)=>{calls.push({url,opts});let body;
  if(url.endsWith('/api/status'))body={ready:true};
  else if(url.endsWith('/api/frames'))body={id:'exact-job'};
  else if(url.endsWith('/api/jobs/exact-job'))body={status:'done',answer:'2 + 2 = 4'};
  else if(url==='/api/text'){assert.equal(opts.body.get('csrf'),'csrf-test');assert.equal(opts.body.get('text'),'2 + 2 = 4');body={revision:7};}
  else if(url==='/api/screen')body={revision:7,rendered:7,pages:1,healthy:!failDisplay};
  else throw Error('Unexpected fetch '+url);
  return {ok:true,json:async()=>body};
 }};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('firmware/ui/camera.js','utf8'),ctx);
(async()=>{
 node('apiUrl').value='https://api.example';node('appToken').value='a'.repeat(40);node('size').value='2';node('autoSend').checked=true;
 await node('connect').onsubmit({preventDefault(){}});
 node('file').files=[{size:100}];await node('file').onchange();
 assert.equal(node('answer').textContent,'2 + 2 = 4');assert.match(node('screenStatus').textContent,/Ekran yenilendi/);
 assert.deepEqual(calls.map(x=>x.url),['https://api.example/api/status','https://api.example/api/frames','https://api.example/api/jobs/exact-job','/api/text','/api/screen']);
 const profile=JSON.parse(Buffer.from(calls[1].opts.headers['X-Study-Profile'],'base64').toString());assert.equal(profile.course,'Makroökonomie');
 assert.equal(calls[1].opts.credentials,'omit');assert.equal(calls[3].opts.credentials,'same-origin');
 assert.equal(calls[1].opts.headers.Authorization,'Bearer '+'a'.repeat(40));assert.equal(calls[3].opts.headers.Authorization,undefined);
 assert.equal(vm.runInContext("checkUrl('https://project.supabase.co/functions/v1/not-kamera-api/')",ctx),'https://project.supabase.co/functions/v1/not-kamera-api');
 const shortened=vm.runInContext("forScreen('ş😀'.repeat(3000))",ctx);assert(new TextEncoder().encode(shortened).length<=6000);assert.match(shortened,/kisaltildi/);
 failDisplay=true;await node('retryScreen').onclick();assert.match(node('notice').textContent,/hata bildirdi/);
 assert.equal(node('send').disabled,false);assert.equal(node('retryScreen').disabled,false);
 const secondNodes=new Map();let bootstrap;
 const get=id=>{if(!secondNodes.has(id))secondNodes.set(id,{value:'',hidden:false,classList:{toggle(){}},requestSubmit(){bootstrap=this.onsubmit({preventDefault(){}})}});return secondNodes.get(id)};
 const base='https://jckoovsocynnxbrsalld.supabase.co/functions/v1/not-kamera-api';const setupToken='s'.repeat(48);
 const boot={...ctx,document:{...ctx.document,getElementById:get},location:{hash:'#setup='+Buffer.from(JSON.stringify({url:base,token:setupToken})).toString('base64'),pathname:'/camera',search:''},history:{replaceState(){boot.location.hash=''}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},fetch:async(url,opts)=>{assert.equal(url,base+'/api/status');assert.equal(opts.headers.Authorization,'Bearer '+setupToken);return {ok:true,json:async()=>({ready:true})}}};
 vm.createContext(boot);vm.runInContext(fs.readFileSync('firmware/ui/camera.js','utf8'),boot);await bootstrap;
 assert.equal(boot.location.hash,'');assert.equal(get('appToken').value,setupToken);assert.match(get('notice').textContent,/Bağlantı hazır/);
 console.log('PASS photo → OpenAI job → screen, auth isolation, UTF-8 limit, display failure');
})().catch(e=>{console.error(e);process.exitCode=1});
