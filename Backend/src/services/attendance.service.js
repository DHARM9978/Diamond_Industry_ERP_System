const prisma = require("../config/database");

// ======================================================
// INDIA STANDARD TIME
// ======================================================

const IST_OFFSET_MS =
5.5 * 60 * 60 * 1000;

const DEFAULT_OFFICE_CLOSE_TIME =
"22:00";

const DUPLICATE_WINDOW_SECONDS =
30;

const OFFICE_CLOSE_SETTING_KEYS = [
"attendance.office_close_time",
"office_close_time",
"ATTENDANCE_OFFICE_CLOSE_TIME"
];

// ======================================================
// COMMON ERROR HELPER
// ======================================================

const createError = (
message,
statusCode = 400
) => {
const error = new Error(message);

error.statusCode =
statusCode;

return error;
};

// ======================================================
// DATE / TIME HELPERS
// ======================================================

const getISTDateParts = (date) => {
const utcDate = new Date(date);

const istDate = new Date(
    utcDate.getTime() + IST_OFFSET_MS
);

return {
    year: istDate.getUTCFullYear(),
    month: istDate.getUTCMonth(),
    day: istDate.getUTCDate()
};

};

const getStartOfDay = (date) => {
const {
year,
month,
day
} = getISTDateParts(date);

return new Date(
    Date.UTC(
        year,
        month,
        day,
        0,
        0,
        0,
        0
    ) - IST_OFFSET_MS
);

};

const getEndOfDay = (date) => {
return new Date(
getStartOfDay(date).getTime() +
(24 * 60 * 60 * 1000) -
1
);
};

const getISTDateString = (date) => {
const {
year,
month,
day
} = getISTDateParts(date);

return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

};

// ======================================================
// MYSQL DATE HELPERS
// ======================================================
//
// Attendance.date is a MySQL DATE field, not a timestamp.
// It must represent the IST calendar date itself.
//
// Do NOT use getStartOfDay()/getEndOfDay() for Attendance.date
// queries or writes. Those helpers return UTC instants that
// represent an IST day boundary and are intended for real
// DateTime values such as AttendancePunch.punchedAt.
//
// For the DATE column, use a UTC-midnight Date whose calendar
// components are the desired IST year/month/day. This prevents
// MySQL from storing the previous calendar day (for example,
// 17-Sep IST becoming 16-Sep in the database).
// ======================================================

const getISTCalendarDate = (date) => {
const {
year,
month,
day
} = getISTDateParts(date);

return new Date(
    Date.UTC(
        year,
        month,
        day,
        0,
        0,
        0,
        0
    )
);

};

const getNextISTCalendarDate = (date) => {
const calendarDate =
getISTCalendarDate(date);

return new Date(
    calendarDate.getTime() +
    (24 * 60 * 60 * 1000)
);

};

// ======================================================
// MYSQL TIME HELPERS
// ======================================================
//
// Prisma represents MySQL TIME values as Date objects
// based on 1970-01-01.
//
// IMPORTANT:
// We use UTC components because the TIME itself has no
// timezone information.
// ======================================================

const timeValueToMinutes = (timeValue) => {
if (!timeValue) {
return null;
}

if (typeof timeValue === "string") {
    const parts = timeValue
        .split(":")
        .map(Number);

    return (
        parts[0] * 60 +
        parts[1] +
        ((parts[2] || 0) / 60)
    );
}

return (
    timeValue.getUTCHours() * 60 +
    timeValue.getUTCMinutes() +
    (
        timeValue.getUTCSeconds() / 60
    )
);

};

const formatTimeValue = (timeValue) => {
if (!timeValue) {
return null;
}

// Already a time string
if (typeof timeValue === "string") {
    const match = timeValue.match(
        /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
    );

    if (!match) {
        return null;
    }

    const hours = String(
        Number(match[1])
    ).padStart(2, "0");

    const minutes = match[2];

    const seconds =
        match[3] || "00";

    return `${hours}:${minutes}:${seconds}`;
}

// Prisma MySQL TIME -> Date
if (timeValue instanceof Date) {
    return [
        String(
            timeValue.getUTCHours()
        ).padStart(2, "0"),

        String(
            timeValue.getUTCMinutes()
        ).padStart(2, "0"),

        String(
            timeValue.getUTCSeconds()
        ).padStart(2, "0")
    ].join(":");
}

return null;

};

// ======================================================
// CONVERT REAL TIMESTAMP TO IST MYSQL TIME
// ======================================================
//
// AttendancePunch.punchedAt is a real DateTime instant.
// Attendance.checkInTime/checkOutTime are MySQL TIME values.
// Convert the instant to the Indian clock and keep only HH:mm.
// ======================================================

const createMySQLTimeFromIST = (dateValue) => {
if (!dateValue) {
return null;
}

const date = new Date(dateValue);

if (Number.isNaN(date.getTime())) {
    return null;
}

const istDate = new Date(
    date.getTime() + IST_OFFSET_MS
);

return new Date(
    Date.UTC(
        1970,
        0,
        1,
        istDate.getUTCHours(),
        istDate.getUTCMinutes(),
        istDate.getUTCSeconds(),
        0
    )
);

};

// ======================================================
// BUILD TODAY'S ATTENDANCE VIEW FROM RAW PUNCHES
// ======================================================
//
// AttendancePunch.punchedAt is the source of truth.
// If the last punch is IN, hours continue up to the current time.
// Checkout stays null until an OUT punch is recorded.
// ======================================================


// ======================================================
// CALCULATE RAW PUNCH SESSION STATE
// ======================================================
//
// AttendancePunch is the source of truth for the raw IN/OUT
// session state.
//
// One central calculator is used by:
// - live daily attendance
// - single device punch processing
// - batch imports
// - historical inspection
// - AUTO_CLOSE resolution
//
// Multiple sessions are handled independently:
//
// 08:00 IN
// 14:00 OUT
// 16:00 IN
// 21:00 OUT
//
// = 6 + 5 = 11 hours
//
// The final unmatched IN is represented by openIn and is NOT
// included in completedHours.
// ======================================================

const calculatePunchSessionState = (
punches = []
) => {

const sortedPunches =
[...punches].sort(
(a, b) =>
new Date(
a.punchedAt
).getTime() -
new Date(
b.punchedAt
).getTime()
);

let firstIn =
null;

let lastOut =
null;

let openIn =
null;

let completedMilliseconds =
0;

const sessions =
[];

for (
const punch
of sortedPunches
) {

const punchedAt =
new Date(
punch.punchedAt
);

if (
Number.isNaN(
punchedAt.getTime()
)
) {
continue;
}

if (
punch.punchType ===
"IN"
) {

if (
firstIn === null
) {
firstIn =
new Date(
punchedAt
);
}

// Ignore a repeated IN state when calculating sessions.
// The raw event itself remains stored.
if (
openIn === null
) {
openIn =
new Date(
punchedAt
);
}
}

else if (
punch.punchType ===
"OUT"
) {

const outTime =
new Date(
punchedAt
);

lastOut =
outTime;

if (
openIn !== null
) {

const duration =
outTime.getTime() -
openIn.getTime();

if (
duration > 0
) {

completedMilliseconds +=
duration;

sessions.push({
in:
new Date(
openIn
),

out:
new Date(
outTime
),

hours:
Number(
(
duration /
(1000 * 60 * 60)
).toFixed(2)
)
});
}

openIn =
null;
}
}
}

return {
punches:
sortedPunches,

firstIn,

lastOut,

openIn,

hasOpenSession:
openIn !== null,

completedMilliseconds,

completedHours:
Number(
(
completedMilliseconds /
(1000 * 60 * 60)
).toFixed(2)
),

sessions
};

};


// ======================================================
// BUILD TODAY'S ATTENDANCE VIEW FROM RAW PUNCHES
// ======================================================
//
// This is a display projection only.
//
// If the current day ends with an unmatched IN, the UI may show
// elapsed working time up to "now", but this value is not written
// into Attendance as a checkout.
//
// AUTO_CLOSE is handled separately by batch resolution.
// ======================================================

const buildTodayAttendanceFromPunches = (
punches,
now
) => {

const groups =
new Map();

for (
const punch
of punches
) {

const key =
`${punch.employeeId}|${getISTDateString(
punch.punchedAt
)}`;

if (
!groups.has(
key
)
) {

groups.set(
key,
{
employeeId:
punch.employeeId,

employee:
punch.employee ||
null,

date:
getISTCalendarDate(
punch.punchedAt
),

punches:
[]
}
);
}

groups
.get(key)
.punches
.push(
punch
);
}

const result =
[];

for (
const group
of groups.values()
) {

const state =
calculatePunchSessionState(
group.punches
);

if (
!state.firstIn
) {
continue;
}

let totalMilliseconds =
state.completedMilliseconds;

if (
state.openIn
) {

const ongoingMilliseconds =
new Date(now).getTime() -
state.openIn.getTime();

if (
ongoingMilliseconds > 0
) {
totalMilliseconds +=
ongoingMilliseconds;
}
}

const totalHours =
totalMilliseconds /
(1000 * 60 * 60);

result.push({

employeeId:
group.employeeId,

date:
group.date,

checkInTime:
createMySQLTimeFromIST(
state.firstIn
),

checkOutTime:
state.hasOpenSession
? null
: (
state.lastOut
? createMySQLTimeFromIST(
state.lastOut
)
: null
),

totalHours:
totalHours > 0
? Number(
totalHours.toFixed(2)
)
: null,

status:
"PRESENT",

resolutionSource:
state.hasOpenSession
? null
: "DEVICE",

manualOverride:
false,

manualOverrideAt:
null,

manualOverrideBy:
null,

employee:
group.employee
});
}

return result;
};

const parseTime = (
value,
fieldName
) => {
if (value === null) {
return null;
}

if (
    typeof value !== "string" ||
    !/^\d{2}:\d{2}(:\d{2})?$/.test(value)
) {
    const error = new Error(
        `${fieldName} must use HH:mm or HH:mm:ss format`
    );

    error.statusCode = 400;

    throw error;
}

const parts =
    value.split(":").map(Number);

const hours = parts[0];
const minutes = parts[1];
const seconds = parts[2] ?? 0;

if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
) {
    const error = new Error(
        `${fieldName} contains an invalid time`
    );

    error.statusCode = 400;

    throw error;
}

return new Date(
    Date.UTC(
        1970,
        0,
        1,
        hours,
        minutes,
        seconds,
        0
    )
);

};

// ======================================================
// COMBINE ATTENDANCE DATE + TIME
// ======================================================

const combineAttendanceDateAndTime = (
attendanceDate,
timeValue
) => {
if (
!attendanceDate ||
!timeValue
) {
return null;
}

const {
    year,
    month,
    day
} = getISTDateParts(attendanceDate);

const hours =
    timeValue instanceof Date
        ? timeValue.getUTCHours()
        : Number(
            String(timeValue)
                .split(":")[0]
        );

const minutes =
    timeValue instanceof Date
        ? timeValue.getUTCMinutes()
        : Number(
            String(timeValue)
                .split(":")[1]
        );

const seconds =
    timeValue instanceof Date
        ? timeValue.getUTCSeconds()
        : Number(
            String(timeValue)
                .split(":")[2] || 0
        );

const milliseconds =
    timeValue instanceof Date
        ? timeValue.getUTCMilliseconds()
        : 0;

return new Date(
    Date.UTC(
        year,
        month,
        day,
        hours,
        minutes,
        seconds,
        milliseconds
    ) - IST_OFFSET_MS
);

};

// ======================================================
// CALCULATE TOTAL HOURS
// ======================================================

const calculateTotalHours = (
attendanceDate,
checkInTime,
checkOutTime
) => {
if (
!attendanceDate ||
!checkInTime ||
!checkOutTime
) {
return null;
}

const checkInInstant =
    combineAttendanceDateAndTime(
        attendanceDate,
        checkInTime
    );

if (!checkInInstant) {
    return null;
}

const checkOutInstant =
    new Date(checkOutTime);

let milliseconds =
    checkOutInstant.getTime() -
    checkInInstant.getTime();

/*
 * If the OUT time is earlier because the
 * attendance crossed midnight, add one day.
 */
if (milliseconds < 0) {
    milliseconds +=
        24 * 60 * 60 * 1000;
}

const hours =
    milliseconds /
    (1000 * 60 * 60);

return Number(
    hours.toFixed(2)
);

};

// ======================================================
// FORMAT TOTAL HOURS
// ======================================================

