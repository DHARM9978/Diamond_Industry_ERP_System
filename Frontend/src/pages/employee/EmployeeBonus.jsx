import { useEffect, useMemo, useState } from 'react';

import {
  CheckCircle2,
  Clock3,
  Wallet,
} from 'lucide-react';

import {
  PageHeader,
  DataTable,
} from '@/components/ui/PageComponents';

import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

import { bonusService } from '@/services/apiServices';


// ============================================================
// HELPERS
// ============================================================

const unwrap = (response) => {
  return (
    response?.data?.data ??
    response?.data ??
    response
  );
};


const getArray = (response) => {
  const data = unwrap(response);

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.records)) {
    return data.records;
  }

  if (Array.isArray(data?.settlements)) {
    return data.settlements;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
};


const getNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
};


const formatNumber = (value) => {
  return getNumber(value).toLocaleString(
    'en-IN',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
};


const formatCurrency = (value) => {
  return `₹${getNumber(value).toLocaleString(
    'en-IN',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
};


const formatDate = (value) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
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


const formatPayPeriod = (record) => {
  if (
    !record?.payPeriodStart &&
    !record?.payPeriodEnd
  ) {
    return '—';
  }

  const start = record.payPeriodStart
    ? formatDate(record.payPeriodStart)
    : '—';

  const end = record.payPeriodEnd
    ? formatDate(record.payPeriodEnd)
    : '—';

  return `${start} - ${end}`;
};


// ============================================================
// EMPLOYEE BONUS PAGE
// ============================================================

export function EmployeeBonus() {
  const [bonusData, setBonusData] = useState({
    extraWork: [],
    settlements: [],
    summary: {},
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadBonuses = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await bonusService.myBonuses();
        const data = unwrap(response);

        const extraWork = Array.isArray(data?.extraWork)
          ? data.extraWork
          : [];

        const settlements = Array.isArray(data?.settlements)
          ? data.settlements
          : Array.isArray(data?.records)
            ? data.records
            : Array.isArray(data)
              ? data
              : [];

        const summary =
          data?.summary && typeof data.summary === 'object'
            ? data.summary
            : {};

        if (isMounted) {
          setBonusData({
            extraWork,
            settlements,
            summary,
          });
        }
      } catch (loadError) {
        console.error('Failed to load bonus history:', loadError);

        if (isMounted) {
          setBonusData({
            extraWork: [],
            settlements: [],
            summary: {},
          });

          setError(
            loadError?.response?.data?.message ||
              loadError?.message ||
              'Failed to load your bonus payment history.'
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadBonuses();

    return () => {
      isMounted = false;
    };
  }, []);

  const pendingRecords = useMemo(() => {
    return [...bonusData.extraWork]
      .filter((record) => {
        const hours = getNumber(record?.extraHours);
        const status = String(record?.status || '').toUpperCase();

        return hours > 0 && status === 'ACCUMULATED';
      })
      .sort(
        (a, b) =>
          new Date(b?.createdAt || 0) -
          new Date(a?.createdAt || 0)
      );
  }, [bonusData.extraWork]);

  const settledRecords = useMemo(() => {
    return [...bonusData.settlements].sort(
      (a, b) =>
        new Date(
          b?.settlementDate ||
            b?.createdAt ||
            0
        ) -
        new Date(
          a?.settlementDate ||
            a?.createdAt ||
            0
        )
    );
  }, [bonusData.settlements]);

  const pendingHours = useMemo(() => {
    const summaryValue = getNumber(
      bonusData.summary?.accumulatedExtraHours
    );

    if (summaryValue > 0) {
      return summaryValue;
    }

    return pendingRecords.reduce(
      (total, record) =>
        total + getNumber(record?.extraHours),
      0
    );
  }, [bonusData.summary, pendingRecords]);

  const totalBonus = useMemo(() => {
    const summaryValue = getNumber(
      bonusData.summary?.totalBonusPaid
    );

    if (summaryValue > 0) {
      return summaryValue;
    }

    return settledRecords.reduce(
      (total, record) =>
        total + getNumber(record?.incentiveAmount),
      0
    );
  }, [bonusData.summary, settledRecords]);

  const totalSettledHours = useMemo(() => {
    const summaryValue = getNumber(
      bonusData.summary?.totalSettledHours
    );

    if (summaryValue > 0) {
      return summaryValue;
    }

    return settledRecords.reduce(
      (total, record) =>
        total + getNumber(record?.settledHours),
      0
    );
  }, [bonusData.summary, settledRecords]);

  const getRecordPeriod = (record) => {
    if (
      record?.payPeriodStart ||
      record?.payPeriodEnd
    ) {
      return formatPayPeriod(record);
    }

    if (record?.payroll?.payPeriodStart || record?.payroll?.payPeriodEnd) {
      return formatPayPeriod({
        payPeriodStart:
          record.payroll.payPeriodStart,
        payPeriodEnd:
          record.payroll.payPeriodEnd,
      });
    }

    return '—';
  };

  const pendingColumns = [
    {
      key: 'period',
      label: 'Pay Period',
      render: (record) => (
        <div>
          <div className="font-medium text-navy-900">
            {getRecordPeriod(record)}
          </div>

          {record?.payrollId && (
            <div className="mt-1 text-xs text-navy-500">
              Payroll #{record.payrollId}
            </div>
          )}
        </div>
      ),
    },

    {
      key: 'extraHours',
      label: 'Extra Hours',
      align: 'right',
      render: (record) => (
        <span className="font-medium text-amber-700">
          {formatNumber(record?.extraHours)} hrs
        </span>
      ),
    },

    {
      key: 'recordedDate',
      label: 'Recorded',
      align: 'right',
      render: (record) =>
        formatDate(record?.createdAt),
    },

    {
      key: 'status',
      label: 'Status',
      align: 'center',
      render: () => (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
          <Clock3 size={13} />
          Pending
        </span>
      ),
    },
  ];

  const settlementColumns = [
    {
      key: 'payPeriod',
      label: 'Pay Period',
      render: (record) => (
        <div>
          <div className="font-medium text-navy-900">
            {getRecordPeriod(record)}
          </div>

          {record?.payrollId && (
            <div className="mt-1 text-xs text-navy-500">
              Payroll #{record.payrollId}
            </div>
          )}
        </div>
      ),
    },

    {
      key: 'settledHours',
      label: 'Extra Hours',
      align: 'right',
      render: (record) => (
        <span className="font-medium text-navy-900">
          {formatNumber(record?.settledHours)} hrs
        </span>
      ),
    },

    {
      key: 'incentiveAmount',
      label: 'Bonus Paid',
      align: 'right',
      render: (record) => (
        <span className="font-bold text-navy-900">
          {formatCurrency(record?.incentiveAmount)}
        </span>
      ),
    },

    {
      key: 'settlementDate',
      label: 'Payment Date',
      align: 'right',
      render: (record) =>
        formatDate(record?.settlementDate),
    },

    {
      key: 'settlementId',
      label: 'Settlement',
      align: 'center',
      render: (record) => (
        <span className="text-navy-600">
          #{record?.settlementId || '—'}
        </span>
      ),
    },

    {
      key: 'status',
      label: 'Status',
      align: 'center',
      render: () => (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
          <CheckCircle2 size={13} />
          Paid
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <FullPageSpinner
        message="Loading your bonus payments..."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Bonuses"
        subtitle="Your extra-work bonus and payment history"
      />

      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-navy-100 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Clock3 size={20} />
            </div>

            <div>
              <div className="text-xs font-medium text-navy-500">
                Pending Extra Hours
              </div>

              <div className="mt-1 text-2xl font-bold text-navy-900">
                {formatNumber(pendingHours)}
                <span className="ml-1 text-sm font-medium text-navy-500">
                  hrs
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-navy-100 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700">
              <Wallet size={20} />
            </div>

            <div>
              <div className="text-xs font-medium text-navy-500">
                Total Bonus Paid
              </div>

              <div className="mt-1 text-2xl font-bold text-navy-900">
                {formatCurrency(totalBonus)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-navy-100 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <CheckCircle2 size={20} />
            </div>

            <div>
              <div className="text-xs font-medium text-navy-500">
                Extra Hours Settled
              </div>

              <div className="mt-1 text-2xl font-bold text-navy-900">
                {formatNumber(totalSettledHours)}
                <span className="ml-1 text-sm font-medium text-navy-500">
                  hrs
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {pendingRecords.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-navy-900">
              Pending Bonus Hours
            </h2>

            <p className="mt-1 text-sm text-navy-500">
              Extra-work hours currently accumulated and awaiting bonus settlement.
            </p>
          </div>

          <DataTable
            columns={pendingColumns}
            data={pendingRecords}
          />
        </section>
      )}

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-navy-900">
            Bonus Payment History
          </h2>

          <p className="mt-1 text-sm text-navy-500">
            Your settled extra-work hours and corresponding bonus payments.
          </p>
        </div>

        {settledRecords.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No bonus payments"
            message="Your settled extra-work bonuses will appear here once they are processed."
          />
        ) : (
          <DataTable
            columns={settlementColumns}
            data={settledRecords}
          />
        )}
      </section>
    </div>
  );
}

export default EmployeeBonus;
