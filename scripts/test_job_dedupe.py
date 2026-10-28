import unittest
from job_dedupe import dedupe,canonical_url

class TestDedupe(unittest.TestCase):
    def test_tracking_urls(self):
        self.assertEqual(canonical_url("https://jobs.example.com/42?utm_source=a"),canonical_url("https://jobs.example.com/42?utm_source=b"))
    def test_preserve_distinct_requisitions(self):
        rows=[dict(company="Example",title="Software Intern",location="VA",url="https://x.com/jobs/1"),dict(company="Example",title="Software Intern II",location="VA",url="https://x.com/jobs/2")]
        self.assertEqual(len(dedupe(rows)),2)
    def test_prefer_employer_detail(self):
        rows=[dict(company="Acme",title="Software Intern",location="Reston, VA",url="https://community.com/1",community=True,description="lead"),dict(company="Acme",title="Software Intern",location="Reston, VA",url="https://jobs.acme.com/1",community=False,job_description="Complete employer posting")]
        result=dedupe(rows)
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]["url"],"https://jobs.acme.com/1")
    def test_duplicate_url_with_tracking(self):
        rows=[dict(company="Acme",title="Software Intern",location="VA",url="https://x.com/1?utm_source=a"),dict(company="Acme",title="Software Intern",location="Virginia",url="https://x.com/1?utm_source=b")]
        self.assertEqual(len(dedupe(rows)),1)
if __name__=="__main__":unittest.main()