const formatDuration = (hours) => {
const totalMinutes =
Math.round(
Number(hours || 0) * 60
);

const wholeHours =
    Math.floor(
        totalMinutes / 60
    );

const minutes =
    totalMinutes % 60;

if (
    wholeHours === 0 &&
    minutes === 0
) {
    return "0 minutes";
}

if (wholeHours === 0) {
    return `${minutes} ${
        minutes === 1
            ? "minute"
            : "minutes"
    }`;
}

if (minutes === 0) {
    return `${wholeHours} ${
        wholeHours === 1
            ? "hour"
            : "hours"
    }`;
}

return `${wholeHours} ${
    wholeHours === 1
        ? "hour"
        : "hours"
} ${minutes} ${
    minutes === 1
        ? "minute"
        : "minutes"
}`;

};

// ======================================================
// SERIALIZE ATTENDANCE RECORD
// ======================================================
//
// This is the important fix.
//
// Instead of returning:
//
// 1970-01-01T22:41:02.000Z
//
// the API returns:
//
// 22:41:02
//
// And instead of:
//
// 2026-09-07T00:00:00.000Z
//
// the API returns:
//
// 2026-09-07
// ======================================================

const serializeAttendance = (
attendance
) => {
if (!attendance) {
return null;
}

return {
    ...attendance,

    date:
        attendance.date
            ? getISTDateString(
                attendance.date
            )
            : null,

    checkInTime:
        formatTimeValue(
            attendance.checkInTime
        ),

    checkOutTime:
        formatTimeValue(
            attendance.checkOutTime
        ),

    totalHours:
        attendance.totalHours !== null &&
        attendance.totalHours !== undefined
            ? Number(attendance.totalHours)
            : null
};

};


// ======================================================
// SERIALIZE RAW PUNCH
// ======================================================
//
// AttendancePunch.punchId is a BigInt. Convert it to a string for
// JSON consumers while preserving all other raw audit information.
// ======================================================

const serializePunch = (
punch
) => {

if (!punch) {
return null;
}

return {
...punch,

punchId:
typeof punch.punchId ===
"bigint"
? punch.punchId.toString()
: punch.punchId
};
};


// ======================================================
// OFFICE CLOSE SETTINGS
// ======================================================
//
// Existing Setting is company-scoped key/value storage.
// No additional settings table is introduced.
//
// Supported keys are intentionally backward-compatible.
// The default is 22:00 when no valid company setting exists.
// ======================================================

const getOfficeCloseTime = async (
companyId,
db = prisma
) => {

const numericCompanyId =
Number(companyId);

if (
!Number.isInteger(
numericCompanyId
) ||
numericCompanyId < 1
) {
return DEFAULT_OFFICE_CLOSE_TIME;
}

for (
const key
of OFFICE_CLOSE_SETTING_KEYS
) {

const setting =
await db.setting.findUnique({
where: {
companyId_key: {
companyId:
numericCompanyId,

key
}
},

select: {
value:
true
}
});

if (
setting?.value
) {

try {

const parsed =
parseTime(
setting.value,
"office close time"
);

return formatTimeValue(
parsed
).slice(
0,
5
);

}
catch {
// Ignore malformed setting and try the next supported key.
}
}
}

return DEFAULT_OFFICE_CLOSE_TIME;
};


// ======================================================
// OFFICE CLOSE REACHED
// ======================================================

const isOfficeCloseReached = (
attendanceDate,
officeCloseTime,
now = new Date()
) => {

const closeTime =
parseTime(
officeCloseTime,
"officeCloseTime"
);

const closeInstant =
combineAttendanceDateAndTime(
attendanceDate,
closeTime
);

return Boolean(
closeInstant &&
new Date(now).getTime() >=
closeInstant.getTime()
);
};


// ======================================================
// ADMIN ID NORMALIZATION
// ======================================================

const getAdminIdFromUser = (
adminUser
) => {

if (!adminUser) {
return null;
}

const rawId =
adminUser.adminId ??
adminUser.userId ??
adminUser.id;

if (
rawId === undefined ||
rawId === null ||
rawId === ""
) {
return null;
}

const numericId =
Number(rawId);

return Number.isInteger(
numericId
) &&
numericId > 0
? numericId
: null;
};


// ======================================================
// RESOLVE ATTENDANCE FOR ONE EMPLOYEE / ONE DATE
// ======================================================
//
// RAW:
// AttendancePunch
//
// RESOLVED:
// Attendance
//
// Precedence:
//
// ADMIN override
//      ↓
// DEVICE real OUT
//      ↓
// AUTO_CLOSE at office close
//
// AUTO_CLOSE changes only the Attendance resolution. It never
// creates an AttendancePunch.
// ======================================================

const resolveAttendanceForDateWithClient = async (
db,
employeeId,
attendanceDateValue,
options = {}
) => {

const attendanceDate =
getISTCalendarDate(
attendanceDateValue
);

if (
!attendanceDate
) {
throw createError(
"Invalid attendance date"
);
}

const dayStart =
getStartOfDay(
attendanceDate
);

const dayEnd =
getEndOfDay(
attendanceDate
);

const existing =
await db.attendance.findUnique({
where: {
employeeId_date: {
employeeId:
Number(employeeId),

date:
attendanceDate
}
}
});

// ------------------------------------------------------
// ADMIN OVERRIDE PROTECTION
// ------------------------------------------------------
//
// Once an administrator explicitly corrects Attendance,
// automatic calculation must never silently replace it.
// ------------------------------------------------------

if (
existing?.manualOverride ===
true
) {
return existing;
}

const punches =
await db.attendancePunch.findMany({
where: {
employeeId:
Number(employeeId),

punchedAt: {
gte:
dayStart,

lte:
dayEnd
}
},

orderBy: {
punchedAt:
"asc"
}
});

if (
punches.length ===
0
) {
return existing ||
null;
}

const state =
calculatePunchSessionState(
punches
);

if (
!state.firstIn
) {
return existing ||
null;
}

const officeCloseTime =
options.officeCloseTime ||
await getOfficeCloseTime(
options.companyId,
db
);

const now =
options.now instanceof Date
? options.now
: new Date();

let checkOutInstant =
null;

let resolutionSource =
null;

let totalHours =
state.completedHours;

// ------------------------------------------------------
// REAL DEVICE OUT
// ------------------------------------------------------

if (
!state.hasOpenSession &&
state.lastOut
) {

checkOutInstant =
state.lastOut;

resolutionSource =
"DEVICE";
}

// ------------------------------------------------------
// FINAL OPEN SESSION
// ------------------------------------------------------

if (
state.hasOpenSession
) {

const shouldAutoClose =
options.autoClose ===
true &&
isOfficeCloseReached(
attendanceDate,
officeCloseTime,
now
);

if (
shouldAutoClose
) {

const closeTime =
parseTime(
officeCloseTime,
"officeCloseTime"
);

const closeInstant =
combineAttendanceDateAndTime(
attendanceDate,
closeTime
);

if (
closeInstant &&
closeInstant.getTime() >
state.openIn.getTime()
) {

checkOutInstant =
closeInstant;

resolutionSource =
"AUTO_CLOSE";

const openMilliseconds =
closeInstant.getTime() -
state.openIn.getTime();

totalHours =
Number(
(
state.completedHours +
openMilliseconds /
(1000 * 60 * 60)
).toFixed(2)
);
}
}
}

// ------------------------------------------------------
// STILL OPEN
// ------------------------------------------------------

if (
!checkOutInstant
) {

totalHours =
state.completedHours >
0
? state.completedHours
: null;

resolutionSource =
null;
}

// ------------------------------------------------------
// WRITE RESOLVED ATTENDANCE
// ------------------------------------------------------

const attendanceData = {

employeeId:
Number(employeeId),

date:
attendanceDate,

checkInTime:
createMySQLTimeFromIST(
state.firstIn
),

checkOutTime:
checkOutInstant
? createMySQLTimeFromIST(
checkOutInstant
)
: null,

totalHours,

status:
"PRESENT",

resolutionSource,

manualOverride:
false,

manualOverrideAt:
null,

manualOverrideBy:
null
};

if (
existing
) {

return db.attendance.update({
where: {
attendanceId:
existing.attendanceId
},

data:
attendanceData
});
}

return db.attendance.create({
data:
attendanceData
});
};


// ======================================================
// PUBLIC ATTENDANCE RESOLVER
// ======================================================

const resolveAttendanceForDate = async (
employeeId,
attendanceDate,
options = {}
) => {

return resolveAttendanceForDateWithClient(
prisma,
employeeId,
attendanceDate,
options
);
};


// ======================================================
// NORMALIZE BATCH EVENT TYPE
// ======================================================
//
// Machine payloads may call this field eventType, punchType,
// type, checkIn, checkOut, entry, or exit. Normalize only the
// supported semantic values.
// ======================================================

const normalizeEventType = (
value
) => {

if (
value === undefined ||
value === null ||
value === ""
) {
return null;
}

const normalized =
String(value)
.trim()
.toUpperCase();

if (
[
"IN",
"CHECK_IN",
"CHECKIN",
"ENTRY"
].includes(
normalized
)
) {
return "IN";
}

if (
[
"OUT",
"CHECK_OUT",
"CHECKOUT",
"EXIT"
].includes(
normalized
)
) {
return "OUT";
}

return null;
};


// ======================================================
// PROCESS DEVICE ATTENDANCE PUNCH
// ======================================================

// ======================================================
// PROCESS DEVICE ATTENDANCE PUNCH
// ======================================================
//
// This remains the current single-punch/test API.
//
// The important architectural change is that this function
// creates only the RAW AttendancePunch and then asks the central
// resolver to calculate the ERP Attendance row.
//
// Therefore:
// - no duplicate calculation implementation
// - no fake AUTO_CLOSE punch
// - ADMIN overrides remain protected
// - DEVICE OUT can replace a previous AUTO_CLOSE
// ======================================================

