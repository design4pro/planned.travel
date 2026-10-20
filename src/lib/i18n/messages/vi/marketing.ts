/**
 * The public pages' copy, in vi.
 *
 * Authored from `../en/marketing.ts`, never from another product's catalogue
 * (`docs/SPEC.md` §1, §8.9). The English file is the schema:
 * `TranslationOf<typeof En>` makes a missing or invented key a compile error,
 * and `__tests__/parity.test.ts` checks the placeholders.
 *
 * No price appears below, in any form. See the note in the English file.
 *
 * **Trình bày.** Tên sản phẩm giữ nguyên chữ Latinh.
 */

import type { TranslationOf } from '../../types'
import type En from '../en/marketing'

const messages = {
  /* ---------------------- actions, shared by the header and the footer */
  'action.startFree': 'Bắt đầu miễn phí',
  'action.signIn': 'Đăng nhập',
  'action.pricing': 'Giá',
  'action.seePricing': 'Xem giá',
  'action.skipToContent': 'Chuyển đến nội dung',
  /* -------------------------------------------------------- the header */
  'nav.home': 'planned.travel — trang chủ',
  'nav.onThisPage': 'Trong trang này',
  'anchor.planner': 'Lịch trình',
  'anchor.modules': 'Phân hệ',
  /* ----------------------------------------------- /pricing */
  'visual.dropOnDay': 'Thả vào ngày {day}',
  'legal.summaryNote':
    'Bản tóm tắt ở đây để bạn đọc. Điều thật sự áp dụng là phần bên dưới.',
  'visual.daysTravelled': 'Số ngày đi',
  'visual.acrossEveryTrip': 'trên mọi chuyến đi',
  'visual.mapFilled': 'đã điền {percent}% bản đồ',
  'visual.previewSummary':
    'Bản xem trước bảng điều khiển planned.travel: chuyến đi kế tiếp kèm ngày, số người và số địa điểm; tổng số quốc gia đã đến, số chuyến đi và số ngày đi; bản đồ lộ trình; và hai đặt chỗ gần nhất.',
  'visual.placesMapped': {
    other: '{value} địa điểm trên bản đồ',
  },
  'visual.splitWays': {
    other: 'chia {value} người',
  },
  'visual.tripTotal': 'Tổng chuyến đi',
  'visual.paidSplit': '{who} đã trả · {split}',
  'visual.nextUp': 'Tiếp theo',
  'visual.ofTotal': '{done} trên {total}',
  'visual.awaitingReply': 'Đang chờ trả lời',
  'visual.upcoming': 'Sắp tới',
  'visual.days': {
    other: '{value} ngày',
  },
  'visual.places': {
    other: '{value} địa điểm',
  },
  'visual.transfersLeft': {
    other: 'còn {value} lần chuyển',
  },

  'legal.badge.version': 'Phiên bản {version}',
  'legal.badge.effective': 'Có hiệu lực từ {updated}',
  'legal.notice.title': 'Đây là bản mẫu, không phải tư vấn pháp lý',
  'legal.notice.body':
    'Nó được viết bằng tiếng Anh đơn giản để làm điểm khởi đầu thật sự hữu ích cho một dịch vụ lên kế hoạch du lịch nhỏ, và mọi chỗ trống mà một doanh nghiệp phải điền đều được đánh dấu. Hãy nhờ luật sư có chuyên môn trong khu vực pháp lý của bạn rà soát và điều chỉnh trước khi bạn nhận dù chỉ một khách hàng. Không có gì ở đây khẳng định planned.travel có bất kỳ chứng nhận, kiểm định hay chuẩn tuân thủ nào.',
  'legal.contents': 'Nội dung',
  'legal.shortVersion': 'Bản ngắn',
  'legal.both': 'Cả hai văn bản áp dụng cùng nhau.',

  'landing.plans.title': 'Bắt đầu miễn phí. Trả tiền khi nó xứng đáng.',
  'landing.plans.lede':
    'Mọi gói đều có lịch trình theo ngày, bản đồ, ngân sách và danh sách hành lý. Các gói trả phí - từ {price} mỗi tháng - mở khóa chuyến đi không giới hạn, đặt chỗ, sổ tay và xuất dữ liệu.',
  'landing.plans.ledeFree':
    'Mọi gói đều có lịch trình theo ngày, bản đồ, ngân sách và danh sách hành lý. Các gói trả phí mở khóa chuyến đi không giới hạn, đặt chỗ, sổ tay và xuất dữ liệu.',
  'landing.plans.compare': 'So sánh từng giới hạn, từng dòng một',
  'landing.questions.title': 'Câu hỏi, trả lời thẳng thắn',
  'landing.questions.lede':
    'Năm điều người ta thật sự muốn biết trước khi bắt đầu.',
  'cta.heading': 'Chuyến đi tới của bạn đã xứng đáng được lên kế hoạch tử tế',
  'cta.lede':
    'Hai chuyến đi, cả bản đồ, lịch trình và danh sách hành lý: miễn phí, không cần thẻ và không có đồng hồ đếm ngược.',
  'landing.faq.seats.q': 'Những người đi cùng tôi có phải trả tiền không?',
  'landing.faq.seats.a':
    'Không. Mọi người bạn mời vào không gian làm việc {crew} đều nằm trong số chỗ của nó. Họ đăng nhập bằng tài khoản riêng và chỉ thấy những chuyến bạn đã thêm họ vào.',
  'landing.faq.phone.q': 'Nó chạy tốt trên điện thoại chứ?',
  'landing.faq.phone.a':
    'Có. Bố cục cho điện thoại được vẽ riêng chứ không phải bóp nhỏ từ bản máy tính, và đây là một trang web: không có gì phải cài và không có gì phải cập nhật.',
  'landing.faq.privacy.q': 'Ai có thể xem chuyến đi của tôi?',
  'landing.faq.privacy.a':
    'Một chuyến đi thuộc về một không gian làm việc, và chỉ những người được mời vào đó mới mở được. Không có gì công khai, không có bảng tin khám phá, và mặc định không chia sẻ gì với ai.',
  'landing.faq.stop.q': 'Chuyến đi của tôi ra sao nếu tôi ngừng trả tiền?',
  'landing.faq.stop.a':
    'Không có gì bị xóa. Các mô-đun trả phí khóa lại, chuyến đi của bạn nằm đúng chỗ, và tất cả mở lại ngay khi bạn đăng ký. Gói {free} vẫn không mất tiền, không đếm ngược.',

  'action.startPlanning': 'Bắt đầu lên kế hoạch miễn phí',
  'cta.comparePlans': 'So sánh các gói',
  'landing.hero.eyebrow': 'Lên kế hoạch chuyến đi cùng nhau',
  'landing.hero.title': 'Lên kế hoạch cho chuyến đi.',
  'landing.hero.titleQuiet': 'Không phải cho bảng tính.',
  'landing.hero.lede':
    'Một lịch trình trên bản đồ thật, chia sẻ trực tiếp với tất cả người cùng đi - kèm đặt chỗ, tiền và danh sách hành lý gắn ngay vào đó.',
  'landing.hero.secondary': 'Xem chi phí bao nhiêu',
  'landing.trust.noCard': 'Không cần thẻ để bắt đầu',
  'landing.trust.noAds': 'Không quảng cáo, không liên kết tiếp thị',
  'landing.trust.export': 'Xuất mọi thứ, bất cứ lúc nào',

  'proof.eyebrow': 'Trả lời thẳng',
  'proof.title': 'Không có lời chứng thực, vì chúng tôi chưa xứng đáng',
  'proof.lede':
    'planned.travel còn mới. Thay vì bịa ra một lời khen hay đi vay logo của ai đó, đây chính xác là nó làm gì, dành cho ai, và điều gì nó sẽ không bao giờ làm với bạn.',
  'proof.who.label': 'Dành cho ai',
  'proof.who.heading': 'Dành cho người rốt cuộc phải lập bảng tính',
  'proof.who.body':
    'Cho các cặp đôi, gia đình và nhóm bạn muốn một kế hoạch duy nhất mà ai cũng thấy, thay vì sáu ảnh chụp màn hình, ba nhóm chat và một ghi chú chung không ai mở từ tháng Ba.',
  'proof.not.label': 'Không phải là gì',
  'proof.not.heading':
    'Không phải trang đặt phòng, cũng không bán cho một trang như thế',
  'proof.not.body':
    'Chúng tôi không lấy hoa hồng, không mang quảng cáo và không đặt liên kết tiếp thị, nên không có gì trên trang lặng lẽ đẩy bạn về một khách sạn cụ thể. Bạn trả tiền cho chúng tôi, nghĩa là chúng tôi làm việc cho bạn.',
  'proof.where.label': 'Đồ của bạn nằm ở đâu',
  'proof.where.heading':
    'Trên Cloudflare, trong không gian làm việc của riêng bạn',
  'proof.where.body':
    'Chuyến đi nằm trong cơ sở dữ liệu giới hạn theo không gian làm việc của bạn, còn tệp nằm trong kho đối tượng của chính chúng tôi, cả hai đều phục vụ từ biên mạng Cloudflare. Polar, đơn vị bán hàng chính thức của chúng tôi, xử lý thanh toán và xuất hóa đơn, nên số thẻ của bạn không bao giờ đến tay chúng tôi.',
  'proof.promise.ads.title': 'Không quảng cáo, không phân tích của bên thứ ba',
  'proof.promise.ads.body':
    'Không có gì trên trang này đang đo bạn cho một ai khác.',
  'proof.promise.sold.title':
    'Chuyến đi của bạn không bao giờ bị bán hay cho thuê',
  'proof.promise.sold.body':
    'Không cho nhà quảng cáo, không cho công ty du lịch, không cho ai cả.',
  'proof.promise.leave.title': 'Rời đi khi nào bạn muốn, mang theo tất cả',
  'proof.promise.leave.body':
    'Lịch trình PDF, tệp lịch và các địa điểm của bạn dưới dạng GeoJSON.',
  'proof.certification':
    'Hôm nay chúng tôi không có chứng nhận an ninh nào, và cũng sẽ không ngụ ý là có. Khi planned.travel được kiểm định theo một tiêu chuẩn, đây là nơi chúng tôi nêu tên tiêu chuẩn, đơn vị kiểm định và ngày - chứ không sớm hơn.',

  'feature.modules.title': 'Phần còn lại của chuyến đi, đã lo xong',
  'feature.modules.lede':
    'Mỗi mô-đun làm tốt đúng một việc rồi chuyển kết quả cho các mô-đun khác. Ở đây không có tab để trống chờ một bản phát hành tương lai.',
  'feature.module.lists.benefit': 'Không ai đến mà thiếu cục chuyển đổi điện.',
  'feature.module.lists.detail':
    'Hành lý, việc cần làm, đồ phải mua và giấy tờ: mỗi việc một danh sách, chia sẻ với tất cả người cùng đi và tích dần khi xong.',
  'feature.module.journal.name': 'Sổ tay',
  'feature.module.journal.benefit':
    'Chuyến đi thành một câu chuyện, không phải một thư mục.',
  'feature.module.journal.detail':
    'Các mục xếp theo ngày, kèm ảnh bạn chụp, nơi bạn ở, thời tiết và cảm giác thật của ngày đó.',
  'feature.module.atlas.benefit': 'Một bản đồ cho mọi nơi bạn từng đến.',
  'feature.module.atlas.detail':
    'Đánh dấu một quốc gia đã đến và nó vào bản đồ thế giới của bạn, kèm lần đầu, lần gần nhất và số lần bạn quay lại.',
  'feature.module.vacay.benefit': 'Xin phép nghỉ trước khi mua vé bay.',
  'feature.module.vacay.detail':
    'Đánh dấu những ngày bạn đi vắng và cả năm tự đầy lên: cuối tuần, ngày lễ và ngày nghỉ của mọi người khác trên cùng một lưới.',
  'feature.module.collab.benefit': 'Các quyết định ở lại cùng chuyến đi.',
  'feature.module.collab.detail':
    'Mỗi chuyến một luồng trao đổi, ghi chú chung cho những điều ai cũng phải nhớ, và một cuộc bình chọn cho lúc cả nhóm không thống nhất được bữa tối.',
  'feature.module.files.benefit': 'Thẻ lên máy bay ở nơi bạn tìm được.',
  'feature.module.files.detail':
    'Xác nhận, vé, giấy bảo hiểm và biên lai gắn vào đúng chuyến đi của chúng, không bị vùi trong hộp thư.',

  'feature.planner.title': 'Lịch trình từng ngày vẽ trên bản đồ thật',
  'feature.planner.lede':
    'Thu thập những nơi bạn muốn đến, rồi kéo chúng vào một ngày. Bản đồ vẽ lại tuyến đường ngay khi bạn làm, nên bạn thấy liền khi một buổi sáng khiến bạn băng qua thành phố hai lần.',
  'feature.planner.point.days':
    'Một cột mỗi ngày, kèm ngày, thời tiết và nơi bạn ngủ.',
  'feature.planner.point.unscheduled':
    'Những nơi chưa có ngày chờ ở cột riêng cho đến khi được xếp vào một ngày.',
  'feature.planner.point.crew':
    'Ở {crew} mọi người kéo cùng lúc: con trỏ trực tiếp, đồng bộ tức thì, không cần tải lại.',
  'feature.planner.point.tiles':
    'Ô bản đồ vector lấy từ kho của chính chúng tôi, nên không nhà cung cấp bản đồ nào theo dõi bạn lên kế hoạch.',
  'feature.costs.title': 'Chi phí chung thật sự tất toán được',
  'feature.costs.lede':
    'Ghi lại chi tiêu bằng đúng tiền tệ của chuyến đi, chia từng khoản theo đúng thỏa thuận thật, và xem chuỗi chuyển tiền ngắn nhất khép lại tất cả.',
  'feature.costs.point.split':
    'Chia đều, theo tỷ lệ, hay đúng số tiền: theo từng khoản, không phải cả chuyến.',
  'feature.costs.point.currency':
    'Mọi thứ quy về một loại tiền của chuyến đi để tổng số có nghĩa.',
  'feature.costs.point.settle':
    'Màn hình tất toán nói ai trả cho ai, và ghi nhận khoản chuyển ngay khi xong.',
  'feature.costs.point.receipt':
    'Kèm biên lai vào khoản chi, để con số luôn có bằng chứng.',
  'feature.book.title': 'Mọi đặt chỗ, kèm mã bạn cần ở cửa',
  'feature.book.lede':
    'Chỗ ở, bàn ăn, tour và vé trong một danh sách, cạnh các chuyến bay, tàu và phà đưa bạn giữa chúng: mỗi thứ đều có số xác nhận và ngày mà nó thuộc về.',
  'feature.book.point.legs':
    'Chặng di chuyển mang theo số ghế, sân ga, nhà chờ và mã đặt chỗ.',
  'feature.book.point.day':
    'Một đặt chỗ gắn với một ngày, nên xuất hiện trong lịch trình mà không phải nhập lại.',
  'feature.book.point.states':
    'Đã yêu cầu, đã xác nhận và đã hủy là những trạng thái riêng, không phải ghi chú trong một ô.',
  'feature.book.point.export':
    'Xuất cả chuyến đi thành lịch trình PDF hoặc tệp lịch trước khi bay.',

  'pricing.faq.trial.q': 'Khi bản dùng thử kết thúc thì sao?',
  'pricing.faq.trial.a':
    'Bản dùng thử chuyển thành gói trả phí. Polar lưu một phương thức thanh toán khi bản dùng thử bắt đầu và thu phí vào ngày nó kết thúc, nên nếu bạn huỷ trước đó thì không bao giờ bị thu. Trong cả hai trường hợp, không có gì bị xoá: các phân hệ trả phí bị khoá, các chuyến đi vẫn đúng chỗ, và mọi thứ mở lại ngay khi bạn đăng ký.',
  'pricing.faq.seller.q': 'Thực ra tôi đang mua từ ai?',
  'pricing.faq.seller.a':
    'Từ Polar. Họ là bên bán chính thức của chúng tôi: bán gói đăng ký cho bạn với vai trò đại lý, nhận thanh toán, xuất hoá đơn dưới tên họ, và xác định, thu, nộp thuế bán hàng hoặc VAT mà nước bạn thu. Hoàn tiền và tranh chấp thẻ cũng giải quyết với họ. Dịch vụ vẫn do chúng tôi vận hành, và chúng tôi trả lời email của bạn.',
  'pricing.faq.change.q': 'Tôi có thể đổi gói giữa một chuyến đi không?',
  'pricing.faq.change.a':
    'Có. Lên gói có hiệu lực ngay và được chia theo ngày; xuống gói có hiệu lực vào cuối kỳ bạn đã trả, nên bạn không bao giờ mất quyền truy cập đã trả tiền.',
  'pricing.faq.seats.q':
    'Tính phí theo thành viên ở gói {crew} hoạt động thế nào?',
  'pricing.faq.seats.a':
    'Bạn trả cho số chỗ thực sự dùng, và có thể đổi số đó bất cứ lúc nào. Lời mời còn treo cũng tính vào số chỗ, nên một không gian không bao giờ âm thầm vượt gói.',
  'pricing.faq.guests.q': 'Những người đi cùng tôi có cần gói riêng không?',
  'pricing.faq.guests.a':
    'Không. Mọi người bạn mời vào không gian làm việc {crew} đều được số chỗ của nó bao gồm. Họ đăng nhập bằng tài khoản riêng và thấy những chuyến đi mà họ được thêm vào.',
  'pricing.faq.storage.q': 'Những gì được tính vào dung lượng lưu trữ?',
  'pricing.faq.storage.a':
    'Ảnh, vé, xác nhận và bất kỳ tệp nào bạn gắn vào chuyến đi. Ô bản đồ và bản thân ứng dụng không bao giờ được tính. Trong Cài đặt bạn thấy chính xác thứ gì đang chiếm dung lượng.',
  'pricing.faq.export.q': 'Tôi có thể lấy dữ liệu của mình ra không?',
  'pricing.faq.export.a':
    'Luôn luôn. Mỗi chuyến đi xuất ra dưới dạng lịch trình PDF và tệp lịch, còn các địa điểm xuất ra dưới dạng GeoJSON. Đó là chuyến đi của bạn, không phải của chúng tôi.',

  /* ------------------------------------ the plan card lines */
  'pricing.card.noCard': 'Không thẻ, không kỳ hạn, không đếm ngược',
  'pricing.card.yearlyPerSeat':
    '{amount} mỗi năm cho mỗi thành viên, thu một lần',
  'pricing.card.yearly': '{amount} thu một lần mỗi năm',
  'pricing.card.seatsUnlimited': 'Thành viên không giới hạn',
  'pricing.card.tripsUnlimited': 'chuyến đi không giới hạn',
  'pricing.card.startFree': 'Bắt đầu miễn phí',
  'pricing.card.startTrial': 'Dùng thử {plan}',
  'pricing.card.popular': 'Được chọn nhiều nhất',
  'pricing.card.noteYearly': 'Thu một lần mỗi năm. Hai tháng chúng tôi mời.',
  'pricing.card.noteMonthly': 'Thu theo tháng. Đổi hoặc huỷ bất cứ lúc nào.',
  'pricing.card.trial': {
    other: 'Dùng thử {value} ngày, thẻ trước, thu phí khi kết thúc',
  },
  'pricing.card.seatsUpTo': {
    other: 'Tối đa {value} thành viên',
  },
  'pricing.card.trips': {
    other: '{value} chuyến cùng lúc',
  },

  'pricing.feature.storage': '{size} cho ảnh và tài liệu',
  'pricing.feature.storageShared': '{size} dùng chung cho ảnh và tài liệu',
  'pricing.feature.free.tripsDetail':
    'Lưu trữ một chuyến để bắt đầu chuyến khác',
  'pricing.feature.solo.modules': 'Mọi mô-đun lập kế hoạch',
  'pricing.feature.solo.modulesDetail': 'Đặt chỗ, sổ tay, ngân sách, hành lý',
  'pricing.feature.crew.membersDetail':
    'Tính phí theo từng thành viên, đổi lúc nào cũng được',
  'pricing.feature.crew.realtimeDetail': 'Con trỏ trực tiếp và đồng bộ tức thì',
  'pricing.feature.crew.supportDetail':
    'Người thật trả lời trong một ngày làm việc',

  'pricing.hero.eyebrow': 'Hai chuyến đi miễn phí, mãi mãi',
  'pricing.hero.title': 'Hãy lên kế hoạch cho đàng hoàng.',
  'pricing.hero.titleQuiet': 'Trả cho phần bạn dùng.',
  'pricing.hero.lede':
    'Lên kế hoạch hai chuyến đi miễn phí. Mở mọi phân hệ cho một người, hoặc rủ cả nhóm cùng sửa một lịch trình.',
  'pricing.hero.taxNote':
    'Giá tính bằng đô la Mỹ, chưa gồm thuế bán hàng hay VAT. Polar là bên bán chính thức của chúng tôi: Polar là bên xuất hiện trên hoá đơn, tính phần nước bạn thu, cộng vào khi thanh toán và nộp lại. Bạn có thể huỷ bất cứ lúc nào, ngay trong sản phẩm.',
  'pricing.compare.eyebrow': 'Cạnh nhau',
  'pricing.compare.title': 'Từng giới hạn, đặt cạnh nhau',
  'pricing.compare.lede':
    'Một bảng, dựng từ chính danh mục mà hệ thống thanh toán đọc. Nếu một dòng nói phân hệ có trong gói, phần kiểm tra quyền cũng nói vậy.',
  'pricing.compare.caption': 'So sánh tính năng và giới hạn giữa cả ba gói',
  'pricing.compare.feature': 'Tính năng',
  'pricing.compare.limits': 'Giới hạn',
  'pricing.compare.included': 'Có',
  'pricing.compare.notIncluded': 'Không có',
  'pricing.compare.includedIn': 'Có trong {plan}',
  'pricing.compare.notIn': 'Không có trong {plan}',
  'pricing.questions.eyebrow': 'Trước khi bạn hỏi',
  'pricing.questions.title': 'Câu hỏi, đã trả lời',
  'pricing.questions.lede': 'Thanh toán, dùng thử và lấy lại dữ liệu của bạn.',
  'pricing.cta.secondary': 'Xem cách hoạt động',
  'pricing.module.itinerary': 'Lịch trình từng ngày',
  'pricing.module.map': 'Bản đồ tương tác',
  'pricing.module.budget': 'Ngân sách và chia chi phí',
  'pricing.module.packing': 'Danh sách hành lý và việc cần làm',
  'pricing.module.reservations': 'Đặt chỗ',
  'pricing.module.journal': 'Nhật ký hành trình',
  'pricing.module.atlas': 'Bản đồ các nước đã đến',
  'pricing.module.collaboration': 'Mời người cùng đi',
  'pricing.module.realtime': 'Cộng tác trực tiếp',
  'pricing.module.offlineMaps': 'Bản đồ ngoại tuyến',
  'pricing.module.pdfExport': 'Xuất PDF và lịch',
  'pricing.module.prioritySupport': 'Hỗ trợ ưu tiên',

  'anchor.plans': 'Gói',
  'anchor.compare': 'So sánh',
  'anchor.questions': 'Câu hỏi',
  /* -------------------------------------------------------- the footer */
  'footer.blurb':
    'Một nơi duy nhất cho lịch trình, bản đồ, chỗ đã đặt, tiền và danh sách hành lý — chia sẻ với tất cả những người cùng đi.',
  'footer.attribution':
    'Chạy trên Cloudflare Workers. Dữ liệu bản đồ © những người đóng góp OpenStreetMap. Bán và xuất hoá đơn qua Polar, đơn vị bán hàng chính thức của chúng tôi.',
  'footer.column.product': 'Sản phẩm',
  'footer.column.account': 'Tài khoản',
  'footer.link.overview': 'Tổng quan',
  'footer.link.everyModule': 'Tất cả phân hệ',
  'footer.link.dayPlanner': 'Lịch trình theo ngày',
  'footer.link.sharedCosts': 'Chi phí chung',
  'footer.link.reservations': 'Chỗ đã đặt',
  'footer.link.atlasJournal': 'Atlas và nhật ký',
  'footer.link.createAccount': 'Tạo tài khoản',
  'footer.link.terms': 'Điều khoản dịch vụ',
  'footer.link.privacy': 'Thông báo về quyền riêng tư',
} satisfies TranslationOf<typeof En>

export default messages
