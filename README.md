# AutoBDK GUI

An Electron-based desktop application for attendance management with features to view attendance records and one-click retroactive attendance sign-in functionality.

## Features

- 📅 Visual calendar display of attendance records
- 🔐 Automatic Cookie management
- 🚀 One-click retroactive attendance sign-in for anomalies
- 📱 Built-in mobile simulator for login
- 💾 Local data persistence

## API Call Flow

This application interacts with the backend through APIs provided in `src/api.ts`. Below is a detailed explanation of each API and its calling process.

### 1. User Authentication and Information Retrieval

#### `common(cookie: string)`

**Purpose**: Validate Cookie validity and retrieve basic user information (company name, employee name, CSRF Token)

**When to call**:

- Automatically called when the application starts
- Re-validate after Cookie update

**Parameters**:

- `cookie`: HTTP Cookie string (format: `name1=value1; name2=value2`)

**Return value**:

```typescript
{
  companyName: string;    // Company name
  employeeName: string;   // Employee name
  csrf: string;           // CSRF Token (required for subsequent requests)
  redirect?: string;      // If present, authentication failed
}
```

**Usage example**:

```typescript
const result = await electronAPI.verifyCookies();
if (result.success) {
  const { companyName, employeeName, csrf } = result.data;
  // Store csrf for later use
}
```

---

### 2. Attendance Record Query

#### `getAttendanceRecordList(cred: ICredential, yearmo?: string)`

**Purpose**: Get the attendance record list for a specified month (calendar view data)

**When to call**:

- Automatically load current month data after successful login
- When switching months
- Refresh data after retroactive sign-in completion

**Parameters**:

- `cred`: Authentication credential object

  ```typescript
  {
    'Cookie': string;        // Cookie string
    'X-CSRF-TOKEN': string;  // CSRF Token
  }
  ```

- `yearmo`: Year-month string (format: `YYYYMM`, e.g. `202511`), empty value gets current month

**Return value**:

```typescript
{
  attandanceArchive: {
    begin: string;      // Attendance period start date
    end: string;        // Attendance period end date
    yearmo: string;     // Year-month
  };
  records: [
    {
      date: number;           // Date (1-31)
      time: number;           // Unix timestamp
      situation: number;      // 0=normal, -1=anomaly
      isToday: number;        // Is today (1=yes)
      isWorkday: number;      // Is workday (1=yes)
      lunarShow: string;      // Lunar calendar display
      monthStatus: number;    // 0=current month, -1=previous month, 1=next month
      // ... other fields
    }
  ];
  // ... other statistics fields
}
```

**Usage example**:

```typescript
const result = await electronAPI.getAttendanceRecords(csrf, '202511');
if (result.success) {
  renderCalendar(result.data);
}
```

---

#### `getAttendanceRecordByDate(cred: ICredential, date: string)`

**Purpose**: Get detailed attendance information for a specified date (including clock-in/out times, anomaly status, etc.)

**When to call**:

- In the one-click retroactive sign-in process, analyze detailed information for each anomaly date
- When user clicks on a specific day in the calendar to view details

**Parameters**:

- `cred`: Authentication credential object
- `date`: Date string (format: `yyyyMMdd`, e.g. `20251115`)

**Return value**:

```typescript
{
  signTimeList: [
    {
      rangeName: string;          // "上班" (clock in) or "下班" (clock out)
      clockTime: string;          // Clock time (format: "HH:mm", e.g. "09:30")
      statusDesc: string;         // Status description (empty string=normal, otherwise shows anomaly reason)
      clockAttribution: number;   // 1=clock in, 2=clock out
      rangeId: string;            // Time range ID (needed for retroactive sign-in)
    }
  ];
  timeRanges: [
    {
      startingTime: string;   // Scheduled start time
      closingTime: string;    // Scheduled end time
    }
  ];
  // ... other fields
}
```

**Usage example**:

```typescript
const result = await electronAPI.getAttendanceRecordByDate(csrf, '20251115');
if (result.success) {
  const { signTimeList } = result.data;
  const clockIn = signTimeList.find(s => s.rangeName === '上班');
  const clockOut = signTimeList.find(s => s.rangeName === '下班');

  // Check if retroactive sign-in is needed
  if (!clockIn.clockTime || clockIn.statusDesc) {
    // Need to sign in
  }
}
```

---

### 3. Retroactive Sign-in Record Query

#### `getApproveBdkFlow(cred: ICredential, date: string)`

**Purpose**: Get submitted retroactive sign-in approval records for a specified date

**When to call**:

- In the one-click retroactive sign-in process, check if a retroactive sign-in has already been submitted for a certain day
- Avoid duplicate retroactive sign-ins

