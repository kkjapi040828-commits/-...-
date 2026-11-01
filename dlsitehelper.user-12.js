// ==UserScript==
// @name         DLsite 언어 고정 + 일본 이벤트 + 할인 배너만
// @namespace    dlsite-locale-filter
// @version      0.39.1
// @description  (테스트중: 0.38~0.39 실제 폰 확인 전) 사이트 원래 화면은 그대로 두고: 언어 고정, 이벤트 페이지 자동 일본어, 할인 외 배너 숨김, 목록 할인·쿠폰 필터·성우 표시 (성능·태그 검색 최적화).
// @match        https://www.dlsite.com/*
// @match        https://play.dlsite.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        unsafeWindow
// @run-at       document-start
// @noframes
// ==/UserScript==

/*
 * 구조 (위에서 아래 순서로 실행된다)
 *   1. CONFIG   상수와 설정 기본값. 바꿀 일이 생기면 여기만 고친다.
 *   2. store    설정·캐시 저장(GM 저장소).
 *   3. route    지금 주소가 어떤 페이지인지 판별.
 *   4. locale   언어 쿠키 고정, 이동 직전 쿠키 미리 쓰기.
 *   5. redirect 검색 주소에 조건(할인중, 한국어)을 붙여 한 번만 이동. (쿠폰 대상 페이지에는 할인중 조건을 붙이지 않는다)
 *   5.6 kw      한국어 태그 이름 검색어에 일본어 태그 이름을 '또는'으로 붙임.
 *   6. clean    배너·다른 층·쿠폰 팝업 숨김(원래 화면에서 빼기만 함).
 *   7. list     목록 상단 바(한 줄): ↺ · 층▾ · 언어▾ · 할인▾(할인율·정렬) · 쿠폰▾ · 필터 · 개수(순서·보이기는 설정 '칩'). 사진 아래 줄: 품번 · 쿠폰 · ♥.
 *   7.6 fav     카드 ♥(사이트 즐겨찾기). 7.7 sbox 사이트 검색창 아래 목록(저장한 검색 · 자주 쓰는 태그 · 최근 · 태그 후보).
 *   8. voice    성우: 음성 작품 카드에 있는 이름을 쓰고, 없을 때만 작품 정보를 받아 카드에 붙임.
 *   9. jaFetch  일본어 화면을 받아 일본 할인 배너·이벤트 목록을 만듦.
 *  10. panel    설정 버튼과 바텀 시트 설정 창.
 *  10.5 play    DLsite Play(play.dlsite.com)에서 작품 숨기기(Play 자체 비표시)·품번 띠. Play에서는 이것만 돈다.
 *  11. boot     시작과 화면 변화 감시.
 *
 * 0.39.1
 *   - 묶음 할인 화면에 검색 칩: 글자(한국어 태그 이름이면 일본어도) 또는 태그 후보로 그 묶음 안에서 거름(주소 ?keyword=·?genre[n]=, 사이트가 거름). openBulk.
 *
 * 0.39.0
 *   - 정리안3: 바 맨 앞 ↺(바꾼 게 있을 때)·층 칩(TL·BL × 동인·코믹·드라마)·필터 칩, 칩 순서·보이기 설정. 사진 아래 줄에 품번·쿠폰·♥(즐겨찾기, 누를 때만 요청 1).
 *   - 사이트 검색창을 누르면 저장한 검색·자주 쓰는 태그(☆)·최근, 치면 태그 후보 → 태그 번호로 검색. 정사각형 썸네일·목록 진단 삭제. row·fav·sbox·tags·saved.
 *
 * 0.38.2
 *   - 한국어 태그 이름(또는 '연하 공'의 '연하' 같은 앞말)으로 검색하면 일본어 이름을 '또는'(|)으로 붙여 일본어보다 적게 안 나오게(임신 → 임신|妊娠|孕ませ). kw. 태그 목록 7일에 2번.
 *
 * 0.38.1
 *   - 기본값: 인기순·한국어·할인 없음(saleOnly 기본 끔)·쿠폰 없음. 칩을 짧게 누르면 바꾼 게 있을 땐 기본으로, 기본일 땐 팝업. 꾹 = 언제나 팝업. tapHold.
 *   - 언어 칩은 기본(한국어)과 다를 때만 파란색. 일본어 첫 화면(배너·이벤트) 캐시 30분 → 2시간.
 *
 * 0.38.0
 *   - 할인중·언어를 직접 끄면 그 검색에 기본값(할인중·한국어)을 다시 붙이지 않음(전엔 같은 페이지를 다시 받음). 'TL만' 자동 붙이기·🔍 검색 시트·태그 받기 없앰.
 *   - 성우는 음성 작품 카드의 이름을 씀(작품 정보 요청: 쪽당 최대 30 → 성우가 잘린 카드만). 언어 쿠키 ko-kr도 한국어로 봐서 처음 새로고침 안 함. 중복 코드 정리.
 *
 * 0.37.5
 *   - 브라우저를 껐다 켤 때마다 사이트가 성인 확인을 다시 묻던 것: 전에 '네'를 눌러 adultchecked=1이 남아 있으면 사라진 세션 쿠키(adultchecked_session)만 다시 넣는다. 처음 확인은 직접 눌러야 함. locale.ageSession.
 *
 * 0.37.4
 *   - 일본어 쿠키(KO 버튼 한/일 전환, 이벤트 페이지)일 때 사이트가 '언어 선택' 창을 계속 띄우던 것을 막음: localesuggested=true 쿠키가 없으면 넣는다. locale.suggested.
 *
 * 0.37.3
 *   - 사이트 연령 확인 창이 떠 있는 동안 설정 버튼(KO)을 숨김. 버튼이 창의 '네' 위에 겹쳐 보였음. ageGateHide.
 *
 * 0.37.2
 *   - 한국어 기본으로 이동한 검색(language/jp + options KO_KR)에서 언어 칩이 '한·일'로 보이던 것 고침(사이트는 한국어만 보여 줌). langNow.
 *
 * 0.37.1
 *   - 목록 카드 아래 띠에 품번 표시, 누르면 작품을 열지 않고 품번 복사(초록). 언어를 안 정한 검색은 한국어(+언어 불필요)로(설정 koDefault, 이름·쿠폰 검색 제외). list.deco copier.
 *
 * 0.37.0
 *   - 검색 목록의 할인율(30·50·80%↑)·할인중을 사이트 필터(주소 discount_rates%5B0%5D/c8·c9·c10, campaign/campaign)로. 서버가 거르므로 개수·다음 쪽도 맞음. 70%는 사이트에 없어 80%로.
 *   - 정렬에 신작순·판매순 추가. 사이트가 주소를 order%5B0%5D/cend로 바꿔 정렬이 늘 '인기순'으로 읽히던 것·order가 두 번 붙던 것 고침. pathPairs·pathGet·pathSet.
 *
 * 0.36.3
 *   - CV 이름을 길게 눌러도(링크·이미지 메뉴 대신) 성우 이름만 복사(CV 글자는 안 들어감). copyVa.
 *
 * 0.36.2
 *   - 카드의 'CV 이름'을 누르면 작품을 열지 않고 성우 이름 복사(글자가 잠깐 초록색). list.deco.
 *
 * 0.36.1
 *   - 서클 목록에도 언어 버튼(주소 options[]). 서클은 언어가 없으면 사이트가 일본어로 되돌려서, 다 끄면 네 언어를 다 넣는다. langNow·langPath.
 *
 * 0.36.0
 *   - 목록 위 바: 쿠폰·할인·언어·🔍를 누르면 바 바로 아래 팝업(바깥을 누르면 닫힘). 이모지 대신 선 아이콘, 버튼은 회색 채움·고르면 파란색.
 *   - 할인 팝업 = 할인율(위) + 정렬(할인 개시일·마감 임박·저가·인기, 사이트 정렬). 언어 팝업 = 한·일·간체·번체 여러 개(검색 주소 options[]).
 *   - 이 스크립트의 정렬 창·할인율순·마감순(이 쪽 안에서) 없앰. 고른 것을 다시 누르면 꺼져 기본으로.
 *
 * 0.35.1
 *   - 선택 창(정렬·할인율·쿠폰) 안의 빈 곳(제목 줄)을 눌러도 닫힘. sheet.ensure.
 *
 * 0.35.0
 *   - 정렬 창: 한 줄씩 아이콘과 함께, 사이트 정렬 8개(인기·신작·오래된·판매·평점·리뷰·가격 2, 검색 주소의 order) + 할인율·마감 임박. 꾸욱 끌어 순서 바꿈.
 *   - 목록 위 정렬 버튼에 지금 정렬의 아이콘과 이름. 장바구니 쿠폰 딱지를 표지 왼쪽 아래에 겹침(PC에선 작품 형식 줄에 붙어 있었음).
 *
 * 0.34.0
 *   - Play 버튼 '편집' → '숨기기'. 아래 칸엔 이번에 고른 작품만, 버튼을 꾸욱(0.5초) 누르면 이미 숨긴 작품도 보여 되돌릴 수 있음.
 *   - 버튼을 끌어서 옮김(이 기기에 위치 저장, play.fabPos). 요청 수는 그대로.
 *
 * 0.33.1
 *   - Play 품번 띠를 누르면 작품을 열지 않고 품번 복사(띠가 잠깐 초록색).
 *   - 쿠폰: 작품 정보 요청 중에 쿠폰함이 도착하면 모든 작품이 '쿠폰 없음'으로 6시간 남던 문제(쿠폰 필터를 켜면 다 숨겨짐). checkNow.
 *
 * 0.33.0
 *   - Play 숨기기를 Play 자체 비표시(/api/ignore, 계정에 저장)로: 빈칸·스크롤 튐 없음, 폰·PC 같이. 편집 한 번에 요청 GET 1 + POST·DELETE 각 1 이하.
 *   - 아래 칸 표지·제목은 Play 저장소에서(번역판 표지가 안 뜨던 문제). Play 목록 썸네일마다 품번 띠. 예전 이 기기 숨김은 다음 편집 때 보냄.
 *
 * 0.32.1
 *   - Play 숨기기: 목록에서 숨긴 작품 자리를 빈칸으로 남김. 빼 버리면 스크롤할 때 화면이 위아래로 튀었음('최근 본 작품' 줄은 그대로 뺌).
 *
 * 0.32.0
 *   - Play 숨기기 편집 중: 누른 작품은 목록에서 빠지고 화면 아래 '숨긴 작품' 칸으로(거기서 누르면 되돌림). 저장값에 표지·제목을 같이 저장.
 *
 * 0.31.1
 *   - Play 숨기기: 스크롤하면 숨긴 작품이 잠깐 보였다 사라지던 문제. 카드가 생긴 뒤 숨기지 않고 CSS(:has)로 처음부터 안 그림.
 *
 * 0.31.0
 *   - 차단 목록(설정, 바로가기 아래): 서클·성우·작가 이름이 정확히 같은 작품을 목록에서 숨김(요청 0번).
 *   - 성우·작가·서클 이름 검색(keyword_creater 등)에는 할인중 조건을 자동으로 안 붙임. 설정의 한국어/日本語 버튼 삭제(JA 버튼 탭은 그대로).
 *   - DLsite Play: 오른쪽 아래 '편집'으로 작품 숨기기(이 기기에만 저장, 10.5 play).
 *
 * 0.30.1
 *   - 장바구니 쿠폰 딱지를 썸네일 왼쪽 아래로(왼쪽 위는 사이트 발매 딱지와 겹쳐 지저분했음).
 *
 * 0.30.0
 *   - 카드 오른쪽 위에 쿠폰(1개부터 쓰는 최고율, 2개 이상 조건은 따로)·묶음 할인 딱지. 쿠폰 필터를 꺼도 보임(작품 정보 50개당 1번).
 *   - CV·DLW는 썸네일 아래 어두운 띠로. 세일 마감 배지는 뺌. 안 쓰는 코드(coupon.on, CSS 몇 줄) 정리.
 *
 * 0.29.8
 *   - 쿠폰 대상 페이지(genres/works?genrekey=)를 같은 조건의 검색 화면으로 바꿔 열기(필터를 쓸 수 있게).
 *   - 마감 배지: 무엇이 끝나는지(세일)와 오늘/내일을 두 칸으로. 쿠폰 창은 최고율이 같으면 최저율 높은 쪽이 위.
 *
 * 0.29.7
 *   - 🔍 검색어를 같은 목록 안에서는 쪽을 넘겨도 기억(탭마다). 이벤트 페이지는 다음 쪽이 새로 열려서 검색이 풀렸음.
 *
 * 0.29.6
 *   - 검색창을 ✕나 지우기로 비우면 바로 검색 거르기를 풂(예전엔 🔍를 다시 눌러야 풀려서, 창을 닫으면 지운 검색어로 계속 걸러졌음).
 *
 * 0.29.5
 *   - 서클 페이지(/circle/profile/)와 작품 형식 목록(/works/type/, 예: 만화)도 목록으로 봐서 쿠폰·할인중 바가 뜸.
 *
 * 0.29.4
 *   - DLW 링크를 dlwatcher.com/product/품번으로(예전 ?q=는 그 사이트가 안 받아 첫 화면만 열림).
 *   - 묶음 할인 2쪽 이상에서 필터를 걸면 사이트가 2쪽을 그대로 요청해 404로 멈추던 문제: 누르기 직전 쪽 번호를 1로.
 *
 * 0.29.3
 *   - 장바구니 쿠폰 딱지: 할인율이 제일 큰 쿠폰 하나만, 할인율별 색(50%+ 빨강, 30%+ 주황, 그 아래 파랑), 글자 위아래 가운데.
 *
 * 0.29.2
 *   - PC 장바구니(li._cart_items, .work_thumb)에도 쿠폰 딱지. 폰 화면 구조만 찾아서 PC에선 안 보이던 문제.
 *
 * 0.29.1
 *   - 태그를 한국어+일본어로 저장(작품 정보를 한국어로 받음). 이벤트 페이지에서 받은 태그가 일본어뿐이라 한글 검색(예: 임신)이 안 되던 문제.
 *
 * 0.29.0
 *   - 쿠폰을 켜면 개수를 '대상/이 쪽 · 전체 대상/전체'로(전체는 999 같은 묶음 할인·검색 페이지, 300개 이하만). 장바구니 썸네일에 쓸 수 있는 쿠폰 딱지.
 *   - 일본 한정 이벤트: 날짜 대신 이벤트 이름(배너 alt)과 조건 배지(3개 999엔 등), 마감. 쿠폰 튜토리얼은 뺌.
 *
 * 0.28.2
 *   - 사이트 정렬·필터를 써도 할인중 조건이 안 빠지게: 검색 주소에 할인중이 있으면 사이트 필터 창의 '할인중 작품'을 한 번 켜 둠.
 *
 * 0.28.1
 *   - 쿠폰: 가진 쿠폰을 쿠폰함 데이터에서 자동으로 읽음(6시간에 한 번). Obey Me처럼 이름에 coupon이 없는 쿠폰도 인식.
 *   - 쿠폰 대상 판정: 작품 정보 묶음 주소로 50개씩 한 번에(요청 50번 → 1번). 성우 조회는 0.27.4 방식으로 되돌림.
 *
 * 0.28.0
 *   - 특집 배너(media.vivion-bcs.com 이미지 + 검색 페이지로 가는 링크)도 할인 아니면 숨김. 위 신작 슬라이드는 그대로.
 *   - 쿠폰 필터: 쿠폰 대상 목록 전체(최대 2000개, 요청 수십 번)를 받지 않고, 성우 조회 때 받는 작품 정보의 쿠폰 키로 판정. 확인 전 카드는 보여 둠.
 *
 * 0.27.4
 *   - JA 버튼 위치: 끌어서 옮긴 자리를 화면 비율 대신 px로 저장('fab.xy'의 {l, t}). 화면 폭이 바뀌어도 자리가 안 변함.
 *   - 예전 비율 값({x, y})은 그대로 읽어 쓰고, 다음에 끌면 px 값으로 바뀜.
 *
 * 0.27.3
 *   - 쿠폰 팝업: 검사 기록을 글자 수 기준으로 바꿔 늦게 그려져도 다시 보고, 위로 6단계 제한 대신 글자 수 300자 제한으로 고정 컨테이너를 찾음.
 *   - JA 버튼: 위치 계산 폭을 innerWidth 대신 스크롤바를 뺀 clientWidth로 바꿈.
 *   - 배너 판정: OFF·sale은 단어 단위로, /campaign/tutorial은 제외. isList에 /works/genre/·/works/exclusive 추가.
 *
 * 0.27.2
 *   - 언어 쿠키는 .dlsite.com 도메인 쿠키만 쓰고 host-only 쿠키는 삭제(중복 쿠키 충돌 방지).
 *   - 가격이 늦게 그려지는 카드를 '할인 아님'으로 굳히지 않음. 지연 로딩 자리표시자 이미지는 배너 판정에서 제외.
 *   - 이미지 주소 폴백은 https만 허용. 검색용 텍스트는 검색어가 있을 때만 생성. 쿠폰은 받을 게 있을 때만 요청.
 *   - 태그는 작품당 15개, 태그 캐시 1500개까지. 만료된 coupon:* 저장 키를 하루 한 번 정리.
 *
 * 0.27.1
 *   - 서버 보호: 403은 3연속일 때만 정지, 429/503은 즉시 30분 정지(탭 간 공유), 일본어 화면 요청도 정지 규칙 적용.
 *   - 성우 조회: 404/410·성인 인증 필요는 재시도하지 않고, 인증 필요 시 5분 쉼. 쉬는 동안 타이머로 자동 재개.
 *   - @noframes 추가(iframe에서 중복 실행 방지).
 *
 * 0.27.0
 *   - 쿠폰 팝업 숨기기 버그 수정(couponPopup에서 host를 먼저 checked에 넣던 줄 삭제).
 *   - isList에 /genres/works 추가(쿠폰 페이지에서 필터 바가 안 뜨던 문제).
 *   - 태그 요청은 검색 중에도 화면에 보이는 카드만 받는다(서버 요청 수를 늘리지 않음).
 *   - 썸네일 정사각형 CSS는 설정 스위치(기본 꺼짐)로 바꾸고 목록 페이지에서만 적용.
 *   - clean.banners()가 이미 본 이미지를 WeakSet으로 건너뜀.
 *   - 설정의 바로가기 안내 문구 단축.
 */
