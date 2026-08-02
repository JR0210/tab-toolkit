const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const ABSOLUTE_THRESHOLD = 7 * DAY

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/**
 * Formats an ISO-8601 timestamp relative to `now`. `now` is injectable so
 * this is deterministically testable rather than depending on the real
 * current time.
 */
export function formatRelativeDate(isoString: string, now: Date = new Date()): string {
  const then = new Date(isoString).getTime()
  const elapsed = now.getTime() - then

  if (elapsed < MINUTE) {
    return 'Just now'
  }

  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE)
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  }

  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR)
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  }

  if (elapsed < ABSOLUTE_THRESHOLD) {
    const days = Math.floor(elapsed / DAY)
    return `${days} ${days === 1 ? 'day' : 'days'} ago`
  }

  const date = new Date(isoString)
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
}
