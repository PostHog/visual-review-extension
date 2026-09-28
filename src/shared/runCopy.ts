import {
    HedgehogError,
    HedgehogHourglass,
    HedgehogMagnifyingGlass,
    HedgehogReading,
    HedgehogStampApproved,
    HedgehogSuccess,
} from '@posthog/brand/hoggies'

import type { RunState } from './runState'

export type Tone = 'success' | 'attention' | 'danger' | 'neutral'

export type Hoggie = typeof HedgehogSuccess

/** How each run state is presented, shared by the GitHub sidebar and the popup. */
export const STATE_COPY: Record<RunState, { label: string; tone: Tone; hoggie: Hoggie }> = {
    needs_review: { label: 'Needs review', tone: 'attention', hoggie: HedgehogMagnifyingGlass },
    failed: { label: 'Failed', tone: 'danger', hoggie: HedgehogError },
    processing: { label: 'In progress', tone: 'attention', hoggie: HedgehogHourglass },
    observe: { label: 'Tracking only', tone: 'neutral', hoggie: HedgehogReading },
    approved: { label: 'Approved', tone: 'success', hoggie: HedgehogStampApproved },
    clean: { label: 'No visual changes', tone: 'success', hoggie: HedgehogSuccess },
}
