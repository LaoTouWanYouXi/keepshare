/**
 * Egern / Surge — http-request
 * @version 1.3.2
 * @changelog
 *   1.3.2 - 成功页停留不跳转；KeepShare 入口改由 keepshare-page-intercept 转发至本脚本
 *   1.3.1 - 增强 resolve 解析；默认仅保留视频；按体积剔除小广告片；成功页显示版本号
 *   1.3.0 - 光鸭导入前先 resolve_res，按规则过滤广告/ junk 后仅提交 fileIndexes
 *   1.2.4 - 模块参数改为逗号分隔 positional（参考 trakt sgmodule）
 *   1.1.4 - KeepShare 跳转去掉 ?action=，使用模板域名（防 301）
 *   1.1.0 - 双格式 $done；HTTP 虚拟域名
 */

const CLIENT_ID = "aMe-8VSlkrbQXpUR";
const ACCOUNT_URL = "https://account.guangyapan.com";
const API_BASE = "https://api.guangyapan.com";
const SITE_ORIGIN = "https://www.guangyapan.com";
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";

const SCRIPT_VERSION = "1.3.2";

const POSITIONAL_ARG_KEYS = [
  "GUANGYA_REFRESH_TOKEN",
  "GUANGYA_PARENT_ID",
  "KEEPSHARE_TEMPLATE",
  "ENABLE_115",
  "ENABLE_PIKPAK",
  "ENABLE_GUANGYA",
  "MAGNET_HOST",
  "MAGNET_FILTER",
  "MAGNET_BLOCK_PATTERNS",
  "MAGNET_MIN_VIDEO_MB",
  "MAGNET_VIDEO_ONLY"
];

const VIDEO_EXTS = {
  mp4: 1, mkv: 1, avi: 1, wmv: 1, mov: 1, m4v: 1,
  ts: 1, flv: 1, rmvb: 1, webm: 1, "3gp": 1
};

const DEFAULT_BLOCK_PATTERN_SOURCES = [
  "广告|推广|宣传|加群|更多资源|最新地址|影视大站|1024|91\\.tv|草榴",
  "sample|preview|trailer|预告|预览|样片|精彩花絮",
  "\\.(txt|url|nfo|htm|html|jpg|jpeg|png|gif|exe|apk|torrent)$"
];
const TOKEN_KEYS = [
  "GUANGYA_REFRESH_TOKEN", "guangya_refresh_token", "guangyaRefreshToken",
  "refresh_token", "REFRESH_TOKEN", "TOKEN", "token"
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
    if (typeof ctx !== "undefined" && ctx && ctx.env) return ctx.env;
    if (typeof $ctx !== "undefined" && $ctx && $ctx.env) return $ctx.env;
  } catch (e) { /* ignore */ }
  return null;
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

function parseModuleArgString(raw) {
  const out = {};
  const s = String(raw || "");
  if (!s || s === "[object Object]") return out;
  if (s.charAt(0) === "{") {
    try {
      const j = JSON.parse(s);
      if (j && typeof j === "object") return mergeObject(out, j);
    } catch (e) { /* fall through */ }
  }
  POSITIONAL_ARG_KEYS.forEach(function (key) {
    const marker = key + "=";
    const idx = s.indexOf(marker);
    if (idx === -1) return;
    let rest = s.slice(idx + marker.length);
    let cut = rest.length;
    POSITIONAL_ARG_KEYS.forEach(function (nextKey) {
      if (nextKey === key) return;
      const pos = rest.indexOf("&" + nextKey + "=");
      if (pos !== -1 && pos < cut) cut = pos;
    });
    let val = rest.slice(0, cut);
    try { val = decodeURIComponent(val.replace(/\+/g, " ")); } catch (e) { /* keep */ }
    out[key] = val;
  });
  return out;
}

function parseArgumentInput(arg) {
  const out = {};
  if (arg == null) return out;
  if (typeof arg === "object" && !Array.isArray(arg)) return mergeObject(out, arg);
  const raw = String(arg).trim();
  if (!raw || raw === "[object Object]") return out;
  if (raw.indexOf("=") !== -1 && /GUANGYA_REFRESH_TOKEN=/i.test(raw)) {
    return parseModuleArgString(raw);
  }
  return parsePositionalArgument(raw, POSITIONAL_ARG_KEYS);
}

