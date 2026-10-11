import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {mathText} from '../functions/not-kamera-api/math-text.ts';
import {validateDocument,readDocument,labelWidth} from '../functions/not-kamera-api/answer.ts';
const cases=JSON.parse(await fs.readFile(new URL('../../firmware/tests/math-text-fixture.json',import.meta.url),'utf8'));
test('mathematical typography preserves meaning, unsupported notation and ordinary words',()=>{
 for(const [input,output] of cases){assert.equal(mathText(input),output,input);assert.equal(mathText(output),output);}
 assert.equal(mathText('W'.repeat(65536)),'W'.repeat(65536));
});
test('text and graph labels are normalized before pixel/byte validation',async()=>{
 const doc=JSON.parse(await fs.readFile(new URL('../../firmware/tests/graph-fixture.json',import.meta.url),'utf8'));
 doc.sections[0].text='y^2 = 4; Y_{t+1} = 120; π ≤ √(x).';
 const graph=doc.sections[0].graphs[0];graph.x_label='Y_0';graph.curves[0].label='IS_0';
 const result=readDocument(validateDocument(doc));
 assert.equal(result.sections[0].text,'y² = 4; Yₜ₊₁ = 120; π ≤ √(x).');
 assert.equal(result.sections[0].graphs[0].x_label,'Y₀');
 assert.equal(result.sections[0].graphs[0].curves[0].label,'IS₀');
 for(const s of ['⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿⁱ','₀₁₂₃₄₅₆₇₈₉ₜ₊₁','Δπ√∑∫≤≥≠×÷'])assert(Number.isFinite(labelWidth(s)));
});
