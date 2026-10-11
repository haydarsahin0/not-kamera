import {GLYPH_METRICS} from './font-metrics.ts';
import {mathText} from './math-text.ts';
export const ANSWER_FORMAT='not-ekran-answer-v1';
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const string={type:'string'},number={type:'number'},point=object({x:number,y:number});
const array=items=>({type:'array',items});
const curve=object({label:string,points:array(point),label_at:point,dashed:{type:'boolean'}});
const graph=object({title:string,x_label:string,y_label:string,curves:array(curve),points:array(object({label:string,at:point})),arrows:array(object({from:point,to:point})),x_ticks:array(object({label:string,value:number})),y_ticks:array(object({label:string,value:number}))});
export const ANSWER_SCHEMA=object({format:{type:'string',enum:[ANSWER_FORMAT]},sections:array(object({task:string,text:string,graphs:array(graph)}))});
export const GRAPH_INSTRUCTIONS=`Gib die Lösung ausschließlich im vorgegebenen JSON-Schema aus, format="${ANSWER_FORMAT}". sections steht in Aufgabenreihenfolge; task enthält z.B. "Aufgabe 1) a)" und text nur die kurze fachliche Lösung, ohne wiederholte Überschrift. Wenn eine Zeichnung, Skizze oder grafische Darstellung verlangt wird, liefere tatsächlich mindestens ein graphs-Objekt; ersetze die verlangte Zeichnung niemals nur durch einen Text. Bei reinen Text-/Rechenfragen ist graphs leer. Ist eine Grafik wegen unlesbarer Angaben nicht bestimmbar, benenne dies knapp statt eine Grafik zu erfinden.
Ein graphs-Objekt ist eine fachliche 2D-Zeichnung für ein monochromes 200x200-Display. x und y sind normierte Positionen von 0 bis 100, y wächst nach oben. Diese Positionen sind NICHT die fachlichen Zahlenwerte. Setze konkrete Zahlenwerte nur als x_ticks/y_ticks-Labels. Wähle einen konsistenten Maßstab, bei mehreren Darstellungen desselben Zustands denselben Maßstab. Verwechsle relative Diagrammpositionen nicht mit Einheiten oder Ergebnissen. Bei rein qualitativen Aufgaben keine erfundenen Zahlenwerte. Beschrifte die Achsen mit kurzen Variablen wie Y, i, P, pi. Bei negativen Werten verschiebe den Nullpunkt passend und markiere ihn durch Ticks.
Pro Diagramm höchstens 3 Kurven, 3 markierte Punkte, 3 Pfeile und 3 Ticks je Achse. Für komplexere Darstellungen nutze mehrere klar betitelte Diagramme; kürze keine geforderte Kurve oder Teilaufgabe weg. Insgesamt höchstens 12 Diagramme, 4 je Abschnitt, 24 Abschnitte. Kurven bestehen aus 2–24 Punkten; gerade Linien aus 2 Punkten, gekrümmte Linien aus einigen Stützpunkten. label_at liegt auf der zugehörigen Kurve, möglichst fern von anderen Labels. Verwende kurze lesbare Kurven-/Punktlabels mit höchstens 5 Zeichen, z.B. IS₀, IS₁, LM, E₀, E₁. Benutze bei vielen Namen kurze Kürzel und erkläre sie knapp in text. Keine abgeschnittenen oder versteckten Beschriftungen. Punkte und Kurven müssen fachlich zusammenpassen: Gleichgewichte liegen auf den zutreffenden Schnittpunkten; Verschiebungen zeigen die richtige Richtung. Prüfe dies intern.
Platziere Punktlabels und Kurvenanker mit genügend Abstand; markierte Punkte liegen möglichst zwischen 10 und 90. Alte Kurven dürfen gestrichelt sein (dashed=true), neue durchgezogen. Pfeile from->to stellen nur gefragte Bewegungen/Verschiebungen dar. Ticks sind optional; y_ticks-Labels höchstens 2 Zeichen und 22 Positionseinheiten voneinander entfernt, x_ticks-Labels höchstens 3 Zeichen und 34 Positionseinheiten voneinander entfernt. Keine dichten Zahlenreihen. Titel kurz und eindeutig (z.B. "IS-LM: G steigt"). Keine LaTeX-Strings, Markdown, ASCII-Bilder oder SVG-Code. Beschreibe im Text nur die verlangte Begründung oder notwendige Zeichnungserklärung; eine echte Grafik wird durch die Zeicheninformationen erstellt.`;