function getRefreshToken(cfg, argRaw) {
  const ctxEnv = readCtxEnv();
  const fromKeys = pickFirstValid(
    TOKEN_KEYS.map(function (k) { return cfg && cfg[k]; }).concat(
      ctxEnv ? TOKEN_KEYS.map(function (k) { return ctxEnv[k]; }) : []
    )
  );
  if (fromKeys) return fromKeys;
  return scanGyToken(argRaw) || scanGyToken(JSON.stringify(readCtxEnv() || {}));
}

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

function decodeArg() {
  return loadConfig();
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

/** 兼容 Surge(response 包裹) 与 Egern(顶层字段) 两种 $done 格式 */
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
  const h = { Location: location, "Cache-Control": "no-store", "Connection": "close" };
  $done({ response: { status: 302, headers: h }, status: 302, headers: h });
}

function magnetBase(cfg) {
  return "http://" + resolveMagnetHost(cfg);
}

function buildMagnetPage(magnet, cfg) {
  const base = magnetBase(cfg);
  const enc = encodeURIComponent(magnet);
  const show115 = resolveVal(cfg.ENABLE_115, "1") !== "0";
  const showPikpak = resolveVal(cfg.ENABLE_PIKPAK, "1") !== "0";
  const showGuangya = resolveVal(cfg.ENABLE_GUANGYA, "1") !== "0";
  const ks = parseKeepShareTemplate(cfg);

  let buttons = "";
  if (show115) {
    const u115 = ks ? ks.base + enc + "?action=115" :
      "https://115.com/web/lixian/?ct=offline&ac=add&url=" + enc;
    buttons += "<a class=\"btn btn-green\" href=\"" + htmlEscape(u115) + "\">115 网盘 · 离线下载</a>";
  }
  if (showPikpak) {
    const upk = ks ? ks.base + enc + "?action=pikpak" :
      "https://mypikpak.com/drive/all?action=add_magnet&url=" + enc;
    buttons += "<a class=\"btn btn-blue\" href=\"" + htmlEscape(upk) + "\">PikPak · 一键导入</a>";
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
    "<p class=\"sub\">长按下方文本可复制。115 / PikPak 为外链，光鸭走本地脚本。</p>" +
    "<textarea readonly>" + htmlEscape(magnet) + "</textarea>" + buttons +
    "<p class=\"hint\"><a href=\"javascript:history.back()\" style=\"color:#71717a\">返回上一页</a></p>" +
    "</div></body></html>";
}

function htmlPage(title, bodyHtml) {
  return "<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" + title + "</title>" +
    "<style>body{font-family:-apple-system,sans-serif;background:#0b0b0f;color:#f4f4f5;padding:24px 16px}" +
    ".card{max-width:520px;margin:0 auto;background:#16161d;border-radius:16px;padding:20px;border:1px solid #2a2a35}" +
    "h1{font-size:20px;margin-bottom:12px}p{font-size:14px;line-height:1.6;color:#d4d4d8;margin-bottom:10px}" +
    "a{color:#60a5fa;text-decoration:none}.btn{display:inline-block;margin-top:12px;padding:10px 14px;background:#3b82f6;color:#fff;border-radius:10px}" +
    "</style></head><body><div class=\"card\">" + bodyHtml + "</div></body></html>";
}

function httpPost(url, headers, bodyObj, timeoutMs) {
  return new Promise(function (resolve, reject) {
    $httpClient.post({
      url: url,
      headers: headers,
      body: JSON.stringify(bodyObj),
      timeout: timeoutMs || 25
    }, function (err, resp, data) {
      if (err) return reject(err);
      try {
        resolve(typeof data === "string" ? JSON.parse(data) : data);
      } catch (e) {
        reject(new Error("JSON parse failed: " + String(data).slice(0, 200)));
      }
    });
  });
}

function isApiSuccess(result) {
  return !!(result && (result.msg === "success" || result.code === 0 || result.data));
}

function toFiniteNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function chooseBestNameCandidate(values) {
  for (let i = 0; i < values.length; i++) {
    const s = String(values[i] || "").trim();
    if (s) return s;
  }
  return "";
}

function collectObjectArrays(node, out, seen) {
  out = out || [];
  seen = seen || (typeof WeakSet !== "undefined" ? new WeakSet() : null);
  if (!node || typeof node !== "object") return out;
  if (seen && seen.has(node)) return out;
  if (seen) seen.add(node);

  if (Array.isArray(node)) {
    if (node.length && node.every(function (item) {
      return item && typeof item === "object" && !Array.isArray(item);
    })) {
      out.push(node);
    }
    for (let i = 0; i < node.length; i++) collectObjectArrays(node[i], out, seen);
    return out;
  }

  const keys = Object.keys(node);
  for (let i = 0; i < keys.length; i++) collectObjectArrays(node[keys[i]], out, seen);
  return out;
}

function findFirstValueByKeys(node, keys, seen) {
  seen = seen || (typeof WeakSet !== "undefined" ? new WeakSet() : null);
  if (!node || typeof node !== "object") return null;
  if (seen && seen.has(node)) return null;
  if (seen) seen.add(node);

  for (let i = 0; i < keys.length; i++) {
    if (Object.prototype.hasOwnProperty.call(node, keys[i])) return node[keys[i]];
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const found = findFirstValueByKeys(node[i], keys, seen);
      if (found != null) return found;
    }
    return null;
  }
  const objKeys = Object.keys(node);
  for (let j = 0; j < objKeys.length; j++) {
    const found = findFirstValueByKeys(node[objKeys[j]], keys, seen);
    if (found != null) return found;
  }
  return null;
}

