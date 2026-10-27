"""Cumulative nationwide employer index and fair ATS refresh scheduler.

A company in the index means that a public internship source has referenced it.
It does NOT imply an available job or a verified hiring program. Previously
observed sources survive through the public jobs.json snapshot after deploy.
"""
import hashlib
import ipaddress
import re
from datetime import datetime, timezone, timedelta
from urllib.parse import urlsplit
from discover_boards import from_listing, key as board_key, CAPS, TOTAL_BUDGET

MAX_RECORDS=12000
RETENTION_DAYS=365
SUPPORT=set(CAPS)
BLACKLIST={"linkedin.com","www.linkedin.com","indeed.com","www.indeed.com","glassdoor.com",
           "www.glassdoor.com","handshake.com","app.joinhandshake.com","jobbie.bot","aplyr.ai",
           "github.com","raw.githubusercontent.com","bit.ly","tinyurl.com","google.com",
           "docs.google.com","forms.gle","forms.office.com","discord.com","workday.com"}
def now_string(at):return at.astimezone(timezone.utc).replace(microsecond=0).isoformat()

def classify_link(raw):
    """Capture verified HTTPS listing URLs, but never crawl arbitrary sites."""
    if not isinstance(raw,dict):return None
    company=str(raw.get("company") or "").strip()[:110]
    url=raw.get("url")
    if not company or company.casefold() in ("unknown employer","unknown","n/a","none"):
        return None
    if not isinstance(url,str) or len(url)>1300:return None
    try:
        parsed=urlsplit(url)
        if parsed.scheme!="https" or not parsed.hostname or parsed.username or parsed.password or parsed.port:
            return None
    except ValueError:return None
    host=parsed.hostname.lower()
    if "." not in host or host.endswith((".local",".internal",".localhost")):return None
    try:
        if not ipaddress.ip_address(host).is_global:return None
    except ValueError:
        pass
    if host in BLACKLIST or host.endswith(".linkedin.com") or host.endswith(".indeed.com"):
        return None
    direct=from_listing(raw)
    if direct:
        return dict(direct, mode="public_board", careers_url=url.split("#",1)[0][:800])
    if host=="jobs.jobvite.com" and len(parsed.path.split("/"))>=3:
        platform="jobvite"
    elif host.endswith(".icims.com") and "/jobs/" in parsed.path:
        platform="icims"
    elif host.endswith(".oraclecloud.com") and "/CandidateExperience/" in parsed.path:
        platform="oracle"
    elif (host.endswith(".successfactors.com") or host.endswith(".successfactors.eu") or host.endswith(".jobs2web.com")):
        platform="successfactors"
    else:
        platform="other"
    return dict(company=company,ats=platform,mode="link_only",careers_url=url.split("#",1)[0][:800])

def registry_key(record):
    """Stable across source reordering and changes in job URL."""
    if record.get("mode")=="public_board":
        return "ats|"+ "|".join(board_key(record))
    canonical=re.sub(r"[^a-z0-9]+","",str(record.get("company","")).lower())
    return "lead|"+canonical

def _parsed_date(value):
    try:
        x=datetime.fromisoformat(str(value).replace("Z","+00:00"))
        return x.replace(tzinfo=timezone.utc) if x.tzinfo is None else x.astimezone(timezone.utc)
    except (ValueError,TypeError):return None

