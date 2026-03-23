const output = document.getElementById("output");
const button = document.getElementById("check-health");

button?.addEventListener("click", async () => {
  output.textContent = "요청 중...";
  try {
    const response = await fetch("/api/v1/health");
    const data = await response.json();
    output.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    output.textContent = `요청 실패: ${error instanceof Error ? error.message : String(error)}`;
  }
});