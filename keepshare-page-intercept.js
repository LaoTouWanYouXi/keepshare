/**
 * Egern / Surge — http-request
 * KeepShare 磁力页：请求发出前拦截；按钮走同域 ?egern= 动作（避免 egern-magnet.local 无效）
 * @version 1.3.2
 * @changelog
 *   1.3.2 - 光鸭按钮改走 egern-magnet.local/guangya（复用过滤脚本）；去掉成功后自动跳转 App
 *   1.2.4 - 模块参数改为逗号分隔 positional（参考 trakt sgmodule）
 *   1.2.3 - 读取 Egern ctx.env；增强 $argument 解析与 gy. 扫描
 *   1.2.2 - 修复 Egern $argument 为对象 / 全局 $env 读不到 token
 *   1.2.1 - 按钮改 keepshare 同域 ?egern=；内联光鸭 API；成功后跳转打开 App
 *   1.2.0 - KeepShare 请求级拦截
 */

const CLIENT_ID = "aMe-8VSlkrbQXpUR";
const ACCOUNT_URL = "https://account.guangyapan.com";
const API_BASE = "https://api.guangyapan.com";
const SITE_ORIGIN = "https://www.guangyapan.com";
const GUANGYA_APP_URL = "https://app.guangyapan.com/pan";
const DEFAULT_MAGNET_HOST = "egern-magnet.local";
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";

const SCRIPT_VERSION = "1.3.2";

/** 与 Magnet-Guangya.sgmodule argument= 占位符顺序一致 */
const POSITIONAL_ARG_KEYS = [
  "GUANGYA_REFRESH_TOKEN",
  "GUANGYA_PARENT_ID",
  "KEEPSHARE_TEMPLATE",
  "ENABLE_115",
  "ENABLE_PIKPAK",
  "ENABLE_GUANGYA",
  "MAGNET_HOST"
];

const TOKEN_KEYS = [
  "GUANGYA_REFRESH_TOKEN",
  "guangya_refresh_token",
  "guangyaRefreshToken",
  "refresh_token",
  "REFRESH_TOKEN",
  "TOKEN",
  "token"
];

function isPlaceholder(s) {
  const v = String(s || "").trim();
  return !v || v.indexOf("{{") !== -1;
}

function pickFirstValid(values) {
  for (let i = 0; i < values.length; i++) {
    const v = String(values[i] || "").trim();
    if (!isPlaceholder(v)) return v;
  }
  return "";
}

function mergeObject(out, src) {
  if (!src || typeof src !== "object" || Array.isArray(src)) return out;
  Object.keys(src).forEach(function (k) {
    const v = src[k];
    if (v != null && typeof v !== "object") out[k] = v;
  });
  return out;
}

function readCtxEnv() {
  try {
    if (typeof ctx !== "undefined" && ctx && ctx.env && typeof ctx.env === "object") return ctx.env;
    if (typeof $ctx !== "undefined" && $ctx && $ctx.env && typeof $ctx.env === "object") return $ctx.env;
  } catch (e) {
    /* ignore */
  }
  return null;
}

function readPersistentToken() {
  try {
    if (typeof $persistentStore !== "undefined" && $persistentStore.read) {
      return pickFirstValid([
        $persistentStore.read("GUANGYA_REFRESH_TOKEN"),
        $persistentStore.read("guangya_refresh_token")
      ]);
    }
  } catch (e) {
    /* ignore */
  }
  try {
    if (typeof $prefs !== "undefined" && $prefs.valueForKey) {
      return pickFirstValid([
        $prefs.valueForKey("GUANGYA_REFRESH_TOKEN"),
        $prefs.valueForKey("guangya_refresh_token")
      ]);
    }
  } catch (e2) {
    /* ignore */
  }
  return "";
}

function scanGyToken(text) {
  const m = String(text || "").match(/gy\.[A-Za-z0-9_\-\.~+/=]{8,}/);
  return m ? m[0] : "";
}

function parsePositionalArgument(raw, keys) {
  const out = {};
  const s = String(raw || "").trim();
  if (!s || s === "[object Object]") return out;
  const parts = s.split(",");
  keys.forEach(function (key, i) {
    if (parts[i] !== undefined) out[key] = String(parts[i]).trim();
  });
  return out;
}

