const {defineConfig,devices}=require("@playwright/test");
module.exports=defineConfig({testDir:"./e2e",timeout:30000,retries:1,webServer:{command:"python3 -m http.server 8765 --directory site",port:8765,reuseExistingServer:!process.env.CI,timeout:15000},use:{baseURL:"http://127.0.0.1:8765",trace:"retain-on-failure"},projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}}]});
