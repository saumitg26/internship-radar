const assert=require("node:assert/strict");
const intel=require("../site/job-intelligence.js");
function make(desc){return {title:"Software Engineering Intern",company:"Example",location:"Reston, VA",description:desc,job_description:desc,dmv_priority:true};}
let x=intel.evaluate(make("Must be graduating in 2027. Experience with Python and AWS."));assert.equal(x.blockers.length,1);
x=intel.evaluate(make("Junior or Senior classification preferred. Python and AWS experience welcome."));assert.equal(x.blockers.length,0);
x=intel.evaluate(make("US citizenship required. Python experience."),{citizen:false});assert.equal(x.blockers.length,1);
x=intel.evaluate(make("Work with React, SQL, Java, Python and PostgreSQL."));assert(x.matched.includes("Python"));assert(x.score<=100);
x=intel.evaluate({title:"Software Intern",company:"X",description:"Short community lead",community:true});assert(x.uncertain.length>=2);
console.log("Job intelligence tests passed");
