---
title: UX Writing Guide
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-10
audience: public
---

# UX Writing Guide

> The writing rules for every string a user sees: six required rules and eight principles. Everyone who writes or edits user-facing copy reads this.

## Summary

Based on the official TDS UX writing guide and Toss's eight writing principles. Apply it to
every string the app shows a user.

The rules are in English because they are documentation. The examples stay in Korean
because they are the product: each one is a string the app either does or does not show.
Every Korean line carries a `conventions:allow-korean` marker, which is the line-level
exception the shared conventions prefer over exempting a whole file.

## Core values (voice)

| Value | Meaning |
| --- | --- |
| **Clear** | Plain words, and a sentence understood on the first read |
| **Concise** | Only what is needed, laid out to be scanned |
| **Casual** | Everyday language instead of jargon or a stiff register |
| **Respect** | Trust before conversion, and communication that means it |
| **Emotional** | State the fact, and acknowledge how it feels |

## Required rules

### 1. Use 해요체 throughout <!-- conventions:allow-korean: the register being specified -->

Every string uses 해요체, whatever the context. <!-- conventions:allow-korean: the register being specified -->

| ❌ | ✅ |
| --- | --- |
| 운행 안함 | 운행하지 않아요 <!-- conventions:allow-korean: UX copy example --> |
| 운행하지 않습니다 | 운행하지 않아요 <!-- conventions:allow-korean: UX copy example --> |

### 2. Prefer the active voice

Write "~했어요" rather than "~됐어요". Drop the "~었". Change the verb if you have to. <!-- conventions:allow-korean: the forms are the rule -->

| ❌ | ✅ |
| --- | --- |
| 업데이트가 완료됐어요 | 시간표를 업데이트했어요 <!-- conventions:allow-korean: UX copy example --> |
| 저장되었어요 | 저장했어요 <!-- conventions:allow-korean: UX copy example --> |
| 발송됐어요 | 보냈어요 <!-- conventions:allow-korean: UX copy example --> |

### 3. Say what is possible, not what is not

Replace "안 돼요" with "~하면 할 수 있어요". <!-- conventions:allow-korean: the forms are the rule -->

| ❌ | ✅ |
| --- | --- |
| 현금 결제 불가 | 카드나 T머니로 결제할 수 있어요 <!-- conventions:allow-korean: UX copy example --> |
| 운행중인 버스 없음 | 오늘 운행이 끝났어요, plus the first bus tomorrow <!-- conventions:allow-korean: UX copy example --> |
| 검색 결과 없음 | 찾는 건물이 없어요. 다른 이름으로 검색해 보세요 <!-- conventions:allow-korean: UX copy example --> |

### 4. Keep honorifics casual

Avoid over-formal honorifics such as "~시겠어요?", "~시나요?" and "~께". <!-- conventions:allow-korean: the forms being banned are the point -->

| ❌ | ✅ |
| --- | --- |
| 검색하시겠어요? | 검색해 보세요 <!-- conventions:allow-korean: UX copy example --> |
| 어떤 건물을 찾고 계신가요? | 어떤 건물을 찾고 있나요? <!-- conventions:allow-korean: UX copy example --> |
| 이름이 어떻게 되시나요? | 이름이 뭐예요? or 이름을 알려주세요 <!-- conventions:allow-korean: UX copy example --> |

When removing the honorific leaves an awkward sentence, rewrite it with the information you
want as the subject.

### 5. Unpack noun stacks

Turn a Sino-Korean noun compound into a verb phrase.

| ❌ | ✅ |
| --- | --- |
| 시간표 업데이트 | 시간표가 바뀌었어요 <!-- conventions:allow-korean: UX copy example --> |
| 서비스 점검 | 서비스를 점검하고 있어요 <!-- conventions:allow-korean: UX copy example --> |
| 네트워크 오류 | 네트워크에 문제가 생겼어요 <!-- conventions:allow-korean: UX copy example --> |

When the compound resists unpacking, use the form "{명사}가 {명사}해서". <!-- conventions:allow-korean: the pattern is the instruction -->

### 6. Write "돼요", never "되어요" <!-- conventions:allow-korean: the two forms are the rule -->

It saves space on a phone. Every "되어요" becomes "돼요". <!-- conventions:allow-korean: the two forms are the rule -->

| ❌ | ✅ |
| --- | --- |
| 적용되어요 | 적용돼요 <!-- conventions:allow-korean: UX copy example --> |

## Writing principles