/** 按已知键边界解析 key=value 格式（兼容旧版） */
function parseModuleArgString(raw) {
  const out = {};
  const s = String(raw || "");
  if (!s || s === "[object Object]") return out;

  if (s.charAt(0) === "{") {
    try {
      const j = JSON.parse(s);
      if (j && typeof j === "object") return mergeObject(out, j);
    } catch (e) {
      /* fall through */
    }
  }

  const MODULE_ARG_KEYS = POSITIONAL_ARG_KEYS.concat(["MAGNET_HOST"]);
  MODULE_ARG_KEYS.forEach(function (key) {
    const marker = key + "=";
    const idx = s.indexOf(marker);
    if (idx === -1) return;
    let rest = s.slice(idx + marker.length);
    let cut = rest.length;
    MODULE_ARG_KEYS.forEach(function (nextKey) {
      if (nextKey === key) return;
      const pos = rest.indexOf("&" + nextKey + "=");
      if (pos !== -1 && pos < cut) cut = pos;
    });
    let val = rest.slice(0, cut);
    try {
      val = decodeURIComponent(val.replace(/\+/g, " "));
    } catch (e) {
      /* keep raw */
    }
    out[key] = val;
  });

  if (!out.GUANGYA_REFRESH_TOKEN) {
    try {
      new URLSearchParams(s).forEach(function (v, k) {
        if (!out[k]) out[k] = v;
      });
    } catch (e2) {
      /* ignore */
    }
  }

  return out;
}

function parseArgumentInput(arg) {
  const out = {};
  if (arg == null) return out;
  if (typeof arg === "object" && !Array.isArray(arg)) {
    return mergeObject(out, arg);
  }
  const raw = String(arg).trim();
  if (!raw || raw === "[object Object]") return out;
  if (raw.indexOf("=") !== -1 && /GUANGYA_REFRESH_TOKEN=/i.test(raw)) {
    return parseModuleArgString(raw);
  }
  return parsePositionalArgument(raw, POSITIONAL_ARG_KEYS);
}

/** 合并模块 argument、Egern ctx.env、Surge $env（兼容多平台） */
function loadConfig() {
  const out = {};
  const argRaw = typeof $argument !== "undefined" ? String($argument || "") : "";

  mergeObject(out, typeof $environment !== "undefined" ? $environment : null);
  mergeObject(out, typeof $env !== "undefined" ? $env : null);
  mergeObject(out, parseArgumentInput(typeof $argument !== "undefined" ? $argument : null));
  mergeObject(out, readCtxEnv());

  const token = getRefreshToken(out, argRaw);
  if (token) out.GUANGYA_REFRESH_TOKEN = token;

  return out;
}

function getRefreshToken(cfg, argRaw) {
  const ctxEnv = readCtxEnv();
  const fromKeys = pickFirstValid(
    TOKEN_KEYS.map(function (k) {
      return cfg && cfg[k];
    }).concat(
      ctxEnv ? TOKEN_KEYS.map(function (k) { return ctxEnv[k]; }) : []
    )
  );
  if (fromKeys) return fromKeys;

  const persisted = readPersistentToken();
  if (persisted) return persisted;

  return scanGyToken(argRaw) || scanGyToken(JSON.stringify(readCtxEnv() || {}));
}

function tokenDiagnostic(cfg) {
  const argRaw = typeof $argument !== "undefined" ? String($argument || "") : "";
  const firstPart = argRaw.split(",")[0] || "";
  const placeholder = /\{\{\{?\s*GUANGYA_REFRESH_TOKEN\s*\}?\}\}/.test(argRaw);
  const ctxEnv = readCtxEnv();
  const ctxKeys = ctxEnv
    ? Object.keys(ctxEnv).filter(function (k) {
      return /guangya|refresh|token/i.test(k);
    }).join(",") || "无匹配键"
    : "无 ctx.env";
  const gyScan = scanGyToken(argRaw) ? "是" : "否";
  const tokenLen = getRefreshToken(cfg, argRaw).length;
  const format = argRaw.indexOf("=") !== -1 ? "key=value" : "positional";

  return "诊断 v" + SCRIPT_VERSION +
    "：格式=" + format +
    "，argument长度=" + argRaw.length +
    "，首段(token)长度=" + firstPart.length +
    "，占位符未替换=" + (placeholder ? "是" : "否") +
    "，ctx.env=" + ctxKeys +
    "，gy扫描=" + gyScan +
    "，token长度=" + tokenLen;
}

function decodeArg() {
  return loadConfig();
}

function resolveVal(v, fallback) {
  const s = String(v || "").trim();
  if (!s || s.indexOf("{{") !== -1) return fallback;
  return s;
}

function randomHex(len) {
  let s = "";
  for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 16).toString(16);
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

function respondRedirect(location) {
  const h = {
    Location: location,
    "Cache-Control": "no-store",
    "Connection": "close",
    "X-Egern-Magnet-Ver": SCRIPT_VERSION
  };
  $done({ response: { status: 302, headers: h }, status: 302, headers: h });
}

