import { useEffect, useMemo, useState } from 'react';

import {
  Wallet,
  Download,
  RefreshCw,
  Plus,
  X,
} from 'lucide-react';

import {
  PageHeader,
  DataTable,
} from '@/components/ui/PageComponents';

import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';

import {
  payrollService,
  employeeService,
} from '@/services/apiServices';


// ============================================================
// Helpers
// ============================================================

const getErrorMessage = (error) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    'Something went wrong.'
  );
};


const formatCurrency = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return '₹0.00';
  }

  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};


const formatNumber = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '0.00';
  }

  return number.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};


const formatDate = (date) => {
  if (!date) {
    return '-';
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return '-';
  }

  return parsedDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};


const getEmployeeName = (record) => {
  const firstName =
    record?.employee?.firstName ||
    record?.firstName ||
    '';

  const lastName =
    record?.employee?.lastName ||
    record?.lastName ||
    '';

  const fullName =
    `${firstName} ${lastName}`.trim();

  return fullName || 'Unknown Employee';
};


const getEmployeeDisplayName = (employee) => {
  const firstName =
    employee?.firstName || '';

  const lastName =
    employee?.lastName || '';

  const name =
    `${firstName} ${lastName}`.trim();

  if (!name) {
    return `Employee #${employee?.employeeId ?? ''}`;
  }

  return `${name} (#${employee.employeeId})`;
};


const getPayrollMonth = (record) => {
  if (!record?.payPeriodStart) {
    return '-';
  }

  const date =
    new Date(record.payPeriodStart);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
};


const getTodayString = () => {
  const date = new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      date.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};


const getCurrentMonthStart = () => {
  const date = new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  return `${year}-${month}-01`;
};


const getCurrentMonthEnd = () => {
  const date = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  );

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      date.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};


