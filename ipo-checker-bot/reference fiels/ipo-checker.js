const { chromium } = require('playwright');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

if (fs.existsSync(path.join(__dirname, '.env'))) {
  require('dotenv').config();
}

const MEROSHARE_LOGIN = 'https://meroshare.cdsc.com.np/#/login';
const MEROSHARE_ASBA = 'https://meroshare.cdsc.com.np/#/asba';
const SENT_IPOS_FILE = path.join(__dirname, 'sent-ipos.json');

const USERNAME = process.env.MEROSHARE_USERNAME;
const PASSWORD = process.env.MEROSHARE_PASSWORD;
const DP_ID = process.env.MEROSHARE_DP_ID;
const EMAIL_USER = process.env.EMAIL_USER;
const GMAIL_PASSWORD = process.env.GMAIL_PASSWORD;
const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL;

async function loadSentIpos() {
  try {
    if (fs.existsSync(SENT_IPOS_FILE)) {
      return JSON.parse(fs.readFileSync(SENT_IPOS_FILE, 'utf8'));
    }
  } catch (error) {
    console.log('No previous IPO records found');
  }
  return [];
}

function saveSentIpos(ipos) {
  fs.writeFileSync(SENT_IPOS_FILE, JSON.stringify(ipos, null, 2));
}

async function sendEmail(subject, body, screenshotPath) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: GMAIL_PASSWORD }
  });

  const mailOptions = {
    from: EMAIL_USER,
    to: RECIPIENT_EMAIL,
    subject,
    html: body,
    attachments: screenshotPath ? [{ filename: 'ipo-screenshot.png', path: screenshotPath }] : []
  };

  await transporter.sendMail(mailOptions);
  console.log('Email sent successfully');
}

async function checkIpos() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  let screenshotPath = null;

  try {
    console.log('Navigating to Meroshare login...');
    await page.goto(MEROSHARE_LOGIN, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('Logging in...');
    //await page.selectOption('select[data-select2-id="1"]', DP_ID);
    await page.click('.select2-selection.select2-selection--single');
    await page.waitForTimeout(500);
    await page.keyboard.type(DP_ID); // Search text
    await page.keyboard.press('Enter');
    await page.fill('input[id="username"]', USERNAME);
    await page.fill('input[id="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    console.log('Navigating to ASBA page...');
    await page.goto(MEROSHARE_ASBA, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const ipoElements = await page.$$('.table tbody tr');
    
    if (ipoElements.length === 0) {
      console.log('No IPOs found');
      await browser.close();
      return;
    }

    const currentIpos = [];
    for (const row of ipoElements) {
      const companyName = await row.$eval('td:nth-child(2)', el => el.textContent.trim()).catch(() => '');
      const scrip = await row.$eval('td:nth-child(1)', el => el.textContent.trim()).catch(() => '');
      if (companyName) {
        currentIpos.push({ scrip, companyName, id: `${scrip}-${companyName}` });
      }
    }

    const sentIpos = await loadSentIpos();
    const newIpos = currentIpos.filter(ipo => !sentIpos.includes(ipo.id));

    if (newIpos.length > 0) {
      screenshotPath = path.join(__dirname, 'ipo-screenshot.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });

      const ipoList = newIpos.map(ipo => `<li><strong>${ipo.companyName}</strong> (${ipo.scrip})</li>`).join('');
      const emailBody = `
        <h2>New IPO Alert!</h2>
        <p>The following IPOs are now available on Meroshare:</p>
        <ul>${ipoList}</ul>
        <p>Check the screenshot for details.</p>
      `;

      await sendEmail('🚨 New IPO Available on Meroshare', emailBody, screenshotPath);

      const updatedSentIpos = [...sentIpos, ...newIpos.map(ipo => ipo.id)];
      saveSentIpos(updatedSentIpos);
      console.log('New IPOs found and email sent');
    } else {
      console.log('No new IPOs to notify');
    }

  } catch (error) {
    console.error('Error:', error);
    screenshotPath = path.join(__dirname, 'error-screenshot.png');
    await page.screenshot({ path: screenshotPath });
    await sendEmail('❌ IPO Checker Error', `<p>Error occurred: ${error.message}</p>`, screenshotPath);
  } finally {
    await browser.close();
  }
}

checkIpos();
