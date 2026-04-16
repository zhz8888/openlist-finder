import CryptoJS from "crypto-js";
import { load } from "@tauri-apps/plugin-store";

const ENCRYPTION_KEY_STORE_FILE = "encryption-key.json";
const ENCRYPTION_KEY_KEY = "openlist-encryption-key";

let cachedKey: string | null = null;

async function getOrCreateEncryptionKey(): Promise<string> {
  if (cachedKey) {
    return cachedKey;
  }

  try {
    const store = await load(ENCRYPTION_KEY_STORE_FILE, { defaults: {} });
    let key = await store.get<string>(ENCRYPTION_KEY_KEY);
    
    if (!key) {
      key = CryptoJS.lib.WordArray.random(256 / 8).toString();
      await store.set(ENCRYPTION_KEY_KEY, key);
      await store.save();
      console.log("[Crypto] 生成并保存新的加密密钥");
    } else {
      console.log("[Crypto] 从 Tauri Store 加载加密密钥");
    }

    cachedKey = key;
    return key;
  } catch (error) {
    console.error("[Crypto] 加密密钥操作失败:", error);
    throw new Error("加密密钥初始化失败");
  }
}

export async function encrypt(plainText: string): Promise<string> {
  const key = await getOrCreateEncryptionKey();
  console.log("[Crypto] 开始加密数据");
  const encrypted = CryptoJS.AES.encrypt(plainText, key).toString();
  console.log("[Crypto] 数据加密完成");
  return encrypted;
}

export async function decrypt(cipherText: string): Promise<string> {
  const key = await getOrCreateEncryptionKey();
  console.log("[Crypto] 开始解密数据");
  
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decrypted) {
      console.error("[Crypto] 解密失败：密钥不匹配或数据已损坏");
      throw new Error("解密失败：密钥不匹配或数据已损坏");
    }
    
    console.log("[Crypto] 数据解密完成");
    return decrypted;
  } catch (error) {
    if (error instanceof Error && error.message.includes("解密失败")) {
      throw error;
    }
    console.error("[Crypto] 解密过程异常:", error);
    throw new Error("解密过程异常，请检查数据完整性");
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
      console.log(`[Crypto] 加密字段: ${String(field)}`);
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
        console.log(`[Crypto] 解密字段: ${String(field)}`);
        (decrypted[field] as unknown) = await decrypt(String(value));
      } catch (error) {
        console.error(`[Crypto] 字段 ${String(field)} 解密失败:`, error);
        throw new Error(`字段 ${String(field)} 解密失败: ${error instanceof Error ? error.message : "未知错误"}`);
      }
    }
  }
  
  return decrypted;
}
