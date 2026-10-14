"""Additional independent, public sources for US Summer 2027 internship leads.

Read-only sources; links lead to employers. A source listing may be stale.
Markdown providers do not reliably publish original posting dates, so we do
not turn relative 'age' values into a fabricated posted date.
"""
import html
import re
from urllib.request import Request, urlopen

SOURCES={
    "SpeedyApply SWE":"https://raw.githubusercontent.com/speedyapply/2027-SWE-College-Jobs/main/README.md",
    "SpeedyApply AI":"https://raw.githubusercontent.com/speedyapply/2027-AI-College-Jobs/main/README.md",
    "2027 Internship Scanner":"https://raw.githubusercontent.com/WonOfAKind/New-Grad-And-Internships-2027/main/data/latest_scan.json",
    "Vansh 2027 Internships":"https://raw.githubusercontent.com/vanshb03/Summer2027-Internships/dev/README.md",
    "Zapply 2027 Internships":"https://raw.githubusercontent.com/zapplyjobs/Internships-2027/main/README.md",
    "2027 Tracker SWE":"https://raw.githubusercontent.com/SuryaHarikrishnan/2027-internship-tracker/master/listings/software-engineering.md",
    "2027 Tracker AI":"https://raw.githubusercontent.com/SuryaHarikrishnan/2027-internship-tracker/master/listings/data-science-ai-machine-learning.md",
}
FOREIGN=re.compile(r"\b(canada|toronto|montreal|vancouver|ottawa|quebec|ontario|united kingdom|london|india|singapore|germany|ireland|dublin|france|australia|poland|japan|brazil|netherlands|spain|berlin|paris|sydney|bengaluru|hyderabad)\b",re.I)
TECH=re.compile(r"software|developer|devops|computer science|cloud|data|cyber|security|ai\b|machine learning|web|full.?stack|back.?end|front.?end|platform|IT intern|information technology|infrastructure|systems engineering|firmware|embedded|compiler|robotics|quantitative developer",re.I)
INTERNSHIP=re.compile(r"intern(ship)?|co[- ]?op|fellow(ship)?|apprentice",re.I)
BAD_DEGREE=re.compile(r"(ph\.?d\.?|doctoral|high school|mba only|masters only|master.s only)",re.I)

def eligible(title,location):
    if not INTERNSHIP.search(title) or not TECH.search(title):
        return False
    if BAD_DEGREE.search(title):
        return False
    if re.search(r"\b(2025|2026|2028|2029)\b",title) and "2027" not in title:
        return False
    if re.search(r"\b(spring|fall|winter)\s+2027\b",title,re.I) and not re.search(r"\bsummer\b",title,re.I):
        return False
    if FOREIGN.search(location) and not re.search(r"\b(US|USA|United States)\b",location,re.I):
        return False
    if re.search(r",\s*(ON|BC|QC|AB)\b",location):
        return False
    return True

def clean(text):
    return html.unescape(re.sub(r"<[^>]+>","",str(text))).strip().replace("**","")

def speedy(text,source):
    if not isinstance(text,str):
        raise ValueError("Expected Markdown from "+source)
    if "USA" not in text[:4500] or "Internships" not in text[:4500]:
        raise ValueError("Unexpected SpeedyApply format")
    for line in text.splitlines():
        if not line.startswith("|"):
            continue
        parts=[x.strip() for x in line.split("|")[1:-1]]
        if len(parts)<6:
            continue
        company=clean(parts[0]);title=clean(parts[1]);location=clean(parts[2])
        if not company or not eligible(title,location):
            continue
        # The posting cell is HTML with the direct employer apply link.
        links=re.findall(r'<a\s+href="(https://[^"]+)"',parts[4],re.I)
        if not links:
            continue
        url=html.unescape(links[0]).strip()
        if not url.startswith("https://"):
            continue
        yield {
            "company":company[:120],
            "title":title[:180],
            "location":location[:220] or "Location unspecified",
            "description":"Independent public internship lead; verify requirements and availability with the employer.",
            "url":url,
            "source":source+" · community",
            "posted":"",
            "community":True,
        }

def recent_scan(data):
    if not isinstance(data,dict) or not isinstance(data.get("fresh_leads"),list):
        raise ValueError("Unexpected recent scan format")
    for row in data["fresh_leads"]:
        if not isinstance(row,dict) or row.get("role_type")!="Internship":
            continue
        title=str(row.get("title") or "")
        location=str(row.get("location") or "")
        url=row.get("url")
        if not eligible(title,location) or not isinstance(url,str) or not url.startswith("https://"):
            continue
        yield {
            "company":str(row.get("company") or "Unknown employer")[:120],
            "title":title[:180],
            "location":location[:220] or "Location unspecified",
            "description":"Recently discovered public internship lead; verify this is a Summer 2027 opening.",
            "url":url,
            "source":"2027 Internship Scanner · community",
            "posted":str(row.get("posted_at") or "")[:10],
            "community":True,
        }

