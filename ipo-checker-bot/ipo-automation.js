const { chromium } = require('playwright');
const nodemailer = require('nodemailer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

if (fs.existsSync(path.join(__dirname, '.env'))) {
  require('dotenv').config();
}

const CONFIG = {
  baseURL: 'https://webbackend.cdsc.com.np/api/meroShare',
  frontendURL: 'https://meroshare.cdsc.com.np',
};

const SENT_IPOS_FILE = path.join(__dirname, 'sent-ipos.json');

function getAppliedIPOsFile(username) {
  return path.join(__dirname, `applied-ipos-${username}.json`);
}

function loadJSON(file) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {}
  return [];
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function delay(ms = 1000) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getHeaders(authToken) {
  return {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'authorization': authToken,
    'content-type': 'application/json',
    'Referer': CONFIG.frontendURL
  };
}

async function performLogin(page, account) {
  await page.goto(CONFIG.frontendURL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.select2-selection', { visible: true });
  await page.click('.select2-selection');
  await page.waitForSelector('.select2-search__field', { visible: true });
  await page.type('.select2-search__field', account.dpId);
  await page.keyboard.press('Enter');
  await page.type('#username', account.username);
  await delay(500);
  await page.type('#password', account.password);
  await delay(500);
  await page.click('button[type="submit"]');
  await delay(2000);
}

async function getAuthToken(page) {
  await delay(5000);
  const authToken = await page.evaluate(() => window.sessionStorage.getItem('Authorization'));
  if (!authToken) throw new Error('Failed to retrieve authorization token');
  return authToken;
}

async function checkAvailableIPOs(authToken, username) {
  console.log(`[${username}] Fetching available IPOs...`);
  const { data } = await axios.post(
    `${CONFIG.baseURL}/companyShare/applicableIssue/`,
    {
      filterFieldParams: [
        { key: 'companyIssue.companyISIN.script', alias: 'Scrip' },
        { key: 'companyIssue.companyISIN.company.name', alias: 'Company Name' }
      ],
      page: 1,
      size: 10,
      searchRoleViewConstants: 'VIEW_APPLICABLE_SHARE',
      filterDateParams: [{ key: 'minIssueOpenDate', value: '' }, { key: 'maxIssueCloseDate', value: '' }]
    },
    { headers: getHeaders(authToken), timeout: 60000 }
  );
  console.log(`[${username}] IPOs fetched:`, data?.object?.length || 0);
  return data?.object || [];
}

async function applyIPO(page, authToken, ipo, account) {
  const { data: banks } = await axios.get(`${CONFIG.baseURL}/bank/`, { headers: getHeaders(authToken) });
  const bankId = banks[0].id;

  await page.goto(`${CONFIG.frontendURL}/#/asba/apply/${ipo.companyShareId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#selectBank');
  await page.selectOption('#selectBank', bankId.toString());
  await delay();

  await page.waitForSelector('#accountNumber');
  await page.waitForFunction(() => {
    const select = document.querySelector('#accountNumber');
    return select && select.options.length > 1 && select.options[1].value !== '';
  });
  const accountValue = await page.$eval('#accountNumber option:nth-child(2)', o => o.value);
  await page.selectOption('#accountNumber', accountValue);
  await delay();

  await page.type('#appliedKitta', account.kitta || '10');
  await delay();
  await page.type('#crnNumber', account.crnNumber);
  await delay();
  await page.click('#disclaimer');
  await delay();

  await page.waitForFunction(() => {
    const btn = document.querySelector('button[type="submit"]');
    return btn && !btn.disabled;
  });
  await page.click('button[type="submit"]');
  await delay(2000);

  await page.waitForSelector('#transactionPIN');
  await page.type('#transactionPIN', account.pin);
  await delay(2000);

  try {
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[type="submit"]:not([disabled])');
      return btn !== null;
    }, { timeout: 10000 });
    await page.click('button[type="submit"]');
  } catch {
    await page.evaluate(() => {
      document.querySelectorAll('button[type="submit"]').forEach(btn => {
        const span = btn.querySelector('span');
        if (span?.textContent.trim() === 'Apply') btn.click();
      });
    });
  }
  await delay(3000);
}

async function getApplicationStatus(authToken) {
  const today = new Date();
  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(today.getMonth() - 2);
  
  const formatDate = (date) => date.toISOString().split('T')[0];
  const dateRange = `BETWEEN '${formatDate(twoMonthsAgo)}' AND '${formatDate(today)}'`;
  
  const { data } = await axios.post(
    `${CONFIG.baseURL}/applicantForm/active/search/`,
    {
      filterFieldParams: [
        { key: 'companyShare.companyIssue.companyISIN.script', alias: 'Scrip' },
        { key: 'companyShare.companyIssue.companyISIN.company.name', alias: 'Company Name' }
      ],
      page: 1,
      size: 200,
      searchRoleViewConstants: 'VIEW_APPLICANT_FORM_COMPLETE',
      filterDateParams: [{key: "appliedDate", condition: "", alias: "", value: dateRange}]
    },
    { headers: getHeaders(authToken) }
  );
  return data?.object || [];
}

async function getApplicationDetails(authToken, applicantFormId) {
  const { data } = await axios.get(
    `${CONFIG.baseURL}/applicantForm/report/detail/${applicantFormId}`,
    { headers: getHeaders(authToken) }
  );
  return { statusName: data.statusName, meroshareRemark: data.meroshareRemark };
}

async function processAccount(account, page) {
  let results = { newIPOs: [], applied: [], statuses: [], errors: [] };

  try {
    console.log(`[${account.username}] 🔄 Processing...`);
    
    console.log(`[${account.username}] Logging in...`);
    await performLogin(page, account);
    console.log(`[${account.username}] Getting auth token...`);
    const authToken = await getAuthToken(page);
    console.log(`[${account.username}] Auth token received`);

    const availableIPOs = await checkAvailableIPOs(authToken, account.username);
    const sentIPOs = loadJSON(SENT_IPOS_FILE);
    const appliedIPOs = loadJSON(getAppliedIPOsFile(account.username));

    console.log(`[${account.username}] Processing ${availableIPOs.length} available IPOs...`);

    for (const ipo of availableIPOs) {
      const ipoId = `${ipo.scrip}-${account.username}`;
      
      if (!sentIPOs.includes(ipoId)) {
        console.log(`[${account.username}] New IPO found: ${ipo.scrip} - ${ipo.companyName}`);
        results.newIPOs.push(ipo);
        sentIPOs.push(ipoId);

        if (ipo.action === 'edit') {
          console.log(`[${account.username}] IPO ${ipo.scrip} already applied manually (action=edit)`);
          if (!appliedIPOs.find(a => a.ipoId === ipoId)) {
            appliedIPOs.push({ ipoId, scrip: ipo.scrip, company: ipo.companyName, username: account.username, date: new Date().toISOString(), manuallyApplied: true });
          }
          continue;
        }

        if (account.autoApply !== false) {
          try {
            console.log(`[${account.username}] Applying for IPO: ${ipo.scrip}...`);
            await applyIPO(page, authToken, ipo, account);
            console.log(`[${account.username}] ✅ Successfully applied for ${ipo.scrip}`);
            results.applied.push(ipo);
            if (!appliedIPOs.find(a => a.ipoId === ipoId)) {
              appliedIPOs.push({ ipoId, scrip: ipo.scrip, company: ipo.companyName, username: account.username, date: new Date().toISOString() });
            }
          } catch (err) {
            console.log(`[${account.username}] ❌ Failed to apply for ${ipo.scrip}: ${err.message}`);
            results.errors.push({ ipo: ipo.scrip, error: err.message });
          }
        } else {
          console.log(`[${account.username}] Auto-apply disabled, skipping ${ipo.scrip}`);
        }
      }
    }

    saveJSON(SENT_IPOS_FILE, sentIPOs);
    saveJSON(getAppliedIPOsFile(account.username), appliedIPOs);

    console.log(`[${account.username}] Checking application statuses...`);
    const applications = await getApplicationStatus(authToken);
    console.log(`[${account.username}] Found ${applications.length} applications`);
    
    for (const app of applications) {
      const details = await getApplicationDetails(authToken, app.applicantFormId);
      
      const applied = appliedIPOs.find(a => a.scrip === app.scrip && a.username === account.username);
      if (applied) {
        const oldStatus = applied.statusName;
        const oldRemark = applied.meroshareRemark;
        
        if (oldStatus !== details.statusName || oldRemark !== details.meroshareRemark) {
          console.log(`[${account.username}] Status changed for ${app.scrip}: ${oldStatus || 'New'} → ${details.statusName}`);
          results.statuses.push({ scrip: app.scrip, oldStatus, newStatus: details.statusName, remark: details.meroshareRemark });
        }
        
        applied.statusName = details.statusName;
        applied.meroshareRemark = details.meroshareRemark;
      }
    }
    saveJSON(getAppliedIPOsFile(account.username), appliedIPOs);
    console.log(`[${account.username}] ✅ Processing completed`);

  } catch (error) {
    results.errors.push({ general: error.message });
    const screenshot = path.join(__dirname, `error-${account.username}.png`);
    await page.screenshot({ path: screenshot }).catch(() => {});
  }

  return results;
}

async function sendEmail(subject, body) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.GMAIL_PASSWORD }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.RECIPIENT_EMAIL,
    subject,
    html: body
  });
  console.log('✅ Email sent:', subject);
}

async function main() {
  const accountsJSON = process.env.ACCOUNTS_JSON;
  if (!accountsJSON) {
    console.error('❌ ACCOUNTS_JSON environment variable not set');
    process.exit(1);
  }

  const accounts = JSON.parse(accountsJSON);
  let allResults = [];

  const browser = await chromium.launch({ headless: true });
  try {
    for (const account of accounts) {
      const page = await browser.newPage();
      const results = await processAccount(account, page);
      allResults.push({ username: account.username, ...results });
      
      await delay(5000);
    }
  } finally {
    await browser.close();
  }

  let emailBody = '<h2>📋 IPO Automation Report</h2>';
  let hasContent = false;

  for (const result of allResults) {
    let userHasContent = false;
    let userSection = `<div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px;">`;
    userSection += `<h3 style="color: #333; margin-top: 0;">👤 Account: ${result.username}</h3>`;

    if (result.newIPOs.length > 0) {
      userSection += '<h4 style="color: #2196F3;">🆕 New IPOs Found:</h4><ul>';
      result.newIPOs.forEach(ipo => {
        userSection += `<li><strong>${ipo.companyName}</strong> (${ipo.scrip})</li>`;
      });
      userSection += '</ul>';
      userHasContent = true;
    }

    if (result.applied.length > 0) {
      userSection += '<h4 style="color: #4CAF50;">✅ IPOs Applied:</h4><ul>';
      result.applied.forEach(ipo => {
        userSection += `<li><strong>${ipo.companyName}</strong> (${ipo.scrip})</li>`;
      });
      userSection += '</ul>';
      userHasContent = true;
    }

    if (result.statuses.length > 0) {
      userSection += '<h4 style="color: #FF9800;">📊 Status Updates:</h4><ul>';
      result.statuses.forEach(s => {
        userSection += `<li><strong>${s.scrip}</strong>: ${s.oldStatus || 'New'} → <strong>${s.newStatus}</strong><br><small>Remark: ${s.remark || 'N/A'}</small></li>`;
      });
      userSection += '</ul>';
      userHasContent = true;
    }

    if (result.errors.length > 0) {
      userSection += '<h4 style="color: #F44336;">⚠️ Errors:</h4><ul>';
      result.errors.forEach(e => {
        userSection += `<li>${e.ipo || 'General'}: ${e.error || e.general}</li>`;
      });
      userSection += '</ul>';
      userHasContent = true;
    }

    if (!userHasContent) {
      userSection += '<p style="color: #999;">Successfully Processed.. <br/>ℹ️ No actions performed for this account</p>';
    }

    userSection += '</div>';
    emailBody += userSection;
    if (userHasContent) hasContent = true;
  }

  await sendEmail('📋 IPO Automation Report', emailBody);
  if (!hasContent) {
    console.log('ℹ️ No actions performed, no email sent');
  }

  console.log('✅ All accounts processed');
}

main();
