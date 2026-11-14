/**
 * What the notice schemas make of the server's production fixtures. Recorded
 * from the hand parsers before the zod port, which reproduces them unchanged.
 */
import { describe, expect, it } from 'vitest';
import { parseOrThrow } from '@skkuverse/shared';
import detail from './__fixtures__/notice-detail.json';
import list from './__fixtures__/notice-list.json';
import tabs from './__fixtures__/notice-tabs.json';
import { noticeDetailSchema, noticePageSchema, noticeTabsSchema } from './notices.schema';

const envelope = (data: unknown) => ({ meta: { code: 200 }, data });

describe('the notice schemas over the server fixtures', () => {
  it('reads a notice page', () => {
    // Act
    const page = parseOrThrow(noticePageSchema, envelope(list.data).data, 'notices.page');

    // Assert
    expect(page).toMatchInlineSnapshot(`
      {
        "hasMore": true,
        "nextCursor": "eyJkIjoiMjAyNi0wOS0zMCIsImMiOiIyMDI2LTEwLTEyVDA1OjEwOjE2LjIwOFoiLCJpIjoiNmFiY2MxOGFiMGMyN2QzOTkwYmI4M2NiIn0",
        "notices": [
          {
            "articleNo": 140562,
            "author": "���հ����б� ���д��",
            "category": null,
            "date": "2026-10-14",
            "department": "성균관대_통합(장학)",
            "hasAttachments": true,
            "hasContent": false,
            "id": "6acee22b9cb01d9a98e90cc0",
            "isEdited": false,
            "row": null,
            "sourceId": "skku-notice06",
            "sourceUrl": "https://www.skku.edu/skku/campus/skk_comm/notice06.do?mode=view&articleNo=140562&article.offset=0&articleLimit=10",
            "summary": {
              "endAt": {
                "date": "2026-11-13",
                "label": "공고 및 서류 접수",
                "time": "18:00",
              },
              "oneLiner": "국내 4년제 학부생 대상, 홈페이지에서 신청서·서류 업로드",
              "startAt": {
                "date": "2026-10-14",
                "time": null,
              },
              "type": "action_required",
            },
            "title": "2027년도 두산연강재단 장학생 선발 안내",
            "views": 2723,
          },
          {
            "articleNo": 140575,
            "author": "성균관대학교 장학담당",
            "category": null,
            "date": "2026-10-14",
            "department": "성균관대_통합(장학)",
            "hasAttachments": true,
            "hasContent": false,
            "id": "6acf2f809cb01d9a98eb3c7b",
            "isEdited": false,
            "row": null,
            "sourceId": "skku-notice06",
            "sourceUrl": "https://www.skku.edu/skku/campus/skk_comm/notice06.do?mode=view&articleNo=140575&article.offset=0&articleLimit=10",
            "summary": {
              "endAt": {
                "date": "2026-10-30",
                "label": "신청기간",
                "time": null,
              },
              "oneLiner": "화학 계열 대학원생 대상, 이메일로 지원서 접수",
              "startAt": {
                "date": "2026-10-15",
                "time": null,
              },
              "type": "informational",
            },
            "title": "(대학원)2026년도 동진장학연구재단 동진장학금 선발 안내",
            "views": 1630,
          },
        ],
      }
    `);
  });

  it('reads the tab configuration', () => {
    // Act
    const config = parseOrThrow(noticeTabsSchema, envelope(tabs.data).data, 'notices.tabs');

    // Assert
    expect(config).toMatchInlineSnapshot(`
      {
        "schemaVersion": 1,
        "tabs": [
          {
            "key": "dept",
            "label": "학과",
            "picker": {
              "campusDefaultIds": {
                "hssc": [],
                "nsc": [],
              },
              "defaultIds": [],
              "maxSelection": 5,
              "sources": [
                {
                  "campus": "nsc",
                  "college": "공과대학",
                  "excludeReason": null,
                  "excludeReasonText": null,
                  "id": "arch",
                  "name": "건축학과",
                  "noticeAvailable": true,
                },
                {
                  "campus": "nsc",
                  "college": "공과대학",
                  "excludeReason": "siteUnreachable",
                  "excludeReasonText": "학과 홈페이지에 연결이 되지 않아 공지를 가져올 수 없어요",
                  "id": "cheme",
                  "name": "화학공학과",
                  "noticeAvailable": false,
                },
              ],
            },
            "tabMode": "picker",
          },
          {
            "fixed": {
              "campus": "both",
              "name": "성균관대_통합(학사)",
              "sourceId": "skku-notice02",
            },
            "key": "academic",
            "label": "학사",
            "tabMode": "fixed",
          },
          {
            "key": "library",
            "label": "도서관",
            "picker": {
              "campusDefaultIds": {
                "hssc": [
                  "lib-hssc",
                ],
                "nsc": [
                  "lib-nsc",
                ],
              },
              "defaultIds": [],
              "maxSelection": 3,
              "sources": [
                {
                  "campus": "hssc",
                  "college": null,
                  "excludeReason": null,
                  "excludeReasonText": null,
                  "id": "lib-hssc",
                  "name": "중앙학술정보관",
                  "noticeAvailable": true,
                },
                {
                  "campus": "nsc",
                  "college": null,
                  "excludeReason": null,
                  "excludeReasonText": null,
                  "id": "lib-nsc",
                  "name": "삼성학술정보관",
                  "noticeAvailable": true,
                },
              ],
            },
            "tabMode": "picker",
          },
        ],
      }
    `);
  });

  it('reads a notice detail', () => {
    // Act
    const notice = parseOrThrow(noticeDetailSchema, envelope(detail.data).data, 'notices.detail');

    // Assert
    expect(notice).toMatchInlineSnapshot(`
      {
        "articleNo": 140482,
        "attachments": [
          {
            "name": "전남대학교 인공지능혁신융합대학사업단 2026학년도 동계 계절학기 학점교류 신청 안내.Zip",
            "url": "https://www.skku.edu/skku/campus/skk_comm/notice02.do?mode=download&articleNo=140482&attachNo=118217",
          },
        ],
        "author": "인공지능혁신공유대학사업단",
        "category": null,
        "contentMarkdown": "인공지능혁신융합대학사업의 협력교와 학점교류를 희망하는 학생은 아래 안내에 따라 신청하시기 바랍니다.

      ※ 학점교류 교과목의 학점 및 ‘전공’학점 인정여부는 소속학과에서 결정하는 사안입니다.  
      ※ 학점교류 희망 학생",
        "crawledAt": "2026-10-14T08:30:08.216Z",
        "date": "2026-10-14",
        "department": "성균관대_통합(학사)",
        "editInfo": {
          "count": 2,
          "history": [
            {
              "contentChanged": false,
              "detectedAt": "2026-10-13T02:00:08.400Z",
              "newHash": "c1cc5a6bd667511e0962c58666a210c7c5eb20ee0ff1a2b0a42d2365217c4f47",
              "newTitle": "[인공지능혁신융합대학사업] 2026학년도 인공지능혁신융합대학사업 겨울 계절학기 학점교류 수강 안내 (상시 업데이트)",
              "oldHash": "c1cc5a6bd667511e0962c58666a210c7c5eb20ee0ff1a2b0a42d2365217c4f47",
              "oldTitle": "[인공지능혁신융합대학사업] 2026학년도 인공지능혁신융합대학사업 겨울 계절학기 학점교류 수강 안내 (상시 업데이트)",
              "source": "tier1",
              "titleChanged": false,
            },
          ],
        },
        "id": "6acc38239cb01d9a98e2a2b9",
        "lastModified": null,
        "screen": null,
        "sourceId": "skku-notice02",
        "sourceUrl": "https://www.skku.edu/skku/campus/skk_comm/notice02.do?mode=view&articleNo=140482&article.offset=0&articleLimit=10",
        "summary": {
          "details": {
            "action": "첨부 서류와 함께 office@example.com로 이메일 신청",
            "host": "인공지능혁신융합대학사업단",
            "impact": "타 대학 과목은 전공 또는 일반선택으로만 인정되며, 승인 후 포기 시 F학점이 부과될 수 있음",
            "target": "학사과정 2개 학기 이상 이수 학생 (2027년 2월 졸업예정자 제외)",
          },
          "generatedAt": "2026-10-12T02:20:15.269Z",
          "locations": [],
          "model": "claude-haiku-5-5",
          "oneLiner": "전남대 4개 과목 교류, 이메일 office@example.com로 신청, 본교 계절수업과 합산 6학점 이내",
          "periods": [
            {
              "endDate": "2026-10-25",
              "endTime": null,
              "label": "추천 마감일",
              "startDate": null,
              "startTime": null,
            },
          ],
          "text": "인공지능혁신융합대학사업 협력교와의 2026학년도 겨울 계절수업 학점교류를 신청할 수 있어요. 전남대의 인공지능기초(3학점) 등 4개 과목이 대상이며, 추천 마감은 2026년 10월 25일(일)까지예요. 첨부된 대학별",
          "type": "action_required",
        },
        "title": "[인공지능혁신융합대학사업] 2026학년도 인공지능혁신융합대학사업 겨울 계절학기 학점교류 수강 안내 (상시 업데이트)",
        "views": 4685,
      }
    `);
  });
});
