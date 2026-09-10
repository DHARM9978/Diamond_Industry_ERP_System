import { useEffect, useState } from 'react';

import {
  FileBarChart,
  CalendarCheck,
  Users,
  Wallet,
  Banknote,
  CalendarDays,
  Download,
} from 'lucide-react';

import {
  PageHeader,
  DataTable,
} from '@/components/ui/PageComponents';

import { StatusBadge } from '@/components/ui/Badge';

import { FullPageSpinner } from '@/components/ui/Spinner';

import { EmptyState } from '@/components/ui/EmptyState';

import { useToast } from '@/context/ToastContext';

import {
  attendanceService,
  employeeService,
  payrollService,
  advanceService,
  leaveService,
} from '@/services/apiServices';


// ============================================================================
// ADMIN REPORTS
// ============================================================================

export function AdminReports() {
  const { toast } = useToast();

  // ==========================================================================
  // STATE
  // ==========================================================================

  const [reportType, setReportType] =
    useState('attendance');

  const [data, setData] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [totalAdvancePayment, setTotalAdvancePayment] =
    useState(0);

  const [totalPayrollAmount, setTotalPayrollAmount] =
    useState(0);

  const [summaryLoading, setSummaryLoading] =
    useState(true);


  // ==========================================================================
  // REPORT TYPES
  // ==========================================================================

  const reportTypes = [
    {
      value: 'attendance',
      label: 'Attendance Report',
      icon: CalendarCheck,
    },

    {
      value: 'employees',
      label: 'Employee Report',
      icon: Users,
    },

    {
      value: 'payroll',
      label: 'Payroll Report',
      icon: Wallet,
    },

    {
      value: 'advances',
      label: 'Advances Report',
      icon: Banknote,
    },

    {
      value: 'leaves',
      label: 'Leaves Report',
      icon: CalendarDays,
    },
  ];


  const current =
    reportTypes.find(
      (report) =>
        report.value === reportType
    );


  // ==========================================================================
  // EXTRACT API ARRAY
  // ==========================================================================

  const extractArray = (response, possibleKeys = []) => {
    if (Array.isArray(response)) {
      return response;
    }

    if (
      Array.isArray(response?.data)
    ) {
      return response.data;
    }

    if (
      Array.isArray(response?.data?.data)
    ) {
      return response.data.data;
    }

    for (
      const key of possibleKeys
    ) {
      if (
        Array.isArray(response?.[key])
      ) {
        return response[key];
      }

      if (
        Array.isArray(response?.data?.[key])
      ) {
        return response.data[key];
      }
    }

    return [];
  };


  // ==========================================================================
  // EMPLOYEE NAME
  // ==========================================================================

  const getEmployeeName = (employee) => {
    if (!employee) {
      return '—';
    }

    const firstName =
      employee?.firstName || '';

    const lastName =
      employee?.lastName || '';

    const fullName =
      `${firstName} ${lastName}`.trim();

    return (
      fullName ||
      employee?.name ||
      employee?.employeeName ||
      employee?.fullName ||
      '—'
    );
  };


  // ==========================================================================
  // FORMAT DATE
  // ==========================================================================

  const formatDate = (value) => {
    if (!value) {
      return '—';
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(value);
    }

    return date.toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    );
  };


  // ==========================================================================
  // FORMAT MONTH
  // ==========================================================================

  const formatMonth = (value) => {
    if (!value) {
      return '—';
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(value);
    }

    return date.toLocaleDateString(
      'en-IN',
      {
        month: 'long',
        year: 'numeric',
      }
    );
  };


  // ==========================================================================
  // FORMAT TIME
  // ==========================================================================

  const formatTime = (value) => {
    if (!value) {
      return '--';
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(value);
    }

    return date.toLocaleTimeString(
      'en-IN',
      {
        hour: '2-digit',
        minute: '2-digit',
      }
    );
  };


  // ==========================================================================
  // FORMAT CURRENCY
  // ==========================================================================

  const formatCurrency = (value) => {
    const amount =
      Number(value || 0);

    return amount.toLocaleString(
      'en-IN',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  };


  // ==========================================================================
  // LOAD SELECTED REPORT
  // ==========================================================================

  const loadReport = async (
    type
  ) => {
    try {
      setLoading(true);
      setError('');

      let response;

      // ======================================================================
      // ATTENDANCE
      // ======================================================================

      if (type === 'attendance') {
        response =
          await attendanceService.list();
      }


      // ======================================================================
      // EMPLOYEES
      // ======================================================================

      else if (
        type === 'employees'
      ) {
        response =
          await employeeService.list();
      }


      // ======================================================================
      // PAYROLL
      // ======================================================================

      else if (
        type === 'payroll'
      ) {
        response =
          await payrollService.list();
      }


      // ======================================================================
      // ADVANCES
      // ======================================================================

      else if (
        type === 'advances'
      ) {
        response =
          await advanceService.list();
      }


      // ======================================================================
      // LEAVE REQUESTS
      // ======================================================================

      else if (
        type === 'leaves'
      ) {
        response =
          await leaveService.requests();
      }


      console.log(
        `${type} report API response:`,
        response
      );


      // ======================================================================
      // GET ARRAY
      // ======================================================================

      const records =
        extractArray(
          response,
          type === 'payroll'
            ? ['payrolls']
            : type === 'advances'
              ? ['advances']
              : type === 'leaves'
                ? ['requests']
                : type === 'employees'
                  ? ['employees']
                  : ['records']
        );


      // ======================================================================
      // NORMALIZE RECORDS
      // ======================================================================

      let normalizedData = [];


      // ======================================================================
      // ATTENDANCE
      // ======================================================================

      if (
        type === 'attendance'
      ) {
        normalizedData =
          records.map(
            (record) => ({
              employee_id:
                record?.employeeId ??
                record?.employee?.employeeId ??
                '—',

              employee_name:
                getEmployeeName(
                  record?.employee
                ),

              date:
                formatDate(
                  record?.date
                ),

              check_in:
                formatTime(
                  record?.checkInTime
                ),

              check_out:
                formatTime(
                  record?.checkOutTime
                ),

              work_hours:
                Number(
                  record?.totalHours || 0
                ),

              status:
                record?.status ||
                '—',
            })
          );
      }


      // ======================================================================
      // EMPLOYEES
      // ======================================================================

      else if (
        type === 'employees'
      ) {
        normalizedData =
          records.map(
            (employee) => {
              const baseSalary =
                Number(
                  employee?.baseSalary || 0
                );

              const expectedHours =
                Number(
                  employee?.monthlyExpectedHours || 0
                );

              const hourlyRate =
                Number(
                  employee?.salaryRatePerHour || 0
                );

              return {
                employee_id:
                  employee?.employeeId ??
                  employee?.id ??
                  '—',

                name:
                  getEmployeeName(
                    employee
                  ),

                department:
                  employee?.department
                    ?.departmentName ??
                  employee?.departmentName ??
                  '—',

                branch:
                  employee?.branch
                    ?.branchName ??
                  employee?.branchName ??
                  '—',

                designation:
                  employee?.designation ??
                  employee?.role ??
                  '—',

                base_salary:
                  baseSalary,

                expected_hours:
                  expectedHours,

                hourly_rate:
                  hourlyRate,

                status:
                  employee?.status ||
                  '—',
              };
            }
          );
      }


      // ======================================================================
      // PAYROLL
      // ======================================================================

      else if (
        type === 'payroll'
      ) {
        normalizedData =
          records.map(
            (record) => {
              const employee =
                record?.employee;

              const basicSalary =
                Number(
                  record?.basicSalary || 0
                );

              const advanceDeduction =
                Number(
                  record?.advanceDeduction || 0
                );

              const netSalary =
                Number(
                  record?.netSalary ?? 
                  (
                    basicSalary -
                    advanceDeduction
                  )
                );

              const baseSalary =
                Number(
                  record?.baseSalary || 0
                );

              const monthlyExpectedHours =
                Number(
                  record?.monthlyExpectedHours || 0
                );

              const salaryRatePerHour =
                Number(
                  record?.salaryRatePerHour || 0
                );

              const totalWorkingHours =
                Number(
                  record?.totalWorkingHours || 0
                );

              return {
                employee_id:
                  record?.employeeId ??
                  employee?.employeeId ??
                  '—',

                employee_name:
                  getEmployeeName(
                    employee
                  ) !== '—'
                    ? getEmployeeName(
                        employee
                      )
                    : (
                        record?.employeeName ||
                        '—'
                      ),

                pay_period:
                  `${formatDate(
                    record?.payPeriodStart
                  )} - ${formatDate(
                    record?.payPeriodEnd
                  )}`,

                payment_date:
                  formatDate(
                    record?.paymentDate
                  ),

                base_salary:
                  baseSalary,

                expected_hours:
                  monthlyExpectedHours,

                hourly_rate:
                  salaryRatePerHour,

                actual_hours:
                  totalWorkingHours,

                basic_salary:
                  basicSalary,

                advance_deduction:
                  advanceDeduction,

                net_salary:
                  netSalary,

                status:
                  record?.status ||
                  '—',
              };
            }
          );
      }


      // ======================================================================
      // ADVANCES
      // ======================================================================

      else if (
        type === 'advances'
      ) {
        normalizedData =
          records.map(
            (record) => {
              const employee =
                record?.employee;

              return {
                employee_id:
                  record?.employeeId ??
                  employee?.employeeId ??
                  '—',

                employee_name:
                  getEmployeeName(
                    employee
                  ) !== '—'
                    ? getEmployeeName(
                        employee
                      )
                    : (
                        record?.employeeName ||
                        '—'
                      ),

                requested_amount:
                  Number(
                    record?.amount || 0
                  ),

                approved_amount:
                  Number(
                    record?.approvedAmount || 0
                  ),

                paid_amount:
                  Number(
                    record?.paidAmount || 0
                  ),

                reason:
                  record?.reason ??
                  record?.description ??
                  '—',

                request_date:
                  formatDate(
                    record?.paymentDate ??
                    record?.createdAt
                  ),

                status:
                  record?.status ||
                  '—',
              };
            }
          );
      }


      // ======================================================================
      // LEAVES
      // ======================================================================

      else if (
        type === 'leaves'
      ) {
        normalizedData =
          records.map(
            (record) => {
              const employee =
                record?.employee;

              const leaveType =
                record?.leaveType;

              return {
                employee_id:
                  record?.employeeId ??
                  employee?.employeeId ??
                  '—',

                employee_name:
                  getEmployeeName(
                    employee
                  ) !== '—'
                    ? getEmployeeName(
                        employee
                      )
                    : (
                        record?.employeeName ||
                        '—'
                      ),

                leave_type:
                  leaveType?.leaveTypeName ??
                  leaveType?.name ??
                  record?.leaveTypeName ??
                  record?.leaveType ??
                  '—',

                requested_days:
                  Number(
                    record?.totalDays || 0
                  ),

                approved_days:
                  Number(
                    record?.approvedDays || 0
                  ),

                start_date:
                  formatDate(
                    record?.startDate
                  ),

                end_date:
                  formatDate(
                    record?.endDate
                  ),

                approved_start_date:
                  formatDate(
                    record?.approvedStartDate
                  ),

                approved_end_date:
                  formatDate(
                    record?.approvedEndDate
                  ),

                status:
                  record?.status ||
                  '—',
              };
            }
          );
      }


      setData(
        normalizedData
      );

    } catch (err) {
      console.error(
        `Failed to load ${type} report:`,
        err
      );

      const message =
        err?.response?.data?.message ||
        err?.message ||
        `Failed to load ${type} report`;

      setError(
        message
      );

      setData([]);

      toast(
        message,
        'error'
      );

    } finally {
      setLoading(false);
    }
  };


  // ==========================================================================
  // LOAD FINANCIAL SUMMARY
  // ==========================================================================

  const loadFinancialSummary =
    async () => {
      try {
        setSummaryLoading(
          true
        );

        const [
          advanceResponse,
          payrollResponse,
        ] = await Promise.all([
          advanceService.list(),
          payrollService.list(),
        ]);


        console.log(
          'Advance summary response:',
          advanceResponse
        );


        console.log(
          'Payroll summary response:',
          payrollResponse
        );


        const advances =
          extractArray(
            advanceResponse,
            ['advances']
          );


        const payroll =
          extractArray(
            payrollResponse,
            ['payrolls']
          );


        // ====================================================================
        // TOTAL ACTUAL ADVANCE PAYMENT
        //
        // Only PAID advances are counted because paidAmount represents
        // the actual amount that was given to the employee.
        // ====================================================================

        const advanceTotal =
          advances.reduce(
            (
              total,
              record
            ) => {
              if (
                record?.status !== 'PAID'
              ) {
                return total;
              }

              return (
                total +
                Number(
                  record?.paidAmount || 0
                )
              );
            },
            0
          );


        // ====================================================================
        // TOTAL PAYROLL AMOUNT
        //
        // Net salary represents the final payroll amount after deductions.
        // ====================================================================

        const payrollTotal =
          payroll.reduce(
            (
              total,
              record
            ) => {
              const netSalary =
                Number(
                  record?.netSalary || 0
                );

              return (
                total +
                netSalary
              );
            },
            0
          );


        setTotalAdvancePayment(
          advanceTotal
        );

        setTotalPayrollAmount(
          payrollTotal
        );

      } catch (err) {
        console.error(
          'Failed to load financial summary:',
          err
        );

        setTotalAdvancePayment(
          0
        );

        setTotalPayrollAmount(
          0
        );

      } finally {
        setSummaryLoading(
          false
        );
      }
    };


  // ==========================================================================
  // LOAD DATA
  // ==========================================================================

  useEffect(() => {
    loadReport(
      reportType
    );
  }, [reportType]);


  // ==========================================================================
  // LOAD FINANCIAL SUMMARY
  // ==========================================================================

  useEffect(() => {
    loadFinancialSummary();
  }, []);


  // ==========================================================================
  // TABLE COLUMNS
  // ==========================================================================

  const getColumns = () => {
    switch (reportType) {

      // ========================================================================
      // ATTENDANCE
      // ========================================================================

      case 'attendance':
        return [
          {
            key: 'employee_id',
            label: 'Emp ID',
            render: (record) => (
              <span className="font-mono text-xs text-navy-600">
                {record.employee_id}
              </span>
            ),
          },

          {
            key: 'employee_name',
            label: 'Name',
            render: (record) => (
              <span className="font-medium text-navy-900">
                {record.employee_name}
              </span>
            ),
          },

          {
            key: 'date',
            label: 'Date',
            render: (record) => (
              <span className="text-navy-600">
                {record.date}
              </span>
            ),
          },

          {
            key: 'check_in',
            label: 'In',
            align: 'center',
            render: (record) => (
              <span className="font-mono text-navy-700">
                {record.check_in}
              </span>
            ),
          },

          {
            key: 'check_out',
            label: 'Out',
            align: 'center',
            render: (record) => (
              <span className="font-mono text-navy-700">
                {record.check_out}
              </span>
            ),
          },

          {
            key: 'work_hours',
            label: 'Hours',
            align: 'right',
            render: (record) => (
              <span className="font-semibold text-navy-700">
                {record.work_hours > 0
                  ? `${record.work_hours}h`
                  : '--'}
              </span>
            ),
          },

          {
            key: 'status',
            label: 'Status',
            align: 'center',
            render: (record) => (
              <StatusBadge
                status={record.status}
              />
            ),
          },
        ];


      // ========================================================================
      // EMPLOYEES
      // ========================================================================

      case 'employees':
        return [
          {
            key: 'employee_id',
            label: 'Emp ID',
            render: (record) => (
              <span className="font-mono text-xs text-navy-600">
                {record.employee_id}
              </span>
            ),
          },

          {
            key: 'name',
            label: 'Name',
            render: (record) => (
              <span className="font-medium text-navy-900">
                {record.name}
              </span>
            ),
          },

          {
            key: 'department',
            label: 'Dept',
            render: (record) => (
              <span className="text-navy-600">
                {record.department}
              </span>
            ),
          },

          {
            key: 'branch',
            label: 'Branch',
            render: (record) => (
              <span className="text-navy-600">
                {record.branch}
              </span>
            ),
          },

          {
            key: 'designation',
            label: 'Designation',
            render: (record) => (
              <span className="text-navy-600">
                {record.designation}
              </span>
            ),
          },

          {
            key: 'base_salary',
            label: 'Base Salary',
            align: 'right',
            render: (record) => (
              <span className="font-semibold text-navy-800">
                ₹{formatCurrency(
                  record.base_salary
                )}
              </span>
            ),
          },

          {
            key: 'expected_hours',
            label: 'Expected Hrs',
            align: 'right',
            render: (record) => (
              <span className="text-navy-700">
                {Number(
                  record.expected_hours || 0
                ).toFixed(2)}
              </span>
            ),
          },

          {
            key: 'hourly_rate',
            label: 'Hourly Rate',
            align: 'right',
            render: (record) => (
              <span className="text-navy-700">
                ₹{formatCurrency(
                  record.hourly_rate
                )}
              </span>
            ),
          },

          {
            key: 'status',
            label: 'Status',
            align: 'center',
            render: (record) => (
              <StatusBadge
                status={record.status}
              />
            ),
          },
        ];


      // ========================================================================
      // PAYROLL
      // ========================================================================

      case 'payroll':
        return [
          {
            key: 'employee_id',
            label: 'Emp ID',
            render: (record) => (
              <span className="font-mono text-xs text-navy-600">
                {record.employee_id}
              </span>
            ),
          },

          {
            key: 'employee_name',
            label: 'Name',
            render: (record) => (
              <span className="font-medium text-navy-900">
                {record.employee_name}
              </span>
            ),
          },

          {
            key: 'pay_period',
            label: 'Pay Period',
            render: (record) => (
              <div>
                <div className="text-sm text-navy-700">
                  {record.pay_period}
                </div>

                {record.payment_date !== '—' && (
                  <div className="text-xs text-navy-400 mt-1">
                    Paid: {record.payment_date}
                  </div>
                )}
              </div>
            ),
          },

          {
            key: 'base_salary',
            label: 'Base Salary',
            align: 'right',
            render: (record) => (
              <span className="text-navy-700">
                ₹{formatCurrency(
                  record.base_salary
                )}
              </span>
            ),
          },

          {
            key: 'expected_hours',
            label: 'Expected Hrs',
            align: 'right',
            render: (record) => (
              <span className="text-navy-700">
                {Number(
                  record.expected_hours || 0
                ).toFixed(2)}
              </span>
            ),
          },

          {
            key: 'hourly_rate',
            label: 'Hourly Rate',
            align: 'right',
            render: (record) => (
              <span className="text-navy-700">
                ₹{formatCurrency(
                  record.hourly_rate
                )}
              </span>
            ),
          },

          {
            key: 'actual_hours',
            label: 'Actual Hrs',
            align: 'right',
            render: (record) => (
              <span className="font-semibold text-navy-800">
                {Number(
                  record.actual_hours || 0
                ).toFixed(2)}
              </span>
            ),
          },

          {
            key: 'basic_salary',
            label: 'Earned Salary',
            align: 'right',
            render: (record) => (
              <span className="text-navy-700">
                ₹{formatCurrency(
                  record.basic_salary
                )}
              </span>
            ),
          },

          {
            key: 'advance_deduction',
            label: 'Advance',
            align: 'right',
            render: (record) => (
              record.advance_deduction > 0 ? (
                <span className="text-red-600">
                  -₹{formatCurrency(
                    record.advance_deduction
                  )}
                </span>
              ) : (
                <span className="text-navy-400">
                  —
                </span>
              )
            ),
          },

          {
            key: 'net_salary',
            label: 'Net Pay',
            align: 'right',
            render: (record) => (
              <span className="font-bold text-navy-900">
                ₹{formatCurrency(
                  record.net_salary
                )}
              </span>
            ),
          },

          {
            key: 'status',
            label: 'Status',
            align: 'center',
            render: (record) => (
              <StatusBadge
                status={record.status}
              />
            ),
          },
        ];


      // ========================================================================
      // ADVANCES
      // ========================================================================

      case 'advances':
        return [
          {
            key: 'employee_id',
            label: 'Emp ID',
            render: (record) => (
              <span className="font-mono text-xs text-navy-600">
                {record.employee_id}
              </span>
            ),
          },

          {
            key: 'employee_name',
            label: 'Name',
            render: (record) => (
              <span className="font-medium text-navy-900">
                {record.employee_name}
              </span>
            ),
          },

          {
            key: 'requested_amount',
            label: 'Requested',
            align: 'right',
            render: (record) => (
              <span className="text-navy-700">
                ₹{formatCurrency(
                  record.requested_amount
                )}
              </span>
            ),
          },

          {
            key: 'approved_amount',
            label: 'Approved',
            align: 'right',
            render: (record) => (
              record.approved_amount > 0 ? (
                <span className="text-navy-700">
                  ₹{formatCurrency(
                    record.approved_amount
                  )}
                </span>
              ) : (
                <span className="text-navy-400">
                  —
                </span>
              )
            ),
          },

          {
            key: 'paid_amount',
            label: 'Paid',
            align: 'right',
            render: (record) => (
              record.paid_amount > 0 ? (
                <span className="font-semibold text-navy-900">
                  ₹{formatCurrency(
                    record.paid_amount
                  )}
                </span>
              ) : (
                <span className="text-navy-400">
                  —
                </span>
              )
            ),
          },

          {
            key: 'reason',
            label: 'Reason',
            render: (record) => (
              <span className="text-sm text-navy-500">
                {record.reason}
              </span>
            ),
          },

          {
            key: 'request_date',
            label: 'Date',
            render: (record) => (
              <span className="text-sm text-navy-500">
                {record.request_date}
              </span>
            ),
          },

          {
            key: 'status',
            label: 'Status',
            align: 'center',
            render: (record) => (
              <StatusBadge
                status={record.status}
              />
            ),
          },
        ];


      // ========================================================================
      // LEAVES
      // ========================================================================

      case 'leaves':
        return [
          {
            key: 'employee_id',
            label: 'Emp ID',
            render: (record) => (
              <span className="font-mono text-xs text-navy-600">
                {record.employee_id}
              </span>
            ),
          },

          {
            key: 'employee_name',
            label: 'Name',
            render: (record) => (
              <span className="font-medium text-navy-900">
                {record.employee_name}
              </span>
            ),
          },

          {
            key: 'leave_type',
            label: 'Type',
            render: (record) => (
              <span className="text-navy-600">
                {record.leave_type}
              </span>
            ),
          },

          {
            key: 'requested_days',
            label: 'Requested',
            align: 'center',
            render: (record) => (
              <span className="font-semibold text-navy-700">
                {Number(
                  record.requested_days || 0
                ).toFixed(2)}
              </span>
            ),
          },

          {
            key: 'approved_days',
            label: 'Approved',
            align: 'center',
            render: (record) => (
              <span className="font-semibold text-navy-700">
                {record.approved_days > 0
                  ? Number(
                      record.approved_days
                    ).toFixed(2)
                  : '—'}
              </span>
            ),
          },

          {
            key: 'start_date',
            label: 'Requested Start',
            render: (record) => (
              <span className="text-sm text-navy-500">
                {record.start_date}
              </span>
            ),
          },

          {
            key: 'approved_start_date',
            label: 'Approved Start',
            render: (record) => (
              <span className="text-sm text-navy-500">
                {record.approved_start_date}
              </span>
            ),
          },

          {
            key: 'status',
            label: 'Status',
            align: 'center',
            render: (record) => (
              <StatusBadge
                status={record.status}
              />
            ),
          },
        ];


      default:
        return [];
    }
  };


  // ==========================================================================
  // CSV ESCAPE
  // ==========================================================================

  const escapeCsvValue = (
    value
  ) => {
    if (
      value === null ||
      value === undefined
    ) {
      return '';
    }

    const stringValue =
      String(value);

    if (
      stringValue.includes(',') ||
      stringValue.includes('"') ||
      stringValue.includes('\n')
    ) {
      return `"${stringValue.replace(
        /"/g,
        '""'
      )}"`;
    }

    return stringValue;
  };


  // ==========================================================================
  // EXPORT CSV
  // ==========================================================================

  const handleExportCSV = () => {
    if (!data.length) {
      toast(
        'There is no data to export',
        'error'
      );

      return;
    }

    let headers = [];
    let rows = [];


    // ========================================================================
    // ATTENDANCE
    // ========================================================================

    if (
      reportType === 'attendance'
    ) {
      headers = [
        'Employee ID',
        'Employee Name',
        'Date',
        'Check In',
        'Check Out',
        'Work Hours',
        'Status',
      ];

      rows =
        data.map(
          (record) => [
            record.employee_id,
            record.employee_name,
            record.date,
            record.check_in,
            record.check_out,
            record.work_hours,
            record.status,
          ]
        );
    }


    // ========================================================================
    // EMPLOYEES
    // ========================================================================

    else if (
      reportType === 'employees'
    ) {
      headers = [
        'Employee ID',
        'Name',
        'Department',
        'Branch',
        'Designation',
        'Base Salary',
        'Expected Hours',
        'Hourly Rate',
        'Status',
      ];

      rows =
        data.map(
          (record) => [
            record.employee_id,
            record.name,
            record.department,
            record.branch,
            record.designation,
            record.base_salary,
            record.expected_hours,
            record.hourly_rate,
            record.status,
          ]
        );
    }


    // ========================================================================
    // PAYROLL
    // ========================================================================

    else if (
      reportType === 'payroll'
    ) {
      headers = [
        'Employee ID',
        'Employee Name',
        'Pay Period',
        'Base Salary',
        'Expected Hours',
        'Hourly Rate',
        'Actual Working Hours',
        'Earned Salary',
        'Advance Deduction',
        'Net Salary',
        'Payment Date',
        'Status',
      ];

      rows =
        data.map(
          (record) => [
            record.employee_id,
            record.employee_name,
            record.pay_period,
            record.base_salary,
            record.expected_hours,
            record.hourly_rate,
            record.actual_hours,
            record.basic_salary,
            record.advance_deduction,
            record.net_salary,
            record.payment_date,
            record.status,
          ]
        );
    }


    // ========================================================================
    // ADVANCES
    // ========================================================================

    else if (
      reportType === 'advances'
    ) {
      headers = [
        'Employee ID',
        'Employee Name',
        'Requested Amount',
        'Approved Amount',
        'Paid Amount',
        'Reason',
        'Date',
        'Status',
      ];

      rows =
        data.map(
          (record) => [
            record.employee_id,
            record.employee_name,
            record.requested_amount,
            record.approved_amount,
            record.paid_amount,
            record.reason,
            record.request_date,
            record.status,
          ]
        );
    }


    // ========================================================================
    // LEAVES
    // ========================================================================

    else if (
      reportType === 'leaves'
    ) {
      headers = [
        'Employee ID',
        'Employee Name',
        'Leave Type',
        'Requested Days',
        'Approved Days',
        'Requested Start',
        'Requested End',
        'Approved Start',
        'Approved End',
        'Status',
      ];

      rows =
        data.map(
          (record) => [
            record.employee_id,
            record.employee_name,
            record.leave_type,
            record.requested_days,
            record.approved_days,
            record.start_date,
            record.end_date,
            record.approved_start_date,
            record.approved_end_date,
            record.status,
          ]
        );
    }


    // ========================================================================
    // CREATE CSV
    // ========================================================================

    const csv = [
      headers
        .map(
          escapeCsvValue
        )
        .join(','),

      ...rows.map(
        (row) =>
          row
            .map(
              escapeCsvValue
            )
            .join(',')
      ),
    ].join('\n');


    // ========================================================================
    // DOWNLOAD CSV
    // ========================================================================

    const blob =
      new Blob(
        ['\uFEFF' + csv],
        {
          type:
            'text/csv;charset=utf-8;',
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );


    const link =
      document.createElement(
        'a'
      );


    link.href = url;


    link.download =
      `${reportType}-report-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;


    document.body.appendChild(
      link
    );


    link.click();


    document.body.removeChild(
      link
    );


    URL.revokeObjectURL(
      url
    );


    toast(
      `${current?.label || 'Report'} exported successfully`,
      'success'
    );
  };


  // ==========================================================================
  // LOADING
  // ==========================================================================

  if (loading) {
    return (
      <FullPageSpinner
        message={
          `Loading ${
            current?.label ||
            'report'
          }...`
        }
      />
    );
  }


  // ==========================================================================
  // PAGE
  // ==========================================================================

  return (
    <div>

      {/* ====================================================================
          HEADER
      ===================================================================== */}

      <PageHeader
        title="Reports"
        subtitle="
          Generate and export workforce reports
        "
        actions={
          <button
            type="button"
            onClick={
              handleExportCSV
            }
            disabled={
              data.length === 0
            }
            className="
              btn-secondary
              flex
              items-center
              gap-2
            "
          >
            <Download size={18} />

            Export CSV
          </button>
        }
      />


      {/* ====================================================================
          FINANCIAL SUMMARY
      ===================================================================== */}

      <div
        className="
          grid
          grid-cols-1
          md:grid-cols-2
          gap-4
          mb-6
        "
      >

        {/* ==================================================================
            TOTAL ACTUAL ADVANCE PAYMENT
        =================================================================== */}

        <div
          className="
            bg-white
            border
            border-navy-100
            rounded-xl
            p-5
            shadow-sm
            flex
            items-center
            justify-between
          "
        >

          <div>

            <p
              className="
                text-sm
                text-navy-500
                mb-1
              "
            >
              Total Advance Payment
            </p>


            <h2
              className="
                text-2xl
                font-bold
                text-navy-900
              "
            >
              {summaryLoading
                ? 'Loading...'
                : `₹${formatCurrency(
                    totalAdvancePayment
                  )}`}
            </h2>


            <p
              className="
                text-xs
                text-navy-400
                mt-1
              "
            >
              Actual amount paid to employees
            </p>

          </div>


          <div
            className="
              w-12
              h-12
              rounded-xl
              bg-navy-100
              flex
              items-center
              justify-center
            "
          >
            <Banknote
              size={24}
              className="text-navy-600"
            />
          </div>

        </div>


        {/* ==================================================================
            TOTAL PAYROLL AMOUNT
        =================================================================== */}

        <div
          className="
            bg-white
            border
            border-navy-100
            rounded-xl
            p-5
            shadow-sm
            flex
            items-center
            justify-between
          "
        >

          <div>

            <p
              className="
                text-sm
                text-navy-500
                mb-1
              "
            >
              Total Payroll Amount
            </p>


            <h2
              className="
                text-2xl
                font-bold
                text-navy-900
              "
            >
              {summaryLoading
                ? 'Loading...'
                : `₹${formatCurrency(
                    totalPayrollAmount
                  )}`}
            </h2>


            <p
              className="
                text-xs
                text-navy-400
                mt-1
              "
            >
              Total net payroll
            </p>

          </div>


          <div
            className="
              w-12
              h-12
              rounded-xl
              bg-navy-100
              flex
              items-center
              justify-center
            "
          >
            <Wallet
              size={24}
              className="text-navy-600"
            />
          </div>

        </div>

      </div>


      {/* ====================================================================
          REPORT TYPE CARDS
      ===================================================================== */}

      <div
        className="
          grid
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-5
          gap-3
          mb-6
        "
      >

        {reportTypes.map(
          (report) => {
            const Icon =
              report.icon;

            const active =
              reportType ===
              report.value;

            return (
              <button
                key={
                  report.value
                }
                type="button"
                onClick={() =>
                  setReportType(
                    report.value
                  )
                }
                className={`
                  card-hover
                  p-4
                  text-left
                  transition-all
                  ${
                    active
                      ? 'ring-2 ring-accent-500 bg-accent-50'
                      : ''
                  }
                `}
              >

                <div
                  className={`
                    w-10
                    h-10
                    rounded-lg
                    flex
                    items-center
                    justify-center
                    mb-2
                    ${
                      active
                        ? 'bg-accent-600 text-white'
                        : 'bg-navy-100 text-navy-600'
                    }
                  `}
                >
                  <Icon
                    size={20}
                  />
                </div>


                <p
                  className={`
                    text-sm
                    font-medium
                    ${
                      active
                        ? 'text-accent-800'
                        : 'text-navy-700'
                    }
                  `}
                >
                  {report.label}
                </p>

              </button>
            );
          }
        )}

      </div>


      {/* ====================================================================
          ERROR
      ===================================================================== */}

      {error && (
        <div
          className="
            mb-4
            rounded-lg
            border
            border-red-200
            bg-red-50
            px-4
            py-3
            text-sm
            text-red-700
          "
        >
          {error}
        </div>
      )}


      {/* ====================================================================
          REPORT TITLE
      ===================================================================== */}

      <div
        className="
          mb-4
          flex
          items-center
          gap-2
        "
      >

        <FileBarChart
          size={20}
          className="text-navy-600"
        />


        <h3
          className="
            font-semibold
            text-navy-900
          "
        >
          {current?.label}
        </h3>

      </div>


      {/* ====================================================================
          REPORT DATA
      ===================================================================== */}

      {data.length === 0 ? (
        <EmptyState
          icon={FileBarChart}
          title="No data"
          message="
            No data is available for this report.
          "
        />
      ) : (
        <DataTable
          columns={
            getColumns()
          }
          data={data}
          emptyMessage="
            No data for this report
          "
        />
      )}

    </div>
  );
}