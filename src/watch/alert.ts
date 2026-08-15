/** Pure alert formatting + filtering for `yassir watch`. */
import type { Change, ChangeKind } from './diff.js';

const ICON: Record<ChangeKind, string> = {
  flipped_out: '🔴',
  became_unknown: '🟠',
  flipped_in: '🟢',
  resolved: '🔵',
  new: '•',
};

const LABEL: Record<ChangeKind, string> = {
  flipped_out: 'NO LONGER COMPLIANT',
  flipped_in: 'now compliant',
  became_unknown: 'verdict now indeterminate',
  resolved: 'verdict resolved',
  new: 'now tracked',
};

export function formatChange(c: Change): string {
  return `${ICON[c.kind]} ${c.symbol} — ${LABEL[c.kind]}`;
}

/** Changes worth surfacing. By default the baseline `new` entries are silent. */
export function alertableChanges(changes: Change[], includeBaseline = false): Change[] {
  return changes.filter((c) => includeBaseline || c.kind !== 'new');
}

export type WebhookFormat = 'discord' | 'slack' | 'raw';

const DISCORD_WEBHOOK_RE = /\/\/(?:[^/]*\.)?(?:discord\.com|discordapp\.com)\/api\/webhooks\//i;
const SLACK_WEBHOOK_RE = /\/\/hooks\.slack\.com\//i;

export function detectWebhookFormat(url: string): WebhookFormat {
  if (DISCORD_WEBHOOK_RE.test(url)) return 'discord';
  if (SLACK_WEBHOOK_RE.test(url)) return 'slack';
  return 'raw';
}

//discord "content:" or slack "text:" contains whole batch of changes
export function formatAlertMessage(changes: Change[]): string {
  return [`⚠️ ${changes.length} compliance change(s):`, ...changes.map(formatChange)].join('\n');
}

export interface BuildWebhookPayloadOptions {
  format?: WebhookFormat;
  //default to now for tests. prod never sets it, defaulting to date at cal ltime
  now?: Date;
}

//discord/slack get their own format. all others get a generic raw payload.
//if you dont pass fornat, it will be inferred from the url (discord/slack/raw)
export function buildWebhookPayload(
  url: string,
  changes: Change[],
  opts: BuildWebhookPayloadOptions = {},
): { body: unknown } {
  const format = opts.format ?? detectWebhookFormat(url);
  if (format === 'discord') {
    return { body: { content: formatAlertMessage(changes) } };
  }
  if (format === 'slack') {
    return { body: { text: formatAlertMessage(changes) } };
  }
  const at = opts.now ?? new Date();
  return { body: { source: 'yassir-watch', at: at.toISOString(), changes } };
}
