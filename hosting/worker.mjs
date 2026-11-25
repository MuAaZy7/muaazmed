// Every asset, including legacy pages and raw answer-bank JS, is gated.
const publicPaths=new Set(["/account.html","/assets/account.js","/assets/account.css"]);
const cookieName="__Host-med_session";
const noStore={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"same-origin"};
function response(message,status=200,headers={}){return new Response(message,{status,headers:{...noStore,...headers}});}
function cookie(req){return (req.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(cookieName+"="))?.slice(cookieName.length+1)||"";}
function sameOrigin(req){return req.headers.get("Origin")===new URL(req.url).origin;}
function redirectLogin(req){const u=new URL(req.url);return response(null,302,{Location:"/account.html?next="+encodeURIComponent(u.pathname+u.search)});}
async function member(env,token){
 if(!token||token.length>8192||!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)return false;
 try{const r=await fetch(env.SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/rpc/member_status",{method:"POST",headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:"{}"});
 if(!r.ok)return false;return (await r.json())?.active===true;}catch{return false;}
}
async function asset(req,env){const result=await env.ASSETS.fetch(req);const headers=new Headers(result.headers);for(const [k,v] of Object.entries(noStore))headers.set(k,v);return new Response(result.body,{status:result.status,headers});}
export default {async fetch(req,env){
 const u=new URL(req.url),p=u.pathname;
 if(p==="/backend-config.js"&&["GET","HEAD"].includes(req.method)){
  const cfg={url:env.SUPABASE_URL||"",publishableKey:env.SUPABASE_PUBLISHABLE_KEY||"",protectedHosting:true};
  return response("window.MED_BACKEND="+JSON.stringify(cfg)+";",200,{"Content-Type":"application/javascript; charset=utf-8"});
 }
 if(p==="/_auth/session"){
  if(req.method!=="POST"||!sameOrigin(req))return response("Forbidden",403);
  const token=(req.headers.get("Authorization")||"").match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1]||"";
  if(!await member(env,token))return response("Membership required",403);
  return response("OK",200,{"Set-Cookie":cookieName+"="+token+"; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=3600"});
 }
 if(p==="/_auth/logout"){
  if(req.method!=="POST"||!sameOrigin(req))return response("Forbidden",403);
  return response("OK",200,{"Set-Cookie":cookieName+"=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0"});
 }
 if(!["GET","HEAD"].includes(req.method))return response("Method not allowed",405);
 if(publicPaths.has(p))return asset(req,env);
 if(!await member(env,cookie(req))){
  if(req.headers.get("Sec-Fetch-Dest")==="document"||req.headers.get("Accept")?.includes("text/html"))return redirectLogin(req);
  return response("Membership required",403);
 }
 return asset(req,env);
}};
