/**
 * Mapping from server building name (name.ko) to HSSC map buildingname.
 * Used to determine if a building exists on the HSSC floor map
 * and to navigate from BuildingDetailSheet → HSSC map.
 *
 * HSSC map names are now unified with server names.
 * Aliases handle variant spellings from different API responses.
 */

export const SERVER_TO_HSSC_NAME: Record<string, string> = {
  // Direct matches (server name = HSSC map name)
  법학관: '법학관',
  수선관: '수선관',
  '수선관(별관)': '수선관(별관)',
  '수선관별관': '수선관(별관)',
  호암관: '호암관',
  퇴계인문관: '퇴계인문관',
  다산경제관: '다산경제관',
  경영관: '경영관',
  경영대학: '경영관',
  교수회관: '교수회관',
  중앙학술정보관: '중앙학술정보관',
  중앙도서관: '중앙학술정보관',
  '600주년기념관': '600주년기념관',
  '600주년 기념관': '600주년기념관',
  국제관: '국제관',
  학생회관: '학생회관',
};

/** Check if a building (by server Korean name) exists on the HSSC floor map. */
export function getHsscBuildingName(serverNameKo: string): string | null {
  return SERVER_TO_HSSC_NAME[serverNameKo] ?? null;
}
