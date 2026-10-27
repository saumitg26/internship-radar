#!/usr/bin/env python3
"""No-network tests of automatically discovering US employer ATS boards."""
import sys
from pathlib import Path
from datetime import datetime,timezone,timedelta
sys.path.insert(0,str(Path(__file__).resolve().parent))
import discover_boards as d
import sync_jobs as sync

def lead(company,url):
    return {"company":company,"title":"Software Engineer Intern - Summer 2027","location":"Seattle, WA","url":url}
def run():
    urls=[
        ("Tiny Startup","https://jobs.ashbyhq.com/tiny-startup/uuid-id","ashby","tiny-startup"),
        ("SmallCo","https://jobs.lever.co/smallco/abc123/apply","lever","smallco"),
        ("MidCorp","https://job-boards.greenhouse.io/midcorp/jobs/342434","greenhouse","midcorp"),
        ("LegacyCo","https://boards.greenhouse.io/legacy/jobs/1234","greenhouse","legacy"),
        ("Enterprise","https://enterprise.wd4.myworkdayjobs.com/en-US/External_Careers/job/New-York/Software-Engineering-Intern_R8888","workday","External_Careers"),
    ]
    for name,url,kind,slug in urls:
        b=d.from_listing(lead(name,url))
        assert b and b["ats"]==kind and b["slug"]==slug,(url,b)
    invalid=[
        "https://tiny-startup.example/careers/jobs/abc",
        "https://jobs.ashbyhq.com/boardonly",
        "https://jobs.lever.co/boardonly",
        "https://boards.greenhouse.io/boardonly",
        "https://jobs.ashbyhq.com.evil.org/fake/jobs/123",
        "https://user:pass@jobs.lever.co/acme/jobs/abc",
        "http://jobs.lever.co/acme/jobs/abc",
        "https://jobs.lever.co:8443/acme/jobs/abc",
        "https://localhost/jobs/foo/bar",
        "https://127.0.0.1/jobs/foo/bar",
        "https://company.wd3.myworkdayjobs.com/boardonly",
        "https://example.com/redirect?url=https://jobs.ashbyhq.com/foo/bar",
    ]
    for url in invalid:
        assert d.from_listing(lead("Unknown",url)) is None,url
    assert d.from_listing(lead("Unknown employer","https://jobs.lever.co/abc/jobs/id")) is None
    jobs=[lead(name,url) for name,url,_,_ in urls]
    jobs+=[lead("SmallCo","https://jobs.lever.co/smallco/another/job")]
    configured=[{"company":"MidCorp","ats":"greenhouse","slug":"midcorp"}]
    boards,counts=d.discover(jobs,configured)
    assert len(boards)==4,len(boards)
    assert max(counts.values())==2
    now=datetime(2026,10,26,17,tzinfo=timezone.utc)
    first,total=d.choose(jobs,configured,now,budget=3)
    second,total2=d.choose(jobs,configured,now,budget=3)
    assert total==total2==4 and first==second
    assert len(first)==3
    assert not any(x["company"]=="MidCorp" for x in first)
    assert d.choose(jobs,configured,now,budget=0)[0]==[]
    massive=[lead("Tiny "+str(i),"https://jobs.ashbyhq.com/tiny"+str(i)+"/role") for i in range(200)]
    massive += [lead("Workday "+str(i),f"https://client{i}.wd1.myworkdayjobs.com/External/job/SF/Intern_R{i}") for i in range(40)]
    selected,count=d.choose(massive,[],now)
    assert count==240
    assert len(selected)<=d.TOTAL_BUDGET and sum(x["ats"]=="workday" for x in selected)<=d.CAPS["workday"]
    different,_=d.choose(massive,[],now+timedelta(hours=4))
    assert [d.key(x) for x in selected]!=[d.key(x) for x in different],"Rotating selection should reach new employers"
    wd={"company":"Tiny Workday","ats":"workday","slug":"Careers","host":"tiny.wd1.myworkdayjobs.com","discovered":True}
    calls=[]
    def fetch(url,body):
        calls.append(body["offset"])
        return {"total":10000,"jobPostings":[
            {"title":"Software Intern","externalPath":f"/job/CA/Intern_{body['offset']+i}","locationsText":"CA, USA"} for i in range(20)
        ]}
    results=sync.workday_jobs(wd,fetch=fetch)
    assert calls==[0,20,40] and len(results)==60,(calls,len(results))
    print("PASS: safe ATS host extraction, employer deduplication, bounded rotation, and small-company coverage")
if __name__=="__main__":
    run()