**Parameters**:

- `cred`: Authentication credential object
- `date`: Unix timestamp string (e.g. `1699920000`)

**Return value**:

```typescript
[
  {
    flowSid: string;       // Approval flow ID
    flowTypeName: string;  // Flow type name (e.g. "补卡")
    isFinish: number;      // Is finished (1=finished)
    startDate: number;     // Retroactive sign-in time (Unix timestamp)
  }
]
```

**Usage example**:

```typescript
const result = await electronAPI.getApproveBdkFlow(csrf, '1699920000');
if (result.success && result.data.length > 0) {
  // Already have retroactive sign-in records
  const approvals = result.data;
  for (const approval of approvals) {
    const time = new Date(approval.startDate * 1000);
    if (time.getHours() <= 10) {
      // Already signed in for morning
    }
  }
}
```

---

### 4. Retroactive Sign-in Process

#### `newSignAgain(cred: ICredential)`

**Purpose**: Get configuration information for the retroactive sign-in process (must be called before submitting retroactive sign-in)

**When to call**:

- After user confirms retroactive sign-in, before starting the retroactive sign-in process
- Get required parameters such as flow_type, flowSettingId, departmentId

**Parameters**:

- `cred`: Authentication credential object

**Return value**:

```typescript
{
  flow_type: number;              // Flow type (6=retroactive sign-in)
  flow_type_desc: string;         // Flow type description
  flowSettingId: number;          // Flow setting ID
  departmentList: [
    {
      departmentId: string;       // Department ID (needed when submitting retroactive sign-in)
      departmentName: string;     // Department name
    }
  ];
}
```

**Usage example**:

```typescript
const result = await electronAPI.newSignAgain(csrf);
if (result.success) {
  const config = result.data;
  // Use config to construct retroactive sign-in request
}
```

---

#### `startAttendanceApproval(cred: ICredential, approval: IAttendanceApproval)`

**Purpose**: Submit a retroactive sign-in application

**When to call**:

- After getting retroactive sign-in configuration, submit an application for each record that needs retroactive sign-in
- Recommended to wait 10 seconds between submissions
- If encountering "duplicate submission" error, can retry up to 5 times

**Parameters**:

- `cred`: Authentication credential object
- `approval`: Retroactive sign-in application object

  ```typescript
  {
    flow_type: number;          // Get from newSignAgain
    flowSettingId: number;      // Get from newSignAgain
    departmentId: string;       // Get from newSignAgain
    date: string;               // Unix timestamp of the date (at midnight)
    start_date: string;         // Retroactive sign-in time (format: "YYYY-MM-DD HH:mm")
    timeRangeId: string;        // Get from getAttendanceRecordByDate
    bdkDate: string;            // Retroactive sign-in date (format: "YYYY-MM-DD")
    clockType: number;          // 1=clock in, 2=clock out
  }
  ```

**Return value**:

```typescript
// Success
{ success: true }

// Failure
{
  success: false,
  error: string  // Error message (e.g. "duplicate submission", "approval already exists", etc.)
}
```

**Usage example**:

```typescript
const approval = {
  flow_type: config.flow_type,
  flowSettingId: config.flowSettingId,
  departmentId: config.departmentList[0].departmentId,
  date: "1699920000",
  start_date: "2023-11-14 10:00",
  timeRangeId: "2027489",
  bdkDate: "2023-11-14",
  clockType: 1,  // Clock in
};

// Support retry
for (let retry = 0; retry < 5; retry++) {
  const result = await electronAPI.startAttendanceApproval(csrf, approval);
  if (result.success) {
    console.log('Retroactive sign-in successful');
    break;
  } else if (result.error.includes('重复提交')) {
    // Retry
    continue;
  } else {
    console.error('Retroactive sign-in failed:', result.error);
    break;
  }
}

// Wait 10 seconds before submitting the next one
await new Promise(resolve => setTimeout(resolve, 10000));
```

---

## Complete One-Click Retroactive Sign-in Process

Below is the complete retroactive sign-in process implemented in `src/renderer.ts`:

### Step 1: Analyze Attendance Data

