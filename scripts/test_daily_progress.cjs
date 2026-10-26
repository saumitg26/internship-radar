/* Run using node scripts/test_daily_progress.cjs. No browser or network needed. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const Progress=require("../site/progress.js");
function row(id,at,url,status="applied"){
  return {status,applied_at:at,job:{id,company:"Company "+id,title:"Software Intern",url:url||""}};
}
const now=new Date(2026,9,26,12);
const iso=(day,hour=11)=>new Date(2026,9,day,hour).toISOString();
assert.deepEqual(Progress.goalSteps(10),[2,5,8,10]);
assert.deepEqual(Progress.goalSteps(3),[1,2,3]);
assert.deepEqual(Progress.goalSteps(1),[1]);
assert.equal(Progress.dateKey(now),"2026-10-26");
assert.equal(Progress.dateKey("garbage"),"");
assert.equal(Progress.canonicalUrl("https://jobs.example/jobs/1/?utm_source=mail#apply"),
                   Progress.canonicalUrl("https://jobs.example/jobs/1"));
const empty=Progress.summary({},10,now);
assert.equal(empty.today,0);
assert.equal(empty.percent,0);
assert.equal(empty.remaining,10);
assert.equal(empty.week.length,7);
assert.equal(empty.activeDays,0);
assert.match(Progress.message(empty),/first submission/i);
const records={
 a:row("a",iso(26),"https://jobs.example/jobs/1?utm_source=newsletter"),
 duplicate:row("duplicate",iso(26),"https://jobs.example/jobs/1"),
 b:row("b",iso(26),"https://jobs.example/jobs/2"),
 prior:row("prior",iso(25),"https://jobs.example/jobs/3"),
 saved:row("saved",iso(26),"https://jobs.example/jobs/4","saved"),
 skipped:row("skipped",iso(26),"https://jobs.example/jobs/5","skipped"),
 future:row("future",iso(27),"https://jobs.example/jobs/6")
};
let result=Progress.summary(records,10,now);
assert.equal(result.today,2,"A repeated application URL counts once");
assert.equal(result.total,3,"Past, uniquely submitted applications also count toward total");
assert.equal(result.weeklyTotal,3);
assert.equal(result.activeDays,2);
assert.equal(result.remaining,8);
assert.equal(result.percent,20);
assert.equal(result.nextStep,5);
assert.equal(result.week[5].count,1);
assert.equal(result.week[6].count,2);
assert.ok(!result.complete);
for(let n=3;n<=10;n++)records["more-"+n]=row("more-"+n,iso(26),"https://jobs.example/jobs/"+(10+n));
result=Progress.summary(records,10,now);
assert.equal(result.today,10);
assert.equal(result.remaining,0);
assert.equal(result.percent,100);
assert.equal(result.nextStep,null);
assert.ok(result.complete);
assert.match(Progress.message(result),/goal complete/i);
records.extra=row("extra",iso(26),"https://jobs.example/jobs/99");
result=Progress.summary(records,10,now);
assert.equal(result.today,11,"Users may exceed the daily target");
assert.equal(result.percent,100,"Progress width must be capped at 100 percent");
const small=Progress.summary({x:row("x",iso(26),"")},1,now);
assert.equal(small.nextStep,null);
assert.ok(small.complete);
const html=fs.readFileSync("site/index.html","utf8");
for(const id of ["momentumPanel","momentumCount","momentumGoal","momentumTrack","momentumBar","momentumMilestones","momentumAction","momentumWeek"]){
  assert.ok(html.includes('id="'+id+'"'),"Dashboard exposes "+id);
}
assert.ok(html.includes('<script src="progress.js"></script>'),"Progress calculations loaded in dashboard");
assert.ok(html.includes("renderMomentum();"),"Progress widget re-renders with application state");
console.log("PASS: daily goal progress, source deduplication, future dates, milestones, weekly activity, UI wiring.");
