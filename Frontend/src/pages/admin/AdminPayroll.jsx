import { useEffect, useMemo, useState } from 'react';
import {
  Wallet,
  Download,
  RefreshCw,
  Settings,
  CalendarDays,
  Save,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

import {
  PageHeader,
  DataTable,
} from '@/components/ui/PageComponents';

import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchInput } from '@/components/ui/Form';

import {
  payrollService,
  branchService,
} from '@/services/apiServices';

import apiClient from '@/services/apiClient';


// ============================================================
// ADMIN PAYROLL
// ============================================================

export function AdminPayroll() {

  // ==========================================================
  // PAYROLL RECORDS
  // ==========================================================

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // ==========================================================
  // PAYROLL VIEW
  // ==========================================================

  const [payrollView, setPayrollView] = useState('CURRENT');

  // ==========================================================
  // SEARCH / FILTER
  // ==========================================================

  const [search, setSearch] = useState('');

  const [selectedBranch, setSelectedBranch] =
    useState('ALL');

  // ==========================================================
  // BRANCHES
  // ==========================================================

  const [branches, setBranches] = useState([]);

  const [branchesLoading, setBranchesLoading] =
    useState(true);

  // ==========================================================
  // PAYROLL ACTION STATES
  // ==========================================================

  const [payingPayrollId, setPayingPayrollId] =
    useState(null);

  const [generatingPayroll, setGeneratingPayroll] =
    useState(false);

  const [payrollMessage, setPayrollMessage] =
    useState('');

  const [payrollError, setPayrollError] =
    useState('');

  // ==========================================================
  // PAYROLL PAYMENT CONFIRMATION STATE
  // ==========================================================

  const [paymentRecord, setPaymentRecord] =
    useState(null);

  // ==========================================================
  // PAYROLL CONFIGURATION
  // ==========================================================

  const [configuration, setConfiguration] =
    useState({
      startDay: 1,
      endDay: 0,
      paymentDay: 5,
      enabled: true,
    });

  const [currentPeriod, setCurrentPeriod] =
    useState(null);

  const [nextPeriod, setNextPeriod] =
    useState(null);

  const [currentPeriodsByBranch, setCurrentPeriodsByBranch] = useState({});

  const [configurationLoading, setConfigurationLoading] =
    useState(false);

  const [configurationSaving, setConfigurationSaving] =
    useState(false);

  const [configurationMessage, setConfigurationMessage] =
    useState('');

  const [configurationError, setConfigurationError] =
    useState('');


  // ==========================================================
  // HELPERS
  // ==========================================================

  const unwrapResponse = (response) => {
    return (
      response?.data?.data ??
      response?.data ??
      response
    );
  };


  const getPayrollRecordsFromResponse = (response) => {

    const data = unwrapResponse(response);

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.records)) {
      return data.records;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    return [];
  };


  // ==========================================================
  // LOAD PAYROLL
  // ==========================================================

  const loadPayroll = async () => {

    try {

      setLoading(true);
      setPayrollError('');

      const response =
        await payrollService.list();

      const payrollRecords =
        getPayrollRecordsFromResponse(response);

      setRecords(payrollRecords);

    } catch (error) {

      console.error(
        'Failed to load payroll:',
        error
      );

      setRecords([]);

      setPayrollError(
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load payroll records.'
      );

    } finally {

      setLoading(false);

    }
  };


  // ==========================================================
  // LOAD BRANCHES
  // ==========================================================

  const loadBranches = async () => {

    try {

      setBranchesLoading(true);

      const response =
        await branchService.list();

      const branchRecords =
        unwrapResponse(response);

      if (Array.isArray(branchRecords)) {

        setBranches(branchRecords);

      } else if (
        Array.isArray(branchRecords?.data)
      ) {

        setBranches(
          branchRecords.data
        );

      } else {

        setBranches([]);

      }

    } catch (error) {

      console.error(
        'Failed to load branches:',
        error
      );

      setBranches([]);

    } finally {

      setBranchesLoading(false);

    }
  };


  // ==========================================================
  // LOAD CONFIGURATION
  // ==========================================================

  const loadCurrentPeriodsForBranches = async (branchList = branches) => {
    if (!Array.isArray(branchList) || branchList.length === 0) {
      setCurrentPeriodsByBranch({});
      return;
    }

    const results = await Promise.allSettled(
      branchList.map(async (branch) => {
        const branchId = Number(branch?.branchId);
        if (!Number.isInteger(branchId)) return null;

        const response = await apiClient.get(
          `/api/payroll/period/${branchId}/current`
        );

        return {
          branchId,
          period: unwrapResponse(response) || null,
        };
      })
    );

    const periodMap = {};

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value?.branchId) {
        periodMap[result.value.branchId] = result.value.period;
      } else if (result.status === 'rejected') {
        console.error(
          'Failed to load a branch current payroll period:',
          result.reason
        );
      }
    });

    setCurrentPeriodsByBranch(periodMap);
  };


  const loadConfiguration = async (
    branchId,
    options = {}
  ) => {

    const {
      clearMessages = true,
    } = options;

    if (!branchId) {

      setConfiguration({
        startDay: 1,
        endDay: 0,
        paymentDay: 5,
        enabled: true,
      });

      setCurrentPeriod(null);
      setNextPeriod(null);

      return;
    }

    try {

      setConfigurationLoading(true);

      if (clearMessages) {
        setConfigurationMessage('');
        setConfigurationError('');
      }

      // --------------------------------------------------------
      // LOAD CONFIGURATION
      // --------------------------------------------------------

      try {

        const configurationResponse =
          await apiClient.get(
            `/api/payroll/configuration/${branchId}`
          );

        const configurationData =
          unwrapResponse(
            configurationResponse
          ) || {};

        setConfiguration({

          startDay:
            Number(
              configurationData.startDay ?? 1
            ),

          endDay:
            Number(
              configurationData.endDay ?? 0
            ),

          paymentDay:
            Number(
              configurationData.paymentDay ?? 5
            ),

          enabled:
            configurationData.enabled !== false,

        });

      } catch (configurationError) {

        console.error(
          'Failed to load payroll configuration:',
          configurationError
        );

        setConfigurationError(
          configurationError?.response?.data?.message ||
          configurationError?.message ||
          'Failed to load payroll configuration.'
        );

        return;
      }

      // --------------------------------------------------------
      // LOAD CURRENT / NEXT PERIOD
      // --------------------------------------------------------
      // These are intentionally loaded separately. A problem with
      // either period endpoint must not make configuration appear
      // as if it was not saved.

      const currentResult =
        await Promise.resolve()
          .then(() =>
            apiClient.get(
              `/api/payroll/period/${branchId}/current`
            )
          )
          .then(
            (response) => ({
              status: 'fulfilled',
              value: response,
            }),
            (reason) => ({
              status: 'rejected',
              reason,
            })
          );

      if (currentResult.status === 'fulfilled') {

        const currentPeriodData =
          unwrapResponse(currentResult.value) || null;

        setCurrentPeriod(currentPeriodData);
        setCurrentPeriodsByBranch((previous) => ({
          ...previous,
          [Number(branchId)]: currentPeriodData,
        }));

        // --------------------------------------------------------
        // CALCULATE NEXT PAYROLL PERIOD FROM THE CURRENT PERIOD
        // --------------------------------------------------------
        // The current-period API is the authoritative period data.
        // Build the next cycle locally so the Next Payroll Period
        // card does not depend on a second endpoint response shape.
        // --------------------------------------------------------

        const currentStartValue =
          currentPeriodData?.payPeriodStart ??
          currentPeriodData?.periodStart;

        const currentEndValue =
          currentPeriodData?.payPeriodEnd ??
          currentPeriodData?.periodEnd;

        const currentStartDate =
          currentStartValue
            ? new Date(currentStartValue)
            : null;

        const currentEndDate =
          currentEndValue
            ? new Date(currentEndValue)
            : null;

        if (
          currentStartDate &&
          !Number.isNaN(currentStartDate.getTime()) &&
          currentEndDate &&
          !Number.isNaN(currentEndDate.getTime())
        ) {

          const nextStartYear =
            currentStartDate.getFullYear() +
            (currentStartDate.getMonth() === 11 ? 1 : 0);

          const nextStartMonth =
            (currentStartDate.getMonth() + 1) % 12;

          const startDay =
            Math.min(
              Math.max(Number(configuration.startDay) || 1, 1),
              new Date(
                nextStartYear,
                nextStartMonth + 1,
                0
              ).getDate()
            );

          let nextEndYear =
            nextStartYear;

          let nextEndMonth =
            nextStartMonth;

          const configuredEndDay =
            Number(configuration.endDay);

          if (
            configuredEndDay === 0
          ) {
            // End on the last day of the next start month.
            nextEndYear =
              nextStartYear;
            nextEndMonth =
              nextStartMonth;

          } else if (
            configuredEndDay < startDay
          ) {
            // A cycle such as 15th → 14th ends in the
            // following calendar month.
            nextEndMonth += 1;

            if (nextEndMonth > 11) {
              nextEndMonth = 0;
              nextEndYear += 1;
            }
          }

          const daysInEndMonth =
            new Date(
              nextEndYear,
              nextEndMonth + 1,
              0
            ).getDate();

          const endDay =
            configuredEndDay === 0
              ? daysInEndMonth
              : Math.min(
                  Math.max(
                    configuredEndDay,
                    1
                  ),
                  daysInEndMonth
                );

          const paymentDay =
            Math.min(
              Math.max(
                Number(configuration.paymentDay) || 5,
                1
              ),
              31
            );

          let paymentYear =
            nextEndYear;

          let paymentMonth =
            nextEndMonth + 1;

          if (paymentMonth > 11) {
            paymentMonth = 0;
            paymentYear += 1;
          }

          const daysInPaymentMonth =
            new Date(
              paymentYear,
              paymentMonth + 1,
              0
            ).getDate();

          const resolvedPaymentDay =
            Math.min(
              paymentDay,
              daysInPaymentMonth
            );

          setNextPeriod({
            payPeriodStart: new Date(
              nextStartYear,
              nextStartMonth,
              startDay
            ),

            payPeriodEnd: new Date(
              nextEndYear,
              nextEndMonth,
              endDay
            ),

            paymentDate: new Date(
              paymentYear,
              paymentMonth,
              resolvedPaymentDay
            ),
          });

        } else {

          setNextPeriod(null);

        }

      } else {

        console.error(
          'Failed to load current payroll period:',
          currentResult.reason
        );

        setCurrentPeriod(null);
        setNextPeriod(null);

      }
    } finally {

      setConfigurationLoading(false);

    }
  };


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {

    const initialize = async () => {

      await Promise.all([
        loadPayroll(),
        loadBranches(),
      ]);

    };

    initialize();

  }, []);


  // ==========================================================
  // LOAD CURRENT PERIODS WHEN BRANCHES CHANGE
  // ==========================================================

  useEffect(() => {
    if (branches.length === 0) {
      setCurrentPeriodsByBranch({});
      return;
    }

    loadCurrentPeriodsForBranches(branches);
  }, [branches]);


  // ==========================================================
  //   // LOAD CONFIGURATION WHEN BRANCH CHANGES
  // ==========================================================

  useEffect(() => {

    if (branches.length === 0) {
      return;
    }

    const branchId =
      selectedBranch === 'ALL'
        ? branches[0]?.branchId
        : Number(selectedBranch);

    if (branchId) {

      loadConfiguration(
        branchId
      );

    }

  }, [
    selectedBranch,
    branches,
  ]);


  // ==========================================================
  // REFRESH
  // ==========================================================

  const handleRefresh = async () => {

    setPayrollMessage('');
    setPayrollError('');

    await Promise.all([
      loadPayroll(),
      loadBranches(),
    ]);

    await loadCurrentPeriodsForBranches(branches);

    const branchId =
      selectedBranch === 'ALL'
        ? branches[0]?.branchId
        : Number(selectedBranch);

    if (branchId) {
      await loadConfiguration(branchId);
    }

  };


  // ==========================================================
  // GENERATE CURRENT PAYROLL
  // ==========================================================

