/**
 * The public pages' copy, in ja.
 *
 * Authored from `../en/marketing.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders.
 *
 * No price appears below, in any form. See the note in the English file.
 *
 * **表記.** 製品名はラテン文字のまま。区切りは全角中黒ではなく読点を用いる。
 */

import type { TranslationOf } from '../../types'
import type En from '../en/marketing'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  'action.startFree': '無料で始める',
  'action.signIn': 'ログイン',
  'action.pricing': '料金',
  'action.seePricing': '料金を見る',
  'action.skipToContent': '本文へスキップ',
  /* -------------------------------------------------------- the header */
  'nav.home': 'planned.travel — ホーム',
  'nav.onThisPage': 'このページの内容',
  'anchor.planner': 'プランナー',
  'anchor.modules': 'モジュール',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': '{day} 日目にドロップ',
  'legal.summaryNote':
    '要点は読まれるためにあります。実際に適用されるのは以下の各項です。',
  'visual.daysTravelled': '旅行日数',
  'visual.acrossEveryTrip': 'すべての旅行の合計',
  'visual.mapFilled': '地図の {percent}% を記入済み',
  'visual.previewSummary':
    'planned.travel のダッシュボードのプレビュー。次の旅行の日程・同行者数・場所数、訪問国数・旅行数・旅行日数の集計、旅程のルート地図、そして直近2件の予約が並びます。',
  'visual.placesMapped': {
    other: '地図に{value}か所',
  },
  'visual.splitWays': {
    other: '{value}人で割り勘',
  },
  'visual.tripTotal': '旅行の合計',
  'visual.paidSplit': '{who} が支払い · {split}',
  'visual.nextUp': '次の予定',
  'visual.ofTotal': '{total} 件中 {done} 件',
  'visual.awaitingReply': '返信待ち',
  'visual.upcoming': '今後の予定',
  'visual.days': {
    other: '{value}日間',
  },
  'visual.places': {
    other: '{value}か所',
  },
  'visual.transfersLeft': {
    other: '送金あと{value}件',
  },

  'legal.badge.version': 'バージョン {version}',
  'legal.badge.effective': '{updated} 施行',
  'legal.notice.title': 'これはテンプレートであり、法的助言ではありません',
  'legal.notice.body':
    '小規模な旅行計画サービスにとって本当に使える出発点になるよう、平易な英語で書いています。事業者が埋めるべき箇所はすべて印を付けてあります。顧客をひとり受け入れる前に、お住まいの法域の有資格の弁護士に確認と修正を依頼してください。ここに planned.travel が保有する認証、監査、コンプライアンス基準を主張する記述はありません。',
  'legal.contents': '目次',
  'legal.shortVersion': '要点',
  'legal.both': '両方の文書が同時に適用されます。',

  'landing.plans.title': '無料で始めて、価値が出てから払う。',
  'landing.plans.lede':
    'どのプランにも日程プランナー、地図、予算、荷造りリストが入っています。有料プラン（月額 {price} から）では、旅行数無制限、予約、日記、書き出しが使えます。',
  'landing.plans.ledeFree':
    'どのプランにも日程プランナー、地図、予算、荷造りリストが入っています。有料プランでは、旅行数無制限、予約、日記、書き出しが使えます。',
  'landing.plans.compare': 'すべての上限を一行ずつ比べる',
  'landing.questions.title': '質問に、まっすぐ答えます',
  'landing.questions.lede': '始める前にみなさんが本当に知りたい5つのこと。',
  'cta.heading': '次の旅は、もうきちんと計画する価値があります',
  'cta.lede':
    '旅行2件、地図のすべて、日程、荷造りリスト。無料で、カードも不要、期限のカウントもありません。',
  'landing.faq.seats.q': '一緒に旅行する人もお金を払う必要がありますか？',
  'landing.faq.seats.a':
    'いりません。{crew} のワークスペースに招いた人は、そのワークスペースの人数に含まれます。各自のアカウントでサインインし、あなたが追加した旅行だけが見えます。',
  'landing.faq.phone.q': 'スマートフォンでもきちんと動きますか？',
  'landing.faq.phone.a':
    '動きます。モバイル用のレイアウトはデスクトップ版を押し縮めたものではなく、別に設計しています。ウェブサイトなので、インストールも更新も必要ありません。',
  'landing.faq.privacy.q': '私の旅行は誰が見られますか？',
  'landing.faq.privacy.a':
    '旅行はひとつのワークスペースに属し、開けるのはそのワークスペースに招かれた人だけです。公開されるものはなく、発見用のフィードもなく、初期状態では誰とも共有されません。',
  'landing.faq.stop.q': '支払いをやめたら旅行はどうなりますか？',
  'landing.faq.stop.a':
    '何も削除されません。有料モジュールはロックされますが、旅行はそのままの場所に残り、契約した瞬間にすべて解除されます。{free} プランは無料のまま、期限もありません。',

  'action.startPlanning': '無料でプランを立てる',
  'cta.comparePlans': 'プランを比べる',
  'landing.hero.eyebrow': 'みんなで立てる旅行の計画',
  'landing.hero.title': '旅を計画する。',
  'landing.hero.titleQuiet': '表計算ではなく。',
  'landing.hero.lede':
    '本物の地図の上にひとつの旅程。同行者全員とリアルタイムで共有され、予約もお金も荷造りリストもそこに紐づきます。',
  'landing.hero.secondary': '料金を見る',
  'landing.trust.noCard': '始めるのにカードは不要',
  'landing.trust.noAds': '広告なし、アフィリエイトリンクなし',
  'landing.trust.export': 'いつでも、すべて書き出せます',

  'proof.eyebrow': 'まっすぐな答え',
  'proof.title': '推薦の声はありません。まだ頂けるだけのことをしていないので',
  'proof.lede':
    'planned.travel は新しいサービスです。引用を作ったり他社のロゴを借りたりする代わりに、何をするのか、誰のためなのか、そして決してしないことを、ここにそのまま書きます。',
  'proof.who.label': '誰のためか',
  'proof.who.heading': '結局あの表を作ることになる人のために',
  'proof.who.body':
    'スクリーンショット6枚、グループチャット3つ、3月から誰も開いていない共有メモ。そうではなく、全員が見られるひとつの計画がほしいカップル、家族、友人グループのために。',
  'proof.not.label': '何ではないか',
  'proof.not.heading': '予約サイトではなく、そこへ売る気もありません',
  'proof.not.body':
    '手数料は取らず、広告は載せず、アフィリエイトリンクも置きません。だからページ上のどこにも、特定のホテルへそっと誘導するものはありません。お金を払うのはあなたなので、私たちはあなたのために働きます。',
  'proof.where.label': 'あなたのものが置かれる場所',
  'proof.where.heading': 'Cloudflare 上、あなた自身のワークスペースに',
  'proof.where.body':
    '旅行データはあなたのワークスペースに限定されたデータベースに、ファイルは自社のオブジェクトストレージに置かれ、どちらも Cloudflare のエッジから配信されます。決済とインボイスは記録上の販売者である Polar が担うため、カード番号が私たちに届くことはありません。',
  'proof.promise.ads.title': '広告なし、第三者の解析なし',
  'proof.promise.ads.body':
    'このページには、誰か他人のためにあなたを測るものはありません。',
  'proof.promise.sold.title':
    'あなたの旅行が売られたり貸されたりすることはありません',
  'proof.promise.sold.body': '広告主にも、旅行会社にも、誰にも。',
  'proof.promise.leave.title': 'いつでも、すべてを持って出ていけます',
  'proof.promise.leave.body':
    'PDF の旅程、カレンダーファイル、そして場所は GeoJSON で。',
  'proof.certification':
    '現時点でセキュリティ認証は取得しておらず、取得しているかのような書き方もしません。planned.travel が何らかの規格で監査を受けたときに、その規格名、監査人、日付をここに書きます。それより前には書きません。',

  'feature.modules.title': '旅の残りも、ちゃんと片づく',
  'feature.modules.lede':
    'どのモジュールもひとつの仕事をきちんとこなし、その結果を他へ渡します。将来のリリースを待つだけの空タブはひとつもありません。',
  'feature.module.lists.benefit': '変換プラグを忘れる人が出ません。',
  'feature.module.lists.detail':
    '荷造り、やること、買い物、書類。用途ごとに1つのリストを、同行者全員と共有しながらその場でチェックしていきます。',
  'feature.module.journal.name': '日記',
  'feature.module.journal.benefit': '旅がフォルダではなく、物語になります。',
  'feature.module.journal.detail':
    '日付順の記録に、撮った写真、いた場所、天気、そしてその日が実際どうだったかが並びます。',
  'feature.module.atlas.benefit': '行ったところ全部を1枚の地図に。',
  'feature.module.atlas.detail':
    '国を訪問済みにすると世界地図に加わります。初回、直近、そして何度戻ったかまで残ります。',
  'feature.module.vacay.benefit': '航空券より先に、休みを取る。',
  'feature.module.vacay.detail':
    '不在の日を印すと1年が埋まっていきます。週末、祝日、そして他の全員の休みも同じ表の中に。',
  'feature.module.collab.benefit': '決めたことが旅と一緒に残ります。',
  'feature.module.collab.detail':
    '旅ごとに1つのスレッド、全員が覚えておくべきことは共有メモへ、夕食が決まらないときは投票で。',
  'feature.module.files.benefit': '搭乗券は、見つけられる場所に。',
  'feature.module.files.detail':
    '確認書、チケット、保険証書、領収書は、それが属する旅に添付されます。受信箱に埋もれません。',

  'feature.planner.title': '本物の地図に描く、日ごとの旅程',
  'feature.planner.lede':
    '行きたい場所を集めて、あとは日付にドラッグするだけ。地図はその場でルートを描き直すので、午前中に街を二度横断する予定になっていればすぐに分かります。',
  'feature.planner.point.days':
    '1日1列。日付、天気、その夜泊まる場所まで並びます。',
  'feature.planner.point.unscheduled':
    '日付のない場所は専用の列で、日が決まるまで待機します。',
  'feature.planner.point.crew':
    '{crew} なら全員が同時にドラッグできます。リアルタイムのカーソル、即時同期、再読み込みなし。',
  'feature.planner.point.tiles':
    'ベクタータイルは自社ストレージから配信。地図ベンダーに計画を見られることはありません。',
  'feature.costs.title': '本当に清算まで終わる割り勘',
  'feature.costs.lede':
    '支出は旅行の通貨で記録し、実際に決めたとおりに分け、すべてを清算する最短の送金の組み合わせを確認できます。',
  'feature.costs.point.split':
    '均等、比率、金額指定のいずれか。旅行単位ではなく支出単位で選べます。',
  'feature.costs.point.currency':
    'すべて旅行の単一通貨に換算するので、合計に意味があります。',
  'feature.costs.point.settle':
    '清算画面は誰が誰に払うかを示し、送金が済めばそれを記録します。',
  'feature.costs.point.receipt':
    '領収書は支出に添付。金額にはつねに裏づけが残ります。',
  'feature.book.title': 'すべての予約を、入口で必要な番号とともに',
  'feature.book.lede':
    '宿、レストラン、ツアー、チケットを一つのリストに。その間を結ぶ航空便、列車、フェリーもすぐ隣に並び、それぞれに確認番号と該当日が付きます。',
  'feature.book.point.legs':
    '移動区間には座席、ホーム、ターミナル、予約番号が入ります。',
  'feature.book.point.day':
    '予約は日付に紐づくので、入力し直さなくても旅程に現れます。',
  'feature.book.point.states':
    '申請中・確定・キャンセルは別々の状態で、備考欄のメモではありません。',
  'feature.book.point.export':
    '出発前に、旅程全体を PDF またはカレンダーファイルとして書き出せます。',

  'pricing.faq.trial.q': '無料期間が終わるとどうなりますか？',
  'pricing.faq.trial.a':
    '無料期間はそのまま有料プランに移ります。Polar は無料期間の開始時に支払い方法を登録し、期間が終わる日に請求します。その前に解約すれば請求は発生しません。どちらの場合もデータは削除されません。有料モジュールがロックされ、旅行はそのままの場所に残り、購読した瞬間にすべて再び開きます。',
  'pricing.faq.seller.q': '実際には誰から購入するのですか？',
  'pricing.faq.seller.a':
    'Polar からです。Polar は当社の正規販売者であり、リセラーとして購読をあなたに販売し、支払いを受け取り、自社名で請求書を発行し、あなたの国が課す売上税または VAT を算定・徴収・納付します。返金やカードの異議も Polar と解決します。サービスを運営し、メールに答えるのは引き続き当社です。',
  'pricing.faq.change.q': '旅行の途中でプランを変えられますか？',
  'pricing.faq.change.a':
    'できます。上位への変更は即時に反映され、日割りで計算されます。下位への変更は、すでに支払い済みの期間の終わりから有効になるので、支払った分のアクセスを失うことはありません。',
  'pricing.faq.seats.q': '{crew} の人数割り課金はどう動きますか？',
  'pricing.faq.seats.a':
    '実際に埋まっている席の分だけ支払います。人数はいつでも変更できます。未応答の招待も席として数えるので、ワークスペースが気づかないうちにプランを超えることはありません。',
  'pricing.faq.guests.q': '同行者にも各自の購読が必要ですか？',
  'pricing.faq.guests.a':
    'いりません。{crew} のワークスペースに招いた人は、そのワークスペースの席でカバーされます。各自のアカウントでサインインし、追加された旅行だけが見えます。',
  'pricing.faq.storage.q': '保存容量には何が数えられますか？',
  'pricing.faq.storage.a':
    '写真、チケット、確認書、そして旅行に添付したあらゆるファイルです。地図のタイルとアプリ自体は決して数えません。何が容量を使っているかは設定で正確に確認できます。',
  'pricing.faq.export.q': '自分のデータを取り出せますか？',
  'pricing.faq.export.a':
    'いつでも可能です。旅行ごとに PDF の旅程とカレンダーファイルとして書き出せ、場所は GeoJSON として書き出せます。あなたの旅行であって、当社のものではありません。',

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': 'カード不要、期限なし、カウントダウンなし',
  'pricing.card.yearlyPerSeat': '1人あたり年{amount}、一括請求',
  'pricing.card.yearly': '年に一度{amount}を請求',
  'pricing.card.seatsUnlimited': 'メンバー数は無制限',
  'pricing.card.tripsUnlimited': '旅行数は無制限',
  'pricing.card.startFree': '無料で始める',
  'pricing.card.startTrial': '{plan}を試す',
  'pricing.card.popular': 'いちばん選ばれています',
  'pricing.card.noteYearly': '年に一度の請求です。2か月分はこちらの負担です。',
  'pricing.card.noteMonthly': '月ごとの請求です。いつでも変更・解約できます。',
  'pricing.card.trial': {
    other: '{value}日間無料、カードは先に登録、終了時に請求',
  },
  'pricing.card.seatsUpTo': {
    other: '最大{value}人',
  },
  'pricing.card.trips': {
    other: '同時に{value}件の旅行',
  },

  'pricing.feature.storage': '写真と書類に {size}',
  'pricing.feature.storageShared': '写真と書類に共有 {size}',
  'pricing.feature.free.tripsDetail': '1つをアーカイブすれば次を始められます',
  'pricing.feature.solo.modules': 'すべての計画モジュール',
  'pricing.feature.solo.modulesDetail': '予約、日記、予算、荷造り',
  'pricing.feature.crew.membersDetail': 'メンバー単位の請求、いつでも変更可能',
  'pricing.feature.crew.realtimeDetail': 'リアルタイムのカーソルと即時同期',
  'pricing.feature.crew.supportDetail': '営業日1日以内に担当者が回答',

  'pricing.hero.eyebrow': '2つの旅行はずっと無料',
  'pricing.hero.title': 'きちんと計画する。',
  'pricing.hero.titleQuiet': '使った分だけ払う。',
  'pricing.hero.lede':
    '2つの旅行を無料で計画できます。1人ならすべてのモジュールを解放、仲間を連れてくれば同じ旅程を同時に編集できます。',
  'pricing.hero.taxNote':
    '価格は米ドル、売上税・VATは含みません。Polar が正規の販売者です。請求書に記載されるのは Polar で、あなたの国の税額を算出し、決済時に加算して納付します。解約は製品の中からいつでもできます。',
  'pricing.compare.eyebrow': '並べて',
  'pricing.compare.title': 'すべての上限を比較',
  'pricing.compare.lede':
    '請求システムが読むのと同じカタログから生成した1つの表です。ある行がモジュールを含むと言えば、権限チェックもそう答えます。',
  'pricing.compare.caption': '3つのプランすべての機能と上限の比較',
  'pricing.compare.feature': '機能',
  'pricing.compare.limits': '上限',
  'pricing.compare.included': '含む',
  'pricing.compare.notIncluded': '含まない',
  'pricing.compare.includedIn': '{plan} に含む',
  'pricing.compare.notIn': '{plan} には含まない',
  'pricing.questions.eyebrow': 'お尋ねの前に',
  'pricing.questions.title': 'よくある質問',
  'pricing.questions.lede': '請求、無料期間、そしてデータの持ち出しについて。',
  'pricing.cta.secondary': '使い方を見る',
  'pricing.module.itinerary': '日ごとの旅程',
  'pricing.module.map': 'インタラクティブな地図',
  'pricing.module.budget': '予算と割り勘',
  'pricing.module.packing': '持ち物・やることリスト',
  'pricing.module.reservations': '予約',
  'pricing.module.journal': '旅の記録',
  'pricing.module.atlas': '訪問国マップ',
  'pricing.module.collaboration': '同行者を招待',
  'pricing.module.realtime': 'リアルタイム共同編集',
  'pricing.module.offlineMaps': 'オフライン地図',
  'pricing.module.pdfExport': 'PDF・カレンダー書き出し',
  'pricing.module.prioritySupport': '優先サポート',

  'anchor.plans': 'プラン',
  'anchor.compare': '比較',
  'anchor.questions': 'よくある質問',
  /* -------------------------------------------------------- the footer */
  'footer.blurb':
    '旅程、地図、予約、お金、持ち物リストをひとつの場所に。行く人全員で共有できます。',
  'footer.attribution':
    'Cloudflare Workers 上で動作。地図データ © OpenStreetMap 貢献者。販売と請求は記録上の販売者である Polar が行います。',
  'footer.column.product': 'プロダクト',
  'footer.column.account': 'アカウント',
  'footer.link.overview': '概要',
  'footer.link.everyModule': 'すべてのモジュール',
  'footer.link.dayPlanner': '日程プランナー',
  'footer.link.sharedCosts': '割り勘',
  'footer.link.reservations': '予約',
  'footer.link.atlasJournal': 'アトラスと旅日記',
  'footer.link.createAccount': 'アカウントを作成',
  'footer.link.terms': '利用規約',
  'footer.link.privacy': 'プライバシーに関する通知',
} satisfies TranslationOf<typeof En>

export default messages