function normalizeResolvedFileEntry(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const index = toFiniteNumberOrNull(
    obj.fileIndex != null ? obj.fileIndex :
    obj.file_index != null ? obj.file_index :
    obj.index != null ? obj.index :
    obj.idx != null ? obj.idx :
    obj.fileNo != null ? obj.fileNo :
    obj.file_no != null ? obj.file_no :
    obj.seq
  );
  if (index == null || index < 0) return null;
  const name = chooseBestNameCandidate([
    obj.name, obj.fileName, obj.file_name, obj.filename,
    obj.path, obj.filePath, obj.file_path, obj.fullPath, obj.full_path,
    obj.relativePath, obj.relative_path, obj.filePathName, obj.file_path_name,
    obj.resName, obj.resourceName, obj.title
  ]);
  const size = toFiniteNumberOrNull(
    obj.fileSize != null ? obj.fileSize :
    obj.file_size != null ? obj.file_size :
    obj.filesize != null ? obj.filesize :
    obj.size != null ? obj.size :
    obj.length != null ? obj.length :
    obj.len != null ? obj.len :
    obj.bytes
  );
  return { index: index, name: name, size: size == null ? 0 : size, raw: obj };
}

function extractResolvedFileEntriesDirect(payload) {
  const data = payload && payload.data;
  if (!data || typeof data !== "object") return null;
  const list = data.list || data.files || data.fileList || data.resList || data.items || data.fileInfos;
  if (!Array.isArray(list) || !list.length) return null;
  let entries = list.map(normalizeResolvedFileEntry).filter(Boolean);
  entries = entries.filter(function (item, index, arr) {
    return arr.findIndex(function (other) { return other.index === item.index; }) === index;
  }).sort(function (a, b) { return a.index - b.index; });
  return entries.length ? entries : null;
}

function preferNamedEntries(entries) {
  const named = entries.filter(function (item) { return item.name; });
  return named.length ? named : entries;
}

