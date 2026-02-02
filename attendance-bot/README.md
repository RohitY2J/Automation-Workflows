# Attendance Bot

Automated attendance punching using GitHub Actions and Playwright.

## Setup

1. **Fork this repository**

2. **Add GitHub Secrets** (Settings → Secrets and variables → Actions):
   ```
   ATTENDANCE_URL = https://your-company-attendance-portal.com
   EMAIL = your.email@company.com
   PASSWORD = your_password
   SHIFT_VALUE = morning (or whatever your shift dropdown value is)
   ```

3. **Enable GitHub Actions** (Actions tab → Enable workflows)

## Schedule

- **Punch In**: 1:30 PM KTM (Monday-Friday)
- **Punch Out**: 10:30 PM KTM (Monday-Friday)

## Testing

### Method 1: Manual Trigger (Recommended)
1. Go to your repository → **Actions** tab
2. Click **Daily Attendance Bot**
3. Click **Run workflow** → **Run workflow**
4. Check logs in real-time

### Method 2: Test Cron Schedule
```bash
# Temporarily change cron to run in 2 minutes
- cron: '*/2 * * * *'  # Every 2 minutes (for testing only)
```

### Method 3: Local Testing
```bash
npm install playwright
npx playwright install chromium

# Create test.js with your credentials
node test.js
```

## Customization

Edit `.github/workflows/attendance.yml`:
- Change cron schedule
- Modify selectors for your attendance system
- Adjust timezone

## Selectors to Update

Replace these with your actual webpage selectors:
- `input[name="email"]` → Your email input selector
- `input[name="password"]` → Your password input selector  
- `button[type="submit"]` → Your login button selector
- `select#shift` → Your shift dropdown selector
- `button:has-text("Punch IN")` → Your punch in button selector
- `button:has-text("Punch OUT")` → Your punch out button selector