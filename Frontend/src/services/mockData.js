// ============================================================
// MOCK DATA FALLBACK
// When the backend API is unavailable, these provide realistic
// demo data so the UI is fully functional for demonstration.
// ============================================================

export const mockEmployees = [
  { id: 1, employee_id: 'EMP001', name: 'Rajesh Patel', email: 'employee@diamond.com', phone: '+91 98765 43210', department: 'Cutting', branch: 'Surat Main', designation: 'Senior Diamond Cutter', status: 'active', join_date: '2023-01-15', salary: 45000 },
  { id: 2, employee_id: 'EMP002', name: 'Priya Sharma', email: 'priya@diamond.com', phone: '+91 98765 43211', department: 'Polishing', branch: 'Surat Main', designation: 'Polishing Expert', status: 'active', join_date: '2023-03-20', salary: 38000 },
  { id: 3, employee_id: 'EMP003', name: 'Amit Desai', email: 'amit@diamond.com', phone: '+91 98765 43212', department: 'Quality', branch: 'Mumbai Branch', designation: 'Quality Analyst', status: 'active', join_date: '2022-11-05', salary: 52000 },
  { id: 4, employee_id: 'EMP004', name: 'Sneha Mehta', email: 'sneha@diamond.com', phone: '+91 98765 43213', department: 'Design', branch: 'Mumbai Branch', designation: 'Jewelry Designer', status: 'on_leave', join_date: '2023-06-10', salary: 41000 },
  { id: 5, employee_id: 'EMP005', name: 'Vikram Singh', email: 'vikram@diamond.com', phone: '+91 98765 43214', department: 'Cutting', branch: 'Surat Main', designation: 'Diamond Cutter', status: 'active', join_date: '2023-08-01', salary: 35000 },
  { id: 6, employee_id: 'EMP006', name: 'Anjali Joshi', email: 'anjali@diamond.com', phone: '+91 98765 43215', department: 'Administration', branch: 'Surat Main', designation: 'HR Manager', status: 'active', join_date: '2022-05-15', salary: 55000 },
  { id: 7, employee_id: 'EMP007', name: 'Karan Malhotra', email: 'karan@diamond.com', phone: '+91 98765 43216', department: 'Sales', branch: 'Mumbai Branch', designation: 'Sales Executive', status: 'active', join_date: '2023-04-20', salary: 40000 },
  { id: 8, employee_id: 'EMP008', name: 'Deepika Rao', email: 'deepika@diamond.com', phone: '+91 98765 43217', department: 'Polishing', branch: 'Surat Main', designation: 'Junior Polisher', status: 'inactive', join_date: '2023-09-10', salary: 28000 },
];

export const mockAttendance = [
  { id: 1, employee_name: 'Rajesh Patel', employee_id: 'EMP001', date: '2026-09-03', check_in: '09:02', check_out: '18:05', status: 'present', work_hours: 9.0 },
  { id: 2, employee_name: 'Priya Sharma', employee_id: 'EMP002', date: '2026-09-03', check_in: '09:15', check_out: '18:10', status: 'late', work_hours: 8.9 },
  { id: 3, employee_name: 'Amit Desai', employee_id: 'EMP003', date: '2026-09-03', check_in: '08:55', check_out: '18:00', status: 'present', work_hours: 9.1 },
  { id: 4, employee_name: 'Sneha Mehta', employee_id: 'EMP004', date: '2026-09-03', check_in: null, check_out: null, status: 'on_leave', work_hours: 0 },
  { id: 5, employee_name: 'Vikram Singh', employee_id: 'EMP005', date: '2026-09-03', check_in: '09:00', check_out: '18:05', status: 'present', work_hours: 9.0 },
  { id: 6, employee_name: 'Karan Malhotra', employee_id: 'EMP007', date: '2026-09-03', check_in: null, check_out: null, status: 'absent', work_hours: 0 },
  { id: 7, employee_name: 'Anjali Joshi', employee_id: 'EMP006', date: '2026-09-03', check_in: '08:50', check_out: '18:15', status: 'present', work_hours: 9.4 },
];

export const mockLeaves = [
  { id: 1, employee_name: 'Sneha Mehta', employee_id: 'EMP004', leave_type: 'Casual Leave', start_date: '2026-09-03', end_date: '2026-09-05', days: 3, reason: 'Family function', status: 'approved', applied_on: '2026-08-28' },
  { id: 2, employee_name: 'Vikram Singh', employee_id: 'EMP005', leave_type: 'Sick Leave', start_date: '2026-09-06', end_date: '2026-09-07', days: 2, reason: 'Fever and cold', status: 'pending', applied_on: '2026-09-01' },
  { id: 3, employee_name: 'Karan Malhotra', employee_id: 'EMP007', leave_type: 'Earned Leave', start_date: '2026-09-10', end_date: '2026-09-15', days: 6, reason: 'Vacation trip', status: 'pending', applied_on: '2026-09-02' },
  { id: 4, employee_name: 'Rajesh Patel', employee_id: 'EMP001', leave_type: 'Casual Leave', start_date: '2026-08-20', end_date: '2026-08-21', days: 2, reason: 'Personal work', status: 'rejected', applied_on: '2026-08-15' },
];

