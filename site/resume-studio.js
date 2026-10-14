(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safely=(s,n=160)=>String(s??'').trim().slice(0,n);
const limitBytes=12*1024*1024;
const DB_NAME='internship-radar-resumes-v1';
const REQUIREMENTS=[
 ['React',/\bReact(?:\.js)?\b/i],['TypeScript',/\bTypeScript\b/i],['JavaScript',/\bJavaScript\b/i],
 ['Python',/\bPython\b/i],['Java',/\bJava\b/i],['C#',/\bC#/i],['C++',/\bC\+\+/i],
 ['SQL',/\bSQL\b/i],['PostgreSQL',/\bPostgreSQL|Postgres\b/i],['AWS',/\bAWS|Amazon Web Services\b/i],
 ['Azure',/\bAzure\b/i],['Docker',/\bDocker\b/i],['Kubernetes',/\bKubernetes\b/i],
 ['FastAPI',/\bFastAPI\b/i],['Node.js',/\bNode(?:\.js)?\b/i],['REST APIs',/\bREST(?:ful)?\s+APIs?\b/i],
 ['Git',/\bGit\b/i],['CI/CD',/\bCI\/CD|continuous integration\b/i],['Linux',/\bLinux\b/i],
 ['React Native',/\bReact Native\b/i],['Agile',/\bAgile\b/i],['Unit Testing',/\bUnit Test(?:ing|s)?\b/i],
 ['Data Structures',/\bData Structures\b/i],['Machine Learning',/\bMachine Learning\b/i],
 ['Generative AI',/\bGenerative AI|GenAI|LLMs?\b/i],['Cybersecurity',/\bCybersecurity\b/i],
 ['TensorFlow',/\bTensorFlow\b/i],['PyTorch',/\bPyTorch\b/i],['Cloud',/\bCloud\b/i],
 ['Testing',/\bTesting\b/i],['Debugging',/\bDebugg(?:ing|ed?)\b/i],['APIs',/\bAPIs?\b/i],
 ['Algorithms',/\bAlgorithms?\b/i],['HTML',/\bHTML\b/i],['CSS',/\bCSS\b/i],['Spring',/\bSpring Boot\b/i]
];
const HEADERS=new Set(['EDUCATION','TECHNICAL SKILLS','PROFESSIONAL EXPERIENCE','EXPERIENCE','PROJECTS','LEADERSHIP','AWARDS & CERTIFICATIONS','CERTIFICATIONS','ACTIVITIES','RESEARCH','SKILLS','AWARDS','VOLUNTEER EXPERIENCE']);
const jobId=(new URLSearchParams(location.search).get('job')||'manual').slice(0,160);
const feed=window.INTERNSHIP_RADAR_FEED||{jobs:[]};
const handoff=(()=>{
 try{
  const value=JSON.parse(sessionStorage.getItem('internship-radar-job-handoff-v1')||'null');
  return value&&value.id===jobId&&typeof value.title==='string'&&typeof value.company==='string'?value:null;
 }catch(e){return null}
})();
const feedJob=(Array.isArray(feed.jobs)?feed.jobs:[]).find(j=>j.id===jobId)||null;
const job=feedJob&&handoff
 ?{...handoff,...feedJob,
   job_description:(String(feedJob.job_description||'').length>=String(handoff.job_description||'').length?feedJob.job_description:handoff.job_description),
   description:(String(feedJob.description||'').length>=String(handoff.description||'').length?feedJob.description:handoff.description)}
 :(feedJob||handoff||null);
let db=null,master=null,versions=[],suggestions=[],draft={},scoreStats={requirements:[],covered:[],missing:[]};
let currentJD='',waitingPdf=false,toastHandle=null;
function notify(s){const el=$('toast');el.textContent=s;el.classList.add('show');clearTimeout(toastHandle);toastHandle=setTimeout(()=>el.classList.remove('show'),4200)}
function normalize(s){return String(s??'').replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n').trim()}
function hasKey(s,re){return re.test(s)}
function relevant(){return REQUIREMENTS.filter(([name,re])=>hasKey(currentJD,re))}
function comparable(t){return REQUIREMENTS.filter(([name,re])=>hasKey(t,re)).map(x=>x[0])}
function labelName(){return job?safely(job.company,45)+'_'+safely(job.title,58):'Custom_Job'}
function fileStem(){return ('Resume_'+labelName()).replace(/[^a-z0-9._-]+/gi,'_').slice(0,100)}
function saveBlob(blob,name){const a=document.createElement('a');const u=URL.createObjectURL(blob);a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)}
function openDB(){return new Promise((resolve,reject)=>{if(!indexedDB)return reject(new Error('IndexedDB unavailable'));const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('masters'))d.createObjectStore('masters',{keyPath:'id',autoIncrement:true});if(!d.objectStoreNames.contains('kv'))d.createObjectStore('kv',{keyPath:'key'});if(!d.objectStoreNames.contains('drafts'))d.createObjectStore('drafts',{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function dbOp(store,method,arg){return new Promise((resolve,reject)=>{const t=db.transaction(store,method==='put'||method==='delete'?'readwrite':'readonly');const r=t.objectStore(store)[method](arg);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function storeMaster(text,filename,bytes=null,type='text/plain'){text=normalize(text);if(text.length<80)throw Error('Add at least 80 characters of resume content before saving.');const entry={created:new Date().toISOString(),filename:safely(filename,160),type,bytes,text};const id=await dbOp('masters','put',entry);await dbOp('kv','put',{key:'active',id});master={...entry,id};versions=await dbOp('masters','getAll');draft={};suggestions=[];await loadDraft();renderMaster();generateSuggestions();renderAll();notify('Master resume saved privately as version '+master.id+'.');}
async function restoreMaster(id){const v=versions.find(x=>x.id===id);if(!v)return;if(!confirm('Restore this earlier master as a NEW latest version? Your current version will remain in history.'))return;await storeMaster(v.text,v.filename,v.bytes||null,v.type);}
function renderMaster(){
 $('masterName').textContent=master?master.filename:'No resume saved yet';
 $('masterDetail').textContent=master?'Version '+master.id+' · Updated '+new Date(master.created).toLocaleDateString()+' · stored on this device':'PDF, DOCX, or TXT · stays in your browser';
 $('versionPill').textContent=master?'Version '+master.id:'Not saved';
 $('uploadLabel').textContent=master?'Update resume':'Upload resume';
 $('editMaster').disabled=!master;
 $('versionHistory').disabled=!versions.length;
 $('downloadPdf').disabled=!master;
 $('downloadDocx').disabled=!master;
 $('downloadOriginal').disabled=!(master&&master.bytes);
 $('previewStatus').textContent=master?'Master v'+master.id:'Not started';
 $('masterText').value=master?.text||'';
 $('historyItems').innerHTML=versions.slice().reverse().map(v=>'<div class="history-row"><span>v'+v.id+' · '+esc(v.filename)+' · '+new Date(v.created).toLocaleDateString()+'</span><button type="button" class="btn btn-quiet" data-restore="'+v.id+'">Restore as new</button></div>').join('')||'<div class="hint">No versions saved yet.</div>';
}
function setupJob(){
 if(!job){
  $('jobSubtitle').textContent='Choose a posting or paste any job description to tailor your saved resume.';
  $('jobSource').textContent='Manual description';
  $('jobStatus').textContent='Paste a job description to begin.';
  return;
 }
 $('jobSubtitle').textContent='Tailoring for '+job.company+' · '+job.title+' · '+(job.location||'Location not listed');
 const full=String(job.job_description||handoff?.job_description||'').trim();
 const excerpt=String(job.description||handoff?.description||'').trim();
 const generic=!full&&(!excerpt||/^(Public community listing|Community listing|Independent public internship lead|Recently discovered public internship lead|Public internship lead)/i.test(excerpt));
 const summary=generic?
  'LISTING SUMMARY — not the full employer job description\n'+
  'Role: '+job.title+'\nEmployer: '+job.company+'\nLocation: '+(job.location||'Not listed')+'\n'+
  'Please paste the complete employer job description below to improve the match rating and resume suggestions.'
  :'';
 const available=(full||summary||excerpt).slice(0,12000);
 $('jobDescription').value=available;
 $('jobSource').textContent=full?'Full employer description auto-loaded':generic?'Listing information auto-loaded': 'Available job excerpt auto-loaded';
 $('jobStatus').textContent=full?'Full description was automatically pasted from the public employer feed. Verify against the live posting.':
  'Only listing information is available for this employer. We filled the field automatically; paste the full job description from the employer for accurate tailoring.';
 try{
  const u=new URL(job.url);
  if(u.protocol==='https:'){
   $('jobLink').href=u.href;$('jobLink').textContent='Employer posting ↗';$('jobLink').target='_blank';$('jobLink').rel='noopener noreferrer';
  }
 }catch(e){}
}

/* Public ATS APIs can provide fuller descriptions if the scheduled feed has only
   an excerpt. No resume data, account tokens, or credentials are sent. */
async function autofillOfficialDescription(){
 if(!job)return;
 const start=$('jobDescription').value;
 if((job.job_description||'').trim().length>250){
  $('jobSource').textContent='Full employer description auto-loaded';
  return;
 }
 let u;
 try{u=new URL(job.url)}catch(e){return}
 const path=u.pathname.split('/').filter(Boolean);
 let api='';
 if(['job-boards.greenhouse.io','boards.greenhouse.io'].includes(u.hostname)&&path[1]==='jobs'&&/^\d+$/.test(path[2]||'')){
  api='https://boards-api.greenhouse.io/v1/boards/'+encodeURIComponent(path[0])+'/jobs/'+encodeURIComponent(path[2])+'?content=true';
 }else if(u.hostname==='jobs.lever.co'&&path.length>=2&&/^[\w-]+$/.test(path[0])&&/^[\w-]+$/.test(path[1])){
  api='https://api.lever.co/v0/postings/'+encodeURIComponent(path[0])+'/'+encodeURIComponent(path[1]);
 }else if(u.hostname==='jobs.ashbyhq.com'&&path.length>=2&&/^[\w.-]+$/.test(path[0])){
  api='https://api.ashbyhq.com/posting-api/job-board/'+encodeURIComponent(path[0]);
 }else if(/^[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com$/i.test(u.hostname)){
  const realPath=/^[a-z]{2}-[A-Za-z]{2}$/.test(path[0]||'')?path.slice(1):path;
  if(realPath.length<4||realPath[1]!=='job'||!realPath.every(p=>/^[a-zA-Z0-9._-]+$/.test(p)))return;
  const tenant=u.hostname.split('.')[0];
  api='https://'+u.hostname+'/wday/cxs/'+tenant+'/'+realPath[0]+'/'+realPath.slice(1).join('/');
 }else return;
 try{
  const response=await fetch(api,{credentials:'omit',cache:'no-store',redirect:'follow'});
  if(!response.ok)throw new Error('Unavailable');
  const data=await response.json();
  let content='';
  if(u.hostname==='jobs.ashbyhq.com'){
   const item=(data.jobs||[]).find(x=>{
    try{const p=new URL(x.jobUrl||'').pathname.split('/').filter(Boolean);return p[1]===path[1];}catch(e){return false}
   });
   content=item?.descriptionHtml||item?.descriptionPlain||'';
  }else content=data.jobPostingInfo?.jobDescription||data.content||data.descriptionPlain||data.description||'';
  if(typeof content!=='string')return;
  const parser=new DOMParser();
  const doc=parser.parseFromString(content.replace(/<br\s*\/?>/gi,'\n').replace(/<\/(?:p|li|div|h[1-6])>/gi,'\n'), 'text/html');
  doc.querySelectorAll('script,style,iframe').forEach(n=>n.remove());
  const full=normalize((doc.body?.textContent||'').replace(/\n[ \t]+/g,'\n')).slice(0,12000);
  if(full.length<250)return;
  if($('jobDescription').value!==start)return; // never overwrite user edits
  $('jobDescription').value=full;
  $('jobSource').textContent='Full employer description automatically loaded';
  $('jobStatus').textContent='Retrieved from the employer’s public applicant-tracking board. Review before using the match suggestions.';
  await refresh();
 }catch(e){
  // No misleading "full" label; the prefilled feed excerpt remains editable.
  if($('jobDescription').value===start&&start.length<400){
   $('jobStatus').textContent='The employer’s full description could not be retrieved automatically. The role summary is prefilled; open the posting if you need the complete text.';
  }
 }
}
async function readPDF(bytes){
 if(!window.pdfjsLib)throw Error('PDF reader not loaded. Try DOCX or TXT, or paste resume text.');
 pdfjsLib.GlobalWorkerOptions.workerSrc='./vendor/pdf.worker.min.js';
 const pdf=await pdfjsLib.getDocument({data:new Uint8Array(bytes.slice(0)),isEvalSupported:false}).promise;
 if(pdf.numPages>5)throw Error('Resumes of more than five pages are not supported.');
 const physical=[];
 for(let p=1;p<=pdf.numPages;p++){
  const pg=await pdf.getPage(p);
  const content=await pg.getTextContent();
  const buckets=[];
  for(const item of content.items){
   if(!String(item.str||'').trim())continue;
   const x=Number(item.transform?.[4]||0),y=Number(item.transform?.[5]||0);
   const width=Number(item.width||0);
   let row=buckets.find(r=>Math.abs(r.y-y)<=1.35);
   if(!row){row={y,items:[]};buckets.push(row)}
   const style=content.styles?.[item.fontName]||{};
   row.items.push({x,width,text:item.str,bold:/bold/i.test(String(style.fontFamily||'')+' '+String(item.fontName||''))});
  }
  buckets.sort((a,b)=>b.y-a.y);
  for(const row of buckets){
   row.items.sort((a,b)=>a.x-b.x);
   let text='',previous=null;
   for(const part of row.items){
    const distance=previous?part.x-(previous.x+previous.width):0;
    if(text&&!/\s$/.test(text)&&!/^\s/.test(part.text)&&distance>1.1)text+=' ';
    text+=part.text;
    previous=part;
   }
   text=text.replace(/\s+/g,' ').trim();
   if(text)physical.push({text,x:row.items[0]?.x||0,bold:row.items.some(x=>x.bold)});
  }
 }
 return normalizePdfLines(physical);
}
function normalizePdfLines(physical){
 const output=[];let section='',last=null;
 const sections=new Set(['EDUCATION','TECHNICAL SKILLS','PROFESSIONAL EXPERIENCE','EXPERIENCE','PROJECTS','LEADERSHIP','AWARDS & CERTIFICATIONS','CERTIFICATIONS','ACTIVITIES','RESEARCH','SKILLS','AWARDS']);
 for(const raw of physical){
  let line=normalize(raw.text);
  if(!line)continue;
  const isHeader=sections.has(line.toUpperCase());
  const bullet=/^[•●▪]\s?/.test(line);
  if(bullet){line='• '+line.replace(/^[•●▪]\s*/, '');}
  if(isHeader){
   section=line.toUpperCase();last={kind:'section',x:raw.x,value:line};
   output.push(last);continue;
  }
  // The original PDF's continuation lines are indented about 5 points farther
  // than their bullet start. Respect geometry instead of guessing from words.
  if(last&&last.kind==='bullet'&&!bullet&&raw.x>=last.x+2.5){
   last.value+=' '+line;continue;
  }
  if(last&&last.kind==='project'&&section==='PROJECTS'&&!bullet&&
     (/[|,]$/.test(last.value)||!raw.bold&&raw.x>last.x+3)){
   last.value+=' '+line;continue;
  }
  if(last&&last.kind==='text'&&!bullet&&!isHeader&&
     (/[,:]$/.test(last.value)||/^[a-z(]/.test(line))&&
     (section==='EDUCATION'||section==='TECHNICAL SKILLS'||section==='SKILLS')){
   last.value+=' '+line;continue;
  }
  // Job names, education rows and project titles always remain independent,
  // even when they directly follow a wrapped bullet in the original PDF.
  const kind=bullet?'bullet':section==='PROJECTS'?'project':'text';
  last={kind,x:raw.x,value:line};output.push(last);
 }
 return output.map(row=>row.value).join('\n');
}
async function readDOCX(bytes){
 const a=new Uint8Array(bytes),v=new DataView(bytes),decoder=new TextDecoder();
 let end=-1;for(let i=a.length-22;i>=Math.max(0,a.length-66000);i--){if(v.getUint32(i,true)===0x06054b50){end=i;break}}
 if(end<0)throw Error('Not a valid DOCX/ZIP file.');
 let pos=v.getUint32(end+16,true);const count=v.getUint16(end+10,true);
 let xml='';
 for(let i=0;i<count;i++){
  if(v.getUint32(pos,true)!==0x02014b50)throw Error('Invalid DOCX ZIP directory.');
  const method=v.getUint16(pos+10,true),size=v.getUint32(pos+20,true),nameLen=v.getUint16(pos+28,true),extra=v.getUint16(pos+30,true),comment=v.getUint16(pos+32,true),off=v.getUint32(pos+42,true);
  const name=decoder.decode(a.slice(pos+46,pos+46+nameLen));pos+=46+nameLen+extra+comment;
  if(name!=='word/document.xml')continue;
  if(v.getUint32(off,true)!==0x04034b50)throw Error('Invalid DOCX content.');
  const from=off+30+v.getUint16(off+26,true)+v.getUint16(off+28,true);
  const content=a.slice(from,from+size);
  let out;
  if(method===0)out=content;
  else if(method===8&&typeof DecompressionStream!=='undefined')out=new Uint8Array(await new Response(new Blob([content]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  else throw Error('This browser cannot decompress the DOCX file. Use PDF or TXT.');
  xml=decoder.decode(out);break;
 }
 if(!xml)throw Error('DOCX did not contain a readable Word document.');
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
 const paras=[...doc.getElementsByTagNameNS(ns,'p')];
 return paras.map(p=>{
  const content=[...p.getElementsByTagNameNS(ns,'t')].map(t=>t.textContent||'').join('');
  if(!content.trim())return '';
  return p.getElementsByTagNameNS(ns,'numPr').length?'• '+content:content;
 }).filter(Boolean).join('\n');
}
async function importFile(file){
 if(file.size>limitBytes)throw Error('Resume file exceeds the 12 MB local limit.');
 const bytes=await file.arrayBuffer();let text='';
 if(/\.pdf$/i.test(file.name))text=await readPDF(bytes);
 else if(/\.docx$/i.test(file.name))text=await readDOCX(bytes);
 else if(/\.txt$/i.test(file.name))text=await file.text();
 else throw Error('Choose a PDF, DOCX, or TXT file.');
 if(!text||text.trim().length<80)throw Error('Could not read enough resume text. Try editing or pasting your text.');
 await storeMaster(text,file.name,bytes,file.type||'application/octet-stream');
}
function analyze(){
 currentJD=normalize($('jobDescription').value);
 const req=relevant(),cv=renderText();
 const covered=req.filter(([name,re])=>hasKey(cv,re));
 const missing=req.filter(([name,re])=>!hasKey(cv,re));
 const n=req.length,score=n?Math.round(covered.length/n*100):null;
 scoreStats={requirements:req,covered,missing};
 $('score').textContent=master&&score!==null?String(score):'—';
 $('ring').style.background='conic-gradient(#86e6cf '+(master&&score!==null?score*3.6:0)+'deg, #3c5569 0deg)';
 $('ring').setAttribute('aria-valuenow',String(master&&score!==null?score:0));
 $('matchedCount').textContent=master?covered.length:'0';
 $('missingCount').textContent=master?missing.length:'0';
 $('ratingLabel').textContent=!master?'Add a resume':n<2?'Need full job description':score>=80?'Strong overlap':score>=50?'Partial overlap':'Limited overlap';
 $('scoreInfo').textContent=!master?'Upload your master resume to measure its keyword coverage.':n<2?'Only '+n+' recognizable keyword'+(n===1?'':'s')+' found. Paste the full job description for a more meaningful comparison.':'Matched '+covered.length+' of '+n+' recognizable job-description keywords in your '+(draftCount()?'tailored':'master')+' resume. This is NOT an ATS vendor score.';
 $('matchChips').innerHTML=req.slice(0,14).map(([name])=>'<span class="chip '+(covered.some(x=>x[0]===name)?'good':'gap')+'">'+(covered.some(x=>x[0]===name)?'✓ ':'○ ')+esc(name)+'</span>').join('')||'<span class="hint">No technical keywords recognized from the description yet.</span>';
}
function parseLines(t){return normalize(t).split('\n').map(x=>x.trim()).filter(Boolean)}
function suggestRewrite(original){
 let s=original.replace(/^[•●▪*-]\s*/,'').trim();
 const replacementRules=[
 [/^Developed React and TypeScript functionality for (.+?), building (.+?) and integrating /i,'Built React and TypeScript $2 for $1, integrating '],
 [/^Built a full-stack React\/FastAPI application/i,'Developed a full-stack React and FastAPI application'],
 [/^Engineered an event-driven AWS application with /i,'Built an event-driven AWS application using '],
 [/^Developed React Native\/Expo features/i,'Built React Native and Expo features'],
 [/^Implemented (.+?) using /i,'Developed $1 with '],
 [/^Worked on (.+)/i,'Contributed to $1'],
 [/^Helped (?:to )?develop (.+)/i,'Contributed to developing $1'],
 [/^Responsible for (.+)/i,'Contributed to $1'],
 [/^Built (.+)/i,'Developed $1'],
 [/^Developed (.+)/i,'Built $1']
 ];
 for(const [pat,replace] of replacementRules){if(pat.test(s)){const out=s.replace(pat,replace);if(out!==s)return (original.trim().startsWith('•')?'• ':'')+out}}
 return null;
}
function generateSuggestions(){
 const raw=master?parseLines(master.text):[];
 const req=relevant();
 const bullets=raw.filter(s=>/^[•●▪*-]\s/.test(s)&&s.length>40);
 const scored=bullets.map(original=>{
  const hits=req.filter(([name,re])=>hasKey(original,re)).map(x=>x[0]);
  return {original,hits,weight:hits.length*4+Math.min(original.length,220)/200}
 }).filter(x=>x.hits.length).sort((a,b)=>b.weight-a.weight);
 const seen=new Set();
 suggestions=scored.map(x=>{
  if(seen.has(x.original))return null;seen.add(x.original);
  const proposed=suggestRewrite(x.original);
  if(!proposed||proposed===x.original)return null;
  return {original:x.original,proposed,keywords:x.hits,
   why:'Your existing bullet supports '+x.hits.slice(0,3).join(', ')+'. This is a wording alternative, not a new achievement.'};
 }).filter(Boolean).slice(0,5);
 // Persisted decisions are keyed to exact original text for this master and role.
 draft={...draft};
 for(const s of suggestions){if(!draft[s.original])draft[s.original]={status:'pending',text:s.proposed}}
 renderSuggestions();
}
function draftCount(){return suggestions.filter(s=>draft[s.original]?.status==='accepted').length}
function renderText(){
 let t=master?.text||'';
 for(const s of suggestions){
  const d=draft[s.original];
  if(d?.status==='accepted'&&t.includes(s.original))t=t.replace(s.original,normalize(d.text))
 }
 return t;
}
async function persistDraft(){if(!db||!master)return;await dbOp('drafts','put',{id:jobId+'|'+master.id,edits:draft,jobDescription:$('jobDescription').value})}
async function loadDraft(){
 draft={};if(!master)return;
 try{const r=await dbOp('drafts','get',jobId+'|'+master.id);if(r){draft=r.edits||{};if(r.jobDescription&&r.jobDescription.length>$('jobDescription').value.length)$('jobDescription').value=r.jobDescription}}catch{}
 currentJD=normalize($('jobDescription').value);
}
function renderSuggestions(){
 const n=draftCount();
 $('reviewCount').textContent=n+' accepted';
 $('suggestionStatus').textContent=!master?'Save your master resume to begin.':!currentJD?'Paste the full job description to see suggestions.':suggestions.length?suggestions.length+' wording suggestions from experience already in your resume.':'No safe automatic rewrites identified. You can still use the match analysis and export your resume.';
 $('suggestions').innerHTML=suggestions.map((s,i)=>{
  const d=draft[s.original],status=d?.status||'pending';
  return '<article class="suggestion"><div class="suggestion-title"><div><h3>'+esc(s.keywords.slice(0,3).join(' · '))+' — sharpen this bullet</h3><small>Existing experience · suggestion '+(i+1)+'</small></div><span class="state '+(status==='accepted'?'accepted':'')+'">'+(status==='accepted'?'✓ Accepted':status==='skipped'?'Skipped':'To review')+'</span></div><div class="beforeafter"><div class="wording"><small>ORIGINAL</small>'+esc(s.original)+'</div><div class="wording after"><small>SUGGESTED · EDIT BEFORE ACCEPTING</small><textarea class="edit-box" data-edit="'+i+'" aria-label="Edit suggestion '+(i+1)+'">'+esc(d?.text||s.proposed)+'</textarea></div></div><div class="suggestion-foot"><div class="why">'+esc(s.why)+'</div><div class="btns">'+(status==='accepted'?'<button type="button" class="btn btn-quiet" data-action="undo" data-index="'+i+'">↶ Undo</button>':'<button type="button" class="btn btn-quiet" data-action="skip" data-index="'+i+'">'+(status==='skipped'?'Restore':'Skip')+'</button><button type="button" class="btn btn-primary" data-action="accept" data-index="'+i+'">✓ Accept</button>')+'</div></div></article>'
 }).join('')||'<div class="empty">No grounded rewrite suggestions yet. The keyword comparison still works, and you can download your master without changes.</div>';
}
function renderPaper(){
 const paper=$('paper');
 if(!master){paper.innerHTML='<div class="paper-empty">Upload your master resume to see a live document preview.</div>';return}
 const layout=window.InternshipRadarResumeLayout;
 const rows=layout?.blocks(renderText())||parseLines(renderText()).map((x,i)=>({type:i===0?'name':i===1?'contact':HEADERS.has(x.toUpperCase())?'section':'text',text:x}));
 paper.innerHTML=rows.map(item=>{
  const t=esc(item.text||'');
  if(item.type==='name')return '<div class="paper-name">'+t+'</div>';
  if(item.type==='contact')return '<div class="paper-contact">'+t+'</div>';
  if(item.type==='section')return '<div class="paper-section">'+t+'</div>';
  if(item.type==='education'||item.type==='role')return '<div class="paper-role"><span>'+t+'</span><span class="paper-date">'+esc(item.date||'')+'</span></div>';
  if(item.type==='project')return '<div class="paper-line role-line">'+t+'</div>';
  if(item.type==='bullet')return '<div class="paper-line bullet">• '+t+'</div>';
  if(item.type==='keyval')return '<div class="paper-line"><b>'+esc(item.key)+':</b> '+t+'</div>';
  return '<div class="paper-line">'+t+'</div>';
 }).join('');
 $('previewStatus').textContent=draftCount()+' accepted · master v'+master.id;
 const warn=rows.length>85?'This resume may exceed one page. Download and check your page count.':
  draftCount()?'Edited PDF uses an aligned serif layout modeled on your master. Review the final file before applying.':
  'No accepted edits: Download PDF preserves your original uploaded PDF exactly. This is a simplified live text preview.';
 $('pageWarning').textContent=warn;
 $('pageWarning').classList.toggle('warning',rows.length>85);
}
function renderAll(){renderSuggestions();renderPaper();analyze()}
async function refresh(){currentJD=normalize($('jobDescription').value);generateSuggestions();renderAll();if(master)await persistDraft()}
function pdfExport(){
 if(!master)return;
 const maker=window.jspdf?.jsPDF;
 const layout=window.InternshipRadarResumeLayout;
 if(!maker||!layout){notify('PDF layout module is unavailable. Refresh the page and try again.');return}
 try{
  const untouched=draftCount()===0 && /\.(pdf)$/i.test(master.filename||'') && master.bytes instanceof ArrayBuffer;
  const output=layout.exportPDF(maker,renderText(),untouched?master.bytes:null,!untouched,fileStem(),notify);
  saveBlob(output.blob,fileStem()+'.pdf');
  if(output.original)notify('Downloaded your exact original PDF — all formatting preserved.');
  else notify('Downloaded the redesigned PDF with aligned roles, project headings and readable bullets. Check the page count before submitting.');
 }catch(e){notify('Unable to format this PDF safely: '+e.message)}
}
function xmlEsc(s){return esc(s).replace(/&#39;/g,'&apos;').replace(/&quot;/g,'&quot;')}
function docxXml(){
 const paragraphs=parseLines(renderText()).map((line,i)=>{
  const header=HEADERS.has(line.toUpperCase());
  const bullet=/^[•●▪*-]\s/.test(line);
  const content=xmlEsc(line);
  const run='<w:r><w:rPr><w:rFonts w:ascii="Liberation Serif" w:hAnsi="Liberation Serif"/>'+(header||i===0||(!bullet&&/ - | \| /.test(line))?'<w:b/>':'')+'<w:sz w:val="'+(i===0?'27':i===1?'17':header?'19':'18')+'"/></w:rPr><w:t xml:space="preserve">'+content+'</w:t></w:r>';
  const borders=header?'<w:pBdr><w:bottom w:val="single" w:sz="5" w:space="2" w:color="000000"/></w:pBdr>':'';
  const props='<w:pPr>'+(i<2?'<w:jc w:val="center"/>':'')+borders+'<w:spacing w:before="'+(header?'120':'12')+'" w:after="0" w:line="218" w:lineRule="auto"/>'+(bullet?'<w:ind w:left="200" w:hanging="175"/>':'')+'</w:pPr>';
  return '<w:p>'+props+run+'</w:p>';
 }).join('');
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paragraphs+'<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="500" w:right="590" w:bottom="500" w:left="590" w:header="300" w:footer="300" w:gutter="0"/></w:sectPr></w:body></w:document>';
}
function crc32(u8){let c=0xffffffff;for(const byte of u8){c^=byte;for(let j=0;j<8;j++)c=(c&1)?(c>>>1)^0xedb88320:c>>>1}return (c^0xffffffff)>>>0}
function buildZip(entries){
 const encoder=new TextEncoder(),files=[],directory=[];let offset=0;
 const u16=(n)=>[n&255,(n>>>8)&255],u32=(n)=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
 for(const [name,content] of entries){
  const filename=encoder.encode(name),data=encoder.encode(content),crc=crc32(data);
  const local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(filename.length),...u16(0)]);
  files.push(local,filename,data);
  const central=new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(filename.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)]);
  directory.push(central,filename);offset+=local.length+filename.length+data.length
 }
 const size=directory.reduce((a,b)=>a+b.length,0);
 const footer=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(entries.length),...u16(entries.length),...u32(size),...u32(offset),...u16(0)]);
 return new Blob([...files,...directory,footer],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})
}
function downloadDOCX(){
 if(!master)return;
 const types='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
 const rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
 saveBlob(buildZip([['[Content_Types].xml',types],['_rels/.rels',rels],['word/document.xml',docxXml()]]),fileStem()+'.docx');
 notify('Downloaded editable DOCX. Review fonts and page breaks in Word.');
}
function downloadSource(){if(master?.bytes)saveBlob(new Blob([master.bytes],{type:master.type}),master.filename)}
function wire(){
 $('analyze').onclick=refresh;
 $('jobDescription').addEventListener('change',refresh);
 $('resumeFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;
  $('uploadLabel').textContent='Reading…';
  try{await importFile(file)}catch(err){notify('Import failed: '+err.message)}finally{$('resumeFile').value='';$('uploadLabel').textContent=master?'Update resume':'Upload resume'}
 };
 $('editMaster').onclick=()=>{if(!master)return;$('masterText').value=master.text;$('masterEditor').hidden=false;$('masterText').focus()};
 $('cancelEdit').onclick=()=>$('masterEditor').hidden=true;
 $('saveMaster').onclick=async()=>{try{await storeMaster($('masterText').value,(master?.filename||'Pasted_Resume.txt').replace(/\.(pdf|docx)$/i,'.txt'),null,'text/plain');$('masterEditor').hidden=true}catch(e){notify(e.message)}};
 $('versionHistory').onclick=()=>{$('historyPanel').hidden=!$('historyPanel').hidden};
 $('historyItems').onclick=async e=>{const b=e.target.closest('button[data-restore]');if(b){try{await restoreMaster(Number(b.dataset.restore))}catch(e){notify(e.message)}}};
 $('suggestions').onclick=async e=>{
  const b=e.target.closest('button[data-action]');if(!b)return;
  const s=suggestions[Number(b.dataset.index)];if(!s)return;
  const d=draft[s.original];if(!d)return;
  if(b.dataset.action==='accept'){
   if(!d.text.trim()){notify('The proposed bullet cannot be empty.');return}
   const additions=comparable(d.text).filter(k=>!comparable(master.text).includes(k));
   if(additions.length&&!confirm('Your edited bullet contains skills not detected in your master resume: '+additions.join(', ')+'. Only accept if you actually have this experience. Continue?'))return;
   d.status='accepted';notify('Accepted for this job only. Master resume unchanged.');
  }else if(b.dataset.action==='undo')d.status='pending';
  else if(b.dataset.action==='skip')d.status=d.status==='skipped'?'pending':'skipped';
  await persistDraft();renderAll();
 };
 $('suggestions').oninput=e=>{const ta=e.target.closest('textarea[data-edit]');if(!ta)return;const s=suggestions[Number(ta.dataset.edit)];if(!s)return;draft[s.original].text=ta.value;if(draft[s.original].status==='accepted'){renderPaper();analyze()}persistDraft().catch(()=>{})};
 $('resetSuggestions').onclick=async()=>{if(!master)return;if(!confirm('Reset accepted edits for this job and master version?'))return;draft={};generateSuggestions();await persistDraft();renderAll();notify('Job-specific edits reset.')};
 $('downloadPdf').onclick=pdfExport;
 $('downloadDocx').onclick=downloadDOCX;
 $('downloadOriginal').onclick=downloadSource;
}
async function init(){
 setupJob();wire();
 currentJD=normalize($('jobDescription').value);
 void autofillOfficialDescription();
 try{
  db=await openDB();versions=await dbOp('masters','getAll');
  const active=await dbOp('kv','get','active');
  master=active?.id?await dbOp('masters','get',active.id):null;
  await loadDraft();renderMaster();generateSuggestions();renderAll();
 }catch(e){notify('Private storage is unavailable in this browser. Try normal browsing mode.');renderMaster();renderAll();$('resumeFile').disabled=true}
}
init();
})();