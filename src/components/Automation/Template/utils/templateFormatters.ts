import { getPhoneCountryDialCode } from '../../../../data/phoneCountries';
import type {
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

export function toE164Phone(countryIso: string, phoneNumber: string): string {
  const countryDigits = getPhoneCountryDialCode(countryIso).replace(/\D/g, '');
  const trimmedPhone = phoneNumber.trim();
  let localDigits = trimmedPhone.replace(/\D/g, '');

  if (trimmedPhone.startsWith('+') && localDigits.startsWith(countryDigits)) {
    localDigits = localDigits.slice(countryDigits.length);
  }

  return `+${countryDigits}${localDigits.replace(/^0+/, '')}`;
}
