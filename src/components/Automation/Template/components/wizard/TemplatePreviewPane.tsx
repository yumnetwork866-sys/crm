import type { TemplateFormData, WizardStep } from '../../types';
import { TemplatePreview } from '../TemplatePreview';

interface TemplatePreviewPaneProps {
  wizardStep: WizardStep;
  form: TemplateFormData;
}

export function TemplatePreviewPane({ wizardStep, form }: TemplatePreviewPaneProps) {
  return (
    <div className="w-full lg:w-90">
      <div
        className="z-20 lg:fixed lg:top-20 lg:max-h-[calc(100vh-11rem)] lg:w-90 lg:overflow-y-auto lg:rounded-2xl"
        style={{ right: 'max(2rem, calc((100vw - 1536px) / 2))' }}
      >
        <TemplatePreview
          wizardStep={wizardStep}
          templateType={form.templateType}
          category={form.category}
          headerFormat={form.headerFormat}
          headerText={form.headerText}
          headerExamples={form.headerExamples}
          mediaFileName={form.mediaFileName}
          mediaPreviewUrl={form.mediaPreviewUrl}
          body={form.body}
          bodyExamples={form.bodyExamples}
          footer={form.footer}
          buttons={form.buttons}
          parameterFormat={form.parameterFormat}
          otpType={form.otpType}
          otpButtonText={form.otpButtonText}
          otpExpiration={form.otpExpiration}
          addSecurityRecommendation={form.addSecurityRecommendation}
        />
      </div>
    </div>
  );
}
