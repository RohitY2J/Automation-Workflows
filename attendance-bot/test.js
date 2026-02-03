const { chromium } = require('playwright');
const nodemailer = require('nodemailer');
const fs = require('fs');

const config = {
  ATTENDANCE_URL: 'https://login.replicon.com/DefaultV2.aspx?companykey=CedarGateTechnologies&msg=&code=PleaseLoginToContinue&init=',
  EMAIL: 'Rohit.kawari',
  PASSWORD: 'HayeHaye@316',
  SHIFT_VALUE: 'evening'
};

const emailConfig = {
  service: 'gmail',
  auth: {
    user: 'rohitkauri13@gmail.com',
    pass: 'bjqi ffbu dzya yjde'
  }
};

async function sendEmail(subject, body, attachments = []) {
  try {
    const transporter = nodemailer.createTransport(emailConfig);
    
    const mailOptions = {
      from: 'rohitkauri13@gmail.com',
      to: 'rohitkauri13@gmail.com',
      subject: subject,
      text: body,
      attachments: attachments
    };
    
    await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully');
  } catch (error) {
    console.error('❌ Email failed:', error.message);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: false }); // Set to true for headless
  const page = await browser.newPage();
  let logMessages = [];
  let status = 'SUCCESS';
  let screenshotPath = '';
  const action = 'out';//hour < 12 ? 'in' : 'out';

  
  // Capture console logs
  const log = (message) => {
    console.log(message);
    logMessages.push(`${new Date().toISOString()}: ${message}`);
  };
  
  try {
    log('📋 Starting attendance bot...');
    log(`URL: ${config.ATTENDANCE_URL}`);
    log(`Email: ${config.EMAIL}`);
    log(`Shift: ${config.SHIFT_VALUE}`);
    
    // Determine action based on time
    const hour = new Date().getUTCHours();
    
    log(`🤖 Starting clock ${action} at ${new Date()}`);
    
    // Navigate to attendance page
    await page.goto(config.ATTENDANCE_URL);
    
    // Login
    await page.fill('input[id="LoginNameTextBox"]', config.EMAIL);
    await page.fill('input[id="PasswordTextBox"]', config.PASSWORD);
    await page.click('input[type="submit"]#LoginButton');
    
    // Wait for navigation after login
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    
    // Check for existing punch records today
    const punchTable = await page.$('.userDatePunchItemTable');
    let hasPunchIn = false;
    let hasPunchOut = false;
    
    if (punchTable) {
      const punchBadges = await page.$$('.punchBadgeIn, .punchBadgeOut');
      for (const badge of punchBadges) {
        const badgeText = await badge.textContent();
        if (badgeText === 'In') hasPunchIn = true;
        if (badgeText === 'Out') hasPunchOut = true;
      }
    }
    
    log(`Current punch status - In: ${hasPunchIn}, Out: ${hasPunchOut}`);
    
    if (action === 'in') {
      if (hasPunchIn) {
        log('⚠️ Already clocked in today. Skipping clock in.');
        screenshotPath = 'already-clocked-in.png';
        await page.screenshot({ path: screenshotPath });
        status = 'SKIPPED';
      } else {
        // Clock In
        await page.click('input.punchButton.clockIn[value="Clock In"]');
        
        // Wait for popup to appear
        await page.waitForSelector('.contextPopup .authenticPunchDialog');
        
        // Click on Activity dropdown using stable attributes
        await page.click('a.divDropdown[aria-label="Activity Combo box"]');
        
        // Wait for dropdown options to load
        await page.waitForTimeout(1000);
        
        // Try to find and click Evening Shift option
        await page.click('a[href="javascript:;"]:has-text("Evening Shift")');
        
        // Click Save button in popup
        await page.click('input.important[value="Save"][data-id="save"]');
        
        log(`✅ Successfully clocked in with Evening Shift at ${new Date()}`);
        screenshotPath = 'success-clock-in.png';
        // Wait for page to update before taking screenshot
        await page.waitForTimeout(3000);
        await page.screenshot({ path: screenshotPath });
      }
    } else {
      if (!hasPunchIn) {
        log('⚠️ Not clocked in yet. Cannot clock out.');
        screenshotPath = 'not-clocked-in.png';
        await page.screenshot({ path: screenshotPath });
        status = 'ERROR';
      } else if (hasPunchOut) {
        log('⚠️ Already clocked out today. Skipping clock out.');
        screenshotPath = 'already-clocked-out.png';
        await page.screenshot({ path: screenshotPath });
        status = 'SKIPPED';
      } else {
        // Clock Out
        await page.click('input.punchButton.clockOut[value="Clock Out"]');
        
        // Click Save button in popup (if any)
        try {
          await page.waitForSelector('input.important[value="Save"][data-id="save"]', { timeout: 3000 });
          await page.click('input.important[value="Save"][data-id="save"]');
        } catch (e) {
          log('No save popup for clock out');
        }
        
        log(`✅ Successfully clocked out at ${new Date()}`);
        screenshotPath = 'success-clock-out.png';
        // Wait for page to update before taking screenshot
        await page.waitForTimeout(3000);
        await page.screenshot({ path: screenshotPath });
      }
    }
    
  } catch (error) {
    log(`❌ Error: ${error.message}`);
    status = 'FAILED';
    screenshotPath = 'error-screenshot.png';
    await page.screenshot({ path: screenshotPath });
  } finally {
    await browser.close();
    
    // Save logs to file
    const logContent = logMessages.join('\n');
    fs.writeFileSync('attendance.log', logContent);
    
    // Send email notification
    const emailSubject = `Attendance Bot - ${status}`;
    const emailBody = `Attendance Bot Execution Report

Status: ${status}
Action: Clock ${action}
Time: ${new Date()}

Logs:
${logContent}`;
    
    const attachments = [
      { filename: 'attendance.log', path: './attendance.log' }
    ];
    
    if (screenshotPath && fs.existsSync(screenshotPath)) {
      attachments.push({ filename: screenshotPath, path: `./${screenshotPath}` });
    }
    
    await sendEmail(emailSubject, emailBody, attachments);
    
    if (status === 'FAILED') {
      process.exit(1);
    }
  }
})();