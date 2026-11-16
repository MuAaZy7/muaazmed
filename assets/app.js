(function(){
"use strict";
const EYE_NOTES=Array.isArray(window.MED_NOTES)?window.MED_NOTES:[];
const RAW_CASES=[...(window.MED_BANK||[]),...(window.MED_EXTRA||[])];
const SLIDES=window.MED_SLIDES||[];
const CONFIG=window.MED_BACKEND||{};
const CORE_MAP={
 16:["Anaphylaxis","Anaphylactic Shock"],35:["HIV/AIDS","Oral Candidiasis"],2:["Sepsis"],
 17:["Sepsis"],12:["Cardiac Arrhythmia"],32:["Congestive Cardiac Failure"],
 1:["Ischaemic Heart Disease"],13:["Pulmonary Embolism"],3:["Shock"],26:["Asthma"],
 33:["Chronic Obstructive Pulmonary Disease (COPD)"],11:["Pneumonia"],7:["Tuberculosis"],
 5:["Acute Kidney Injury"],34:["Nephritic syndrome","Nephrotic syndrome"],
 23:["Renal Calculi"],19:["Liver Cirrhosis","Ascites"],14:["Liver Cirrhosis"],
 6:["Upper GI Bleed","Peptic Ulcer Disease"],20:["Aplastic Anaemia"],
 10:["Iron Deficiency Anaemia"],27:["Stroke"]
};
const MODULES=["All","Emergency","BCMH","CVS","Respiratory","Renal","GIT","MSK","Haem / Cancer","Cancer","Paediatrics","Neuro"];
const MODULE_ICON={"Emergency":"✚","BCMH":"◈","CVS":"♡","Respiratory":"◉","Renal":"◇","GIT":"≈","MSK":"✳","Haem / Cancer":"◈","Cancer":"✦","Paediatrics":"☼","Neuro":"☷"};
const CASES=RAW_CASES.map(c=>Object.assign({},c,{coreNames:Array.isArray(c.core)?c.core:(c.core?[c.core]:(CORE_MAP[c.id]||[]))}));
const CORE_CASES=CASES.filter(c=>c.coreNames.length>0);
const KEY="muaazmed-gemp1-2026-v5";
const defaultState=()=>({learned:[],saved:[],quickChecks:{},flashcards:{},flashSession:null,caseAnswers:{},flags:{},mockSessions:{},mockHistory:[],guestName:"Guest student",lastVisited:null});
let state=defaultState();
try{const p=JSON.parse(localStorage.getItem(KEY)||"null");if(p&&typeof p==="object")state=Object.assign(defaultState(),p)}catch(e){}
if(!Array.isArray(state.learned))state.learned=[];
if(!Array.isArray(state.saved))state.saved=[];
if(!state.flashcards||typeof state.flashcards!=="object")state.flashcards={};
if(!Array.isArray(state.mockHistory))state.mockHistory=[];
if(!state.mockSessions||typeof state.mockSessions!=="object")state.mockSessions={};
if(!state.caseAnswers||typeof state.caseAnswers!=="object")state.caseAnswers={};
let filterNotes="All",filterCases="Core",filterLectures="All",searchText="",currentTimer=null,toastTimer=null;
let supabase=null,authUser=null,syncTimer=null,authReady=false,communityEntries=[];
let activeQuestion=null;
const $=id=>document.getElementById(id);
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const norm=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g," ").trim();
const today=()=>new Date().toISOString().slice(0,10);
const short=(s,n=130)=>String(s||"").length>n?String(s).slice(0,n).trimEnd()+"…":String(s||"");
const titleCase=s=>String(s||"").replace(/\b\w/g,x=>x.toUpperCase());
const courseName=c=>c&&c.category||"BCMH";
const goto=url=>{if(location.hash!==url)location.hash=url;else render()};
const noteHash=n=>"#note/"+encodeURIComponent(n);
const caseHash=(id,idx=0)=>"#case/"+encodeURIComponent(String(id))+"/"+idx;
const qrKey=(c,q)=>String(c.id)+":"+String(q.number);
const totalQuestions=CASES.reduce((n,c)=>n+c.questions.length,0);
function toast(msg){const el=$("toast");if(!el)return;el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2900)}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){toast("Local storage full; export your progress.")}if(authUser&&supabase){clearTimeout(syncTimer);syncTimer=setTimeout(syncNow,1300)}}
function progressPct(){return Math.round(state.learned.length/Math.max(1,EYE_NOTES.length)*100)}
function answeredCount(){return Object.keys(state.caseAnswers).length}
function caseAccuracy(){const a=Object.values(state.caseAnswers);return a.length?Math.round(a.filter(x=>x.correct).length/a.length*100):null}
function bestScore(){const a=state.mockHistory.filter(h=>h.total===120);return a.length?Math.max(...a.map(x=>Math.round(x.correct/120*100))):null}
function badge(label,style=""){return '<span class="chip '+style+'">'+esc(label)+'</span>'}
function iconFor(m){return MODULE_ICON[m]||"✧"}
function head(over,title,sub,actions=""){return '<div class="page-head"><div><div class="overline">'+esc(over)+'</div><h1>'+esc(title)+'</h1><p>'+esc(sub)+'</p></div><div class="page-actions">'+actions+'</div></div>'}
function feedbackBox(text,style=""){return '<div class="feedback '+style+'">'+text+'</div>'}
function formatNumber(n){return new Intl.NumberFormat("en-ZA").format(n)}
function clip(s,n=150){return esc(short(s,n))}
function setCrumb(page){const labels={home:"Dashboard",notes:"Core notes",note:"Core condition",cases:"Case bank",case:"Clinical case",mocks:"Mock exams",mock:"Mock paper",result:"Results",flashcards:"Flashcards",study:"Card review",leaderboard:"Scoreboard",lectures:"Lecture library"};$("crumb").textContent=labels[page]||"Dashboard";document.querySelectorAll("[data-nav]").forEach(a=>a.classList.toggle("active",a.dataset.nav===(["note"].includes(page)?"notes":["case"].includes(page)?"cases":["mock","result"].includes(page)?"mocks":page==="study"?"flashcards":page)))}
function setIdentity(){let label=authUser?(authUser.user_metadata?.nickname||authUser.email?.split("@")[0]||"Student"):state.guestName;label=short(label,21);$("side-name").textContent=label;$("top-identity").textContent=authUser?"My account":"Guest mode";$("top-avatar").textContent=label.slice(0,1).toUpperCase();$("side-status").textContent=authUser?"Synced account (when online)":"Progress saved on this device";document.querySelector(".avatar").textContent=label.slice(0,1).toUpperCase()}
function learnToggle(name){const idx=state.learned.indexOf(name);if(idx>=0)state.learned.splice(idx,1);else state.learned.push(name);save();render()}
function saveToggle(name){const idx=state.saved.indexOf(name);if(idx>=0)state.saved.splice(idx,1);else state.saved.push(name);save();render()}
function questionStats(){const p=Object.values(state.caseAnswers);const c=p.filter(x=>x.correct).length;return {count:p.length,correct:c,percent:p.length?Math.round(c/p.length*100):0}}
function renderHome(){
 const quiz=questionStats(),pct=progressPct(),best=bestScore();
 const modules=[["BCMH","BCMH & infections"],["CVS","Cardiovascular"],["Respiratory","Respiratory"],["Renal","Renal"],["GIT","Gastrointestinal"],["MSK","Musculoskeletal"],["Haem / Cancer","Haematology & cancer"],["Emergency","Emergencies"]];
 const subjectTiles=modules.map(([group,label])=>{const count=EYE_NOTES.filter(n=>n.category===group||(group==="Haem / Cancer"&&n.category==="Cancer")).length;const done=EYE_NOTES.filter(n=>(n.category===group||(group==="Haem / Cancer"&&n.category==="Cancer"))&&state.learned.includes(n.name)).length;return '<button class="subject-tile" data-action="module" data-module="'+esc(group)+'"><span class="subject-icon">'+iconFor(group)+'</span><span><b>'+esc(label)+'</b><small>'+done+' / '+count+' conditions revised</small></span><span class="subject-arrow">↗</span></button>'}).join("");
 $("view").innerHTML='<section class="hero"><div class="hero-copy"><div class="hero-kicker">THE GEMP1 END-OF-YEAR INTEGRATED ASSESSMENT</div><h1>Build the clinical thinking that gets you <em>exam-ready.</em></h1><p>Every red-listed GEMP1 condition. Condensed high-yield notes, 396 clinical flashcards, case clusters and two complete timed practice papers — organised around what Wits says it tests.</p><div class="hero-actions"><a class="btn btn-primary" href="#notes">Start learning ↗</a><a class="btn btn-soft" href="#flashcards">Review flashcards →</a><a class="btn btn-soft" href="#mocks">Mock exams ↗</a></div></div><div class="hero-art"><div class="orbit"><div class="hero-ring"><span>'+pct+'%<small>REVISED</small></span></div></div><span class="spark a">✦</span><span class="spark b">✧</span></div></section>'+
 '<section class="stat-grid">'+
 metric("◈",EYE_NOTES.length,"GEMP1 core conditions","Official red-listed scope")+
 metric("☷",CASES.length,"Clinical case clusters",totalQuestions+" practice questions")+
 metric("◇","120 × 2","Full mock papers","180 minutes each")+
 metric("✦",best==null?"—":best+"%","Your best mock score","Target: 90% or higher")+
 '</section><div class="dashboard-cols"><div><section class="panel"><div class="panel-head"><div><h2>Master the core, one system at a time</h2><p>All 66 red-marked GEMP1 conditions, grouped for fast revision.</p></div><a href="#notes" class="btn btn-sm">View all ↗</a></div><div class="subject-grid">'+subjectTiles+'</div><div class="notice">Source transparency: the 66-condition scope follows the red text in your Wits document. Summaries are original educational syntheses; case questions include student-bank contributions and separately identified original practice.</div></section></div><div><section class="panel"><div class="panel-head"><div><h2>Your revision pulse</h2><p>Your progress is private to this device in guest mode.</p></div></div><div class="progress-meta"><span>Conditions revised</span><b>'+state.learned.length+' / '+EYE_NOTES.length+'</b></div><div class="progress-track"><span style="width:'+pct+'%"></span></div><div class="rule"></div>'+
 task("▤","Finish your next condition","Short mechanism + discriminators + red flags","#notes")+
 task("◈","Flip active-recall flashcards","396 cards with spaced reviews","#flashcards")+
 task("◈","Reason through a case cluster","SBA, results interpretation and VSAQ","#cases")+
 task("▣","Sit a 3-hour timed mock","120 marks · exam-style review","#mocks")+
 '<div class="notice good"><strong>Practice so far:</strong> '+quiz.count+' questions answered · '+(quiz.count?quiz.percent+"% accuracy":"no answers yet")+'.</div></section></div></div>';
}
function metric(icon,value,label,note){return '<div class="metric-card"><span class="metric-icon">'+icon+'</span><div class="metric-number">'+esc(value)+'</div><div class="metric-label">'+esc(label)+'</div><div class="metric-note">'+esc(note)+'</div></div>'}
function task(icon,title,sub,link){return '<a class="task-row" href="'+link+'"><span class="task-mark">'+icon+'</span><span class="task-body"><b>'+esc(title)+'</b><small>'+esc(sub)+'</small></span><span class="task-go">→</span></a>'}
function filterBar(section,options,active){return '<div class="filters">'+options.map(x=>'<button class="filter-pill '+(x===active?"active":"")+'" data-action="filter" data-section="'+section+'" data-value="'+esc(x)+'">'+esc(x)+'</button>').join("")+'</div>'}
function notesFiltered(){return EYE_NOTES.filter(n=>{const group=(filterNotes==="All"||filterNotes===n.category||(filterNotes==="Haem / Cancer"&&n.category==="Cancer")||(filterNotes==="Saved"&&state.saved.includes(n.name))||(filterNotes==="To revise"&&!state.learned.includes(n.name)));const query=norm(n.name+" "+n.category+" "+n.presentation+" "+n.clues).includes(norm(searchText));return group&&query}).sort((a,b)=>a.name.localeCompare(b.name))}
function noteCard(n){
 const saved=state.saved.includes(n.name),learned=state.learned.includes(n.name);
 return '<article class="condition-card"><div class="card-top">'+badge(n.category,"blue")+'<button class="icon-star '+(saved?"saved":"")+'" data-action="save" data-name="'+esc(n.name)+'" aria-label="Bookmark condition">'+(saved?"★":"☆")+'</button></div><h3>'+esc(n.name)+'</h3><p>'+clip(n.presentation,148)+'</p><div class="card-footer"><span>'+(learned?'<span class="is-learned">✓ Revised</span>':'<span>High-yield note</span>')+'</span><a class="card-cta" href="'+noteHash(n.name)+'">Open notes ↗</a></div></article>'
}
function renderNotes(){
 $("view").innerHTML=head("YOUR EXAM SCOPE","The 66 GEMP1 core conditions","These are the red-highlighted conditions in the Wits scope. Learn the mechanism, pattern, discriminating clue, safety priority and a quick VSAQ.",'<button class="btn" data-action="export">Export progress ↗</button>')+
 '<div class="toolbar"><label class="search-field"><span>⌕</span><input id="notes-search" type="search" placeholder="Search diagnoses, presentations or mechanisms…" value="'+esc(searchText)+'" aria-label="Search conditions"></label>'+filterBar("notes",["All","To revise","Saved","Emergency","BCMH","CVS","Respiratory","Renal","GIT","MSK","Haem / Cancer","Cancer","Paediatrics","Neuro"],filterNotes)+'</div><div class="results-count" id="notes-count"></div><div class="card-grid" id="notes-cards"></div>';
 refreshNotesList();
}
function refreshNotesList(){const found=notesFiltered();const target=$("notes-cards");if(!target)return;target.innerHTML=found.map(noteCard).join("")||'<div class="empty"><div class="empty-symbol">⌕</div><h3>No matching conditions</h3><p>Try a different search or module filter.</p></div>';$("notes-count").textContent=found.length+" of "+EYE_NOTES.length+" conditions"}
function relatedCases(name){return CASES.filter(c=>c.coreNames.some(n=>norm(n)===norm(name)))}
function slidesFor(n){const wordMap={
 "Anaphylaxis":["anaphylaxis","antihistamines"],"Anaphylactic Shock":["anaphylaxis","shock"],"Tuberculosis":["tb","tuberculosis"],"HIV/AIDS":["hiv","arvs"],"Osteoporosis":["osteoporosis","bone physiology"],"Gout":["gout"],"Iron Deficiency Anaemia":["iron deficiency","anaemia"],"Ischaemic Heart Disease":["myocardial infarction","atherosclerosis","acute cardiac"],"Renal Calculi":["calculi","urology"],"Liver Cirrhosis":["chronic liver","portal hypertension"],"Cholecystitis":["cholecystitis","gallstones"],"Peptic Ulcer Disease":["peptic ulcer"],"Rheumatoid Arthritis":["rheumatoid arthritis"],"Nephritic syndrome":["glomerulonephritis","haematuria"],"Nephrotic syndrome":["nephrotic","proteinuria"],"Disseminated Intravascular Coagulation":["coagulation","haemostasis"],"Von Willebrand Disease":["coagulation","haemostasis"],"Septic Arthritis":["osteoarticular infections"],"Breast Cancer":["cancer"],"Cervical Cancer":["cancer"],"Severe Acute Malnutrition":["nutrition"]
 };
 const tokens=(wordMap[n.name]||[n.name.toLowerCase()]).map(x=>norm(x));
 const mod=norm(n.category);
 const scored=SLIDES.map(s=>{let score=0;const sn=norm(s.name),sm=norm(s.module);for(const x of tokens)if(sn.includes(x))score+=12;if(mod==="haem cancer"&&(sm.includes("haem")||sm.includes("cancer")))score+=2;else if(mod==="emergency"&&(sn.includes("shock")||sn.includes("emergency")))score+=3;else if(mod===sm)score+=2;return{s,score}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
 return scored.slice(0,4).map(x=>x.s);
}
function renderDetail(name){
 const n=EYE_NOTES.find(x=>norm(x.name)===norm(name));if(!n){goto("#notes");return}
 const saved=state.saved.includes(n.name),learned=state.learned.includes(n.name),rels=relatedCases(n.name),slides=slidesFor(n);
 
 const sections=[
  section("◈","Clinical presentation",n.presentation,""),
  section("✳","Mechanism · explain why",n.mechanism,"highlight"),
  section("⌁","Discriminating findings",n.clues,""),
  section("⌕","Investigations and interpretation",n.tests,""),
  section("!","Danger signs & safest next step",n.safety,"warning"),
  section("⇄","Differentiate from common mimics",n.differentiate,""),
  section("★","Exam memory hook",n.memory,"ok")
 ].join("");
 const links=rels.map(c=>'<div class="linked-case"><span>◈</span><strong>'+esc(c.title)+'</strong><a href="'+caseHash(c.id)+'">Practise ↗</a></div>').join("")||'<p class="tiny-note">A full case cluster is being prepared for this condition. Start with its VSAQ and use the clinical case bank for integrated practice.</p>';
 const lectures=slides.map(s=>'<div class="linked-case"><span>▥</span><strong>'+esc(s.name)+'</strong><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">Slides ↗</a></div>').join("")||'<p class="tiny-note">Browse the lecture library to find supporting course material.</p>';
 $("view").innerHTML='<div class="detail-layout"><div class="detail-main"><button class="back-link" data-action="back-notes">← Back to core conditions</button><div class="detail-hero"><div class="detail-top">'+badge("GEMP1 red-listed","red")+badge(n.category,"blue")+(learned?badge("Revised ✓","green"):"")+'</div><h1>'+esc(n.name)+'</h1><p>'+esc(n.presentation)+'</p><div class="page-actions"><button class="btn '+(learned?"btn-success":"btn-primary")+'" data-action="learn" data-name="'+esc(n.name)+'">'+(learned?"✓ Marked as revised":"+ Mark as revised")+'</button><button class="btn" data-action="save" data-name="'+esc(n.name)+'">'+(saved?"★ Saved":"☆ Save note")+'</button><button class="btn btn-soft" data-action="flash-start" data-scope="condition:'+esc(n.name)+'" data-mode="All" data-limit="6">◈ Flashcards</button></div></div>'+sections+'<div class="notice">Study rule: be able to recognise the presentation, explain the underlying mechanism, interpret basic investigations and state the safest supervised action. These summaries are revision aids, not a replacement for your original Wits teaching material.</div></div><aside class="detail-aside"><section class="aside-box"><div class="overline">ACTIVE RECALL · FLASHCARDS</div><h3>6 cards for this condition</h3><p>Clinical recognition, mechanism, investigations, safety, differential and VSAQ.</p><div class="progress-meta"><span>Mastered</span><b>'+Flash.statsFor(n.name).mastered+' / 6</b></div><div class="progress-track"><span style="width:'+(Flash.statsFor(n.name).mastered/6*100)+'%"></span></div><button class="btn btn-primary btn-wide" style="margin-top:14px" data-action="flash-start" data-scope="condition:'+esc(n.name)+'" data-mode="All" data-limit="6">Study 6 flashcards →</button><p class="tiny-note" style="margin-top:10px">Flip the card and rate your recall to schedule future reviews.</p></section><section class="aside-box"><h3>Linked case practice</h3>'+links+'</section><section class="aside-box"><h3>Related Wits lectures</h3>'+lectures+'</section></aside></div>';
}
function section(icon,title,body,kind){return '<section class="detail-section '+kind+'"><h2><span>'+icon+'</span>'+esc(title)+'</h2><p>'+esc(body)+'</p></section>'}
function renderCases(){
 let found=CASES.filter(c=>filterCases==="All"||(filterCases==="Core"?c.coreNames.length>0:filterCases==="Extension"?c.coreNames.length===0:norm(c.module).includes(norm(filterCases))));
 if(searchText)found=found.filter(c=>norm(c.title+" "+c.module+" "+c.scenario).includes(norm(searchText)));
 $("view").innerHTML=head("CLINICAL REASONING","Think in clinical clusters","Practise linked SBAs, interpretation and VSAQs. Student-contributed cases and original new practice are labelled; only red-listed conditions enter the core-only mock pool.",'<a class="btn btn-primary" href="#mocks">Full mocks ↗</a>')+
 '<div class="toolbar"><label class="search-field"><span>⌕</span><input id="cases-search" type="search" aria-label="Search case bank" placeholder="Search clinical presentations…" value="'+esc(searchText)+'"></label>'+filterBar("cases",["Core","All","Extension","BCMH","CVS","Respiratory","Renal","GIT","MSK","Haem / Cancer","Paediatrics"],filterCases)+'</div><p class="tiny-note">'+found.length+' clusters shown · '+found.reduce((a,c)=>a+c.questions.length,0)+' questions · Original cases are not official Wits questions.</p>'+
 '<div class="case-list">'+found.map(c=>'<article class="case-card"><div class="card-top">'+badge(c.module,"blue")+badge(c.coreNames.length?"Core linked":"Integrated context",c.coreNames.length?"green":"amber")+'</div><small>'+esc(c.source||"Student teaching bank")+' · '+c.questions.length+' questions</small><h3>'+esc(c.title)+'</h3><p>'+clip(c.scenario,165)+'</p><div class="card-footer"><span>'+c.questions.filter(q=>q.type==="VSAQ").length+' VSAQ · '+c.questions.filter(q=>q.type==="SBA").length+' SBA</span><a class="card-cta" href="'+caseHash(c.id)+'">Start case ↗</a></div></article>').join("")+'</div>';
}
function renderCase(id,idx){
 const c=CASES.find(x=>String(x.id)===String(id));if(!c){goto("#cases");return}
 idx=Math.max(0,Math.min(c.questions.length-1,Number(idx)||0));const q=c.questions[idx],key=qrKey(c,q),saved=state.caseAnswers[key],flag=state.flags[key];
 const opts=q.type==="SBA"?'<div class="options">'+q.options.map((o,i)=>{const ch="ABCD"[i],cls=saved?(ch===q.answer?"correct":ch===saved.answer?"incorrect":""):"";return '<button class="option '+cls+'" data-action="answer-case" data-case="'+c.id+'" data-index="'+idx+'" data-letter="'+ch+'" '+(saved?"disabled":"")+'><span class="opt-letter">'+ch+'</span>'+esc(o)+'</button>'}).join("")+'</div>':
 '<div><p class="tiny-note">Answer in 1–3 words. You can check the expected answer after submitting.</p><input class="input" style="width:100%" id="case-free" placeholder="Very short answer…" value="'+esc(saved?.answer||"")+'" '+(saved?"disabled":"")+'><div style="margin-top:10px"><button class="btn btn-primary btn-sm" data-action="answer-vsaq" data-case="'+c.id+'" data-index="'+idx+'" '+(saved?"disabled":"")+'>Check answer</button></div></div>';
 const expl=saved?'<div class="q-explanation"><h4>'+((q.type==="VSAQ"||saved.correct)?"✓ Answer & reasoning":"Review the reasoning")+'</h4><p><strong>Expected: '+esc(q.type==="SBA"?q.options["ABCD".indexOf(q.answer)]:q.answer)+'.</strong> '+esc(q.explain||q.point||"")+'</p></div>':"";
 const palette=c.questions.map((x,i)=>{const f=state.caseAnswers[qrKey(c,x)],fl=state.flags[qrKey(c,x)];return '<button class="'+(i===idx?"active ":"")+(f?(f.correct?"answered":"wrong"):"")+(fl?" flagged":"")+'" data-action="case-jump" data-case="'+c.id+'" data-index="'+i+'">'+(i+1)+'</button>'}).join("");
 $("view").innerHTML='<div class="case-layout"><div><button class="back-link" data-action="back-cases">← Back to clinical case bank</button><div class="scenario"><div class="overline">CLINICAL CASE · '+esc(c.module)+'</div><h2>'+esc(c.title)+'</h2><p>'+esc(c.scenario)+'</p></div><div class="question-panel"><div class="q-progress"><span>QUESTION '+(idx+1)+' OF '+c.questions.length+'</span>'+badge(q.type==="VSAQ"?"VSAQ · 1–3 words":q.isData?"Results interpretation":"SBA · 4 options","blue")+'</div><h2>'+esc(q.q)+'</h2>'+opts+expl+'<div class="question-foot"><button class="btn btn-sm" data-action="flag" data-key="'+esc(key)+'">'+(flag?"⚑ Flagged":"⚐ Flag for review")+'</button><div class="page-actions"><button class="btn btn-sm" data-action="case-jump" data-case="'+c.id+'" data-index="'+(idx-1)+'" '+(idx===0?"disabled":"")+'>← Previous</button><button class="btn btn-primary btn-sm" data-action="case-jump" data-case="'+c.id+'" data-index="'+(idx+1)+'" '+(idx===c.questions.length-1?"disabled":"")+'>Next →</button></div></div>'+(saved?'<button class="btn btn-soft btn-sm" style="margin-top:15px" data-action="ask-ai" data-case="'+c.id+'" data-index="'+idx+'">✦ Ask the AI tutor about this question</button>':'<p class="tiny-note" style="margin-top:15px">Answer first to unlock the rationale and AI tutor.</p>')+'</div></div><aside class="q-side"><div class="aside-box"><h3>Question navigator</h3><p class="tiny-note">Choose a question; green means answered correctly.</p><div class="q-palette">'+palette+'</div><div class="progress-track"><span style="width:'+Math.round(100*c.questions.filter(x=>state.caseAnswers[qrKey(c,x)]).length/c.questions.length)+'%"></span></div><p class="tiny-note">'+c.questions.filter(x=>state.caseAnswers[qrKey(c,x)]).length+' of '+c.questions.length+' completed</p><div class="rule"></div><p class="tiny-note"><strong>Source:</strong> '+esc(c.source||"Student teaching bank")+'</p><p class="tiny-note">These questions are practice material and have not been verified as official Wits items.</p></div></aside></div>';
}
function mockCaseOrder(){
 const byModule={};for(const c of CORE_CASES){const m=c.module;if(!byModule[m])byModule[m]=[];byModule[m].push(c)}
 Object.keys(byModule).forEach(k=>byModule[k].sort((a,b)=>(a.id*117+51)%997-(b.id*117+51)%997));
 let order=[];let groups=Object.keys(byModule).sort();let alive=true;while(alive){alive=false;for(const k of groups){if(byModule[k].length){order.push(byModule[k].shift());alive=true}}}
 const a=[],b=[];for(let i=0;i<order.length;i++){if(a.length===18&&b.length===18)break;if(i%2===0&&a.length<18)a.push(order[i]);else if(b.length<18)b.push(order[i]);else if(a.length<18)a.push(order[i])}
 return {A:a,B:b}
}
const MOCK_CASES=mockCaseOrder();
function mockItems(which){
 const list=MOCK_CASES[which]||[];let out=[];
 list.forEach((c,i)=>{
  const count=i<12?7:6;
  const sbas=c.questions.filter(q=>q.type==="SBA");
  const data=sbas.find(q=>q.isData||/lab report|results:|ecg shows|blood results|spirometry|creatinine|haemoglobin|haematocrit|blood count|imaging shows|x-ray shows|x-ray reveals|urinalysis|blood gas/i.test(q.q));
  let selected=sbas.filter(q=>!data||q.number!==data.number).slice(0,count-2);
  if(data)selected.push(data);
  else if(sbas[count-2])selected.push(sbas[count-2]);
  const v=c.questions.find(q=>q.type==="VSAQ");
  if(v)selected.push(v);
  if(selected.length<count)for(const q of c.questions){if(!selected.includes(q)){selected.splice(selected.length-(v?1:0),0,q);if(selected.length===count)break}}
  selected.slice(0,count).forEach((q,j)=>out.push({id:qrKey(c,q),caseId:c.id,caseTitle:c.title,category:c.module,scenario:c.scenario,q,section:i+1,sectionQ:j+1}));
 });
 return out.slice(0,120);
}
const MOCKS={A:mockItems("A"),B:mockItems("B")};
function fmtTime(ms){const t=Math.max(0,Math.ceil(ms/1000)),h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=t%60;return [h,m,s].map(x=>String(x).padStart(2,"0")).join(":")}
function mockResults(which){const hist=state.mockHistory.filter(x=>x.paper===which).sort((a,b)=>b.date-a.date);return hist.length?hist[0]:null}
function renderMocks(){
 const cards=["A","B"].map(p=>{const ses=state.mockSessions[p],done=mockResults(p),ready=MOCKS[p].length===120;
 return '<article class="mock-card '+(ses&&ses.status==="active"?"mock-live":"")+'"><div class="card-top">'+badge("PAPER "+p,"blue")+badge(ready?"120 QUESTIONS":"UNDER CONSTRUCTION",ready?"green":"amber")+'</div><h2>Integrated Paper '+p+'</h2><p>Approximately 18 undifferentiated clinical case clusters with linked 4-option SBAs, data interpretation and 1–3-word VSAQs.</p><div class="mock-stats">'+badge("180 minutes")+badge("120 marks")+badge("Timed & self-marked")+'</div>'+(done?'<p><strong>Latest result: '+done.correct+'/120 ('+Math.round(done.correct/120*100)+'%)</strong></p>':"")+'<button class="btn btn-primary" data-action="mock-start" data-paper="'+p+'" '+(!ready?"disabled":"")+'>'+(ses?.status==="active"?"Continue paper":ses?"Retake paper":"Start paper")+' →</button></article>'}).join("");
 $("view").innerHTML=head("THE EXAM CENTRE","Sit the paper before the paper","Official format: 2 papers of 120 questions, 180 minutes each, typically ~35–40 case clusters across both papers. These two mock papers are original/student-derived practice, not predictions.",'<a class="btn" href="https://ulwazi.wits.ac.za/courses/91264/files/12089280" target="_blank" rel="noopener">Wits assessment guide ↗</a>')+
 '<div class="mock-grid">'+cards+'</div><div class="notice warning">Assessment focus: recognising undifferentiated presentations, mechanisms, results interpretation, patient safety and the safest supervised next step. VSAQs are self-marked after submission. A 90% target is a study goal, not a score guarantee.</div>';
}
function scoreMock(which){const m=MOCKS[which],s=state.mockSessions[which];if(!s)return null;let sbaCorrect=0,sbaTotal=0,vsaqTotal=0,vsaqCorrect=0,unmarked=0,answered=0;
 for(const item of m){let val=s.answers[item.id];if(val!=null&&String(val).trim())answered++;if(item.q.type==="SBA"){sbaTotal++;if(val===item.q.answer)sbaCorrect++}else{vsaqTotal++;if(s.review[item.id]===true)vsaqCorrect++;else if(s.review[item.id]!==false)unmarked++}}
 return{sbaCorrect,sbaTotal,vsaqTotal,vsaqCorrect,unmarked,answered,correct:sbaCorrect+vsaqCorrect,total:m.length};
}
function renderMock(which){
 const m=MOCKS[which];const s=state.mockSessions[which];if(!s){goto("#mocks");return}if(s.status!=="active"){goto("#result/"+which);return}
 if(Date.now()>=s.end){submitPaper(which);return}
 const idx=Math.max(0,Math.min(119,s.index||0)),item=m[idx];if(!item){goto("#mocks");return}
 const q=item.q,sel=s.answers[item.id],flag=(s.flags||[]).includes(item.id);
 let options=q.type==="SBA"?'<div class="options">'+q.options.map((o,i)=>{const letter="ABCD"[i];return '<button class="option '+(sel===letter?"selected":"")+'" data-action="mock-answer" data-paper="'+which+'" data-letter="'+letter+'"><span class="opt-letter">'+letter+'</span>'+esc(o)+'</button>'}).join("")+'</div>':'<label><span class="tiny-note">Your 1–3-word answer:</span><input id="mock-free" class="input" style="display:block;width:100%;margin-top:8px" data-paper="'+which+'" placeholder="Type answer…" maxlength="100" value="'+esc(sel||"")+'"></label>';
 const palette=m.map((t,i)=>'<button class="'+(i===idx?"active ":"")+(s.answers[t.id]!=null&&String(s.answers[t.id]).trim()?"answered ":"")+(s.flags.includes(t.id)?"flagged":"")+'" data-action="mock-jump" data-paper="'+which+'" data-index="'+i+'">'+(i+1)+'</button>').join("");
 const stats=scoreMock(which);
 $("view").innerHTML='<div class="paper-banner"><div><div class="overline">TIMED PRACTICE PAPER '+which+'</div><h1 style="font-size:25px;margin:0">Integrated Assessment · Paper '+which+'</h1></div><div class="page-actions"><span class="timer" id="timer">'+fmtTime(s.end-Date.now())+'</span><button class="btn" data-action="mock-flag" data-paper="'+which+'">'+(flag?"⚑ Flagged":"⚐ Flag")+'</button></div></div><div class="exam-grid"><div><div class="question-panel"><div class="q-progress"><span>QUESTION '+(idx+1)+' / 120 · CLUSTER '+item.section+' / '+MOCK_CASES[which].length+'</span>'+badge(q.type==="VSAQ"?"VSAQ":q.isData||q.skill==="Results interpretation"?"Data interpretation":"SBA","blue")+'</div><div class="exam-stem"><strong>'+esc(item.caseTitle)+'</strong>\n\n'+esc(item.scenario)+'</div><h2>'+esc(q.q)+'</h2>'+options+'<div class="question-foot"><button class="btn btn-sm" data-action="mock-move" data-paper="'+which+'" data-offset="-1" '+(idx===0?"disabled":"")+'>← Previous</button><span class="tiny-note">Answers are hidden until submission</span><button class="btn btn-primary btn-sm" data-action="mock-move" data-paper="'+which+'" data-offset="1" '+(idx===119?"disabled":"")+'>Next →</button></div></div></div><aside class="q-side"><div class="aside-box"><h3>Your answer map</h3><div class="progress-meta"><span>Answered</span><strong>'+stats.answered+' / 120</strong></div><div class="progress-track"><span style="width:'+Math.round(stats.answered/120*100)+'%"></span></div><div class="q-palette" style="max-height:350px;overflow:auto">'+palette+'</div><button class="btn btn-primary btn-wide" data-action="mock-submit" data-paper="'+which+'">Submit paper</button><p class="tiny-note">Timer continues if you close this tab. No answer explanations appear during the paper.</p></div></aside></div>';
 const timer=$("timer");clearInterval(currentTimer);currentTimer=setInterval(()=>{if(!document.getElementById("timer")){clearInterval(currentTimer);return}const remain=s.end-Date.now();timer.textContent=fmtTime(remain);timer.classList.toggle("warning",remain<600000);if(remain<=0){clearInterval(currentTimer);submitPaper(which)}},1000);
}
function submitPaper(which){
 const s=state.mockSessions[which];if(!s||s.status!=="active")return;const list=MOCKS[which];
 s.status="submitted";s.completed=Date.now();s.review=s.review||{};
 for(const item of list){if(item.q.type!=="VSAQ")continue;const typed=norm(s.answers[item.id]||""),accepted=[item.q.answer,...(item.q.accepted||[])].map(norm);s.review[item.id]=typed&&accepted.includes(typed)?true:null}
 save();goto("#result/"+which);toast("Paper submitted. Self-mark remaining VSAQs.")
}
function finishMarking(which){
 const s=state.mockSessions[which];const sum=scoreMock(which);
 if(sum.unmarked>0)return;
 if(s.recorded)return;
 s.recorded=true;state.mockHistory.push({paper:which,correct:sum.correct,total:sum.total,date:Date.now(),id:which+"-"+s.started});
 save();syncMockResult(which,sum);toast("Final score saved: "+sum.correct+" / 120.")
}
function renderResult(which){
 const s=state.mockSessions[which];if(!s||s.status==="active"){goto("#mocks");return}
 const sum=scoreMock(which),complete=sum.unmarked===0,pct=Math.round(sum.correct/120*100);
 const v=MOCKS[which].filter(x=>x.q.type==="VSAQ");
 const marks=v.map(item=>{const ans=s.review[item.id],typed=s.answers[item.id]||"(no answer)";return '<div class="review-row"><b>'+esc(item.caseTitle)+' · VSAQ</b><div style="margin:7px 0">'+esc(item.q.q)+'</div><div class="micro">Your answer: <strong>'+esc(typed)+'</strong> · Expected: <strong>'+esc(item.q.answer)+'</strong></div><p class="tiny-note">'+esc(item.q.explain||"")+'</p><div class="page-actions"><button class="btn btn-sm '+(ans===true?"btn-success":"")+'" data-action="mark-vsaq" data-paper="'+which+'" data-id="'+esc(item.id)+'" data-correct="1">✓ Correct</button><button class="btn btn-sm '+(ans===false?"btn-soft":"")+'" data-action="mark-vsaq" data-paper="'+which+'" data-id="'+esc(item.id)+'" data-correct="0">✕ Incorrect</button></div></div>'}).join("");
 const incorrect=MOCKS[which].filter(i=>i.q.type==="SBA"&&s.answers[i.id]!==i.q.answer).slice(0,26);
 const review=incorrect.map(i=>'<div class="review-row"><b>'+esc(i.caseTitle)+' · Q'+i.q.number+'</b><div style="margin:6px 0">'+esc(i.q.q)+'</div><div>Your answer: '+esc(i.q.options["ABCD".indexOf(s.answers[i.id])]||"Unanswered")+'</div><div style="color:#248a6e;font-weight:800">Expected: '+esc(i.q.options["ABCD".indexOf(i.q.answer)])+'</div><p class="tiny-note">'+esc(i.q.explain||"")+'</p><button class="btn btn-soft btn-sm" data-action="ask-ai" data-paper="'+which+'" data-id="'+esc(i.id)+'">✦ Ask AI tutor</button></div>').join("");
 $("view").innerHTML='<button class="back-link" data-action="back-mocks">← All mock papers</button>'+head("PAPER "+which+" · RESULTS","Your clinical reasoning report","SBA marks are automatic; VSAQs must be self-marked using the expected 1–3-word answers. Your final result is saved only when every VSAQ is marked.")+
 '<section class="panel"><div class="page-head" style="margin:0"><div><div class="overline">'+(complete?"FINAL SCORE":"PROVISIONAL SCORE")+'</div><div class="score-large">'+(complete?sum.correct+"/120":sum.sbaCorrect+"/"+sum.sbaTotal+" SBA")+'</div><div class="micro text-muted">'+(complete?pct+"% overall":sum.unmarked+" VSAQs still awaiting self-marking")+'</div></div><div class="page-actions">'+badge(complete&&pct>=90?"A-level target achieved":complete?"Review weak areas":"Finish marking",complete&&pct>=90?"green":"amber")+'<button class="btn" data-action="export">Export progress</button></div></div><div class="score-bands" style="margin-top:20px"><div class="score-band"><b>'+sum.sbaCorrect+'/'+sum.sbaTotal+'</b><span>SBA correct</span></div><div class="score-band"><b>'+sum.vsaqCorrect+'/'+sum.vsaqTotal+'</b><span>VSAQ correct so far</span></div><div class="score-band"><b>'+sum.answered+'/120</b><span>Answers submitted</span></div></div></section>'+
 '<section class="panel" style="margin-top:18px"><div class="panel-head"><div><h2>Self-mark your VSAQs</h2><p>Credit short equivalent answers if scientifically correct. When unsure, compare with the explanation.</p></div>'+badge(sum.unmarked+" to mark","amber")+'</div><div class="exam-review">'+marks+'</div></section>'+
 '<section class="panel" style="margin-top:18px"><div class="panel-head"><div><h2>Review SBA errors</h2><p>These incorrect or unanswered items are your immediate revision priorities.</p></div></div><div class="exam-review">'+(review||'<p class="tiny-note">All SBAs correct — excellent work.</p>')+'</div></section>';
}
function renderLeaderboard(){
 const hist=[...state.mockHistory].sort((a,b)=>b.date-a.date),best=bestScore(),personal=hist.slice(0,15).map((x,i)=>'<div class="board-row"><span class="rank-num">'+(i+1)+'</span><span class="board-name">Paper '+x.paper+' · '+new Date(x.date).toLocaleDateString("en-ZA")+'</span><span class="board-score">'+x.correct+'/120 · '+Math.round(x.correct/120*100)+'%</span></div>').join("");
 const community=authReady&&communityEntries.length?communityEntries.map((r,i)=>'<div class="board-row"><span class="rank-num">'+(i+1)+'</span><span class="board-name">'+esc(r.nickname)+'</span><span class="board-score">'+esc(r.best_score)+' / 120</span></div>').join(""):'<div class="empty"><div class="empty-symbol">☆</div><h3>Community board not active yet</h3><p>Personal mock results work today. Cross-device community rankings will appear when the Supabase backend is configured and users opt in.</p></div>';
 $("view").innerHTML=head("PROGRESS TRACKER","Your scoreboard","Track attempts honestly, aim for consistent improvement and compare only published opt-in profiles once community accounts are enabled.",'<button class="btn" data-action="export">Export my progress</button>')+
 '<div class="stat-grid">'+metric("✦",best==null?"—":best+"%","Personal best","Two 120-question mocks")+metric("▤",state.learned.length+"/"+EYE_NOTES.length,"Conditions revised","Red-listed GEMP1 scope")+metric("◈",answeredCount(),"Case answers","Interactive practice")+metric("⌁",caseAccuracy()==null?"—":caseAccuracy()+"%","Case accuracy","Across answered questions")+'</div>'+
 '<div class="dashboard-cols"><section class="panel"><div class="panel-head"><div><h2>My mock exam history</h2><p>Stored locally in guest mode.</p></div></div>'+(personal||'<div class="empty"><h3>No mock results yet</h3><p>Complete a timed paper and self-mark VSAQs to record your score.</p><a class="btn btn-primary" href="#mocks">Go to mocks ↗</a></div>')+'</section><section class="panel"><div class="panel-head"><div><h2>Community leaderboard</h2><p>Opt-in ranking; no fabricated profiles or scores.</p></div></div>'+community+(authReady?'<button class="btn btn-soft btn-sm" data-action="load-board">Refresh leaderboard</button>':'<p class="tiny-note">Requires configured authentication, database and explicit student opt-in.</p>')+'</section></div>';
}
function renderLectures(){
 let choices=["All",...new Set(SLIDES.map(x=>x.module))].sort();let slides=SLIDES.filter(s=>(filterLectures==="All"||s.module===filterLectures)&&norm(s.name+" "+s.module).includes(norm(searchText)));
 $("view").innerHTML=head("SOURCE LIBRARY","Wits lecture bank","Direct Google Drive lecture links supplied for GEMP1 revision. These are references — this website does not redistribute the slide PDFs.",'<a class="btn btn-primary" href="https://drive.google.com/drive/folders/185j-AM_bQrW6duNPT5NQIGCTzxQ_8yD8" target="_blank" rel="noopener">Open Drive folder ↗</a>')+
 '<div class="toolbar"><label class="search-field"><span>⌕</span><input id="lectures-search" type="search" aria-label="Search lectures" placeholder="Find lecture titles…" value="'+esc(searchText)+'"></label><select id="lecture-module" class="select" aria-label="Select lecture module">'+choices.map(x=>'<option value="'+esc(x)+'" '+(x===filterLectures?"selected":"")+'>'+esc(x)+'</option>').join("")+'</select></div><p class="tiny-note">'+slides.length+' lecture references shown</p><div class="lectures-list">'+slides.map(s=>'<a class="lecture-item" href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer"><span>▥</span><div><b>'+esc(s.name)+'</b><small>'+esc(s.module)+'</small></div><span>↗</span></a>').join("")+'</div>';
}
const Flash=window.createMuaazFlashcards({notes:EYE_NOTES,getState:()=>state,save,goto,view:()=>$("view"),esc,norm,badge,toast,render});
function render(){clearInterval(currentTimer);let r=decodeURIComponent(location.hash.replace(/^#/,"")||"home").split("/");let page=r[0]||"home";if(!["home","notes","note","cases","case","mocks","mock","result","leaderboard","lectures","flashcards","study"].includes(page))page="home";setCrumb(page);setIdentity();
 try{
  if(page==="home")renderHome();
  else if(page==="notes")renderNotes();
  else if(page==="note")renderDetail(r.slice(1).join("/"));
  else if(page==="cases")renderCases();
  else if(page==="case")renderCase(r[1],r[2]);
  else if(page==="mocks")renderMocks();
  else if(page==="mock")renderMock(r[1]);
  else if(page==="result")renderResult(r[1]);
  else if(page==="leaderboard")renderLeaderboard();
  else if(page==="lectures")renderLectures();
  else if(page==="flashcards")Flash.overview();
  else if(page==="study")Flash.study();
 }catch(err){console.error(err);$("view").innerHTML='<div class="empty"><h3>We could not load that section.</h3><p>'+esc(err.message)+'</p><a class="btn" href="#home">Return to dashboard</a></div>'}
}
function startMock(p){if(!MOCKS[p]||MOCKS[p].length!==120){toast("This paper is not ready");return}let s=state.mockSessions[p];if(!s||s.status!=="active"){s={status:"active",started:Date.now(),end:Date.now()+180*60000,index:0,answers:{},flags:[],review:{},recorded:false};state.mockSessions[p]=s;save()}goto("#mock/"+p)}
function goMockIndex(p,i){const s=state.mockSessions[p];if(!s)return;s.index=Math.min(119,Math.max(0,i));save();render()}
function markVsaq(p,id,correct){const s=state.mockSessions[p];if(!s||s.status==="active")return;s.review[id]=correct;save();finishMarking(p);render()}
function exportProgress(){const data={format:"muaazmed-progress-v5",exported:new Date().toISOString(),state};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");const url=URL.createObjectURL(blob);a.href=url;a.download="muaazmed-progress-"+today()+".json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast("Your progress file is ready")}
function closeModal(){$("modal-root").innerHTML="";$("drawer-root").innerHTML=""}
function showAccount(mode="signin"){
 const configured=Boolean(CONFIG.url&&(CONFIG.publishableKey||CONFIG.anonKey));
 let h='<div class="modal-wrap" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-label="Student account" data-no-close="1"><button class="close-x" data-action="close-modal" aria-label="Close dialog">×</button><div class="overline">STUDENT PROFILE</div><h2>'+(authUser?"Your study account":"Study now, sign in when ready")+'</h2>';
 if(authUser){h+='<p>You are signed in as <strong>'+esc(authUser.email||"student")+'</strong>. Your saved progress synchronises while online.</p><label for="nickname">Display name</label><input id="nickname" class="input" maxlength="32" value="'+esc(authUser.user_metadata?.nickname||authUser.email?.split("@")[0]||"Student")+'"><div class="page-actions" style="margin-top:15px"><label style="display:flex;align-items:center;gap:7px;margin:0;font-size:11px"><input type="checkbox" id="visible-board"> Show my mock score on the opt-in leaderboard</label></div><div class="modal-actions"><button class="btn btn-primary" data-action="save-profile">Save profile</button><button class="btn" data-action="signout">Sign out</button></div>'}
 else{h+='<p>No login is needed to study. Guest progress stays on this device. Optional accounts provide cross-device sync after the backend is connected.</p><label for="guest-nickname">Guest display name</label><input id="guest-nickname" class="input" maxlength="32" value="'+esc(state.guestName)+'"><button class="btn btn-soft btn-sm" style="margin-top:8px" data-action="guest-save">Save guest name</button>';
  if(configured){h+='<div class="rule"></div><div class="overline">'+(mode==="signup"?"CREATE ACCOUNT":"EXISTING ACCOUNT")+'</div><label for="auth-email">Email</label><input id="auth-email" class="input" type="email" autocomplete="email"><label for="auth-password">Password</label><input id="auth-password" class="input" type="password" autocomplete="'+(mode==="signup"?"new-password":"current-password")+'" minlength="8"><div class="modal-actions"><button class="btn btn-primary" data-action="auth-go" data-mode="'+mode+'">'+(mode==="signup"?"Create account":"Sign in")+'</button><button class="btn" data-action="auth-mode" data-mode="'+(mode==="signup"?"signin":"signup")+'">'+(mode==="signup"?"Already have an account? Sign in":"Create account")+'</button></div>'}
  else{h+='<div class="notice warning">Accounts and shared scoreboard are not connected yet. The study platform, local progress, mocks and explanations work without any account. A Supabase setup is required to activate synced accounts.</div>'}
 }
 h+='<div class="auth-status" id="auth-status"></div></section></div>';$("modal-root").innerHTML=h;
 if(authUser&&supabase)supabase.from("profiles").select("leaderboard_visible").eq("id",authUser.id).maybeSingle().then(({data})=>{if($("visible-board"))$("visible-board").checked=Boolean(data?.leaderboard_visible)});
}
async function ensureAuth(){if(supabase)return supabase;if(!CONFIG.url||!(CONFIG.publishableKey||CONFIG.anonKey))return null;try{const m=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");supabase=m.createClient(CONFIG.url,CONFIG.publishableKey||CONFIG.anonKey);const {data}=await supabase.auth.getUser();authUser=data?.user||null;authReady=true;supabase.auth.onAuthStateChange((_event,session)=>{authUser=session?.user||null;setIdentity();if(authUser)loadCloudProgress()});if(authUser)await loadCloudProgress();loadLeaderboard();render();return supabase}catch(e){console.warn("Accounts unavailable:",e);authReady=false;return null}}
async function authGo(mode){const status=$("auth-status");const email=String($("auth-email")?.value||"").trim(),password=String($("auth-password")?.value||"");if(!email.includes("@")||password.length<8){status.textContent="Enter a valid email and password of at least 8 characters.";return}const api=await ensureAuth();if(!api){status.textContent="Account backend is not connected or could not load.";return}status.textContent="Connecting…";
 try{const resp=mode==="signup"?await api.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname+"#home"}}):await api.auth.signInWithPassword({email,password});if(resp.error)throw resp.error;status.style.color="#16866d";status.textContent=mode==="signup"?"Account created. Check your email if confirmation is enabled.":"Signed in successfully.";if(resp.data?.session){authUser=resp.data.user;await loadCloudProgress();setTimeout(closeModal,650);render()}}catch(e){status.textContent=e.message||"Authentication failed."}}
async function signOut(){if(supabase)await supabase.auth.signOut();authUser=null;state=defaultState();save();closeModal();render();toast("Signed out; guest session reset on this device")}
async function saveProfile(){if(!supabase||!authUser)return;const nickname=String($("nickname")?.value||"").trim().slice(0,32);const visible=Boolean($("visible-board")?.checked);if(!nickname){toast("Choose a display name");return}
 const a=await supabase.from("profiles").upsert({id:authUser.id,nickname,leaderboard_visible:visible},{onConflict:"id"});if(a.error){toast(a.error.message);return}
 await supabase.auth.updateUser({data:{nickname}});toast("Profile updated");closeModal();loadLeaderboard();render()}
async function loadCloudProgress(){if(!supabase||!authUser)return;try{const {data,error}=await supabase.from("progress").select("snapshot").eq("user_id",authUser.id).maybeSingle();if(error)throw error;if(data?.snapshot&&typeof data.snapshot==="object"){const remote=data.snapshot;state=Object.assign(defaultState(),remote);localStorage.setItem(KEY,JSON.stringify(state))}render()}catch(e){console.warn("Sync read failed:",e)}}
async function syncNow(){if(!supabase||!authUser)return;try{const {error}=await supabase.from("progress").upsert({user_id:authUser.id,snapshot:state,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(error)throw error}catch(e){console.warn("Cloud sync error:",e)}}
async function syncMockResult(p,score){if(!supabase||!authUser)return;try{await supabase.from("mock_results").insert({user_id:authUser.id,paper:p,correct:score.correct,total:120})}catch(e){console.warn("Mock score upload failed:",e)}}
async function loadLeaderboard(){if(!supabase)return;try{const {data,error}=await supabase.rpc("get_leaderboard");if(error)throw error;communityEntries=Array.isArray(data)?data:[];if(location.hash==="#leaderboard")render()}catch(e){console.warn("Leaderboard unavailable:",e)}}
function openTutor(c,q,submitted=true){activeQuestion={c,q};const explanation=String(q.explain||q.point||"No detailed explanation is included for this practice item.");const ready=Boolean(supabase&&authUser);
 $("drawer-root").innerHTML='<div class="drawer-wrap" data-action="close-modal"><div class="drawer" data-no-close="1"><div class="drawer-head"><h2>✦ MuaazMed AI tutor</h2><button class="close-x" style="position:static" data-action="close-modal">×</button></div><div class="drawer-content" id="ai-content"><div class="chip blue">CASE-BASED EXPLANATIONS</div><h3 style="margin-top:20px;font-size:16px">'+esc(c.title)+'</h3><p class="micro">'+esc(q.q)+'</p><div class="ai-message"><strong>VERIFIED QUESTION-BANK EXPLANATION</strong>'+esc(explanation)+'</div>'+(ready?'<div class="notice good">You can ask a follow-up question using your account. AI responses are educational, may make mistakes and must be checked against lectures.</div>':'<div class="notice warning">Live AI requires a configured authenticated backend and server-side API key. The authored answer explanation above works without it.</div>')+'</div><div class="drawer-input"><textarea id="ai-prompt" class="textarea" placeholder="Explain the mechanism, why B is wrong, or how to interpret these results…" maxlength="1200"></textarea><button class="btn btn-primary btn-wide" data-action="ask-ai-send" '+(!ready?"disabled":"")+'>Ask follow-up →</button></div></div></div>';
}
async function sendAI(){if(!activeQuestion||!supabase||!authUser){toast("Sign in after the AI backend is connected");return}const prompt=$("ai-prompt")?.value.trim();if(!prompt){toast("Type a question");return}const content=$("ai-content");const div=document.createElement("div");div.className="ai-message user";div.innerHTML='<strong>YOU ASKED</strong>'+esc(prompt);content.append(div);$("ai-prompt").value="";const reply=document.createElement("div");reply.className="ai-message";reply.textContent="Thinking through the clinical reasoning…";content.append(reply);content.scrollTop=content.scrollHeight;
 try{const {data,error}=await supabase.functions.invoke("ask-ai",{body:{prompt,context:{scenario:activeQuestion.c.scenario,question:activeQuestion.q.q,options:activeQuestion.q.options||[],expected:activeQuestion.q.answer,explanation:activeQuestion.q.explain||""}}});if(error)throw error;if(!data||!data.answer)throw Error(data?.error||"No AI response returned.");reply.textContent=data.answer}catch(e){reply.textContent="AI service unavailable: "+(e.message||"Please try again.")}}
document.addEventListener("click",e=>{
 const el=e.target.closest("[data-action]");if(!el)return;
 const action=el.dataset.action;
 if(Flash.handleAction(action,el))return;
 if(action==="close-modal"){if(e.target.closest("[data-no-close]")&&!e.target.closest(".close-x"))return;closeModal();return}
 if(["search","menu","account","export","load-board"].includes(action)){
  if(action==="search"){goto("#notes");setTimeout(()=>$("notes-search")?.focus(),80)}
  if(action==="menu")$("sidebar").classList.toggle("open");
  if(action==="account")showAccount();
  if(action==="export")exportProgress();
  if(action==="load-board")loadLeaderboard();
  return}
 if(action==="module"){filterNotes=el.dataset.module;searchText="";goto("#notes");return}
 if(action==="filter"){const section=el.dataset.section;if(section==="notes")filterNotes=el.dataset.value;else if(section==="cases")filterCases=el.dataset.value;render();return}
 if(action==="learn"){learnToggle(el.dataset.name);return}
 if(action==="save"){saveToggle(el.dataset.name);return}
 if(action==="back-notes"){goto("#notes");return}
 if(action==="back-cases"){goto("#cases");return}
 if(action==="back-mocks"){goto("#mocks");return}
 if(action==="quick-check"){const note=EYE_NOTES.find(n=>n.name===el.dataset.name);if(!note)return;const answer=($("quick-answer")?.value||"").trim();if(!answer){toast("Type 1–3 words");return}const correct=norm(answer)===norm(note.answer)||norm(answer).includes(norm(note.answer));state.quickChecks[note.name]={answer,correct};save();render();return}
 if(action==="answer-case"){const c=CASES.find(x=>String(x.id)===el.dataset.case),q=c?.questions[Number(el.dataset.index)];if(!q)return;state.caseAnswers[qrKey(c,q)]={answer:el.dataset.letter,correct:el.dataset.letter===q.answer,time:Date.now()};save();render();return}
 if(action==="answer-vsaq"){const c=CASES.find(x=>String(x.id)===el.dataset.case),q=c?.questions[Number(el.dataset.index)];if(!q)return;const answer=($("case-free")?.value||"").trim();if(!answer){toast("Type a short answer");return}const acc=[q.answer,...(q.accepted||[])].map(norm);state.caseAnswers[qrKey(c,q)]={answer,correct:acc.includes(norm(answer)),time:Date.now()};save();render();return}
 if(action==="case-jump"){const c=CASES.find(x=>String(x.id)===el.dataset.case);if(!c)return;const idx=Number(el.dataset.index);if(idx<0||idx>=c.questions.length)return;goto(caseHash(c.id,idx));return}
 if(action==="flag"){state.flags[el.dataset.key]=!state.flags[el.dataset.key];save();render();return}
 if(action==="mock-start"){startMock(el.dataset.paper);return}
 if(action==="mock-answer"){const p=el.dataset.paper,s=state.mockSessions[p];if(!s)return;const item=MOCKS[p][s.index];s.answers[item.id]=el.dataset.letter;save();render();return}
 if(action==="mock-jump"){goMockIndex(el.dataset.paper,Number(el.dataset.index));return}
 if(action==="mock-move"){const p=el.dataset.paper;goMockIndex(p,(state.mockSessions[p]?.index||0)+Number(el.dataset.offset));return}
 if(action==="mock-flag"){const p=el.dataset.paper,s=state.mockSessions[p];if(!s)return;const id=MOCKS[p][s.index].id;const idx=s.flags.indexOf(id);if(idx<0)s.flags.push(id);else s.flags.splice(idx,1);save();render();return}
 if(action==="mock-submit"){const p=el.dataset.paper;if(!confirm("Submit Paper "+p+"? Unanswered questions will receive no marks and you can then review all explanations."))return;submitPaper(p);return}
 if(action==="mark-vsaq"){markVsaq(el.dataset.paper,el.dataset.id,el.dataset.correct==="1");return}
 if(action==="ask-ai"){const c=el.dataset.case?CASES.find(x=>String(x.id)===el.dataset.case):CASES.find(x=>x.id===MOCKS[el.dataset.paper]?.find(q=>q.id===el.dataset.id)?.caseId);let q=el.dataset.case?c?.questions[Number(el.dataset.index)]:MOCKS[el.dataset.paper]?.find(x=>x.id===el.dataset.id)?.q;if(c&&q)openTutor(c,q);return}
 if(action==="ask-ai-send"){sendAI();return}
 if(action==="auth-mode"){showAccount(el.dataset.mode);return}
 if(action==="auth-go"){authGo(el.dataset.mode);return}
 if(action==="guest-save"){const val=($("guest-nickname")?.value||"Guest student").trim().slice(0,32);state.guestName=val||"Guest student";save();setIdentity();toast("Guest name saved");return}
 if(action==="save-profile"){saveProfile();return}
 if(action==="signout"){signOut();return}
});
document.addEventListener("input",e=>{
 const t=e.target;
 if(Flash.handleInput(t))return;
 if(t.id==="notes-search"){searchText=t.value;refreshNotesList()}
 if(t.id==="cases-search"){searchText=t.value;renderCases();const input=$("cases-search");if(input){input.focus();input.setSelectionRange(searchText.length,searchText.length)}}
 if(t.id==="lectures-search"){searchText=t.value;renderLectures();const input=$("lectures-search");if(input){input.focus();input.setSelectionRange(searchText.length,searchText.length)}}
 if(t.id==="mock-free"){const p=t.dataset.paper,s=state.mockSessions[p];if(s&&s.status==="active"){const item=MOCKS[p][s.index];s.answers[item.id]=t.value;save()}}
});
document.addEventListener("change",e=>{if(Flash.handleChange(e.target))return;if(e.target.id==="lecture-module"){filterLectures=e.target.value;renderLectures()}});
window.addEventListener("hashchange",()=>{searchText="";$("sidebar")?.classList.remove("open");window.scrollTo({top:0,behavior:"auto"});render()});
window.addEventListener("keydown",e=>{if(Flash.handleKey(e))return;if(e.key==="Escape")closeModal()});
window.addEventListener("beforeunload",()=>{clearInterval(currentTimer)});
if(EYE_NOTES.length!==66||CASES.length!==75||totalQuestions!==725||SLIDES.length!==72||Flash.cards.length!==396){console.warn("MuaazMed content validation:",{notes:EYE_NOTES.length,cases:CASES.length,questions:totalQuestions,slides:SLIDES.length})}
if(!location.hash)history.replaceState(null,"","#home");
setIdentity();render();ensureAuth();
})();