const processDevicePunch = async (
data
) => {

const {
device,
sensorSlot,
eventId
} = data || {};

// ==================================================
// VALIDATE DEVICE
// ==================================================

if (
!device
) {
throw createError(
"Authenticated device is required",
401
);
}

// ==================================================
// VALIDATE SENSOR SLOT
// ==================================================

const slot =
Number(sensorSlot);

if (
!Number.isInteger(slot) ||
slot < 1
) {
throw createError(
"Sensor slot must be a positive integer"
);
}

// ==================================================
// VALIDATE EVENT ID WHEN PROVIDED
// ==================================================

let normalizedEventId =
null;

if (
eventId !== undefined &&
eventId !== null &&
eventId !== ""
) {

normalizedEventId =
String(eventId)
.trim();

if (
!normalizedEventId
) {
throw createError(
"eventId cannot be empty"
);
}

if (
normalizedEventId.length >
100
) {
throw createError(
"eventId cannot exceed 100 characters"
);
}
}

// ==================================================
// UPDATE DEVICE LAST SEEN
// ==================================================

await prisma.iotDevice.update({
where: {
deviceId:
device.deviceId
},

data: {
lastSeenAt:
new Date()
}
});

// ==================================================
// FIND FINGERPRINT
// ==================================================

const fingerprint =
await prisma.fingerprintTemplate.findUnique({
where: {
sensorSlot:
slot
},

include: {
employee:
true
}
});

if (
!fingerprint
) {
throw createError(
"No fingerprint is registered for this sensor slot",
404
);
}

// ==================================================
// CHECK FINGERPRINT STATUS
// ==================================================

if (
fingerprint.status !==
"ACTIVE"
) {
throw createError(
"Fingerprint template is inactive",
403
);
}

// ==================================================
// EMPLOYEE
// ==================================================

const employee =
fingerprint.employee;

if (
employee.status !==
"ACTIVE"
) {
throw createError(
"Employee is not active",
403
);
}

// ==================================================
// CURRENT EVENT TIME
// ==================================================

const punchedAt =
new Date();

// ==================================================
// TRANSACTION
// ==================================================

const result =
await prisma.$transaction(
async (
tx
) => {

// --------------------------------------------------
// IDEMPOTENT EVENT CHECK
// --------------------------------------------------
//
// If a client/device retries the same event, do not
// create another raw punch.
//
if (
normalizedEventId
) {

const existingEvent =
await tx.attendancePunch.findUnique({
where: {
deviceId_eventId: {
deviceId:
device.deviceId,

eventId:
normalizedEventId
}
},

include: {
employee: {
select: {
employeeId: true,
firstName: true,
lastName: true,
email: true
}
},

device: {
select: {
deviceId: true,
deviceCode: true,
deviceName: true,
branchId: true
}
}
}
});

if (
existingEvent
) {

const existingAttendance =
await tx.attendance.findUnique({
where: {
employeeId_date: {
employeeId:
employee.employeeId,

date:
getISTCalendarDate(
existingEvent.punchedAt
)
}
}
});

return {
punch:
existingEvent,

attendance:
existingAttendance,

totalHours:
existingAttendance?.totalHours
? Number(
existingAttendance.totalHours
)
: 0,

totalHoursFormatted:
formatDuration(
existingAttendance?.totalHours
),

duplicate:
true
};
}
}

// --------------------------------------------------
// TODAY'S RAW PUNCHES
// --------------------------------------------------
//
// Previous-day open sessions never block today's punch.
// The current calendar date is independently calculated.
//
const startOfToday =
getStartOfDay(
punchedAt
);

const endOfToday =
getEndOfDay(
punchedAt
);

const todayPunches =
await tx.attendancePunch.findMany({
where: {
employeeId:
employee.employeeId,

punchedAt: {
gte:
startOfToday,

lte:
endOfToday
}
},

orderBy: {
punchedAt:
"desc"
}
});

// --------------------------------------------------
// DUPLICATE WINDOW FOR LEGACY/SINGLE-PUNCH CLIENTS
// --------------------------------------------------

if (
todayPunches.length > 0
) {

const lastPunch =
todayPunches[0];

const secondsSinceLastPunch =
(
punchedAt.getTime() -
new Date(
lastPunch.punchedAt
).getTime()
) / 1000;

if (
secondsSinceLastPunch >=
0 &&
secondsSinceLastPunch <
DUPLICATE_WINDOW_SECONDS
) {

throw createError(
`Duplicate punch detected. Please wait ${DUPLICATE_WINDOW_SECONDS} seconds before scanning again.`,
409
);
}
}

// --------------------------------------------------
// DETERMINE IN / OUT
// --------------------------------------------------

let punchType =
"IN";

if (
todayPunches.length > 0
) {

const lastPunch =
todayPunches[0];

punchType =
lastPunch.punchType ===
"IN"
? "OUT"
: "IN";
}

console.log(
"Attendance punch type:",
punchType
);

// --------------------------------------------------
// CREATE RAW PUNCH
// --------------------------------------------------

const punch =
await tx.attendancePunch.create({
data: {
employeeId:
employee.employeeId,

deviceId:
device.deviceId,

sensorSlot:
slot,

punchType:
punchType,

punchedAt:
punchedAt,

eventId:
normalizedEventId
},

include: {
employee: {
select: {
employeeId: true,
firstName: true,
lastName: true,
email: true
}
},

device: {
select: {
deviceId: true,
deviceCode: true,
deviceName: true,
branchId: true
}
}
}
});

// --------------------------------------------------
// CENTRAL ATTENDANCE RESOLUTION
// --------------------------------------------------
//
// autoClose=false here because a normal single punch is
// not the batch settlement mechanism.
//
const attendance =
await resolveAttendanceForDateWithClient(
tx,
employee.employeeId,
punchedAt,
{
autoClose:
false,

companyId:
employee.companyId
}
);

return {
punch,

attendance,

totalHours:
attendance?.totalHours
? Number(
attendance.totalHours
)
: 0,

totalHoursFormatted:
formatDuration(
attendance?.totalHours
),

duplicate:
false
};
}
);

return result;
};


// ======================================================
// PROCESS ATTENDANCE BATCH
// ======================================================
//
// Future biometric-machine flow:
//
// Device memory card
//       ↓
// Batch upload
//       ↓
// RAW AttendancePunch
//       ↓
// Central session calculation
//       ↓
// Attendance resolution
//
// This function is intentionally idempotent.
// Re-uploading the same eventId for the same device does not
// create another AttendancePunch.
//
// Expected concepts per event:
//
// {
//     eventId,
//     employeeId,
//     eventDateTime,
//     eventType,
//     sensorSlot
// }
//
// eventType may be omitted only when the server must derive
// IN / OUT from the previous raw state.
// ======================================================

const processAttendanceBatch = async (
data
) => {

const {
device,
events,
officeCloseTime:
suppliedOfficeCloseTime
} = data || {};

if (
!device
) {
throw createError(
"Authenticated device is required",
401
);
}

if (
!Array.isArray(events)
) {
throw createError(
"events must be an array"
);
}

if (
events.length === 0
) {
return {
deviceId:
device.deviceId,

receivedCount:
0,

insertedCount:
0,

duplicateCount:
0,

insertedPunches:
[],

duplicatePunches:
[],

attendance:
[]
};
}

if (
events.length > 5000
) {
throw createError(
"A maximum of 5000 attendance events can be uploaded in one batch"
);
}

const companyId =
Number(
device.companyId
);

const normalizedEvents = [];

for (
let index = 0;
index < events.length;
index++
) {

const event =
events[index] || {};

const eventId =
String(
event.eventId ??
""
).trim();

if (
!eventId
) {
throw createError(
`Batch event at index ${index} is missing eventId`
);
}

if (
eventId.length > 100
) {
throw createError(
`Batch event at index ${index} has an eventId longer than 100 characters`
);
}

if (
event.deviceId !== undefined &&
event.deviceId !== null &&
String(event.deviceId) !==
String(device.deviceId)
) {
throw createError(
`Batch event ${eventId} belongs to another device`
);
}

const employeeId =
Number(
event.employeeId
);

if (
!Number.isInteger(
employeeId
) ||
employeeId < 1
) {
throw createError(
`Batch event ${eventId} has an invalid employeeId`
);
}

const timestampValue =
event.eventDateTime ??
event.punchedAt ??
event.timestamp ??
null;

const punchedAt =
new Date(
timestampValue
);

if (
!timestampValue ||
Number.isNaN(
punchedAt.getTime()
)
) {
throw createError(
`Batch event ${eventId} has an invalid eventDateTime`
);
}

const normalizedType =
normalizeEventType(
event.eventType ??
event.punchType ??
event.type
);

let sensorSlot =
Number(
event.sensorSlot ?? 0
);

if (
!Number.isInteger(
sensorSlot
) ||
sensorSlot < 0
) {
throw createError(
`Batch event ${eventId} has an invalid sensorSlot`
);
}

normalizedEvents.push({
eventId,
employeeId,
punchedAt,
punchType:
normalizedType,
sensorSlot,
originalIndex:
index
});
}

// ------------------------------------------------------
// VALIDATE EMPLOYEES IN ONE QUERY
// ------------------------------------------------------

const employeeIds =
Array.from(
new Set(
normalizedEvents.map(
event =>
event.employeeId
)
)
);

const employees =
await prisma.employee.findMany({
where: {
employeeId: {
in:
employeeIds
},
...(Number.isInteger(
companyId
) && companyId > 0
? {
companyId
}
: {})
},

select: {
employeeId: true,
companyId: true,
status: true
}
});

const employeeMap =
new Map(
employees.map(
employee => [
employee.employeeId,
employee
]
)
);

for (
const employeeId
of employeeIds
) {

const employee =
employeeMap.get(
employeeId
);

if (
!employee
) {
throw createError(
`Employee ${employeeId} was not found for this device`
);
}

if (
employee.status !==
"ACTIVE"
) {
throw createError(
`Employee ${employeeId} is not active`,
403
);
}

if (
Number.isInteger(
companyId
) &&
companyId > 0 &&
Number(employee.companyId) !==
companyId
) {
throw createError(
`Employee ${employeeId} does not belong to the authenticated device company`,
403
);
}
}

// ------------------------------------------------------
// SORT BY ACTUAL EVENT TIME
// ------------------------------------------------------
//
// Upload order is not attendance order.
// Always calculate session state using punch timestamp.
//
const sortedEvents =
[...normalizedEvents].sort(
(a, b) => {

const timeDifference =
a.punchedAt.getTime() -
b.punchedAt.getTime();

if (
timeDifference !== 0
) {
return timeDifference;
}

return (
a.originalIndex -
b.originalIndex
);
}
);

// ------------------------------------------------------
// LOAD EXISTING EVENT IDs
// ------------------------------------------------------

const eventIds =
sortedEvents.map(
event =>
event.eventId
);

const existingEvents =
await prisma.attendancePunch.findMany({
where: {
deviceId:
device.deviceId,

eventId: {
in:
eventIds
}
},

include: {
employee: {
select: employeeSelect
},

device: {
select: {
deviceId: true,
deviceCode: true,
deviceName: true,
branchId: true
}
}
}
});

const existingEventMap =
new Map(
existingEvents.map(
punch => [
String(punch.eventId),
punch
]
)
);

// ------------------------------------------------------
// LOAD EXISTING RAW PUNCHES FOR EVENT-TYPE INFERENCE
// ------------------------------------------------------
//
// The eventType coming from the machine should normally be
// explicit. If it is absent, derive it from the actual prior
// raw state for that employee and attendance date.
//
const uniqueEmployeeIds =
employeeIds;

const earliestEvent =
sortedEvents[0].punchedAt;

const latestEvent =
sortedEvents[
sortedEvents.length - 1
].punchedAt;

const existingRangePunches =
await prisma.attendancePunch.findMany({
where: {
employeeId: {
in:
uniqueEmployeeIds
},

punchedAt: {
gte:
getStartOfDay(
earliestEvent
),

lte:
getEndOfDay(
latestEvent
)
}
},

orderBy: {
punchedAt:
"asc"
}
});

const stateByEmployeeDate =
new Map();

for (
const punch
of existingRangePunches
) {

const key =
`${punch.employeeId}|${getISTDateString(
punch.punchedAt
)}`;

stateByEmployeeDate.set(
key,
punch.punchType
);
}

const insertedPunches =
[];

const duplicatePunches =
[];

const affectedAttendanceKeys =
new Map();

const seenBatchEventIds =
new Set();

await prisma.$transaction(
async (
tx
) => {

// --------------------------------------------------
// OFFICE CLOSE RESOLUTION SETTING
// --------------------------------------------------

const officeCloseTime =
suppliedOfficeCloseTime
? formatTimeValue(
parseTime(
suppliedOfficeCloseTime,
"officeCloseTime"
)
).slice(
0,
5
)
: await getOfficeCloseTime(
companyId,
tx
);

// --------------------------------------------------
// PROCESS EACH EVENT
// --------------------------------------------------

for (
const event
of sortedEvents
) {

if (
seenBatchEventIds.has(
event.eventId
)
) {

const duplicate =
existingEventMap.get(
event.eventId
);

duplicatePunches.push(
duplicate || {
eventId:
event.eventId,

duplicate:
true
}
);

continue;
}

seenBatchEventIds.add(
event.eventId
);

// -----------------------------------------------
// IDEMPOTENCY CHECK
// -----------------------------------------------

const existingEvent =
existingEventMap.get(
event.eventId
);

if (
existingEvent
) {

duplicatePunches.push(
existingEvent
);

affectedAttendanceKeys.set(
`${event.employeeId}|${getISTDateString(
event.punchedAt
)}`,
{
employeeId:
event.employeeId,

attendanceDate:
getISTCalendarDate(
event.punchedAt
)
}
);

continue;
}

// -----------------------------------------------
// DETERMINE PUNCH TYPE
// -----------------------------------------------

const attendanceKey =
`${event.employeeId}|${getISTDateString(
event.punchedAt
)}`;

let punchType =
event.punchType;

if (
!punchType
) {

const previousPunchType =
stateByEmployeeDate.get(
attendanceKey
);

punchType =
previousPunchType ===
"IN"
? "OUT"
: "IN";
}

// -----------------------------------------------
// INSERT RAW PUNCH
// -----------------------------------------------

let punch;

try {

punch =
await tx.attendancePunch.create({
data: {
employeeId:
event.employeeId,

deviceId:
device.deviceId,

sensorSlot:
event.sensorSlot,

punchType,

punchedAt:
event.punchedAt,

eventId:
event.eventId
},

include: {
employee: {
select:
employeeSelect
},

device: {
select: {
deviceId: true,
deviceCode: true,
deviceName: true,
branchId: true
}
}
}
});

}
catch (
error
) {

if (
error?.code ===
"P2002"
) {

const duplicate =
await tx.attendancePunch.findUnique({
where: {
deviceId_eventId: {
deviceId:
device.deviceId,

eventId:
event.eventId
}
},

include: {
employee: {
select:
employeeSelect
},

device: {
select: {
deviceId: true,
deviceCode: true,
deviceName: true,
branchId: true
}
}
}
});

duplicatePunches.push(
duplicate || {
eventId:
event.eventId,

duplicate:
true
}
);

continue;
}

throw error;
}

insertedPunches.push(
punch
);

// -----------------------------------------------
// KEEP DERIVED STATE IN SYNC
// -----------------------------------------------

stateByEmployeeDate.set(
attendanceKey,
punchType
);

affectedAttendanceKeys.set(
attendanceKey,
{
employeeId:
event.employeeId,

attendanceDate:
getISTCalendarDate(
event.punchedAt
)
}
);
}

// --------------------------------------------------
// CENTRAL ATTENDANCE RESOLUTION
// --------------------------------------------------
//
// Run once for every affected employee/date.
//
// Because autoClose=true, a late batch upload can settle a
// historical open session using that historical day's office
// close time. No fake raw punch is created.
//
for (
const affected
of affectedAttendanceKeys.values()
) {

await resolveAttendanceForDateWithClient(
tx,
affected.employeeId,
affected.attendanceDate,
{
autoClose:
true,

companyId:
companyId,

officeCloseTime:
officeCloseTime,

now:
new Date()
}
);
}
}
);

// ------------------------------------------------------
// LOAD RESOLVED ATTENDANCE FOR RESPONSE
// ------------------------------------------------------

const resolvedAttendance =
[];

for (
const affected
of affectedAttendanceKeys.values()
) {

const attendance =
await prisma.attendance.findUnique({
where: {
employeeId_date: {
employeeId:
affected.employeeId,

date:
affected.attendanceDate
}
},

include: {
employee: {
select:
employeeSelect
},

manualOverrideAdmin: {
select: {
adminId:
true,

adminName:
true,

email:
true
}
}
}
});

if (
attendance
) {
resolvedAttendance.push(
serializeAttendance(
attendance
)
);
}
}

return {
deviceId:
device.deviceId,

receivedCount:
normalizedEvents.length,

insertedCount:
insertedPunches.length,

duplicateCount:
duplicatePunches.length,

insertedPunches:
insertedPunches.map(
serializePunch
),

duplicatePunches:
duplicatePunches.map(
serializePunch
),

attendance:
resolvedAttendance
};
};

