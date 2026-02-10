# Automated Attendance Bot

An automated attendance system that uses Playwright to clock in/out on Replicon portal with scheduled execution via GitHub Actions.

## Project Overview

This bot automatically handles daily attendance by:
- **Clock In**: 1:00 PM KTM (Evening Shift)
- **Clock Out**: 11:05 PM KTM
- **Email Notifications**: Success/failure reports with screenshots and logs
- **Duplicate Prevention**: Skips if already clocked in/out

## Flow Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub Actions│    │  External Cron  │    │  Manual Trigger │
│   (Scheduled)   │    │   (cron-job.org)│    │ (workflow_dispatch)│
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    Attendance Bot       │
                    │    (test.js)           │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Login to Replicon     │
                    │   Portal               │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Check Current Time     │
                    │  (UTC < 12 = In)       │
                    │  (UTC >= 12 = Out)     │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ Check Existing Punches  │
                    │ (.punchBadgeIn/Out)    │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
    ┌─────────▼─────────┐ ┌──────▼──────┐ ┌─────────▼─────────┐
    │   Clock In        │ │   Clock Out │ │      Skip         │
    │ (Evening Shift)   │ │             │ │  (Already Done)   │
    └─────────┬─────────┘ └──────┬──────┘ └─────────┬─────────┘
              │                  │                  │
              └──────────────────┼──────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Take Screenshot       │
                    │   Generate Logs        │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Send Email Report     │
                    │ (Gmail SMTP + Attach)   │
                    └─────────────────────────┘
```

## Project Flow

### 1. Initial Setup
- Created Playwright automation script for Replicon portal
- Implemented login functionality with credentials
- Added evening shift selection for clock-in

### 2. GitHub Actions Integration
- Developed scheduled workflow for automatic execution
- Set up cron jobs for KTM timezone (UTC+5:45)
- Added manual trigger and repository_dispatch support

### 3. Duplicate Prevention Logic
- **Clock In**: Checks existing punch records, skips if already clocked in
- **Clock Out**: Verifies clock-in status and existing clock-out, skips if already done
- **Status Tracking**: Uses punch table HTML structure (`.punchBadgeIn/.punchBadgeOut`)

### 4. Email Notification System
- Integrated nodemailer for Gmail SMTP
- Sends reports with screenshots and logs attached
- Different screenshots for each scenario:
  - `already-clocked-in.png` - Skip clock in
  - `already-clocked-out.png` - Skip clock out
  - `not-clocked-in.png` - Cannot clock out
  - `success-clock-in.png` - Successful clock in
  - `success-clock-out.png` - Successful clock out
  - `error-screenshot.png` - Any errors

### 5. Private Repository Challenge
- **Issue**: GitHub Actions scheduled workflows don't work in private repos (free accounts)
- **Solution**: Added `repository_dispatch` trigger for external HTTP requests

### 6. External Scheduling Options
- **cron-job.org**: Free plan with 25 jobs, HTTP requests support
- **Public GitHub Repo**: Unlimited free scheduled workflows
- **HTTP Trigger**: POST requests to trigger attendance bot

### 7. Automatic Retry Mechanism
- **Retry Workflow**: Monitors main attendance workflow and retries on failure
- **Trigger**: Automatically runs when "Daily Attendance Bot" workflow completes
- **On Failure**: 
  - Waits 60 seconds before retry
  - Checks recent failure count (max 3 retries)
  - Triggers workflow again if under retry limit
  - Stops retrying after max attempts reached
- **On Success**: Logs confirmation message that monitoring is active
- **Smart Logic**: Prevents infinite retry loops with failure count tracking

## Files Structure

```
├── attendance-bot/
│   ├── test.js              # Main Playwright automation script
│   └── test-email.js        # Standalone email testing
├── .github/workflows/
│   ├── attendance.yml       # Main attendance workflow
│   └── attendance-retry.yml # Automatic retry on failure
└── README.md               # This file
```

## Key Features

- **Time-based Actions**: Automatically determines clock in/out based on UTC time
- **Robust Error Handling**: Screenshots and logs for all scenarios
- **Email Reports**: Always sends notifications regardless of success/failure
- **Duplicate Prevention**: Smart checking to avoid double entries
- **External Triggers**: Support for HTTP-based scheduling workarounds
- **Automatic Retry**: Intelligent retry mechanism with max 3 attempts on failure

## Configuration

### Replicon Portal
- URL: `https://login.replicon.com/DefaultV2.aspx?companykey=CedarGateTechnologies`
- Username: `Rohit.kawari`
- Shift: Evening Shift selection

### Email Settings
- Gmail SMTP with app password
- Sends to: `rohitkauri13@gmail.com`
- Attachments: Screenshots and logs

### Schedule
- **Clock In**: `15 7 * * 1-5` (1:00 PM KTM, weekdays)
- **Clock Out**: `20 17 * * 1-5` (11:05 PM KTM, weekdays)

## Usage

1. **Automatic**: Runs on schedule via GitHub Actions
2. **Manual**: Use workflow_dispatch in GitHub Actions
3. **External**: HTTP POST to repository_dispatch endpoint
4. **Local**: Run `node test.js` in attendance-bot directory

## Status Codes

- **SUCCESS**: Operation completed successfully
- **SKIPPED**: Already clocked in/out, no action needed
- **ERROR**: Cannot perform action (e.g., not clocked in for clock out)
- **FAILED**: Technical error during execution
