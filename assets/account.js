const cfg=window.MED_BACKEND||{},root=document.getElementById("account"),admin=document.getElementById("admin"),status=document.getElementById("status");
const $=id=>document.getElementById(id),esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const msg=t=>status.textContent=t||"";
let api,user,member,mode="signin",busy=false,recovery=false,createdCode="";
const next=()=>{const raw=new URLSearchParams(location.search).get("next");if(!raw||!raw.startsWith("/")||raw.startsWith("//"))return "/";try{const u=new URL(raw,location.origin);return u.origin===location.origin&&!u.pathname.startsWith("/account")&&!u.pathname.startsWith("/_auth")?u.pathname+u.search+u.hash:"/";}catch{return "/";}};
const rpc=async(name,args={})=>{const {data,error}=await api.rpc(name,args);if(error)throw Error(error.message);return data;};
const session=async()=>{const {data,error}=await api.auth.getSession();if(error)throw error;return data.session;};
async function openStudy(){
 const s=await session();if(!s||!member?.active)throw Error("Membership required.");
 if(cfg.protectedHosting){const r=await fetch("/_auth/session",{method:"POST",headers:{Authorization:"Bearer "+s.access_token}});if(!r.ok)throw Error("Could not establish protected session. Sign in again.");}
 location.assign(next());
}
function showSignIn(){
 admin.hidden=true;
 root.innerHTML='<h1>'+(mode==="signup"?"Create your free account":mode==="reset"?"Reset password":"Welcome back")+'</h1><p class="muted">Use your email address. A valid invitation is required to activate a student membership.</p><form id="login-form"><label for="email">Email address</label><input id="email" required type="email" autocomplete="email">'+(mode==="reset"?"":'<label for="password">Password (at least 8 characters)</label><input id="password" required minlength="8" type="password" autocomplete="'+(mode==="signup"?"new-password":"current-password")+'">')+(mode==="signup"?'<label for="invite">Invitation code</label><input id="invite" required maxlength="100" autocomplete="off" autocapitalize="characters" spellcheck="false"><p class="muted">The code is redeemed after email verification. Creating an email account alone does not grant access.</p>':"")+'<button class="primary" type="submit">'+(mode==="signup"?"Create free account":mode==="reset"?"Send reset email":"Sign in")+'</button></form><button data-action="mode" data-mode="'+(mode==="signup"?"signin":"signup")+'">'+(mode==="signup"?"Already registered? Sign in":"Create free account")+'</button><button data-action="mode" data-mode="reset">Forgot password?</button>'+(cfg.protectedHosting?"":'<p class="muted">Public preview hosting: study files are not private yet.</p><a class="link" href="/">Return to study site</a>');
}
function showRecovery(){admin.hidden=true;root.innerHTML='<h1>Choose a new password</h1><form id="recovery-form"><label for="new-password">New password</label><input id="new-password" type="password" minlength="8" autocomplete="new-password" required><button class="primary">Update password</button></form>';}
async function refresh(){
 const s=await session();user=s?.user||null;
 if(recovery){showRecovery();return;}
 if(!user){member=null;showSignIn();return;}
 member=await rpc("member_status");
 if(!member?.active){admin.hidden=true;root.innerHTML='<h1>Activate membership</h1><p class="muted">Signed in as '+esc(user.email)+'. Enter the invitation supplied by the administrator. Suspended students must contact the administrator.</p><form id="redeem-form"><label for="invite">Invitation code</label><input id="invite" required maxlength="100" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="primary">Activate access</button></form><button data-action="logout">Sign out</button>';
 const pending=sessionStorage.getItem("med-pending-invite");if(pending)$("invite").value=pending;return;}
 sessionStorage.removeItem("med-pending-invite");
 const {data:p,error}=await api.from("profiles").select("nickname,leaderboard_visible").eq("id",user.id).maybeSingle();if(error)throw error;
 root.innerHTML='<h1>Your study account</h1><p>'+esc(user.email)+'</p><p class="muted">'+(member.admin?"Administrator":"Active student membership")+'</p><form id="profile-form"><label for="nickname">Leaderboard display name</label><input id="nickname" minlength="2" maxlength="32" required value="'+esc(p?.nickname||"Student")+'"><label><input id="visible" type="checkbox" '+(p?.leaderboard_visible?"checked":"")+'> Opt in to the study leaderboard (nickname only)</label><button>Save profile</button></form><button class="primary" data-action="study">Open study platform →</button><button data-action="logout">Sign out</button><a class="link" href="/leaderboard.html">Leaderboard</a>';
 if(member.admin){admin.hidden=false;await showAdmin();}else admin.hidden=true;
}
async function showAdmin(){
 const [invites,members]=await Promise.all([rpc("admin_list_invites"),rpc("admin_list_members")]);
 admin.innerHTML='<h2>Admin · invitations and members</h2><p class="muted">Codes are generated securely, stored as hashes and displayed only when created. Copy the code before leaving.</p><form id="invite-form"><label for="label">Label (optional)</label><input id="label" maxlength="80" placeholder="e.g. GEMP1 group"><div class="row"><div><label for="uses">Maximum uses</label><input id="uses" type="number" value="1" min="1" max="100" required></div><div><label for="days">Expires in days</label><input id="days" type="number" value="7" min="1" max="365" required></div></div><button class="primary">Generate invitation</button></form>'+(createdCode?'<h3 style="margin-top:15px">New code</h3><code>'+esc(createdCode)+'</code><button data-action="copy">Copy code</button>':"")+'<h3 style="margin-top:24px">Invitations</h3><div class="scroll"><table><thead><tr><th>Label</th><th>Uses</th><th>Expires</th><th>Status</th><th></th></tr></thead><tbody>'+invites.map(i=>'<tr><td>'+esc(i.label||"Unlabelled")+'</td><td>'+i.uses+'/'+i.max_uses+'</td><td>'+esc(new Date(i.expires_at).toLocaleDateString())+'</td><td>'+ (i.revoked?"Revoked":new Date(i.expires_at)<=new Date()?"Expired":i.uses>=i.max_uses?"Exhausted":"Active")+'</td><td>'+(!i.revoked?'<button data-action="revoke" data-id="'+esc(i.id)+'">Revoke</button>':"")+'</td></tr>').join("")+'</tbody></table></div><h3 style="margin-top:24px">Members ('+members.length+')</h3><div class="scroll"><table><thead><tr><th>Email</th><th>Nickname</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>'+members.map(m=>'<tr><td>'+esc(m.email)+'</td><td>'+esc(m.nickname)+'</td><td>'+esc(m.role)+'</td><td>'+(m.active?"Active":"Suspended")+'</td><td>'+(m.role==="student"?'<button data-action="toggle" data-id="'+esc(m.id)+'" data-active="'+(!m.active)+'">'+(m.active?"Suspend":"Restore")+'</button>':"")+'</td></tr>').join("")+'</tbody></table></div>';
}
async function redeem(code){const r=await rpc("redeem_invite",{p_code:code.trim()});if(!r?.ok)throw Error(r?.error||"Invitation could not be redeemed.");sessionStorage.removeItem("med-pending-invite");await refresh();msg("Membership activated.");}
async function perform(fn){if(busy)return;busy=true;msg("");try{await fn();}catch(e){msg(e.message||"Please try again.");}finally{busy=false;}}
document.addEventListener("submit",e=>{e.preventDefault();const id=e.target.id;perform(async()=>{
 if(id==="login-form"){
  const email=$("email").value.trim(),password=$("password")?.value;
  if(mode==="reset"){const {error}=await api.auth.resetPasswordForEmail(email,{redirectTo:location.origin+"/account.html"});if(error)throw error;msg("If an account exists, a password reset email has been requested.");return;}
  if(mode==="signup"){const code=$("invite").value.trim();sessionStorage.setItem("med-pending-invite",code);const {data,error}=await api.auth.signUp({email,password,options:{emailRedirectTo:location.origin+"/account.html"}});if(error)throw error;if(data.session){await refresh();if(!member?.active)await redeem(code);}else msg("Check your email to verify your account. Keep your invitation code for activation.");}
  else{const {error}=await api.auth.signInWithPassword({email,password});if(error)throw error;await refresh();if(member?.active&&!member.admin&&new URLSearchParams(location.search).has("next"))await openStudy();}
 }else if(id==="redeem-form"){await redeem($("invite").value);}
 else if(id==="profile-form"){const {error}=await api.from("profiles").upsert({id:user.id,nickname:$("nickname").value.trim(),leaderboard_visible:$("visible").checked});if(error)throw error;msg("Profile saved.");}
 else if(id==="invite-form"){const x=await rpc("admin_create_invite",{p_label:$("label").value,p_max_uses:Number($("uses").value),p_days:Number($("days").value)});createdCode=x.code;await showAdmin();}
 else if(id==="recovery-form"){const {error}=await api.auth.updateUser({password:$("new-password").value});if(error)throw error;recovery=false;await refresh();msg("Password updated.");}
});});
document.addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(!b)return;perform(async()=>{switch(b.dataset.action){
 case "mode":mode=b.dataset.mode;showSignIn();break;
 case "study":await openStudy();break;
 case "logout":{const {error}=await api.auth.signOut();if(error)throw error;if(cfg.protectedHosting)await fetch("/_auth/logout",{method:"POST"});sessionStorage.removeItem("med-pending-invite");createdCode="";mode="signin";await refresh();break;}
 case "copy":await navigator.clipboard.writeText(createdCode);msg("Code copied.");break;
 case "revoke":await rpc("admin_revoke_invite",{p_id:b.dataset.id});await showAdmin();break;
 case "toggle":await rpc("admin_set_member",{p_id:b.dataset.id,p_active:b.dataset.active==="true"});await showAdmin();break;
}});});
try{
 if(!cfg.url||!(cfg.publishableKey||cfg.anonKey))throw Error("Accounts are not connected yet. The owner must configure Supabase.");
 const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");api=createClient(cfg.url,cfg.publishableKey||cfg.anonKey);
 // Supabase emits PASSWORD_RECOVERY on a recovery link; keep callback synchronous.
 api.auth.onAuthStateChange(event=>{if(event==="PASSWORD_RECOVERY"){recovery=true;showRecovery();}});
 await refresh();
}catch(e){root.innerHTML='<h1>Account service unavailable</h1><p class="muted">'+esc(e.message)+'</p>'+(cfg.protectedHosting?"":'<a class="link" href="/">Return to public study site</a>');}
