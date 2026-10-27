#!/usr/bin/env python3
"""Deterministic offline test for persistent employer discovery and scan fairness."""
from datetime import datetime,timezone,timedelta
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import employer_registry as r
import discover_boards as d

NOW=datetime(2026,10,26,21,tzinfo=timezone.utc)

def lead(company,url):
    return {"company":company,"title":"Software Engineering Intern - Summer 2027",
            "location":"Reston, VA","url":url}

def test():
    listing=[
        lead("Little Startup","https://jobs.ashbyhq.com/littlestartup/4d90c7d8-123"),
        lead("Local Consulting","https://jobs.lever.co/localconsulting/d123456"),
        lead("National Chain","https://jobs.smartrecruiters.com/NationalChain/1234-intern"),
        lead("School District","https://apply.workable.com/district/j/A12BB3/"),
        lead("Healthcare","https://jobs.healthcare.icims.com/jobs/1234/software-intern/job"),
        lead("Jobvite Startup","https://jobs.jobvite.com/techstart/job/abc123"),
        lead("Enterprise","https://client.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/123"),
        lead("Factory","https://career5.successfactors.com/portal/jobs?id=123"),
        lead("Small local business","https://smallbusiness.example/careers/software-internship"),
    ]
    reg=r.merge([],listing,[],NOW)
    assert len(reg)==9,len(reg)
    assert r.stats(reg)["public_boards"]==4
    assert r.stats(reg)["link_only"]==5
    assert {x["ats"] for x in reg if x["mode"]=="link_only"}=={"icims","jobvite","oracle","successfactors","other"}
    assert all(x["last_checked"]=="" for x in reg)
    selected,total=r.choose(reg,[],NOW,budget=2)
    assert len(selected)==2 and total==4
    assert all(s["mode"]=="public_board" for s in selected)
    results={s["key"]:(True,3) for s in selected}
    r.update_checked(reg,results,NOW)
    assert all(x["last_status"]=="ok" and x["last_job_count"]==3 for x in reg if x["key"] in results)
    second,_=r.choose(reg,[],NOW+timedelta(hours=4),budget=2)
    assert len(second)==2 and not ({s["key"] for s in selected}&{s["key"] for s in second})
    # Scan state and source links must persist with no new listings in next refresh.
    nextreg=r.merge(reg,[],[],NOW+timedelta(hours=4))
    assert len(nextreg)==len(reg)
    preserved=next(x for x in nextreg if x["key"]==selected[0]["key"])
    assert preserved["last_status"]=="ok" and preserved["last_job_count"]==3
    # Configuration must supersede dynamic discovery and prevent redundant polling.
    configured=[{"company":"Little Startup","ats":"ashby","slug":"littlestartup"}]
    nextreg=r.merge(reg,listing,configured,NOW+timedelta(hours=5))
    assert not any(x.get("slug")=="littlestartup" for x in nextreg)
    # Failure cooldown: three consecutive errors -> 18 hour retry pause.
    candidate=next(x for x in nextreg if x["mode"]=="public_board")
    for i in range(3):
        r.update_checked(nextreg,{candidate["key"]:(False,0)},NOW+timedelta(hours=i))
    assert candidate["failures"]==3 and candidate["last_status"]=="error"
    short,_=r.choose(nextreg,configured,NOW+timedelta(hours=5))
    assert candidate["key"] not in {x["key"] for x in short}
    late,_=r.choose(nextreg,configured,NOW+timedelta(hours=21))
    assert candidate["key"] in {x["key"] for x in late}
    assert len(r.merge(nextreg,[],configured,NOW+timedelta(days=370)))==0
    # No URL tricks or third-party auto-apply pages become recognized employer links.
    invalid=[
      "http://jobs.ashbyhq.com/acme/123",
      "https://jobs.ashbyhq.com.evil.example/acme/123",
      "https://127.0.0.1/admin",
      "https://localhost/private",
      "https://user:pass@jobs.lever.co/company/123",
      "https://www.linkedin.com/jobs/view/123",
      "https://jobbie.bot/register?job=123",
      "https://app.joinhandshake.com/jobs/123",
      "https://indeed.com/viewjob?jk=123",
      "https://tinyurl.com/xyz",
    ]
    assert not [u for u in invalid if r.classify_link(lead("Demo",u))],[u for u in invalid if r.classify_link(lead("Demo",u))]
    assert r.classify_link(lead("Demo","https://jobs.ashbyhq.com/demo/abc"))["mode"]=="public_board"
    assert len(r.merge([{"key":"bad","company":"evil","mode":"public_board","careers_url":"http://localhost","last_seen":NOW.isoformat()}],[],[],NOW))==0
    print("PASS: cumulative source registry, five link-only platforms, scan fairness and cooldown, data retention, safe URL rules")

if __name__=="__main__":
    test()
