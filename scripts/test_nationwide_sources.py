#!/usr/bin/env python3
"""Offline regression tests: nationwide discovery must use employer URLs."""
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import nationwide_jobs as n

TRAKKER='''<!-- TABLE_USA_INTERN_START -->
| Company | Position | Location | Posting | Age |
|---|---|---|---|---|
| **Microsoft** | Software Engineering Intern | Redmond, Washington, USA | <a href="https://apply.careers.microsoft.com/job/42"><img src="apply.svg"></a> | 1d |
| **Firm 2** | Developer Intern, Winter 2027 | Toronto, Canada | <a href="https://jobs.example.com/43">Apply</a> | 1d |
<!-- TABLE_USA_INTERN_END -->'''
BIG='''# Internship tracker
## Amazon
| Role | Category | Degree | Location | Posted | First seen |
|---|---|---|---|---|---|
| [Software Development Engineer Intern](https://amazon.jobs/en/jobs/123) 🆕 | Software | BS | Seattle, WA | 2026-10-26 |
| [Software Engineer Intern](https://amazon.jobs/en/jobs/124) | Software | BS | Bucharest | 2026-10-26 |
## Google
| Role | Category | Degree | Location | Posted | First seen |
|---|---|---|---|---|---|
| [AI Research Intern](https://www.google.com/about/careers/jobs/123) | AI/ML | BS | Mountain View, CA | 2026-10-25 |
## How this works
'''
JOBBIE='''# US Tech Internships
| Company | Role | Location | Posted | Link | Apply with Jobbie |
|---|---|---|---|---|---|
| Nvidia | Software Engineering Intern | California, United States | 2026-10-26 | [Job listing](https://nvidia.wd5.myworkdayjobs.com/careers/job/123) | <a href="https://jobbie.bot/register?job=123">Apply</a> |
| Error | Software Engineering Intern | Virginia, United States | 2026-10-26 | [Job listing](https://jobbie.bot/register?job=abc) | <a href="https://jobbie.bot/register?job=abc">Apply</a> |
'''
def run():
    a=list(n.trakker(TRAKKER))
    assert len(a)==1 and a[0]["company"]=="Microsoft"
    assert a[0]["url"]=="https://apply.careers.microsoft.com/job/42"
    b=list(n.bigtech(BIG))
    assert len(b)==2 and {x["company"] for x in b}=={"Amazon","Google"}
    assert b[0]["posted"]=="2026-10-26"
    c=list(n.jobbie(JOBBIE))
    assert len(c)==1 and c[0]["company"]=="Nvidia" and "jobbie.bot" not in c[0]["url"]
    assert not n._item("Scam","Software Engineer Intern","Boston","javascript:alert(1)","Fake")
    assert not n._item("Fake","Software Engineer Intern","Boston","https://jobbie.bot/signup","Fake")
    assert not n._item("Lab","PhD ML Intern","Seattle","https://jobs.example.edu/123","Test")
    seen={n.SOURCES["Trakker US Internships"]:TRAKKER,n.SOURCES["Big Tech Internship Tracker"]:BIG,n.SOURCES["Jobbie US Listings"]:JOBBIE}
    rows,healthy,errors,counts=n.gather(lambda url:seen[url])
    assert len(healthy)==3 and len(rows)==4 and not errors,errors
    assert sorted(counts.values())==[1,1,2]
    failed,ok,errors,counts=n.gather(lambda url:{"unexpected":"format"} if False else (_ for _ in ()).throw(ValueError("feed down")))
    assert not failed and not ok and len(errors)==3
    print("PASS: nationwide parser fixtures, direct employer URLs, non-US exclusions, rejection of auto-apply links, and source failures")

if __name__=="__main__":
    run()
