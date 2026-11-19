(function(){
"use strict";
const root=document.getElementById("cp-app");
const STORE="muaazmed-blind-clusters-v1";
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const tidy=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g," ").trim();
const papers=window.MED_PAPER_GROUPS?.papers||[];
const second=papers.find(x=>x.paper==="Paper 2");
const paper2Names=new Set((second?.subjects||[]).flatMap(s=>s.conditions.map(tidy)));
const maps={16:["Anaphylaxis","Anaphylactic Shock"],35:["HIV/AIDS","Oral Candidiasis"],2:["Sepsis"],17:["Sepsis"],12:["Cardiac Arrhythmia"],32:["Congestive Cardiac Failure"],1:["Ischaemic Heart Disease"],13:["Pulmonary Embolism"],3:["Shock"],26:["Asthma"],33:["Chronic Obstructive Pulmonary Disease (COPD)"],11:["Pneumonia"],7:["Tuberculosis"],5:["Acute Kidney Injury"],34:["Nephritic syndrome","Nephrotic syndrome"],23:["Renal Calculi"],19:["Liver Cirrhosis","Ascites"],14:["Liver Cirrhosis"],6:["Upper GI Bleed","Peptic Ulcer Disease"],20:["Aplastic Anaemia"],10:["Iron Deficiency Anaemia"],27:["Stroke"]};
const raw=[...(window.MED_BANK||[]),...(window.MED_EXTRA||[]),...(window.MED_INTEGRATED_CASES||[])];
const seen=new Set();
const fromSite=raw.filter(c=>{
  const names=Array.isArray(c.core)?c.core:(c.core?[c.core]:(maps[c.id]||[c.title]));
  const suitable=names.some(n=>paper2Names.has(tidy(n)))||(!c.core&&["Renal","GIT","MSK","Haem/Onc"].includes(c.module));
  if(!suitable||seen.has(String(c.id)))return false;
  seen.add(String(c.id));return true;
}).map(c=>({
  id:"site-"+c.id,scenario:c.scenario||"",source:c.source||"MuaazMed existing practice bank",questions:(c.questions||[]).filter(q=>q&&q.q&&q.answer&&((Array.isArray(q.options)&&q.options.length===4&&/^[ABCD]$/.test(String(q.answer)))||!Array.isArray(q.options)||q.options.length===0)).map((q,i)=>({
    number:q.number||i+1,q:q.q,type:Array.isArray(q.options)&&q.options.length===4?"SBA":"VSAQ",
    options:Array.isArray(q.options)&&q.options.length===4?q.options:undefined,answer:String(q.answer),
    accepted:Array.isArray(q.accepted)?q.accepted:[],explain:q.explain||q.point||"Review the correct answer and clinical reasoning.",
    whyOptions:q.whyOptions,point:q.point
  }))
})).filter(c=>c.scenario&&c.questions.length);
const pool={"Paper 1":(window.MED_PDF_PAPER1||[]).filter(c=>c.questions?.length),"Paper 2":fromSite};
let db={active:"Paper 1",randomize:false,sessions:{},showAll:false};
try{const x=JSON.parse(localStorage.getItem(STORE)||"null");if(x&&typeof x==="object")db={...db,...x,sessions:x.sessions||{}};}catch(_){}
if(!pool[db.active])db.active="Paper 1";
function save(){try{localStorage.setItem(STORE,JSON.stringify(db));}catch(_){}} 
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function session(){const x=db.sessions[db.active];return x&&Array.isArray(x.order)&&x.order.length?x:null;}
function makeSession(randomize=db.randomize){const order=pool[db.active].map((_,i)=>i);if(randomize)shuffle(order);db.sessions[db.active]={order,pos:0,q:0,answers:{},finished:false,created:Date.now(),randomize};db.randomize=randomize;save();render();}
function current(s){const c=pool[db.active][s.order[s.pos]];return {c,q:c?.questions[s.q],key:c?c.id+":"+(s.q):""};}
function score(s){const a=Object.values(s.answers||{});return {answered:a.length,correct:a.filter(x=>x.correct).length};}
function totalFor(p){return pool[p].reduce((n,c)=>n+c.questions.length,0);}
function statCard(p){const s=db.sessions[p],count=pool[p].length,done=s?score(s):{answered:0,correct:0};return '<div class="cp-stat"><strong>'+count+'</strong><span>Case clusters</span></div><div class="cp-stat"><strong>'+totalFor(p)+'</strong><span>Practice questions</span></div><div class="cp-stat"><strong>'+done.answered+'</strong><span>Answered this session</span></div><div class="cp-stat"><strong>'+(done.answered?Math.round(done.correct/done.answered*100)+"%":"—")+'</strong><span>Session accuracy</span></div>';}
function landing(){
 const p=db.active,s=session(),cases=pool[p],visible=db.showAll?cases:cases.slice(0,42);
 root.innerHTML='<div class="cp-hero"><a class="cp-back" href="index.html#practice">← All practice questions</a><div class="cp-overline">GEMP1 · EXAM PREP</div><h1>Blind case cluster practice</h1><p>Work through complete clinical cases without being told the diagnosis. Choose a paper, answer each SBA or VSAQ, and get instant feedback before moving on.</p></div>'+
 '<div class="cp-tabs" role="group" aria-label="Select exam paper"><button data-act="paper" data-paper="Paper 1" class="'+(p==="Paper 1"?"selected":"")+'">Paper 1</button><button data-act="paper" data-paper="Paper 2" class="'+(p==="Paper 2"?"selected":"")+'">Paper 2</button></div>'+
 '<div class="cp-stats">'+statCard(p)+'</div>'+
 '<section class="cp-config"><div><h2>'+esc(p)+' · Case clusters</h2><p>'+(p==="Paper 1"?"All 336 questions and answer explanations imported from the uploaded BCMH, CVS and Respiratory practice PDF.":"Cases from MuaazMed’s existing Renal, GIT, MSK and Haem/Onc question bank; the uploaded PDF only covers Paper 1.")+'</p><label class="cp-toggle"><input type="checkbox" id="cp-shuffle" '+(db.randomize?"checked":"")+'> Randomise cluster order</label></div><div class="cp-actions"><button class="cp-primary" data-act="start">Start new practice →</button>'+(s?'<button class="cp-secondary" data-act="continue">Continue session ('+score(s).answered+' answered)</button>':"")+'</div></section>'+
 '<div class="cp-list-head"><h2>Choose any cluster</h2><span>Condition titles hidden until you review the answer</span></div>'+
 '<div class="cp-grid">'+visible.map((c,i)=>'<button class="cp-cluster" data-act="open" data-idx="'+i+'"><span class="cp-cluster-number">CLUSTER '+String(i+1).padStart(2,"0")+'</span><strong>Clinical case</strong><small>'+c.questions.length+' questions · SBA + short answers</small><span class="cp-cluster-cta">Practise cluster →</span></button>').join("")+'</div>'+
 (cases.length>visible.length?'<button class="cp-secondary cp-more" data-act="more">Show all '+cases.length+' clusters</button>':"")+
 '<p class="cp-note">Study-paper groupings are for revision, not a guarantee of Wits examination allocation. All questions are educational practice, not official Wits past-paper questions. Progress is saved on this device.</p>';
}
function answerRecord(value){const s=session();if(!s||s.finished)return;const {q,key}=current(s);if(!q||Object.hasOwn(s.answers,key))return;const given=String(value||"").trim();if(!given)return;const target=tidy(q.answer);const aliases=[q.answer,...(q.accepted||[])].map(tidy);const correct=q.type==="SBA"?given===q.answer:aliases.includes(tidy(given));s.answers[key]={given,correct,time:Date.now()};save();render();}
function next(delta){const s=session();if(!s)return;const item=current(s);if(delta>0&&!Object.hasOwn(s.answers,item.key))return;let pos=s.pos,q=s.q+delta;if(q>=pool[db.active][s.order[pos]].questions.length){pos++;q=0;}if(q<0){pos--;if(pos>=0)q=pool[db.active][s.order[pos]].questions.length-1;}if(pos<0)return;if(pos>=s.order.length){s.finished=true;save();render();return;}s.pos=pos;s.q=q;save();render();}
function review(){
 const s=session(),a=score(s),missed=[];for(const idx of s.order){const c=pool[db.active][idx];c.questions.forEach((q,i)=>{const x=s.answers[c.id+":"+i];if(x&&!x.correct)missed.push({c,idx,q,i,x});});}
 root.innerHTML='<div class="cp-hero"><a href="#" class="cp-back" data-act="home">← Back to clusters</a><div class="cp-overline">'+esc(db.active)+'</div><h1>Practice complete</h1><p>Every mistake is a revision opportunity. Review the feedback below, or start a fresh shuffled run.</p></div><div class="cp-stats"><div class="cp-stat"><strong>'+a.correct+'</strong><span>Correct</span></div><div class="cp-stat"><strong>'+a.answered+'</strong><span>Answered</span></div><div class="cp-stat"><strong>'+Math.round(a.correct/Math.max(1,a.answered)*100)+'%</strong><span>Accuracy</span></div><div class="cp-stat"><strong>'+missed.length+'</strong><span>To revise</span></div></div><div class="cp-actions"><button class="cp-primary" data-act="start" data-random="yes">Practise again · shuffled</button><button class="cp-secondary" data-act="home">Back to clusters</button></div>'+
 '<section class="cp-review"><h2>Questions to revisit</h2>'+(missed.length?missed.map(x=>'<article><strong>'+esc(x.q.q)+'</strong><p>Your answer: '+esc(x.x.given)+'</p><p>Correct answer: <b>'+esc(correctLabel(x.q))+'</b></p><p>'+esc(x.q.explain)+'</p></article>').join(""):'<p>No incorrect answers in this session.</p>')+'</section>';
}
function correctLabel(q){return q.type==="SBA"&&q.options?' '+q.answer+". "+q.options["ABCD".indexOf(q.answer)]:q.answer;}
function play(){
 const s=session();if(!s){landing();return;}if(s.finished){review();return;}
 const {c,q,key}=current(s);if(!c||!q){landing();return;}const a=s.answers[key],t=score(s),totalCases=s.order.length;
 const caseQuestions=c.questions.length,atLast=s.pos===s.order.length-1&&s.q===caseQuestions-1;
 const currLabel='Cluster '+String(s.pos+1).padStart(2,"0")+' of '+totalCases;
 const choices=q.type==="SBA"?(q.options||[]).map((opt,i)=>{const letter="ABCD"[i],isRight=letter===q.answer,isWrong=a&&letter===a.given&&!isRight;return '<button data-act="choose" data-value="'+letter+'" class="cp-choice '+(a&&isRight?"correct":isWrong?"incorrect":"")+'" '+(a?"disabled":"")+'><span class="cp-letter">'+letter+'</span><span>'+esc(opt)+'</span>'+(a&&isRight?'<b class="cp-answer-mark">✓</b>':isWrong?'<b class="cp-answer-mark">✕</b>':"")+'</button>';}).join(""):'<form id="cp-vsaq-form"><label for="cp-vsaq">Your answer (usually 1–3 words)</label><input id="cp-vsaq" autocomplete="off" placeholder="Type your answer" '+(a?"disabled":"")+' value="'+(a?esc(a.given):"")+'"><button class="cp-primary" type="submit" '+(a?"disabled":"")+'>Check answer</button></form>';
 const fb=a?'<div class="cp-feedback '+(a.correct?"correct":"incorrect")+'" role="status" aria-live="polite"><span class="cp-feedback-status">'+(a.correct?"✓ Correct":"✕ Not quite")+'</span><div class="cp-solution"><small>CORRECT ANSWER</small><strong>'+esc(correctLabel(q))+'</strong></div><h3>Why this is the answer</h3><p>'+esc(q.explain||"")+'</p>'+(a.given&&!a.correct&&q.whyOptions&&q.type==="SBA"&&q.whyOptions["ABCD".indexOf(a.given)]?'<p><b>Your chosen option:</b> '+esc(q.whyOptions["ABCD".indexOf(a.given)])+'</p>':"")+(q.point?'<p class="cp-takeaway"><b>Key point:</b> '+esc(q.point)+'</p>':"")+(q.type==="VSAQ"&&!a.correct?'<button class="cp-secondary cp-self" data-act="selfmark">My equivalent answer is correct</button>':"")+'</div>':"";
 root.innerHTML='<div class="cp-play"><div class="cp-play-top"><button class="cp-back" data-act="home">← Clusters</button><span class="cp-pill">'+esc(db.active)+'</span><span class="cp-saving">✓ Saved on this device</span></div>'+
 '<div class="cp-progress"><div><b>'+currLabel+'</b><span>Question '+(s.q+1)+' of '+caseQuestions+' · '+t.answered+' attempted · '+t.correct+' correct</span></div><div class="cp-progress-bar"><span style="width:'+Math.round((s.pos+s.q/caseQuestions)/totalCases*100)+'%"></span></div></div>'+
 '<article class="cp-case"><div class="cp-case-kicker">CLINICAL SCENARIO</div><div class="cp-scenario">'+esc(c.scenario||"")+'</div><div class="cp-qkicker">QUESTION '+(s.q+1)+' · '+(q.type==="VSAQ"?"VERY SHORT ANSWER":s.q===5?"DATA INTERPRETATION":"SINGLE BEST ANSWER")+'</div><h2>'+esc(q.q)+'</h2><div class="cp-options">'+choices+'</div>'+fb+
 '<div class="cp-next"><button class="cp-secondary" data-act="prev" '+(s.pos===0&&s.q===0?"disabled":"")+'>← Previous</button><button class="cp-primary" data-act="next" '+(!a?"disabled":"")+'>'+(atLast?"Finish practice →":s.q===caseQuestions-1?"Next cluster →":"Next question →")+'</button></div></article></div>';
}
function render(){if(!root)return;if(db.view==="play")play();else landing();}
root.addEventListener("click",e=>{const target=e.target.closest("[data-act]");if(!target)return;const act=target.dataset.act;e.preventDefault();
 if(act==="paper"){db.active=target.dataset.paper;db.view="landing";db.showAll=false;save();render();}
 if(act==="start"){db.view="play";makeSession(target.dataset.random==="yes"?true:db.randomize);}
 if(act==="continue"){db.view="play";save();render();}
 if(act==="home"){db.view="landing";save();render();}
 if(act==="more"){db.showAll=true;save();render();}
 if(act==="open"){const idx=+target.dataset.idx;const order=pool[db.active].map((_,i)=>i);db.sessions[db.active]={order,pos:idx,q:0,answers:{},finished:false,created:Date.now(),randomize:false};db.view="play";save();render();}
 if(act==="choose")answerRecord(target.dataset.value);
 if(act==="prev")next(-1);
 if(act==="next")next(1);
 if(act==="selfmark"){const s=session(),k=current(s).key;if(s.answers[k]){s.answers[k].correct=true;s.answers[k].selfMarked=true;save();render();}}
});
root.addEventListener("change",e=>{if(e.target.id==="cp-shuffle"){db.randomize=e.target.checked;save();}});
root.addEventListener("submit",e=>{if(e.target.id==="cp-vsaq-form"){e.preventDefault();answerRecord(document.getElementById("cp-vsaq")?.value);}});
document.querySelectorAll("[data-cp-mobile-menu]").forEach(b=>b.addEventListener("click",()=>document.querySelector(".sidebar")?.classList.toggle("cp-open")));
render();
})();