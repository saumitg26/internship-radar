"""Broader 2027 US engineering internship leads from public community feeds.

These are candidates, not guarantees of active employer vacancies.
"""
import re
from datetime import datetime, timezone

SOURCES = {
 "ApplyGuy": "https://raw.githubusercontent.com/ApplyGuy/2027-Internships/main/data/internships.json",
 "2027 Tech Jobs": "https://raw.githubusercontent.com/aprameyak/2027-tech-jobs/main/listings.json",
 "Understudy": "https://raw.githubusercontent.com/Keugene11/Summer-2027-Tech-Internships/main/.github/scripts/listings.json",
 "2027 Live ATS": "https://raw.githubusercontent.com/zshah101/Automated-List-Of-Summer-2027-and-Fall-2026-Tech-Internships/main/docs/api/jobs.json",
}
FOREIGN=re.compile(r"\b(canada|toronto|montreal|vancouver|ottawa|quebec|ontario|united kingdom|london|india|singapore|germany|ireland|dublin|france|australia|poland|japan|brazil|netherlands|spain|berlin|paris|sydney|bengaluru|hyderabad)\b",re.I)
DEGREE=re.compile(r"\b(phd only|ph\.?d\.? only|doctoral only|mba only|masters only|master.s only)\b",re.I)
INTERNSHIP=re.compile(r"intern|co[- ]?op|fellow|apprentice",re.I)

def _valid(title,season,location):
 title,season,location=str(title or ""),str(season or ""),str(location or "")
 if not INTERNSHIP.search(title):return False
 if re.search(r"\b(2025|2026|2028|2029)\b",title) and "2027" not in title:return False
 if re.search(r"\b(2025|2026|2028|2029)\b",season) and "2027" not in season:return False
 if re.search(r"\b(spring|fall|winter)\b",season,re.I) and not re.search("summer",season,re.I):return False
 if FOREIGN.search(location) and not re.search(r"\b(USA|US|United States)\b",location,re.I):return False
 if re.search(r",\s*(ON|BC|QC|AB)\b",location):return False
 return True

def _item(company,title,loc,url,source,posted,season):
 return {"company":str(company or "Unknown employer")[:120],"title":str(title)[:180],"location":str(loc or "Location unspecified")[:220],"url":url,"source":source+" · community","posted":str(posted or "")[:10],"season":str(season or "")[:60],"community":True,
   "description":"Public community listing. Verify that this internship is currently open on the employer's website."}

def _applyguy(data):
 if not isinstance(data,dict) or not isinstance(data.get("jobs"),list):raise ValueError("Invalid ApplyGuy feed")
 for x in data["jobs"]:
  if not isinstance(x,dict):continue
  title=x.get("title","");season=x.get("season","");loc=x.get("location","");url=x.get("listingUrl") or x.get("url")
  if _valid(title,season,loc) and not DEGREE.search(str(title)+" "+str(x.get("category",""))) and isinstance(url,str) and url.startswith("https://"):
   yield _item(x.get("company"),title,loc,url,"ApplyGuy",x.get("posted"),season)

def _techjobs(data):
 if not isinstance(data,list):raise ValueError("Invalid 2027 Tech Jobs feed")
 for x in data:
  if not isinstance(x,dict) or x.get("type")!="summer":continue
  title=x.get("role","");season=x.get("season","");loc=x.get("location","");url=x.get("url")
  if "2027" in str(season) and _valid(title,season,loc) and not DEGREE.search(str(x.get("education",""))) and isinstance(url,str) and url.startswith("https://"):
   yield _item(x.get("company"),title,loc,url,"2027 Tech Jobs",x.get("date_added"),season)


def _understudy(data):
 if not isinstance(data,list):raise ValueError("Understudy feed must be an array")
 for row in data:
  if not isinstance(row,dict) or row.get("active") is False or row.get("is_visible") is False:continue
  title=row.get("title") or ""
  locs=row.get("locations") or []
  loc=", ".join(str(x) for x in locs if x) if isinstance(locs,list) else str(locs)
  terms=row.get("terms") or []
  season=", ".join(str(x) for x in terms if x) if isinstance(terms,list) else str(terms)
  url=row.get("url")
  if not _valid(title,season,loc) or DEGREE.search(str(title)):continue
  if not isinstance(url,str) or not url.startswith("https://"):continue
  stamp=row.get("date_posted")
  posted=""
  if isinstance(stamp,(int,float)) and 1600000000<float(stamp)<2200000000:
   posted=datetime.fromtimestamp(stamp,timezone.utc).date().isoformat()
  yield _item(row.get("company_name"),title,loc,url,"Understudy",posted,season)

def _liveats(data):
 if not isinstance(data,dict) or not isinstance(data.get("jobs"),list):
  raise ValueError("2027 Live ATS feed must contain jobs array")
 for row in data["jobs"]:
  if not isinstance(row,dict):continue
  title=row.get("title") or ""
  season=row.get("season") or ""
  loc=row.get("location") or ""
  url=row.get("url")
  if not _valid(title,season,loc):continue
  # An unstated season is a potential lead, not a verified Summer 2027 offer.
  if not isinstance(url,str) or not url.startswith("https://"):continue
  if DEGREE.search(str(title)+" "+str(row.get("program") or "")):continue
  item=_item(row.get("company"),title,loc,url,"2027 Live ATS",row.get("posted_at"),season)
  item["description"]="Public employer-board lead. Season may be unstated; verify Summer 2027 timing and live availability."
  item["matched_skills"]=[str(skill) for skill in row.get("skills",[])[:12] if isinstance(skill,str)] if isinstance(row.get("skills"),list) else []
  yield item

def gather(get_json):
 out=[];ok=[];errors=[];counts={}
 for name,url in SOURCES.items():
  try:
   data=get_json(url)
   rows=list(_applyguy(data) if name=="ApplyGuy" else _techjobs(data) if name=="2027 Tech Jobs" else _understudy(data) if name=="Understudy" else _liveats(data))
   out.extend(rows);ok.append(name);counts[name]=len(rows)
  except Exception as err:errors.append(name+": "+str(err)[:110])
 return out,ok,errors,counts
