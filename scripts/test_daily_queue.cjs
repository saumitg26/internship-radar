/* Run using node scripts/test_daily_queue.cjs. The shortlist never submits anything. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const Daily=require("../site/daily-queue.js");
const now=new Date(2026,9,26,12);
const good=(id,title,location,opts={})=>Object.assign({
  id,company:"Company "+id,title,location,
  url:"https://jobs.example/"+id,description:"Java Python SQL intern",
  score:70,source:"Greenhouse",discovered_on:"2026-10-25"
},opts);
const prefs=Daily.preferences({role:"swe",location:"dmv",skills:" Java, Python, java, \tAWS, "});
assert.deepEqual(prefs,{role:"swe",location:"dmv",skills:"java, python, aws"});
assert.equal(Daily.preferences(null).role,"swe");
assert.equal(Daily.preferences({role:"nonsense",location:"x"}).location,"dmv");
assert.equal(Daily.safeUrl("javascript:alert(1)"),"");
assert.equal(Daily.safeUrl("http://jobs.example/a"),"");
assert.equal(Daily.canonicalUrl("https://jobs.example/a/?utm_source=site#read"),
                   Daily.canonicalUrl("https://jobs.example/a"));
const list=[
 good("a","Software Engineer Intern","Fairfax, VA"),
 good("b","Data Science Intern","Boston, MA",{score:95}),
 good("c","Software Engineer Intern","Seattle, WA",{score:50}),
 good("d","Cloud Engineering Intern","Remote",{score:65}),
 good("e","Software Engineer Intern","Reston, VA",{community:true,eligibility_notes:["Junior only"]}),
 good("f","Software Engineer Intern","Washington, DC",{url:""}),
 good("g","Software Engineer Intern","Fairfax, VA",{url:"http://jobs.example/g"}),
 good("h","Software Engineer Intern","Fairfax, VA",{status:"closed"}),
 good("duplicate","Software Engineer Intern","Fairfax, VA",{url:"https://jobs.example/a?utm_source=duplicate"})
];
let ranked=Daily.build(list,{},prefs,10,now);
assert.ok(ranked.length>=4);
assert.ok(ranked[0].job.id==="a","Skill and region preferences should be weighted");
assert.equal(ranked.some(x=>x.job.id==="f"),false,"No link is excluded");
assert.equal(ranked.some(x=>x.job.id==="g"),false,"Insecure URL is excluded");
assert.equal(ranked.some(x=>x.job.id==="h"),false,"Explicitly closed listing is excluded");
assert.equal(ranked.some(x=>x.job.id==="duplicate"),false,"Tracking URLs deduplicate");
assert.ok(ranked[0].reasons.some(x=>x.startsWith("Mentions java")));
assert.ok(ranked[0].reasons.includes("Preferred region"));
assert.ok(ranked.find(x=>x.job.id==="e").warnings.includes("Junior only"),"Eligibility warnings retained");
assert.ok(ranked.find(x=>x.job.id==="e").points<ranked[0].points,"Warnings are penalized");
const records={
 already:{status:"applied",job:{id:"manual",url:"https://jobs.example/a?utm_campaign=x"}},
 skipped:{status:"skipped",job:{id:"b",url:"https://jobs.example/b"}},
 saved:{status:"saved",job:{id:"c",url:"https://jobs.example/c"}}
};
ranked=Daily.build(list,records,prefs,10,now);
assert.equal(ranked.some(x=>x.job.id==="a"),false,"Manual applications on same canonical URL block suggestion");
assert.equal(ranked.some(x=>x.job.id==="b"),false,"Skipped status excluded");
assert.ok(ranked.find(x=>x.job.id==="c").reasons.includes("Saved by you"));
let many=Array.from({length:7},(_,i)=>good("a"+i,"Software Engineer Intern "+i,"Fairfax, VA",{company:"Same Company"}))
  .concat(Array.from({length:7},(_,i)=>good("b"+i,"Software Developer Intern "+i,"Reston, VA",{company:"Other "+i})));
let diversified=Daily.build(many,{},prefs,10,now);
assert.equal(diversified.length,10);
assert.ok(diversified.filter(x=>x.job.company==="Same Company").length<=2,"Companies limited when enough alternatives exist");
let all=Daily.build(many,{},prefs,30,now);
assert.equal(all.length,14,"If variety is exhausted, remaining leads may still be presented");
assert.deepEqual(Daily.build(many,{},prefs,10,now).map(x=>x.job.id),diversified.map(x=>x.job.id),"Deterministic ranking");
const html=fs.readFileSync("site/index.html","utf8");
for(const id of ["daily","dailyList","dailyFocus","dailyEmployer","dailyConfirm","dailyApplied","dailyPreferences","dailyResume","dailyNext"]){
 assert.ok(html.includes('id="'+id+'"'),"Daily UI includes "+id);
}
assert.ok(html.includes("renderDaily();"),"Daily queue renders from existing application state");
assert.ok(html.includes('data-page="daily"'),"Daily 10 has a separate navigation destination");
assert.ok(html.includes("dailyConfirm").valueOf(),"A user-confirmation checkbox is present");
console.log("PASS: explainable ranking, preferences, deduplication, eligibility, diversity, confirmation UI and stable output");
