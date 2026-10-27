#!/usr/bin/env python3
"""Refresh a public, keyless feed of internship postings from configured ATS boards."""
import concurrent.futures
import hashlib
import html
import json
import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from pathlib import Path
from urllib.parse import urlsplit, parse_qsl, urlencode, urlunsplit
from urllib.request import Request, urlopen
from urllib.parse import quote
from community_jobs import gather as gather_community
from extra_jobs import gather as gather_extra
from nationwide_jobs import gather as gather_nationwide, SOURCES as NATIONWIDE_SOURCES
from community_jobs import SOURCES as COMMUNITY_SOURCES
from extra_jobs import SOURCES as EXTRA_SOURCES
from discover_boards import choose as choose_discovered_boards

ROOT=Path(__file__).resolve().parents[1]
BOARD_FILE=ROOT/"scripts"/"boards.json"
PRIORITY_FILE=ROOT/"scripts"/"priority_employers.json"
SITE=ROOT/"site"
RX_ROLE=re.compile(r"\b(intern(ship)?|co[- ]?op|fellow(ship)?|apprentice(ship)?)\b", re.I)
RX_TECH=re.compile(r"software|developer|engineering|computer science|backend|front.?end|cloud|platform|devops|data engineer|data scien|data analy|cyber|machine learning|artificial intelligence|information technology|\btechnology\b|\btechnical\b|\bit\s+intern\b|\bai\b|\bml\b",re.I)
RX_EXCLUDE=re.compile(r"\b(sales|marketing|accounting|recruiting|human resources|business development|graphic design|legal|mechanical|manufacturing|civil engineering|electrical engineering|chemical engineering|industrial engineering|aerospace engineering|materials engineering)\b",re.I)
RX_FOREIGN=re.compile(r"\b(london|india|singapore|australia|germany|united kingdom|canada|france|netherlands|poland|japan|dublin|ireland|spain|brazil|toronto|vancouver|montreal|berlin|munich|amsterdam|paris|sydney|melbourne|hyderabad|bengaluru)\b",re.I)
RX_DMV=re.compile(r"\b(washington\s*,?\s*d\.?c\.?|district of columbia|northern virginia|dmv|fairfax|reston|mclean|herndon|arlington|alexandria|falls church|vienna|tysons|chantilly|sterling|ashburn|leesburg|dulles|springfield|manassas|woodbridge|bethesda|rockville|silver spring|gaithersburg|college park|hyattsville)\b",re.I)
RX_REGION=re.compile(r"\b(virginia|maryland|va|md)\b",re.I)
SKILLS=("Java","Python","React","TypeScript","AWS","SQL","PostgreSQL","API","Cloud")
def clean(s):
    return re.sub(r"\s+"," ",html.unescape(re.sub(r"<[^>]+>"," ",str(s or "")))).strip()
def readable_description(value):
    """Preserve job-description paragraphs and bullets for the editing interface."""
    source=str(value or "")
    source=re.sub(r"(?i)<li(?:\s[^>]*)?>","\n• ",source)
    source=re.sub(r"(?i)<br\s*/?>|</(?:p|div|li|h[1-6]|section|ul|ol)>","\n",source)
    source=re.sub(r"<[^>]+>"," ",source)
    source=html.unescape(source)
    source=re.sub(r"[ \t]+"," ",source)
    source=re.sub(r"\n[ \t]*","\n",source)
    return re.sub(r"\n{3,}","\n\n",source).strip()

def get(url):
    req=Request(url,headers={"User-Agent":"InternshipRadar/1.0 (personal internship search)","Accept":"application/json"})
    with urlopen(req,timeout=17) as response:
        return json.load(response)

