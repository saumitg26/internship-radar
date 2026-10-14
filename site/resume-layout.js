/* Internship Radar: structured, searchable PDF resume output.
   Never uploads private master data, original PDFs, or job-specific drafts. */
(()=>{
'use strict';
const SECTION_NAMES=new Set(['EDUCATION','TECHNICAL SKILLS','PROFESSIONAL EXPERIENCE','EXPERIENCE','PROJECTS','LEADERSHIP','AWARDS & CERTIFICATIONS','CERTIFICATIONS','ACTIVITIES','RESEARCH','SKILLS','AWARDS','VOLUNTEER EXPERIENCE']);
const BULLET=/^[•●▪*-]\s/;
const DATE=/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\s*[-–]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|Present)\s*$/i;
const EXPECTED=/\bExpected\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\s*$/i;
function normalizeLegacyProjects(src){
 // Prior PDF import could accidentally join a bold project header to the
 // preceding bullet, so split ONLY inside the Projects section.
 return String(src||'').split(/\r?\n/).reduce((acc,line)=>{
  const now=line.trim();
  if(SECTION_NAMES.has(now.toUpperCase())){acc.section=now.toUpperCase();acc.lines.push(now);return acc}
  if(acc.section==='PROJECTS'&&BULLET.test(now)){
   const m=now.match(/^([\s\S]*[.!?])\s+([A-Z][A-Za-z0-9]{2,24}(?:\s+[A-Z][A-Za-z0-9]{2,24}){0,2}\s+-\s+[^\n]{3,130}\|[^\n]*)$/);
   if(m){acc.lines.push(m[1],m[2]);return acc}
  }
  acc.lines.push(now);return acc
 },{section:'',lines:[]}).lines.join('\n');
}
function blocks(source){
 const clean=normalizeLegacyProjects(source);
 const rows=clean.split('\n').map(x=>x.trim()).filter(Boolean);
 const result=[];let section='',last=null;
 rows.forEach((line,i)=>{
  if(i===0){last={type:'name',text:line};result.push(last);return}
  if(i===1){last={type:'contact',text:line};result.push(last);return}
  if(SECTION_NAMES.has(line.toUpperCase())){section=line.toUpperCase();last={type:'section',text:line.toUpperCase()};result.push(last);return}
  if(BULLET.test(line)){last={type:'bullet',text:line.replace(BULLET,'').trim()};result.push(last);return}
  if(section==='PROFESSIONAL EXPERIENCE'||section==='EXPERIENCE'||section==='LEADERSHIP'){
   const found=line.match(DATE);
   last={type:'role',text:found?line.slice(0,found.index).trim():line,date:found?found[0]:''};result.push(last);return;
  }
  if(section==='PROJECTS'){
   // A PDF heading may wrap visually: join only after a trailing comma/pipe.
   if(last?.type==='project'&&/[|,]$/.test(last.text)){last.text+=' '+line;return}
   last={type:'project',text:line};result.push(last);return;
  }
  if(section==='EDUCATION'&&EXPECTED.test(line)){
   const found=line.match(EXPECTED);
   last={type:'education',text:line.slice(0,found.index).trim(),date:found[0]};result.push(last);return
  }
  const colon=line.indexOf(':');
  if((section==='TECHNICAL SKILLS'||section==='SKILLS'||section==='AWARDS & CERTIFICATIONS')&&colon>0&&colon<45){
   last={type:'keyval',key:line.slice(0,colon),text:line.slice(colon+1).trim()};result.push(last);return
  }
  // Wrapped continuation when input was pasted from a PDF rather than imported
  // with line geometry. Preserve discrete blocks; never append to a bullet
  // unless it visibly begins with a lowercase continuation fragment.
  if(last&&last.type==='bullet'&&/^[a-z(]/.test(line)){last.text+=' '+line;return}
  last={type:'text',text:line};result.push(last);
 });
 return result;
}
function buildPdf(PDF,data,scale){
 const pdf=new PDF({unit:'pt',format:'letter',compress:true});
 const color='#141414',left=36,right=576,width=right-left;
 let y=744,pages=1;
 const serif='times';
 function font(size=9,bold=false){
  pdf.setFont(serif,bold?'bold':'normal');pdf.setFontSize(size*scale);pdf.setTextColor(color);
 }
 function measure(t,size,bold){font(size,bold);return pdf.getTextWidth(t)}
 function draw(t,x,size,bold=false,align='left'){
  font(size,bold);
  pdf.text(String(t),x,y,{align});
 }
 function next(amount=10){
  y-=amount*scale;
 }
 function pageIf(need){
  if(y-need*scale<38){pdf.addPage();y=750;pages++}
 }
 function split(t,available,size,bold=false){
  font(size,bold);return pdf.splitTextToSize(String(t),available).flatMap(r=>String(r).split('\n'));
 }
 function printRows(t,x,maxw,size,bold=false,step=10.1){
  for(const str of split(t,maxw,size,bold)){
   pageIf(step);draw(str,x,size,bold);next(step)
  }
 }
 function bullet(t){
  const lines=split(t,width-14,8.72);
  for(const [i,line] of lines.entries()){
   pageIf(10.8);
   if(i===0)draw('•',40,8.75);
   draw(line,47,8.72);next(10.65)
  }
  next(.8)
 }
 function role(t,date,kind){
  const size=8.92;
  const datewidth=date?measure(date,size,true):0;
  const space=Math.max(170,width-datewidth-(date?12:0));
  const pieces=split(t,space,size,true);
  for(let i=0;i<pieces.length;i++){
   pageIf(11);
   draw(pieces[i],left,size,true);
   if(i===0&&date)draw(date,right,size,true,'right');
   next(11)
  }
 }
 function labeled(k,txt){
  const size=8.73,klabel=k+': ';
  const prefix=measure(klabel,size,true);
  const pieces=String(txt).split(/\s+/),rows=[];
  let current='',first=true;
  for(const word of pieces){
   const candidate=(current+' '+word).trim();
   const avail=width-(first?prefix:0);
   if(current&&measure(candidate,size,false)>avail){rows.push(current);current=word;first=false}
   else current=candidate;
  }
  if(current)rows.push(current);
  for(let i=0;i<rows.length;i++){
   pageIf(10.5);
   if(i===0){draw(klabel,left,size,true);draw(rows[i],left+prefix,size)}
   else draw(rows[i],left,size);
   next(10.5)
  }
 }
 for(const block of data){
  if(block.type==='name'){
   pageIf(21);draw(block.text,306,16.3,true,'center');next(18);continue
  }
  if(block.type==='contact'){
   let size=8.45;
   while(size>7&&measure(block.text,size,false)>width)size-=.2;
   pageIf(22);draw(block.text,306,size,false,'center');next(20);continue
  }
  if(block.type==='section'){
   pageIf(29);
   draw(block.text,left,10.35,true);next(3.5);
   pdf.setDrawColor(21,21,21);pdf.setLineWidth(.68);
   pdf.line(left,y-1,right,y-1);next(12.9);continue
  }
  if(block.type==='education'||block.type==='role'){role(block.text,block.date||'',block.type);continue}
  if(block.type==='project'){
   pageIf(12);printRows(block.text,left,width,8.92,true,11);continue
  }
  if(block.type==='bullet'){bullet(block.text);continue}
  if(block.type==='keyval'){labeled(block.key,block.text);continue}
  pageIf(12);printRows(block.text,left,width,8.75,false,10.6)
 }
 return {pdf,pages,bottom:y};
}
function exportPDF(PDF,text,sourceBytes,hasEdits,filename,notify){
 if(!hasEdits&&sourceBytes instanceof ArrayBuffer){
  // A no-change PDF must be byte-for-byte the user's original design.
  return {original:true,blob:new Blob([sourceBytes],{type:'application/pdf'}),pages:1};
 }
 const parsed=blocks(text);
 if(parsed.length<3)throw Error('Resume content is incomplete.');
 let output;
 for(const scale of [1,.97,.94,.91,.88]){
  output=buildPdf(PDF,parsed,scale);
  if(output.pages===1)break;
 }
 const blob=output.pdf.output('blob');
 if(output.pages>1)notify('The tailored text needs '+output.pages+' pages. Consider shortening approved edits before submitting.');
 return {blob,pages:output.pages,original:false};
}
window.InternshipRadarResumeLayout={blocks,exportPDF};
})();