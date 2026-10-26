/* Tests for focused Home navigation and dedicated deep-dive screens. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("site/index.html","utf8");
const slice=(begin,end)=>{
 const a=html.indexOf(begin),b=html.indexOf(end,a+begin.length);
 assert.ok(a>=0,"Missing "+begin);
 assert.ok(b>a,"Missing delimiter "+end);
 return html.slice(a,b);
};
const home=slice('<section id="home" class="view active">','<section id="discover" class="view">');
const discover=slice('<section id="discover" class="view">','<section id="recent" class="view">');
const insights=slice('<section id="insights" class="view">','<section id="programs" class="view">');
const nav=slice('<nav class="nav" aria-label="Main navigation">','</nav>');
assert.ok(nav.indexOf('data-page="home"')<nav.indexOf('data-page="discover"'),"Home is the first nav destination");
assert.equal((html.match(/id="momentumPanel"/g)||[]).length,1,"One mission only");
assert.ok(home.includes('id="momentumPanel"'),"Mission only on Home");
assert.ok(home.includes('id="homeSavedCount"'),"Saved action available on Home");
assert.ok(home.includes('id="homeRecentList"'),"Compact fresh leads on Home");
assert.ok(home.includes('id="homeInsights"'),"Deeper stats are one click away");
assert.ok(!home.includes('id="insightsBars"'),"Detailed charts are not on Home");
assert.ok(!home.includes('id="jobList"'),"Top 10 full cards are not on Home");
assert.ok(discover.includes('id="jobList"'),"Top 10 remains its own view");
assert.ok(!discover.includes('id="momentumPanel"'),"Mission is not duplicated on job discovery");
assert.ok(!discover.includes('id="homeRecentList"'),"Fresh preview moved to Home");
assert.ok(insights.includes('id="insightsBars"'),"Charts remain on Stats & Insights");
assert.ok(insights.includes('id="insightsStages"'),"Pipeline analytics stay in Stats");
assert.ok(html.includes('var records={}, goal=10, view="home"'),"Default browser view is Home");
assert.ok(html.includes('window.history.pushState'),"Navigating updates URL");
assert.ok(html.includes('window.addEventListener("popstate"'),"Browser back is supported");
assert.ok(html.includes('aria-current="page"'),"Navigation exposes active state");
assert.ok(html.includes('.home-task:focus-visible'),"Home actions include visible keyboard focus");
assert.ok(html.includes('@media(max-width:650px)'),"Compact layout has a mobile breakpoint");
for(const id of ["home","discover","recent","explore","companies","pipeline","insights","programs","plan","settings"]){
 assert.equal((html.match(new RegExp('id="'+id+'" class="view','g'))||[]).length,1,"View "+id+" occurs once");
}
console.log("PASS: Home is first, separated from discovery and analytics, responsive and deep-linkable.");
