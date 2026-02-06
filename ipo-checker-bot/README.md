# IPO Automation Bot

Complete IPO automation: checks for new IPOs, auto-applies, tracks status, and sends email notifications.

## Features

- **IPO Detection**: Checks for new IPOs daily
- **Auto-Apply**: Automatically applies for IPOs (configurable per account)
- **Status Tracking**: Monitors application status and updates
- **Email Notifications**: Sends alerts for:
  - New IPOs available
  - Successful applications
  - Status updates (only when changed)
  - Errors
- **Multiple Accounts**: Supports multiple Meroshare accounts
- **Duplicate Prevention**: Tracks notified and applied IPOs per account
- **Manual Application Detection**: Skips auto-apply if already applied manually

## Setup

### 1. GitHub Secrets

Add these secrets in repository settings:

**ACCOUNTS_JSON** - JSON array of accounts:
```json
[
  {
    "dpId": "17300",
    "username": "01352580",
    "password": "YourPassword#",
    "crnNumber": "12345678",
    "pin": "1234",
    "kitta": "10",
    "autoApply": true
  }
]
```

**Other Secrets:**
- `EMAIL_USER` - Gmail address for sending
- `GMAIL_PASSWORD` - Gmail app password
- `RECIPIENT_EMAIL` - Email to receive notifications

### 2. Account Fields

- `dpId` - DP ID value (e.g., "17300" for NIMB ACE CAPITAL)
- `username` - Meroshare username
- `password` - Meroshare password (wrap in quotes if contains #)
- `crnNumber` - CRN number
- `pin` - Transaction PIN
- `kitta` - Number of shares to apply (default: "10")
- `autoApply` - Auto-apply for IPOs (true/false, default: true)

### 3. Gmail App Password

1. Enable 2FA on Gmail
2. Generate app password at https://myaccount.google.com/apppasswords
3. Use this password in `GMAIL_PASSWORD` secret

## How It Works

1. **Login**: Authenticates each account to Meroshare
2. **Check IPOs**: Fetches available IPOs from API
3. **Compare**: Checks against `sent-ipos.json` for new IPOs
4. **Detect Manual**: Skips if `action === 'edit'` (already applied manually)
5. **Auto-Apply**: Applies for IPOs if `autoApply: true`
6. **Check Status**: Fetches application status for last 2 months
7. **Track Changes**: Only notifies when status or remark changes
8. **Send Email**: Single consolidated report for all accounts
9. **Update Files**: Commits tracking files per account

## Files

- `ipo-automation.js` - Main automation script
- `sent-ipos.json` - Tracks notified IPOs (shared)
- `applied-ipos-{username}.json` - Tracks applied IPOs per account
- `accounts-example.json` - Example accounts structure
- `package.json` - Dependencies

## Email Report Format

Single email with sections for each account:

### 🆕 New IPOs Found
Lists newly detected IPOs

### ✅ IPOs Applied
Lists successfully applied IPOs

### 📊 Status Updates
Shows status changes with old → new status and remarks

### ⚠️ Errors
Lists any errors encountered

## Usage

**GitHub Actions**: Runs on push or manual trigger

**Local Testing**:
```bash
cd ipo-checker-bot
npm install
# Create .env file with ACCOUNTS_JSON, EMAIL_USER, GMAIL_PASSWORD, RECIPIENT_EMAIL
node ipo-automation.js
```

## Schedule Recommendation

Best times to run:
- **10:00 AM KTM** - Morning check for new IPOs
- **4:00 PM KTM** - Final check before close

Add to workflow:
```yaml
schedule:
  - cron: '15 4 * * *'   # 10:00 AM KTM
  - cron: '15 10 * * *'  # 4:00 PM KTM
```

## Processing Flow

**Sequential Processing** (Default):
- Processes accounts one by one
- Reuses single browser instance
- Clears session between accounts
- Slower but more stable

---

## Advanced: Concurrent Processing

For faster execution, process multiple accounts simultaneously.

### Implementation

```javascript
// Separate browser context per account
async function processAccount(account) {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-dev-shm-usage', '--no-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  // ... process account
  await browser.close();
}

// Run all accounts concurrently
const allResults = await Promise.all(
  accounts.map(account => processAccount(account))
);
```

### Benefits
- 3x faster for 3 accounts
- Isolated browser contexts
- No session conflicts

### Considerations
- Higher memory usage
- May trigger rate limits
- Requires stable network
- Add random delays to avoid detection

### Tips for Concurrent Mode

1. **Random Delays**: Add between actions
```javascript
function randomDelay() {
  return new Promise(r => setTimeout(r, Math.random() * 1500 + 500));
}
```

2. **Page Reload**: After networkidle for stability
```javascript
await page.goto(url, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'domcontentloaded' });
```

3. **Event Logging**: Debug concurrent issues
```javascript
page.on('load', () => console.log(`[${username}] load fired`));
page.on('requestfailed', req => console.log(`[${username}] Failed: ${req.url()}`));
```

4. **Headless Mode**: Test with `headless: false` first

### When to Use Concurrent

✅ Use when:
- Processing 3+ accounts
- Time is critical
- Stable network connection

❌ Avoid when:
- Experiencing timeouts
- Limited system resources
- Testing new features
