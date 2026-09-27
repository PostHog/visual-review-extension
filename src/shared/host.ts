/** oauth.posthog.com fronts both Cloud regions and tells us which one the user is on. */
export const CLOUD_AUTH_HOST = 'https://oauth.posthog.com'

/** The origin of a user-entered instance URL (a bare host gets https://), or null if it isn't a URL. */
export function normalizeHost(host: string): string | null {
    const trimmed = host.trim()
    const candidate = trimmed.includes('://') ? trimmed : `https://${trimmed}`
    return URL.canParse(candidate) ? new URL(candidate).origin : null
}
