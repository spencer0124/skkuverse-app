import type { AppLanguage } from '../store/settings';

/**
 * Flutter key → RN key mapping reference
 * ─────────────────────────────────────────
 * Flutter ('키'.tr)            RN (dot-notation)
 * ─────────────────────────────────────────
 * '인사캠'                  → campus.hssc
 * '자과캠'                  → campus.nsc
 * '캠퍼스'                  → nav.campus
 * '정보'                    → nav.info
 * '이동'                    → nav.transit
 * '확인'                    → common.ok
 * '닫기'                    → common.close
 * '다시 시도'               → common.retry
 * '시간표'                  → transit.schedule
 * '인사캠 건물지도'          → campus.hsscMap
 * '자과캠 건물지도'          → campus.nscMap
 * '전체'                    → common.total
 * '운영대수'                → transit.busCount
 * '특이사항'                → transit.notes
 * '다음 셔틀'               → transit.nextShuttle
 * '첫 운행'                 → transit.firstService
 * '다음'                    → transit.next
 * '운행하지 않아요'          → transit.noService
 * '운행 종료'               → transit.serviceEnded
 * '출발'                    → transit.departure
 * '후'                      → transit.later
 * '노선'                    → transit.route
 * '대수'                    → transit.buses
 * '총'                      → transit.totalLabel
 * '편'                      → transit.trips
 * '시간'                    → transit.time
 * '시간_unit'               → transit.timeUnit
 * '분'                      → transit.minutes
 * '기준'                    → transit.based
 * '대 운행 중'              → transit.busesInOperation
 * '번호 없음'               → transit.noNumber
 * '회차'                    → transit.turn
 * '건물'                    → building.building
 * '공간'                    → building.space
 * '건'                      → building.counter
 * '성균관대 건물/공간 검색'   → building.searchPlaceholder
 * '엘리베이터'              → building.elevator
 * '장애인 화장실'            → building.accessibleRestroom
 * '건물 정보를 불러오지 못했어요' → error.buildingLoad
 * '링크를 열 수 없어요'      → error.openLink
 * '잠시 후 다시 시도해 주세요' → error.tryLater
 * '네트워크에 문제가 생겼어요' → error.network
 * '위치 권한이 필요해요'     → location.permissionNeeded
 * '위치 정보를 사용하려면\n권한을 허용해 주세요' → location.permissionMessage
 * '설정으로 이동'            → location.goToSettings
 * '찾는 건물이 없어요'       → empty.noBuildings
 * '찾는 장소가 없어요'       → empty.noPlaces
 * '시간 정보가 없어요'       → empty.noTimeInfo
 * '장소 정보가 없어요'       → empty.noLocationInfo
 * '운행 중인 버스가 없어요'   → empty.noBusesRunning
 * '버스 정보가 없어요'       → empty.noBusInfo
 * '분실물'                  → lostAndFound.title
 * '분실물 게시판'            → lostAndFound.board
 * '물건을 찾고 있어요'       → lostAndFound.lookingForItem
 * '주인을 찾고 있어요'       → lostAndFound.lookingForOwner
 * '학생지원팀'              → lostAndFound.supportTeam
 * '복사했어요!'              → lostAndFound.copied
 * '이메일 주소를 복사했어요'  → lostAndFound.emailCopied
 * '이메일: '                → lostAndFound.emailLabel
 * '인사캠 학생지원팀  '      → lostAndFound.hsscSupportTeam
 * '자과캠 학생지원팀  '      → lostAndFound.nscSupportTeam
 * '유실물은 이렇게 처리돼요'  → lostAndFound.howHandled
 * '→  최초 발견자...'        → lostAndFound.handleProcess
 * '인사캠: 600주년기념관...'  → lostAndFound.supportTeamInfo
 */

