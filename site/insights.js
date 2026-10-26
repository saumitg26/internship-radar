/* Local-first application statistics. Derived from existing tracker records. */
(function(root,factory){
  "use strict";
  var api=factory(root&&root.InternshipProgress);
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.InternshipInsights=api;
})(typeof window!=="undefined"?window:null,function(inBrowserProgress){
  "use strict";
  var Progress=inBrowserProgress;
  if(!Progress&&typeof module==="object"&&module.exports)Progress=require("./progress.js");
  var STAGES=["applied","oa","interview","offer","rejected"];
  var RESPONSES=["oa","interview","offer","rejected"];
  function offsetKey(now,days){
    return Progress.dateKey(new Date(now.getFullYear(),now.getMonth(),now.getDate()+days,12));
  }
  function ageCalendarDays(older,newer){
    function asUTC(d){return Date.UTC(Number(d.slice(0,4)),Number(d.slice(5,7))-1,Number(d.slice(8,10)));}
    return Math.round((asUTC(newer)-asUTC(older))/86400000);
  }
  function entries(records,now){
    var at=now instanceof Date?now:new Date(now||Date.now());
    if(!Number.isFinite(at.getTime()))at=new Date();
    var ordered=Object.keys(records||{}).reduce(function(out,id){
      var r=records[id];
      if(!r||!r.job||!STAGES.includes(r.status)||!r.applied_at)return out;
      var when=new Date(r.applied_at);
      if(!Number.isFinite(when.getTime())||when.getTime()>at.getTime())return out;
      out.push({id:id,company:String(r.job.company||""),title:String(r.job.title||""),url:String(r.job.url||""),status:r.status,
        appliedAt:when.toISOString(),day:Progress.dateKey(when),at:when.getTime()});
      return out;
    },[]).sort(function(a,b){return a.at-b.at;});
    var seen=new Set();
    return ordered.filter(function(e){
      var key=Progress.canonicalUrl(e.url)||"record:"+e.id;
      if(seen.has(key))return false;
      seen.add(key);return true;
    });
  }
  function chartBins(items,mode,now){
    var days=mode==="7"?7:mode==="30"?30:90;
    var count=mode==="7"?7:mode==="30"?10:13;
    var width=Math.ceil(days/count);
    var bars=[];
    for(var offset=-(days-1);offset<=0;offset+=width){
      var endOffset=Math.min(0,offset+width-1),start=offsetKey(now,offset),end=offsetKey(now,endOffset);
      var n=items.filter(function(e){return e.day>=start&&e.day<=end;}).length;
      bars.push({start:start,end:end,count:n,label:start===end?start:start+" to "+end});
    }
    return bars;
  }
  function calculate(records,opts){
    opts=opts||{};
    var now=opts.now instanceof Date?opts.now:new Date(opts.now||Date.now());
    if(!Number.isFinite(now.getTime()))now=new Date();
    var range=["7","30","90","all"].includes(String(opts.range))?String(opts.range):"30";
    var goal=Number(opts.goal);
    if(!Number.isInteger(goal)||goal<1||goal>30)goal=10;
    var all=entries(records,now);
    var start=range==="all"?"":offsetKey(now,-Number(range)+1);
    var prevStart=range==="all"?"":offsetKey(now,-Number(range)*2+1);
    var current=all.filter(function(e){return !start||e.day>=start;});
    var previous=range==="all"?null:all.filter(function(e){return e.day>=prevStart&&e.day<start;}).length;
    var counts=Object.create(null);
    current.forEach(function(e){counts[e.day]=(counts[e.day]||0)+1;});
    var days=Object.keys(counts);
    var goalDays=days.filter(function(day){return counts[day]>=goal;}).length;
    var byStage={applied:0,oa:0,interview:0,offer:0,rejected:0};
    current.forEach(function(e){byStage[e.status]++;});
    var responses=RESPONSES.reduce(function(total,k){return total+byStage[k];},0);
    var today=Progress.dateKey(now);
    var older=all.filter(function(e){return e.status==="applied"&&ageCalendarDays(e.day,today)>=14;});
    var saved=Object.values(records||{}).filter(function(r){return r&&r.status==="saved";}).length;
    var suggestions=[];
    if(saved>0)suggestions.push({text:saved+" saved role"+(saved===1?"":"s")+" ready to review or apply to.",page:"pipeline"});
    if(older.length>0)suggestions.push({text:older.length+" submitted application"+(older.length===1?"":"s")+" have no newer status after 14+ days. Check their status before considering a follow-up.",page:"pipeline"});
    if(!current.length)suggestions.push({text:"No recorded submissions in this period. Find one eligible role and submit a thoughtful application.",page:"explore"});
    else if(responses===0&&current.length>=5)suggestions.push({text:"No outcomes recorded for these applications yet. Update your pipeline when employers respond.",page:"pipeline"});
    return {
      range:range,start:start,entries:current,allEntries:all,
      submitted:current.length,previous:previous,delta:previous===null?null:current.length-previous,
      activeDays:days.length,perActiveDay:days.length?current.length/days.length:0,
      goalDays:goalDays,goal:goal,stage:byStage,
      responseCount:responses,responseRate:current.length?Math.round(100*responses/current.length):0,
      saved:saved,reviewCount:older.length,reviewEntries:older,
      chart:chartBins(current,range,now),chartLabel:range==="7"?"Daily activity · last 7 days":range==="30"?"3-day groups · last 30 days":range==="90"?"Weekly groups · last 90 days":"Recent 90 days · all-time totals above",
      suggestions:suggestions
    };
  }
  return {entries:entries,calculate:calculate,ageCalendarDays:ageCalendarDays,STAGES:STAGES};
});
