/**
 * Known MultiSigWallet contract versions used by the signature packing functions.
 *
 * Only v1.0.0 needs an explicit constant — it is the legacy format (raw 65-byte
 * ECDSA concatenation). v1.1.0 and later all use the same packed format, so they
 * are matched implicitly as "anything that is not v1.0.0".
 */
export const CONTRACT_VERSION_LEGACY = '1.0.0';
