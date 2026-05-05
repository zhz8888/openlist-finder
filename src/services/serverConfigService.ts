import { invoke } from "@tauri-apps/api/core";
import type { ServerConfig } from "@/types";

/**
 * 从后端加载所有服务器配置
 * 
 * 调用 Rust 后端的 load_servers 命令,从 Tauri Store 中读取持久化的服务器配置。
 * 
 * @returns 服务器配置列表
 */
export async function loadServers(): Promise<ServerConfig[]> {
  try {
    return await invoke<ServerConfig[]>("load_servers");
  } catch (error) {
    console.error("[ServerConfig] Failed to load servers:", error);
    throw error;
  }
}

/**
 * 保存所有服务器配置到后端
 * 
 * 将服务器配置列表写入 Rust 后端的 Tauri Store 进行持久化存储。
 * 
 * @param servers - 要保存的服务器配置列表
 */
export async function saveServers(servers: ServerConfig[]): Promise<void> {
  try {
    await invoke<void>("save_servers", { servers });
  } catch (error) {
    console.error("[ServerConfig] Failed to save servers:", error);
    throw error;
  }
}

/**
 * 添加新服务器配置
 * 
 * 创建新的服务器配置并添加到持久化存储中。
 * 
 * @param server - 要添加的服务器配置
 */
export async function addServer(server: ServerConfig): Promise<void> {
  try {
    await invoke<void>("add_server", { server });
  } catch (error) {
    console.error("[ServerConfig] Failed to add server:", error);
    throw error;
  }
}

/**
 * 更新服务器配置
 * 
 * 根据服务器 ID 更新现有服务器配置的信息。只有提供的字段才会被更新。
 * 
 * @param id - 要更新的服务器 ID
 * @param data - 要更新的字段数据
 */
export async function updateServer(
  id: string,
  data: {
    name?: string;
    url?: string;
    token?: string;
    username?: string;
    password?: string;
    isDefault?: boolean;
  }
): Promise<void> {
  try {
    await invoke<void>("update_server", {
      id,
      data: {
        name: data.name,
        url: data.url,
        token: data.token,
        username: data.username,
        password: data.password,
        is_default: data.isDefault,
      },
    });
  } catch (error) {
    console.error("[ServerConfig] Failed to update server:", error);
    throw error;
  }
}

/**
 * 删除服务器配置
 * 
 * 根据服务器 ID 从持久化存储中移除指定的服务器配置。
 * 
 * @param id - 要删除的服务器 ID
 */
export async function removeServer(id: string): Promise<void> {
  try {
    await invoke<void>("remove_server", { id });
  } catch (error) {
    console.error("[ServerConfig] Failed to remove server:", error);
    throw error;
  }
}

/**
 * 设置默认服务器
 * 
 * 将指定服务器设为默认服务器,同时取消其他服务器的默认状态。
 * 
 * @param id - 要设为默认的服务器 ID
 */
export async function setDefaultServer(id: string): Promise<void> {
  try {
    await invoke<void>("set_default_server", { id });
  } catch (error) {
    console.error("[ServerConfig] Failed to set default server:", error);
    throw error;
  }
}
