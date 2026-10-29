import { useFlag } from './flags';
import { NewCheckout, OldCheckout, Banner } from './components';

export function App() {
  const newCheckout = useFlag('new-checkout');
  return (
    <main>
      {useFlag('old-banner') && <Banner />}
      {newCheckout ? <NewCheckout /> : <OldCheckout />}
    </main>
  );
}
