import { MessageCircle, StickyNote, Vote } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CollabSectionId } from '#/lib/collab-sections'

export const COLLAB_SECTION_PRESENTATION = {
  conversation: { label: 'trips.collab.conversation', icon: MessageCircle },
  notes: { label: 'modules.field.notes', icon: StickyNote },
  polls: { label: 'modules.collab.polls.heading', icon: Vote },
} as const satisfies Record<
  CollabSectionId,
  { label: string; icon: LucideIcon }
>
