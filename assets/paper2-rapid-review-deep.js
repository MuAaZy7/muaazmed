/* Expanded Paper 2 rapid review, drawing on existing MuaazMed core notes, deep cards, and case-based explanations. Student-authored revision, not official paper questions. */
(function () {
"use strict";
const synonyms = {
"acute kidney injury (aki)":"acute kidney injury",
"chronic kidney disease (ckd)":"chronic kidney disease",
"nephritic syndrome":"nephritic syndrome",
"nephrotic syndrome":"nephrotic syndrome",
"renal calculi (urolithiasis)":"renal calculi",
"severe acute malnutrition (sam)":"severe acute malnutrition",
"diarrhoea - clinical approach":"diarrhoea",
"shigellosis (bacillary dysentery)":"shigellosis",
"irritable bowel syndrome (ibs)":"irritable bowel syndrome",
"gastro-oesophageal reflux disease (gord)":"gastroesophageal reflux disease",
"peptic ulcer disease (pud)":"peptic ulcer disease",
"upper gastrointestinal bleed (ugib)":"upper gi bleed",
"ulcerative colitis (uc)":"ulcerative colitis",
"colorectal cancer (crc)":"colorectal cancer",
"gallstones and biliary colic":"gallstones",
"acute cholecystitis":"cholecystitis",
"acute pancreatitis":"pancreatitis",
"closed long-bone fractures":"fractures (long bone, closed)",
"anterior cruciate ligament (acl) injury":"anterior cruciate ligament injury",
"vitamin d deficiency (rickets/osteomalacia)":"vitamin d deficiency",
"osteoarthritis (oa)":"osteoarthritis",
"rheumatoid arthritis (ra)":"rheumatoid arthritis",
"bone tumour - osteosarcoma":"bone tumour (osteosarcoma)",
"iron-deficiency anaemia":"iron deficiency anaemia",
"von willebrand disease (vwd)":"von willebrand disease",
"disseminated intravascular coagulation (dic)":"disseminated intravascular coagulation",
"liver cirrhosis":"liver cirrhosis"
};
const normal = s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[’‘]/g,"'").replace(/[‐‑–—]/g,"-").replace(/\s+/g," ").trim();
const canonical = s=>synonyms[normal(s)]||normal(s);
const escape = s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const notes=Array.isArray(window.MED_NOTES)?window.MED_NOTES:[];
const cards=Array.isArray(window.MED_FLASHCARD_EXTENDED)?window.MED_FLASHCARD_EXTENDED:[];
const cases=Array.isArray(window.MED_EXTRA)?window.MED_EXTRA:[];
const noteMap=new Map(notes.map(x=>[canonical(x.name),x]));
const cardMap=new Map(cards.map(x=>[canonical(x.name),Array.isArray(x.cards)?x.cards:[]]));
const caseMap=new Map();
for(const c of cases){const names=Array.isArray(c.core)?c.core:[c.core];for(const name of names){if(!name)continue;const k=canonical(name);if(!caseMap.has(k))caseMap.set(k,[]);caseMap.get(k).push(c)}}
const containers=[...document.querySelectorAll(".condition")];
let matched=0, totalCards=0, totalCases=0;
for(const condition of containers){
 const summary=condition.querySelector("summary b");
 const body=condition.querySelector(".inside");
 if(!summary||!body)continue;
 const label=summary.textContent.trim(),key=canonical(label);
 const core=noteMap.get(key),deep=cardMap.get(key)||[],clinical=caseMap.get(key)||[];
 const panel=document.createElement("div");panel.className="expanded-notes";
 let inner="<div class='expanded-heading'><strong>DEEP REVIEW — NOT JUST BUZZWORDS</strong><small>Core science · investigations · safety · applied reasoning</small></div>";
 if(core){
 matched++;
 const sections=[
 ["Clinical presentation and discriminating signs",core.presentation,core.clues],
 ["Mechanism: connect physiology and pathology",core.mechanism,core.memory],
 ["Investigations and interpretation",core.tests,core.differentiate],
 ["Red flags and safest first step",core.safety,null]
 ];
 inner+="<div class='note-detail-grid'>"+sections.map(([heading,a,b])=>"<article class='note-detail'><h4>"+escape(heading)+"</h4>"+(a?"<p>"+escape(a)+"</p>":"")+(b?"<p>"+escape(b)+"</p>":"")+"</article>").join("")+"</div>";
 if(core.vsaq)inner+="<div class='deep-vsaq'><b>Likely VSAQ-style prompt:</b> "+escape(core.vsaq)+" <details><summary>Reveal model answer</summary><p>"+escape(core.answer)+"</p></details></div>";
 }
 if(deep.length){
 totalCards+=deep.length;
 inner+="<details class='deep-set'><summary><b>"+deep.length+" deeper clinical flashcards</b><span>Foundations, investigations, data interpretation, treatment, red flags</span></summary><div class='quiz-set'>"+
 deep.map((c,i)=>"<article class='quiz-item'><div class='quiz-meta'>"+escape(c.skill||"Recall")+" · "+(i+1)+"/"+deep.length+"</div><div class='question'>"+escape(c.front)+"</div><details><summary>Reveal explanation / answer</summary><p>"+escape(c.back)+"</p></details></article>").join("")+"</div></details>";
 }
 if(clinical.length){
 const best=clinical.slice(0,2);totalCases+=best.length;
 inner+="<details class='deep-set'><summary><b>"+best.length+" integrated case cluster"+(best.length!==1?"s":"")+"</b><span>Unfold the clinical stem, MCQ/VSAQ reasoning and examiner traps</span></summary>"+
 best.map(c=>"<section class='case-review'><h4>"+escape(c.title||"Integrated clinical case")+"</h4><p class='clinical-stem'>"+escape(c.scenario||"")+"</p>"+
 (Array.isArray(c.questions)?c.questions.slice(0,9):[]).map((q,i)=>{
 const opts=Array.isArray(q.options)?q.options:[],abc=["A","B","C","D"],ans=q.answer;
 return "<div class='case-q'><div class='quiz-meta'>Question "+(i+1)+" · "+escape(q.type||"SBA")+" · "+escape(q.skill||"Clinical reasoning")+"</div><strong>"+escape(q.q||"")+"</strong>"+(opts.length?"<ol class='choices' type='A'>"+opts.map(o=>"<li>"+escape(o)+"</li>").join("")+"</ol>":"")+"<details><summary>Show answer and reasoning</summary><p><b>Answer:</b> "+escape(ans)+"</p>"+(q.explain?"<p>"+escape(q.explain)+"</p>":"")+(q.point?"<p><b>Exam pearl:</b> "+escape(q.point)+"</p>":"")+"</details></div>";
 }).join("")+"</section>").join("")+"</details>";
 }
 if(!core&&!deep.length&&!clinical.length)inner+="<p class='small-muted'>This condition's expanded source bank has no direct matching entry. Use the condition-level pearls above and the illustrated Word study guide.</p>";
 panel.innerHTML=inner;
 body.appendChild(panel);
}
const facts=document.getElementById("depth-facts");if(facts)facts.textContent=matched+" expanded condition notes · "+totalCards+" deep flashcards · "+totalCases+" linked case clusters";
const expand=document.getElementById("expand-conditions");if(expand)expand.addEventListener("click",()=>{const hidden=[...document.querySelectorAll(".condition:not(.hidden)")];const openAny=hidden.some(c=>!c.open);for(const c of hidden)c.open=openAny;expand.textContent=openAny?"Collapse visible conditions":"Expand visible conditions";});
})();