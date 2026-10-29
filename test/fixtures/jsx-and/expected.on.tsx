import { PromoBanner } from './PromoBanner';
import { Footer } from './Footer';

export function Page({ isAdmin }: { isAdmin: boolean }) {
  return (
    <main>
      <PromoBanner />
      {isAdmin && <span>admin promo</span>}
      <Footer />
    </main>
  );
}
