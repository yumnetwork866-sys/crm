import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildMessageTemplatePayload,
  buildSurveyFlowJson,
  createSurveyFlow,
  deleteMessageTemplate,
  fetchTemplateAnalytics,
  fetchWhatsAppFlows,
  uploadTemplateSampleMedia,
} from './metaApiClient';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildMessageTemplatePayload', () => {
  it('maps named examples, media header and marketing buttons to Meta fields', () => {
    const payload = buildMessageTemplatePayload({
      wabaId: 'waba-id',
      token: 'token',
      name: 'order_ready',
      language: 'vi',
      category: 'UTILITY',
      parameterFormat: 'NAMED',
      allowCategoryChange: true,
      header: {
        format: 'IMAGE',
        examples: [],
        mediaHandle: 'media-handle',
      },
      body: 'Xin chào {{customer_name}}, đơn {{order_id}} đã sẵn sàng.',
      bodyExamples: [
        { name: 'customer_name', value: 'An' },
        { name: 'order_id', value: 'A-123' },
      ],
      footer: 'Cảm ơn bạn',
      buttons: [
        { type: 'URL', text: 'Xem đơn', url: 'https://example.com/orders/{{order_id}}', urlExample: 'https://example.com/orders/A-123' },
        { type: 'PHONE_NUMBER', text: 'Gọi hỗ trợ', phoneNumber: '+84901234567' },
        { type: 'VOICE_CALL', text: 'Gọi WhatsApp', activeForDays: 7 },
        { type: 'QUICK_REPLY', text: 'Đã hiểu' },
      ],
    });

    expect(payload).toEqual({
      name: 'order_ready',
      language: 'vi',
      category: 'UTILITY',
      parameter_format: 'NAMED',
      allow_category_change: true,
      components: [
        {
          type: 'HEADER',
          format: 'IMAGE',
          example: { header_handle: ['media-handle'] },
        },
        {
          type: 'BODY',
          text: 'Xin chào {{customer_name}}, đơn {{order_id}} đã sẵn sàng.',
          example: {
            body_text_named_params: [
              { param_name: 'customer_name', example: 'An' },
              { param_name: 'order_id', example: 'A-123' },
            ],
          },
        },
        { type: 'FOOTER', text: 'Cảm ơn bạn' },
        {
          type: 'BUTTONS',
          buttons: [
            {
              type: 'URL',
              text: 'Xem đơn',
              url: 'https://example.com/orders/{{order_id}}',
              example: ['https://example.com/orders/A-123'],
            },
            { type: 'PHONE_NUMBER', text: 'Gọi hỗ trợ', phone_number: '+84901234567' },
            { type: 'VOICE_CALL', text: 'Gọi WhatsApp', active_for: 7 },
            { type: 'QUICK_REPLY', text: 'Đã hiểu' },
          ],
        },
      ],
    });
  });

  it('nests positional BODY examples and maps authentication OTP components', () => {
    const positional = buildMessageTemplatePayload({
      wabaId: 'waba-id',
      token: 'token',
      name: 'offer',
      language: 'vi',
      category: 'MARKETING',
      body: 'Xin chào {{1}}, mã của bạn là {{2}}.',
      bodyExamples: [{ value: 'An' }, { value: 'SALE20' }],
      buttons: [],
    });
    expect(positional.components[0].example).toEqual({ body_text: [['An', 'SALE20']] });

    const authentication = buildMessageTemplatePayload({
      wabaId: 'waba-id',
      token: 'token',
      name: 'login_code',
      language: 'vi',
      category: 'AUTHENTICATION',
      bodyExamples: [],
      buttons: [],
      authentication: {
        addSecurityRecommendation: true,
        codeExpirationMinutes: 10,
        otpType: 'ZERO_TAP',
        button: {
          text: 'Sao chép mã',
          autofill: 'Tự động điền',
          package: 'com.example.app',
          signature: 'signature-hash',
          zeroTapTermsAccepted: true,
        },
      },
    });
    expect(authentication).toEqual({
      name: 'login_code',
      language: 'vi',
      category: 'AUTHENTICATION',
      components: [
        { type: 'BODY', add_security_recommendation: true },
        { type: 'FOOTER', code_expiration_minutes: 10 },
        {
          type: 'BUTTONS',
          buttons: [{
            type: 'OTP',
            otp_type: 'ZERO_TAP',
            text: 'Sao chép mã',
            autofill_text: 'Tự động điền',
            package_name: 'com.example.app',
            signature_hash: 'signature-hash',
            zero_tap_terms_accepted: true,
          }],
        },
      ],
    });
  });
});

