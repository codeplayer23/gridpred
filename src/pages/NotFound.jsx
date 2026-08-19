import { Link } from 'react-router-dom';
import Button from '@/components/ui/Button';

export default function NotFound({ label = 'Page not found' }) {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
      <p className="mono-label mb-6">Error 404</p>
      <h1 className="font-display text-[clamp(3rem,12vw,9rem)] leading-[0.85] font-medium tracking-[-0.05em]">
        BOX,
        <br />
        BOX.
      </h1>
      <p className="mt-8 max-w-sm text-ink-mute">
        {label}. Nothing here but an empty pit box — head back to the timing screens.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button to="/">Back to home</Button>
        <Button to="/drivers" variant="ghost">
          Explore drivers
        </Button>
      </div>
      <Link to="/predict" className="mono-label mt-10 transition-colors hover:text-ink">
        Or jump to the prediction
      </Link>
    </div>
  );
}
