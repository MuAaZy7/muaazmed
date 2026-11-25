/* Import the original 117-cluster Paper 2 master bank as validated data, never executable code. */
(function(){
"use strict";
const KEY="muaazmed-paper2-master-bank-v1";
const text=v=>typeof v==="string"&&v.trim().length>0;
function validate(rows){
 if(!Array.isArray(rows)||rows.length!==117)throw Error("Expected the complete 117-cluster master bank.");
 const ids=new Set();
 const topics=new Map();
 for(const c of rows){
  if(!Number.isInteger(c.id)||c.id<92001||c.id>92117||ids.has(c.id)||!text(c.title)||!text(c.scenario)||!Array.isArray(c.core)||c.core.length!==1||!text(c.core[0])||!["Renal","GIT","MSK","Haem/Onc","Crossover"].includes(c.module)||c.masterHard!==true||c.paper2Only!==true||c.difficulty!=="Hard"||!Array.isArray(c.questions)||c.questions.length!==8)throw Error("Invalid master cluster.");
  ids.add(c.id);topics.set(c.core[0],(topics.get(c.core[0])||0)+1);
  for(let i=0;i<8;i++){
   const q=c.questions[i];
   if(!q||q.number!==i+1||!text(q.q)||!text(q.explain)||!text(q.answer)||(i<6?(q.type!=="SBA"||!Array.isArray(q.options)||q.options.length!==4||!q.options.every(text)||new Set(q.options).size!==4||!/^[ABCD]$/.test(q.answer)||!!q.isData!==(i===5)):(q.type!=="VSAQ"||!!q.options?.length)))throw Error("Invalid question in cluster "+c.id+".");
  }
 }
 if(topics.size!==39||[...topics.values()].some(n=>n!==3))throw Error("Expected three cases per topic.");
 // Return only expected fields; do not carry arbitrary executable markup or metadata.
 return rows.map(c=>({id:c.id,title:c.title,scenario:c.scenario,core:c.core,module:c.module,difficulty:"Hard",masterHard:true,paper2Only:true,source:"Original Paper 2 master bank",questions:c.questions.map(q=>({number:q.number,type:q.type,q:q.q,answer:q.answer,explain:q.explain,...(q.type==="SBA"?{options:q.options,isData:!!q.isData}:{accepted:[]})}))})).sort((a,b)=>a.id-b.id);
}
function local(){try{return validate(JSON.parse(localStorage.getItem(KEY)||"null"));}catch(_){return [];}}
window.MED_MASTER_READY=(async()=>{
 let rows=[];
 try{
  const response=await fetch("data/paper2-master-hard.json",{cache:"no-cache",...(typeof AbortSignal!=="undefined"&&typeof AbortSignal.timeout==="function"?{signal:AbortSignal.timeout(5000)}:{})});
  if(response.ok)rows=validate(await response.json());
 }catch(_){}
 window.MED_MASTER_REMOTE=rows.length>0;
 window.MED_MASTER_HARD=rows.length?rows:local();
})();
document.addEventListener("change",async e=>{
 const input=e.target;
 if(input.id!=="master-hard-file"||!input.files?.length)return;
 const status=document.getElementById("master-hard-status");
 try{
  const file=input.files[0];if(file.size>2000000)throw Error("File is too large.");
  const rows=validate(JSON.parse(await file.text()));
  localStorage.setItem(KEY,JSON.stringify(rows));
  if(status)status.textContent="117 clusters imported. Reloading…";
  location.reload();
 }catch(err){if(status)status.textContent="Import failed: "+err.message;input.value="";}
});
})();