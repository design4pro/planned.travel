/**
 * The world tracker and the map chrome, in Turkish.
 *
 * Authored from `../en/atlas.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). `TranslationOf<typeof En>` makes a missing or
 * invented key a compile error; `__tests__/parity.test.ts` checks the
 * placeholders and the plural branches.
 *
 * **Terminology.** `Dünya haritası` for the atlas module, `gezi` for a trip,
 * `ülke` for a country and `istek listesi` for the bucket list — the first
 * three are the words `tr/shell.ts` already uses, and the address is the
 * formal siz throughout, matching the rest of the catalogue.
 *
 * **Plural.** `Intl.PluralRules('tr')` reports `one` · `other`. A noun after
 * a numeral stays singular in Turkish ("5 ülke"), so the two branches often
 * carry the same words — the branch still exists because the locale's CLDR
 * data demands it.
 *
 * **What stays byte-identical.** Values with no letter in them once the
 * `{tokens}` are stripped — the separators, `{from} – {to}`, ` ({span})` —
 * are the same marks Turkish uses, and the parity suite exempts them
 * structurally.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/atlas'

const messages = {
  'panel.stats.empty.title': 'Henüz sayılacak bir şey yok',
  'panel.stats.empty.body':
    'Haritada bir ülke işaretle veya bir seyahat planla; rakamların burada görünmeye başlasın.',
  'panel.stats.empty.action': 'Seyahat planla',
  /* ------------------------------------------------------------- the screen */
  'screen.world.empty':
    'Dünya haritası. Henüz gezildi olarak işaretlenmiş ülke yok.',
  'screen.world.summary':
    '{total} ülkeden {visited} tanesi gezildi olarak işaretlenmiş dünya haritası.',
  'screen.error.title': 'Dünya haritası yüklenmedi',

  /* -------------------------------------------------------------- map chrome */
  'map.loading': 'Harita yükleniyor',
  'map.controls.label': 'Harita denetimleri',
  'map.controls.zoomIn': 'Yakınlaştır',
  'map.controls.zoomOut': 'Uzaklaştır',
  'map.controls.north': 'Kuzeye döndür',
  'map.controls.locate': 'Konumumu bul',
  'map.controls.locateFailed': 'Konumunuzu alamadık.',
  'map.controls.locateFailedBody':
    'Bu site için konum erişiminin açık olduğunu kontrol edip yeniden deneyin.',

  'map.attribution.label': 'Harita verisinin kaynağı:',
  'map.attribution.geocoder': 'Yer aramasının kaynağı:',

  'map.basemap.title': 'Altlık harita kullanılamıyor',
  'map.basemap.body':
    'Sokak ayrıntısı çevrimdışı. Yine de her yer gerçek konumunda gösteriliyor; mesafeler ve kümeler doğru kalıyor.',
  'map.basemap.credit': 'Kıyı çizgilerinin kaynağı:',
  'map.basemap.retry': 'Yeniden dene',
  'map.basemap.retrying': 'Altlık harita denetleniyor',

  'map.engine.unsupported.title': 'Harita çizimi kullanılamıyor',
  'map.engine.unsupported.body':
    'Bu tarayıcı etkileşimli haritayı çalıştıramıyor: WebGL2 gerekiyor ve burada kullanılabilir bir WebGL2 bağlamı yok. Bu ekranda başka hiçbir şey ona bağlı değil.',
  'map.engine.stalled.title': 'Harita henüz çizilmedi',
  'map.engine.stalled.body':
    'Haritanın başlaması için tanınan sürede hiçbir şey görünmedi. Kendiliğinden toparlanabilir; bu ekranda başka hiçbir şey ona bağlı değil.',

  'map.coverage.partial.title': 'Kısmi sokak ayrıntısı',
  'map.coverage.partial.body': {
    one: 'Yayımlanan harita verisi bu gezinin {outside} yerini kapsamıyor. Kendi kıyı çizgilerimizde, gerçek konumunda gösteriliyor.',
    other:
      'Yayımlanan harita verisi bu gezinin {outside} yerini kapsamıyor. Kendi kıyı çizgilerimizde, gerçek konumlarında gösteriliyorlar.',
  },
  'map.coverage.none.title': 'Burada sokak ayrıntısı yok',
  'map.coverage.none.body':
    'Bu bölgenin sokakları henüz yayımlanmadı. Kıyı çizgileri, iğneler ve aralarındaki rotalar gerçek — yalnızca binalar ve yollar eksik.',
  'map.coverage.dismiss': 'Harita kapsamı notunu kapat',

  'map.legend.title': 'Gösterge',
  'map.legend.collapse': '{title} bölümünü daralt',
  'map.legend.expand': '{title} bölümünü genişlet',
  'map.legend.dayPin': 'Örnek gün iğnesi',
  'map.legend.dayPinMeaning': 'Program günü',
  'map.legend.clusterPin': 'Örnek küme iğnesi',
  'map.legend.clusterPinMeaning': 'Kümelenmiş yerler',

  'map.filter.label': 'Yerleri kategoriye göre süz',
  'map.filter.all': 'Tümü',
  'map.filter.category': {
    one: '{name} · {places} yer',
    other: '{name} · {places} yer',
  },

  'map.pin.day': '{day}. gün',
  'map.pin.cluster': {
    one: '{places} yer — ayırmak için yakınlaştırın',
    other: '{places} yer — ayırmak için yakınlaştırın',
  },

  'map.place.rating': 'Puan: {rating} / {max}',
  'map.place.clause.day': '{day}. gün',
  'map.place.clause.rating': 'puan: {rating} / {max}',
  'map.place.clause.visited': 'gezildi',
  'map.place.clause.separator': ', ',

  /* ----------------------------------------------------------- the map's key */
  'legend.title': 'Son ziyaret',
  'legend.recent': {
    one: 'Son bir yıl içinde',
    other: 'Son {years} yıl içinde',
  },
  'legend.middle': '{from}–{to} yıl önce veya tarihsiz',
  'legend.distant': {
    one: '{years} yıldan uzun süre önce',
    other: '{years} yıldan uzun süre önce',
  },
  'legend.unvisited': 'Henüz gezilmedi',
  'legend.note':
    'Ton yalnızca ne kadar zaman geçtiğini gösterir — Ülke sekmesi her tarihi tek tek yazar.',

  /* -------------------------------------------------------------- the shelf */
  'panel.coverage.label': 'Dünya kapsamı',
  'panel.coverage.unit': '{total} içinden',
  'panel.coverage.caption': 'Dünyanın {share} kadarı · {visits}',
  'panel.progress.label': 'Her ülkeye doğru',
  'panel.progress.remaining': '{remaining} kaldı',
  'panel.toggle.hide': 'Dünya haritası ayrıntılarını gizle',
  'panel.toggle.show': 'Dünya haritası ayrıntılarını göster',
  'panel.tabs.label': 'Dünya haritası bölümleri',
  'panel.tab.country': 'Ülke',
  'panel.tab.stats': 'İstatistik',
  'panel.tab.bucket': 'İstek listesi',
  'panel.back': 'Tüm ülkeler',
  'panel.list.label': 'Gezilen ülkeler',
  'panel.loading': 'Dünya haritanız yükleniyor',

  'panel.empty.blank.title': 'Haritanız henüz boş',
  'panel.empty.blank.body':
    'Bir ülkeyi gezildi olarak işaretleyin; burada haritada dolar — ilk ve son ziyaretiyle, kaç kez gittiğinizle ve onun hakkında yazdıklarınızla birlikte.',
  'panel.empty.pick.title': 'Bir ülke seçin',
  'panel.empty.pick.body':
    'Haritadan, arama alanından veya listeden birini seçin; tam kaydı burada açılır — ilk ziyaret, son ziyaret, sayaç ve notunuz.',

  'panel.stat.places': 'Yerleriniz',
  'panel.stat.placesNone': 'Henüz bir geziye hiçbir yer iğnelenmedi',
  'panel.stat.placesCaption':
    'Kaydedilen görülecek yerler, konaklamalar ve duraklar',
  'panel.stat.regions': 'Bölgelerin',
  'panel.stat.regionsNone': 'Henüz işaretlenmiş bölge yok',
  'panel.stat.regionsCaption': 'Eyaletler, iller, vilayetler',
  'panel.stat.visits': 'Ziyaretlerin',
  'panel.stat.visitsCaption': 'Kayıtlı her varış',
  'panel.stat.trips': 'Gezileriniz',
  'panel.stat.tripsCaption': 'Katıldığınız tüm geziler',
  'panel.stat.cities': 'Şehirlerin',
  'panel.stat.citiesCaption': 'Konakladığınız veya durduğunuz şehirler',
  'panel.stat.days': 'Seyahat günlerin',
  'panel.stat.daysCaption': 'Kaydınızdaki tüm geziler boyunca',
  'panel.continents.label': 'Kıtalara göre ülkeler',

  'panel.bucket.empty.title': 'Listede bir şey yok',
  'panel.bucket.empty.body':
    'Hep gitmek istediğiniz bir yer. Ekleyin, oraya vardığınızda işaretleyin.',
  'panel.bucket.label': 'İstek listesi',
  'panel.bucket.progress': '{done} / {total} tamamlandı',
  'panel.bucket.done': 'Tamam',
  'panel.bucket.toGo': 'Sırada',
  'panel.bucket.target': '{year} yılına kadar',
  'panel.bucket.hidden': {
    one: 'Listenizde burada gösterilmeyen {entries} kayıt daha var.',
    other: 'Listenizde burada gösterilmeyen {entries} kayıt daha var.',
  },
  'panel.bucket.kind.country': 'Ülke',
  'panel.bucket.kind.region': 'Bölge',
  'panel.bucket.kind.place': 'Yer',

  /* --------------------------------------------------------------- the world */
  'continent.africa': 'Afrika',
  'continent.antarctica': 'Antarktika',
  'continent.asia': 'Asya',
  'continent.europe': 'Avrupa',
  'continent.northAmerica': 'Kuzey Amerika',
  'continent.oceania': 'Okyanusya',
  'continent.southAmerica': 'Güney Amerika',
  'continent.unknown': 'Kıta kaydedilmemiş',

  /* ------------------------------------------------------------- the record */
  'record.visited': 'Gezildi',
  'record.firstVisit': 'İlk ziyaret',
  'record.lastVisit': 'Son ziyaret',
  'record.visitDates': 'Ziyaret tarihleri',
  'record.notRecorded': 'Kaydedilmemiş',
  'record.datesUnrecorded': 'Tarihler kaydedilmemiş',
  'record.visits': {
    one: '{visits} ziyaret',
    other: '{visits} ziyaret',
  },
  'record.span': '{from} – {to}',
  'record.spanFrom': 'İlk ziyaret: {from}',
  'record.spanTo': 'Son ziyaret: {to}',
  'record.visitsUnit': { one: 'ziyaret', other: 'ziyaret' },
  'record.gap.days': {
    one: '{gap} gün arayla',
    other: '{gap} gün arayla',
  },
  'record.gap.months': {
    one: '{gap} ay arayla',
    other: '{gap} ay arayla',
  },
  'record.gap.years': {
    one: '{gap} yıl arayla',
    other: '{gap} yıl arayla',
  },
  'record.note.empty': 'Henüz not yok',
  'record.noOutline':
    'Bu haritanın çizdiği dünya sınırları 1:110m ölçeğinde kesilmiştir; bu da söz konusu toprağı bağlı olduğu devletin içine katar — haritada çerçevelenecek bir şey kalmaz. Ziyaret yine de sayılır.',

  /* --------------------------------------------------------------- the list */
  'list.sort.label': 'Ülkeleri sırala',
  'list.sort.code': 'Ülke kodu',
  'list.sort.codeStatement': "Ülke koduna göre, A'dan Z'ye sıralandı.",
  'list.sort.name': 'Ülke adı',
  'list.sort.nameStatement':
    "Ülke adına göre A'dan Z'ye, ardından ülke koduna göre sıralandı.",
  'list.sort.recent': 'En yeni ziyaret',
  'list.sort.recentStatement':
    'En yeni ziyaret başta olacak şekilde, ardından ülke koduna göre sıralandı.',
  'list.sort.visits': 'En çok ziyaret',
  'list.sort.visitsStatement':
    'En çok ziyaret başta olacak şekilde, ardından ülke koduna göre sıralandı.',
  'list.row.cell': '{label} {value}',
  'list.noOutline':
    'Dünya sınırları onu bağlı olduğu devletin içine kattığı için haritada çerçevelenecek bir şey yok.',
  'list.announce.selected': '{name} seçildi.',
  'list.announce.selectedUnframed': '{name} seçildi. {reason}',
  'list.empty.title': 'Haritada henüz ülke yok',
  'list.empty.body':
    'Bir ülkeye ziyaret kaydedildiği anda buraya düşer — ilk varışıyla, en yenisiyle ve kaç kez gittiğinizle birlikte.',
  'list.loading': 'Gezilen ülkeler yükleniyor',
  'list.error.title': 'Ülkeleriniz yüklenmedi',
  'list.error.body':
    'Dünya haritası gezdiğiniz ülkeleri şu anda okuyamadı. Hiçbir şey kaybolmadı — hâlâ kayıtlılar.',
  'list.error.retry': 'Yeniden dene',
  'list.error.retrying': 'Ülkeleriniz yükleniyor',

  /* ------------------------------------------------------------- the search */
  'search.label': 'Ülke bul',
  'search.loading': 'Ülkeleriniz yükleniyor',
  'search.placeholder': 'Ülke adı veya kodu',
  'search.entry.notVisited': 'Henüz gezilmedi',
  'search.entry.noOutline': 'harita sınırı yok',
  'search.entry.separator': ' · ',
  'search.cleared': 'Seçim temizlendi.',
  'search.unframed':
    '{name} dünya ölçeğinde bir sınıra sahip değil; haritanın çerçeveleyecek bir şeyi yok.',
  'search.unframedVisited':
    '{name} dünya ölçeğinde bir sınıra sahip değil; haritanın çerçeveleyecek bir şeyi yok. Kaydı bundan etkilenmez.',
  'search.results.empty':
    'Kaydınızda henüz ülke yok. Yazın; dünyanın bütün ülkelerinde arayın.',
  'search.results.emptyPinned':
    '{name} seçildi. Kaydınızda henüz ülke yok — yazın; dünyanın bütün ülkelerinde arayın.',
  'search.results.record': {
    one: 'Kaydınızda {countries} ülke var.',
    other: 'Kaydınızda {countries} ülke var.',
  },
  'search.results.capped': 'İlk {shown} tanesi gösteriliyor.',
  'search.results.pinned': '{name} seçildi ve listenin başında.',
  'search.results.none': '{term} ile eşleşen ülke yok.',
  'search.results.matches': {
    one: '{term} ile eşleşen {countries} ülke var.',
    other: '{term} ile eşleşen {countries} ülke var.',
  },
  'search.announce.selected': '{name} seçildi.',
  'search.announce.framing': '{name} seçildi. Harita onu çerçeveliyor.',
  'search.announce.unframed': '{name} seçildi. {reason}',
  'search.empty.title': 'Kaydınızda henüz bir şey yok',
  'search.empty.body':
    'Haritada bulmak için bir ülke adı veya iki harfli kodunu yazın.',
  'search.empty.noMatchTitle': '“{term}” ile eşleşen ülke yok',
  'search.empty.noMatchBody':
    "Yazımı kontrol edin veya iki harfli kodu deneyin — PT, Portekiz'i bulur. Gitmiş olun ya da olmayın, {countries} ülkenin tamamı aranabilir.",

  /* ------------------------------------------------------- the two writes */
  'actions.label': 'Kaydınız',
  'actions.visit.absent.title': 'Gezilmedi',
  'actions.visit.absent.caption': 'Arkasında gezi olmayan bir ziyaret.',
  'actions.visit.title': 'Gezildi',
  'actions.visit.caption': '{visits} · {dates}',
  'actions.goal.absent.title': 'Listede değil',
  'actions.goal.absent.caption': 'Gitmeyi tasarladığınız bir yer.',
  'actions.goal.title': 'İstek listesinde',
  'actions.goal.waiting': 'Sırasını bekliyor.',
  'actions.goal.target': 'Hedef: {year}.',
  'actions.goal.achieved.title': 'Listeden işaretlendi',
  'actions.goal.achieved.caption': 'Oraya vardınız. Kayıt hatıra olarak kalır.',

  'actions.button.remove': 'Kaldır',
  'actions.button.mark': 'Gezildi olarak işaretle',
  'actions.button.add': 'Listeye ekle',
  'actions.visit.remove.name': '{name} ülkesini dünya haritanızdan kaldır',
  'actions.visit.remove.busy': '{name} dünya haritanızdan kaldırılıyor',
  'actions.visit.add.name': 'Gezildi olarak işaretle: {name}',
  'actions.visit.add.busy': '{name} gezildi olarak işaretleniyor',
  'actions.goal.remove.name': '{name} ülkesini istek listenizden kaldır',
  'actions.goal.remove.busy': '{name} istek listenizden kaldırılıyor',
  'actions.goal.add.name': 'Listeye ekle: {name}',
  'actions.goal.add.busy': '{name} istek listenize ekleniyor',

  'actions.hint':
    'İkisi de hemen geçerli olur ve ikisi de buradan geri alınabilir.',
  'actions.offline':
    'Cihazınız sunucuya ulaşamadı. Bağlantıyı kontrol edip yeniden deneyin.',
  'actions.toast.marked': 'Gezildi olarak işaretlendi',
  'actions.toast.markedBody': '{name} dünya haritanızda.',
  'actions.toast.markFailed': '{name} işaretlenemedi',
  'actions.toast.unmarked': 'Dünya haritanızdan kaldırıldı',
  'actions.toast.unmarkedBody': '{name} artık gezildi olarak işaretli değil.',
  'actions.toast.unmarkFailed': '{name} kaldırılamadı',
  'actions.toast.listed': 'İstek listenize eklendi',
  'actions.toast.listedBody': '{name} gitmeyi tasarladığınız bir yer.',
  'actions.toast.listFailed': '{name} eklenemedi',
  'actions.toast.unlisted': 'İstek listenizden kaldırıldı',
  'actions.toast.unlistedBody': '{name} artık listede değil.',
  'actions.toast.unlistFailed': '{name} kaldırılamadı',
  'actions.toast.fallback':
    'Değişiklik sunucuya ulaşmadı. Az sonra yeniden deneyin.',

  'actions.confirm.visit.title': '{name} dünya haritanızdan kaldırılsın mı?',
  'actions.confirm.visit.body': {
    one: '{visits} kayıtlı ziyaret{dates}{note} silinecek. Gezileriniz ve kayıtlı yerleriniz olduğu gibi kalır.',
    other:
      '{visits} kayıtlı ziyaret{dates}{note} silinecek. Gezileriniz ve kayıtlı yerleriniz olduğu gibi kalır.',
  },
  'actions.confirm.visit.dates': ' ({span})',
  'actions.confirm.visit.note': ' ve beraberindeki notunuz',
  'actions.confirm.goal.title': '{name} istek listenizden kaldırılsın mı?',
  'actions.confirm.goal.body':
    'Zaten işaretlenmiş; bu yüzden oraya vardığınıza dair kayıt da silinir. Dünya haritanız ve gezileriniz olduğu gibi kalır.',

  /* ------------------------------------------------- the card over the map */
  // Turkish does not pluralise the noun after a numeral, so the branch a count
  // selects never changes the word — the same rule `card.visits` and
  // `card.places` below already follow.
  'card.trips': { one: 'Çalışma alanı gezisi', other: 'Çalışma alanı gezisi' },
  'card.visits': { one: 'Ziyaret', other: 'Ziyaret' },
  'card.places': { one: 'Çalışma alanı yeri', other: 'Çalışma alanı yeri' },
  'card.firstTrip': 'İlk gezi',
  'card.lastTrip': 'Son gezi',
  'card.firstVisit': 'İlk ziyaret',
  'card.lastVisit': 'Son ziyaret',
  'card.absent': 'Kaydedilmemiş',
  'card.loading': 'Ülke yükleniyor',
  'card.loadingNamed': '{name} yükleniyor',
  'card.error.body': 'Bu sayılar yüklenmedi. Hiçbir şey kaybolmadı.',
  'card.error.retry': 'Yeniden dene',
  'overlay.close': '{name} kartını kapat',
  'regions.label': 'Bölgeler',
  'regions.hint':
    'Bölge eklemek {country} ülkesini de ziyaret edildi olarak işaretler.',
  'regions.keeps': 'Bölgeyi kaldırmak {country} ülkesini atlasından kaldırmaz.',
  'regions.keeps.unvisited':
    'Bu bölgeler kayıtta kalır. {country} ülkesini ziyaret edildi olarak işaretleyerek veya bir bölge ekleyerek haritana geri koyabilirsin.',
  'regions.empty.title': 'Burada henüz bölge kaydedilmedi',
  'regions.empty.body':
    '{country} içinde ziyaret ettiğin bir eyalet, il veya bölge ekle.',
  'regions.input.label': '{country} içinde bölge ekle',
  'regions.input.placeholder': 'Örneğin Bavyera',
  'regions.add': 'Bölge ekle',
  'regions.adding': '{region} ekleniyor',
  'regions.remove': '{region} bölgesini kaldır',
  'regions.loading': 'Bölgelerin yükleniyor',
  'regions.status.added': '{region} eklendi',
  'regions.status.exists': '{region} zaten kayıtlı',
  'regions.status.removed': '{region} kaldırıldı',
  'regions.status.addedCountry':
    '{region} eklendi. {country} artık ziyaret edildi olarak işaretli.',
  'regions.error.invalid': 'Bir bölge adı gir.',
  'regions.error.hidden':
    'Ad, izin verilmeyen karakterler içeriyor. Bunları kaldırıp tekrar dene.',
  'regions.error.load': '{country} içindeki bölgelerin yüklenemedi.',
  'regions.error.add': '{region} eklenemedi. Tekrar dene.',
  'regions.error.remove': '{region} kaldırılamadı. Tekrar dene.',
  'regions.error.full':
    '{limit} bölge kaydettin. Başka bir bölge eklemek için birini kaldır.',
  'regions.reload': 'Bölgeleri yeniden yükle',
  'actions.confirm.visitRegions.body': {
    one: '{history}{country} içinde kaydettiğin bölgeler kayıtta kalır: {count}.',
    other:
      '{history}{country} içinde kaydettiğin bölgeler kayıtta kalır: {count}.',
  },
  'regions.error.uncertain':
    'Değişiklik doğrulanamadı. Neyin kaydedildiğini kontrol etmek için bölgelerini yeniden yükle.',
  'regions.status.refreshFailed':
    '{result} Atlas yenilenemedi. Haritayı güncellemek için yeniden yükle.',

  'panel.stat.periodLabel': 'Verileri göster',
  'panel.stat.allTime': 'Tüm zamanlar',
  'panel.stat.groupAll': 'Tüm zamanların verileri',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.groupYear': 'Seçilen yılın verileri: {year}',
  'panel.stat.announceAll': 'Tüm zamanların verileri gösteriliyor.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.announceYear': 'Seçilen yılın verileri gösteriliyor: {year}.',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.tripsYear': 'Başlangıç yılı: {year}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.daysYear': 'Seyahatlerin başlangıç yılı: {year}',
  'panel.stat.countries': 'Seyahatlerindeki ülkeler',
  'panel.stat.countriesCaption': 'Bu seyahatlerdeki farklı ülkeler',
  'panel.stat.streak': 'Ardışık seyahat yılların',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakRange':
    'Her yıl seyahat, ilk yıl: {first}, son yıl: {last}',
  // Translators: use a form that needs no case suffix on the year digits (especially hu and tr).
  'panel.stat.streakSingle': 'Bir seyahat, yıl: {last}',
  'panel.stat.streakNone': 'Seri başlatmak için tarihli bir seyahat ekle',
} satisfies TranslationOf<typeof En>

export default messages
