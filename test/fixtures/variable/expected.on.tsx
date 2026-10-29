import { Steps } from './Steps';

export function Wizard() {
  const onNext = () => console.log('next');

  const step = 1;
  console.log(step);

  return (
    <div>
      <Steps onNext={onNext} />
    </div>
  );
}
