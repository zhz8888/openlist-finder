import CryptoJS from "crypto-js";
import { getKey, generateKey } from "@/services/keyringService";

let cachedKey: string | null = null;

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
    console.warn("[Crypto] Token 解密失败，返回原始值:", error);
    return token;
  }
}

async function getOrCreateEncryptionKey(): Promise<string> {
  if (cachedKey) {
    return cachedKey;
  }

  try {
    let key = await getKey();
    
    if (!key) {
      console.log("[Crypto] 未找到加密密钥，正在生成新密钥");
      key = await generateKey();
      console.log("[Crypto] 新密钥已生成并保存到系统密钥链");
    } else {
      console.log("[Crypto] 从系统密钥链加载加密密钥");
    }

    cachedKey = key;
    return key;
  } catch (error) {
    console.error("[Crypto] 加密密钥操作失败:", error);
    throw new Error("加密密钥初始化失败");
  }
}

function deriveKey(password: string): CryptoJS.lib.WordArray {
  return CryptoJS.SHA256(password);
}

export async function encrypt(plainText: string): Promise<string> {
  const key = await getOrCreateEncryptionKey();
  console.log("[Crypto] 开始加密数据");
  
  try {
    const derivedKey = deriveKey(key);
    const iv = CryptoJS.lib.WordArray.random(16);
    
    const encrypted = CryptoJS.AES.encrypt(plainText, derivedKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    
    const result = iv.toString() + ":" + encrypted.ciphertext.toString();
    console.log("[Crypto] 数据加密完成");
    return result;
  } catch (error) {
    console.error("[Crypto] 加密失败:", error);
    throw new Error(`数据加密失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }
}

export async function decrypt(cipherText: string): Promise<string> {
  const key = await getOrCreateEncryptionKey();
  console.log("[Crypto] 开始解密数据");
  
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
        console.error("[Crypto] 解密失败：密钥不匹配或数据已损坏");
        console.error("[Crypto] 密文长度:", cipherText.length);
        throw new Error("解密失败：密钥不匹配或数据已损坏");
      }
      
      console.log("[Crypto] 数据解密完成");
      return decrypted;
    } else {
      console.log("[Crypto] 检测到旧格式密文，尝试兼容解密");
      const derivedKey = deriveKey(key);
      const bytes = CryptoJS.AES.decrypt(cipherText, derivedKey, {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
      
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decrypted) {
        console.error("[Crypto] 旧格式解密失败");
        throw new Error("解密失败：密钥不匹配或数据已损坏");
      }
      
      console.log("[Crypto] 旧格式数据解密完成");
      return decrypted;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("解密失败")) {
      throw error;
    }
    console.error("[Crypto] 解密过程异常:", error);
    throw new Error(`解密过程异常，请检查数据完整性: ${error instanceof Error ? error.message : "未知错误"}`);
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
