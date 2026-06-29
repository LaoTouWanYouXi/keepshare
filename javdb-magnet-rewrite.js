/**
 * JavDB 详情页 — http-response
 * @version 1.1.2
 * @changelog
 *   1.1.2 - 拦截 window.open / mousedown；MutationObserver 动态链接；更强 href 匹配
 *   1.1.0 - 页内弹层；去除 target=_blank
 *   1.0.x - 初版（已废弃）
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

const SCRIPT_VERSION = "1.1.2";
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

const cfg = decodeArg();
const MAGNET_BASE = "http://" + resolveMagnetHost(cfg);
const PANEL_CFG = {
  v: SCRIPT_VERSION,
  base: MAGNET_BASE,
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

function attrEsc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function isMagnetHref(href) {
  return /^magnet:/i.test(String(href || "").trim());
}

function magnetFromHref(href) {
  return String(href || "").trim().split("&")[0].split("#")[0];
}

function stripNavAttrs(tagInner) {
  return String(tagInner || "")
    .replace(/\shref\s*=\s*(["'])[^"']*\1/gi, " ")
    .replace(/\starget\s*=\s*(["'])[^"']*\1/gi, " ")
    .replace(/\srel\s*=\s*(["'])[^"']*\1/gi, " ")
    .replace(/\sonclick\s*=\s*(["'])[^"']*\1/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 静态 HTML：所有 magnet / keepshare 磁力链接 neutralize */
