import { HedgehogError } from '@posthog/brand/hoggies'
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'

import { BrandLogomark } from '../shared/BrandLogomark'
import { type Hoggie, STATE_COPY, type Tone } from '../shared/runCopy'
import { overallState, type RunState, runState, runTimestamp } from '../shared/runState'
import { headline, runDetail, tileSummary } from '../shared/runSummary'
import { timeAgo } from '../shared/time'
import type { PrResults, RunView } from '../shared/types'
import {
    CheckCircleFillIcon,
    DotFillIcon,
    EyeIcon,
    LinkExternalIcon,
    LockIcon,
    SyncIcon,
    UnlockIcon,
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

// GitHub's own tiles: hovering opens the panel after a short pause, and it closes shortly after
// the pointer leaves the tile and the panel. A click pins it open until the next click.
const OPEN_DELAY_MS = 400
const CLOSE_DELAY_MS = 200

function useHoverPanel() {
    const [hovered, setHovered] = useState(false)
    const [pinned, setPinned] = useState(false)
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
    const panel = useRef<HTMLDivElement>(null)
    const open = hovered || pinned

    const later = (next: boolean, delay: number) => {
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setHovered(next), delay)
    }
    useEffect(() => () => clearTimeout(timer.current), [])

    // A manual popover: no light dismiss, so a pinned panel stays put, like GitHub's.
    useEffect(() => {
        const el = panel.current
        if (el && open !== el.matches(':popover-open')) {
            if (open) {
                el.showPopover()
            } else {
                el.hidePopover()
            }
        }
    }, [open])

    useEffect(() => {
        if (!open) {
            return
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                clearTimeout(timer.current)
                setPinned(false)
                setHovered(false)
            }
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [open])

    const enter = (e: PointerEvent) => {
        if (e.pointerType === 'mouse') {
            // Already open (coming back from the panel): just cancel the close.
            later(true, hovered ? 0 : OPEN_DELAY_MS)
        }
    }
    const leave = (e: PointerEvent) => {
        if (e.pointerType === 'mouse') {
            later(false, CLOSE_DELAY_MS)
        }
    }
    const togglePin = () => {
        clearTimeout(timer.current)
        // Unpinning closes the panel even with the pointer still on the tile, like GitHub's.
        setHovered(false)
        setPinned((p) => !p)
    }
    return {
        open,
        pinned,
        panel,
        tileProps: { onPointerEnter: enter, onPointerLeave: leave },
        panelProps: { onPointerEnter: enter, onPointerLeave: leave },
        togglePin,
    }
}

/**
 * A tile in GitHub's merge box, next to Checks, Comments, and Approvals, built like theirs: a
 * label, a short summary, and a bar with one segment per run type. Hovering it shows the runs,
 * and clicking pins them open.
 */
export function StatusTile({ results }: { results: PrResults | null }) {
    const { open, pinned, panel, tileProps, panelProps, togglePin } = useHoverPanel()
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
    const PinIcon = pinned ? LockIcon : UnlockIcon
    return (
        <>
            <div className={`tile ${open ? 'open' : ''}`} {...tileProps}>
                <button
                    type="button"
                    className="tile-button"
                    aria-controls={PANEL_ID}
                    aria-expanded={open}
                    aria-label={`Visual review: ${summary}. ${segments.map((s) => s.label).join(', ')}. ${pinned ? 'Unpin' : 'Pin'} runs`}
                    onClick={togglePin}
                />
                <div className="label-row">
                    <BrandLogomark className="tile-logomark" />
                    <strong className="label-text">Visual review</strong>
                    <span className="tile-summary">{summary}</span>
                    <PinIcon size={14} className={`pin-icon ${pinned ? 'pinned' : ''}`} />
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
                ref={panel}
                id={PANEL_ID}
                popover="manual"
                role="group"
                className="panel"
                aria-label="Visual review runs"
                {...panelProps}
            >
                <RunsPanel results={results} />
            </div>
        </>
    )
}
