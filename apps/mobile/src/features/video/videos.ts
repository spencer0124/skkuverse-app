export interface VideoItem {
  id: string;
  label: string;
  thumbnailUrl: string;
}

const thumb = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
const item = (id: string, label: string): VideoItem => ({ id, label, thumbnailUrl: thumb(id) });

export const EPISODES: VideoItem[] = [
  item('evuyl2zTB6Y', '1화'),
  item('Rd6ButlXuVI', '2화'),
  item('ImPPNPduk28', '3화'),
];

export const TRAILERS: VideoItem[] = [
  item('3UjqUD3YRpk', '메인 예고편'),
  item('rvM5N0PARGE', '1회차 예고편'),
  item('ZUY3RPdDoU8', '2회차 예고편'),
  item('0i1k34zT-5c', '3회차 예고편'),
];

export interface StaffCredit {
  role: string;
  names: string;
}

export const SHOW = {
  title: '성균관대 스캔들',
  subtitle: 'TV 프로그램 · 연애 리얼리티',
  description: `성균관대에서 시작된
설레는 첫 만남의 순간✨

"첫눈에 반하는 것 같아요."
"사랑하게 되는 발판이 되지 않을까?"
"저 분이었으면 했어요."

서로의 이상형으로 만나,
조금씩 가까워지는 청춘들💚

캠퍼스 곳곳,
그리고 성대 앞 익숙한 거리에서
이어지는 설렘과 미묘한 감정들.

당신의 캠퍼스 로망이 현실이 되는 순간,
지금 공개됩니다.

성대생 연애 리얼리티 프로그램,
[성균관대 스캔들]`,
  channelName: 'SUBS 성대방송국',
  channelUrl: 'https://youtube.com/channel/UCCwTQy5erJK34z9-VW1aMtQ',
  // .jpg, not .png: the file has always been JPEG data. Android's AAPT trusts
  // the extension and fails `mergeReleaseResources` outright on the mismatch
  // ("file failed to compile"), which broke every Android RELEASE build. Debug
  // builds were unaffected because Metro serves the asset instead of routing it
  // through AAPT, and iOS sniffs content rather than the extension — so the
  // defect only ever surfaced on an Android store build.
  hero: require('../../../assets/video/subs-poster.jpg'),
  staff: [
    { role: '기획', names: '김신비 이시원 조서희' },
    { role: '제작', names: '설연희 윤서현 이성민' },
    { role: '미술', names: '김지영 이채윤' },
    { role: '촬영', names: '김신비 김지영 설연희 윤서현 이성민 이시원 이채윤 조서희' },
    { role: '편집', names: '김신비 이시원 이채윤 조서희' },
    { role: '자막', names: '김지영 설연희 윤서현 이성민' },
    { role: '출연', names: '박지완 오현아' },
  ] as StaffCredit[],
};
