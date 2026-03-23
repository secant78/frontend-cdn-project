// Fetch request metadata from the Express API and render it in the info box
(async function loadRequestInfo() {
  const box = document.getElementById("info-box");
  if (!box) return;

  try {
    const res = await fetch("/api/info");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const rows = [
      ["client-ip",                    data.clientIp],
      ["x-forwarded-for",              data.headers["x-forwarded-for"]],
      ["cloudfront-viewer-country",    data.headers["cloudfront-viewer-country"]],
      ["cloudfront-viewer-city",       data.headers["cloudfront-viewer-city"]],
      ["x-amz-cf-id",                  data.headers["x-amz-cf-id"]],
      ["user-agent",                   data.headers["user-agent"]],
      ["environment",                  data.environment],
    ];

    const tableRows = rows
      .map(([key, val]) => {
        const display = val
          ? `<span>${escapeHtml(val)}</span>`
          : `<span class="val-none">not present</span>`;
        return `<tr><td>${key}</td><td>${display}</td></tr>`;
      })
      .join("");

    box.innerHTML = `<table class="info-table"><tbody>${tableRows}</tbody></table>`;
  } catch (err) {
    box.innerHTML = `<div class="info-loading">Could not load request info: ${escapeHtml(err.message)}</div>`;
  }
})();

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
