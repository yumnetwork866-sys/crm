import {
  getMetaApiError,
  type CreateMessageTemplateOptions,
  type CreateSurveyFlowOptions,
  type CreateSurveyFlowResult,
  type MessageTemplateExample,
  type TemplateAnalyticsDataPoint,
  type TemplateAnalyticsSummary,
  type WhatsAppApprovedTemplate,
  type WhatsAppFlow,
} from './types';

export async function fetchMessageTemplates(options: {
  wabaId: string;
  token: string;
}): Promise<WhatsAppApprovedTemplate[]> {
  const { wabaId, token } = options;
  const query = new URLSearchParams({
    fields: 'id,name,status,language,category,parameter_format,rejected_reason,quality_score,components',
    limit: '100',
  });
  let nextUrl: string | null = `https://graph.facebook.com/v26.0/${wabaId}/message_templates?${query.toString()}`;
  const templates: WhatsAppApprovedTemplate[] = [];
  let pageCount = 0;

  while (nextUrl && pageCount < 10) {
    const response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    const result: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.error?.message || 'Không thể tải WhatsApp template từ Meta.');
    }
    if (Array.isArray(result?.data)) {
      templates.push(...result.data);
    }
    nextUrl = typeof result?.paging?.next === 'string' ? result.paging.next : null;
    pageCount += 1;
  }

  return templates.sort((a, b) =>
    a.name.localeCompare(b.name) || a.language.localeCompare(b.language)
  );
}

export async function deleteMessageTemplate(options: {
  wabaId: string;
  token: string;
  templateId: string;
  name: string;
}): Promise<void> {
  const query = new URLSearchParams({
    name: options.name,
    hsm_id: options.templateId,
  });
  const response = await fetch(
    `https://graph.facebook.com/v26.0/${options.wabaId}/message_templates?${query.toString()}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${options.token}` },
      signal: AbortSignal.timeout(20_000),
    },
  );
  const result: any = await response.json().catch(() => ({}));
  if (!response.ok || result?.success !== true) {
    throw new Error(getMetaApiError(result, `Meta không thể xóa template '${options.name}'.`));
  }
}

export async function fetchApprovedMessageTemplates(options: {
  wabaId: string;
  token: string;
}): Promise<WhatsAppApprovedTemplate[]> {
  const templates = await fetchMessageTemplates(options);
  return templates.filter((template) => template.status === 'APPROVED');
}

function analyticsCount(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce((total, item) => {
      const count = item && typeof item === 'object' && 'count' in item
        ? Number(item.count)
        : 0;
      return total + (Number.isFinite(count) ? count : 0);
    }, 0);
  }
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}

