// Copy the site's explicitly allowed public-facing assets, never repository internals.
import {cp,mkdir,rm,readFile,writeFile} from "node:fs/promises";
const dist=new URL("../private-dist/",import.meta.url);
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
for(const p of ["assets","data","index.html","account.html","leaderboard.html","cluster-practice.html","eye.html","flashcards.html","gemp2-eye-2026.html","legacy.html","msk.html"]){
 await cp(new URL("../"+p,import.meta.url),new URL(p,dist),{recursive:true});
}
console.log("private-dist ready; deploy only behind the Worker.");
