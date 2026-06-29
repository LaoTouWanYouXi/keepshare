/**
 * Egern / Surge — http-response
 * @version 1.1.0
 * @changelog
 *   1.1.0 - HTTP 链接；textarea 复制；版本响应头
 *   1.0.x - 初版 KeepShare 拦截
 *
 * JavDB 详情页见 javdb-magnet-rewrite.js
 */

const SCRIPT_VERSION = "1.1.0";
const MAGNET_RE = /magnet:\?[^\s"'<>\\]+/i;

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

const DEFAULT_MAGNET_HOST = "egern-magnet.local";

function resolveMagnetHost(cfg) {
  const candidates = [cfg && cfg.MAGNET_HOST, cfg && cfg.magnet_host];
  for (let i = 0; i < candidates.length; i++) {
    const v = String(candidates[i] || "").trim();
    if (v && v.indexOf("{{") === -1 && v.indexOf("}}") === -1) return v;
  }
  return DEFAULT_MAGNET_HOST;
}

function htmlEscape(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveVal(v, fallback) {
  const s = String(v || "").trim();
  if (!s || s.indexOf("{{") !== -1) return fallback;
  return s;
}

function buildMagnetPage(magnet, cfg) {
  const base = "http://" + resolveMagnetHost(cfg);
  const enc = encodeURIComponent(magnet);
  const show115 = resolveVal(cfg.ENABLE_115, "1") !== "0";
  const showPikpak = resolveVal(cfg.ENABLE_PIKPAK, "1") !== "0";
  const showGuangya = resolveVal(cfg.ENABLE_GUANGYA, "1") !== "0";

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

  return "<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">" +
    "<title>检测到磁力链接</title>" +
    "<style>*{box-sizing:border-box;margin:0;padding:0}" +
    "body{font-family:-apple-system,sans-serif;background:#0b0b0f;color:#f2f2f7;padding:24px 16px}" +
    ".card{max-width:520px;margin:0 auto;background:#16161d;border:1px solid #2a2a35;border-radius:18px;padding:20px 16px}" +
    "h1{font-size:22px;margin-bottom:8px}.sub{font-size:13px;color:#a1a1aa;margin-bottom:14px}" +
    "textarea{width:100%;height:88px;background:#0f0f14;color:#d4d4d8;border:1px solid #30303a;border-radius:10px;padding:10px;font-size:12px;word-break:break-all;box-sizing:border-box}" +
    ".btn{display:block;width:100%;border-radius:12px;padding:14px;font-size:16px;font-weight:600;margin-top:10px;text-decoration:none;text-align:center}" +
    ".btn-green{background:#22c55e;color:#052e16}.btn-green.btn-guangya{background:#16a34a;color:#fff}.btn-blue{background:#3b82f6;color:#fff}" +
    ".hint{font-size:12px;color:#71717a;text-align:center;margin-top:12px}</style></head><body>" +
    "<div class=\"card\"><h1>检测到磁力链接</h1>" +
    "<p class=\"sub\">长按下方文本可复制磁力链接。</p>" +
    "<textarea readonly>" + htmlEscape(magnet) + "</textarea>" + buttons +
    "<p class=\"hint\">由 Egern 本地脚本拦截</p></div></body></html>";
}

function extractMagnetFromText(text) {
  if (!text) return "";
  const m = String(text).match(MAGNET_RE);
  return m ? m[0] : "";
}

function extractMagnetFromUrl(url) {
  if (!url) return "";
  const u = String(url);
  if (u.indexOf("magnet:?") === 0) return u.split("#")[0];
  try {
    const parsed = new URL(u);
    for (const key of ["magnet", "url", "link", "m", "mag"]) {
      const val = parsed.searchParams.get(key);
      if (val && val.indexOf("magnet:") === 0) return val;
      if (val) {
        const inner = extractMagnetFromText(decodeURIComponent(val));
        if (inner) return inner;
      }
    }
    const q = decodeURIComponent(parsed.search || "");
    const fromQ = extractMagnetFromText(q);
    if (fromQ) return fromQ;
    const path = decodeURIComponent(parsed.pathname || "");
    const fromPath = extractMagnetFromText(path);
    if (fromPath) return fromPath;
    const slashMag = path.match(/\/(magnet:\?[^/]+)$/i);
    if (slashMag) return slashMag[1];
    const encMag = path.match(/\/(magnet%3A%3F[^/]+)/i);
    if (encMag) return decodeURIComponent(encMag[1]);
  } catch (e) {
    return extractMagnetFromText(decodeURIComponent(u));
  }
  return "";
}

function extractMagnetFromKeepShareUrl(url) {
  const u = String(url || "");
  const m = u.match(/keepshare\.(?:org|cc)\/[^/?#]+\/([^?#]+)/i);
  if (!m) return extractMagnetFromUrl(u);
  try {
    const part = decodeURIComponent(m[1]);
    if (part.indexOf("magnet:") === 0) return part.split("#")[0];
    return extractMagnetFromText(part);
  } catch (e) {
    return extractMagnetFromText(m[1]);
  }
}

function getHeader(headers, name) {
  if (!headers) return "";
  const lower = name.toLowerCase();
  for (const k in headers) {
    if (k.toLowerCase() === lower) return headers[k];
  }
  return "";
}

const cfg = decodeArg();
const reqUrl = String($request.url || "");
let magnet = "";

if (/keepshare\.(?:org|cc)/i.test(reqUrl)) {
  magnet = extractMagnetFromKeepShareUrl(reqUrl);
}

if (!magnet) {
  magnet = extractMagnetFromUrl(reqUrl);
}

if (!magnet) {
  const loc = getHeader($response.headers, "Location");
  magnet = extractMagnetFromUrl(loc) || extractMagnetFromText(loc);
}

if (!magnet && $response.body) {
  magnet = extractMagnetFromText($response.body);
  if (!magnet) {
    const hrefMatch = String($response.body).match(
      /(?:location\.href|location\s*=)\s*['"](magnet:[^'"]+)['"]/i
    );
    if (hrefMatch) magnet = hrefMatch[1];
  }
  if (!magnet) {
    const metaMatch = String($response.body).match(
      /content\s*=\s*['"]\s*0\s*;\s*url=(magnet:[^'"]+)['"]/i
    );
    if (metaMatch) magnet = metaMatch[1];
  }
}

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
