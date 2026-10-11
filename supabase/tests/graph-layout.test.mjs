import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {prepareDocument} from '../functions/not-kamera-api/graph-layout.ts';
import {validateDocument} from '../functions/not-kamera-api/answer.ts';
const fixture=JSON.parse(await fs.readFile(new URL('../../firmware/tests/graph-fixture.json',import.meta.url),'utf8'));
const one=()=>({format:fixture.format,sections:[structuredClone(fixture.sections[0])]});
test('already valid graph data and input objects stay unchanged',()=>{
 const before=structuredClone(fixture);assert.deepEqual(JSON.parse(prepareDocument(fixture)),before);assert.deepEqual(fixture,before);
});
test('wide labels, off-curve leaders and dense ticks retain all geometry and exact original values',async()=>{
 const doc=one(),g=doc.sections[0].graphs[0];
 g.curves[0].label='IS vor der Staatsausgabenerhöhung';g.curves[0].label_at={x:90,y:90};
 g.points[0].label='Ausgangsgleichgewicht';g.y_label='Preisniveau in Geldeinheiten';
 g.x_ticks=[{label:'10000',value:30},{label:'10001',value:31},{label:'10002',value:32}];
 g.y_ticks=[{label:'1200',value:45},{label:'1400',value:46},{label:'1600',value:47}];
 assert.throws(()=>validateDocument(structuredClone(doc)));
 const result=JSON.parse(prepareDocument(doc));assert.equal(result.sections[0].graphs.length,3);
 for(const graph of result.sections[0].graphs){
  assert.deepEqual(graph.curves.map(c=>c.points),g.curves.map(c=>c.points));assert.deepEqual(graph.points.map(p=>p.at),g.points.map(p=>p.at));assert.deepEqual(graph.arrows,g.arrows);
  assert(graph.curves[0].label_at.x+graph.curves[0].label_at.y===90);
 }
 assert.deepEqual(result.sections[0].graphs.flatMap(x=>x.x_ticks.map(t=>t.value)),[30,31,32]);
 assert.deepEqual(result.sections[0].graphs.flatMap(x=>x.y_ticks.map(t=>t.value)),[45,46,47]);
 for(const original of [g.curves[0].label,g.points[0].label,g.y_label,'10000','10001','10002','1200','1400','1600'])assert(result.sections[0].text.includes(original));
 assert.deepEqual(JSON.parse(prepareDocument(result)),result);
 // Consumed by the C++ native parser/raster regression, not a JS mock.
 await fs.writeFile('/tmp/not-layout-regression.json',JSON.stringify(result));
});
test('aliases avoid collisions and same-named drawings have distinct legend identities',()=>{
 const doc=one(),g=doc.sections[0].graphs[0];g.curves[0].label='y₁';g.y_ticks=[{label:'1200',value:40}];
 doc.sections[0].graphs.push(structuredClone(g));doc.sections[0].graphs[1].y_ticks[0].label='1400';
 const result=JSON.parse(prepareDocument(doc)),graphs=result.sections[0].graphs;
 assert.equal(graphs[0].y_ticks[0].label,'y2');assert.match(result.sections[0].text,/y2 = 1200/);assert.match(result.sections[0].text,/y2 = 1400/);
 assert.notEqual(graphs[0].title,graphs[1].title);assert(result.sections[0].text.includes(graphs[0].title));assert(result.sections[0].text.includes(graphs[1].title));
});
test('invalid coordinates, missing arrays and too many required drawings are never silently dropped',()=>{
 const doc=one();doc.sections[0].graphs[0].curves[0].points[0].x=-1;assert.throws(()=>prepareDocument(doc),/coordinate_0_100/);
 const missing=one();delete missing.sections[0].graphs[0].x_ticks;assert.throws(()=>prepareDocument(missing));
 const many=one();const g=many.sections[0].graphs[0];g.y_ticks=[{label:'120',value:20},{label:'130',value:21},{label:'140',value:22}];many.sections[0].graphs=Array.from({length:5},()=>structuredClone(g));assert.throws(()=>prepareDocument(many));
});
