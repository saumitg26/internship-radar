"""Cross-source internship deduplication without merging distinct requisitions."""
import re
from urllib.parse import urlsplit,parse_qsl,urlencode

TRACKING={"ref","source","referrer","gh_src","lever-source","utm_source","utm_medium","utm_campaign","utm_term","utm_content","gclid","fbclid"}
def canonical_url(url):
    p=urlsplit(str(url or ""))
    query=urlencode(sorted((k.lower(),v) for k,v in parse_qsl(p.query,keep_blank_values=True) if k.lower() not in TRACKING and not k.lower().startswith("utm_")))
    return (p.netloc.lower()+p.path.rstrip("/").lower()+"?"+query).rstrip("?")
def compact(value):
    return re.sub(r"[^a-z0-9]","",str(value or "").casefold())
def role_key(job):
    return (compact(job.get("company")),compact(job.get("title")),compact(job.get("location")))
def quality(job):
    return (not bool(job.get("community")), bool(job.get("job_description")),len(str(job.get("job_description") or job.get("description") or "")),int(job.get("score") or 0))
def dedupe(jobs):
    """Collapse duplicate URLs and identical company/title/location across all sources.
    Do not fuzzy-match different titles or locations: that can erase real openings.
    """
    unique=[]; by_url={};by_role={}
    for job in sorted(jobs,key=quality,reverse=True):
        url=canonical_url(job.get("url"));role=role_key(job)
        existing=by_url.get(url) if url else None
        if existing is None and all(role):
            existing=by_role.get(role)
        if existing is not None:
            # Merge useful missing details without changing the chosen primary listing.
            for field in ("job_description","discovered_on","first_seen","posted"):
                if not existing.get(field) and job.get(field):existing[field]=job[field]
            continue
        unique.append(job)
        if url:by_url[url]=job
        if all(role):by_role[role]=job
    return unique
