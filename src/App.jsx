import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import Home from '@/pages/Home';

/**
 * Home ships in the main bundle so the landing experience paints immediately.
 * Every other route is split — the analytics and comparison views pull in the
 * charting library, which has no business in the first paint.
 */
const Drivers = lazy(() => import('@/pages/Drivers'));
const DriverDetail = lazy(() => import('@/pages/DriverDetail'));
const Teams = lazy(() => import('@/pages/Teams'));
const TeamDetail = lazy(() => import('@/pages/TeamDetail'));
const Races = lazy(() => import('@/pages/Races'));
const RaceDetail = lazy(() => import('@/pages/RaceDetail'));
const Predict = lazy(() => import('@/pages/Predict'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Compare = lazy(() => import('@/pages/Compare'));
const NotFound = lazy(() => import('@/pages/NotFound'));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="drivers" element={<Drivers />} />
        <Route path="drivers/:id" element={<DriverDetail />} />
        <Route path="teams" element={<Teams />} />
        <Route path="teams/:id" element={<TeamDetail />} />
        <Route path="races" element={<Races />} />
        <Route path="races/:id" element={<RaceDetail />} />
        <Route path="predict" element={<Predict />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="compare" element={<Compare />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