const ko = {
  // ── Campus ──
  'campus.hssc': '인사캠',
  'campus.nsc': '자과캠',
  'campus.hsscMap': '인사캠 건물지도',
  'campus.nscMap': '자과캠 건물지도',

  // ── Navigation ──
  'nav.home': '홈',
  'nav.campus': '캠퍼스',
  'nav.info': '정보',
  'nav.transit': '이동',

  // ── Common ──
  'common.ok': '확인',
  'common.close': '닫기',
  'common.retry': '다시 시도',
  'common.total': '전체',

  // ── Transit ──
  'transit.schedule': '시간표',
  'transit.busCount': '운영대수',
  'transit.notes': '특이사항',
  'transit.nextShuttle': '다음 셔틀',
  'transit.firstService': '첫 운행',
  'transit.next': '다음',
  'transit.noService': '운행하지 않아요',
  'transit.serviceEnded': '운행 종료',
  'transit.departure': '출발',
  'transit.later': '후',
  'transit.route': '노선',
  'transit.buses': '대수',
  'transit.totalLabel': '총',
  'transit.trips': '편',
  'transit.time': '시간',
  'transit.timeUnit': '시간',
  'transit.minutes': '분',
  'transit.based': '기준',
  'transit.busesInOperation': '대 운행 중',
  'transit.noNumber': '번호 없음',
  'transit.turn': '회차',

  // ── Search ──
  'search.title': '검색',
  'search.placeholder': '건물, 강의실 검색',
  'search.buildingCount': '건물 {0}건, 공간 {1}건',
  'search.building': '건물',
  'search.space': '공간',
  'search.emptyPrompt': '어떤 건물이나 강의실을 찾고 있나요?',
  'search.noResult': "'{0}'에 대한 결과가 없어요",
  'search.noResultHint': '건물명이나 호실 번호로 다시 검색해보세요',

  // ── Building ──
  'building.building': '건물',
  'building.space': '공간',
  'building.counter': '건',
  'building.searchPlaceholder': '성균관대 건물/공간 검색',
  'building.elevator': '엘리베이터',
  'building.accessibleRestroom': '장애인 화장실',
  'building.floorGuide': '층별 안내',
  'building.buildingInfo': '건물 정보',
  'building.connectedBuildings': '연결 건물',
  'building.passageway': '연결통로',
  'building.buildingNo': '건물번호',
  'building.roomCount': '호실 {0}개',
  'building.unitCount': '{0}개 공간',
  'building.collapse': '접기',
  'building.showMore': '더보기',
  'building.floorMap': '건물 연결지도 보기',
  'building.floorMapDesc': '건물 간 연결통로와 층별 정보',

  // ── Day names ──
  'day.mon': '월',
  'day.tue': '화',
  'day.wed': '수',
  'day.thu': '목',
  'day.fri': '금',
  'day.sat': '토',
  'day.sun': '일',

  // ── Week labels ──
  'week.ordinal1': '첫째',
  'week.ordinal2': '둘째',
  'week.ordinal3': '셋째',
  'week.ordinal4': '넷째',
  'week.ordinal5': '다섯째',
  'week.weekLabel': '{0}월 {1} 주',

  // ── Filter ──
  'filter.campus': '캠퍼스',
  'filter.layer': '레이어',

  // ── ETA formatting ──
  'eta.imminent': '곧 출발',
  'eta.minutesLater': '{0}분 후',
  'eta.hoursLater': '{0}시간 후',
  'eta.hoursMinutesLater': '{0}시간 {1}분 후',
  'eta.minutes': '{0}분',
  'eta.hours': '{0}시간',
  'eta.hoursMinutes': '{0}시간 {1}분',

  // ── Schedule ──
  'schedule.footer': '시간표 · 총 {0}편',
  'schedule.busUnit': '{0}대',
  'schedule.suspended': '운행이 중단되었어요',
  'schedule.resumeDate': '{0}부터 다시 운행할 예정이에요',
  'schedule.noScheduleData': '시간표 정보가 없어요',
  'schedule.dataLoadFailed': '데이터를 불러올 수 없어요',

  // ── Realtime ──
  'realtime.infoBar': '{0} 기준 · {1}대 운행 중',

  // ── Force Update ──
  'update.required': '업데이트가 필요해요',
  'update.message': '최신 버전으로 업데이트해야\n앱을 사용할 수 있어요',
  'update.goToStore': '업데이트하기',

  // ── Error / Network ──
  'error.buildingLoad': '건물 정보를 불러오지 못했어요',
  'error.openLink': '링크를 열 수 없어요',
  'error.tryLater': '잠시 후 다시 시도해 주세요',
  'error.network': '네트워크에 문제가 생겼어요',
  'error.appStart': '앱을 시작할 수 없어요',
  'error.checkNetwork': '네트워크 연결을 확인하고 다시 시도해 주세요',
  'error.somethingWrong': '문제가 발생했어요',

  // ── Location ──
  'location.permissionNeeded': '위치 권한이 필요해요',
  'location.permissionMessage': '위치 정보를 사용하려면\n권한을 허용해 주세요',
  'location.goToSettings': '설정으로 이동',

  // ── Empty States ──
  'empty.noBuildings': '찾는 건물이 없어요',
  'empty.noPlaces': '찾는 장소가 없어요',
  'empty.noTimeInfo': '시간 정보가 없어요',
  'empty.noLocationInfo': '장소 정보가 없어요',
  'empty.noBusesRunning': '운행 중인 버스가 없어요',
  'empty.noBusInfo': '버스 정보가 없어요',

  // ── Lost & Found ──
  'lostAndFound.title': '분실물',
  'lostAndFound.board': '분실물 게시판',
  'lostAndFound.lookingForItem': '물건을 찾고 있어요',
  'lostAndFound.lookingForOwner': '주인을 찾고 있어요',
  'lostAndFound.supportTeam': '학생지원팀',
  'lostAndFound.copied': '복사했어요!',
  'lostAndFound.emailCopied': '이메일 주소를 복사했어요',
  'lostAndFound.emailLabel': '이메일: ',
  'lostAndFound.hsscSupportTeam': '인사캠 학생지원팀  ',
  'lostAndFound.nscSupportTeam': '자과캠 학생지원팀  ',
  'lostAndFound.howHandled': '유실물은 이렇게 처리돼요',
  'lostAndFound.handleProcess':
    '→  최초 발견자 습득 시, 1~2일 내 학생지원팀 이관\n→  학생지원팀: 유실물 게시판에 1개월 동안 공지\n→  1년 보관 후 폐기',
  'lostAndFound.supportTeamInfo':
    '인사캠: 600주년기념관 1층\n자과캠: 학생회관 종합행정실 1층\n운영시간: 평일 09:00~17:30',
} as const;

