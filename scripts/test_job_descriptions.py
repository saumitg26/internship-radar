#!/usr/bin/env python3
"""No-network regression tests for structured public employer job descriptions."""
import sync_jobs as m

def test():
    cases = [
        (
            {"url":"https://jobs.smartrecruiters.com/TestCompany/12345-software-engineer-intern"},
            "https://api.smartrecruiters.com/v1/companies/TestCompany/postings/12345",
            {"jobAd":{"sections":{"jobDescription":{"text":"<p>Build Java APIs for backend services.</p>"},"qualifications":{"text":"<ul><li>Python and SQL</li></ul>"}}}},
            ["Build Java APIs","Python and SQL"]
        ),
        (
            {"url":"https://apply.workable.com/testco/j/DEADBEEF/apply/"},
            "https://www.workable.com/api/accounts/testco?details=true",
            {"jobs":[{"shortcode":"DEADBEEF","description":"<p>Develop TypeScript applications and AWS services.</p>"}]},
            ["Develop TypeScript"]
        ),
        (
            {"url":"https://gdit.wd5.myworkdayjobs.com/gdit_earlytalent/job/USA-VA-Falls-Church/Summer-2027-Software-Development-Internship_RQ228405-2"},
            "https://gdit.wd5.myworkdayjobs.com/wday/cxs/gdit/gdit_earlytalent/job/USA-VA-Falls-Church/Summer-2027-Software-Development-Internship_RQ228405-2",
            {"jobPostingInfo":{"jobDescription":"<p>Write reliable Python and Java software, test services, and collaborate with the team.</p>"}},
            ["Write reliable Python"]
        ),
    ]
    original=m.get
    try:
        for job,expected_url,response,fragments in cases:
            def fake_get(url):
                assert url==expected_url,(url,expected_url)
                return response
            m.get=fake_get
            actual=m.ats_job_description(job)
            if "Workday" in expected_url:
                pass
            for phrase in fragments:
                assert phrase in actual,(job,phrase,actual)
            assert "Source-reported internship" not in actual
        print("Employer details PASS: SmartRecruiters, Workable and Workday formats.")
    finally:
        m.get=original

if __name__=="__main__":
    test()
