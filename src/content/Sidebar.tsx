import { HedgehogError } from '@posthog/brand/hoggies'
import { Logo } from '@posthog/brand/logo'
import type { ReactNode } from 'react'

import { type Hoggie, STATE_COPY, type Tone } from '../shared/runCopy'
import { approverName, changeCount, overallState, type RunState, runState, runTimestamp, summaryText } from '../shared/runState'
import { timeAgo } from '../shared/time'
import type { PrResults, RunApi, RunView } from '../shared/types'
import { CheckCircleFillIcon, DotFillIcon, EyeIcon, LinkExternalIcon, SyncIcon, XCircleFillIcon } from './icons'

const STATE_ICON: Record<RunState, typeof CheckCircleFillIcon> = {
    needs_review: DotFillIcon,
    failed: XCircleFillIcon,
    processing: SyncIcon,
    observe: EyeIcon,
    approved: CheckCircleFillIcon,
    clean: CheckCircleFillIcon,
}

function headline(runs: RunView[], state: RunState): string {
    switch (state) {
        case 'needs_review': {
            const total = runs
                .filter((r) => runState(r.run) === 'needs_review')
                .reduce((sum, r) => sum + (r.run.summary.unresolved ?? changeCount(r.run)), 0)
            return `${total} snapshot${total === 1 ? '' : 's'} to review`
        }
        case 'failed':
            return 'A run failed'
        case 'processing':
            return 'Comparing snapshots…'
        case 'approved': {
            const who = runs.map((r) => approverName(r.run)).find(Boolean)
            return who ? `Approved by ${who}` : 'Changes approved'
        }
        case 'observe':
            return 'Visual changes recorded'
        case 'clean':
            return 'All snapshots match'
    }
}

function runDetail(run: RunApi): string {
    const state = runState(run)
    if (state === 'failed') {
        return run.error_message || 'Processing failed'
    }
    if (state === 'processing') {
        return run.status === 'pending' ? 'Waiting for screenshots' : 'Diffing snapshots'
    }
    const summary = summaryText(run)
    if (state === 'approved') {
        return `${summary || 'Changes'} approved`
    }
    return summary || `${run.summary.total} unchanged`
}

function RunRow({ view: { run, url } }: { view: RunView }) {
    const state = runState(run)
    const Icon = STATE_ICON[state]
    const detail = runDetail(run)
    return (
        <li className="run-row">
            <Icon className={`fg-${STATE_COPY[state].tone} ${state === 'processing' ? 'spin' : ''}`} />
            <a className="run-link" href={url} target="_blank" rel="noreferrer" title={`${run.run_type}: ${detail}`}>
                <span className="run-type">{run.run_type}</span>
                <span className="run-detail">{detail}</span>
            </a>
        </li>
    )
}

function Section({
    tone,
    hoggie: HoggieIllustration,
    title,
    subtitle,
    children,
}: {
    tone: Tone
    hoggie: Hoggie
    title: string
    subtitle?: ReactNode
    children?: ReactNode
}) {
    return (
        <section className={`section tone-${tone}`} aria-label="PostHog visual review">
            <h3 className="heading">
                <Logo.Logomark className="logomark" aria-hidden="true" />
                Visual review
            </h3>
            <div className="summary">
                <div className="hoggie">
                    <HoggieIllustration size={36} />
                </div>
                <div className="summary-text">
                    <div className="title">{title}</div>
                    {subtitle && <div className="subtitle">{subtitle}</div>}
                </div>
            </div>
            {children}
        </section>
    )
}

/** Whether there's anything to show. Otherwise the section stays hidden and takes no space. */
export function hasContent(results: PrResults | null): boolean {
    return results?.kind === 'runs' || results?.kind === 'error'
}

export function Sidebar({ results }: { results: PrResults | null }) {
    switch (results?.kind) {
        case undefined:
        case 'signed_out':
        case 'repo_not_tracked':
        case 'no_runs':
            // Only take up space when there's a run to report on. Signing in lives in the toolbar popup.
            return null
        case 'error':
            return (
                <Section tone="danger" hoggie={HedgehogError} title="Couldn't load results" subtitle={results.message} />
            )
        case 'runs': {
            const state = overallState(results.runs)
            const copy = STATE_COPY[state]
            // getPrResults returns no_runs for an empty list, so there's always at least one run.
            const primaryRun = results.runs.find((r) => runState(r.run) === state)!
            const latest = results.runs.map((r) => runTimestamp(r.run)).sort().at(-1)!
            return (
                <Section
                    tone={copy.tone}
                    hoggie={copy.hoggie}
                    title={headline(results.runs, state)}
                    subtitle={
                        <>
                            <span className="label">{copy.label}</span>
                            <span>updated {timeAgo(latest)}</span>
                        </>
                    }
                >
                    <ul className="runs">
                        {results.runs.map((view) => (
                            <RunRow key={view.run.id} view={view} />
                        ))}
                    </ul>
                    <a
                        className={`btn ${state === 'needs_review' ? 'btn-primary' : ''}`}
                        href={primaryRun.url}
                        target="_blank"
                        rel="noreferrer"
                    >
                        {state === 'needs_review' ? 'Review in PostHog' : 'Open in PostHog'}
                        <LinkExternalIcon className="btn-trailing" />
                    </a>
                </Section>
            )
        }
    }
}
