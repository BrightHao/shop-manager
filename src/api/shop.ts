import { app } from "../utils/cloudbase";

const ENV_ID = import.meta.env.VITE_ENV_ID || "";

export async function callShopApi(
  action: string,
  data: Record<string, unknown> = {},
) {
  if (!ENV_ID) {
    throw new Error("VITE_ENV_ID is not configured");
  }

  try {
    const result = await app.callFunction({
      name: "shop-api",
      data: { action, data },
    });
    // Unwrap cloud function response: { code, message, data: { data, total } }
    return result.result?.data ?? result.result;
  } catch (error) {
    console.error(`Shop API call failed [${action}]:`, error);
    throw error;
  }
}

export async function callShopApiRaw(
  name: string,
  data: Record<string, unknown> = {},
) {
  if (!ENV_ID) {
    throw new Error("VITE_ENV_ID is not configured");
  }

  try {
    const result = await app.callFunction({
      name,
      data,
    });
    return result.result;
  } catch (error) {
    console.error(`Shop raw API call failed [${name}]:`, error);
    throw error;
  }
}
