/**
 * JavDB 详情页 — http-response
 * 将 magnet: 下载链接改写为本地操作页，避免 iOS 直接唤起系统磁力处理器
 *
 * 匹配：javdb.com / javdb36.com 等镜像的 /v/ 详情页
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

const cfg = decodeArg();
const MAGNET_HOST = cfg.MAGNET_HOST || "egern-magnet.local";

function toInterceptPage(magnet) {
  return "https://" + MAGNET_HOST + "/page?magnet=" + encodeURIComponent(magnet);
}

function rewriteMagnetHrefs(html) {
  let body = String(html);
  let changed = false;

  body = body.replace(/href=(["'])(magnet:\?[^"']+)\1/gi, function (_all, quote, magnet) {
    changed = true;
    return "href=" + quote + toInterceptPage(magnet) + quote;
  });

  body = body.replace(/href=(["'])(https?:\/\/[^"']*keepshare\.(?:org|cc)\/[^"']+)\1/gi, function (_all, quote, url) {
    const m = url.match(/magnet%3A%3F[^"'&]+/i) || url.match(/magnet:\?[^"'&]+/i);
    if (!m) return _all;
    changed = true;
    let magnet = m[0];
    try {
      magnet = decodeURIComponent(magnet);
    } catch (e) { /* keep */ }
    return "href=" + quote + toInterceptPage(magnet) + quote;
  });

  return changed ? body : null;
}

if (!$response.body || $response.status !== 200) {
  $done({});
} else if (!/\/v\/[A-Za-z0-9]+/.test($request.url)) {
  $done({});
} else {
  const rewritten = rewriteMagnetHrefs($response.body);
  if (!rewritten) {
    $done({});
  } else {
    $done({ body: rewritten });
  }
}