// ======================================================
// GET ALL ATTENDANCE
// ======================================================

const getAllAttendance = async (
filters = {}
) => {

const {
    date,
    from,
    to
} = filters;

const where = {};


if (date) {

    const selectedDate =
        new Date(
            `${date}T00:00:00`
        );

    if (
        Number.isNaN(
            selectedDate.getTime()
        )
    ) {
        const error = new Error(
            "Invalid date. Use YYYY-MM-DD"
        );

        error.statusCode = 400;

        throw error;
    }

    where.date = {
        gte:
            getISTCalendarDate(
                selectedDate
            ),

        lt:
            getNextISTCalendarDate(
                selectedDate
            )
    };
}

else if (
    from ||
    to
) {

    where.date = {};

    if (from) {

        const fromDate =
            new Date(
                `${from}T00:00:00`
            );

        if (
            Number.isNaN(
                fromDate.getTime()
            )
        ) {
            const error = new Error(
                "Invalid from date. Use YYYY-MM-DD"
            );

            error.statusCode = 400;

            throw error;
        }

        where.date.gte =
            getISTCalendarDate(
                fromDate
            );
    }


    if (to) {

        const toDate =
            new Date(
                `${to}T00:00:00`
            );

        if (
            Number.isNaN(
                toDate.getTime()
            )
        ) {
            const error = new Error(
                "Invalid to date. Use YYYY-MM-DD"
            );

            error.statusCode = 400;

            throw error;
        }

        where.date.lt =
            getNextISTCalendarDate(
                toDate
            );
    }
}


const attendance =
    await prisma.attendance.findMany({
        where,

        include: {
            employee: {
                select: {
                    employeeId: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    status: true
                }
            }
        },

        orderBy: [
            {
                date: "desc"
            },

            {
                employeeId: "asc"
            }
        ]
    });


return attendance.map(
    serializeAttendance
);

};

// ======================================================
// GET ATTENDANCE BY ID
// ======================================================

const getAttendanceById = async (
attendanceId
) => {

const id =
    Number(attendanceId);

if (
    !Number.isInteger(id) ||
    id < 1
) {
    const error = new Error(
        "Invalid attendance ID"
    );

    error.statusCode = 400;

    throw error;
}


const attendance =
    await prisma.attendance.findUnique({
        where: {
            attendanceId: id
        },

        include: {
            employee: {
                select: {
                    employeeId: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    status: true
                }
            },

            manualOverrideAdmin: {
                select: {
                    adminId: true,
                    adminName: true,
                    email: true
                }
            }
        }
    });


if (!attendance) {
    const error = new Error(
        "Attendance record not found"
    );

    error.statusCode = 404;

    throw error;
}


return serializeAttendance(
    attendance
);

};

// ======================================================
// GET EMPLOYEE ATTENDANCE
// ======================================================

const getEmployeeAttendance = async (
employeeId,
filters = {}
) => {

const id =
    Number(employeeId);

if (
    !Number.isInteger(id) ||
    id < 1
) {
    const error = new Error(
        "Invalid employee ID"
    );

    error.statusCode = 400;

    throw error;
}


const {
    from,
    to
} = filters;


const where = {
    employeeId: id
};


if (
    from ||
    to
) {

    where.date = {};


    if (from) {

        const fromDate =
            new Date(
                `${from}T00:00:00`
            );

        if (
            Number.isNaN(
                fromDate.getTime()
            )
        ) {
            const error = new Error(
                "Invalid from date. Use YYYY-MM-DD"
            );

            error.statusCode = 400;

            throw error;
        }

        where.date.gte =
            getISTCalendarDate(
                fromDate
            );
    }


    if (to) {

        const toDate =
            new Date(
                `${to}T00:00:00`
            );

        if (
            Number.isNaN(
                toDate.getTime()
            )
        ) {
            const error = new Error(
                "Invalid to date. Use YYYY-MM-DD"
            );

            error.statusCode = 400;

            throw error;
        }

        where.date.lt =
            getNextISTCalendarDate(
                toDate
            );
    }
}


const attendance =
    await prisma.attendance.findMany({
        where,

        include: {
            employee: {
                select: {
                    employeeId: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    status: true
                }
            }
        },

        orderBy: {
            date: "desc"
        }
    });


return attendance.map(
    serializeAttendance
);

};

// ======================================================
// GET ATTENDANCE SUMMARY
// ======================================================
//
// Supports both the existing daily summary and range summaries.
//
// Daily:
//   getAttendanceSummary(date, { companyId })
//
// Range:
//   getAttendanceSummary(null, {
//       from,
//       to,
//       companyId
//   })
//
// Range summaries are used by the ADMIN ATTENDANCE page for:
// - Last 7 Days
// - Monthly
//
// The response contains:
// - overall period totals
// - employee-level totals
// - total hours
//
// AttendancePunch remains the source of truth for the current IST
// day, so a still-open punch can continue contributing live hours.
// ======================================================

