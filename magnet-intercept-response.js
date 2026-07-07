/**
 * Egern / Surge — http-response（备用，主流程见 keepshare-page-intercept.js）
 * @version 1.2.1
 * @changelog
 *   1.2.0 - 主拦截改为 http-request（keepshare-page-intercept.js）
 *   1.1.x - http-response 替换 KeepShare 页
 */

const SCRIPT_VERSION = "1.2.1";

function decodeArg() {
  const raw = typeof $argument !== "undefined" ? String($argument || "") : "";
  const env = typeof $env !== "undefined" && $env ? $env : {};
  const out = Object.assign({}, env);
  if (!raw) return out;
  raw.split("&").forEach(function (pair) {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    out[decodeURIComponent(pair.slice(0, idx))] = decodeURIComponent(pair.slice(idx + 1));
  });
  return out;
}

function resolveMagnetHost(cfg) {
  const candidates = [cfg && cfg.MAGNET_HOST, cfg && cfg.magnet_host];
  for (let i = 0; i < candidates.length; i++) {
    const v = String(candidates[i] || "").trim();
    if (v && v.indexOf("{{") === -1 && v.indexOf("}}") === -1) return v;
  }
  return "egern-magnet.local";
}

function resolveVal(v, fallback) {
  const s = String(v || "").trim();
  if (!s || s.indexOf("{{") !== -1) return fallback;
  return s;
}

function htmlEscape(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildMagnetPage(magnet, cfg) {
  const base = "http://" + resolveMagnetHost(cfg);
  const enc = encodeURIComponent(magnet);
  const show115 = resolveVal(cfg.ENABLE_115, "1") !== "0";
  const showPikpak = resolveVal(cfg.ENABLE_PIKPAK, "1") !== "0";
  const showGuangya = resolveVal(cfg.ENABLE_GUANGYA, "1") !== "0";
  const show123 = resolveVal(cfg.ENABLE_123, "1") !== "0";

  let buttons = "";
  if (show115) {
    buttons += "<a class=\"btn btn-green\" href=\"" + htmlEscape(base + "/115?magnet=" + enc) +
      "\">115 网盘 · 离线下载</a>";
  }
  if (showPikpak) {
    buttons += "<a class=\"btn btn-blue\" href=\"" + htmlEscape(base + "/pikpak?magnet=" + enc) +
      "\">PikPak · 一键导入</a>";
  }
  if (showGuangya) {
    buttons += "<a class=\"btn btn-green btn-guangya\" href=\"" +
      htmlEscape(base + "/guangya?magnet=" + enc) + "\">光鸭云盘 · 一键导入</a>";
  }
  if (show123) {
    buttons += "<a class=\"btn btn-purple\" href=\"" +
      htmlEscape(base + "/123?magnet=" + enc) + "\">123云盘 · 一键导入</a>";
  }

  return "<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>检测到磁力链接</title>" +
    "<style>*{box-sizing:border-box;margin:0;padding:0}" +
    "body{font-family:-apple-system,sans-serif;background:#0b0b0f;color:#f2f2f7;padding:24px 16px}" +
    ".card{max-width:520px;margin:0 auto;background:#16161d;border:1px solid #2a2a35;border-radius:18px;padding:20px 16px}" +
    "h1{font-size:22px;margin-bottom:8px}.sub{font-size:13px;color:#a1a1aa;margin-bottom:14px}" +
    "textarea{width:100%;height:88px;background:#0f0f14;color:#d4d4d8;border:1px solid #30303a;border-radius:10px;padding:10px;font-size:12px;word-break:break-all;box-sizing:border-box}" +
    ".btn{display:block;width:100%;border-radius:12px;padding:14px;font-size:16px;font-weight:600;margin-top:10px;text-decoration:none;text-align:center}" +
    ".btn-green{background:#22c55e;color:#052e16}.btn-green.btn-guangya{background:#16a34a;color:#fff}.btn-blue{background:#3b82f6;color:#fff}.btn-purple{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff}" +
    ".hint{font-size:12px;color:#71717a;text-align:center;margin-top:12px}</style></head><body>" +
    "<div class=\"card\"><h1>检测到磁力链接</h1>" +
    "<p class=\"sub\">长按下方文本可复制磁力链接。</p>" +
    "<textarea readonly>" + htmlEscape(magnet) + "</textarea>" + buttons +
    "<p class=\"hint\">Egern v" + SCRIPT_VERSION + "</p></div></body></html>";
}

/** 只处理 URL 路径里带 magnet 的 KeepShare 链接 */
function extractMagnetFromKeepShareUrl(url) {
  const u = String(url || "");
  if (!/keepshare\.(?:org|cc)\/[^/?#]+\/magnet/i.test(u)) return "";
  const m = u.match(/keepshare\.(?:org|cc)\/[^/?#]+\/([^?#]+)/i);
  if (!m) return "";
  try {
    const part = decodeURIComponent(m[1]);
    if (part.indexOf("magnet:") === 0) return part.split("&")[0].split("#")[0];
    const inner = part.match(/magnet:\?[^\s]+/i);
    return inner ? inner[0] : "";
  } catch (e) {
    if (m[1].indexOf("magnet%3A") === 0 || m[1].indexOf("magnet:") === 0) {
      try { return decodeURIComponent(m[1]).split("&")[0]; } catch (e2) { return ""; }
    }
    return "";
  }
}

const cfg = decodeArg();
const reqUrl = String($request.url || "");
const magnet = extractMagnetFromKeepShareUrl(reqUrl);

if (!magnet) {
  $done({});
} else {
  $done({
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Egern-Magnet-Ver": SCRIPT_VERSION
    },
    body: buildMagnetPage(magnet, cfg)
  });
}
