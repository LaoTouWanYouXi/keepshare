/**
 * Egern / Surge — http-request
 * Forward 详情页点击豆瓣 / TMDB 图标 → 半屏搜索页 → 302 跳转 JavDB 搜索
 * @version 1.0.0
 */

const SCRIPT_VERSION = "1.0.0";
const JAVDB_SEARCH_BASE = "https://javdb.com/search";

function extractMatchCode(text) {
  var s = String(text || "").trim();
  if (!s) return "";
  s = s.toUpperCase();
  s = s.replace(/^[A-Z0-9]+(?:\.[A-Z0-9]+)+@/, "");
  s = s.replace(/^(?:HHD800|HHB800)[_\-@.\s]?/, "");
  var normalized = s.replace(/_/g, "-").replace(/\s+/g, " ").trim();
  var patterns = [
    /\bFC2(?:[- ]?PPV)?[- ]?(\d{5,8})\b/,
    /\bCARIB[- ]?(\d{6,8})\b/,
    /\b1PONDO[- ]?(\d{6,8})\b/,
    /\bHEYZO[- ]?(\d{3,6})\b/,
    /\bT28[- ]?(\d{6,8})\b/,
    /\b([A-Z]{2,15})[- ]?(\d{2,10})\b/,
    /\b(\d{6}[-_]\d{2,3})\b/,
  ];
  for (var i = 0; i < patterns.length; i++) {
    var match = normalized.match(patterns[i]);
    if (!match) continue;
    if (match[1] && match[2]) return match[1] + "-" + match[2];
    if (match[1]) return match[1].replace(/\s+/g, "");
  }
  return "";
}

function extractJavCode(text) {
  var code = extractMatchCode(text);
  if (!code) return "";
  var parts = code.match(/^([A-Z0-9]+)-(\d+)$/i);
  if (parts) return parts[1] + "-" + String(parseInt(parts[2], 10));
  return code;
}

function respondRedirect(location) {
  var h = {
    Location: location,
    "Cache-Control": "no-store",
    Connection: "close",
    "X-Forward-JavDB-Ver": SCRIPT_VERSION,
  };
  $done({ response: { status: 302, headers: h }, status: 302, headers: h });
}

function buildJavdbSearchUrl(code) {
  return JAVDB_SEARCH_BASE + "?q=" + encodeURIComponent(code) + "&f=all";
}

function decodeQueryValue(raw) {
  var value = String(raw || "").replace(/\+/g, " ");
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return value;
  }
}

function readQueryParam(reqUrl, key) {
  var pattern = new RegExp("[?&]" + key + "=([^&#]*)", "i");
  var match = String(reqUrl || "").match(pattern);
  if (!match) return "";
  return decodeQueryValue(match[1]);
}

function parseSearchKeyword(reqUrl) {
  var url = String(reqUrl || "").split("#")[0];

  if (/^https?:\/\/m\.douban\.com\/search\/?(?:[?#]|$)/i.test(url)) {
    return readQueryParam(url, "query");
  }

  if (/^https?:\/\/search\.douban\.com\/movie\/subject_search/i.test(url)) {
    return readQueryParam(url, "search_text");
  }

  if (/^https?:\/\/www\.themoviedb\.org\/search/i.test(url)) {
    return readQueryParam(url, "query");
  }

  return "";
}

function isForwardProviderSearchUrl(reqUrl) {
  var url = String(reqUrl || "").split("#")[0];
  return (
    /^https?:\/\/m\.douban\.com\/search\/?(?:[?#]|$)/i.test(url) ||
    /^https?:\/\/search\.douban\.com\/movie\/subject_search/i.test(url) ||
    /^https?:\/\/www\.themoviedb\.org\/search/i.test(url)
  );
}

var reqUrl = String($request.url || "");

if (!isForwardProviderSearchUrl(reqUrl)) {
  $done({});
} else {
  var keyword = parseSearchKeyword(reqUrl);
  var code = extractJavCode(keyword);
  if (!code) {
    $done({});
  } else {
    respondRedirect(buildJavdbSearchUrl(code));
  }
}