function extractResolvedFileEntries(payload) {
  const direct = extractResolvedFileEntriesDirect(payload);
  if (direct && direct.length) return preferNamedEntries(direct);

  const arrays = collectObjectArrays(payload);
  let best = [];
  let bestScore = -1;

  for (let a = 0; a < arrays.length; a++) {
    const arr = arrays[a];
    let entries = arr.map(normalizeResolvedFileEntry).filter(Boolean);
    entries = entries.filter(function (item, index, list) {
      return list.findIndex(function (other) { return other.index === item.index; }) === index;
    }).sort(function (x, y) { return x.index - y.index; });

    if (!entries.length) {
      const positional = [];
      for (let i = 0; i < arr.length; i++) {
        const name = chooseBestNameCandidate([
          arr[i] && arr[i].name, arr[i] && arr[i].fileName, arr[i] && arr[i].file_name,
          arr[i] && arr[i].filename, arr[i] && arr[i].path, arr[i] && arr[i].filePath,
          arr[i] && arr[i].file_path, arr[i] && arr[i].fullPath, arr[i] && arr[i].full_path,
          arr[i] && arr[i].resName, arr[i] && arr[i].resourceName, arr[i] && arr[i].title
        ]);
        if (!name) continue;
        positional.push({
          index: i,
          name: name,
          size: toFiniteNumberOrNull(arr[i] && (arr[i].fileSize || arr[i].size)) || 0,
          raw: arr[i]
        });
      }
      if (positional.length) entries = positional;
    }

    if (!entries.length) continue;
    const nameCount = entries.filter(function (item) { return item.name; }).length;
    const score = entries.length * 10 + nameCount * 3 + (entries.length > 1 ? 5 : 0);
    if (score > bestScore) {
      best = entries;
      bestScore = score;
    }
  }

  if (best.length) return preferNamedEntries(best);

  const explicitIndexes = findFirstValueByKeys(payload, ["fileIndexes", "file_indexes", "indexes"]);
  if (Array.isArray(explicitIndexes) && explicitIndexes.length) {
    return explicitIndexes.map(function (value) {
      return toFiniteNumberOrNull(value);
    }).filter(function (value) {
      return value != null;
    }).filter(function (value, index, list) {
      return list.indexOf(value) === index;
    }).sort(function (x, y) { return x - y; }).map(function (index) {
      return { index: index, name: "", size: 0, raw: null };
    });
  }

  const total = toFiniteNumberOrNull(findFirstValueByKeys(payload, [
    "fileCount", "file_count", "totalCount", "total_count", "count", "total"
  ]));
  if (total != null && total > 0) {
    const out = [];
    for (let i = 0; i < total; i++) out.push({ index: i, name: "", size: 0, raw: null });
    return out;
  }
  return [];
}

function parseRegexPatternSource(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (s.charAt(0) === "/") {
    const last = s.lastIndexOf("/");
    if (last > 0) {
      const body = s.slice(1, last);
      const flags = s.slice(last + 1);
      try { return new RegExp(body, flags || "i"); } catch (e) { /* fall through */ }
    }
  }
  try { return new RegExp(s, "i"); } catch (e) { return null; }
}

function parseBlockPatterns(cfg) {
  const raw = resolveVal(cfg.MAGNET_BLOCK_PATTERNS, "");
  const sources = raw
    ? raw.split(/[;|]/).map(function (s) { return String(s || "").trim(); }).filter(Boolean)
    : DEFAULT_BLOCK_PATTERN_SOURCES.slice();
  const patterns = [];
  for (let i = 0; i < sources.length; i++) {
    const re = parseRegexPatternSource(sources[i]);
    if (re) patterns.push(re);
  }
  return patterns;
}

function isVideoFileName(name) {
  const parts = String(name || "").split(".");
  if (parts.length < 2) return false;
  return !!VIDEO_EXTS[parts.pop().toLowerCase()];
}

function isMagnetFilterEnabled(cfg) {
  return resolveVal(cfg.MAGNET_FILTER, "1") !== "0";
}

function getMinVideoMb(cfg) {
  const n = Number(resolveVal(cfg.MAGNET_MIN_VIDEO_MB, "80"));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function isVideoOnlyEnabled(cfg) {
  return resolveVal(cfg.MAGNET_VIDEO_ONLY, "1") !== "0";
}

function isMultiPartVideoName(name) {
  const n = String(name || "").toLowerCase();
  return /(?:^|[\._\-])p(?:art)?[\._\-]?\d+(?:[\._\-]|$)/.test(n) ||
    /(?:^|[\._\-])cd[\._\-]?\d+(?:[\._\-]|$)/.test(n) ||
    /(?:^|[\._\-])disc[\._\-]?\d+(?:[\._\-]|$)/.test(n) ||
    /(?:^|[\._\-])vol[\._\-]?\d+(?:[\._\-]|$)/.test(n) ||
    /分段|第[\d一二三四五六七八九十]+[部分集段]/.test(n);
}

function applySmartVideoPrune(entries) {
  const videos = entries.filter(function (item) { return isVideoFileName(item.name); });
  const sized = videos.filter(function (item) { return Number(item.size) > 0; });
  if (sized.length < 2) {
    return { kept: entries, blocked: [] };
  }
  sized.sort(function (a, b) { return b.size - a.size; });
  const maxSize = sized[0].size;
  const threshold = maxSize * 0.15;
  const kept = [];
  const blocked = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!isVideoFileName(entry.name)) {
      kept.push(entry);
      continue;
    }
    const size = Number(entry.size || 0);
    if (size > 0 && size < threshold && !isMultiPartVideoName(entry.name)) {
      blocked.push({ entry: entry, reason: "small-video" });
    } else {
      kept.push(entry);
    }
  }
  return { kept: kept, blocked: blocked };
}