export function labelWidth(s){let x=0,extent=0;for(const ch of s.normalize('NFC')){const g=GLYPH_METRICS[ch.codePointAt(0)];if(!g)throw Error('Nicht unterstütztes Grafikzeichen.');extent=Math.max(extent,x+g[1]+g[2]);x+=g[0];}return Math.max(x,extent);}
const fail=()=>{throw Error('Grafikdaten sind ungültig oder auf dem kleinen Display nicht lesbar.');};
function text(s,max,empty=true){if(typeof s!=='string')fail();s=mathText(s);if(new TextEncoder().encode(s).length>max||s.includes('\0')||(!empty&&!s.trim()))fail();return s;}
function label(s,max){s=text(s,48,false);if(/[\r\n\t]/.test(s)||labelWidth(s)>max)fail();return s;}
function list(a,min,max){if(!Array.isArray(a)||a.length<min||a.length>max)fail();return a;}
function coordinate(n){if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>100)fail();return n;}
function position(p){if(!p||typeof p!=='object')fail();coordinate(p.x);coordinate(p.y);return p;}
const px=x=>34+Math.round(x*140/100),py=y=>145-Math.round(y*97/100);
function collision(a,b){return a.x<b.x+b.w+3&&a.x+a.w+3>b.x&&a.y<b.y+b.h+3&&a.y+a.h+3>b.y;}
function crosses(b,curves){for(const c of curves)for(let i=1;i<c.points.length;i++){const x=px(c.points[i-1].x),y=py(c.points[i-1].y),dx=px(c.points[i].x)-x,dy=py(c.points[i].y)-y;let t0=0,t1=1,hit=true;const p=[-dx,dx,-dy,dy],q=[x-b.x+2,b.x+b.w+2-x,y-b.y+2,b.y+b.h+2-y];for(let j=0;j<4;j++){if(p[j]===0){if(q[j]<0){hit=false;break;}}else{const t=q[j]/p[j];if(p[j]<0)t0=Math.max(t0,t);else t1=Math.min(t1,t);if(t0>t1){hit=false;break;}}}if(hit)return true;}return false;}
function place(s,at,boxes,curves){const w=labelWidth(s),h=22,ax=px(at.x),ay=py(at.y);let winner=null,best=1000000;
 const consider=(x,y)=>{const b={x,y,w,h};if(b.x<36||b.y<41||b.x+w>194||b.y+h>143||boxes.some(old=>collision(b,old)))return;const score=(x+Math.trunc(w/2)-ax)**2+(y+Math.trunc(h/2)-ay)**2+(crosses(b,curves)?100000:0);if(score<best){winner=b;best=score;}};
 for(const [dx,dy] of [[5,-h-3],[5,4],[-w-5,-h-3],[-w-5,4],[-Math.trunc(w/2),-h-8],[-Math.trunc(w/2),8],[9,-Math.trunc(h/2)],[-w-9,-Math.trunc(h/2)]])consider(ax+dx,ay+dy);
 for(let y=41;y+h<=143;y+=4)for(let x=36;x+w<=194;x+=4)consider(x,y);if(winner){boxes.push(winner);return true;}return false;}
export function validateDocument(doc){
 if(!doc||doc.format!==ANSWER_FORMAT)fail();let total=0;
 for(const section of list(doc.sections,1,24)){
  section.task=text(section.task,160,false);section.text=text(section.text,65536);list(section.graphs,0,4);
  if(!section.text.trim()&&!section.graphs.length)fail();
  for(const g of section.graphs){
   if(++total>12)fail();g.title=text(g.title,160,false);g.x_label=label(g.x_label,90);g.y_label=label(g.y_label,90);
   for(const c of list(g.curves,1,3)){c.label=label(c.label,64);position(c.label_at);list(c.points,2,24).forEach(position);if(typeof c.dashed!=='boolean')fail();
    // A label anchor belongs on its curve, not on an unrelated diagram area.
    let distance=Infinity;for(let i=1;i<c.points.length;i++){let a=c.points[i-1],b=c.points[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((c.label_at.x-a.x)*dx+(c.label_at.y-a.y)*dy)/(dx*dx+dy*dy||1)));distance=Math.min(distance,Math.hypot(c.label_at.x-a.x-t*dx,c.label_at.y-a.y-t*dy));}if(distance>4)fail();
   }
   for(const m of list(g.points,0,3)){m.label=label(m.label,64);position(m.at);}
   for(const a of list(g.arrows,0,3)){position(a.from);position(a.to);if(a.from.x===a.to.x&&a.from.y===a.to.y)fail();}
   for(const [ticks,max,gap] of [[g.x_ticks,42,34],[g.y_ticks,26,22]]){list(ticks,0,3);for(let i=0;i<ticks.length;i++){ticks[i].label=label(ticks[i].label,max);coordinate(ticks[i].value);if(ticks.slice(0,i).some(t=>Math.abs(t.value-ticks[i].value)<gap))fail();}}
   const boxes=g.points.map(m=>({x:px(m.at.x)-4,y:py(m.at.y)-4,w:9,h:9}));g.points.forEach((m,i)=>{if(!place(m.label,m.at,boxes,g.curves)&&!place('E'+(i+1),m.at,boxes,g.curves))fail();});g.curves.forEach((c,i)=>{if(!place(c.label,c.label_at,boxes,g.curves)&&!place('C'+(i+1),c.label_at,boxes,g.curves))fail();});
  }
 }
 const s=JSON.stringify(doc);if(new TextEncoder().encode(s).length>65536)throw Error('Cevap ekran kapasitesini aştı; metin kesilmedi.');return s;
}
export function readDocument(answer){if(typeof answer!=='string'||!answer.trimStart().startsWith('{'))return null;try{const d=JSON.parse(answer);return d.format===ANSWER_FORMAT?d:null;}catch{return null;}}
export function plainAnswer(answer){const doc=readDocument(answer);if(!doc)return answer;
 return doc.sections.map(s=>[s.task,s.text,...s.graphs.map(g=>'Grafik: '+g.title+'\nAchsen: '+g.x_label+', '+g.y_label+'\nKurven: '+g.curves.map(c=>c.label).join(', ')+'\n[Die Zeichnung wird auf dem Gerät ab Version 0.8.0 angezeigt.]')].filter(Boolean).join('\n')).join('\n\n');
}
