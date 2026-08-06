import { create } from 'zustand';

/**
 * 상세 화면의 "이전 공지 / 다음 공지"를 위한 목록 컨텍스트.
 *
 * **왜 React Query 캐시를 직접 읽지 않는가.** 목록은 `useNoticeList` /
 * `useMultiSourceNoticeList`의 무한스크롤 캐시에 있지만, 상세 화면이 그걸
 * 꺼내려면 queryKey(`sourceId` + `{type, q}`)를 정확히 재현해야 한다. 그 키는
 * 활성 탭·검색어·단일/다중 소스 모드에 따라 달라져서, 상세 화면이 알 수 없는
 * 상태에 의존하게 된다. 대신 목록 → 상세로 넘어가는 **단일 지점**(
 * `NoticeListPanel.handleSelect`)에서 그 순간 화면에 있던 배열을 그대로
 * 넘겨받는다.
 *
 * **인덱스를 저장하지 않는 이유.** 다음 공지로 연속 이동하면 저장해 둔
 * 인덱스는 곧 어긋난다. 상세 화면이 매번 `(sourceId, articleNo)`로 자기
 * 위치를 다시 찾는 무상태 방식이라야 몇 번을 넘겨도 견딘다.
 *
 * 목록을 거치지 않은 진입(딥링크·북마크·홈 미리보기·검색)에서는 컨텍스트가
 * 없으므로 `items`가 비고, 상세 화면은 이전/다음 버튼을 감춘다.
 */
export interface NoticeSibling {
  /** 라우트에 쓸 sourceId. 다중 소스 탭에서는 item의 sourceId와 다를 수 있다. */
  sourceId: string;
  articleNo: number;
  title: string;
}

interface NoticeSiblingsState {
  items: NoticeSibling[];
  setItems: (items: NoticeSibling[]) => void;
  clear: () => void;
}

export const useNoticeSiblingsStore = create<NoticeSiblingsState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  clear: () => set({ items: [] }),
}));

export interface NoticeSiblingsResult {
  prev: NoticeSibling | null;
  next: NoticeSibling | null;
}

/**
 * 현재 공지의 앞뒤 항목. 목록에 없으면(다른 경로로 진입) 둘 다 null.
 *
 * **게시판 관례를 따른다** — "이전글"은 화면상 위/아래가 아니라 **작성 순서**
 * 기준이다:
 *
 *   이전글 = 이 글보다 **먼저** 올라온 글 = 더 오래된 것 = 목록에서 **아래쪽** (i+1)
 *   다음글 = 이 글보다 **나중에** 올라온 글 = 더 최신 = 목록에서 **위쪽**   (i-1)
 *
 * 공지 목록은 최신순 정렬이라 목록 위치와 시간 순서가 뒤집혀 있다. 그래서
 * 한때 i-1을 '이전글'로 매핑했는데, 그러면 **가장 최근 글에서 '다음글'이
 * 생기고 '이전글'이 없어지는** 정반대 결과가 나온다.
 */
export function findSiblings(
  items: NoticeSibling[],
  sourceId: string,
  articleNo: number,
): NoticeSiblingsResult {
  const i = items.findIndex(
    (it) => it.articleNo === articleNo && it.sourceId === sourceId,
  );
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i < items.length - 1 ? items[i + 1] : null,
    next: i > 0 ? items[i - 1] : null,
  };
}
