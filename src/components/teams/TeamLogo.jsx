import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { cx, tint } from '@/lib/format';
import { getTeamLogo } from '@/data/teamAssets';

/**
 * Team logo.
 *
 * Marks come from the canonical registry in data/teamAssets.js — openly
 * licensed files recoloured to white silhouettes so they read on GridPred's
 * dark surfaces. A team with no licensed mark, and any logo that fails to load,
 * falls back to a neutral GridPred plate carrying the team's own name and
 * colour. Another team's logo is never substituted.
 */
function TeamLogo({
  team,
  size = 40,
  className = '',
  showFallbackLabel = true,
  tone = 'light',
  animated = false,
}) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : getTeamLogo(team?.id);

  if (!team) return null;

  if (!src) {
    return (
      <span
        className={cx('inline-flex shrink-0 items-center gap-2 rounded-md px-2 py-1', className)}
        style={{
          height: size,
          border: `1px solid ${tint(team.accent ?? '#8a9099', 0.45)}`,
          background: tint(team.accent ?? '#8a9099', 0.1),
        }}
        title={`${team.name} — no openly-licensed logo available`}
      >
        <span
          aria-hidden
          className="block h-2 w-2 shrink-0 rounded-[2px]"
          style={{ background: team.accent }}
        />
        {showFallbackLabel && (
          <span
            className="truncate font-display leading-none font-semibold tracking-[-0.02em]"
            style={{ fontSize: Math.max(9, size * 0.32), color: team.accent }}
          >
            {team.abbreviation ?? team.name}
          </span>
        )}
        <span className="sr-only">{team.name} logo unavailable</span>
      </span>
    );
  }

  const Img = animated ? motion.img : 'img';
  return (
    <Img
      src={src}
      alt={`${team.name} logo`}
      onError={() => setFailed(true)}
      loading="lazy"
      decoding="async"
      className={cx('block shrink-0 object-contain object-left', className)}
      style={{
        height: size,
        maxWidth: size * 3.2,
        opacity: tone === 'light' ? 0.92 : 0.7,
        filter: tone === 'light' ? 'none' : 'grayscale(1)',
      }}
      {...(animated
        ? { whileHover: { scale: 1.06 }, transition: { type: 'spring', stiffness: 320, damping: 22 } }
        : {})}
    />
  );
}

export default memo(TeamLogo);