function neutralizeMagnetAnchors(html) {
  let body = String(html);

  body = body.replace(/<a\b([^>]*)>/gi, function (full, inner) {
    const hrefM = inner.match(/\shref\s*=\s*(["'])([^"']+)\1/i);
    if (!hrefM) return full;
    const href = hrefM[2];
    if (isMagnetHref(href)) {
      const attrs = stripNavAttrs(inner);
      return '<a ' + attrs + ' href="#" data-egern-magnet="' + attrEsc(magnetFromHref(href)) + '">';
    }
    if (/keepshare\.(?:org|cc)/i.test(href) && /magnet/i.test(href)) {
      const attrs = stripNavAttrs(inner);
      let magnet = "";
      try {
        const part = decodeURIComponent(href.split("/").pop().split("?")[0]);
        if (isMagnetHref(part)) magnet = magnetFromHref(part);
      } catch (e) { /* ignore */ }
      if (magnet) {
        return '<a ' + attrs + ' href="#" data-egern-magnet="' + attrEsc(magnet) + '">';
      }
    }
    if (/\starget\s*=\s*(["'])[^"']*\1/i.test(inner) && isMagnetHref(hrefM[2])) {
      return full;
    }
    return full;
  });

  body = body.replace(
    /(<(?:div|section)[^>]*id=(["'])magnets-content\2[^>]*>[\s\S]*?)<\/(?:div|section)>/gi,
    function (block) {
      return block.replace(/\starget\s*=\s*(["'])[^"']*\1/gi, "");
    }
  );

  return body;
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
    "function mkBtn(href,text,bg,fg){var b=document.createElement('button');b.type='button';b.textContent=text;" +
    "b.style.cssText='display:block;box-sizing:border-box;width:100%;text-align:center;padding:14px 12px;margin-bottom:10px;border-radius:12px;font-size:16px;font-weight:600;border:0;cursor:pointer;background:'+bg+';color:'+fg+';" +
    "b.addEventListener('click',function(ev){ev.preventDefault();location.href=href;});return b;}" +
    "function showPanel(m){" +
    "var old=document.getElementById('egern-magnet-panel');if(old)old.remove();" +
    "var w=document.createElement('div');w.id='egern-magnet-panel';" +
    "w.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:16px';" +
    "var c=document.createElement('div');" +
    "c.style.cssText='width:100%;max-width:520px;background:#16161d;color:#f2f2f7;border:1px solid #2a2a35;border-radius:18px;padding:20px 16px;font-family:-apple-system,sans-serif';" +
    "var h=document.createElement('h2');h.textContent='检测到磁力链接';h.style.cssText='margin:0 0 8px;font-size:20px';" +
    "var p=document.createElement('p');p.textContent='选择操作。复制请长按下方文本框。';p.style.cssText='margin:0 0 12px;font-size:13px;color:#a1a1aa';" +
    "var ta=document.createElement('textarea');ta.readOnly=true;ta.value=m;" +
    "ta.style.cssText='width:100%;height:88px;background:#0f0f14;color:#d4d4d8;border:1px solid #30303a;border-radius:10px;padding:10px;font-size:12px;word-break:break-all;box-sizing:border-box';" +
    "var bs=document.createElement('div');bs.style.marginTop='12px';" +
    "if(C.s115){bs.appendChild(mkBtn(ksUrl(m,'115')||('https://115.com/web/lixian/?ct=offline&ac=add&url='+encodeURIComponent(m)),'115 网盘 · 离线下载','#22c55e','#052e16'));}" +
    "if(C.spk){bs.appendChild(mkBtn(ksUrl(m,'pikpak')||('https://mypikpak.com/drive/all?action=add_magnet&url='+encodeURIComponent(m)),'PikPak · 一键导入','#3b82f6','#fff'));}" +
    "if(C.sgy){bs.appendChild(mkBtn(C.base+'/guangya?magnet='+encodeURIComponent(m),'光鸭云盘 · 一键导入','#16a34a','#fff'));}" +
    "var cl=document.createElement('button');cl.type='button';cl.textContent='关闭';" +
    "cl.style.cssText='display:block;width:100%;text-align:center;margin-top:12px;color:#71717a;font-size:13px;background:0;border:0';" +
    "cl.onclick=function(){w.remove();};" +
    "c.appendChild(h);c.appendChild(p);c.appendChild(ta);c.appendChild(bs);c.appendChild(cl);w.appendChild(c);" +
    "w.onclick=function(ev){if(ev.target===w)w.remove();};document.body.appendChild(w);}" +
    "function pickMag(el){return el.getAttribute('data-egern-magnet')||el.getAttribute('href')||'';}" +
    "function fixAnchor(a){if(!a||a.hasAttribute('data-egern-fixed'))return;" +
    "var h=a.getAttribute('href')||'';if(!isMag(h))return;" +
    "a.setAttribute('data-egern-magnet',norm(h));a.setAttribute('href','#');a.removeAttribute('target');a.removeAttribute('rel');a.setAttribute('data-egern-fixed','1');}" +
    "function scan(root){var nodes=(root||document).querySelectorAll('a[href^=\"magnet:\"],a[href^=\"magnet:?\"],a[href^=\"MAGNET:\"]');" +
    "for(var i=0;i<nodes.length;i++)fixAnchor(nodes[i]);}" +
    "function handleLink(el,e){var m=norm(pickMag(el));if(!isMag(m))return false;" +
    "if(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();}" +
    "showPanel(m);return true;}" +
    "function findLink(t){return t&&t.closest?t.closest('a[data-egern-magnet],a[href^=\"magnet:\"],a[href^=\"magnet:?\"],a[href^=\"MAGNET:\"]'):null;}" +
    "['mousedown','touchstart','click','auxclick'].forEach(function(evt){" +
    "document.addEventListener(evt,function(e){var a=findLink(e.target);if(!a)return;" +
    "if(evt==='mousedown'||evt==='touchstart'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();return;}" +
    "handleLink(a,e);},true);});" +
    "var _open=window.open;" +
    "window.open=function(u,t,f){if(isMag(u)){showPanel(norm(u));return null;}" +
    "if(/keepshare\\.(org|cc)/i.test(String(u||''))&&/magnet/i.test(String(u||''))){try{var p=decodeURIComponent(String(u).split('/').pop().split('?')[0]);if(isMag(p)){showPanel(norm(p));return null;}}catch(x){}}" +
    "return _open.apply(window,arguments);};" +
    "scan(document);" +
    "var box=document.getElementById('magnets-content');" +
    "if(box&&window.MutationObserver){new MutationObserver(function(){scan(box);}).observe(box,{childList:true,subtree:true});}" +
    "setInterval(function(){scan(document.getElementById('magnets-content')||document);},1500);" +
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
  let body = neutralizeMagnetAnchors(String($response.body));
  body = injectPanelScript(body);
  $done({ status: 200, headers: buildHtmlHeaders(), body: body });
}