function shouldBlockMagnetFile(entry, patterns, minVideoMb, videoOnly) {
  const name = String(entry.name || "");
  if (name) {
    for (let i = 0; i < patterns.length; i++) {
      if (patterns[i].test(name)) return { blocked: true, reason: "pattern" };
    }
    if (videoOnly && !isVideoFileName(name)) {
      return { blocked: true, reason: "non-video" };
    }
  }
  if (minVideoMb > 0 && name && isVideoFileName(name)) {
    const size = Number(entry.size || 0);
    if (size > 0 && size < minVideoMb * 1024 * 1024) {
      return { blocked: true, reason: "size" };
    }
  }
  return { blocked: false, reason: "" };
}

function filterResolvedMagnetFiles(entries, cfg) {
  const patterns = parseBlockPatterns(cfg);
  const minVideoMb = getMinVideoMb(cfg);
  const videoOnly = isVideoOnlyEnabled(cfg);
  let kept = [];
  const blocked = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const verdict = shouldBlockMagnetFile(entry, patterns, minVideoMb, videoOnly);
    if (verdict.blocked) blocked.push({ entry: entry, reason: verdict.reason });
    else kept.push(entry);
  }
  const pruned = applySmartVideoPrune(kept);
  kept = pruned.kept;
  for (let j = 0; j < pruned.blocked.length; j++) blocked.push(pruned.blocked[j]);
  return { kept: kept, blocked: blocked, patterns: patterns, minVideoMb: minVideoMb, videoOnly: videoOnly };
}

function formatFilePreview(entries, limit) {
  const max = limit || 8;
  const lines = [];
  for (let i = 0; i < entries.length && i < max; i++) {
    const item = entries[i];
    const label = item.name || ("#" + item.index);
    lines.push(htmlEscape(label));
  }
  if (entries.length > max) lines.push("… 另有 " + (entries.length - max) + " 个");
  return lines.join("<br>");
}

function formatBlockedPreview(blocked, limit) {
  const max = limit || 8;
  const lines = [];
  for (let i = 0; i < blocked.length && i < max; i++) {
    const item = blocked[i];
    const label = item.entry.name || ("#" + item.entry.index);
    const tag = item.reason === "size" ? " (过小)" :
      item.reason === "small-video" ? " (小体积广告)" :
      item.reason === "non-video" ? " (非视频)" : "";
    lines.push(htmlEscape(label + tag));
  }
  if (blocked.length > max) lines.push("… 另有 " + (blocked.length - max) + " 个");
  return lines.join("<br>");
}

function accountHeaders(did) {
  return {
    accept: "*/*",
    "content-type": "application/json",
    origin: SITE_ORIGIN,
    referer: SITE_ORIGIN + "/",
    "user-agent": UA,
    "x-client-id": CLIENT_ID,
    "x-client-version": "0.0.1",
    "x-device-id": did,
    "x-device-model": "iphone%2F18.0",
    "x-device-name": "iPhone",
    "x-device-sign": "wdi10." + did + randomHex(32),
    "x-net-work-type": "NONE",
    "x-os-version": "iPhone OS 18.0",
    "x-platform-version": "1",
    "x-protocol-version": "301",
    "x-provider-name": "NONE",
    "x-sdk-version": "9.0.2",
    "x-action": "401"
  };
}