def merge(old, leads, configured, at=None):
    """Keep previously discovered employers, add new ones, prune very old links."""
    at=at or datetime.now(timezone.utc)
    if at.tzinfo is None:at=at.replace(tzinfo=timezone.utc)
    stamp=now_string(at)
    earliest=at-timedelta(days=RETENTION_DAYS)
    configured_keys={"ats|"+"|".join(board_key(b)) for b in configured}
    records={}
    if not isinstance(old,list):old=[]
    for item in old[:MAX_RECORDS*2]:
        if not isinstance(item,dict):continue
        k=item.get("key")
        if not isinstance(k,str) or len(k)>280:continue
        if k in configured_keys:continue
        seen=_parsed_date(item.get("last_seen"))
        if not seen or seen<earliest:continue
        company=str(item.get("company") or "")[:110]
        mode=item.get("mode")
        ats=item.get("ats")
        url=item.get("careers_url")
        if not company or mode not in ("public_board","link_only") or not isinstance(url,str) or not url.startswith("https://"):
            continue
        if mode=="public_board":
            probe=from_listing({"company":company,"url":url})
            if not probe or registry_key(dict(probe,mode="public_board"))!=k:continue
        else:
            probe=classify_link({"company":company,"url":url})
            if not probe or probe["mode"]!="link_only" or registry_key(probe)!=k:continue
        record=dict(probe,key=k,first_seen=str(item.get("first_seen") or stamp)[:32],
                    last_seen=str(item["last_seen"])[:32],
                    last_checked=str(item.get("last_checked") or "")[:32],
                    last_success=str(item.get("last_success") or "")[:32],
                    last_status="ok" if item.get("last_status")=="ok" else "error" if item.get("last_status")=="error" else "not_checked",
                    failures=max(0,min(99,int(item.get("failures") or 0))),
                    last_job_count=max(0,min(100000,int(item.get("last_job_count") or 0))))
        records[k]=record
    for raw in leads:
        info=classify_link(raw)
        if not info:continue
        k=registry_key(info)
        if k in configured_keys:continue
        prior=records.get(k)
        if prior:
            prior["last_seen"]=stamp
            if prior["mode"]=="link_only" and info["mode"]=="public_board":
                # If same company gets a direct ATS source, the link-only
                # history remains separately identified and is not called scanned.
                pass
        else:
            records[k]=dict(info,key=k,first_seen=stamp,last_seen=stamp,
                            last_checked="",last_success="",last_status="not_checked",
                            failures=0,last_job_count=0)
    values=list(records.values())
    # Never discard fresh discoveries; bound the embedded JSON snapshot.
    values.sort(key=lambda x:(x["last_seen"],x["first_seen"],x["key"]),reverse=True)
    return values[:MAX_RECORDS]

def choose(registry, configured, at=None, budget=TOTAL_BUDGET):
    """Scan oldest unchecked first, rotate ties and avoid immediate retries."""
    at=at or datetime.now(timezone.utc)
    if at.tzinfo is None:at=at.replace(tzinfo=timezone.utc)
    configured_keys={"ats|"+"|".join(board_key(b)) for b in configured}
    slot=int(at.timestamp()//14400)
    options=[]
    for record in registry:
        if record.get("mode")!="public_board" or record.get("ats") not in SUPPORT:
            continue
        if record.get("key") in configured_keys:continue
        checked=_parsed_date(record.get("last_checked"))
        if checked and record.get("last_status")=="error":
            pause=min(48,6*max(1,int(record.get("failures") or 1)))
            if (at-checked).total_seconds()<pause*3600:continue
        options.append(record)
    def order(record):
        checked=_parsed_date(record.get("last_checked"))
        age=checked.timestamp() if checked else 0
        h=int.from_bytes(hashlib.sha256((str(slot)+"|"+record["key"]).encode()).digest()[:8],"big")
        return age,h
    options.sort(key=order)
    cap={k:0 for k in CAPS}
    picked=[]
    limit=max(0,min(TOTAL_BUDGET,int(budget)))
    for record in options:
        kind=record["ats"]
        if cap[kind]>=CAPS[kind]:continue
        picked.append(record)
        cap[kind]+=1
        if len(picked)>=limit:break
    return picked[:limit],len(options)

def update_checked(registry, updates, at=None):
    """Updates map registry keys to (success, count); modifies each record."""
    at=at or datetime.now(timezone.utc)
    stamp=now_string(at)
    for item in registry:
        if item.get("key") not in updates:continue
        success,count=updates[item["key"]]
        item["last_checked"]=stamp
        if success:
            item["last_success"]=stamp
            item["last_status"]="ok"
            item["failures"]=0
            item["last_job_count"]=max(0,int(count))
        else:
            item["last_status"]="error"
            item["failures"]=min(99,int(item.get("failures") or 0)+1)

def stats(registry):
    return dict(discovered=len(registry),
                public_boards=sum(r.get("mode")=="public_board" for r in registry),
                link_only=sum(r.get("mode")=="link_only" for r in registry),
                scanned_ever=sum(bool(r.get("last_checked")) for r in registry),
                responding_last_scan=sum(r.get("last_status")=="ok" for r in registry))
