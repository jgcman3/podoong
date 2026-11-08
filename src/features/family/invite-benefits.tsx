import { Check } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { familyInviteCopy } from './invite-copy';
export function InviteBenefits({ locale }: { locale: Locale }) {
  return (
    <ul className="family-invite-benefits">
      {familyInviteCopy(locale).benefits.map((benefit) => (
        <li key={benefit}>
          <Check size={15} aria-hidden="true" />
          <span>{benefit}</span>
        </li>
      ))}
    </ul>
  );
}
