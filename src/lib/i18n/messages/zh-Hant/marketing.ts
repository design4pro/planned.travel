/**
 * The public pages' copy, in zh-Hant.
 *
 * Authored from `../en/marketing.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders.
 *
 * No price appears below, in any form. See the note in the English file.
 *
 * **排版.** 產品名保留拉丁字母；破折號用全形。
 */

import type { TranslationOf } from '../../types'
import type En from '../en/marketing'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  'action.startFree': '免費開始',
  'action.signIn': '登入',
  'action.pricing': '定價',
  'action.seePricing': '查看定價',
  'action.skipToContent': '跳至主要內容',
  /* -------------------------------------------------------- the header */
  'nav.home': 'planned.travel — 首頁',
  'nav.onThisPage': '本頁目錄',
  'anchor.planner': '行程規劃',
  'anchor.modules': '模組',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': '放到第 {day} 天',
  'legal.summaryNote': '簡要版是給人讀的。真正適用的是下面的條款。',
  'visual.daysTravelled': '旅行天數',
  'visual.acrossEveryTrip': '所有行程合計',
  'visual.mapFilled': '地圖已填 {percent}%',
  'visual.previewSummary':
    'planned.travel 面板預覽：下一趟行程及其日期、同行人數和地點數量；已到過的國家、行程總數和旅行天數的合計；行程路線地圖；以及接下來的兩筆訂位。',
  'visual.placesMapped': {
    other: '地圖上 {value} 個地點',
  },
  'visual.splitWays': {
    other: '{value} 人均攤',
  },
  'visual.tripTotal': '行程總額',
  'visual.paidSplit': '{who} 付款 · {split}',
  'visual.nextUp': '接下來',
  'visual.ofTotal': '第 {done} 項，共 {total} 項',
  'visual.awaitingReply': '等待回覆',
  'visual.upcoming': '即將到來',
  'visual.days': {
    other: '{value} 天',
  },
  'visual.places': {
    other: '{value} 個地點',
  },
  'visual.transfersLeft': {
    other: '還剩 {value} 筆轉帳',
  },

  'legal.badge.version': '版本 {version}',
  'legal.badge.effective': '{updated} 起生效',
  'legal.notice.title': '這是範本，不是法律意見',
  'legal.notice.body':
    '它用淺顯的英語寫成，目的是給一個小型旅行規劃服務一個真正可用的起點，企業必須補齊的每處空缺都已標出。在接下第一位客戶之前，請讓你所在司法管轄區的合格律師審閱並調整。這裡沒有任何內容聲稱 planned.travel 持有某項認證、審計或合規標準。',
  'legal.contents': '目錄',
  'legal.shortVersion': '簡要版',
  'legal.both': '兩份文件同時適用。',

  'landing.plans.title': '免費開始。等它值得了再付錢。',
  'landing.plans.lede':
    '每個方案都含逐日規劃、地圖、預算和行李清單。付費方案 - 每月 {price} 起 - 解鎖不限次數的行程、訂位、日誌和匯出。',
  'landing.plans.ledeFree':
    '每個方案都含逐日規劃、地圖、預算和行李清單。付費方案解鎖不限次數的行程、訂位、日誌和匯出。',
  'landing.plans.compare': '逐行比較每一項上限',
  'landing.questions.title': '問題，直接回答',
  'landing.questions.lede': '大家在動手之前真正想知道的六件事。',
  'cta.heading': '你下一趟旅程已經值得好好規劃',
  'cta.lede':
    '兩趟行程、整張地圖、逐日安排和行李清單：免費，不用綁卡，也沒有倒數計時。',
  'landing.faq.seats.q': '和我同行的人也要付錢嗎？',
  'landing.faq.seats.a':
    '不用。你邀請進{crew}工作區的每個人都算在這個工作區的名額裡。他們用自己的帳號登入，只看得到你把他們加進去的那些行程。',
  'landing.faq.phone.q': '在手機上能好好用嗎？',
  'landing.faq.phone.a':
    '能。手機版面是單獨畫的，不是從桌面版擠下來的；而且這是一個網站，沒有東西要裝，也沒有東西要更新。',
  'landing.faq.privacy.q': '誰能看到我的行程？',
  'landing.faq.privacy.a':
    '一趟行程屬於一個工作區，只有被邀請進那個工作區的人才能打開。沒有任何內容是公開的，沒有探索動態，預設也不會分享給任何人。',
  'landing.faq.stop.q': '如果我停止付費，我的行程會怎樣？',
  'landing.faq.stop.a':
    '什麼都不會刪。付費模組會鎖上，你的行程原地不動，一旦訂閱就全部解鎖。{free}繼續免費，沒有倒數計時。',

  'action.startPlanning': '免費開始規劃',
  'cta.comparePlans': '比較各個方案',
  'landing.hero.eyebrow': '一起規劃旅程',
  'landing.hero.title': '規劃這趟旅程。',
  'landing.hero.titleQuiet': '而不是表格。',
  'landing.hero.lede':
    '真實地圖上的一份行程，即時分享給所有同行的人 - 訂位、花費和行李清單都掛在上面。',
  'landing.hero.secondary': '看看要花多少',
  'landing.trust.noCard': '開始不用綁卡',
  'landing.trust.noAds': '沒有廣告，沒有聯盟連結',
  'landing.trust.export': '隨時匯出全部內容',

  'proof.eyebrow': '直白的答案',
  'proof.title': '沒有客戶評價，因為我們還沒資格拿到',
  'proof.lede':
    'planned.travel 還很新。與其編一句好評或借別人的標誌，不如把它做什麼、給誰用，以及絕不會對你做什麼，都直接寫在這裡。',
  'proof.who.label': '給誰用',
  'proof.who.heading': '給那個最後總要去做表格的人',
  'proof.who.body':
    '給那些想要一份所有人都看得到的計畫的情侶、家庭和朋友團 - 而不是六張截圖、三個群組聊天，還有一份三月之後沒人打開過的共用筆記。',
  'proof.not.label': '它不是什麼',
  'proof.not.heading': '不是訂房網站，也不打算賣給這種網站',
  'proof.not.body':
    '我們不收佣金、不帶廣告、不放聯盟連結，所以頁面上沒有任何東西會悄悄把你推向某家飯店。付錢的是你，所以我們為你做事。',
  'proof.where.label': '你的東西放在哪裡',
  'proof.where.heading': '在 Cloudflare 上，在你自己的工作區裡',
  'proof.where.body':
    '行程存在僅限於你工作區的資料庫裡，檔案存在我們自己的物件儲存裡，兩者都從 Cloudflare 的邊緣節點提供。作為登記銷售方的 Polar 負責結帳並開立發票，所以你的卡號從不會到我們這裡。',
  'proof.promise.ads.title': '沒有廣告，沒有第三方分析',
  'proof.promise.ads.body': '這個頁面上沒有任何東西在替別人衡量你。',
  'proof.promise.sold.title': '你的行程絕不出售、絕不出租',
  'proof.promise.sold.body': '不給廣告商，不給旅遊公司，不給任何人。',
  'proof.promise.leave.title': '想走就走，把所有東西帶上',
  'proof.promise.leave.body':
    'PDF 行程表、日曆檔，以及你的地點匯出為 GeoJSON。',
  'proof.certification':
    '我們目前沒有任何安全認證，也不會暗示自己有。等 planned.travel 按某個標準接受審計，我們會在這裡寫出標準名稱、審計方和日期 - 在那之前不會。',

  'feature.modules.title': '行程的其餘部分，一併搞定',
  'feature.modules.lede':
    '每個模組只把一件事做好，再把成果交給其他模組。這裡沒有一個等著將來版本的佔位標籤。',
  'feature.module.lists.benefit': '不會有人忘了帶轉接頭。',
  'feature.module.lists.detail':
    '行李、待辦、要買的東西和證件：一件事一份清單，與同行的人共用，邊做邊勾。',
  'feature.module.journal.name': '日誌',
  'feature.module.journal.benefit': '旅程變成故事，而不是一個資料夾。',
  'feature.module.journal.detail':
    '按日期排列的紀錄，帶上你拍的照片、當時在哪、天氣，以及那天真實的感受。',
  'feature.module.atlas.benefit': '一張地圖裝下你去過的所有地方。',
  'feature.module.atlas.detail':
    '把一個國家標為已去過，它就進入你的世界地圖：第一次、最近一次，以及你回去過幾次。',
  'feature.module.vacay.benefit': '先請到假，再訂機票。',
  'feature.module.vacay.detail':
    '標出你不在的日子，一年就自己填滿：週末、法定假日，還有其他人的休假都在同一張格子裡。',
  'feature.module.collab.benefit': '決定跟著行程留下來。',
  'feature.module.collab.detail':
    '每趟行程一個話題，大家都得記住的事放進共用筆記，晚餐定不下來就投票。',
  'feature.module.files.benefit': '登機證放在你找得到的地方。',
  'feature.module.files.detail':
    '確認單、門票、保險文件和收據都掛在它們所屬的那趟行程上，不會埋在收件匣裡。',

  'feature.planner.title': '畫在真實地圖上的逐日行程',
  'feature.planner.lede':
    '把想去的地方收集起來，再拖到某一天。地圖會隨手重畫路線，所以一個上午要橫越城市兩次，你立刻就看得見。',
  'feature.planner.point.days': '一天一欄，帶上日期、天氣，以及當晚住哪裡。',
  'feature.planner.point.unscheduled':
    '還沒排期的地點待在自己那一欄，直到分到某一天。',
  'feature.planner.point.crew':
    '在{crew}裡所有人同時拖動：即時游標、即時同步、無需重新載入。',
  'feature.planner.point.tiles':
    '向量圖磚由我們自己的儲存提供，沒有任何地圖供應商看著你做規劃。',
  'feature.costs.title': '真能結清的共同開支',
  'feature.costs.lede':
    '用行程本身的貨幣記下花費，按你們真正約定的方式拆分每一筆，再看清結完所有帳所需的最短轉帳組合。',
  'feature.costs.point.split':
    '平均分、按份額分，或按確切金額：逐筆設定，而不是整趟統一。',
  'feature.costs.point.currency': '一切折算成單一行程貨幣，總額才有意義。',
  'feature.costs.point.settle': '結算檢視寫明誰付給誰，轉帳完成後隨即記錄。',
  'feature.costs.point.receipt': '把收據附在支出上，數字永遠帶著憑證。',
  'feature.book.title': '每一筆訂位，都帶上門口要用的編號',
  'feature.book.lede':
    '住宿、餐位、導覽和門票在同一份清單裡，旁邊就是把你送來送去的航班、火車和渡輪：每一項都有確認號和所屬日期。',
  'feature.book.point.legs': '交通段落帶著座位、月台、航廈和訂位編號。',
  'feature.book.point.day': '訂位掛在某一天上，不用重新輸入就出現在行程裡。',
  'feature.book.point.states':
    '已申請、已確認、已取消是各自獨立的狀態，不是某個欄位裡的備註。',
  'feature.book.point.export': '出發前把整趟行程匯出成 PDF 行程表或日曆檔。',

  'pricing.faq.trial.q': '試用期結束後會怎樣？',
  'pricing.faq.trial.a':
    '試用期會直接轉為付費方案。Polar 在試用開始時記錄一種支付方式，並在試用結束當天扣款；在那之前取消，就不會被扣款。兩種情況下都不會刪除任何東西：付費模組鎖定，行程留在原處，一旦訂閱便全部重新開啟。',
  'pricing.faq.seller.q': '我究竟是向誰購買？',
  'pricing.faq.seller.a':
    '向 Polar。它是我們的登記銷售方：作為分銷商把訂閱賣給你，收取款項，以自己的名義開立發票，並核定、徵收並繳納你所在國家收取的銷售稅或加值稅。退款與信用卡爭議也與它處理。服務仍由我們營運，郵件也由我們回覆。',
  'pricing.faq.change.q': '能在行程進行到一半時換方案嗎？',
  'pricing.faq.change.a':
    '可以。升級立即生效並按天折算；降級在你已付費的週期結束後生效，所以你不會失去已付費的存取權。',
  'pricing.faq.seats.q': '{crew}的按人計費是怎麼算的？',
  'pricing.faq.seats.a':
    '你只為實際占用的席次付費，人數隨時可改。尚未接受的邀請也計入席次，因此工作區不會悄悄超出方案。',
  'pricing.faq.guests.q': '和我同行的人需要各自訂閱嗎？',
  'pricing.faq.guests.a':
    '不需要。你邀請進{crew}工作區的每個人都由該工作區的席次涵蓋。他們用自己的帳號登入，只看到被加入的行程。',
  'pricing.faq.storage.q': '哪些內容算進儲存空間？',
  'pricing.faq.storage.a':
    '照片、票券、確認單，以及你附加到行程的任何檔案。地圖圖磚和應用本身從不計入。在設定裡可以準確看到什麼占用了空間。',
  'pricing.faq.export.q': '我能把自己的資料帶走嗎？',
  'pricing.faq.export.a':
    '隨時可以。每段行程都能匯出為 PDF 行程和日曆檔案，你的地點可匯出為 GeoJSON。這是你的旅行，不是我們的。',

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': '無需信用卡，無期限，無倒數',
  'pricing.card.yearlyPerSeat': '每人每年 {amount}，一次收取',
  'pricing.card.yearly': '每年一次收取 {amount}',
  'pricing.card.seatsUnlimited': '成員數不限',
  'pricing.card.tripsUnlimited': '行程數不限',
  'pricing.card.startFree': '免費開始',
  'pricing.card.startTrial': '試用 {plan}',
  'pricing.card.popular': '最多人選擇',
  'pricing.card.noteYearly': '每年收取一次。兩個月由我們請。',
  'pricing.card.noteMonthly': '按月收取。隨時更換或取消。',
  'pricing.card.trial': {
    other: '{value} 天免費試用，先綁卡，結束時收取',
  },
  'pricing.card.seatsUpTo': {
    other: '最多 {value} 人',
  },
  'pricing.card.trips': {
    other: '同時 {value} 段行程',
  },

  'pricing.feature.storage': '{size} 用於照片與文件',
  'pricing.feature.storageShared': '{size} 共用空間，用於照片與文件',
  'pricing.feature.free.tripsDetail': '封存一次行程即可開始下一次',
  'pricing.feature.solo.modules': '全部規劃模組',
  'pricing.feature.solo.modulesDetail': '訂房、日誌、預算、行李',
  'pricing.feature.crew.membersDetail': '按成員計費，隨時調整',
  'pricing.feature.crew.realtimeDetail': '即時游標與即時同步',
  'pricing.feature.crew.supportDetail': '一個工作日內由真人回覆',

  'pricing.hero.eyebrow': '兩趟行程永久免費',
  'pricing.hero.title': '好好地做計畫。',
  'pricing.hero.titleQuiet': '按用量付費。',
  'pricing.hero.lede':
    '免費規劃兩趟行程。一個人可解鎖全部模組，或者帶上整隊人，一起編輯同一份行程。',
  'pricing.hero.taxNote':
    '價格以美元計，不含銷售稅或加值稅。Polar 是我們的登記銷售方：發票上是它，它計算你所在國家收取的稅額、在結帳時加上並代為繳納。你可以隨時在產品內取消。',
  'pricing.compare.eyebrow': '並排比較',
  'pricing.compare.title': '每項上限，一目了然',
  'pricing.compare.lede':
    '一張表，來自計費系統讀取的同一份目錄。若某列說模組包含在內，權限檢查也這麼認。',
  'pricing.compare.caption': '三個方案的功能與上限對比',
  'pricing.compare.feature': '功能',
  'pricing.compare.limits': '上限',
  'pricing.compare.included': '包含',
  'pricing.compare.notIncluded': '不包含',
  'pricing.compare.includedIn': '{plan} 包含',
  'pricing.compare.notIn': '{plan} 不包含',
  'pricing.questions.eyebrow': '在你開口之前',
  'pricing.questions.title': '問題，已解答',
  'pricing.questions.lede': '計費、試用，以及把資料帶走。',
  'pricing.cta.secondary': '看看它怎麼用',
  'pricing.module.itinerary': '逐日行程',
  'pricing.module.map': '互動地圖',
  'pricing.module.budget': '預算與費用分攤',
  'pricing.module.packing': '行李與待辦清單',
  'pricing.module.reservations': '預訂',
  'pricing.module.journal': '旅行日誌',
  'pricing.module.atlas': '到訪國家地圖',
  'pricing.module.collaboration': '邀請同行者',
  'pricing.module.realtime': '即時協作',
  'pricing.module.offlineMaps': '離線地圖',
  'pricing.module.pdfExport': 'PDF 與日曆匯出',
  'pricing.module.prioritySupport': '優先支援',

  'anchor.plans': '方案',
  'anchor.compare': '比較',
  'anchor.questions': '常見問題',
  /* -------------------------------------------------------- the footer */
  'footer.blurb':
    '行程、地圖、訂房、帳目與行李清單都在一處——與同行的每個人共享。',
  'footer.attribution':
    '執行於 Cloudflare Workers。地圖資料 © OpenStreetMap 貢獻者。由記錄商戶 Polar 負責銷售與開立發票。',
  'footer.column.product': '產品',
  'footer.column.account': '帳戶',
  'footer.link.overview': '總覽',
  'footer.link.everyModule': '全部模組',
  'footer.link.dayPlanner': '每日規劃',
  'footer.link.sharedCosts': '共同開支',
  'footer.link.reservations': '訂房',
  'footer.link.atlasJournal': '地圖冊與旅行日誌',
  'footer.link.createAccount': '建立帳戶',
  'footer.link.terms': '服務條款',
  'footer.link.privacy': '隱私聲明',
} satisfies TranslationOf<typeof En>

export default messages