const getAttendanceSummary = async (
    date,
    filters = {}
) => {

    const {
        from = null,
        to = null,
        companyId = null
    } = filters;


    // ==================================================
    // OPTIONAL COMPANY SCOPE
    // ==================================================

    const parsedCompanyId =
        companyId !== undefined &&
        companyId !== null &&
        companyId !== ""
            ? Number(companyId)
            : null;


    if (
        parsedCompanyId !== null &&
        (
            !Number.isInteger(parsedCompanyId) ||
            parsedCompanyId < 1
        )
    ) {
        throw createError(
            "Invalid company ID"
        );
    }


    // ==================================================
    // DAILY SUMMARY
    // ==================================================
    //
    // Keep the existing daily response shape so the current
    // admin/dashboard consumers remain compatible.
    // ==================================================

    if (!from && !to) {

        const targetDate =
            date
                ? new Date(
                    `${date}T00:00:00`
                )
                : new Date();


        if (
            Number.isNaN(
                targetDate.getTime()
            )
        ) {
            throw createError(
                "Invalid date. Use YYYY-MM-DD"
            );
        }


        const calendarDateStart =
            getISTCalendarDate(
                targetDate
            );

        const calendarDateEnd =
            getNextISTCalendarDate(
                targetDate
            );


        const employeeWhere = {
            status: "ACTIVE"
        };


        if (
            parsedCompanyId !== null
        ) {
            employeeWhere.companyId =
                parsedCompanyId;
        }


        const employees =
            await prisma.employee.findMany({
                where: employeeWhere,

                select: {
                    employeeId: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    status: true
                },

                orderBy: {
                    employeeId: "asc"
                }
            });


        const employeeIds =
            employees.map(
                employee =>
                    Number(employee.employeeId)
            );


        const storedAttendance =
            employeeIds.length > 0
                ? await prisma.attendance.findMany({
                    where: {
                        employeeId: {
                            in: employeeIds
                        },

                        date: {
                            gte:
                                calendarDateStart,

                            lt:
                                calendarDateEnd
                        }
                    },

                    select: {
                        attendanceId: true,
                        employeeId: true,
                        date: true,
                        checkInTime: true,
                        checkOutTime: true,
                        totalHours: true,
                        status: true,
                        resolutionSource: true,
                        manualOverride: true
                    }
                })
                : [];


        // --------------------------------------------------
        // Live current-day projection
        // --------------------------------------------------

        const now = new Date();

        const isToday =
            getISTDateString(
                targetDate
            ) ===
            getISTDateString(
                now
            );


        let liveTodayRows = [];

        if (
            isToday &&
            employeeIds.length > 0
        ) {
            const todayStart =
                getStartOfDay(now);

            const todayEnd =
                getEndOfDay(now);

            const todayPunches =
                await prisma.attendancePunch.findMany({
                    where: {
                        punchedAt: {
                            gte:
                                todayStart,
                            lte:
                                todayEnd
                        },

                        employeeId: {
                            in: employeeIds
                        }
                    },

                    include: {
                        employee: {
                            select: {
                                employeeId: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                status: true
                            }
                        }
                    },

                    orderBy: {
                        punchedAt: "asc"
                    }
                });


            liveTodayRows =
                buildTodayAttendanceFromPunches(
                    todayPunches,
                    now
                );
        }


        const storedMap =
            new Map();

        for (
            const record of storedAttendance
        ) {
            storedMap.set(
                Number(record.employeeId),
                record
            );
        }


        const liveMap =
            new Map();

        for (
            const record of liveTodayRows
        ) {
            liveMap.set(
                Number(record.employeeId),
                record
            );
        }


        // --------------------------------------------------
        // Approved leave for selected date
        // --------------------------------------------------

        let leaveMap = new Map();

        if (
            employeeIds.length > 0
        ) {
            const approvedLeaves =
                await prisma.leaveRequest.findMany({
                    where: {
                        employeeId: {
                            in: employeeIds
                        },

                        status: "APPROVED"
                    },

                    select: {
                        employeeId: true,
                        startDate: true,
                        endDate: true,
                        approvedStartDate: true,
                        approvedEndDate: true
                    }
                });


            const selectedDateKey =
                getISTDateString(
                    targetDate
                );


            leaveMap =
                new Map();


            for (
                const leave of approvedLeaves
            ) {
                const effectiveStart =
                    leave.approvedStartDate ||
                    leave.startDate;

                const effectiveEnd =
                    leave.approvedEndDate ||
                    leave.endDate;

                if (
                    !effectiveStart ||
                    !effectiveEnd
                ) {
                    continue;
                }


                const startKey =
                    getISTDateString(
                        effectiveStart
                    );

                const endKey =
                    getISTDateString(
                        effectiveEnd
                    );


                if (
                    selectedDateKey >= startKey &&
                    selectedDateKey <= endKey
                ) {
                    leaveMap.set(
                        Number(leave.employeeId),
                        true
                    );
                }
            }
        }


        let present = 0;
        let absent = 0;
        let late = 0;
        let onLeave = 0;
        let checkedIn = 0;
        let checkedOut = 0;
        let totalHours = 0;

        const employeeSummaries = [];


        for (
            const employee of employees
        ) {
            const employeeId =
                Number(employee.employeeId);

            const storedRecord =
                storedMap.get(employeeId) ||
                null;

            const liveRecord =
                liveMap.get(employeeId) ||
                null;

            const record =
                liveRecord
                    ? {
                        ...(storedRecord || {}),
                        ...liveRecord,
                        employee
                    }
                    : storedRecord;

            let effectiveStatus =
                "ABSENT";

            if (
                record?.checkInTime
            ) {
                const checkInMinutes =
                    timeValueToMinutes(
                        record.checkInTime
                    );

                effectiveStatus =
                    checkInMinutes !== null &&
                    checkInMinutes >
                        LATE_AFTER_MINUTES
                        ? "LATE"
                        : "PRESENT";
            } else if (
                leaveMap.has(employeeId)
            ) {
                effectiveStatus =
                    "ON_LEAVE";
            }


            if (
                record?.checkInTime
            ) {
                present += 1;
                checkedIn += 1;
            }

            if (
                effectiveStatus === "LATE"
            ) {
                late += 1;
            }

            if (
                effectiveStatus === "ON_LEAVE"
            ) {
                onLeave += 1;
            }

            if (
                effectiveStatus === "ABSENT"
            ) {
                absent += 1;
            }

            if (
                record?.checkOutTime
            ) {
                checkedOut += 1;
            }

            const employeeHours =
                record?.totalHours !== null &&
                record?.totalHours !== undefined
                    ? Number(record.totalHours)
                    : 0;

            if (
                Number.isFinite(
                    employeeHours
                ) &&
                employeeHours > 0
            ) {
                totalHours +=
                    employeeHours;
            }


            employeeSummaries.push({
                employeeId,
                firstName:
                    employee.firstName,
                lastName:
                    employee.lastName,
                email:
                    employee.email,
                attendanceDays:
                    record?.checkInTime ? 1 : 0,
                presentDays:
                    record?.checkInTime ? 1 : 0,
                lateDays:
                    effectiveStatus === "LATE"
                        ? 1
                        : 0,
                absentDays:
                    effectiveStatus === "ABSENT"
                        ? 1
                        : 0,
                onLeaveDays:
                    effectiveStatus === "ON_LEAVE"
                        ? 1
                        : 0,
                checkedInDays:
                    record?.checkInTime ? 1 : 0,
                checkedOutDays:
                    record?.checkOutTime ? 1 : 0,
                totalHours:
                    Number(
                        employeeHours.toFixed(2)
                    ),
                totalHoursFormatted:
                    formatDuration(
                        employeeHours
                    )
            });
        }


        return {
            period: "DAILY",
            date:
                getISTDateString(
                    targetDate
                ),
            from:
                getISTDateString(
                    targetDate
                ),
            to:
                getISTDateString(
                    targetDate
                ),
            totalEmployees:
                employees.length,
            present,
            absent,
            late,
            onLeave,
            checkedIn,
            checkedOut,
            totalHours:
                Number(
                    totalHours.toFixed(2)
                ),
            employeeSummaries
        };
    }


    // ==================================================
    // RANGE SUMMARY
    // ==================================================

    const rangeFrom =
        from ||
        to;

    const rangeTo =
        to ||
        from;


    const fromDate =
        new Date(
            `${rangeFrom}T00:00:00`
        );

    const toDate =
        new Date(
            `${rangeTo}T00:00:00`
        );


    if (
        Number.isNaN(
            fromDate.getTime()
        ) ||
        Number.isNaN(
            toDate.getTime()
        )
    ) {
        throw createError(
            "Invalid date range. Use YYYY-MM-DD"
        );
    }


    const fromCalendarDate =
        getISTCalendarDate(
            fromDate
        );

    const toCalendarDate =
        getISTCalendarDate(
            toDate
        );


    if (
        fromCalendarDate.getTime() >
        toCalendarDate.getTime()
    ) {
        throw createError(
            "The from date cannot be after the to date"
        );
    }


    const rangeEndExclusive =
        getNextISTCalendarDate(
            toDate
        );


    const employeeWhere = {
        status: "ACTIVE"
    };


    if (
        parsedCompanyId !== null
    ) {
        employeeWhere.companyId =
            parsedCompanyId;
    }


    const employees =
        await prisma.employee.findMany({
            where: employeeWhere,

            select: {
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true
            },

            orderBy: {
                employeeId: "asc"
            }
        });


    const employeeIds =
        employees.map(
            employee =>
                Number(employee.employeeId)
        );


    const attendanceRecords =
        employeeIds.length > 0
            ? await prisma.attendance.findMany({
                where: {
                    employeeId: {
                        in: employeeIds
                    },

                    date: {
                        gte:
                            fromCalendarDate,

                        lt:
                            rangeEndExclusive
                    }
                },

                select: {
                    attendanceId: true,
                    employeeId: true,
                    date: true,
                    checkInTime: true,
                    checkOutTime: true,
                    totalHours: true,
                    status: true,
                    resolutionSource: true,
                    manualOverride: true
                },

                orderBy: [
                    {
                        date: "asc"
                    },
                    {
                        employeeId: "asc"
                    }
                ]
            })
            : [];


    // --------------------------------------------------
    // Current-day live attendance overlay
    // --------------------------------------------------

    const now = new Date();
    const todayKey =
        getISTDateString(now);

    const rangeStartKey =
        getISTDateString(
            fromCalendarDate
        );

    const rangeEndKey =
        getISTDateString(
            toCalendarDate
        );

    let liveTodayRows = [];

    if (
        employeeIds.length > 0 &&
        todayKey >= rangeStartKey &&
        todayKey <= rangeEndKey
    ) {
        const todayStart =
            getStartOfDay(now);

        const todayEnd =
            getEndOfDay(now);

        const todayPunches =
            await prisma.attendancePunch.findMany({
                where: {
                    punchedAt: {
                        gte:
                            todayStart,
                        lte:
                            todayEnd
                    },

                    employeeId: {
                        in: employeeIds
                    }
                },

                include: {
                    employee: {
                        select: {
                            employeeId: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            status: true
                        }
                    }
                },

                orderBy: {
                    punchedAt: "asc"
                }
            });

        liveTodayRows =
            buildTodayAttendanceFromPunches(
                todayPunches,
                now
            );
    }


    // --------------------------------------------------
    // Build a single attendance map by employee/date.
    // --------------------------------------------------

    const attendanceMap =
        new Map();

    for (
        const record of attendanceRecords
    ) {
        attendanceMap.set(
            `${Number(record.employeeId)}|${getISTDateString(record.date)}`,
            record
        );
    }

    for (
        const liveRecord of liveTodayRows
    ) {
        attendanceMap.set(
            `${Number(liveRecord.employeeId)}|${getISTDateString(liveRecord.date)}`,
            liveRecord
        );
    }


    // --------------------------------------------------
    // Approved leaves in the selected range.
    // --------------------------------------------------

    const leaveMap =
        new Map();

    if (
        employeeIds.length > 0
    ) {
        const approvedLeaves =
            await prisma.leaveRequest.findMany({
                where: {
                    employeeId: {
                        in: employeeIds
                    },

                    status: "APPROVED"
                },

                select: {
                    employeeId: true,
                    startDate: true,
                    endDate: true,
                    approvedStartDate: true,
                    approvedEndDate: true
                }
            });


        for (
            const leave of approvedLeaves
        ) {
            const effectiveStart =
                leave.approvedStartDate ||
                leave.startDate;

            const effectiveEnd =
                leave.approvedEndDate ||
                leave.endDate;

            if (
                !effectiveStart ||
                !effectiveEnd
            ) {
                continue;
            }


            const leaveStart =
                getISTCalendarDate(
                    effectiveStart
                );

            const leaveEnd =
                getISTCalendarDate(
                    effectiveEnd
                );

            const clippedStart =
                leaveStart.getTime() <
                fromCalendarDate.getTime()
                    ? fromCalendarDate
                    : leaveStart;

            const clippedEnd =
                leaveEnd.getTime() >
                toCalendarDate.getTime()
                    ? toCalendarDate
                    : leaveEnd;

            if (
                clippedStart.getTime() >
                clippedEnd.getTime()
            ) {
                continue;
            }


            let cursor =
                new Date(
                    clippedStart
                );

            while (
                cursor.getTime() <=
                clippedEnd.getTime()
            ) {
                const key =
                    `${Number(leave.employeeId)}|${getISTDateString(cursor)}`;

                leaveMap.set(
                    key,
                    true
                );

                cursor =
                    new Date(
                        cursor.getTime() +
                        (24 * 60 * 60 * 1000)
                    );
            }
        }
    }


    // --------------------------------------------------
    // Iterate every active employee over every calendar day.
    // This produces a consistent employee-day summary for the UI.
    // --------------------------------------------------

    const calendarDays =
        Math.floor(
            (
                toCalendarDate.getTime() -
                fromCalendarDate.getTime()
            ) /
            (24 * 60 * 60 * 1000)
        ) + 1;


    const totalEmployeeDays =
        employees.length *
        calendarDays;

    let present = 0;
    let absent = 0;
    let late = 0;
    let onLeave = 0;
    let checkedIn = 0;
    let checkedOut = 0;
    let totalHours = 0;


    const employeeSummaries =
        employees.map(
            employee => ({
                employeeId:
                    Number(employee.employeeId),
                firstName:
                    employee.firstName,
                lastName:
                    employee.lastName,
                email:
                    employee.email,
                attendanceDays: 0,
                presentDays: 0,
                lateDays: 0,
                absentDays: 0,
                onLeaveDays: 0,
                checkedInDays: 0,
                checkedOutDays: 0,
                totalHours: 0,
                totalHoursFormatted:
                    formatDuration(0),
                averageHours: 0,
                averageHoursFormatted:
                    formatDuration(0)
            })
        );


    const employeeSummaryMap =
        new Map(
            employeeSummaries.map(
                summary => [
                    Number(summary.employeeId),
                    summary
                ]
            )
        );


    let cursor =
        new Date(
            fromCalendarDate
        );

    while (
        cursor.getTime() <=
        toCalendarDate.getTime()
    ) {
        const dateKey =
            getISTDateString(cursor);

        for (
            const employee of employees
        ) {
            const employeeId =
                Number(employee.employeeId);

            const summary =
                employeeSummaryMap.get(
                    employeeId
                );

            const record =
                attendanceMap.get(
                    `${employeeId}|${dateKey}`
                ) ||
                null;

            let effectiveStatus =
                "ABSENT";

            if (
                record?.checkInTime
            ) {
                const checkInMinutes =
                    timeValueToMinutes(
                        record.checkInTime
                    );

                effectiveStatus =
                    checkInMinutes !== null &&
                    checkInMinutes >
                        LATE_AFTER_MINUTES
                        ? "LATE"
                        : "PRESENT";
            } else if (
                leaveMap.has(
                    `${employeeId}|${dateKey}`
                )
            ) {
                effectiveStatus =
                    "ON_LEAVE";
            }


            if (
                record?.checkInTime
            ) {
                present += 1;
                checkedIn += 1;
                summary.attendanceDays += 1;
                summary.presentDays += 1;
                summary.checkedInDays += 1;
            }

            if (
                record?.checkOutTime
            ) {
                checkedOut += 1;
                summary.checkedOutDays += 1;
            }

            const recordHours =
                record?.totalHours !== null &&
                record?.totalHours !== undefined
                    ? Number(record.totalHours)
                    : 0;

            if (
                Number.isFinite(recordHours) &&
                recordHours > 0
            ) {
                totalHours +=
                    recordHours;
                summary.totalHours +=
                    recordHours;
            }


            if (
                effectiveStatus === "LATE"
            ) {
                late += 1;
                summary.lateDays += 1;
            }

            if (
                effectiveStatus === "ON_LEAVE"
            ) {
                onLeave += 1;
                summary.onLeaveDays += 1;
            }

            if (
                effectiveStatus === "ABSENT"
            ) {
                absent += 1;
                summary.absentDays += 1;
            }
        }

        cursor =
            new Date(
                cursor.getTime() +
                (24 * 60 * 60 * 1000)
            );
    }


    for (
        const summary of employeeSummaries
    ) {
        const averageHours =
            summary.presentDays > 0
                ? summary.totalHours /
                    summary.presentDays
                : 0;

        summary.totalHours =
            Number(
                summary.totalHours.toFixed(2)
            );

        summary.totalHoursFormatted =
            formatDuration(
                summary.totalHours
            );

        summary.averageHours =
            Number(
                averageHours.toFixed(2)
            );

        summary.averageHoursFormatted =
            formatDuration(
                averageHours
            );
    }


    return {
        period: "RANGE",
        from:
            getISTDateString(
                fromCalendarDate
            ),
        to:
            getISTDateString(
                toCalendarDate
            ),
        calendarDays,
        totalEmployees:
            employees.length,
        totalEmployeeDays,
        present,
        absent,
        late,
        onLeave,
        checkedIn,
        checkedOut,
        totalHours:
            Number(
                totalHours.toFixed(2)
            ),
        totalHoursFormatted:
            formatDuration(
                totalHours
            ),
        employeeSummaries
    };

};

