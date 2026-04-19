import type { Department } from '../types';

/**
 * Hardcoded department list for onboarding UI development.
 * Will be replaced with API data later.
 * Sorted alphabetically (가나다순).
 */
const departments: Department[] = [
  // ── HSSC (인문사회과학캠퍼스) ──
  { id: 'economics', name: '경제학과', campus: 'hssc' },
  { id: 'public-admin', name: '행정학과', campus: 'hssc' },
  { id: 'korean-lang', name: '국어국문학과', campus: 'hssc' },
  { id: 'english-lang', name: '영어영문학과', campus: 'hssc' },
  { id: 'history', name: '사학과', campus: 'hssc' },
  { id: 'philosophy', name: '철학과', campus: 'hssc' },
  { id: 'sociology', name: '사회학과', campus: 'hssc' },
  { id: 'psychology', name: '심리학과', campus: 'hssc' },
  { id: 'journalism', name: '미디어커뮤니케이션학과', campus: 'hssc' },
  { id: 'political-science', name: '정치외교학과', campus: 'hssc' },
  { id: 'child-youth', name: '아동청소년학과', campus: 'hssc' },
  { id: 'education', name: '교육학과', campus: 'hssc' },
  { id: 'chinese-lang', name: '중어중문학과', campus: 'hssc' },
  { id: 'french-lang', name: '프랑스어문학과', campus: 'hssc' },
  { id: 'german-lang', name: '독어독문학과', campus: 'hssc' },
  { id: 'russian-lang', name: '러시아어문학과', campus: 'hssc' },
  { id: 'art', name: '미술학과', campus: 'hssc' },
  { id: 'design', name: '디자인학과', campus: 'hssc' },
  { id: 'acting', name: '연기예술학과', campus: 'hssc' },
  { id: 'film', name: '영상학과', campus: 'hssc' },
  { id: 'dance', name: '무용학과', campus: 'hssc' },
  { id: 'law', name: '법학과', campus: 'hssc' },
  { id: 'business', name: '경영학과', campus: 'hssc' },

  // ── NSC (자연과학캠퍼스) ──
  { id: 'software', name: '소프트웨어학과', campus: 'nsc' },
  { id: 'computer-science', name: '컴퓨터공학과', campus: 'nsc' },
  { id: 'ai', name: '인공지능학과', campus: 'nsc' },
  { id: 'electronic-eng', name: '전자전기공학부', campus: 'nsc' },
  { id: 'mechanical-eng', name: '기계공학부', campus: 'nsc' },
  { id: 'civil-eng', name: '건설환경공학부', campus: 'nsc' },
  { id: 'chem-eng', name: '화학공학/고분자공학부', campus: 'nsc' },
  { id: 'materials-eng', name: '신소재공학부', campus: 'nsc' },
  { id: 'semiconductor', name: '반도체시스템공학과', campus: 'nsc' },
  { id: 'systems-mgmt', name: '시스템경영공학과', campus: 'nsc' },
  { id: 'architecture', name: '건축학과', campus: 'nsc' },
  { id: 'landscape', name: '조경학과', campus: 'nsc' },
  { id: 'math', name: '수학과', campus: 'nsc' },
  { id: 'physics', name: '물리학과', campus: 'nsc' },
  { id: 'chemistry', name: '화학과', campus: 'nsc' },
  { id: 'biology', name: '생명과학과', campus: 'nsc' },
  { id: 'food-biotech', name: '식품생명공학과', campus: 'nsc' },
  { id: 'biomedical-eng', name: '바이오메카트로닉스학과', campus: 'nsc' },
  { id: 'pharmacy', name: '약학과', campus: 'nsc' },
  { id: 'sport-science', name: '스포츠과학과', campus: 'nsc' },

  // ── Both campuses ──
  { id: 'global-convergence', name: '글로벌융합학부', campus: 'both' },
  { id: 'data-science', name: '데이터사이언스융합전공', campus: 'both' },
];

departments.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

export const MOCK_DEPARTMENTS = departments;
