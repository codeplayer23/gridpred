import { memo } from 'react';
import { tint } from '@/lib/format';

/**
 * Abstract constructor mark.
 *
 * Three swept blades whose angle and spacing derive from the team id, drawn in
 * the team's own colour. Stands in for a real badge without imitating one.
 */
function TeamCrest({ team, size = 120, className = '' }) {
  const uid = `crest-${team.id}`;
  const seed = team.id.charCodeAt(0) + team.id.length;
  const lean = (seed % 7) * 3 - 9;

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`${team.name} mark`}
    >
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={team.accentSoft ?? team.accent} />
          <stop offset="100%" stopColor={team.accent} />
        </linearGradient>
      </defs>
      <g transform={`rotate(${lean} 60 60)`}>
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M ${18 + i * 6} ${34 + i * 17} C ${44 + i * 4} ${22 + i * 17}, ${74 + i * 3} ${28 + i * 17}, ${102 - i * 5} ${46 + i * 15}`}
            fill="none"
            stroke={`url(#${uid})`}
            strokeWidth={9 - i * 1.6}
            strokeLinecap="round"
            opacity={1 - i * 0.26}
          />
        ))}
      </g>
      <circle cx="60" cy="60" r="54" fill="none" stroke={tint(team.accent, 0.24)} strokeWidth="1.5" />
    </svg>
  );
}

export default memo(TeamCrest);
