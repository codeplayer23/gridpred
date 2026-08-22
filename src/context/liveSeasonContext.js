import { createContext } from 'react';

/**
 * Live championship context. Kept in its own module so the provider component
 * and the consumer hooks can live in separate files — a file that exports both
 * a component and helpers breaks React Fast Refresh.
 */
export const LiveSeasonContext = createContext(null);
