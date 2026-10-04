import {
Fragment,
useEffect,
useMemo,
useState,
} from 'react';

import {
CalendarCheck,
CalendarDays,
Clock3,
ChevronDown,
ChevronRight,
Download,
Pencil,
RefreshCw,
Save,
UserCheck,
UserMinus,
UserX,
XCircle,
} from 'lucide-react';

import {
PageHeader,
DataTable,
} from '@/components/ui/PageComponents';

import { StatusBadge } from '@/components/ui/Badge';

import { FullPageSpinner } from '@/components/ui/Spinner';

import { EmptyState } from '@/components/ui/EmptyState';

import { Modal } from '@/components/ui/Modal';

import { useToast } from '@/context/ToastContext';

import {
SearchInput,
Select,
} from '@/components/ui/Form';

import {
attendanceService,
leaveService,
} from '@/services/apiServices';

// ============================================================
// GET TODAY'S DATE IN IST
// ============================================================

const getISTTodayString = () => {
return new Intl.DateTimeFormat('en-CA', {
timeZone: 'Asia/Kolkata',
year: 'numeric',
month: '2-digit',
day: '2-digit',
}).format(new Date());
};

// ============================================================
// DATE RANGE HELPERS
// ============================================================

const addDaysToDateString = (
dateString,
days,
) => {
if (!dateString) {
return '';
}

const [year, month, day] =
dateString
.split('-')
.map(Number);

const date = new Date(
Date.UTC(
year,
month - 1,
day,
),
);

date.setUTCDate(
date.getUTCDate() + days
);

return `${date.getUTCFullYear()}-${String(
date.getUTCMonth() + 1
).padStart(2, '0')}-${String(
date.getUTCDate()).padStart(2, '0')}`;
};

const getCurrentMonthString = () => {
return getISTTodayString().slice(0, 7);
};

const getMonthRange = (monthValue) => {
if (
!monthValue ||
!/^\d{4}-\d{2}$/.test(monthValue)
) {
const today = getISTTodayString();
return {
from: today,
to: today,
};
}

const [year, month] =
monthValue
.split('-')
.map(Number);

const firstDay =
`${year}-${String(month).padStart(2, '0')}-01`;

const lastDayDate = new Date(
Date.UTC(
year,
month,
0,
),
);

const lastDay =
`${lastDayDate.getUTCFullYear()}-${String(
lastDayDate.getUTCMonth() + 1,
).padStart(2, '0')}-${String(
lastDayDate.getUTCDate(),
).padStart(2, '0')}`;

return {
from: firstDay,
to: lastDay,
};
};

const formatPeriodDate = (dateValue) => {
if (!dateValue) {
return '--';
}

const date = new Date(`${dateValue}T00:00:00`);

if (Number.isNaN(date.getTime())) {
return '--';
}

return date.toLocaleDateString('en-IN', {
day: '2-digit',
month: 'short',
year: 'numeric',
timeZone: 'Asia/Kolkata',
});
};

// ============================================================
// FETCH ALL RANGE ATTENDANCE RECORDS
// ============================================================
//
// A monthly period can contain more than 100 attendance rows.
// The backend is paginated, so the admin page collects all pages
// for range views instead of silently showing only the first page.
// ============================================================

const fetchAttendanceRecords = async (
params,
fetchAllPages,
) => {
const firstResponse =
await attendanceService.list({
...params,
page: 1,
limit: 100,
});

const firstData =
Array.isArray(firstResponse)
? firstResponse
: Array.isArray(firstResponse?.data)
? firstResponse.data
: [];

if (!fetchAllPages) {
return firstData;
}

const pagination =
firstResponse?.pagination || null;

const totalPages =
Number(pagination?.totalPages) || 1;

if (totalPages <= 1) {
return firstData;
}

const allRecords = [
...firstData,
];

for (
let page = 2;
page <= totalPages;
page += 1
) {
const response =
await attendanceService.list({
...params,
page,
limit: 100,
});

const pageData =
Array.isArray(response)
? response
: Array.isArray(response?.data)
? response.data
: [];

allRecords.push(...pageData);
}

return allRecords;
};

// ============================================================
// ADMIN ATTENDANCE
// ============================================================

