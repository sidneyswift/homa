const OFFSET_ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;
const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const MINUTES_PER_HOUR = BigInt(60);
const MILLISECONDS_PER_MINUTE = BigInt(60_000);
const NANOSECONDS_PER_MILLISECOND = BigInt(1_000_000);

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  const monthLengths = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return monthLengths[month - 1] ?? 0;
}

/** Parses an offset-bearing ISO timestamp without losing fractional digits. */
export function parseOffsetIsoTimestampEpochNanoseconds(
  value: string,
): bigint {
  const match = OFFSET_ISO_TIMESTAMP_PATTERN.exec(value);
  if (match === null) {
    throw new TypeError(`Invalid offset-bearing ISO timestamp "${value}"`);
  }
  const [
    ,
    yearValue,
    monthValue,
    dayValue,
    hourValue,
    minuteValue,
    secondValue,
    fractionValue,
    zoneValue,
    offsetSign,
    offsetHourValue,
    offsetMinuteValue,
  ] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const second = Number(secondValue);
  const fractionNanoseconds = BigInt(
    (fractionValue ?? "").padEnd(9, "0"),
  );
  const offsetHour = Number(offsetHourValue ?? 0);
  const offsetMinute = Number(offsetMinuteValue ?? 0);
  const calendarFieldsAreValid =
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59;
  const offsetFieldsAreValid =
    zoneValue === "Z" ||
    (zoneValue !== "-00:00" &&
      offsetHour >= 0 &&
      offsetHour <= 14 &&
      offsetMinute >= 0 &&
      offsetMinute <= 59 &&
      (offsetHour < 14 || offsetMinute === 0));
  if (!calendarFieldsAreValid || !offsetFieldsAreValid) {
    throw new TypeError(`Invalid offset-bearing ISO timestamp "${value}"`);
  }

  const wallClockDate = new Date(0);
  wallClockDate.setUTCFullYear(year, month - 1, day);
  wallClockDate.setUTCHours(hour, minute, second, 0);
  const wallClockEpochMilliseconds = wallClockDate.getTime();
  if (!Number.isFinite(wallClockEpochMilliseconds)) {
    throw new TypeError(`Invalid offset-bearing ISO timestamp "${value}"`);
  }
  const offsetDirection = offsetSign === "+" ? BIGINT_ONE : -BIGINT_ONE;
  const offsetMinutes =
    zoneValue === "Z"
      ? BIGINT_ZERO
      : offsetDirection *
        (BigInt(offsetHour) * MINUTES_PER_HOUR + BigInt(offsetMinute));
  const wholeSecondEpochMilliseconds =
    BigInt(wallClockEpochMilliseconds) -
    offsetMinutes * MILLISECONDS_PER_MINUTE;
  return (
    wholeSecondEpochMilliseconds * NANOSECONDS_PER_MILLISECOND +
    fractionNanoseconds
  );
}
