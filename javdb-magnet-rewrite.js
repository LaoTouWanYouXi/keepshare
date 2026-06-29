/**
 * JavDB 详情页 — http-response
 * 1. 改写 HTML 中的 magnet: 链接
 * 2. 注入点击拦截脚本（兼容 JS 动态加载的磁力列表）
 * 3. 修正响应头，避免 Content-Length 不匹配导致页面一直 loading
 */

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

const cfg = decodeArg();
const MAGNET_HOST = resolveMagnetHost(cfg);

function toInterceptPage(magnet) {
  return "https://" + MAGNET_HOST + "/page?magnet=" + encodeURIComponent(magnet);
}

function buildHtmlHeaders() {
  const headers = {};
  const src = $response.headers || {};
  for (const k in src) {
    const lk = k.toLowerCase();
    if (lk === "content-length" || lk === "content-encoding" || lk === "transfer-encoding") continue;
    headers[k] = src[k];
  }
  headers["Content-Type"] = "text/html; charset=utf-8";
  return headers;
}

function rewriteMagnetHrefs(html) {
  let body = String(html);
  let changed = false;

  body = body.replace(/href=(["'])(magnet:\?[^"']+)\1/gi, function (_all, quote, magnet) {
    changed = true;
    return "href=" + quote + toInterceptPage(magnet.split("&")[0]) + quote;
  });

  body = body.replace(/href=(["'])(https?:\/\/[^"']*keepshare\.(?:org|cc)\/[^"']+)\1/gi, function (_all, quote, url) {
    const m = url.match(/magnet%3A%3F[^"'&]+/i) || url.match(/magnet:\?[^"'&]+/i);
    if (!m) return _all;
    changed = true;
    let magnet = m[0];
    try {
      magnet = decodeURIComponent(magnet);
    } catch (e) { /* keep */ }
    return "href=" + quote + toInterceptPage(magnet.split("&")[0]) + quote;
  });

  return changed ? body : body;
}

function injectClickInterceptor(html) {
  if (String(html).indexOf("data-egern-magnet-intercept") !== -1) return html;
  const host = MAGNET_HOST;
  const script =
    "<script data-egern-magnet-intercept>(function(){" +
    "var H=" + JSON.stringify(host) + ";" +
    "function go(m){location.href='https://'+H+'/page?magnet='+encodeURIComponent(m);}" +
    "document.addEventListener('click',function(e){" +
    "var a=e.target.closest('a[href^=\"magnet:?\"]');" +
    "if(!a)return;" +
    "e.preventDefault();e.stopImmediatePropagation();" +
    "go(a.getAttribute('href').split('&')[0]);" +
    "},true);" +
    "})();</script>";
  if (/<\/body>/i.test(html)) return String(html).replace(/<\/body>/i, script + "</body>");
  return String(html) + script;
}

if (!$response.body || $response.status !== 200) {
  $done({});
} else if (!/\/v\/[A-Za-z0-9]+/.test($request.url)) {
  $done({});
} else {
  const original = String($response.body);
  let body = rewriteMagnetHrefs(original);
  body = injectClickInterceptor(body);
  if (body === original) {
    $done({});
  } else {
    $done({
      status: 200,
      headers: buildHtmlHeaders(),
      body: body
    });
  }
}
