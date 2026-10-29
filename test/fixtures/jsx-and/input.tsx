import { useFlag } from '../flags';
import { PromoBanner } from './PromoBanner';
import { Footer } from './Footer';

export function Page({ isAdmin }: { isAdmin: boolean }) {
  return (
    <main>
      {useFlag('new-checkout') && <PromoBanner />}
      {useFlag('new-checkout') && isAdmin && <span>admin promo</span>}
      <Footer />
    </main>
  );
}