function apiHeaders(token, did) {
  return {
    accept: "application/json, text/plain, */*",
    authorization: "Bearer " + token,
    "content-type": "application/json",
    did: did,
    dt: "4",
    origin: SITE_ORIGIN,
    referer: SITE_ORIGIN + "/",
    "user-agent": UA
  };
}

async function refreshAccessToken(refreshToken, did) {
  const data = await httpPost(
    ACCOUNT_URL + "/v1/auth/token",
    accountHeaders(did),
    { client_id: CLIENT_ID, grant_type: "refresh_token", refresh_token: refreshToken }
  );
  if (!data || !data.access_token) {
    throw new Error((data && (data.error_description || data.msg)) || "刷新 token 失败");
  }
  return data.access_token;
}

async function resolveGuangyaResource(token, did, url) {
  return httpPost(
    API_BASE + "/nd.bizcloudcollection.s/v1/resolve_res",
    apiHeaders(token, did),
    { url: url },
    45
  );
}

async function createGuangyaTask(token, did, magnet, parentId, fileIndexes) {
  const body = { url: magnet, parentId: parentId || "" };
  if (fileIndexes && fileIndexes.length) {
    body.fileIndexes = fileIndexes.map(function (idx) { return Number(idx); });
  }
  return httpPost(
    API_BASE + "/nd.bizcloudcollection.s/v1/create_task",
    apiHeaders(token, did),
    body,
    30
  );
}

function parseKeepShareTemplate(cfg) {
  const raw = resolveVal(cfg.KEEPSHARE_TEMPLATE || cfg.KEEPSHARE_SHARE_ID, "");
  if (!raw) return null;
  if (!raw.includes("/") && !raw.includes(".")) {
    return { base: "https://keepshare.cc/" + raw + "/" };
  }
  try {
    const normalized = raw.endsWith("/") ? raw : raw + "/";
    const u = new URL(normalized);
    return { base: u.origin + u.pathname };
  } catch (e) {
    return null;
  }
}

/** 标准 KeepShare 分享链接：{模板}{urlencode(magnet)}，不要加 ?action= */
function keepshareMagnetUrl(cfg, magnet) {
  const ks = parseKeepShareTemplate(cfg);
  if (!ks) return "";
  return ks.base + encodeURIComponent(magnet);
}

function parseRequest() {
  const url = String($request.url || "");
  const u = new URL(url);
  return {
    host: u.hostname,
    path: u.pathname.replace(/\/$/, "") || "/",
    magnet: decodeURIComponent(u.searchParams.get("magnet") || "")
  };
}

const cfg = decodeArg();
const host = resolveMagnetHost(cfg);
const req = parseRequest();

