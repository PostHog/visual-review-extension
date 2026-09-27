const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 24 * 3600],
    ['month', 30 * 24 * 3600],
    ['week', 7 * 24 * 3600],
    ['day', 24 * 3600],
    ['hour', 3600],
    ['minute', 60],
]

const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' })

/** "3 min. ago" for an ISO string or epoch milliseconds. */
export function timeAgo(value: string | number): string {
    const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000)
    for (const [unit, size] of UNITS) {
        if (Math.abs(seconds) >= size) {
            return formatter.format(Math.round(seconds / size), unit)
        }
    }
    return 'just now'
}
