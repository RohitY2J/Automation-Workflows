# HostFileUpdate

Automation workflows for attendance tracking and IPO monitoring using GitHub Actions.

## Available Workflows

### 1. Daily Attendance Bot
**File:** `.github/workflows/attendance.yml`

Automated attendance system for Replicon portal with scheduled clock in/out.

- **Triggers:** Manual (`workflow_dispatch`), External HTTP (`repository_dispatch`)
- **Schedule:** Clock In at 1:00 PM KTM, Clock Out at 11:05 PM KTM (currently disabled)
- **Features:**
  - Automatic clock in/out with Evening Shift selection
  - Duplicate prevention (skips if already clocked in/out)
  - Holiday/skip date support
  - Email notifications with screenshots
  - Time-based action detection (UTC < 12 = In, >= 12 = Out)

**Usage:**
- Manual: GitHub Actions → Run workflow
- External: POST to `https://api.github.com/repos/RohitY2J/HostFileUpdate/dispatches` with `{"event_type":"attendance-trigger"}`

---

### 2. Attendance Retry Monitor
**File:** `.github/workflows/attendance-retry.yml`

Automatically retries the Daily Attendance Bot workflow if it fails.

- **Triggers:** Automatically when "Daily Attendance Bot" workflow completes
- **Features:**
  - Monitors main attendance workflow completion
  - Retries up to 2 times on failure
  - 60 second delay between retries
  - Smart failure count tracking to prevent infinite loops

**How it works:**
- Runs automatically after attendance workflow fails
- Checks recent failure count
- Triggers workflow again if under retry limit
- Stops after max attempts reached

---

### 3. IPO Automation
**File:** `.github/workflows/ipo-checker.yml`

Automated IPO checking and application system.

- **Triggers:** Manual (`workflow_dispatch`), External HTTP (`repository_dispatch`)
- **Features:**
  - Checks for new IPO listings
  - Automated IPO application process
  - Email notifications for new IPOs
  - Tracks sent and applied IPOs in JSON files
  - Auto-commits updated records

**Usage:**
- Manual: GitHub Actions → Run workflow
- External: POST with `{"event_type":"check-ipo"}`

---

## Required Secrets

Configure these in GitHub Settings → Secrets:

### Attendance Bot
- `REPLICON_EMAIL` - Replicon login email
- `REPLICON_PASSWORD` - Replicon password
- `GMAIL_PASSWORD` - Gmail app password for notifications

### IPO Automation
- `ACCOUNTS_JSON` - JSON array of account credentials
- `EMAIL_USER` - Email sender address
- `GMAIL_PASSWORD` - Gmail app password
- `RECIPIENT_EMAIL` - Email recipient for notifications

---

## Documentation

- **Attendance Bot Details:** [README-attendance-bot.md](README-attendance-bot.md)
- **Retry Script:** [trigger-with-retry.sh](trigger-with-retry.sh)

---

## External Scheduling

For private repositories, use external cron services:
- **cron-job.org** - Free HTTP-based scheduling
- **Public GitHub Repo** - Unlimited scheduled workflows

See [README-attendance-bot.md](README-attendance-bot.md) for detailed setup instructions.