export async function fetchTemplateAnalytics(options: {
  wabaId: string;
  token: string;
  templateIds: string[];
  start?: number;
  end?: number;
}): Promise<TemplateAnalyticsSummary[]> {
  const end = options.end ?? Math.floor(Date.now() / 1000);
  const start = options.start ?? end - (30 * 24 * 60 * 60);
  const templateIds = Array.from(new Set(options.templateIds));
  const pointsByTemplate = new Map<string, Map<string, TemplateAnalyticsDataPoint>>(
    templateIds.map((templateId) => [templateId, new Map()]),
  );

  for (let offset = 0; offset < templateIds.length; offset += 10) {
    const batch = templateIds.slice(offset, offset + 10);
    const query = new URLSearchParams({
      start: String(start),
      end: String(end),
      granularity: 'DAILY',
      metric_types: JSON.stringify(['SENT', 'DELIVERED', 'READ', 'CLICKED']),
      template_ids: JSON.stringify(batch),
    });
    const response = await fetch(
      `https://graph.facebook.com/v26.0/${options.wabaId}/template_analytics?${query.toString()}`,
      {
        headers: { Authorization: `Bearer ${options.token}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    const result: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.error?.message || 'Không thể tải thống kê WhatsApp template từ Meta.');
    }

    for (const entry of Array.isArray(result?.data) ? result.data : []) {
      const rawPoints = Array.isArray(entry?.data_points) ? entry.data_points : [entry];
      for (const rawPoint of rawPoints) {
        const templateId = String(rawPoint?.template_id ?? entry?.template_id ?? '');
        const templatePoints = pointsByTemplate.get(templateId);
        if (!templatePoints) continue;
        const point: TemplateAnalyticsDataPoint = {
          start: analyticsCount(rawPoint?.start),
          end: analyticsCount(rawPoint?.end),
          sent: analyticsCount(rawPoint?.sent),
          delivered: analyticsCount(rawPoint?.delivered),
          read: analyticsCount(rawPoint?.read),
          clicked: analyticsCount(rawPoint?.clicked),
        };
        const pointKey = `${point.start}:${point.end}`;
        const existing = templatePoints.get(pointKey);
        templatePoints.set(pointKey, existing ? {
          start: point.start,
          end: point.end,
          sent: existing.sent + point.sent,
          delivered: existing.delivered + point.delivered,
          read: existing.read + point.read,
          clicked: existing.clicked + point.clicked,
        } : point);
      }
    }
  }

  return templateIds.map((templateId) => {
    const dataPoints = Array.from(pointsByTemplate.get(templateId)?.values() || [])
      .sort((a, b) => a.start - b.start || a.end - b.end);
    return dataPoints.reduce<TemplateAnalyticsSummary>((summary, point) => ({
      ...summary,
      sent: summary.sent + point.sent,
      delivered: summary.delivered + point.delivered,
      read: summary.read + point.read,
      clicked: summary.clicked + point.clicked,
    }), {
      templateId,
      sent: 0,
      delivered: 0,
      read: 0,
      clicked: 0,
      dataPoints,
    });
  });
}

export async function fetchWhatsAppFlows(options: {
  wabaId: string;
  token: string;
}): Promise<WhatsAppFlow[]> {
  const { wabaId, token } = options;
  const query = new URLSearchParams({
    fields: 'id,name,status,categories',
    limit: '100',
  });
  let nextUrl: string | null = `https://graph.facebook.com/v26.0/${wabaId}/flows?${query.toString()}`;
  const flows: WhatsAppFlow[] = [];
  let pageCount = 0;

  while (nextUrl && pageCount < 10) {
    const response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    const result: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.error?.message || 'Không thể tải danh sách Flow từ Meta.');
    }
    if (Array.isArray(result?.data)) {
      flows.push(...result.data);
    }
    nextUrl = typeof result?.paging?.next === 'string' ? result.paging.next : null;
    pageCount += 1;
  }

  return flows.sort((a, b) => a.name.localeCompare(b.name));
}

type FlowJsonDataDefinition = {
  type: 'array';
  items: { type: 'string' };
  __example__: string[];
};

/** Build a self-contained, endpoint-less survey accepted by the WhatsApp Flows JSON schema. */
export function buildSurveyFlowJson(
  screens: CreateSurveyFlowOptions['screens'],
): Record<string, unknown> {
  const screenIds = ['SURVEY_ONE', 'SURVEY_TWO', 'SURVEY_THREE'] as const;
  const routingModel = Object.fromEntries(
    screenIds.map((screenId, index) => [screenId, screenIds[index + 1] ? [screenIds[index + 1]] : []]),
  );

  return {
    version: '7.1',
    routing_model: routingModel,
    screens: screens.map((screen, index) => {
      const isLastScreen = index === screens.length - 1;
      const previousAnswers = Object.fromEntries(
        screens.slice(0, index).map((_previousScreen, previousIndex) => [
          `answer_${previousIndex + 1}`,
          {
            type: 'array',
            items: { type: 'string' },
            __example__: [`option_${previousIndex + 1}_1`],
          } satisfies FlowJsonDataDefinition,
        ]),
      );
      const answerName = `answer_${index + 1}`;
      const payload = Object.fromEntries([
        ...Object.keys(previousAnswers).map((name) => [name, `\${data.${name}}`]),
        [answerName, `\${form.${answerName}}`],
      ]);

      return {
        id: screenIds[index],
        title: screen.title,
        ...(isLastScreen ? { terminal: true, success: true } : {}),
        ...(index > 0 ? { data: previousAnswers } : {}),
        layout: {
          type: 'SingleColumnLayout',
          children: [{
            type: 'Form',
            name: `survey_form_${index + 1}`,
            children: [
              { type: 'TextHeading', text: screen.heading },
              { type: 'TextBody', text: screen.description },
              {
                type: 'CheckboxGroup',
                name: answerName,
                label: 'Chọn ít nhất một phương án',
                required: true,
                'data-source': screen.options.map((option, optionIndex) => ({
                  id: `option_${index + 1}_${optionIndex + 1}`,
                  title: option,
                })),
              },
              {
                type: 'Footer',
                label: isLastScreen ? 'Gửi' : 'Tiếp tục',
                'on-click-action': isLastScreen
                  ? { name: 'complete', payload }
                  : {
                    name: 'navigate',
                    next: { type: 'screen', name: screenIds[index + 1] },
                    payload,
                  },
              },
            ],
          }],
        },
      };
    }),
  };
}

/** Create a real editable Meta Flow and upload its Flow JSON without publishing it. */
export async function createSurveyFlow(
  options: CreateSurveyFlowOptions,
): Promise<CreateSurveyFlowResult> {
  const createResponse = await fetch(
    `https://graph.facebook.com/v26.0/${options.wabaId}/flows`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: options.name, categories: ['SURVEY'] }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  const createResult: any = await createResponse.json().catch(() => ({}));
  if (!createResponse.ok || !createResult?.id) {
    throw new Error(getMetaApiError(createResult, 'Meta không thể tạo WhatsApp Flow.'));
  }

  const flowId = String(createResult.id);
  const formData = new FormData();
  const flowJson = JSON.stringify(buildSurveyFlowJson(options.screens));
  formData.append('file', new Blob([flowJson], { type: 'application/json' }), 'flow.json');
  formData.append('name', 'flow.json');
  formData.append('asset_type', 'FLOW_JSON');

  try {
    const uploadResponse = await fetch(
      `https://graph.facebook.com/v26.0/${flowId}/assets`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${options.token}` },
        body: formData,
        signal: AbortSignal.timeout(20_000),
      },
    );
    const uploadResult: any = await uploadResponse.json().catch(() => ({}));
    const hasValidationErrors = Array.isArray(uploadResult?.validation_errors)
      && uploadResult.validation_errors.length > 0;
    if (!uploadResponse.ok || uploadResult?.success === false || hasValidationErrors) {
      throw new Error(getMetaApiError(uploadResult, 'Meta từ chối file flow.json.'));
    }
  } catch (uploadError: any) {
    let cleanupSucceeded = false;
    try {
      const cleanupResponse = await fetch(`https://graph.facebook.com/v26.0/${flowId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${options.token}` },
        signal: AbortSignal.timeout(15_000),
      });
      const cleanupResult: any = await cleanupResponse.json().catch(() => ({}));
      cleanupSucceeded = cleanupResponse.ok && cleanupResult?.success !== false;
    } catch {
      cleanupSucceeded = false;
    }
    const uploadMessage = uploadError?.message || 'Không thể tải flow.json lên Meta.';
    throw new Error(
      cleanupSucceeded
        ? `${uploadMessage} Flow nháp đã được dọn dẹp.`
        : `${uploadMessage} Không thể dọn dẹp Flow nháp ${flowId}; hãy xóa thủ công trong Meta.`,
      { cause: uploadError },
    );
  }

  return { id: flowId, name: options.name, status: 'DRAFT' };
}

