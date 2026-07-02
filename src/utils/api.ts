import { ShopData, Message } from "../types";

export async function fetchShopData(): Promise<ShopData> {
  const res = await fetch("/api/shop");
  if (!res.ok) {
    throw new Error("មិនអាចទាញយកទិន្នន័យបានទេ");
  }
  return res.json();
}

export async function saveShopData(data: ShopData): Promise<void> {
  const res = await fetch("/api/shop", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error("មិនអាចរក្សាទុកទិន្នន័យបានទេ");
  }
}

export async function loginUser(username: string, password: string): Promise<{ success: boolean; role?: "owner" | "staff"; name?: string } | null> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      return res.json();
    }
  } catch (error) {
    console.warn("Auth server connection failed, trying offline validation...", error);
  }

  // Offline or network failure fallback
  const normalizedUser = (username || "").toLowerCase().trim();

  // Try to find in offline cache
  try {
    const cached = localStorage.getItem("kunthy_shop_data_cache");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && Array.isArray(parsed.users)) {
        const found = parsed.users.find(
          (u: any) => (u.username || "").toLowerCase().trim() === normalizedUser
        );
        if (found && found.password === password) {
          return { success: true, role: found.role, name: found.name };
        }
      }
    }
  } catch (err) {
    console.error("Error reading cached users during offline login:", err);
  }

  // Static fallback if server is unreachable
  if ((normalizedUser === "admin" || normalizedUser === "kunthy") && password === "123456") {
    return { success: true, role: "owner", name: "Kunthy" };
  } else if (normalizedUser === "pich" && password === "123456") {
    return { success: true, role: "staff", name: "Pich" };
  }

  return null;
}

export async function chatWithAI(
  message: string,
  history: Message[],
  context: ShopData
): Promise<string> {
  const res = await fetch("/api/gemini/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, history, context }),
  });
  if (!res.ok) {
    throw new Error("ការឆ្លើយតបរបស់ AI មានបញ្ហា");
  }
  const data = await res.json();
  return data.text;
}

export async function resetShopData(): Promise<ShopData> {
  const res = await fetch("/api/shop/reset", {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("មិនអាចកំណត់ទិន្នន័យឡើងវិញបានទេ");
  }
  const result = await res.json();
  return result.data;
}
