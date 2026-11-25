/* Original supplemental clinical questions, informed by Wits format and student Paper 1 recollections.
   These are not official Wits questions or a reproduction of lecture slides. See local STGs/EML:
   https://www.health.gov.za/nhi-edp-stgs-eml/ ; https://www.sahivsoc.org/Guidelines/Index */
(function(){
"use strict";
const rows=window.MED_P2_EXPANSION_ROWS||[],more=window.MED_P2_EXPANSION_EXTRA||{};
const subjects=window.MED_PAPER_GROUPS?.papers?.find(p=>p.paper==="Paper 2")?.subjects||[];
const sprint=window.MED_P2_SPRINT||[];
const cases=[];
let sbaIndex=0;
function make(line,number){
 const [kind,q,...values]=line;
 if(kind==="V"){const [answer,...accepted]=values[0].split(";");return {number,type:"VSAQ",q,answer,accepted,options:[],explain:values[1],skill:"Applied very short answer"};}
 const parsed=values.map(v=>{const i=v.indexOf("~");if(i<=0)throw Error("Invalid Paper 2 distractor");return {option:v.slice(0,i),why:v.slice(i+1)};});
 if(parsed.length!==4)throw Error("Invalid Paper 2 option count");
 // Stable balanced answer positions. Vary order in blocks of four, never sort by option length.
 const permutations=[[2,0,3,1],[1,3,0,2],[3,1,2,0],[0,2,1,3],[2,3,1,0],[1,0,2,3],[3,2,0,1]];
 const k=sbaIndex++,pos=permutations[Math.floor(k/4)%permutations.length][k%4],order=[1,2,3];
 if(k%2)order.reverse();if(k%3===0)order.push(order.shift());order.splice(pos,0,0);
 return {number,type:"SBA",q,options:order.map(i=>parsed[i].option),answer:"ABCD"[pos],whyOptions:order.map(i=>parsed[i].why),explain:parsed[0].why,skill:kind==="D"?"Data interpretation":"Applied biomedical / clinical reasoning",isData:kind==="D"};
}
rows.forEach((r,i)=>{
 const original=sprint.find(c=>c.core===r.name),subject=subjects.find(s=>s.conditions.includes(r.name));
 if(!original||!subject)throw Error("Unmapped Paper 2 condition: "+r.name);
 const lines=r.lines.concat(more[r.name]||[]);
 // Keep data interpretation labelled explicitly and short answers together, without a fixed cluster length.
 const questions=[...lines.filter(l=>l[0]!=="V"),...lines.filter(l=>l[0]==="V")].map((l,j)=>make(l,j+1));
 cases.push({id:6000+i,title:"Applied clinical case · "+r.name,core:r.name,module:original.module,scenario:r.scenario,questions,difficulty:"Challenge",source:"Original supplemental GEMP1 practice, adapted to Wits case-cluster format and reported Paper 1 themes; not official exam questions",paper2Only:true,expansion:true});
});
window.MED_P2_EXPANSION=cases;
window.MED_EXTRA=(window.MED_EXTRA||[]).concat(cases);
for(const n of (window.MED_NOTES||[])){const c=cases.find(c=>c.core===n.name);if(c)n.expansionClusterId=c.id;}
})();