if (req.host !== host) {
  $done({});
} else if (req.path === "/page") {
  const magnet = req.magnet;
  if (!magnet || magnet.indexOf("magnet:") !== 0) {
    respondLocal(400, {}, htmlPage("参数错误", "<h1>缺少有效磁力链接</h1>"));
  } else {
    respondLocal(200, {}, buildMagnetPage(magnet, cfg));
  }
} else if (req.path === "/115") {
  const magnet = req.magnet;
  if (!magnet || magnet.indexOf("magnet:") !== 0) {
    respondLocal(400, {}, htmlPage("参数错误", "<h1>缺少有效磁力链接</h1>"));
  } else {
    const ks = keepshareMagnetUrl(cfg, magnet);
    const target = ks ||
      "https://115.com/web/lixian/?ct=offline&ac=add&url=" + encodeURIComponent(magnet);
    respondRedirect(target);
  }
} else if (req.path === "/pikpak") {
  const magnet = req.magnet;
  if (!magnet || magnet.indexOf("magnet:") !== 0) {
    respondLocal(400, {}, htmlPage("参数错误", "<h1>缺少有效磁力链接</h1>"));
  } else {
    respondRedirect(
      "https://mypikpak.com/drive/all?action=add_magnet&url=" + encodeURIComponent(magnet)
    );
  }
} else if (req.path === "/guangya") {
  const magnet = req.magnet;
  if (!magnet || magnet.indexOf("magnet:") !== 0) {
    respondLocal(400, {}, htmlPage("参数错误", "<h1>缺少有效磁力链接</h1>"));
    return;
  }
  const argRaw = typeof $argument !== "undefined" ? String($argument || "") : "";
  const refresh = getRefreshToken(cfg, argRaw);
  if (!refresh) {
    respondLocal(200, {}, htmlPage("未配置 Token", "<h1>未配置光鸭 Refresh Token</h1>" +
      "<p>请在 Egern 模块参数填写 GUANGYA_REFRESH_TOKEN</p>" +
      "<p style=\"word-break:break-all;font-size:12px\">" + htmlEscape(magnet) + "</p>"));
    return;
  }
  (async function () {
    try {
      const did = cfg.GUANGYA_DID || randomHex(32);
      const token = await refreshAccessToken(refresh, did);
      const parentId = cfg.GUANGYA_PARENT_ID || "";
      const filterEnabled = isMagnetFilterEnabled(cfg);
      let fileIndexes = null;
      let filterSummary = "";

      if (filterEnabled) {
        const resolved = await resolveGuangyaResource(token, did, magnet);
        if (!isApiSuccess(resolved)) {
          throw new Error((resolved && (resolved.msg || resolved.message)) || "解析磁力文件列表失败");
        }
        const entries = extractResolvedFileEntries(resolved);
        if (!entries.length) {
          throw new Error("无法从 resolve_res 获取文件列表，请设置 MAGNET_FILTER=0 关闭过滤后重试");
        }
        const filtered = filterResolvedMagnetFiles(entries, cfg);
        if (!filtered.kept.length) {
          respondLocal(200, {}, htmlPage("全部被过滤", "<h1>没有可下载的文件</h1>" +
            "<p>共解析 " + entries.length + " 个文件，均被拦截规则命中。</p>" +
            (filtered.blocked.length
              ? "<p style=\"font-size:13px;color:#a1a1aa\">已拦截示例：<br>" +
                formatBlockedPreview(filtered.blocked) + "</p>"
              : "") +
            "<p>可在模块参数调整 MAGNET_BLOCK_PATTERNS 或 MAGNET_MIN_VIDEO_MB，或设置 MAGNET_FILTER=0 关闭过滤。</p>" +
            "<a class=\"btn\" href=\"javascript:history.back()\">返回</a>"));
          return;
        }
        fileIndexes = filtered.kept.map(function (item) { return item.index; });
        filterSummary = "<p style=\"font-size:12px;color:#71717a\">脚本版本 " + SCRIPT_VERSION + "</p>" +
          "<p>已解析 " + entries.length + " 个文件，提交 " + fileIndexes.length +
          " 个，拦截 " + filtered.blocked.length + " 个。</p>";
        if (filtered.kept.length) {
          filterSummary += "<p style=\"font-size:13px;color:#a1a1aa\">将下载：<br>" +
            formatFilePreview(filtered.kept) + "</p>";
        }
        if (filtered.blocked.length) {
          filterSummary += "<p style=\"font-size:13px;color:#a1a1aa\">已拦截：<br>" +
            formatBlockedPreview(filtered.blocked) + "</p>";
        }
      }

      const result = await createGuangyaTask(token, did, magnet, parentId, fileIndexes);
      const ok = isApiSuccess(result);
      const msg = (result && result.msg) || JSON.stringify(result);
      if (ok) {
        respondLocal(200, {}, htmlPage("导入成功", "<h1>已提交光鸭云下载</h1>" +
          (filterEnabled
            ? filterSummary
            : "<p style=\"font-size:12px;color:#71717a\">脚本版本 " + SCRIPT_VERSION + "</p>" +
              "<p>未启用文件过滤（全量下载）。</p>") +
          "<p>任务已提交，请自行打开光鸭 App 或网页「云下载」查看进度。</p>" +
          "<a class=\"btn\" href=\"javascript:history.back()\">返回上一页</a>"));
      } else {
        respondLocal(200, {}, htmlPage("导入失败", "<h1>光鸭返回异常</h1><p>" + htmlEscape(msg) + "</p>" +
          "<a class=\"btn\" href=\"javascript:history.back()\">返回</a>"));
      }
    } catch (e) {
      respondLocal(200, {}, htmlPage("请求失败", "<h1>调用光鸭 API 失败</h1><p>" + htmlEscape(e.message || e) + "</p>" +
        "<a class=\"btn\" href=\"javascript:history.back()\">返回</a>"));
    }
  })();
} else {
  $done({});
}