export const mockAdvances = [
  { id: 1, employee_name: 'Rajesh Patel', employee_id: 'EMP001', amount: 10000, reason: 'Medical emergency', status: 'approved', request_date: '2026-08-25', approved_date: '2026-08-26', monthly_deduction: 2000 },
  { id: 2, employee_name: 'Vikram Singh', employee_id: 'EMP005', amount: 5000, reason: 'School fees', status: 'pending', request_date: '2026-09-01', approved_date: null, monthly_deduction: 1000 },
  { id: 3, employee_name: 'Priya Sharma', employee_id: 'EMP002', amount: 15000, reason: 'Home repair', status: 'pending', request_date: '2026-09-02', approved_date: null, monthly_deduction: 3000 },
  { id: 4, employee_name: 'Karan Malhotra', employee_id: 'EMP007', amount: 8000, reason: 'Vehicle repair', status: 'approved', request_date: '2026-08-15', approved_date: '2026-08-16', monthly_deduction: 2000 },
  { id: 5, employee_name: 'Amit Desai', employee_id: 'EMP003', amount: 20000, reason: 'Family wedding', status: 'rejected', request_date: '2026-08-10', approved_date: null, monthly_deduction: 4000 },
];

export const mockPayroll = [
  { id: 1, employee_name: 'Rajesh Patel', employee_id: 'EMP001', month: 'August 2026', basic_salary: 45000, hra: 9000, allowances: 5000, deductions: 2000, net_salary: 57000, status: 'paid' },
  { id: 2, employee_name: 'Priya Sharma', employee_id: 'EMP002', month: 'August 2026', basic_salary: 38000, hra: 7600, allowances: 4000, deductions: 1000, net_salary: 48600, status: 'paid' },
  { id: 3, employee_name: 'Amit Desai', employee_id: 'EMP003', month: 'August 2026', basic_salary: 52000, hra: 10400, allowances: 6000, deductions: 2500, net_salary: 65900, status: 'paid' },
  { id: 4, employee_name: 'Sneha Mehta', employee_id: 'EMP004', month: 'August 2026', basic_salary: 41000, hra: 8200, allowances: 4500, deductions: 1500, net_salary: 52200, status: 'paid' },
  { id: 5, employee_name: 'Vikram Singh', employee_id: 'EMP005', month: 'September 2026', basic_salary: 35000, hra: 7000, allowances: 3500, deductions: 1000, net_salary: 44500, status: 'unpaid' },
  { id: 6, employee_name: 'Anjali Joshi', employee_id: 'EMP006', month: 'September 2026', basic_salary: 55000, hra: 11000, allowances: 6500, deductions: 3000, net_salary: 69500, status: 'unpaid' },
];

export const mockDashboard = {
  total_employees: 8,
  present_today: 5,
  absent_today: 1,
  on_leave_today: 1,
  late_today: 1,
  pending_leaves: 2,
  pending_advances: 2,
  monthly_payroll: 312400,
  attendance_rate: 87.5,
  recent_activities: [
    { type: 'attendance', message: 'Rajesh Patel checked in at 09:02 AM', time: '2 hours ago' },
    { type: 'leave', message: 'Vikram Singh applied for Sick Leave', time: '5 hours ago' },
    { type: 'advance', message: 'Priya Sharma requested ₹15,000 salary advance', time: '1 day ago' },
    { type: 'payroll', message: 'August 2026 payroll processed for 4 employees', time: '2 days ago' },
    { type: 'leave', message: 'Sneha Mehta\'s leave request approved', time: '3 days ago' },
  ],
};

export const mockFingerprints = [
  { id: 1, employee_name: 'Rajesh Patel', employee_id: 'EMP001', finger: 'Right Index', template_id: 'FP001_RI', status: 'enrolled', enrolled_on: '2023-01-15', device: 'Device-01' },
  { id: 2, employee_name: 'Priya Sharma', employee_id: 'EMP002', finger: 'Right Index', template_id: 'FP002_RI', status: 'enrolled', enrolled_on: '2023-03-20', device: 'Device-01' },
  { id: 3, employee_name: 'Amit Desai', employee_id: 'EMP003', finger: 'Left Index', template_id: 'FP003_LI', status: 'enrolled', enrolled_on: '2022-11-05', device: 'Device-02' },
  { id: 4, employee_name: 'Sneha Mehta', employee_id: 'EMP004', finger: 'Right Thumb', template_id: 'FP004_RT', status: 'pending', enrolled_on: null, device: null },
  { id: 5, employee_name: 'Vikram Singh', employee_id: 'EMP005', finger: 'Right Index', template_id: 'FP005_RI', status: 'enrolled', enrolled_on: '2023-08-01', device: 'Device-01' },
];

