/** Interactive element coordinates extracted from SVG _clickarea data. */

export interface ElementCoord {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  type: 'ellipse' | 'rect';
}

// 83 interactive elements
export const ELEMENT_COORDS: Record<string, ElementCoord> = {
  // ── 법학관 (place1) ──
  place1_6F: { cx: 377.5, cy: 1391, rx: 89.5, ry: 86, type: 'ellipse' },
  place1_5F: { cx: 506.5, cy: 1513, rx: 89.5, ry: 86, type: 'ellipse' },
  place1_4F: { cx: 664.5, cy: 1663, rx: 89.5, ry: 86, type: 'ellipse' },
  place1_3F: { cx: 817.5, cy: 1829, rx: 89.5, ry: 86, type: 'ellipse' },
  place1_1F: { cx: 872.5, cy: 2126, rx: 81.5, ry: 86, type: 'ellipse' },
  place1_B1F: { cx: 728.5, cy: 2291, rx: 89.5, ry: 86, type: 'ellipse' },
  place1_B2F: { cx: 568.5, cy: 2458, rx: 89.5, ry: 86, type: 'ellipse' },

  // ── 수선관 (place2) ──
  place2_2F: { cx: 1060, cy: 2137, rx: 71, ry: 68, type: 'ellipse' },
  place2_4F: { cx: 1060, cy: 1829, rx: 71, ry: 68, type: 'ellipse' },
  place2_6F: { cx: 1060, cy: 1510, rx: 71, ry: 68, type: 'ellipse' },
  place2_7F: { cx: 1060, cy: 1352, rx: 71, ry: 68, type: 'ellipse' },
  place2_9F: { cx: 1060, cy: 1044, rx: 71, ry: 68, type: 'ellipse' },

  // ── 수선관(별관) (place3) ──
  place3_2F: { cx: 1210, cy: 2134, rx: 71, ry: 68, type: 'ellipse' },
  place3_3F: { cx: 1210, cy: 1986, rx: 71, ry: 68, type: 'ellipse' },
  place3_4F: { cx: 1210, cy: 1831, rx: 71, ry: 68, type: 'ellipse' },
  place3_6F: { cx: 1210, cy: 1511, rx: 71, ry: 68, type: 'ellipse' },
  place3_7F: { cx: 1210, cy: 1351, rx: 71, ry: 68, type: 'ellipse' },
  place3_9F: { cx: 1210, cy: 1040, rx: 71, ry: 68, type: 'ellipse' },
  place3_10F: { cx: 1182, cy: 908, rx: 71, ry: 68, type: 'ellipse' },

  // ── 호암관 (place4) ──
  place4_1F_1: { cx: 2091, cy: 2492, rx: 71, ry: 68, type: 'ellipse' },
  place4_1F_2: { cx: 2091, cy: 2252, rx: 71, ry: 68, type: 'ellipse' },
  place4_2F: { cx: 1842, cy: 2182, rx: 71, ry: 68, type: 'ellipse' },
  place4_3F: { cx: 1842, cy: 1982, rx: 71, ry: 68, type: 'ellipse' },
  place4_4F: { cx: 1842, cy: 1792, rx: 71, ry: 68, type: 'ellipse' },
  place4_5F: { cx: 1842, cy: 1592, rx: 71, ry: 68, type: 'ellipse' },
  place4_6F: { cx: 1842, cy: 1402, rx: 71, ry: 68, type: 'ellipse' },
  place4_7F: { cx: 1842, cy: 1202, rx: 71, ry: 68, type: 'ellipse' },
  place4_8F: { cx: 1842, cy: 1009, rx: 71, ry: 68, type: 'ellipse' },
  place4_9F: { cx: 1842, cy: 810, rx: 71, ry: 68, type: 'ellipse' },
  place4_10F: { cx: 1842, cy: 610, rx: 71, ry: 68, type: 'ellipse' },
  place4_11F: { cx: 1842, cy: 420, rx: 71, ry: 68, type: 'ellipse' },
  place4_12F: { cx: 1842, cy: 230, rx: 71, ry: 68, type: 'ellipse' },

  // ── 퇴계인문관 (place5) ──
  place5_6F: { cx: 2163, cy: 990, rx: 71, ry: 68, type: 'ellipse' },
  place5_7F: { cx: 2173, cy: 790, rx: 71, ry: 68, type: 'ellipse' },
  place5_8F: { cx: 2173, cy: 603, rx: 71, ry: 68, type: 'ellipse' },

  // ── 경영관 (place7) ──
  place7_B4F: { cx: 2461, cy: 3164, rx: 71, ry: 68, type: 'ellipse' },
  place7_B3F: { cx: 2461, cy: 2964, rx: 71, ry: 68, type: 'ellipse' },
  place7_B2F: { cx: 2461, cy: 2764, rx: 71, ry: 68, type: 'ellipse' },
  place7_B1F: { cx: 2461, cy: 2569, rx: 71, ry: 68, type: 'ellipse' },
  place7_1F: { cx: 2461, cy: 2371, rx: 71, ry: 68, type: 'ellipse' },
  place7_2F: { cx: 2461, cy: 2171, rx: 71, ry: 68, type: 'ellipse' },
  place7_5F: { cx: 2461, cy: 1601, rx: 71, ry: 68, type: 'ellipse' },

  // ── 교수회관 (place8) ──
  place8_1F: { cx: 3082, cy: 1850, rx: 71, ry: 68, type: 'ellipse' },
  place8_2F: { cx: 3082, cy: 1690, rx: 71, ry: 68, type: 'ellipse' },
  place8_3F: { cx: 3082, cy: 1536, rx: 71, ry: 68, type: 'ellipse' },
  place8_4F: { cx: 3082, cy: 1380, rx: 71, ry: 68, type: 'ellipse' },
  place8_5F: { cx: 3082, cy: 1238, rx: 71, ry: 68, type: 'ellipse' },

  // ── 중앙학술정보관 (place9) ──
  place9_1F: { cx: 3250, cy: 2168, rx: 71, ry: 68, type: 'ellipse' },
  place9_2F: { cx: 3250, cy: 2008, rx: 71, ry: 68, type: 'ellipse' },
  place9_3F: { cx: 3250, cy: 1854, rx: 71, ry: 68, type: 'ellipse' },
  place9_4F: { cx: 3250, cy: 1698, rx: 71, ry: 68, type: 'ellipse' },
  place9_5F: { cx: 3250, cy: 1534, rx: 71, ry: 68, type: 'ellipse' },

  // ── 600주년기념관 (place10) ──
  place10_B4F: { cx: 3735, cy: 3363, rx: 71, ry: 68, type: 'ellipse' },
  place10_B3F: { cx: 3735, cy: 3222, rx: 71, ry: 68, type: 'ellipse' },
  place10_B1F: { cx: 3735, cy: 2948, rx: 71, ry: 68, type: 'ellipse' },
  place10_1F: { cx: 3734, cy: 2809, rx: 69, ry: 66, type: 'ellipse' },
  place10_2F: { cx: 3733, cy: 2678, rx: 69, ry: 61, type: 'ellipse' },
  place10_3F: { cx: 3731, cy: 2544, rx: 69, ry: 62, type: 'ellipse' },
  place10_4F: { cx: 3735, cy: 2412.5, rx: 69, ry: 58.5, type: 'ellipse' },
  place10_5F: { cx: 3735, cy: 2283.5, rx: 69, ry: 58.5, type: 'ellipse' },
  place10_6F: { cx: 3735, cy: 2143.5, rx: 69, ry: 58.5, type: 'ellipse' },

  // ── 국제관 (place11) ──
  place11_B3F: { cx: 3960, cy: 3493, rx: 71, ry: 60, type: 'ellipse' },
  place11_B2F: { cx: 3960, cy: 3353, rx: 71, ry: 60, type: 'ellipse' },
  place11_B1F: { cx: 3960, cy: 3218, rx: 71, ry: 60, type: 'ellipse' },
  place11_2F: { cx: 3960, cy: 2948, rx: 71, ry: 60, type: 'ellipse' },
  place11_3F: { cx: 3960, cy: 2798, rx: 71, ry: 60, type: 'ellipse' },
  place11_4F: { cx: 3960, cy: 2674, rx: 71, ry: 60, type: 'ellipse' },
  place11_5F: { cx: 3960, cy: 2551, rx: 71, ry: 60, type: 'ellipse' },

  // ── 학생회관 (place12) ──
  place12_1F: { cx: 1868, cy: 3520, rx: 58, ry: 60, type: 'ellipse' },
  place12_2F: { cx: 2057, cy: 3520, rx: 58, ry: 60, type: 'ellipse' },
  place12_3F: { cx: 2261, cy: 3520, rx: 58, ry: 60, type: 'ellipse' },
  place12_4F: { cx: 2459, cy: 3520, rx: 58, ry: 60, type: 'ellipse' },
  place12_5F: { cx: 2643, cy: 3520, rx: 58, ry: 60, type: 'ellipse' },

  // ── 연결통로 (connect) ──
  connect1: { cx: 1034, cy: 1983, rx: 102, ry: 72, type: 'rect' },
  connect2: { cx: 1129.5, cy: 2295, rx: 140.5, ry: 72, type: 'rect' },
  connect3: { cx: 1129.5, cy: 1191, rx: 140.5, ry: 72, type: 'rect' },
  connect4: { cx: 1129.5, cy: 1671, rx: 140.5, ry: 72, type: 'rect' },
  connect5: { cx: 2321.5, cy: 1779, rx: 208.5, ry: 72, type: 'rect' },
  connect6: { cx: 2213.5, cy: 1573, rx: 115.5, ry: 72, type: 'rect' },
  connect7: { cx: 2213.5, cy: 1388, rx: 115.5, ry: 72, type: 'rect' },
  connect8: { cx: 2213.5, cy: 1188, rx: 115.5, ry: 72, type: 'rect' },
  connect9: { cx: 2359, cy: 1980, rx: 186, ry: 60, type: 'rect' },
  connect10: { cx: 3858, cy: 3087, rx: 186, ry: 60, type: 'rect' },
};
