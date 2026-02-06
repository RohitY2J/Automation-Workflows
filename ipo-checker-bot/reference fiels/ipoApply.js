/**
 * MeroShare Automation Script
 * Automates the share application process via MeroShare using Puppeteer
 * Author: [Your Name]
 *
 * Requirements:
 * - Node.js
 * - Puppeteer
 * - Axios
 * - dotenv
 */

const puppeteer = require("puppeteer");
const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const ENCRYPTION_KEY = crypto.createHash("sha256").update(process.env.SECRET_KEY).digest();
const IV_LENGTH = 16;

/**
 * Decrypts a string encrypted with AES-256-CBC
 * @param {string} text - Encrypted text in the format 'iv:encryptedText'
 * @returns {string} - Decrypted plain text
 */
function decrypt(text) {
  const [ivHex, encryptedText] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

class MeroShareAutomation {
  /**
   * @param {Object} credentials - User credentials and config
   */
  constructor(credentials) {
    this.config = {
      baseURL: "https://webbackend.cdsc.com.np/api/meroShare",
      frontendURL: "https://meroshare.cdsc.com.np",
      timeout: 30000,
      retryAttempts: 3,
      defaultDelay: 1000,
    };
    this.credentials = credentials;
    this.validateCredentials();
  }

  /** Validates required credential fields */
  validateCredentials() {
    const required = ["dpId", "username", "password", "crnNumber", "pin"];
    const missing = required.filter((key) => !this.credentials[key]);
    if (missing.length > 0) throw new Error(`Missing required credentials: ${missing.join(", ")}`);
  }

  /**
   * @param {number} ms - Delay in milliseconds
   * @returns {Promise<void>}
   */
  delay(ms = this.config.defaultDelay) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Returns the headers for API requests
   * @param {string|null} authorization
   * @returns {Object}
   */
  getHeaders(authorization = null) {
    return {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
      ...(authorization && { authorization }),
      "content-type": "application/json",
      Referer: this.config.frontendURL,
    };
  }

  /**
   * Fetches the companyShareId of the target script
   * @param {string} authorization - Bearer token
   * @returns {Promise<string>} - Company share ID
   */
  async fetchFirstCompanyShareId(authorization) {
    const url = `${this.config.baseURL}/companyShare/applicableIssue/`;
    const targetScript = process.env.TARGET_SCRIPT?.toUpperCase();

    const response = await axios.post(
      url,
      {
        filterFieldParams: [
          { key: "companyIssue.companyISIN.script", alias: "Scrip" },
          { key: "companyIssue.companyISIN.company.name", alias: "Company Name" },
        ],
        page: 1,
        size: 10,
        searchRoleViewConstants: "VIEW_APPLICABLE_SHARE",
        filterDateParams: [
          { key: "minIssueOpenDate", value: "" },
          { key: "maxIssueCloseDate", value: "" },
        ],
      },
      {
        headers: this.getHeaders(authorization),
        timeout: this.config.timeout,
      }
    );

    const matchingShare = response.data?.object?.find(
      (item) => item.scrip && item.scrip.toUpperCase() === targetScript
    );
    if (!matchingShare) throw new Error(`No matching share found for script: ${targetScript}`);
    return matchingShare.companyShareId;
  }

  /**
   * @param {string} authorization
   * @returns {Promise<string>} Bank ID
   */
  async getFirstBankId(authorization) {
    const url = `${this.config.baseURL}/bank/`;
    const response = await axios.get(url, {
      headers: this.getHeaders(authorization),
      timeout: this.config.timeout,
    });
    return response.data[0].id;
  }

  /**
   * @param {string} dpId
   * @returns {Promise<string>} DP Name
   */
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

  /**
   * Performs login to MeroShare
   * @param {puppeteer.Page} page
   * @param {string} dpName
   * @param {string} dpId
   */
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

  /**
   * Gets auth token from sessionStorage after login
   * @param {puppeteer.Page} page
   * @returns {Promise<string>} Authorization token
   */
  async getAuthorizationToken(page) {
    await page.goto(`${this.config.frontendURL}/#/asba`, { waitUntil: "networkidle2" });
    const authToken = await page.evaluate(() => window.sessionStorage.getItem("Authorization"));
    if (!authToken) throw new Error("Failed to retrieve authorization token");
    return authToken;
  }

  /**
   * Fills the share application form
   * @param {puppeteer.Page} page - Puppeteer page instance
   * @param {string} companyShareId - Company share ID
   * @param {string} bankId - Bank ID
   */
  async fillApplicationForm(page, companyShareId, bankId) {
    await page.goto(`${this.config.frontendURL}/#/asba/apply/${companyShareId}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("#selectBank");
    await page.select("#selectBank", bankId.toString());
    await this.delay();

    await page.waitForSelector("#accountNumber");
    await page.waitForFunction(() => {
      const select = document.querySelector("#accountNumber");
      return select && select.options.length > 1 && select.options[1].value !== "";
    });

    const secondOptionValue = await page.$eval("#accountNumber option:nth-child(2)", (o) => o.value);
    await page.select("#accountNumber", secondOptionValue);
    await this.delay();

    const appliedKitta = parseInt(process.env.APPLIED_KITTA);
    await page.type("#appliedKitta", appliedKitta.toString());
    await this.delay();

    await page.type("#crnNumber", this.credentials.crnNumber);
    await this.delay();
    await page.click("#disclaimer");

    await page.waitForFunction(() => {
      const btn = document.querySelector('button[type="submit"]');
      return btn && !btn.disabled;
    });
    await page.click('button[type="submit"]');
  }

  /**
   * Completes the share application submission by entering transaction PIN
   * @param {puppeteer.Page} page
   */
  async completeApplication(page) {
    await page.waitForSelector("#transactionPIN");
    await this.delay();
    await page.type("#transactionPIN", this.credentials.pin);
    await this.delay(2000);

    try {
      await page.waitForFunction(() => {
        const btn = document.querySelector('button[type="submit"]:not([disabled])');
        return btn !== null;
      }, { timeout: 10000 });
      await page.click('button[type="submit"]');
    } catch {
      await page.evaluate(() => {
        document.querySelectorAll('button[type="submit"]').forEach(btn => {
          const span = btn.querySelector("span");
          if (span?.textContent.trim() === "Apply") btn.click();
        });
      });
    }

    await this.delay(2000);

    try {
      const historyEntry = {
        company: process.env.TARGET_SCRIPT || "Unknown",
        boid: this.credentials.boid,
        username: this.credentials.username,
        fullname: this.credentials.fullname,
        units: parseInt(process.env.APPLIED_KITTA) || 0,
        date: new Date().toISOString(),
      };
      const historyPath = path.join(__dirname, "history.json");
      let history = [];

      if (fs.existsSync(historyPath)) {
        history = JSON.parse(fs.readFileSync(historyPath));
      }
      history.push(historyEntry);
      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
      console.log("✅ History saved:", historyEntry);
    } catch (err) {
      console.error("❌ Failed to save history:", err.message);
    }
  }

  /** Run the automation for a user */
  async execute() {
    let browser = null;
    try {
      const dpName = await this.getDpNameById(this.credentials.dpId);
      browser = await puppeteer.launch({ headless: false, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });

      await this.performLogin(page, dpName, this.credentials.dpId);
      const authToken = await this.getAuthorizationToken(page);

      const [companyShareId, bankId] = await Promise.all([
        this.fetchFirstCompanyShareId(authToken),
        this.getFirstBankId(authToken),
      ]);

      await this.fillApplicationForm(page, companyShareId, bankId);
      await this.completeApplication(page);
    } catch (error) {
      console.error("Automation failed:", error.message);
    } finally {
      if (browser) await browser.close();
    }
  }
}

module.exports = MeroShareAutomation;

if (require.main === module) {
  const accountsPath = path.join(__dirname, "accounts.json");
  if (!fs.existsSync(accountsPath)) {
    console.error("accounts.json file not found!");
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
      console.log(`🔁 Running automation for #${index + 1}: ${credentials.username}`);
      const automation = new MeroShareAutomation(credentials);
      await automation.execute();
    }
    console.log("✅ All accounts processed.");
  })();
}
