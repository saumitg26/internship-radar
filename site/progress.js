/* Daily momentum calculations. No account, analytics, or network requests. */
(function(root,factory){
  "use strict";
  var api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.InternshipProgress=api;
})(typeof window!=="undefined"?window:null,function(){
  "use strict";
  function dateKey(value){
    var date=value instanceof Date?value:new Date(value);
    if(!Number.isFinite(date.getTime()))return "";
    var y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0");
    return y+"-"+m+"-"+String(date.getDate()).padStart(2,"0");
  }
  function offsetKey(now,days){
    return dateKey(new Date(now.getFullYear(),now.getMonth(),now.getDate()+days,12));
  }
  function canonicalUrl(value){
    try{
      var url=new URL(String(value||""));
      if(url.protocol!=="https:"&&url.protocol!=="http:")return "";
      url.hash="";
      ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","ref","source","referrer","gh_src"].forEach(function(key){url.searchParams.delete(key);});
      return url.hostname.toLowerCase()+url.pathname.replace(/\/+$/,"")+url.search;
    }catch(e){return "";}
  }
  function goalSteps(goal){
    return Array.from(new Set([Math.ceil(goal*.2),Math.ceil(goal*.5),Math.ceil(goal*.8),goal])).sort(function(a,b){return a-b;});
  }
  function summary(records,goal,now){
    var at=now instanceof Date?now:new Date(now||Date.now());
    if(!Number.isFinite(at.getTime()))at=new Date();
    goal=Number.isInteger(Number(goal))&&Number(goal)>=1&&Number(goal)<=30?Number(goal):10;
    var counts=Object.create(null),seen=new Set(),all=[];
    Object.keys(records||{}).forEach(function(id){
      var r=records[id];
      if(!r||!r.job||!r.applied_at||r.status==="saved"||r.status==="skipped")return;
      var when=new Date(r.applied_at);
      if(!Number.isFinite(when.getTime())||when>at)return;
      all.push({id:id,record:r,time:when.getTime(),day:dateKey(when)});
    });
    all.sort(function(a,b){return a.time-b.time;});
    all.forEach(function(x){
      var key=canonicalUrl(x.record.job.url)||"record:"+x.id;
      if(seen.has(key))return;
      seen.add(key);
      counts[x.day]=(counts[x.day]||0)+1;
    });
    var today=offsetKey(at,0),todayCount=counts[today]||0;
    var week=Array.from({length:7},function(_,i){
      var key=offsetKey(at,i-6);
      return {date:key,count:counts[key]||0,isToday:i===6};
    });
    var steps=goalSteps(goal);
    return {
      goal:goal,today:todayCount,total:seen.size,remaining:Math.max(0,goal-todayCount),
      percent:Math.min(100,Math.round(todayCount/goal*100)),
      complete:todayCount>=goal,
      steps:steps,nextStep:steps.find(function(n){return n>todayCount;})||null,
      week:week,activeDays:week.filter(function(x){return x.count>0;}).length,
      weeklyTotal:week.reduce(function(sum,x){return sum+x.count;},0)
    };
  }
  function message(progress){
    if(progress.complete)return "Daily goal complete. Keep going only if you find another strong fit.";
    if(progress.today===0)return "Start with one relevant internship. The first submission creates momentum.";
    if(progress.today===1)return "First application logged. Choose the next strong fit.";
    if(progress.today<Math.ceil(progress.goal/2))return "You're building momentum. Keep the quality high.";
    return "You're getting close. Every genuine submission moves the bar.";
  }
  return {dateKey:dateKey,canonicalUrl:canonicalUrl,goalSteps:goalSteps,summary:summary,message:message};
});
