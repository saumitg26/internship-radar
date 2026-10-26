/* Explainable ranking for the browser-local Daily 10 application queue. */
(function(root,factory){
  "use strict";
  var api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.InternshipDailyQueue=api;
})(typeof window!=="undefined"?window:null,function(){
  "use strict";
  var DONE=["applied","oa","interview","offer","rejected","skipped"];
  var ROLE={
    swe:/software|developer|programmer|full.?stack|back.?end|front.?end|web engineer|application engineer/i,
    ai:/\bai\b|machine learning|artificial intelligence|data scien|data engineer|analytics|research engineer/i,
    cloud:/cloud|devops|platform|infrastructure|site reliability|sre\b|systems engineer/i
  };
  var DMV=/\bdmv\b|washington[,\s]*(?:d\.?c\.?|district of columbia)|\b(?:DC|northern virginia|fairfax|reston|herndon|mclean|tysons|arlington|alexandria|chantilly|sterling|ashburn|leesburg|falls church|vienna|bethesda|rockville|silver spring|gaithersburg|manassas|woodbridge)\b/i;
  var VIRGINIA=/\b(?:VA|virginia|fairfax|reston|herndon|mclean|arlington|alexandria|chantilly|sterling|ashburn|leesburg|tysons|richmond|manassas|woodbridge|norfolk)\b/i;
  function safeUrl(value){
    try{var url=new URL(String(value||""));return url.protocol==="https:"?url.href:"";}catch(e){return "";}
  }
  function canonicalUrl(value){
    try{
      var u=new URL(String(value||""));if(u.protocol!=="https:")return "";
      u.hash="";
      Array.from(u.searchParams.keys()).forEach(function(k){
        if(/^utm_/i.test(k)||/^(ref|source|referrer|gh_src|lever-source)$/i.test(k))u.searchParams.delete(k);
      });
      return u.host.toLowerCase()+u.pathname.replace(/\/+$/,"")+u.search;
    }catch(e){return "";}
  }
  function preferences(raw){
    raw=raw||{};
    var role=["swe","cloud","ai","all"].includes(raw.role)?raw.role:"swe";
    var location=["dmv","virginia","remote","all"].includes(raw.location)?raw.location:"dmv";
    var skills=String(raw.skills||"").split(",").map(function(s){return s.trim().toLowerCase().replace(/\s+/g," ");})
      .filter(function(s){return s.length>=2&&s.length<=35;})
      .filter(function(s,i,a){return a.indexOf(s)===i;}).slice(0,8);
    return {role:role,location:location,skills:skills.join(", ")};
  }
  function score(job,prefs,now){
    var title=String(job.title||""),loc=String(job.location||""),desc=String(job.job_description||job.description||"");
    var hay=(title+" "+desc+" "+(Array.isArray(job.matched_skills)?job.matched_skills.join(" "):"")).toLowerCase();
    var points=Math.round(Math.min(100,Math.max(0,Number(job.score)||0))*.1);
    var reasons=[];
    if(job.isSaved){points+=26;reasons.push("Saved by you");}
    if(prefs.role!=="all"&&ROLE[prefs.role].test(title)){
      points+=22;reasons.push(({swe:"Software development role",ai:"AI or data role",cloud:"Cloud or platform role"})[prefs.role]);
    }else if(prefs.role!=="all"){points-=14;}
    if(prefs.location!=="all"){
      var matched=prefs.location==="remote"?/\bremote\b/i.test(loc):prefs.location==="virginia"?VIRGINIA.test(loc):DMV.test(loc);
      if(matched){points+=19;reasons.push(prefs.location==="remote"?"Remote listed":"Preferred region");}
    }
    var matchedSkills=prefs.skills.split(",").map(function(s){return s.trim();}).filter(Boolean).filter(function(s){
      var escaped=s.replace(/[|\\{}()[\]^$+*?.]/g,"\\$&");
      return new RegExp("(^|[^a-z0-9])"+escaped+"(?=$|[^a-z0-9])","i").test(hay);
    });
    matchedSkills.slice(0,3).forEach(function(s){reasons.push("Mentions "+s);});
    points+=Math.min(21,matchedSkills.length*7);
    if(job.community){points-=8;}else{points+=9;reasons.push("Direct employer feed");}
    var when=String(job.discovered_on||job.posted||"").slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(when)){
      var day=new Date(when+"T12:00:00");
      var age=Math.round((new Date(now.getFullYear(),now.getMonth(),now.getDate(),12)-day)/86400000);
      if(age>=0&&age<8){points+=12;reasons.push("Recent listing date");}
    }
    var warnings=Array.isArray(job.eligibility_notes)?job.eligibility_notes.filter(function(s){return typeof s==="string";}).slice(0,5):[];
    if(warnings.length)points-=18;
    return {points:points,reasons:reasons.slice(0,5),warnings:warnings,matchedSkills:matchedSkills};
  }
  function build(jobs,records,rawPrefs,limit,now){
    var prefs=preferences(rawPrefs),at=now instanceof Date?now:new Date(),count=Math.max(1,Math.min(30,Number(limit)||10));
    var blocked=new Set(),savedUrls=new Set(),seen=new Set(),out=[],byCompany=Object.create(null);
    Object.keys(records||{}).forEach(function(id){
      var r=records[id];if(!r)return;
      var key=canonicalUrl(r.job&&r.job.url);
      if(r.status==="saved"&&key)savedUrls.add(key);
      if(DONE.includes(r.status)&&key)blocked.add(key);
    });
    (Array.isArray(jobs)?jobs:[]).forEach(function(j){
      if(!j||!j.id||!j.title||!j.company||!safeUrl(j.url))return;
      if(j.closed===true||j.is_closed===true||String(j.status||"").toLowerCase()==="closed")return;
      var state=records&&records[j.id];
      if(state&&DONE.includes(state.status))return;
      var key=canonicalUrl(j.url),identity=String(j.company).toLowerCase().trim()+"|"+String(j.title).toLowerCase().trim()+"|"+String(j.location||"").toLowerCase().trim();
      if(!key||blocked.has(key)||seen.has(key)||seen.has("role:"+identity))return;
      seen.add(key);seen.add("role:"+identity);
      var item=Object.assign({},j,{isSaved:Boolean((state&&state.status==="saved")||savedUrls.has(key))});
      var scored=score(item,prefs,at);
      out.push({job:j,points:scored.points,reasons:scored.reasons,warnings:scored.warnings,skills:scored.matchedSkills});
    });
    out.sort(function(a,b){return b.points-a.points||String(a.job.company).localeCompare(String(b.job.company))||String(a.job.id).localeCompare(String(b.job.id));});
    var selected=[],deferred=[];
    out.forEach(function(row){
      var company=String(row.job.company).toLowerCase().trim();
      if((byCompany[company]||0)>=2){deferred.push(row);return;}
      if(selected.length<count){selected.push(row);byCompany[company]=(byCompany[company]||0)+1;}
    });
    if(selected.length<count)selected.push.apply(selected,deferred.slice(0,count-selected.length));
    return selected;
  }
  return {preferences:preferences,score:score,build:build,canonicalUrl:canonicalUrl,safeUrl:safeUrl};
});