### 1. Weed cutting

Remove words that carry no meaning.

| ❌ | ✅ |
| --- | --- |
| 혹시 다른 건물을 찾고 있나요? | 다른 건물을 찾고 있나요? <!-- conventions:allow-korean: UX copy example --> |
| 지금 바로 확인하세요 | 지금 확인하세요, since 지금 and 바로 say the same thing <!-- conventions:allow-korean: UX copy example --> |

### 2. Remove empty sentences

Cut explanatory sentences the screen does not need.

| ❌ | ✅ |
| --- | --- |
| 아래 목록에서 원하는 건물을 선택해주세요 | Just show the list <!-- conventions:allow-korean: UX copy example --> |
| 여기에서 셔틀 시간표를 확인할 수 있어요 | Just show the timetable <!-- conventions:allow-korean: UX copy example --> |

### 3. Focus on the key message

Do not repeat across screens. One screen carries one message.

### 4. Write from the user's side

Give information from the user's point of view rather than the system's.

| ❌ | ✅ |
| --- | --- |
| 서버에서 데이터를 불러오지 못했어요 | 건물 정보를 불러오지 못했어요 <!-- conventions:allow-korean: UX copy example --> |
| GPS 신호가 약해요 | 현재 위치를 찾지 못했어요 <!-- conventions:allow-korean: UX copy example --> |

### 5. Hint at the next step

Make what happens after a tap predictable.

| ❌ | ✅ |
| --- | --- |
| 더보기 | 층별 공간 보기 <!-- conventions:allow-korean: UX copy example --> |
| 확인 | 시간표 보기 <!-- conventions:allow-korean: UX copy example --> |

### 6 to 8

Deeper applications of the rules above.

## Exceptions

### The passive voice is fine for

- **A service ending or expiring**, where the subject is what matters: 이번 학기 운행이 종료돼요 <!-- conventions:allow-korean: UX copy example -->
- **Explaining cause and effect**, as in 카드를 등록하지 않으면 결제가 안 돼요 <!-- conventions:allow-korean: UX copy example -->
- **Reassurance**, as in 개인정보는 수집되지 않아요 <!-- conventions:allow-korean: UX copy example -->
- Do not use 종료돼요 for something that ends on a regular cycle. Use 오늘 운행이 끝났어요. <!-- conventions:allow-korean: UX copy example -->

### Honorifics are fine for

- **A question that guesses at context**, as in 혹시 비밀번호를 잊으셨나요? <!-- conventions:allow-korean: UX copy example -->
- **Asking a favour**, as in 잠깐 설문에 참여해 주시겠어요? <!-- conventions:allow-korean: UX copy example -->

### The negative is fine for

- **A policy limit**, as in 이 기능은 학생 인증 후에 쓸 수 있어요, given with its reason <!-- conventions:allow-korean: UX copy example -->
- **A restricted feature**, as in 현금으로는 결제할 수 없어요 <!-- conventions:allow-korean: UX copy example -->
- **Reassurance**, as in 위치 정보는 저장하지 않아요 <!-- conventions:allow-korean: UX copy example -->

## SKKUBUS copy patterns

### Status messages

| Situation | Copy |
| --- | --- |
| Shuttle running | `다음 버스 {시간}` <!-- conventions:allow-korean: UX copy example --> |
| Shuttle finished for the day | `오늘 운행이 끝났어요` <!-- conventions:allow-korean: UX copy example --> |
| Before the first shuttle | `첫차 {시간}에 출발해요` <!-- conventions:allow-korean: UX copy example --> |
| No service today | `오늘은 쉬는 날이에요` <!-- conventions:allow-korean: UX copy example --> |
| Loading | A skeleton UI, with no text |
| Data failed to load | `{대상}을 불러오지 못했어요` with a `다시 시도해 주세요` button <!-- conventions:allow-korean: UX copy example --> |
| No search results | `찾는 건물이 없어요` <!-- conventions:allow-korean: UX copy example --> |
| Empty list | `아직 {대상}이 없어요` <!-- conventions:allow-korean: UX copy example --> |

### Error message template

| Part | Copy |
| --- | --- |
| Title | `{대상}을 불러오지 못했어요` <!-- conventions:allow-korean: UX copy example --> |
| Body | `잠시 후 다시 시도해 주세요` <!-- conventions:allow-korean: UX copy example --> |
| Buttons | `다시 시도` and `닫기` <!-- conventions:allow-korean: UX copy example --> |

