/**
 * JavDB 详情页 — http-response
 * @version 1.1.5
 * @changelog
 *   1.1.5 - 操作弹层增加 123 云盘一键导入按钮
 *   1.1.4 - 拦截 keepshare.org/cc 下载链接；115/PikPak 走本地 /115 /pikpak（去掉 ?action= 防 301）
 *   1.1.3 - 保留 magnet: href，页内弹层
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

const SCRIPT_VERSION = "1.1.5";

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

const cfg = decodeArg();
const PANEL_CFG = {
  v: SCRIPT_VERSION,
  base: "http://" + resolveMagnetHost(cfg),
  s115: resolveVal(cfg.ENABLE_115, "1") !== "0",
  spk: resolveVal(cfg.ENABLE_PIKPAK, "1") !== "0",
  sgy: resolveVal(cfg.ENABLE_GUANGYA, "1") !== "0",
  s123: resolveVal(cfg.ENABLE_123, "1") !== "0"
};

function buildHtmlHeaders() {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "X-Egern-Magnet-Ver": SCRIPT_VERSION
  };
}

/** magnet 与 keepshare 磁力链接：去掉 target=_blank */
function stripDownloadBlankTarget(html) {
  return String(html).replace(/<a\b([^>]*\shref=(["'])([^"']+)\2[^>]*)>/gi, function (_all, inner, _q, href) {
    const h = String(href || "");
    const isMag = /^magnet:/i.test(h);
    const isKs = /keepshare\.(?:org|cc)/i.test(h) && /magnet/i.test(h);
    if (!isMag && !isKs) return _all;
    const cleaned = inner
      .replace(/\starget\s*=\s*(["'])[^"']*\1/gi, " ")
      .replace(/\srel\s*=\s*(["'])[^"']*\1/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return "<a " + cleaned + ">";
  });
}

function buildInjectScript() {
  const cfgJson = JSON.stringify(PANEL_CFG);
  return (
    "<script data-egern-magnet-intercept data-ver=\"" + SCRIPT_VERSION + "\">" +
    "(function(){" +
    "var V='" + SCRIPT_VERSION + "';" +
    "if(window.__egernMagnetVer===V)return;" +
    "window.__egernMagnetVer=V;" +
    "var C=" + cfgJson + ";" +
    "function isMag(u){return/^magnet:/i.test(String(u||''));}" +
    "function norm(u){return String(u||'').trim().split('&')[0].split('#')[0];}" +
    "function isKsMag(u){return/keepshare\\.(org|cc)/i.test(String(u||''))&&/magnet/i.test(String(u||''));}" +
    "function magnetFromKs(u){try{var p=String(u).split('?')[0].split('/');var last=decodeURIComponent(p[p.length-1]);if(isMag(last))return norm(last);}catch(x){}return'';}" +
    "function magnetFromLink(h){if(isMag(h))return norm(h);if(isKsMag(h))return magnetFromKs(h);return'';}" +
    "function go(href){location.assign(href);}" +
    "function mkBtn(href,text,bg,fg){var b=document.createElement('button');b.type='button';b.textContent=text;" +
    "b.style.cssText='display:block;box-sizing:border-box;width:100%;padding:14px 12px;margin-bottom:10px;border-radius:12px;font-size:16px;font-weight:600;border:0;cursor:pointer;background:'+bg+';color:'+fg+';" +
    "b.onclick=function(){go(href);};return b;}" +
    "function showPanel(m){" +
    "var old=document.getElementById('egern-magnet-panel');if(old)old.remove();" +
    "var w=document.createElement('div');w.id='egern-magnet-panel';" +
    "w.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:16px';" +
    "var c=document.createElement('div');" +
    "c.style.cssText='width:100%;max-width:520px;background:#16161d;color:#f2f2f7;border:1px solid #2a2a35;border-radius:18px;padding:20px 16px;font-family:-apple-system,sans-serif';" +
    "c.innerHTML='<h2 style=\"margin:0 0 8px;font-size:20px\">检测到磁力链接</h2>" +
    "<p style=\"margin:0 0 12px;font-size:13px;color:#a1a1aa\">选择操作。复制请长按下方文本框。</p>';" +
    "var ta=document.createElement('textarea');ta.readOnly=true;ta.value=m;" +
    "ta.style.cssText='width:100%;height:88px;background:#0f0f14;color:#d4d4d8;border:1px solid #30303a;border-radius:10px;padding:10px;font-size:12px;word-break:break-all;box-sizing:border-box';" +
    "var bs=document.createElement('div');bs.style.marginTop='12px';" +
    "var enc=encodeURIComponent(m);" +
    "if(C.s115){bs.appendChild(mkBtn(C.base+'/115?magnet='+enc,'115 网盘 · 离线下载','#22c55e','#052e16'));}" +
    "if(C.spk){bs.appendChild(mkBtn(C.base+'/pikpak?magnet='+enc,'PikPak · 一键导入','#3b82f6','#fff'));}" +
    "if(C.sgy){bs.appendChild(mkBtn(C.base+'/guangya?magnet='+enc,'光鸭云盘 · 一键导入','#16a34a','#fff'));}" +
    "if(C.s123){bs.appendChild(mkBtn(C.base+'/123?magnet='+enc,'123云盘 · 一键导入','#667eea','#fff'));}" +
    "var cl=document.createElement('button');cl.type='button';cl.textContent='关闭';" +
    "cl.style.cssText='display:block;width:100%;margin-top:12px;color:#71717a;font-size:13px;background:0;border:0';" +
    "cl.onclick=function(){w.remove();};" +
    "c.appendChild(ta);c.appendChild(bs);c.appendChild(cl);w.appendChild(c);" +
    "w.onclick=function(ev){if(ev.target===w)w.remove();};document.body.appendChild(w);}" +
    "function onDownloadClick(e){var a=e.target.closest('a[href]');if(!a)return;" +
    "var h=a.getAttribute('href')||'';var m=magnetFromLink(h);if(!m)return;" +
    "e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();showPanel(m);return false;}" +
    "document.addEventListener('click',onDownloadClick,true);" +
    "var _open=window.open;" +
    "window.open=function(u){var m=magnetFromLink(String(u||''));if(m){showPanel(m);return null;}return _open.apply(window,arguments);};" +
    "function fixTargets(root){var list=(root||document).querySelectorAll('a[href]');" +
    "for(var i=0;i<list.length;i++){var h=list[i].getAttribute('href')||'';if(isMag(h)||isKsMag(h)){list[i].removeAttribute('target');list[i].removeAttribute('rel');}}}" +
    "fixTargets(document);" +
    "var box=document.getElementById('magnets-content');" +
    "if(box&&window.MutationObserver){new MutationObserver(function(){fixTargets(box);}).observe(box,{childList:true,subtree:true});}" +
    "})();</script>"
  );
}

function injectPanelScript(html) {
  const s = String(html);
  const script = buildInjectScript();
  if (s.indexOf("data-egern-magnet-intercept") !== -1) {
    return s.replace(/<script data-egern-magnet-intercept[\s\S]*?<\/script>/i, script);
  }
  if (/<\/body>/i.test(s)) return s.replace(/<\/body>/i, script + "</body>");
  return s + script;
}

if (!$response.body || $response.status !== 200) {
  $done({});
} else if (!/\/v\/[A-Za-z0-9]+/.test($request.url)) {
  $done({});
} else {
  let body = stripDownloadBlankTarget(String($response.body));
  body = injectPanelScript(body);
  $done({ status: 200, headers: buildHtmlHeaders(), body: body });
}
