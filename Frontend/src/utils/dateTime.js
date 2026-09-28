/**
 * Frontend date/time utilities for Diamond ERP.
 *
 * Rules:
 * - Real DateTime timestamps are displayed in Asia/Kolkata (IST).
 * - YYYY-MM-DD business dates are displayed without timezone shifting.
 * - HH:mm / HH:mm:ss clock values are treated as clock values and are
 *   displayed directly without applying a timezone conversion.
 */

const IST_TIME_ZONE = 'Asia/Kolkata';

const isValidDate = (date) =>
  date instanceof Date && !Number.isNaN(date.getTime());

const parseDateTime = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return isValidDate(value)
      ? value
      : null;
  }

  const date = new Date(value);

  return isValidDate(date)
    ? date
    : null;
};

const parseBusinessDate = (value) => {
  if (!value) {
    return null;
  }

  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    const [year, month, day] = value
      .split('-')
      .map(Number);

    const date = new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        12,
        0,
        0,
        0
      )
    );

    return isValidDate(date)
      ? date
      : null;
  }

  return parseDateTime(value);
};

const isClockValue = (value) =>
  typeof value === 'string' &&
  /^\d{2}:\d{2}(?::\d{2})?$/.test(value);

/**
 * Format a business date.
 *
 * Example:
 *   2026-09-25 -> 25 Sep 2026
 */
export const formatISTDate = (value, options = {}) => {
  if (!value) {
    return '—';
  }

  const date = parseBusinessDate(value);

  if (!date) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(date);
};

/**
 * Format a real DateTime timestamp in Indian Standard Time.
 *
 * Example:
 *   2026-09-25T21:45:10.741Z
 *   -> 26 Sep 2026, 03:15:10 AM
 */
export const formatISTDateTime = (
  value,
  options = {}
) => {
  if (!value) {
    return '—';
  }

  const date = parseDateTime(value);

  if (!date) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    ...options,
  }).format(date);
};

/**
 * Format a real DateTime timestamp as an Indian time.
 *
 * Example:
 *   2026-09-25T21:45:10.741Z
 *   -> 03:15:10 AM
 *
 * For HH:mm / HH:mm:ss values, the value is treated as a clock time
 * already expressed in the ERP's business timezone and is not shifted.
 */
export const formatISTTime = (
  value,
  options = {}
) => {
  if (!value) {
    return '—';
  }

  if (isClockValue(value)) {
    const [hours, minutes, seconds = '00'] =
      value.split(':');

    const hourNumber = Number(hours);
    const minuteNumber = Number(minutes);
    const secondNumber = Number(seconds);

    if (
      !Number.isInteger(hourNumber) ||
      !Number.isInteger(minuteNumber) ||
      !Number.isInteger(secondNumber) ||
      hourNumber < 0 ||
      hourNumber > 23 ||
      minuteNumber < 0 ||
      minuteNumber > 59 ||
      secondNumber < 0 ||
      secondNumber > 59
    ) {
      return '—';
    }

    const date = new Date(
      Date.UTC(
        1970,
        0,
        1,
        hourNumber,
        minuteNumber,
        secondNumber,
        0
      )
    );

    return new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      ...options,
    }).format(date);
  }

  const date = parseDateTime(value);

  if (!date) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    ...options,
  }).format(date);
};

/**
 * Return YYYY-MM-DD for a real timestamp using India time.
 *
 * This is useful for filters and attendance business-day grouping.
 */
export const getISTDateString = (value) => {
  if (!value) {
    return '';
  }

  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return value;
  }

  const date = parseDateTime(value);

  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};
