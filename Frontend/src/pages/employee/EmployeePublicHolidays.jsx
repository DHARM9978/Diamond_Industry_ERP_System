import { useEffect, useMemo, useState } from 'react';

import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RefreshCw,
  XCircle,
} from 'lucide-react';

import {
  PageHeader,
  DataTable,
} from '@/components/ui/PageComponents';

import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

import { publicHolidayService } from '@/services/apiServices';

import {
  formatISTDate,
  getISTDateString,
} from '@/utils/dateTime';


// ============================================================
// HELPERS
// ============================================================

const unwrapResponse = (response) => {
  return (
    response?.data?.data ??
    response?.data ??
    response
  );
};


const getHolidayArray = (response) => {
  const data = unwrapResponse(response);

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.holidays)) {
    return data.holidays;
  }

  if (Array.isArray(data?.records)) {
    return data.records;
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


const getDateKey = (value) => {
  if (!value) {
    return '';
  }

  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return value;
  }

  return getISTDateString(value);
};


const formatDate = (value) => {
  return formatISTDate(value, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};


const getTodayKey = () => {
  return getDateKey(new Date());
};


const formatHours = (value) => {
  const hours = getNumber(value);

  return hours.toLocaleString(
    'en-IN',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
};


const getHolidayName = (holiday) => {
  return (
    holiday?.holidayName ||
    holiday?.name ||
    'Public Holiday'
  );
};


const getHolidayDate = (holiday) => {
  return (
    holiday?.holidayDate ||
    holiday?.date ||
    null
  );
};


const isPaidHoliday = (holiday) => {
  return Boolean(
    holiday?.isPaid ??
    holiday?.paid ??
    false
  );
};


const getDailyHours = (holiday) => {
  return getNumber(
    holiday?.dailyWorkingHours ??
    holiday?.workingHours ??
    0
  );
};


const buildCalendarDays = (year, monthIndex) => {
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const leadingDays = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();
  const cells = [];

  for (let index = 0; index < leadingDays; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(
      [
        String(year),
        String(monthIndex + 1).padStart(2, '0'),
        String(day).padStart(2, '0'),
      ].join('-')
    );
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};


const getCalendarMonthLabel = (year, monthIndex) => {
  return new Date(
    year,
    monthIndex,
    1
  ).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
};


// ============================================================
// EMPLOYEE PUBLIC HOLIDAYS
// ============================================================

export function EmployeePublicHolidays() {

  // ==========================================================
  // STATE
  // ==========================================================

  const currentYear = new Date().getFullYear();

  const [selectedYear, setSelectedYear] =
    useState(currentYear);

  const [holidays, setHolidays] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');

  const [calendarMonth, setCalendarMonth] =
    useState(new Date().getMonth());

  const [selectedHoliday, setSelectedHoliday] =
    useState(null);


  // ==========================================================
  // LOAD HOLIDAYS
  // ==========================================================

  const loadHolidays = async (
    showFullLoader = true
  ) => {

    try {

      if (showFullLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError('');

      const response =
        await publicHolidayService.my({
          year: Number(selectedYear),
        });

      const records =
        getHolidayArray(response);

      setHolidays(records);

    } catch (loadError) {

      console.error(
        'Failed to load public holidays:',
        loadError
      );

      setHolidays([]);

      setError(
        loadError?.response?.data?.message ||
        loadError?.message ||
        'Failed to load public holidays.'
      );

    } finally {

      setLoading(false);
      setRefreshing(false);

    }
  };


  useEffect(() => {

    let mounted = true;

    const load = async () => {

      try {

        setLoading(true);
        setError('');

        const response =
          await publicHolidayService.my({
            year: Number(selectedYear),
          });

        if (!mounted) {
          return;
        }

        setHolidays(
          getHolidayArray(response)
        );

      } catch (loadError) {

        if (!mounted) {
          return;
        }

        console.error(
          'Failed to load public holidays:',
          loadError
        );

        setHolidays([]);

        setError(
          loadError?.response?.data?.message ||
          loadError?.message ||
          'Failed to load public holidays.'
        );

      } finally {

        if (mounted) {
          setLoading(false);
        }

      }

    };

    load();

    return () => {
      mounted = false;
    };

  }, [selectedYear]);


  useEffect(() => {
    setSelectedHoliday(null);

    if (Number(selectedYear) === Number(currentYear)) {
      setCalendarMonth(new Date().getMonth());
    } else {
      setCalendarMonth(0);
    }
  }, [selectedYear, currentYear]);


  // ==========================================================
  // NORMALIZE + SORT
  // ==========================================================

  const sortedHolidays = useMemo(() => {

    return [...holidays].sort(
      (a, b) => {

        const dateA =
          getDateKey(
            getHolidayDate(a)
          );

        const dateB =
          getDateKey(
            getHolidayDate(b)
          );

        return dateA.localeCompare(
          dateB
        );

      }
    );

  }, [holidays]);


  // ==========================================================
  // CALENDAR
  // ==========================================================

  const calendarDays = useMemo(
    () =>
      buildCalendarDays(
        Number(selectedYear),
        calendarMonth
      ),
    [selectedYear, calendarMonth]
  );


  const calendarHolidayMap = useMemo(() => {
    const map = new Map();

    sortedHolidays.forEach((holiday) => {
      const dateKey = getDateKey(
        getHolidayDate(holiday)
      );

      if (dateKey) {
        map.set(dateKey, holiday);
      }
    });

    return map;
  }, [sortedHolidays]);


  const calendarMonthLabel =
    getCalendarMonthLabel(
      Number(selectedYear),
      calendarMonth
    );

  const goToPreviousCalendarMonth = () => {
    if (calendarMonth <= 0) {
      return;
    }

    setCalendarMonth((month) => month - 1);
    setSelectedHoliday(null);
  };


  const goToNextCalendarMonth = () => {
    if (calendarMonth >= 11) {
      return;
    }

    setCalendarMonth((month) => month + 1);
    setSelectedHoliday(null);
  };


  const handleCalendarHolidayClick = (holiday) => {
    setSelectedHoliday(holiday || null);
  };


  // ==========================================================
  // DATE GROUPS
  // ==========================================================

  const todayKey =
    getTodayKey();

  const upcomingHolidays =
    useMemo(() => {

      return sortedHolidays.filter(
        (holiday) => {

          const dateKey =
            getDateKey(
              getHolidayDate(holiday)
            );

          return (
            dateKey >= todayKey
          );

        }
      );

    }, [
      sortedHolidays,
      todayKey,
    ]);


  const paidHolidayCount =
    sortedHolidays.filter(
      (holiday) =>
        isPaidHoliday(holiday)
    ).length;


  const unpaidHolidayCount =
    sortedHolidays.length -
    paidHolidayCount;


  const totalPaidHours =
    sortedHolidays.reduce(
      (total, holiday) => {

        if (
          !isPaidHoliday(holiday)
        ) {
          return total;
        }

        return (
          total +
          getDailyHours(holiday)
        );

      },
      0
    );


  // ==========================================================
  // STATUS
  // ==========================================================

  const getDateStatus = (
    holiday
  ) => {

    const dateKey =
      getDateKey(
        getHolidayDate(holiday)
      );

    if (
      dateKey === todayKey
    ) {
      return 'TODAY';
    }

    if (
      dateKey > todayKey
    ) {
      return 'UPCOMING';
    }

    return 'PAST';
  };


  // ==========================================================
  // TABLE COLUMNS
  // ==========================================================

  const columns = [

    {
      key: 'holidayDate',
      header: 'Date',
      align: 'left',
      render: (holiday) => {

        const status =
          getDateStatus(
            holiday
          );

        return (
          <div className="flex flex-col">

            <span className="font-medium text-navy-900">
              {formatDate(
                getHolidayDate(
                  holiday
                )
              )}
            </span>

            {status === 'TODAY' && (
              <span className="mt-1 inline-flex w-fit items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                Today
              </span>
            )}

            {status === 'UPCOMING' && (
              <span className="mt-1 inline-flex w-fit items-center rounded-full bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-700">
                Upcoming
              </span>
            )}

          </div>
        );

      },
    },

    {
      key: 'holidayName',
      header: 'Holiday',
      align: 'left',
      render: (holiday) => (
        <span className="font-medium text-navy-900">
          {getHolidayName(
            holiday
          )}
        </span>
      ),
    },

    {
      key: 'isPaid',
      header: 'Type',
      align: 'center',
      render: (holiday) => {

        const paid =
          isPaidHoliday(
            holiday
          );

        return (
          <span
            className={
              paid
                ? 'inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700'
                : 'inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-600'
            }
          >

            {paid ? (
              <CheckCircle2
                size={14}
              />
            ) : (
              <XCircle
                size={14}
              />
            )}

            {paid
              ? 'Paid Holiday'
              : 'Unpaid Holiday'}

          </span>
        );

      },
    },

    {
      key: 'dailyWorkingHours',
      header: 'Working Hours',
      align: 'center',
      render: (holiday) => {

        const paid =
          isPaidHoliday(
            holiday
          );

        if (!paid) {
          return (
            <span className="text-navy-400">
              0.00 hrs
            </span>
          );
        }

        return (
          <span className="font-medium text-navy-800">
            {formatHours(
              getDailyHours(
                holiday
              )
            )}{' '}
            hrs
          </span>
        );

      },
    },

  ];


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {

    return (
      <FullPageSpinner
        message="Loading public holidays..."
      />
    );

  }


  // ==========================================================
  // PAGE
  // ==========================================================

  return (

    <div className="space-y-6">

      <PageHeader
        title="Public Holidays"
        subtitle="View the public holidays configured for your branch."
      />


      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (

        <div className="rounded-xl border border-error-100 bg-error-50 p-4">

          <div className="flex items-start gap-3">

            <XCircle
              size={20}
              className="mt-0.5 shrink-0 text-error-700"
            />

            <div className="flex-1">

              <p className="font-semibold text-error-800">
                Unable to load public holidays
              </p>

              <p className="mt-1 text-sm text-error-700">
                {error}
              </p>

            </div>

            <button
              type="button"
              onClick={() =>
                loadHolidays(true)
              }
              className="rounded-lg border border-error-200 bg-white px-3 py-2 text-sm font-semibold text-error-700 hover:bg-error-100"
            >
              Retry
            </button>

          </div>

        </div>

      )}


      {/* ======================================================
          FILTER / REFRESH
      ====================================================== */}

      <section className="rounded-xl border border-navy-100 bg-white p-4">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <h2 className="text-base font-semibold text-navy-900">
              Holiday Calendar
            </h2>

            <p className="mt-1 text-sm text-navy-500">
              These holidays apply to your assigned branch.
            </p>

          </div>


          <div className="flex flex-wrap items-center gap-3">

            <label
              htmlFor="public-holiday-year"
              className="text-sm font-medium text-navy-700"
            >
              Year
            </label>

            <select
              id="public-holiday-year"
              value={selectedYear}
              onChange={(event) =>
                setSelectedYear(
                  Number(event.target.value)
                )
              }
              className="rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-800 outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-100"
            >

              {[
                currentYear - 1,
                currentYear,
                currentYear + 1,
                currentYear + 2,
              ].map((year) => (
                <option
                  key={year}
                  value={year}
                >
                  {year}
                </option>
              ))}

            </select>


            <button
              type="button"
              onClick={() =>
                loadHolidays(false)
              }
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm font-semibold text-navy-700 hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-50"
            >

              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? 'animate-spin'
                    : ''
                }
              />

              Refresh

            </button>

          </div>

        </div>

      </section>


      {/* ======================================================
          SUMMARY
      ====================================================== */}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        <div className="rounded-xl border border-navy-100 bg-white p-5">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <CalendarDays size={20} />
            </div>

            <div>

              <div className="text-xs font-medium text-navy-500">
                Total Holidays
              </div>

              <div className="mt-1 text-2xl font-bold text-navy-900">
                {sortedHolidays.length}
              </div>

            </div>

          </div>

        </div>


        <div className="rounded-xl border border-navy-100 bg-white p-5">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-50 text-success-700">
              <CheckCircle2 size={20} />
            </div>

            <div>

              <div className="text-xs font-medium text-navy-500">
                Paid Holidays
              </div>

              <div className="mt-1 text-2xl font-bold text-navy-900">
                {paidHolidayCount}
              </div>

            </div>

          </div>

        </div>


        <div className="rounded-xl border border-navy-100 bg-white p-5">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
              <XCircle size={20} />
            </div>

            <div>

              <div className="text-xs font-medium text-navy-500">
                Unpaid Holidays
              </div>

              <div className="mt-1 text-2xl font-bold text-navy-900">
                {unpaidHolidayCount}
              </div>

            </div>

          </div>

        </div>


        <div className="rounded-xl border border-navy-100 bg-white p-5">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Clock3 size={20} />
            </div>

            <div>

              <div className="text-xs font-medium text-navy-500">
                Paid Holiday Hours
              </div>

              <div className="mt-1 text-2xl font-bold text-navy-900">
                {formatHours(
                  totalPaidHours
                )}
              </div>

            </div>

          </div>

        </div>

      </section>


      {/* ======================================================
          HOLIDAY LIST
      ====================================================== */}

      <section>

        <div className="mb-4">

          <h2 className="text-lg font-semibold text-navy-900">
            {selectedYear} Public Holidays
          </h2>

          <p className="mt-1 text-sm text-navy-500">
            Public holidays configured by your administrator for your branch.
          </p>

        </div>


        {sortedHolidays.length === 0 ? (

          <EmptyState
            icon={CalendarDays}
            title="No public holidays"
            message={`No public holidays have been configured for your branch in ${selectedYear}.`}
          />

        ) : (

          <DataTable
            columns={columns}
            data={sortedHolidays}
          />

        )}

      </section>


      {/* ======================================================
          UPCOMING + CALENDAR
      ====================================================== */}

      {sortedHolidays.length > 0 && (

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-stretch">

          <div className="rounded-xl border border-navy-100 bg-white p-5">

            <div className="mb-4 flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-50 text-success-700">
                <CalendarDays size={20} />
              </div>

              <div>

                <h3 className="font-semibold text-navy-900">
                  Upcoming & Today
                </h3>

                <p className="text-sm text-navy-500">
                  {upcomingHolidays.length} holiday
                  {upcomingHolidays.length === 1
                    ? ''
                    : 's'}
                </p>

              </div>

            </div>


            {upcomingHolidays.length === 0 ? (

              <p className="rounded-lg bg-navy-50 p-4 text-sm text-navy-500">
                There are no upcoming public holidays for this year.
              </p>

            ) : (

              <div className="space-y-3">

                {upcomingHolidays.map(
                  (holiday) => {

                    const status =
                      getDateStatus(
                        holiday
                      );

                    const paid =
                      isPaidHoliday(
                        holiday
                      );

                    return (

                      <div
                        key={
                          holiday?.publicHolidayId ??
                          `${getDateKey(
                            getHolidayDate(
                              holiday
                            )
                          )}-${getHolidayName(
                            holiday
                          )}`
                        }
                        className="rounded-lg border border-navy-100 p-4"
                      >

                        <div className="flex items-start justify-between gap-4">

                          <div>

                            <p className="font-semibold text-navy-900">
                              {getHolidayName(
                                holiday
                              )}
                            </p>

                            <p className="mt-1 text-sm text-navy-500">
                              {formatDate(
                                getHolidayDate(
                                  holiday
                                )
                              )}
                            </p>

                          </div>

                          <span
                            className={
                              status === 'TODAY'
                                ? 'rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700'
                                : 'rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700'
                            }
                          >
                            {status === 'TODAY'
                              ? 'Today'
                              : 'Upcoming'}
                          </span>

                        </div>


                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">

                          <span
                            className={
                              paid
                                ? 'rounded-full bg-success-50 px-2.5 py-1 font-semibold text-success-700'
                                : 'rounded-full bg-navy-50 px-2.5 py-1 font-semibold text-navy-600'
                            }
                          >
                            {paid
                              ? 'Paid'
                              : 'Unpaid'}
                          </span>

                          {paid && (
                            <span className="text-navy-500">
                              {formatHours(
                                getDailyHours(
                                  holiday
                                )
                              )}{' '}
                              paid hours
                            </span>
                          )}

                        </div>

                      </div>

                    );

                  }
                )}

              </div>

            )}

          </div>


          <div className="min-w-0">

            <section className="h-full rounded-xl border border-navy-100 bg-white p-4">

        <div className="mb-3 flex items-center justify-between gap-2">

          <div>
            <h2 className="text-sm font-semibold text-navy-900">
              {calendarMonthLabel}
            </h2>

            <p className="mt-0.5 text-[10px] leading-4 text-navy-500">
              Public holidays for your assigned branch are highlighted on the calendar.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToPreviousCalendarMonth}
              disabled={calendarMonth === 0}
              aria-label="Previous month"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-navy-200 bg-white text-navy-700 hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={15} />
            </button>

            <button
              type="button"
              onClick={goToNextCalendarMonth}
              disabled={calendarMonth === 11}
              aria-label="Next month"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-navy-200 bg-white text-navy-700 hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={15} />
            </button>
          </div>

        </div>

        <div className="overflow-x-auto">
          <div className="w-full">

            <div className="grid grid-cols-7 border-b border-navy-100">
              {[
                'Mon',
                'Tue',
                'Wed',
                'Thu',
                'Fri',
                'Sat',
                'Sun',
              ].map((dayName) => (
                <div
                  key={dayName}
                  className="px-1 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wide text-navy-500"
                >
                  {dayName}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 overflow-hidden rounded-b-xl border-l border-t border-navy-100">

              {calendarDays.map((dateKey, index) => {
                if (!dateKey) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="min-h-[58px] border-b border-r border-navy-100 bg-navy-50/40 p-1"
                    />
                  );
                }

                const holiday =
                  calendarHolidayMap.get(dateKey);

                const isToday =
                  dateKey === todayKey;

                const isSelected =
                  selectedHoliday?.publicHolidayId ===
                  holiday?.publicHolidayId;

                const dayNumber =
                  Number(dateKey.slice(-2));

                const paid =
                  holiday
                    ? isPaidHoliday(holiday)
                    : false;

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() =>
                      handleCalendarHolidayClick(holiday)
                    }
                    className={
                      [
                        'min-h-[58px] border-b border-r border-navy-100 p-1 text-left transition-colors',
                        holiday
                          ? paid
                            ? 'bg-success-50/70 hover:bg-success-100'
                            : 'bg-navy-50 hover:bg-navy-100'
                          : 'bg-white hover:bg-navy-50',
                        isToday
                          ? 'ring-2 ring-inset ring-primary-500'
                          : '',
                        isSelected
                          ? 'bg-primary-50 ring-2 ring-inset ring-primary-600'
                          : '',
                      ].join(' ')
                    }
                    aria-label={
                      holiday
                        ? `${getHolidayName(holiday)} on ${formatDate(holiday.holidayDate)}`
                        : dateKey
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={
                          isToday
                            ? 'flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white'
                            : 'text-[10px] font-semibold text-navy-700'
                        }
                      >
                        {dayNumber}
                      </span>

                      {isToday && !holiday && (
                        <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[8px] font-semibold text-blue-700">
                          Today
                        </span>
                      )}
                    </div>

                    {holiday && (
                      <div className="mt-1.5">
                        <p className="line-clamp-1 text-[9px] font-semibold text-navy-900">
                          {getHolidayName(holiday)}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span
                            className={
                              paid
                                ? 'rounded-full bg-success-100 px-1.5 py-0.5 text-[8px] font-semibold text-success-700'
                                : 'rounded-full bg-navy-100 px-1.5 py-0.5 text-[8px] font-semibold text-navy-600'
                            }
                          >
                            {paid ? 'Paid' : 'Unpaid'}
                          </span>

                          {paid && (
                            <span className="text-[8px] font-medium text-navy-500">
                              {formatHours(
                                getDailyHours(holiday)
                              )} hrs
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}

            </div>
          </div>
        </div>

        {selectedHoliday && (
          <div className="mt-3 rounded-lg border border-primary-100 bg-primary-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
                  Selected Holiday
                </p>

                <h3 className="mt-1 text-lg font-bold text-navy-900">
                  {getHolidayName(selectedHoliday)}
                </h3>

                <p className="mt-1 text-xs text-navy-600">
                  {formatDate(
                    getHolidayDate(selectedHoliday)
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={
                    isPaidHoliday(selectedHoliday)
                      ? 'rounded-full bg-success-100 px-2 py-1 text-[9px] font-semibold text-success-700'
                      : 'rounded-full bg-navy-100 px-2 py-1 text-[9px] font-semibold text-navy-600'
                  }
                >
                  {isPaidHoliday(selectedHoliday)
                    ? 'Paid Holiday'
                    : 'Unpaid Holiday'}
                </span>

                {isPaidHoliday(selectedHoliday) && (
                  <span className="rounded-full bg-white px-2 py-1 text-[9px] font-semibold text-navy-600">
                    {formatHours(
                      getDailyHours(selectedHoliday)
                    )}{' '}
                    paid hours
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

            </section>




          </div>

        </section>

      )}

    </div>

  );

}


// ============================================================
// DEFAULT EXPORT
// ============================================================

export default EmployeePublicHolidays;

