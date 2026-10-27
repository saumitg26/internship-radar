#!/usr/bin/env python3
"""Non-deploying smoke check for independently maintained nationwide feeds."""
import nationwide_jobs as n

def main():
    rows,ok,errors,counts=n.gather()
    companies={r["company"].casefold() for r in rows}
    urls={r["url"] for r in rows}
    print("=== Nationwide internships feed diagnostic ===")
    for name in n.SOURCES:
        print(f"{name}: {counts.get(name,0)} US tech internship leads"+(" (unavailable)" if name not in ok else ""))
    print(f"Totals before cross-source dedup: {len(rows)} leads; {len(urls)} URLs; {len(companies)} companies; {len(ok)}/{len(n.SOURCES)} sources responding")
    for err in errors:print("Source warning: "+err)
    # The main refresh deduplicates these against all existing employer/11 discovery feeds.
if __name__=="__main__":
    main()
