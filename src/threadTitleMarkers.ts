export type ManagedThreadTitleMarker = 'pending' | 'review'

type ManagedThreadTitleInfo = {
  marker: ManagedThreadTitleMarker | null
  prefix: string | null
  displayTitle: string
  badgeLabel: string | null
  buttonLabel: string | null
}

const MANAGED_THREAD_TITLE_MARKERS: Array<{
  marker: ManagedThreadTitleMarker
  prefix: string
  badgeLabel: string
  buttonLabel: string
}> = [
  {
    marker: 'pending',
    prefix: '💤',
    badgeLabel: 'Waiting',
    buttonLabel: 'Pending',
  },
  {
    marker: 'review',
    prefix: '⏳',
    badgeLabel: 'In review',
    buttonLabel: 'Waiting for review',
  },
]

function parseManagedMarkerPrefix(title: string): { marker: ManagedThreadTitleMarker; prefix: string; remainder: string } | null {
  for (const candidate of MANAGED_THREAD_TITLE_MARKERS) {
    if (!title.startsWith(candidate.prefix)) continue
    const remainder = title.slice(candidate.prefix.length).replace(/^\s+/u, '')
    return {
      marker: candidate.marker,
      prefix: candidate.prefix,
      remainder,
    }
  }

  return null
}

export function getManagedThreadTitleInfo(title: string): ManagedThreadTitleInfo {
  const normalizedTitle = title.trim()
  const parsed = parseManagedMarkerPrefix(normalizedTitle)
  if (!parsed) {
    return {
      marker: null,
      prefix: null,
      displayTitle: normalizedTitle,
      badgeLabel: null,
      buttonLabel: null,
    }
  }

  const meta = MANAGED_THREAD_TITLE_MARKERS.find((candidate) => candidate.marker === parsed.marker)
  return {
    marker: parsed.marker,
    prefix: parsed.prefix,
    displayTitle: parsed.remainder,
    badgeLabel: meta?.badgeLabel ?? null,
    buttonLabel: meta?.buttonLabel ?? null,
  }
}

export function stripManagedThreadTitleMarker(title: string): string {
  return getManagedThreadTitleInfo(title).displayTitle
}

export function setManagedThreadTitleMarker(
  title: string,
  marker: ManagedThreadTitleMarker | null,
): string {
  const baseTitle = stripManagedThreadTitleMarker(title).trim()
  if (!marker) {
    return baseTitle
  }

  const meta = MANAGED_THREAD_TITLE_MARKERS.find((candidate) => candidate.marker === marker)
  if (!meta) {
    return baseTitle
  }

  return baseTitle ? `${meta.prefix} ${baseTitle}` : meta.prefix
}

export function toggleManagedThreadTitleMarker(title: string, marker: ManagedThreadTitleMarker): string {
  const current = getManagedThreadTitleInfo(title)
  if (current.marker === marker) {
    return setManagedThreadTitleMarker(title, null)
  }
  return setManagedThreadTitleMarker(title, marker)
}