export const mockDevices = [
  { id: 1, name: 'Device-01', serial: 'ZK4500-001', location: 'Surat Main - Gate A', model: 'ZK4500', status: 'online', last_sync: '2026-09-03 08:55', employees_enrolled: 12 },
  { id: 2, name: 'Device-02', serial: 'ZK4500-002', location: 'Surat Main - Gate B', model: 'ZK4500', status: 'online', last_sync: '2026-09-03 08:50', employees_enrolled: 8 },
  { id: 3, name: 'Device-03', serial: 'ZK4500-003', location: 'Mumbai Branch - Entrance', model: 'ZK4500', status: 'offline', last_sync: '2026-09-02 18:30', employees_enrolled: 5 },
];

export const mockBranches = [
  { id: 1, name: 'Surat Main', address: 'Ring Road, Surat, Gujarat - 395002', phone: '+91 261 234 5678', employees: 5, departments: 4 },
  { id: 2, name: 'Mumbai Branch', address: 'Opera House, Mumbai, Maharashtra - 400004', phone: '+91 22 234 5678', employees: 3, departments: 3 },
];

export const mockDepartments = [
  { id: 1, name: 'Cutting', branch: 'Surat Main', head: 'Rajesh Patel', employees: 2 },
  { id: 2, name: 'Polishing', branch: 'Surat Main', head: 'Priya Sharma', employees: 2 },
  { id: 3, name: 'Quality', branch: 'Mumbai Branch', head: 'Amit Desai', employees: 1 },
  { id: 4, name: 'Design', branch: 'Mumbai Branch', head: 'Sneha Mehta', employees: 1 },
  { id: 5, name: 'Administration', branch: 'Surat Main', head: 'Anjali Joshi', employees: 1 },
  { id: 6, name: 'Sales', branch: 'Mumbai Branch', head: 'Karan Malhotra', employees: 1 },
];

export const mockCompany = {
  id: 1,
  name: 'Brilliant Diamonds Pvt Ltd',
  email: 'info@brilliantdiamonds.com',
  phone: '+91 261 234 5678',
  address: 'Ring Road, Surat, Gujarat - 395002',
  gstin: '24AABCB1234L1Z5',
  established: '2010',
  branches: 2,
  total_employees: 8,
};

export const mockEmployeeProfile = {
  id: 1,
  employee_id: 'EMP001',
  name: 'Rajesh Patel',
  email: 'employee@diamond.com',
  phone: '+91 98765 43210',
  department: 'Cutting',
  branch: 'Surat Main',
  designation: 'Senior Diamond Cutter',
  status: 'active',
  join_date: '2023-01-15',
  salary: 45000,
};

export const mockEmployeeAttendance = [
  { date: '2026-09-03', check_in: '09:02', check_out: '18:05', status: 'present', work_hours: 9.0 },
  { date: '2026-09-02', check_in: '08:58', check_out: '18:10', status: 'present', work_hours: 9.2 },
  { date: '2026-09-01', check_in: '09:10', check_out: '18:00', status: 'late', work_hours: 8.8 },
  { date: '2026-08-31', check_in: null, check_out: null, status: 'weekly_off', work_hours: 0 },
  { date: '2026-08-30', check_in: '09:00', check_out: '18:05', status: 'present', work_hours: 9.0 },
];

export const mockEmployeeAttendanceSummary = {
  present: 21,
  absent: 1,
  late: 2,
  on_leave: 2,
  weekly_off: 4,
  total_hours: 189.5,
  attendance_rate: 91.3,
};

export const mockEmployeeLeaves = [
  { id: 1, leave_type: 'Casual Leave', start_date: '2026-08-20', end_date: '2026-08-21', days: 2, reason: 'Personal work', status: 'rejected', applied_on: '2026-08-15' },
  { id: 2, leave_type: 'Sick Leave', start_date: '2026-07-10', end_date: '2026-07-11', days: 2, reason: 'Fever', status: 'approved', applied_on: '2026-07-08' },
];

export const mockEmployeeLeaveBalances = [
  { type: 'Casual Leave', total: 12, used: 4, remaining: 8 },
  { type: 'Sick Leave', total: 7, used: 2, remaining: 5 },
  { type: 'Earned Leave', total: 15, used: 0, remaining: 15 },
];

export const mockEmployeeAdvances = [
  { id: 1, amount: 10000, reason: 'Medical emergency', status: 'approved', request_date: '2026-08-25', monthly_deduction: 2000, remaining: 8000 },
  { id: 2, amount: 5000, reason: 'Festival shopping', status: 'approved', request_date: '2026-06-10', monthly_deduction: 1000, remaining: 2000 },
];

export const mockEmployeePayroll = [
  { id: 1, month: 'August 2026', basic_salary: 45000, hra: 9000, allowances: 5000, deductions: 2000, advance_deduction: 2000, net_salary: 55000, status: 'paid' },
  { id: 2, month: 'July 2026', basic_salary: 45000, hra: 9000, allowances: 5000, deductions: 2000, advance_deduction: 1000, net_salary: 56000, status: 'paid' },
  { id: 3, month: 'June 2026', basic_salary: 45000, hra: 9000, allowances: 5000, deductions: 2000, advance_deduction: 1000, net_salary: 56000, status: 'paid' },
];
