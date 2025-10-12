import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

export const sha256Hex = (value: string) => bytesToHex(sha256(utf8ToBytes(value)));