// ======================================================
// GET EMPLOYEE ATTENDANCE SUMMARY
// ======================================================

const getEmployeeAttendanceSummary = async (
employeeId,
filters = {}
) => {

const id =
    Number(employeeId);

if (
    !Number.isInteger(id) ||
    id < 1
) {
    const error = new Error(
        "Invalid employee ID"
    );

    error.statusCode = 400;

    throw error;
}


const employee =
    await prisma.employee.findUnique({
        where: {
            employeeId: id
        },

        select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true
        }
    });


if (!employee) {
    const error = new Error(
        "Employee not found"
    );

    error.statusCode = 404;

    throw error;
}


const {
    from,
    to
} = filters;


const where = {
    employeeId: id
};


if (
    from ||
    to
) {

    where.date = {};


    if (from) {

        const fromDate =
            new Date(
                `${from}T00:00:00`
            );

        if (
            Number.isNaN(
                fromDate.getTime()
            )
        ) {
            const error = new Error(
                "Invalid from date. Use YYYY-MM-DD"
            );

            error.statusCode = 400;

            throw error;
        }

        where.date.gte =
            getISTCalendarDate(
                fromDate
            );
    }


    if (to) {

        const toDate =
            new Date(
                `${to}T00:00:00`
            );

        if (
            Number.isNaN(
                toDate.getTime()
            )
        ) {
            const error = new Error(
                "Invalid to date. Use YYYY-MM-DD"
            );

            error.statusCode = 400;

            throw error;
        }

        where.date.lt =
            getNextISTCalendarDate(
                toDate
            );
    }
}


const attendance =
    await prisma.attendance.findMany({
        where,

        orderBy: {
            date: "asc"
        }
    });


const totalDays =
    attendance.length;


const presentDays =
    attendance.filter(
        record =>
            record.status === "PRESENT"
    ).length;


const absentDays =
    attendance.filter(
        record =>
            record.status === "ABSENT"
    ).length;


const totalHours =
    attendance.reduce(
        (total, record) =>
            total +
            (
                record.totalHours
                    ? Number(
                        record.totalHours
                    )
                    : 0
            ),
        0
    );


const averageHours =
    presentDays > 0
        ? totalHours / presentDays
        : 0;


return {
    employee: {
        employeeId:
            employee.employeeId,

        firstName:
            employee.firstName,

        lastName:
            employee.lastName,

        email:
            employee.email,

        status:
            employee.status
    },

    from:
        from || null,

    to:
        to || null,

    totalDays,

    presentDays,

    absentDays,

    totalHours:
        Number(
            totalHours.toFixed(2)
        ),

    totalHoursFormatted:
        formatDuration(
            totalHours
        ),

    averageHours:
        Number(
            averageHours.toFixed(2)
        ),

    averageHoursFormatted:
        formatDuration(
            averageHours
        )
};

};

// ======================================================
// GET ATTENDANCE WITH FILTERS + PAGINATION
// ======================================================

// ======================================================
// ATTENDANCE STATUS RULES FOR ADMIN DAILY VIEW
// ======================================================
//
// The Attendance table currently stores PRESENT / ABSENT.
// LATE and ON_LEAVE are derived for the admin daily view so
// historical attendance rows do not need a schema migration.
//
// Late cutoff is intentionally kept configurable here.
// Change this value when the ERP's official shift start changes.
// ======================================================

const LATE_AFTER_MINUTES = 9 * 60;

// ======================================================
// BUILD EFFECTIVE STATUS
// ======================================================

const getEffectiveAttendanceStatus = (
attendanceRecord,
leaveMap,
employeeId,
isDailyView = false
) => {
const checkInTime =
attendanceRecord?.checkInTime || null;

// Real attendance always takes precedence over leave.
if (checkInTime) {
    const checkInMinutes =
        timeValueToMinutes(checkInTime);

    if (
        checkInMinutes !== null &&
        checkInMinutes > LATE_AFTER_MINUTES
    ) {
        return "LATE";
    }

    return "PRESENT";
}

// Preserve an explicitly corrected stored status when it exists.
if (
    attendanceRecord?.status === "ABSENT"
) {
    return "ABSENT";
}

// Approved leave applies only when there is no attendance.
if (
    leaveMap?.has(
        Number(employeeId)
    )
) {
    return "ON_LEAVE";
}

// Daily roster view needs a concrete state even when no
// Attendance row exists yet.
if (isDailyView) {
    return "ABSENT";
}

return attendanceRecord?.status || "ABSENT";

};

// ======================================================
// GET ATTENDANCE WITH FILTERS + PAGINATION
// ======================================================

