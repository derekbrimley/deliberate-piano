import React from 'react';
import { Box } from '@mui/joy';

/**
 * Score-inspired details for the Paper look (they also render, plainly, in Color).
 * Fonts come from CSS variables set in index.css per look, so Color keeps the system font.
 */

/** Section label: Cormorant small caps on Paper, a bold label on Color. */
export const smallCapsSx = {
  fontFamily: 'var(--label-font)',
  fontWeight: 'var(--label-weight)',
  fontSize: 'var(--label-size)',
  letterSpacing: 'var(--label-tracking)',
  lineHeight: 1.2,
} as const;

/** Display serif with old-style figures, for the timer and big numbers. */
export const engravedNumeralsSx = {
  fontFamily: 'var(--display-font)',
  fontWeight: 600,
  fontVariantNumeric: 'oldstyle-nums tabular-nums',
  fontFeatureSettings: '"onum" 1, "tnum" 1',
} as const;

/**
 * Thin double rule, like a pair of staff lines. With `final` it ends in a
 * thin + thick barline, the end of a piece, to close a page or list.
 */
export const StaffRule: React.FC<{ my?: number; final?: boolean }> = ({ my = 1, final }) => (
  <Box role="presentation" sx={{ my, display: 'flex', height: 7, flexShrink: 0 }}>
    <Box sx={{ flex: 1, borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'text.primary' }} />
    {final && (
      <>
        <Box sx={{ width: '1.5px', bgcolor: 'text.primary' }} />
        <Box sx={{ width: '3px' }} />
        <Box sx={{ width: '5px', bgcolor: 'text.primary' }} />
      </>
    )}
  </Box>
);

/** Fermata glyph (inline SVG: no music font needed). */
export const Fermata: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg width={size} height={size / 2} viewBox="0 0 40 20" aria-hidden="true" style={{ display: 'block' }}>
    <path d="M2 19 C2 6 12 1 20 1 C28 1 38 6 38 19 L35.5 19 C35 9 28 4.5 20 4.5 C12 4.5 5 9 4.5 19 Z" fill="currentColor" />
    <circle cx="20" cy="15" r="3" fill="currentColor" />
  </svg>
);

/**
 * Session progress as measures: finished blocks are filled, the current one is
 * bounded by bold barlines.
 */
export const MeasureProgress: React.FC<{ position: number; total: number }> = ({ position, total }) => (
  <Box
    role="img"
    aria-label={`Block ${position} of ${total}`}
    sx={{ display: 'flex', alignItems: 'stretch', height: 12, mb: 0.5, flexShrink: 0, '& > *': { flexShrink: 0 } }}
  >
    {Array.from({ length: total }).map((_, i) => {
      const n = i + 1;
      const current = n === position;
      return (
        <React.Fragment key={i}>
          <Box sx={{ width: current || n === position + 1 ? '3px' : '1px', bgcolor: 'text.primary' }} />
          <Box
            sx={{
              width: '28px',
              borderTop: '1px solid',
              borderBottom: '1px solid',
              borderColor: 'text.primary',
              bgcolor: n < position ? 'text.primary' : 'transparent',
              ...(current && {
                background: 'repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 4px)',
                color: 'text.primary',
              }),
            }}
          />
        </React.Fragment>
      );
    })}
    {/* closing barline of the last measure */}
    <Box sx={{ width: position === total ? '3px' : '1px', bgcolor: 'text.primary' }} />
  </Box>
);
