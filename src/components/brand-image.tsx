import Image from 'next/image';
import portrait from '../../public/brand/podung.png';

export function BrandImage({ large = false }: { large?: boolean }) {
  return (
    <Image
      src={portrait}
      alt=""
      aria-hidden="true"
      className={large ? 'brand-image large' : 'brand-image'}
      width={large ? 220 : 70}
      height={large ? 220 : 70}
      sizes={large ? '220px' : '70px'}
      loading="eager"
    />
  );
}
