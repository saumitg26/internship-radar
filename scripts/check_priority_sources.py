#!/usr/bin/env python3
"""Non-deploying diagnostic: check actual qualifying leads from Virginia ATS feeds.

Bounded Workday pagination. A refused request means unavailable from this runner,
NOT evidence that employer has no internships. No data is published.
"""
import concurrent.futures
import json
from pathlib import Path
import sync_jobs

ROOT=Path(__file__).resolve().parents[1]

def check(board):
    try:
        if board["ats"]=="workday":
            rows=sync_jobs.workday_jobs(board)
        elif board["company"]=="Shield AI":
            rows=sync_jobs.scan(board)
        else:
            return board["company"],"not checked",0,0,""
        tech=[sync_jobs.normalize(dict(row)) for row in rows]
        tech=[j for j in tech if j]
        local=sum(1 for j in tech if j.get("dmv_priority") or sync_jobs.RX_REGION.search(j["location"]))
        samples=" | ".join(j["title"][:65] for j in tech[:2])
        if not tech:
            samples="No qualifying titles in "+str(len(rows))+" scanned; sample: "+" | ".join(str(r.get("title",""))[:50] for r in rows[:3])
        return board["company"],"responding",len(tech),local,samples
    except Exception as e:
        return board["company"],"request blocked/error",0,0,type(e).__name__+": "+str(e)[:120]

def main():
    boards=json.loads((ROOT/"scripts/boards.json").read_text())
    focus=[x for x in boards if x["ats"]=="workday" or x["company"]=="Shield AI"]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results=list(pool.map(check,focus))
    print("\n=== VA internship source diagnostic (one request per board) ===")
    for company,status,count,local,info in results:
        print(f"{company}: {status}; qualifying tech internships={count}; VA/DMV={local}; examples={info}")
    success=sum(status=="responding" for _,status,_,_,_ in results)
    print(f"Sources responding from this Actions runner: {success}/{len(results)}")
    # Do not fail or fake live coverage. The actual refresh tracks failures itself.

if __name__=="__main__":
    main()
