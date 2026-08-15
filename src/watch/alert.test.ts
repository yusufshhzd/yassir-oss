import { describe, expect, test } from 'bun:test';
import {
  formatChange,
  alertableChanges,
  detectWebhookFormat,
  formatAlertMessage,
  buildWebhookPayload,
} from './alert.js';
import type { Change } from './diff.js';

describe('watch alerts', () => {
  test('formats a flipped_out change prominently', () => {
    const s = formatChange({ symbol: 'AAPL', kind: 'flipped_out', from: true, to: false });
    expect(s).toContain('AAPL');
    expect(s).toContain('🔴');
  });

  test('alertableChanges drops baseline "new" by default', () => {
    const changes: Change[] = [
      { symbol: 'A', kind: 'new', from: undefined, to: true },
      { symbol: 'B', kind: 'flipped_out', from: true, to: false },
    ];
    expect(alertableChanges(changes).map((c) => c.symbol)).toEqual(['B']);
  });

  test('alertableChanges can include baseline when asked', () => {
    const changes: Change[] = [{ symbol: 'A', kind: 'new', from: undefined, to: true }];
    expect(alertableChanges(changes, true)).toHaveLength(1);
  });
});

describe('webhook format detection', () => {
  test('detects Discord webhook URLs', () => {
    expect(detectWebhookFormat('https://discord.com/api/webhooks/123/abc')).toBe('discord');
    expect(detectWebhookFormat('https://discordapp.com/api/webhooks/123/abc')).toBe('discord');
    expect(detectWebhookFormat('https://ptb.discord.com/api/webhooks/123/abc')).toBe('discord');
  });

  test('detects Slack webhook URLs', () => {
    expect(detectWebhookFormat('https://hooks.slack.com/services/T00/B00/xyz')).toBe('slack');
  });

  test('falls back to raw for anything else', () => {
    expect(detectWebhookFormat('https://example.com/hook')).toBe('raw');
  });
});

describe('formatAlertMessage', () => {
  test('joins a header and each formatted change, keeping the icons', () => {
    const changes: Change[] = [
      { symbol: 'AAPL', kind: 'flipped_out', from: true, to: false },
      { symbol: 'MSFT', kind: 'flipped_in', from: false, to: true },
    ];
    const msg = formatAlertMessage(changes);
    expect(msg).toContain('2 compliance change(s)');
    expect(msg).toContain('🔴 AAPL — NO LONGER COMPLIANT');
    expect(msg).toContain('🟢 MSFT — now compliant');
  });
});

describe('buildWebhookPayload', () => {
  const changes: Change[] = [{ symbol: 'AAPL', kind: 'flipped_out', from: true, to: false }];

  test('shapes a Discord payload with a "content" field, auto-detected from the URL', () => {
    const { body } = buildWebhookPayload('https://discord.com/api/webhooks/1/abc', changes);
    expect(body).toEqual({ content: formatAlertMessage(changes) });
  });

  test('shapes a Slack payload with a "text" field, auto-detected from the URL', () => {
    const { body } = buildWebhookPayload('https://hooks.slack.com/services/T00/B00/xyz', changes);
    expect(body).toEqual({ text: formatAlertMessage(changes) });
  });

  test('an explicit format overrides URL detection', () => {
    const { body } = buildWebhookPayload('https://example.com/hook', changes, { format: 'discord' }) as {
      body: { content: string };
    };
    expect(body.content).toContain('🔴 AAPL');
  });

  test('keeps the raw JSON envelope for plain webhooks (no breaking change)', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const { body } = buildWebhookPayload('https://example.com/hook', changes, { now });
    expect(body).toEqual({ source: 'yassir-watch', at: now.toISOString(), changes });
  });
});
