// Account state and authenticated API access. This is the only module that clears
// account state, so session, profile, and repo index never disagree.

import { repoIndexItem } from '../shared/repoIndex'
import { storageItem } from '../shared/storage'
import type { ProjectBasic } from '../shared/types'
import { refresh, RefreshRejectedError, type Session } from './auth'
import { errorDetail } from './http'

export interface Profile {
    email: string
    projectId?: number
    projects: ProjectBasic[]
}

export const sessionItem = storageItem<Session>('session')
export const profileItem = storageItem<Profile>('profile')

const REFRESH_MARGIN_MS = 60_000

/** The user isn't signed in (any more). Account state has already been cleared. */
export class SessionEndedError extends Error {
    constructor() {
        super('Your PostHog session ended. Sign in again from the extension popup.')
    }
}

/** Sign out locally. Content scripts and the popup react to the storage change. */
export async function clearAccount(): Promise<void> {
    await Promise.all([sessionItem.set(null), profileItem.set(null), repoIndexItem.set(null)])
}

async function endSession(): Promise<never> {
    await clearAccount()
    throw new SessionEndedError()
}

// Several tabs can ask for data at once; make sure only one refresh is in flight.
let refreshing: Promise<Session> | null = null

function refreshOnce(session: Session): Promise<Session> {
    refreshing ??= refresh(session)
        .then(async (next) => {
            await sessionItem.set(next)
            return next
        })
        .catch((error) => (error instanceof RefreshRejectedError ? endSession() : Promise.reject(error)))
        .finally(() => {
            refreshing = null
        })
    return refreshing
}

export async function validSession(): Promise<Session> {
    const session = await sessionItem.get()
    if (!session) {
        throw new SessionEndedError()
    }
    return session.expiresAt - REFRESH_MARGIN_MS < Date.now() ? refreshOnce(session) : session
}

export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number
    ) {
        super(message)
    }
}

/** GET a PostHog API path with the OAuth token, refreshing it once on 401. */
export async function api<T>(path: string, session?: Session): Promise<T> {
    const get = (s: Session) =>
        fetch(`${s.apiHost}${path}`, {
            headers: { Authorization: `Bearer ${s.accessToken}`, Accept: 'application/json' },
            // Never send posthog.com cookies: some endpoints prefer session auth over the bearer token.
            credentials: 'omit',
        })

    const current = session ?? (await validSession())
    let response = await get(current)
    if (response.status === 401) {
        response = await get(await refreshOnce(current))
        if (response.status === 401) {
            return endSession()
        }
    }
    if (!response.ok) {
        throw new ApiError((await errorDetail(response)).message, response.status)
    }
    return (await response.json()) as T
}
