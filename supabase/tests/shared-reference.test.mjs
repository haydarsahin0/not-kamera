import test from 'node:test';import assert from 'node:assert/strict';
import {contextDecision,pageInput,MAX_CONTEXT_PAGES,CONTEXT_INSTRUCTIONS} from '../functions/not-kamera-api/context.ts';
test('reference and recent photos share bounded, unique 1-based context indices',()=>{
 const pages=Array.from({length:8},(_,i)=>({mime:'image/png',image_base64:'YQ==',reference_page:i<2}));
 const input=pageInput({course:'Produktion und Logistik'},pages[0],pages)[0].content;
 assert.equal(MAX_CONTEXT_PAGES,8);assert.equal(input.filter(x=>x.type==='input_image').length,9);
 assert.match(input.at(-2).text,/AKTUELLE SEITE/);
 assert.deepEqual(contextDecision({decision:'uses_previous',used_pages:[1,8],reference_page:false},8).used_pages,[1,8]);
 for(const value of [
  {decision:'independent',used_pages:[1],reference_page:false},
  {decision:'uses_previous',used_pages:[9],reference_page:false},
  {decision:'uses_previous',used_pages:[1,1],reference_page:false},
  {decision:'independent',used_pages:[],reference_page:'true'}
 ])assert.throws(()=>contextDecision(value,8));
 assert.throws(()=>pageInput({},pages[0],[...pages,pages[0]]));
});

test('four crops keep every original image in order and allow a continued question',()=>{
 const pages=['YQ==','Yg==','Yw=='].map(image_base64=>({mime:'image/jpeg',image_base64}));
 const c=pageInput({course:'Unternehmensführung und Organisation'},{mime:'image/jpeg',image_base64:'ZA=='},pages)[0].content;
 assert.deepEqual(c.filter(p=>p.type==='input_image').map(p=>p.image_url.split(',')[1]),['YQ==','Yg==','Yw==','ZA==']);
 assert.deepEqual(contextDecision({decision:'uses_previous',used_pages:[1,2,3],reference_page:false},3).used_pages,[1,2,3]);
 for(const rule of ['MEHRERE FOTOAUSSCHNITTE','ALLE benötigten','Falltext erfasst.','Überlappende Passagen nur einmal','Frage selbst auf zwei Fotos'])assert(CONTEXT_INSTRUCTIONS.includes(rule));
});
