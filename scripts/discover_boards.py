"""Discover additional public employer boards from independent internship listings.

Only recognizes known, public applicant tracking system (ATS) URL shapes.
No arbitrary websites, crawling, login, company-name guessing or private URLs.
Selection rotates fairly across refreshes within a bounded request budget.
"""
import hashlib
import re
from collections import Counter
from datetime import datetime, timezone
from urllib.parse import urlsplit

SLUG=re.compile(r"^[a-zA-Z0-9_.-]{2,70}$")
WD_HOST=re.compile(r"^[a-z0-9-]+\.wd[0-9]+\.myworkdayjobs\.com$")
LOCALE=re.compile(r"^[a-z]{2}-[a-z]{2}$",re.I)
CAPS={"greenhouse":30,"lever":16,"ashby":20,"workday":6,"smartrecruiters":12,"workable":12}
TOTAL_BUDGET=60

def from_listing(listing):
    """Return a vetted board reference or None for an unsupported job URL."""
    if not isinstance(listing,dict):return None
    company=str(listing.get("company") or "").strip()[:110]
    if not company or company.lower()=="unknown employer":return None
    url=listing.get("url")
    if not isinstance(url,str):return None
    try:
        parsed=urlsplit(url)
        if parsed.scheme!="https" or not parsed.hostname or parsed.username or parsed.password or parsed.port:return None
    except ValueError:
        return None
    host=parsed.hostname.lower()
    path=[p for p in parsed.path.strip("/").split("/") if p]
    kind=None
    slug=None
    if host in ("job-boards.greenhouse.io","boards.greenhouse.io"):
        if len(path)<3 or path[1]!="jobs":return None
        kind,slug="greenhouse",path[0]
    elif host=="jobs.lever.co":
        if len(path)<2:return None
        kind,slug="lever",path[0]
    elif host=="jobs.ashbyhq.com":
        if len(path)<2:return None
        kind,slug="ashby",path[0]
    elif host=="jobs.smartrecruiters.com":
        if len(path)<2:return None
        kind,slug="smartrecruiters",path[0]
    elif host=="apply.workable.com":
        if len(path)<3 or path[1]!="j":return None
        kind,slug="workable",path[0]
    elif WD_HOST.fullmatch(host):
        if path and LOCALE.fullmatch(path[0]):path=path[1:]
        if len(path)<3 or path[1]!="job":return None
        kind,slug="workday",path[0]
    else:
        return None
    if not SLUG.fullmatch(slug):return None
    result={"company":company,"ats":kind,"slug":slug,"discovered":True}
    if kind=="workday":result["host"]=host
    return result

def key(board):
    return (board["ats"],str(board.get("host","")).lower(),board["slug"].lower())

def discover(listings,configured):
    """Return unique board candidates not already in the configured registry."""
    existing={key(b) for b in configured}
    hits={}
    counts=Counter()
    for listing in listings:
        board=from_listing(listing)
        if board is None:continue
        k=key(board)
        if k in existing:continue
        hits.setdefault(k,board)
        counts[k]+=1
    return list(hits.values()),counts

def choose(listings,configured,at=None,budget=TOTAL_BUDGET):
    """Select a rotating, reproducible subset with per-ATS and total caps.

    Six rotations per day, aligned to the existing four-hour refresh schedule.
    Frequent and one-off small-company leads both have a chance to be scanned.
    """
    candidates,counts=discover(listings,configured)
    at=at or datetime.now(timezone.utc)
    if at.tzinfo is None:at=at.replace(tzinfo=timezone.utc)
    slot=int(at.timestamp()//14400)
    def order(board):
        k=key(board)
        token=f"{slot}|{k[0]}|{k[1]}|{k[2]}".encode()
        random_order=int.from_bytes(hashlib.sha256(token).digest()[:8],"big")
        # Small bonus for independent repeat leads, not enough to drown out niche firms.
        return (random_order // min(3,counts[k]),random_order)
    candidates.sort(key=order)
    if budget<=0:return [],len(candidates)
    taken=Counter()
    selected=[]
    for board in candidates:
        kind=board["ats"]
        if taken[kind]>=CAPS[kind]:continue
        selected.append(board)
        taken[kind]+=1
        if len(selected)>=max(0,min(TOTAL_BUDGET,int(budget))):break
    return selected,len(candidates)
