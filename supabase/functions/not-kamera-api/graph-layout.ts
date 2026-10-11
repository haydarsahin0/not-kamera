import {labelWidth,validateDocument} from './answer.ts';
import {mathText} from './math-text.ts';

// Presentation-only adaptation. Never clamp data, delete a curve/tick, rescale
// an axis, or round a result. The unchanged native parser is the final contract.
export function prepareDocument(input){
 const doc=structuredClone(input);
 if(!Array.isArray(doc?.sections))return validateDocument(doc);
 const sections=[];
 for(const section of doc.sections){
  if(!Array.isArray(section?.graphs)){sections.push(section);continue;}
  const graphs=[],notes=[];
  for(const [sourceIndex,source] of section.graphs.entries()){
   const g=structuredClone(source),legend=[];
   if(!g||!Array.isArray(g.curves)||!Array.isArray(g.points)||!Array.isArray(g.x_ticks)||!Array.isArray(g.y_ticks)){graphs.push(g);continue;}
   const identity=s=>s.replace(/[₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹]/g,c=>String('₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)%10));
   const used=new Set([g.x_label,g.y_label,...g.curves.map(c=>c?.label),...g.points.map(p=>p?.label),...g.x_ticks.map(t=>t?.label),...g.y_ticks.map(t=>t?.label)].filter(s=>typeof s==='string').map(mathText).map(identity));
   const fits=(s,w)=>{try{return typeof s==='string'&&s.trim()&&!/[\r\n\t\0]/.test(s)&&new TextEncoder().encode(s).length<=48&&labelWidth(s)<=w;}catch{return false;}};
   function shortLabel(s,w,prefix){
    if(typeof s!=='string'||!s.trim()||s.includes('\0'))return s;
    s=mathText(s);if(fits(s,w))return s;
    // Keep the complete original label in an adjacent text page.
    for(const letter of [prefix,'V','A','B','D'])for(let i=1;i<=9;i++){
     const code=letter+i;if(used.has(identity(code))||!fits(code,w))continue;
     used.add(identity(code));legend.push(code+' = '+s.replace(/[\r\n\t]+/g,' '));return code;
    }
    return s; // Final validation/repair handles a genuinely impossible layout.
   }
   g.x_label=shortLabel(g.x_label,90,'X');g.y_label=shortLabel(g.y_label,90,'Y');
   for(const c of g.curves){if(!c)continue;c.label=shortLabel(c.label,64,'K');
    // The anchor is a label leader endpoint, not a financial data point.
    // Project it onto its own polyline; never move the polyline itself.
    if(!finitePoint(c.label_at)||!Array.isArray(c.points)||c.points.length<2||!c.points.every(finitePoint))continue;
    let nearest=null,distance=Infinity;
    for(let i=1;i<c.points.length;i++){
     const a=c.points[i-1],b=c.points[i],dx=b.x-a.x,dy=b.y-a.y;
     const t=Math.max(0,Math.min(1,((c.label_at.x-a.x)*dx+(c.label_at.y-a.y)*dy)/(dx*dx+dy*dy||1)));
     const p={x:a.x+t*dx,y:a.y+t*dy},d=Math.hypot(c.label_at.x-p.x,c.label_at.y-p.y);
     if(d<distance){distance=d;nearest=p;}
    }
    if(distance>4)c.label_at=nearest;
   }
   for(const p of g.points)if(p)p.label=shortLabel(p.label,64,'E');
   for(const t of g.x_ticks)if(t)t.label=shortLabel(t.label,42,'x');
   for(const t of g.y_ticks)if(t)t.label=shortLabel(t.label,26,'y');
   // Close ticks cannot be spread apart without falsifying the scale. Repeat
   // the identical drawing with separate tick groups instead, retaining every
   // original value at its original position. Neither axis is rescaled.
   const xs=tickGroups(g.x_ticks,34),ys=tickGroups(g.y_ticks,22),count=Math.max(xs.length,ys.length);
   if(legend.length){
    // Distinguish local legend codes when a task contains several diagrams.
    if(section.graphs.length>1&&typeof g.title==='string'){const suffix=' ['+(sourceIndex+1)+']';if(new TextEncoder().encode(g.title+suffix).length<=160)g.title+=suffix;else throw Error('Grafik düzeni doğrulanamadı (title_legend).');}
    notes.push(g.title+' — Beschriftung:\n'+legend.join('\n'));
   }
   for(let i=0;i<count;i++)graphs.push({...g,x_ticks:xs[i%xs.length],y_ticks:ys[i%ys.length]});
  }
  const body=typeof section.text==='string'?section.text:'';
  if(typeof section.text!=='string'){sections.push(section);continue;}
  // The firmware allows four drawings per section. Preserve overflow by using
  // additional sections with the same task number, never by truncating.
  if(!graphs.length)sections.push(section);
  else for(let i=0;i<graphs.length;i+=4)sections.push({...section,text:i===0?[body,...notes].filter(Boolean).join('\n\n'):'',graphs:graphs.slice(i,i+4)});
 }
 doc.sections=sections;
 return validateDocument(doc);
}
function finitePoint(p){return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100;}
function tickGroups(ticks,gap){
 if(!ticks.length)return [[]];
 if(ticks.some(t=>!t||!Number.isFinite(t.value)||t.value<0||t.value>100))return [ticks];
 if(ticks.length<=3&&ticks.every((t,i)=>ticks.slice(0,i).every(p=>Math.abs(p.value-t.value)>=gap)))return [ticks];
 const groups=[];
 for(const tick of [...ticks].sort((a,b)=>a.value-b.value)){
  let group=groups.find(g=>g.length<3&&g.every(t=>Math.abs(t.value-tick.value)>=gap));
  if(!group){group=[];groups.push(group);}group.push(tick);
 }
 return groups;
}