const escapeCsvValue = (value) => {
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


// ============================================================
// Main Component
// ============================================================

export function AdminPayroll() {

  const { toast } = useToast();

  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');

  const [generateModalOpen, setGenerateModalOpen] =
    useState(false);


  // ==========================================================
  // Load Payroll
  // ==========================================================

  const loadPayroll = async () => {
    try {
      setLoading(true);

      const response =
        await payrollService.list();

      let payrollRecords = [];

      if (Array.isArray(response)) {
        payrollRecords = response;
      }

      else if (
        Array.isArray(response?.data)
      ) {
        payrollRecords =
          response.data;
      }

      setRecords(
        payrollRecords
      );

    } catch (error) {

      console.error(
        'Failed to load payroll:',
        error
      );

      setRecords([]);

      toast(
        getErrorMessage(error),
        'error'
      );

    } finally {
      setLoading(false);
    }
  };


  // ==========================================================
  // Load Employees
  // ==========================================================

  const loadEmployees = async () => {
    try {

      const response =
        await employeeService.list();

      let employeeRecords = [];

      if (Array.isArray(response)) {
        employeeRecords = response;
      }

      else if (
        Array.isArray(response?.data)
      ) {
        employeeRecords =
          response.data;
      }


      // Only active employees can have payroll generated.
      const activeEmployees =
        employeeRecords.filter(
          (employee) =>
            employee?.status === 'ACTIVE'
        );


      setEmployees(
        activeEmployees
      );

    } catch (error) {

      console.error(
        'Failed to load employees:',
        error
      );

      setEmployees([]);

      toast(
        getErrorMessage(error),
        'error'
      );
    }
  };


  // ==========================================================
  // Initial Load
  // ==========================================================

  useEffect(() => {

    const loadPageData =
      async () => {

        try {

          setLoading(true);

          await Promise.all([
            loadPayroll(),
            loadEmployees(),
          ]);

        } finally {

          setLoading(false);

        }
      };


    loadPageData();

  }, []);


  // ==========================================================
  // Search
  // ==========================================================

  const filtered = useMemo(() => {

    const searchTerm =
      search.trim().toLowerCase();

    if (!searchTerm) {
      return records;
    }


    return records.filter(
      (record) => {

        const employeeName =
          getEmployeeName(
            record
          ).toLowerCase();

        const employeeId =
          String(
            record?.employeeId ?? ''
          ).toLowerCase();

        const month =
          getPayrollMonth(
            record
          ).toLowerCase();


        return (
          employeeName.includes(
            searchTerm
          ) ||
          employeeId.includes(
            searchTerm
          ) ||
          month.includes(
            searchTerm
          )
        );
      }
    );

  }, [records, search]);


  // ==========================================================
  // Export Payroll
  // ==========================================================

  const handleExport = () => {

    if (
      filtered.length === 0
    ) {
      return;
    }


    const headers = [

      'Payroll ID',

      'Employee ID',

      'Employee Name',

      'Email',

      'Pay Period Start',

      'Pay Period End',

      'Base Salary',

      'Expected Monthly Hours',

      'Hourly Rate',

      'Actual Working Hours',

      'Earned Salary',

      'Advance Deduction',

      'Net Salary',

      'Payment Date',

    ];


    const rows =
      filtered.map(
        (record) => [

          record?.payrollId,

          record?.employeeId,

          getEmployeeName(record),

          record?.employee?.email || '',

          formatDate(
            record?.payPeriodStart
          ),

          formatDate(
            record?.payPeriodEnd
          ),

          record?.baseSalary ?? '',

          record?.monthlyExpectedHours ?? '',

          record?.salaryRatePerHour ?? '',

          record?.totalWorkingHours ?? 0,

          record?.basicSalary ?? 0,

          record?.advanceDeduction ?? 0,

          record?.netSalary ?? 0,

          formatDate(
            record?.paymentDate
          ),

        ]
      );


    const csv =
      [
        headers,
        ...rows,
      ]
        .map(
          (row) =>
            row
              .map(
                escapeCsvValue
              )
              .join(',')
        )
        .join('\n');


    const csvWithBom =
      '\uFEFF' + csv;


    const blob =
      new Blob(
        [csvWithBom],
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


    const date =
      new Date()
        .toISOString()
        .split('T')[0];


    link.download =
      `payroll-export-${date}.csv`;


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
  };


  // ==========================================================
  // Generate Payroll
  // ==========================================================

  const handleGeneratePayroll =
    async (formData) => {

      try {

        setSaving(true);


        const response =
          await payrollService.create(
            formData
          );


        console.log(
          'Payroll created:',
          response
        );


        toast(
          'Payroll generated successfully',
          'success'
        );


        setGenerateModalOpen(
          false
        );


        await loadPayroll();


      } catch (error) {

        console.error(
          'Payroll generation failed:',
          error
        );


        toast(
          getErrorMessage(error),
          'error'
        );

      } finally {

        setSaving(false);

      }
    };


  // ==========================================================
  // Table Columns
  // ==========================================================

  const columns = [

    // --------------------------------------------------------
    // Employee ID
    // --------------------------------------------------------

    {
      key: 'employeeId',

      label: 'Emp ID',

      render: (record) => (
        <span
          className="
            font-mono
            text-xs
            font-semibold
            text-navy-600
          "
        >
          {record?.employeeId ?? '—'}
        </span>
      ),
    },


    // --------------------------------------------------------
    // Employee
    // --------------------------------------------------------

    {
      key: 'employee',

      label: 'Employee',

      render: (record) => (
        <div>

          <div
            className="
              font-medium
              text-navy-900
            "
          >
            {getEmployeeName(
              record
            )}
          </div>

          {record?.employee?.email && (
            <div
              className="
                text-xs
                text-navy-400
              "
            >
              {record.employee.email}
            </div>
          )}

        </div>
      ),
    },


    // --------------------------------------------------------
    // Period
    // --------------------------------------------------------

    {
      key: 'month',

      label: 'Pay Period',

      render: (record) => (
        <div>

          <span
            className="
              text-navy-700
              font-medium
            "
          >
            {getPayrollMonth(
              record
            )}
          </span>

          <div
            className="
              text-xs
              text-navy-400
              mt-1
            "
          >
            {formatDate(
              record?.payPeriodStart
            )}

            {' — '}

            {formatDate(
              record?.payPeriodEnd
            )}
          </div>

        </div>
      ),
    },


    // --------------------------------------------------------
    // Base Salary
    // --------------------------------------------------------

    {
      key: 'baseSalary',

      label: 'Base Salary',

      align: 'right',

      render: (record) => (
        <span
          className="
            text-navy-700
            font-medium
          "
        >
          {record?.baseSalary !== null &&
           record?.baseSalary !== undefined
            ? formatCurrency(
                record.baseSalary
              )
            : '—'}
        </span>
      ),
    },


    // --------------------------------------------------------
    // Expected Monthly Hours
    // --------------------------------------------------------

    {
      key: 'monthlyExpectedHours',

      label: 'Expected Hrs',

      align: 'right',

      render: (record) => (
        <span
          className="
            text-navy-600
          "
        >
          {record?.monthlyExpectedHours !== null &&
           record?.monthlyExpectedHours !== undefined
            ? `${formatNumber(
                record.monthlyExpectedHours
              )} hrs`
            : '—'}
        </span>
      ),
    },


    // --------------------------------------------------------
    // Hourly Rate
    // --------------------------------------------------------

    {
      key: 'salaryRatePerHour',

      label: 'Hourly Rate',

      align: 'right',

      render: (record) => (
        <span
          className="
            text-navy-700
            font-medium
          "
        >
          {record?.salaryRatePerHour !== null &&
           record?.salaryRatePerHour !== undefined
            ? formatCurrency(
                record.salaryRatePerHour
              )
            : '—'}
        </span>
      ),
    },


    // --------------------------------------------------------
    // Actual Working Hours
    // --------------------------------------------------------

    {
      key: 'workingHours',

      label: 'Actual Hours',

      align: 'right',

      render: (record) => (
        <span
          className="
            text-navy-600
          "
        >
          {formatNumber(
            record?.totalWorkingHours
          )}{' '}
          hrs
        </span>
      ),
    },


    // --------------------------------------------------------
    // Earned Salary
    // --------------------------------------------------------

    {
      key: 'basicSalary',

      label: 'Earned Salary',

      align: 'right',

      render: (record) => (
        <span
          className="
            text-navy-700
            font-semibold
          "
        >
          {formatCurrency(
            record?.basicSalary
          )}
        </span>
      ),
    },


    // --------------------------------------------------------
    // Advance Deduction
    // --------------------------------------------------------

    {
      key: 'advanceDeduction',

      label: 'Advance',

      align: 'right',

      render: (record) => (

        <span
          className="
            font-medium
            text-error-600
          "
        >

          {Number(
            record?.advanceDeduction
          ) > 0
            ? `-${formatCurrency(
                record.advanceDeduction
              )}`
            : formatCurrency(0)}

        </span>

      ),
    },


    // --------------------------------------------------------
    // Net Salary
    // --------------------------------------------------------

    {
      key: 'netSalary',

      label: 'Net Pay',

      align: 'right',

      render: (record) => {

        const netSalary =
          Number(
            record?.netSalary
          );


        const isNegative =
          netSalary < 0;


        return (
          <span
            className={`font-bold ${
              isNegative
                ? 'text-error-600'
                : 'text-navy-900'
            }`}
          >
            {formatCurrency(
              netSalary
            )}
          </span>
        );
      },
    },


    // --------------------------------------------------------
    // Payment Date
    // --------------------------------------------------------

    {
      key: 'paymentDate',

      label: 'Payment Date',

      render: (record) => (
        <span
          className="
            text-navy-500
            text-sm
          "
        >
          {formatDate(
            record?.paymentDate
          )}
        </span>
      ),
    },

  ];


  // ==========================================================
  // Loading
  // ==========================================================

  if (loading) {

    return (
      <FullPageSpinner
        message="Loading payroll..."
      />
    );
  }


  // ==========================================================
  // Page
  // ==========================================================

  return (
    <div>

      <PageHeader
        title="Payroll"

        subtitle={`
          ${filtered.length}
          record${filtered.length !== 1 ? 's' : ''}
        `}

        actions={

          <div
            className="
              flex
              items-center
              gap-2
            "
          >

            {/* Generate */}

            <button
              type="button"

              onClick={() =>
                setGenerateModalOpen(
                  true
                )
              }

              className="
                btn-primary
                flex
                items-center
                gap-2
              "
            >
              <Plus size={18} />
              Generate Payroll
            </button>


            {/* Export */}

            <button
              type="button"

              onClick={handleExport}

              disabled={
                filtered.length === 0
              }

              className="
                btn-secondary
                flex
                items-center
                gap-2
                disabled:opacity-50
                disabled:cursor-not-allowed
              "
            >
              <Download size={18} />
              Export
            </button>

          </div>
        }
      />


      {/* ======================================================
          Search + Refresh
      ====================================================== */}

      <div
        className="
          mb-5
          flex
          items-center
          gap-3
        "
      >

        <div className="flex-1">

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="
              Search by employee name or ID...
            "
          />

        </div>


        <button
          type="button"
          onClick={loadPayroll}
          disabled={loading}

          className="
            flex
            items-center
            gap-2
            px-4
            py-2
            rounded-lg
            border
            border-navy-200
            text-navy-700
            hover:bg-navy-50
            transition-colors
            disabled:opacity-50
          "
        >

          <RefreshCw
            size={16}
            className={
              loading
                ? 'animate-spin'
                : ''
            }
          />

          Refresh

        </button>

      </div>


      {/* ======================================================
          Payroll Table
      ====================================================== */}

      {filtered.length === 0 ? (

        <EmptyState
          icon={Wallet}

          title="No payroll records"

          message={
            search
              ? 'No payroll records match your search.'
              : 'Payroll records will appear here.'
          }
        />

      ) : (

        <DataTable
          columns={columns}
          data={filtered}
        />

      )}


      {/* ======================================================
          Generate Payroll Modal
      ====================================================== */}

      <GeneratePayrollModal
        open={
          generateModalOpen
        }

        onClose={() => {
          if (!saving) {
            setGenerateModalOpen(
              false
            );
          }
        }}

        employees={
          employees
        }

        saving={
          saving
        }

        onGenerate={
          handleGeneratePayroll
        }
      />

    </div>
  );
}


// =================================================================
// Generate Payroll Modal
// =================================================================

function GeneratePayrollModal({
  open,
  onClose,
  employees,
  saving,
  onGenerate,
}) {

  const [form, setForm] = useState({
    employeeId: '',
    payPeriodStart:
      getCurrentMonthStart(),

    payPeriodEnd:
      getCurrentMonthEnd(),

    paymentDate:
      getTodayString(),
  });


  // ==========================================================
  // Reset Form
  // ==========================================================

  useEffect(() => {

    if (open) {

      setForm({
        employeeId: '',
        payPeriodStart:
          getCurrentMonthStart(),

        payPeriodEnd:
          getCurrentMonthEnd(),

        paymentDate:
          getTodayString(),
      });

    }

  }, [open]);


  // ==========================================================
  // Update Field
  // ==========================================================

  const updateField = (
    field,
    value
  ) => {

    setForm(
      (previous) => ({
        ...previous,
        [field]: value,
      })
    );

  };


  // ==========================================================
  // Selected Employee
  // ==========================================================

  const selectedEmployee =
    employees.find(
      (employee) =>
        String(
          employee?.employeeId
        ) ===
        String(
          form.employeeId
        )
    );


  // ==========================================================
  // Submit
  // ==========================================================

  const handleSubmit = (
    event
  ) => {

    event.preventDefault();


    if (!form.employeeId) {
      return;
    }


    if (!form.payPeriodStart) {
      return;
    }


    if (!form.payPeriodEnd) {
      return;
    }


    if (
      form.payPeriodStart >
      form.payPeriodEnd
    ) {
      return;
    }


    onGenerate({
      employeeId:
        Number(
          form.employeeId
        ),

      payPeriodStart:
        form.payPeriodStart,

      payPeriodEnd:
        form.payPeriodEnd,

      paymentDate:
        form.paymentDate || null,
    });

  };


  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate Payroll"
      size="lg"
    >

      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >

        {/* ==================================================
            Employee
        ================================================== */}

        <div className="flex flex-col gap-1.5">

          <label
            className="
              text-sm
              font-medium
              text-navy-700
            "
          >
            Employee

            <span className="text-error-500">
              *
            </span>
          </label>


          <select
            className="input-field"

            value={
              form.employeeId
            }

            onChange={(event) =>
              updateField(
                'employeeId',
                event.target.value
              )
            }

            required
          >

            <option value="">
              Select Employee
            </option>

            {employees.map(
              (employee) => (
                <option
                  key={
                    employee.employeeId
                  }
                  value={
                    employee.employeeId
                  }
                >
                  {getEmployeeDisplayName(
                    employee
                  )}
                </option>
              )
            )}

          </select>

          {employees.length === 0 && (
            <p
              className="
                text-xs
                text-error-600
              "
            >
              No active employees are available.
            </p>
          )}

        </div>


        {/* ==================================================
            Selected Employee Salary Information
        ================================================== */}

        {selectedEmployee && (

          <div
            className="
              rounded-lg
              border
              border-navy-100
              bg-navy-50
              p-4
            "
          >

            <div
              className="
                text-sm
                font-semibold
                text-navy-800
                mb-3
              "
            >
              Current Salary Configuration
            </div>


            <div
              className="
                grid
                grid-cols-1
                sm:grid-cols-3
                gap-3
              "
            >

              <div>
                <p
                  className="
                    text-xs
                    text-navy-400
                  "
                >
                  Base Salary
                </p>

                <p
                  className="
                    text-sm
                    font-semibold
                    text-navy-800
                  "
                >
                  {formatCurrency(
                    selectedEmployee.baseSalary
                  )}
                </p>
              </div>


              <div>
                <p
                  className="
                    text-xs
                    text-navy-400
                  "
                >
                  Expected Hours
                </p>

                <p
                  className="
                    text-sm
                    font-semibold
                    text-navy-800
                  "
                >
                  {formatNumber(
                    selectedEmployee.monthlyExpectedHours
                  )}{' '}
                  hrs
                </p>
              </div>


              <div>
                <p
                  className="
                    text-xs
                    text-navy-400
                  "
                >
                  Hourly Rate
                </p>

                <p
                  className="
                    text-sm
                    font-semibold
                    text-navy-800
                  "
                >
                  {formatCurrency(
                    selectedEmployee.salaryRatePerHour
                  )}
                </p>
              </div>

            </div>

          </div>

        )}


        {/* ==================================================
            Pay Period
        ================================================== */}

        <div
          className="
            grid
            grid-cols-1
            sm:grid-cols-2
            gap-4
          "
        >

          {/* Start */}

          <div
            className="
              flex
              flex-col
              gap-1.5
            "
          >

            <label
              className="
                text-sm
                font-medium
                text-navy-700
              "
            >
              Pay Period Start

              <span className="text-error-500">
                *
              </span>
            </label>


            <input
              type="date"

              className="input-field"

              value={
                form.payPeriodStart
              }

              onChange={(event) =>
                updateField(
                  'payPeriodStart',
                  event.target.value
                )
              }

              required
            />

          </div>


          {/* End */}

          <div
            className="
              flex
              flex-col
              gap-1.5
            "
          >

            <label
              className="
                text-sm
                font-medium
                text-navy-700
              "
            >
              Pay Period End

              <span className="text-error-500">
                *
              </span>
            </label>


            <input
              type="date"

              className="input-field"

              value={
                form.payPeriodEnd
              }

              onChange={(event) =>
                updateField(
                  'payPeriodEnd',
                  event.target.value
                )
              }

              required
            />

          </div>

        </div>


        {/* ==================================================
            Payment Date
        ================================================== */}

        <div
          className="
            flex
            flex-col
            gap-1.5
          "
        >

          <label
            className="
              text-sm
              font-medium
              text-navy-700
            "
          >
            Payment Date
          </label>


          <input
            type="date"

            className="input-field"

            value={
              form.paymentDate
            }

            onChange={(event) =>
              updateField(
                'paymentDate',
                event.target.value
              )
            }
          />

        </div>


        {/* ==================================================
            Calculation Information
        ================================================== */}

        <div
          className="
            rounded-lg
            bg-navy-50
            border
            border-navy-100
            p-4
            text-sm
            text-navy-600
          "
        >

          <p>
            <strong>
              Payroll is calculated automatically.
            </strong>
          </p>

          <p className="mt-1">
            The system reads the employee's actual
            attendance hours for the selected period,
            calculates earned salary using the stored
            hourly rate, and deducts any unpaid payroll
            eligible advance.
          </p>

          <p className="mt-1">
            No salary amount is entered manually here.
          </p>

        </div>


        {/* ==================================================
            Buttons
        ================================================== */}

        <div
          className="
            flex
            justify-end
            gap-3
            pt-4
            border-t
            border-navy-100
          "
        >

          <button
            type="button"

            onClick={onClose}

            disabled={saving}

            className="
              px-4
              py-2
              rounded-lg
              text-sm
              font-medium
              text-navy-600
              hover:bg-navy-100
              disabled:opacity-50
            "
          >
            Cancel
          </button>


          <button
            type="submit"

            disabled={
              saving ||
              employees.length === 0
            }

            className="
              btn-primary
              px-5
              py-2
              disabled:opacity-50
              disabled:cursor-not-allowed
            "
          >

            {saving
              ? 'Generating...'
              : 'Generate Payroll'}

          </button>

        </div>

      </form>

    </Modal>
  );
}