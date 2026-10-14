const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync('site/resume-edits.js','utf8'),ctx);
const {editedResume}=ctx.window.InternshipRadarResumeEdits;
const master='Education\nProjects\n• Built Java APIs and worked with AWS Lambda.\n• Created a Python backend.';
const first='• Implemented Java REST APIs and AWS Lambda workflows.';
const second='• Developed a Python backend and API integration.';
const original={...{0:master}};
const edits={
 '• Built Java APIs and worked with AWS Lambda.':{status:'accepted',text:first},
 '• Created a Python backend.':{status:'pending',text:second}
};
let out=editedResume(master,edits);
assert.equal(out.applied.length,1,'accepted edit is counted');
assert.ok(out.text.includes(first),'approved wording is in tailored resume');
assert.ok(!out.text.includes('• Built Java APIs and worked with AWS Lambda.'),'old wording was replaced');
assert.ok(master.includes('• Built Java APIs and worked with AWS Lambda.'),'master not changed');
assert.ok(out.text.includes('• Created a Python backend.'),'pending edit not exported');
// Re-analyzing a description could remove suggestions from UI; saved drafts
// must remain effective independently of regenerated suggestion lists.
const afterReanalysis=editedResume(master,edits);
assert.equal(afterReanalysis.applied.length,1,'accepted rewrite remains after reanalysis');
edits['• Created a Python backend.']={status:'accepted',text:'Built a Python backend and API integration.'};
out=editedResume(master,edits);
assert.equal(out.applied.length,2,'two approved edits actually applied');
assert.ok(out.text.includes('• Built a Python backend and API integration.'),'bullet marker preserved');
assert.equal(editedResume(master,{'not present':{status:'accepted',text:'irrelevant'}}).applied.length,0,'missing source cannot count as accepted');
assert.equal(editedResume(master,{'• Created a Python backend.':{status:'accepted',text:'• Created a Python backend.'}}).applied.length,0,'no-op not counted');
assert.equal(editedResume(master,{'• Created a Python backend.':{status:'skipped',text:'• X'}}).applied.length,0,'skipped not exported');
console.log('Resume edits PASS: acceptance, export text, no-op, skipped, persistence across suggestion refresh, master isolation.');