def workday_jobs(board, fetch=None):
    """Scan public Workday job-search results without sign-in.

    Workday may reject requests. A failed scan is NOT evidence that there are
    no openings. Use bounded pagination to limit request volume.
    """
    host=str(board.get("host","")).lower()
    site=str(board.get("slug",""))
    if not re.fullmatch(r"[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com",host):
        raise ValueError("Invalid Workday host")
    if not re.fullmatch(r"[A-Za-z0-9_-]+",site):
        raise ValueError("Invalid Workday board identifier")
    tenant=host.split(".")[0]
    endpoint=f"https://{host}/wday/cxs/{tenant}/{site}/jobs"
    fetch=fetch or post_json
    seen=set()
    result=[]
    max_pages=3 if board.get("discovered") else 12
    for term in ("intern",):
        for offset in range(0,max_pages*20,20):
            payload={"appliedFacets":{},"limit":20,"offset":offset,"searchText":term}
            data=fetch(endpoint,payload)
            if not isinstance(data,dict) or not isinstance(data.get("jobPostings"),list):
                raise ValueError("Unexpected Workday job search response")
            posts=data["jobPostings"]
            for post in posts:
                if not isinstance(post,dict):continue
                path=str(post.get("externalPath") or "")
                if not path.startswith("/job/") or path.startswith("//"):continue
                url=f"https://{host}/{quote(site,safe='')}{path}"
                if url in seen:continue
                seen.add(url)
                location=post.get("locationsText") or post.get("location") or ""
                if not location and isinstance(post.get("bulletFields"),list):
                    location=", ".join(str(x) for x in post["bulletFields"][:2])
                result.append(dict(
                    company=board["company"],title=str(post.get("title") or ""),
                    location=str(location),description="",url=url,source="Workday",
                    posted=""
                ))
            total=data.get("total")
            if len(posts)<20 or (isinstance(total,int) and offset+20>=total):break
    return result

def post_json(url,payload):
    body=json.dumps(payload).encode("utf-8")
    req=Request(url,data=body,headers={
        "User-Agent":"Mozilla/5.0 (compatible; InternshipRadar/1.0; public-job-search)",
        "Accept":"application/json","Content-Type":"application/json"
    },method="POST")
    with urlopen(req,timeout=17) as response:
        return json.load(response)

def scan(board):
    slug=board["slug"]; typ=board["ats"]; company=board["company"]
    if typ=="workday":
        return workday_jobs(board)
    if typ=="greenhouse":
        rows=get("https://boards-api.greenhouse.io/v1/boards/"+slug+"/jobs?content=true").get("jobs",[])
        return [dict(company=company,title=x.get("title",""),location=(x.get("location") or {}).get("name",""),description=clean(x.get("content","")),url=x.get("absolute_url",""),source="Greenhouse") for x in rows]
    if typ=="lever":
        rows=get("https://api.lever.co/v0/postings/"+slug+"?mode=json")
        return [dict(company=company,title=x.get("text",""),location=(x.get("categories") or {}).get("location",""),description=clean(x.get("descriptionPlain") or x.get("description")),url=x.get("hostedUrl") or x.get("applyUrl") or "",source="Lever") for x in rows]
    if typ=="ashby":
        rows=get("https://api.ashbyhq.com/posting-api/job-board/"+slug)
        return [dict(company=company,title=x.get("title",""),location=x.get("location",""),description=clean(x.get("descriptionHtml") or x.get("descriptionPlain")),url=x.get("jobUrl") or x.get("applyUrl") or "",source="Ashby") for x in rows.get("jobs",[]) if x.get("isListed",True)]
    if typ=="smartrecruiters":
        # Official unauthenticated public Posting API; one keyword-scoped page.
        rows=get("https://api.smartrecruiters.com/v1/companies/"+quote(slug,safe="")+"/postings?q=intern&limit=100&offset=0")
        if not isinstance(rows,dict) or not isinstance(rows.get("content"),list):
            raise ValueError("Unexpected SmartRecruiters postings response")
        results=[]
        for item in rows["content"]:
            if not isinstance(item,dict):continue
            identifier=str(item.get("id") or "")
            if not re.fullmatch(r"[A-Za-z0-9-]{4,100}",identifier):continue
            loc=item.get("location") or {}
            if not isinstance(loc,dict):loc={}
            location=", ".join(str(loc.get(x)) for x in ("city","region","country") if loc.get(x))
            url="https://jobs.smartrecruiters.com/"+slug+"/"+identifier
            results.append(dict(company=company,title=str(item.get("name") or ""),
                location=location,description="",url=url,source="SmartRecruiters",
                posted=str(item.get("releasedDate") or "")[:10]))
        return results
    if typ=="workable":
        # Workable's documented public account feed (no credentials/candidates).
        payload=get("https://www.workable.com/api/accounts/"+quote(slug,safe="")+"?details=true")
        if not isinstance(payload,dict) or not isinstance(payload.get("jobs"),list):
            raise ValueError("Unexpected Workable public jobs response")
        results=[]
        for item in payload["jobs"]:
            if not isinstance(item,dict):continue
            shortcode=str(item.get("shortcode") or "")
            if not re.fullmatch(r"[A-Za-z0-9_-]{3,100}",shortcode):continue
            location=", ".join(str(item.get(k)) for k in ("city","state","country") if item.get(k))
            if item.get("telecommuting") or item.get("workplace_type")=="remote":location="Remote · "+location
            url="https://apply.workable.com/"+slug+"/j/"+shortcode+"/"
            results.append(dict(company=company,title=str(item.get("title") or ""),
                location=location,description=clean(item.get("description") or ""),
                url=url,source="Workable",posted=str(item.get("published_on") or "")[:10]))
        return results
    raise ValueError("Unsupported ATS")
