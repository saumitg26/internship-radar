"""Independent nationwide technical internship feeds with direct employer links.

All sources are public, unauthenticated, and fallible. These are application
leads, not independently verified openings. Never use third-party auto-apply
or registration links instead of employer job URLs.
"""
import html
import re
from urllib.parse import urlsplit
from extra_jobs import get_text, eligible, clean as clean_html

SOURCES={
    "Trakker US Internships":"https://raw.githubusercontent.com/TrakkerHQ/swe-jobs/main/README.md",
    "Big Tech Internship Tracker":"https://raw.githubusercontent.com/Emjumaev/FAANG-2027-Internships-Tracker/main/README.md",
    "Jobbie US Listings":"https://raw.githubusercontent.com/jobbie-bot/Summer-2027-Tech-Internships/main/README.md",
}
FOREIGN_PLACE=re.compile(r"\b(basel|yerevan|bucharest|milan|belgrade|zurich|switzerland|italy|armenian|armenia|romania|lithuania|greece|united kingdom|england|poland|dublin|cork|ireland|germany|india|canada|singapore|australia|portugal|israel|tokyo|japan|korea|brazil|netherlands|spain|france)\b",re.I)
TITLE_SKIP=re.compile(r"\b(PhD(?:\s+only)?|doctoral|MBA|high school)\b",re.I)
DATE=re.compile(r"^\d{4}-\d{2}-\d{2}$")
LINK=re.compile(r"https://[^\s\"'<>)]+")

def _safe_url(url):
    if not isinstance(url,str):return ""
    url=html.unescape(url).strip()
    try:
        parts=urlsplit(url)
        if parts.scheme!="https" or not parts.hostname or parts.username or parts.password:return ""
        if parts.hostname.lower() in {"jobbie.bot","aplyr.ai","swejoblists.com"}:return ""
        return url
    except ValueError:return ""

def _item(company,title,location,url,source,posted=""):
    company=clean_html(company)[:120]
    title=clean_html(title).replace("🆕","").replace("🇺🇸","").replace("🛂","").strip()[:180]
    location=clean_html(location)[:220]
    url=_safe_url(url)
    if not (company and title and url) or TITLE_SKIP.search(title) or "🔒" in title:return None
    if not eligible(title,location) or FOREIGN_PLACE.search(location):return None
    return {
        "company":company,"title":title,"location":location or "Location unspecified",
        "description":"Public national technical internship lead. Verify the employer application, academic requirements and availability.",
        "url":url,"source":source+" · community",
        "posted":posted if DATE.fullmatch(str(posted)) else "",
        "community":True,
    }

def trakker(text):
    start="<!-- TABLE_USA_INTERN_START -->"
    end="<!-- TABLE_USA_INTERN_END -->"
    if start not in text or end not in text:raise ValueError("USA intern table markers unavailable")
    block=text.split(start,1)[1].split(end,1)[0]
    for line in block.splitlines():
        if not line.startswith("| **"):continue
        cells=[c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells)!=5:continue
        company,title,location,posting,age=cells
        match=re.search(r'<a\s+href="(https://[^"]+)"',posting,re.I)
        if not match:continue
        item=_item(company.replace("**",""),title,location,match.group(1),"Trakker US Internships")
        if item:yield item

def bigtech(text):
    if "## Amazon" not in text or "## Google" not in text:raise ValueError("Big Tech sections missing")
    company=""
    for line in text.splitlines():
        if line.startswith("## "):
            company=line[3:].strip()
            if company=="How this works":break
            continue
        if not company or not line.startswith("| ["):continue
        cells=[c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells)<5:continue
        match=re.match(r"\[([^\]]+)\]\((https://[^)]+)\)",cells[0])
        if not match:continue
        title,url=match.groups()
        location=cells[3]
        posted=cells[4]
        item=_item(company,title,location,url,"Big Tech Internship Tracker",posted)
        if item:yield item

def jobbie(text):
    if "| Company | Role | Location | Posted | Link |" not in text:raise ValueError("US employer-link table missing")
    for line in text.splitlines():
        if not line.startswith("| ") or "[Job listing](https://" not in line:continue
        cells=[c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells)!=6:continue
        company,title,location,posted,posting,_=cells
        match=re.search(r"\[Job listing\]\((https://[^)]+)\)",posting)
        if not match:continue
        item=_item(company,title,location,match.group(1),"Jobbie US Listings",posted)
        if item:yield item

PARSERS={
    "Trakker US Internships":trakker,
    "Big Tech Internship Tracker":bigtech,
    "Jobbie US Listings":jobbie,
}
def gather(fetch_text=get_text):
    leads=[];healthy=[];errors=[];counts={}
    for name,url in SOURCES.items():
        try:
            raw=fetch_text(url)
            rows=list(PARSERS[name](raw))
            if not rows:raise ValueError("Source returned no qualifying US technical internships")
            healthy.append(name)
            counts[name]=len(rows)
            leads.extend(rows)
        except Exception as err:
            errors.append(name+": "+str(err)[:110])
    return leads,healthy,errors,counts
