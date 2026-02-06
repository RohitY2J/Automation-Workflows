# IPO Automation Bot

Complete IPO automation: checks for new IPOs, auto-applies, tracks status, and sends email notifications.

## Features

- **IPO Detection**: Checks for new IPOs daily
- **Auto-Apply**: Automatically applies for IPOs (configurable per account)
- **Status Tracking**: Monitors application status and updates
- **Email Notifications**: Sends alerts for:
  - New IPOs available
  - Successful applications
  - Status updates
  - Errors
- **Multiple Accounts**: Supports multiple Meroshare accounts
- **Duplicate Prevention**: Tracks notified and applied IPOs

## Setup

### 1. GitHub Secrets

Add these secrets in repository settings:

**ACCOUNTS_JSON** - JSON array of accounts (see format below):
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
2. **Check IPOs**: Fetches available IPOs from ASBA page
3. **Compare**: Checks against `sent-ipos.json` for new IPOs
4. **Notify New**: Sends email if new IPOs found
5. **Auto-Apply**: Applies for IPOs if `autoApply: true`
6. **Notify Applied**: Sends email confirmation
7. **Check Status**: Fetches application status for all applied IPOs
8. **Notify Status**: Sends status update email
9. **Update Files**: Commits tracking files to prevent duplicates

## Files

- `ipo-automation.js` - Main unified automation script
- `sent-ipos.json` - Tracks notified IPOs (auto-updated)
- `applied-ipos.json` - Tracks applied IPOs with status (auto-updated)
- `accounts-example.json` - Example accounts structure
- `package.json` - Dependencies

## Email Notifications

### 🚨 New IPO Available
Sent when new IPOs are detected

### ✅ IPO Applied
Sent after successfully applying for IPO

### 📊 IPO Status Update
Sent with current application statuses

### ❌ Error
Sent if any errors occur with screenshot

## Usage

**Automatic**: Runs daily at 9:45 AM KTM via GitHub Actions

**Manual**: Trigger via GitHub Actions workflow_dispatch

**Local Testing**:
```bash
cd ipo-checker-bot
npm install
export ACCOUNTS_JSON='[{"dpId":"17300","username":"user","password":"pass","crnNumber":"123","pin":"1234","kitta":"10","autoApply":true}]'
export EMAIL_USER="your_email@gmail.com"
export GMAIL_PASSWORD="your_app_password"
export RECIPIENT_EMAIL="recipient@gmail.com"
node ipo-automation.js
```

## Schedule

- **Daily Check**: `0 4 * * *` (9:45 AM KTM / 4:00 AM UTC)
- Adjust cron in `.github/workflows/ipo-checker.yml` as needed

## Multiple Accounts

The bot processes accounts sequentially. Each account gets separate email notifications. Set `autoApply: false` for accounts you want to manually apply.