```typescript
async function analyzeAttendanceData() {
  // 1. Get current month attendance record list
  const recordsResult = await electronAPI.getAttendanceRecords(csrf, yearmo);
  const { records } = recordsResult.data;

  // 2. Iterate through all anomaly records (situation === -1)
  for (const record of records) {
    if (record.situation !== -1) continue;

    // 3. Get detailed clock information for this date
    const detailResult = await electronAPI.getAttendanceRecordByDate(
      csrf,
      formatDateString(record.time)
    );

    const clockIn = detailResult.data.signTimeList.find(s => s.rangeName === '上班');
    const clockOut = detailResult.data.signTimeList.find(s => s.rangeName === '下班');

    // 4. Check if there are existing retroactive sign-in records
    const bdkResult = await electronAPI.getApproveBdkFlow(csrf, `${record.time}`);
    const hasClockInSigned = bdkResult.data.some(a => getHour(a.startDate) <= 10);
    const hasClockOutSigned = bdkResult.data.some(a => getHour(a.startDate) >= 19);

    // 5. Determine if retroactive sign-in is needed
    if (!hasClockInSigned && (!clockIn.clockTime || clockIn.statusDesc)) {
      approvalList.push({
        date: '11-15',
        time: '10:00',
        clockType: 1,  // Clock in
        rangeId: clockIn.rangeId,
        timestamp: record.time,
      });
    }

    if (!hasClockOutSigned && (!clockOut.clockTime || clockOut.statusDesc)) {
      approvalList.push({
        date: '11-15',
        time: '19:00',
        clockType: 2,  // Clock out
        rangeId: clockOut.rangeId,
        timestamp: record.time,
      });
    }
  }

  return approvalList;
}
```

### Step 2: User Confirmation

Display the list of records that need retroactive sign-in, and wait for user to click the "Confirm Retroactive Sign-in" button.

### Step 3: Execute Retroactive Sign-in

```typescript
async function startApprovalProcess() {
  // 1. Get retroactive sign-in process configuration
  const signResult = await electronAPI.newSignAgain(csrf);
  const config = signResult.data;

  // 2. Submit retroactive sign-in applications one by one
  for (const item of approvalItems) {
    // 3. Construct retroactive sign-in request
    const approval = {
      flow_type: config.flow_type,
      flowSettingId: config.flowSettingId,
      departmentId: config.departmentList[0].departmentId,
      date: `${getTimestampAtMidnight(item.timestamp)}`,
      start_date: `2023-11-15 ${item.time}`,
      timeRangeId: item.rangeId,
      bdkDate: `2023-11-15`,
      clockType: item.clockType,
    };

    // 4. Submit application (with retry support)
    for (let retry = 0; retry < 5; retry++) {
      const result = await electronAPI.startAttendanceApproval(csrf, approval);

      if (result.success) {
        item.status = 'success';
        break;
      } else if (result.error.includes('重复提交')) {
        // Retry
        continue;
      } else {
        item.status = 'error';
        item.error = result.error;
        break;
      }
    }

    // 5. Wait 10 seconds before processing next one (avoid too frequent requests)
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}
```

### Step 4: Display Results

Count success/failure numbers, display detailed error messages, provide calendar refresh functionality.

---

## Development & Build

### Install Dependencies

```bash
npm install
```

### Development Mode

```bash
npm start
```

### Build

```bash
npm run package
```

---

## Important Notes

1. **Authentication Credentials**: All API calls require valid Cookie and CSRF Token
2. **Request Frequency**: When doing retroactive sign-in, recommend 10-second intervals between requests to avoid rate limiting
3. **Retry Mechanism**: Should automatically retry when encountering "duplicate submission" errors, fail directly for other errors
4. **Error Handling**: All API calls should be wrapped with try-catch and display user-friendly error messages
5. **Data Refresh**: Should refresh attendance calendar after retroactive sign-in completion to ensure latest status is displayed

---

## Tech Stack

- **Framework**: Electron
- **Build Tool**: Vite
- **Language**: TypeScript
- **HTTP Client**: got
- **UI**: Native HTML/CSS

---

## API Call Order Summary

### Login Process

```
1. User logs in via WebView
2. Cookie is automatically saved
3. common(cookie) - Verify and get CSRF Token
4. getAttendanceRecordList(cred) - Load current month attendance
```

### One-Click Retroactive Sign-in Process

```
1. getAttendanceRecordList(cred, yearmo)
   ↓ Get anomaly record list

2. For each anomaly record:
   ├─ getAttendanceRecordByDate(cred, date)
   │   ↓ Get detailed clock information
   │
   └─ getApproveBdkFlow(cred, timestamp)
       ↓ Check if already signed

3. User confirms retroactive sign-in list
   ↓

4. newSignAgain(cred)
   ↓ Get retroactive sign-in configuration

5. For each retroactive sign-in record:
   └─ startAttendanceApproval(cred, approval)
       ↓ Submit retroactive sign-in application (10-second interval)

6. getAttendanceRecordList(cred, yearmo)
   ↓ Refresh calendar
```

---

## License

MIT