const surveyScreens = [
  {
    title: 'Câu hỏi 1',
    heading: 'Bạn quan tâm điều gì?',
    description: 'Chọn các phương án phù hợp.',
    options: ['Giá', 'Chất lượng'],
  },
  {
    title: 'Câu hỏi 2',
    heading: 'Bạn muốn được liên hệ ở đâu?',
    description: 'Bạn có thể chọn nhiều kênh.',
    options: ['WhatsApp', 'Email'],
  },
  {
    title: 'Câu hỏi 3',
    heading: 'Khi nào bạn muốn mua?',
    description: 'Chọn thời gian phù hợp nhất.',
    options: ['Hôm nay', 'Tuần sau'],
  },
] as const;

describe('buildSurveyFlowJson', () => {
  it('builds a three-screen endpoint-less survey with navigation and completion payloads', () => {
    const flowJson: any = buildSurveyFlowJson(surveyScreens.map((screen) => ({
      ...screen,
      options: [...screen.options],
    })) as unknown as Parameters<typeof buildSurveyFlowJson>[0]);

    expect(flowJson.version).toBe('7.1');
    expect(flowJson.routing_model).toEqual({
      SURVEY_ONE: ['SURVEY_TWO'],
      SURVEY_TWO: ['SURVEY_THREE'],
      SURVEY_THREE: [],
    });
    expect(flowJson.screens).toHaveLength(3);
    expect(flowJson.screens[0]).toMatchObject({
      id: 'SURVEY_ONE',
      title: 'Câu hỏi 1',
      layout: {
        type: 'SingleColumnLayout',
        children: [{
          type: 'Form',
          name: 'survey_form_1',
          children: [
            { type: 'TextHeading', text: 'Bạn quan tâm điều gì?' },
            { type: 'TextBody', text: 'Chọn các phương án phù hợp.' },
            {
              type: 'CheckboxGroup',
              name: 'answer_1',
              required: true,
              'data-source': [
                { id: 'option_1_1', title: 'Giá' },
                { id: 'option_1_2', title: 'Chất lượng' },
              ],
            },
            {
              type: 'Footer',
              'on-click-action': {
                name: 'navigate',
                next: { type: 'screen', name: 'SURVEY_TWO' },
                payload: { answer_1: '${form.answer_1}' },
              },
            },
          ],
        }],
      },
    });
    expect(flowJson.screens[1].data.answer_1).toEqual({
      type: 'array',
      items: { type: 'string' },
      __example__: ['option_1_1'],
    });
    expect(flowJson.screens[2]).toMatchObject({
      terminal: true,
      success: true,
      data: {
        answer_1: expect.any(Object),
        answer_2: expect.any(Object),
      },
    });
    const finalAction = flowJson.screens[2].layout.children[0].children[3]['on-click-action'];
    expect(finalAction).toEqual({
      name: 'complete',
      payload: {
        answer_1: '${data.answer_1}',
        answer_2: '${data.answer_2}',
        answer_3: '${form.answer_3}',
      },
    });
  });
});

describe('createSurveyFlow', () => {
  it('creates a draft on the WABA then uploads flow.json as a FLOW_JSON asset', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'flow-123' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createSurveyFlow({
      wabaId: 'waba-id',
      token: 'access-token',
      name: 'Khảo sát khách hàng',
      screens: surveyScreens.map((screen) => ({ ...screen, options: [...screen.options] })) as unknown as Parameters<typeof buildSurveyFlowJson>[0],
    })).resolves.toEqual({ id: 'flow-123', name: 'Khảo sát khách hàng', status: 'DRAFT' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('https://graph.facebook.com/v26.0/waba-id/flows');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Khảo sát khách hàng', categories: ['SURVEY'] }),
    });
    expect(fetchMock.mock.calls[1][0]).toBe('https://graph.facebook.com/v26.0/flow-123/assets');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer access-token' },
    });
    const formData = fetchMock.mock.calls[1][1]?.body as FormData;
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get('name')).toBe('flow.json');
    expect(formData.get('asset_type')).toBe('FLOW_JSON');
    const flowFile = formData.get('file') as File;
    expect(flowFile.name).toBe('flow.json');
    expect(flowFile.type).toBe('application/json');
    expect(JSON.parse(await flowFile.text())).toEqual(buildSurveyFlowJson(
      surveyScreens.map((screen) => ({ ...screen, options: [...screen.options] })) as unknown as Parameters<typeof buildSurveyFlowJson>[0],
    ));
  });

  it('deletes the newly created draft when asset upload fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'flow-456' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        validation_errors: [{ error: 'Invalid screen layout' }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createSurveyFlow({
      wabaId: 'waba-id',
      token: 'access-token',
      name: 'Survey',
      screens: surveyScreens.map((screen) => ({ ...screen, options: [...screen.options] })) as unknown as Parameters<typeof buildSurveyFlowJson>[0],
    })).rejects.toThrow('Invalid screen layout Flow nháp đã được dọn dẹp.');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]).toEqual([
      'https://graph.facebook.com/v26.0/flow-456',
      expect.objectContaining({
        method: 'DELETE',
        headers: { Authorization: 'Bearer access-token' },
      }),
    ]);
  });
});

