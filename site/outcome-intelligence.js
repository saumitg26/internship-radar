(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.InternshipOutcomeIntelligence=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const stages=new Set(["applied","oa","interview","offer","rejected"]);
 function analyze(records,now=new Date()){
  const all=Object.values(records||{}).filter(r=>r&&stages.has(r.status));
  const n=all.length,byStatus={applied:0,oa:0,interview:0,offer:0,rejected:0},byCompany={};
  all.forEach(r=>{byStatus[r.status]++;const name=String(r.job?.company||"Unknown");byCompany[name]=(byCompany[name]||0)+1});
  const interviews=byStatus.interview+byStatus.offer;
  const pending=byStatus.applied+byStatus.oa;
  const response=byStatus.oa+byStatus.interview+byStatus.offer+byStatus.rejected;
  let suggestions=[];
  if(n<5)suggestions.push("Record at least five applications before interpreting response patterns.");
  if(n>=5&&response/n<0.2)suggestions.push("Most applications still have no recorded response; check application dates and follow-up windows before drawing conclusions.");
  if(n>=10&&interviews===0)suggestions.push("No interviews recorded in this sample. Review role eligibility, job-specific tailoring, and application timing; this does not prove a resume problem.");
  if(pending>0)suggestions.push(pending+" applications are still pending; review their dates for a respectful follow-up.");
  return {total:n,byStatus,interviews,pending,responseRate:n?Math.round(response/n*100):0,interviewRate:n?Math.round(interviews/n*100):0,companies:Object.keys(byCompany).length,suggestions};
 }
 function verifySnapshot(job,feed){
  if(!job||!job.url)return {status:"unknown",reason:"No official posting URL"};
  const matching=(feed?.jobs||[]).some(j=>j.url===job.url||j.id===job.id);
  return {status:matching?"listed-in-feed":"not-in-feed",reason:matching?"Present in the latest collected catalog; not proof the employer is still accepting applications.":"Not found in the latest catalog; do not infer that it has closed."};
 }
 return {analyze,verifySnapshot};
});