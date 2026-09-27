import { HedgehogError } from '@posthog/brand/hoggies'
import { Logo } from '@posthog/brand/logo'
import { type ReactNode, useState } from 'react'

import { type Hoggie, STATE_COPY, type Tone } from '../shared/runCopy'
import {
    approverName,
    changeCount,
    overallState,
    type RunState,
    runState,
    runTimestamp,
    summaryText,
} from '../shared/runState'
import { timeAgo } from '../shared/time'
import type { PrResults, RunApi, RunView } from '../shared/types'
import {
    CheckCircleFillIcon,
    ChevronDownIcon,
    DotFillIcon,
    EyeIcon,
    LinkExternalIcon,
    SyncIcon,
    XCircleFillIcon,
} from './icons'

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
            return `${total} snapshot${total === 1 ? '' : 's'} waiting for review`
        }
        case 'failed':
            return 'A visual review run failed'
        case 'processing':
            return 'Comparing snapshots against baselines…'
        case 'approved': {
            const who = runs.map((r) => approverName(r.run)).find(Boolean)
            return who ? `Visual changes approved by ${who}` : 'Visual changes approved'
        }
        case 'observe':
            return 'Visual changes recorded'
        case 'clean':
            return 'Every snapshot matches its baseline'
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
        const who = approverName(run)
        return `${summary || 'Changes'} approved${who ? ` by ${who}` : ''}`
    }
    return summary || `${run.summary.total} snapshots unchanged`
}

function RunRow({ view: { run, url } }: { view: RunView }) {
    const state = runState(run)
    const Icon = STATE_ICON[state]
    return (
        <div className="run-row">
            <Icon className={`fg-${STATE_COPY[state].tone} ${state === 'processing' ? 'spin' : ''}`} />
            <span className="run-type">{run.run_type}</span>
            <span className="run-detail">{runDetail(run)}</span>
            <span className="run-meta">
                <code>{run.commit_sha.slice(0, 7)}</code>
                <span aria-hidden="true">·</span>
                <span>{timeAgo(runTimestamp(run))}</span>
            </span>
            <a className="link" href={url} target="_blank" rel="noreferrer">
                {state === 'needs_review' ? 'Review' : 'Details'}
            </a>
        </div>
    )
}

function Shell({
    tone,
    hoggie: HoggieIllustration,
    title,
    label,
    subtitle,
    action,
    children,
    collapsed,
    onToggle,
}: {
    tone: Tone
    hoggie: Hoggie
    title: string
    label?: string
    subtitle?: ReactNode
    action?: ReactNode
    children?: ReactNode
    collapsed?: boolean
    onToggle?: () => void
}) {
    return (
        <section className={`box tone-${tone}`} aria-label="PostHog visual review">
            <div className="box-header">
                <div className="hoggie">
                    <HoggieIllustration size={52} />
                </div>
                <div className="header-text">
                    <div className="eyebrow">
                        <Logo.Logomark className="logomark" aria-hidden="true" />
                        <span>Visual review</span>
                        {label && <span className="label">{label}</span>}
                    </div>
                    <div className="title">{title}</div>
                    {subtitle && <div className="subtitle">{subtitle}</div>}
                </div>
                <div className="header-actions">
                    {action}
                    {onToggle && (
                        <button
                            type="button"
                            className={`icon-button ${collapsed ? 'is-collapsed' : ''}`}
                            aria-label={collapsed ? 'Show runs' : 'Hide runs'}
                            aria-expanded={!collapsed}
                            onClick={onToggle}
                        >
                            <ChevronDownIcon />
                        </button>
                    )}
                </div>
            </div>
            {children && !collapsed && <div className="box-body">{children}</div>}
        </section>
    )
}

const COLLAPSED_KEY = 'posthog-vr-collapsed'

export function Banner({ results }: { results: PrResults | null }) {
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1')
    const toggle = () => {
        setCollapsed((c) => {
            localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1')
            return !c
        })
    }

    switch (results?.kind) {
        case undefined:
        case 'signed_out':
        case 'repo_not_tracked':
        case 'no_runs':
            // Only take up space when there's a run to report on. Signing in lives in the toolbar popup.
            return null
        case 'error':
            return (
                <Shell
                    tone="danger"
                    hoggie={HedgehogError}
                    title="Couldn't load visual review results"
                    subtitle={results.message}
                />
            )
        case 'runs': {
            const state = overallState(results.runs)
            const copy = STATE_COPY[state]
            // getPrResults returns no_runs for an empty list, so there's always at least one run.
            const primaryRun = results.runs.find((r) => runState(r.run) === state)!
            const latest = results.runs.map((r) => runTimestamp(r.run)).sort().at(-1)!
            return (
                <Shell
                    tone={copy.tone}
                    hoggie={copy.hoggie}
                    label={copy.label}
                    title={headline(results.runs, state)}
                    subtitle={`${results.runs.length} run${results.runs.length === 1 ? '' : 's'} · updated ${timeAgo(latest)}`}
                    action={
                        <a
                            className={`btn ${state === 'needs_review' ? 'btn-primary' : ''}`}
                            href={primaryRun.url}
                            target="_blank"
                            rel="noreferrer"
                        >
                            {state === 'needs_review' ? 'Review in PostHog' : 'Open in PostHog'}
                            <LinkExternalIcon className="btn-trailing" />
                        </a>
                    }
                    collapsed={collapsed}
                    onToggle={toggle}
                >
                    {results.runs.map((view) => (
                        <RunRow key={view.run.id} view={view} />
                    ))}
                </Shell>
            )
        }
    }
}
