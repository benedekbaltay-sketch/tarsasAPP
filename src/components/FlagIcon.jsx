import React from 'react';

/**
 * Inline SVG country flag icons (zero external CDN requests; 100% CSP-compliant).
 */
export function FlagIcon({ country = 'hu', className = 'w-5 h-3.5 rounded-[2px] shadow-2xs border border-black/15' }) {
  if (country === 'gb' || country === 'en') {
    return (
      <svg
        viewBox="0 0 60 36"
        className={className}
        role="img"
        aria-label="EN"
        xmlns="http://www.w3.org/2000/svg"
      >
        <clipPath id="gb-flag-clip">
          <rect width="60" height="36" />
        </clipPath>
        <g clipPath="url(#gb-flag-clip)">
          <rect width="60" height="36" fill="#012169" />
          <path d="M0,0 L60,36 M60,0 L0,36" stroke="#FFFFFF" strokeWidth="7" />
          <path d="M0,0 L60,36 M60,0 L0,36" stroke="#C8102E" strokeWidth="3.2" />
          <path d="M30,0 V36 M0,18 H60" stroke="#FFFFFF" strokeWidth="11" />
          <path d="M30,0 V36 M0,18 H60" stroke="#C8102E" strokeWidth="6.5" />
        </g>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 60 36"
      className={className}
      role="img"
      aria-label="HU"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="60" height="12" y="0" fill="#CE2939" />
      <rect width="60" height="12" y="12" fill="#FFFFFF" />
      <rect width="60" height="12" y="24" fill="#477050" />
    </svg>
  );
}
