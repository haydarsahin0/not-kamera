import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
const source=await fs.readFile(new URL('../../web/camera-install/provision.js',import.meta.url),'utf8');
function fixture(device='NotCamera',dropFirst=false,extra={}){
 const nodes=new Map(),commands=[],chunks=[];let callback,queued=[],reset=false,signals;
 const get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,checked:true,addEventListener(name,fn){this[name]=fn;}});return nodes.get(id);};
 const reader={async read(){if(queued.length)return {value:queued.shift(),done:false};return new Promise(r=>callback=r);},async cancel(){callback?.({done:true});},releaseLock(){}};
 const respond=j=>{const value=new TextEncoder().encode('boot noise\n'+JSON.stringify(j)+'\n');if(callback){const r=callback;callback=null;r({value,done:false});}else queued.push(value);};
 let line='',liveSeq=0,shot=false,sent=false;const utf8=new TextDecoder();const writer={async write(bytes){chunks.push(bytes.length);line+=utf8.decode(bytes,{stream:true});if(!line.endsWith('\n'))return;const j=JSON.parse(line);line='';commands.push(j);if(dropFirst&&commands.length===1)return;if(j.cmd==='status')respond({device,version:'0.2.1',detail:'ready',camera_ready:true,wifi:true,ip:'172.20.10.2',ap:'NotCamera-1234',code:'private-device-code',ssid:'Test iPhone',course:'Makroökonomie',rules:'',interval:15,automatic:true,sent:0,rendered:0,busy:false,...extra,...(shot&&!sent?{held:true,frame:9}:{}),...(sent?{phase:'delivered',detail:'Cevap NotEkran tarafından gösterildi.'}:{})});else if(j.cmd==='live')setImmediate(()=>respond({live:true,seq:++liveSeq,busy:false,error:'',valid:true,mean:40,light:.2,ink:.01,edge:1,spread:50,edge_min:2,image:'/9j/AA=='}));else if(j.cmd==='live_stop')respond({ok:true});else if(j.cmd==='shoot'){shot=true;respond({ok:true});}else if(j.cmd==='send'){sent=true;respond({ok:true});}else if(j.cmd==='preview')respond({frame:9,preview:'/9j/HELD'});else if(j.cmd==='orient')respond({ok:true,hmirror:j.hmirror,vflip:j.vflip});else if(j.cmd==='scan')respond({ok:true,networks:[{ssid:'Haydar iPhone’u',rssi:-40},{ssid:'Komşu',rssi:-80}]});else if(j.cmd==='test_camera')respond({ok:true});else if(j.cmd==='configure'){reset=true;respond({ok:true});}},releaseLock(){}};
 const port={async setSignals(s){signals=s;},async open(opts){assert.equal(opts.baudRate,115200);},readable:{getReader:()=>reader},writable:{getWriter:()=>writer},async close(){}};
 const timers=new Map();let n=0;const ctx={document:{getElementById:get},navigator:{serial:{requestPort:async()=>port}},TextDecoder,TextEncoder,JSON,Number,Error,console,setTimeout(fn,ms){if(ms===600||ms===200||ms===6000||ms===20||ms===500||ms===1000||ms===150){queueMicrotask(fn);return ++n;}timers.set(++n,fn);if(dropFirst&&commands.length===0)queueMicrotask(fn);return n;},clearTimeout(id){timers.delete(id);}};
 vm.runInNewContext(source,ctx);return {get,commands,chunks,reset:()=>reset,signals:()=>signals};
}
test('camera identity checked before USB provisioning; credentials never leave USB',async()=>{
 const s=fixture();await s.get('usbConnect').onclick();assert.equal(s.get('save').disabled,false);assert.match(s.get('usbState').textContent,/NotCamera 0.2.1/);
 s.get('password').value='private-hotspot';s.get('token').value='z'.repeat(48);s.get('rules').value='x'.repeat(900)+'Antworten mit ä und ö';
 await s.get('setup').submit({preventDefault(){}});assert.equal(s.commands.length,2);assert.equal(s.commands[1].password,'private-hotspot');assert.equal(s.commands[1].token,'z'.repeat(48));assert.equal(s.commands[1].rules,'x'.repeat(900)+'Antworten mit ä und ö');assert(s.chunks.length>15&&s.chunks.every(n=>n<=64));assert.equal(s.get('password').value,'');assert.equal(s.get('token').value,'');assert(s.reset());
 // Only local USB code is shown, never the cloud bearer or hotspot password.
 assert(!s.get('usbState').textContent.includes('private-hotspot'));assert(!s.get('usbState').textContent.includes('z'.repeat(48)));
});
test('NotEkran or another serial device cannot receive camera credentials',async()=>{
 const s=fixture('NotEkran');await s.get('usbConnect').onclick();assert.equal(s.get('save').disabled,true);await s.get('setup').submit({preventDefault(){}});assert.equal(s.commands.length,1);
});

