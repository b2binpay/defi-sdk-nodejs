import type { ResponseError } from '../generated-contracts';

const BOX_INNER_WIDTH = 52;

export class InsufficientCreditsError extends Error {
  override name = 'InsufficientCreditsError';

  constructor(
    public readonly required?: number,
    public readonly available?: number,
  ) {
    super('Insufficient credits for operation');
  }
}

export function formatCreditsWarning(required?: number, available?: number): string {
  const pad = (text: string): string => `║  ${text.padEnd(BOX_INNER_WIDTH - 2)}║`;
  const empty = pad('');
  const top = `╔${'═'.repeat(BOX_INNER_WIDTH)}╗`;
  const divider = `╠${'═'.repeat(BOX_INNER_WIDTH)}╣`;
  const bottom = `╚${'═'.repeat(BOX_INNER_WIDTH)}╝`;

  const header = '⚠  b2binpay-sdk warning';
  const headerPadded = header
    .padStart(Math.floor((BOX_INNER_WIDTH - 2 + header.length) / 2))
    .padEnd(BOX_INNER_WIDTH - 2);

  const lines: string[] = [top, `║  ${headerPadded}║`, divider, pad('Insufficient credits')];

  if (required !== undefined && available !== undefined) {
    lines.push(empty);
    lines.push(pad(`Required:   ${required}`));
    lines.push(pad(`Available:  ${available}`));
  }

  lines.push(bottom);

  return lines.join('\n');
}

export async function parseCreditsError(err: ResponseError): Promise<InsufficientCreditsError | null> {
  if (err.response.status !== 402) {
    return null;
  }

  try {
    const body: unknown = await err.response.clone().json();
    if (body !== null && typeof body === 'object') {
      const { required, available } = body as Record<string, unknown>;
      const req = typeof required === 'number' ? required : undefined;
      const avail = typeof available === 'number' ? available : undefined;
      return new InsufficientCreditsError(req, avail);
    }
  } catch {
    // body unreadable — still a credits error
  }

  return new InsufficientCreditsError();
}
