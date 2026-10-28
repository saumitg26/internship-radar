(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root){root.InternshipCopilot=api;if(root.document)root.document.addEventListener("DOMContentLoaded",api.init);}
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const safe=s=>String(s==null?"":s).trim();
 const lines=s=>safe(s).split(/\r?\n/).map(x=>x.replace(/^[•*-]\s*/,"").trim()).filter(x=>x.length>=18).slice(0,6);
 const clean=s=>safe(s).replace(/\s+/g," ");
 function draft(mode,data){
  const company=safe(data.company)||"the company",role=safe(data.role)||"this internship";
  const achievements=lines(data.evidence);
  const detail=clean(data.detail);
  const contact=safe(data.contact)||"Hiring Team";
  const evidence=achievements.length?achievements.slice(0,2).join(" Additionally, "):"";
  const interest=detail||"the opportunity to work on meaningful engineering challenges and learn from experienced teammates";
  if(mode==="answer")return "I'm interested in "+company+"'s "+role+" opportunity because of "+interest+". "+(evidence?"My background includes "+evidence+". ":"")+"I'd value the chance to contribute, learn from the team, and deepen my technical skills.";
  if(mode==="letter")return "Dear "+contact+",\n\nI'm applying for the "+role+" position at "+company+". What particularly interests me is "+interest+".\n\n"+(evidence?"Relevant experience from my resume includes "+evidence+".\n\n":"[Add one specific, verified example from your experience.]\n\n")+"I would welcome the opportunity to contribute to the team while learning from its engineers and partners. Thank you for considering my application.\n\nSincerely,\n[Your name]";
  if(mode==="outreach")return "Hi "+(contact==="Hiring Team"?"there":contact)+", I'm interested in the "+role+" opportunity at "+company+". "+(achievements[0]?"I've worked on "+achievements[0]+". ":"")+"I'd appreciate the chance to learn more about your team and what makes a candidate successful. Thank you!";
  if(mode==="interview")return "ROLE-SPECIFIC INTERVIEW PREPARATION — "+company+" / "+role+"\n\n1. Why this role? Explain your real interest: "+interest+".\n2. Explain an engineering or analytical project from your resume, including your exact contribution.\n3. What technical tradeoffs did you consider, and why?\n4. Describe a bug, reliability issue, or difficult problem you resolved.\n5. Explain how you collaborated with someone who had different priorities.\n6. What skills in the job description are you still developing?\n7. What would you ask the hiring manager about the work and mentorship?\n\nSTAR + Reflection framework for your evidence:\n"+(achievements.length?achievements.map((a,i)=>(i+1)+". "+a+"\n   Situation: [actual context]\n   Task: [your assignment]\n   Action: [what YOU did]\n   Result: [verifiable outcome]\n   Reflection: [what you'd improve]").join("\n\n"):"[Add actual achievement bullets above to build an evidence bank.]");
  if(mode==="research")return "COMPANY RESEARCH PLAN — "+company+"\n\nThis is a research checklist, NOT verified company research.\n\n1. Confirm the position is still live at the official employer careers site.\n2. Find the company's current products, customers, and business model.\n3. Review the team's technologies from the posting and official engineering material.\n4. Read recent official announcements relevant to this role.\n5. Verify salary, work arrangement, sponsorship, and graduation eligibility.\n6. Identify potential contacts only from public, trustworthy sources.\n7. Write a specific why-company statement after verifying evidence.\n\nOfficial job URL: "+safe(data.url||"[Add official employer link]")+"\n\nRole description excerpt: "+safe(data.description).slice(0,900);
  if(mode==="followup")return "Subject: Follow-up on "+role+" application\n\nHello "+contact+",\n\nI recently applied for the "+role+" position at "+company+" and wanted to reiterate my interest. "+(detail?"I'm particularly interested in "+interest+". ":"")+"I appreciate your consideration and would be happy to provide additional information about my experience.\n\nThank you,\n[Your name]\n\nSend only after checking the employer's requested communication process and allowing an appropriate response window.";
  if(mode==="negotiation")return "COMPENSATION CONVERSATION — "+company+" / "+role+"\n\nThank you for discussing compensation. I'm excited about the opportunity and would appreciate learning more about the established pay range for this internship. I'd be happy to discuss a fair rate based on the responsibilities, location, and overall program.\n\nBefore naming a figure: research real pay data for comparable internships, verify the employer's posted range, and factor in relocation or housing expenses. Do not invent competing offers.";
  return "";
 }
 const $=id=>document.getElementById(id);
 const key="internship-radar-copilot-draft-v1";
 function parseJob(){return (new URLSearchParams(location.search).get("job")||"").slice(0,180)}
 function setStatus(msg){$("draftStatus").textContent=msg}
 function save(){try{localStorage.setItem(key,JSON.stringify({mode:$("mode").value,company:$("company").value,role:$("role").value,output:$("output").value,savedAt:new Date().toISOString()}));setStatus("Draft saved in this browser. No external transmission.");}catch(e){setStatus("Local storage unavailable; copy the draft instead.")}}
 function openMaster(){return new Promise((resolve,reject)=>{if(!indexedDB)return reject(Error("No IndexedDB"));let req=indexedDB.open("internship-radar-resumes-v1",1);req.onerror=()=>reject(req.error);req.onupgradeneeded=()=>{req.transaction.abort()};req.onsuccess=()=>{let db=req.result;try{let tx=db.transaction(["kv","masters"],"readonly");let active=tx.objectStore("kv").get("active");active.onsuccess=()=>{if(!active.result){db.close();resolve(null);return}let r=tx.objectStore("masters").get(active.result.id);r.onsuccess=()=>{db.close();resolve(r.result||null)};r.onerror=()=>{db.close();reject(r.error)}};active.onerror=()=>{db.close();reject(active.error)}}catch(e){db.close();reject(e)}}})}
 function syncJob(j){$("company").value=j.company||"";$("role").value=j.title||"";$("description").value=j.job_description||j.description||"";showIntel()}
 function showIntel(){const engine=window.InternshipIntelligence;const details=$("description").value.trim();const node=$("intel");if(!details){node.textContent="Add an official job description for eligibility signals.";return}if(!engine){node.textContent="Eligibility engine not available.";return}let x=engine.evaluate({title:$("role").value,company:$("company").value,job_description:details});node.classList.toggle("warn",!!x.blockers.length);node.textContent=x.verdict+" · "+x.matched.length+" identified skills · "+x.blockers.concat(x.uncertain).slice(0,3).join(" · ")}
 function create(){const value=draft($("mode").value,{company:$("company").value,role:$("role").value,description:$("description").value,evidence:$("evidence").value,detail:$("detail").value,contact:$("contact").value,url:(window.INTERNSHIP_RADAR_FEED?.jobs||[]).find(j=>j.id===$("jobSelect").value)?.url});$("output").value=value;$("copy").disabled=!value;$("download").disabled=!value;$("save").disabled=!value;setStatus("Draft created locally. Verify facts, tone, and the current role before using it.");}
 function download(){const blob=new Blob([$("output").value],{type:"text/plain;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="application-draft.txt";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 async function init(){
  const jobs=Array.isArray(window.INTERNSHIP_RADAR_FEED?.jobs)?window.INTERNSHIP_RADAR_FEED.jobs:[];
  const select=$("jobSelect");
  jobs.filter(j=>j&&j.id&&j.title).slice(0,5000).forEach(j=>{const option=document.createElement("option");option.value=j.id;option.textContent=j.company+" — "+j.title;select.appendChild(option)});
  select.onchange=()=>{const j=jobs.find(x=>x.id===select.value);if(j)syncJob(j)};
  ["description","role","company"].forEach(id=>$(id).addEventListener("input",showIntel));
  const selected=parseJob();if(selected&&jobs.some(j=>j.id===selected)){select.value=selected;syncJob(jobs.find(j=>j.id===selected))}
  $("generate").onclick=create;
  $("copy").onclick=async()=>{try{await navigator.clipboard.writeText($("output").value);setStatus("Copied. Verify before sending.")}catch(e){$("output").focus();$("output").select();setStatus("Clipboard unavailable; select and copy the draft manually.")}};
  $("download").onclick=download;$("save").onclick=save;
  $("clear").onclick=()=>{$("output").value="";$("copy").disabled=true;$("save").disabled=true;$("download").disabled=true;setStatus("Draft cleared.")};
  $("output").oninput=()=>{$("copy").disabled=!$("output").value;$("save").disabled=!$("output").value;$("download").disabled=!$("output").value};
  try{let master=await openMaster();if(master){$("masterStatus").textContent="Saved master found: "+master.filename+". Select and verify the evidence below.";const bullets=lines(master.text).filter(l=>/\b(built|developed|evaluated|integrated|analyzed|implemented|created|collaborated|designed|tested|led|researched)\b/i.test(l));$("evidence").value=bullets.slice(0,4).join("\n")}else{$("masterStatus").textContent="No saved master found. Add verified achievements manually, or upload your resume in Resume Studio."}}catch(e){$("masterStatus").textContent="Saved master unavailable in this browser. Add verified achievements manually."}
  showIntel();
 }
 return {draft,init,lines};
});
