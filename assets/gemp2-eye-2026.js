/* GEMP2 EYE 2026 practice engine. Vanilla JS; works on GitHub Pages with no login. */
(function(){
"use strict";
var raw=Array.isArray(window.GEMP2_EYE_BANK)?window.GEMP2_EYE_BANK:[];
var caseText=window.GEMP2_EYE_CASES||{};
var app=document.getElementById("gemp26");
var sections=[
{id:1,title:"Neuro & psychiatry",sub:"Source pages 1–3",desc:"Earlier GEMP2 recall"},
{id:2,title:"MSK, rheumatology & pharmacology",sub:"Source pages 4–5",desc:"Earlier GEMP2 recall"},
{id:3,title:"General medicine & paediatrics",sub:"Source page 6",desc:"Earlier GEMP2 recall"},
{id:4,title:"Reproductive health & resuscitation",sub:"Source page 7",desc:"Earlier GEMP2 recall"},
{id:5,title:"Integrated recalled cases — A",sub:"Source page 8",desc:"End-year integrated section"},
{id:6,title:"Integrated recalled cases — B",sub:"Source page 9",desc:"End-year integrated section • incomplete source"}
];
var bank=raw.filter(function(x){return x&&Array.isArray(x.options)&&x.options.length===4&&Array.isArray(x.why)&&x.why.length===4&&Number.isInteger(x.correct)&&x.correct>=0&&x.correct<4;}).map(function(x,i){return Object.assign({id:"gemp2-2026-q"+i},x)});
var key="muaazmed:gemp2eye2026:v1";
var saved={};try{saved=JSON.parse(localStorage.getItem(key)||"{}")||{}}catch(e){saved={}}
var config={section:"integrated",paper:"All",block:"All",shuffle:true,missed:false};
var deck=[],cursor=0,sessionAnswers={};
var escapeHtml=function(x){return String(x==null?"":x).replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]})};
var esc=escapeHtml;
var el=function(id){return document.getElementById(id)};
var sect=function(i){return sections.filter(function(s){return s.id===i})[0]||{title:"Source section"}};
var label=function(b){return b==="Other"?"Other GEMP2 blocks":b};
var randomize=function(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a};
var qualify=function(x,skipBlock){return (config.section==="integrated"?x.section>=5:config.section==="all"||String(x.section)===config.section)&&(config.paper==="All"||x.paper===config.paper)&&(skipBlock||config.block==="All"||x.block===config.block)&&(!config.missed||saved[x.id]&&saved[x.id].correct===false)};
var selected=function(skipBlock){return bank.filter(function(x){return qualify(x,!!skipBlock)})};
var blocks=function(){return Array.from(new Set(selected(true).map(function(x){return x.block}))).sort()};
function save(){try{localStorage.setItem(key,JSON.stringify(saved))}catch(e){}}
function buildDeck(){
 var current=selected(false).sort(function(a,b){return a.section-b.section}), groupMap={},groups=[];
 current.forEach(function(x){
  var group=String(x.section)+"|"+x.case+"|"+x.block;
  if(!groupMap[group]){groupMap[group]=[];groups.push(group)}
  groupMap[group].push(x)
 });
 if(config.shuffle)groups=randomize(groups);
 return groups.reduce(function(arr,g){return arr.concat(groupMap[g])},[]);
}
function counts(){var total=bank.length,stored=Object.values(saved);return{total:total,answered:stored.length,correct:stored.filter(function(x){return x.correct}).length,integrated:bank.filter(function(x){return x.section>=5}).length}}
function startScreen(){
 var st=counts(), eligible=selected(false).length;
 var out='<div class="g-hero"><a class="g-back" href="index.html#practice">← Back to Practice Questions</a>'+
 '<div class="g-eyebrow">MUAAZMED / PAST PAPER PRACTICE</div>'+
 '<h1 class="g-title">GEMP2 EYE 2026 <span style="color:#5d7fbe">Recalled Past Papers</span></h1>'+
 '<p class="g-lead">Practise questions reconstructed from the uploaded student-recall sheet. Choose an option to see an immediate verdict and a separate clinical explanation for <strong>all four choices</strong>. The two final source sections are kept as separate integrated case collections.</p>'+
 '<div class="g-tagrow"><span class="g-tag">Paper 1 · BCMH / CVS / Respiratory</span><span class="g-tag">Paper 2 · Renal / GIT / MSK / Haem/Onc</span><span class="g-tag">Six original source sections</span></div></div>';
 out+='<div class="g-disclaimer"><strong>Source accuracy:</strong> These are student recollections, not verified official Wits papers. Original missing answer choices were reconstructed for study. <strong>Section 6 (PDF page 9) mainly contains headings, not full question stems</strong>; practice made from those headings is clearly marked as original topic practice. Questions outside your study breakdown are labelled separately. Clinical decisions must follow current local protocols.</div>';
 out+='<div class="g-cards"><div class="g-card"><b>'+st.total+'</b><span>Four-option practice questions</span></div><div class="g-card"><b>'+st.integrated+'</b><span>Integrated-section questions</span></div><div class="g-card"><b>'+st.answered+'</b><span>Questions tried on this device</span></div></div>';
 out+='<h2 class="g-section-title">Select a source section</h2><div class="g-sections">';
 var choices=[{id:"integrated",title:"Integrated EYE (both)",sub:"Final two source pages",desc:"Default · 2026 EYE practice"},{id:"all",title:"All six sections",sub:"Whole uploaded PDF",desc:"Mix older GEMP2 and EYE recall"}].concat(sections);
 choices.forEach(function(s){var n=bank.filter(function(x){return s.id==="integrated"?x.section>=5:s.id==="all"||x.section===s.id}).length;
 out+='<button type="button" class="g-section '+(String(config.section)===String(s.id)?"active":"")+'" data-section="'+esc(s.id)+'"><small>'+esc(s.sub)+'</small><strong>'+esc(s.title)+'</strong><span>'+n+' questions · '+esc(s.desc)+'</span></button>'
 });
 out+='</div><section class="g-controls"><div class="g-filter-grid">';
 out+='<div class="g-field"><label for="g-paper">Study breakdown</label><select id="g-paper">';
 ["All","Paper 1","Paper 2","Other"].forEach(function(p){out+='<option value="'+p+'" '+(config.paper===p?"selected":"")+'>'+label(p)+'</option>'});out+='</select></div>';
 var bs=blocks();if(config.block!=="All"&&bs.indexOf(config.block)===-1)config.block="All";
 out+='<div class="g-field"><label for="g-block">Block</label><select id="g-block"><option value="All">All relevant blocks</option>';
 bs.forEach(function(b){out+='<option '+(config.block===b?"selected":"")+' value="'+esc(b)+'">'+esc(b)+'</option>'});out+='</select></div>';
 out+='<div class="g-field"><label>Question format</label><div style="background:#f5f8fc;border:1px solid #e0e7f1;border-radius:10px;min-height:46px;display:flex;align-items:center;padding:10px 12px;color:#435f87;font-size:12px;font-weight:800">Single-best-answer · 4 options</div></div></div>';
 out+='<div class="g-control-bottom"><label class="g-switch"><input type="checkbox" id="g-shuffle" '+(config.shuffle?"checked":"")+'> Randomise case-cluster order</label>'+
 '<label class="g-switch"><input type="checkbox" id="g-missed" '+(config.missed?"checked":"")+'> Only previously incorrect questions</label>'+
 '<button class="g-btn primary" id="g-start" '+(eligible?"":"disabled")+'>Start continuous practice ('+eligible+')</button></div>';
 out+='<p class="g-controls-hint">A cluster keeps its questions together, even when randomised. Case diagnoses are hidden while answering; they appear after submission. Paper 1/Paper 2 grouping follows your <em>existing study split</em>, not an asserted official GEMP2 exam allocation.</p></section>';
 out+='<div class="g-smallprint">Fact-check notes: “malignant hyperthermia” replaces the recall typo “hypothermia”; mitral stenosis obstructs left-atrium-to-left-ventricle inflow; the recalled asthma FEV1 change is computed against predicted FEV1. A topic heading alone is never represented as an actually recalled MCQ.</div>';
 out+='<div class="g-reference-links">Relevant clinical references: <a href="https://ginasthma.org/faq/" target="_blank" rel="noopener">GINA asthma diagnostic guidance</a> · <a href="https://www.who.int/teams/global-malaria-programme/case-management/treatment" target="_blank" rel="noopener">WHO malaria management</a> · <a href="https://www.resus.org.uk/professional-library/2025-resuscitation-guidelines/first-aid-guidelines" target="_blank" rel="noopener">Resuscitation Council 2025</a>.</div>';
 app.innerHTML=out;
 Array.from(app.querySelectorAll("[data-section]")).forEach(function(btn){btn.addEventListener("click",function(){config.section=btn.getAttribute("data-section");config.block="All";startScreen()})});
 el("g-paper").addEventListener("change",function(){config.paper=this.value;config.block="All";startScreen()});
 el("g-block").addEventListener("change",function(){config.block=this.value;startScreen()});
 el("g-shuffle").addEventListener("change",function(){config.shuffle=this.checked});
 el("g-missed").addEventListener("change",function(){config.missed=this.checked;startScreen()});
 if(el("g-start"))el("g-start").addEventListener("click",function(){deck=buildDeck();cursor=0;sessionAnswers={};if(deck.length)renderQuestion()});
}
function infoForQuestion(q){
 var count=0,ord=0,seen={};
 deck.forEach(function(x){var k=String(x.section)+"|"+x.case;if(!seen[k]){seen[k]=++count}if(x.id===q.id)ord=seen[k]});
 return "Case cluster "+ord+" · "+sect(q.section).title;
}
function renderQuestion(){
 if(cursor>=deck.length){finishScreen();return}
 var q=deck[cursor],selection=sessionAnswers[q.id],done=selection!==undefined;
 var n=Object.keys(sessionAnswers).length, correct=Object.keys(sessionAnswers).filter(function(id){var x=deck.filter(function(z){return z.id===id})[0];return x&&x.correct===sessionAnswers[id]}).length;
 var out='<div class="g-toolbar"><button class="g-btn" id="g-exit">← Filters</button><div class="g-eyebrow">'+esc(infoForQuestion(q))+'</div></div>'+
 '<div class="g-progress"><div class="g-progress-top"><span>Question '+(cursor+1)+' of '+deck.length+'</span><span>'+n+' answered · '+correct+' correct</span></div><div class="g-progress-track"><div style="width:'+Math.round(cursor/deck.length*100)+'%"></div></div></div>'+
 '<article class="g-question"><div class="g-qmeta">'+esc(sect(q.section).sub)+' · '+esc(q.paper==="Other"?"Other GEMP2":q.paper)+' · '+esc(q.block)+'</div>';
 if(caseText[q.case])out+='<div class="g-case">'+esc(caseText[q.case])+'</div>';
 out+='<h2>'+esc(q.question)+'</h2><div class="g-opts">';
 q.options.forEach(function(option,i){
  var state=done&&i===q.correct?" correct":done&&i===selection&&i!==q.correct?" incorrect":"";
  var mark=done&&i===q.correct?' <span aria-label="Correct">✓</span>':done&&i===selection?' <span aria-label="Your incorrect answer">✕</span>':'';
  out+='<button class="g-option'+state+'" data-pick="'+i+'" '+(done?"disabled":"")+'><span class="g-letter">'+String.fromCharCode(65+i)+'</span><span>'+esc(option)+'</span>'+mark+'</button>';
 });
 out+='</div>';
 if(done){
  var good=selection===q.correct;
  out+='<section class="g-feedback" aria-live="polite"><div class="g-feedback-head '+(good?"":"bad")+'">'+(good?"✓ Correct answer":"✕ Not quite — learn from this")+'</div>'+
  '<div class="g-answer"><strong>Correct: '+String.fromCharCode(65+q.correct)+'. '+esc(q.options[q.correct])+'</strong></div>'+
  '<strong style="font-size:12px;color:#395b87">WHY EACH OPTION IS RIGHT OR WRONG</strong><div class="g-why">';
  q.options.forEach(function(option,i){
   out+='<div class="g-reason '+(i===q.correct?"right":i===selection?"chosen-wrong":"")+'"><strong>'+String.fromCharCode(65+i)+'. '+(i===q.correct?"CORRECT":"INCORRECT")+' — '+esc(option)+'</strong><p>'+esc(q.why[i])+'</p></div>'
  });
  out+='</div><div class="g-context">'+(q.kind==="topic-practice"?"<strong>Source transparency:</strong> The PDF supplies this topic heading but not a complete remembered MCQ. This is a new teaching question, not a recovered exam item.":"<strong>Source transparency:</strong> The prompt is based on a student recall, with reconstructed choices and reviewer explanations.")+
  '<div style="margin-top:6px">Revealed case: <strong>'+esc(q.case.replace(/-/g," "))+'</strong>.</div></div></section>'
 }
 out+='<div class="g-actions"><button class="g-btn" id="g-leave">Back to filters</button><button class="g-btn primary" id="g-next" '+(!done?"disabled":"")+'>'+(cursor===deck.length-1?"Finish session":"Next question →")+'</button></div></article>';
 app.innerHTML=out;
 Array.from(app.querySelectorAll("[data-pick]")).forEach(function(btn){btn.addEventListener("click",function(){
  if(sessionAnswers[q.id]!==undefined)return;
  var pick=Number(btn.getAttribute("data-pick"));sessionAnswers[q.id]=pick;
  saved[q.id]={correct:pick===q.correct,selected:pick,at:new Date().toISOString()};save();renderQuestion();
  var feedback=app.querySelector(".g-feedback");if(feedback){feedback.scrollIntoView({behavior:"smooth",block:"nearest"})}
 })});
 el("g-next").addEventListener("click",function(){cursor+=1;renderQuestion();window.scrollTo({top:0,behavior:"auto"})});
 el("g-exit").addEventListener("click",startScreen);
 el("g-leave").addEventListener("click",startScreen);
}
function finishScreen(){
 var n=Object.keys(sessionAnswers).length,k=deck.filter(function(x){return sessionAnswers[x.id]===x.correct}).length;
 var missed=deck.filter(function(x){return sessionAnswers[x.id]!==x.correct});
 app.innerHTML='<div class="g-finish"><div class="g-eyebrow">SESSION COMPLETE</div><h2>'+k+' / '+n+' correct</h2><p>You completed '+n+' question'+(n===1?"":"s")+'. Every result is stored on this device for missed-question revision. Review the '+missed.length+' incorrect question'+(missed.length===1?"":"s")+' to improve clinical reasoning.</p><div class="g-actions"><button class="g-btn primary" id="g-back">Change filters / practise again</button>'+(missed.length?'<button class="g-btn" id="g-redo">Redo missed from this session</button>':'')+'</div></div>';
 el("g-back").addEventListener("click",startScreen);
 if(el("g-redo"))el("g-redo").addEventListener("click",function(){deck=missed;cursor=0;sessionAnswers={};renderQuestion()});
}
document.addEventListener("keydown",function(e){
 if(e.altKey||e.ctrlKey||e.metaKey||/INPUT|SELECT|TEXTAREA/.test(document.activeElement&&document.activeElement.tagName||""))return;
 if(!deck.length||!app.querySelector(".g-question"))return;
 var q=deck[cursor];if(!q)return;
 if(/^[1-4]$/.test(e.key)&&sessionAnswers[q.id]===undefined){var b=app.querySelector('[data-pick="'+(Number(e.key)-1)+'"]');if(b)b.click()}
 if(e.key.toLowerCase()==="n"&&sessionAnswers[q.id]!==undefined){el("g-next").click()}
});
var mobile=el("g-mobile");if(mobile)mobile.addEventListener("click",function(){el("sidebar").classList.toggle("cp-open");var s=el("sidebar");s.style.transform=s.classList.contains("cp-open")?"translateX(0)":"translateX(-100%)";s.style.zIndex="1000"});
startScreen();
})();