type TranslationKey = keyof typeof ko;
type TranslationMap = Record<TranslationKey, string>;

const en: TranslationMap = {
  // ── Campus ──
  'campus.hssc': 'HSSC',
  'campus.nsc': 'NSC',
  'campus.hsscMap': ' HSSC Map ',
  'campus.nscMap': 'NSC Map ',

  // ── Navigation ──
  'nav.home': 'Home',
  'nav.campus': 'Campus',
  'nav.info': 'Info',
  'nav.transit': 'Transit',

  // ── Common ──
  'common.ok': 'ok',
  'common.close': 'Close',
  'common.retry': 'Retry',
  'common.total': 'Total',

  // ── Transit ──
  'transit.schedule': 'schedule',
  'transit.busCount': 'Number of Buses',
  'transit.notes': 'Notes',
  'transit.nextShuttle': 'Next Shuttle',
  'transit.firstService': 'First Service',
  'transit.next': 'Next',
  'transit.noService': 'No service',
  'transit.serviceEnded': 'Service ended',
  'transit.departure': 'departure',
  'transit.later': 'later',
  'transit.route': 'Route',
  'transit.buses': 'Buses',
  'transit.totalLabel': 'Total',
  'transit.trips': 'trips',
  'transit.time': 'Time',
  'transit.timeUnit': 'h',
  'transit.minutes': 'm',
  'transit.based': 'based',
  'transit.busesInOperation': ' buses in operation',
  'transit.noNumber': 'No number',
  'transit.turn': 'Turn',

  // ── Search ──
  'search.title': 'Search',
  'search.placeholder': 'Search buildings, classrooms',
  'search.buildingCount': '{0} buildings, {1} spaces',
  'search.building': 'Building',
  'search.space': 'Space',
  'search.emptyPrompt': 'Which building or classroom are you looking for?',
  'search.noResult': "No results for '{0}'",
  'search.noResultHint': 'Try searching by building name or room number',

  // ── Building ──
  'building.building': 'Building',
  'building.space': 'Space',
  'building.counter': '',
  'building.searchPlaceholder': 'Search SKKU buildings/spaces',
  'building.elevator': 'Elevator',
  'building.accessibleRestroom': 'Accessible Restroom',
  'building.floorGuide': 'Floor Guide',
  'building.buildingInfo': 'Building Info',
  'building.connectedBuildings': 'Connected Buildings',
  'building.passageway': 'Passageway',
  'building.buildingNo': 'Building No.',
  'building.roomCount': '{0} rooms',
  'building.unitCount': '{0} spaces',
  'building.collapse': 'Collapse',
  'building.showMore': 'Show more',
  'building.floorMap': 'Floor Connection Map',
  'building.floorMapDesc': 'Passageways and floor info between buildings',

  // ── Day names ──
  'day.mon': 'Mon',
  'day.tue': 'Tue',
  'day.wed': 'Wed',
  'day.thu': 'Thu',
  'day.fri': 'Fri',
  'day.sat': 'Sat',
  'day.sun': 'Sun',

  // ── Week labels ──
  'week.ordinal1': '1st',
  'week.ordinal2': '2nd',
  'week.ordinal3': '3rd',
  'week.ordinal4': '4th',
  'week.ordinal5': '5th',
  'week.weekLabel': '{1} week of {0}',

  // ── Filter ──
  'filter.campus': 'Campus',
  'filter.layer': 'Layers',

  // ── ETA formatting ──
  'eta.imminent': 'Departing soon',
  'eta.minutesLater': '{0}m later',
  'eta.hoursLater': '{0}h later',
  'eta.hoursMinutesLater': '{0}h {1}m later',
  'eta.minutes': '{0}m',
  'eta.hours': '{0}h',
  'eta.hoursMinutes': '{0}h {1}m',

  // ── Schedule ──
  'schedule.footer': 'Schedule · {0} trips',
  'schedule.busUnit': '{0}',
  'schedule.suspended': 'Service is suspended',
  'schedule.resumeDate': 'Service will resume from {0}',
  'schedule.noScheduleData': 'No schedule data',
  'schedule.dataLoadFailed': 'Could not load data',

  // ── Realtime ──
  'realtime.infoBar': 'As of {0} · {1} buses running',

  // ── Force Update ──
  'update.required': 'Update Required',
  'update.message': 'Please update to the latest version\nto continue using the app',
  'update.goToStore': 'Update Now',

  // ── Error / Network ──
  'error.buildingLoad': 'Could not load building info',
  'error.openLink': 'Could not open link',
  'error.tryLater': 'Please try again later',
  'error.network': 'Network issue detected',
  'error.appStart': 'Could not start the app',
  'error.checkNetwork': 'Check your network and try again',
  'error.somethingWrong': 'Something went wrong',

  // ── Location ──
  'location.permissionNeeded': 'Location permission needed',
  'location.permissionMessage':
    'Allow location access\nto use this feature',
  'location.goToSettings': 'Go to Settings',

  // ── Empty States ──
  'empty.noBuildings': 'No buildings found',
  'empty.noPlaces': 'No places found nearby',
  'empty.noTimeInfo': 'No time info',
  'empty.noLocationInfo': 'No location info',
  'empty.noBusesRunning': 'No buses in service',
  'empty.noBusInfo': 'No bus info',

  // ── Lost & Found ──
  'lostAndFound.title': 'Lost & Found',
  'lostAndFound.board': 'Lost and found bulletin board',
  'lostAndFound.lookingForItem': 'Looking for an item',
  'lostAndFound.lookingForOwner': 'Looking for the owner',
  'lostAndFound.supportTeam': 'Student Support Team',
  'lostAndFound.copied': 'Copied!',
  'lostAndFound.emailCopied': 'Email address copied',
  'lostAndFound.emailLabel': 'Email: ',
  'lostAndFound.hsscSupportTeam': 'HSSC Student Support Team  ',
  'lostAndFound.nscSupportTeam': 'NSC Student Support Team  ',
  'lostAndFound.howHandled': 'How lost items are handled',
  'lostAndFound.handleProcess':
    '→ Upon first discovery, transfer to the Student Support Team within 1-2 days\n→ Student Support Team: Notice on the lost and found bulletin board for 1 month\n→ Stored for 1 year and then discarded',
  'lostAndFound.supportTeamInfo':
    'HSSC: 1F, 600th Anniversary Hall\nNSC: 1F, Student Center\nOperating hours: Weekdays 09:00~17:30',
};

