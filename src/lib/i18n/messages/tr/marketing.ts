/**
 * The public pages' copy, in tr.
 *
 * Authored from `../en/marketing.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders.
 *
 * No price appears below, in any form. See the note in the English file.
 *
 * **Yazım.** Ürün adları Latin harfleriyle kalır.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/marketing'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  'action.startFree': 'Ücretsiz başla',
  'action.signIn': 'Giriş yap',
  'action.pricing': 'Fiyatlar',
  'action.seePricing': 'Fiyatları gör',
  'action.skipToContent': 'İçeriğe geç',
  /* -------------------------------------------------------- the header */
  'nav.home': 'planned.travel — ana sayfa',
  'nav.onThisPage': 'Bu sayfada',
  'anchor.planner': 'Planlayıcı',
  'anchor.modules': 'Modüller',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': '{day}. güne bırak',
  'legal.summaryNote':
    'Özet okunmak için burada. Gerçekte geçerli olan aşağıdakiler.',
  'visual.daysTravelled': 'Seyahat günü',
  'visual.acrossEveryTrip': 'tüm seyahatlerde',
  'visual.mapFilled': 'haritanın %{percent}’i dolduruldu',
  'visual.previewSummary':
    'planned.travel panosunun bir önizlemesi: tarihleri, yolcuları ve yer sayısıyla bir sonraki seyahat; gezilen ülke, seyahat ve seyahat günü toplamları; güzergâhın haritası; ve sıradaki iki rezervasyon.',
  'visual.placesMapped': {
    one: 'haritada {value} yer',
    other: 'haritada {value} yer',
  },
  'visual.splitWays': {
    one: 'bölünmedi',
    other: '{value} kişiye bölündü',
  },
  'visual.tripTotal': 'Seyahat toplamı',
  'visual.paidSplit': '{who} ödedi · {split}',
  'visual.nextUp': 'Sırada',
  'visual.ofTotal': '{total} içinde {done}',
  'visual.awaitingReply': 'Yanıt bekliyor',
  'visual.upcoming': 'Yaklaşan',
  'visual.days': {
    one: '{value} gün',
    other: '{value} gün',
  },
  'visual.places': {
    one: '{value} yer',
    other: '{value} yer',
  },
  'visual.transfersLeft': {
    one: '{value} transfer kaldı',
    other: '{value} transfer kaldı',
  },

  'legal.badge.version': 'Sürüm {version}',
  'legal.badge.effective': '{updated} tarihinden geçerli',
  'legal.notice.title': 'Bu bir şablon, hukuki tavsiye değil',
  'legal.notice.body':
    'Küçük bir seyahat planlama hizmeti için gerçekten işe yarar bir başlangıç noktası olsun diye yalın İngilizceyle yazıldı ve bir işletmenin doldurması gereken her boşluk işaretlendi. Tek bir müşteri kabul etmeden önce kendi yargı çevrende yetkin bir avukata inceletip uyarlat. Burada hiçbir şey planned.travel’in sahip olduğu bir sertifika, denetim ya da uyum standardı olduğunu ileri sürmüyor.',
  'legal.contents': 'İçindekiler',
  'legal.shortVersion': 'Kısa hâli',
  'legal.both': 'İki belge birlikte geçerlidir.',

  'landing.plans.title': 'Ücretsiz başla. Hak ettiğinde öde.',
  'landing.plans.lede':
    'Her paket gün planlayıcıyı, haritayı, bütçeleri ve bavul listelerini içeriyor. Ücretli paketler - aylık {price} üzerinden - sınırsız seyahati, rezervasyonları, günlüğü ve dışa aktarmayı açıyor.',
  'landing.plans.ledeFree':
    'Her paket gün planlayıcıyı, haritayı, bütçeleri ve bavul listelerini içeriyor. Ücretli paketler sınırsız seyahati, rezervasyonları, günlüğü ve dışa aktarmayı açıyor.',
  'landing.plans.compare': 'Her sınırı satır satır karşılaştır',
  'landing.questions.title': 'Sorular, dosdoğru yanıtlar',
  'landing.questions.lede':
    'İnsanların başlamadan önce gerçekten bilmek istediği beş şey.',
  'cta.heading': 'Bir sonraki seyahatin şimdiden düzgün planlanmayı hak ediyor',
  'cta.lede':
    'İki seyahat, haritanın tamamı, gün planı ve bavul listeleri: ücretsiz, kartsız ve geri sayımsız.',
  'landing.faq.seats.q':
    'Birlikte seyahat ettiğim kişiler de ödemek zorunda mı?',
  'landing.faq.seats.a':
    'Hayır. {crew} çalışma alanına davet ettiğin herkes, o alanın kişi sayısıyla kapsanıyor. Kendi hesabıyla giriyor ve yalnızca eklediğin seyahatleri görüyor.',
  'landing.faq.phone.q': 'Telefonda düzgün çalışıyor mu?',
  'landing.faq.phone.a':
    'Evet. Mobil düzenler masaüstünden sıkıştırılmıyor, ayrıca çiziliyor; ve bu bir web sitesi, yani kurulacak bir şey de güncel tutulacak bir şey de yok.',
  'landing.faq.privacy.q': 'Seyahatimi kim görebilir?',
  'landing.faq.privacy.a':
    'Bir seyahat tek bir çalışma alanına ait ve onu yalnızca o alana davet edilenler açabilir. Hiçbir şey herkese açık değil, keşfet akışı yok ve varsayılan olarak hiçbir şey kimseyle paylaşılmıyor.',
  'landing.faq.stop.q': 'Ödemeyi bırakırsam seyahatlerime ne olur?',
  'landing.faq.stop.a':
    'Hiçbir şey silinmiyor. Ücretli modüller kilitleniyor, seyahatlerin tam olduğu yerde kalıyor ve abone olduğun anda her şey yeniden açılıyor. {free} paket ücretsiz kalıyor, geri sayım yok.',

  'action.startPlanning': 'Ücretsiz planlamaya başla',
  'cta.comparePlans': 'Paketleri karşılaştır',
  'landing.hero.eyebrow': 'Birlikte seyahat planlama',
  'landing.hero.title': 'Seyahati planla.',
  'landing.hero.titleQuiet': 'Tabloyu değil.',
  'landing.hero.lede':
    'Gerçek bir haritada tek bir program, gidenlerin hepsiyle canlı paylaşılıyor - rezervasyonlar, para ve bavul listesi ona bağlı.',
  'landing.hero.secondary': 'Ne kadara geldiğini gör',
  'landing.trust.noCard': 'Başlamak için kart gerekmez',
  'landing.trust.noAds': 'Reklam yok, ortaklık bağlantısı yok',
  'landing.trust.export': 'Her şeyi dışa aktar, ne zaman istersen',

  'proof.eyebrow': 'Dolambaçsız yanıtlar',
  'proof.title': 'Referans yok, çünkü henüz hak etmedik',
  'proof.lede':
    'planned.travel yeni. Bir alıntı uydurmak ya da birinin logosunu ödünç almak yerine, burada tam olarak ne yaptığı, kimin için olduğu ve sana asla ne yapmayacağı yazıyor.',
  'proof.who.label': 'Kimin için',
  'proof.who.heading': 'Sonunda tabloyu hazırlayan kişi için',
  'proof.who.body':
    'Altı ekran görüntüsü, üç grup sohbeti ve marttan beri kimsenin açmadığı ortak bir not yerine, herkesin görebildiği tek bir plan isteyen çiftler, aileler ve arkadaş grupları için.',
  'proof.not.label': 'Ne değil',
  'proof.not.heading': 'Rezervasyon sitesi değil, birine satılık da değil',
  'proof.not.body':
    'Komisyon almıyoruz, reklam taşımıyoruz ve ortaklık bağlantısı koymuyoruz; yani sayfada hiçbir şey seni sessizce belirli bir otele yönlendirmiyor. Bize sen ödüyorsun, yani senin için çalışıyoruz.',
  'proof.where.label': 'Eşyaların nerede duruyor',
  'proof.where.heading': 'Cloudflare üzerinde, kendi çalışma alanında',
  'proof.where.body':
    'Seyahatler çalışma alanına daraltılmış bir veritabanında, dosyalar kendi nesne depomuzda duruyor; ikisi de Cloudflare’in kenar ağından sunuluyor. Kayıtlı satıcımız Polar ödemeyi yürütüyor ve faturayı kesiyor, yani kart numaran bize hiç ulaşmıyor.',
  'proof.promise.ads.title': 'Reklam yok, üçüncü taraf analitiği yok',
  'proof.promise.ads.body': 'Bu sayfada hiçbir şey seni başkası için ölçmüyor.',
  'proof.promise.sold.title': 'Seyahatlerin asla satılmıyor ya da kiralanmıyor',
  'proof.promise.sold.body':
    'Ne reklamcılara, ne seyahat şirketlerine, kimseye.',
  'proof.promise.leave.title': 'İstediğin zaman ayrıl, her şeyi yanına al',
  'proof.promise.leave.body':
    'PDF programlar, takvim dosyaları ve yerlerin GeoJSON olarak.',
  'proof.certification':
    'Bugün hiçbir güvenlik sertifikamız yok ve varmış gibi de göstermeyeceğiz. planned.travel bir standarda göre denetlendiğinde, standardı, denetçiyi ve tarihi burada yazacağız - öncesinde değil.',

  'feature.modules.title': 'Seyahatin gerisi, çözülmüş',
  'feature.modules.lede':
    'Her modül tek bir işi düzgün yapıyor ve işini diğerlerine devrediyor. Burada gelecek bir sürümü bekleyen boş sekme yok.',
  'feature.module.lists.benefit': 'Kimse adaptörsüz varmıyor.',
  'feature.module.lists.detail':
    'Bavul, yapılacaklar, alışveriş ve belgeler: iş başına bir liste, giden herkesle paylaşılıyor ve olurken işaretleniyor.',
  'feature.module.journal.name': 'Günlük',
  'feature.module.journal.benefit':
    'Seyahat bir anlatıya dönüşüyor, klasöre değil.',
  'feature.module.journal.detail':
    'Tarih sırasıyla kayıtlar; çektiğin fotoğraflar, nerede olduğun, hava ve o günün gerçekte nasıl geçtiği.',
  'feature.module.atlas.benefit': 'Gittiğin her yerin tek haritası.',
  'feature.module.atlas.detail':
    'Bir ülkeyi gezildi olarak işaretle, dünya haritana katılıyor: ilk gidiş, en son gidiş ve kaç kez döndüğün.',
  'feature.module.vacay.benefit': 'İzni uçuştan önce al.',
  'feature.module.vacay.detail':
    'Uzakta olduğun günleri işaretle, yıl kendiliğinden doluyor: hafta sonları, resmî tatiller ve herkesin izni aynı ızgarada.',
  'feature.module.collab.benefit': 'Kararlar seyahatin yanında kalıyor.',
  'feature.module.collab.detail':
    'Seyahat başına bir konu, herkesin hatırlaması gerekenler için ortak notlar ve grup akşam yemeğinde anlaşamayınca bir anket.',
  'feature.module.files.benefit': 'Biniş kartları, bulabileceğin yerde.',
  'feature.module.files.detail':
    'Onaylar, biletler, sigorta belgeleri ve fişler ait oldukları seyahate ekli, bir gelen kutusuna gömülü değil.',

  'feature.planner.title': 'Gerçek bir haritaya çizilmiş gün gün program',
  'feature.planner.lede':
    'Görmek istediğin yerleri topla, sonra bir güne sürükle. Harita sen çalışırken rotayı yeniden çiziyor, böylece bir sabahın seni şehri iki kez geçirdiğini hemen görüyorsun.',
  'feature.planner.point.days':
    'Gün başına bir kolon: tarihi, havası ve uyuduğun yer.',
  'feature.planner.point.unscheduled':
    'Tarihi olmayan yerler kendi kolonunda, bir gün alana kadar bekliyor.',
  'feature.planner.point.crew':
    '{crew} planında herkes aynı anda sürüklüyor: canlı imleçler, anında eşitleme, yenileme yok.',
  'feature.planner.point.tiles':
    'Vektör karolar kendi depomuzdan geliyor, yani hiçbir harita sağlayıcısı ne planladığını izlemiyor.',
  'feature.costs.title': 'Gerçekten kapanan ortak masraflar',
  'feature.costs.lede':
    'Harcamayı seyahatin kendi para biriminde yaz, her masrafı gerçekten anlaştığınız gibi böl ve her şeyi kapatan en kısa transfer dizisini gör.',
  'feature.costs.point.split':
    'Eşit olarak, paya göre ya da tam tutarla: masraf başına, seyahat başına değil.',
  'feature.costs.point.currency':
    'Her şey tek bir seyahat para birimine çevriliyor, böylece toplam bir şey ifade ediyor.',
  'feature.costs.point.settle':
    'Hesaplaşma görünümü kimin kime ödediğini söylüyor ve transfer olunca kaydediyor.',
  'feature.costs.point.receipt':
    'Fişi masrafa ekle, böylece tutarın her zaman kanıtı olur.',
  'feature.book.title': 'Her rezervasyon, kapıda gereken kodla',
  'feature.book.lede':
    'Konaklamalar, masalar, turlar ve biletler tek listede; aralarında seni taşıyan uçuşlar, trenler ve vapurlarla birlikte - her biri onay numarasıyla ve ait olduğu günle.',
  'feature.book.point.legs':
    'Ulaşım bacakları koltuğu, peronu, terminali ve rezervasyon kodunu taşıyor.',
  'feature.book.point.day':
    'Rezervasyon bir güne bağlı, yani yeniden yazmadan programda görünüyor.',
  'feature.book.point.states':
    'Talep edildi, onaylandı ve iptal edildi ayrı durumlar, bir alandaki not değil.',
  'feature.book.point.export':
    'Uçmadan önce tüm seyahati PDF program ya da takvim dosyası olarak dışa aktar.',

  'pricing.faq.trial.q': 'Deneme süresi bitince ne olur?',
  'pricing.faq.trial.a':
    'Deneme, ücretli plana dönüşür. Polar deneme başlarken bir ödeme yöntemi alır ve denemenin bittiği gün tahsil eder; öncesinde iptal edersen hiç ödeme alınmaz. Hiçbir durumda bir şey silinmez: ücretli modüller kilitlenir, gezilerin tam olarak yerinde kalır ve abone olduğun anda her şey yeniden açılır.',
  'pricing.faq.seller.q': 'Aslında kimden satın alıyorum?',
  'pricing.faq.seller.a':
    'Polar’dan. Polar bizim kayıtlı satıcımız: aboneliği sana bizim adımıza satar, ödemeyi alır, faturayı kendi adına keser ve ülkenin aldığı satış vergisi ya da KDV’yi belirler, tahsil eder ve yatırır. İadeler ve kart itirazları da onunla çözülür. Hizmeti hâlâ biz işletiyoruz ve e-postalarına biz yanıt veriyoruz.',
  'pricing.faq.change.q': 'Bir gezinin ortasında plan değiştirebilir miyim?',
  'pricing.faq.change.a':
    'Evet. Üst plana geçiş hemen geçerli olur ve güne göre oranlanır; alt plana geçiş, zaten ödediğin dönemin sonunda başlar, yani ödediğin erişimi hiç kaybetmezsin.',
  'pricing.faq.seats.q': '{crew} planında kişi başı ücretlendirme nasıl işler?',
  'pricing.faq.seats.a':
    'Gerçekten doldurduğun koltuklar için ödersin ve sayıyı dilediğin an değiştirebilirsin. Bekleyen davetler de koltuklarından sayılır, böylece bir çalışma alanı planı sessizce aşamaz.',
  'pricing.faq.guests.q':
    'Birlikte gezdiğim kişilerin kendi aboneliği gerekir mi?',
  'pricing.faq.guests.a':
    'Hayır. {crew} çalışma alanına davet ettiğin herkes o alanın kişi sayısıyla kapsanır. Kendi hesaplarıyla girer ve eklendikleri gezileri görürler.',
  'pricing.faq.storage.q': 'Depolamaya ne dahil?',
  'pricing.faq.storage.a':
    'Fotoğraflar, biletler, onaylar ve bir geziye eklediğin her dosya. Harita karoları ve uygulamanın kendisi asla sayılmaz. Ayarlar’da neyin yer kapladığını tam olarak görürsün.',
  'pricing.faq.export.q': 'Verilerimi dışarı alabilir miyim?',
  'pricing.faq.export.a':
    'Her zaman. Her gezi PDF plan ve takvim dosyası olarak, yerlerin de GeoJSON olarak dışa aktarılır. Bunlar senin gezilerin, bizim değil.',

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': 'Kart yok, süre yok, geri sayım yok',
  'pricing.card.yearlyPerSeat': 'Üye başına yılda {amount}, tek seferde',
  'pricing.card.yearly': 'Yılda bir kez {amount}',
  'pricing.card.seatsUnlimited': 'Sınırsız üye',
  'pricing.card.tripsUnlimited': 'sınırsız gezi',
  'pricing.card.startFree': 'Ücretsiz başla',
  'pricing.card.startTrial': '{plan} planını dene',
  'pricing.card.popular': 'En çok seçilen',
  'pricing.card.noteYearly': 'Yılda bir kez alınır. İki ay bizden.',
  'pricing.card.noteMonthly':
    'Aylık alınır. İstediğin zaman değiştir ya da iptal et.',
  'pricing.card.trial': {
    one: '{value} gün ücretsiz, kart önden, bitince tahsil',
    other: '{value} gün ücretsiz, kart önden, bitince tahsil',
  },
  'pricing.card.seatsUpTo': {
    one: 'En fazla {value} üye',
    other: 'En fazla {value} üye',
  },
  'pricing.card.trips': {
    one: 'aynı anda {value} gezi',
    other: 'aynı anda {value} gezi',
  },

  'pricing.feature.storage': 'Fotoğraflar ve belgeler için {size}',
  'pricing.feature.storageShared': 'Fotoğraflar ve belgeler için ortak {size}',
  'pricing.feature.free.tripsDetail': 'Yenisine başlamak için birini arşivle',
  'pricing.feature.solo.modules': 'Tüm planlama modülleri',
  'pricing.feature.solo.modulesDetail':
    'Rezervasyonlar, günlük, bütçeler, bavul',
  'pricing.feature.crew.membersDetail':
    'Kişi başına faturalanır, istediğin zaman değiştir',
  'pricing.feature.crew.realtimeDetail': 'Canlı imleçler ve anında eşitleme',
  'pricing.feature.crew.supportDetail': 'Bir iş günü içinde insandan yanıt',

  'pricing.hero.eyebrow': 'İki gezi ücretsiz, kalıcı olarak',
  'pricing.hero.title': 'Doğru dürüst planla.',
  'pricing.hero.titleQuiet': 'Kullandığın kadar öde.',
  'pricing.hero.lede':
    'İki geziyi ücretsiz planla. Tek gezgin için her modülü aç, ya da bütün ekibi getir ve aynı planı birlikte düzenleyin.',
  'pricing.hero.taxNote':
    'Fiyatlar ABD doları cinsinden, satış vergisi ve KDV hariç. Polar bizim kayıtlı satıcımız: faturanda görünen o, ülkenin ne aldığını hesaplar, ödemede ekler ve yatırır. Dilediğin zaman, ürünün içinden iptal edebilirsin.',
  'pricing.compare.eyebrow': 'Yan yana',
  'pricing.compare.title': 'Her sınır, karşılaştırıldı',
  'pricing.compare.lede':
    'Tek tablo, faturalandırmanın okuduğu katalogdan üretildi. Bir satır bir modülün dahil olduğunu söylüyorsa, yetki kontrolü de aynı şeyi söyler.',
  'pricing.compare.caption':
    'Üç planın tümünde özellik ve sınır karşılaştırması',
  'pricing.compare.feature': 'Özellik',
  'pricing.compare.limits': 'Sınırlar',
  'pricing.compare.included': 'Dahil',
  'pricing.compare.notIncluded': 'Dahil değil',
  'pricing.compare.includedIn': '{plan} planında dahil',
  'pricing.compare.notIn': '{plan} planında yok',
  'pricing.questions.eyebrow': 'Sormadan önce',
  'pricing.questions.title': 'Sorular, yanıtlandı',
  'pricing.questions.lede': 'Faturalandırma, denemeler ve verini geri alma.',
  'pricing.cta.secondary': 'Nasıl çalıştığını gör',
  'pricing.module.itinerary': 'Gün gün plan',
  'pricing.module.map': 'Etkileşimli harita',
  'pricing.module.budget': 'Bütçeler ve masraf paylaşımı',
  'pricing.module.packing': 'Valiz ve yapılacaklar listeleri',
  'pricing.module.reservations': 'Rezervasyonlar',
  'pricing.module.journal': 'Seyahat günlüğü',
  'pricing.module.atlas': 'Gezilen ülkeler haritası',
  'pricing.module.collaboration': 'Başka gezginleri davet et',
  'pricing.module.realtime': 'Canlı ortak çalışma',
  'pricing.module.offlineMaps': 'Çevrimdışı haritalar',
  'pricing.module.pdfExport': 'PDF ve takvim aktarımı',
  'pricing.module.prioritySupport': 'Öncelikli destek',

  'anchor.plans': 'Paketler',
  'anchor.compare': 'Karşılaştırma',
  'anchor.questions': 'Sorular',
  /* -------------------------------------------------------- the footer */
  'footer.blurb':
    'Güzergâh, harita, rezervasyonlar, para ve valiz listesi için tek bir yer — gelen herkesle paylaşılır.',
  'footer.attribution':
    'Cloudflare Workers üzerinde çalışır. Harita verileri © OpenStreetMap katkıcıları. Satış ve faturalandırma, kayıtlı satıcımız Polar tarafından yapılır.',
  'footer.column.product': 'Ürün',
  'footer.column.account': 'Hesap',
  'footer.link.overview': 'Genel bakış',
  'footer.link.everyModule': 'Tüm modüller',
  'footer.link.dayPlanner': 'Gün planlayıcı',
  'footer.link.sharedCosts': 'Paylaşılan masraflar',
  'footer.link.reservations': 'Rezervasyonlar',
  'footer.link.atlasJournal': 'Atlas ve günlük',
  'footer.link.createAccount': 'Hesap oluştur',
  'footer.link.terms': 'Hizmet koşulları',
  'footer.link.privacy': 'Gizlilik bildirimi',
} satisfies TranslationOf<typeof En>

export default messages
