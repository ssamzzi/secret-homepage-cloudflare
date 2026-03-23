function parseCloudinaryUrl(rawValue = "") {
  const raw = String(rawValue || "").trim().replace(/^CLOUDINARY_URL=/i, "").trim().replace(/^["']|["']$/g, "");
  if (!raw) return null;
  const parsed = new URL(raw);
  if (parsed.protocol !== "cloudinary:") return null;
  if (!parsed.username || !parsed.password || !parsed.hostname) return null;
  return {
    apiKey: decodeURIComponent(parsed.username),
    apiSecret: decodeURIComponent(parsed.password),
    cloudName: parsed.hostname,
  };
}

export function getCloudinaryConfig(env) {
  const config = parseCloudinaryUrl(env.CLOUDINARY_URL || "");
  if (!config) {
    throw new Error("CLOUDINARY_URL is missing");
  }
  return config;
}

export async function uploadImageToCloudinary(env, file) {
  const config = getCloudinaryConfig(env);
  const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`;
  const form = new FormData();
  form.append("file", file, file.name || "upload.jpg");
  form.append("folder", env.CLOUDINARY_FOLDER || "secret-homepage");

  const auth = btoa(`${config.apiKey}:${config.apiSecret}`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
    },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloudinary upload failed (${response.status}): ${text}`);
  }

  const body = await response.json();
  if (!body?.secure_url) {
    throw new Error("Cloudinary secure_url is missing");
  }
  return body.secure_url;
}
