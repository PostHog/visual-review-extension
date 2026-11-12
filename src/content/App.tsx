import { useCallback, useEffect, useRef, useState } from 'react'

import { errorMessage } from '../shared/errors'
import { send } from '../shared/messages'
import type { RepoIndexEntry } from '../shared/repoIndex'
import { isInFlight } from '../shared/runState'
import type { PrResults, PullRequestRef } from '../shared/types'
import { hasContent, StatusTile } from './StatusTile'

const POLL_IN_FLIGHT_MS = 15_000
const POLL_AWAITING_RUN_MS = 60_000
const STALE_ON_FOCUS_MS = 60_000

export function App({
    pr,
    entry,
    onVisibleChange,
}: {
    pr: PullRequestRef
    entry: RepoIndexEntry
    onVisibleChange: (visible: boolean) => void
}) {
    const [results, setResults] = useState<PrResults | null>(null)
    const loadedAt = useRef(0)

    const load = useCallback(async () => {
        try {
            setResults(await send({ type: 'pr:results', pr, entry }))
        } catch (error) {
            setResults({ kind: 'error', message: errorMessage(error) })
        }
        loadedAt.current = Date.now()
    }, [pr, entry])

    useEffect(() => {
        void load()
    }, [load])

    // Keep polling while CI is still producing or diffing snapshots. A PR with no runs yet is
    // polled slowly too: the tile is hidden then, and should appear once CI uploads a run.
    useEffect(() => {
        const interval =
            results?.kind === 'runs' && isInFlight(results.runs)
                ? POLL_IN_FLIGHT_MS
                : results?.kind === 'no_runs'
                  ? POLL_AWAITING_RUN_MS
                  : null
        if (interval == null) {
            return
        }
        const id = setInterval(() => {
            if (document.visibilityState === 'visible') {
                void load()
            }
        }, interval)
        return () => clearInterval(id)
    }, [results, load])

    // Coming back to a tab after reviewing in PostHog should show the new state.
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible' && Date.now() - loadedAt.current > STALE_ON_FOCUS_MS) {
                void load()
            }
        }
        document.addEventListener('visibilitychange', onVisible)
        return () => document.removeEventListener('visibilitychange', onVisible)
    }, [load])

    // The host is a tile in GitHub's merge box, so take it out rather than leave an empty
    // tile when there's nothing to report.
    useEffect(() => onVisibleChange(hasContent(results)), [results, onVisibleChange])

    return <StatusTile results={results} />
}
