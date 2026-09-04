import { useState, useEffect, useMemo } from 'react';
import { CalendarCheck, Download } from 'lucide-react';

import {
  PageHeader,
  DataTable,
} from '@/components/ui/PageComponents';

import { StatusBadge } from '@/components/ui/Badge';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  SearchInput,
  Select,
} from '@/components/ui/Form';

import { attendanceService } from '@/services/apiServices';


export function AdminAttendance() {

  // ============================================================
  // STATE
  // ============================================================

  const [records, setRecords] = useState([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');

  const [statusFilter, setStatusFilter] = useState('');

  const [dateFilter, setDateFilter] = useState('');


  // ============================================================
  // FETCH ATTENDANCE
  // ============================================================

  useEffect(() => {

    const loadAttendance = async () => {

      try {

        setLoading(true);

        const response =
          await attendanceService.list();

        console.log(
          'Attendance API response:',
          response
        );


        /*
         * Backend response:
         *
         * {
         *   success: true,
         *   message: "...",
         *   data: [...]
         * }
         */

        const apiData =
          Array.isArray(response)
            ? response
            : Array.isArray(response?.data)
              ? response.data
              : [];


        /*
         * Convert backend response into a
         * frontend-friendly structure.
         */

        const normalizedRecords =
          apiData.map((record) => {

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
                record.checkInTime,

              checkOutTime:
                record.checkOutTime,

              totalHours:
                record.totalHours,

              status:
                record.status,

              createdAt:
                record.createdAt,

              updatedAt:
                record.updatedAt,

            };

          });


        console.log(
          'Normalized attendance records:',
          normalizedRecords
        );


        setRecords(normalizedRecords);

      }

      catch (error) {

        console.error(
          'Failed to fetch attendance:',
          error
        );

        /*
         * IMPORTANT:
         *
         * Do NOT use mockAttendance here.
         *
         * If the API fails, show an empty state
         * instead of displaying fake data.
         */

        setRecords([]);

      }

      finally {

        setLoading(false);

      }

    };


    loadAttendance();

  }, []);


  // ============================================================
  // FORMAT DATE
  // ============================================================

  const formatDate = (dateString) => {

    if (!dateString) {
      return '--';
    }


    const date =
      new Date(dateString);


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return '--';

    }


    return date.toLocaleDateString(
      'en-GB',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }
    );

  };


  // ============================================================
  // FORMAT TIME
  // ============================================================

  const formatTime = (timeString) => {

    if (!timeString) {
      return '--';
    }


    const date =
      new Date(timeString);


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return '--';

    }


    return date.toLocaleTimeString(
      'en-IN',
      {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }
    );

  };


  // ============================================================
  // GET DATE FOR FILTER
  // ============================================================

  const getDateForFilter = (dateString) => {

    if (!dateString) {
      return '';
    }


    const date =
      new Date(dateString);


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return '';

    }


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


  // ============================================================
  // FILTER RECORDS
  // ============================================================

  const filtered = useMemo(() => {

    const searchValue =
      search
        .trim()
        .toLowerCase();


    return records.filter((record) => {


      // --------------------------------------------------------
      // SEARCH
      // --------------------------------------------------------

      const employeeName =
        record.employeeName
          ?.toLowerCase() || '';


      const employeeId =
        String(
          record.employeeId ?? ''
        ).toLowerCase();


      const employeeEmail =
        record.employeeEmail
          ?.toLowerCase() || '';


      const matchSearch =
        !searchValue ||
        employeeName.includes(
          searchValue
        ) ||
        employeeId.includes(
          searchValue
        ) ||
        employeeEmail.includes(
          searchValue
        );


      // --------------------------------------------------------
      // STATUS
      // --------------------------------------------------------

      const matchStatus =
        !statusFilter ||
        record.status === statusFilter;


      // --------------------------------------------------------
      // DATE
      // --------------------------------------------------------

      const matchDate =
        !dateFilter ||
        getDateForFilter(
          record.date
        ) === dateFilter;


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
    dateFilter,
  ]);


  // ============================================================
  // EXPORT CSV
  // ============================================================

  const handleExport = () => {

    /*
     * IMPORTANT:
     *
     * This function is INSIDE the component,
     * therefore it can access `filtered`.
     */

    if (!filtered || filtered.length === 0) {

      alert(
        'No attendance records available to export.'
      );

      return;

    }


    // ----------------------------------------------------------
    // CSV HEADERS
    // ----------------------------------------------------------

    const headers = [

      'Attendance ID',

      'Employee ID',

      'Employee Name',

      'Email',

      'Date',

      'Check In',

      'Check Out',

      'Total Hours',

      'Status',

    ];


    // ----------------------------------------------------------
    // CSV ROWS
    // ----------------------------------------------------------

    const rows =
      filtered.map((record) => [

        record.attendanceId ?? '',

        record.employeeId ?? '',

        record.employeeName ?? '',

        record.employeeEmail ?? '',

        formatDate(record.date),

        formatTime(record.checkInTime),

        formatTime(record.checkOutTime),

        record.totalHours !== null &&
        record.totalHours !== undefined &&
        record.totalHours !== ''
          ? Number(
              record.totalHours
            ).toFixed(2)
          : '',

        record.status ?? '',

      ]);


    // ----------------------------------------------------------
    // ESCAPE CSV VALUES
    // ----------------------------------------------------------

    const escapeCsvValue = (value) => {

      if (
        value === null ||
        value === undefined
      ) {

        return '';

      }


      const stringValue =
        String(value);


      /*
       * If value contains comma,
       * quotation mark or newline,
       * wrap it inside quotes.
       */

      if (
        stringValue.includes(',') ||
        stringValue.includes('"') ||
        stringValue.includes('\n') ||
        stringValue.includes('\r')
      ) {

        return `"${stringValue.replace(
          /"/g,
          '""'
        )}"`;

      }


      return stringValue;

    };


    // ----------------------------------------------------------
    // CREATE CSV
    // ----------------------------------------------------------

    const csvContent = [

      headers
        .map(escapeCsvValue)
        .join(','),

      ...rows.map((row) =>
        row
          .map(escapeCsvValue)
          .join(',')
      ),

    ].join('\n');


    // ----------------------------------------------------------
    // CREATE FILE
    // ----------------------------------------------------------

    /*
     * UTF-8 BOM makes Excel handle
     * the CSV correctly.
     */

    const blob = new Blob(
      [
        '\uFEFF' +
        csvContent
      ],
      {
        type:
          'text/csv;charset=utf-8;',
      }
    );


    const url =
      URL.createObjectURL(blob);


    const link =
      document.createElement('a');


    link.href = url;


    // ----------------------------------------------------------
    // FILE NAME
    // ----------------------------------------------------------

    const today =
      new Date()
        .toISOString()
        .split('T')[0];


    link.download =
      `attendance_${today}.csv`;


    // ----------------------------------------------------------
    // DOWNLOAD
    // ----------------------------------------------------------

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);


    // Release browser memory

    URL.revokeObjectURL(url);

  };


  // ============================================================
  // TABLE COLUMNS
  // ============================================================

  const columns = [

    // ----------------------------------------------------------
    // EMPLOYEE ID
    // ----------------------------------------------------------

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

          {record.employeeId}

        </span>

      ),

    },


    // ----------------------------------------------------------
    // EMPLOYEE
    // ----------------------------------------------------------

    {
      key: 'employeeName',

      label: 'Employee',

      render: (record) => (

        <div>

          <span
            className="
              font-medium
              text-navy-900
            "
          >

            {record.employeeName || '--'}

          </span>


          {record.employeeEmail && (

            <div
              className="
                text-xs
                text-navy-400
                mt-1
              "
            >

              {record.employeeEmail}

            </div>

          )}

        </div>

      ),

    },


    // ----------------------------------------------------------
    // DATE
    // ----------------------------------------------------------

    {
      key: 'date',

      label: 'Date',

      render: (record) => (

        <span
          className="
            text-navy-600
          "
        >

          {formatDate(
            record.date
          )}

        </span>

      ),

    },


    // ----------------------------------------------------------
    // CHECK IN
    // ----------------------------------------------------------

    {
      key: 'checkInTime',

      label: 'Check In',

      align: 'center',

      render: (record) => (

        <span
          className={`
            font-mono
            ${
              record.checkInTime
                ? 'text-navy-700'
                : 'text-navy-300'
            }
          `}
        >

          {formatTime(
            record.checkInTime
          )}

        </span>

      ),

    },


    // ----------------------------------------------------------
    // CHECK OUT
    // ----------------------------------------------------------

    {
      key: 'checkOutTime',

      label: 'Check Out',

      align: 'center',

      render: (record) => (

        <span
          className={`
            font-mono
            ${
              record.checkOutTime
                ? 'text-navy-700'
                : 'text-navy-300'
            }
          `}
        >

          {formatTime(
            record.checkOutTime
          )}

        </span>

      ),

    },


    // ----------------------------------------------------------
    // HOURS
    // ----------------------------------------------------------

    {
      key: 'totalHours',

      label: 'Hours',

      align: 'right',

      render: (record) => {

        const hours =
          Number(
            record.totalHours
          );


        const validHours =
          Number.isFinite(hours);


        return (

          <span
            className="
              font-semibold
              text-navy-700
            "
          >

            {validHours
              ? `${hours.toFixed(2)}h`
              : '--'}

          </span>

        );

      },

    },


    // ----------------------------------------------------------
    // STATUS
    // ----------------------------------------------------------

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


      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <PageHeader

        title="Attendance"

        subtitle={`
          ${filtered.length}
          record${filtered.length !== 1 ? 's' : ''}
        `}

        actions={

          <button

            type="button"

            className="
              btn-secondary
              flex
              items-center
              gap-2
            "

            onClick={handleExport}

            disabled={
              filtered.length === 0
            }

          >

            <Download
              size={18}
            />

            Export

          </button>

        }

      />


      {/* ======================================================
          FILTERS
      ====================================================== */}

      <div
        className="
          grid
          grid-cols-1
          sm:grid-cols-3
          gap-3
          mb-5
        "
      >


        {/* ----------------------------------------------------
            SEARCH
        ---------------------------------------------------- */}

        <SearchInput

          value={search}

          onChange={setSearch}

          placeholder="Search employee..."

        />


        {/* ----------------------------------------------------
            STATUS
        ---------------------------------------------------- */}

        <Select

          value={statusFilter}

          onChange={setStatusFilter}

          placeholder="All Statuses"

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


        {/* ----------------------------------------------------
            DATE
        ---------------------------------------------------- */}

        <input

          type="date"

          className="input-field"

          value={dateFilter}

          onChange={(event) =>
            setDateFilter(
              event.target.value
            )
          }

        />

      </div>


      {/* ======================================================
          TABLE / EMPTY STATE
      ====================================================== */}

      {filtered.length === 0 ? (

        <EmptyState

          icon={CalendarCheck}

          title="No attendance records"

          message={
            records.length === 0
              ? 'No attendance records are available.'
              : 'No records match your filters.'
          }

        />

      ) : (

        <DataTable

          columns={columns}

          data={filtered}

        />

      )}

    </div>

  );

}