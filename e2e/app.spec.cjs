const {test,expect}=require("@playwright/test");
test("home, navigation and feed are functional",async({page})=>{
 await page.goto("/index.html");
 await expect(page.getByText("Internship Radar").first()).toBeVisible();
 await expect(page.locator("#mainContent")).toBeVisible();
 await page.getByRole("button",{name:/Explore internships/i}).first().click();
 await expect(page.locator("#explore")).toHaveClass(/active/);
 await expect(page.locator("#exploreJobList")).toBeVisible();
});
test("copilot opens and generates editable evidence-only drafts",async({page})=>{
 await page.goto("/application-copilot.html");
 await expect(page.locator("#generate")).toBeVisible();
 await page.locator("#company").fill("Example Company");
 await page.locator("#role").fill("Software Intern");
 await page.locator("#evidence").fill("Built a Python dashboard using real project data.");
 await page.locator("#detail").fill("their engineering work");
 await page.locator("#generate").click();
 await expect(page.locator("#output")).toHaveValue(/Example Company/);
 await expect(page.locator("#output")).toHaveValue(/Python dashboard/);
 await expect(page.locator("#copy")).toBeEnabled();
});
test("resume studio starts without Javascript errors",async({page})=>{
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("/resume-studio.html");
 await expect(page.locator("#jobDescription")).toBeVisible();
 expect(errors).toEqual([]);
});
