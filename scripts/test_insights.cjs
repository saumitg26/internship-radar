/* Run with node scripts/test_insights.cjs. Deterministic, local-only tests. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const Insights=require("../site/insights.js");
const now=new Date(2026,9,26,16);
function timestamp(day){return new Date(2026,9,day,11).toISOString();}
function row(id,day,status,url){
 return {status:status||"applied",applied_at:day?timestamp(day):null,
   job:{id,company:"Employer "+id,title:"Software Intern",url:url||""}};
}
let records={
 a:row("a",26,"applied","https://jobs.example/a?utm_source=mail"),
 b:row("b",26,"oa","https://jobs.example/b"),
 c:row("c",23,"interview","https://jobs.example/c"),
 d:row("d",20,"offer","https://jobs.example/d"),
 e:row("e",15,"rejected","https://jobs.example/e"),
 f:row("f",12,"applied","https://jobs.example/f"),
 old:row("old",5,"applied","https://jobs.example/old"),
 duplicate:row("duplicate",26,"applied","https://jobs.example/a"),
 saved:row("saved",26,"saved","https://jobs.example/saved"),
 skipped:row("skipped",26,"skipped","https://jobs.example/skipped"),
 incomplete:row("incomplete",null,"interview","https://jobs.example/incomplete"),
 future:row("future",27,"applied","https://jobs.example/future")
};
let s=Insights.calculate(records,{range:"7",now,goal:2});
assert.equal(s.submitted,4);
assert.equal(s.previous,1);
assert.equal(s.delta,3);
assert.equal(s.stage.applied,1);
assert.equal(s.stage.oa,1);
assert.equal(s.stage.interview,1);
assert.equal(s.stage.offer,1);
assert.equal(s.stage.rejected,0);
assert.equal(s.responseCount,3);
assert.equal(s.responseRate,75);
assert.equal(s.goalDays,1);
assert.equal(s.activeDays,3);
assert.equal(s.perActiveDay,4/3);
assert.equal(s.chart.length,7);
assert.equal(s.chart.reduce((acc,b)=>acc+b.count,0),4);
assert.ok(s.suggestions.some(x=>x.page==="pipeline"));
assert.equal(s.saved,1);
s=Insights.calculate(records,{range:"30",now,goal:10});
assert.equal(s.submitted,7,"Old completed applications still count inside the 30-day range");
assert.equal(s.reviewCount,2,"Old unchanged submitted roles are suggested for status review");
assert.equal(s.stage.rejected,1);
assert.equal(s.chart.length,10);
assert.equal(s.chart.reduce((acc,b)=>acc+b.count,0),7);
assert.equal(s.goalDays,0);
assert.equal(s.responseCount,4);
s=Insights.calculate(records,{range:"90",now});
assert.equal(s.chart.length,13);
assert.equal(s.chart.reduce((acc,b)=>acc+b.count,0),7);
s=Insights.calculate(records,{range:"all",now});
assert.equal(s.submitted,7);
assert.equal(s.previous,null);
assert.equal(s.chart.length,13);
assert.equal(s.chart.reduce((acc,b)=>acc+b.count,0),7);
assert.equal(Insights.ageCalendarDays("2026-10-12","2026-10-26"),14);
assert.equal(Insights.calculate({},{range:"7",now}).responseRate,0);
assert.ok(Insights.calculate({},{range:"7",now}).suggestions.some(x=>x.page==="explore"));
assert.equal(Insights.entries(records,now).length,7);
const html=fs.readFileSync("site/index.html","utf8");
for(const id of ["insights","insightsRange","insightsBars","insightsStages","insightsActions","insightsRows","appliedDate"]){
 assert.ok(html.includes('id="'+id+'"'),"Dashboard contains "+id);
}
assert.ok(html.includes('<script src="insights.js"></script>'));
assert.ok(html.includes("renderInsights();"));
assert.ok(html.includes('data-page="insights"'));
console.log("PASS: analytics ranges, date groups, duplicate exclusion, stage counts, responses, overdue reviews and UI wiring");
