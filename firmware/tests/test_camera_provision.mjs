import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
const source=await fs.readFile(new URL('../../web/camera-install/provision.js',import.meta.url),'utf8');
function fixture(device='NotCamera'){
 const nodes=new Map(),commands=[];let callback,queued=[],reset=false;
 const get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,checked:true,addEventListener(name,fn){this[name]=fn;}});return nodes.get(id);};
 const reader={async read(){if(queued.length)return {value:queued.shift(),done:false};return new Promise(r=>callback=r);},async cancel(){callback?.({done:true});},releaseLock(){}};
 const respond=j=>{const value=new TextEncoder().encode('boot noise\n'+JSON.stringify(j)+'\n');if(callback){const r=callback;callback=null;r({value,done:false});}else queued.push(value);};
 const writer={async write(bytes){const j=JSON.parse(new TextDecoder().decode(bytes));commands.push(j);if(j.cmd==='status')respond({device,version:'0.1.0',detail:'ready',camera_ready:true,wifi:true,ip:'172.20.10.2',ap:'NotCamera-1234',code:'private-device-code',ssid:'Test iPhone',course:'Makroökonomie',rules:'',interval:15,automatic:true,sent:0,rendered:0,busy:false});else if(j.cmd==='configure'){reset=true;respond({ok:true});}},releaseLock(){}};
 const port={async open(opts){assert.equal(opts.baudRate,115200);},readable:{getReader:()=>reader},writable:{getWriter:()=>writer},async close(){}};
 const timers=new Map();let n=0;const ctx={document:{getElementById:get},navigator:{serial:{requestPort:async()=>port}},TextDecoder,TextEncoder,JSON,Number,Error,console,setTimeout(fn,ms){if(ms===600){queueMicrotask(fn);return ++n;}timers.set(++n,fn);return n;},clearTimeout(id){timers.delete(id);}};
 vm.runInNewContext(source,ctx);return {get,commands,reset:()=>reset};
}
test('camera identity checked before USB provisioning; credentials never leave USB',async()=>{
 const s=fixture();await s.get('usbConnect').onclick();assert.equal(s.get('save').disabled,false);assert.match(s.get('usbState').textContent,/NotCamera 0.1.0/);
 s.get('password').value='private-hotspot';s.get('token').value='z'.repeat(48);s.get('rules').value='Antworten mit ä und ö';
 await s.get('setup').submit({preventDefault(){}});assert.equal(s.commands.length,2);assert.equal(s.commands[1].password,'private-hotspot');assert.equal(s.commands[1].token,'z'.repeat(48));assert.equal(s.commands[1].rules,'Antworten mit ä und ö');assert.equal(s.get('password').value,'');assert.equal(s.get('token').value,'');assert(s.reset());
 // Only local USB code is shown, never the cloud bearer or hotspot password.
 assert(!s.get('usbState').textContent.includes('private-hotspot'));assert(!s.get('usbState').textContent.includes('z'.repeat(48)));
});
test('NotEkran or another serial device cannot receive camera credentials',async()=>{
 const s=fixture('NotEkran');await s.get('usbConnect').onclick();assert.equal(s.get('save').disabled,true);await s.get('setup').submit({preventDefault(){}});assert.equal(s.commands.length,1);
});
