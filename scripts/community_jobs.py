"""Broader 2027 US engineering internship leads from public community feeds.

These are candidates, not guarantees of active employer vacancies.
"""
import re

SOURCES = {
 "ApplyGuy": "https://raw.githubusercontent.com/ApplyGuy/2027-Internships/main/data/internships.json",
 "2027 Tech Jobs": "https://raw.githubusercontent.com/aprameyak/2027-tech-jobs/main/listings.json",
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

def gather(get_json):
 out=[];ok=[];errors=[];counts={}
 for name,url in SOURCES.items():
  try:
   data=get_json(url)
   rows=list(_applyguy(data) if name=="ApplyGuy" else _techjobs(data))
   out.extend(rows);ok.append(name);counts[name]=len(rows)
  except Exception as err:errors.append(name+": "+str(err)[:110])
 return out,ok,errors,counts
