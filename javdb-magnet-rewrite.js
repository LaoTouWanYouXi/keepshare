/**
 * JavDB 详情页 — http-response
 * @version 1.1.0
 * @changelog
 *   1.1.0 - 取消跳转虚拟域名；页内弹层；去除 target=_blank 防 about:blank 卡死
 *   1.0.x - 初版 href 改写（已废弃）
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

const SCRIPT_VERSION = "1.1.0";
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
  const headers = { "Content-Type": "text/html; charset=utf-8", "X-Egern-Magnet-Ver": SCRIPT_VERSION };
  return headers;
}

function attrEsc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** 去掉 target=_blank，改为页内 data 属性，避免新开 about:blank 标签 */
function neutralizeMagnetAnchors(html) {
  return String(html).replace(
    /<a\b([^>]*?)\shref=(["'])(magnet:\?[^"']+)\2([^>]*)>/gi,
    function (_all, pre, _q, magnet, post) {
      const attrs = (pre + " " + post)
        .replace(/\starget\s*=\s*(["'])[^"']*\1/gi, " ")
        .replace(/\srel\s*=\s*(["'])[^"']*\1/gi, " ")
        .replace(/\sonclick\s*=\s*(["'])[^"']*\1/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      const m = magnet.split("&")[0];
      return '<a ' + attrs + ' href="#" data-egern-magnet="' + attrEsc(m) + '">';
    }
  );
}

function buildInjectScript() {
  const cfgJson = JSON.stringify(PANEL_CFG);
  return (
    "<script data-egern-magnet-intercept data-ver=\"" + SCRIPT_VERSION + "\">" +
    "(function(){" +
    "if(window.__egernMagnetPanelInit)return;" +
    "window.__egernMagnetPanelInit=1;" +
    "var C=" + cfgJson + ";" +
    "function ksUrl(m,a){if(!C.ks)return'';var b=C.ks;return b+(b.charAt(b.length-1)==='/'?'':'/')+encodeURIComponent(m)+'?action='+a;}" +
    "function mkBtn(href,text,bg,fg){var a=document.createElement('a');a.href=href;a.textContent=text;" +
    "a.style.cssText='display:block;box-sizing:border-box;width:100%;text-align:center;padding:14px 12px;margin-bottom:10px;border-radius:12px;font-size:16px;font-weight:600;text-decoration:none;background:'+bg+';color:'+fg;return a;}" +
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
    "var cl=document.createElement('a');cl.href='#';cl.textContent='关闭';cl.style.cssText='display:block;text-align:center;margin-top:12px;color:#71717a;font-size:13px;text-decoration:none';" +
    "cl.onclick=function(ev){ev.preventDefault();w.remove();};" +
    "c.appendChild(h);c.appendChild(p);c.appendChild(ta);c.appendChild(bs);c.appendChild(cl);w.appendChild(c);" +
    "w.addEventListener('click',function(ev){if(ev.target===w)w.remove();});" +
    "document.body.appendChild(w);}" +
    "function pickMagnet(el){return el.getAttribute('data-egern-magnet')||(el.getAttribute('href')||'').split('&')[0];}" +
    "document.addEventListener('click',function(e){" +
    "var a=e.target.closest('a[data-egern-magnet],a[href^=\"magnet:?\"]');if(!a)return;" +
    "e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();" +
    "var m=pickMagnet(a);if(m&&m.indexOf('magnet:')===0)showPanel(m);return false;" +
    "},true);" +
    "document.addEventListener('auxclick',function(e){" +
    "var a=e.target.closest('a[data-egern-magnet],a[href^=\"magnet:?\"]');if(!a)return;" +
    "e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();return false;" +
    "},true);" +
    "})();</script>"
  );
}

function injectPanelScript(html) {
  if (String(html).indexOf("data-egern-magnet-intercept") !== -1) {
    return String(html).replace(/data-ver=\"[^\"]*\"/, "data-ver=\"" + SCRIPT_VERSION + "\"");
  }
  const script = buildInjectScript();
  if (/<\/body>/i.test(html)) return String(html).replace(/<\/body>/i, script + "</body>");
  return String(html) + script;
}

if (!$response.body || $response.status !== 200) {
  $done({});
} else if (!/\/v\/[A-Za-z0-9]+/.test($request.url)) {
  $done({});
} else {
  const original = String($response.body);
  let body = neutralizeMagnetAnchors(original);
  body = injectPanelScript(body);
  $done({
    status: 200,
    headers: buildHtmlHeaders(),
    body: body
  });
}
