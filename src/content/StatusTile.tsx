import { HedgehogError } from '@posthog/brand/hoggies'
import { type ReactNode, useState } from 'react'

import { BrandLogomark } from '../shared/BrandLogomark'
import { type Hoggie, STATE_COPY, type Tone } from '../shared/runCopy'
import { overallState, type RunState, runState, runTimestamp } from '../shared/runState'
import { headline, runDetail, tileSummary } from '../shared/runSummary'
import { timeAgo } from '../shared/time'
import type { PrResults, RunView } from '../shared/types'
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

const PANEL_ID = 'visual-review-runs'

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

function Summary({
    hoggie: HoggieIllustration,
    title,
    subtitle,
}: {
    hoggie: Hoggie
    title: string
    subtitle?: ReactNode
}) {
    return (
        <div className="summary">
            <div className="hoggie">
                <HoggieIllustration size={36} />
            </div>
            <div className="summary-text">
                <div className="title">{title}</div>
                {subtitle && <div className="subtitle">{subtitle}</div>}
            </div>
        </div>
    )
}

/** What the tile's panel shows: the overall state, one row per run type, and a link to PostHog. */
export function RunsPanel({ results }: { results: PrResults }) {
    return (
        <>
            <h3 className="panel-heading">
                <BrandLogomark className="logomark" />
                <span>PostHog visual review</span>
            </h3>
            <PanelBody results={results} />
        </>
    )
}

function PanelBody({ results }: { results: PrResults }) {
    if (results.kind === 'error') {
        return <Summary hoggie={HedgehogError} title="Couldn't load results" subtitle={results.message} />
    }
    if (results.kind !== 'runs') {
        return null
    }
    const state = overallState(results.runs)
    const copy = STATE_COPY[state]
    // getPrResults returns no_runs for an empty list, so there's always at least one run.
    const primaryRun = results.runs.find((r) => runState(r.run) === state)!
    const latest = results.runs.map((r) => runTimestamp(r.run)).sort().at(-1)!
    return (
        <div className={`tone-${copy.tone}`}>
            <Summary
                hoggie={copy.hoggie}
                title={headline(results.runs, state)}
                subtitle={
                    <>
                        <span className="label">{copy.label}</span>
                        <span>updated {timeAgo(latest)}</span>
                    </>
                }
            />
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
        </div>
    )
}

/** Whether there's anything to show. Otherwise the tile stays out of GitHub's merge box. */
export function hasContent(results: PrResults | null): results is Extract<PrResults, { kind: 'runs' | 'error' }> {
    return results?.kind === 'runs' || results?.kind === 'error'
}

/**
 * A tile in GitHub's merge box, next to Checks, Comments, and Approvals, built like theirs: a
 * label, a short summary, and a bar with one segment per run type. Clicking it opens the runs.
 */
export function StatusTile({ results }: { results: PrResults | null }) {
    const [open, setOpen] = useState(false)
    if (!hasContent(results)) {
        // Only take up space when there's a run to report on. Signing in lives in the toolbar popup.
        return null
    }
    const summary = results.kind === 'runs' ? tileSummary(results.runs) : "Couldn't load"
    const segments: { tone: Tone; label: string }[] =
        results.kind === 'runs'
            ? results.runs.map(({ run }) => ({
                  tone: STATE_COPY[runState(run)].tone,
                  label: `${run.run_type}: ${STATE_COPY[runState(run)].label.toLowerCase()}`,
              }))
            : []
    return (
        <>
            <div className={`tile ${open ? 'open' : ''}`}>
                <button
                    type="button"
                    className="tile-button"
                    popoverTarget={PANEL_ID}
                    aria-label={`Visual review: ${summary}. ${segments.map((s) => s.label).join(', ')}`}
                />
                <div className="label-row">
                    <strong className="label-text">Visual review</strong>
                    <span className="tile-summary">{summary}</span>
                    <ChevronDownIcon className="nav-icon" />
                </div>
                {segments.length > 0 ? (
                    <div className="bar" aria-hidden="true">
                        {segments.map((s, i) => (
                            <span key={i} className={`segment bg-${s.tone}`} />
                        ))}
                    </div>
                ) : (
                    <div className="bar-unavailable" aria-hidden="true" />
                )}
            </div>
            <div
                id={PANEL_ID}
                popover="auto"
                className="panel"
                aria-label="Visual review runs"
                onToggle={(e) => setOpen(e.newState === 'open')}
            >
                <RunsPanel results={results} />
            </div>
        </>
    )
}
