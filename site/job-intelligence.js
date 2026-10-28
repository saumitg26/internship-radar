/* Deterministic, explainable screening. No inflated hiring probabilities or fabricated ATS score. */
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.InternshipIntelligence=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const profile={graduationYear:2028,skills:["Python","Java","JavaScript","TypeScript","React","FastAPI","PostgreSQL","SQL","AWS","Git","R","Docker"],citizen:true};
 const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
 function evaluate(job,custom){
  const p=Object.assign({},profile,custom||{});
  const description=String(job.job_description||job.description||"");
  const title=String(job.title||"");
  const content=title+" "+description;
  const findings=[],blockers=[],uncertain=[];
  const year=Number(p.graduationYear);
  const ranges=[...description.matchAll(/(?:graduat(?:ing|ion|es)?|class of|degree completion|expected graduation)[^.!?\n]{0,75}?\b(20\d\d)\b/gi)].map(m=>Number(m[1]));
  const mustYear=description.match(/(?:must|required|only|exclusively)[^.!?\n]{0,85}(?:graduat(?:e|ing|ion)|class of)[^.!?\n]{0,60}\b(20\d\d)\b/i);
  if(mustYear&&year&&Number(mustYear[1])!==year){
   blockers.push("Graduation year "+mustYear[1]+" explicitly required; profile says "+year+".");
  }else if(ranges.length&&year&&!ranges.includes(year)){
   uncertain.push("Posting mentions graduation year "+[...new Set(ranges)].join(", ")+"; check eligibility.");
  }
  if(/\b(?:juniors? and seniors? only|only juniors? and seniors?|must be (?:a )?(?:junior|senior)|(?:junior|senior) standing required)\b/i.test(description)){
   uncertain.push("Class-standing restriction may apply; verify before applying.");
  }else if(/\b(?:junior|senior)(?:s)? (?:classification |standing )?preferred\b/i.test(description)){
   findings.push("Junior/senior preference, not an explicit exclusion.");
  }
  if(/(?:no (?:visa )?sponsorship|sponsorship (?:is )?not (?:available|provided))/i.test(description)){
   findings.push("No sponsorship: review work authorization.");
  }
  if(/(?:us|u s|u\.s\.) citizenship (?:is )?required|must be (?:a )?u\.?s\.? citizen/i.test(description)){
   if(p.citizen===false)blockers.push("Posting requires US citizenship.");
   else findings.push("US citizenship requirement noted.");
  }
  const matched=(p.skills||[]).filter(skill=>new RegExp("\\b"+String(skill).replace(/[.*+?^$\{\}()|[\]\\]/g,"\\$&")+"\\b","i").test(content));
  const majorMatch=/software|developer|backend|full.stack|data|cloud|ai|machine learning|cyber|technology|engineering/i.test(title);
  const signal=Math.min(100,Math.round(35+(majorMatch?25:0)+Math.min(30,matched.length*5)+(job.dmv_priority?10:0)));
  const evidence=description.length>300?"Detailed posting available":"Limited listing details; score is low-confidence";
  if(!job.job_description||description.length<=300)uncertain.push("Full employer requirements unavailable.");
  if(job.community)uncertain.push("Third-party listing: confirm the opening on employer site.");
  return {score:signal,matched:matched,findings:findings,blockers:blockers,uncertain:uncertain,evidence:evidence,verdict:blockers.length?"Review eligibility":uncertain.length?"Verify requirements":"Good candidate to review"};
 }
 return {evaluate:evaluate,profile:profile};
});
