#!/usr/bin/env python3
"""Refresh a public, keyless feed of internship postings from configured ATS boards."""
import concurrent.futures
import hashlib
import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
BOARD_FILE=ROOT/"scripts"/"boards.json"
SITE=ROOT/"site"
RX_ROLE=re.compile(r"\b(intern(ship)?|co[- ]?op|fellow(ship)?|apprentice(ship)?)\b", re.I)
RX_TECH=re.compile(r"software|developer|engineering|backend|front.?end|cloud|platform|devops|data engineer|cyber|machine learning|artificial intelligence",re.I)
RX_EXCLUDE=re.compile(r"\b(sales|marketing|accounting|recruiting|human resources|business development|graphic design|legal)\b",re.I)
RX_FOREIGN=re.compile(r"\b(london|india|singapore|australia|germany|united kingdom|canada|france|netherlands|poland|japan|dublin|ireland|spain|brazil|toronto|vancouver|montreal|berlin|munich|amsterdam|paris|sydney|melbourne|hyderabad|bengaluru)\b",re.I)
RX_DMV=re.compile(r"\b(washington\s*,?\s*d\.?c\.?|district of columbia|northern virginia|dmv|fairfax|reston|mclean|herndon|arlington|alexandria|falls church|vienna|tysons|chantilly|sterling|ashburn|leesburg|dulles|springfield|manassas|woodbridge|bethesda|rockville|silver spring|gaithersburg|college park|hyattsville)\b",re.I)
RX_REGION=re.compile(r"\b(virginia|maryland|va|md)\b",re.I)
SKILLS=("Java","Python","React","TypeScript","AWS","SQL","PostgreSQL","API","Cloud")
def clean(s):
    return re.sub(r"\s+"," ",html.unescape(re.sub(r"<[^>]+>"," ",str(s or "")))).strip()
def get(url):
    req=Request(url,headers={"User-Agent":"InternshipRadar/1.0 (personal internship search)","Accept":"application/json"})
    with urlopen(req,timeout=17) as response:
        return json.load(response)
def scan(board):
    slug=board["slug"]; typ=board["ats"]; company=board["company"]
    if typ=="greenhouse":
        rows=get("https://boards-api.greenhouse.io/v1/boards/"+slug+"/jobs?content=true").get("jobs",[])
        return [dict(company=company,title=x.get("title",""),location=(x.get("location") or {}).get("name",""),description=clean(x.get("content","")),url=x.get("absolute_url",""),source="Greenhouse") for x in rows]
    if typ=="lever":
        rows=get("https://api.lever.co/v0/postings/"+slug+"?mode=json")
        return [dict(company=company,title=x.get("text",""),location=(x.get("categories") or {}).get("location",""),description=clean(x.get("descriptionPlain") or x.get("description")),url=x.get("hostedUrl") or x.get("applyUrl") or "",source="Lever") for x in rows]
    if typ=="ashby":
        rows=get("https://api.ashbyhq.com/posting-api/job-board/"+slug)
        return [dict(company=company,title=x.get("title",""),location=x.get("location",""),description=clean(x.get("descriptionHtml") or x.get("descriptionPlain")),url=x.get("jobUrl") or x.get("applyUrl") or "",source="Ashby") for x in rows.get("jobs",[]) if x.get("isListed",True)]
    raise ValueError("Unsupported ATS")
def normalize(x):
    title=str(x["title"]);location=str(x["location"] or "Location unspecified");desc=x["description"]
    if not RX_ROLE.search(title) or not RX_TECH.search(title) or RX_EXCLUDE.search(title):return
    if re.search(r"\b(2025|2026|2028|2029)\b",title):return
    if RX_FOREIGN.search(location) and not re.search(r"\bUS\b|USA|United States",location,re.I):return
    url=x["url"]
    if not isinstance(url,str) or not url.startswith("https://"):return
    score=40
    t=title.lower()
    score+=22 if "software" in t else 0
    score+=14 if "backend" in t or "full.stack" in t else 0
    score+=18 if "2027" in t else 0
    score+=9 if "summer" in t else 0
    dmv=bool(RX_DMV.search(location))
    regional=bool(RX_REGION.search(location))
    score+=30 if dmv else (10 if regional else 0)
    score+=5 if "remote" in location.lower() else 0
    matches=[k for k in SKILLS if re.search(r"\b"+re.escape(k)+r"\b",desc,re.I)]
    score+=min(18,len(matches)*3)
    x["id"]=hashlib.sha256(url.encode()).hexdigest()[:18]
    x["description"]=desc[:420]
    x["location"]=location
    x["_rank"]=score  # preserve meaningful ranking when displayed score reaches 99
    x["score"]=min(99,score)
    x["dmv_priority"]=dmv
    x["matched_skills"]=matches
    x["eligibility_notes"]=(["Verify graduation eligibility"] if re.search(r"graduat.{0,30}2027|2027.{0,30}graduat",desc,re.I) and "2028" not in desc else [])
    return x
def main():
    boards=json.loads(BOARD_FILE.read_text())
    jobs={};errors=[];working=0
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        future_map={ex.submit(scan,b):b for b in boards}
        for f in concurrent.futures.as_completed(future_map):
            b=future_map[f]
            try:
                working+=1
                for raw in f.result():
                    job=normalize(raw)
                    if job:jobs[job["id"]]=job
            except Exception as error:
                working-=1
                errors.append(f'{b["company"]}: {str(error)[:100]}')
    matches=sorted(jobs.values(),key=lambda j:(-j["_rank"],j["company"],j["title"]))
    for job in matches:
        job.pop("_rank",None)
    # Never silently preserve a stale snapshot as if it were newly refreshed.
    data={"generated_at":datetime.now(timezone.utc).isoformat(),"scanned_boards":len(boards),"responsive_boards":working,"jobs":matches,"count":len(matches),"errors":errors[:30],"note":"Verify each employer's requirements and whether posting is still open."}
    SITE.mkdir(exist_ok=True)
    (SITE/"jobs.json").write_text(json.dumps(data,indent=2,ensure_ascii=True))
    (SITE/"jobs.js").write_text("window.INTERNSHIP_RADAR_FEED = "+json.dumps(data,ensure_ascii=True)+";\n")
    print(f"Collected {len(matches)} engineering internships from {working}/{len(boards)} boards")
if __name__=="__main__":main()
