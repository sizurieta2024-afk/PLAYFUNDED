import { createHash, randomUUID } from "node:crypto";

const MAX_SIZE = 10 * 1024 * 1024;
const MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
} as const;

export type AllowedKycMime = keyof typeof MIME_TO_EXT;

export const ALLOWED_KYC_TYPES = Object.keys(MIME_TO_EXT) as AllowedKycMime[];
export const KYC_MAX_SIZE = MAX_SIZE;

function hasPdfSignature(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function hasJpegSignature(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function hasPngSignature(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function isFilenameSuspicious(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("..") ||
    /[\\/<>:"|?*\x00-\x1f]/.test(name) ||
    /\.(exe|js|sh|php|bat|cmd|scr|zip|rar)(\.[a-z0-9]+)?$/i.test(lower)
  );
}

function matchesSignature(type: AllowedKycMime, buffer: Buffer): boolean {
  if (type === "application/pdf") return hasPdfSignature(buffer);
  if (type === "image/jpeg") return hasJpegSignature(buffer);
  return hasPngSignature(buffer);
}

export type KycFileValidationResult =
  | {
      ok: false;
      error: "file_too_big" | "file_wrong_type" | "file_bad_signature" | "file_name_invalid" | "file_empty";
    }
  | {
      ok: true;
      contentType: AllowedKycMime;
      extension: string;
      sha256: string;
      storageName: string;
      size: number;
    };

export function validateKycFile(
  userId: string,
  file: File,
  buffer: Buffer,
): KycFileValidationResult {
  if (file.size <= 0 || buffer.length === 0) {
    return { ok: false, error: "file_empty" };
  }

  if (file.size > KYC_MAX_SIZE) {
    return { ok: false, error: "file_too_big" };
  }

  if (!ALLOWED_KYC_TYPES.includes(file.type as AllowedKycMime)) {
    return { ok: false, error: "file_wrong_type" };
  }

  if (isFilenameSuspicious(file.name)) {
    return { ok: false, error: "file_name_invalid" };
  }

  const contentType = file.type as AllowedKycMime;
  if (!matchesSignature(contentType, buffer)) {
    return { ok: false, error: "file_bad_signature" };
  }

  const extension = MIME_TO_EXT[contentType];
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  return {
    ok: true,
    contentType,
    extension,
    sha256,
    storageName: `${userId}/${Date.now()}-${randomUUID()}.${extension}`,
    size: file.size,
  };
}
