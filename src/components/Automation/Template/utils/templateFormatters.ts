import { getPhoneCountryDialCode } from '../../../../data/phoneCountries';
import type {
  AutomationParameterSource,
  AutomationTemplateParameterMapping,
  WhatsAppApprovedTemplate,
  WhatsAppTemplateExample,
  WhatsAppTemplateParameterFormat,
} from '../../../../types';
import { extractVariables } from './templateValidation';

export function syncExamples(
  current: WhatsAppTemplateExample[],
  variables: string[],
  format: WhatsAppTemplateParameterFormat,
): WhatsAppTemplateExample[] {
  const next = variables.map((variable, index) => ({
    ...(format === 'NAMED' ? { name: variable } : {}),
    value:
      current.find((example) => example.name === variable)?.value ||
      current[index]?.value ||
      '',
  }));

  const isUnchanged = next.length === current.length && next.every((example, index) => (
    example.name === current[index]?.name && example.value === current[index]?.value
  ));

  return isUnchanged ? current : next;
}

export function substituteExamples(
  text: string,
  examples: WhatsAppTemplateExample[],
  format: WhatsAppTemplateParameterFormat,
): string {
  const variables = extractVariables(text, format);

  return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, variable: string) => {
    const index = variables.indexOf(variable.trim());
    const example =
      format === 'NAMED'
        ? examples.find((item) => item.name === variable.trim())
        : examples[index];

    return example?.value.trim() || match;
  });
}

export interface ApprovedTemplateVariable {
  component: 'HEADER' | 'BODY' | 'BUTTON';
  componentIndex: number;
  buttonIndex?: number;
  variable: string;
  token: string;
  example?: string;
}

export const AUTOMATION_PARAMETER_SOURCE_OPTIONS: Array<{
  value: AutomationParameterSource;
  label: string;
  preview: string;
}> = [
  { value: 'customer_name', label: 'Tên khách hàng', preview: 'Nguyễn Văn A' },
  { value: 'customer_phone', label: 'Số điện thoại', preview: '0901 234 567' },
  { value: 'customer_email', label: 'Email', preview: 'nguyenvana@example.com' },
  { value: 'customer_address', label: 'Địa chỉ', preview: '123 Nguyễn Huệ, TP.HCM' },
  { value: 'order_code', label: 'Mã đơn hàng', preview: 'DH000123' },
  { value: 'order_date', label: 'Ngày mua', preview: '04/09/2026' },
  { value: 'order_total', label: 'Tổng tiền đơn hàng', preview: '500.000 ₫' },
  { value: 'product_name', label: 'Tên sản phẩm', preview: 'Sản phẩm mẫu' },
  { value: 'product_quantity', label: 'Số lượng sản phẩm', preview: '1' },
  { value: 'constant', label: 'Giá trị cố định', preview: '' },
];

export function getApprovedTemplateParameterFormat(
  template?: WhatsAppApprovedTemplate,
): WhatsAppTemplateParameterFormat {
  return template?.parameter_format?.toUpperCase() === 'NAMED' ? 'NAMED' : 'POSITIONAL';
}

function getComponentExamples(
  template: WhatsAppApprovedTemplate,
  component: WhatsAppApprovedTemplate['components'][number],
  componentType: 'HEADER' | 'BODY',
): Map<string, string> {
  const format = getApprovedTemplateParameterFormat(template);
  if (format === 'NAMED') {
    const values = componentType === 'HEADER'
      ? component.example?.header_text_named_params
      : component.example?.body_text_named_params;
    return new Map(
      (values || []).flatMap((item) => (
        item.param_name && typeof item.example === 'string'
          ? [[item.param_name, item.example] as const]
          : []
      )),
    );
  }

  const values = componentType === 'HEADER'
    ? component.example?.header_text
    : component.example?.body_text?.[0];
  return new Map((values || []).map((value, index) => [String(index + 1), value]));
}

export function extractApprovedTemplateVariables(
  template?: WhatsAppApprovedTemplate,
): ApprovedTemplateVariable[] {
  if (!template) return [];

  const format = getApprovedTemplateParameterFormat(template);
  const pattern = format === 'NAMED'
    ? /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi
    : /\{\{\s*(\d+)\s*\}\}/g;
  const variables: ApprovedTemplateVariable[] = [];

  template.components.forEach((component, componentIndex) => {
    const componentType = component.type?.toUpperCase();
    if ((componentType === 'HEADER' || componentType === 'BODY') && component.text) {
      const examples = getComponentExamples(template, component, componentType);
      const seen = new Set<string>();
      for (const match of component.text.matchAll(new RegExp(pattern.source, pattern.flags))) {
        const variable = match[1];
        if (seen.has(variable)) continue;
        seen.add(variable);
        variables.push({
          component: componentType,
          componentIndex,
          variable,
          token: match[0],
          example: examples.get(variable),
        });
      }
    }

    if (componentType === 'BUTTONS') {
      (component.buttons || []).forEach((button, buttonIndex) => {
        if (button.type?.toUpperCase() !== 'URL' || !button.url) return;
        const seen = new Set<string>();
        for (const match of button.url.matchAll(new RegExp(pattern.source, pattern.flags))) {
          const variable = match[1];
          if (seen.has(variable)) continue;
          seen.add(variable);
          variables.push({
            component: 'BUTTON',
            componentIndex,
            buttonIndex,
            variable,
            token: match[0],
            example: button.example?.[0],
          });
        }
      });
    }
  });

  return variables;
}

export function getAutomationParameterMappingKey(
  mapping: Pick<AutomationTemplateParameterMapping, 'component' | 'componentIndex' | 'buttonIndex' | 'variable'>,
): string {
  return [mapping.component, mapping.componentIndex, mapping.buttonIndex ?? '-', mapping.variable].join(':');
}

export function getAutomationParameterPreviewValue(
  mapping?: AutomationTemplateParameterMapping,
  fallback = '',
): string {
  if (!mapping?.source) return fallback;
  if (mapping.source === 'constant') return mapping.value?.trim() || fallback;
  return AUTOMATION_PARAMETER_SOURCE_OPTIONS.find((option) => option.value === mapping.source)?.preview || fallback;
}

export function toE164Phone(countryIso: string, phoneNumber: string): string {
  const countryDigits = getPhoneCountryDialCode(countryIso).replace(/\D/g, '');
  const trimmedPhone = phoneNumber.trim();
  let localDigits = trimmedPhone.replace(/\D/g, '');

  if (trimmedPhone.startsWith('+') && localDigits.startsWith(countryDigits)) {
    localDigits = localDigits.slice(countryDigits.length);
  }

  return `+${countryDigits}${localDigits.replace(/^0+/, '')}`;
}
