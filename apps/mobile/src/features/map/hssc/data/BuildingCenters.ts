/**
 * Representative center coordinates for each building in SVG space.
 * Used for "건물 연결지도 보기" navigation — centers the map on this point.
 * Manually selected from mid-floor element positions.
 */

export const BUILDING_CENTERS: Record<string, { cx: number; cy: number }> = {
  법학관: { cx: 664.5, cy: 1663 },       // place1_4F (middle floor)
  수선관: { cx: 1060, cy: 1510 },         // place2_6F
  '수선관(별관)': { cx: 1210, cy: 1511 },  // place3_6F
  호암관: { cx: 1842, cy: 1402 },         // place4_6F
  퇴계인문관: { cx: 2173, cy: 790 },      // place5_7F
  다산경제관: { cx: 2213, cy: 1388 },     // connect7 (퇴계4F-다산4F midpoint)
  경영관: { cx: 2461, cy: 2371 },         // place7_1F (central among B4~5F)
  교수회관: { cx: 3082, cy: 1536 },       // place8_3F
  중앙학술정보관: { cx: 3250, cy: 1854 },  // place9_3F
  '600주년기념관': { cx: 3735, cy: 2678 }, // place10_2F
  국제관: { cx: 3960, cy: 2948 },         // place11_2F
  학생회관: { cx: 2261, cy: 3520 },       // place12_3F
};
