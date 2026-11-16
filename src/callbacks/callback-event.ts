import { CallbackOperationType, CallbackType } from '../api/models';

/** Top-level grouping of a callback configured through callback settings. */
export enum CallbackGroup {
  Invoices = 'INVOICES',
  Queue = 'QUEUE',
  Operations = 'OPERATIONS',
}

interface CallbackEventBase {
  /** Callback id; stable across redeliveries, so use it to deduplicate. */
  id: string;
  /** When this delivery attempt was generated (ISO 8601, UTC); changes on every resend. */
  timestamp: string;
  data: Record<string, unknown>;
}

/** A callback delivered through a callback setting. `entity` and `event` are scoped by `group`. */
export interface SettingsCallbackEvent extends CallbackEventBase {
  group: CallbackGroup;
  entity: string;
  event: string;
  chainId: string;
}

/** The flat per-object contract of callbacks created before callback settings. */
export interface LegacyCallbackEvent extends CallbackEventBase {
  type: CallbackType;
  operation_id: string;
  operation_type: CallbackOperationType;
}

export type CallbackEvent = SettingsCallbackEvent | LegacyCallbackEvent;

const GROUPS = new Set<unknown>(Object.values(CallbackGroup));
const LEGACY_TYPES = new Set<unknown>(Object.values(CallbackType));
const OPERATION_TYPES = new Set<unknown>(Object.values(CallbackOperationType));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Checks the fields every callback carries plus the discriminating ones of either contract. */
export function isCallbackEvent(value: unknown): value is CallbackEvent {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.timestamp !== 'string') {
    return false;
  }
  if (!isRecord(value.data)) {
    return false;
  }
  if ('group' in value) {
    return (
      GROUPS.has(value.group) &&
      typeof value.entity === 'string' &&
      typeof value.event === 'string' &&
      typeof value.chainId === 'string'
    );
  }
  return (
    LEGACY_TYPES.has(value.type) && typeof value.operation_id === 'string' && OPERATION_TYPES.has(value.operation_type)
  );
}

export function isSettingsCallbackEvent(event: CallbackEvent): event is SettingsCallbackEvent {
  return 'group' in event;
}
