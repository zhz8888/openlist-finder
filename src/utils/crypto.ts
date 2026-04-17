import CryptoJS from "crypto-js";
import { getKey, generateKey } from "@/services/keyringService";

let cachedKey: string | null = null;

function maskSensitiveData(data: string): string {
  if (!data || data.length <= 8) return "***";
  return `${data.substring(0, 4)}...${data.substring(data.length - 4)}`;
}

function looksLikeEncryptedToken(token: string): boolean {
  if (!token || token.length < 10) {
    return false;
  }
  
  const parts = token.split(":");
  if (parts.length === 2) {
    const ivPart = parts[0];
    
    if (ivPart.length === 32 && /^[0-9a-fA-F]+$/.test(ivPart)) {
      return true;
    }
  }
  
  return false;
}

export async function isTokenEncrypted(token: string): Promise<boolean> {
  return looksLikeEncryptedToken(token);
}

export async function tryDecryptToken(token: string): Promise<string> {
  if (!looksLikeEncryptedToken(token)) {
    return token;
  }
  
  try {
    return await decrypt(token);
  } catch (error) {
    console.warn("[Crypto] Token decryption failed, returning original value:", error);
    return token;
  }
}

async function getOrCreateEncryptionKey(): Promise<string> {
  if (cachedKey) {
    console.log("[Crypto] Using cached encryption key");
    return cachedKey;
  }

  try {
    console.log("[Crypto] Fetching encryption key");
    let key = await getKey();
    
    if (!key) {
      console.log("[Crypto] No encryption key found, generating new key");
      key = await generateKey();
      console.log("[Crypto] New key generated, length:", key.length);
      console.log("[Crypto] Key prefix:", maskSensitiveData(key));
    } else {
      console.log("[Crypto] Loaded encryption key from keychain, length:", key.length);
      console.log("[Crypto] Key prefix:", maskSensitiveData(key));
    }

    cachedKey = key;
    return key;
  } catch (error) {
    console.error("[Crypto] Encryption key operation failed:", error);
    throw new Error("Encryption key initialization failed");
  }
}

function deriveKey(password: string): CryptoJS.lib.WordArray {
  return CryptoJS.SHA256(password);
}

export async function encrypt(plainText: string): Promise<string> {
  const key = await getOrCreateEncryptionKey();
  console.log("[Crypto] Starting data encryption");
  
  try {
    const derivedKey = deriveKey(key);
    const iv = CryptoJS.lib.WordArray.random(16);
    
    const encrypted = CryptoJS.AES.encrypt(plainText, derivedKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    
    const result = iv.toString() + ":" + encrypted.ciphertext.toString();
    console.log("[Crypto] Data encryption completed");
    return result;
  } catch (error) {
    console.error("[Crypto] Encryption failed:", error);
    throw new Error(`Data encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function decrypt(cipherText: string): Promise<string> {
  const key = await getOrCreateEncryptionKey();
  console.log("[Crypto] Starting data decryption");
  console.log("[Crypto] Ciphertext:", maskSensitiveData(cipherText));
  console.log("[Crypto] Key prefix:", maskSensitiveData(key));
  
  try {
    const parts = cipherText.split(":");
    
    if (parts.length === 2) {
      const iv = CryptoJS.enc.Hex.parse(parts[0]);
      const ciphertext = CryptoJS.enc.Hex.parse(parts[1]);
      const derivedKey = deriveKey(key);
      
      const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: ciphertext,
      });
      
      const bytes = CryptoJS.AES.decrypt(cipherParams, derivedKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
      
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decrypted) {
        console.error("[Crypto] Decryption failed: key mismatch or corrupted data");
        console.error("[Crypto] Ciphertext length:", cipherText.length);
        throw new Error("Decryption failed: key mismatch or corrupted data");
      }
      
      // 检查解密结果是否包含非打印字符（可能是密钥不匹配导致的乱码）
      const hasNonPrintableChars = /[^\x20-\x7E\s]/.test(decrypted);
      if (hasNonPrintableChars) {
        console.error("[Crypto] Decryption result contains non-printable characters, possible key mismatch");
        console.error("[Crypto] Decryption result preview:", maskSensitiveData(decrypted));
        throw new Error("Decryption failed: key mismatch or corrupted data");
      }
      
      console.log("[Crypto] Data decryption completed");
      console.log("[Crypto] Plaintext length:", decrypted.length);
      return decrypted;
    } else {
      console.log("[Crypto] Detected legacy format ciphertext, attempting compatible decryption");
      const derivedKey = deriveKey(key);
      const bytes = CryptoJS.AES.decrypt(cipherText, derivedKey, {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
      
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decrypted) {
        console.error("[Crypto] Legacy format decryption failed");
        throw new Error("Decryption failed: key mismatch or corrupted data");
      }
      
      // 检查解密结果是否包含非打印字符
      const hasNonPrintableChars = /[^\x20-\x7E\s]/.test(decrypted);
      if (hasNonPrintableChars) {
        console.error("[Crypto] Legacy format decryption result contains non-printable characters, possible key mismatch");
        console.error("[Crypto] Decryption result preview:", maskSensitiveData(decrypted));
        throw new Error("Decryption failed: key mismatch or corrupted data");
      }
      
      console.log("[Crypto] Legacy format data decryption completed");
      return decrypted;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Decryption failed")) {
      throw error;
    }
    console.error("[Crypto] Decryption process exception:", error);
    throw new Error(`Decryption process exception, please check data integrity: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function encryptObject<T extends Record<string, unknown>>(
  obj: T,
  fieldsToEncrypt: (keyof T)[]
): Promise<T> {
  const encrypted = { ...obj };
  
  for (const field of fieldsToEncrypt) {
    const value = obj[field];
    if (value !== undefined && value !== null) {
      console.log(`[Crypto] Encrypting field: ${String(field)}`);
      (encrypted[field] as unknown) = await encrypt(String(value));
    }
  }
  
  return encrypted;
}

export async function decryptObject<T extends Record<string, unknown>>(
  obj: T,
  fieldsToDecrypt: (keyof T)[]
): Promise<T> {
  const decrypted = { ...obj };
  
  for (const field of fieldsToDecrypt) {
    const value = obj[field];
    if (value !== undefined && value !== null) {
      try {
        console.log(`[Crypto] Decrypting field: ${String(field)}`);
        (decrypted[field] as unknown) = await decrypt(String(value));
      } catch (error) {
        console.error(`[Crypto] Failed to decrypt field ${String(field)}:`, error);
        throw new Error(`Failed to decrypt field ${String(field)}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
  }
  
  return decrypted;
}