def normalize(x):
    title=str(x["title"]);location=str(x["location"] or "Location unspecified");desc=x["description"]
    curated_generic=x.get("company") in ("GRVTY","Dark Wolf Solutions") and bool(RX_TECH.search(desc))
    if not RX_ROLE.search(title) or not (RX_TECH.search(title) or curated_generic) or RX_EXCLUDE.search(title):return
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
    matches=list(dict.fromkeys(matches + [k for k in x.get("matched_skills",[]) if isinstance(k,str) and k in SKILLS]))
    score+=min(18,len(matches)*3)
    x["id"]=hashlib.sha256(url.encode()).hexdigest()[:18]
    # Keep full available employer-ATS descriptions for private, in-browser resume comparison.
    # Community listings often have excerpts only; do not pretend they were scraped in full.
    if not x.get("community",False) and len(desc)>420:
        x["job_description"]=desc[:6500]
    x["description"]=desc[:420]
    x["posted"]=str(x.get("posted") or "")[:10]
    x["community"]=bool(x.get("community",False))
    x["location"]=location
    x["_rank"]=score  # preserve meaningful ranking when displayed score reaches 99
    x["score"]=min(99,score)
    x["dmv_priority"]=dmv
    x["matched_skills"]=matches
    x["eligibility_notes"]=(["Verify graduation eligibility"] if re.search(r"graduat.{0,30}2027|2027.{0,30}graduat",desc,re.I) and "2028" not in desc else [])
    return x

def previous_snapshot():
    """Read the previously published public feed to carry forward first-seen dates."""
    url="https://saumitg26.github.io/internship-radar/jobs.json?version="+str(int(datetime.now(timezone.utc).timestamp()))
    try:
        request=Request(url,headers={"User-Agent":"InternshipRadar/1.0","Cache-Control":"no-cache"})
        with urlopen(request,timeout=12) as response:
            data=json.load(response)
        if isinstance(data,dict) and isinstance(data.get("jobs"),list):
            return data
    except Exception as e:
        print("Prior published feed unavailable; freshness unknown: "+str(e)[:100])
    return None

