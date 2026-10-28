import test from 'node:test';import assert from 'node:assert/strict';
import {contextDecision,pageInput,MAX_CONTEXT_PAGES} from '../functions/not-kamera-api/context.ts';
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
