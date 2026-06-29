/**
 * Egern / Surge — http-request
 * 在访问 KeepShare 磁力页时，于请求发出前直接返回本地操作页（不连服务器、不触发 PikPak 自动跳转）
 * @version 1.2.0
 * @changelog
 *   1.2.0 - 新增：KeepShare 请求级拦截，替代 JavDB 页内弹层流程
 */

const SCRIPT_VERSION = "1.2.0";

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

function respondLocal(status, headers, body) {
  const h = Object.assign(
    {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Connection": "close",
      "X-Egern-Magnet-Ver": SCRIPT_VERSION
    },
    headers || {}
  );
  const st = status || 200;
  const b = body || "";
  const resp = { status: st, headers: h, body: b };
  $done({ response: resp, status: st, headers: h, body: b });
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
    "textarea{width:100%;height:88px;background:#0f0f14;color:#d4d4d8;border:1px solid #30303a;border-radius:10px;padding:10px;font-size:12px;word-break:break-all}" +
    ".btn{display:block;width:100%;border-radius:12px;padding:14px;font-size:16px;font-weight:600;margin-top:10px;text-decoration:none;text-align:center}" +
    ".btn-green{background:#22c55e;color:#052e16}.btn-green.btn-guangya{background:#16a34a;color:#fff}" +
    ".btn-blue{background:#3b82f6;color:#fff}" +
    ".hint{font-size:12px;color:#71717a;text-align:center;margin-top:12px}" +
    "</style></head><body><div class=\"card\">" +
    "<h1>检测到磁力链接</h1>" +
    "<p class=\"sub\">已拦截 KeepShare 自动跳转。长按下方文本可复制磁力链接。</p>" +
    "<textarea readonly>" + htmlEscape(magnet) + "</textarea>" + buttons +
    "<p class=\"hint\"><a href=\"javascript:history.back()\" style=\"color:#71717a\">返回上一页</a> · v" +
    SCRIPT_VERSION + "</p></div></body></html>";
}

/** 从 KeepShare URL 路径解析 magnet（与 JavDB 下载链接格式一致） */
function extractMagnetFromKeepShareUrl(url) {
  const u = String(url || "");
  if (!/keepshare\.(?:org|cc)/i.test(u)) return "";

  try {
    const noQuery = u.split("?")[0].split("#")[0];
    const parts = noQuery.split("/").filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      let seg = parts[i];
      try {
        seg = decodeURIComponent(seg);
      } catch (e) {
        /* keep raw */
      }
      if (/^magnet:/i.test(seg)) {
        return seg.split("&")[0].split("#")[0];
      }
      const inner = seg.match(/magnet:\?[^\s]+/i);
      if (inner) return inner[0];
    }
  } catch (e) {
    /* fall through */
  }
  return "";
}

const cfg = decodeArg();
const reqUrl = String($request.url || "");

if (!/keepshare\.(?:org|cc)/i.test(reqUrl) || !/magnet/i.test(reqUrl)) {
  $done({});
} else {
  const magnet = extractMagnetFromKeepShareUrl(reqUrl);
  if (!magnet) {
    $done({});
  } else {
    respondLocal(200, {}, buildMagnetPage(magnet, cfg));
  }
}
