/* Pure, job-specific resume edits. No file uploads or network calls. */
(function(root){
'use strict';
const bullet=/^[•●▪*+-]\s*/;
function editedResume(masterText,draft){
 const input=String(masterText||'');
 const lines=input.split(/\r?\n/);
 const applied=[];
 for(const [key,entry] of Object.entries(draft||{})){
  if(!entry||entry.status!=='accepted')continue;
  const original=String(key||'').trim();
  const proposed=String(entry.text||'').replace(/\r\n?/g,'\n').trim();
  if(!original||!proposed)continue;
  const index=lines.findIndex(line=>line.trim()===original);
  if(index===-1)continue;
  // A rewrite of an existing bullet stays a bullet, even if the user typed
  // text without "•" into the editing textarea.
  const replacement=bullet.test(original)&&!bullet.test(proposed)?'• '+proposed:proposed;
  if(original===replacement)continue;
  lines[index]=lines[index].match(/^\s*/)[0]+replacement;
  applied.push({original,replacement});
 }
 return {text:lines.join('\n'),applied};
}
root.InternshipRadarResumeEdits={editedResume};
})(typeof window==='undefined'?globalThis:window);
