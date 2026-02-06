const puppeteer = require("puppeteer");
const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const ENCRYPTION_KEY = crypto.createHash("sha256").update(process.env.SECRET_KEY).digest();
const IV_LENGTH = 16;

function decrypt(text) {
  const [ivHex, encryptedText] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

class MeroShareAutomation {
  constructor(credentials) {
    this.config = {
      baseURL: "https://webbackend.cdsc.com.np/api/meroShare",
      frontendURL: "https://meroshare.cdsc.com.np",
      timeout: 30000,
      defaultDelay: 1000,
    };
    this.credentials = credentials;
    this.validateCredentials();
  }

  validateCredentials() {
    const required = ["dpId", "username", "password", "crnNumber", "pin"];
    const missing = required.filter((key) => !this.credentials[key]);
    if (missing.length > 0)
      throw new Error(`Missing required credentials: ${missing.join(", ")}`);
  }

  delay(ms = this.config.defaultDelay) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getHeaders(authorization = null) {
    return {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
      ...(authorization && { authorization }),
      "content-type": "application/json",
      Referer: this.config.frontendURL,
    };
  }

  async postWithFilters(url, filterFields, searchConstant, authorization) {
    return axios.post(
      url,
      {
        filterFieldParams: filterFields,
        page: 1,
        size: 200,
        searchRoleViewConstants: searchConstant,
        filterDateParams: [],
      },
      {
        headers: this.getHeaders(authorization),
        timeout: this.config.timeout,
      }
    );
  }

  async fetchApplicantFormIdBasedOnScript(authorization) {
    const url = `${this.config.baseURL}/applicantForm/active/search/`;
    const filterFields = [
      { key: "companyShare.companyIssue.companyISIN.script", alias: "Scrip" },
      { key: "companyShare.companyIssue.companyISIN.company.name", alias: "Company Name" },
    ];
    return this.postWithFilters(url, filterFields, "VIEW_APPLICANT_FORM_COMPLETE", authorization);
  }

  async fetchApplicantFormDetails(authorization, applicantFormId) {
    const url = `${this.config.baseURL}/applicantForm/report/detail/${applicantFormId}`;
    const { data } = await axios.get(url, {
      headers: this.getHeaders(authorization),
      timeout: this.config.timeout,
    });
    return {
      statusName: data.statusName,
      meroshareRemark: data.meroshareRemark,
    };
  }

  async getDpNameById(dpId) {
    const url = `${this.config.baseURL}/capital/`;
    const response = await axios.get(url, {
      headers: this.getHeaders(),
      timeout: this.config.timeout,
    });
    const dp = response.data.find((item) => item.code.toString() === dpId.toString());
    if (!dp) throw new Error(`DP with ID ${dpId} not found`);
    return dp.name;
  }

  async performLogin(page, dpName, dpId) {
    await page.goto(this.config.frontendURL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".select2-selection", { visible: true });
    await page.click(".select2-selection");
    await page.waitForSelector(".select2-search__field", { visible: true });
    await page.type(".select2-search__field", dpId);
    await page.keyboard.press("Enter");
    await page.type("#username", this.credentials.username);
    await this.delay(500);
    await page.type("#password", this.credentials.password);
    await this.delay(500);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle2" });
  }

  async getAuthorizationToken(page) {
    await page.goto(`${this.config.frontendURL}/#/asba`, { waitUntil: "networkidle2" });
    const authToken = await page.evaluate(() => window.sessionStorage.getItem("Authorization"));
    if (!authToken) throw new Error("Failed to retrieve authorization token");
    return authToken;
  }

  async clickApplicationReportTab(page) {
    await page.waitForSelector(".nav .nav-link");
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll(".nav .nav-link"));
      const reportTab = tabs.find((tab) => tab.textContent.includes("Application Report"));
      if (reportTab) reportTab.click();
    });
    await this.delay(2000);
  }

  async fillApplicationForm(page, authToken) {
    console.log("🔁 Navigating to ASBA dashboard...");
    await page.goto(`${this.config.frontendURL}/#/asba`, { waitUntil: "domcontentloaded" });
    await this.clickApplicationReportTab(page);

    console.log("📡 Fetching applicant form list...");
    const applicantFormsResponse = await this.fetchApplicantFormIdBasedOnScript(authToken);
    const applicantForms = applicantFormsResponse?.data?.object || [];

    const historyPath = path.join(__dirname, "history.json");
    if (!fs.existsSync(historyPath)) {
      console.warn("⚠️ history.json not found. Skipping update.");
      return;
    }

    const historyData = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
    const matchedHistoryRecords = historyData.filter(
      (record) => record.username === this.credentials.username
    );

    for (const [i, history] of matchedHistoryRecords.entries()) {
      const company = history.company.toUpperCase();
      const matchingShare = applicantForms.find(
        (item) => item.scrip?.toUpperCase() === company
      );

      console.log(`🔍 [${i + 1}/${matchedHistoryRecords.length}] Checking: ${company}`);
      if (!matchingShare) {
        console.warn(`⛔ No matching script found for: ${company}`);
        continue;
      }

      const applicantFormId = matchingShare.applicantFormId;
      console.log(`🆔 Applicant Form ID: ${applicantFormId}`);

      try {
        const { statusName, meroshareRemark } = await this.fetchApplicantFormDetails(
          authToken,
          applicantFormId
        );
        console.log("✅ Status:", statusName || "N/A");
        console.log("💬 Remark:", meroshareRemark || "N/A");

        const index = historyData.findIndex(
          (entry) =>
            entry.username === this.credentials.username &&
            entry.company.toUpperCase() === company
        );

        if (index !== -1) {
          historyData[index].boid = this.credentials.boid;
          historyData[index].statusName = statusName;
          historyData[index].meroshareRemark = meroshareRemark;
          console.log("💾 History record updated.");
        }
      } catch (err) {
        console.error("❌ Error fetching form details:", err.message);
      }

      await this.delay(5000); // Wait 5 seconds between each record
    }

    fs.writeFileSync(historyPath, JSON.stringify(historyData, null, 2));
    console.log("📁 history.json saved.");
  }

  async execute() {
    let browser = null;
    try {
      const dpName = await this.getDpNameById(this.credentials.dpId);
      browser = await puppeteer.launch({
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });

      await this.performLogin(page, dpName, this.credentials.dpId);
      const authToken = await this.getAuthorizationToken(page);
      await this.fillApplicationForm(page, authToken);
    } catch (error) {
      console.error("⚠️ Automation failed:", error.message);
    } finally {
      if (browser) await browser.close();
    }
  }
}

module.exports = MeroShareAutomation;

if (require.main === module) {
  const accountsPath = path.join(__dirname, "accounts.json");
  if (!fs.existsSync(accountsPath)) {
    console.error("❌ accounts.json file not found!");
    process.exit(1);
  }

  const accounts = JSON.parse(fs.readFileSync(accountsPath, "utf-8"));
  const decryptedAccounts = accounts.map((acc) => ({
    ...acc,
    password: decrypt(acc.password),
    crnNumber: decrypt(acc.crnNumber),
    pin: decrypt(acc.pin),
  }));

  (async () => {
    for (const [index, credentials] of decryptedAccounts.entries()) {
      console.log(`🚀 Running automation for #${index + 1}: ${credentials.username}`);
      try {
        const automation = new MeroShareAutomation(credentials);
        await automation.execute();
      } catch (err) {
        console.error(`❌ Error for ${credentials.username}:`, err.message);
      }

      await new Promise((res) => setTimeout(res, 9000)); // Delay between accounts
    }
    console.log("✅ All accounts processed.");
  })();
}
