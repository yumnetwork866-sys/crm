import { memo } from 'react';
import type { WhatsAppTemplateButtonType } from '../../../../../types';
import { TEMPLATE_BUTTON_ICON_CLASSES } from '../../constants/templateConstants';

interface TemplateButtonIconProps {
  type: WhatsAppTemplateButtonType;
  iconClass?: string;
}

export const TemplateButtonIcon = memo(function TemplateButtonIcon({ type, iconClass }: TemplateButtonIconProps) {
  const isWhatsApp = type === 'VOICE_CALL';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center text-emerald-600 template-preview-button-icon ${
        isWhatsApp ? 'is-whatsapp' : ''
      }`}
      aria-hidden="true"
    >
      <i className={`${iconClass || TEMPLATE_BUTTON_ICON_CLASSES[type]} block leading-none`} />
    </span>
  );
});