def ats_job_description(job):
    """Read publicly accessible employer ATS details, without accounts or login."""
    u=urlsplit(job["url"])
    host=u.netloc.lower()
    path=[p for p in u.path.strip("/").split("/") if p]
    if host in ("job-boards.greenhouse.io","boards.greenhouse.io") and len(path)>=3 and path[1]=="jobs":
        slug,jid=path[0],path[2]
        if not re.fullmatch(r"[a-zA-Z0-9_-]+",slug) or not re.fullmatch(r"\d+",jid):return ""
        response=get("https://boards-api.greenhouse.io/v1/boards/"+slug+"/jobs/"+jid+"?content=true")
        return clean(response.get("content") or "")
    if host=="jobs.lever.co" and len(path)>=2:
        slug,jid=path[:2]
        if not re.fullmatch(r"[a-zA-Z0-9_-]+",slug) or not re.fullmatch(r"[a-zA-Z0-9-]+",jid):return ""
        response=get("https://api.lever.co/v0/postings/"+slug+"/"+jid)
        return clean(response.get("descriptionPlain") or response.get("description") or "")
    # Public Workday job detail JSON (many employers, including GDIT).
    # Uses only documented-looking public job page structure; no sign-in/cookies.
    workday_path=path[1:] if path and re.fullmatch(r"[a-z]{2}-[A-Za-z]{2}",path[0]) else path
    if re.fullmatch(r"[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com",host) and len(workday_path)>=4 and workday_path[1]=="job":
        tenant=host.split(".")[0]
        board=workday_path[0]
        if not re.fullmatch(r"[A-Za-z0-9_-]+",tenant) or not re.fullmatch(r"[A-Za-z0-9_-]+",board):return ""
        if not all(re.fullmatch(r"[A-Za-z0-9._-]+",piece) for piece in workday_path[2:]):return ""
        endpoint="https://"+host+"/wday/cxs/"+tenant+"/"+board+"/job/"+"/".join(workday_path[2:])
        response=get(endpoint)
        info=response.get("jobPostingInfo") or {}
        desc=readable_description(info.get("jobDescription") or "")
        if len(desc)>180:return desc
        return ""
    # SmartRecruiters' public Posting API provides employer-authored job details.
    if host in ("jobs.smartrecruiters.com","www.smartrecruiters.com") and len(path)>=2:
        company=path[0]
        posting=re.match(r"^(\d+)(?:-|$)|^([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})(?:-|$)",path[1])
        if not re.fullmatch(r"[A-Za-z0-9_-]+",company) or not posting:return ""
        posting_id=posting.group(1) or posting.group(2)
        response=get("https://api.smartrecruiters.com/v1/companies/"+company+"/postings/"+posting_id)
        sections=(response.get("jobAd") or {}).get("sections") or {}
        result=[]
        for key,name in (("jobDescription","Responsibilities"),("qualifications","Qualifications"),("additionalInformation","Additional details")):
            section=sections.get(key) or {}
            content=readable_description(section.get("text") or "")
            if content:result.append(name+":\n"+content)
        return "\n\n".join(result)
    # Workable's public account feed supports descriptions with details=true.
    if host=="apply.workable.com" and len(path)>=3 and path[1]=="j":
        account,shortcode=path[0],path[2]
        if not re.fullmatch(r"[A-Za-z0-9_-]+",account) or not re.fullmatch(r"[A-Za-z0-9_-]+",shortcode):return ""
        response=get("https://www.workable.com/api/accounts/"+account+"?details=true")
        for posting in response.get("jobs",[]):
            if str(posting.get("shortcode") or "").lower()==shortcode.lower():
                return readable_description(posting.get("description") or "")
        return ""
    if host=="ats.rippling.com" and len(path)>=3 and path[1]=="jobs":
        request=Request(job["url"],headers={"User-Agent":"Mozilla/5.0 (compatible; InternshipRadar/1.0)","Accept":"text/html"})
        with urlopen(request,timeout=12) as response:
            page=response.read(750000).decode("utf-8",errors="replace")
        # Prefer publicly served JobPosting structured metadata, when available.
        for block in re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',page,re.I|re.S):
            try:
                meta=json.loads(html.unescape(block))
                elements=meta if isinstance(meta,list) else meta.get("@graph",[meta]) if isinstance(meta,dict) else []
                for item in elements:
                    if isinstance(item,dict) and "JobPosting" in str(item.get("@type","")):
                        desc=clean(item.get("description") or "")
                        if len(desc)>250:return desc
            except (ValueError,TypeError):
                pass
        visible=re.sub(r'(?is)<(script|style|noscript|svg)\b[^>]*>.*?</\1>'," ",page)
        visible=re.sub(r'(?i)<br\b[^>]*>|</(?:p|div|li|h[1-6])>'," \n ",visible)
        return clean(visible)[:6500]
    if host=="jobs.ashbyhq.com" and len(path)>=2:
        slug,jid=path[:2]
        if not re.fullmatch(r"[A-Za-z0-9._-]+",slug) or not re.fullmatch(r"[A-Za-z0-9-]+",jid):return ""
        response=get("https://api.ashbyhq.com/posting-api/job-board/"+slug)
        for item in response.get("jobs",[]):
            posted=urlsplit(item.get("jobUrl") or "").path.strip("/").split("/")
            if len(posted)>=2 and posted[1]==jid:
                return clean(item.get("descriptionHtml") or item.get("descriptionPlain") or "")
    return ""