const getAttendancePaginated = async (
filters = {}
) => {

const {
    date,
    from,
    to,
    employeeId,
    companyId,
    status,
    page = 1,
    limit = 20
} = filters;


const parsedPage =
    Number(page);

const parsedLimit =
    Number(limit);


// ==============================================
// VALIDATE PAGE
// ==============================================

if (
    !Number.isInteger(parsedPage) ||
    parsedPage < 1
) {
    const error = new Error(
        "Page must be a positive integer"
    );

    error.statusCode = 400;
    throw error;
}


// ==============================================
// VALIDATE LIMIT
// ==============================================

if (
    !Number.isInteger(parsedLimit) ||
    parsedLimit < 1 ||
    parsedLimit > 100
) {
    const error = new Error(
        "Limit must be between 1 and 100"
    );

    error.statusCode = 400;
    throw error;
}


// ==============================================
// VALIDATE STATUS
// ==============================================

const allowedStatusFilters = [
    "PRESENT",
    "ABSENT",
    "LATE",
    "ON_LEAVE"
];

if (
    status !== undefined &&
    status !== "" &&
    !allowedStatusFilters.includes(status)
) {
    const error = new Error(
        "Invalid attendance status filter"
    );

    error.statusCode = 400;
    throw error;
}


// ==============================================
// OPTIONAL COMPANY SCOPE
// ==============================================

const parsedCompanyId =
    companyId !== undefined &&
    companyId !== null &&
    companyId !== ""
        ? Number(companyId)
        : null;

if (
    parsedCompanyId !== null &&
    (
        !Number.isInteger(parsedCompanyId) ||
        parsedCompanyId < 1
    )
) {
    const error = new Error(
        "Invalid company ID"
    );

    error.statusCode = 400;
    throw error;
}


// ==============================================
// OPTIONAL EMPLOYEE FILTER
// ==============================================

let parsedEmployeeId = null;

if (
    employeeId !== undefined &&
    employeeId !== ""
) {
    parsedEmployeeId =
        Number(employeeId);

    if (
        !Number.isInteger(parsedEmployeeId) ||
        parsedEmployeeId < 1
    ) {
        const error = new Error(
            "Invalid employee ID"
        );

        error.statusCode = 400;
        throw error;
    }
}


// ==============================================
// DAILY STATUS VIEW
// ==============================================
//
// This mode is used whenever a specific date is selected,
// or whenever a status filter is selected without a date.
//
// It creates one row per active employee for that day, so:
//
// - PRESENT -> has attendance
// - LATE -> check-in is after the configured cutoff
// - ON_LEAVE -> approved leave and no attendance
// - ABSENT -> no attendance and no approved leave
//
// This is the part that makes every status filter actually
// usable instead of depending on an Attendance row already
// existing in the database.
// ==============================================

const dailyViewRequested =
    Boolean(date) ||
    Boolean(status);

let dailyDate = null;

if (dailyViewRequested) {
    dailyDate = date
        ? new Date(
            `${date}T00:00:00`
        )
        : new Date();

    if (
        Number.isNaN(
            dailyDate.getTime()
        )
    ) {
        const error = new Error(
            "Invalid date. Use YYYY-MM-DD"
        );

        error.statusCode = 400;
        throw error;
    }

    const dailyDateStart =
        getISTCalendarDate(
            dailyDate
        );

    const dailyDateEnd =
        getNextISTCalendarDate(
            dailyDate
        );


    // ----------------------------------------------
    // Active employees for the selected company
    // ----------------------------------------------

    const employeeWhere = {
        status: "ACTIVE"
    };

    if (
        parsedCompanyId !== null
    ) {
        employeeWhere.companyId =
            parsedCompanyId;
    }

    if (
        parsedEmployeeId !== null
    ) {
        employeeWhere.employeeId =
            parsedEmployeeId;
    }


    const employees =
        await prisma.employee.findMany({
            where: employeeWhere,

            select: {
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true
            },

            orderBy: {
                employeeId: "asc"
            }
        });


    const employeeIds =
        employees.map(
            employee =>
                employee.employeeId
        );


    if (
        employeeIds.length === 0
    ) {
        return {
            data: [],
            pagination: {
                page: 1,
                limit: parsedLimit,
                total: 0,
                totalPages: 0,
                hasNextPage: false,
                hasPreviousPage: false
            }
        };
    }


    // ----------------------------------------------
    // Stored attendance for selected day
    // ----------------------------------------------

    const storedAttendance =
        await prisma.attendance.findMany({
            where: {
                employeeId: {
                    in: employeeIds
                },

                date: {
                    gte:
                        dailyDateStart,

                    lt:
                        dailyDateEnd
                }
            },

            include: {
                employee: {
                    select: {
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        status: true
                    }
                }
            }
        });


    const attendanceMap =
        new Map();

    for (
        const record
        of storedAttendance
    ) {
        attendanceMap.set(
            Number(record.employeeId),
            record
        );
    }


    // ----------------------------------------------
    // Today's raw punches
    // ----------------------------------------------
    //
    // Raw punches are needed only when the selected day
    // is the current IST day. They keep the admin page
    // live while the Attendance summary row is being built.
    // ----------------------------------------------

    const now =
        new Date();

    const isToday =
        getISTDateString(
            dailyDate
        ) ===
        getISTDateString(
            now
        );

    let todayViews = [];

    if (isToday) {
        const todayStart =
            getStartOfDay(now);

        const todayEnd =
            getEndOfDay(now);


        const todayPunches =
            await prisma.attendancePunch.findMany({
                where: {
                    punchedAt: {
                        gte:
                            todayStart,

                        lte:
                            todayEnd
                    },

                    employeeId: {
                        in: employeeIds
                    }
                },

                include: {
                    employee: {
                        select: {
                            employeeId: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            status: true
                        }
                    }
                },

                orderBy: {
                    punchedAt: "asc"
                }
            });


        todayViews =
            buildTodayAttendanceFromPunches(
                todayPunches,
                now
            );
    }


    const todayViewMap =
        new Map();

    for (
        const todayView
        of todayViews
    ) {
        todayViewMap.set(
            Number(todayView.employeeId),
            todayView
        );
    }


    // ----------------------------------------------
    // Approved leaves overlapping selected date
    // ----------------------------------------------

    const approvedLeaves =
        await prisma.leaveRequest.findMany({
            where: {
                employeeId: {
                    in: employeeIds
                },

                status: "APPROVED"
            },

            select: {
                employeeId: true,
                startDate: true,
                endDate: true,
                approvedStartDate: true,
                approvedEndDate: true
            }
        });


    const selectedDateKey =
        getISTDateString(
            dailyDate
        );


    const leaveMap =
        new Map();


    for (
        const leave
        of approvedLeaves
    ) {
        const effectiveStart =
            leave.approvedStartDate ||
            leave.startDate;

        const effectiveEnd =
            leave.approvedEndDate ||
            leave.endDate;

        if (
            !effectiveStart ||
            !effectiveEnd
        ) {
            continue;
        }


        const startKey =
            getISTDateString(
                effectiveStart
            );

        const endKey =
            getISTDateString(
                effectiveEnd
            );


        if (
            selectedDateKey >= startKey &&
            selectedDateKey <= endKey
        ) {
            leaveMap.set(
                Number(leave.employeeId),
                true
            );
        }
    }


    // ----------------------------------------------
    // Build one daily row per employee
    // ----------------------------------------------

    const dailyRows = [];


    for (
        const employee
        of employees
    ) {
        const id =
            Number(
                employee.employeeId
            );


        const storedRecord =
            attendanceMap.get(id) ||
            null;


        const liveRecord =
            todayViewMap.get(id) ||
            null;


        const baseRecord =
            liveRecord
                ? {
                    ...(storedRecord || {}),
                    ...liveRecord,
                    employee:
                        storedRecord?.employee ||
                        liveRecord?.employee ||
                        employee
                }
                : (
                    storedRecord
                        ? storedRecord
                        : {
                            attendanceId:
                                null,

                            employeeId:
                                employee.employeeId,

                            date:
                                dailyDate,

                            checkInTime:
                                null,

                            checkOutTime:
                                null,

                            totalHours:
                                null,

                            status:
                                null,

                            createdAt:
                                null,

                            updatedAt:
                                null,

                            employee:
                                employee
                        }
                );


        const effectiveStatus =
            getEffectiveAttendanceStatus(
                baseRecord,
                leaveMap,
                id,
                true
            );


        // ------------------------------------------
        // Status filter
        // ------------------------------------------

        if (
            status &&
            effectiveStatus !== status
        ) {
            continue;
        }


        dailyRows.push({
            ...baseRecord,

            employee:
                baseRecord.employee ||
                employee,

            employeeId:
                employee.employeeId,

            date:
                baseRecord.date ||
                dailyDate,

            status:
                effectiveStatus,

            attendanceStatus:
                baseRecord.status ||
                null,

            onLeave:
                effectiveStatus ===
                "ON_LEAVE",

            late:
                effectiveStatus ===
                "LATE"
        });
    }


    // ----------------------------------------------
    // Search/order/pagination
    // ----------------------------------------------

    dailyRows.sort(
        (a, b) =>
            Number(a.employeeId) -
            Number(b.employeeId)
    );


    const total =
        dailyRows.length;


    // Daily roster intentionally returns the complete
    // employee set because AdminAttendance has no
    // pagination controls of its own.
    const pagedDailyRows =
        dailyRows;


    const serializedDailyRows =
        pagedDailyRows.map(
            serializeAttendance
        );


    return {
        data:
            serializedDailyRows,

        pagination: {
            page: 1,
            limit:
                Math.max(
                    total,
                    parsedLimit
                ),
            total,
            totalPages:
                total > 0
                    ? 1
                    : 0,
            hasNextPage: false,
            hasPreviousPage: false
        }
    };
}


// ==============================================
// ORIGINAL HISTORY / DATE-RANGE VIEW
// ==============================================
//
// Preserve the existing historical behavior when no
// daily status view is requested.
// ==============================================

const where = {};


if (
    parsedCompanyId !== null
) {
    where.employee = {
        companyId:
            parsedCompanyId
    };
}


if (
    parsedEmployeeId !== null
) {
    where.employeeId =
        parsedEmployeeId;
}


// ==============================================
// DATE FILTER
// ==============================================

if (date) {
    const selectedDate =
        new Date(
            `${date}T00:00:00`
        );

    if (
        Number.isNaN(
            selectedDate.getTime()
        )
    ) {
        const error = new Error(
            "Invalid date. Use YYYY-MM-DD"
        );

        error.statusCode = 400;
        throw error;
    }

    where.date = {
        gte:
            getISTCalendarDate(
                selectedDate
            ),
        lt:
            getNextISTCalendarDate(
                selectedDate
            )
    };
}
else if (from || to) {
    where.date = {};

    if (from) {
        const fromDate =
            new Date(
                `${from}T00:00:00`
            );

        if (
            Number.isNaN(
                fromDate.getTime()
            )
        ) {
            const error = new Error(
                "Invalid from date. Use YYYY-MM-DD"
            );

            error.statusCode = 400;
            throw error;
        }

        where.date.gte =
            getISTCalendarDate(
                fromDate
            );
    }


    if (to) {
        const toDate =
            new Date(
                `${to}T00:00:00`
            );

        if (
            Number.isNaN(
                toDate.getTime()
            )
        ) {
            const error = new Error(
                "Invalid to date. Use YYYY-MM-DD"
            );

            error.statusCode = 400;
            throw error;
        }

        where.date.lt =
            getNextISTCalendarDate(
                toDate
            );
    }
}


const skip =
    (parsedPage - 1) *
    parsedLimit;


// ==============================================
// LOAD STORED ATTENDANCE
// ==============================================

const attendance =
    await prisma.attendance.findMany({
        where,

        include: {
            employee: {
                select: {
                    employeeId: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    status: true
                }
            }
        }
    });


// ==============================================
// LOAD TODAY'S RAW PUNCHES
// ==============================================
//
// Preserve the existing behavior: when no historical
// date filter is selected, today's raw punches are merged
// into the historical attendance list.
// ==============================================

const now =
    new Date();

const todayStart =
    getStartOfDay(now);

const todayEnd =
    getEndOfDay(now);

const includeToday =
    !date &&
    !from &&
    !to;


const todayPunches =
    includeToday
        ? await prisma.attendancePunch.findMany({
            where: {
                punchedAt: {
                    gte:
                        todayStart,

                    lte:
                        todayEnd
                },

                ...(parsedEmployeeId !== null
                    ? {
                        employeeId:
                            parsedEmployeeId
                    }
                    : {}),

                ...(parsedCompanyId !== null
                    ? {
                        employee: {
                            companyId:
                                parsedCompanyId
                        }
                    }
                    : {})
            },

            include: {
                employee: {
                    select: {
                        employeeId: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        status: true
                    }
                }
            },

            orderBy: {
                punchedAt: "asc"
            }
        })
        : [];


const todayViews =
    buildTodayAttendanceFromPunches(
        todayPunches,
        now
    );


// ==============================================
// MERGE TODAY'S RAW DATA INTO ATTENDANCE DATA
// ==============================================

const merged =
    new Map();


for (
    const record
    of attendance
) {
    const key =
        `${record.employeeId}|${getISTDateString(
            record.date
        )}`;

    merged.set(
        key,
        record
    );
}


for (
    const todayView
    of todayViews
) {
    const key =
        `${todayView.employeeId}|${getISTDateString(
            todayView.date
        )}`;

    const existing =
        merged.get(key);


    if (existing) {

        if (
            existing.manualOverride === true
        ) {
            merged.set(
                key,
                {
                    ...existing,

                    employee:
                        existing.employee ||
                        todayView.employee
                }
            );
        }
        else {
            merged.set(
                key,
                {
                    ...existing,

                    checkInTime:
                        todayView.checkInTime,

                    checkOutTime:
                        todayView.checkOutTime,

                    totalHours:
                        todayView.totalHours,

                    status:
                        "PRESENT",

                    resolutionSource:
                        todayView.resolutionSource,

                    manualOverride:
                        false,

                    manualOverrideAt:
                        null,

                    manualOverrideBy:
                        null,

                    employee:
                        existing.employee ||
                        todayView.employee
                }
            );
        }
    }
    else {
        // Defensive fallback: a raw IN punch must be visible
        // even when its summary Attendance row has not been created.
        merged.set(
            key,
            {
                attendanceId:
                    null,

                employeeId:
                    todayView.employeeId,

                date:
                    todayView.date,

                checkInTime:
                    todayView.checkInTime,

                checkOutTime:
                    todayView.checkOutTime,

                totalHours:
                    todayView.totalHours,

                status:
                    "PRESENT",

                resolutionSource:
                    todayView.resolutionSource,

                manualOverride:
                    false,

                manualOverrideAt:
                    null,

                manualOverrideBy:
                    null,

                createdAt:
                    now,

                updatedAt:
                    now,

                employee:
                    todayView.employee
            }
        );
    }
}


// ==============================================
// ======================================================
// DETECT HISTORICAL OPEN SESSIONS FROM RAW PUNCHES
// ======================================================
//
// IMPORTANT:
// Checking only Attendance.checkOutTime is insufficient.
// Example:
//
//   01:34 IN
//   17:46 OUT
//   18:10 IN
//
// The stored Attendance row still has checkOutTime=17:46,
// but the final raw punch is IN, so the historical day still
// needs administrator settlement.
//
// After settlement, Attendance.checkOutTime is replaced with
// the administrator-provided settlement time. If that time is
// different from the last real OUT punch, the historical session
// is considered settled.
// ======================================================

const mergedRecords =
    Array.from(merged.values());

const historicalRecordsForPunchCheck =
    mergedRecords.filter((record) => {
        if (!record?.date) {
            return false;
        }

        return (
            getISTDateString(record.date) <
            getISTDateString(now)
        );
    });

const punchStateMap = new Map();

if (
    historicalRecordsForPunchCheck.length > 0
) {
    const historicalEmployeeIds =
        Array.from(
            new Set(
                historicalRecordsForPunchCheck.map(
                    (record) =>
                        Number(record.employeeId)
                )
            )
        ).filter(
            (employeeId) =>
                Number.isInteger(employeeId) &&
                employeeId > 0
        );

    const sortedHistoricalDates =
        historicalRecordsForPunchCheck
            .map((record) =>
                record.date instanceof Date
                    ? record.date
                    : new Date(record.date)
            )
            .filter(
                (dateValue) =>
                    !Number.isNaN(
                        dateValue.getTime()
                    )
            )
            .sort(
                (a, b) =>
                    a.getTime() -
                    b.getTime()
            );

    if (
        historicalEmployeeIds.length > 0 &&
        sortedHistoricalDates.length > 0
    ) {
        const punchStart =
            getStartOfDay(
                sortedHistoricalDates[0]
            );

        const punchEnd =
            getEndOfDay(
                sortedHistoricalDates[
                    sortedHistoricalDates.length - 1
                ]
            );

        const historicalPunches =
            await prisma.attendancePunch.findMany({
                where: {
                    employeeId: {
                        in: historicalEmployeeIds
                    },

                    punchedAt: {
                        gte: punchStart,
                        lte: punchEnd
                    }
                },

                orderBy: {
                    punchedAt: "asc"
                }
            });

        const groupedPunches = new Map();

        for (const punch of historicalPunches) {
            const key =
                `${punch.employeeId}|${getISTDateString(
                    punch.punchedAt
                )}`;

            if (!groupedPunches.has(key)) {
                groupedPunches.set(key, []);
            }

            groupedPunches.get(key).push(punch);
        }

        for (const [key, punches] of groupedPunches.entries()) {
            punchStateMap.set(
                key,
                calculatePunchSessionState(punches)
            );
        }
    }
}

// CALCULATE LATE STATUS FOR EXISTING RECORDS
// ==============================================
//
// Historical rows do not get synthesized absent/leave
// rows here. They retain their existing list behavior.
// LATE is still derived from check-in time.
// ==============================================

const historicalAttendance =
    mergedRecords.map(
        (record) => {
            const key =
                `${record.employeeId}|${getISTDateString(
                    record.date
                )}`;

            const punchState =
                punchStateMap.get(key);

            const rawOpenSession =
                punchState?.hasOpenSession === true;

            const storedCheckout =
                formatTimeValue(
                    record.checkOutTime
                );

            const lastRawOut =
                punchState?.lastOut
                    ? formatTimeValue(
                        createMySQLTimeFromIST(
                            punchState.lastOut
                        )
                    )
                    : null;

            // A historical day is pending settlement only when the
            // raw punches still end with IN and the Attendance row has
            // not already been replaced with an administrator settlement.
            //
            // Cases:
            //   IN -> OUT -> IN, stored checkout = last real OUT
            //       => still pending
            //
            //   IN -> OUT -> IN, stored checkout = admin settlement
            //       => already settled
            //
            //   IN only, stored checkout = null
            //       => still pending
            //
            //   IN only, stored checkout = admin settlement
            //       => already settled
            const hasOpenSession =
                rawOpenSession &&
                (
                    storedCheckout === null ||
                    (
                        lastRawOut !== null &&
                        storedCheckout === lastRawOut
                    )
                );

            return {
                ...record,

                hasOpenSession,

                status:
                    record.checkInTime &&
                    timeValueToMinutes(
                        record.checkInTime
                    ) >
                    LATE_AFTER_MINUTES
                        ? "LATE"
                        : (
                            record.status ||
                            "ABSENT"
                        )
            };
        }
    );


// ==============================================
// SORT ALL RECORDS
// ==============================================

historicalAttendance.sort(
    (a, b) => {

        const aTime =
            new Date(
                a.date
            ).getTime();

        const bTime =
            new Date(
                b.date
            ).getTime();


        if (
            aTime !== bTime
        ) {
            return (
                bTime -
                aTime
            );
        }


        return (
            Number(
                a.employeeId
            ) -
            Number(
                b.employeeId
            )
        );
    }
);


const total =
    historicalAttendance.length;


// ==============================================
// PAGINATION
// ==============================================

const pagedAttendance =
    historicalAttendance.slice(
        skip,
        skip + parsedLimit
    );


// ==============================================
// SERIALIZE
// ==============================================

const serializedAttendance =
    pagedAttendance.map(
        serializeAttendance
    );


const totalPages =
    Math.ceil(
        total /
        parsedLimit
    );


return {
    data:
        serializedAttendance,

    pagination: {
        page:
            parsedPage,

        limit:
            parsedLimit,

        total,

        totalPages,

        hasNextPage:
            parsedPage <
            totalPages,

        hasPreviousPage:
            parsedPage >
            1
    }
};

};

