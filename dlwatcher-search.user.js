// ==UserScript==
// @name         DLwatcher 검색 (품번/제목/성우)
// @namespace    dlwatcher-search
// @version      0.3.0
// @description  dlwatcher.com에 품번(RJ) / 제목·서클 / 성우 통합 검색을 추가합니다.
// @match        https://dlwatcher.com/*
// @connect      www.dlsite.com
// @connect      dlsite.com
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ---- 유저스크립트 어댑터: 확장프로그램용 코드를 그대로 쓰기 위한 chrome/fetch 대체 ----
  let __listener = null;
  const chrome = {
    runtime: {
      lastError: null,
      onMessage: { addListener(fn) { __listener = fn; } },
      sendMessage(msg, cb) { __listener(msg, null, cb); },
    },
    storage: {
      local: {
        async get(keys) {
          const out = {};
          for (const k of keys) {
            const v = GM_getValue(k);
            if (v !== undefined) out[k] = v;
          }
          return out;
        },
        set(obj) {
          for (const [k, v] of Object.entries(obj)) GM_setValue(k, v);
        },
      },
    },
  };

  // 서비스 워커의 fetch 대신 GM_xmlhttpRequest 로 DLsite 를 호출한다(교차 출처 허용).
  const fetch = (url, opts) =>
    new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        headers: (opts && opts.headers) || {},
        timeout: 20000,
        onload: (r) =>
          resolve({
            ok: r.status >= 200 && r.status < 300,
            status: r.status,
            text: async () => r.responseText,
            json: async () => JSON.parse(r.responseText),
          }),
        onerror: () => reject(new Error("DLsite 연결에 실패했어요.")),
        ontimeout: () => reject(Object.assign(new Error("timeout"), { name: "AbortError" })), // background.js가 시간 초과 문구로 바꾼다
      });
    });

  GM_addStyle("/* \ubaa8\ub4e0 \uaddc\uce59\uc740 #dlws-root \uc544\ub798\ub85c \ud55c\uc815\ud574\uc11c dlwatcher \uc6d0\ub798 \ud654\uba74\uc744 \uac74\ub4dc\ub9ac\uc9c0 \uc54a\ub294\ub2e4. */\n#dlws-root, #dlws-root * { box-sizing: border-box; }\n\n#dlws-root {\n  --bg: #ffffff;\n  --surface: #f2f2f3;\n  --line: #ececee;\n  --ink: #111111;\n  --sub: #6b6b70;\n  --faint: #a3a3a8;\n  --red: #e5322d;\n  /* \uc810\uc218 4\ub2e8\uacc4 \uc0c9(\ubbf8\ud655\uc815) */\n  --lv-low: #0f9d58;\n  --lv-cheap: #7ad27a;\n  --lv-avg: #d9a400;\n  --lv-high: #e5322d;\n  /* \uadf8\ub798\ud504: \uc62c\ud574 / \uc9c0\ub09c\ud574 / \uc7ac\uc791\ub144 */\n  --g0: #185fa5;\n  --g1: #378add;\n  --g2: #9cc4ee;\n  --scrim: rgba(12, 14, 20, .5);\n\n  font-family: \"Pretendard Variable\", Pretendard, \"Hiragino Sans\", \"Noto Sans JP\", \"Noto Sans KR\", \"Apple SD Gothic Neo\", \"Malgun Gothic\", Meiryo, system-ui, sans-serif;\n  font-size: 14px;\n  line-height: 1.45;\n  color: var(--ink);\n  -webkit-text-size-adjust: 100%;\n}\n\n@media (prefers-color-scheme: dark) {\n  #dlws-root {\n    --bg: #141518;\n    --surface: #1f2024;\n    --line: #2a2b30;\n    --ink: #ededf0;\n    --sub: #a4a4ab;\n    --faint: #6f6f76;\n    --red: #ff5b52;\n    --g0: #8fbef0;\n    --g1: #5d9be0;\n    --g2: #35587e;\n    --scrim: rgba(0, 0, 0, .65);\n  }\n}\n\n#dlws-root button { font: inherit; color: inherit; }\n#dlws-root :focus-visible { outline: 2px solid var(--g0); outline-offset: 2px; }\n#dlws-root [hidden] { display: none !important; }\n\n/* ---------- \uc5f4\uae30 \ubc84\ud2bc ---------- */\n#dlws-root #dlws-fab {\n  position: fixed; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); z-index: 2147483000;\n  width: 54px; height: 54px; padding: 0; border: 0; border-radius: 50%;\n  display: grid; place-items: center; cursor: pointer;\n  background: var(--ink); color: var(--bg);\n  box-shadow: 0 6px 18px rgba(0, 0, 0, .3);\n}\n#dlws-root #dlws-fab svg { width: 24px; height: 24px; }\n#dlws-root .dlws-dot { position: absolute; top: 2px; right: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--red); border: 2px solid var(--bg); }\n\n/* ---------- \uc2dc\ud2b8(\ud3f0: \uc804\uccb4 \ud654\uba74 / PC: \uac00\uc6b4\ub370 \ud328\ub110) ---------- */\n#dlws-root #dlws-overlay { position: fixed; inset: 0; z-index: 2147483001; display: none; background: var(--scrim); }\n#dlws-root #dlws-overlay.dlws-open { display: block; }\n#dlws-root .dlws-panel { position: relative; display: flex; flex-direction: column; width: 100%; height: 100%; background: var(--bg); }\n@media (min-width: 700px) {\n  #dlws-root .dlws-panel { width: 460px; height: 92vh; margin: 4vh auto 0; border-radius: 18px; overflow: hidden; box-shadow: 0 16px 48px rgba(0, 0, 0, .4); }\n}\n\n#dlws-root .dlws-body { flex: 1 1 auto; overflow-y: auto; overscroll-behavior: contain; padding: calc(8px + env(safe-area-inset-top, 0px)) 16px 24px; }\n\n/* ---------- \uba38\ub9ac\ub9d0 ---------- */\n#dlws-root .dlws-ph { display: flex; align-items: center; justify-content: space-between; margin: 6px 0 12px; }\n#dlws-root .dlws-ph h1 { margin: 0; font-size: 22px; font-weight: 700; line-height: 1.3; color: var(--ink); }\n#dlws-root .dlws-ph h1 small { margin-left: 8px; font-size: 13px; font-weight: 400; color: var(--faint); }\n#dlws-root .dlws-x, #dlws-root .dlws-clear { width: 36px; height: 36px; padding: 0; border: 0; background: none; display: grid; place-items: center; color: var(--faint); cursor: pointer; border-radius: 50%; }\n#dlws-root .dlws-x svg { width: 22px; height: 22px; }\n#dlws-root .dlws-clear svg { width: 16px; height: 16px; }\n\n#dlws-root .dlws-field { display: flex; align-items: center; background: var(--surface); border-radius: 12px; padding: 0 4px 0 12px; margin-bottom: 8px; }\n#dlws-root .dlws-field input {\n  flex: 1; min-width: 0; height: 44px; padding: 0; border: 0; outline: 0; background: none; color: var(--ink);\n  font: inherit; font-size: 16px; /* 16px \ubbf8\ub9cc\uc774\uba74 iOS\uac00 \ud655\ub300\ud55c\ub2e4 */\n}\n#dlws-root .dlws-field input::placeholder { color: var(--faint); }\n#dlws-root .dlws-field input::-webkit-search-cancel-button { display: none; }\n\n#dlws-root .dlws-sec { display: flex; justify-content: space-between; align-items: center; margin: 16px 0 6px; font-size: 12px; color: var(--faint); }\n#dlws-root .dlws-chips { display: flex; gap: 6px; flex-wrap: wrap; }\n#dlws-root .dlws-chip {\n  max-width: 14em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;\n  padding: 5px 11px; border: 1px solid var(--line); border-radius: 999px; background: var(--bg); color: var(--sub); font-size: 12px; cursor: pointer;\n}\n#dlws-root .dlws-linkbtn { border: 0; background: none; padding: 0; color: var(--faint); font-size: 12px; cursor: pointer; }\n\n#dlws-root .dlws-empty { padding: 28px 0; text-align: center; color: var(--faint); font-size: 13px; }\n#dlws-root .dlws-error { margin: 8px 0; padding: 10px 12px; border-radius: 10px; color: #b42318; background: rgba(217, 45, 32, .1); font-size: 13px; }\n#dlws-root .dlws-muted { color: var(--faint); font-size: 12px; }\n#dlws-root .dlws-foot { margin-top: 40px; text-align: center; color: var(--faint); font-size: 12px; }\n\n/* ---------- \uc815\ub82c ---------- */\n#dlws-root .dlws-sorts { display: flex; gap: 6px; margin: -4px 0 6px; }\n#dlws-root .dlws-sorts .dlws-chip { border: 0; color: var(--faint); }\n#dlws-root .dlws-sorts .dlws-chip.on { background: var(--ink); color: var(--bg); }\n#dlws-root .dlws-grp { display: flex; justify-content: space-between; padding: 14px 0 4px; font-size: 13px; font-weight: 600; border-bottom: 1px solid var(--line); }\n#dlws-root .dlws-grp span { font-weight: 400; color: var(--faint); }\n\n/* ---------- \uc791\ud488 \uc904 ---------- */\n#dlws-root .dlws-card { border-bottom: 1px solid var(--line); }\n#dlws-root .dlws-sum { display: flex; align-items: center; gap: 12px; padding: 10px 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }\n#dlws-root .dlws-tw { position: relative; flex: none; }\n#dlws-root .dlws-thumb { display: block; width: 48px; height: 48px; object-fit: cover; border-radius: 8px; background: var(--surface); }\n#dlws-root .dlws-new { display: none; position: absolute; top: -3px; left: -3px; width: 11px; height: 11px; border-radius: 50%; background: var(--red); border: 2px solid var(--bg); }\n#dlws-root .dlws-card.has-news .dlws-new { display: block; }\n#dlws-root .dlws-newslist .dlws-card.has-news .dlws-new { display: none; } /* \uc0c8\uc18c\uc2dd \ud0ed\uc5d0\uc11c\ub294 \uc804\ubd80 \uc0c8\uc18c\uc2dd\uc774\ub77c \uc810\uc774 \ud544\uc694 \uc5c6\ub2e4 */\n#dlws-root .dlws-main { flex: 1; min-width: 0; }\n#dlws-root .dlws-name {\n  font-size: 14px; font-weight: 600; line-height: 1.3; word-break: break-word;\n  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;\n}\n#dlws-root .dlws-card.dlws-open .dlws-name { -webkit-line-clamp: unset; display: block; }\n#dlws-root .dlws-price { margin-top: 3px; font-size: 12px; }\n#dlws-root .dlws-kind { margin-top: 2px; font-size: 11px; color: var(--red); }\n\n#dlws-root .dlws-pl { display: inline-flex; align-items: baseline; gap: 5px; font-variant-numeric: tabular-nums; color: var(--ink); }\n#dlws-root .dlws-pl s { color: var(--faint); }\n#dlws-root .dlws-pl .ar { color: var(--faint); }\n#dlws-root .dlws-pl.reg .now { color: var(--sub); }\n#dlws-root .dlws-pl.big { margin-left: auto; }\n#dlws-root .dlws-pl.big s, #dlws-root .dlws-pl.big .ar { font-size: 12px; }\n#dlws-root .dlws-pl.big .now { font-size: 22px; line-height: 1.2; }\n\n#dlws-root .dlws-lv { flex: none; width: 11px; height: 11px; border-radius: 50%; background: transparent; }\n#dlws-root .dlws-lv.lv-low { background: var(--lv-low); }\n#dlws-root .dlws-lv.lv-cheap { background: var(--lv-cheap); }\n#dlws-root .dlws-lv.lv-avg { background: var(--lv-avg); }\n#dlws-root .dlws-lv.lv-high { background: var(--lv-high); }\n\n/* ---------- \ud3bc\uce68 ---------- */\n#dlws-root .dlws-detail { padding: 0 0 16px; display: grid; gap: 10px; }\n#dlws-root .dlws-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }\n#dlws-root .dlws-tag.ko { background: var(--ink); color: var(--bg); }\n#dlws-root .dlws-tag.mk { background: var(--bg); border: 1px solid var(--line); } /* \uc11c\ud074 \ud0dc\uadf8\ub294 \ud14c\ub450\ub9ac */\n#dlws-root .dlws-tag { padding: 4px 10px; border: 0; border-radius: 999px; background: var(--surface); color: var(--sub); font-size: 12px; cursor: pointer; }\n#dlws-root .dlws-status { display: flex; align-items: center; gap: 8px; }\n#dlws-root .dlws-status .dlws-lv { width: 12px; height: 12px; }\n#dlws-root .dlws-status .lt { font-size: 14px; font-weight: 600; }\n\n#dlws-root .dlws-legend { display: flex; gap: 6px; }\n#dlws-root .dlws-legend button {\n  display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border: 1px solid var(--line); border-radius: 999px;\n  background: var(--bg); color: var(--faint); font-size: 12px; cursor: pointer;\n}\n#dlws-root .dlws-legend button[aria-pressed=\"true\"] { color: var(--ink); border-color: var(--faint); }\n#dlws-root .dlws-legend i { display: inline-block; width: 14px; vertical-align: middle; border-top: 2px solid; }\n#dlws-root .dlws-legend .y0 i { border-color: var(--g0); }\n#dlws-root .dlws-legend .y1 i { border-color: var(--g1); border-top-style: dotted; }\n#dlws-root .dlws-legend .y2 i { border-color: var(--g2); }\n#dlws-root .dlws-chart svg { display: block; width: 100%; height: auto; overflow: visible; }\n#dlws-root .c-grid { stroke: var(--line); stroke-width: .7; }\n#dlws-root .c-mon { fill: var(--faint); font-size: 11px; font-family: inherit; }\n#dlws-root .c-low { stroke: var(--red); stroke-width: .8; opacity: .6; }\n#dlws-root .c-lowt { fill: var(--red); font-size: 11px; font-family: inherit; }\n#dlws-root .c-y0, #dlws-root .c-y1, #dlws-root .c-y2 { fill: none; stroke-linejoin: round; }\n#dlws-root .c-y0 { stroke: var(--g0); stroke-width: 2; }\n#dlws-root .c-y1 { stroke: var(--g1); stroke-width: 1.5; stroke-dasharray: 3 3; }\n#dlws-root .c-y2 { stroke: var(--g2); stroke-width: 1.5; }\n#dlws-root .c-now { fill: var(--g0); }\n\n#dlws-root .dlws-nums { display: flex; justify-content: space-between; font-size: 13px; font-variant-numeric: tabular-nums; }\n#dlws-root .dlws-nums em { font-style: normal; color: var(--sub); margin-right: 4px; }\n#dlws-root .dlws-note { font-size: 12px; color: var(--sub); }\n#dlws-root .dlws-note.warn { color: var(--lv-avg); }\n\n#dlws-root .dlws-acts { display: flex; gap: 8px; }\n#dlws-root .dlws-btn {\n  display: inline-flex; align-items: center; justify-content: center; height: 42px; padding: 0 12px; flex: 1;\n  border: 1px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--sub);\n  font-size: 13px; text-decoration: none; cursor: pointer;\n}\n#dlws-root .dlws-btn.primary { flex: 1.4; background: var(--ink); border-color: var(--ink); color: var(--bg); }\n#dlws-root .dlws-star { flex: 0 0 42px; padding: 0; color: var(--faint); }\n#dlws-root .dlws-star svg { width: 20px; height: 20px; fill: none; }\n#dlws-root .dlws-star[aria-pressed=\"true\"] { color: #d99a00; }\n#dlws-root .dlws-star[aria-pressed=\"true\"] svg { fill: currentColor; }\n#dlws-root .dlws-trow { display: flex; align-items: center; gap: 8px; font-size: 14px; }\n#dlws-root .dlws-tin { flex: 1; min-width: 0; height: 42px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--ink); font: inherit; font-size: 16px; }\n\n#dlws-root .dlws-more { display: block; margin: 16px auto 0; height: 40px; padding: 0 22px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); color: var(--sub); cursor: pointer; }\n\n/* ---------- \ud558\ub2e8 \ud0ed ---------- */\n#dlws-root .dlws-nav { flex: none; display: flex; border-top: 1px solid var(--line); background: var(--bg); padding-bottom: env(safe-area-inset-bottom, 0px); }\n#dlws-root .dlws-nav button { flex: 1; height: 54px; border: 0; background: none; color: var(--faint); font-size: 13px; cursor: pointer; }\n#dlws-root .dlws-nav button.on { color: var(--ink); font-weight: 700; }\n#dlws-root .dlws-badge {\n  display: inline-block; min-width: 16px; height: 16px; margin-left: 3px; padding: 0 5px; border-radius: 999px; vertical-align: 4px;\n  background: var(--red); color: #fff; font-style: normal; font-weight: 700; font-size: 10px; line-height: 16px; text-align: center;\n}\n\n/* ---------- \uc54c\ub9bc \uc904(\ub418\ub3cc\ub9ac\uae30 \ub4f1) ---------- */\n#dlws-root .dlws-toast {\n  position: absolute; left: 12px; right: 12px; bottom: calc(66px + env(safe-area-inset-bottom, 0px)); z-index: 5;\n  display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-radius: 10px;\n  background: var(--ink); color: var(--bg); font-size: 13px; box-shadow: 0 6px 20px rgba(0, 0, 0, .3);\n}\n#dlws-root .dlws-toast button { border: 0; background: none; color: inherit; font-weight: 700; text-decoration: underline; cursor: pointer; white-space: nowrap; }\n\n/* ---------- \ubc31\uc5c5 ---------- */\n#dlws-root .dlws-backup { margin-top: 28px; font-size: 12px; color: var(--faint); }\n#dlws-root .dlws-backup summary { cursor: pointer; }\n#dlws-root .dlws-backup[open] { display: grid; gap: 8px; }\n#dlws-root .dlws-memo { width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; resize: vertical; background: var(--surface); color: var(--ink); font: inherit; font-size: 16px; }\n\n@media (prefers-reduced-motion: no-preference) {\n  #dlws-root .dlws-detail:not([hidden]) { animation: dlws-open .16s ease-out; }\n  @keyframes dlws-open { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }\n}\n\n/* \ud654\uba74 \ubc16 \uc904\uc740 \ubc30\uce58 \uacc4\uc0b0\uc744 \uac74\ub108\ub6f4\ub2e4(\uc990\uaca8\ucc3e\uae30\uac00 \ub9ce\uc744 \ub54c \uc5f4\uae30\u00b7\uc815\ub82c\uc774 \ub290\ub824\uc9c0\uc9c0 \uc54a\uac8c) */\n#dlws-root .dlws-card:not(.dlws-open) { content-visibility: auto; contain-intrinsic-size: auto 69px; }\n\n/* ---------- \uac80\uc0c9 \ud544\ud130 \uce69 \u00b7 \uc811\ud78c \uc694\uc57d \uc904 ---------- */\n#dlws-root .dlws-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 0 0 6px; }\n#dlws-root .dlws-fc { padding: 5px 11px; border: 1px solid var(--line); border-radius: 999px; background: var(--bg); color: var(--faint); font-size: 12px; cursor: pointer; }\n#dlws-root .dlws-fc.on { background: var(--ink); border-color: var(--ink); color: var(--bg); }\n#dlws-root .dlws-filters .sep { width: 1px; height: 16px; background: var(--line); }\n/* \ub192\uc774 0\uc9dc\ub9ac \ub9c9\ub300\uae30\uc5d0 \uc694\uc57d \uc904\uc744 \ub9e4\ub2ec\uc544\uc11c, \ub098\ud0c0\ub098\ub3c4 \uc544\ub798 \ubaa9\ub85d\uc774 \ubc00\ub9ac\uc9c0 \uc54a\uac8c \ud55c\ub2e4 */\n#dlws-root .dlws-fstick { position: sticky; top: calc(-8px - env(safe-area-inset-top, 0px)); z-index: 3; height: 0; margin: 0 -16px; }\n#dlws-root .dlws-fsum {\n  display: flex; justify-content: space-between; width: 100%; padding: calc(10px + env(safe-area-inset-top, 0px)) 16px 10px; border: 0; border-bottom: 1px solid var(--line);\n  background: var(--bg); color: var(--sub); font-size: 12px; text-align: left; cursor: pointer;\n}\n");

  // ---- background.js (그대로) ----
