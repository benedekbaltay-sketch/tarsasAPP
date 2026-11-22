import React from 'react';

/**
 * StickyMonthHeader
 * Renders a sticky month divider header with high opacity, backdrop-blur,
 * and exact alignment under sticky headers.
 *
 * @param {Object} props
 * @param {string} props.label - e.g. "2026. NOV." or "NOV 2026"
 * @param {'modal'|'page'|string} [props.topOffset='modal'] - 'modal' (top: 0), 'page' (top: var(--app-header-height, 61px)), or custom Tailwind class
 * @param {boolean} [props.isFirst=false] - Whether this is the first section in the card
 * @param {React.ReactNode} [props.rightContent=null] - Optional right badge or counter
 * @param {string} [props.className=''] - Additional custom CSS classes
 */
export function StickyMonthHeader({
  label,
  topOffset = 'modal',
  isFirst = false,
  rightContent = null,
  className = ''
}) {
  const isPage = topOffset === 'page';
  const isModal = topOffset === 'modal' || topOffset === 'top-0';

  const positionClass = isPage
    ? 'sticky top-[57px] sm:top-[61px] z-10'
    : isModal
    ? 'sticky top-0 z-10'
    : `sticky ${topOffset} z-10`;

  const inlineStyle = isPage
    ? { top: 'var(--app-header-height, 61px)' }
    : undefined;

  return (
    <div
      style={inlineStyle}
      className={`${positionClass} bg-gray-100/95 sm:bg-gray-50/95 backdrop-blur-md px-4 py-2 border-y border-gray-200/90 flex items-center justify-between text-xs font-bold text-gray-700 uppercase tracking-wider select-none shadow-2xs transition-colors ${
        isFirst ? 'first:rounded-t-2xl first:border-t-0' : ''
      } ${className}`}
    >
      <span className="truncate">{label}</span>
      {rightContent}
    </div>
  );
}

/**
 * StickyMonthSection
 * Wrapper <section> for a monthly group of items. Restricts the sticky header so that the next month
 * naturally pushes it up and off-screen.
 *
 * @param {Object} props
 * @param {string} props.monthKey - Unique key for the month (e.g. "2026-11")
 * @param {string} props.label - Formatted month label (e.g. "2026. NOV.")
 * @param {'modal'|'page'|string} [props.topOffset='modal'] - 'modal', 'page', or custom class
 * @param {boolean} [props.isFirst=false] - Whether this is the first group in the list
 * @param {React.ReactNode} props.children - Rendered list items for this month
 * @param {React.ReactNode} [props.rightContent=null] - Optional content to display on the right
 * @param {string} [props.className=''] - Additional classes on the wrapper <section>
 */
export function StickyMonthSection({
  monthKey,
  label,
  topOffset = 'modal',
  isFirst = false,
  children,
  rightContent = null,
  className = ''
}) {
  return (
    <section
      key={monthKey}
      data-month-group={monthKey}
      className={`month-group relative divide-y divide-gray-100 ${className}`}
    >
      <StickyMonthHeader
        label={label}
        topOffset={topOffset}
        isFirst={isFirst}
        rightContent={rightContent}
      />
      <div className="divide-y divide-gray-100">
        {children}
      </div>
    </section>
  );
}
