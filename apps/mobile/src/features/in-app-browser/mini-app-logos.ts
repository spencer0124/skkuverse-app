/**
 * serviceName → 로컬 이미지 소스 매핑.
 * in-app-browser 하단 pill + HomeScreen 타일 양쪽에서 참조.
 * 이미지가 없는 서비스는 파비콘(faviconUrl)으로 자동 폴백.
 */
export const MINI_APP_LOGOS: Record<string, number> = {
  '인사캠 총학생회': require('../../../assets/mini-app-logos/speak.webp'),
  '자과캠 총학생회': require('../../../assets/mini-app-logos/speak.webp'),
  '성균웹진': require('../../../assets/mini-app-logos/scaa.jpg'),
  '성대신문': require('../../../assets/mini-app-logos/sungdaenews.png'),
  'SPEAK': require('../../../assets/mini-app-logos/speak.webp'),
};