test('serial connection asserts DTR and releases RTS before requesting status',async()=>{
 const s=fixture();await s.get('usbConnect').onclick();assert.equal(s.signals().dataTerminalReady,true);assert.equal(s.signals().requestToSend,false);
});
test('an unanswered status request resets the camera over USB, then retries without sending credentials',async()=>{
 const s=fixture('NotCamera',true);await s.get('usbConnect').onclick();assert.equal(s.commands.length,2);assert.deepEqual({...s.signals()},{dataTerminalReady:false,requestToSend:false});assert(s.commands.every(c=>c.cmd==='status'));assert.equal(s.get('save').disabled,false);
});
test('single-frame diagnostic needs a verified camera and sends no secrets',async()=>{
 const s=fixture();await s.get('testCamera').onclick();assert.equal(s.commands.length,0);await s.get('usbConnect').onclick();await s.get('testCamera').onclick();assert.equal(JSON.stringify(s.commands[1]),'{"cmd":"test_camera"}');
});
function silent({openError,requestError,hangClose=false}={}){
 // A port that accepts the connection but never answers and never finishes writing/closing.
 const nodes=new Map();let filters;const get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,checked:true,addEventListener(name,fn){this[name]=fn;}});return nodes.get(id);};
 const never=()=>new Promise(()=>{});
 const reader={read:never,cancel:never,releaseLock(){}},writer={write:never,abort:never,releaseLock(){}};
 const port={async setSignals(){},async open(){if(openError)throw openError;},readable:{getReader:()=>reader},writable:{getWriter:()=>writer},close:hangClose?never:async()=>{}};
 const ctx={document:{getElementById:get},navigator:{serial:{requestPort:async o=>{filters=o&&o.filters;if(requestError)throw requestError;return port;}}},TextDecoder,TextEncoder,JSON,Number,Error,String,Promise,console,setTimeout(fn){queueMicrotask(fn);return 1;},clearTimeout(){}};
 vm.runInNewContext(source,ctx);return {get,filters:()=>filters};
}
test('boot or crash text received instead of a reply is shown, with the camera code masked',async()=>{
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,checked:true,addEventListener(n,f){this[n]=f;}});return nodes.get(id);};
 let pending=['ESP-ROM:esp32s3-20210327\nrst:0x15 (USB_UART_CHIP_RESET),boot:0x0 (DOWNLOAD(USB/UART0))\nwaiting for download\n{"device":"NotCamera","code":"secret12345678"'];
 let wake;const reader={async read(){while(!pending.length)await new Promise(r=>wake=r);return {value:new TextEncoder().encode(pending.shift()),done:false};},cancel:async()=>{},releaseLock(){}};
 const writer={write:async()=>{},releaseLock(){}},port={async setSignals(){},async open(){},readable:{getReader:()=>reader},writable:{getWriter:()=>writer},async close(){}};
 let fire=[];const ctx={document:{getElementById:get},navigator:{serial:{requestPort:async()=>port}},TextDecoder,TextEncoder,JSON,Number,Error,String,Promise,console,setTimeout(fn){fire.push(fn);queueMicrotask(()=>fire.shift()?.());return 1;},clearTimeout(){}};
 vm.runInNewContext(source,ctx);
 // The reset clears what was seen before it, so the log must arrive after the reset: queue it again when signals change.
 const setSignals=port.setSignals;port.setSignals=async v=>{if(v.requestToSend===false&&v.dataTerminalReady===false)pending=['rst:0x15 boot:0x0 (DOWNLOAD(USB/UART0))\nwaiting for download\n{"device":"NotCamera","code":"secret12345678"\n'];wake?.();return setSignals(v);};
 await get('usbConnect').onclick();const text=get('usbState').textContent;
 assert.match(text,/yükleme modunda/);assert.match(text,/waiting for download/);assert(!text.includes('secret12345678'));assert.equal(get('usbConnect').disabled,false);
});
test('a silent port reports no data and never leaves the find button disabled',async()=>{
 const s=silent({hangClose:true});await s.get('usbConnect').onclick();assert.equal(s.get('usbConnect').disabled,false);assert.match(s.get('usbState').textContent,/hiç veri gelmedi/);assert.equal(s.get('save').disabled,true);
});
test('only camera USB ports are offered, and a busy or missing port gets a specific hint',async()=>{
 let s=silent();await s.get('usbConnect').onclick();assert(s.filters().some(f=>f.usbVendorId===0x303a));
 s=silent({openError:Object.assign(Error('Failed to open serial port.'),{name:'NetworkError'})});await s.get('usbConnect').onclick();assert.match(s.get('usbState').textContent,/başka bir pencere/);assert.equal(s.get('usbConnect').disabled,false);
 s=silent({requestError:Object.assign(Error('No port selected by the user.'),{name:'NotFoundError'})});await s.get('usbConnect').onclick();assert.match(s.get('usbState').textContent,/USB JTAG\/serial debug unit/);
});
test('offline camera lists visible hotspots and saves the iPhone apostrophe spelling',async()=>{
 const s=fixture('NotCamera',false,{wifi:false,wifi_reason:201,ssid:"Haydar iPhone'u",automatic:false,camera_ready:true});await s.get('usbConnect').onclick();
 const text=s.get('usbState').textContent;assert.match(text,/bulunamadı/);assert.match(text,/Haydar iPhone’u · Komşu/);
 assert.equal(s.get('ssid').value,'Haydar iPhone’u');assert.equal(s.get('automatic').checked,false);
 s.get('ssid').value="Haydar iPhone'u ";s.get('password').value='private-hotspot';s.get('token').value='z'.repeat(48);
 await s.get('setup').submit({preventDefault(){}});const saved=s.commands.find(c=>c.cmd==='configure');assert.equal(saved.ssid,'Haydar iPhone’u');assert.equal(saved.automatic,false);
});
test('live view streams frames and re-checks the photo rules on them',async()=>{
 const s=fixture('NotCamera',false);await s.get('usbConnect').onclick();
 s.get('livePreview').onclick();for(let i=0;i<50;++i)await new Promise(r=>setImmediate(r));
 assert.equal(s.get('preview').src,'data:image/jpeg;base64,/9j/AA==');const m=s.get('metrics').textContent;
 assert.match(m,/✗ Parlaklık 40/);assert.match(m,/✗ Netlik/);assert.match(m,/✓ Yazı oranı/);assert.match(m,/ışık/);assert.match(m,/saniyede/);
 s.get('livePreview').onclick();for(let i=0;i<50;++i)await new Promise(r=>setImmediate(r));assert(s.commands.some(c=>c.cmd==='live_stop'));assert(s.commands.filter(c=>c.cmd==='live').length>1);assert.equal(s.commands.find(c=>c.cmd==='live').size,0);
});
test('mirror buttons toggle the saved camera orientation',async()=>{
 const s=fixture('NotCamera',false,{hmirror:true,vflip:false});await s.get('usbConnect').onclick();
 await s.get('mirrorH').onclick();await s.get('mirrorV').onclick();const sent=s.commands.filter(c=>c.cmd==='orient');
 assert.deepEqual(sent.map(c=>[c.hmirror,c.vflip]),[[false,false],[false,true]]);
});
test('manual photo: first press shoots and shows it, second press sends and follows it to NotEkran',async()=>{
 const s=fixture('NotCamera',false,{automatic:false});await s.get('usbConnect').onclick();assert.equal(s.get('sendPhoto').disabled,true);
 await s.get('shoot').onclick();assert.equal(s.get('preview').src,'data:image/jpeg;base64,/9j/HELD');assert.equal(s.get('sendPhoto').disabled,false);
 await s.get('sendPhoto').onclick();assert(s.commands.some(c=>c.cmd==='send'));assert.match(s.get('usbState').textContent,/NotEkran’da gösterildi/);
});
