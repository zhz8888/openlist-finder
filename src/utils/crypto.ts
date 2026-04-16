import CryptoJS from "crypto-js";

const ENCRYPTION_KEY_STORAGE_KEY = "openlist-encryption-key";

function getOrCreateEncryptionKey(): string {
  if (typeof window === "undefined") {
    throw new Error("Encryption is only available in browser environment");
  }

  let key = sessionStorage.getItem(ENCRYPTION_KEY_STORAGE_KEY);
  
  if (!key) {
    key = CryptoJS.lib.WordArray.random(256 / 8).toString();
    sessionStorage.setItem(ENCRYPTION_KEY_STORAGE_KEY, key);
  }

  return key;
}

export function encrypt(plainText: string): string {
  const key = getOrCreateEncryptionKey();
  const encrypted = CryptoJS.AES.encrypt(plainText, key).toString();
  return encrypted;
}

export function decrypt(cipherText: string): string {
  const key = getOrCreateEncryptionKey();
  const bytes = CryptoJS.AES.decrypt(cipherText, key);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  
  if (!decrypted) {
    throw new Error("解密失败：密钥不匹配或数据已损坏");
  }
  
  return decrypted;
}

export function encryptObject<T extends Record<string, unknown>>(
  obj: T,
  fieldsToEncrypt: (keyof T)[]
): T {
  const encrypted = { ...obj };
  
  for (const field of fieldsToEncrypt) {
    const value = obj[field];
    if (value !== undefined && value !== null) {
      (encrypted[field] as unknown) = encrypt(String(value));
    }
  }
  
  return encrypted;
}

export function decryptObject<T extends Record<string, unknown>>(
  obj: T,
  fieldsToDecrypt: (keyof T)[]
): T {
  const decrypted = { ...obj };
  
  for (const field of fieldsToDecrypt) {
    const value = obj[field];
    if (value !== undefined && value !== null) {
      try {
        (decrypted[field] as unknown) = decrypt(String(value));
      } catch {
        (decrypted[field] as unknown) = value;
      }
    }
  }
  
  return decrypted;
}
