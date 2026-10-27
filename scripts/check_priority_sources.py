#!/usr/bin/env python3
"""Non-deploying diagnostic: check whether configured Virginia ATS sources answer on Actions.

One public request per source. A refused request means unavailable from this
runner, NOT evidence that employer has no internships. No data is published.
"""
import concurrent.futures
import json
from pathlib import Path
import sync_jobs

ROOT=Path(__file__).resolve().parents[1]

def check(board):
    if board["ats"]=="workday":
        host=board["host"]
        tenant=host.split(".")[0]
        endpoint=f'https://{host}/wday/cxs/{tenant}/{board["slug"]}/jobs'
        try:
            response=sync_jobs.post_json(endpoint,{"appliedFacets":{},"limit":1,"offset":0,"searchText":"intern"})
            if isinstance(response,dict) and isinstance(response.get("jobPostings"),list):
                return board["company"],"responding",len(response["jobPostings"]),str(response.get("total","unknown"))
            return board["company"],"invalid response",0,""
        except Exception as e:
            return board["company"],"request blocked/error",0,type(e).__name__+": "+str(e)[:120]
    if board["company"]=="Shield AI":
        try:
            rows=sync_jobs.scan(board)
            return board["company"],"responding",len(rows),""
        except Exception as e:
            return board["company"],"request blocked/error",0,type(e).__name__+": "+str(e)[:120]
    return board["company"],"not checked",0,""

def main():
    boards=json.loads((ROOT/"scripts/boards.json").read_text())
    focus=[x for x in boards if x["ats"]=="workday" or x["company"]=="Shield AI"]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results=list(pool.map(check,focus))
    print("\n=== VA internship source diagnostic (one request per board) ===")
    for company,status,count,info in results:
        print(f"{company}: {status}; sample={count}; {info}")
    success=sum(status=="responding" for _,status,_,_ in results)
    print(f"Sources responding from this Actions runner: {success}/{len(results)}")
    # Do not fail or fake live coverage. The actual refresh tracks failures itself.

if __name__=="__main__":
    main()