const zh: TranslationMap = {
  // ── Campus ──
  'campus.hssc': '人文社会校区',
  'campus.nsc': '自然科学校区',
  'campus.hsscMap': '人文社会校区地图',
  'campus.nscMap': '自然科学校区地图',

  // ── Navigation ──
  'nav.home': '首页',
  'nav.campus': '校园',
  'nav.info': '信息',
  'nav.transit': '出行',

  // ── Common ──
  'common.ok': '查看',
  'common.close': '关闭',
  'common.retry': '重试',
  'common.total': '全部的',

  // ── Transit ──
  'transit.schedule': '时间表',
  'transit.busCount': '车辆数量',
  'transit.notes': '备注',
  'transit.nextShuttle': '下一班车',
  'transit.firstService': '首班车',
  'transit.next': '下一班',
  'transit.noService': '不运行',
  'transit.serviceEnded': '运行结束',
  'transit.departure': '出发',
  'transit.later': '后',
  'transit.route': '路线',
  'transit.buses': '车辆',
  'transit.totalLabel': '共',
  'transit.trips': '班',
  'transit.time': '时间',
  'transit.timeUnit': '小时',
  'transit.minutes': '分',
  'transit.based': '基准',
  'transit.busesInOperation': '台 运行中',
  'transit.noNumber': '无编号',
  'transit.turn': '回程',

  // ── Search ──
  'search.title': '搜索',
  'search.placeholder': '搜索建筑、教室',
  'search.buildingCount': '建筑 {0}栋, 空间 {1}个',
  'search.building': '建筑',
  'search.space': '空间',
  'search.emptyPrompt': '想找哪栋建筑或教室？',
  'search.noResult': "未找到'{0}'的结果",
  'search.noResultHint': '请尝试按建筑名称或房间号搜索',

  // ── Building ──
  'building.building': '建筑',
  'building.space': '空间',
  'building.counter': '',
  'building.searchPlaceholder': '搜索建筑/空间',
  'building.elevator': '电梯',
  'building.accessibleRestroom': '无障碍卫生间',
  'building.floorGuide': '楼层指南',
  'building.buildingInfo': '建筑信息',
  'building.connectedBuildings': '连接建筑',
  'building.passageway': '连接通道',
  'building.buildingNo': '建筑编号',
  'building.roomCount': '{0}间',
  'building.unitCount': '{0}个空间',
  'building.collapse': '收起',
  'building.showMore': '更多',
  'building.floorMap': '建筑连接地图',
  'building.floorMapDesc': '建筑之间的连接通道和楼层信息',

  // ── Day names ──
  'day.mon': '一',
  'day.tue': '二',
  'day.wed': '三',
  'day.thu': '四',
  'day.fri': '五',
  'day.sat': '六',
  'day.sun': '日',

  // ── Week labels ──
  'week.ordinal1': '第一',
  'week.ordinal2': '第二',
  'week.ordinal3': '第三',
  'week.ordinal4': '第四',
  'week.ordinal5': '第五',
  'week.weekLabel': '{0}月 {1}周',

  // ── Filter ──
  'filter.campus': '校区',
  'filter.layer': '图层',

  // ── ETA formatting ──
  'eta.imminent': '即将出发',
  'eta.minutesLater': '{0}分后',
  'eta.hoursLater': '{0}小时后',
  'eta.hoursMinutesLater': '{0}小时{1}分后',
  'eta.minutes': '{0}分',
  'eta.hours': '{0}小时',
  'eta.hoursMinutes': '{0}小时{1}分',

  // ── Schedule ──
  'schedule.footer': '时间表 · 共{0}班',
  'schedule.busUnit': '{0}台',
  'schedule.suspended': '已暂停运行',
  'schedule.resumeDate': '将从{0}起恢复运行',
  'schedule.noScheduleData': '暂无时间表信息',
  'schedule.dataLoadFailed': '无法加载数据',

  // ── Realtime ──
  'realtime.infoBar': '截至{0} · {1}台运行中',

  // ── Force Update ──
  'update.required': '需要更新',
  'update.message': '请更新至最新版本\n以继续使用',
  'update.goToStore': '立即更新',

  // ── Error / Network ──
  'error.buildingLoad': '无法加载建筑信息',
  'error.openLink': '无法打开链接',
  'error.tryLater': '请稍后重试',
  'error.network': '网络出现问题',
  'error.appStart': '无法启动应用',
  'error.checkNetwork': '请检查网络连接后重试',
  'error.somethingWrong': '出现问题',

  // ── Location ──
  'location.permissionNeeded': '需要位置权限',
  'location.permissionMessage': '要使用位置信息\n请允许权限',
  'location.goToSettings': '前往设置',

  // ── Empty States ──
  'empty.noBuildings': '找不到建筑',
  'empty.noPlaces': '未找到附近的地点',
  'empty.noTimeInfo': '暂无时间信息',
  'empty.noLocationInfo': '暂无地点信息',
  'empty.noBusesRunning': '没有运行中的车辆',
  'empty.noBusInfo': '暂无公交信息',

  // ── Lost & Found ──
  'lostAndFound.title': '失物招领',
  'lostAndFound.board': '失物招领公告牌',
  'lostAndFound.lookingForItem': '正在寻找物品',
  'lostAndFound.lookingForOwner': '寻找失主',
  'lostAndFound.supportTeam': '学生支持团队',
  'lostAndFound.copied': '已复制！',
  'lostAndFound.emailCopied': '已复制邮箱地址',
  'lostAndFound.emailLabel': '电子邮件: ',
  'lostAndFound.hsscSupportTeam': '人文社会校区学生支持团队  ',
  'lostAndFound.nscSupportTeam': '自然科学校区学生支持团队  ',
  'lostAndFound.howHandled': '失物处理流程',
  'lostAndFound.handleProcess':
    '→ 第一次发现后，在1-2天内转移到学生支持团队\n→ 学生支持团队：失物招领公告牌上的通知，为期1个月\n→ 保存1年，然后丢弃',
  'lostAndFound.supportTeamInfo':
    '人文社会校区: 一楼600周年纪念馆\n自然科学校区: 一楼学生中心\n开放时间：平日09:00~17:30',
};

export const translations: Record<AppLanguage, TranslationMap> = { ko, en, zh };
export type { TranslationKey };
