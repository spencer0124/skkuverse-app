import availableLines from './data/AvailableLines';

/*
건물끼리 연결하는 연결통로(connect)는 그룹으로 이루어져 있음 -> groupId로 구분
건물 내부의 층들은 각각 원으로 이루어져 있음 -> id로 구분

터치를 쉽게 하기 위해 각각의 도형 위에는
크기가 더 큰 투명도 1% 도형을 그려놓음
따라서 실제로 정보를 가져오기 위해는 이름에서 "_clickarea"를 제거해야 함
*/

export interface OverlayInfo {
  itemtype: string;
  placename: string;
  buildingname: string;
  previousplace: string | null;
  afterplace: string | null;
  placeinfo: string | null;
  time: string | null;
  leftColor: string;
  rightColor: string;
  x: number;
  y: number;
}

export const handleSVGClick = (event: MouseEvent): OverlayInfo | null => {
  const target = event.target as SVGElement;
  let { id: clickedId, groupId } = extractIds(target);

  clickedId = processClickArea(clickedId);
  groupId = groupId ? processClickArea(groupId) : groupId;

  const actualId = groupId || clickedId;
  if (isAvailableLine(actualId)) {
    return createOverlayInfo(actualId);
  }

  return null;
};

const extractIds = (element: SVGElement): { id: string; groupId: string | null } => {
  return {
    id: element.id,
    groupId: element.getAttribute('data-group'),
  };
};

const processClickArea = (id: string): string => {
  return id && id.endsWith('_clickarea') ? id.replace('_clickarea', '') : id;
};

const isAvailableLine = (id: string): boolean => {
  return Object.prototype.hasOwnProperty.call(availableLines, id);
};

const createOverlayInfo = (id: string): OverlayInfo => {
  const element = document.getElementById(id)!;
  const rect = element.getBoundingClientRect();

  return {
    ...availableLines[id as keyof typeof availableLines],
    x: rect.left + window.scrollX - 9,
    y: rect.top + window.scrollY - 25,
  };
};
