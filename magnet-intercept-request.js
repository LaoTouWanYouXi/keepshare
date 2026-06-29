/**
 * Egern / Surge — http-request
 * 虚拟域名 egern-magnet.local：
 *   /page    — 展示磁力操作页（JavDB 改写后的入口）
 *   /guangya — 光鸭云盘云下载
 *   /115     — 115 离线下载（KeepShare API 或 115 Web）
 *   /pikpak  — PikPak 导入（KeepShare API 或 PikPak Web）
 *
 * 注意：http-request 返回本地页面必须用 $done({ response: { ... } })
 */

const CLIENT_ID = "aMe-8VSlkrbQXpUR";
const ACCOUNT_URL = "https://account.guangyapan.com";
const API_BASE = "https://api.guangyapan.com";
const SITE_ORIGIN = "https://www.guangyapan.com";
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";

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

/** http-request 本地响应（Surge / Egern 标准格式） */
function respondLocal(status, headers, body) {
  $done({
    response: {
      status: status || 200,
      headers: Object.assign(
        { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        headers || {}
      ),
      body: body || ""
    }
  });
}

function respondRedirect(location) {
  $done({
    response: {
      status: 302,
      headers: { Location: location, "Cache-Control": "no-store" }
    }
  });
}

function buildMagnetPage(magnet, cfg) {
  const host = resolveMagnetHost(cfg);
  const enc = encodeURIComponent(magnet);
  const base = "https://" + host;
  const copyJs =
    "navigator.clipboard&&navigator.clipboard.writeText(" +
    JSON.stringify(magnet) +
    ").then(function(){alert('已复制磁力链接')}).catch(function(){prompt('复制磁力链接'," +
    JSON.stringify(magnet) +
    ")})";

  const show115 = cfg.ENABLE_115 !== "0";
  const showPikpak = cfg.ENABLE_PIKPAK !== "0";
  const showGuangya = cfg.ENABLE_GUANGYA !== "0";

  let buttons =
    "<button class=\"btn btn-gray\" onclick=\"" + copyJs + "\">复制磁力链接</button>";
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
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
    "background:#0b0b0f;color:#f2f2f7;min-height:100vh;padding:24px 16px 40px}" +
    ".card{max-width:520px;margin:0 auto;background:#16161d;border:1px solid #2a2a35;" +
    "border-radius:18px;padding:22px 18px;box-shadow:0 12px 40px rgba(0,0,0,0.35)}" +
    "h1{font-size:22px;font-weight:700;margin-bottom:8px}" +
    ".sub{font-size:13px;line-height:1.5;color:#a1a1aa;margin-bottom:18px}" +
    ".magnet{background:#0f0f14;border:1px solid #30303a;border-radius:12px;padding:12px;" +
    "font-size:12px;line-height:1.55;word-break:break-all;color:#d4d4d8;margin-bottom:16px;max-height:160px;overflow:auto}" +
    ".btn{display:block;width:100%;border:0;border-radius:12px;padding:14px 16px;font-size:16px;" +
    "font-weight:600;margin-bottom:10px;cursor:pointer;text-decoration:none;text-align:center}" +
    ".btn-gray{background:#3f3f46;color:#fff}.btn-green{background:#22c55e;color:#052e16}" +
    ".btn-green.btn-guangya{background:#16a34a;color:#fff}.btn-blue{background:#3b82f6;color:#fff}" +
    ".hint{font-size:12px;color:#71717a;text-align:center;margin-top:8px}</style></head><body>" +
    "<div class=\"card\"><h1>检测到磁力链接</h1>" +
    "<p class=\"sub\">请选择一个操作。需要返回 JavDB 详情页时，使用浏览器返回按钮。</p>" +
    "<div class=\"magnet\">" + htmlEscape(magnet) + "</div>" + buttons +
    "<p class=\"hint\">由 Egern 本地脚本拦截 · 不经过第三方中转</p></div></body></html>";
}

function htmlPage(title, bodyHtml) {
  return "<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" + title + "</title>" +
    "<style>body{font-family:-apple-system,sans-serif;background:#0b0b0f;color:#f4f4f5;" +
    "padding:24px 16px}.card{max-width:520px;margin:0 auto;background:#16161d;border-radius:16px;" +
    "padding:20px;border:1px solid #2a2a35}h1{font-size:20px;margin-bottom:12px}" +
    "p{font-size:14px;line-height:1.6;color:#d4d4d8;margin-bottom:10px}" +
    "a{color:#60a5fa;text-decoration:none}.btn{display:inline-block;margin-top:12px;padding:10px 14px;" +
    "background:#3b82f6;color:#fff;border-radius:10px}</style></head><body><div class=\"card\">" +
    bodyHtml + "</div></body></html>";
}

function httpPost(url, headers, bodyObj) {
  return new Promise(function (resolve, reject) {
    $httpClient.post({
      url: url,
      headers: headers,
      body: JSON.stringify(bodyObj),
      timeout: 30
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

async function createGuangyaTask(token, did, magnet, parentId) {
  return httpPost(
    API_BASE + "/nd.bizcloudcollection.s/v1/create_task",
    apiHeaders(token, did),
    { url: magnet, parentId: parentId || "" }
  );
}

function parseKeepShareTemplate(cfg) {
  const raw = String(cfg.KEEPSHARE_TEMPLATE || cfg.KEEPSHARE_SHARE_ID || "").trim();
  if (!raw || raw.indexOf("{{") !== -1) return null;
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

function keepshareActionUrl(cfg, magnet, action) {
  const ks = parseKeepShareTemplate(cfg);
  if (!ks) return "";
  return ks.base + encodeURIComponent(magnet) + "?action=" + action;
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
    const ks = keepshareActionUrl(cfg, magnet, "115");
    const target = ks ||
      "https://115.com/web/lixian/?ct=offline&ac=add&url=" + encodeURIComponent(magnet);
    respondRedirect(target);
  }
} else if (req.path === "/pikpak") {
  const magnet = req.magnet;
  if (!magnet || magnet.indexOf("magnet:") !== 0) {
    respondLocal(400, {}, htmlPage("参数错误", "<h1>缺少有效磁力链接</h1>"));
  } else {
    const ks = keepshareActionUrl(cfg, magnet, "pikpak");
    const target = ks ||
      "https://mypikpak.com/drive/all?action=add_magnet&url=" + encodeURIComponent(magnet);
    respondRedirect(target);
  }
} else if (req.path === "/guangya") {
  (async function () {
    const magnet = req.magnet;
    if (!magnet || magnet.indexOf("magnet:") !== 0) {
      respondLocal(400, {}, htmlPage("参数错误", "<h1>缺少有效磁力链接</h1><p>请从拦截页重新进入。</p>"));
      return;
    }

    const refresh = cfg.GUANGYA_REFRESH_TOKEN || "";
    if (!refresh || refresh.indexOf("{{") !== -1) {
      respondLocal(200, {}, htmlPage("未配置 Token", "<h1>未配置光鸭 Refresh Token</h1>" +
        "<p>请在 Egern 模块参数中设置 <code>GUANGYA_REFRESH_TOKEN</code>，然后重试。</p>" +
        "<p style=\"word-break:break-all;font-size:12px;opacity:.8\">" + htmlEscape(magnet) + "</p>"));
      return;
    }

    try {
      const did = cfg.GUANGYA_DID || randomHex(32);
      const token = await refreshAccessToken(refresh, did);
      const result = await createGuangyaTask(token, did, magnet, cfg.GUANGYA_PARENT_ID || "");
      const ok = result && (result.msg === "success" || result.code === 0 || result.data);
      const msg = (result && result.msg) || JSON.stringify(result);

      if (ok) {
        respondLocal(200, {}, htmlPage("导入成功", "<h1>已提交光鸭云下载</h1>" +
          "<p>任务已创建，请到光鸭云盘 App / 网页的「云下载」查看进度。</p>" +
          "<p style=\"font-size:12px;opacity:.75;word-break:break-all\">" + htmlEscape(magnet) + "</p>" +
          "<a class=\"btn\" href=\"javascript:history.back()\">返回</a>"));
      } else {
        respondLocal(200, {}, htmlPage("导入失败", "<h1>光鸭返回异常</h1><p>" + htmlEscape(msg) + "</p>" +
          "<p style=\"font-size:12px;word-break:break-all\">" + htmlEscape(magnet) + "</p>" +
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