def enrich_selected_descriptions(matches):
    """Prefill additional employer JDs for high-priority public community listings."""
    public_ats=("greenhouse.io","jobs.lever.co","jobs.ashbyhq.com","ats.rippling.com","myworkdayjobs.com","smartrecruiters.com","apply.workable.com")
    targets=[j for j in matches if j.get("community") and not j.get("job_description") and
             any(host in j.get("url","") for host in public_ats)]
    targets.sort(key=lambda j:(-int("General Dynamics Information Technology" in j.get("company","")),-int("myworkdayjobs.com" in j.get("url","")),-int(bool(j.get('discovered_on'))),-int(bool(j.get('dmv_priority'))),-int(bool(RX_REGION.search(j.get('location','')))),-j.get('score',0)))
    def fill(j):
        try:
            desc=ats_job_description(j)
            if len(desc)>220:return (j,desc[:6500])
        except Exception:pass
        return (j,"")
    hits=0
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        for j,desc in pool.map(fill,targets[:400]):
            if desc:
                j["job_description"]=desc
                hits+=1
    gdit=[j for j in matches if "General Dynamics Information Technology" in j.get("company","") and "Summer 2027 Software Development Internship" in j.get("title","")]
    print("GDIT Summer 2027 Software Development description coverage: "+str([(j.get("url","").split("/")[-1],len(j.get("job_description",""))) for j in gdit]))
    print("Additional full descriptions: "+str(hits)+" fetched from "+str(min(400,len(targets)))+" public ATS roles.")