// ======================================================
// GET ATTENDANCE PUNCH HISTORY
// ======================================================

const getAttendancePunchHistory = async (
employeeId,
filters = {}
) => {

const id =
    Number(employeeId);

if (
    !Number.isInteger(id) ||
    id < 1
) {
    const error = new Error(
        "Invalid employee ID"
    );

    error.statusCode = 400;

    throw error;
}


const employee =
    await prisma.employee.findUnique({
        where: {
            employeeId: id
        },

        select: {
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true
        }
    });


if (!employee) {
    const error = new Error(
        "Employee not found"
    );

    error.statusCode = 404;

    throw error;
}


const {
    date,
    from,
    to
} = filters;


const where = {
    employeeId: id
};


if (date) {

    const selectedDate =
        new Date(
            `${date}T00:00:00`
        );


    if (
        Number.isNaN(
            selectedDate.getTime()
        )
    ) {
        const error = new Error(
            "Invalid date. Use YYYY-MM-DD"
        );

        error.statusCode = 400;

        throw error;
    }


    where.punchedAt = {
        gte:
            getStartOfDay(
                selectedDate
            ),

        lt:
            getEndOfDay(
                selectedDate
            )
    };
}

else if (
    from ||
    to
) {

    where.punchedAt = {};


    if (from) {

        const fromDate =
            new Date(
                `${from}T00:00:00`
            );


        if (
            Number.isNaN(
                fromDate.getTime()
            )
        ) {
            const error = new Error(
                "Invalid from date. Use YYYY-MM-DD"
            );

            error.statusCode = 400;

            throw error;
        }


        where.punchedAt.gte =
            getStartOfDay(
                fromDate
            );
    }


    if (to) {

        const toDate =
            new Date(
                `${to}T00:00:00`
            );


        if (
            Number.isNaN(
                toDate.getTime()
            )
        ) {
            const error = new Error(
                "Invalid to date. Use YYYY-MM-DD"
            );

            error.statusCode = 400;

            throw error;
        }


        where.punchedAt.lt =
            getEndOfDay(
                toDate
            );
    }
}


const punches =
    await prisma.attendancePunch.findMany({
        where,

        include: {
            device: {
                select: {
                    deviceId: true,
                    deviceCode: true,
                    deviceName: true,
                    branchId: true
                }
            }
        },

        orderBy: {
            punchedAt: "asc"
        }
    });


return {
    employee,

    filters: {
        date:
            date || null,

        from:
            from || null,

        to:
            to || null
    },

    totalPunches:
        punches.length,

    punches:
        punches.map(
            punch => ({
                ...punch,

                punchId:
                    punch.punchId.toString()
            })
        )
};

};

// ======================================================
// ADMIN ATTENDANCE CORRECTION
// ======================================================

const updateAttendance = async (
attendanceId,
data,
adminUser = null
) => {

const id =
    Number(attendanceId);


if (
    !Number.isInteger(id) ||
    id < 1
) {
    const error = new Error(
        "Invalid attendance ID"
    );

    error.statusCode = 400;

    throw error;
}


const existingAttendance =
    await prisma.attendance.findUnique({
        where: {
            attendanceId: id
        },

        include: {
            employee: {
                select: {
                    employeeId: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    status: true
                }
            }
        }
    });


if (!existingAttendance) {
    const error = new Error(
        "Attendance record not found"
    );

    error.statusCode = 404;

    throw error;
}


const {
    checkInTime,
    checkOutTime,
    status
} = data;


if (
    checkInTime === undefined &&
    checkOutTime === undefined &&
    status === undefined
) {
    const error = new Error(
        "At least one attendance field is required"
    );

    error.statusCode = 400;

    throw error;
}


// ======================================================
// HISTORICAL MISSING-CHECKOUT SETTLEMENT
// ======================================================
//
// An administrator may settle a previous day's final open IN.
// We never overwrite or delete raw fingerprint punches.
// Instead, we recalculate the whole day from those punches:
//
//   IN -> OUT -> IN -> admin settlement OUT
//
// Completed sessions remain intact and only the final unmatched
// IN is closed using the administrator's supplied checkout time.
//
// Today's unresolved IN is intentionally NOT settled through this
// path. The employee still has the current day available to punch OUT.
// ======================================================

if (
    checkOutTime !== undefined
) {
    const attendanceDate =
        existingAttendance.date;

    const attendanceDateString =
        getISTDateString(
            attendanceDate
        );

    const todayDateString =
        getISTDateString(
            new Date()
        );

    const isHistoricalDate =
        attendanceDateString <
        todayDateString;

    if (isHistoricalDate) {
        const settlementTime =
            parseTime(
                checkOutTime,
                "checkOutTime"
            );

        const dayStart =
            getStartOfDay(
                attendanceDate
            );

        const dayEnd =
            getEndOfDay(
                attendanceDate
            );

        const rawPunches =
            await prisma.attendancePunch.findMany({
                where: {
                    employeeId:
                        existingAttendance.employeeId,

                    punchedAt: {
                        gte: dayStart,
                        lte: dayEnd
                    }
                },

                orderBy: {
                    punchedAt: "asc"
                }
            });

        const punchState =
            calculatePunchSessionState(
                rawPunches
            );

        if (punchState.hasOpenSession) {
            const storedCheckout =
                formatTimeValue(
                    existingAttendance.checkOutTime
                );

            const lastRawOut =
                punchState.lastOut
                    ? formatTimeValue(
                        createMySQLTimeFromIST(
                            punchState.lastOut
                        )
                    )
                    : null;

            // If the raw punches still end with IN but the stored checkout
            // is already different from the last real OUT, the day has
            // already been settled by an administrator. Do not settle it
            // a second time.
            const alreadySettled =
                storedCheckout !== null &&
                (
                    lastRawOut === null ||
                    storedCheckout !== lastRawOut
                );

            if (alreadySettled) {
                const error = new Error(
                    "This historical attendance has already been settled."
                );

                error.statusCode = 409;

                throw error;
            }

            const settlementInstant =
                combineAttendanceDateAndTime(
                    attendanceDate,
                    settlementTime
                );

            if (
                !settlementInstant
            ) {
                const error = new Error(
                    "Invalid settlement checkout time"
                );

                error.statusCode = 400;

                throw error;
            }

            // Historical settlement closes the final unmatched IN on the
            // SAME attendance date. Never add 24 hours implicitly here.
            // The admin must enter a checkout time later than that final IN.
            if (
                settlementInstant.getTime() <=
                punchState.openIn.getTime()
            ) {
                const error = new Error(
                    "Settlement checkout time must be later than the final unmatched IN time on the same attendance date."
                );

                error.statusCode = 400;

                throw error;
            }

            const finalSessionMilliseconds =
                settlementInstant.getTime() -
                punchState.openIn.getTime();

            if (
                finalSessionMilliseconds <= 0
            ) {
                const error = new Error(
                    "Settlement checkout time must be after the final unmatched IN time"
                );

                error.statusCode = 400;

                throw error;
            }

            const finalSessionHours =
                finalSessionMilliseconds /
                (1000 * 60 * 60);

            const totalHours =
                Number(
                    (
                        punchState.completedHours +
                        finalSessionHours
                    ).toFixed(2)
                );

            const totalHoursFormatted =
                formatDuration(
                    totalHours
                );

            const updatedAttendance =
                await prisma.attendance.update({
                    where: {
                        attendanceId: id
                    },

                    data: {
                        checkOutTime:
                            settlementTime,

                        totalHours,

                        status:
                            status !== undefined
                                ? status
                                : "PRESENT",

                        resolutionSource:
                            "ADMIN",

                        manualOverride:
                            true,

                        manualOverrideAt:
                            new Date(),

                        manualOverrideBy:
                            getAdminIdFromUser(
                                adminUser
                            )
                    },

                    include: {
                        employee: {
                            select: {
                                employeeId: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                status: true
                            }
                        }
                    }
                });

            return {
                attendance:
                    serializeAttendance(
                        updatedAttendance
                    ),

                totalHours,

                totalHoursFormatted,

                correctedBy:
                    adminUser?.userId ||
                    adminUser?.id ||
                    null
            };
        }

        // Historical checkout correction is only valid as a settlement
        // when the raw punches currently have an unmatched final IN.
        // Do not let the generic correction path overwrite a settled
        // historical record a second time.
        const error = new Error(
            "This historical attendance does not have an unresolved final IN session to settle."
        );

        error.statusCode = 409;

        throw error;
    }
}


// ======================================================
// NORMAL ATTENDANCE CORRECTION
// ======================================================

const newCheckInTime =
    checkInTime !== undefined
        ? parseTime(
            checkInTime,
            "checkInTime"
        )
        : existingAttendance.checkInTime;


const newCheckOutTime =
    checkOutTime !== undefined
        ? parseTime(
            checkOutTime,
            "checkOutTime"
        )
        : existingAttendance.checkOutTime;


let totalHours = null;
let totalHoursFormatted =
    "0 minutes";


if (
    newCheckInTime &&
    newCheckOutTime
) {
    const checkInMinutes =
        timeValueToMinutes(
            newCheckInTime
        );

    const checkOutMinutes =
        timeValueToMinutes(
            newCheckOutTime
        );

    let durationMinutes =
        checkOutMinutes -
        checkInMinutes;

    if (
        durationMinutes < 0
    ) {
        durationMinutes +=
            24 * 60;
    }

    if (
        durationMinutes > 0
    ) {
        totalHours =
            Number(
                (
                    durationMinutes / 60
                ).toFixed(2)
            );

        totalHoursFormatted =
            formatDuration(
                totalHours
            );
    }
}


const updateData = {};


if (
    checkInTime !== undefined
) {
    updateData.checkInTime =
        newCheckInTime;
}


if (
    checkOutTime !== undefined
) {
    updateData.checkOutTime =
        newCheckOutTime;
}


if (
    checkInTime !== undefined ||
    checkOutTime !== undefined
) {
    updateData.totalHours =
        totalHours;
}


if (
    status !== undefined
) {
    const allowedStatuses = [
        "PRESENT",
        "ABSENT"
    ];

    if (
        !allowedStatuses.includes(
            status
        )
    ) {
        const error = new Error(
            "Invalid attendance status"
        );

        error.statusCode = 400;

        throw error;
    }

    updateData.status =
        status;
}



// ======================================================
// PROTECT EXPLICIT ADMIN CORRECTION
// ======================================================
//
// Any successful manual attendance edit becomes the authoritative
// ERP resolution for that date. Raw biometric punches remain
// unchanged for auditability.
// ======================================================

updateData.resolutionSource =
"ADMIN";

updateData.manualOverride =
true;

updateData.manualOverrideAt =
new Date();

updateData.manualOverrideBy =
getAdminIdFromUser(
adminUser
);


const updatedAttendance =
    await prisma.attendance.update({
        where: {
            attendanceId: id
        },

        data: updateData,

        include: {
            employee: {
                select: {
                    employeeId: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    status: true
                }
            }
        }
    });


return {
    attendance:
        serializeAttendance(
            updatedAttendance
        ),

    totalHours,

    totalHoursFormatted,

    correctedBy:
        adminUser?.userId ||
        adminUser?.id ||
        null
};

};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
processDevicePunch,

processAttendanceBatch,

resolveAttendanceForDate,

getAllAttendance,

getAttendancePaginated,

getAttendancePunchHistory,

getAttendanceById,

getEmployeeAttendance,

getAttendanceSummary,

getEmployeeAttendanceSummary,

updateAttendance

};