export function AdminAttendance() {

const [records, setRecords] = useState([]);

const [summaryData, setSummaryData] = useState(null);

const [loading, setLoading] = useState(true);

const [refreshing, setRefreshing] = useState(false);

const [search, setSearch] = useState('');

const [statusFilter, setStatusFilter] = useState('');

const [viewMode, setViewMode] = useState('DAILY');

const [dateFilter, setDateFilter] =
useState(getISTTodayString());

const [monthFilter, setMonthFilter] =
useState(getCurrentMonthString());

const { toast } = useToast();

const [editingRecord, setEditingRecord] = useState(null);
const [checkoutTime, setCheckoutTime] = useState('');
const [savingCorrection, setSavingCorrection] = useState(false);

const [detailModalOpen, setDetailModalOpen] = useState(false);
const [detailLoading, setDetailLoading] = useState(false);
const [detailType, setDetailType] = useState('DAILY_PUNCHES');
const [selectedEmployee, setSelectedEmployee] = useState(null);
const [selectedDayRecord, setSelectedDayRecord] = useState(null);
const [employeePunches, setEmployeePunches] = useState([]);
const [employeeAttendance, setEmployeeAttendance] = useState([]);
const [employeePeriodSummary, setEmployeePeriodSummary] = useState(null);
const [detailDate, setDetailDate] = useState('');
const [expandedDayDate, setExpandedDayDate] = useState(null);
const [expandedDayPunches, setExpandedDayPunches] = useState({});
const [expandedDayLoading, setExpandedDayLoading] = useState(false);

const handleDateFilterChange = (value) => {
const today = getISTTodayString();

if (viewMode === 'MONTHLY') {
const currentMonth = getCurrentMonthString();

setMonthFilter(
value && value <= currentMonth
? value
: currentMonth
);

return;
}

setDateFilter(
value && value <= today
? value
: today
);
};

// ============================================================
// SELECTED PERIOD
// ============================================================

const selectedPeriod = useMemo(() => {
if (viewMode === 'DAILY') {
const selectedDate =
dateFilter || getISTTodayString();

return {
from: selectedDate,
to: selectedDate,
label: formatPeriodDate(selectedDate),
};
}

if (viewMode === 'LAST_7_DAYS') {
const endDate =
dateFilter || getISTTodayString();
const startDate =
addDaysToDateString(endDate, -6);

return {
from: startDate,
to: endDate,
label: `${formatPeriodDate(startDate)} – ${formatPeriodDate(endDate)}`,
};
}

const range =
getMonthRange(monthFilter || getCurrentMonthString());

const monthLabel = (() => {
const date = new Date(`${range.from}T00:00:00`);

if (Number.isNaN(date.getTime())) {
return `${formatPeriodDate(range.from)} – ${formatPeriodDate(range.to)}`;
}

return date.toLocaleDateString('en-IN', {
month: 'long',
year: 'numeric',
timeZone: 'Asia/Kolkata',
});
})();

return {
from: range.from,
to: range.to,
label: monthLabel,
};
}, [
viewMode,
dateFilter,
monthFilter,
]);

const isRangeView =
viewMode !== 'DAILY';

// ============================================================
// FORMAT DATE
// ============================================================

const formatDate = (dateValue) => {
if (!dateValue) {
return '--';
}

// Backend format: YYYY-MM-DD.
if (
typeof dateValue === 'string' &&
/^\d{4}-\d{2}-\d{2}$/.test(dateValue)
) {
const [year, month, day] = dateValue.split('-');
return `${day}/${month}/${year}`;
}

const date = new Date(dateValue);

if (Number.isNaN(date.getTime())) {
return '--';
}

return date.toLocaleDateString('en-GB', {
day: '2-digit',
month: '2-digit',
year: 'numeric',
});
};

// ============================================================
// FORMAT TIME
// ============================================================

const formatTime = (timeValue) => {
if (!timeValue) {
return '--';
}

if (
typeof timeValue === 'string' &&
/^\d{2}:\d{2}(:\d{2})?$/.test(timeValue)
) {
const [hours, minutes] = timeValue
.split(':')
.map(Number);

if (
Number.isNaN(hours) ||
Number.isNaN(minutes)
) {
return '--';
}

const date = new Date();
date.setHours(hours, minutes, 0, 0);

return date.toLocaleTimeString('en-IN', {
hour: '2-digit',
minute: '2-digit',
hour12: true,
});
}

const date = new Date(timeValue);

if (Number.isNaN(date.getTime())) {
return '--';
}

return date.toLocaleTimeString('en-IN', {
hour: '2-digit',
minute: '2-digit',
hour12: true,
});
};

// ============================================================
// DATE FILTER VALUE
// ============================================================

const getDateForFilter = (dateValue) => {
if (!dateValue) {
return '';
}

if (
typeof dateValue === 'string' &&
/^\d{4}-\d{2}-\d{2}$/.test(dateValue)
) {
return dateValue;
}

const date = new Date(dateValue);

if (Number.isNaN(date.getTime())) {
return '';
}

const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');

return `${year}-${month}-${day}`;
};

// ============================================================
// FORMAT HOURS
// ============================================================

const formatHours = (hoursValue) => {
const hours = Number(hoursValue);

if (!Number.isFinite(hours) || hours <= 0) {
return '--';
}

return `${hours.toFixed(2)}h`;
};

// ============================================================
// ATTENDANCE CORRECTION WINDOW
// ============================================================
//
// AUTO_CLOSE attendance can be corrected for three calendar days:
// attendance date + the next two calendar days.
//
// Example:
// 03/10/2026 -> editable on 03/10, 04/10 and 05/10
// 06/10/2026 -> locked
//
// Historical open sessions use the same correction window.
// The backend remains the final authority for the correction.
// ============================================================

const getCorrectionWindow = (record) => {
const recordDate =
getDateForFilter(record?.date);

const todayDate =
getISTTodayString();

if (!recordDate) {
return {
recordDate: '',
lastEditableDate: '',
lockDate: '',
withinWindow: false,
canCorrect: false,
locked: false,
};
}

const lockDate =
addDaysToDateString(recordDate, 3);

const lastEditableDate =
addDaysToDateString(recordDate, 2);

const withinWindow =
todayDate >= recordDate &&
todayDate < lockDate;

const isAutoClose =
record?.resolutionSource === 'AUTO_CLOSE' &&
record?.manualOverride !== true;

const isHistoricalOpenSession =
recordDate < todayDate &&
record?.hasOpenSession === true;

const isCorrectionRecord =
isAutoClose ||
isHistoricalOpenSession;

return {
recordDate,
lastEditableDate,
lockDate,
withinWindow,
canCorrect:
withinWindow &&
isCorrectionRecord,
locked:
isCorrectionRecord &&
!withinWindow,
isAutoClose,
isHistoricalOpenSession,
};
};

const canCorrectAttendance = (record) => {
return getCorrectionWindow(record).canCorrect === true;
};

// ============================================================
// ATTENDANCE CORRECTION
// ============================================================

const openCheckoutCorrection = (record) => {
const correction =
getCorrectionWindow(record);

if (!correction.canCorrect) {
toast(
correction.locked
? `This attendance is locked after ${formatPeriodDate(
correction.lastEditableDate,
)}.`
: 'This attendance record cannot be corrected.',
'error',
);
return;
}

setEditingRecord(record);

setCheckoutTime(
record?.checkOutTime
? String(record.checkOutTime).slice(0, 5)
: ''
);
};

const closeCheckoutCorrection = () => {
setEditingRecord(null);
setCheckoutTime('');
};

const saveCheckoutCorrection = async () => {
if (!editingRecord?.attendanceId) {
return;
}

if (!/^\d{2}:\d{2}$/.test(checkoutTime)) {
toast(
'Please enter a valid checkout time.',
'error'
);
return;
}

try {
setSavingCorrection(true);

await attendanceService.update(
editingRecord.attendanceId,
{
checkOutTime: `${checkoutTime}:00`,
}
);

toast(
editingRecord?.resolutionSource === 'AUTO_CLOSE'
? 'Attendance checkout corrected successfully.'
: 'Attendance hours settled successfully.',
'success'
);

closeCheckoutCorrection();
await loadAttendance(false, false);
} catch (error) {
console.error(
'Failed to correct checkout:',
error
);

toast(
error?.response?.data?.message ||
error?.message ||
'Failed to correct checkout time.',
'error'
);
} finally {
setSavingCorrection(false);
}
};

// ============================================================
// EMPLOYEE DETAIL HELPERS
// ============================================================

const closeEmployeeDetails = () => {
setDetailModalOpen(false);
setDetailLoading(false);
setDetailType('DAILY_PUNCHES');
setSelectedEmployee(null);
setSelectedDayRecord(null);
setDetailDate('');
setEmployeePunches([]);
setEmployeeAttendance([]);
setEmployeePeriodSummary(null);
setExpandedDayDate(null);
setExpandedDayPunches({});
setExpandedDayLoading(false);
setDetailDate('');
};

const normalizeEmployee = (employeeValue, fallbackRecord = null) => {
const employee = employeeValue || fallbackRecord || {};

const employeeId =
employee.employeeId ??
fallbackRecord?.employeeId ??
null;

const firstName =
employee.firstName ||
fallbackRecord?.employee?.firstName ||
'';

const lastName =
employee.lastName ||
fallbackRecord?.employee?.lastName ||
'';

return {
employeeId,
firstName,
lastName,
name:
`${firstName} ${lastName}`.trim() ||
employee.name ||
employee.employeeName ||
`Employee ${employeeId ?? ''}`.trim(),
email:
employee.email ||
fallbackRecord?.employeeEmail ||
'',
status:
employee.status ||
fallbackRecord?.employeeStatus ||
'',
};
};

const extractResponseData = (response) => {
if (!response) {
return null;
}

if (response.data !== undefined) {
return response.data;
}

return response;
};

const normalizePunches = (response) => {
const data = extractResponseData(response);

if (Array.isArray(data)) {
return data;
}

if (Array.isArray(data?.punches)) {
return data.punches;
}

return [];
};

const normalizeEmployeeAttendance = (response) => {
const data = extractResponseData(response);

if (Array.isArray(data)) {
return data;
}

return [];
};

const calculateDisplayStatus = (record) => {
if (!record) {
return 'ABSENT';
}

if (record.status === 'UPCOMING') {
return 'UPCOMING';
}

if (record.status === 'ON_LEAVE') {
return 'ON_LEAVE';
}

if (record.status === 'ABSENT') {
return 'ABSENT';
}

if (record.checkInTime) {
const match = String(record.checkInTime).match(
/^(\d{1,2}):(\d{2})/
);

if (match) {
const minutes =
Number(match[1]) * 60 +
Number(match[2]);

if (minutes > 9 * 60) {
return 'LATE';
}
}

return 'PRESENT';
}

return record.status || 'ABSENT';
};

// ============================================================
// BUILD COMPLETE EMPLOYEE PERIOD CALENDAR
// ============================================================
//
// Range detail must show every calendar date, not only dates that
// already have an Attendance row. Approved leave dates are marked
// ON_LEAVE. Past/current dates without attendance or leave are
// marked ABSENT. Future dates remain UPCOMING instead of being
// incorrectly treated as absent.
// ============================================================

const getEffectiveLeaveRange = (leave) => {
const start =
leave?.status === 'APPROVED' && leave?.approvedStartDate
? getDateForFilter(leave.approvedStartDate)
: getDateForFilter(leave?.startDate);

const end =
leave?.status === 'APPROVED' && leave?.approvedEndDate
? getDateForFilter(leave.approvedEndDate)
: getDateForFilter(leave?.endDate);

return {
start,
end,
};
};

const getLeaveTypeName = (leave) => {
return (
leave?.leaveType?.name ||
leave?.leaveType?.leaveTypeName ||
leave?.leaveType?.code ||
leave?.leaveTypeName ||
'Leave'
);
};

const isDateInsideRange = (dateKey, start, end) => {
return Boolean(
dateKey &&
start &&
end &&
dateKey >= start &&
dateKey <= end
);
};

const buildEmployeePeriodRows = (
attendanceRows,
leaveRows,
fromDate,
toDate,
employeeId,
) => {
const attendanceMap = new Map();

for (const row of attendanceRows || []) {
const dateKey = getDateForFilter(row?.date);

if (dateKey) {
attendanceMap.set(dateKey, row);
}
}

const approvedLeaves = (leaveRows || []).filter(
(leave) =>
String(leave?.status || '').toUpperCase() === 'APPROVED'
);

const today = getISTTodayString();
const rows = [];

let currentDate = fromDate;

while (currentDate && currentDate <= toDate) {
const storedAttendance =
attendanceMap.get(currentDate) || null;

const matchingLeave = approvedLeaves.find((leave) => {
const range = getEffectiveLeaveRange(leave);

return isDateInsideRange(
currentDate,
range.start,
range.end,
);
});

let row;

if (matchingLeave) {
row = {
...(storedAttendance || {}),
attendanceId: storedAttendance?.attendanceId || null,
employeeId: storedAttendance?.employeeId ?? employeeId,
date: currentDate,
status: 'ON_LEAVE',
attendanceStatus: 'ON_LEAVE',
onLeave: true,
leaveTypeName: getLeaveTypeName(matchingLeave),
};
} else if (storedAttendance) {
row = {
...storedAttendance,
date: currentDate,
status: calculateDisplayStatus(storedAttendance),
onLeave: false,
};
} else if (currentDate > today) {
row = {
attendanceId: null,
employeeId,
date: currentDate,
checkInTime: null,
checkOutTime: null,
totalHours: null,
hasOpenSession: false,
status: 'UPCOMING',
attendanceStatus: 'UPCOMING',
onLeave: false,
late: false,
resolutionSource: null,
manualOverride: false,
};
} else {
row = {
attendanceId: null,
employeeId,
date: currentDate,
checkInTime: null,
checkOutTime: null,
totalHours: null,
hasOpenSession: false,
status: 'ABSENT',
attendanceStatus: 'ABSENT',
onLeave: false,
late: false,
resolutionSource: null,
manualOverride: false,
};
}

rows.push(row);
currentDate = addDaysToDateString(currentDate, 1);
}

return rows;
};

const openDailyEmployeeDetails = async (record) => {
if (!record?.employeeId) {
return;
}

const employee = normalizeEmployee(
{
employeeId: record.employeeId,
firstName: record.employeeName?.split(' ')?.[0] || '',
lastName: record.employeeName?.split(' ')?.slice(1).join(' ') || '',
email: record.employeeEmail,
status: record.employeeStatus,
},
record,
);

setDetailType('DAILY_PUNCHES');
setSelectedEmployee(employee);
setSelectedDayRecord(record);
setDetailDate(getDateForFilter(record.date) || selectedPeriod.from);
setEmployeePunches([]);
setEmployeeAttendance([]);
setEmployeePeriodSummary(null);
setExpandedDayDate(null);
setExpandedDayPunches({});
setExpandedDayLoading(false);
setDetailModalOpen(true);
setDetailLoading(true);

try {
const response = await attendanceService.employeePunches(
record.employeeId,
{
date: getDateForFilter(record.date) || selectedPeriod.from,
},
);

setEmployeePunches(
normalizePunches(response),
);
} catch (error) {
console.error(
'Failed to load employee punch history:',
error,
);

toast(
error?.response?.data?.message ||
error?.message ||
'Failed to load employee punch history.',
'error',
);
} finally {
setDetailLoading(false);
}
};

const openRangeEmployeeDetails = async (employee) => {
if (!employee?.employeeId) {
return;
}

const normalizedEmployee = normalizeEmployee(employee);

setDetailType('RANGE_ATTENDANCE');
setSelectedEmployee(normalizedEmployee);
setSelectedDayRecord(null);
setEmployeePunches([]);
setEmployeeAttendance([]);
setEmployeePeriodSummary(null);
setExpandedDayDate(null);
setExpandedDayPunches({});
setExpandedDayLoading(false);
setDetailModalOpen(true);
setDetailLoading(true);

try {
const params = {
from: selectedPeriod.from,
to: selectedPeriod.to,
};

const [
attendanceResponse,
summaryResponse,
leaveResponse,
] = await Promise.all([
attendanceService.employee(
employee.employeeId,
params,
),
attendanceService.employeeSummary(
employee.employeeId,
params,
),
leaveService.requests({
employeeId: employee.employeeId,
status: 'APPROVED',
}),
]);

const attendanceRows =
normalizeEmployeeAttendance(
attendanceResponse,
);

const leaveData = extractResponseData(leaveResponse);

const periodLeaves =
Array.isArray(leaveData)
? leaveData
: Array.isArray(leaveData?.data)
? leaveData.data
: [];

const completePeriodRows =
buildEmployeePeriodRows(
attendanceRows,
periodLeaves,
selectedPeriod.from,
selectedPeriod.to,
employee.employeeId,
);

setEmployeeAttendance(completePeriodRows);

const presentDays =
completePeriodRows.filter(
(row) =>
row.status === 'PRESENT' ||
row.status === 'LATE'
).length;

const absentDays =
completePeriodRows.filter(
(row) => row.status === 'ABSENT'
).length;

const leaveDays =
completePeriodRows.filter(
(row) => row.status === 'ON_LEAVE'
).length;

const lateDays =
completePeriodRows.filter(
(row) => row.status === 'LATE'
).length;

const checkedInDays =
completePeriodRows.filter(
(row) => Boolean(row.checkInTime)
).length;

const checkedOutDays =
completePeriodRows.filter(
(row) => Boolean(row.checkOutTime)
).length;

const totalHours =
completePeriodRows.reduce(
(total, row) => {
const hours = Number(row.totalHours);
return total + (Number.isFinite(hours) ? hours : 0);
},
0,
);

const averageHours =
presentDays > 0
? totalHours / presentDays
: 0;

setEmployeePeriodSummary({
...(extractResponseData(summaryResponse) || {}),
totalDays: completePeriodRows.length,
calendarDays: completePeriodRows.length,
presentDays,
absentDays,
onLeaveDays: leaveDays,
leaveDays,
lateDays,
checkedInDays,
checkedOutDays,
totalHours,
averageHours,
totalHoursFormatted: totalHours > 0
? `${totalHours.toFixed(2)}h`
: '--',
averageHoursFormatted: averageHours > 0
? `${averageHours.toFixed(2)}h`
: '--',
});
} catch (error) {
console.error(
'Failed to load employee period attendance:',
error,
);

toast(
error?.response?.data?.message ||
error?.message ||
'Failed to load employee attendance for this period.',
'error',
);
} finally {
setDetailLoading(false);
}
};

const togglePeriodDayPunches = async (attendance) => {
const dateKey = getDateForFilter(attendance?.date);

if (!dateKey || !selectedEmployee?.employeeId) {
return;
}

if (expandedDayDate === dateKey) {
setExpandedDayDate(null);
return;
}

setExpandedDayDate(dateKey);

if (
attendance?.status === 'ABSENT' ||
attendance?.status === 'ON_LEAVE' ||
attendance?.status === 'UPCOMING'
) {
setExpandedDayPunches((current) => ({
...current,
[dateKey]: [],
}));
return;
}

const hasCachedPunches =
Object.prototype.hasOwnProperty.call(
expandedDayPunches,
dateKey,
);

if (hasCachedPunches) {
return;
}

setExpandedDayLoading(true);

try {
const response =
await attendanceService.employeePunches(
selectedEmployee.employeeId,
{
date: dateKey,
},
);

setExpandedDayPunches((current) => ({
...current,
[dateKey]: normalizePunches(response),
}));
} catch (error) {
console.error(
'Failed to load daily punch history:',
error,
);

setExpandedDayPunches((current) => ({
...current,
[dateKey]: [],
}));

toast(
error?.response?.data?.message ||
error?.message ||
'Failed to load punch history for this day.',
'error',
);
} finally {
setExpandedDayLoading(false);
}
};

// ============================================================
// LOAD ATTENDANCE + SUMMARY
// ============================================================

const loadAttendance = async (
showRefresh = false,
showPageLoading = false,
) => {
try {
if (showRefresh) {
setRefreshing(true);
}

if (showPageLoading) {
setLoading(true);
}

const periodParams =
viewMode === 'DAILY'
? {
date: selectedPeriod.from,
}
: {
from: selectedPeriod.from,
to: selectedPeriod.to,
};

const listParams = {
...periodParams,
...(viewMode === 'DAILY' && statusFilter
? {
status: statusFilter,
}
: {}),
};

const [
summaryResponse,
attendanceRecords,
] = await Promise.all([
attendanceService.summary(
periodParams
),
fetchAttendanceRecords(
listParams,
isRangeView,
),
]);

const normalizedRecords =
attendanceRecords.map((record) => {
const firstName =
record.employee?.firstName || '';

const lastName =
record.employee?.lastName || '';

const employeeName =
`${firstName} ${lastName}`.trim();

return {
attendanceId:
record.attendanceId,

employeeId:
record.employeeId,

employeeName:
employeeName ||
`Employee ${record.employeeId}`,

employeeEmail:
record.employee?.email || '',

employeeStatus:
record.employee?.status || '',

date:
record.date,

checkInTime:
record.checkInTime || null,

checkOutTime:
record.checkOutTime || null,

totalHours:
record.totalHours !== null &&
record.totalHours !== undefined
? Number(record.totalHours)
: null,

hasOpenSession:
record.hasOpenSession === true,

status:
record.status,

attendanceStatus:
record.attendanceStatus || null,

onLeave:
record.onLeave === true,

late:
record.late === true,

resolutionSource:
record.resolutionSource || null,

manualOverride:
record.manualOverride === true,

createdAt:
record.createdAt,

updatedAt:
record.updatedAt,
};
});

setRecords(
normalizedRecords
);

setSummaryData(
summaryResponse || null
);

} catch (error) {
console.error(
'Failed to fetch attendance summary:',
error
);

if (showPageLoading) {
setRecords([]);
setSummaryData(null);
}

toast(
error?.response?.data?.message ||
error?.message ||
'Failed to load attendance summary.',
'error'
);
} finally {
if (showPageLoading) {
setLoading(false);
}

if (showRefresh) {
setRefreshing(false);
}
}
};

// ============================================================
// INITIAL LOAD + LIVE ATTENDANCE REFRESH
// ============================================================

useEffect(() => {
let mounted = true;

const initialLoad = async () => {
if (!mounted) {
return;
}

await loadAttendance(
false,
true,
);
};

initialLoad();

// Keep the existing live 5-second refresh for Daily view.
// Range summaries are intentionally refreshed manually to avoid
// repeatedly loading a complete week/month from the backend.
let intervalId = null;

if (viewMode === 'DAILY') {
intervalId = setInterval(() => {
if (mounted) {
loadAttendance(
false,
false,
);
}
}, 5000);
}

return () => {
mounted = false;

if (intervalId) {
clearInterval(intervalId);
}
};
}, [
viewMode,
dateFilter,
monthFilter,
statusFilter,
]);

// ============================================================
// RESOLUTION SOURCE DISPLAY
// ============================================================

const getResolutionSourceLabel = (source) => {
switch (source) {
case 'DEVICE':
return 'Device';

case 'AUTO_CLOSE':
return 'Auto Close';

case 'ADMIN':
return 'Admin Override';

default:
return 'Open';
}
};

const getResolutionSourceClass = (source) => {
switch (source) {
case 'DEVICE':
return 'inline-flex items-center rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700';

case 'AUTO_CLOSE':
return 'inline-flex items-center rounded-full bg-warning-50 px-2.5 py-1 text-xs font-semibold text-warning-800';

case 'ADMIN':
return 'inline-flex items-center rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700';

default:
return 'inline-flex items-center rounded-full bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-500';
}
};

// ============================================================
// DISPLAY STATUS
// ============================================================

const getRecordStatus = (record) => {
if (
viewMode === 'DAILY' &&
record?.status
) {
return record.status;
}

if (
record?.status === 'ON_LEAVE'
) {
return 'ON_LEAVE';
}

if (
record?.checkInTime &&
record?.late === true
) {
return 'LATE';
}

if (record?.checkInTime) {
const match =
String(record.checkInTime).match(
/^(\d{1,2}):(\d{2})/
);

if (match) {
const checkInMinutes =
Number(match[1]) * 60 +
Number(match[2]);

if (checkInMinutes > 9 * 60) {
return 'LATE';
}
}

return 'PRESENT';
}

return record?.status || 'ABSENT';
};

// ============================================================
// VIEW MODE CHANGE
// ============================================================

const handleViewModeChange = (mode) => {
setViewMode(mode);

// Status filters are intentionally limited to Daily view because
// the range attendance endpoint returns attendance rows rather than
// a full employee-day roster with leave resolution for every date.
if (mode !== 'DAILY') {
setStatusFilter('');
}

if (
mode !== 'MONTHLY' &&
!dateFilter
) {
setDateFilter(getISTTodayString());
}
};

// ============================================================
// STATUS FILTER CHANGE
// ============================================================

const handleStatusFilterChange = (
value,
) => {
setStatusFilter(value);

if (
value &&
!dateFilter
) {
setDateFilter(getISTTodayString());
}
};

// ============================================================
// FILTER RECORDS
// ============================================================

const filtered = useMemo(() => {
const searchValue =
search.trim().toLowerCase();

return records.filter((record) => {
const matchSearch =
!searchValue ||
record.employeeName
?.toLowerCase()
.includes(searchValue) ||
String(record.employeeId)
.toLowerCase()
.includes(searchValue);

const recordStatus =
getRecordStatus(record);

const matchStatus =
!statusFilter ||
recordStatus === statusFilter;

const matchDate =
viewMode !== 'DAILY' ||
!dateFilter ||
getDateForFilter(record.date) === dateFilter;

return (
matchSearch &&
matchStatus &&
matchDate
);
});
}, [
records,
search,
statusFilter,
viewMode,
dateFilter,
]);

// ============================================================
// FILTER EMPLOYEE SUMMARY
// ============================================================

const filteredEmployeeSummaries = useMemo(() => {
const summaries =
Array.isArray(summaryData?.employeeSummaries)
? summaryData.employeeSummaries
: [];

const searchValue =
search.trim().toLowerCase();

if (!searchValue) {
return summaries;
}

return summaries.filter((employee) => {
const employeeName =
`${employee.firstName || ''} ${employee.lastName || ''}`
.trim()
.toLowerCase();

return (
employeeName.includes(searchValue) ||
String(employee.employeeId)
.toLowerCase()
.includes(searchValue) ||
(employee.email || '')
.toLowerCase()
.includes(searchValue)
);
});
}, [
summaryData,
search,
]);

// ============================================================
// EXPORT CSV
// ============================================================

const handleExport = () => {
if (filtered.length === 0) {
alert(
'No attendance records available to export.'
);
return;
}

const headers = [
'Employee ID',
'Employee Name',
'Email',
'Date',
'Check In',
'Check Out',
'Total Hours',
'Status',
'Resolution Source',
'Manual Override',
];

const rows = filtered.map((record) => [
record.employeeId,
record.employeeName || '',
record.employeeEmail || '',
formatDate(record.date),
formatTime(record.checkInTime),
formatTime(record.checkOutTime),
record.totalHours !== null &&
record.totalHours !== undefined
? Number(record.totalHours).toFixed(2)
: '',
getRecordStatus(record),
getResolutionSourceLabel(
record.resolutionSource,
),
record.manualOverride === true
? 'YES'
: 'NO',
]);

const escapeCsvValue = (value) => {
if (
value === null ||
value === undefined
) {
return '';
}

const stringValue = String(value);

if (
stringValue.includes(',') ||
stringValue.includes('"') ||
stringValue.includes('\n')
) {
return `"${stringValue.replace(/"/g, '""')}"`;
}

return stringValue;
};

const csvContent = [
headers
.map(escapeCsvValue)
.join(','),

...rows.map((row) =>
row
.map(escapeCsvValue)
.join(','),
),
].join('\n');

const blob = new Blob(
['\uFEFF' + csvContent],
{
type: 'text/csv;charset=utf-8;',
},
);

const url = URL.createObjectURL(blob);
const link = document.createElement('a');

link.href = url;

link.download =
`attendance_${selectedPeriod.from}_${selectedPeriod.to}.csv`;

document.body.appendChild(link);
link.click();
document.body.removeChild(link);

URL.revokeObjectURL(url);
};

// ============================================================
// SUMMARY CARD DATA
// ============================================================

const summaryCards = [
{
label: 'Total Employees',
value: summaryData?.totalEmployees ?? '--',
icon: CalendarDays,
},
{
label: 'Present',
value: summaryData?.present ?? '--',
icon: UserCheck,
},
{
label: 'Absent',
value: summaryData?.absent ?? '--',
icon: UserX,
},
{
label: 'Late',
value: summaryData?.late ?? '--',
icon: UserMinus,
},
{
label: 'On Leave',
value: summaryData?.onLeave ?? '--',
icon: CalendarCheck,
},
{
label: 'Total Hours',
value:
summaryData?.totalHoursFormatted ||
(summaryData?.totalHours !== undefined
? formatHours(summaryData.totalHours)
: '--'),
icon: Clock3,
ChevronDown,
ChevronRight,
},
];

// ============================================================
// LOADING
// ============================================================

if (loading) {
return (
<FullPageSpinner
message="Loading attendance..."
/>
);
}

// ============================================================
// UI
// ============================================================

return (
<div>

<PageHeader
 title="Attendance"
 subtitle={`${selectedPeriod.label} · ${filtered.length} detail record${
 filtered.length !== 1 ? 's' : ''
 }`}
 actions={
 <div className="flex items-center gap-2">

<button
 type="button"
 className="btn-secondary"
 onClick={() =>
 loadAttendance(true, false)
 }
 disabled={refreshing}
>
<RefreshCw
 size={18}
 className={
 refreshing
 ? 'animate-spin'
 : ''
 }
/>
Refresh
</button>

<button
 type="button"
 className="btn-secondary"
 onClick={handleExport}
 disabled={filtered.length === 0}
>
<Download size={18} />
Export
</button>

</div>
}
/>

{/* ========================================================
    VIEW MODE
======================================================== */}

<div className="mb-5 rounded-xl border border-navy-100 bg-white p-3 shadow-sm">
<div className="flex flex-wrap items-center gap-2">

{[
{
value: 'DAILY',
label: 'Daily',
},
{
value: 'LAST_7_DAYS',
label: 'Last 7 Days',
},
{
value: 'MONTHLY',
label: 'Monthly',
},
].map((item) => (
<button
 key={item.value}
 type="button"
 onClick={() =>
 handleViewModeChange(item.value)
 }
 className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
 viewMode === item.value
 ? 'bg-navy-900 text-white'
 : 'bg-navy-50 text-navy-600 hover:bg-navy-100'
 }`}
>
{item.label}
</button>
))}

<div className="ml-auto flex flex-wrap items-center gap-2">

{viewMode === 'MONTHLY' ? (
<input
 type="month"
 className="input-field"
 value={monthFilter}
 max={getCurrentMonthString()}
 onChange={(event) =>
 handleDateFilterChange(event.target.value)
 }
/>
) : (
<input
 type="date"
 className="input-field"
 value={dateFilter}
 max={getISTTodayString()}
 onChange={(event) =>
 handleDateFilterChange(event.target.value)
 }
/>
)}

</div>

</div>

<p className="mt-2 px-1 text-xs text-navy-400">
{viewMode === 'DAILY'
? 'Daily attendance for the selected date. The current day remains live and refreshes automatically.'
: viewMode === 'LAST_7_DAYS'
? `Rolling 7-day attendance from ${formatPeriodDate(selectedPeriod.from)} to ${formatPeriodDate(selectedPeriod.to)}.`
: `Monthly attendance for ${selectedPeriod.label}.`}
</p>
</div>

{/* ========================================================
    SUMMARY CARDS
======================================================== */}

<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
{summaryCards.map((card) => {
const Icon = card.icon;

return (
<div
 key={card.label}
 className="rounded-xl border border-navy-100 bg-white p-4 shadow-sm"
>
<div className="flex items-center justify-between gap-3">
<div>
<p className="text-xs font-medium uppercase tracking-wide text-navy-400">
{card.label}
</p>
<p className="mt-2 text-xl font-bold text-navy-900">
{card.value}
</p>
</div>

<div className="rounded-lg bg-navy-50 p-2.5 text-navy-600">
<Icon size={19} />
</div>
</div>
</div>
);
})}
</div>

{/* ========================================================
    PERIOD SUMMARY
======================================================== */}

<div className="mb-6 rounded-xl border border-navy-100 bg-white p-5 shadow-sm">
<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
<div>
<p className="text-xs font-semibold uppercase tracking-wide text-navy-400">
Attendance Summary
</p>
<h2 className="mt-1 text-lg font-semibold text-navy-900">
{selectedPeriod.label}
</h2>
</div>

<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
<div className="rounded-lg bg-navy-50 px-4 py-3">
<p className="text-[11px] uppercase tracking-wide text-navy-400">
Checked In
</p>
<p className="mt-1 text-sm font-semibold text-navy-800">
{summaryData?.checkedIn ?? '--'}
</p>
</div>

<div className="rounded-lg bg-navy-50 px-4 py-3">
<p className="text-[11px] uppercase tracking-wide text-navy-400">
Checked Out
</p>
<p className="mt-1 text-sm font-semibold text-navy-800">
{summaryData?.checkedOut ?? '--'}
</p>
</div>

{viewMode !== 'DAILY' && (
<div className="rounded-lg bg-navy-50 px-4 py-3">
<p className="text-[11px] uppercase tracking-wide text-navy-400">
Calendar Days
</p>
<p className="mt-1 text-sm font-semibold text-navy-800">
{summaryData?.calendarDays ?? '--'}
</p>
</div>
)}

{viewMode !== 'DAILY' && (
<div className="rounded-lg bg-navy-50 px-4 py-3">
<p className="text-[11px] uppercase tracking-wide text-navy-400">
Employee-Days
</p>
<p className="mt-1 text-sm font-semibold text-navy-800">
{summaryData?.totalEmployeeDays ?? '--'}
</p>
</div>
)}
</div>
</div>
</div>

{/* ========================================================
    EMPLOYEE SUMMARY FOR RANGE VIEWS
======================================================== */}

{viewMode !== 'DAILY' && (
<div className="mb-6">
<div className="mb-3 flex items-center justify-between gap-3">
<div>
<p className="text-xs font-semibold uppercase tracking-wide text-navy-400">
Employee Summary
</p>
<h2 className="text-lg font-semibold text-navy-900">
Attendance totals by employee
</h2>
</div>

<p className="text-xs text-navy-400">
{filteredEmployeeSummaries.length} employee{filteredEmployeeSummaries.length !== 1 ? 's' : ''}
</p>
</div>

{filteredEmployeeSummaries.length === 0 ? (
<div className="rounded-xl border border-navy-100 bg-white p-6 text-center text-sm text-navy-500">
No employees match the current search.
</div>
) : (
<div className="overflow-x-auto rounded-xl border border-navy-100 bg-white">
<table className="min-w-full text-sm">
<thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-400">
<tr>
<th className="px-4 py-3">Employee</th>
<th className="px-4 py-3 text-center">Present</th>
<th className="px-4 py-3 text-center">Absent</th>
<th className="px-4 py-3 text-center">Leave</th>
<th className="px-4 py-3 text-center">Late</th>
<th className="px-4 py-3 text-center">Checked Out</th>
<th className="px-4 py-3 text-right">Total Hours</th>
<th className="px-4 py-3 text-right">Avg / Present Day</th>
</tr>
</thead>
<tbody className="divide-y divide-navy-100">
{filteredEmployeeSummaries.map((employee, index) => (
<tr
key={employee.employeeId || `employee-${index}`}
onClick={() => openRangeEmployeeDetails(employee)}
className="cursor-pointer transition-colors hover:bg-navy-50/70 focus-within:bg-navy-50/70"
title="Click anywhere on this employee row to view attendance"
>
<td className="px-4 py-3">
<div className="font-medium text-navy-900">
{`${employee.firstName || ''} ${employee.lastName || ''}`.trim() || `Employee ${employee.employeeId}`}
</div>
{employee.email && (
<div className="mt-1 text-xs text-navy-400">
{employee.email}
</div>
)}
</td>
<td className="px-4 py-3 text-center font-semibold text-navy-700">
{employee.presentDays ?? 0}
</td>
<td className="px-4 py-3 text-center font-semibold text-navy-700">
{employee.absentDays ?? 0}
</td>
<td className="px-4 py-3 text-center font-semibold text-navy-700">
{employee.onLeaveDays ?? 0}
</td>
<td className="px-4 py-3 text-center font-semibold text-navy-700">
{employee.lateDays ?? 0}
</td>
<td className="px-4 py-3 text-center font-semibold text-navy-700">
{employee.checkedOutDays ?? 0}
</td>
<td className="px-4 py-3 text-right font-semibold text-navy-700">
{employee.totalHoursFormatted || formatHours(employee.totalHours)}
</td>
<td className="px-4 py-3 text-right font-semibold text-navy-700">
{employee.averageHoursFormatted || formatHours(employee.averageHours)}
</td>
</tr>
))}
</tbody>
</table>
</div>

)}
</div>
)}

{/* ========================================================
    FILTERS
======================================================== */}

<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">

<SearchInput
 value={search}
 onChange={setSearch}
 placeholder="Search employee..."
/>

<Select
 value={statusFilter}
 onChange={handleStatusFilterChange}
 placeholder="All Statuses"
 disabled={isRangeView}
 options={[
 {
 value: 'PRESENT',
 label: 'Present',
 },
 {
 value: 'ABSENT',
 label: 'Absent',
 },
 {
 value: 'LATE',
 label: 'Late',
 },
 {
 value: 'ON_LEAVE',
 label: 'On Leave',
 },
 ]}
/>

<div className="flex items-center rounded-lg border border-navy-100 bg-navy-50 px-3 text-sm text-navy-500">
<CalendarCheck size={16} className="mr-2 shrink-0" />
<span>
{selectedPeriod.label}
</span>
</div>

</div>

{isRangeView && (
<p className="-mt-3 mb-5 text-xs text-navy-400">
Status filtering is available in Daily view. Range views provide period-wide status counts in the summary above.
</p>
)}

{/* ========================================================
    TABLE / EMPTY STATE
======================================================== */}

{filtered.length === 0 ? (
<EmptyState
 icon={CalendarCheck}
 title="No attendance records"
 message={
 records.length === 0
 ? 'No attendance records are available for this period.'
 : 'No records match your current search or filter.'
 }
/>
) : (
<div className="overflow-x-auto rounded-xl border border-navy-100 bg-white">
<table className="min-w-full text-sm">
<thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-400">
<tr>
<th className="px-4 py-3">Emp ID</th>
<th className="px-4 py-3">Employee</th>
<th className="px-4 py-3">Date</th>
<th className="px-4 py-3 text-center">Check In</th>
<th className="px-4 py-3 text-center">Check Out</th>
<th className="px-4 py-3 text-right">Hours</th>
<th className="px-4 py-3 text-center">Resolution</th>
<th className="px-4 py-3 text-center">Override</th>
<th className="px-4 py-3 text-center">Status</th>
<th className="px-4 py-3 text-center">Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-navy-100">
{filtered.map((record, index) => (
<tr
key={record.attendanceId || `${record.employeeId}-${record.date}-${index}`}
onClick={() =>
viewMode === 'DAILY'
? openDailyEmployeeDetails(record)
: openRangeEmployeeDetails(record)
}
className="cursor-pointer transition-colors hover:bg-navy-50/70"
title={
viewMode === 'DAILY'
? 'Click anywhere to view this employee\'s fingerprint punches'
: 'Click anywhere to view this employee\'s attendance for this period'
}
>
<td className="px-4 py-3 font-mono text-xs font-semibold text-navy-600">
{record.employeeId}
</td>
<td className="px-4 py-3">
<div className="font-medium text-navy-900">
{record.employeeName || '--'}
</div>
{record.employeeEmail && (
<div className="mt-1 text-xs text-navy-400">
{record.employeeEmail}
</div>
)}
</td>
<td className="px-4 py-3 text-navy-600">
{formatDate(record.date)}
</td>
<td className="px-4 py-3 text-center font-mono">
<span className={record.checkInTime ? 'text-navy-700' : 'text-navy-300'}>
{formatTime(record.checkInTime)}
</span>
</td>
<td className="px-4 py-3 text-center font-mono">
<span className={record.checkOutTime ? 'text-navy-700' : 'text-navy-300'}>
{formatTime(record.checkOutTime)}
</span>
</td>
<td className="px-4 py-3 text-right font-semibold text-navy-700">
{formatHours(record.totalHours)}
</td>
<td className="px-4 py-3 text-center">
<div className="flex flex-col items-center gap-1">
<span className={getResolutionSourceClass(record.resolutionSource)}>
{getResolutionSourceLabel(record.resolutionSource)}
</span>
{record.resolutionSource === 'AUTO_CLOSE' && (
<span className="text-[11px] text-warning-700">
Resolved at office close
</span>
)}
</div>
</td>
<td className="px-4 py-3 text-center">
<span className={record.manualOverride ? 'text-xs font-semibold text-accent-700' : 'text-xs text-navy-300'}>
{record.manualOverride ? 'Yes' : 'No'}
</span>
</td>
<td className="px-4 py-3 text-center">
<StatusBadge status={getRecordStatus(record)} />
</td>
<td className="px-4 py-3 text-center" onClick={(event) => event.stopPropagation()}>
{canCorrectAttendance(record) ? (
<button
type="button"
onClick={() => openCheckoutCorrection(record)}
className="inline-flex items-center gap-1.5 rounded-lg border border-warning-300 bg-warning-50 px-3 py-1.5 text-xs font-semibold text-warning-800 hover:bg-warning-100"
title={
record?.resolutionSource === 'AUTO_CLOSE'
? 'Correct automatically closed checkout'
: 'Settle historical missing checkout'
}
>
<Pencil size={14} />
{record?.resolutionSource === 'AUTO_CLOSE'
? 'Edit'
: 'Settle'}
</button>
) : getCorrectionWindow(record).locked ? (
<span
className="inline-flex items-center rounded-lg border border-navy-100 bg-navy-50 px-3 py-1.5 text-xs font-semibold text-navy-400"
title="Attendance correction window has expired"
>
Locked
</span>
) : (
<span className="text-xs text-navy-300">--</span>
)}
</td>
</tr>
))}
</tbody>
</table>
</div>
)}

<Modal
 open={detailModalOpen}
 onClose={closeEmployeeDetails}
 title={
 detailType === 'DAILY_PUNCHES'
 ? 'Employee Punch Details'
 : 'Employee Attendance Details'
 }
 size="lg"
>
<div className="space-y-5">

<div className="rounded-xl border border-navy-100 bg-navy-50 p-4">
<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
<div>
<p className="text-xs font-semibold uppercase tracking-wide text-navy-400">
{detailType === 'DAILY_PUNCHES'
? 'Daily attendance'
: 'Attendance period'}
</p>
<p className="mt-1 text-lg font-semibold text-navy-900">
{selectedEmployee?.name || 'Employee'}
</p>
<p className="mt-1 text-sm text-navy-500">
Employee ID: {selectedEmployee?.employeeId ?? '--'}
{selectedEmployee?.email
? ` · ${selectedEmployee.email}`
: ''}
</p>
</div>

<div className="rounded-lg bg-white px-3 py-2 text-right shadow-sm">
<p className="text-[11px] uppercase tracking-wide text-navy-400">
Period
</p>
<p className="mt-1 text-sm font-semibold text-navy-800">
{detailType === 'DAILY_PUNCHES'
? formatPeriodDate(detailDate || selectedPeriod.from)
: selectedPeriod.label}
</p>
</div>
</div>
</div>

{detailLoading ? (
<div className="flex items-center justify-center rounded-xl border border-navy-100 bg-white p-10">
<div className="text-sm text-navy-500">
Loading employee attendance...
</div>
</div>
) : detailType === 'DAILY_PUNCHES' ? (
<>
<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
<div className="rounded-lg border border-navy-100 bg-white p-3">
<p className="text-[11px] uppercase tracking-wide text-navy-400">Check In</p>
<p className="mt-1 font-semibold text-navy-800">
{formatTime(selectedDayRecord?.checkInTime)}
</p>
</div>
<div className="rounded-lg border border-navy-100 bg-white p-3">
<p className="text-[11px] uppercase tracking-wide text-navy-400">Check Out</p>
<p className="mt-1 font-semibold text-navy-800">
{formatTime(selectedDayRecord?.checkOutTime)}
</p>
</div>
<div className="rounded-lg border border-navy-100 bg-white p-3">
<p className="text-[11px] uppercase tracking-wide text-navy-400">Total Hours</p>
<p className="mt-1 font-semibold text-navy-800">
{formatHours(selectedDayRecord?.totalHours)}
</p>
</div>
<div className="rounded-lg border border-navy-100 bg-white p-3">
<p className="text-[11px] uppercase tracking-wide text-navy-400">Punches</p>
<p className="mt-1 font-semibold text-navy-800">
{employeePunches.length}
</p>
</div>
</div>

<div className="overflow-hidden rounded-xl border border-navy-100 bg-white">
<div className="border-b border-navy-100 px-4 py-3">
<p className="text-sm font-semibold text-navy-900">
Fingerprint Punch History
</p>
<p className="mt-1 text-xs text-navy-400">
Every raw punch recorded for this employee on the selected day.
</p>
</div>

{employeePunches.length === 0 ? (
<div className="p-6 text-center text-sm text-navy-500">
No fingerprint punches were recorded for this employee on this date.
</div>
) : (
<div className="overflow-x-auto">
<table className="min-w-full text-sm">
<thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-400">
<tr>
<th className="px-4 py-3">#</th>
<th className="px-4 py-3">Time</th>
<th className="px-4 py-3">Type</th>
<th className="px-4 py-3">Device</th>
<th className="px-4 py-3">Sensor</th>
<th className="px-4 py-3">Event ID</th>
</tr>
</thead>
<tbody className="divide-y divide-navy-100">
{employeePunches.map((punch, index) => (
<tr key={punch.punchId || `${punch.eventId || 'punch'}-${index}`} className="hover:bg-navy-50/60">
<td className="px-4 py-3 text-navy-400">{index + 1}</td>
<td className="px-4 py-3 font-mono font-semibold text-navy-800">
{formatTime(punch.punchedAt)}
</td>
<td className="px-4 py-3">
<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
punch.punchType === 'IN'
? 'bg-success-50 text-success-700'
: 'bg-warning-50 text-warning-800'
}`}>
{punch.punchType || '--'}
</span>
</td>
<td className="px-4 py-3 text-navy-600">
{punch.device?.deviceName || punch.device?.deviceCode || punch.deviceId || '--'}
</td>
<td className="px-4 py-3 text-navy-600">
{punch.sensorSlot ?? '--'}
</td>
<td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs text-navy-500">
{punch.eventId || '--'}
</td>
</tr>
))}
</tbody>
</table>
</div>
)}
</div>
</>
) : (
<>
<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
<div className="rounded-lg border border-navy-100 bg-white p-3">
<p className="text-[11px] uppercase tracking-wide text-navy-400">Present Days</p>
<p className="mt-1 font-semibold text-navy-800">
{employeePeriodSummary?.presentDays ?? '--'}
</p>
</div>
<div className="rounded-lg border border-navy-100 bg-white p-3">
<p className="text-[11px] uppercase tracking-wide text-navy-400">Absent Days</p>
<p className="mt-1 font-semibold text-navy-800">
{employeePeriodSummary?.absentDays ?? '--'}
</p>
</div>
<div className="rounded-lg border border-navy-100 bg-white p-3">
<p className="text-[11px] uppercase tracking-wide text-navy-400">Total Hours</p>
<p className="mt-1 font-semibold text-navy-800">
{employeePeriodSummary?.totalHoursFormatted || formatHours(employeePeriodSummary?.totalHours)}
</p>
</div>
<div className="rounded-lg border border-navy-100 bg-white p-3">
<p className="text-[11px] uppercase tracking-wide text-navy-400">Avg / Present Day</p>
<p className="mt-1 font-semibold text-navy-800">
{employeePeriodSummary?.averageHoursFormatted || formatHours(employeePeriodSummary?.averageHours)}
</p>
</div>
</div>

<div className="overflow-hidden rounded-xl border border-navy-100 bg-white">
<div className="border-b border-navy-100 px-4 py-3">
<p className="text-sm font-semibold text-navy-900">
Daily Attendance for Selected Period
</p>
<p className="mt-1 text-xs text-navy-400">
{selectedPeriod.label}. Every calendar date is shown. Approved leave is marked Leave, past/current days without attendance are marked Absent, and future dates are marked Upcoming. Click any recorded day to expand its fingerprint punches inline.
</p>
</div>

{employeeAttendance.length === 0 ? (
<div className="p-6 text-center text-sm text-navy-500">
No calendar dates are available for this employee in the selected period.
</div>
) : (
<div className="overflow-x-auto">
<table className="min-w-full text-sm">
<thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-400">
<tr>
<th className="px-4 py-3">Date</th>
<th className="px-4 py-3">Check In</th>
<th className="px-4 py-3">Check Out</th>
<th className="px-4 py-3">Hours</th>
<th className="px-4 py-3">Status</th>
<th className="px-4 py-3">Leave Type</th>
<th className="px-4 py-3">Resolution</th>
<th className="px-4 py-3 text-right">Punches</th>
</tr>
</thead>
<tbody className="divide-y divide-navy-100">
{employeeAttendance.map((attendance, index) => {
const status = calculateDisplayStatus(attendance);
const dateKey = getDateForFilter(attendance.date);
const isExpanded = expandedDayDate === dateKey;
const dayPunches = expandedDayPunches[dateKey] || [];

return (
<Fragment key={attendance.attendanceId || `${attendance.date}-${index}`}>
<tr
onClick={() => togglePeriodDayPunches(attendance)}
className="cursor-pointer transition-colors hover:bg-navy-50/70"
title="Click this day to show or hide fingerprint punches"
>
<td className="px-4 py-3 font-medium text-navy-800">
<div className="inline-flex items-center gap-2">
{isExpanded ? (
<ChevronDown size={15} className="text-navy-500" />
) : (
<ChevronRight size={15} className="text-navy-400" />
)}
<span>{formatDate(attendance.date)}</span>
</div>
</td>
<td className="px-4 py-3 font-mono text-navy-700">
{formatTime(attendance.checkInTime)}
</td>
<td className="px-4 py-3 font-mono text-navy-700">
{formatTime(attendance.checkOutTime)}
</td>
<td className="px-4 py-3 font-semibold text-navy-700">
{formatHours(attendance.totalHours)}
</td>
<td className="px-4 py-3">
{status === 'UPCOMING' ? (
<span className="inline-flex rounded-full bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-500">
Upcoming
</span>
) : (
<StatusBadge status={status} />
)}
</td>
<td className="px-4 py-3">
{attendance.status === 'ON_LEAVE' ? (
<span className="text-xs font-semibold text-warning-700">
{attendance.leaveTypeName || 'Leave'}
</span>
) : (
<span className="text-xs text-navy-300">--</span>
)}
</td>
<td className="px-4 py-3">
<span className={getResolutionSourceClass(attendance.resolutionSource)}>
{getResolutionSourceLabel(attendance.resolutionSource)}
</span>
</td>
<td className="px-4 py-3 text-right text-xs font-semibold text-navy-500">
{isExpanded
? 'Hide punches'
: 'Show punches'}
</td>
</tr>

{isExpanded && (
<tr className="bg-navy-50/60">
<td colSpan={8} className="px-4 py-4">
<div className="rounded-lg border border-navy-100 bg-white">
<div className="flex items-center justify-between gap-3 border-b border-navy-100 px-4 py-3">
<div>
<p className="text-sm font-semibold text-navy-900">
Fingerprint punches for {formatDate(attendance.date)}
</p>
<p className="mt-1 text-xs text-navy-400">
Raw punches are shown here; no separate page or navigation is used.
</p>
</div>
<span className="rounded-full bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-600">
{expandedDayLoading ? 'Loading...' : `${dayPunches.length} punch${dayPunches.length === 1 ? '' : 'es'}`}
</span>
</div>

{expandedDayLoading ? (
<div className="p-5 text-center text-sm text-navy-500">
Loading fingerprint punches...
</div>
) : dayPunches.length === 0 ? (
<div className="p-5 text-center text-sm text-navy-500">
No fingerprint punches were recorded for this day.
</div>
) : (
<div className="overflow-x-auto">
<table className="min-w-full text-sm">
<thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-400">
<tr>
<th className="px-4 py-3">#</th>
<th className="px-4 py-3">Time</th>
<th className="px-4 py-3">Type</th>
<th className="px-4 py-3">Device</th>
<th className="px-4 py-3">Sensor</th>
<th className="px-4 py-3">Event ID</th>
</tr>
</thead>
<tbody className="divide-y divide-navy-100">
{dayPunches.map((punch, punchIndex) => (
<tr key={punch.punchId || `${punch.eventId || 'punch'}-${punchIndex}`} className="hover:bg-navy-50/60">
<td className="px-4 py-3 text-navy-400">{punchIndex + 1}</td>
<td className="px-4 py-3 font-mono font-semibold text-navy-800">
{formatTime(punch.punchedAt)}
</td>
<td className="px-4 py-3">
<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
punch.punchType === 'IN'
? 'bg-success-50 text-success-700'
: 'bg-warning-50 text-warning-800'
}`}>
{punch.punchType || '--'}
</span>
</td>
<td className="px-4 py-3 text-navy-600">
{punch.device?.deviceName || punch.device?.deviceCode || punch.deviceId || '--'}
</td>
<td className="px-4 py-3 text-navy-600">
{punch.sensorSlot ?? '--'}
</td>
<td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs text-navy-500">
{punch.eventId || '--'}
</td>
</tr>
))}
</tbody>
</table>
</div>
)}
</div>
</td>
</tr>
)}
</Fragment>
);
})}
</tbody>
</table>
</div>
)}
</div>
</>
)}

<div className="flex justify-end">
<button
 type="button"
 onClick={closeEmployeeDetails}
 className="btn-secondary"
>
Close
</button>
</div>

</div>
</Modal>

<Modal
 open={Boolean(editingRecord)}
 onClose={closeCheckoutCorrection}
 title={
editingRecord?.resolutionSource === 'AUTO_CLOSE'
? 'Correct Auto-Closed Checkout'
: 'Settle Missing Checkout'
}
 size="sm"
>
<div className="space-y-5">

<div className="rounded-lg bg-warning-50 p-4">
<p className="font-semibold text-warning-900">
{editingRecord?.employeeName || 'Employee'}
</p>
<p className="mt-1 text-sm text-warning-800">
{formatDate(editingRecord?.date)} · Check in {formatTime(editingRecord?.checkInTime)}
</p>

{editingRecord?.resolutionSource && (
<p className="mt-1 text-xs text-warning-700">
Current resolution: {getResolutionSourceLabel(editingRecord.resolutionSource)}
</p>
)}

<p className="mt-2 text-xs text-warning-700">
{editingRecord?.resolutionSource === 'AUTO_CLOSE'
? 'This record was automatically closed at the company office closing time. You can change that checkout time during the three-day correction window.'
: 'Enter the checkout time for the missing final session. The existing checkout shown in this row may belong to an earlier completed IN/OUT session and is not used as the settlement time. Completed sessions are preserved, and the system recalculates the full day from the fingerprint punches.'}
</p>

{editingRecord?.date && (
<p className="mt-2 text-xs text-warning-700">
Editable through{' '}
<strong>
{formatPeriodDate(
getCorrectionWindow(editingRecord).lastEditableDate,
)}
</strong>
</p>
)}
</div>

<div>
<label
htmlFor="attendance-checkout-time"
className="mb-1.5 block text-sm font-medium text-navy-700"
>
Checkout Time
</label>

<input
id="attendance-checkout-time"
type="time"
value={checkoutTime}
onChange={(event) =>
setCheckoutTime(event.target.value)
}
className="input-field w-full"
disabled={savingCorrection}
/>
</div>

<div className="flex justify-end gap-2">
<button
 type="button"
 onClick={closeCheckoutCorrection}
 disabled={savingCorrection}
 className="btn-secondary inline-flex items-center gap-2"
>
<XCircle size={16} />
Cancel
</button>

<button
 type="button"
 onClick={saveCheckoutCorrection}
 disabled={savingCorrection || !checkoutTime}
 className="btn-primary inline-flex items-center gap-2"
>
<Save size={16} />
{savingCorrection
? 'Saving...'
: editingRecord?.resolutionSource === 'AUTO_CLOSE'
? 'Save Correction'
: 'Settle Hours'}
</button>
</div>

</div>
</Modal>

</div>
);
}
