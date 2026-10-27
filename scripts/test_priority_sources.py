#!/usr/bin/env python3
"""Offline regression tests for priority Virginia employer feeds and health labels."""
import json
from pathlib import Path
import sync_jobs as m

ROOT=Path(__file__).resolve().parents[1]

def test():
    boards=json.loads((ROOT/"scripts/boards.json").read_text())
    featured=json.loads((ROOT/"scripts/priority_employers.json").read_text())
    names=[x["company"] for x in boards]
    assert len(names)==len(set(names)),"Duplicate direct employer source"
    for company in ["Capital One","Fannie Mae","GDIT","Leidos","Northrop Grumman","Booz Allen Hamilton","Appian","Shield AI"]:
        assert company in names,company
    for b in boards:
        if b["ats"]=="workday":
            assert b["host"].endswith(".myworkdayjobs.com")
            assert b["slug"]
    for employer in featured:
        assert employer["careers_url"].startswith("https://")
        assert employer["company"]
    listed={e["company"] for e in featured}
    for c in ["Freddie Mac","CACI","MITRE","Navy Federal Credit Union","RTX","BAE Systems","SAIC"]:
        assert c in listed,c

    board={"company":"Capital One","ats":"workday","slug":"Capital_One","host":"capitalone.wd12.myworkdayjobs.com"}
    urls=[]
    def fake_fetch(url,payload):
        urls.append((url,payload))
        assert payload["searchText"]=="intern"
        assert payload["limit"]==20
        return {"total":3,"jobPostings":[
            {"title":"Technology Internship Program - Summer 2027",
             "externalPath":"/job/McLean-VA/Technology-Internship-Program---Summer-2027_R244387-1",
             "locationsText":"McLean, VA"},
            {"title":"Software Engineering Intern - Summer 2027",
             "externalPath":"/job/Richmond-VA/Software-Engineer-Intern_R7777",
             "bulletFields":["Richmond, VA"]},
            {"title":"External redirect","externalPath":"//bad.example/intern"}
        ]}
    rows=m.workday_jobs(board,fetch=fake_fetch)
    assert len(urls)==1
    assert urls[0][0]=="https://capitalone.wd12.myworkdayjobs.com/wday/cxs/capitalone/Capital_One/jobs"
    assert len(rows)==2
    assert rows[0]["url"].startswith("https://capitalone.wd12.myworkdayjobs.com/Capital_One/job/")
    assert rows[0]["source"]=="Workday"
    assert rows[1]["location"]=="Richmond, VA"
    normalized=m.normalize(dict(rows[0]))
    assert normalized and normalized["dmv_priority"] and normalized["company"]=="Capital One",normalized

    def partial_fetch(url,payload):
        if payload["offset"]==0:
            return {"total":21,"jobPostings":[
                {"title":"Software Intern","externalPath":"/job/x/test_R1","locationsText":"Reston, VA"}
            ]*20}
        assert payload["offset"]==20
        return {"total":21,"jobPostings":[
            {"title":"Software Intern 2","externalPath":"/job/y/test_R2","locationsText":"Reston, VA"}
        ]}
    assert len(m.workday_jobs(board,fetch=partial_fetch))==2

    for invalid in ("evil.com","evil.wd1.myworkdayjobs.com.bad.example"):
        try:m.workday_jobs({**board,"host":invalid},fetch=fake_fetch)
        except ValueError:pass
        else:raise AssertionError("Untrusted ATS host accepted: "+invalid)
    try:m.workday_jobs(board,fetch=lambda *_:{"response":"invalid"})
    except ValueError:pass
    else:raise AssertionError("Malformed feed response was treated as healthy")
    print("PASS: Virginia employer directory, real Workday job URL construction, regional internship matching, failures and pagination.")

if __name__=="__main__":
    test()