function htmlPage(title, bodyHtml) {
  return "<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">" +
    "<title>" + htmlEscape(title) + "</title>" +
    "<style>body{font-family:-apple-system,sans-serif;background:#0b0b0f;color:#f4f4f5;padding:24px 16px}" +
    ".card{max-width:520px;margin:0 auto;background:#16161d;border-radius:16px;padding:20px;border:1px solid #2a2a35}" +
    "h1{font-size:20px;margin-bottom:12px}p{font-size:14px;line-height:1.6;color:#d4d4d8;margin-bottom:10px}" +
    "a{color:#60a5fa;text-decoration:none}.btn{display:inline-block;margin-top:12px;padding:12px 16px;background:#16a34a;color:#fff;border-radius:10px;font-weight:600}" +
    ".btn-secondary{background:#3b82f6}</style></head><body><div class=\"card\">" + bodyHtml + "</div></body></html>";
}

function resolveMagnetHost(cfg) {
  const candidates = [cfg && cfg.MAGNET_HOST, cfg && cfg.magnet_host];
  for (let i = 0; i < candidates.length; i++) {
    const v = String(candidates[i] || "").trim();
    if (v && v.indexOf("{{") === -1 && v.indexOf("}}") === -1) return v;
  }
  return DEFAULT_MAGNET_HOST;
}

function buildGuangyaImportUrl(magnet, cfg) {
  return "http://" + resolveMagnetHost(cfg) + "/guangya?magnet=" + encodeURIComponent(magnet);
}

function buildActionUrl(reqUrl, action) {
  try {
    const u = new URL(reqUrl.split("#")[0]);
    u.searchParams.set("egern", action);
    return u.toString();
  } catch (e) {
    const sep = reqUrl.indexOf("?") === -1 ? "?" : "&";
    return reqUrl.split("#")[0] + sep + "egern=" + encodeURIComponent(action);
  }
}

function buildMagnetPage(magnet, cfg, reqUrl) {
  const show115 = resolveVal(cfg.ENABLE_115, "1") !== "0";
  const showPikpak = resolveVal(cfg.ENABLE_PIKPAK, "1") !== "0";
  const showGuangya = resolveVal(cfg.ENABLE_GUANGYA, "1") !== "0";

  let buttons = "";
  if (show115) {
    buttons += "<a class=\"btn btn-green\" href=\"" + htmlEscape(buildActionUrl(reqUrl, "115")) +
      "\">115 网盘 · 离线下载</a>";
  }
  if (showPikpak) {
    buttons += "<a class=\"btn btn-blue\" href=\"" + htmlEscape(buildActionUrl(reqUrl, "pikpak")) +
      "\">PikPak · 一键导入</a>";
  }
  if (showGuangya) {
    buttons += "<a class=\"btn btn-green btn-guangya\" href=\"" +
      htmlEscape(buildGuangyaImportUrl(magnet, cfg)) + "\">光鸭云盘 · 一键导入</a>";
  }

  return "<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">" +
    "<title>检测到磁力链接</title>" +
    "<style>*{box-sizing:border-box;margin:0;padding:0}" +
    "body{font-family:-apple-system,sans-serif;background:#0b0b0f;color:#f2f2f7;padding:24px 16px}" +
    ".card{max-width:520px;margin:0 auto;background:#16161d;border:1px solid #2a2a35;border-radius:18px;padding:20px 16px}" +
    "h1{font-size:22px;margin-bottom:8px}.sub{font-size:13px;color:#a1a1aa;margin-bottom:14px}" +
    "textarea{width:100%;height:88px;background:#0f0f14;color:#d4d4d8;border:1px solid #30303a;border-radius:10px;padding:10px;font-size:12px;word-break:break-all}" +
    ".btn{display:block;width:100%;border-radius:12px;padding:14px;font-size:16px;font-weight:600;margin-top:10px;text-decoration:none;text-align:center;-webkit-tap-highlight-color:transparent}" +
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

function parseEgernAction(url) {
  try {
    return String(new URL(url.split("#")[0]).searchParams.get("egern") || "").toLowerCase();
  } catch (e) {
    const m = String(url).match(/[?&]egern=([^&#]+)/i);
    return m ? decodeURIComponent(m[1]).toLowerCase() : "";
  }
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
    const action = parseEgernAction(reqUrl);
    if (action === "115") {
      respondRedirect(
        "https://115.com/web/lixian/?ct=offline&ac=add&url=" + encodeURIComponent(magnet)
      );
    } else if (action === "pikpak") {
      respondRedirect(
        "https://mypikpak.com/drive/all?action=add_magnet&url=" + encodeURIComponent(magnet)
      );
    } else if (action === "guangya") {
      respondRedirect(buildGuangyaImportUrl(magnet, cfg));
    } else {
      respondLocal(200, {}, buildMagnetPage(magnet, cfg, reqUrl));
    }
  }
}
