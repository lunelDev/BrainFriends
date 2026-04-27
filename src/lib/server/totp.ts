/**
 * src/lib/server/totp.ts
 *
 * RFC 6238 TOTP 구현 (외부 패키지 없이 Node 내장 crypto 만 사용).
 * 정책: SHA1 / 30초 윈도우 / 6자리 — 표준 인증앱(Google Authenticator,
 * Microsoft Authenticator, 1Password 등) 호환.
 *
 * 보안 메모:
 *   - 검증 시 ±1 윈도우 허용(시계 어긋남 보정).
 *   - 같은 시간 윈도우에서 동일 코드를 두 번 못 쓰도록 호출자가 last_verified_at
 *     같은 컬럼을 함께 검사할 책임이 있다 (replay 방어).
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecretBase32(byteLength = 20): string {
  const bytes = randomBytes(byteLength);
  return base32Encode(bytes);
}

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < buffer.length; i += 1) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/g, "").toUpperCase().replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (let i = 0; i < cleaned.length; i += 1) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx < 0) throw new Error("invalid_base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function generateHotp(
  secret: Buffer,
  counter: bigint,
  digits = 6,
  algorithm = "SHA1",
): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(counter);
  const hmac = createHmac(algorithm.toLowerCase(), secret);
  hmac.update(counterBuf);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binCode =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  const mod = 10 ** digits;
  const code = (binCode % mod).toString().padStart(digits, "0");
  return code;
}

export type TotpVerifyOptions = {
  secretBase32: string;
  code: string;
  digits?: number;
  periodSec?: number;
  algorithm?: string;
  windowDriftSteps?: number; // ±N step
  now?: Date;
};

export function generateTotpAt(opts: {
  secretBase32: string;
  digits?: number;
  periodSec?: number;
  algorithm?: string;
  now?: Date;
}): string {
  const periodSec = opts.periodSec ?? 30;
  const digits = opts.digits ?? 6;
  const algorithm = opts.algorithm ?? "SHA1";
  const epochSec = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  const counter = BigInt(Math.floor(epochSec / periodSec));
  return generateHotp(base32Decode(opts.secretBase32), counter, digits, algorithm);
}

/**
 * TOTP 검증.
 * 시계 ±drift step 허용 (기본 ±1 = 30초 전후 ±30초).
 * 일치하면 사용된 step 인덱스 리턴 (0 = 현재, ±1 = 직전/다음). 불일치면 null.
 */
export function verifyTotp(opts: TotpVerifyOptions): number | null {
  const periodSec = opts.periodSec ?? 30;
  const digits = opts.digits ?? 6;
  const algorithm = opts.algorithm ?? "SHA1";
  const drift = opts.windowDriftSteps ?? 1;
  const cleaned = String(opts.code).replace(/\D/g, "");
  if (cleaned.length !== digits) return null;

  const secret = base32Decode(opts.secretBase32);
  const epochSec = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  const baseCounter = BigInt(Math.floor(epochSec / periodSec));

  const expectedBuf = Buffer.from(cleaned);
  for (let step = -drift; step <= drift; step += 1) {
    const candidate = generateHotp(
      secret,
      baseCounter + BigInt(step),
      digits,
      algorithm,
    );
    const candidateBuf = Buffer.from(candidate);
    if (
      candidateBuf.length === expectedBuf.length &&
      timingSafeEqual(candidateBuf, expectedBuf)
    ) {
      return step;
    }
  }
  return null;
}

/**
 * otpauth:// URI 생성 — 인증앱 QR 등록용.
 * label 은 "<issuer>:<account>" 형식 권장.
 */
export function buildOtpAuthUri(opts: {
  secretBase32: string;
  account: string;
  issuer?: string;
  digits?: number;
  periodSec?: number;
  algorithm?: string;
}): string {
  const issuer = opts.issuer ?? "BrainFriends";
  const params = new URLSearchParams();
  params.set("secret", opts.secretBase32);
  params.set("issuer", issuer);
  params.set("algorithm", opts.algorithm ?? "SHA1");
  params.set("digits", String(opts.digits ?? 6));
  params.set("period", String(opts.periodSec ?? 30));
  const label = encodeURIComponent(`${issuer}:${opts.account}`);
  return `otpauth://totp/${label}?${params.toString()}`;
}
