/**
 * The costs tab's copy, in tr.
 *
 * Authored from `../en/costs.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders and the plural
 * branches.
 *
 * **Çoğul.** `one` · `other`; Türkçede sayıdan sonra ad çoğul eki almaz.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/costs'

const messages = {
  /* ------------------------------------------------------------ people */
  'person.you': 'Sen',
  'person.youTarget': 'sana',
  'person.removed': 'Kaldırılan gezgin',
  /* ------------------------------------------------ delete an expense */
  'delete.title': 'Bu masraf silinsin mi?',
  'delete.description':
    '“{title}” ve onun bölüşümü hesaptan çıkıyor. Bu geri alınamaz.',
  'delete.failed': 'Silinemedi',
  'delete.failedBody': 'Masraf silinemedi. Birazdan tekrar dene.',
  'delete.noBalances':
    'Hiçbir bakiye değişmiyor - üzerinde bölüşülmüş bir şey yoktu.',
  'delete.balancesChange': '{names} bakiyeleri değişiyor.',
  'delete.confirm': 'Masrafı sil',
  'delete.working': 'Masraf siliniyor',

  /* ---------------------------------------------- the filter bar */
  'toolbar.title': 'Masraflar',
  'toolbar.shownOf': '{total} içinde {shown}',
  'toolbar.searchPlaceholder': 'Masraflarda, notlarda veya ödeyende ara…',
  'toolbar.searchLabel': 'Masraflarda ara',
  'toolbar.allCategories': 'Tüm kategoriler',
  'toolbar.allDays': 'Tüm günler',
  'toolbar.filterCategory': 'Kategoriye göre süz',
  'toolbar.filterDay': 'Güne göre süz',
  'toolbar.whose': 'Kimin masrafları',
  'toolbar.paidByMe': 'Benim ödediklerim',
  'toolbar.owedToMe': 'Bana borçlu olunan',
  'toolbar.logged': {
    one: '{value} kayıtlı',
    other: '{value} kayıtlı',
  },

  /* ------------------------------------------- the split editor */
  'split.section': 'Yolcular arasında bölüşüm',
  'split.label': 'Bölüşenler',
  'split.everyone': 'Herkes',
  'split.nobody': 'Kimse',
  'split.how': 'Bu masraf nasıl bölünüyor',
  'split.method.equal': 'Eşit olarak',
  'split.method.equalHint':
    'Dahil olan herkes aynı tutarı ödüyor, artan en küçük birim listedeki ilk kişiye gidiyor.',
  'split.method.exact': 'Tam tutar',
  'split.method.exactHint':
    'Kimin gerçekte ne kadar borcu olduğunu yaz. Tutarların toplamı genel toplamı vermeli.',
  'split.method.shares': 'Paylar',
  'split.method.sharesHint':
    'Bölüşümü ağırlıklandır - bir çift için 2 pay, diğerleri için 1.',
  'split.method.percentage': 'Yüzde',
  'split.method.percentageHint':
    'Yüzdeyle bölüşüm. Yüzdelerin toplamı 100 olmalı.',
  'split.exactFor': '{name} için tam tutar',
  'split.percentFor': '{name} için yüzde',
  'split.sharesFor': '{name} için pay',
  'split.balanced': 'Denk',
  'split.allocated': '{total} içinden {allocated} dağıtıldı',
  'split.over': '{amount} fazla',
  'split.left': '{amount} kaldı',

  /* ---------------------------------------- the expense dialog */
  'field.amount': 'Tutar',
  'field.currency': 'Para birimi',
  'field.date': 'Tarih',
  'field.paidBy': 'Ödeyen',
  'expense.editTitle': 'Bu masrafı düzenle',
  'expense.addTitle': 'Masraf ekle',
  'expense.editDescription':
    'Tutarı değiştirirsen aşağıda dahil olan herkes arasında yeniden bölünür.',
  'expense.addDescription':
    'Bu seyahatte tutarlar {currency} cinsinden tutuluyor. Fişi kendi para biriminde yaz ve çevrildiğinde ne olduğunu kaydet.',
  'expense.saveFailed': 'Kaydedilemedi',
  'expense.what': 'Ne içindi',
  'expense.whatPlaceholder': 'Kyubey’de akşam yemeği',
  'expense.amountNotANumber': 'Tutarı sayı olarak yaz.',
  'expense.currencyLabel': 'Bu fişin yazıldığı para birimi',
  'expense.convertedTo': '{currency} cinsine çevrildi',
  'expense.convertedHint':
    'Ekstrende {from} tutarının {to} cinsinden karşılığı.',
  'expense.convertedSuggested':
    'Bu gezide kullanılan kura göre önerildi ({date}, {rate}). Ekstrenle eşleşecek şekilde değiştir.',
  'expense.convertedNotANumber': 'Çevrilen tutarı sayı olarak yaz.',
  'expense.dateLabel': 'Masrafın tarihi',
  'expense.paidByHint':
    'Kimsenin henüz üstlenmediği bir fişi yazıyorsan ödeyensiz bırak.',
  'expense.nobodyYet': 'Henüz kimse',
  'expense.whoPaid': 'Kim ödedi',
  'expense.notesHint': 'İsteğe bağlı. Fişin söylemediği her şey.',
  'expense.notesPlaceholder': 'Tadım menüsü bölüşüldü, içecekler ayrı.',
  'expense.noAmount': 'Henüz tutar yok',
  'expense.saving': 'Masraf kaydediliyor',
  'expense.saveChanges': 'Değişiklikleri kaydet',
  'expense.add': 'Masraf ekle',

  /* ---------------------------------------- the payment dialog */
  'payment.title': 'Ödeme kaydet',
  'payment.description':
    'Kaydedilen bir transfer iki bakiyeden de düşüyor. Para taşımıyor - planned.travel hesabı tutuyor, parayı bankan gönderiyor.',
  'payment.youSuffix': '{name} (sen)',
  'payment.pays': '{from}, {to} kişisine ödüyor',
  'payment.pickTwo': 'İki farklı kişi seç.',
  'payment.paidTo': 'Kime ödendi',
  'payment.needsTwo': 'Bir ödeme iki farklı kişi gerektirir.',
  'payment.whoPaying': 'Kim ödüyor',
  'payment.whoPaid': 'Kime ödeniyor',
  'payment.amountIn': '{currency} cinsinden tutar',
  'payment.amountPositive': 'Sıfırdan büyük bir tutar yaz.',
  'payment.currencyLabel': 'Ödemenin yapıldığı para birimi',
  'payment.how': 'Nasıl',
  'payment.howMade': 'Ödeme nasıl yapıldı',
  'payment.dateLabel': 'Ödemenin tarihi',
  'payment.note': 'Not',
  'payment.noteHint': 'İsteğe bağlı. Bir referans ya da neyi kapsadığı.',
  'payment.notePlaceholder': 'Kyoto’daki oteli ve JR biletlerini kapsıyor.',
  'payment.recording': 'Ödeme kaydediliyor',
  'payment.confirm': 'Ödemeyi kaydet',
  'payment.failed': 'Ödeme kaydedilemedi. Birazdan tekrar dene.',
  'payment.method.bankTransfer': 'Banka transferi',
  'payment.method.cash': 'Nakit',
  'payment.method.card': 'Kart',
  'payment.method.app': 'Ödeme uygulaması',
  'payment.method.other': 'Başka bir şey',

  /* --------------------------------------------------------- settle up */
  'settle.label': 'Hesaplaşma',
  'settle.addPayment': 'Ödeme ekle',
  'settle.action': 'Hesaplaş',
  'settle.empty.title': 'Herkes ödeşti',
  'settle.empty.body':
    'Hiçbir transfer gerekmiyor. Bir gider ekle, her dengesizlik burada görünür.',
  /* ---------------------------------------------------------- balances */
  'balances.label': 'Bakiyeler',
  'balances.count': {
    one: '{travellers} gezgin',
    other: '{travellers} gezgin',
  },
  'balances.empty':
    'Bir giderin ödeyeni ve paylaşımı olduğunda bakiyeler görünür.',
  /* ------------------------------------------------------- by category */
  'categories.label': 'Kategoriye göre',
  'categories.againstBudget': 'Gezi bütçesine karşı',
  'categories.progressLabel': 'Gezi bütçesine karşı harcanan',
  'categories.empty':
    'Bütçe satırları ve giderler, dökülecek bir şey olduğunda burada dökülür.',
  'categories.legendLabel': 'Kategoriye göre harcama',
  'categories.planned': '{amount} planlandı',
  'categories.nothingSpent':
    'Henüz bir şey harcanmadı. Planladığınız şeyler burada.',
  /* A share under one percent; the glyph is hidden, the spoken form is read. */
  'percent.belowOne': '<{percent}',
  'percent.belowOneSpoken': '{percent} altında',
  /* ------------------------------------------------- member bar (#833) */
  'memberBar.label': 'Para kimin için harcandı',
  'memberBar.others': {
    one: '{others} diğer gezgin',
    other: '{others} diğer gezgin',
  },
  'memberBar.notSplit': 'Kimseye atanmadı',
  'totalTile.label': 'Toplam gezi harcaması',
  'totalTile.captionPlanned': 'Tüm gezginler için {amount} planlandı',
  'totalTile.captionBudget': 'Gezi için {amount} bütçe',
  'totalTile.yourShare': 'Senin payın',
  'totalTile.youPaid': 'Senin ödediğin',
  /* ------------------------------------------------- payments recorded */
  'payments.label': 'Kaydedilen ödemeler',
  'payments.empty.title': 'Henüz ödeme yok',
  'payments.empty.body':
    'Biri bir bakiyeyi geri ödediğinde transfer buraya kaydedilir.',
  /* ------------------------------------------- read-only ledger (#837) */
  'readOnly.title': 'Masrafları görebilirsin ama değiştiremezsin',
  'readOnly.body':
    'Harcama ekleme, düzenleme, silme ve ödeme kaydetme yetkisi yalnızca gezinin sahiplerinde ve düzenleme izni olanlarda var. Bir şeyin değişmesi gerekiyorsa bir sahibe sor.',
  'readOnly.empty':
    'Bu gezi için henüz harcama kaydedilmedi. Bir sahip ya da düzenleyici ekleyince burada görünür.',
  'readOnly.settleEmpty':
    'Şu an hiçbir transfer gerekmiyor. Olası bir dengesizlik burada görünürdü.',
  'refusal.rebaseChanged':
    'Onaylarken gezi değişti, bu yüzden hiçbir şey değiştirilmedi. Yeni tutarları kontrol edin ve yeniden onaylayın.',
  'refusal.tripCurrencyChanged':
    'Bu gezinin bütçe para birimi artık {to}, bu yüzden kaydedilmedi. Sayfa yenilendi: tutarı kontrol edin ve yeniden kaydedin.',
} satisfies TranslationOf<typeof En>

export default messages