// ==========================================================
// GENERATE CURRENT PAYROLL
// ==========================================================

const handleGenerateCurrentPayroll =
  async () => {

    try {

      setGeneratingPayroll(true);
      setPayrollMessage('');
      setPayrollError('');

      if (branches.length === 0) {
        setPayrollError(
          'No branches are available.'
        );
        return;
      }

      const branchesToGenerate =
        selectedBranch === 'ALL'
          ? branches
          : branches.filter(
              (branch) =>
                Number(branch.branchId) ===
                Number(selectedBranch)
            );

      const generationResults = [];

      for (
        const branch
        of branchesToGenerate
      ) {

        const branchId =
          Number(
            branch.branchId
          );

        const response =
          await payrollService.generateCurrentBranch(
            branchId
          );

        generationResults.push(
          response
        );
      }


      const generatedCount =
        generationResults.reduce(
          (
            total,
            result
          ) =>
            total +
            Number(
              result?.generatedCount || 0
            ),
          0
        );


      const alreadyGeneratedCount =
        generationResults.reduce(
          (
            total,
            result
          ) =>
            total +
            Number(
              result?.alreadyGeneratedCount || 0
            ),
          0
        );


      const employeeErrors =
        generationResults.flatMap(
          (result) =>
            Array.isArray(
              result?.results
            )
              ? result.results.filter(
                  (item) =>
                    item?.success === false
                )
              : []
        );


      if (
        employeeErrors.length > 0
      ) {

        setPayrollError(
          employeeErrors
            .map(
              (item) =>
                `Employee ${item.employeeId}: ${item.error}`
            )
            .join(' | ')
        );

      } else if (
        generatedCount > 0
      ) {

        setPayrollMessage(
          `${generatedCount} payroll record(s) generated successfully.`
        );

      } else if (
        alreadyGeneratedCount > 0
      ) {

        setPayrollMessage(
          'Payroll is already generated for the current period.'
        );

      } else {

        setPayrollError(
          'Payroll generation completed, but no employee payroll records were created.'
        );

      }


      // Reload payroll after generation
      await loadPayroll();

    } catch (error) {

      console.error(
        'Failed to generate current payroll:',
        error
      );

      setPayrollError(
        error?.response?.data?.message ||
        error?.message ||
        'Failed to generate current payroll.'
      );

    } finally {

      setGeneratingPayroll(false);

    }

  };


  // ==========================================================
  // SAVE CONFIGURATION
  // ==========================================================

  const handleSaveConfiguration =
    async () => {

      if (branches.length === 0) {

        setConfigurationError(
          'No branches are available.'
        );

        return;
      }

      const startDay =
        Number(configuration.startDay);

      const endDay =
        Number(configuration.endDay);

      const paymentDay =
        Number(configuration.paymentDay);


      // --------------------------------------------------------
      // VALIDATION
      // --------------------------------------------------------

      if (
        !Number.isInteger(startDay) ||
        startDay < 1 ||
        startDay > 31
      ) {

        setConfigurationMessage('');

        setConfigurationError(
          'Start Day must be between 1 and 31.'
        );

        return;
      }


      if (
        !Number.isInteger(endDay) ||
        endDay < 0 ||
        endDay > 31
      ) {

        setConfigurationMessage('');

        setConfigurationError(
          'End Day must be between 0 and 31. Use 0 for the last day of the month.'
        );

        return;
      }


      if (
        !Number.isInteger(paymentDay) ||
        paymentDay < 1 ||
        paymentDay > 31
      ) {

        setConfigurationMessage('');

        setConfigurationError(
          'Payment Day must be between 1 and 31.'
        );

        return;
      }


      const payload = {

        startDay,

        endDay,

        paymentDay,

        enabled:
          Boolean(
            configuration.enabled
          ),

      };


      try {

        setConfigurationSaving(true);

        setConfigurationMessage('');
        setConfigurationError('');


        // ------------------------------------------------------
        // SAVE FOR ALL BRANCHES
        // ------------------------------------------------------

        if (
          selectedBranch === 'ALL'
        ) {

          for (
            const branch of branches
          ) {

            await apiClient.put(
              `/api/payroll/configuration/${branch.branchId}`,
              payload
            );

          }

          // Keep the values visible immediately.
          setConfiguration({
            startDay,
            endDay,
            paymentDay,
            enabled: Boolean(
              configuration.enabled
            ),
          });

          // Refresh configuration and period cards, but do not
          // allow the refresh to erase the success message.
          await loadConfiguration(
            branches[0]?.branchId,
            {
              clearMessages: false,
            }
          );

          setConfigurationMessage(
            'Payroll period configuration saved successfully for all branches.'
          );

        }

        // ------------------------------------------------------
        // SAVE FOR SINGLE BRANCH
        // ------------------------------------------------------

        else {

          const branchId =
            Number(selectedBranch);

          if (!branchId) {

            throw new Error(
              'Please select a valid branch.'
            );

          }

          await apiClient.put(
            `/api/payroll/configuration/${branchId}`,
            payload
          );

          // Keep the values visible immediately.
          setConfiguration({
            startDay,
            endDay,
            paymentDay,
            enabled: Boolean(
              configuration.enabled
            ),
          });

          // Refresh configuration and period cards, but do not
          // allow the refresh to erase the success message.
          await loadConfiguration(
            branchId,
            {
              clearMessages: false,
            }
          );

          setConfigurationMessage(
            'Payroll period configuration saved successfully.'
          );

        }

        await loadPayroll();
        await loadCurrentPeriodsForBranches(branches);

      } catch (error) {

        console.error(
          'Failed to save payroll configuration:',
          error
        );

        setConfigurationMessage('');

        setConfigurationError(
          error?.response?.data?.message ||
          error?.message ||
          'Failed to save payroll configuration.'
        );

      } finally {

        setConfigurationSaving(false);

      }

    };


  // ==========================================================
  // DATE KEY
  // ==========================================================

  const getDateKey = (value) => {
    if (!value) return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return `${date.getUTCFullYear()}-${String(
      date.getUTCMonth() + 1
    ).padStart(2, '0')}-${String(
      date.getUTCDate()
    ).padStart(2, '0')}`;
  };


  // ==========================================================
  //   // PAYROLL MONTH
  // ==========================================================

  const getPayrollMonth = (
    record
  ) => {

    if (!record?.payPeriodStart) {
      return '-';
    }

    const date =
      new Date(
        record.payPeriodStart
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return '-';

    }

    return date.toLocaleDateString(
      'en-IN',
      {
        month: 'short',
        year: 'numeric',
      }
    );

  };


  // ==========================================================
  // FORMAT DATE
  // ==========================================================

  const formatDate = (
    date
  ) => {

    if (!date) {
      return '-';
    }

    const parsedDate =
      new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {

      return '-';

    }

    return parsedDate.toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    );

  };


  // ==========================================================
  // FORMAT CURRENCY
  // ==========================================================

  const formatCurrency = (
    value
  ) => {

    const amount =
      Number(value);

    if (
      Number.isNaN(amount)
    ) {

      return '₹0';

    }

    return `₹${amount.toLocaleString(
      'en-IN',
      {
        maximumFractionDigits: 2,
      }
    )}`;

  };


  // ==========================================================
  // EMPLOYEE NAME
  // ==========================================================

  const getEmployeeName = (
    record
  ) => {

    const firstName =
      record?.employee?.firstName ||
      '';

    const lastName =
      record?.employee?.lastName ||
      '';

    const fullName =
      `${firstName} ${lastName}`.trim();

    return (
      fullName ||
      'Unknown Employee'
    );

  };


  // ==========================================================
  // EMPLOYEE BASE SALARY
  // ==========================================================

  const getBaseSalary = (
    record
  ) => {

    // baseSalary is the employee's monthly salary.
    // basicSalary is attendance-earned regular salary and may already
    // reflect shortage hours, so it must not be used as the pending base.
    const salary =
      record?.baseSalary ??
      record?.monthlySalary ??
      0;

    return Number(salary) || 0;

  };


  // ==========================================================
  // LIVE ADVANCE DEDUCTION
  // ==========================================================

  const getAdvanceDeduction = (
    record
  ) => {

    const deduction =
      record?.advanceDeduction ??
      0;

    return Math.max(
      Number(deduction) || 0,
      0
    );

  };


  // ==========================================================
  // LIVE REGULAR PAYABLE AMOUNT
  // ==========================================================
  //
  // Example:
  //
  // Salary       = ₹30,000
  // Advance      = ₹2,000
  // Pending      = ₹28,000
  //
  // Another advance:
  //
  // Salary       = ₹30,000
  // Total advance = ₹7,000
  // Pending      = ₹23,000
  //
  // ==========================================================

  const getPendingAmount = (
    record
  ) => {

    const salary =
      getBaseSalary(record);

    const shortageDeduction =
      getShortageDeduction(record);

    const advance =
      getAdvanceDeduction(record);

    return Math.max(
      salary - shortageDeduction - advance,
      0
    );

  };


  // ==========================================================
  // ATTENDANCE / SHORTAGE HELPERS
  // ==========================================================

  const getRegularWorkingHours = (record) => {
    return Math.max(
      Number(record?.regularWorkingHours) || 0,
      0
    );
  };


  const getExtraHours = (record) => {
    return Math.max(
      Number(record?.extraHours) || 0,
      0
    );
  };


  const getShortageHours = (record) => {
    return Math.max(
      Number(record?.shortageHours) || 0,
      0
    );
  };


  const getShortageDeduction = (record) => {
    return Math.max(
      Number(record?.shortageDeduction) || 0,
      0
    );
  };

  // ==========================================================
  // RECORD BRANCH ID
  // ==========================================================

  const getRecordBranchId = (
    record
  ) => {

    const branchId =
      record?.branchId ??
      record?.employee?.branchId ??
      record?.employee?.branch?.branchId ??
      null;

    if (
      branchId === null ||
      branchId === undefined
    ) {

      return null;

    }

    const numericBranchId =
      Number(branchId);

    return Number.isInteger(
      numericBranchId
    )
      ? numericBranchId
      : null;

  };


  // ==========================================================
  // RECORD BRANCH NAME
  // ==========================================================

  const getRecordBranchName = (
    record
  ) => {

    if (
      record?.branch?.branchName
    ) {

      return (
        record.branch.branchName
      );

    }

    if (
      record?.employee?.branch?.branchName
    ) {

      return (
        record.employee.branch.branchName
      );

    }

    const branchId =
      getRecordBranchId(record);

    if (
      branchId === null
    ) {

      return '-';

    }

    const branch =
      branches.find(
        (item) =>
          Number(
            item.branchId
          ) === branchId
      );

    return (
      branch?.branchName ||
      `Branch ${branchId}`
    );

  };


  // ==========================================================
  // STATUS
  // ==========================================================

  const isPayrollPaid = (
    record
  ) => {

    return (
      String(
        record?.status || ''
      ).toUpperCase() === 'PAID' ||
      Boolean(record?.paymentDate)
    );

  };


  // ==========================================================
  // CURRENT PAYROLL RECORDS
  // ==========================================================

  const currentPayrollRecords =
    useMemo(() => {
      return records.filter((record) => {
        // Paid payrolls always belong to History.
        if (isPayrollPaid(record)) return false;

        const recordBranchId = getRecordBranchId(record);

        if (
          selectedBranch !== 'ALL' &&
          Number(recordBranchId) !== Number(selectedBranch)
        ) {
          return false;
        }

        if (recordBranchId === null) return false;

        // Current Payroll means the exact current period for this
        // payroll record's branch. Older and future unpaid records
        // must not appear in Current Payroll.
        const branchCurrentPeriod =
          currentPeriodsByBranch[Number(recordBranchId)];

        if (!branchCurrentPeriod) return false;

        const currentStart = getDateKey(
          branchCurrentPeriod.payPeriodStart ??
          branchCurrentPeriod.periodStart
        );

        const currentEnd = getDateKey(
          branchCurrentPeriod.payPeriodEnd ??
          branchCurrentPeriod.periodEnd
        );

        const recordStart = getDateKey(record.payPeriodStart);
        const recordEnd = getDateKey(record.payPeriodEnd);

        return Boolean(
          currentStart &&
          currentEnd &&
          recordStart &&
          recordEnd &&
          recordStart === currentStart &&
          recordEnd === currentEnd
        );
      });
    }, [records, selectedBranch, currentPeriodsByBranch]);


  // HISTORY RECORDS
  // ==========================================================

  const historyPayrollRecords =
    useMemo(() => {

      return records.filter(
        (record) =>
          isPayrollPaid(record)
      );

    }, [records]);


  // ==========================================================
  // FILTER CURRENT PAYROLL
  // ==========================================================

  const filteredCurrentPayroll =
    useMemo(() => {

      const searchTerm =
        search
          .trim()
          .toLowerCase();

      return currentPayrollRecords.filter(
        (record) => {

          // ----------------------------------------------------
          // BRANCH
          // ----------------------------------------------------

          if (
            selectedBranch !== 'ALL'
          ) {

            const branchId =
              getRecordBranchId(record);

            if (
              Number(branchId) !==
              Number(selectedBranch)
            ) {

              return false;

            }

          }


          // ----------------------------------------------------
          // SEARCH
          // ----------------------------------------------------

          if (!searchTerm) {
            return true;
          }

          const employeeName =
            getEmployeeName(
              record
            ).toLowerCase();

          const employeeId =
            String(
              record?.employeeId ??
              ''
            ).toLowerCase();

          const email =
            String(
              record?.employee?.email ??
              ''
            ).toLowerCase();

          const branchName =
            getRecordBranchName(
              record
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
            email.includes(
              searchTerm
            ) ||
            branchName.includes(
              searchTerm
            ) ||
            month.includes(
              searchTerm
            )
          );

        }
      );

    }, [
      currentPayrollRecords,
      search,
      selectedBranch,
      branches,
    ]);


  // ==========================================================
  // FILTER HISTORY
  // ==========================================================

  const filteredHistoryPayroll =
    useMemo(() => {

      const searchTerm =
        search
          .trim()
          .toLowerCase();

      return historyPayrollRecords.filter(
        (record) => {

          // ----------------------------------------------------
          // BRANCH
          // ----------------------------------------------------

          if (
            selectedBranch !== 'ALL'
          ) {

            const branchId =
              getRecordBranchId(record);

            if (
              Number(branchId) !==
              Number(selectedBranch)
            ) {

              return false;

            }

          }


          // ----------------------------------------------------
          // SEARCH
          // ----------------------------------------------------

          if (!searchTerm) {
            return true;
          }

          const employeeName =
            getEmployeeName(
              record
            ).toLowerCase();

          const employeeId =
            String(
              record?.employeeId ??
              ''
            ).toLowerCase();

          const email =
            String(
              record?.employee?.email ??
              ''
            ).toLowerCase();

          const branchName =
            getRecordBranchName(
              record
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
            email.includes(
              searchTerm
            ) ||
            branchName.includes(
              searchTerm
            ) ||
            month.includes(
              searchTerm
            )
          );

        }
      );

    }, [
      historyPayrollRecords,
      search,
      selectedBranch,
      branches,
    ]);


  // ==========================================================
  // CURRENT PAYMENT DATE
  // ==========================================================

  const getScheduledPaymentDate = (
    record
  ) => {

    if (
      record?.scheduledPaymentDate
    ) {

      return new Date(
        record.scheduledPaymentDate
      );

    }

    if (
      record?.paymentDate
    ) {

      return new Date(
        record.paymentDate
      );

    }

    if (
      currentPeriod?.paymentDate
    ) {

      return new Date(
        currentPeriod.paymentDate
      );

    }

    if (
      currentPeriod?.scheduledPaymentDate
    ) {

      return new Date(
        currentPeriod.scheduledPaymentDate
      );

    }

    return null;

  };


  // ==========================================================
  // CAN PAY
  // ==========================================================

  const canPayPayroll = (
    record
  ) => {

    if (
      isPayrollPaid(record)
    ) {

      return false;

    }

    const paymentDate =
      getScheduledPaymentDate(
        record
      );

    if (!paymentDate) {

      return false;

    }

    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const configuredDate =
      new Date(
        paymentDate
      );

    configuredDate.setHours(
      0,
      0,
      0,
      0
    );

    return (
      today >= configuredDate
    );

  };


  // ==========================================================
  // PAYROLL PAY ACTION
  // ==========================================================

  const handlePayPayroll =
    async (record) => {

      if (!record?.payrollId) {

        setPayrollError(
          'Payroll ID is missing.'
        );

        return;

      }

      if (
        isPayrollPaid(record)
      ) {

        return;

      }

      if (
        !canPayPayroll(record)
      ) {

        setPayrollError(
          `Payroll payment is not available until ${formatDate(
            getScheduledPaymentDate(record)
          )}.`
        );

        return;

      }

      setPayrollMessage('');
      setPayrollError('');
      setPaymentRecord(record);
    };


  // ==========================================================
  // CONFIRM PAYROLL PAYMENT
  // ==========================================================

  const handleConfirmPayrollPayment =
    async () => {

      if (!paymentRecord?.payrollId) {
        return;
      }

      try {

        setPayingPayrollId(
          paymentRecord.payrollId
        );

        setPayrollMessage('');
        setPayrollError('');

        await payrollService.pay(
          paymentRecord.payrollId
        );

        setPayrollMessage(
          `${getEmployeeName(
            paymentRecord
          )}'s payroll has been marked as paid successfully.`
        );

        setPaymentRecord(null);

        await loadPayroll();

      } catch (error) {

        console.error(
          'Failed to pay payroll:',
          error
        );

        setPayrollError(
          error?.response?.data?.message ||
          error?.message ||
          'Failed to process payroll payment.'
        );

      } finally {

        setPayingPayrollId(null);

      }

    };


  const handleClosePaymentDialog = () => {

    if (payingPayrollId !== null) {
      return;
    }

    setPaymentRecord(null);
  };

  // ==========================================================
  // CSV ESCAPE
  // ==========================================================

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


  // ==========================================================
  // EXPORT CURRENT/HISTORY
  // ==========================================================

  const handleExport = () => {

    const exportRecords =
      payrollView === 'CURRENT'
        ? filteredCurrentPayroll
        : filteredHistoryPayroll;

    if (
      exportRecords.length === 0
    ) {

      return;

    }

    const headers = [
      'Payroll ID',
      'Employee ID',
      'Employee Name',
      'Email',
      'Branch',
      'Pay Period Start',
      'Pay Period End',
      'Monthly Salary',
      'Regular Working Hours',
      'Extra Hours',
      'Shortage Hours',
      'Shortage Deduction',
      'Advance Deduction',
      'Pending / Net Salary',
      'Scheduled Payment Date',
      'Actual Payment Date',
      'Status',
    ];


    const rows =
      exportRecords.map(
        (record) => {

          const salary =
            getBaseSalary(record);

          const advance =
            getAdvanceDeduction(record);

          const pending =
            getPendingAmount(record);

          const regularWorkingHours =
            getRegularWorkingHours(record);

          const extraHours =
            getExtraHours(record);

          const shortageHours =
            getShortageHours(record);

          const shortageDeduction =
            getShortageDeduction(record);

          return [

            record.payrollId,

            record.employeeId,

            getEmployeeName(record),

            record.employee?.email ||
            '',

            getRecordBranchName(record),

            formatDate(
              record.payPeriodStart
            ),

            formatDate(
              record.payPeriodEnd
            ),

            salary,

            regularWorkingHours,

            extraHours,

            shortageHours,

            shortageDeduction,

            advance,

            isPayrollPaid(record)
              ? (
                record.netSalary ??
                pending
              )
              : pending,

            formatDate(
              getScheduledPaymentDate(
                record
              )
            ),

            formatDate(
              record.paymentDate
            ),

            isPayrollPaid(record)
              ? 'PAID'
              : 'UNPAID',

          ];

        }
      );


    const csv = [
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


    const blob =
      new Blob(
        [
          '\uFEFF' +
          csv,
        ],
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
      `payroll-${payrollView.toLowerCase()}-${date}.csv`;


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
  // TABLE COLUMNS
  // ==========================================================

  const columns = useMemo(() => {

    const baseColumns = [

      // --------------------------------------------------------
      // EMPLOYEE ID
      // --------------------------------------------------------

      {
        key: 'employeeId',
        label: 'Emp ID',

        render: (record) => (

          <span className="font-mono text-xs font-semibold text-navy-600">

            {record.employeeId}

          </span>

        ),

      },


      // --------------------------------------------------------
      // EMPLOYEE
      // --------------------------------------------------------

      {
        key: 'employee',
        label: 'Employee',

        render: (record) => (

          <div>

            <div className="font-medium text-navy-900">

              {getEmployeeName(record)}

            </div>

            {record.employee?.email && (

              <div className="text-xs text-navy-400">

                {record.employee.email}

              </div>

            )}

          </div>

        ),

      },


      // --------------------------------------------------------
      // BRANCH
      // --------------------------------------------------------

      {
        key: 'branch',
        label: 'Branch',

        render: (record) => (

          <span className="font-medium text-navy-700">

            {getRecordBranchName(record)}

          </span>

        ),

      },


      // --------------------------------------------------------
      // MONTH
      // --------------------------------------------------------

      {
        key: 'month',
        label: 'Month',

        render: (record) => (

          <div>

            <span className="text-navy-700 font-medium">

              {getPayrollMonth(record)}

            </span>

            <div className="text-xs text-navy-400 mt-1">

              {formatDate(
                record.payPeriodStart
              )}

              {' — '}

              {formatDate(
                record.payPeriodEnd
              )}

            </div>

          </div>

        ),

      },


      // --------------------------------------------------------
      // MONTHLY SALARY
      // --------------------------------------------------------

      {
        key: 'salary',
        label: 'Salary',
        align: 'right',

        render: (record) => (

          <span className="font-semibold text-navy-700">

            {formatCurrency(
              getBaseSalary(record)
            )}

          </span>

        ),

      },


      // --------------------------------------------------------
      // REGULAR WORKING HOURS
      // --------------------------------------------------------

      {
        key: 'regularWorkingHours',
        label: 'Regular Hours',
        align: 'right',

        render: (record) => (
          <span className="text-navy-600">
            {getRegularWorkingHours(record).toFixed(2)} h
          </span>
        ),

      },


      // --------------------------------------------------------
      // EXTRA HOURS
      // --------------------------------------------------------

      {
        key: 'extraHours',
        label: 'Extra Hours',
        align: 'right',

        render: (record) => {
          const hours = getExtraHours(record);

          return (
            <span className={hours > 0 ? 'font-semibold text-green-700' : 'text-navy-500'}>
              {hours.toFixed(2)} h
            </span>
          );
        },

      },


      // --------------------------------------------------------
      // SHORTAGE HOURS
      // --------------------------------------------------------

      {
        key: 'shortageHours',
        label: 'Shortage Hours',
        align: 'right',

        render: (record) => {
          const hours = getShortageHours(record);

          return (
            <span className={hours > 0 ? 'font-semibold text-error-600' : 'text-navy-500'}>
              {hours.toFixed(2)} h
            </span>
          );
        },

      },


      // --------------------------------------------------------
      // SHORTAGE DEDUCTION
      // --------------------------------------------------------

      {
        key: 'shortageDeduction',
        label: 'Shortage Deduction',
        align: 'right',

        render: (record) => {
          const deduction = getShortageDeduction(record);

          return (
            <span className={deduction > 0 ? 'font-semibold text-error-600' : 'text-navy-500'}>
              {deduction > 0
                ? `-${formatCurrency(deduction)}`
                : formatCurrency(0)
              }
            </span>
          );
        },

      },


      // --------------------------------------------------------
      // ADVANCE
      // --------------------------------------------------------

      {
        key: 'advanceDeduction',
        label: 'Advance',
        align: 'right',

        render: (record) => {

          const advance =
            getAdvanceDeduction(record);

          return (

            <span
              className={
                advance > 0
                  ? 'font-semibold text-error-600'
                  : 'text-navy-500'
              }
            >

              {advance > 0
                ? `-${formatCurrency(advance)}`
                : formatCurrency(0)
              }

            </span>

          );

        },

      },


      // --------------------------------------------------------
      // PENDING / NET
      // --------------------------------------------------------

      {
        key: 'pendingAmount',
        label:
          payrollView === 'CURRENT'
            ? 'Pending Amount'
            : 'Net Paid',
        align: 'right',

        render: (record) => {

          const amount =
            payrollView === 'CURRENT'
              ? getPendingAmount(record)
              : (
                record.netSalary ??
                getPendingAmount(record)
              );

          return (

            <span className="font-bold text-navy-900">

              {formatCurrency(amount)}

            </span>

          );

        },

      },


      // --------------------------------------------------------
      // PAYMENT DATE
      // --------------------------------------------------------

      {
        key: 'paymentDate',
        label:
          payrollView === 'CURRENT'
            ? 'Payment Date'
            : 'Paid On',

        render: (record) => {

          const date =
            payrollView === 'CURRENT'
              ? getScheduledPaymentDate(record)
              : record.paymentDate;

          return (

            <span className="text-navy-600 text-sm">

              {formatDate(date)}

            </span>

          );

        },

      },

    ];


    // ----------------------------------------------------------
    // CURRENT PAYROLL ACTION
    // ----------------------------------------------------------

    if (
      payrollView === 'CURRENT'
    ) {

      baseColumns.push({

        key: 'action',
        label: 'Action',
        align: 'right',

        render: (record) => {

          const paid =
            isPayrollPaid(record);

          const available =
            canPayPayroll(record);

          const isPaying =
            payingPayrollId ===
            record.payrollId;

          if (paid) {

            return (

              <div className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700">

                <CheckCircle2
                  size={16}
                />

                Paid

              </div>

            );

          }


          return (

            <div className="flex flex-col items-end gap-1">

              <button
                type="button"
                onClick={() =>
                  handlePayPayroll(record)
                }
                disabled={
                  !available ||
                  isPaying
                }
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-navy-800 text-white text-sm font-semibold hover:bg-navy-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  available
                    ? 'Pay payroll'
                    : `Payment available from ${formatDate(
                        getScheduledPaymentDate(record)
                      )}`
                }
              >

                {isPaying ? (

                  <>
                    <Loader2
                      size={15}
                      className="animate-spin"
                    />

                    Paying...

                  </>

                ) : (

                  <>
                    <Wallet
                      size={15}
                    />

                    Pay

                  </>

                )}

              </button>

              {!available && (

                <span className="text-[11px] text-navy-400">

                  Available from{' '}

                  {formatDate(
                    getScheduledPaymentDate(record)
                  )}

                </span>

              )}

            </div>

          );

        },

      });

    }


    // ----------------------------------------------------------
    // HISTORY STATUS
    // ----------------------------------------------------------

    if (
      payrollView === 'HISTORY'
    ) {

      baseColumns.push({

        key: 'status',
        label: 'Status',

        render: () => (

          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-semibold text-green-700">

            <CheckCircle2
              size={14}
            />

            PAID

          </span>

        ),

      });

    }


    return baseColumns;

  }, [
    payrollView,
    branches,
    payingPayrollId,
    currentPeriod,
    records,
  ]);


  // ==========================================================
  // PERIOD CARD
  // ==========================================================

  const renderPeriodCard = (
    title,
    period
  ) => {

    return (

      <div className="rounded-xl border border-navy-100 bg-white p-5">

        <div className="flex items-center gap-2 mb-4">

          <CalendarDays
            size={18}
            className="text-navy-600"
          />

          <h3 className="font-semibold text-navy-800">

            {title}

          </h3>

        </div>


        {!period ? (

          <p className="text-sm text-navy-400">

            Period information unavailable.

          </p>

        ) : (

          <div className="space-y-3">

            <div>

              <div className="text-xs text-navy-400">

                Payroll Period

              </div>

              <div className="text-base font-semibold text-navy-800">

                {formatDate(
                  period.payPeriodStart ??
                  period.periodStart
                )}

                {' → '}

                {formatDate(
                  period.payPeriodEnd ??
                  period.periodEnd
                )}

              </div>

            </div>


            <div>

              <div className="text-xs text-navy-400">

                Payment Date

              </div>

              <div className="text-sm font-semibold text-navy-700">

                {formatDate(
                  period.paymentDate ??
                  period.scheduledPaymentDate
                )}

              </div>

            </div>

          </div>

        )}

      </div>

    );

  };


  // ==========================================================
  // CURRENT VIEW COUNT
  // ==========================================================

  const displayedRecords =
    payrollView === 'CURRENT'
      ? filteredCurrentPayroll
      : filteredHistoryPayroll;


  // ==========================================================
  // LOADING
  // ==========================================================

  if (
    loading ||
    branchesLoading
  ) {

    return (

      <FullPageSpinner
        message="Loading payroll..."
      />

    );

  }


  // ==========================================================
  // PAGE
  // ==========================================================

  return (

    <div>

      {/* ======================================================
          HEADER
      ====================================================== */}

      <PageHeader

        title="Payroll"

        subtitle={
          payrollView === 'CURRENT'
            ? `${filteredCurrentPayroll.length} current payroll record${
                filteredCurrentPayroll.length !== 1
                  ? 's'
                  : ''
              }`
            : `${filteredHistoryPayroll.length} paid payroll record${
                filteredHistoryPayroll.length !== 1
                  ? 's'
                  : ''
              }`
        }

        actions={

          <div className="flex items-center gap-2">

            <button
              type="button"
              onClick={
                handleGenerateCurrentPayroll
              }
              disabled={
                generatingPayroll ||
                branches.length === 0
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-800 text-white hover:bg-navy-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >

              {generatingPayroll ? (

                <Loader2
                  size={17}
                  className="animate-spin"
                />

              ) : (

                <RefreshCw
                  size={17}
                />

              )}

              {generatingPayroll
                ? 'Generating...'
                : 'Generate Current'
              }

            </button>


            <button
              type="button"
              onClick={handleExport}
              disabled={
                displayedRecords.length === 0
              }
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >

              <Download
                size={18}
              />

              Export

            </button>

          </div>

        }

      />


      {/* ======================================================
          ACTION MESSAGE
      ====================================================== */}

      {payrollMessage && (

        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">

          {payrollMessage}

        </div>

      )}


      {payrollError && (

        <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">

          {payrollError}

        </div>

      )}


      {/* ======================================================
          CURRENT / HISTORY TABS
      ====================================================== */}

      <div className="mb-5 flex items-center gap-1 rounded-xl border border-navy-100 bg-white p-1 w-fit">

        <button
          type="button"
          onClick={() => {
            setPayrollView('CURRENT');
            setPayrollMessage('');
            setPayrollError('');
          }}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            payrollView === 'CURRENT'
              ? 'bg-navy-800 text-white'
              : 'text-navy-600 hover:bg-navy-50'
          }`}
        >

          <Wallet
            size={16}
          />

          Current Payroll

          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              payrollView === 'CURRENT'
                ? 'bg-white/15 text-white'
                : 'bg-navy-50 text-navy-600'
            }`}
          >

            {currentPayrollRecords.length}

          </span>

        </button>


        <button
          type="button"
          onClick={() => {
            setPayrollView('HISTORY');
            setPayrollMessage('');
            setPayrollError('');
          }}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            payrollView === 'HISTORY'
              ? 'bg-navy-800 text-white'
              : 'text-navy-600 hover:bg-navy-50'
          }`}
        >

          <CheckCircle2
            size={16}
          />

          Payroll History

          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              payrollView === 'HISTORY'
                ? 'bg-white/15 text-white'
                : 'bg-navy-50 text-navy-600'
            }`}
          >

            {historyPayrollRecords.length}

          </span>

        </button>

      </div>


      {/* ======================================================
          FILTERS
      ====================================================== */}

      <div className="mb-5 flex flex-col lg:flex-row gap-3">

        {/* ----------------------------------------------------
            BRANCH
        ----------------------------------------------------- */}

        <div className="w-full lg:w-64">

          <label
            htmlFor="payroll-branch"
            className="block text-xs font-medium text-navy-500 mb-1"
          >

            Branch

          </label>


          <select
            id="payroll-branch"
            value={selectedBranch}
            onChange={(event) =>
              setSelectedBranch(
                event.target.value
              )
            }
            className="w-full px-3 py-2 rounded-lg border border-navy-200 bg-white text-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-200"
          >

            <option value="ALL">

              All Branches

            </option>


            {branches.map(
              (branch) => (

                <option
                  key={branch.branchId}
                  value={branch.branchId}
                >

                  {branch.branchName}

                </option>

              )
            )}

          </select>

        </div>


        {/* ----------------------------------------------------
            SEARCH
        ----------------------------------------------------- */}

        <div className="flex-1">

          <label className="block text-xs font-medium text-navy-500 mb-1">

            Search Employee

          </label>


          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by employee name, ID, email or branch..."
          />

        </div>


        {/* ----------------------------------------------------
            REFRESH
        ----------------------------------------------------- */}

        <div className="flex items-end">

          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-navy-200 text-navy-700 hover:bg-navy-50 transition-colors"
          >

            <RefreshCw
              size={16}
            />

            Refresh

          </button>

        </div>

      </div>


      {/* ======================================================
          PAYROLL PERIOD SETTINGS
      ====================================================== */}

      <div className="mb-6 rounded-xl border border-navy-100 bg-navy-50/40 p-5">

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">

          <div>

            <div className="flex items-center gap-2">

              <Settings
                size={20}
                className="text-navy-600"
              />

              <h2 className="text-lg font-semibold text-navy-900">

                Payroll Period Settings

              </h2>

            </div>


            <p className="text-sm text-navy-500 mt-1">

              Set the payroll cycle and payment day.

            </p>

          </div>


          <div className="text-sm text-navy-500">

            Applied to:{' '}

            <span className="font-semibold text-navy-800">

              {selectedBranch === 'ALL'
                ? 'All Branches'
                : (
                    branches.find(
                      (branch) =>
                        Number(
                          branch.branchId
                        ) ===
                        Number(
                          selectedBranch
                        )
                    )?.branchName ||
                    `Branch ${selectedBranch}`
                  )}

            </span>

          </div>

        </div>


        {/* ----------------------------------------------------
            SUCCESS
        ----------------------------------------------------- */}

        {configurationMessage && (

          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">

            {configurationMessage}

          </div>

        )}


        {/* ----------------------------------------------------
            ERROR
        ----------------------------------------------------- */}

        {configurationError && (

          <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">

            {configurationError}

          </div>

        )}


        {/* ----------------------------------------------------
            LOADING
        ----------------------------------------------------- */}

        {configurationLoading ? (

          <div className="py-6 text-center text-sm text-navy-500">

            Loading payroll period settings...

          </div>

        ) : (

          <>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

              {/* =================================================
                  START DAY
              ================================================== */}

              <div>

                <label
                  htmlFor="payroll-start-day"
                  className="block text-xs font-medium text-navy-600 mb-1"
                >

                  Start Day

                </label>


                <input
                  id="payroll-start-day"
                  type="number"
                  min="1"
                  max="31"
                  value={
                    configuration.startDay
                  }
                  onChange={(event) =>
                    setConfiguration(
                      (previous) => ({
                        ...previous,
                        startDay:
                          event.target.value,
                      })
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg border border-navy-200 bg-white text-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-200"
                />


                <p className="mt-1 text-xs text-navy-400">

                  1–31

                </p>

              </div>


              {/* =================================================
                  END DAY
              ================================================== */}

              <div>

                <label
                  htmlFor="payroll-end-day"
                  className="block text-xs font-medium text-navy-600 mb-1"
                >

                  End Day

                </label>


                <input
                  id="payroll-end-day"
                  type="number"
                  min="0"
                  max="31"
                  value={
                    configuration.endDay
                  }
                  onChange={(event) =>
                    setConfiguration(
                      (previous) => ({
                        ...previous,
                        endDay:
                          event.target.value,
                      })
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg border border-navy-200 bg-white text-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-200"
                />


                <p className="mt-1 text-xs text-navy-500">

                  Enter 1–31. Use 0 for the last day of the month.

                </p>

              </div>


              {/* =================================================
                  PAYMENT DAY
              ================================================== */}

              <div>

                <label
                  htmlFor="payroll-payment-day"
                  className="block text-xs font-medium text-navy-600 mb-1"
                >

                  Payment Day

                </label>


                <input
                  id="payroll-payment-day"
                  type="number"
                  min="1"
                  max="31"
                  value={
                    configuration.paymentDay
                  }
                  onChange={(event) =>
                    setConfiguration(
                      (previous) => ({
                        ...previous,
                        paymentDay:
                          event.target.value,
                      })
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg border border-navy-200 bg-white text-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-200"
                />


                <p className="mt-1 text-xs text-navy-400">

                  1–31

                </p>

              </div>


              {/* =================================================
                  AUTOMATIC PAYROLL
              ================================================== */}

              <div>

                <label className="block text-xs font-medium text-navy-600 mb-1">

                  Automatic Payroll

                </label>


                <button
                  type="button"
                  onClick={() =>
                    setConfiguration(
                      (previous) => ({
                        ...previous,
                        enabled:
                          !previous.enabled,
                      })
                    )
                  }
                  className={`w-full px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    configuration.enabled
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-error-200 bg-error-50 text-error-700'
                  }`}
                >

                  {configuration.enabled
                    ? 'Enabled'
                    : 'Disabled'
                  }

                </button>


                <p className="mt-1 text-xs text-navy-400">

                  Controls automatic payroll generation

                </p>

              </div>

            </div>


            {/* --------------------------------------------------
                SAVE
            --------------------------------------------------- */}

            <div className="mt-5 flex justify-end">

              <button
                type="button"
                onClick={
                  handleSaveConfiguration
                }
                disabled={
                  configurationSaving ||
                  branches.length === 0
                }
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-navy-800 text-white hover:bg-navy-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >

                <Save
                  size={17}
                />

                {configurationSaving
                  ? 'Saving...'
                  : 'Save Configuration'
                }

              </button>

            </div>

          </>

        )}

      </div>


      {/* ======================================================
          CURRENT / NEXT PERIOD
      ====================================================== */}

      <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">

        {renderPeriodCard(
          'Current Payroll Period',
          currentPeriod
        )}

        {renderPeriodCard(
          'Next Payroll Period',
          nextPeriod
        )}

      </div>


      {/* ======================================================
          SUMMARY
      ====================================================== */}

      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* ----------------------------------------------------
            CURRENT
        ----------------------------------------------------- */}

        <div className="rounded-xl border border-navy-100 bg-white p-4">

          <div className="text-xs font-medium text-navy-400">

            Current Payroll

          </div>

          <div className="mt-1 text-2xl font-bold text-navy-900">

            {currentPayrollRecords.length}

          </div>

          <div className="mt-1 text-xs text-navy-500">

            Unpaid payroll records

          </div>

        </div>


        {/* ----------------------------------------------------
            HISTORY
        ----------------------------------------------------- */}

        <div className="rounded-xl border border-navy-100 bg-white p-4">

          <div className="text-xs font-medium text-navy-400">

            Payroll History

          </div>

          <div className="mt-1 text-2xl font-bold text-navy-900">

            {historyPayrollRecords.length}

          </div>

          <div className="mt-1 text-xs text-navy-500">

            Paid payroll records

          </div>

        </div>


        {/* ----------------------------------------------------
            TOTAL PENDING
        ----------------------------------------------------- */}

        <div className="rounded-xl border border-navy-100 bg-white p-4">

          <div className="text-xs font-medium text-navy-400">

            Total Pending

          </div>

          <div className="mt-1 text-2xl font-bold text-navy-900">

            {formatCurrency(
              filteredCurrentPayroll.reduce(
                (total, record) =>
                  total +
                  getPendingAmount(
                    record
                  ),
                0
              )
            )}

          </div>

          <div className="mt-1 text-xs text-navy-500">

            After shortage and advance deductions

          </div>

        </div>

      </div>


      {/* ======================================================
          SELECTED BRANCH
      ====================================================== */}

      <div className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-navy-50 border border-navy-100">

        <span className="text-xs text-navy-500">

          Showing:

        </span>


        <span className="text-sm font-semibold text-navy-800">

          {selectedBranch === 'ALL'
            ? 'All Branches'
            : (
                branches.find(
                  (branch) =>
                    Number(
                      branch.branchId
                    ) ===
                    Number(
                      selectedBranch
                    )
                )?.branchName ||
                `Branch ${selectedBranch}`
              )}

        </span>

      </div>


      {/* ======================================================
          PAYROLL PAYMENT DIALOG
      ====================================================== */}

      {paymentRecord && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">

          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-navy-100">

            <div className="border-b border-navy-100 px-6 py-4">

              <div className="flex items-center justify-between gap-4">

                <div>
                  <h2 className="text-lg font-bold text-navy-900">
                    Confirm Payroll Payment
                  </h2>

                  <p className="mt-1 text-sm text-navy-500">
                    {getEmployeeName(paymentRecord)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleClosePaymentDialog}
                  disabled={payingPayrollId !== null}
                  className="rounded-lg px-3 py-1.5 text-sm text-navy-500 hover:bg-navy-50 disabled:opacity-50"
                >
                  Close
                </button>

              </div>

            </div>


            <div className="p-6 space-y-4">

              <div className="grid grid-cols-2 gap-3">

                <div className="rounded-lg border border-navy-100 bg-navy-50/50 p-3">
                  <div className="text-xs text-navy-400">
                    Payroll Salary
                  </div>

                  <div className="mt-1 font-bold text-navy-900">
                    {formatCurrency(
                      getBaseSalary(paymentRecord)
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-navy-100 bg-navy-50/50 p-3">
                  <div className="text-xs text-navy-400">
                    Advance Deduction
                  </div>

                  <div className="mt-1 font-bold text-navy-900">
                    {formatCurrency(
                      getAdvanceDeduction(paymentRecord)
                    )}
                  </div>
                </div>

              </div>


              <div className="rounded-lg border border-navy-100 bg-white p-4">

                <div className="flex items-center justify-between text-sm">

                  <span className="text-navy-500">
                    Regular payable amount
                  </span>

                  <span className="font-semibold text-navy-800">
                    {formatCurrency(
                      getPendingAmount(paymentRecord)
                    )}
                  </span>

                </div>


                <div className="mt-3 border-t border-navy-100 pt-3 flex items-center justify-between">

                  <span className="font-semibold text-navy-700">
                    Total payroll payment
                  </span>

                  <span className="text-xl font-bold text-navy-900">
                    {formatCurrency(
                      getPendingAmount(paymentRecord)
                    )}
                  </span>

                </div>

              </div>


              <div className="rounded-lg border border-navy-100 bg-navy-50/50 px-4 py-3">

                <p className="text-xs text-navy-500">
                  Extra-hours bonuses are managed separately in the Bonus Payments module.
                  Paying payroll here only processes the employee's regular salary.
                </p>

              </div>

            </div>


            <div className="flex justify-end gap-3 border-t border-navy-100 px-6 py-4">

              <button
                type="button"
                onClick={handleClosePaymentDialog}
                disabled={payingPayrollId !== null}
                className="rounded-lg border border-navy-200 px-4 py-2 text-sm font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmPayrollPayment}
                disabled={payingPayrollId !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >

                {payingPayrollId !== null ? (
                  <>
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                    Paying...
                  </>
                ) : (
                  <>
                    <Wallet size={16} />
                    Confirm Payment
                  </>
                )}

              </button>

            </div>

          </div>

        </div>

      )}

      {/* ======================================================
          PAYROLL TABLE
      ====================================================== */}

      {displayedRecords.length === 0 ? (

        <EmptyState
          icon={
            payrollView === 'CURRENT'
              ? Wallet
              : CheckCircle2
          }
          title={
            payrollView === 'CURRENT'
              ? 'No current payroll records'
              : 'No payroll history'
          }
          message={
            search
              ? 'No payroll records match your search.'
              : payrollView === 'CURRENT'
                ? 'Current payroll records will appear here.'
                : 'Paid payroll records will appear here after payroll is processed.'
          }
        />

      ) : (

        <DataTable
          columns={columns}
          data={displayedRecords}
        />

      )}

    </div>

  );

}


// ============================================================
// DEFAULT EXPORT
// ============================================================
export default AdminPayroll;