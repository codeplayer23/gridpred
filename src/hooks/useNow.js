import { useEffect, useState } from 'react';

/**
 * A single shared clock.
 *
 * Countdowns, session state and freshness labels all need the current time. Giving
 * each its own interval means dozens of timers drifting apart; this keeps one
 * timer per tick rate and hands the same instant to every subscriber.
 */
const subscribers = new Map(); // interval -> { timer, listeners:Set }

function subscribe(interval, listener) {
  let entry = subscribers.get(interval);
  if (!entry) {
    entry = { timer: null, listeners: new Set() };
    subscribers.set(interval, entry);
  }
  entry.listeners.add(listener);
  if (!entry.timer) {
    entry.timer = setInterval(() => {
      const now = Date.now();
      entry.listeners.forEach((fn) => fn(now));
    }, interval);
  }
  return () => {
    entry.listeners.delete(listener);
    if (entry.listeners.size === 0) {
      clearInterval(entry.timer);
      subscribers.delete(interval);
    }
  };
}

/**
 * @param {number} interval tick rate in ms — 1000 for countdowns, 60000 for
 *                          anything that only needs minute resolution
 * @returns {number} the current epoch time, updated on each tick
 */
export function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => subscribe(interval, setNow), [interval]);
  return now;
}
