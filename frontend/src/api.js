export async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || data?.error || `Request failed: ${response.status}`);
  }
  return data;
}

export async function sendJson(url, { method = "POST", body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || data?.error || `Request failed: ${response.status}`);
  }
  return data;
}

export async function sendForm(url, formData, { method = "POST" } = {}) {
  const response = await fetch(url, {
    method,
    body: formData,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || data?.error || `Request failed: ${response.status}`);
  }
  return data;
}
