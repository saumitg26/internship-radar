/* Run using node scripts/test_application_pipeline.cjs. No browser/network needed. */
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const html=fs.readFileSync('site/index.html','utf8');
const match=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match,'Dashboard app script exists');
const src=match[1];
function between(start,end){
 const i=src.indexOf(start);
 assert.ok(i>=0,'Expected snippet '+start);
 const j=src.indexOf(end,i+start.length);
 assert.ok(j>i,'Expected boundary '+end);
 return src.slice(i,j);
}
const elements={
 pipelineList:{innerHTML:''},
 pSaved:{textContent:''},
 pOa:{textContent:''},
 pInterview:{textContent:''},
 pApplied:{textContent:''},
 exploreSearch:{value:''},
 exploreLocation:{value:'all'},
 exploreRole:{value:'all'},
 exploreCity:{value:''},
 exploreKeywords:{value:''},
 exploreAge:{value:'all'},
 exploreStatus:{value:'new'},
 exploreSort:{value:'newest'}
};
let records={},stored='',renders=0,notification='';
const jobs=[
 {id:'j1',company:'Example Tech',title:'Software Developer Intern',location:'Fairfax, VA',url:'https://example.com/intern/123',posted:'2026-10-14',discovered_on:'2026-10-14',score:85,dmv_priority:true,description:'Build backend services.'},
 {id:'j2',company:'Other Co',title:'Software Intern',location:'Reston, VA',url:'https://example.com/intern/456',posted:'2026-10-14',discovered_on:'2026-10-14',score:75,dmv_priority:true,description:'Create APIs.'}
];
let handler=null;
const ctx={
 jobs,records,exploreCompany:'',
 '$':id=>{assert.ok(elements[id],'Known element '+id);return elements[id]},
 document:{addEventListener:(name,fn)=>{if(name==='click')handler=fn}},
 text:x=>String(x??'').replace(/</g,'&lt;'),
 link:u=>u,
 today:d=>(d?new Date(d):new Date('2026-10-14T16:00:00Z')).toISOString().slice(0,10),
 local:j=>j.dmv_priority===true,
 virginia:j=>j.location.includes('VA'),
 maryland:j=>j.location.includes('MD'),
 recentDate:j=>({date:j.discovered_on,kind:'discovered'}),
 ageDays:d=>Math.round((Date.parse('2026-10-14')-Date.parse(d))/86400000),
 notify:m=>{notification=m},
 save:()=>{stored=JSON.stringify(records)},
 render:()=>{renders++}
};
const code=[
 between('var validStatuses=', 'function local(j)'),
 between('function exploreVisible(){','function renderExplore(){'),
 between('function recentMatches(maxAge,loc,role,city){','function storeRecentPrefs(){'),
 between('function renderPipeline(){','$("pipelineList").onchange='),
 between('// The same job card appears in Top 10, Explore, recent discoveries','$("showMore").onclick=')
].join('\n');
vm.runInNewContext(code,ctx);
assert.equal(typeof handler,'function','All job-list clicks are delegated');
assert.equal(ctx.exploreVisible().length,2,'Two unapplied jobs visible in Explore before click');
assert.equal(ctx.recentMatches(7,'all','all','').length,2,'Two recent jobs visible before click');
function press(job,action){
 handler({target:{closest:selector=>selector.includes('data-job')?{dataset:{job,action}}:null}});
}
// This synthetic click stands in for a dynamically rendered card in Latest Jobs,
// Fresh openings, Top 10 or Explore; only the button data attributes matter.
press('j1','applied');
assert.equal(records.j1.status,'applied','Applied status persists in tracker');
assert.ok(records.j1.applied_at,'Applied timestamp recorded');
assert.ok(JSON.parse(stored).j1,'Records persisted to browser storage');
assert.equal(renders,1,'App immediately rerenders');
assert.ok(notification.includes('My Pipeline'),'Confirmation points user to pipeline');
assert.equal(ctx.exploreVisible().length,1,'Applied job hidden from default Explore view');
assert.equal(ctx.recentMatches(7,'all','all','').length,1,'Applied job hidden from Latest and homepage');
ctx.renderPipeline();
assert.ok(elements.pipelineList.innerHTML.includes('Example Tech'),'Pipeline includes employer');
assert.ok(elements.pipelineList.innerHTML.includes('Software Developer Intern'),'Pipeline includes role');
assert.ok(elements.pipelineList.innerHTML.includes('selected'),'Applied status selected');
assert.equal(elements.pApplied.textContent,1,'Pipeline applied counter updates');
elements.exploreStatus.value='all';
assert.equal(ctx.exploreVisible().length,2,'Explicit All statuses shows applied jobs');
elements.exploreStatus.value='applied';
assert.equal(ctx.exploreVisible().length,1,'Explicit Applied filter shows the applied job');
elements.exploreStatus.value='new';
press('j2','saved');
assert.equal(ctx.exploreVisible().length,1,'Saved but unapplied jobs remain discoverable');
ctx.renderPipeline();
assert.ok(elements.pipelineList.innerHTML.includes('Other Co'),'Saved job also appears in pipeline');
press('j2','applied');
assert.equal(ctx.recentMatches(7,'all','all','').length,0,'All newly applied jobs disappear from discovery');
assert.equal(ctx.exploreVisible().length,0,'All applied jobs hidden from default Explore');
ctx.renderPipeline();
assert.equal(elements.pApplied.textContent,2,'Both applied records included');
assert.equal(JSON.parse(stored).j2.status,'applied','Saving over an existing Saved record works');
console.log('PASS: I applied across every dynamic job card, local save, immediate hide, pipeline entry, status filters and counts.');
