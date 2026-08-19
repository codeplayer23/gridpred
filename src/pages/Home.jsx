import Hero from '@/components/hero/Hero';
import Manifesto from '@/components/hero/Manifesto';
import NextRaceSection from '@/components/hero/NextRaceSection';
import DriverExplorer from '@/components/drivers/DriverExplorer';
import StandingsSnapshot from '@/components/hero/StandingsSnapshot';
import PredictionTeaser from '@/components/predictions/PredictionTeaser';
import ClosingCta from '@/components/hero/ClosingCta';

/**
 * Landing experience, ordered as an exploration path:
 * hook → premise → next race → the grid → the season → the prediction → act.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <Manifesto />
      <NextRaceSection />
      <DriverExplorer />
      <StandingsSnapshot />
      <PredictionTeaser />
      <ClosingCta />
    </>
  );
}