// DLsite 검색/상품 JSON을 대신 가져오는 서비스 워커.
// content script는 CORS 때문에 dlsite.com을 직접 못 부르므로 여기서 호스트 권한으로 fetch 한다.

const SITES = {
  maniax: { path: "maniax", sex: "male" },     // 18禁 同人
  girls: { path: "girls", sex: null },         // 乙女向け(18禁+전연령 함께 나옴)
  bl: { path: "bl", sex: null },               // BL(sex_category/gay를 붙이면 결과가 0건이 된다)
  home: { path: "home", sex: null },           // 全年齢
};

const ORDERS = ["trend", "release_d", "dl_d"];
const PER_PAGE = 30;

const TYPES = { audio: "audio", comic: "comic" }; // DLsite work_type_category 값(보이스·ASMR / 만화)

function searchUrl(site, kind, query, order, page, type, sale) {
  const s = SITES[site] || SITES.maniax;
  const key = kind === "cv" ? "keyword_creater" : kind === "maker" ? "keyword_maker_name" : "keyword";
  const sexPart = s.sex ? `/sex_category%5B0%5D/${s.sex}` : "";
  const ord = ORDERS.includes(order) ? order : "trend";
  const typePart = TYPES[type] ? `/work_type_category%5B0%5D/${TYPES[type]}` : "";
  const salePart = sale ? "/campaign/campaign" : ""; // 세일 중인 작품만(확인: 성우 검색 1945건 → 954건, 첫 30건 전부 세일)
  return (
    `https://www.dlsite.com/${s.path}/fsr/ajax/=/language/jp${sexPart}${typePart}${salePart}` +
    `/${key}/${encodeURIComponent(query).replace(/%20/g, "+")}` + // 경로 속 %20(띄어쓰기)은 DLsite가 403으로 막는다
    `/order%5B0%5D/${ord}/per_page/${PER_PAGE}/page/${page}/from/fs.header`
  );
}