(function () {
  'use strict';

  /* ========== 1. CONFIG ========== */
  const COOKIE = 'locale'; // 쿠키 이름이 다르면 여기만 수정
  const DEFAULTS = {
    locale: 'ko_KR',
    autoJa: true, // 이벤트 페이지는 일본어
    searchJa: false, // 검색 결과는 일본어
    hideBanners: true,
    saleStrip: true,
    onlyTlBl: true,
    hideCouponPop: true,
    saleOnly: false, // 검색 주소에 할인중 조건(2026-11-01 사용자: 기본은 할인중 아님)
    koDefault: true, // 검색 주소에 작품 언어가 없으면 한국어로
    showVA: true,
    'sb.sale': false, // 필터: 할인중만
    'sb.rate': 0, // 필터: 최소 할인율(0이면 끔)
    'sb.coupon': '', // 쿠폰 대상만: 빈 값이면 끔, '*'이면 아는 모든 쿠폰, 그 외는 쿠폰 id 하나
    hideAI: false, // AI 생성 작품 숨기기
    'fab.xy': null, // 끌어서 옮긴 버튼 위치 {l, t}(px). 예전 값 {x, y}(화면 비율 0~1)도 읽는다. 없으면 아래 fab.pos
    'fab.pos': 'rm', // 버튼 위치: rm 오른쪽 가운데, rt 오른쪽 위, rb 오른쪽 아래, lm 왼쪽 가운데
  };
  const KEEP_HREF = /\/(?:campaign\b(?!\/tutorial)|bulkbuy\b)|discount|coupon|(?:^|[^a-z])sale(?![a-z])/i; // 남길 배너(주소)
  const KEEP_TEXT = /セール|割引|%\s*OFF|(?:^|[^a-z])OFF(?![a-z])|まとめ買い|クーポン|\d+本\d+円|할인|세일|쿠폰|(?:^|[^a-z])sale(?![a-z])|coupon|discount/i; // 남길 배너(글자)
  const BANNER_IMG = /bcsv2_temp|media\.dlsite\.com\/bcs\/|\/modpub\/[^"']*\/bn_/i; // 배너 이미지 경로
  const FEATURE_IMG = /vivion-bcs\.com\/images\//i; // 특집 배너 이미지 서버(신작 슬라이드도 같은 서버라 FEATURE_HREF와 함께 본다)
  const FEATURE_HREF = /\/fsr\/|\/works\/genre\//; // 특집 배너는 검색 페이지로 간다
  const NOT_BANNER_IMG = /logo|icon|btn_|common\//i;
  const ALLOWED_FLOORS = ['girls', 'bl', 'girls-pro', 'bl-pro', 'girls-drama', 'bl-drama'];
  const FLOOR_SUB = /^(|asmr|voice|tool|girlsgame)$/;
  // '기간' 같은 너무 흔한 단어를 제거해 불필요한 텍스트 노드 매칭 방지
  const COUPON_HINT = /쿠폰|초이득|期間限定|クーポン/;
  const POP_MAX_TEXT = 300; // 쿠폰 팝업으로 숨길 컨테이너의 최대 글자 수
  const COUPON_POP = /DLsite\s*쿠폰|기간\s*임박|초이득|期間限定|クーポン.{0,10}(確認|チェック)/;
  const STRIP_FLOORS = ['girls', 'bl', 'maniax', 'home', 'girls-pro', 'bl-pro', 'girls-drama', 'bl-drama', 'pro', 'books', 'garumani'];
  const SALE_RE = /\d+\s*%\s*(OFF|오프)/i;
  const AI_RE = /AI生成|AI一部利用|AI\s*생성|AI\s*일부/i;
  const NAME_SEARCH = /\/keyword_(?:creater|maker_name)\//; // 성우·작가·서클 이름 검색(할인중 조건을 자동으로 안 붙임)
  const normName = (s) => String(s || '').toLowerCase().replace(/[\s　"“”]+/g, '');
  // 차단 목록(설정의 '차단' 칸). 서클·성우·작가 구분 없이 이름이 정확히 같으면 숨긴다.
  const blockSet = () => blockSet.cache || (blockSet.cache = new Set(String(store.get('block.list', '')).split('\n').map(normName).filter(Boolean)));
  const PRICE_RE = /\d[\d,.]*\s*(?:円|JPY|원|KRW|USD|CNY|TWD|HKD|EUR|元)|[$₩¥€]\s*\d/i; // 가격이 그려졌는지 판단(늦게 로드되는 카드 대응)
  const PID_RE = /product_id\/([A-Za-z]{2}\d{6,8})/;
  const OURS = '#dlh,#dlsale,#dlbar,#dlsheet,.dlva,.dlpn,.dlx,.dlw,.dlcp,.dlrow'; // 이 스크립트가 만든 요소
  const CACHE_MS = 2 * 3600 * 1000; // 일본어 첫 화면(할인 배너·이벤트 목록) 캐시. 30분 → 2시간(요청 1/4, 0.38.1)
  const RATE_STEPS = [0, 30, 50, 80]; // 할인 팝업에서 고르는 최소 할인율(0 = 할인중). 사이트 필터와 같은 값
  const DLW_URL = (id) => `https://dlwatcher.com/product/${encodeURIComponent(id)}`;
  const FAB_LONG_MS = 450; // 버튼을 이만큼 꾹 누르면 설정 시트
  const VA_PARALLEL = 1;
  const VA_GAP_MS = 1500;
  const VA_SAVE_DEBOUNCE_MS = 5000; // 대용량 객체 저장 빈도 완화 (5초)
  const FETCH_TIMEOUT = 20000;
  // 성우가 없는 작품 형식(카드 .work_category.type_XXX): 만화·극화·웹툰·CG·노벨. 이런 카드는 성우를 받지 않는다
  const NO_VOICE_TYPE = /\btype_(?:MNG|SCM|WBT|ICG|NRE)\b/;
  const SHORTCUTS = [
    ['👤', '마이페이지', 'https://www.dlsite.com/girls-touch/mypage/user'],
    ['⭐', '즐겨찾기', 'https://www.dlsite.com/girls-touch/mypage/wishlist'],
  ];

  /* ========== 2. store ========== */
  const store = {
    get(k, d = DEFAULTS[k]) { try { const v = GM_getValue(k); return v === undefined ? d : v; } catch (e) { return d; } },
    set(k, v) { try { GM_setValue(k, v); } catch (e) { /* 저장 실패는 무시 */ } },
  };
  const opt = (k) => store.get(k);

  // 서버 요청 공통: 시간 초과(본문 읽기까지), 429/403/503이면 쉬기(net), 실패면 err.status가 붙은 오류. as = 'json' | 'text'
  function netFetch(url, init, as) {
    if (!net.ok()) return Promise.reject(new Error('서버 제한으로 쉬는 중'));
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), FETCH_TIMEOUT);
    return fetch(url, { ...init, signal: ctl.signal })
      .then((r) => { if (!r.ok) { net.trip(r.status); throw Object.assign(new Error('HTTP ' + r.status), { status: r.status }); } return r[as](); })
      .catch((e) => { throw e && e.name === 'AbortError' ? new Error('시간 초과') : e; })
      .finally(() => clearTimeout(to));
  }
  const XHR = { 'X-Requested-With': 'XMLHttpRequest' };
  // 글자 복사(클립보드가 막히면 옛 방식). 되면 node에 잠깐 'ok'
  function copyText(node, text) {
    const done = () => { node.classList.add('ok'); setTimeout(() => node.classList.remove('ok'), 800); };
    const old = () => {
      const ta = el('textarea', { style: 'position:fixed;opacity:0' });
      ta.value = text;
      document.body.append(ta); ta.select();
      try { if (document.execCommand('copy')) done(); } catch (err) { /* 복사 실패 */ }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, old);
    else old();
  }
  const toneOf = (n) => (n >= 50 ? 'c3' : n >= 30 ? 'c2' : n ? 'c1' : 'c0'); // 쿠폰 할인율 색

  // 안전 정지: 사이트가 429/403/503을 돌려주면 백그라운드 요청을 30분 멈춘다.
  const NET_COOL_MS = 30 * 60 * 1000;
  const net = {
    until: 0,
    hit403: 0,
    ok() { // 매번 저장소를 읽어 다른 탭이 건 정지도 따른다
      net.until = Math.max(net.until, +store.get('net.until', 0) || 0);
      return Date.now() >= net.until;
    },
    good() { net.hit403 = 0; },
    trip(status) {
      if (status === 403) { // 403은 3연속일 때만(일시적 차단·인증 문제와 구분)
        if (++net.hit403 < 3) return;
      } else if (status !== 429 && status !== 503) return;
      net.hit403 = 0;
      net.until = Date.now() + NET_COOL_MS;
      store.set('net.until', net.until);
    },
  };

  /* ========== 3. route ========== */
  const route = {
    isSearch: (p) => /\/fsr\//.test(p),
    isCampaign: (p) => /\/(campaign|bulkbuy)(\/|$|\?)/.test(p) && !/\/fsr\//.test(p),
    isList: (p) => route.isCampaign(p) || route.isSearch(p) || /\/works\/discount/.test(p) || /\/genres\/works/.test(p) || /\/works\/genre\//.test(p) || /\/works\/exclusive/.test(p) || /\/works\/type\//.test(p) || /\/circle\/profile\//.test(p),
    floor: () => (location.pathname.split('/')[1] || 'girls').replace(/-touch$/, ''),
    isCouponBox: (p) => /\/mypage\/coupon\//.test(p),
    isCart: (p) => /^\/[^/]+\/cart(\/|$)/.test(p),
  };
  const pidOf = (href) => ((href || '').match(PID_RE) || [])[1];

  /* ========== 4. locale ========== */
  const cookieAttr = () => 'path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
  // 사이트는 ko-kr 모양도 한국어로 받는다(2026-11-01 locale=ko-kr 쿠키로 받은 검색 결과가 한국어). 모양만 다르면 다시 쓰지 않는다(전엔 처음 열 때 새로고침이 한 번 더 났음)
  const sameLocale = (a, b) => !!a && !!b && a.replace('-', '_').toLowerCase() === b.toLowerCase();
  const locale = {
    read() {
      let c = '';
      try { c = document.cookie; } catch (e) { return null; }
      const m = c.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : null;
    },
    // 일본어 쿠키일 때 사이트가 '언어 선택' 창(div._adultcheck.type_lang_select)을 띄운다. 언어를 하나 고르면 사이트가
    // localesuggested=true(365일)를 남겨 멈춘다(2026-11-01 폰 화면 크기 브라우저로 확인). 그 쿠키가 없으면 같은 값을 넣어 창을 막는다.
    // 성인 확인(adultchecked)은 본인이 직접 누르는 것이라 건드리지 않는다.
    suggested() {
      try {
        if (/(?:^|; )localesuggested=/.test(document.cookie)) return;
        document.cookie = 'localesuggested=true; ' + cookieAttr() + '; max-age=31536000; domain=.dlsite.com';
      } catch (e) { /* 쿠키 접근이 막힌 문서 */ }
    },
    // 사이트 성인 확인 창은 세션 쿠키 adultchecked_session이 없으면(브라우저를 닫았다 켜면 사라짐) adultchecked=1(400일)이 있어도 다시 뜬다(2026-11-01 쿠키 조합 8가지로 확인).
    // 전에 직접 '네'를 눌러 adultchecked=1이 남아 있을 때만 세션 표시를 다시 넣는다. 처음 확인은 건너뛰지 않는다.
    ageSession() {
      try {
        if (!/(?:^|; )adultchecked=1(?:;|$)/.test(document.cookie) || /(?:^|; )adultchecked_session=/.test(document.cookie)) return;
        document.cookie = 'adultchecked_session=1; ' + cookieAttr() + '; domain=.dlsite.com';
      } catch (e) { /* 쿠키 접근이 막힌 문서 */ }
    },
    write(v) {
      locale.suggested();
      const attr = cookieAttr();
      try {
        document.cookie = `${COOKIE}=${v}; ${attr}; max-age=31536000; domain=.dlsite.com`;
        document.cookie = `${COOKIE}=; ${attr}; max-age=0`; // 같은 이름의 host-only 쿠키가 도메인 쿠키를 가리지 않게 삭제
      } catch (e) { /* 쿠키 접근이 막힌 문서 */ }
    },
    wantFor(path) {
      const ja = (route.isCampaign(path) && opt('autoJa')) || (route.isSearch(path) && opt('searchJa'));
      return ja ? 'ja_JP' : opt('locale');
    },
    enforce(reload) {
      locale.suggested();
      locale.ageSession();
      const want = locale.wantFor(location.pathname);
      if (sameLocale(locale.read(), want)) return;
      locale.write(want);
      if (!reload) return;
      const key = 'dlh_reload:' + location.pathname;
      try {
        if (!sessionStorage.getItem(key)) { sessionStorage.setItem(key, '1'); location.reload(); }
      } catch (e) { /* sessionStorage 막힘 */ }
    },
    clearReloadGuards() {
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith('dlh_reload:')) sessionStorage.removeItem(k);
        }
      } catch (e) { /* 무시 */ }
    },
    hookNavigation() {
      const before = (raw) => {
        try {
          const u = new URL(raw, location.href);
          if (!u.hostname.endsWith('dlsite.com')) return;
          const w = locale.wantFor(u.pathname);
          if (!sameLocale(locale.read(), w)) locale.write(w);
        } catch (e) { /* 잘못된 주소 */ }
      };
      document.addEventListener('click', (e) => {
        const a = e.target.closest && e.target.closest('a[href]');
        if (a && a.target !== '_blank') before(a.href);
      }, true);
      document.addEventListener('submit', (e) => before(e.target.action || location.href), true);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) locale.enforce(false); });
    },
  };

  /* ========== 5. redirect ========== */
  const COUPON_RE = /custom_genres\/([A-Za-z0-9_]*coupon[A-Za-z0-9_]*)/i;
  // 쿠폰 대상 페이지(genres/works?genrekey=키)는 필터가 없다. 같은 목록을 검색 주소로 연다(작품 형식 group1 → work_type_category).
  function genreSearchPath() {
    const m = location.pathname.match(/^\/([^/]+)\/genres\/works\/?$/);
    const u = new URL(location.href);
    const key = u.searchParams.get('genrekey');
    if (!m || !key || !/^[A-Za-z0-9_]+$/.test(key)) return null;
    let np = `/${m[1]}/fsr/=/custom_genres/${key}`;
    let n = 0;
    for (const [k, v] of u.searchParams) {
      if (k === 'genrekey' || k === 'locale') continue;
      if (!/^group1\[\d*\]$/.test(k) || !/^[a-z_]+$/.test(v)) return null; // 모르는 조건이 있으면 바꾸지 않는다
      np += `/work_type_category[${n++}]/${v}`;
    }
    return np;
  }
  function searchRedirectTarget() {
    const gp = genreSearchPath();
    const p = gp || location.pathname;
    if (!route.isSearch(p)) return null;
    let np = p.replace(/\/?$/, '');
    const origPath = np;
    const off = userOff.get(p); // 이 검색에서 사용자가 직접 끈 기본값은 다시 붙이지 않는다
    if (opt('saleOnly') && !off.sale && !/\/campaign\/campaign/.test(p) && !/discount_rates/.test(p) && !/\/is_free/.test(p) && !COUPON_RE.test(p) && !NAME_SEARCH.test(p)) np += '/campaign/campaign';
    // 작품 언어를 안 정한 검색은 한국어(+언어 불필요)로. 이름 검색·쿠폰 대상 검색은 일본어 작품이 많아 그대로 둔다
    if (opt('koDefault') && !off.lang && /^\/girls(-touch)?\/fsr\//.test(p) && !/options(?:%5B|\[)/i.test(p) && !COUPON_RE.test(p) && !NAME_SEARCH.test(p)) np += '/options%5B0%5D/KO_KR/options%5B1%5D/NM';
    np = kw.path(np) || np; // 한국어 태그 이름 검색어에 일본어 이름을 '또는'으로(검색창에서 못 바꾼 경우)
    const u = new URL(location.href);
    if (gp) u.search = '';
    u.pathname = np === origPath ? p : np;
    if (opt('searchJa') && u.searchParams.get('locale') !== 'ja_JP') u.searchParams.set('locale', 'ja_JP');
    return u.href === location.href ? null : u.href;
  }

  // 칩으로 직접 끈 기본값(할인중 sale, 한국어 lang)을 검색 조건별로 기억한다(탭마다, 탭을 닫으면 다시 기본). 정렬·쪽은 빼고 비교
  const userOff = {
    key: (p) => pathSet(p.replace(/\/?$/, ''), ['order', 'page'], []),
    all() { try { return JSON.parse(sessionStorage.getItem('dlh_off') || '{}') || {}; } catch (e) { return {}; } },
    get(p) { return userOff.all()[userOff.key(p)] || {}; },
    mark(p, k) { // 지금 주소에서 이미 끈 것도 새 주소로 이어 간다(할인중을 끈 뒤 언어를 끄는 경우)
      const all = userOff.all(), key = userOff.key(p);
      const prev = { ...(all[userOff.key(location.pathname)] || {}), ...(all[key] || {}) };
      delete all[key]; // 최근 것을 뒤로(20개까지)
      all[key] = { ...prev, [k]: true };
      const ks = Object.keys(all);
      for (let i = 0; i < ks.length - 20; i++) delete all[ks[i]];
      try { sessionStorage.setItem('dlh_off', JSON.stringify(all)); } catch (e) { /* sessionStorage 막힘 */ }
    },
  };

  /* ========== 5.6 kw: 한국어 검색어에 일본어 태그 이름을 '또는'(|)으로 붙임 ==========
     한국어로 치면 일본어보다 적게 나왔다(2026-11-01: 임신 3034 / 妊娠 3258, 순애 4829 / 純愛 5496). 사이트 검색어는 '|'가 '또는'이다(妊娠|임신 3667).
     태그 목록(/girls/genre/list, 한국어·일본어 각 1번, 7일 캐시)에서 번호가 같은 이름을 짝짓고, 검색어가 한국어 태그 이름(또는 '/'로 나눈 한 조각)과
     같으면 일본어 이름을 붙인다(임신 → 임신|妊娠|孕ませ). 띄어쓰기가 든 검색어(여러 단어)는 그대로 둔다. */
  const TAGS_KEY = 'tags1';
  const TAGS_TTL = 7 * 864e5;
  const HANGUL = /[가-힣]/;
  const kw = {
    list() { const c = store.get(TAGS_KEY, null); return c && Array.isArray(c.list) ? c.list : []; }, // [[번호, 한국어, 일본어]]
    _busy: null,
    load() {
      const c = store.get(TAGS_KEY, null);
      if ((c && Date.now() - c.t < TAGS_TTL) || kw._busy || !net.ok()) return;
      const get = (loc) => fetchDoc(`https://www.dlsite.com/girls/genre/list?locale=${loc}`, 'omit').then(({ doc }) => {
        const m = new Map();
        for (const a of doc.querySelectorAll('a[href*="/works/genre/=/genre/"]')) {
          const n = (a.getAttribute('href').match(/\/genre\/(\d+)/) || [])[1];
          const t = [...a.childNodes].filter((x) => x.nodeType === 3).map((x) => x.data).join('').trim(); // 뒤의 (개수) span은 뺀다
          if (n && t) m.set(n, t);
        }
        return m;
      });
      store.set(TAGS_KEY, { t: Date.now() - TAGS_TTL + NET_COOL_MS, list: kw.list() }); // 실패해도 30분은 다시 안 받음
      kw._busy = get('ko_KR')
        .then((ko) => new Promise((ok) => setTimeout(ok, VA_GAP_MS)).then(() => get('ja_JP')).then((ja) => {
          const list = [...ko].filter(([n]) => ja.has(n)).map(([n, k]) => [n, k, ja.get(n)]);
          if (list.length > 50) store.set(TAGS_KEY, { t: Date.now(), list });
        }))
        .catch(() => { /* 다음에 다시 */ })
        .finally(() => { kw._busy = null; });
    },
    // 짝 목록: 태그 이름 그대로 + '공(攻め)·수(受け)'를 뗀 앞말(연하 공/年下攻め → 연하/年下, 집착 공/執着攻め → 집착/執着). 앞말은 두 글자 이상만
    pairs() {
      const list = kw.list();
      if (kw._pairsOf === list.length && kw._pairs) return kw._pairs;
      const out = [];
      for (const [, ko, ja] of list) {
        out.push([ko, ja]);
        const m = ko.match(/^(.{2,})\s(공|수)$/), j = m && ja.match(m[2] === '공' ? /^(.+?)攻め?$/ : /^(.+?)受け?$/);
        if (j) out.push([m[1], j[1]]);
      }
      kw._pairsOf = list.length;
      return (kw._pairs = out);
    },
    // 한국어 검색어 → '한국어|일본어…'. 바꿀 게 없으면 null. 띄어쓰기는 태그 이름 하나와 같을 때만(연하 공 → 연하공|年下攻め), 아니면 여러 단어라 그대로
    expand(word) {
      const raw = String(word || '').trim();
      if (!raw || /\|/.test(raw) || !HANGUL.test(raw)) return null;
      const w = raw.replace(/\s+/g, '');
      const out = [];
      for (const [ko, ja] of kw.pairs()) {
        const kp = ko.split('/').map((x) => x.replace(/\s+/g, ''));
        const i = kp.indexOf(w);
        if (i < 0 && ko.replace(/\s+/g, '') !== w) continue;
        const jp = ja.split('/').map((x) => x.trim()).filter(Boolean);
        for (const j of (i >= 0 && kp.length > 1 && kp.length === jp.length ? [jp[i]] : jp)) if (!out.includes(j)) out.push(j); // 조각 수가 같으면 같은 자리 것만
      }
      return out.length ? [w, ...out].join('|') : null;
    },
    // 검색 주소의 keyword를 바꾼 주소(바꿀 게 없으면 null)
    path(pathname) {
      const k = pathGet(pathname, 'keyword');
      if (k === undefined) return null;
      let d = '';
      try { d = decodeURIComponent(k.replace(/\+/g, ' ')); } catch (e) { return null; }
      const x = kw.expand(d);
      return x ? pathSet(pathname, ['keyword', 'page'], [['keyword', encodeURIComponent(x)]]) : null;
    },
    // 사이트 검색창에서 검색하기 직전(제출·Enter·검색 버튼, 사이트보다 먼저)에 글자를 바꾼다. 그러면 요청이 늘지 않는다
    before(e) {
      const t = e.target;
      let inp = null;
      if (e.type === 'submit') inp = t.querySelector && t.querySelector('input[name=keyword]');
      else if (e.type === 'keydown') { if (e.key === 'Enter' && t.matches && t.matches('input[name=keyword]')) inp = t; }
      else { const f = t.closest && t.closest('.globalSearchBtn, #search_button'); inp = f && f.closest('form') && f.closest('form').querySelector('input[name=keyword]'); }
      if (inp && inp.value.trim()) sbox.remember(inp.value.trim());
      if (inp && sheet.opener === inp) sheet.close(); // 검색하면 검색창 목록은 닫는다
      const x = inp && kw.expand(inp.value);
      if (!x) return;
      inp.value = x;
      inp.dispatchEvent(new Event('input', { bubbles: true })); // 사이트(Vue)가 값을 들고 있으면 같이 바뀌게
    },
    // 바꾼 검색어(임신|妊娠|孕ませ)가 검색창에 보이면 원래 한국어만 보이게(다시 검색하면 before가 또 붙임)
    shown: new WeakSet(),
    tidyBox() {
      for (const inp of document.querySelectorAll('input[name=keyword]')) {
        if (kw.shown.has(inp)) continue;
        const m = inp.value.match(/^([^|]+)\|/);
        if (!m || kw.expand(m[1]) !== inp.value) continue;
        kw.shown.add(inp);
        inp.value = m[1];
      }
    },
  };

  /* ========== 공통 도우미 ========== */
  function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (tag === 'button') e.type = 'button';
    for (const [k, v] of Object.entries(props || {})) {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    e.append(...kids.flat().filter((x) => x != null));
    return e;
  }
  function pressable(b, onTap, onLong, drag, ms = 500) {
    let timer = 0, down = false, moved = false, long = false, px = 0, py = 0;
    const stop = () => clearTimeout(timer);
    b.addEventListener('pointerdown', (e) => {
      down = true; moved = false; long = false; px = e.clientX; py = e.clientY; stop();
      if (drag) { drag.start(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ } }
      timer = setTimeout(() => {
        if (!down || moved) return;
        long = true;
        if (navigator.vibrate) try { navigator.vibrate(30); } catch (err) { /* 무시 */ }
        onLong();
      }, ms);
    });
    b.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - px, dy = e.clientY - py;
      if (!moved && Math.hypot(dx, dy) > (drag ? 16 : 24)) { moved = true; stop(); if (drag) long = true; }
      if (moved && drag) drag.move(dx, dy);
    });
    const end = () => { stop(); if (down && moved && drag) drag.end(); down = false; };
    b.addEventListener('pointerup', end);
    b.addEventListener('pointercancel', end);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('click', () => { if (long) { long = false; return; } onTap(); });
    b.style.webkitTouchCallout = 'none';
    b.style.userSelect = 'none';
    if (drag) b.style.touchAction = 'none';
  }
  const setText = (id, t) => { const n = document.getElementById(id); if (n && n.textContent !== t) n.textContent = t; };
  const hide = (n, flag) => { n.style.display = 'none'; n.dataset[flag] = '1'; };

  // 바·팝업 아이콘: Google Material Symbols Rounded의 path (Apache License 2.0, https://github.com/google/material-design-icons)
  const ICON = {
    sr: 'M380-320q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l224 224q11 11 11 28t-11 28q-11 11-28 11t-28-11L532-372q-30 24-69 38t-83 14Zm0-80q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z',
    hf: 'M480-147q-14 0-28.5-5T426-168l-69-63q-106-97-191.5-192.5T80-634q0-94 63-157t157-63q53 0 100 22.5t80 61.5q33-39 80-61.5T660-854q94 0 157 63t63 157q0 115-85 211T602-230l-68 62q-11 11-25.5 16t-28.5 5Z',
    tk: 'M160-200q-33 0-56.5-23.5T80-280v-120q33 0 56.5-23.5T160-480q0-33-23.5-56.5T80-560v-120q0-33 23.5-56.5T160-760h640q33 0 56.5 23.5T880-680v120q-33 0-56.5 23.5T800-480q0 33 23.5 56.5T880-400v120q0 33-23.5 56.5T800-200H160Z', // 쿠폰(직접 그림)
    dn: 'M480-362q-8 0-15-2.5t-13-8.5L268-557q-11-11-11-28t11-28q11-11 28-11t28 11l156 156 156-156q11-11 28-11t28 11q11 11 11 28t-11 28L508-373q-6 6-13 8.5t-15 2.5Z',
    ck: 'm382-354 339-339q12-12 28-12t28 12q12 12 12 28.5T777-636L410-268q-12 12-28 12t-28-12L182-440q-12-12-11.5-28.5T183-497q12-12 28.5-12t28.5 12l142 143Z',
  };
  function icon(k) {
    const NS = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 -960 960 960');
    s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', ICON[k]);
    s.append(p);
    return s;
  }
  // 할인 팝업의 정렬: 검색 주소의 order 값(2026-10-30 사이트 정렬 창에서 확인, cstart_d·cend는 할인 작품 검색일 때 사이트에도 나옴). trend = 사이트 기본
  // 2026-10-31 사이트 정렬 창에서 확인: 신작 release_d, 판매수 dl_d. cstart_d·cend는 할인 작품 검색일 때만 사이트에 있다
  const SALE_SORTS = [['cstart_d', '할인 개시일 새로운순', '개시순'], ['cend', '마감 임박순', '마감순'], ['release_d', '신작순', '신작순'], ['dl_d', '판매 많은순', '판매순'], ['price', '저가순', '저가순'], ['trend', '인기순', '']];
  // 검색 주소 읽기·고치기. 사이트는 누를 때 주소를 order%5B0%5D/cend처럼 바꾸므로 [n]·%5Bn%5D는 무시하고 키로 본다
  const segKey = (k) => { try { k = decodeURIComponent(k); } catch (e) { /* 그대로 */ } return k.replace(/\[\d*\]$/, ''); };
  function pathPairs(pathname) {
    const m = pathname.match(/^(.*?\/fsr\/=\/)(.*)$/);
    if (!m) return null;
    const seg = m[2].split('/').filter(Boolean), pairs = [];
    for (let i = 0; i + 1 < seg.length; i += 2) pairs.push([seg[i], seg[i + 1]]);
    return { head: m[1], pairs };
  }
  const pathGet = (pathname, key) => { const p = pathPairs(pathname); const f = p && p.pairs.find((x) => segKey(x[0]) === key); return f ? f[1] : undefined; };
  const pathSet = (pathname, drop, add) => {
    const p = pathPairs(pathname);
    return p ? p.head + [...p.pairs.filter((x) => !drop.includes(segKey(x[0]))), ...add].map((x) => x.join('/')).join('/') : pathname;
  };
  const siteOrder = () => pathGet(location.pathname, 'order') || 'trend';
  // 할인율 사이트 필터: discount_rates%5B0%5D/c8(30%↑)·c9(50%↑)·c10(80%↑) (2026-10-31 사이트 필터 창에서 확인, 서버가 거름. c7은 1~29%)
  const RATE_CODE = { 30: 'c8', 50: 'c9', 80: 'c10' };
  const urlRate = () => { const c = pathGet(location.pathname, 'discount_rates'); return Number(Object.keys(RATE_CODE).find((k) => RATE_CODE[k] === c)) || 0; };
  const urlSale = () => pathGet(location.pathname, 'campaign') === 'campaign' || pathGet(location.pathname, 'discount_rates') !== undefined;
  // 작품 언어: 검색 주소 options[n]/<값>(2026-10-30 사이트 필터에서 확인). 여러 개 넣으면 OR(일본어 33025 + 한국어 4239 → 37166)
  const LANGS = [['KO_KR', '한국어', '한'], ['JPN', '일본어', '일'], ['CHI_HANS', '중국어 간체', '간'], ['CHI_HANT', '중국어 번체', '번']];
  // 사이트 필터의 언어 값 전부(그 밖의 options[]는 그대로 둔다). NM = 언어 불필요(그림만 있는 작품 등), 언어를 고르면 같이 넣는다
  const LANG_ALL = /^(JPN|ENG|CHI|CHI_HANS|CHI_HANT|KO_KR|SPA|GER|FRE|IND|ITA|POR|SWE|THA|VIE|OTL|NM|DOT)$/;
  const OPT_SEG = /^options(?:%5B|\[)\d*(?:%5D|\])$/i;
  // 언어를 고를 수 있는 목록: 검색, 서클(주소 …/maker_id/RG….html/options[0]/JPN…, 2026-10-30 PC 서클 화면에서 확인)
  const LANG_PAGE = /\/(?:fsr|circle\/profile)\/(?:ajax\/)?=\/(.*)$/;
  const isCircle = (p) => /\/circle\/profile\//.test(p);
  // 지금 언어(language/jp는 주소에 언어 options[]가 없을 때만 사이트가 JPN으로 읽는다. KO_KR가 같이 있으면 한국어 작품만 나옴, 2026-11-01 확인).
  // 서클은 주소에 없으면 사이트가 일본어·언어 불필요를 기본으로 체크하므로 화면의 체크를 읽는다
  function langNow(pathname) {
    const m = pathname.match(LANG_PAGE);
    if (!m) return [];
    const seg = m[1].split('/');
    const out = new Set();
    let jp = false, hasLang = false;
    for (let i = 0; i + 1 < seg.length; i += 2) {
      if (OPT_SEG.test(seg[i])) { out.add(seg[i + 1]); if (LANG_ALL.test(seg[i + 1])) hasLang = true; }
      if (seg[i] === 'language' && seg[i + 1] === 'jp') jp = true;
    }
    if (jp && !hasLang) out.add('JPN');
    if (!out.size && isCircle(pathname)) for (const i of document.querySelectorAll('input[name="options[]"]:checked')) out.add(i.value);
    return LANGS.map((x) => x[0]).filter((k) => out.has(k));
  }
  // 언어를 바꾼 주소. 언어 값과 language/jp·page는 빼고, 다른 options[]는 번호를 다시 매겨 남긴다.
  // 서클은 언어가 없으면 사이트가 일본어로 되돌리므로, 다 끄면 네 언어를 다 넣는다(= 전체)
  function langPath(pathname, langs) {
    const m = pathname.match(/^(.*?\/(?:fsr|circle\/profile)\/=\/)(.*)$/);
    if (!m) return null;
    if (!langs.length && isCircle(pathname)) langs = LANGS.map((x) => x[0]);
    const seg = m[2].split('/').filter(Boolean);
    const rest = [], opts = [];
    for (let i = 0; i + 1 < seg.length; i += 2) {
      if (OPT_SEG.test(seg[i])) { if (!LANG_ALL.test(seg[i + 1])) opts.push(seg[i + 1]); continue; }
      if ((seg[i] === 'language' && seg[i + 1] === 'jp') || seg[i] === 'page') continue;
      rest.push(seg[i], seg[i + 1]);
    }
    const all = [...(langs.length ? [...langs, 'NM'] : []), ...opts];
    return m[1] + [...all.flatMap((v, i) => [`options%5B${i}%5D`, v]), ...rest].join('/');
  }

  const AGE_GATE = /年齢認証|年齢確認|adult_?check|age_?check|18歳未満/i;
  function fetchDoc(href, credentials) {
    return netFetch(href, { credentials }, 'text')
      .then((t) => { net.good(); return { t, doc: new DOMParser().parseFromString(t, 'text/html') }; });
  }
  function jaFetch(url, looksOk = () => true) {
    const u = new URL(url, location.href);
    u.searchParams.set('locale', 'ja_JP');
    return fetchDoc(u.href, 'omit').then(({ t, doc }) => {
      if (looksOk(doc) || !AGE_GATE.test(t)) return doc;
      return fetchDoc(u.href, 'include').then((r) => { locale.enforce(false); return r.doc; });
    });
  }
  const safeUrl = (raw) => {
    try {
      const u = new URL(raw, 'https://www.dlsite.com');
      return u.protocol === 'https:' && /(^|\.)dlsite\.com$/.test(u.hostname) ? u : null;
    } catch (e) { return null; }
  };

  /* ========== 6. clean ========== */
  const clean = {
    bannersHidden: new Set(),
    bannerSeen: new WeakSet(), // 이미 판정한 이미지는 다시 보지 않는다(옵션을 바꾸면 resetBanners로 비움)
    resetBanners() { clean.bannerSeen = new WeakSet(); clean.banners(); },
    banners() {
      const on = opt('hideBanners');
      for (const img of document.querySelectorAll('a[href] img')) {
        if (clean.bannerSeen.has(img)) continue;
        const src = img.currentSrc || img.src || img.getAttribute('data-src') || '';
        if (!src || /^data:|blank|spacer|1x1/i.test(src)) continue; // 지연 로딩 자리표시자면 나중에 진짜 주소로 다시 본다
        const link = img.closest('a[href]');
        if (link.closest(OURS)) continue;
        clean.bannerSeen.add(img);
        if (!(BANNER_IMG.test(src) || (FEATURE_IMG.test(src) && FEATURE_HREF.test(link.href))) || NOT_BANNER_IMG.test(src)) continue;
        const label = (img.alt || '') + ' ' + (link.title || '') + ' ' + (link.textContent || '');
        const keep = KEEP_HREF.test(link.href) || KEEP_TEXT.test(label);
        const box = link.closest('li') || link;
        if (!keep && on) { hide(box, 'dlhHid'); clean.bannersHidden.add(box); }
        else if (box.dataset.dlhHid === '1') { box.style.display = ''; box.dataset.dlhHid = ''; clean.bannersHidden.delete(box); }
      }
      setText('dlh-hid', `숨긴 배너 ${clean.bannersHidden.size}개`);
    },

    seenFloorLinks: new WeakSet(),
    floors() {
      if (!opt('onlyTlBl')) return;
      const touched = new Set();
      for (const a of document.querySelectorAll('a[href]')) {
        if (clean.seenFloorLinks.has(a)) continue;
        clean.seenFloorLinks.add(a);
        if (a.closest(OURS)) continue;
        let u;
        try { u = new URL(a.href, location.href); } catch (e) { continue; }
        if (!/(^|\.)dlsite\.com$/.test(u.hostname)) continue;
        const seg = u.pathname.split('/').filter(Boolean);
        if (!seg.length) continue;
        const fl = seg[0].replace(/-touch$/, '');
        const sub = seg[1] || '';
        const isFloorLink = seg.length === 1 || (seg.length === 2 && FLOOR_SUB.test(sub));
        if (!isFloorLink || (ALLOWED_FLOORS.includes(fl) && sub !== 'girlsgame')) continue;
        const box = a.closest('li') || a;
        box.style.display = 'none';
        touched.add(box.parentElement);
      }
      for (const ul of touched) {
        if (!ul || ul === document.body) continue;
        const kids = [...ul.children];
        if (!kids.length || !kids.every((k) => k.style.display === 'none')) continue;
        ul.style.display = 'none';
        const prev = ul.previousElementSibling;
        if (prev && prev.textContent.trim().length < 20) prev.style.display = 'none';
      }
    },

    // 쿠폰 팝업 검사: COUPON_HINT가 있는 텍스트 노드만 찾는다. '팝업 아님'으로 본 컨테이너는 글자 수가 같을 때만 건너뛴다.
    // (팝업처럼 보이는데 아직 고정 컨테이너를 못 찾은 경우는 기록하지 않아 다음 검사에서 다시 본다)
    popSeen: new WeakMap(),
    couponPopup() {
      if (!opt('hideCouponPop')) return;
      const checked = clean.popSeen;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentElement && COUPON_HINT.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
      });
      for (let tn = walker.nextNode(); tn; tn = walker.nextNode()) {
        const host = tn.parentElement;
        if (!host || host.closest(OURS)) continue;
        if (host.closest('[data-dlh-pop]')) continue;
        const box = host.closest('a,div,section,aside') || host;
        const t = box.textContent || '';
        if (checked.get(box) === t.length) continue;
        if (t.length > 120 || !COUPON_POP.test(t)) { checked.set(box, t.length); continue; }
        for (let p = box; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
          if ((p.textContent || '').length > POP_MAX_TEXT) break; // 팝업 말고 다른 내용까지 든 컨테이너는 숨기지 않는다
          const pos = getComputedStyle(p).position;
          if (pos === 'fixed' || pos === 'sticky') { hide(p, 'dlhPop'); break; }
        }
      }
    },
  };

  /* ========== 6.5 공통: 성우 이름 나누기 ========== */
  const splitVa = (s) => (s && s !== '-' ? s.split(/\s*[\/／、,，・]\s*/).map((x) => x.trim()).filter(Boolean) : []);

  /* ========== 7. list ==========
     작품 목록 찾기 + 상단 바. 화면에 불러온 작품만 대상이다. */
  const list = {
    state: {
      sale: opt('sb.sale'), rate: opt('sb.rate'),
      coupon: opt('sb.coupon'),
    },
    _items: null,
    _cardCache: new WeakMap(), // 카드별 정적 파싱 결과 캐시 (매 apply마다 정규식·textContent 재실행 방지)
    _priceMiss: new WeakMap(), // 가격이 아직 안 보인 카드의 재시도 횟수
    _thumbCache: new WeakMap(), // 카드별 대표 썸네일 캐시
    _pendingPlaces: new Map(), // box -> card (일괄 위치 계산 큐)
    _rafId: 0,
    _applyTimer: 0,

    invalidate() { list._items = null; },

    // 여러 곳에서 동시에 부르는 apply를 하나로 묶어 실행
    scheduleApply(ms = 120) {
      clearTimeout(list._applyTimer);
      list._applyTimer = setTimeout(() => list.apply(), ms);
    },

    items() {
      if (list._items) return list._items;
      const ids = new Map();
      const anchors = [];
      for (const a of document.querySelectorAll('a[href*="/product_id/"]')) {
        const pid = pidOf(a.href);
        if (!pid || a.closest(OURS)) continue;
        anchors.push(a);
        for (let n = a; n && n !== document.body; n = n.parentElement) {
          let s = ids.get(n);
          if (!s) ids.set(n, (s = new Set()));
          s.add(pid);
        }
      }
      const cards = new Set();
      for (const a of anchors) {
        let e = a;
        while (e.parentElement && e.parentElement !== document.body && ids.get(e.parentElement).size <= 1) e = e.parentElement;
        cards.add(e);
      }
      const groups = new Map();
      for (const e of cards) {
        const g = groups.get(e.parentElement) || [];
        g.push(e);
        groups.set(e.parentElement, g);
      }
      let best = [];
      for (const g of groups.values()) if (g.length > best.length) best = g;
      list._items = best.length >= 3 ? best : [];
      return list._items;
    },

    parseEnd(t) {
      const m = t.match(/[~～〜]\s*(\d{1,2})\/(\d{1,2})\s*(?:[(（][^)）]*[)）]\s*)?(\d{1,2})[:時]\s*(\d{2})?/);
      if (!m) return Infinity;
      const now = new Date();
      const mk = (y) => new Date(y, +m[1] - 1, +m[2], +m[3], +(m[4] || 0));
      let d = mk(now.getFullYear());
      if (d < now - 30 * 864e5) d = mk(now.getFullYear() + 1);
      return +d;
    },

    // 카드의 정적 텍스트·할인율·마감일은 최초 1회만 파싱하여 WeakMap에 저장하고,
    // 나중에 받는 성우(vas)만 결합해 반환한다.
    read(e, i) {
      let base = list._cardCache.get(e);
      if (!base) {
        const rawText = e.textContent || '';
        const a = e.querySelector('a[href*="/product_id/"]');
        const id = a && pidOf(a.href);
        const rates = [...rawText.matchAll(/(\d{1,3})\s*%\s*(?:OFF|오프)/gi)].map((m) => +m[1]).filter((n) => n > 0 && n < 100);
        base = {
          id,
          cardVa: voice.fromCard(e),
          sale: SALE_RE.test(rawText) || !!e.querySelector('.strike,del,s'),
          rate: rates.length ? Math.max(...rates) : 0,
          ai: AI_RE.test(rawText),
          end: list.parseEnd(rawText),
          names: list.names(e),
        };
        // 가격이 아직 없으면 '할인 아님'으로 굳히지 않는다(최대 5번까지 다시 읽고, 그래도 없으면 확정)
        const miss = (list._priceMiss.get(e) || 0) + 1;
        if (base.sale || PRICE_RE.test(rawText) || miss >= 5) list._cardCache.set(e, base);
        else list._priceMiss.set(e, miss);
      }
      const id = base.id;
      const got = id ? voice.getCached(id) : null; // 받아 온 전체 성우가 있으면 그것, 없으면 카드의 이름
      const vas = got ? splitVa(got) : base.cardVa ? base.cardVa.names : [];
      return {
        e, i, id, vas,
        more: !got && !!(base.cardVa && base.cardVa.more), // 카드에 첫 성우만 있음(아직 다 안 받음)
        sale: base.sale,
        rate: base.rate,
        ai: base.ai,
        end: base.end,
        names: base.names,
      };
    },

    // 카드의 서클·작가·성우 링크 이름. 링크 글자와 주소 속 원래 이름(자동 번역돼도 그대로)을 둘 다 넣는다.
    names(e) {
      const out = [];
      for (const a of e.querySelectorAll('a[href*="/maker_id/"], a[href*="/keyword_creater/"], a[href*="/keyword_maker_name/"]')) {
        out.push(normName(a.textContent));
        const m = (a.getAttribute('href') || '').match(/\/keyword_(?:creater|maker_name)\/([^/?#]+)/);
        if (m) { try { out.push(normName(decodeURIComponent(m[1]))); } catch (err) { /* 잘못된 주소 */ } }
      }
      return out.filter(Boolean);
    },

    thumb(card) {
      const cachedImg = list._thumbCache.get(card);
      if (cachedImg && cachedImg.isConnected) return cachedImg;
      const imgs = card.querySelectorAll('img');
      if (imgs.length === 1) {
        list._thumbCache.set(card, imgs[0]);
        return imgs[0];
      }
      let best = null;
      let area = 0;
      for (const img of imgs) {
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        if (w * h > area) { area = w * h; best = img; }
      }
      if (best && area > 2500) list._thumbCache.set(card, best);
      return best || imgs[0] || null;
    },

    host(card) {
      const img = list.thumb(card);
      if (!img) return null;
      return (img.closest('a') || img).parentElement;
    },

    _cb: new WeakMap(),
    cbOf(box) {
      let cb = list._cb.get(box);
      if (cb !== undefined && (cb === null || cb.isConnected)) return cb;
      cb = null;
      for (let n = box.parentElement; n && n !== document.documentElement; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.position !== 'static' || cs.transform !== 'none') { cb = n; break; }
      }
      list._cb.set(box, cb);
      return cb;
    },

    // 강제 리플로우(Layout Thrashing) 방지:
    // 개별 place 호출을 큐에 모았다가 requestAnimationFrame에서
    // 1) 모든 getBoundingClientRect() 읽기 수행 -> 2) 모든 style 쓰기 수행 순서로 일괄 처리한다.
    queuePlace(box, card) {
      list._pendingPlaces.set(box, card);
      if (list._rafId) return;
      list._rafId = requestAnimationFrame(() => {
        list._rafId = 0;
        list.flushPlaces();
      });
    },

    flushPlaces() {
      if (!list._pendingPlaces.size) return;
      const entries = [...list._pendingPlaces.entries()];
      list._pendingPlaces.clear();

      // 1단계: DOM/레이아웃 읽기 전용 (리플로우 최대 1회)
      const sY = window.scrollY;
      const sX = window.scrollX;
      const cbRects = new Map();
      const reads = [];

      for (const [box, card] of entries) {
        if (!box.isConnected || !card.isConnected) continue;
        const img = list.thumb(card);
        if (!img) continue;
        const ir = img.getBoundingClientRect();
        if (ir.height < 20) continue; // 숨겨졌거나 아직 안 그려짐
        const cb = list.cbOf(box);
        let top, left;
        if (cb) {
          let cr = cbRects.get(cb);
          if (!cr) {
            cr = {
              rect: cb.getBoundingClientRect(),
              clientTop: cb.clientTop,
              clientLeft: cb.clientLeft,
              scrollTop: cb.scrollTop,
              scrollLeft: cb.scrollLeft,
            };
            cbRects.set(cb, cr);
          }
          top = Math.round(ir.top - cr.rect.top - cr.clientTop + cr.scrollTop);
          left = Math.round(ir.left - cr.rect.left - cr.clientLeft + cr.scrollLeft);
        } else {
          top = Math.round(ir.top + sY);
          left = Math.round(ir.left + sX);
        }
        reads.push({
          box,
          top: top + 'px',
          left: left + 'px',
          width: Math.round(ir.width) + 'px',
          height: Math.round(ir.height) + 'px',
        });
      }

      // 2단계: 스타일 쓰기 전용 (레이아웃 재계산 유발 없음)
      for (const r of reads) {
        const st = r.box.style;
        if (st.top !== r.top) st.top = r.top;
        if (st.left !== r.left) st.left = r.left;
        if (st.width !== r.width) st.width = r.width;
        if (st.height !== r.height) st.height = r.height;
      }
    },

    _ro: null,
    _roFn: null,
    watch(box, card) {
      if (box.dataset.dlxWatch) return;
      const img = list.thumb(card);
      if (!img) return;
      box.dataset.dlxWatch = '1';
      const redo = () => list.queuePlace(box, card);
      if (!list._ro && 'ResizeObserver' in window) {
        list._roFn = new WeakMap();
        list._ro = new ResizeObserver((es) => es.forEach((en) => { const f = list._roFn.get(en.target); if (f) f(); }));
      }
      if (list._ro) for (const n of [img, box.parentElement]) { if (n) { list._roFn.set(n, redo); list._ro.observe(n); } }
      else window.addEventListener('resize', redo);
      img.addEventListener('load', redo, { passive: true });
    },

    dlw(id) {
      const a = el('a', { class: 'dlw', href: DLW_URL(id), 'aria-label': 'DLwatcher에서 ' + id + ' 보기' }, 'DLW');
      a.addEventListener('click', (ev) => ev.stopPropagation());
      return a;
    },

    deco(x) {
      const card = x.e;
      const boxes = card.querySelectorAll('.dlx');
      for (let i = 1; i < boxes.length; i++) boxes[i].remove();
      let box = boxes[0];
      if (!box) {
        const h = list.host(card);
        if (!h) return;
        box = el('div', { class: 'dlx' });
        h.append(box);
      }
      list.watch(box, card);
      list.queuePlace(box, card);
      list.row(card, x, coupon.badges(x.id) || []);
      const sig = [x.vas.join('/') + (x.more ? '+' : ''), x.id].join('|');
      if (box.dataset.sig === sig) return;
      box.dataset.sig = sig;
      const cv = x.vas.length ? list.copier(el('span', { class: 'dlva', title: x.vas.join(' / ') }, 'CV ' + x.vas[0] + (x.vas.length > 1 ? ' +' + (x.vas.length - 1) : x.more ? ' +' : '')), x.vas[0]) : null;
      box.replaceChildren(...(cv || x.id ? [el('div', { class: 'dlbd' + (cv ? '' : ' bare') }, cv, x.id ? list.dlw(x.id) : null)] : []));
    },
    // 누르거나 길게 누르면 작품을 열지 않고(링크·이미지 메뉴도 막고) 글자 복사. 복사되면 잠깐 초록색
    copier(node, text) {
      const copy = (ev) => { ev.preventDefault(); ev.stopPropagation(); copyText(node, text); };
      for (const t of ['click', 'contextmenu']) node.addEventListener(t, copy);
      return node;
    },
    // 사진 아래 한 줄(정리안3): 품번(누르면 복사) · 쿠폰·묶음 · ♥(로그인일 때). 사진 칸(dt 등) 바로 뒤에 넣는다
    row(card, x, bs) {
      const img = list.thumb(card);
      let tb = img && card.contains(img.closest('dt')) ? img.closest('dt') : img; // 사진 칸(dt), 없으면 카드 바로 아래에서 사진을 품은 칸
      while (tb && tb.parentElement && tb.parentElement !== card && !(tb.tagName === 'DT')) tb = tb.parentElement;
      if (!x.id || !tb || tb === card || !card.contains(tb)) return;
      let r = tb.nextElementSibling;
      if (!r || !r.classList.contains('dlrow')) { r = el(tb.parentElement.tagName === 'DL' ? 'dd' : 'div', { class: 'dlrow' }); tb.after(r); }
      const on = fav.has(x.id);
      const sig = [x.id, bs.map((b) => b.join(':')).join(','), fav.ok(), on].join('|');
      if (r.dataset.sig === sig) return;
      r.dataset.sig = sig;
      let heart = null;
      if (fav.ok()) {
        heart = el('button', { class: 'dlfav' + (on ? ' on' : ''), 'aria-label': on ? '즐겨찾기에서 빼기' : '즐겨찾기', 'aria-pressed': String(on) }, icon('hf'));
        heart.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); fav.toggle(x.id, card, heart); });
      }
      r.replaceChildren(list.copier(el('span', { class: 'dlpn', title: '누르면 품번 복사' }, x.id), x.id),
        ...bs.map(([c, t]) => el('span', { class: 'dlcpn ' + c }, c === 'bk' ? null : icon('tk'), t.replace(/^쿠폰 /, ''))), ...(heart ? [heart] : [])); // null을 넣으면 "null" 글자가 찍힌다(CLAUDE.md 함정)
    },

    lastData: [],
    seq: 0,
    apply() {
      clearTimeout(list._applyTimer);
      const bar = document.getElementById('dlbar');
      if (!bar) return;
      const cnt = bar.querySelector('.cnt');
      const items = list.items();
      if (!items.length) { cnt.textContent = ''; return; }
      const S = list.state;
      for (const e of items) if (!e.dataset.dlIdx) e.dataset.dlIdx = String(list.seq++);
      const data = items.map((e) => list.read(e, +e.dataset.dlIdx));
      list.lastData = data;
      const hideAiOpt = opt('hideAI');
      const bl = blockSet();
      const couponIds = S.coupon ? coupon.ids(S.coupon) : [];
      const couponOn = couponIds.length > 0;
      const siteSide = route.isSearch(location.pathname); // 검색 목록의 할인·할인율은 사이트가 주소로 거르므로 여기서 또 거르지 않는다
      let shown = 0;
      const unknown = [];

      for (const x of data) {
        const cm = couponOn ? coupon.match(couponIds, x.id) : true;
        if (x.id && voice.couponsFor(x.id) === null) unknown.push(x.id); // 쿠폰 거르기와 카드 딱지에 쓴다
        const ok = !(x.ai && hideAiOpt)
          && !(bl.size && (x.names.some((n) => bl.has(n)) || x.vas.some((n) => bl.has(normName(n)))))
          && (siteSide || !S.sale || x.sale)
          && (siteSide || !S.rate || x.rate >= S.rate)
          && cm !== false;
        const wantDisp = ok ? '' : 'none';
        if (x.e.style.display !== wantDisp) x.e.style.display = wantDisp;
        if (ok) shown++;
      }
      if (unknown.length) coupon.checkSoon(unknown);
      if (couponOn) allList.start(data.length);

      // 보이는 카드만 오버레이 갱신 및 일괄 위치 측정 예약
      for (const x of data) if (x.e.style.display !== 'none') list.deco(x);
      list.flushPlaces();

      const v = voice.stat;
      const pending = voice.queue.length + voice.busy;
      cnt.textContent = couponOn ? `${shown}/${data.length}` + allList.part(couponIds) : `${shown}개`;
      setText('dlh-cs', S.coupon ? coupon.status(S.coupon, data) : '');
      bar.setAttribute('aria-busy', pending ? 'true' : 'false');
      setText('dlh-va', `성우: 찾음 ${v.ok} · 없음 ${v.none} · 실패 ${v.err}${v.why ? ' (' + v.why + ')' : ''}`);
    },

    mount() {
      if (!route.isList(location.pathname)) return;
      if (!document.getElementById('dlbar')) {
        const items = list.items();
        if (!items.length) return;
        const S = list.state;
        const toggle = (b, on) => { b.classList.toggle('on', !!on); b.setAttribute('aria-pressed', String(!!on)); };
        const chip = (label) => { const b = el('button', { class: 'c', 'aria-haspopup': 'dialog' }); b.dataset.k = label; return b; };
        const label = (b, text) => b.replaceChildren(el('span', {}, text), icon('dn'));
        // 칩 누르기: 바꾼 게 있으면 짧게 = 기본으로, 기본 상태면 짧게 = 팝업. 꾹 = 언제나 팝업(2026-11-01 사용자 결정)
        const tapHold = (b, isOn, reset, open) => pressable(b, () => (isOn() ? reset() : open()), open, null, FAB_LONG_MS);
        const go = (np) => { if (np && np !== location.pathname) { const u = new URL(location.href); u.pathname = np; location.assign(u.href); return true; } return false; };
        const remount = () => { document.getElementById('dlbar')?.remove(); list.mount(); };
        // 기본 언어: 한국어 기본(koDefault)이 붙는 검색이면 한국어, 아니면(서클·이름·쿠폰 검색) 조건 없음
        const langDef = () => { const p = location.pathname; return opt('koDefault') && isSearch && /^\/girls(-touch)?\/fsr\//.test(p) && !COUPON_RE.test(p) && !NAME_SEARCH.test(p) ? ['KO_KR'] : []; };
        const isSearch = route.isSearch(location.pathname);
        // 주소의 order를 바꿔 다시 연다(사이트에서 정렬을 누를 때처럼 1번). 기본(인기순)은 order를 뺀다
        const goPath = (drop, add) => { const u = new URL(location.href); u.pathname = pathSet(u.pathname, drop, add); location.assign(u.href); };
        const goOrder = (v) => goPath(['order', 'page'], v === 'trend' ? [] : [['order', v]]);
        // 검색 목록은 할인중·할인율도 사이트 필터(주소)로 건다. 할인율이 있으면 campaign/campaign은 뺀다(사이트에서 같은 라디오 한 묶음)
        // 할인율을 끄면 기본(saleOnly면 할인중)으로. '할인중'을 끄면 할인 조건이 없는 주소(= 할인 아닌 작품도)로 가고, 기본 할인중도 그 검색엔 다시 붙이지 않는다
        // (전엔 할인중을 다시 붙여 같은 페이지를 또 받았음). 할인 검색에만 있는 정렬(cend·cstart_d)도 뺀다
        const goRate = (v, off) => {
          const camp = [['campaign', 'campaign']];
          if (!off) { goPath(['discount_rates', 'campaign', 'page'], v ? [['discount_rates%5B0%5D', RATE_CODE[v]]] : camp); return; }
          if (v) { goPath(['discount_rates', 'campaign', 'page'], opt('saleOnly') ? camp : []); return; }
          const np = pathSet(location.pathname, ['discount_rates', 'campaign', 'page', ...(/^c/.test(siteOrder()) ? ['order'] : [])], []);
          userOff.mark(np, 'sale');
          const u = new URL(location.href); u.pathname = np; location.assign(u.href);
        };
        // 할인: 위 칸은 이 쪽 안에서 거르기(할인중·30/50/70%↑), 아래 칸은 사이트 정렬(검색 주소에서만). 고른 것을 다시 누르면 꺼져 기본으로
        const saleChip = () => {
          const b = chip('sale');
          const paint = () => {
            if (isSearch) { S.sale = urlSale(); S.rate = urlRate(); } // 사이트에서 직접 바꿔도 주소를 읽어 맞춘다
            const so = isSearch ? (SALE_SORTS.find((x) => x[0] === siteOrder()) || [])[2] : '';
            const base = S.rate ? `${S.rate}%↑` : S.sale ? '할인중' : '';
            label(b, [base, so].filter(Boolean).join('·') || '할인');
            toggle(b, S.sale || S.rate || so);
          };
          const save = () => { store.set('sb.sale', S.sale); store.set('sb.rate', S.rate); paint(); list.apply(); };
          const open = () => { paint(); sheet.openSale(b, isSearch, (v) => {
            const cur = S.sale || S.rate ? S.rate : -1;
            if (isSearch) { goRate(v, cur === v); return; }
            if (cur === v) { S.sale = false; S.rate = 0; } else { S.sale = true; S.rate = v; }
            save();
          }, (v) => { const cur = siteOrder(); goOrder(v === cur ? 'trend' : v); }); };
          // 기본으로: 할인 조건·정렬을 한 번에 뺀다(검색은 주소 1번 이동). 기본 할인중(saleOnly)도 이 검색엔 다시 안 붙임
          const reset = () => {
            if (!isSearch) { S.sale = false; S.rate = 0; save(); return; }
            const np = pathSet(location.pathname, ['discount_rates', 'campaign', 'order', 'page'], []);
            if (opt('saleOnly')) userOff.mark(np, 'sale');
            const u = new URL(location.href); u.pathname = np; location.assign(u.href);
          };
          tapHold(b, () => { paint(); return b.classList.contains('on'); }, reset, open);
          paint();
          return b;
        };
        // 쿠폰: 팝업에서 하나(맨 위 '가진 쿠폰 아무거나' = 전부). 고른 것을 다시 누르면 끔
        const couponChip = () => {
          const b = chip('coupon');
          b.id = 'dl-coupon-chip';
          const paint = () => { label(b, S.coupon === '*' ? '쿠폰 전체' : S.coupon ? coupon.label(S.coupon) : '쿠폰'); toggle(b, S.coupon); };
          const set = (id) => {
            S.coupon = S.coupon === id ? '' : id;
            store.set('sb.coupon', S.coupon);
            paint();
            list.apply();
            if (S.coupon) coupon.refreshHeld().then((did) => did && list.apply());
          };
          const open = () => {
            sheet.openCoupons(b, set);
            coupon.refreshHeld().then((did) => { if (did && !sheet.node.hidden && sheet.opener === b) sheet.openCoupons(b, set); });
          };
          tapHold(b, () => !!S.coupon, () => set(S.coupon), open);
          paint();
          return b;
        };
        // 작품 언어(검색·서클 목록): 여러 개 고르고, 팝업을 닫을 때 바뀌었으면 주소를 바꿔 연다(사이트에서 필터를 누를 때처럼 1번)
        const langChip = () => {
          const b = chip('lang');
          const cur = langNow(location.pathname);
          const all = isCircle(location.pathname) && cur.length === LANGS.length; // 서클에서 네 언어 다 = 전체(꺼진 것으로 보임)
          const on = all ? [] : LANGS.filter((x) => cur.includes(x[0]));
          label(b, on.length ? on.map((x) => x[2]).join('·') : '언어');
          b.setAttribute('aria-label', '작품 언어: ' + (on.length ? on.map((x) => x[1]).join(', ') : '전체'));
          const def = langDef();
          const isDef = on.map((x) => x[0]).join() === def.join();
          toggle(b, !isDef); // 기본과 다를 때만 파란색
          const go = (v) => {
            const np = langPath(location.pathname, v);
            if (!np || np === location.pathname) return;
            if (!v.length) userOff.mark(np, 'lang'); // 다 끄면 '언어 조건 없음' 그대로(한국어 기본을 다시 붙이지 않음)
            const u = new URL(location.href); u.pathname = np; location.assign(u.href);
          };
          tapHold(b, () => !isDef, () => go(def), () => sheet.openLang(b, cur, go));
          return b;
        };
        // 층(검색만): 대상 TL(female)·BL(gay) × 형식 동인·코믹·드라마(주소 sex_category[]·work_category[], 여러 개 = 또는). 닫을 때 바뀌었으면 한 번 이동
        const floorChip = () => {
          const b = chip('floor');
          const pp = pathPairs(location.pathname);
          const cur = Object.fromEntries(FLOORS.map(([k]) => [k, pp ? pp.pairs.filter((x) => segKey(x[0]) === k).map((x) => x[1]) : []]));
          const names = FLOORS.map(([k, vs]) => cur[k].map((v) => (vs.find((x) => x[0] === v) || [v, v])[1]));
          const n = names[0].length + names[1].length, head = [names[0][0], names[1][0]].filter(Boolean);
          label(b, n ? head.join(' ') + (n > head.length ? '+' + (n - head.length) : '') : '층');
          toggle(b, n);
          const pick = (sel) => go(pathSet(location.pathname, ['sex_category', 'work_category', 'page'], FLOORS.flatMap(([k]) => sel[k].map((v, i) => [`${k}%5B${i}%5D`, v]))));
          tapHold(b, () => n > 0, () => pick({ sex_category: [], work_category: [] }), () => sheet.openFloor(b, cur, pick));
          return b;
        };
        // 필터: 사이트 '필터링 조건' 창을 연다(있는 화면만)
        const filterChip = () => {
          const b = chip('filter');
          b.replaceChildren(el('span', {}, '필터'));
          b.addEventListener('click', () => { const a = document.querySelector('a.search_sort'); if (a) a.click(); });
          return b;
        };
        // 검색(묶음 할인 화면만, 사이트 검색창이 없음): 주소 ?keyword=·?genre[n]=을 사이트가 거른다(2026-11-01: 247368 → keyword=純愛 9978건). 짧게 = 조건 있으면 빼기
        const bulkChip = () => {
          const b = chip('search');
          const u = new URL(location.href);
          const k = u.searchParams.get('keyword') || '';
          const gs = [...u.searchParams.keys()].filter((x) => /^genre\[\d*\]$/.test(x));
          const names = new Map(kw.list().map((x) => [x[0], x[1]]));
          const t = [k.split('|')[0], ...gs.map((g) => '#' + (names.get(u.searchParams.get(g)) || u.searchParams.get(g)))].filter(Boolean).join(' ');
          b.replaceChildren(icon('sr'), el('span', {}, t || '검색'));
          toggle(b, !!t);
          const clear = () => { const v = new URL(location.href); for (const x of ['keyword', 'page', ...gs]) v.searchParams.delete(x); location.assign(v.href); };
          tapHold(b, () => !!t, clear, () => sheet.openBulk(b, k.split('|')[0]));
          return b;
        };
        const make = { floor: isSearch && floorChip, lang: LANG_PAGE.test(location.pathname) && langChip, sale: saleChip, coupon: couponChip, filter: document.querySelector('a.search_sort') && filterChip, search: BULK_PAGE.test(location.pathname) && bulkChip };
        const hidden = chipHidden();
        const chips = chipOrder().filter((k) => make[k] && !hidden.includes(k)).map((k) => make[k]());
        // ↺: 바꾼 칩이 있을 때만 맨 앞에. 누르면 전부 기본으로(검색은 주소 1번 이동)
        const isOn = (k) => chips.some((c) => c.dataset.k === k && c.classList.contains('on'));
        const resetAll = () => {
          if (S.coupon) { S.coupon = ''; store.set('sb.coupon', ''); }
          let np = location.pathname;
          if (isSearch) np = pathSet(np, ['discount_rates', 'campaign', 'order', 'page', 'sex_category', 'work_category'], []);
          else if (isOn('sale')) { S.sale = false; S.rate = 0; store.set('sb.sale', false); store.set('sb.rate', 0); }
          if (isOn('lang')) np = langPath(np, langDef()) || np;
          if (opt('saleOnly')) userOff.mark(np, 'sale');
          if (!langDef().length && isOn('lang')) userOff.mark(np, 'lang');
          if (!go(np)) remount();
        };
        const rs = el('button', { class: 'c rs', 'aria-label': '전부 기본으로', onclick: resetAll }, '↺');
        rs.hidden = !chips.some((c) => c.classList.contains('on'));
        const bar = el('div', { id: 'dlbar', role: 'toolbar', 'aria-label': '목록 거르기' },
          rs, ...chips, el('span', { class: 'cnt', role: 'status', 'aria-live': 'polite' }));
        let ref = items[0].parentElement;
        while (ref.parentElement && ref.parentElement !== document.body && /flex|grid/.test(getComputedStyle(ref.parentElement).display)) ref = ref.parentElement;
        ref.parentElement.insertBefore(bar, ref);
        if (list.state.coupon) coupon.refreshHeld().then((did) => did && list.apply());
      }
      fav.refresh();
      list.apply();
    },
  };
  // 칩 순서·숨김(설정 '칩'). 모르는 값은 버리고 빠진 칩은 뒤에 붙인다
  const CHIPS = [['search', '검색(묶음 할인)'], ['floor', '층'], ['lang', '언어'], ['sale', '할인'], ['coupon', '쿠폰'], ['filter', '필터']];
  const BULK_PAGE = /^\/[^/]+\/campaign\/bulkbuy\/=\/key\//;
  const FLOORS = [['sex_category', [['female', 'TL'], ['gay', 'BL']]], ['work_category', [['doujin', '동인'], ['books', '코믹'], ['drama', '드라마']]]];
  const chipOrder = () => { const v = store.get('chips.order', []); const all = CHIPS.map((x) => x[0]); const o = (Array.isArray(v) ? v : []).filter((k) => all.includes(k)); return [...new Set([...o, ...all])]; };
  const chipHidden = () => { const v = store.get('chips.hidden', []); return Array.isArray(v) ? v : []; };

  /* ========== 7.2 coupon: 쿠폰 적용 대상 ========== */
  const COUPON_TTL = 6 * 3600 * 1000;
  const HELD_URL = 'https://www.dlsite.com/girls-touch/mypage/coupon/list/ajax'; // 쿠폰함 화면이 쓰는 데이터(가진 쿠폰 전부)
  const INFO_URL = 'https://www.dlsite.com/girls-touch/product/info/ajax?product_id='; // 목록 화면이 쓰는 작품 정보 묶음(다른 층 작품도 됨)
  const INFO_BATCH = 50;
  const coupon = {
    seen: new WeakSet(),
    _path: '',
    _cacheAll: null,
    _cacheList: null,
    _cacheAt: 0,

    invalidateCache() {
      coupon._cacheAll = null;
      coupon._cacheList = null;
    },

    allMap() {
      if (!coupon._cacheAll || Date.now() - coupon._cacheAt > 10000) {
        coupon._cacheAll = store.get('coupons', {}) || {};
        coupon._cacheAt = Date.now();
        coupon._cacheList = null;
      }
      return coupon._cacheAll;
    },

    // 카드마다 GM_getValue와 정렬을 반복하지 않도록 메모리 캐시 사용
    list() {
      const all = coupon.allMap();
      if (coupon._cacheList) return coupon._cacheList;
      const now = Date.now();
      coupon._cacheList = Object.values(all)
        .filter((c) => !c.id.startsWith('q:') && (c.until ? c.until > now : now - c.seen < 30 * 864e5)) // q:는 예전 버전이 쿠폰 아닌 기획까지 저장한 것
        .sort((a, b) => (a.until || Infinity) - (b.until || Infinity));
      return coupon._cacheList;
    },
    get(id) { return coupon.allMap()[id] || null; },
    ids(sel) { return sel === '*' ? coupon.list().map((c) => c.id) : (sel ? [sel] : []); },
    rate(id) {
      const c = coupon.get(id);
      if (c && Array.isArray(c.pcts) && c.pcts.length) return c.pcts.length > 1 ? c.pcts[0] + '~' + c.pcts[c.pcts.length - 1] : String(c.pcts[0]);
      const pct = c && c.title && (c.title.match(/(\d+)\s*%\s*OFF/i) || [])[1];
      if (pct) return pct;
      const m = id.match(/coupon(\d+)/i);
      if (!m) return '';
      const d = m[1];
      const ok = (s) => +s >= 5 && +s <= 90 && +s % 5 === 0;
      if (ok(d)) return d;
      if (d.length === 4 && ok(d.slice(0, 2)) && ok(d.slice(2))) return d.slice(0, 2) + '~' + d.slice(2);
      return '';
    },
    label(id) { const r = coupon.rate(id); return r ? r + '%' : '쿠폰'; },
    context(a) {
      let box = a;
      for (let i = 0; i < 6 && box.parentElement; i++) {
        box = box.parentElement;
        if (/まで/.test(box.textContent) && /クーポン|COUPON|쿠폰/i.test(box.textContent)) break;
      }
      const t = box.textContent.replace(/\s+/g, ' ').trim();
      let title = '';
      for (const e of box.querySelectorAll('*')) {
        if (e.closest('a[href*="custom_genres/"]')) continue;
        const x = e.textContent.replace(/\s+/g, ' ').trim();
        if (x.length < 8 || x.length > 120 || !/クーポン|쿠폰/.test(x) || /まで/.test(x)) continue;
        if (!title || x.length < title.length) title = x;
      }
      const um = t.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*まで/);
      return {
        title: title.slice(0, 80),
        until: um ? +new Date(+um[1], +um[2] - 1, +um[3], +um[4], +um[5], +(um[6] || 0)) : 0,
      };
    },
    // 가진 쿠폰을 쿠폰함 데이터에서 읽는다. 6시간에 한 번(실패하면 30분 뒤), 쿠폰함 페이지에선 5분마다까지.
    // 대상 작품 표시(custom_genres/키)가 있는 쿠폰만 쓴다. 같은 키를 쓰는 쿠폰(20%·30%)은 하나로 묶는다.
    // 반환값: 실제로 새로 받았으면 true
    _heldBusy: null,
    heldFresh() { const h = store.get('coupons.held', null); return !!(h && h.ok && Date.now() - h.t < COUPON_TTL); },
    refreshHeld(soon) {
      if (coupon._heldBusy) return coupon._heldBusy;
      const h = store.get('coupons.held', null) || { t: 0, ok: false };
      const age = Date.now() - h.t;
      if (age < (soon ? 5 * 60 * 1000 : h.ok ? COUPON_TTL : NET_COOL_MS) || !net.ok()) return Promise.resolve(false);
      store.set('coupons.held', { t: Date.now(), ok: false });
      coupon._heldBusy = netFetch(HELD_URL, { credentials: 'include', headers: XHR }, 'json')
        .then((arr) => {
          net.good();
          if (!Array.isArray(arr)) throw new Error('쿠폰함 형식 다름');
          const all = {};
          for (const c of arr) {
            const keys = [...new Set([...JSON.stringify(c).matchAll(/custom_genres\/([A-Za-z0-9_]+)/g)].map((m) => m[1]))];
            const until = Date.parse(String(c.end_date || '').replace(' ', 'T') + '+09:00') || 0;
            const pct = c.discount_type === 'rate' ? +c.discount : 0;
            const need = +((c.conditions && c.conditions.post_condition && c.conditions.post_condition.count) || 1) || 1; // 2작품 이상 쿠폰은 2
            for (const id of keys) {
              const o = all[id] || (all[id] = { id, floor: 'girls', title: '', until: 0, seen: Date.now(), pcts: [], need: {} });
              if (pct && !o.pcts.includes(pct)) o.pcts.push(pct);
              if (pct) o.need[pct] = Math.min(o.need[pct] || need, need);
              if (!o.title || pct >= Math.max(...o.pcts)) o.title = String(c.coupon_name || '').slice(0, 80);
              o.until = Math.max(o.until, until);
            }
          }
          for (const o of Object.values(all)) o.pcts.sort((a, b) => a - b);
          const before = new Set(Object.keys(store.get('coupons', {}) || {}));
          if (Object.keys(all).some((id) => !before.has(id))) { voice.cpCache = {}; voice.cpDirty = true; voice.flushSaves(); } // 새 쿠폰이 생기면 작품별 기록을 다시 받는다
          store.set('coupons', all);
          store.set('coupons.held', { t: Date.now(), ok: true });
          coupon.invalidateCache();
          setText('dlh-cp', `쿠폰: 쿠폰함에서 ${Object.keys(all).length}종 확인`);
          return true;
        })
        .catch((e) => { setText('dlh-cp', '쿠폰함을 못 읽음: ' + ((e && e.message) || e)); return false; })
        .finally(() => { coupon._heldBusy = null; locale.enforce(false); });
      return coupon._heldBusy;
    },
    // 쿠폰 기록이 없는 작품을 최대 50개씩 한 번에 받는다(사이트 화면이 쓰는 작품 정보 묶음 주소). 묶음 사이는 VA_GAP_MS 쉼.
    // 대상: need에 넣은 작품(목록 화면·목록 전체·장바구니). 화면에 보이는 목록 것이 먼저.
    need: new Set(),
    _infoBusy: false,
    _infoT: 0,
    _infoFail: 0,
    checkSoon(ids) {
      if (ids) for (const id of ids) if (id) coupon.need.add(id);
      clearTimeout(coupon._infoT);
      coupon._infoT = setTimeout(coupon.checkNow, 300);
    },
    checkNow() {
      if (coupon._infoBusy || !net.ok() || Date.now() - coupon._infoFail < 60 * 1000) return;
      for (const id of coupon.need) if (voice.couponsFor(id) !== null) coupon.need.delete(id);
      const ids = [...coupon.need].slice(0, INFO_BATCH);
      if (!ids.length) return;
      coupon._infoBusy = true;
      netFetch(INFO_URL + ids.map(encodeURIComponent).join(','), { credentials: 'include', headers: XHR }, 'json')
        .then((j) => {
          net.good();
          // 아는 쿠폰은 응답이 온 때 기준. 보낼 때 기준이면, 그 사이 쿠폰함이 와서 기록을 비운 뒤에 '쿠폰 없음'을 6시간 다시 써 버렸다(T2가 가끔 전부 숨김)
          const known = new Set(coupon.ids('*'));
          for (const id of ids) {
            const w = j && j[id];
            const ks = w && Array.isArray(w.custom_genres) ? w.custom_genres.filter((k) => known.has(k)) : [];
            voice.putCoupons(id, ks, w && typeof w.bulkbuy_key === 'string' ? w.bulkbuy_key : '');
            coupon.need.delete(id);
          }
        })
        .catch(() => { coupon._infoFail = Date.now(); })
        .finally(() => {
          locale.enforce(false);
          list.scheduleApply(50);
          cart.paint();
          setTimeout(() => { coupon._infoBusy = false; coupon.checkNow(); }, VA_GAP_MS);
        });
    },
    learn() {
      if (route.isCouponBox(location.pathname)) coupon.refreshHeld(true).then((did) => did && list.apply());
      if (coupon.heldFresh()) return; // 쿠폰함 데이터가 있으면 페이지 링크로 배우지 않는다(가진 쿠폰이 아닌 배너 쿠폰이 섞이지 않게)
      const found = [];
      const diag = { links: 0, fsr: 0, other: [] };
      const add = (href, a) => {
        let u;
        try { u = new URL(href, location.href); } catch (e) { return; }
        const m = u.pathname.match(COUPON_RE);
        if (!m) return; // 작품 정보의 쿠폰 키(custom_genres)로 판정하므로 키가 있는 쿠폰만 기억한다
        const fl = (u.pathname.split('/')[1] || route.floor()).replace(/-touch$/, '');
        found.push({ id: m[1], floor: fl, ...(a ? coupon.context(a) : {}) });
      };
      if (coupon._path !== location.pathname && COUPON_RE.test(location.pathname)) { coupon._path = location.pathname; add(location.href, null); }
      const nodes = new Set();
      for (const n of document.querySelectorAll('a,button')) {
        if (coupon.seen.has(n)) continue;
        coupon.seen.add(n);
        if ((n.getAttribute('href') || '').includes('custom_genres/') || /対象作品|대상\s*작품/.test(n.textContent || '')) nodes.add(n);
      }
      for (const n of nodes) {
        if (n.closest(OURS)) continue;
        diag.links++;
        const href = n.getAttribute('href') || n.dataset.href || n.dataset.url || (n.closest('a[href]') || {}).href || '';
        if (/\/fsr\//.test(href) || COUPON_RE.test(href)) { diag.fsr++; add(href, n); } else diag.other.push(href || '(주소 없음: ' + n.tagName.toLowerCase() + ')');
      }
      if (diag.links || found.length) {
        setText('dlh-cp', `쿠폰: 이 페이지 대상 링크 ${diag.links}개 · 인식 ${found.length}개`
          + (diag.other.length ? ` · 모르는 형식: ${diag.other.slice(0, 2).join(' , ').slice(0, 160)}` : ''));
      }
      if (!found.length) return;
      const all = store.get('coupons', {}) || {};
      for (const f of found) {
        const old = all[f.id] || {};
        all[f.id] = { id: f.id, floor: f.floor, title: f.title || old.title || '', until: f.until || old.until || 0, seen: Date.now() };
      }
      store.set('coupons', all);
      coupon.invalidateCache();
    },
    // 만료된 coupon:* 캐시 키 정리(하루 한 번, 화면이 한가할 때)
    sweep() {
      if (typeof GM_listValues !== 'function' || typeof GM_deleteValue !== 'function') return;
      const last = +store.get('coupon.sweepAt', 0) || 0;
      if (Date.now() - last < 24 * 3600 * 1000) return;
      store.set('coupon.sweepAt', Date.now());
      try {
        for (const k of GM_listValues()) {
          if (/^(cpCache1|cpCache2|tagCache1|tagCache2|search\.recent|tlOnly|squareThumb|flt\..*)$/.test(k)) { GM_deleteValue(k); continue; } // 예전 버전이 쓰던 값(작품별 쿠폰 옛 형식, 태그, 🔍 최근 검색, TL만, 필터 기억)
          if (!k.startsWith('coupon:')) continue;
          const c = store.get(k, null);
          if (!c || !(Date.now() - c.t < COUPON_TTL)) GM_deleteValue(k);
        }
      } catch (e) { /* 저장소 접근 실패는 무시 */ }
    },
    // 작품 하나가 고른 쿠폰 대상인가: true/false, 아직 작품 정보를 못 받았으면 null(이때는 보여 둔다)
    match(ids, pid) {
      const ks = pid ? voice.couponsFor(pid) : [];
      return ks === null ? null : ks.some((k) => ids.includes(k));
    },
    // 카드 딱지: 1개부터 쓰는 쿠폰 중 최고율, 그보다 높은 '2개 이상' 쿠폰, 묶음 할인. 아직 모르면 null
    badges(pid) {
      const ks = pid ? voice.couponsFor(pid) : [];
      if (ks === null) return null;
      let one = 0, multi = 0, multiN = 0;
      const live = new Set(coupon.ids('*')); // 기한이 지난 쿠폰은 빼고
      for (const k of ks) {
        if (!live.has(k)) continue;
        const c = coupon.get(k);
        const pcts = c && Array.isArray(c.pcts) && c.pcts.length ? c.pcts : (coupon.rate(k).match(/\d+/g) || []).map(Number);
        for (const pc of pcts) {
          const n = (c && c.need && c.need[pc]) || 1;
          if (n <= 1) one = Math.max(one, pc);
          else if (pc > multi) { multi = pc; multiN = n; }
        }
      }
      const out = [];
      if (one) out.push([toneOf(one), `쿠폰 ${one}%`]);
      if (multi > one) out.push([toneOf(multi), `${multiN}개 ${multi}%`]);
      if (voice.bulkFor(pid)) out.push(['bk', '묶음']);
      return out;
    },
    status(sel, data) {
      const ids = coupon.ids(sel);
      if (!ids.length) return '아는 쿠폰 없음 (쿠폰 목록 페이지를 먼저 한 번 열어 주세요)';
      const name = sel === '*' ? `쿠폰 ${ids.length}종` : coupon.label(sel);
      let hit = 0, unk = 0;
      for (const x of data) { const r = coupon.match(ids, x.id); if (r === null) unk++; else if (r) hit++; }
      return `${name} 대상 ${hit}개` + (unk ? ` · 확인 중 ${unk}개` : '');
    },
  };

  /* ========== 7.3 allList: 목록 전체(최대 300개)의 작품 id. 쿠폰을 켰을 때 '전체 대상/전체' 숫자용 ==========
     999 같은 묶음 할인 페이지와 검색 페이지만. 사이트가 보여 준 전체 개수와 받은 개수가 다르면 숫자를 안 보인다. */
  const ALL_MAX = 300;
  const TOTAL_RE = /([\d,]+)\s*(?:件中|건\s*중)/;
  const allList = {
    key: '', // 지금 받았거나 받는 중인 목록(정렬 조건은 뺌: 정렬만 바뀌면 다시 받지 않는다)
    ids: null,
    source() {
      const p = location.pathname;
      const qs = new URLSearchParams(location.search);
      qs.delete('order'); qs.delete('locale');
      const q = qs.toString();
      const b = p.match(/^\/([^/]+)\/campaign\/bulkbuy\/=\/key\/([^/]+)/);
      if (b) return { key: 'b:' + b[2] + '?' + q, per: 50, json: false, conds: [''], url: (n, x) => `https://www.dlsite.com/${b[1]}/campaign/bulkbuy/ajax/=/key/${b[2]}/page/${n}/${q ? '?' + q : ''}` };
      if (!route.isSearch(p)) return null;
      const cond = p.replace(/^.*?\/fsr\/(?:ajax\/)?=\//, '').replace(/\/(?:per_page|page|order(?:%5B0%5D|\[0\])?|from|show_type)\/[^/]+/g, '').replace(/\/+$/, '');
      const fl = route.floor();
      // 화면 주소가 language/jp뿐이면 사이트는 작품 언어 조건(options JPN·NM)을 숨겨서 붙인다. 개수가 안 맞으면 이걸 붙여 한 번 더 본다.
      const conds = [cond];
      if (/(^|\/)language\/jp(\/|$)/.test(cond) && !/(^|\/)options(%5B|\[|\/)/.test(cond)) conds.push(cond + '/options%5B0%5D/JPN/options%5B1%5D/NM');
      return { key: 's:' + fl + '/' + cond, per: 100, json: true, conds, url: (n, c) => `https://www.dlsite.com/${fl}/fsr/ajax/=/${c}/per_page/100/page/${n}` };
    },
    start(onPage) {
      const src = allList.source();
      if (!src || src.key === allList.key) return;
      if (allList.ids && allList.idsKey !== src.key) allList.ids = null; // 다른 목록으로 바뀜
      const total = +((((document.body.textContent || '').match(TOTAL_RE)) || [])[1] || '').replace(/,/g, '');
      if (!total) return; // 사이트가 총 개수를 아직 안 그렸으면 다음에 다시 본다(전엔 이 목록을 다시 안 셌음)
      allList.key = src.key;
      allList.ids = null;
      if (total <= onPage || total > ALL_MAX) return; // 한 쪽에 다 있거나 너무 많으면 세지 않는다
      const c = (store.get('lists1', null) || {})[src.key];
      if (c && Date.now() - c.t < COUPON_TTL && c.ids.length === total) { allList.done(c.ids); return; }
      const ids = new Set();
      const pages = Math.ceil(total / src.per);
      const wait = () => new Promise((ok) => setTimeout(ok, VA_GAP_MS));
      const page = (n, ci) => {
        if (allList.key !== src.key) return null; // 그새 다른 목록으로 바뀜
        return netFetch(src.url(n, src.conds[ci]), { credentials: 'include', headers: XHR }, src.json ? 'json' : 'text')
          .then((d) => {
            net.good();
            const html = src.json ? String(d.search_result || '') : d.replace(/&nbsp;/g, ' '); // 개수 글자가 '414&nbsp;件中'으로 온다
            const cnt = src.json ? +(d.page_info && d.page_info.count) : +((html.match(TOTAL_RE) || [])[1] || '').replace(/,/g, '');
            if (cnt !== total) {
              if (n === 1 && ci + 1 < src.conds.length) return wait().then(() => page(1, ci + 1)); // 숨은 조건을 붙여 다시
              throw new Error('개수 다름');
            }
            for (const m of html.matchAll(/product_id\/([A-Za-z]{2}\d{6,8})/g)) ids.add(m[1]);
            return n < pages ? wait().then(() => page(n + 1, ci)) : null;
          });
      };
      page(1, 0)
        .then(() => {
          if (allList.key !== src.key || ids.size !== total) return;
          const all = store.get('lists1', null) || {};
          all[src.key] = { t: Date.now(), ids: [...ids] };
          const ks = Object.keys(all);
          for (let i = 0; i < ks.length - 20; i++) delete all[ks[i]];
          store.set('lists1', all);
          allList.done([...ids]);
        })
        .catch(() => { /* 못 세면 '전체' 숫자를 안 보인다 */ })
        .finally(() => locale.enforce(false));
    },
    done(ids) { allList.ids = ids; allList.idsKey = allList.key; coupon.checkSoon(ids); list.scheduleApply(50); },
    // ' · 전체 대상/전체'. 아직 다 모르면 빈 글자
    part(couponIds) {
      if (!allList.ids) return '';
      let hit = 0;
      for (const id of allList.ids) { const r = coupon.match(couponIds, id); if (r === null) return ''; if (r) hit++; }
      return ` · 전체 ${hit}/${allList.ids.length}`;
    },
  };

  /* ========== 7.4 cart: 장바구니 작품에 쓸 수 있는 쿠폰 딱지(숨기지 않음: 숨겨도 결제에는 들어가므로) ========== */
  const cart = {
    paint() {
      if (!route.isCart(location.pathname)) return;
      coupon.refreshHeld().then((did) => did && cart.paint());
      const known = coupon.ids('*');
      if (!known.length) return;
      const need = [];
      for (const li of document.querySelectorAll('li._cart_item, li._cart_items')) {
        const a = li.querySelector('a[href*="/product_id/"]');
        const id = a && pidOf(a.href);
        if (!id) continue;
        const ks = voice.couponsFor(id);
        if (ks === null) { need.push(id); continue; }
        // 할인율이 제일 큰 쿠폰 하나만. '20~30'은 큰 쪽으로 센다
        const top = (k) => Math.max(0, ...(coupon.rate(k).match(/\d+/g) || []).map(Number));
        const best = known.filter((k) => ks.includes(k)).sort((x, y) => top(y) - top(x))[0];
        const labels = best ? [coupon.label(best)] : [];
        const tone = toneOf(best ? top(best) : 0);
        const sig = labels.join('|');
        let box = li.querySelector('.dlcp');
        const host = box ? box.parentElement : li.querySelector('.n_work_thumb, .work_thumb') || (a.querySelector('img') || a).parentElement;
        const img = host.querySelector('img');
        // 표지 왼쪽 아래에 겹친다. PC는 표지 아래 작품 형식 줄(ASMR 등)까지 칸 안이라 칸 바닥에 두면 그 줄에 붙었다
        const onImg = () => {
          if (!box || !img || !img.offsetHeight) return;
          const top = Math.round(img.getBoundingClientRect().bottom - host.getBoundingClientRect().top - box.offsetHeight - 4);
          if (box.style.top !== top + 'px') Object.assign(box.style, { top: top + 'px', bottom: 'auto' });
        };
        if ((box ? box.dataset.sig : '') === sig) { onImg(); continue; }
        if (!labels.length) { box.remove(); continue; }
        if (!box) {
          if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
          box = el('div', { class: 'dlcp' });
          host.append(box);
          if (img && !img.complete) img.addEventListener('load', onImg, { once: true });
        }
        box.dataset.sig = sig;
        box.replaceChildren(...labels.map((l) => el('b', { class: tone }, l)));
        onImg();
      }
      if (need.length) coupon.checkSoon(need);
    },
  };

  /* ========== 7.6 fav: 카드 ♥(사이트 즐겨찾기) ==========
     내 즐겨찾기 품번 목록 GET /girls/load/favorite/product(약 1.3KB, 10분에 한 번, 목록 화면에서만). 로그아웃이면 ♥를 안 보인다.
     누르면 POST /{층}/cart/ajax mode=wishlist(추가)·wishlist_remove(빼기), obj_nocheck=1, product_id(사이트 코드, 2026-11-01 사용자가 ☆를 눌러 본 요청). 누를 때만 1번.
     폴더 고르기(꾹)는 폴더로 옮길 때 쓰는 번호가 즐겨찾기 화면을 그린 뒤에만 생겨서 아직 없음. */
  const FAV_TTL = 10 * 60 * 1000;
  const fav = {
    c: null,
    get() { if (!fav.c) fav.c = store.get('fav1', null) || { t: 0, ok: false, ids: [] }; return fav.c; },
    // 로그아웃이어도 빈 목록({favorites:[]})이 온다(2026-11-01 확인). 목록이 있거나 로그인 표시(로그아웃 링크·쿠키 dlloginjp)가 있을 때만 ♥
    ok() { const c = fav.get(); return !!c.ok && (c.ids.length > 0 || fav.login()); },
    _lg: [0, false],
    login() { if (Date.now() - fav._lg[0] > 2000) fav._lg = [Date.now(), !!document.querySelector('a[href*="/logout"]') || /(?:^|; )dlloginjp=/.test(document.cookie)]; return fav._lg[1]; },
    has(id) { return fav.get().ids.includes(id); },
    save(c) { fav.c = c; store.set('fav1', c); },
    _busy: false,
    refresh() {
      const c = fav.get();
      if (fav._busy || Date.now() - c.t < (c.ok ? FAV_TTL : NET_COOL_MS) || !net.ok()) return;
      fav._busy = true;
      fav.save({ ...c, t: Date.now() });
      netFetch('https://www.dlsite.com/girls/load/favorite/product', { credentials: 'include', headers: XHR }, 'text')
        .then((t) => {
          let j = null;
          try { j = JSON.parse(t); } catch (e) { /* 로그아웃이면 HTML */ }
          net.good();
          const ids = j && Array.isArray(j.favorites) ? j.favorites.filter((x) => typeof x === 'string') : null;
          fav.save({ t: Date.now(), ok: !!ids, ids: ids || [] });
        })
        .catch(() => { /* 다음에 */ })
        .finally(() => { fav._busy = false; locale.enforce(false); list.scheduleApply(50); });
    },
    toggle(id, card, btn) {
      if (btn.disabled) return;
      const on = fav.has(id);
      const a = card.querySelector('a[href*="/product_id/"]');
      const fl = (((a && a.href.match(/dlsite\.com\/([^/]+)\//)) || [])[1] || route.floor()).replace(/-touch$/, '');
      btn.disabled = true;
      netFetch(`https://www.dlsite.com/${fl}/cart/ajax`, {
        method: 'POST', credentials: 'include',
        headers: { ...XHR, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: new URLSearchParams({ mode: on ? 'wishlist_remove' : 'wishlist', obj_nocheck: '1', product_id: id }).toString(),
      }, 'text')
        .then(() => { net.good(); const c = fav.get(); fav.save({ ...c, ids: on ? c.ids.filter((x) => x !== id) : [id, ...c.ids.filter((x) => x !== id)] }); })
        .catch(() => { btn.classList.add('err'); setTimeout(() => btn.classList.remove('err'), 1200); })
        .finally(() => { btn.disabled = false; locale.enforce(false); list.scheduleApply(0); });
    },
  };

  /* ========== 7.7 sbox: 사이트 검색창 아래 목록(정리안3) ==========
     빈 검색창을 누르면 저장한 검색(사이트 마이페이지, 열 때만·1시간에 1번) · 자주 쓰는 태그(☆) · 최근 검색.
     글자를 치면 태그 후보(한국어·일본어 이름, 목록은 kw가 받은 것) → 누르면 태그 번호로 검색(언어와 상관없이 같은 결과). 맨 아래는 그 글자로 검색. */
  const SAVED_TTL = 3600 * 1000;
  const saved = {
    list() { const c = store.get('saved1', null); return c && Array.isArray(c.list) ? c.list : []; },
    refresh() {
      const c = store.get('saved1', null);
      if ((c && Date.now() - c.t < SAVED_TTL) || !net.ok()) return Promise.resolve(false);
      store.set('saved1', { t: Date.now(), list: saved.list() });
      return fetchDoc('https://www.dlsite.com/girls-touch/mypage/searchword', 'include').then(({ doc }) => {
        const touch = /-touch$/.test(location.pathname.split('/')[1] || '');
        const list = [];
        for (const li of doc.querySelectorAll('li._favorite_item')) { // 2026-11-01 사용자 계정에서 확인: dt.work_thumb > a[href=검색 주소][title=이름]
          const a = li.querySelector('dt a[href*="/fsr/"]');
          const u = a && safeUrl(a.getAttribute('href'));
          if (!u) continue;
          if (!touch) u.pathname = u.pathname.replace(/^\/([^/]+)-touch\//, '/$1/');
          list.push([(a.getAttribute('title') || a.textContent || '').trim().slice(0, 30) || '검색', u.href]);
        }
        store.set('saved1', { t: Date.now(), list });
        return true;
      }).catch(() => false).finally(() => locale.enforce(false));
    },
  };
  const tags = {
    favIds() { const v = store.get('tags.fav', []); return Array.isArray(v) ? v : []; },
    favs() { const m = new Map(kw.list().map((x) => [x[0], x])); return tags.favIds().map((n) => m.get(n)).filter(Boolean); },
    toggleFav(n) { const f = tags.favIds(); store.set('tags.fav', f.includes(n) ? f.filter((x) => x !== n) : [...f, n]); },
    // 이름(한국어·일본어)에 친 글자가 든 태그, 앞에서 맞는 것부터 8개
    find(v) {
      const q = v.replace(/\s+/g, '').toLowerCase();
      if (!q) return [];
      const sc = (t) => { const i = t.replace(/\s+/g, '').toLowerCase().indexOf(q); return i < 0 ? 9 : i ? 1 : 0; };
      return kw.list().map((x) => [Math.min(sc(x[1]), sc(x[2])), x]).filter(([n]) => n < 9).sort((a, b) => a[0] - b[0]).slice(0, 8).map(([, x]) => x);
    },
    // 태그 번호로 검색: 검색 화면이면 지금 조건에 더하고(태그끼리는 '그리고') 검색어는 뺀다, 아니면 새 검색
    go(n) {
      const p = location.pathname, pp = route.isSearch(p) && pathPairs(p);
      if (BULK_PAGE.test(p)) {
        const u = new URL(location.href);
        const gs = [...u.searchParams.keys()].filter((x) => /^genre\[\d*\]$/.test(x));
        if (gs.some((x) => u.searchParams.get(x) === n)) return;
        u.searchParams.delete('page');
        u.searchParams.set(`genre[${gs.length}]`, n);
        location.assign(u.href);
        return;
      }
      if (pp) {
        const gs = pp.pairs.filter((x) => segKey(x[0]) === 'genre');
        if (gs.some((x) => x[1] === n)) return;
        const np = pathSet(p, ['keyword', 'page'], [[`genre%5B${gs.length}%5D`, n]]);
        const u = new URL(location.href); u.pathname = np; location.assign(u.href);
      } else location.assign(`https://www.dlsite.com/${location.pathname.split('/')[1] || 'girls'}/fsr/=/language/jp/genre%5B0%5D/${n}`);
    },
  };
  const sbox = {
    seen: new WeakSet(),
    recent() { const v = store.get('search.recent2', []); return Array.isArray(v) ? v : []; },
    remember(t) { if (t && !/\|/.test(t)) store.set('search.recent2', [t, ...sbox.recent().filter((x) => x !== t)].slice(0, 10)); },
    attach() {
      for (const inp of document.querySelectorAll('input[name=keyword]')) {
        if (sbox.seen.has(inp) || inp.closest(OURS)) continue;
        sbox.seen.add(inp);
        const open = () => sbox.open(inp);
        inp.addEventListener('focus', open);
        inp.addEventListener('click', open);
        inp.addEventListener('input', () => { if (sheet.node && !sheet.node.hidden && sheet.opener === inp) { const ps = sbox.parts(inp); if (ps.length) sheet.redraw(ps); else sheet.close(); } else open(); });
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') sheet.close(); });
      }
    },
    open(inp) {
      if (sheet.node && !sheet.node.hidden && sheet.opener === inp) return;
      const ps = sbox.parts(inp);
      if (ps.length) sheet.show(ps, inp, { noBack: true });
      if (!inp.value.trim()) saved.refresh().then((did) => { if (did && document.activeElement === inp && !inp.value.trim()) { const p2 = sbox.parts(inp); if (p2.length) { if (sheet.node && !sheet.node.hidden && sheet.opener === inp) sheet.redraw(p2); else sheet.show(p2, inp, { noBack: true }); } } });
    },
    submit(inp) { const f = inp.form; if (f && f.requestSubmit) f.requestSubmit(); else if (f) f.submit(); },
    parts(inp) {
      const v = inp.value.trim();
      const chips = (xs) => el('div', { class: 'chips' }, xs);
      if (!v) {
        const out = [];
        const sv = saved.list(), ft = tags.favs(), rc = sbox.recent();
        if (sv.length) out.push(sheet.sec('저장한 검색'), chips(sv.map(([t, u]) => el('a', { class: 'chip sv', href: u }, t))));
        if (ft.length) out.push(sheet.sec('자주 쓰는 태그'), chips(ft.map(([n, ko]) => el('button', { class: 'chip', onclick: () => { sheet.close(); tags.go(n); } }, '#' + ko))));
        if (rc.length) out.push(sheet.sec('최근'), chips(rc.map((t) => el('button', { class: 'chip', onclick: () => { inp.value = t; sheet.close(); sbox.submit(inp); } }, t))));
        return out;
      }
      const fs = tags.favIds();
      const rows = tags.find(v).map(([n, ko, ja]) => {
        const st = el('button', { class: 'st' + (fs.includes(n) ? ' on' : ''), 'aria-label': '자주 쓰는 태그', 'aria-pressed': String(fs.includes(n)), onclick: (e) => { e.stopPropagation(); tags.toggleFav(n); sheet.redraw(sbox.parts(inp)); } }, fs.includes(n) ? '★' : '☆');
        return el('div', { class: 'li tr' }, el('button', { class: 'tb', onclick: () => { sheet.close(); tags.go(n); } }, el('span', { class: 'pt' }, '#' + ko), ko !== ja ? el('span', { class: 'ps' }, ja) : null), st);
      });
      return [...rows, el('button', { class: 'li all', onclick: () => { sheet.close(); sbox.submit(inp); } }, icon('sr'), el('span', { class: 'pt' }, `'${v}' 전체 검색`))];
    },
  };

  /* ========== 7.5 sheet: 바 바로 아래 팝업(쿠폰·할인·언어·층·검색창 목록) ==========
     바깥(투명 막)을 누르면 닫힌다. 화면을 어둡게 덮지 않는다. */
  const sheet = {
    node: null,
    back: null,
    opener: null,
    onClose: null,
    at: 0,
    close() {
      if (!sheet.node || sheet.node.hidden) return;
      sheet.node.hidden = true;
      sheet.back.hidden = true;
      const f = sheet.onClose;
      sheet.onClose = null;
      if (sheet.opener && !sheet.opener.matches('input')) sheet.opener.focus(); // 검색창이면 포커스를 돌려주지 않는다(다시 열림)
      if (f) f();
    },
    ensure() {
      if (sheet.node) return;
      sheet.back = el('div', { id: 'dlsheet-back', hidden: '', onclick: () => { if (Date.now() - sheet.at > 300) sheet.close(); } });
      sheet.node = el('div', { id: 'dlsheet', role: 'dialog', 'aria-label': '선택', hidden: '' });
      sheet.node.addEventListener('keydown', (e) => { if (e.key === 'Escape') sheet.close(); });
      document.documentElement.append(sheet.back, sheet.node);
      // 막 없이 연 팝업(검색창 목록)은 팝업·검색창 칸 바깥을 누르면 닫는다(사이트 검색 버튼은 그대로 눌리게)
      document.addEventListener('pointerdown', (e) => { if (!sheet.node.hidden && sheet.outside && !sheet.node.contains(e.target) && !sheet.outside.contains(e.target)) sheet.close(); }, true);
      const vv = window.visualViewport;
      if (vv) { vv.addEventListener('resize', sheet.fit); vv.addEventListener('scroll', sheet.fit); }
      window.addEventListener('scroll', sheet.fit, { passive: true });
    },
    // 바 바로 아래에(바가 화면 위로 지나갔으면 화면 맨 위에). 키보드가 올라오면 보이는 높이 안에서만
    fit() {
      if (!sheet.node || sheet.node.hidden) return;
      const bar = sheet.opener && (sheet.opener.closest('#dlbar') || sheet.opener); // 바 또는 검색창 아래
      const vv = window.visualViewport;
      const vTop = vv ? vv.offsetTop : 0, vH = vv ? vv.height : innerHeight;
      const top = Math.max(vTop + 8, bar ? Math.round(bar.getBoundingClientRect().bottom) + 6 : vTop + 8);
      sheet.node.style.top = top + 'px';
      sheet.node.style.maxHeight = Math.max(160, Math.round(vTop + vH - top - 10)) + 'px';
    },
    show(parts, opener, opt = {}) {
      sheet.ensure();
      if (!sheet.node.hidden) { sheet.onClose = null; sheet.close(); } // 다른 팝업이 열려 있었으면 닫고(보낼 것 없이)
      sheet.opener = opener;
      sheet.onClose = opt.onClose || null;
      sheet.outside = opt.noBack ? opener.closest('form') || opener : null;
      sheet.at = Date.now();
      sheet.node.replaceChildren(...parts.filter(Boolean));
      sheet.node.hidden = false;
      sheet.back.hidden = !!opt.noBack;
      sheet.fit();
      if (opt.focus) sheet.node.querySelector(opt.focus)?.focus();
    },
    // 내용만 바꾼다(열린 채로)
    redraw(parts) { sheet.node.replaceChildren(...parts.filter(Boolean)); sheet.fit(); },
    sec: (t) => el('div', { class: 'sec' }, t),
    opt(text, on, onclick) { return el('button', { class: 'op' + (on ? ' on' : ''), 'aria-pressed': String(!!on), onclick }, text); },
    // 할인: 위 할인율(이 쪽 안에서 거르기), 아래 정렬(사이트, 검색 주소에서만). 할인율은 누르면 바로 적용하고 창은 열어 둔다
    openSale(opener, withSort, pickRate, pickSort) {
      const S = list.state;
      const draw = () => {
        const cur = S.sale || S.rate ? S.rate : -1;
        const so = siteOrder();
        return [
          sheet.sec('할인율'),
          el('div', { class: 'g4' }, ...RATE_STEPS.map((v) => sheet.opt(v ? `${v}%↑` : '할인중', cur === v, () => { pickRate(v); sheet.redraw(draw()); }))),
          withSort ? sheet.sec('정렬') : null,
          withSort ? el('div', { class: 'g2' }, ...SALE_SORTS.filter(([v]) => !/^c/.test(v) || S.sale).map(([v, t]) => sheet.opt(t, so === v, () => { sheet.close(); pickSort(v); }))) : null,
        ];
      };
      sheet.show(draw(), opener);
    },
    openCoupons(opener, pick) {
      const cur = list.state.coupon;
      const num = (c, i) => parseFloat(coupon.rate(c.id).split('~').slice(i)[0]) || 0; // i=-1 최고율, 0 최저율
      const items = [...coupon.list()].sort((a, b) => (num(b, -1) - num(a, -1)) || (num(b, 0) - num(a, 0)));
      const fmt = (ms) => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()}까지`; };
      const row = (id, big, title, sub, tone) => el('button', { class: 'li' + (cur === id ? ' on' : ''), 'aria-pressed': String(cur === id), onclick: () => { sheet.close(); pick(id); } },
        el('span', { class: 'pr ' + tone }, big),
        el('span', { class: 'pb' }, el('span', { class: 'pt' }, title), sub ? el('span', { class: 'ps' }, sub) : null),
        cur === id ? icon('ck') : null);
      const tone = (r) => toneOf(Math.max(0, ...(r.match(/\d+/g) || []).map(Number)));
      const parts = [row('*', '전체', '가진 쿠폰 아무거나', items.length ? `쿠폰 ${items.length}종` : '', 'c0')];
      for (const c of items) {
        const r = coupon.rate(c.id);
        parts.push(row(c.id, r ? r + '%' : '쿠폰', c.title || (r ? r + '% 쿠폰' : '쿠폰'), c.until ? fmt(c.until) : '', tone(r)));
      }
      sheet.show(parts, opener);
    },
    // 묶음 할인 검색: 입력칸 + 태그 후보. Enter = 그 글자로(한국어 태그 이름이면 일본어도 '또는'), 후보 = 태그 번호
    openBulk(opener, q) {
      const inp = el('input', { type: 'search', class: 'tin', value: q, enterkeyhint: 'search', 'aria-label': '묶음 할인 안에서 검색' });
      const list = el('div', {});
      const run = () => {
        const v = inp.value.trim();
        const u = new URL(location.href);
        u.searchParams.delete('page');
        if (v) { sbox.remember(v); u.searchParams.set('keyword', kw.expand(v) || v); } else u.searchParams.delete('keyword');
        sheet.close();
        location.assign(u.href);
      };
      const draw = () => {
        const v = inp.value.trim();
        list.replaceChildren(...(v ? tags.find(v) : tags.favs()).map(([n, ko, ja]) => el('button', { class: 'li', onclick: () => { sheet.close(); tags.go(n); } },
          el('span', { class: 'pb' }, el('span', { class: 'pt' }, '#' + ko), ko !== ja ? el('span', { class: 'ps' }, ja) : null))));
        sheet.fit();
      };
      inp.addEventListener('input', draw);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
      sheet.show([el('label', { class: 'sin' }, icon('sr'), inp), list], opener, { focus: '.tin' });
      draw();
    },
    // 층: 대상·형식 여러 개. 닫을 때 처음과 다르면 pick
    openFloor(opener, cur, pick) {
      const sel = { sex_category: [...cur.sex_category], work_category: [...cur.work_category] };
      const draw = () => FLOORS.flatMap(([k, vs], i) => [sheet.sec(i ? '형식' : '대상'), el('div', { class: i ? 'g3' : 'g2' }, vs.map(([v, t]) => sheet.opt(t, sel[k].includes(v), () => {
        sel[k] = sel[k].includes(v) ? sel[k].filter((x) => x !== v) : [...sel[k], v];
        sheet.redraw(draw());
      })))]);
      sheet.show(draw(), opener, { onClose: () => { if (FLOORS.some(([k]) => sel[k].join() !== cur[k].join())) pick(sel); } });
    },
    // 언어: 여러 개. 닫을 때 처음과 다르면 pick(새 목록)
    openLang(opener, cur, pick) {
      const sel = new Set(cur);
      const draw = () => LANGS.map(([v, t]) => el('button', { class: 'li', role: 'checkbox', 'aria-checked': String(sel.has(v)), onclick: () => { if (sel.has(v)) sel.delete(v); else sel.add(v); sheet.redraw(draw()); } },
        el('span', { class: 'bx' }, icon('ck')), el('span', { class: 'pt' }, t)));
      sheet.show(draw(), opener, { onClose: () => {
        const v = LANGS.map((x) => x[0]).filter((k) => sel.has(k));
        if (v.join() !== cur.join()) pick(v);
      } });
    },
  };
  /* ========== 8. voice (성우 수집 및 캐시) ==========
     - 음성 작품(.work_category.type_SOU) 카드에는 성우 링크(.author a[keyword_creater])가 있다. 그 이름을 쓰고 요청하지 않는다
       (2026-11-01 검색 결과 3개를 product.json voice_by와 대조해 같음). 성우가 둘 이상이면 카드엔 첫 명만 있고 .author.omit이라 그때만 받는다.
     - 만화·CG·노벨 같은 형식(NO_VOICE_TYPE)은 받지 않는다. 형식 표시가 없는 카드(이벤트 목록 등)는 예전처럼 받는다.
     - 요청 대상은 항상 화면에 보이는 카드뿐이다. 서버 요청 수를 늘리지 않기 위함.
     - GM_setValue는 5초 디바운스로 묶고, 페이지 이탈(visibilitychange / pagehide) 시 즉시 저장한다. */
  const VA_KEY = 'vaCache3';
  const VA_KEY_OLD = 'vaCache2';
  const VA_MAX = 3000;
  const CP_KEY = 'cpCache3'; // 작품별 쿠폰 키(가진 쿠폰 것만)와 묶음 할인 키 { 작품id: { t: 받은 시각, k: '키|키', b: '묶음 키' } }, COUPON_TTL 동안 유효
  const CP_MAX = 1500;
  const CV_HINT = /CV|ＣＶ|C\.V|声優|声の出演|성우/i;
  const CV_LABEL = /(?<![A-Za-z])(?:CV|ＣＶ|C\.V\.?|声優|声の出演|성우)[ \t\u3000]*[:：][ \t\u3000]*([^\n\r<>()（）【】\[\]「」『』]{1,80})/gi;
  const CV_SKIP = /^(?:未定|なし|無し|不明|非公開|秘密|tba|tbd|none|n\/a|[-―ー—]+)$|後日|発表|公開|決定|予定|お楽しみ|お知らせ/i;
  const plainText = (t) => t
    .replace(/<br\s*\/?>|<\/(?:p|div|li|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
  function vaFromText(json) {
    const texts = [];
    const walk = (v, d) => {
      if (typeof v === 'string') { if (v.length < 20000 && CV_HINT.test(v)) texts.push(v); }
      else if (v && typeof v === 'object' && d < 4) for (const k of Object.keys(v)) walk(v[k], d + 1);
    };
    walk(json, 0);
    const names = [];
    for (const t of texts) {
      for (const m of plainText(t).matchAll(CV_LABEL)) {
        for (let n of splitVa(m[1].split(/[。！!？?※★☆■◆●▼]/)[0])) {
          n = n.replace(/(?:様|さん|氏)$/, '').trim();
          if (n && n.length <= 30 && !CV_SKIP.test(n) && !names.includes(n)) names.push(n);
        }
      }
    }
    return names.slice(0, 8);
  }
  const voice = {
    cpTimer: null,
    cache: null,
    vaDirty: false,
    saveTimer: null,
    cpCache: null,
    cpDirty: false,

    ensureCpCache() {
      if (!voice.cpCache) voice.cpCache = store.get(CP_KEY, null) || {};
      return voice.cpCache;
    },
    // 쿠폰 키 목록. 받은 적 없거나 오래됐으면 null
    couponsFor(id) {
      const c = voice.ensureCpCache()[id];
      return c && Date.now() - c.t < COUPON_TTL ? (c.k ? c.k.split('|') : []) : null;
    },
    bulkFor(id) { const c = voice.ensureCpCache()[id]; return c && Date.now() - c.t < COUPON_TTL ? c.b || '' : null; },
    putCoupons(id, keys, bulk) {
      const cc = voice.ensureCpCache();
      delete cc[id];
      cc[id] = bulk ? { t: Date.now(), k: keys.join('|'), b: bulk } : { t: Date.now(), k: keys.join('|') };
      const ids = Object.keys(cc);
      if (ids.length > CP_MAX + 50) {
        for (let i = 0; i < ids.length - CP_MAX; i++) delete cc[ids[i]];
      }
      voice.cpDirty = true;
      clearTimeout(voice.cpTimer);
      voice.cpTimer = setTimeout(() => voice.flushSaves(), VA_SAVE_DEBOUNCE_MS);
    },

    // 카드에 있는 성우: { names, more(첫 명만 있음), need(받아야 함) }. 성우 표시를 끄면 null
    fromCard(card) {
      if (!opt('showVA')) return null;
      const t = card.querySelector('.work_category');
      const type = t ? t.className : '';
      if (NO_VOICE_TYPE.test(type)) return { names: [], more: false, need: false };
      if (!/\btype_SOU\b/.test(type)) return { names: [], more: false, need: true };
      const names = [];
      for (const a of card.querySelectorAll('.author a[href*="/keyword_creater/"]')) {
        const m = (a.getAttribute('href') || '').match(/\/keyword_creater\/([^/?#]+)/);
        let n = '';
        try { n = m ? decodeURIComponent(m[1]).replace(/^"|"$/g, '') : ''; } catch (e) { /* 잘못된 주소 */ }
        n = n || a.textContent.trim(); // 주소 속 이름은 자동 번역돼도 원래 일본어
        if (n && !names.includes(n)) names.push(n);
      }
      const more = !!card.querySelector('.author.omit');
      return { names, more, need: !names.length || more };
    },

    ensureVaCache() {
      if (!voice.cache) {
        voice.cache = store.get(VA_KEY, null);
        if (!voice.cache) {
          voice.cache = {};
          for (const [k, v] of Object.entries(store.get(VA_KEY_OLD, null) || {})) if (v && v !== '-') voice.cache[k] = v;
          store.set(VA_KEY, voice.cache);
          store.set(VA_KEY_OLD, {});
        }
      }
      return voice.cache;
    },
    getCached(id) {
      return voice.ensureVaCache()[id] || null;
    },
    // 받아 온 성우가 있으면(없음 '-'도 기록) 다시 받지 않는다
    hasVa(id) {
      return !!voice.getCached(id);
    },
    putCached(id, name) {
      const vc = voice.ensureVaCache();
      delete vc[id];
      vc[id] = name;
      const keys = Object.keys(vc);
      if (keys.length > VA_MAX + 50) {
        for (let i = 0; i < keys.length - VA_MAX; i++) delete vc[keys[i]];
      }
      voice.vaDirty = true;
      clearTimeout(voice.saveTimer);
      voice.saveTimer = setTimeout(() => voice.flushSaves(), VA_SAVE_DEBOUNCE_MS);
    },

    flushSaves() {
      clearTimeout(voice.saveTimer);
      clearTimeout(voice.cpTimer);
      if (voice.vaDirty && voice.cache) {
        voice.vaDirty = false;
        store.set(VA_KEY, voice.cache);
      }
      if (voice.cpDirty && voice.cpCache) {
        voice.cpDirty = false;
        store.set(CP_KEY, voice.cpCache);
      }
    },

    queue: [],
    busy: 0,
    dead: new Set(),   // 다시 시도해도 소용없는 작품(404/410, 인증 필요)
    pausedUntil: 0,    // 인증 필요 등으로 잠시 멈춘 시각
    _resume: 0,
    stat: { ok: 0, none: 0, err: 0, why: '' },

    fetchVa(id, href) {
      const fl = ((href.match(/dlsite\.com\/([^/]+)\//) || [])[1] || route.floor()).replace(/-touch$/, '');
      return netFetch(`https://www.dlsite.com/${fl}/api/=/product.json?workno=${encodeURIComponent(id)}`, { credentials: 'include' }, 'text')
        .catch((e) => { if (e && (e.status === 404 || e.status === 410)) e.noRetry = true; throw e; })
        .then((t) => {
          let j;
          try { j = JSON.parse(t); } catch (e) {
            const er = new Error('성인 인증 필요: dlsite.com에서 한 번 인증해 주세요');
            er.noRetry = true; er.pause = true;
            throw er;
          }
          net.good();
          const w = Array.isArray(j) ? j[0] : j;
          let names = ((w && w.creaters && w.creaters.voice_by) || []).map((x) => x.name).filter(Boolean);
          if (!names.length && w) names = vaFromText(w);
          return names.length ? names.join(' / ') : '-';
        })
        .finally(() => locale.enforce(false));
    },

    // 우선순위 선택:
    // 1순위: 현재 화면에 보이고(vis) 숨겨지지 않은 카드
    // 2순위: 화면 근처로 들어와 있지만 숨겨진 카드(쿠폰 거르기를 풀면 곧 보일 카드)
    // 화면 밖 카드는 받지 않는다.
    pickNextJobIndex() {
      const idx = voice.queue.findIndex((j) => voice.vis.has(j.card) && j.card.style.display !== 'none');
      if (idx >= 0) return idx;
      return voice.queue.findIndex((j) => voice.vis.has(j.card));
    },

    pump() {
      const wait = Math.max(net.ok() ? 0 : net.until - Date.now(), voice.pausedUntil - Date.now());
      if (wait > 0) {
        voice.stat.why = net.ok() ? '인증 필요: 잠시 쉬는 중' : '서버가 제한해서 30분 쉬는 중';
        clearTimeout(voice._resume);
        voice._resume = setTimeout(voice.pump, wait + 1000);
        return;
      }
      voice.queue = voice.queue.filter((j) => j.card.isConnected && !voice.hasVa(j.id) && !voice.dead.has(j.id) && (voice.tries[j.id] || 0) < 3);
      while (voice.busy < VA_PARALLEL) {
        const k = voice.pickNextJobIndex();
        if (k < 0) break;
        const job = voice.queue.splice(k, 1)[0];
        const { id, url } = job;
        voice.busy++;
        voice.fetchVa(id, url)
          .then((name) => {
            voice.stat[name === '-' ? 'none' : 'ok']++;
            voice.putCached(id, name);
            if (name !== '-') list.scheduleApply(150);
          })
          .catch((e) => {
            voice.stat.err++;
            voice.stat.why = String((e && e.message) || e);
            if (e && e.pause) voice.pausedUntil = Date.now() + 5 * 60 * 1000;
            if (e && e.noRetry) { voice.dead.add(id); return; }
            voice.tries[id] = (voice.tries[id] || 0) + 1;
            if (voice.tries[id] < 3) voice.queue.push(job);
          })
          .finally(() => {
            setTimeout(() => {
              voice.busy--;
              voice.pump();
              if (!voice.busy) list.scheduleApply(100);
            }, VA_GAP_MS);
          });
      }
    },

    load() {
      if (!opt('showVA') || !route.isList(location.pathname)) return;
      for (const card of list.items()) {
        if (card.dataset.dlva) continue;
        const a = card.querySelector('a[href*="/product_id/"]');
        const id = a && pidOf(a.href);
        if (!id) continue;
        card.dataset.dlva = '1';
        if (voice.hasVa(id)) continue;
        const cv = voice.fromCard(card);
        if (cv && !cv.need) continue; // 카드에 성우가 다 있거나(음성) 성우가 없는 형식(만화 등)이면 받지 않는다
        voice.jobs.set(card, { card, id, url: a.href.split('?')[0] });
        voice.io().observe(card); // 화면에 들어올 때만 큐에 들어간다
      }
    },

    jobs: new WeakMap(),
    vis: new Set(),
    tries: {},
    _io: null,
    io() {
      if (voice._io) return voice._io;
      const enter = (card) => {
        voice.vis.add(card);
        const job = voice.jobs.get(card);
        if (job && !voice.queue.includes(job) && !voice.hasVa(job.id) && !voice.dead.has(job.id) && (voice.tries[job.id] || 0) < 3) voice.queue.push(job);
      };
      if (!('IntersectionObserver' in window)) return (voice._io = { observe: (c) => { enter(c); voice.pump(); } });
      voice._io = new IntersectionObserver((entries) => {
        for (const en of entries) { if (en.isIntersecting) enter(en.target); else voice.vis.delete(en.target); }
        voice.pump();
      }, { rootMargin: '300px 0px' });
      return voice._io;
    },
  };

  // 탭을 닫거나 이동할 때 미저장된 성우·태그 캐시를 즉시 기록
  window.addEventListener('pagehide', () => voice.flushSaves());
  document.addEventListener('visibilitychange', () => { if (document.hidden) voice.flushSaves(); });

  /* ========== 9. 일본어 화면에서 가져오는 것들 ========== */
  const stripFloor = () => (STRIP_FLOORS.includes(route.floor()) ? route.floor() : 'girls');
  const cached = (key, make) => {
    const c = store.get(key, null);
    if (c && Date.now() - c.t < CACHE_MS) return Promise.resolve(c.list);
    return make().then((v) => { store.set(key, { t: Date.now(), list: v }); return v; });
  };
  const imgUrl = (img) => {
    if (!img) return '';
    for (const k of ['src', 'data-src', 'data-original', 'data-lazy-src', 'srcset', 'data-srcset']) {
      const v = (img.getAttribute(k) || '').trim().split(/\s+/)[0];
      if (!v || /^data:/.test(v) || /blank|spacer|1x1/i.test(v)) continue;
      const u = safeUrl(v) || (() => { try { const x = new URL(v, 'https://www.dlsite.com'); return x.protocol === 'https:' ? x : null; } catch (e) { return null; } })();
      if (u) return u.href;
    }
    return '';
  };

  const topDocs = {};
  const jaTop = (f) => (topDocs[f] = topDocs[f] || jaFetch(`https://www.dlsite.com/${f}/`));

  function parseSaleBanners(doc) {
    const out = [];
    const byKey = new Map();
    for (const a of doc.querySelectorAll('a[href]')) {
      const u = safeUrl(a.getAttribute('href'));
      if (!u || /\/mypage\/|\/work\/|\/ranking\//.test(u.pathname)) continue;
      const img = a.querySelector('img');
      const src = imgUrl(img);
      const t = ((img && img.alt) || a.title || a.textContent || '').trim().replace(/\s+/g, ' ');
      const isCamp = /\/campaign\//.test(u.pathname);
      const hit = isCamp || KEEP_TEXT.test(t) || (src && KEEP_HREF.test(u.href) && BANNER_IMG.test(src));
      if (!hit || (!src && !isCamp) || (src && NOT_BANNER_IMG.test(src))) continue;
      const key = u.pathname + u.search.replace(/[?&](ai|site_group)[^&]*/g, '');
      const old = byKey.get(key);
      if (old) { if (!old.img && src) old.img = src; continue; }
      const item = { u: u.href, img: src, t: t.slice(0, 60) };
      byKey.set(key, item);
      out.push(item);
    }
    out.sort((a, b) => (b.img ? 1 : 0) - (a.img ? 1 : 0));
    return out.slice(0, 12);
  }
  function paintStrip(items) {
    document.getElementById('dlsale')?.remove();
    setText('dlh-st', `일본 할인 배너 ${items.length}개 (이미지 ${items.filter((x) => x.img).length}개)`);
    if (!items.length) return;
    const withImg = items.filter((x) => x.img);
    if (!withImg.length) return;
    const strip = el('div', { id: 'dlsale' }, withImg.map((x) =>
      el('a', { href: x.u, title: x.t }, el('img', { src: x.img, alt: x.t, referrerpolicy: 'no-referrer', loading: 'lazy' }))));
    for (const img of strip.querySelectorAll('img')) {
      img.addEventListener('load', () => {
        const r = img.naturalWidth / (img.naturalHeight || 1);
        if (r >= 2 && r <= 8) return;
        (img.closest('a') || img).remove();
        if (!strip.children.length) strip.remove();
      });
    }
    const spot = stripSpot();
    if (spot) spot.after(strip);
    else document.body.insertBefore(strip, document.body.firstChild);
  }
  function stripSpot() {
    const anchor = document.querySelector('input[type=search], input[name=keyword], form[action*="fs"]');
    let n = anchor && (anchor.closest('form') || anchor);
    while (n && n.parentElement && n !== document.body) {
      const p = n.parentElement;
      if (n.getBoundingClientRect().width > innerWidth * 0.6 && !/flex|grid/.test(getComputedStyle(p).display)) return n;
      n = p;
    }
    return null;
  }
  function loadStrip() {
    if (!opt('saleStrip') || sameLocale(locale.read(), 'ja_JP')) return;
    const f = stripFloor();
    cached('strip:' + f, () => jaTop(f).then(parseSaleBanners))
      .then(paintStrip)
      .catch((e) => setText('dlh-st', '일본 배너를 못 가져왔어요: ' + ((e && e.message) || '연결 실패')));
  }

  function parseEvents(doc) {
    const seen = new Set();
    const out = [];
    const sp = (s) => (s || '').trim().replace(/\s+/g, ' ');
    for (const a of doc.querySelectorAll('a[href*="/campaign/"]')) {
      const u = safeUrl(a.getAttribute('href'));
      if (!u || /\/campaign\/tutorial/.test(u.pathname) || seen.has(u.href)) continue;
      // 배너 링크의 글자는 마감 날짜뿐이고 이벤트 이름은 이미지 alt에 있다
      const alt = sp((a.querySelector('img') || {}).alt);
      const txt = sp(a.textContent);
      const dm = txt.match(/^(\d{1,2}\/\d{1,2})\s*(\d{1,2}:\d{2})\s*まで$/);
      const t = alt || txt;
      if (!t) continue;
      seen.add(u.href);
      out.push({ u: u.href, t: t.slice(0, 80), d: alt && dm ? `${dm[1]} ${dm[2]}まで` : '' });
    }
    return out;
  }
  function evBadges(t) {
    const s = t.replace(/％/g, '%');
    const badges = [];
    let max = -1;
    const unit = (u) => (u === '冊' ? '권' : '개');
    let nb = 0;
    for (const m of s.matchAll(/(\d{1,3})\s*(本|冊|点|作品|個)\s*(?:以上)?\s*(?:で|→)\s*(\d{1,2})\s*%/g)) { badges.push(`${m[1]}${unit(m[2])} ${m[3]}%`); max = Math.max(max, +m[3]); nb++; }
    const ns = nb ? [] : [...s.matchAll(/(\d{1,2})\s*%?\s*[~～〜]\s*(\d{1,2})\s*%|(\d{1,2})\s*%/g)]
      .flatMap((m) => (m[3] ? [+m[3]] : [+m[1], +m[2]])).filter((n) => n > 0 && n < 100);
    if (ns.length) {
      const lo = Math.min(...ns), hi = Math.max(...ns);
      max = hi;
      badges.push(/最大|最高|MAX|up\s*to|최대/i.test(s) ? `최대 ${hi}%` : lo === hi ? hi + '%' : lo + '~' + hi + '%');
    }
    for (const m of s.matchAll(/(\d{1,3})\s*(本|冊|点|作品|個)\s*(?:で|→)?\s*(\d[\d,]*)\s*円/g)) { badges.push(`${m[1]}${unit(m[2])} ${m[3]}엔`); nb++; }
    return { max, nb, badges };
  }
  function loadEvents(box) {
    box.textContent = '불러오는 중…';
    box.setAttribute('aria-busy', 'true');
    const f = route.floor();
    cached('events2:' + f, () => jaTop(f).then(parseEvents)) // events2: 이름(alt)·마감(d)을 담는 새 형식
      .then((items) => box.replaceChildren(...(items.length
        ? items.map((x, i) => ({ x, i, r: evBadges(x.t) })).sort((a, b) => (b.r.max - a.r.max) || (b.r.nb - a.r.nb) || (a.i - b.i)).map(({ x, r }) =>
          el('a', { class: 'ev', href: x.u }, r.badges.length ? el('span', { class: 'rts' }, r.badges.map((l) => el('span', { class: 'rt' }, l))) : null, el('span', { class: 'et' }, x.t, x.d ? el('i', {}, x.d) : null)))
        : [el('span', { class: 'mut' }, '이벤트를 찾지 못했어요')])))
      .catch((e) => { box.textContent = '불러오지 못했어요: ' + ((e && e.message) || '연결 실패'); })
      .finally(() => box.setAttribute('aria-busy', 'false'));
  }

  /* ========== 10. panel ========== */
  const CSS = `
#dlh,#dlbar,#dlsheet,.dlx,.dlw{--ink:#111;--sub:#555559;--faint:#8a8a90;--line:#dcdce0;--surface:#f2f2f3;--bg:#fff;--red:#e5322d;--acc:#185fa5;
  font-family:"Pretendard Variable",Pretendard,"Hiragino Sans","Noto Sans JP","Noto Sans KR","Apple SD Gothic Neo",system-ui,sans-serif}
#dlh *,#dlbar *,#dlsheet *{box-sizing:border-box}
#dlh button,#dlbar button,#dlsheet button{font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
#dlh :focus-visible,#dlbar :focus-visible,#dlsheet :focus-visible,.dlx :focus-visible,.dlw :focus-visible{outline:2px solid var(--acc);outline-offset:2px}

#dlbar{display:flex;gap:6px;align-items:center;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;
  position:relative;z-index:1;float:none;clear:both;flex:0 0 100%;grid-column:1/-1;width:auto;max-width:100%;margin:0;padding:6px 10px;
  background:var(--bg);border-bottom:1px solid var(--line);font-size:13px;line-height:1.2;color:var(--ink)}
#dlbar::-webkit-scrollbar{display:none}
#dlbar>*{flex:none;margin:0}
#dlbar .c{display:inline-flex;align-items:center;justify-content:center;gap:1px;height:34px;min-width:34px;padding:0 8px 0 12px;border:0;border-radius:8px;background:#eef0f3;color:#3c3f46;font-size:13.5px;font-weight:600;line-height:1;white-space:nowrap}
#dlbar .c svg{flex:none;width:18px;height:18px;fill:currentColor}
#dlbar .c.on{background:#e3ebfc;color:#1a56db;box-shadow:inset 0 0 0 1px #b9cdf5}
#dlbar .c.rs{width:34px;padding:0;font-size:18px;font-weight:700}
#dlbar .c[hidden]{display:none}
#dlbar .cnt{margin-left:auto;font-size:12px;color:var(--faint);white-space:nowrap;padding:0 2px}

.dlx{position:absolute;top:0;left:0;width:100%;height:100%;z-index:30;visibility:visible!important;opacity:1!important;display:block!important;overflow:hidden;box-sizing:border-box;pointer-events:none;font-size:12px;line-height:1.3}
.dlx *{box-sizing:border-box}
.dlx>*{pointer-events:auto}
.dlrow{display:flex!important;align-items:center;gap:6px;margin:4px 0 2px!important;padding:0 2px!important;min-height:26px;list-style:none;font:700 11px/1 "Pretendard Variable",Pretendard,system-ui,sans-serif;color:#555}
.dlrow .dlpn{white-space:nowrap;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.dlrow .dlpn.ok{color:#2e7d32}
.dlrow .dlcpn{display:inline-flex;align-items:center;gap:2px;color:#2f80d1;white-space:nowrap}
.dlrow .dlcpn svg{width:13px;height:13px;fill:currentColor}
.dlrow .dlcpn.c3{color:#e5322d}.dlrow .dlcpn.c2{color:#f07800}.dlrow .dlcpn.bk{color:#7b3fd1}
.dlrow .dlfav{flex:none;margin-left:auto;display:inline-flex;align-items:center;justify-content:center;width:30px;height:26px;padding:0;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
.dlrow .dlfav svg{width:20px;height:20px;fill:none;stroke:#9a9aa0;stroke-width:70}
.dlrow .dlfav.on svg{fill:#e8336d;stroke:#e8336d}
.dlrow .dlfav.err svg{stroke:#e5322d}
.dlrow .dlfav[disabled]{opacity:.5}
.dlx .dlbd{position:absolute;left:0;right:0;bottom:0;pointer-events:none;display:flex;align-items:center;justify-content:space-between;gap:4px;height:24px;padding:0 6px;background:rgba(20,20,24,.72)}
.dlx .dlbd.bare{left:auto;background:none}
.dlx .dlva{min-width:0;color:#fff;font-size:10px;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:auto;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.dlx .dlva.ok,.dlx .dlpn.ok{color:#7be08a}
.dlx .dlpn{flex:none;color:#fff;font-size:10px;font-weight:700;line-height:1;white-space:nowrap;pointer-events:auto;cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.dlx .dlw{visibility:visible!important;opacity:1!important;position:relative;flex:none;display:inline-flex;align-items:center;height:16px;margin:0 0 0 auto;padding:0 6px;border:0;border-radius:999px;background:#fff;color:#111;font-size:10px;font-weight:700;line-height:1;text-decoration:none;white-space:nowrap;pointer-events:auto;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.dlx .dlw::after{content:'';position:absolute;inset:-6px -6px}

.dlcp{position:absolute;left:4px;bottom:4px;z-index:5;display:flex;flex-wrap:wrap;gap:3px;pointer-events:none}
.dlcp b{display:inline-flex;align-items:center;height:16px;background:#e5322d;color:#fff;border-radius:999px;padding:0 6px;font:700 10px/1 system-ui,sans-serif;white-space:nowrap}
.dlcp b.c2{background:#f07800}.dlcp b.c1{background:#2f80d1}.dlcp b.c0{background:#888}


#dlsheet-back{position:fixed;inset:0;background:transparent;z-index:2147483001}
#dlsheet{position:fixed;left:10px;right:10px;z-index:2147483002;max-width:540px;margin:0 auto;padding:6px 0 10px;overflow:auto;background:var(--bg);color:var(--ink);border-radius:14px;box-shadow:0 0 0 1px rgba(0,0,0,.06),0 8px 28px rgba(0,0,0,.18);font-size:14.5px;line-height:1.3}
#dlsheet[hidden],#dlsheet-back[hidden]{display:none}
#dlsheet .sec{display:flex;align-items:center;justify-content:space-between;padding:10px 16px 6px;font-size:12px;font-weight:700;color:var(--faint)}
#dlsheet .g4,#dlsheet .g2{display:grid;gap:6px;padding:0 12px}
#dlsheet .g4{grid-template-columns:repeat(4,1fr)}
#dlsheet .g2{grid-template-columns:1fr 1fr}
#dlsheet .g3{display:grid;gap:6px;padding:0 12px;grid-template-columns:repeat(3,1fr)}
#dlsheet .chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px}
#dlsheet .chip{display:inline-flex;align-items:center;height:32px;max-width:100%;padding:0 12px;border:0;border-radius:8px;background:#eef0f3;color:#3c3f46;font-size:13.5px;font-weight:600;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:none}
#dlsheet .chip.sv{background:#fff3e0;color:#b45309}
#dlsheet .li.tr{padding:0 6px 0 0}
#dlsheet .tb{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-height:48px;justify-content:center;padding:6px 16px;border:0;background:none;color:var(--ink);text-align:left}
#dlsheet .st{flex:none;width:44px;height:44px;border:0;background:none;color:#b0b3ba;font-size:20px}
#dlsheet .st.on{color:#f5a400}
#dlsheet .li.all>svg{fill:var(--faint)}
#dlsheet .sin{display:flex;align-items:center;gap:8px;height:46px;margin:4px 12px;padding:0 12px;border:1.5px solid #c4c6cc;border-radius:10px}
#dlsheet .sin:focus-within{border-color:#1a56db}
#dlsheet .sin>svg{flex:none;width:20px;height:20px;fill:var(--faint)}
#dlsheet .tin{flex:1;min-width:0;height:100%;padding:0;border:0;background:none;color:var(--ink);font:inherit;font-size:16px;outline:0}
#dlsheet .op{display:flex;align-items:center;justify-content:center;height:42px;padding:0 6px;border:0;border-radius:8px;background:#eef0f3;color:#3c3f46;font-size:13.5px;font-weight:600;line-height:1.15;text-align:center}
#dlsheet .op.on{background:#e3ebfc;color:#1a56db;box-shadow:inset 0 0 0 1px #b9cdf5}
#dlsheet .li{display:flex;align-items:center;gap:12px;width:100%;min-height:48px;padding:6px 16px;border:0;background:none;color:var(--ink);text-align:left;line-height:1.25}
#dlsheet .li>svg{flex:none;width:20px;height:20px;fill:#1a56db}
#dlsheet .li.on .pt{color:#1a56db;font-weight:700}
#dlsheet .pr{flex:none;display:flex;align-items:center;justify-content:center;min-width:52px;height:30px;padding:0 6px;border-radius:7px;color:#fff;font-size:14px;font-weight:800;line-height:1}
#dlsheet .pr.c3{background:#e5322d}#dlsheet .pr.c2{background:#f07800}#dlsheet .pr.c1{background:#2f80d1}#dlsheet .pr.c0{background:#eef0f3;color:#3c3f46;font-size:12px}
#dlsheet .pb{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
#dlsheet .pt{font-size:14.5px;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#dlsheet .ps{font-size:12px;color:var(--faint)}
#dlsheet .bx{flex:none;display:flex;align-items:center;justify-content:center;width:20px;height:20px;border:2px solid #c4c6cc;border-radius:5px}
#dlsheet .bx svg{width:16px;height:16px;fill:#fff;visibility:hidden}
#dlsheet [aria-checked=true] .bx{background:#1a56db;border-color:#1a56db}
#dlsheet [aria-checked=true] .bx svg{visibility:visible}

#dlh{position:fixed;right:8px;bottom:calc(78px + env(safe-area-inset-bottom,0px));z-index:2147483000;font-size:14px;line-height:1.45;color:var(--ink)}
#dlh .fab{position:relative;z-index:1;width:56px;height:56px;padding:0;margin:0;border:0;display:flex;align-items:center;justify-content:center;text-align:center;text-indent:0;letter-spacing:0;line-height:1;border-radius:50%;background:var(--ink);color:#fff;font-size:15px;font-weight:700;opacity:1;outline:0;box-shadow:0 0 0 2px rgba(255,255,255,.9),0 4px 14px rgba(0,0,0,.35)}
#dlh .fab:focus,#dlh .fab:focus-visible{outline:0}
#dlh .bk{position:fixed;inset:0;z-index:2;background:rgba(12,14,20,.45);opacity:0;pointer-events:none;transition:opacity .25s}
#dlh.open .bk{opacity:1;pointer-events:auto}
#dlh .pnl{position:fixed;left:0;right:0;bottom:0;z-index:3;display:flex;flex-direction:column;max-width:560px;max-height:88vh;margin:0 auto;background:#fff;border-radius:24px 24px 0 0;box-shadow:0 -8px 28px rgba(0,0,0,.2);transform:translateY(100%);visibility:hidden;transition:transform .28s cubic-bezier(.2,.8,.2,1),visibility 0s .28s}
#dlh.open .pnl{transform:none;visibility:visible;transition:transform .28s cubic-bezier(.2,.8,.2,1)}
#dlh .grab{flex:none;width:36px;height:4px;margin:8px auto 0;border-radius:999px;background:#d4d4d8}
#dlh .hd{flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 4px 0 16px}
#dlh .hd b{font-size:16px;font-weight:700}
#dlh .x{width:40px;height:40px;border:0;border-radius:50%;background:none;color:var(--faint);font-size:18px}
#dlh .sc{flex:none;display:flex;gap:6px;padding:2px 16px 8px;overflow-x:auto;scrollbar-width:none}
#dlh .sc::-webkit-scrollbar{display:none}
#dlh .ch{flex:none;display:inline-flex;align-items:center;height:28px;padding:0 12px;border:1px solid var(--line);border-radius:999px;background:var(--bg);color:var(--sub);font-size:13px;font-weight:600;line-height:1;text-decoration:none;white-space:nowrap}
#dlh .bd{flex:1;min-height:0;overflow:auto;padding:0 16px calc(12px + env(safe-area-inset-bottom,0px));-webkit-overflow-scrolling:touch}
#dlh h4{margin:6px 0 4px;font-size:13px;color:var(--faint);font-weight:600}
#dlh h4:first-child{margin-top:0}
#dlh .row{display:flex;flex-wrap:wrap;gap:8px}
#dlh .c{height:40px;padding:0 15px;border:1px solid var(--line);border-radius:999px;background:var(--bg);color:var(--sub);font-size:14px;font-weight:600}
#dlh .c.on{background:var(--ink);border-color:var(--ink);color:#fff}
#dlh details.adv{margin:0;padding:0;border-bottom:1px solid var(--line)}
#dlh details.adv:last-child{border-bottom:0}
#dlh details.adv[open]{padding-bottom:6px}
#dlh details.adv>summary{user-select:none;-webkit-user-select:none;outline:0;display:flex;align-items:center;gap:8px;min-height:40px;font-size:13px;font-weight:700;color:var(--sub);cursor:pointer;list-style:none}
#dlh details.adv>summary::-webkit-details-marker{display:none}
#dlh details.adv>summary::before{content:'▶';font-size:11px;color:var(--faint);transition:transform .15s}
#dlh details.adv[open]>summary::before{transform:rotate(90deg)}
#dlh label{display:flex;gap:10px;align-items:center;min-height:40px;font-size:14px;color:var(--ink)}
#dlh button.tg{display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;min-height:0;margin:0;padding:9px 0;border:0;border-bottom:1px solid #f2f2f4;border-radius:0;background:none;font-size:14px;font-weight:500;color:var(--ink);text-align:left;cursor:pointer}
#dlh button.tg:last-child{border-bottom:0}
#dlh .tg .tl{flex:1;min-width:0}
#dlh .sw{position:relative;display:block;flex:none;width:40px;height:24px;border-radius:999px;background:#e3e3e6;transition:background .2s}
#dlh .kn{position:absolute;top:2px;left:2px;display:block;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.25);transition:transform .2s}
#dlh textarea.pref{display:block;width:100%;margin-top:4px;padding:10px 12px;border:0;border-radius:12px;background:#f4f4f5;color:var(--ink);font:inherit;font-size:15px;resize:vertical}
#dlh .evs{padding-bottom:6px;border-bottom:1px solid var(--line)}
#dlh .evs h4{margin:8px 0 2px;font-size:13px;font-weight:700;color:var(--sub)}
#dlh .evl{max-height:30vh;overflow:auto;-webkit-overflow-scrolling:touch}
#dlh a.ev{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);color:var(--ink);text-decoration:none;font-size:14px}
#dlh .mut{color:var(--faint);font-size:13px}
#dlh .ev .rts{flex:none;display:flex;flex-direction:column;gap:4px;align-items:stretch}
#dlh .ev .rt{min-width:64px;padding:5px 9px;border-radius:8px;background:var(--red);color:#fff;font-size:15px;font-weight:800;line-height:1.15;text-align:center;white-space:nowrap}
#dlh .ev .et{flex:1;min-width:0}
#dlh .ev .et i{display:block;font-style:normal;font-size:12px;color:var(--faint)}
#dlh .chl{margin:2px 0 6px}
#dlh .chr{display:flex;align-items:center;gap:10px;min-height:44px;border-bottom:1px solid #f2f2f4;background:#fff}
#dlh .chr.drag{box-shadow:0 4px 14px rgba(0,0,0,.18);position:relative;z-index:1}
#dlh .chr .hd2{flex:none;width:36px;height:40px;display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--faint);touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none}
#dlh .chr .tl{flex:1}
#dlh .chr button{height:32px;padding:0 12px;border:1px solid var(--line);border-radius:999px;background:var(--bg);color:var(--sub);font-size:13px;font-weight:600}
#dlh .chr button.on{background:#e3ebfc;border-color:#b9cdf5;color:#1a56db}

#dlsale{display:flex;align-items:flex-start;gap:8px;overflow-x:auto;width:100%;box-sizing:border-box;padding:8px 12px;margin:0;scrollbar-width:none;-webkit-overflow-scrolling:touch}
#dlsale::-webkit-scrollbar{display:none}
#dlsale a{flex:none;width:min(78vw,300px);display:block}
#dlsale img{width:100%!important;height:auto!important;max-width:none!important;display:block;border-radius:10px}
`;

  function buildPanel() {
    const root = el('div', { id: 'dlh' });
    const reload = () => location.reload();
    const applyLang = () => { locale.clearReloadGuards(); locale.write(locale.wantFor(location.pathname)); reload(); };
    const chk = (key, text, after) => {
      let on = !!opt(key);
      const kn = el('span', { class: 'kn' });
      const sw = el('span', { class: 'sw', 'aria-hidden': 'true' }, kn);
      const b = el('button', { class: 'tg', role: 'switch' }, el('span', { class: 'tl' }, text), sw);
      const paint = () => {
        b.setAttribute('aria-checked', String(on));
        sw.style.background = on ? '#34c759' : '#e3e3e6';
        kn.style.transform = on ? 'translateX(16px)' : 'translateX(0)';
      };
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        on = !on;
        store.set(key, on);
        paint();
        if (after === reload || after === applyLang) setTimeout(after, 250); else after();
      });
      paint();
      return b;
    };
    const evBox = el('div', { class: 'evl' });
    // 칩 순서·보이기: ≡를 끌어 순서, 오른쪽 버튼으로 보이기·숨기기. 바꾸면 바를 다시 그린다
    const chipList = el('div', { class: 'chl' });
    const remountBar = () => { document.getElementById('dlbar')?.remove(); list.mount(); };
    const paintChips = () => {
      const hid = chipHidden();
      chipList.replaceChildren(...chipOrder().map((k) => {
        const on = !hid.includes(k);
        const h = el('span', { class: 'hd2', 'aria-hidden': 'true' }, '≡');
        const b = el('button', { class: on ? 'on' : '', 'aria-pressed': String(on), onclick: () => {
          store.set('chips.hidden', on ? [...hid, k] : hid.filter((x) => x !== k));
          paintChips(); remountBar();
        } }, on ? '보임' : '숨김');
        const row = el('div', { class: 'chr', 'data-k': k }, h, el('span', { class: 'tl' }, (CHIPS.find((x) => x[0] === k) || [k, k])[1]), b);
        h.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          row.classList.add('drag');
          const move = (ev) => {
            for (const r of chipList.children) {
              if (r === row) continue;
              const rc = r.getBoundingClientRect();
              if (ev.clientY < rc.top + rc.height / 2) { if (r.previousElementSibling !== row) chipList.insertBefore(row, r); return; }
            }
            if (chipList.lastElementChild !== row) chipList.append(row);
          };
          const up = () => {
            window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
            row.classList.remove('drag');
            const order = [...chipList.children].map((r) => r.dataset.k);
            if (order.join() !== chipOrder().join()) { store.set('chips.order', order); remountBar(); }
          };
          window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up); // 손가락이 ≡ 밖으로 나가도 받게(Play 버튼과 같은 방식)
        });
        return row;
      }));
    };
    paintChips();
    let evLoaded = false;
    let openedAt = 0;
    const sec = (title, opened, ...kids) => el('details', Object.assign({ class: 'adv' }, opened ? { open: '' } : {}), el('summary', {}, title), ...kids);
    const evSec = el('div', { class: 'evs' }, el('h4', {}, '일본 한정 이벤트'), evBox);
    const ensureEv = () => { if (!evLoaded) { evLoaded = true; loadEvents(evBox); } };
    const setOpen = (open) => {
      root.classList.toggle('open', open);
      if (open) { openedAt = Date.now(); ensureEv(); }
    };
    const fab = el('button', { class: 'fab', 'aria-label': '탭: 한/일 전환 · 꾹: 설정' }, opt('locale').slice(0, 2).toUpperCase());
    const toggleLang = () => {
      const now = opt('locale');
      if (now === 'ja_JP') store.set('locale', store.get('locale.prev', 'ko_KR') || 'ko_KR');
      else { store.set('locale.prev', now); store.set('locale', 'ja_JP'); }
      applyLang();
    };
    const vw = () => document.documentElement.clientWidth || innerWidth; // 스크롤바를 뺀 폭(fixed 요소의 기준)
    let at = null;
    pressable(fab, toggleLang, () => setOpen(true), {
      start() { const r = root.getBoundingClientRect(); at = { l: r.left, t: r.top, w: r.width, h: r.height }; },
      move(dx, dy) {
        const st = root.style;
        st.right = st.bottom = 'auto';
        st.left = Math.min(Math.max(at.l + dx, 0), Math.max(vw() - at.w, 0)) + 'px';
        st.top = Math.min(Math.max(at.t + dy, 0), Math.max(innerHeight - at.h, 0)) + 'px';
      },
      end() {
        const r = root.getBoundingClientRect();
        store.set('fab.xy', { l: Math.round(r.left), t: Math.round(r.top) });
      },
    }, FAB_LONG_MS);
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('open')) setOpen(false); });
    const applyPos = () => {
      const st = root.style;
      st.left = st.right = st.top = st.bottom = 'auto';
      const xy = opt('fab.xy');
      const w = root.offsetWidth || 56, h = root.offsetHeight || 56;
      if (xy && typeof xy.l === 'number' && typeof xy.t === 'number') { // px 값: 화면 안으로만 눌러 넣는다(저장값은 그대로)
        st.left = Math.min(Math.max(xy.l, 0), Math.max(vw() - w, 0)) + 'px';
        st.top = Math.min(Math.max(xy.t, 0), Math.max(innerHeight - h, 0)) + 'px';
        return;
      }
      if (xy && typeof xy.x === 'number' && typeof xy.y === 'number') { // 예전 비율 값
        st.left = Math.round(Math.min(Math.max(xy.x, 0), 1) * Math.max(vw() - w, 0)) + 'px';
        st.top = Math.round(Math.min(Math.max(xy.y, 0), 1) * Math.max(innerHeight - h, 0)) + 'px';
        return;
      }
      const k = opt('fab.pos');
      if (k === 'lm') st.left = '4px'; else st.right = '4px';
      if (k === 'rb') st.bottom = 'calc(78px + env(safe-area-inset-bottom,0px))';
      else if (k === 'rt') st.top = '130px';
      else st.top = '50%';
    };
    const defaultLines = () => SHORTCUTS.map(([i, n, u]) => `${i} ${n}|${u}`).join('\n');
    const parseShortcuts = (txt) => {
      const out = [];
      for (const line of String(txt || '').split('\n')) {
        const k = line.lastIndexOf('|');
        if (k < 1) continue;
        const label = line.slice(0, k).trim();
        let u;
        try { u = new URL(line.slice(k + 1).trim(), 'https://www.dlsite.com'); } catch (e) { continue; }
        if (label && /^https?:$/.test(u.protocol)) out.push([label, u.href]);
      }
      return out;
    };
    const curShortcuts = () => {
      const c = parseShortcuts(store.get('shortcuts.custom', ''));
      return c.length ? c : SHORTCUTS.map(([i, n, u]) => [`${i} ${n}`, u]);
    };
    const shortcuts = el('div', { class: 'sc' });
    const paintShortcuts = () => shortcuts.replaceChildren(...curShortcuts().map(([label, url]) => el('a', { class: 'ch', href: url }, label)));
    paintShortcuts();
    const scArea = el('textarea', { class: 'pref', rows: '3', placeholder: '👤 마이페이지|https://www.dlsite.com/...', 'aria-label': '바로가기 편집(이름|주소)' });
    scArea.value = store.get('shortcuts.custom', '') || defaultLines();
    const scSave = el('button', { class: 'c', onclick: () => {
      const v = scArea.value.trim();
      store.set('shortcuts.custom', parseShortcuts(v).length && v !== defaultLines() ? v : '');
      paintShortcuts();
      if (!parseShortcuts(v).length) scArea.value = defaultLines();
    } }, '바로가기 저장');
    const blArea = el('textarea', { class: 'pref', rows: '3', 'aria-label': '차단 목록' });
    blArea.value = store.get('block.list', '');
    const blSave = el('button', { class: 'c', onclick: () => { store.set('block.list', blArea.value.trim()); blockSet.cache = null; list.apply(); } }, '차단 저장');
    const body = el('div', { class: 'bd' },
      evSec,
      sec('설정', false, el('div', { class: 'lst' },
        chk('autoJa', '이벤트 페이지 일본어 자동', applyLang),
        chk('hideBanners', '할인 외 배너 숨기기', clean.resetBanners),
        chk('saleStrip', '일본 할인 배너 표시', reload),
        chk('onlyTlBl', 'TL/BL 층만 보이기', reload),
        chk('hideCouponPop', '쿠폰 팝업 숨기기', reload),
        chk('showVA', '목록에 성우(CV) 표시', reload),
        chk('hideAI', 'AI 생성 작품 숨기기', () => list.apply()),
        chk('saleOnly', '검색은 할인중만 (쿠폰 대상 제외)', reload),
        chk('koDefault', '검색은 한국어 작품만 (언어 안 정했을 때)', reload),
        chk('searchJa', '검색 결과는 일본어로', reload)),
        el('h4', {}, '칩 (≡ 끌어서 순서)'), chipList,
        el('h4', {}, '바로가기 (이름|주소)'), scArea, el('div', { class: 'row' }, scSave),
        el('h4', {}, '차단 (서클·성우·작가, 한 줄에 하나)'), blArea, el('div', { class: 'row' }, blSave)),
      sec('상태', false,
      el('div', { class: 'mut', id: 'dlh-va' }),
      el('div', { class: 'mut', id: 'dlh-cp' }, '쿠폰: 쿠폰 목록 페이지에서 확인돼요'),
      el('div', { class: 'mut', id: 'dlh-cs' }),
      el('div', { class: 'mut', id: 'dlh-hid' }),
      el('div', { class: 'mut', id: 'dlh-st' }),
      el('div', { class: 'mut' }, '현재 쿠키: ' + (locale.read() || '없음')),
      el('div', { class: 'mut' }, '쿠키 이름들: ' + ((() => { try { return document.cookie; } catch (e) { return ''; } })().split('; ').map((c) => c.split('=')[0]).filter(Boolean).join(', ') || '없음')),
      el('div', { class: 'mut' }, '사이트 언어 선택값: ' + ((document.querySelector('select.lang_currency_select') || {}).value || '못 찾음'))));
    const pnl = el('div', { class: 'pnl', id: 'dlh-pnl', role: 'dialog', 'aria-modal': 'true', 'aria-label': '설정' },
      el('div', { class: 'grab' }),
      el('div', { class: 'hd' }, el('b', {}, '설정'),
        el('button', { class: 'x', 'aria-label': '닫기', onclick: () => setOpen(false) }, '✕')),
      shortcuts,
      body);
    const bk = el('div', { class: 'bk', onclick: () => { if (Date.now() - openedAt > 400) setOpen(false); } });
    root.append(bk, pnl, fab);
    applyPos();
    window.addEventListener('resize', applyPos);
    document.documentElement.append(root);
  }

  /* ========== 10.5 play: DLsite Play 작품 숨기기(Play 자체 '비표시' 기능을 씀) ==========
     - Play에는 원래 비표시 기능이 있다(작품 화면 ⋯ → '비표시 작품 목록으로 이동', 설정 → 비표시 작품 목록). 비표시 작품은 Play가 목록과
       개수에서 아예 빼서 빈칸도, 스크롤 튐도 없다. 그래서 숨기기는 Play 서버의 비표시 목록(/api/ignore)에 넣는다(계정에 저장).
       GET /api/ignore → {works:[id]}, POST /api/ignore {works:[전체 목록]}, DELETE /api/ignore {works:[뺄 id]} (2026-10-30 Play 코드와 시험으로 확인).
     - 오른쪽 아래 '숨기기' → 작품을 누르면 화면 아래 '숨긴 작품' 칸으로(그 칸에서 누르면 되돌림) → '완료'에 한꺼번에 보내고 새로고침.
       버튼을 꾸욱 누르면 칸에 이미 비표시인 작품도 보인다(되돌리기용). 버튼은 끌어서 옮긴다.
       요청은 편집 한 번에 GET 1 + (바뀐 게 있으면) POST 1·DELETE 1.
     - Play는 비표시 목록을 브라우저 저장소(IndexedDB 'Play_…'의 Ignore)에도 두고 그걸로 목록을 그린다. 서버만 바꾸면 새로고침해도 안 바뀌어서 같이 고친다.
     - 썸네일마다 품번 띠를 붙인다(주소에서 읽음, 요청 없음).
     - 0.31~0.32는 이 기기에만 저장(play.hidden)하고 CSS로 숨겼다. 그 목록은 다음 편집 때 숨길 작품으로 넣어 보내고 지운다. */
  const PLAY_KEY = 'play.hidden'; // 예전(0.31~0.32) 이 기기 숨김 목록 { 작품id: 1 또는 {i, n} }
  const PLAY_CSS = `
#dlph{position:fixed;right:14px;bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:2147483001;height:44px;padding:0 18px;border:0;border-radius:22px;background:#222;color:#fff;font:700 15px/44px system-ui,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.3);cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
#dlph.on{background:#2196f3}
#dlph[disabled]{opacity:.6}
#dlph-tray{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;padding:8px 12px calc(72px + env(safe-area-inset-bottom,0px));background:#f4f4f5;border-top:1px solid #ddd;font:13px/1.3 system-ui,sans-serif;color:#555}
#dlph-tray b{display:block;margin-bottom:6px}
#dlph-tray .row{display:flex;gap:8px;overflow-x:auto}
#dlph-tray button{flex:none;width:84px;padding:0;border:0;background:none;text-align:left;color:#555;font:inherit;font-size:11px;cursor:pointer}
#dlph-tray img,#dlph-tray .ph{display:block;width:84px;height:63px;object-fit:cover;border-radius:6px;background:#ddd}
#dlph-tray span{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.dlph-idh{position:relative}
.dlph-id{position:absolute;left:0;right:0;bottom:0;z-index:3;height:20px;display:flex;align-items:center;padding:0 6px;background:rgba(20,20,24,.72);color:#fff;font:700 10px/1 system-ui,sans-serif;letter-spacing:.2px;white-space:nowrap;overflow:hidden;cursor:copy}
.dlph-id.ok{background:#2e7d32}`;
  const PLAY_ID = /^[A-Z]{2}\d{6,8}$/;
  // Play의 IndexedDB(Play_…)에서 비표시 목록과 작품 정보(제목·표지)를 읽고 쓴다
  const playDb = {
    async open() {
      const list = indexedDB.databases ? await indexedDB.databases() : [];
      const d = list.find((x) => x.name && x.name.startsWith('Play_'));
      if (!d) return null;
      return new Promise((res) => { const r = indexedDB.open(d.name); r.onsuccess = () => res(r.result); r.onerror = () => res(null); });
    },
    req: (r) => new Promise((res) => { r.onsuccess = () => res(r.result); r.onerror = () => res(null); }),
    async works(ids) { // { id: { i: 표지, n: 제목 } }
      const out = {};
      const db = await playDb.open().catch(() => null);
      if (!db) return out;
      try {
        const st = db.transaction('Purchase').objectStore('Purchase');
        for (const id of ids) {
          const p = await playDb.req(st.get(id));
          if (!p) continue;
          const nm = p.name || {};
          // 표지는 main(Play 비표시 목록도 이걸 씀). 번역판은 thumb(_img_sam)이 없는 경우가 있었다(2026-10-30, 61개 중 16개)
          out[id] = { i: (p.images && (p.images.main || p.images.thumb)) || '', n: nm.ko_KR || nm.ja_JP || Object.values(nm)[0] || '' };
        }
      } catch (e) { /* 저장소 구조가 다르면 제목·표지 없이 */ }
      db.close();
      return out;
    },
    async setIgnore(add, del) {
      const db = await playDb.open().catch(() => null);
      if (!db) return;
      try {
        await new Promise((res) => {
          const tx = db.transaction('Ignore', 'readwrite');
          const st = tx.objectStore('Ignore');
          for (const id of add) st.put({ id });
          for (const id of del) st.delete(id);
          tx.oncomplete = res; tx.onerror = res; tx.onabort = res;
        });
      } catch (e) { /* 없으면 Play가 다음 동기화 때 서버에서 받는다 */ }
      db.close();
    },
  };
  const playApi = (method, works) => fetch('/api/ignore', {
    method, credentials: 'include',
    headers: works ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
    body: works ? JSON.stringify({ works }) : undefined,
  }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))));

  function playHide() {
    let legacy = store.get(PLAY_KEY, null) || {};
    let editing = false, busy = false, old = false; // old: 칸에 이미 비표시인 작품도 보임(버튼을 꾸욱 눌렀을 때)
    let server = []; // 편집을 열 때 받은 비표시 목록
    const add = new Set(), del = new Set(); // 이번 편집에서 숨길 것 / 되돌릴 것
    let info = {}; // 칸에 쓸 제목·표지
    const ID_HREF = /\/work\/([A-Z]{2}\d{6,8})/;
    const ID_IMG = /\/([A-Z]{2}\d{6,8})_img_/;
    // 카드(li 또는 '최근 본 작품'의 role=button)와 작품 id
    const cards = () => {
      const out = new Map();
      for (const a of document.querySelectorAll('a[href*="/work/"]')) {
        const m = (a.getAttribute('href') || '').match(ID_HREF);
        const c = m && a.closest('li');
        if (c && !out.has(c)) out.set(c, m[1]);
      }
      for (const img of document.querySelectorAll('[role=button] img[src*="_img_"]')) {
        const m = img.src.match(ID_IMG);
        const c = m && img.closest('[role=button]');
        if (c && !out.has(c)) out.set(c, m[1]);
      }
      return out;
    };
    const fab = el('button', { id: 'dlph', 'aria-label': '작품 숨기기(꾸욱 누르면 숨긴 작품도 보기, 끌면 옮김)' });
    const hideCss = el('style', { id: 'dlph-hide' });
    const tray = el('div', { id: 'dlph-tray', role: 'region', 'aria-label': '숨긴 작품' });
    tray.hidden = true;
    // CSS로 가리는 작품: 편집 중 새로 고른 것, 아직 보내지 않은 예전 목록. 목록 li는 빈칸으로 남긴다(빼면 스크롤 중 화면이 튐)
    const hideRule = (ids) => !ids.length ? ''
      : `${ids.map((id) => `li:has(a[href$="/work/${id}"])`).join(',')}{visibility:hidden!important}`
        + `${ids.map((id) => `[role=button]:has(img[src*="/${id}_img_"])`).join(',')}{display:none!important}`;
    const ids = () => (editing ? [...add] : Object.keys(legacy)).filter((id) => PLAY_ID.test(id));
    // 썸네일마다 품번 띠(목록 li만)
    const stamp = () => {
      for (const a of document.querySelectorAll('li a[href*="/work/"]')) {
        const m = (a.getAttribute('href') || '').match(ID_HREF);
        const img = m && a.querySelector('img');
        const box = img && img.parentElement;
        if (!box || (box.lastElementChild && box.lastElementChild.className === 'dlph-id' && box.lastElementChild.textContent === m[1])) continue;
        for (const old of box.querySelectorAll(':scope > .dlph-id')) old.remove();
        box.classList.add('dlph-idh');
        box.append(el('span', { class: 'dlph-id' }, m[1]));
      }
    };
    const paint = () => {
      const css = hideRule(ids());
      if (hideCss.textContent !== css) hideCss.textContent = css;
      stamp();
      fab.hidden = !editing && !document.querySelector('a[href*="/work/"], [role=button] img[src*="_img_"]');
      fab.classList.toggle('on', editing);
      fab.disabled = busy;
      fab.textContent = busy ? '저장 중' : editing ? '완료' : '숨기기';
    };
    // 아래 칸: 새로 숨길 것 + (꾸욱 눌렀으면) 이미 비표시인 것(되돌릴 것은 뺌). 누르면 되돌림
    const paintTray = () => {
      tray.hidden = !editing;
      if (!editing) return;
      const list = [...[...add].reverse(), ...(old ? server.filter((id) => !add.has(id) && !del.has(id)) : [])];
      tray.replaceChildren(el('b', {}, '숨긴 작품 ' + list.length), el('div', { class: 'row' }, list.map((id) => {
        const v = info[id] || {};
        return el('button', { 'data-id': id, title: v.n || id, onclick: () => {
          if (add.has(id)) add.delete(id); else del.add(id);
          paint(); paintTray();
        } }, v.i ? el('img', { src: v.i, alt: '', loading: 'lazy' }) : el('div', { class: 'ph' }), el('span', {}, v.n || id));
      })));
    };
    const fail = () => { busy = false; paint(); fab.textContent = '실패'; setTimeout(paint, 2000); };
    // 버튼을 끌면 옮긴다(이 기기에 위치 저장, 화면 밖으로는 안 나감). 0.5초 꾸욱 누르면 숨긴 작품도 칸에 보이며 편집 시작
    const POS_KEY = 'play.fabPos';
    const place = (p) => {
      if (!p) return;
      const x = Math.max(4, Math.min(innerWidth - (fab.offsetWidth || 90) - 4, p.x));
      const y = Math.max(4, Math.min(innerHeight - (fab.offsetHeight || 44) - 4, p.y));
      Object.assign(fab.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
    };
    let press = null, skipClick = false;
    fab.addEventListener('contextmenu', (e) => e.preventDefault()); // 폰에서 꾸욱 누를 때 메뉴가 뜨지 않게
    fab.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      skipClick = false;
      const r = fab.getBoundingClientRect();
      const p = press = { x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId, drag: false, long: false };
      p.t = setTimeout(() => { if (press !== p) return; p.long = skipClick = true; begin(true); }, 500);
    });
    // 움직임·뗌은 window에서 받는다(빨리 끌면 손가락이 버튼 밖으로 먼저 나감)
    window.addEventListener('pointermove', (e) => {
      if (!press || press.long || e.pointerId !== press.id) return;
      if (!press.drag) {
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 8) return;
        press.drag = true;
        clearTimeout(press.t);
        try { fab.setPointerCapture(press.id); } catch (err) { /* 무시 */ }
      }
      place({ x: e.clientX - press.dx, y: e.clientY - press.dy });
    });
    const release = () => {
      if (!press) return;
      clearTimeout(press.t);
      if (press.drag) { skipClick = true; store.set(POS_KEY, { x: parseFloat(fab.style.left), y: parseFloat(fab.style.top) }); }
      press = null;
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('resize', () => { if (fab.style.left) place({ x: parseFloat(fab.style.left), y: parseFloat(fab.style.top) }); });
    // 편집 시작: 서버의 비표시 목록을 받는다(요청 1). 이미 편집 중이면 칸만 넓힌다
    const begin = async (showOld) => {
      if (busy) return;
      if (editing) { if (showOld && !old) { old = true; paintTray(); } return; }
      busy = true; paint();
      try { server = ((await playApi('GET')).works || []).filter((id) => typeof id === 'string'); } catch (e) { fail(); return; }
      add.clear(); del.clear();
      for (const id of Object.keys(legacy)) if (PLAY_ID.test(id) && !server.includes(id)) add.add(id); // 예전 이 기기 숨김을 같이 보낸다
      info = await playDb.works([...new Set([...server, ...add])]);
      busy = false; editing = true; old = showOld;
      paint(); paintTray();
    };
    fab.addEventListener('click', async () => {
      if (skipClick) { skipClick = false; return; }
      if (busy) return;
      if (!editing) { begin(false); return; }
      if (!add.size && !del.size && !Object.keys(legacy).length) { editing = false; paint(); paintTray(); return; }
      busy = true; paint();
      try { // POST는 Play처럼 전체 목록을 보낸다(덧붙이기인지 바꾸기인지 몰라도 안전하게)
        if (add.size) await playApi('POST', [...new Set([...server, ...add])].filter((id) => !del.has(id)));
        if (del.size) await playApi('DELETE', [...del]);
      } catch (e) { fail(); return; }
      await playDb.setIgnore([...add], [...del]);
      legacy = {};
      store.set(PLAY_KEY, null);
      location.reload();
    });
    // 품번 띠를 누르면 작품을 열지 않고 품번만 복사한다(편집 중에도). 복사되면 띠가 잠깐 초록색(copyText)
    // 편집 중에는 작품을 열지 않고 숨길 작품으로 고른다(사이트보다 먼저 받으려고 window 캡처 단계). 칸에 쓸 표지·제목도 같이 읽는다
    window.addEventListener('click', (e) => {
      const band = e.target.closest && e.target.closest('.dlph-id');
      if (band) { e.preventDefault(); e.stopImmediatePropagation(); copyText(band, band.textContent); return; }
      if (!editing || !e.target.closest || e.target.closest('#dlph, #dlph-tray')) return;
      for (const [c, id] of cards()) {
        if (!c.contains(e.target)) continue;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (busy) return;
        del.delete(id);
        add.delete(id); // 다시 넣어 칸의 맨 앞으로
        if (!server.includes(id)) add.add(id);
        if (!info[id]) {
          const img = c.querySelector('img[src*="_img_"]');
          const name = [...c.querySelectorAll('img[alt]')].map((x) => x.alt).find(Boolean) || c.getAttribute('aria-label') || '';
          info[id] = { i: img ? img.src : '', n: name.slice(0, 80) };
        }
        paint(); paintTray();
        return;
      }
    }, true);
    const start = () => {
      (document.head || document.documentElement).append(el('style', {}, PLAY_CSS), hideCss);
      document.body.append(tray, fab);
      paint();
      place(store.get(POS_KEY, null));
      let t = null;
      new MutationObserver((recs) => { // 숨기기는 CSS와 Play가 하고, 여기서는 품번 띠와 편집 버튼만
        const ours = (n) => n.nodeType !== 1 || n.classList.contains('dlph-id');
        if (recs.every((r) => fab.contains(r.target) || tray.contains(r.target) || ([...r.addedNodes].every(ours) && [...r.removedNodes].every(ours)))) return;
        clearTimeout(t);
        t = setTimeout(paint, 100);
      }).observe(document.body, { childList: true, subtree: true });
    };
    if (document.body && document.readyState !== 'loading') start();
    else document.addEventListener('DOMContentLoaded', start);
  }

  /* ========== 11. boot ========== */
  if (location.hostname === 'play.dlsite.com') { playHide(); return; } // Play에서는 숨기기만(언어·목록 기능은 www.dlsite.com 전용)
  const target = searchRedirectTarget();
  if (target) {
    let recent = false;
    try {
      const last = JSON.parse(sessionStorage.getItem('dlh_redirect') || 'null');
      recent = !!last && last.to === target && Date.now() - last.at < 10000;
      if (!recent) sessionStorage.setItem('dlh_redirect', JSON.stringify({ to: target, at: Date.now() }));
    } catch (e) { /* 무시 */ }
    if (!recent) { location.replace(target); return; }
  }
  locale.enforce(true);
  locale.hookNavigation();
  for (const t of ['submit', 'keydown', 'click']) document.addEventListener(t, kw.before, true);

  const isOurs = (n) => n.nodeType === 1 && (n.matches(OURS) || !!n.closest(OURS));
  const onlyOurs = (recs) => recs.every((r) =>
    isOurs(r.target) || [...r.addedNodes, ...r.removedNodes].every((n) => n.nodeType !== 1 || n.matches(OURS)));

  let popAt = 0, popT = 0;
  function popupSoon() {
    clearTimeout(popT);
    const wait = 2500 - (Date.now() - popAt);
    if (wait > 0) { popT = setTimeout(popupSoon, wait); return; }
    popAt = Date.now();
    clean.couponPopup();
  }
  // 사이트 필터 창의 '할인중 작품' 선택(campaign[])을 주소에 맞춘다. 사이트는 정렬·필터를 바꿀 때 이 선택으로 새 주소를 만들어서,
  // 안 맞추면 우리가 붙인 할인중 조건이 빠진다. 주소마다 한 번만(사용자가 직접 끄면 그대로 둔다).
  let saleSynced = '';
  function syncSaleFilter() {
    if (saleSynced === location.href || !route.isSearch(location.pathname) || !/\/campaign\/campaign/.test(location.pathname)) return;
    const r = document.querySelector('input[type=radio][name="campaign[]"]');
    if (!r) return; // 아직 안 그려졌으면 다음 정리 때
    saleSynced = location.href;
    if (!r.checked) r.click();
  }
  // 묶음 할인(bulkbuy) 페이지: 사이트는 필터를 바꿔도 지금 쪽 번호를 그대로 요청해서, 2쪽 이상이면 결과가 모자라 404로 멈춘다(스크립트 없이도 같음).
  // 사이트 필터 창의 '絞り込み'를 누르기 직전에 사이트가 들고 있는 쪽 번호(목록 상태 객체의 page)를 1로 바꾼다.
  function bulkPageReset(e) {
    if (!/\/campaign\/bulkbuy\//.test(location.pathname) || !e.target.closest || !e.target.closest('button.action_sheet_submit')) return;
    const w = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    for (const k of Object.keys(w)) {
      try {
        const o = w[k];
        if (o && typeof o === 'object' && typeof o.endpoint === 'string' && /\/bulkbuy\/ajax\//.test(o.endpoint) && o.page > 1) o.page = 1;
      } catch (err) { /* 다른 사이트 창(iframe)은 못 읽음 */ }
    }
  }
  // 사이트 연령 확인 창(div.adult_check_box._adultcheck, 2026-11-01 폰·PC 확인)이 떠 있는 동안 설정 버튼을 숨긴다(버튼이 창의 '네' 위에 겹쳤음).
  // head 안에도 숨은 ._adultcheck가 하나 더 있어서 전부 본다
  function ageGateHide() {
    const on = [...document.querySelectorAll('._adultcheck')].some((g) => g.getClientRects().length > 0 && getComputedStyle(g).visibility !== 'hidden');
    const h = document.getElementById('dlh');
    if (h && h.hidden !== on) h.hidden = on;
  }
  // 사이트가 검색을 주소만 바꿔(pushState) 보여 주면 시작할 때 바꾸기가 안 돈다. 한국어 태그 이름 검색어면 그때 한 번 바꿔 연다(검색창에서 못 바꾼 경우만, 요청 +1)
  function kwFix() {
    kw.tidyBox();
    const np = route.isSearch(location.pathname) && kw.path(location.pathname);
    if (!np) return;
    try { if (sessionStorage.getItem('dlh_kw') === location.href) return; sessionStorage.setItem('dlh_kw', location.href); } catch (e) { return; }
    const u = new URL(location.href); u.pathname = np; location.replace(u.href);
  }
  function tidy() {
    ageGateHide();
    kwFix();
    sbox.attach();
    locale.enforce(false);
    syncSaleFilter();
    list.invalidate();
    clean.banners();
    clean.floors();
    popupSoon();
    coupon.learn();
    list.mount();
    voice.load();
    cart.paint();
  }
  let started = false;
  function start() {
    if (started || !document.body) return;
    started = true;
    (document.head || document.documentElement).append(el('style', {}, CSS));
    buildPanel();
    document.addEventListener('click', bulkPageReset, true);
    tidy();
    loadStrip();
    setTimeout(coupon.sweep, 8000);
    setTimeout(kw.load, 5000); // 태그 목록(한국어·일본어 각 1번, 7일에 한 번)
    let t = null;
    new MutationObserver((recs) => {
      if (onlyOurs(recs)) return;
      clearTimeout(t);
      t = setTimeout(tidy, 350);
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body && document.readyState !== 'loading') start();
  else document.addEventListener('DOMContentLoaded', start);
})();