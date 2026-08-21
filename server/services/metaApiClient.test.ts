import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildMessageTemplatePayload,
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