// DLsite가 막으면(429·503은 바로, 403은 3번 연속) 30분 동안 요청을 멈춘다. 응답이 20초 넘게 없으면 끊는다.
const COOL_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 20000;
let hit403 = 0;
async function dlsiteFetch(url, opts) {
  const { dlsPause = 0 } = await chrome.storage.local.get(["dlsPause"]); // 서비스 워커가 다시 켜져도 기억하게 저장소에 둔다
  if (Date.now() < dlsPause) throw new Error("DLsite가 요청을 막아서 잠시 쉬는 중이에요(최대 30분).");
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, Object.assign({}, opts, { signal: ctl.signal }));
  } catch (e) {
    throw new Error(e && e.name === "AbortError" ? "DLsite 응답 시간이 초과됐어요." : "DLsite 연결에 실패했어요.");
  } finally {
    clearTimeout(to);
  }
  if (res.status !== 403) hit403 = 0;
  if (res.status === 429 || res.status === 503 || (res.status === 403 && ++hit403 >= 3)) {
    hit403 = 0;
    chrome.storage.local.set({ dlsPause: Date.now() + COOL_MS });
  }
  return res;
}

// 검색 결과 HTML은 content script에서 DOMParser로 파싱한다(서비스 워커에는 DOMParser가 없음).
async function runSearch({ site, kind, query, order, page, workType, sale }) {
  const res = await dlsiteFetch(searchUrl(site, kind, query, order, page || 1, workType, sale), {
    credentials: "include",
    headers: { "X-Requested-With": "XMLHttpRequest" },
  });
  if (!res.ok) throw new Error(`DLsite 검색 응답 오류 (${res.status})`);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(
      "DLsite가 JSON이 아닌 응답을 줬어요. www.dlsite.com에 한 번 접속해서 성인 인증을 해주세요."
    );
  }
  return {
    html: json.search_result || "",
    count: (json.page_info && json.page_info.count) || 0,
    perPage: PER_PAGE,
  };
}

// 여러 작품의 지금 가격만 한 번에(최대 50개). DLsite 목록 화면이 쓰는 주소라 층(girls·maniax 등)과 상관없이 온다.
// 가격·세일 여부만 있고 성우·서클 이름은 없어서 상세는 아래 runProduct로 받는다.
async function runPrices({ ids }) {
  const res = await dlsiteFetch(
    `https://www.dlsite.com/girls-touch/product/info/ajax?product_id=${ids.map(encodeURIComponent).join(",")}`,
    { credentials: "include", headers: { "X-Requested-With": "XMLHttpRequest" } }
  );
  if (!res.ok) throw new Error(`DLsite 가격 응답 오류 (${res.status})`);
  const j = await res.json();
  const out = {};
  for (const id of ids) {
    const w = j && j[id];
    if (w && typeof w.price === "number" && w.official_price) // 없는 품번은 빠져서 오고, 정가 0은 정보가 없는 작품
      out[id] = { price: w.price, regularPrice: w.official_price, onSale: !!w.is_discount };
  }
  return out;
}

// 작품 한 건의 상세(성우, 가격 등). 가격만 필요하면 runPrices로 묶어서 받는다.
async function runProduct({ site, id }) {
  // 선택한 사이트에 없는 작품(예: 여성향 작품을 18禁에서 조회)이면 다른 사이트도 차례로 시도한다.
  const order = [site, ...Object.keys(SITES).filter((k) => k !== site)].filter((k) => SITES[k]);
  let w = null;
  let lastStatus = 0;
  for (const key of order) {
    const res = await dlsiteFetch(
      `https://www.dlsite.com/${SITES[key].path}/api/=/product.json?workno=${encodeURIComponent(id)}`,
      { credentials: "include" }
    );
    lastStatus = res.status;
    if (!res.ok) continue;
    let arr;
    try {
      arr = await res.json();
    } catch (e) {
      continue;
    }
    const cand = Array.isArray(arr) ? arr[0] : arr;
    if (cand && (cand.workno || cand.product_id)) {
      w = cand;
      break;
    }
  }
  if (!w) {
    if (lastStatus && lastStatus >= 500) throw new Error(`상품 정보 오류 (${lastStatus})`);
    return null;
  }
  const cv = ((w.creaters && w.creaters.voice_by) || []).map((x) => x.name);
  const authors = ((w.creaters && w.creaters.created_by) || []).map((x) => x.name);
  return {
    id: w.workno || id,
    name: w.work_name,
    maker: w.maker_name,
    cv,
    authors,
    price: w.price,
    regularPrice: w.official_price || w.regular_price || w.price,
    rate: w.discount_rate || 0,
    onSale: !!w.is_discount_work,
    type: w.work_type_string,
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const job =
    msg && msg.type === "search"
      ? runSearch(msg)
      : msg && msg.type === "product"
      ? runProduct(msg)
      : msg && msg.type === "prices"
      ? runPrices(msg)
      : null;
  if (!job) return false;
  job.then((data) => sendResponse({ ok: true, data })).catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
  return true; // 비동기 응답
});

  // ---- content.js (그대로) ----
