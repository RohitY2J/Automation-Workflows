const { chromium } = require('playwright');
const nodemailer = require('nodemailer');
const fs = require('fs');

// Test credentials (replace with your actual values)
const config = {
  ATTENDANCE_URL: 'https://login.replicon.com/DefaultV2.aspx?companykey=CedarGateTechnologies&msg=&code=PleaseLoginToContinue&init=',
  EMAIL: 'Rohit.kawari',
  PASSWORD: 'HayeHaye@316',
  SHIFT_VALUE: 'morning'
};

const emailConfig = {
  service: 'gmail',
  auth: {
    user: 'rohitkauri13@gmail.com',
    pass: 'bjqi ffbu dzya yjde'
  }
};

(async () => {
  const browser = await chromium.launch({ headless: false }); // Set to true for headless
  const page = await browser.newPage();
  
  // Test both clock in and clock out
  const testAction = config.SHIFT_VALUE === 'morning' ? 'in' : 'out';
  
  try {
    console.log('🤖 Starting attendance test...');
    
    // Navigate to attendance page
    await page.goto(config.ATTENDANCE_URL);
    console.log('✅ Navigated to attendance portal');
    
    // Login
    await page.fill('input[id="LoginNameTextBox"]', config.EMAIL);
    await page.fill('input[id="PasswordTextBox"]', config.PASSWORD);
    console.log('✅ Filled login credentials');
    
    await page.click('input[type="submit"]#LoginButton');
    console.log('✅ Clicked login button');
    
    // Wait for navigation after login
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    console.log('✅ Login completed');
    
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
    
    if (testAction === 'in') {
      if (hasPunchIn) {
        console.log('⚠️ Already clocked in today. Skipping clock in.');
        await page.screenshot({ path: 'already-clocked-in.png' });
        console.log('📸 Screenshot saved as already-clocked-in.png');
        return;
      }
      
      // Clock In
      await page.click('input.punchButton.clockIn[value="Clock In"]');
      console.log('✅ Clicked Clock In button');
      
      // Wait for popup to appear
      await page.waitForSelector('.contextPopup .authenticPunchDialog');
      console.log('✅ Popup appeared');
      
      // Click on Activity dropdown using stable attributes
      await page.click('a.divDropdown[aria-label="Activity Combo box"]');
      console.log('✅ Clicked Activity dropdown');
      
      // Wait for dropdown options to load
      await page.waitForTimeout(1000);
      
      // Try to find and click Evening Shift option
      await page.click('a[href="javascript:;"]:has-text("Evening Shift")');
      console.log('✅ Selected Evening Shift');
      
      // Click Save button in popup
      await page.click('input.important[value="Save"][data-id="save"]');
      console.log('✅ Clicked Save button');
    } else {
      if (!hasPunchIn) {
        console.log('⚠️ Not clocked in yet. Cannot clock out.');
        await page.screenshot({ path: 'not-clocked-in.png' });
        console.log('📸 Screenshot saved as not-clocked-in.png');
        return;
      }
      
      // Clock Out
      await page.click('input.punchButton.clockOut[value="Clock Out"]');
      console.log('✅ Clicked Clock Out button');
      
      // Click Save button in popup (if any)
      try {
        await page.waitForSelector('input.important[value="Save"][data-id="save"]', { timeout: 3000 });
        await page.click('input.important[value="Save"][data-id="save"]');
        console.log('✅ Clicked Save button');
      } catch (e) {
        console.log('✅ No save popup for clock out');
      }
    }
    
    console.log('🎉 Test completed successfully!');
    
    // Take screenshot after successful completion
    await page.screenshot({ path: `success-${testAction}-screenshot.png` });
    console.log(`📸 Success screenshot saved as success-${testAction}-screenshot.png`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'error-screenshot.png' });
    console.log('📸 Screenshot saved as error-screenshot.png');
    
  } finally {
    await browser.close();
    
    // Create log file
    const logContent = `Attendance Test Log
===================
Action: ${testAction.toUpperCase()}
Time: ${new Date()}
Status: Test completed

Detailed execution log would be captured here in production.`;
    fs.writeFileSync('test-execution.log', logContent);
    
    // Send email notification
    try {
      const transporter = nodemailer.createTransport(emailConfig);
      
      // Find screenshot and log files
      let screenshotPath = '';
      const attachments = [];
      
      if (fs.existsSync(`success-${testAction}-screenshot.png`)) {
        screenshotPath = `success-${testAction}-screenshot.png`;
        attachments.push({ path: screenshotPath });
      } else if (fs.existsSync('already-clocked-in.png')) {
        screenshotPath = 'already-clocked-in.png';
        attachments.push({ path: screenshotPath });
      } else if (fs.existsSync('not-clocked-in.png')) {
        screenshotPath = 'not-clocked-in.png';
        attachments.push({ path: screenshotPath });
      } else if (fs.existsSync('error-screenshot.png')) {
        screenshotPath = 'error-screenshot.png';
        attachments.push({ path: screenshotPath });
      }
      
      // Add log file
      if (fs.existsSync('test-execution.log')) {
        attachments.push({ path: 'test-execution.log' });
      }
      
      const mailOptions = {
        from: 'rohitkauri13@gmail.com',
        to: 'rohitkauri13@gmail.com',
        subject: `Attendance Test - ${testAction.toUpperCase()} Action`,
        text: `Attendance test completed.
        
Action: ${testAction.toUpperCase()}
Time: ${new Date()}
Status: Test completed

Please check the attached screenshot for details.`,
        attachments: attachments
      };
      
      await transporter.sendMail(mailOptions);
      console.log('✅ Email notification sent successfully!');
      
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError.message);
    }
  }
})();