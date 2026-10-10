const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function harness({paired=true,hash='',hidden=false}={}){
 const nodes=new Map(),calls=[];let photoState='idle',queued=false;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='course'?'Makroökonomie':'',disabled:false,hidden:false,textContent:'',classList:{toggle(){}},files:[],checked:true});return nodes.get(id)};
 const ctx={TextDecoder,TextEncoder,atob,btoa,console,URLSearchParams,AbortController,AbortSignal,Blob,FormData,
 location:{hash,pathname:'/camera',search:''},history:{replaceState(){ctx.location.hash=''}},
 document:{getElementById:node,createElement:()=>({getContext:()=>({drawImage(){}}),toBlob:fn=>fn(new Blob(['\xff\xd8jpeg'],{type:'image/jpeg'}))})},
 sessionStorage:{getItem(){return null},setItem(){}},
 URL:class extends URL {static createObjectURL(){return 'blob:mock'}static revokeObjectURL(){}},
 Image:class{constructor(){this.width=400;this.height=400}set src(v){queueMicrotask(()=>this.onload())}},
 window:{NOT_CSRF:'csrf-test'},setInterval(){return 1},
 fetch:async(url,opts)=>{calls.push({url,opts});assert(url.startsWith('/'));assert.equal(opts.credentials,'same-origin');assert.equal(opts.headers?.Authorization,undefined);
 let body;if(url==='/api/photo/status')body={screen_hidden:hidden,paired,busy:queued&&photoState!=='rendered',state:photoState,detail:'waiting',cloud:'Internet Wi-Fi bekleniyor',wifi:false,pages:3};
 else if(url==='/api/cloud'){assert.equal(opts.body.get('csrf'),'csrf-test');paired=true;body={saved:true};}
 else if(url==='/api/photo'){assert.equal(opts.headers['X-CSRF'],'csrf-test');assert.equal(opts.body.get('photo').type,'image/jpeg');const p=JSON.parse(Buffer.from(opts.headers['X-Study-Profile'],'base64').toString());assert.equal(p.course,'Makroökonomie');queued=true;photoState='waiting';body={queued:true};}
 else throw Error('Unexpected fetch '+url);return {ok:true,json:async()=>body};}}
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('firmware/ui/camera.js','utf8'),ctx);
 return {ctx,node,calls,done(){photoState='rendered'}};
}
(async()=>{
 const hidden=harness({hidden:true});await vm.runInContext('refresh()',hidden.ctx);assert.match(hidden.node('screenStatus').textContent,/Ekran kapalı/);assert.match(hidden.node('notice').textContent,/okuma sayfası korunuyor/);
 const h=harness();await vm.runInContext('refresh()',h.ctx);assert.equal(h.node('settings').open,false);
 h.node('file').files=[{size:100}];await h.node('file').onchange();
 assert(h.calls.some(x=>x.url==='/api/photo'));assert.match(h.node('notice').textContent,/Fotoğraf cihaz tarafından alındı/);assert.equal(h.node('file').disabled,true);
 await h.node('file').onchange();assert.equal(h.calls.filter(x=>x.url==='/api/photo').length,1); // no duplicate while queued
 h.done();await vm.runInContext('refresh()',h.ctx);assert.match(h.node('screenStatus').textContent,/3 sayfa/);assert.equal(h.node('file').disabled,false);
 const token='s'.repeat(48),setup=Buffer.from(JSON.stringify({url:'https://jckoovsocynnxbrsalld.supabase.co/functions/v1/not-kamera-api',token})).toString('base64');
 const offline=harness({paired:false,hash:'#setup='+setup});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(offline.calls[0].url,'/api/cloud');assert.equal(offline.calls[0].opts.body.get('token'),token);assert.equal(offline.ctx.location.hash,'');assert(!offline.calls.some(x=>x.url.startsWith('https:')));
 console.log('PASS offline pairing, saved device login, local-only multipart upload, single-photo queue, display completion');
})().catch(e=>{console.error(e);process.exitCode=1});