def get_text(url):
    req=Request(url,headers={"User-Agent":"InternshipRadar/1.0", "Accept":"text/plain"})
    with urlopen(req,timeout=22) as response:
        return response.read(4500000).decode("utf-8",errors="replace")

def newer_tables(text,source):
    """Extract public, US-focused tech internships; ignore closed listings and relative ages."""
    if not isinstance(text,str) or 'Internships' not in text[:4000]:
        raise ValueError('Unexpected community format')
    previous_company=''
    for line in text.splitlines():
        if not line.startswith('|') or '<a href=' not in line and '](https://' not in line:
            continue
        cols=[c.strip() for c in line.strip().strip('|').split('|')]
        if source=='Vansh 2027 Internships':
            if len(cols)<5:continue
            company,title,location,posting=cols[:4]
        else:
            if len(cols)<6:continue
            company,title,location,posting=cols[0],cols[1],cols[2],cols[5]
        company=clean(company)
        if company=='↳':company=previous_company
        else:previous_company=company
        title=clean(title)
        location=clean(location).replace('<br>',' / ')
        if not eligible(title,location) or '🔒' in title or '🔒' in line or 'closed' in posting.lower():
            continue
        urls=re.findall(r'(?:href="|\]\()(https://[^"\s)]+)',posting,re.I)
        if not urls:continue
        url=html.unescape(urls[0]).strip()
        # Avoid generating fake original posting dates from relative-age labels.
        yield {
          'company':company[:120], 'title':title[:180],
          'location':location[:220] or 'Location unspecified',
          'description':'Community listing; check the employer posting for the complete job description.',
          'url':url, 'source':source+' · community', 'posted':'',
          'community':True
        }


def tracked_2027(text,source):
    """Public technical Markdown tables; only Summer 2027 or recent unknown-season US roles.

    Posting dates are source-reported, NOT independently employer-verified.
    """
    from datetime import date
    if not isinstance(text,str) or "| Company | Role | Location | Terms |" not in text[:1000]:
        raise ValueError("Unexpected 2027 tracker table")
    today=date.today()
    for line in text.splitlines():
        if not line.startswith("| ["):continue
        cols=[c.strip() for c in line.strip().strip("|").split("|")]
        if len(cols)<7:continue
        companycell,title,location,term,datecell=cols[:5]
        m=re.fullmatch(r"\[([^\]]+)\]\((https://[^)]+)\)",companycell)
        if not m:continue
        company,url=m.groups()
        title=clean(title)
        location=clean(location)
        term=clean(term)
        posted=datecell.strip()
        if not eligible(title,location):continue
        if re.search(r"\b(2025|2026|2028|2029)\b",term) and "2027" not in term:continue
        if re.search(r"\b(winter|spring|fall)\s+2027\b",term,re.I) and not re.search(r"summer 2027",term,re.I):continue
        is_summer=bool(re.search(r"\bsummer\s+2027\b",term+" "+title,re.I))
        if not is_summer:
            if term not in ("","N/A","—","-"):continue
            try:
                published=date.fromisoformat(posted)
                if (today-published).days not in range(0,31):continue
            except ValueError:continue
        yield {
          "company":clean(company)[:120],
          "title":title[:180],
          "location":location[:220] or "Location unspecified",
          "description":"Source-reported internship. "+("Summer 2027 indicated by the source." if is_summer else "Season unspecified; verify Summer 2027 with employer."),
          "url":html.unescape(url),
          "source":source+" · community",
          "posted":posted if re.fullmatch(r"\d{4}-\d{2}-\d{2}",posted) else "",
          "community":True,
        }

def gather(get_json):
    leads=[];healthy=[];errors=[];counts={}
    for name,url in SOURCES.items():
        try:
            rows=list(recent_scan(get_json(url)) if name=="2027 Internship Scanner"
              else tracked_2027(get_text(url),name) if name in ("2027 Tracker SWE","2027 Tracker AI")
              else newer_tables(get_text(url),name) if name in ('Vansh 2027 Internships','Zapply 2027 Internships')
              else speedy(get_text(url),name))
            counts[name]=len(rows)
            healthy.append(name)
            leads.extend(rows)
        except Exception as exc:
            errors.append(name+": "+str(exc)[:110])
    return leads,healthy,errors,counts