describe('deleteMessageTemplate', () => {
  it('deletes only the selected language variant by name and hsm_id', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteMessageTemplate({
      wabaId: 'waba-id',
      token: 'access-token',
      templateId: '123456',
      name: 'order_ready',
    })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v26.0/waba-id/message_templates?name=order_ready&hsm_id=123456',
      expect.objectContaining({
        method: 'DELETE',
        headers: { Authorization: 'Bearer access-token' },
      }),
    );
  });
});

describe('fetchWhatsAppFlows', () => {
  it('loads all pages from Meta and sorts flows by name', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: '2', name: 'Flow B', status: 'PUBLISHED' }],
        paging: { next: 'https://graph.facebook.com/v26.0/next-page' },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: '1', name: 'Flow A', status: 'DRAFT' }],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWhatsAppFlows({
      wabaId: 'waba-id',
      token: 'access-token',
    })).resolves.toEqual([
      { id: '1', name: 'Flow A', status: 'DRAFT' },
      { id: '2', name: 'Flow B', status: 'PUBLISHED' },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/waba-id/flows?');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: 'Bearer access-token' },
    });
  });
});

describe('fetchTemplateAnalytics', () => {
  it('batches template IDs and normalizes daily metrics and totals', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{
          granularity: 'DAILY',
          data_points: [
            {
              template_id: '1',
              start: 1_700_000_000,
              end: 1_700_086_400,
              sent: 10,
              delivered: 8,
              read: 6,
              clicked: [{ count: 2 }, { count: 1 }],
            },
            {
              template_id: '1',
              start: 1_700_086_400,
              end: 1_700_172_800,
              sent: 5,
              delivered: 4,
              read: 3,
              clicked: 2,
            },
          ],
        }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{
          template_id: '11',
          start: 1_700_000_000,
          end: 1_700_086_400,
          sent: 7,
          delivered: 6,
          read: 5,
          clicked: [{ count: 4 }],
        }],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const templateIds = Array.from({ length: 11 }, (_, index) => String(index + 1));

    const result = await fetchTemplateAnalytics({
      wabaId: 'waba-id',
      token: 'access-token',
      templateIds,
      start: 1_700_000_000,
      end: 1_700_172_800,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(firstUrl.origin + firstUrl.pathname).toBe(
      'https://graph.facebook.com/v26.0/waba-id/template_analytics',
    );
    expect(firstUrl.searchParams.get('start')).toBe('1700000000');
    expect(firstUrl.searchParams.get('end')).toBe('1700172800');
    expect(firstUrl.searchParams.get('granularity')).toBe('DAILY');
    expect(JSON.parse(firstUrl.searchParams.get('metric_types') || '[]')).toEqual([
      'SENT', 'DELIVERED', 'READ', 'CLICKED',
    ]);
    expect(JSON.parse(firstUrl.searchParams.get('template_ids') || '[]')).toEqual(templateIds.slice(0, 10));
    const secondUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(JSON.parse(secondUrl.searchParams.get('template_ids') || '[]')).toEqual(['11']);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: 'Bearer access-token' },
    });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      headers: { Authorization: 'Bearer access-token' },
    });

    expect(result).toHaveLength(11);
    expect(result[0]).toEqual({
      templateId: '1',
      sent: 15,
      delivered: 12,
      read: 9,
      clicked: 5,
      dataPoints: [
        {
          start: 1_700_000_000,
          end: 1_700_086_400,
          sent: 10,
          delivered: 8,
          read: 6,
          clicked: 3,
        },
        {
          start: 1_700_086_400,
          end: 1_700_172_800,
          sent: 5,
          delivered: 4,
          read: 3,
          clicked: 2,
        },
      ],
    });
    expect(result[1]).toEqual({
      templateId: '2', sent: 0, delivered: 0, read: 0, clicked: 0, dataPoints: [],
    });
    expect(result[10]).toMatchObject({
      templateId: '11', sent: 7, delivered: 6, read: 5, clicked: 4,
    });
  });
});

describe('uploadTemplateSampleMedia', () => {
  it('creates an upload session then posts the raw buffer with the required headers', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'upload:session-id' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ h: 'sample-handle' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const buffer = Buffer.from('sample');

    await expect(uploadTemplateSampleMedia({
      appId: 'app-id',
      token: 'access-token',
      fileName: 'sample.png',
      mimeType: 'image/png',
      buffer,
    })).resolves.toBe('sample-handle');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/app-id/uploads?');
    expect(fetchMock.mock.calls[0][0]).toContain('file_name=sample.png');
    expect(fetchMock.mock.calls[0][0]).toContain('file_type=image%2Fpng');
    expect(fetchMock.mock.calls[1][0]).toContain('/upload%3Asession-id');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'OAuth access-token',
        file_offset: '0',
        'Content-Type': 'application/octet-stream',
      },
      body: buffer,
    });
  });
});
