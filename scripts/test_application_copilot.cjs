const assert=require("node:assert/strict");
const {draft,lines}=require("../site/application-copilot.js");
const input={company:"Acme",role:"Software Intern",evidence:"• Built a Python dashboard for internal analysis.",detail:"their engineering challenges",description:"Python and SQL experience"};
for(const mode of ["answer","letter","outreach","interview","research","followup","negotiation"]){const x=draft(mode,input);assert(x.length>40,"Missing output for "+mode);assert(x.includes("Acme"),"Missing company in "+mode);}
const answer=draft("answer",input);assert(answer.includes("Built a Python dashboard"));assert(!answer.includes("10,000 users"));assert.equal(lines("• One very clear accomplishment supported by evidence.").length,1);
assert(!draft("answer",{...input,evidence:""}).includes("Built a Python dashboard"));
console.log("Application Copilot checks passed");