// dlwatcher.com 위에 품번 / 링크 / 제목 / 성우 통합 검색 + 즐겨찾기 + 새소식 화면을 얹는 content script.
(() => {
  if (window.__dlwsLoaded) return;
  window.__dlwsLoaded = true;

  const ORDER_LABEL = { trend: "인기순", release_d: "신작순", dl_d: "DL순" };
  const CODE_ANY = /(?:RJ|BJ|VJ|RE|VE)\d{6,8}/i; // 링크·공유 문구 속 품번
  const CODE_DIGITS = /^\d{6,8}$/;
  const CONCURRENCY = 1; // dlwatcher 서버 부담을 줄이려고 작품 정보는 한 번에 하나씩 받는다
  const CACHE_TTL = 6 * 3600 * 1000;
  const LIVE_TTL = 10 * 60 * 1000;
  const LIVE_BATCH = 50; // DLsite 가격 묶음 요청 한 번에 보낼 작품 수
  const CACHE_KEEP = 100; // 즐겨찾기가 아닌 작품은 최근 것만 저장(폰에서 저장이 느려지지 않게)
  const HISTORY_MAX = 12;
  const FAV_TTL = 60 * 60 * 1000; // 즐겨찾기 가격 확인은 1시간 이내 기록이면 다시 받지 않는다
  const FAV_GAP = 30 * 60 * 1000; // 화면을 열 때 마지막 확인이 이보다 오래됐으면 다시 확인
  const CACHE_KEY = "dlws_cache6"; // 데이터 모양이 바뀌면 키를 올려서 옛 캐시를 버린다
  const SEARCH_FLOORS = ["girls", "bl"]; // 여성향·BL만 검색(각 층에 18禁·전연령이 같이 나온다)
  const FAV_SORTS = { score: "점수", cv: "성우", saved: "저장순" };
  const TABS = { search: "검색", favs: "즐겨찾기", news: "새소식" };
  const FONT_CSS = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

  const blank = () => ({ items: [], count: 0, page: 0, loading: false, error: null });
  const state = {
    open: false,
    site: "girls", // 작품 정보를 DLsite에서 찾을 때 먼저 볼 층
    order: "trend",
    tab: "search", // search | favs | news
    query: "",
    mode: "none", // 검색 탭 안의 상태: none | code | text
    seq: 0,
    res: {}, // "층:종류" -> 검색 결과(blank 모양)
    code: null,
    history: [],
    favSort: "score",
    floors: ["girls"], // 검색할 층: girls(HL) / bl(BL), 하나 이상 켜 둔다
    type: "audio", // "audio"(보이스) / "comic"(만화) / ""(전체)
    sale: true, // 세일 중인 작품만
    yearsOn: { y1: false, y2: false }, // 그래프에서 지난해(y1)·재작년(y2)을 켰는지. 올해(y0)는 항상 보인다
    favs: {}, // id -> { id, name, maker, thumb, note, addedAt, price, regular, target, seen:{low,sale,hit,price} }
  };

  /* ---------- 유틸 ---------- */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      el.append(k.nodeType ? k : document.createTextNode(String(k)));
    }
    return el;
  }
  // replaceChildren(null)은 "null" 글자를 넣어버리므로 빈 값은 걸러서 쓴다
  function setKids(el, ...kids) {
    el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  }
  const txt = (el) => (el ? el.textContent.trim().replace(/\s+/g, " ") : "");
  const yenFmt = new Intl.NumberFormat("ja-JP"); // toLocaleString은 호출마다 포맷터를 새로 만들어 느리다
  const num = (n) => yenFmt.format(Number(n));
  const yen = (n) => num(n) + "円";
  const yearFrac = (d) => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / 864e5 / 365;

  function send(msg) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(msg, (r) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (!r) return reject(new Error("응답이 없어요."));
          r.ok ? resolve(r.data) : reject(new Error(r.error));
        });
      } catch (e) {
        reject(new Error("확장프로그램이 갱신됐어요. 페이지를 새로고침해 주세요."));
      }
    });
  }

  function thumbFromId(id) {
    const m = id.match(/^([A-Z]{2})(\d+)$/);
    if (!m) return "";
    const len = m[2].length;
    const folder = m[1] + String(Math.ceil(parseInt(m[2], 10) / 1000) * 1000).padStart(len, "0");
    return `https://img.dlsite.jp/resize/images2/work/doujin/${folder}/${id}_img_main_240x240.jpg`;
  }
  const dlsiteUrl = (id) => `https://www.dlsite.com/${state.site}/work/=/product_id/${id}.html`;

  /* ---------- 저장소 ---------- */
  const cache = new Map(); // id -> { t, d }
  let cacheTimer = null;

  function savePrefs() {
    chrome.storage.local.set({ dlws_prefs: { order: state.order, favSort: state.favSort, yearsOn: state.yearsOn, floors: state.floors, type: state.type, sale: state.sale } });
  }
  function saveHistory() {
    chrome.storage.local.set({ dlws_history: state.history });
  }
  function saveFavs() {
    chrome.storage.local.set({ dlws_favs: state.favs });
  }
  const favCount = () => Object.keys(state.favs).length;

  let toastTimer = null;
  function toast(msg, actionLabel, onAction) {
    if (!els.toast) return;
    clearTimeout(toastTimer);
    setKids(
      els.toast,
      h("span", null, msg),
      actionLabel ? h("button", { type: "button", onclick: () => ((els.toast.hidden = true), onAction && onAction()) }, actionLabel) : null
    );
    els.toast.hidden = false;
    toastTimer = setTimeout(() => (els.toast.hidden = true), 5000);
  }
  function scheduleCacheSave() {
    clearTimeout(cacheTimer);
    cacheTimer = setTimeout(() => {
      // 즐겨찾기 작품은 오래돼도 남겨 둔다(정렬·새소식 비교에 쓰이므로).
      const all = [...cache.entries()];
      const others = all.filter((e) => !state.favs[e[0]]).sort((a, b) => b[1].t - a[1].t).slice(0, CACHE_KEEP);
      const entries = all.filter((e) => state.favs[e[0]]).concat(others);
      chrome.storage.local.set({ [CACHE_KEY]: Object.fromEntries(entries) });
    }, 1500);
  }
  function pushHistory(q) {
    state.history = [q, ...state.history.filter((x) => x !== q)].slice(0, HISTORY_MAX);
    saveHistory();
  }

  /* 최근 1년 세일 평균가: 그래프에서 세일 중이던 구간만 시간 가중 평균으로 계산한다. */
  function avgSalePrice(graph, base, regular) {
    const now = new Date();
    const nowG = now.getFullYear() - base + yearFrac(now);
    const start = nowG - 1;
    const g = graph.slice().sort((a, b) => a.x - b.x);
    let w = 0;
    let t = 0;
    for (let i = 1; i < g.length; i++) {
      const a = g[i - 1];
      const b = g[i];
      const x0 = Math.max(a.x, start);
      const x1 = Math.min(b.x, nowG);
      if (x1 <= x0) continue;
      const span = b.x - a.x || 1;
      const ya = a.y + (b.y - a.y) * ((x0 - a.x) / span);
      const yb = a.y + (b.y - a.y) * ((x1 - a.x) / span);
      if (ya < 0.999 && yb < 0.999) {
        w += ((ya + yb) / 2) * (x1 - x0);
        t += x1 - x0;
      }
    }
    return t > 0 && regular ? Math.round((w / t) * regular) : null;
  }

  /* ---------- 작품 정보: dlwatcher(가격 추이·성우) → 없으면 DLsite ---------- */
  function parseDlw(j) {
    const gs = (j.priceLogGraph && j.priceLogGraph.graphs) || {};
    const keys = Object.keys(gs).map(Number).filter((y) => y > 2000).sort((a, b) => a - b);
    const base = keys.length ? keys[0] : new Date().getFullYear();
    const graph = [];
    const years = {}; // 연도 -> [{x: 0~1(연중 위치), y: 정가 대비 비율}]
    for (const y of keys) {
      const pts = ((gs[y] && gs[y].points) || []).map((p) => ({ x: parseFloat(p.x), y: parseFloat(p.y) })).filter((p) => isFinite(p.x) && isFinite(p.y));
      years[y] = pts;
      for (const p of pts) graph.push({ x: y - base + p.x, y: p.y });
    }
    const cp = j.currentPrice || {};
    const low = j.lowestPrice && j.lowestPrice.priceInfo;
    return {
      tracked: true,
      id: j.productId,
      name: j.productName,
      maker: j.makerName,
      thumb: j.imageURL240,
      url: typeof j.storeDisplayURL === "string" && j.storeDisplayURL.startsWith("https://www.dlsite.com/") ? j.storeDisplayURL : null, // 작품이 있는 층(girls 등) 주소
      cv: (j.creators || []).filter((c) => c.role === "声優").map((c) => c.name),
      authors: (j.creators || []).filter((c) => c.role === "作者").map((c) => c.name),
      price: cp.price,
      regular: cp.regularPrice,
      rate: cp.discountRate,
      features: j.featuresList || [],
      lowest: low ? { price: low.price, rate: low.discountRate } : null,
      ko: ((j.editions || []).find((e) => e && e.label === "韓国語" && e.productId && e.productId !== j.productId) || {}).productId || null, // 한국어판 품번
      years,
      avgSale: avgSalePrice(graph, base, cp.regularPrice),
    };
  }

  async function fetchInfo(id) {
    try {
      const r = await window.fetch(`/product/${id}.json`);
      if (r.ok) {
        // 없는 품번은 404 HTML이 오기도 하므로 JSON 파싱 실패 = dlwatcher에 없는 작품으로 본다
        const j = JSON.parse(await r.text());
        if (j && j.productId) return parseDlw(j);
      }
    } catch (e) {
      /* dlwatcher에 없는 작품이거나 일시 오류 → DLsite로 대체 */
    }
    const d = await send({ type: "product", site: state.site, id });
    if (!d) return null;
    return {
      tracked: false, id: d.id, name: d.name, maker: d.maker, thumb: thumbFromId(d.id),
      cv: d.cv, authors: d.authors || [], price: d.price, regular: d.regularPrice, rate: d.rate, features: [], lowest: null, years: {}, avgSale: null,
    };
  }

  // 검색 결과 카드용(우선)과 즐겨찾기 확인용 대기열을 따로 둔다. 새 검색은 검색용만 비운다.
  const qSearch = [];
  const qFav = [];
  const inflight = new Map(); // 같은 작품을 동시에 두 번 받지 않는다
  let running = 0;
  function getInfo(id, o = {}) {
    const c = cache.get(id);
    if (c && Date.now() - c.t < (o.maxAge == null ? CACHE_TTL : o.maxAge)) return Promise.resolve(c.d);
    const cur = inflight.get(id);
    if (cur) return cur.then(null, (e) => (e && e.cancelled ? getInfo(id, o) : Promise.reject(e)));
    const p = new Promise((resolve, reject) => {
      (o.fav ? qFav : qSearch).push({ id, resolve, reject });
      pump();
    });
    inflight.set(id, p);
    const clear = () => {
      if (inflight.get(id) === p) inflight.delete(id);
    };
    p.then(clear, clear);
    return p;
  }
  function cancelSearchQueue() {
    for (const j of qSearch.splice(0)) j.reject(Object.assign(new Error("cancelled"), { cancelled: true }));
  }
  function pump() {
    while (running < CONCURRENCY && (qSearch.length || qFav.length)) {
      const job = qSearch.shift() || qFav.shift();
      running++;
      fetchInfo(job.id)
        .then((d) => {
          if (d) {
            cache.set(job.id, { t: Date.now(), d });
            scheduleCacheSave();
          }
          job.resolve(d);
        })
        .catch(job.reject)
        .finally(() => {
          running--;
          pump();
        });
    }
  }
  const infoStale = (id) => {
    const c = cache.get(id);
    return c ? c.d : null;
  };

  // DLsite 현재가는 잠깐 모았다가 50개씩 한 번에 받는다(새소식 30개면 요청 1건). 실패하면 null(현재가 확인만 건너뜀).
  const live = new Map();
  const liveWait = new Map(); // id -> 기다리는 resolve 목록
  let liveTimer = null;
  let liveBusy = false;
  function getLive(id) {
    const c = live.get(id);
    if (c && Date.now() - c.t < LIVE_TTL) return Promise.resolve(c.d);
    return new Promise((resolve) => {
      if (!liveWait.has(id)) liveWait.set(id, []);
      liveWait.get(id).push(resolve);
      if (!liveTimer && !liveBusy) liveTimer = setTimeout(flushLive, 50);
    });
  }
  async function flushLive() {
    liveTimer = null;
    liveBusy = true;
    while (liveWait.size) {
      const ids = [...liveWait.keys()].slice(0, LIVE_BATCH);
      const waits = ids.map((id) => {
        const w = liveWait.get(id);
        liveWait.delete(id);
        return w;
      });
      let got = {};
      try {
        got = (await send({ type: "prices", ids })) || {};
      } catch (e) {
        /* 쉬는 중이거나 일시 오류 */
      }
      ids.forEach((id, i) => {
        const d = got[id] || null;
        if (d) live.set(id, { t: Date.now(), d });
        for (const r of waits[i]) r(d);
      });
    }
    liveBusy = false;
  }

  /* ---------- 점수: 동그라미 색 4단계 ----------
     세일 중일 때만 매긴다. 평균 = 최근 1년 세일 평균가. 평균 ±5%는 "평균 수준". */
  const LEVELS = { low: "역대 최저", cheap: "평균보다 쌈", avg: "평균 수준", high: "평균보다 비쌈" };
  const LEVEL_RANK = { low: 0, cheap: 1, avg: 2, high: 3 };
  function level(info) {
    if (!info || !info.tracked || !(info.price < info.regular)) return null;
    const low = info.lowest && info.lowest.price;
    if (low != null && info.price <= low) return "low";
    const a = info.avgSale;
    if (!a) return null;
    if (info.price < a * 0.95) return "cheap";
    if (info.price > a * 1.05) return "high";
    return "avg";
  }
  const lvDot = (lv) => h("i", { class: "dlws-lv" + (lv ? " lv-" + lv : ""), "aria-label": lv ? LEVELS[lv] : null });

  /* ---------- 가격 그래프: 연도 겹침(가로 1~12월) ---------- */
  function yearSeries(info) {
    const now = new Date();
    const cy = now.getFullYear();
    const out = [];
    for (const [i, y] of [cy, cy - 1, cy - 2].entries()) {
      const pts = (info.years && info.years[y]) || [];
      if (!pts.length) continue;
      const end = i === 0 ? yearFrac(now) : 1;
      const s = pts.filter((p) => p.x <= end).sort((a, b) => a.x - b.x);
      const prev = info.years[y - 1];
      if ((!s.length || s[0].x > 0) && prev && prev.length) s.unshift({ x: 0, y: prev[prev.length - 1].y });
      if (!s.length) continue;
      if (s[s.length - 1].x < end) s.push({ x: end, y: s[s.length - 1].y });
      out.push({ year: y, cls: "y" + i, pts: s });
    }
    return out;
  }
  // 올해 기록이 없으면 가장 최근 해를 대신 보여준다.
  const yearShown = (sr, series) => sr.cls === "y0" || state.yearsOn[sr.cls] || (!series.some((x) => x.cls === "y0") && sr === series[0]);
  function yearChart(info, series) {
    const W = 330;
    const L = 10;
    const PW = 310;
    const T = 6;
    const PH = 90;
    const lowRatio = info.lowest && info.regular ? info.lowest.price / info.regular : 1;
    const minR = Math.min(lowRatio, 0.9, ...series.flatMap((s) => s.pts.map((p) => p.y)));
    const rLow = Math.max(0, minR - 0.08);
    const X = (x) => L + x * PW;
    const Y = (r) => T + ((1 - Math.min(1, r)) / (1 - rLow)) * PH;
    const f = (n) => n.toFixed(1);
    let s = "";
    for (let m = 0; m <= 12; m++) s += `<line class="c-grid" x1="${f(X(m / 12))}" x2="${f(X(m / 12))}" y1="${T}" y2="${T + PH}"/>`;
    for (let m = 0; m < 12; m++) s += `<text class="c-mon" x="${f(X((m + 0.5) / 12))}" y="${T + PH + 16}" text-anchor="middle">${m + 1}</text>`;
    if (info.lowest) {
      const ly = f(Y(lowRatio));
      s += `<line class="c-low" x1="${L}" x2="${L + PW}" y1="${ly}" y2="${ly}"/>`;
      // 연말 세일 선과 겹치지 않게 왼쪽 위에 적는다
      s += `<text class="c-lowt" x="${L + 4}" y="${f(Y(lowRatio) - 4)}">최저 ${num(info.lowest.price)}</text>`;
    }
    // 눈금 범위는 꺼진 연도까지 포함해서 정한다(켜고 끌 때 그래프가 출렁이지 않게).
    for (const sr of series.slice().reverse()) {
      if (!yearShown(sr, series)) continue;
      s += `<polyline class="c-${sr.cls}" points="${sr.pts.map((p) => `${f(X(p.x))},${f(Y(p.y))}`).join(" ")}"/>`;
    }
    const cur = series.find((x) => x.cls === "y0");
    if (cur) {
      const p = cur.pts[cur.pts.length - 1];
      s += `<circle class="c-now" cx="${f(X(p.x))}" cy="${f(Y(p.y))}" r="4"/>`;
    }
    return `<svg viewBox="0 0 ${W} ${T + PH + 22}" role="img" aria-label="연도별 가격 추이">${s}</svg>`;
  }

  /* ---------- 검색 결과 파싱 / 검색 ---------- */
  // 번역판: 서클이 "みんなで翻訳"이거나 제목이 【韓国語版】【簡体中文版】처럼 시작한다. 목록에서는 원본만 보여준다.
  const isTranslation = (it) => it.maker === "みんなで翻訳" || /^【[^】]*(?:語|中文)版】/.test(it.name);
  function parseCards(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return [...doc.querySelectorAll("li[data-list_item_product_id]")].map((li) => {
      const id = li.getAttribute("data-list_item_product_id");
      const th = li.querySelector("thumb-with-ng-filter-block");
      const cand = th && th.getAttribute(":thumb-candidates");
      const urls = (cand && cand.match(/\/\/img\.dlsite\.jp\/[^'"\s]+?\.(?:jpg|webp)/g)) || [];
      const pick = urls.find((u) => u.endsWith(".jpg")) || urls[0];
      return {
        id,
        name: txt(li.querySelector(".work_name")),
        maker: txt(li.querySelector(".maker_name")),
        thumb: pick ? "https:" + pick : thumbFromId(id),
        off: parseInt((li.textContent.match(/(\d+)%OFF/) || [])[1] || "0", 10), // 세일이면 할인율(%), 아니면 0
      };
    }).filter((it) => !isTranslation(it));
  }

  // 검색 결과는 (층 × 종류)마다 따로 받는다. 예: "girls:maker" = 여성향 층의 서클 이름 검색
  const bucketsOf = (kinds) => state.floors.flatMap((f) => kinds.map((k) => f + ":" + k));
  async function loadPage(key, page, seq) {
    const b = state.res[key];
    const [site, kind] = key.split(":");
    b.loading = true;
    b.error = null;
    try {
      const r = await send({ type: "search", site, kind, query: state.query, order: state.order, page, workType: state.type, sale: state.sale });
      if (seq !== state.seq) return;
      const items = parseCards(r.html);
      b.items = page === 1 ? items : b.items.concat(items.filter((i) => !b.items.some((x) => x.id === i.id)));
      b.count = r.count;
      b.per = r.perPage || 30;
      b.page = page;
    } catch (e) {
      if (seq === state.seq) b.error = e.message;
    } finally {
      if (seq === state.seq) b.loading = false;
    }
  }
  // 모든 결과를 한 목록으로 합치고 같은 작품은 한 번만 보여준다.
  const buckets = () => Object.values(state.res);
  function mergedItems() {
    const seen = new Set();
    const all = buckets().flatMap((b) => b.items).filter((i) => !seen.has(i.id) && seen.add(i.id));
    return all.map((it, i) => [it, i]).sort((a, b) => (b[0].off || 0) - (a[0].off || 0) || a[1] - b[1]).map((x) => x[0]); // 할인율 높은 순, 세일 아닌 것은 아래(DLsite 순서 유지)
  }
  const canMore = (b) => !b.loading && b.page > 0 && b.page * (b.per || 30) < b.count;
  const hasMore = () => buckets().some(canMore);

  function extractCode(q) {
    const s = q.normalize("NFKC").trim();
    const m = s.match(CODE_ANY);
    if (m) return m[0].toUpperCase();
    if (CODE_DIGITS.test(s)) return "RJ" + s;
    return null;
  }

  // opts.kind: 태그를 눌렀을 때 그 종류만 검색한다("maker" 서클 / "cv" 성우·작가). 없으면 둘 다.
  async function doSearch(raw, opts = {}) {
    const q = (raw || "").trim();
    if (!q) return;
    els.input.value = q;
    els.input.blur();
    state.query = q;
    state.tab = "search";
    pushHistory(q.length > 40 ? q.slice(0, 40) + "…" : q);
    const seq = ++state.seq;
    cancelSearchQueue();
    state.res = {};
    state.code = null;

    const id = extractCode(q);
    if (id) {
      state.mode = "code";
      const c = (state.code = { id, loading: true });
      navPush();
      renderBody();
      try {
        const data = await getInfo(id);
        if (seq !== state.seq) return;
        if (data) c.data = data;
        else c.error = `${id} 작품을 찾지 못했어요.`;
      } catch (e) {
        if (seq !== state.seq) return;
        c.error = e.message;
      }
      c.loading = false;
      renderBody();
      return;
    }

    state.mode = "text";
    const keys = bucketsOf(opts.kind ? [opts.kind] : ["maker", "cv"]);
    for (const k of keys) state.res[k] = Object.assign(blank(), { loading: true });
    navPush();
    renderBody();
    await Promise.all(keys.map((k) => loadPage(k, 1, seq)));
    if (seq !== state.seq) return;
    renderBody();
  }

  async function loadMore() {
    const seq = state.seq;
    const keys = Object.keys(state.res).filter((k) => canMore(state.res[k]));
    if (!keys.length) return;
    for (const k of keys) state.res[k].loading = true;
    renderBody(true);
    await Promise.all(keys.map((k) => loadPage(k, state.res[k].page + 1, seq)));
    if (seq === state.seq) renderBody(true);
  }

  /* ---------- 새소식(최저가 갱신 · 세일 시작 · 목표가 도달) ----------
     즐겨찾기마다 "마지막으로 확인했을 때" 상태(seen)를 저장해 두고, 가격을 다시 받을 때마다 그와 비교한다.
     새소식 탭을 나갈 때 확인 처리한다. 앱/페이지를 열었을 때만 확인한다(푸시 알림 없음). */
  const news = new Map(); // id -> { kinds, price, live, ended }
  const favCheck = { running: false, last: 0 };
  const KIND_TITLE = { low: "최저가 갱신", target: "목표가 도달", sale: "세일 시작" };
  const newsCount = () => {
    let n = 0;
    for (const v of news.values()) if (!v.ended) n++;
    return n;
  };
  const hasNews = (id) => {
    const n = news.get(id);
    return !!n && !n.ended;
  };
  function seenFrom(f, info) {
    return { low: info.lowest ? info.lowest.price : null, sale: info.price < info.regular, hit: f.target != null && info.price <= f.target, price: info.price };
  }
  function evalNews(id, info) {
    const f = state.favs[id];
    if (!f || !info || !info.tracked) return void news.delete(id);
    if (!f.seen) {
      // seen이 없는 즐겨찾기: 지금 상태를 기준으로 삼고 알림은 만들지 않는다.
      f.seen = seenFrom(f, info);
      saveFavs();
      return void news.delete(id);
    }
    const s = f.seen;
    const onSale = info.price < info.regular;
    const low = info.lowest ? info.lowest.price : null;
    const hit = f.target != null && info.price <= f.target;
    let dirty = false;
    if (!onSale && s.sale) ((s.sale = false), (dirty = true)); // 세일이 끝났다가 다시 시작하면 새소식이 되도록
    if (!hit && s.hit) ((s.hit = false), (dirty = true));
    if (dirty) saveFavs();
    const kinds = [];
    if (onSale && low != null && info.price <= low && (s.low == null || info.price < s.low || !s.sale)) kinds.push("low");
    if (hit && !s.hit) kinds.push("target");
    // 평균보다 비싼 세일은 "세일 시작"으로 알리지 않는다.
    if (onSale && !s.sale && !kinds.includes("low") && level(info) !== "high") kinds.push("sale");
    if (!kinds.length) return void news.delete(id);
    const prev = news.get(id);
    const same = prev && prev.price === info.price;
    news.set(id, { kinds, price: info.price, live: same ? prev.live : null, ended: same ? prev.ended : false });
  }
  function ackAll() {
    if (!news.size) return;
    for (const id of [...news.keys()]) {
      const f = state.favs[id];
      const info = infoStale(id);
      if (f && info) f.seen = seenFrom(f, info);
    }
    news.clear();
    saveFavs();
    updateNewsUI();
  }
  function updateNewsUI() {
    const n = newsCount();
    if (els.newsBadge) {
      els.newsBadge.textContent = String(n);
      els.newsBadge.hidden = !n;
    }
    if (els.fabDot) els.fabDot.hidden = !n;
    document.querySelectorAll("#dlws-root .dlws-card").forEach(refreshFav);
  }
  async function checkFavs(force) {
    const ids = Object.keys(state.favs);
    if (!ids.length || favCheck.running) return;
    favCheck.running = true;
    try {
      await Promise.all(
        ids.map((id) =>
          getInfo(id, { fav: true, maxAge: force ? 0 : FAV_TTL })
            .then((info) => info && evalNews(id, info))
            .catch(() => {})
        )
      );
      favCheck.last = Date.now();
    } finally {
      favCheck.running = false;
    }
    updateNewsUI();
    // 새소식이 뜬 작품만 DLsite 현재가로 한 번 더 확인한다(dlwatcher 기록은 이미 끝난 세일일 수 있어서).
    await Promise.all(
      [...news.entries()]
        .filter(([, n]) => !n.live)
        .map(([id]) =>
          getLive(id)
            .then((d) => {
              const cur = news.get(id);
              if (!cur || !d) return;
              cur.live = { price: d.price };
              cur.ended = d.price > cur.price;
            })
            .catch(() => {})
        )
    );
    updateNewsUI();
    rerenderIfIdle();
  }
  function rerenderIfIdle() {
    // 카드를 펼쳐 보거나 입력하는 중에는 화면을 다시 그리지 않는다.
    if (!els.body || (state.tab !== "favs" && state.tab !== "news")) return;
    if (els.body.querySelector(".dlws-open")) return;
    const ae = document.activeElement;
    if (ae && els.body.contains(ae)) return;
    renderBody(true);
  }

  /* ---------- 즐겨찾기 ---------- */
  function refreshFav(el) {
    const id = el.dataset.id;
    const f = state.favs[id];
    el.classList.toggle("is-fav", !!f);
    el.classList.toggle("has-news", hasNews(id));
    const star = el.querySelector(".dlws-star");
    if (star) {
      star.setAttribute("aria-pressed", String(!!f));
      star.setAttribute("aria-label", f ? "즐겨찾기에서 빼기" : "즐겨찾기에 저장");
    }
  }
  function addFav(el, info) {
    const id = el.dataset.id;
    const f = {
      id,
      name: (info && info.name) || el.querySelector(".dlws-name").textContent,
      maker: (info && info.maker) || "",
      thumb: el.querySelector(".dlws-thumb").getAttribute("src") || "",
      note: "",
      addedAt: Date.now(),
      price: info ? info.price : null,
      regular: info ? info.regular : null,
      target: null,
    };
    if (info && info.tracked) f.seen = seenFrom(f, info);
    state.favs[id] = f;
    saveFavs();
    updateNewsUI();
    return f;
  }
  function toggleFav(el) {
    const id = el.dataset.id;
    const cur = state.favs[id];
    if (cur) {
      delete state.favs[id];
      news.delete(id);
      saveFavs();
      updateNewsUI();
      toast("즐겨찾기에서 뺐어요", "되돌리기", () => {
        state.favs[id] = cur;
        saveFavs();
        updateNewsUI();
        if (el.classList.contains("dlws-open") && el.__info) buildDetail(el, el.__info);
      });
    } else {
      addFav(el, el.__info);
      toast("즐겨찾기에 저장했어요");
    }
    if (el.classList.contains("dlws-open") && el.__info) buildDetail(el, el.__info);
  }

  // 목표가: 펼침 화면 아래 버튼 하나. 누르면 입력 줄이 열린다. 즐겨찾기가 아니면 저장도 같이 한다.
  function targetUI(el, info) {
    const id = info.id;
    const btn = h("button", { class: "dlws-btn dlws-tbtn", type: "button" });
    const input = h("input", { class: "dlws-tin", type: "text", inputmode: "numeric", placeholder: "목표가", "aria-label": "목표가(円)", autocomplete: "off" });
    const row = h("div", { class: "dlws-trow", hidden: "" }, input, h("span", null, "円"));
    const paint = () => {
      const t = state.favs[id] && state.favs[id].target;
      btn.textContent = t != null ? `목표가 ${num(t)} ›` : "목표가 설정 ›";
      input.value = t != null ? String(t) : "";
    };
    const setT = (v) => {
      let cur = state.favs[id];
      if (!cur && v == null) return paint();
      if (!cur) cur = addFav(el, info);
      if (cur.target !== v) {
        cur.target = v;
        if (cur.seen) cur.seen.hit = false; // 새로 정한 목표가는 이미 넘었더라도 한 번은 알려준다
        saveFavs();
        evalNews(id, infoStale(id) || info);
        updateNewsUI();
      }
      paint();
    };
    btn.addEventListener("click", () => {
      row.hidden = !row.hidden;
      if (!row.hidden) input.focus();
    });
    input.addEventListener("change", () => {
      const d = input.value.replace(/[^\d]/g, "");
      setT(d ? Math.min(parseInt(d, 10), 9999999) : null);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
        row.hidden = true;
      }
    });
    paint();
    return { btn, row };
  }

  function priceLine(info, big) {
    const sale = info.price < info.regular;
    return h(
      "span",
      { class: "dlws-pl" + (sale ? "" : " reg") + (big ? " big" : "") },
      sale ? [h("s", null, yen(info.regular)), h("span", { class: "ar" }, "→")] : null,
      h("span", { class: "now" }, yen(info.price))
    );
  }

  function buildDetail(el, info) {
    const detail = el.querySelector(".dlws-detail");
    const lv = level(info);
    // 태그: 서클 + (성우가 있으면 성우 전원, 없으면 그림 작가(作者)). 누르면 그 이름으로만 검색한다.
    const tag = (name, kind, cls) => h("button", { class: "dlws-tag" + (cls || ""), type: "button", onclick: (e) => (e.stopPropagation(), doSearch(name, { kind })) }, name);
    const people = info.cv.length ? info.cv : (info.authors || []).filter((n) => n !== info.maker);
    const ko = info.ko ? h("button", { class: "dlws-tag ko", type: "button", onclick: (e) => (e.stopPropagation(), doSearch(info.ko)) }, "한국어판 ›") : null;
    const tags = h("div", { class: "dlws-tags" }, info.maker ? tag(info.maker, "maker", " mk") : null, people.map((n) => tag(n, "cv")), ko);
    const status = h("div", { class: "dlws-status" }, lv ? [lvDot(lv), h("span", { class: "lt" }, LEVELS[lv])] : null, priceLine(info, true));
    const parts = [tags, status];
    let paintChart = null;
    if (info.tracked) {
      const series = yearSeries(info);
      if (series.length) {
        paintChart = () => {
          detail.querySelector(".dlws-chart").innerHTML = yearChart(info, series);
          for (const b of detail.querySelectorAll(".dlws-legend button")) b.setAttribute("aria-pressed", String(yearShown(series.find((x) => x.cls === b.dataset.y), series)));
        };
        const toggleYear = (cls) => {
          if (cls === "y0") return;
          state.yearsOn[cls] = !state.yearsOn[cls];
          savePrefs();
          paintChart();
        };
        parts.push(h("div", { class: "dlws-legend" }, series.map((sr) => h("button", { class: sr.cls, type: "button", "data-y": sr.cls, onclick: (e) => (e.stopPropagation(), toggleYear(sr.cls)) }, h("i"), String(sr.year)))));
        parts.push(h("div", { class: "dlws-chart", "data-svg": "1" }));
      }
      const low = info.lowest && info.lowest.price;
      parts.push(
        h(
          "div",
          { class: "dlws-nums" },
          h("span", null, h("em", null, "최저"), low ? num(low) : "-"),
          h("span", null, h("em", null, "평균"), info.avgSale ? num(info.avgSale) : "-"),
          h("span", null, h("em", null, "정가"), num(info.regular))
        )
      );
    } else {
      parts.push(h("div", { class: "dlws-note" }, "가격 기록 없음"));
    }
    const liveNote = h("div", { class: "dlws-note warn", hidden: "" });
    parts.push(liveNote);
    const star = h("button", { class: "dlws-btn dlws-star", type: "button", onclick: (e) => (e.stopPropagation(), toggleFav(el)) });
    star.innerHTML = ICON_STAR;
    const t = info.tracked ? targetUI(el, info) : null;
    parts.push(
      h("div", { class: "dlws-acts" }, star, t ? t.btn : null, h("a", { class: "dlws-btn primary", href: info.url || dlsiteUrl(info.id), target: "_blank", rel: "noopener" }, "DLsite")),
      t ? t.row : null
    );
    setKids(detail, ...parts);
    if (paintChart) paintChart();
    refreshFav(el);

    // dlwatcher 기록이 이미 끝난 세일일 수 있어서 DLsite 현재가와 다를 때만 알린다.
    if (info.tracked) {
      getLive(info.id)
        .then((d) => {
          if (!liveNote.isConnected || !d || d.price === info.price) return;
          liveNote.textContent = `DLsite 현재가 ${yen(d.price)}`;
          liveNote.hidden = false;
        })
        .catch(() => {});
    }
  }

  function fillCard(el, info) {
    el.__info = info;
    const lv = level(info);
    if (!el.querySelector(".dlws-name").textContent || el.dataset.stub) {
      el.querySelector(".dlws-name").textContent = info.name || info.id;
      const img = el.querySelector(".dlws-thumb");
      if (info.thumb && !img.getAttribute("src")) img.src = info.thumb;
    }
    setKids(el.querySelector(".dlws-price"), priceLine(info, false));
    el.querySelector(".dlws-sum").replaceChild(lvDot(lv), el.querySelector(".dlws-sum > .dlws-lv"));
    refreshFav(el);
    if (el.classList.contains("dlws-open")) buildDetail(el, info);
  }

  function card(item, opts = {}) {
    const img = h("img", { class: "dlws-thumb", loading: "lazy", referrerpolicy: "no-referrer", alt: "" });
    if (item.thumb) img.src = item.thumb;
    img.addEventListener("error", () => {
      const s = img.getAttribute("src") || "";
      if (img.dataset.fb || !s.startsWith("https://img.dlsite.jp")) {
        img.style.visibility = "hidden";
        return;
      }
      img.dataset.fb = "1";
      img.src = s.replace("https://img.dlsite.jp", "/cache/img.dlsite.jp");
    });

    const sum = h(
      "div",
      { class: "dlws-sum", role: "button", tabindex: "0", "aria-expanded": "false" },
      h("div", { class: "dlws-tw" }, img, h("i", { class: "dlws-new" })),
      h("div", { class: "dlws-main" }, h("div", { class: "dlws-name" }, item.name || ""), h("div", { class: "dlws-price" }, h("span", { class: "dlws-muted" }, "…"))),
      lvDot(null)
    );
    const el = h("article", { class: "dlws-card", "data-id": item.id }, sum, h("div", { class: "dlws-detail", hidden: "" }));
    refreshFav(el);

    const toggle = (force) => {
      const open = force != null ? force : !el.classList.contains("dlws-open");
      el.classList.toggle("dlws-open", open);
      el.querySelector(".dlws-detail").hidden = !open;
      sum.setAttribute("aria-expanded", String(open));
      if (open && el.__info) buildDetail(el, el.__info);
    };
    sum.addEventListener("click", () => (toggle(), syncOpenEntry()));
    sum.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target === sum) {
        e.preventDefault();
        toggle();
        syncOpenEntry();
      }
    });

    const load = () =>
      getInfo(item.id, { fav: !!opts.fav })
        .then((info) => {
          if (!el.isConnected) return;
          if (!info) return void setKids(el.querySelector(".dlws-price"), h("span", { class: "dlws-muted" }, "가격 정보 없음"));
          fillCard(el, info);
        })
        .catch((e) => {
          if (e && e.cancelled) return;
          setKids(el.querySelector(".dlws-price"), h("span", { class: "dlws-muted" }, "불러오지 못했어요"));
        });

    if (opts.open) toggle(true);
    const known = opts.fav && infoStale(item.id);
    if (known) fillCard(el, known); // 저장된 값으로 바로 그린다(최신 값은 checkFavs가 따로 받아 온다)
    else if (opts.eager || !io) load();
    else {
      el.__load = load;
      io.observe(el);
    }
    return el;
  }

  /* ---------- 즐겨찾기 정렬 ---------- */
  function favRows() {
    const items = Object.values(state.favs).map((f, i) => ({ f, i, info: infoStale(f.id) }));
    const rank = (x) => {
      const lv = level(x.info);
      if (lv) return LEVEL_RANK[lv];
      return x.info && x.info.tracked ? 4 : 5; // 세일 아님 → 기록 없음
    };
    const rate = (x) => (x.info && x.info.price < x.info.regular ? x.info.rate || 0 : 0);
    const bySaved = (a, b) => b.f.addedAt - a.f.addedAt || b.i - a.i; // 저장 시각이 같으면 나중에 넣은 것이 위
    const byScore = (a, b) => rank(a) - rank(b) || rate(b) - rate(a) || bySaved(a, b);
    if (state.favSort === "saved") return items.sort(bySaved).map((x) => ({ f: x.f }));
    if (state.favSort === "cv") {
      // 작품에 성우가 여러 명이면 즐겨찾기 안에서 가장 많이 겹치는 성우 한 곳에만 넣는다(동률이면 먼저 적힌 성우).
      const cnt = new Map();
      for (const x of items) for (const c of new Set((x.info && x.info.cv) || [])) cnt.set(c, (cnt.get(c) || 0) + 1);
      const groups = new Map();
      for (const x of items) {
        let best = null;
        for (const c of (x.info && x.info.cv) || []) if (best == null || cnt.get(c) > cnt.get(best)) best = c;
        if (!groups.has(best)) groups.set(best, []);
        groups.get(best).push(x);
      }
      const keys = [...groups.keys()].sort((a, b) => (a == null) - (b == null) || groups.get(b).length - groups.get(a).length || String(a).localeCompare(String(b), "ja"));
      const rows = [];
      for (const k of keys) {
        const g = groups.get(k).sort(byScore);
        rows.push({ grp: k == null ? "성우 정보 없음" : k, n: g.length });
        for (const x of g) rows.push({ f: x.f });
      }
      return rows;
    }
    return items.sort(byScore).map((x) => ({ f: x.f }));
  }

  /* ---------- 백업(다른 기기로 옮기기) ---------- */
  function cleanFav(o) {
    if (!o || typeof o.id !== "string" || !/^[A-Z]{2}\d{6,8}$/.test(o.id)) return null;
    const n = (x) => (typeof x === "number" && isFinite(x) ? x : null);
    const f = {
      id: o.id,
      name: String(o.name || "").slice(0, 300),
      maker: String(o.maker || "").slice(0, 200),
      thumb: typeof o.thumb === "string" && /^(https:\/\/|\/)/.test(o.thumb) ? o.thumb : "",
      note: String(o.note || "").slice(0, 300),
      addedAt: n(o.addedAt) || Date.now(),
      price: n(o.price),
      regular: n(o.regular),
      target: n(o.target),
    };
    if (o.seen && typeof o.seen === "object") f.seen = { low: n(o.seen.low), sale: !!o.seen.sale, hit: !!o.seen.hit, price: n(o.seen.price) };
    return f;
  }
  function importFavs(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { added: 0, msg: "데이터를 읽지 못했어요. 내보내기로 만든 글자를 통째로 붙여넣어 주세요." };
    }
    const list = Array.isArray(data) ? data : data && Array.isArray(data.favs) ? data.favs : null;
    if (!list) return { added: 0, msg: "즐겨찾기 데이터가 아니에요." };
    let added = 0;
    let kept = 0;
    for (const raw of list) {
      const f = cleanFav(raw);
      if (!f) continue;
      const cur = state.favs[f.id];
      if (!cur) {
        state.favs[f.id] = f;
        added++;
      } else {
        kept++;
        if (!cur.note && f.note) cur.note = f.note; // 이미 있는 작품은 그대로 두고 빈 값만 채운다
        if (cur.target == null && f.target != null) cur.target = f.target;
      }
    }
    return { added, msg: `${added}개 가져왔어요.` + (kept ? ` ${kept}개는 이미 있어요.` : "") };
  }
  function backupPanel() {
    const ta = h("textarea", { class: "dlws-memo", rows: "3", "aria-label": "백업 데이터" });
    const doExport = () => {
      ta.value = JSON.stringify({ app: "dlws", v: 1, favs: Object.values(state.favs) });
      ta.select();
      let p;
      try {
        p = navigator.clipboard.writeText(ta.value);
      } catch (e) {
        p = Promise.reject(e);
      }
      p.then(
        () => toast("복사했어요"),
        () => toast("복사 권한이 없어요. 위 글자를 직접 복사해 주세요.")
      );
    };
    const doImport = () => {
      const r = importFavs(ta.value);
      toast(r.msg);
      if (r.added) {
        saveFavs();
        renderBody(true);
        checkFavs();
      }
    };
    return h(
      "details",
      { class: "dlws-backup" },
      h("summary", null, "백업"),
      ta,
      h("div", { class: "dlws-acts" }, h("button", { class: "dlws-btn", type: "button", onclick: doExport }, "내보내기"), h("button", { class: "dlws-btn", type: "button", onclick: doImport }, "가져오기"))
    );
  }

  /* ---------- 화면 그리기 ---------- */
  const els = {};
  let io = null;

  function pageHead(title, extra) {
    const close = h("button", { class: "dlws-x", type: "button", "aria-label": "닫기", onclick: () => setOpen(false) });
    close.innerHTML = ICON_X;
    return h("div", { class: "dlws-ph" }, h("h1", null, title, extra != null ? h("small", null, extra) : null), close);
  }

  // 목록이 길어도 화면이 멈추지 않도록 처음 40줄만 바로 그리고 나머지는 프레임마다 나눠서 붙인다.
  const CHUNK = 40;
  let renderSeq = 0;
  function chunked(list, rows, build) {
    list.append(...rows.slice(0, CHUNK).map(build));
    const rest = rows.slice(CHUNK);
    const my = renderSeq;
    const more = () => {
      if (my !== renderSeq || !list.isConnected) return;
      list.append(...rest.splice(0, 30).map(build));
      if (rest.length) requestAnimationFrame(more);
    };
    if (rest.length) requestAnimationFrame(more);
  }
  const favCard = (f) => card({ id: f.id, name: f.name, maker: f.maker, thumb: f.thumb }, { fav: true });

  /* ---------- 검색 필터(HL/BL · 보이스/만화 · 세일) ---------- */
  const filterSummary = () =>
    [state.floors.map((f) => (f === "girls" ? "HL" : "BL")).join("+"), state.type === "audio" ? "보이스" : state.type === "comic" ? "만화" : "전체", state.sale ? "세일" : null].filter(Boolean).join(" · ");
  function changeFilter() {
    savePrefs();
    if (state.query && state.mode === "text") doSearch(state.query); // 같은 검색어를 새 필터로 다시 찾는다
    else renderBody(true);
  }
  function filterChips() {
    const chip = (label, on, fn) => h("button", { class: "dlws-fc" + (on ? " on" : ""), type: "button", "aria-pressed": String(on), onclick: fn }, label);
    const toggleFloor = (f) => () => {
      const has = state.floors.includes(f);
      if (has && state.floors.length === 1) return; // 하나는 켜 둔다
      state.floors = SEARCH_FLOORS.filter((x) => (x === f ? !has : state.floors.includes(x)));
      changeFilter();
    };
    const pickType = (t) => () => ((state.type = state.type === t ? "" : t), changeFilter()); // 켜진 걸 다시 누르면 "전체"
    return h(
      "div",
      { class: "dlws-filters" },
      chip("HL", state.floors.includes("girls"), toggleFloor("girls")),
      chip("BL", state.floors.includes("bl"), toggleFloor("bl")),
      h("i", { class: "sep" }),
      chip("보이스", state.type === "audio", pickType("audio")),
      chip("만화", state.type === "comic", pickType("comic")),
      h("i", { class: "sep" }),
      chip("세일", state.sale, () => ((state.sale = !state.sale), changeFilter()))
    );
  }
  // 칩 줄이 화면 위로 스크롤돼 사라지면 맨 위에 요약 한 줄이 나타난다. 누르면 칩 줄로 돌아간다.
  function filterBar() {
    const chips = filterChips();
    const bar = h("button", { class: "dlws-fsum", type: "button", hidden: "", onclick: () => els.body.scrollTo({ top: 0, behavior: "smooth" }) }, h("span", null, filterSummary()), h("span", null, "변경 ›"));
    const wrap = h("div", { class: "dlws-fstick" }, bar);
    if ("IntersectionObserver" in window) {
      const ob = new IntersectionObserver((en) => (bar.hidden = en[0].isIntersecting || en[0].boundingClientRect.top > 0), { root: els.body });
      ob.observe(chips);
      filterObs = ob;
    }
    return [wrap, chips];
  }

  function renderSearch() {
    // 링크·품번으로 작품 하나를 열 때는 필터(HL/BL·보이스·세일)가 필요 없어서 칩을 숨긴다.
    const nodes = state.mode === "code" ? [els.searchHead] : [els.searchHead, ...filterBar()];
    if (state.mode === "none" || (!state.query && state.mode !== "code")) {
      if (state.history.length) {
        nodes.push(
          h("div", { class: "dlws-sec" }, "최근 검색", h("button", { class: "dlws-linkbtn", type: "button", onclick: () => ((state.history = []), saveHistory(), renderBody()) }, "지우기")),
          h("div", { class: "dlws-chips" }, state.history.map((q) => h("button", { class: "dlws-chip", type: "button", onclick: () => doSearch(q) }, q)))
        );
      }
      return nodes;
    }
    if (state.mode === "code") {
      const c = state.code;
      if (c.loading) return nodes.concat(h("div", { class: "dlws-empty" }, "불러오는 중…"));
      if (c.error) return nodes.concat(h("div", { class: "dlws-error" }, c.error));
      const d = c.data;
      const el = card({ id: d.id, name: "", thumb: d.thumb }, { open: true, eager: true });
      el.dataset.stub = "1";
      return nodes.concat(h("div", { class: "dlws-list" }, el));
    }
    const items = mergedItems();
    const loading = buckets().some((b) => b.loading);
    const err = (buckets().find((b) => b.error) || {}).error;
    if (err) nodes.push(h("div", { class: "dlws-error" }, err));
    if (items.length) nodes.push(h("div", { class: "dlws-list" }, items.map((i) => card(i))));
    else if (loading) nodes.push(h("div", { class: "dlws-empty" }, "검색 중…"));
    else if (!err) nodes.push(h("div", { class: "dlws-empty" }, "결과가 없어요"));
    if (items.length && hasMore()) nodes.push(h("button", { class: "dlws-more", type: "button", onclick: loadMore, disabled: loading ? "" : null }, loading ? "불러오는 중…" : "더 보기"));
    return nodes;
  }

  function renderFavs() {
    const rows = favRows();
    const head = pageHead("즐겨찾기", favCount() ? String(favCount()) : null);
    if (!rows.length) return [head, h("div", { class: "dlws-empty" }, "저장한 작품이 없어요"), backupPanel()];
    const sorts = h(
      "div",
      { class: "dlws-sorts", role: "group", "aria-label": "정렬" },
      Object.entries(FAV_SORTS).map(([k, l]) =>
        h("button", { class: "dlws-chip" + (state.favSort === k ? " on" : ""), type: "button", "aria-pressed": String(state.favSort === k), onclick: () => ((state.favSort = k), savePrefs(), renderBody()) }, l)
      )
    );
    const list = h("div", { class: "dlws-list" });
    chunked(list, rows, (r) => (r.grp != null ? h("div", { class: "dlws-grp" }, r.grp, h("span", null, String(r.n))) : favCard(r.f)));
    return [head, sorts, list, backupPanel()];
  }

  function renderNews() {
    const head = pageHead("새소식");
    const ids = Object.keys(state.favs).filter(hasNews);
    if (!ids.length) return [head, h("div", { class: "dlws-empty" }, "새소식이 없어요")];
    const rank = (id) => {
      const lv = level(infoStale(id));
      return lv ? LEVEL_RANK[lv] : 4;
    };
    ids.sort((a, b) => rank(a) - rank(b));
    const list = h("div", { class: "dlws-list dlws-newslist" });
    chunked(list, ids, (id) => {
      const el = favCard(state.favs[id]);
      const n = news.get(id);
      el.querySelector(".dlws-main").append(h("div", { class: "dlws-kind" }, n.kinds.map((k) => KIND_TITLE[k]).join(" · ")));
      return el;
    });
    return [head, list, h("div", { class: "dlws-foot" }, "탭을 나가면 확인 처리돼요")];
  }

  let filterObs = null;
  function renderBody(keepScroll) {
    const body = els.body;
    if (filterObs) (filterObs.disconnect(), (filterObs = null));
    renderSeq++; // 이전 화면의 이어 그리기를 멈춘다
    const top = body.scrollTop;
    if (io) io.disconnect();
    for (const [k, b] of Object.entries(els.navBtns)) {
      b.classList.toggle("on", state.tab === k);
      b.setAttribute("aria-current", state.tab === k ? "page" : "false");
    }
    const nodes = state.tab === "favs" ? renderFavs() : state.tab === "news" ? renderNews() : renderSearch();
    setKids(body, ...nodes);
    body.scrollTop = keepScroll ? top : 0;
  }

  /* ---------- 뒤로가기 ----------
     폰·PC의 뒤로가기가 사이트 밖(구글 등)으로 바로 나가지 않도록, 화면을 옮길 때마다(검색·탭 이동) 기록을 한 칸씩 쌓고
     뒤로가기가 오면 이전 화면으로 돌아간다. 맨 처음 화면에서 한 번 더 누르면 원래대로 사이트를 나간다. */
  let navDepth = 0;
  let skipPop = 0; // history.go로 일부러 되돌릴 때 생기는 popstate는 무시한다
  const viewNow = () => ({ tab: state.tab, mode: state.mode, query: state.query, res: state.res, code: state.code });
  const baseView = { tab: "search", mode: "none", query: "", res: {}, code: null };
  const views = new Map(); // 기록 번호 -> 화면(결과 목록은 다시 받지 않고 그대로 보여준다)
  let openEntry = null; // 카드를 펼칠 때 쌓은 기록(뒤로가기 = 접기)
  function navPush() {
    if (!state.open) return;
    openEntry = null; // 화면이 바뀌면 펼친 카드 기록은 의미가 없다
    navDepth++;
    views.set(navDepth, viewNow());
    try {
      history.pushState({ dlws: navDepth }, "");
    } catch (e) {
      navDepth--;
    }
  }
  function collapseAll() {
    for (const el of els.body.querySelectorAll(".dlws-card.dlws-open")) {
      el.classList.remove("dlws-open");
      el.querySelector(".dlws-detail").hidden = true;
      el.querySelector(".dlws-sum").setAttribute("aria-expanded", "false");
    }
    openEntry = null;
  }
  // 카드를 처음 펼칠 때 기록을 한 칸 쌓고, 모두 접으면 그 칸을 걷어낸다. 그래서 뒤로가기는 "접기"가 된다.
  function syncOpenEntry() {
    if (!state.open) return;
    const n = els.body.querySelectorAll(".dlws-card.dlws-open").length;
    if (n > 0 && !openEntry) {
      navPush();
      openEntry = { depth: navDepth };
    } else if (n === 0 && openEntry) {
      if (navDepth === openEntry.depth) {
        navDepth--;
        skipPop++;
        history.go(-1);
      }
      openEntry = null;
    }
  }
  const sameView = (v) => v.tab === state.tab && v.mode === state.mode && v.query === state.query && v.res === state.res && v.code === state.code;
  function applyView(v) {
    if (state.tab === "news" && v.tab !== "news") ackAll();
    state.seq++; // 진행 중이던 검색의 늦은 결과가 화면을 덮어쓰지 않게
    cancelSearchQueue();
    Object.assign(state, { tab: v.tab, mode: v.mode, query: v.query, res: v.res, code: v.code });
    els.input.value = v.query;
    renderBody();
    if ((v.tab === "favs" || v.tab === "news") && favCount() && Date.now() - favCheck.last > FAV_GAP) checkFavs();
  }
  function onPop(e) {
    if (skipPop > 0) return void skipPop--;
    const d = e.state && e.state.dlws ? e.state.dlws : 0;
    navDepth = d;
    if (!state.open) return; // 창이 닫혀 있으면 화면은 건드리지 않는다
    const v = d ? views.get(d) || baseView : baseView;
    if (sameView(v) && els.body.querySelector(".dlws-card.dlws-open")) return void collapseAll(); // 같은 화면이면 펼친 카드만 접는다
    applyView(v);
  }
  function unwindNav() {
    // 창을 ✕로 닫을 때 쌓아 둔 기록을 걷어내서, 뒤로가기가 보이지 않는 화면을 거치지 않게 한다.
    if (navDepth > 0) {
      const d = navDepth;
      navDepth = 0;
      skipPop++;
      history.go(-d);
    }
  }

  function setTab(t) {
    if (t !== state.tab) {
      if (state.tab === "news") ackAll(); // 새소식 탭을 나갈 때 확인 처리
      state.tab = t;
      navPush();
    }
    state.tab = t;
    if ((t === "favs" || t === "news") && favCount() && Date.now() - favCheck.last > FAV_GAP) checkFavs();
    renderBody();
    if (t === "search" && state.mode === "none") setTimeout(() => els.input.focus(), 0);
  }

  // auto: 페이지를 열 때 자동으로 열린 경우. 폰에서 키보드가 바로 튀어나오지 않게 입력창에 커서를 넣지 않는다.
  function setOpen(v, auto) {
    if (!v && state.tab === "news") ackAll();
    if (!v) unwindNav();
    state.open = v;
    els.overlay.classList.toggle("dlws-open", v);
    document.documentElement.style.overflow = v ? "hidden" : "";
    if (v && !auto && state.tab === "search" && state.mode === "none") setTimeout(() => els.input.focus(), 0);
    if (v && favCount() && Date.now() - favCheck.last > FAV_GAP) checkFavs();
  }

  function loadFont() {
    // Pretendard(한글). 사이트가 외부 글꼴을 막으면 기본 글꼴로 보인다.
    if (document.getElementById("dlws-font") || !document.head) return;
    document.head.append(h("link", { id: "dlws-font", rel: "stylesheet", href: FONT_CSS, crossorigin: "anonymous" }));
  }

  const ICON_STAR = '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="m12 3.2 2.7 5.6 6.1.8-4.5 4.2 1.2 6-5.5-3-5.5 3 1.2-6L3.2 9.6l6.1-.8Z"/></svg>';
  const ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/></svg>';
  const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  function build() {
    loadFont();
    els.input = h("input", { type: "search", enterkeyhint: "search", placeholder: "링크 · 품번 · 서클 · 성우 · 작가", autocomplete: "off", autocapitalize: "off", spellcheck: "false" });
    const clear = h("button", {
      class: "dlws-clear",
      type: "button",
      "aria-label": "지우기",
      onclick: () => {
        els.input.value = "";
        state.query = "";
        state.mode = "none";
        state.seq++;
        cancelSearchQueue();
        navPush();
        renderBody();
        els.input.focus();
      },
    });
    clear.innerHTML = ICON_X;
    // 검색은 form 제출로 받는다: 폰 키보드의 "검색" 키는 Enter keydown 대신 제출만 보내는 경우가 있다.
    const form = h("form", { class: "dlws-field", action: "#", onsubmit: (e) => (e.preventDefault(), doSearch(els.input.value)) }, els.input, clear);
    els.searchHead = h("div", null, pageHead("검색"), form);

    els.body = h("div", { class: "dlws-body" });
    els.toast = h("div", { class: "dlws-toast", role: "status", hidden: "" });
    els.newsBadge = h("i", { class: "dlws-badge", hidden: "" });
    els.navBtns = {};
    const nav = h(
      "nav",
      { class: "dlws-nav" },
      Object.entries(TABS).map(([k, l]) => (els.navBtns[k] = h("button", { type: "button", onclick: () => setTab(k) }, l, k === "news" ? els.newsBadge : null)))
    );

    const panel = h("div", { class: "dlws-panel", role: "dialog", "aria-label": "DLwatcher 검색" }, els.body, nav, els.toast);
    els.overlay = h("div", { id: "dlws-overlay" }, panel);
    els.overlay.addEventListener("mousedown", (e) => {
      if (e.target === els.overlay) setOpen(false);
    });

    const fab = h("button", { id: "dlws-fab", type: "button", "aria-label": "DLwatcher 검색 열기", onclick: () => setOpen(!state.open) });
    fab.innerHTML = ICON_SEARCH;
    els.fabDot = h("i", { class: "dlws-dot", hidden: "" });
    fab.append(els.fabDot);
    document.documentElement.append(h("div", { id: "dlws-root" }, fab, els.overlay));

    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) =>
          entries.forEach((en) => {
            if (!en.isIntersecting) return;
            io.unobserve(en.target);
            if (en.target.__load) en.target.__load();
          }),
        { root: els.body, rootMargin: "400px 0px" }
      );
    }

    window.addEventListener("popstate", onPop);
    document.addEventListener(
      "keydown",
      (e) => {
        const t = e.target;
        const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
        if (e.key === "Escape" && state.open) setOpen(false);
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          setOpen(true);
        } else if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setOpen(true);
        }
      },
      true
    );

    renderBody();
  }

  async function init() {
    build();
    try {
      const saved = await chrome.storage.local.get(["dlws_prefs", "dlws_history", CACHE_KEY, "dlws_favs"]);
      if (saved.dlws_favs && typeof saved.dlws_favs === "object") state.favs = saved.dlws_favs;
      if (saved.dlws_prefs) {
        if (ORDER_LABEL[saved.dlws_prefs.order]) state.order = saved.dlws_prefs.order;
        if (FAV_SORTS[saved.dlws_prefs.favSort]) state.favSort = saved.dlws_prefs.favSort;
        const pf = saved.dlws_prefs;
        if (Array.isArray(pf.floors) && pf.floors.length && pf.floors.every((f) => SEARCH_FLOORS.includes(f))) state.floors = pf.floors;
        if (pf.type === "" || pf.type === "audio" || pf.type === "comic") state.type = pf.type;
        if (typeof pf.sale === "boolean") state.sale = pf.sale;
        const yo = saved.dlws_prefs.yearsOn;
        if (yo && typeof yo === "object") state.yearsOn = { y1: !!yo.y1, y2: !!yo.y2 };
      }
      if (Array.isArray(saved.dlws_history)) state.history = saved.dlws_history.slice(0, HISTORY_MAX);
      if (saved[CACHE_KEY]) for (const [id, v] of Object.entries(saved[CACHE_KEY])) cache.set(id, v);
      renderBody();
    } catch (e) {
      /* 저장소를 못 읽어도 검색은 동작해야 한다 */
    }
    // dlwatcher 원래 화면은 볼 일이 없어서 들어오자마자 연다(✕로 닫으면 원래 화면). 열 때 즐겨찾기 가격도 확인한다.
    setOpen(true, true);
    // 작품 주소(/product/RJ…, DLsite 도우미의 DLW 버튼)로 들어오면 그 품번을 바로 검색한다
    const pid = /^\/product\//.test(location.pathname) && extractCode(location.pathname);
    if (pid) doSearch(pid);
  }

  init();
})();

})();