- Put 닫기 on the left and the confirm or action button on the right. <!-- conventions:allow-korean: UX copy example -->
- Always use 닫기, never 취소. <!-- conventions:allow-korean: UX copy example -->

### Shuttle copy

| ❌ | ✅ |
| --- | --- |
| 운행시간 월요일 ~ 금요일 | 평일에만 운행해요 <!-- conventions:allow-korean: UX copy example --> |
| 공휴일 운행 안함 | 공휴일은 쉬어요 <!-- conventions:allow-korean: UX copy example --> |
| 요금 및 결제 400원 | 셔틀버스 요금 · 400원 <!-- conventions:allow-korean: UX copy example --> |
| 후불교통결제 기능 가능한 카드에 한함 | 후불교통결제 가능한 카드만 돼요 <!-- conventions:allow-korean: UX copy example --> |
| 금요일에는 기존 인자셔틀 버스와 별도로 학부대학 셔틀 버스가 추가운영됩니다 | 금요일엔 학부대학 셔틀이 추가로 다녀요 <!-- conventions:allow-korean: UX copy example --> |
| 시간표 · 총 7편 | 하루 7회 운행 <!-- conventions:allow-korean: UX copy example --> |

### Buildings and spaces

| ❌ | ✅ |
| --- | --- |
| 건물 5건, 공간 20건 | 건물 5곳 · 공간 20곳 <!-- conventions:allow-korean: UX copy example --> |
| 호실 4개 | 4개 공간 <!-- conventions:allow-korean: UX copy example --> |
| + 6개 더보기 | 6곳 더 보기 <!-- conventions:allow-korean: UX copy example --> |
| → 수선관(별관) | 수선관 별관으로 연결돼요 <!-- conventions:allow-korean: UX copy example --> |

## Snackbar and toast messages

| Situation | Copy |
| --- | --- |
| A link failed to open | `링크를 열 수 없어요` <!-- conventions:allow-korean: UX copy example --> |
| Network dropped | `네트워크에 문제가 생겼어요` <!-- conventions:allow-korean: UX copy example --> |
| Copied | `복사했어요!` <!-- conventions:allow-korean: UX copy example --> |
| Email copied | `이메일 주소를 복사했어요` <!-- conventions:allow-korean: UX copy example --> |

- **Never put 오류 in a snackbar title.** Say what happened. <!-- conventions:allow-korean: the banned word is the point -->
- Tell the user what they can do about it, as in `잠시 후 다시 시도해 주세요`. <!-- conventions:allow-korean: UX copy example -->

## Permission dialogs

| Part | Copy |
| --- | --- |
| Title | `{권한}이 필요해요` <!-- conventions:allow-korean: UX copy example --> |
| Body | `{기능}을 사용하려면\n{권한}을 허용해 주세요` <!-- conventions:allow-korean: UX copy example --> |
| Left button | `닫기`, never 취소 <!-- conventions:allow-korean: UX copy example --> |
| Right button | `설정으로 이동`, which hints at the next step <!-- conventions:allow-korean: UX copy example --> |

## The "none" state

| ❌ | ✅ |
| --- | --- |
| `{정보} 없음`, a noun stack | `{정보}가 없어요`, a 해요체 sentence <!-- conventions:allow-korean: UX copy example --> |

Where space is truly tight, in a badge or a table cell, the short label 없음 is allowed. <!-- conventions:allow-korean: UX copy example -->

## Dark patterns to avoid

What the TDS dark-pattern policy forbids:

1. **No bottom sheet on entry.** Show the screen the user came for first.
2. **No exit-intent popup on back.** Including prompts to accept notifications.
3. **No CTA without a way to decline.** Always offer close or refuse.
4. **No unexpected ads.** Do not interrupt a flow in progress.
5. **No vague CTA text.** Say what pressing the button does.

## Using graphics

1. **Fit the context.** A graphic helps understanding rather than decorating.
2. **One key graphic per screen.** Everything else becomes an icon.
3. **Never cover key information.**
4. **No negative or pleading emotion.**
5. **No decorative effects**, such as meaningless particles or heavy gradients.
6. **Convey the situation accurately.** No exclamation-mark icon when nothing is wrong.
7. **Icon size is 24 to 40px.**
8. **Never place icons side by side.** One at a time.

## Related

- [sdui-campus-spec.md](sdui-campus-spec.md) — the contract for user-facing copy the server
  sends, such as `title`
- [../README.md](../README.md) — the writing rules