function namedExamplePayload(examples: MessageTemplateExample[]) {
  return examples.map((example) => ({
    param_name: example.name,
    example: example.value,
  }));
}

export function buildMessageTemplatePayload(options: CreateMessageTemplateOptions) {
  const {
    name,
    language,
    category,
    parameterFormat = 'POSITIONAL',
    allowCategoryChange,
    header,
    body,
    bodyExamples,
    footer,
    buttons,
    authentication,
  } = options;
  const components: any[] = [];

  if (category === 'AUTHENTICATION') {
    if (!authentication) throw new Error('Thiếu cấu hình authentication.');
    components.push({
      type: 'BODY',
      ...(authentication.addSecurityRecommendation !== undefined
        ? { add_security_recommendation: authentication.addSecurityRecommendation }
        : {}),
    });
    if (authentication.codeExpirationMinutes !== undefined) {
      components.push({
        type: 'FOOTER',
        code_expiration_minutes: authentication.codeExpirationMinutes,
      });
    }
    components.push({
      type: 'BUTTONS',
      buttons: [{
        type: 'OTP',
        otp_type: authentication.otpType,
        ...(authentication.button.text ? { text: authentication.button.text } : {}),
        ...(authentication.button.autofill ? { autofill_text: authentication.button.autofill } : {}),
        ...(authentication.button.package ? { package_name: authentication.button.package } : {}),
        ...(authentication.button.signature ? { signature_hash: authentication.button.signature } : {}),
        ...(authentication.button.zeroTapTermsAccepted !== undefined
          ? { zero_tap_terms_accepted: authentication.button.zeroTapTermsAccepted }
          : {}),
      }],
    });
  } else {
    if (header && header.format !== 'NONE') {
      if (header.format === 'TEXT') {
        components.push({
          type: 'HEADER',
          format: 'TEXT',
          text: header.text,
          ...(header.examples.length > 0
            ? {
              example: parameterFormat === 'NAMED'
                ? { header_text_named_params: namedExamplePayload(header.examples) }
                : { header_text: header.examples.map((example) => example.value) },
            }
            : {}),
        });
      } else if (header.format === 'LOCATION') {
        components.push({
          type: 'HEADER',
          format: 'LOCATION',
        });
      } else {
        components.push({
          type: 'HEADER',
          format: header.format,
          example: { header_handle: [header.mediaHandle] },
        });
      }
    }

    components.push({
      type: 'BODY',
      text: body,
      ...(bodyExamples.length > 0
        ? {
          example: parameterFormat === 'NAMED'
            ? { body_text_named_params: namedExamplePayload(bodyExamples) }
            : { body_text: [bodyExamples.map((example) => example.value)] },
        }
        : {}),
    });
    if (footer) components.push({ type: 'FOOTER', text: footer });
    if (buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: buttons.map((button) => {
          if (button.type === 'URL') {
            return {
              type: 'URL',
              text: button.text,
              url: button.url,
              ...(button.urlExample ? { example: [button.urlExample] } : {}),
            };
          }
          if (button.type === 'PHONE_NUMBER') {
            return {
              type: 'PHONE_NUMBER',
              text: button.text,
              phone_number: button.phoneNumber,
            };
          }
          if (button.type === 'VOICE_CALL') {
            return {
              type: 'VOICE_CALL',
              text: button.text,
              active_for: button.activeForDays,
            };
          }
          if (button.type === 'FLOW') {
            return {
              type: 'FLOW',
              text: button.text,
              ...(button.flowId ? { flow_id: button.flowId } : {}),
              flow_action: 'navigate',
              ...(button.navigateScreen ? { navigate_screen: button.navigateScreen } : {}),
            };
          }
          if (button.type === 'COPY_CODE') {
            return {
              type: 'COPY_CODE',
              text: button.text,
            };
          }
          if (button.type === 'CONTACT') {
            return {
              type: 'CONTACT',
              text: button.text,
            };
          }
          return { type: 'QUICK_REPLY', text: button.text };
        }),
      });
    }
  }

  return {
    name,
    language,
    category,
    ...(category !== 'AUTHENTICATION' ? { parameter_format: parameterFormat } : {}),
    ...(allowCategoryChange !== undefined ? { allow_category_change: allowCategoryChange } : {}),
    components,
  };
}

export async function createMessageTemplate(options: CreateMessageTemplateOptions): Promise<any> {
  const response = await fetch(`https://graph.facebook.com/v26.0/${options.wabaId}/message_templates`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildMessageTemplatePayload(options)),
    signal: AbortSignal.timeout(20_000),
  });
  const result: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error?.error_user_msg || result?.error?.message || 'Meta từ chối yêu cầu tạo template.');
  }
  return result;
}

export async function verifyApprovedMessageTemplate(options: {
  wabaId: string;
  token: string;
  templateName: string;
  languageCode: string;
}): Promise<WhatsAppApprovedTemplate> {
  const templates = await fetchApprovedMessageTemplates(options);
  const approved = templates.find(
    (template) =>
      template.name === options.templateName &&
      template.language === options.languageCode
  );
  if (!approved) {
    throw new Error(`Template '${options.templateName}' (${options.languageCode}) chưa được Meta phê duyệt hoặc không tồn tại.`);
  }
  return approved;
}
