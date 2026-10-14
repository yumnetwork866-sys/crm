import { describe, expect, it } from 'vitest';
import { getWebhookSenderIdentifier } from './webhookMessageParser';

describe('getWebhookSenderIdentifier', () => {
  it('uses the standard from field first', () => {
    expect(getWebhookSenderIdentifier({ from: '84908123456', user_id: 'ignored' })).toBe('84908123456');
  });

  it('accepts BSUID-style from_user_id payloads', () => {
    expect(getWebhookSenderIdentifier({ from_user_id: 'MY.941245582048923' })).toBe('MY.941245582048923');
  });

  it('accepts username-style user_id payloads', () => {
    expect(getWebhookSenderIdentifier({ user_id: '@ghahrzl' })).toBe('@ghahrzl');
  });

  it('can resolve user_id from the webhook contacts collection', () => {
    expect(getWebhookSenderIdentifier({}, {
      contacts: [{ user_id: 'MY.941245582048923' }],
    })).toBe('MY.941245582048923');
  });
});

