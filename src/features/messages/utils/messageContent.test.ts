import { describe, expect, it } from 'vitest';
import {
  extractAudioInfo,
  extractImageInfo,
  isAudioContent,
  parseMessageContent,
} from './messageContent';

describe('messageContent utility', () => {
  describe('isAudioContent and extractAudioInfo', () => {
    it('detects data:audio base64 data URLs', () => {
      const dataUrl = 'data:audio/webm;codecs=opus;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJ7...';
      expect(isAudioContent(dataUrl)).toBe(true);

      const info = extractAudioInfo(dataUrl);
      expect(info.isAudio).toBe(true);
      expect(info.audioUrl).toBe(dataUrl);
      expect(info.caption).toBeNull();
    });

    it('detects audio files in /uploads/ directory', () => {
      const audioPath = '/uploads/chat/voice_1710000000_abc.webm';
      expect(isAudioContent(audioPath)).toBe(true);

      const info = extractAudioInfo(audioPath);
      expect(info.isAudio).toBe(true);
      expect(info.audioUrl).toBe(audioPath);
    });

    it('detects Meta proxy media with type=audio', () => {
      const metaAudio = '/api/meta/media/123456789?type=audio';
      expect(isAudioContent(metaAudio)).toBe(true);

      const info = extractAudioInfo(metaAudio);
      expect(info.isAudio).toBe(true);
      expect(info.audioUrl).toBe(metaAudio);
    });

    it('detects audio placeholders without direct URLs', () => {
      const placeholder = '[Tin nhắn thoại (Audio)]';
      expect(isAudioContent(placeholder)).toBe(true);

      const info = extractAudioInfo(placeholder);
      expect(info.isAudio).toBe(true);
      expect(info.audioUrl).toBeNull();
    });

    it('ensures audio messages are not falsely classified as images by extractImageInfo', () => {
      const audioPath = '/uploads/chat/voice_1710000000_abc.webm';
      const imgInfo = extractImageInfo(audioPath);
      expect(imgInfo.isImage).toBe(false);
      expect(imgInfo.imgUrl).toBeNull();
    });
  });

  describe('extractImageInfo', () => {
    it('still correctly detects images', () => {
      const imagePath = '/uploads/chat/image_123.jpg';
      const imgInfo = extractImageInfo(imagePath);
      expect(imgInfo.isImage).toBe(true);
      expect(imgInfo.imgUrl).toBe(imagePath);
    });
  });

  describe('parseMessageContent', () => {
    it('parses quoted replies correctly', () => {
      const replyData = { id: 'msg_1', senderName: 'Alice', content: 'Hello' };
      const raw = `[reply:${JSON.stringify(replyData)}]\nChào bạn!`;
      const parsed = parseMessageContent(raw);
      expect(parsed.replyTo).toEqual(replyData);
      expect(parsed.cleanContent).toBe('Chào bạn!');
    });
  });
});