def main():
    prior=previous_snapshot()
    boards=json.loads(BOARD_FILE.read_text())
    priority_employers=json.loads(PRIORITY_FILE.read_text())
    jobs={};errors=[];working=0;board_health={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        future_map={ex.submit(scan,b):b for b in boards}
        for f in concurrent.futures.as_completed(future_map):
            b=future_map[f]
            try:
                raw_jobs=f.result()
                working+=1
                board_health[b["company"]]="ok"
                for raw in raw_jobs:
                    job=normalize(raw)
                    if job:jobs[job["id"]]=job
            except Exception as error:
                board_health[b["company"]]="error"
                errors.append(f'{b["company"]}: {str(error)[:100]}')
    # Blend direct employer boards with the broader community sources
    community,community_ok,community_errors,community_counts=gather_community(get)
    other,other_ok,other_errors,other_counts=gather_extra(get)
    nationwide,nationwide_ok,nationwide_errors,nationwide_counts=gather_nationwide()
    community.extend(other)
    community.extend(nationwide)
    community_ok.extend(other_ok)
    community_ok.extend(nationwide_ok)
    community_counts.update(other_counts)
    community_counts.update(nationwide_counts)
    errors.extend(community_errors+other_errors+nationwide_errors)
    # Expand beyond a hand-maintained employer list: infer verified public ATS
    # endpoints from the independent national/community internship links.
    # Rotate a fixed budget each 4-hour refresh, including small employers.
    discovered_boards,discoverable_count=choose_discovered_boards(community,boards)
    dynamic_success=0;dynamic_leads=0;dynamic_failures=0
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        tasks={ex.submit(scan,board):board for board in discovered_boards}
        for future in concurrent.futures.as_completed(tasks):
            board=tasks[future]
            try:
                rows=future.result()
                dynamic_success+=1
                for raw in rows:
                    job=normalize(raw)
                    if job and job["id"] not in jobs:
                        jobs[job["id"]]=job
                        dynamic_leads+=1
            except Exception as exc:
                dynamic_failures+=1
                # These may be transient; preserve third-party leads instead.
                if len(errors)<30:errors.append("Discovered "+board["company"]+" ("+board["ats"]+"): "+str(exc)[:95])
    def semantic_key(job):
        return (re.sub(r"\W+","",job["company"].lower()),
                re.sub(r"\W+","",job["title"].lower()),
                re.sub(r"\W+","",job["location"].lower()))
    def canonical_url(url):
        # Strip referral analytics only, preserving IDs needed on real employer pages.
        parts=urlsplit(url)
        query=urlencode([(k,v) for k,v in parse_qsl(parts.query,keep_blank_values=True)
            if not k.lower().startswith("utm_") and k.lower() not in ("ref","source","referrer","gh_src","lever-source")])
        return urlunsplit((parts.scheme.lower(),parts.netloc.lower(),parts.path.rstrip("/"),query,""))
    seen={semantic_key(job) for job in jobs.values()}
    urls={canonical_url(job["url"]) for job in jobs.values()}
    for raw in community:
        job=normalize(raw)
        if not job: continue
        key=semantic_key(job)
        url=canonical_url(job["url"])
        if key in seen or url in urls or job["id"] in jobs:continue
        seen.add(key)
        urls.add(url)
        jobs[job["id"]]=job
    # Keep every distinct, relevant listing our sources return. Front-end pagination
    # renders only a small slice, rather than dropping lower-ranked companies.
    matches=sorted(jobs.values(),key=lambda j:(-j["_rank"],j.get("community",False),j["company"],j["title"]))
    eastern_today=datetime.now(ZoneInfo("America/New_York")).date().isoformat()
    old_jobs={j.get("id"):j for j in prior.get("jobs",[]) if isinstance(j,dict)} if prior else {}
    old_by_url={canonical_url(j["url"]):j for j in prior.get("jobs",[]) if isinstance(j,dict) and j.get("url")} if prior else {}
    old_by_semantic={semantic_key(j):j for j in prior.get("jobs",[]) if isinstance(j,dict) and j.get("company") and j.get("title") and j.get("location")} if prior else {}
    old_generated=str(prior.get("generated_at",""))[:10] if prior else ""
    new_count=0
    for job in matches:
        job.pop("_rank",None)
        old=old_jobs.get(job["id"]) or old_by_url.get(canonical_url(job["url"])) or old_by_semantic.get(semantic_key(job))
        if old:
            job["first_seen"]=old.get("first_seen") or old_generated
            # 'discovered_on' is only recorded for genuinely new jobs after tracking began.
            # Legacy 'first_seen' was migration-baselined for all existing listings.
            job["discovered_on"]=str(old.get("discovered_on") or "")[:10]
            # Cache only previously obtained, public job descriptions for the same job.
            if old.get("job_description") and not job.get("job_description"):
                job["job_description"]=str(old["job_description"])[:6500]
        elif prior:
            job["first_seen"]=eastern_today
            job["discovered_on"]=eastern_today
            new_count+=1
        else:
            job["first_seen"]=""  # no previous snapshot; never mark everything "new"
            job["discovered_on"]=""
    enrich_selected_descriptions(matches)
    # Show real employer details in cards whenever they are available; never
    # continue displaying a vague third-party-source placeholder beside a full JD.
    generic_label=re.compile(r"^(Source-reported internship|Public community listing|Community listing|Independent public internship lead|Recently discovered public internship lead|Public internship lead)",re.I)
    for job in matches:
        full=str(job.get("job_description") or "").strip()
        if len(full)>220 and generic_label.search(str(job.get("description") or "")):
            brief=re.sub(r"\s+"," ",full).strip()
            job["description"]=brief[:417]+("..." if len(brief)>417 else "")
            job["description_source"]="public employer detail"
    # Flag explicitly stated degree/standing constraints; do not infer eligibility.
    for job in matches:
        description=str(job.get("job_description") or "")
        flags=job.get("eligibility_notes") or []
        if re.search(r"currently enrolled senior|must be (?:a )?senior",description,re.I):
            flags.append("Senior academic standing stated · verify eligibility")
        if re.search(r"(?:U\.S\.|US) citizenship required",description,re.I):
            flags.append("U.S. citizenship required")
        job["eligibility_notes"]=list(dict.fromkeys(flags))
    # Never silently preserve a stale snapshot as if it were newly refreshed.
    companies=sorted({job["company"] for job in matches if job["company"].strip() and job["company"]!="Unknown employer"},key=str.casefold)
    direct_counts={}
    for job in matches:
        if not job.get("community"):
            name=job["company"]
            direct_counts[name]=direct_counts.get(name,0)+1
    configured={board["company"] for board in boards}
    featured=[]
    for row in priority_employers:
        company=str(row["company"])
        mode="direct" if company in configured else "link_only"
        status=board_health.get(company,"unknown") if mode=="direct" else "not_connected"
        featured.append({
            "company":company,"careers_url":row["careers_url"],"mode":mode,
            "status":status,"direct_jobs":direct_counts.get(company,0)
        })
    data={"generated_at":datetime.now(timezone.utc).isoformat(),"scanned_boards":len(boards),"responsive_boards":working,"discovered_ats_candidates":discoverable_count,"discovered_ats_scanned":len(discovered_boards),"discovered_ats_responding":dynamic_success,"discovered_ats_added_before_dedup":dynamic_leads,"community_sources_ok":community_ok,"community_counts":community_counts,"community_sources_configured":len(COMMUNITY_SOURCES)+len(EXTRA_SOURCES)+len(NATIONWIDE_SOURCES),"company_count":len(companies),"jobs":matches,"count":len(matches),"new_count":new_count,"freshness_tracked":bool(prior),"description_coverage":sum(bool(j.get("job_description")) for j in matches),"errors":errors[:30],"priority_employers":featured,"note":"Community listings may be outdated. Check the employer site before applying."}
    SITE.mkdir(exist_ok=True)
    (SITE/"jobs.json").write_text(json.dumps(data,indent=2,ensure_ascii=True))
    (SITE/"jobs.js").write_text("window.INTERNSHIP_RADAR_FEED = "+json.dumps(data,ensure_ascii=True)+";\n")
    virginia_count=sum(1 for job in matches if re.search(r"\b(virginia|VA|fairfax|reston|mclean|herndon|arlington|chantilly|richmond)\b",job["location"],re.I))
    print(f"Freshness tracking: {new_count} newly discovered roles; baseline available: {bool(prior)}")
    print(f"ATS auto-discovery: {discoverable_count} candidate company boards, {len(discovered_boards)} scanned, {dynamic_success} responsive, {dynamic_leads} directly fetched leads before cross-source dedup; {dynamic_failures} failed.")
    print(f"Collected {len(matches)} unique internship leads from {len(companies)} companies ({virginia_count} in Virginia), {working}/{len(boards)} employer boards and {len(community_ok)}/{len(COMMUNITY_SOURCES)+len(EXTRA_SOURCES)+len(NATIONWIDE_SOURCES)} discovery feeds; counts: {community_counts}")
if __name__=="__main__":main()
