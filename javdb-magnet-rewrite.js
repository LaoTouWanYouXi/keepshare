/**
 * JavDB 详情页 — http-response
 * @version 1.1.3
 * @changelog
 *   1.1.3 - 不再改 href 为 #（修复点击滚到顶部）；仅去 target=_blank + 点击拦截弹层
 *   1.1.2 - window.open 拦截（mousedown 过激进，已回退）
 *   1.1.0 - 页内弹层
 *
 * KeepShare 模板参数仍用于弹层内 115/PikPak 按钮，与「磁力拦截-KeepShare」脚本无关。
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

const SCRIPT_VERSION = "1.1.3";

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
  ks: resolveVal(cfg.KEEPSHARE_TEMPLATE, ""),
  s115: resolveVal(cfg.ENABLE_115, "1") !== "0",
  spk: resolveVal(cfg.ENABLE_PIKPAK, "1") !== "0",
  sgy: resolveVal(cfg.ENABLE_GUANGYA, "1") !== "0"
};

function buildHtmlHeaders() {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "X-Egern-Magnet-Ver": SCRIPT_VERSION
  };
}

/** 只去掉 magnet 链接的 target=_blank，保留原始 magnet: href */
function stripMagnetBlankTarget(html) {
  return String(html).replace(/<a\b([^>]*\shref=(["'])magnet:[^"']+\2[^>]*)>/gi, function (_all, inner) {
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
    "function ksUrl(m,a){if(!C.ks)return'';var b=C.ks;return b+(b.slice(-1)==='/'?'':'/')+encodeURIComponent(m)+'?action='+a;}" +
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
    "if(C.s115){bs.appendChild(mkBtn(ksUrl(m,'115')||('https://115.com/web/lixian/?ct=offline&ac=add&url='+encodeURIComponent(m)),'115 网盘 · 离线下载','#22c55e','#052e16'));}" +
    "if(C.spk){bs.appendChild(mkBtn(ksUrl(m,'pikpak')||('https://mypikpak.com/drive/all?action=add_magnet&url='+encodeURIComponent(m)),'PikPak · 一键导入','#3b82f6','#fff'));}" +
    "if(C.sgy){bs.appendChild(mkBtn(C.base+'/guangya?magnet='+encodeURIComponent(m),'光鸭云盘 · 一键导入','#16a34a','#fff'));}" +
    "var cl=document.createElement('button');cl.type='button';cl.textContent='关闭';" +
    "cl.style.cssText='display:block;width:100%;margin-top:12px;color:#71717a;font-size:13px;background:0;border:0';" +
    "cl.onclick=function(){w.remove();};" +
    "c.appendChild(ta);c.appendChild(bs);c.appendChild(cl);w.appendChild(c);" +
    "w.onclick=function(ev){if(ev.target===w)w.remove();};document.body.appendChild(w);}" +
    "function onMagnetClick(e){var a=e.target.closest('a[href^=\"magnet:\"],a[href^=\"magnet:?\"],a[href^=\"MAGNET:\"]');" +
    "if(!a)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();showPanel(norm(a.getAttribute('href')));return false;}" +
    "document.addEventListener('click',onMagnetClick,true);" +
    "var _open=window.open;" +
    "window.open=function(u){if(isMag(u)){showPanel(norm(u));return null;}return _open.apply(window,arguments);};" +
    "function fixTargets(root){var list=(root||document).querySelectorAll('a[href^=\"magnet:\"],a[href^=\"magnet:?\"],a[href^=\"MAGNET:\"]');" +
    "for(var i=0;i<list.length;i++){list[i].removeAttribute('target');list[i].removeAttribute('rel');}}" +
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
  let body = stripMagnetBlankTarget(String($response.body));
  body = injectPanelScript(body);
  $done({ status: 200, headers: buildHtmlHeaders(), body: body });
}
