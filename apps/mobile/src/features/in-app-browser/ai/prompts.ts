/**
 * 인앱 브라우저 페이지 도우미 프롬프트 3종.
 *
 * notices/ai의 grounding 기법을 페이지용으로 이식 — context-only / negative prompting +
 * "모르면 모른다" 제약. 추천 질문은 strict JSON 대신 번호 줄 출력(parseSuggestedQuestions가
 * 관용 파싱) — 2.1B Q4 신뢰도 고려, 기존 notices/ai의 JSON 미사용 방침과 일치.
 *
 * 메시지 빌더는 이미 만들어진 context 문자열을 받는다(hook이 buildPageContext로 1회 생성,
 * 요약/질문/QA에 재사용 — 컨텍스트 3중 재빌드 방지).
 */
import type { ChatMessage } from '@skkuverse/shared';

const PAGE_DELIM = '\n\n──── 페이지 ────\n';

const SUMMARY_SYSTEM =
  '당신은 웹페이지 내용을 요약하는 한국어 어시스턴트입니다.\n' +
  '아래 "페이지" 내용만 근거로 핵심을 3~5개의 간결한 불릿으로 요약하세요.\n' +
  '- 페이지에 없는 정보·추측은 쓰지 마세요.\n' +
  '- 각 불릿은 한 문장으로 짧게.\n' +
  '- 인사말·사족 없이 요약만 출력하세요.';

const QUESTIONS_SYSTEM =
  '당신은 웹페이지를 읽고, 사용자가 본문에서 바로 확인할 만한 짧은 질문을 만드는 한국어 어시스턴트입니다.\n' +
  '아래 "페이지" 본문에 답이 분명히 적혀 있는 사실 확인용 질문 4개를 만드세요.\n' +
  '- 각 질문은 아주 짧게, 핵심 단어 2~3개로만 (예: "신청 기간?", "제출 서류?", "지원 자격?", "장소 어디?").\n' +
  '- 본문에서 답을 바로 찾을 수 있는 구체적 사실만 (날짜·금액·대상·자격·장소·방법·서류 등).\n' +
  '- 한 줄에 하나씩, 번호(1. 2. 3. 4.)를 붙여 출력.\n' +
  '- 긴 문장·추측·일반 상식 질문 금지. 질문 외 다른 말은 절대 출력하지 마세요.';

// 페이지판 grounding 프롬프트 (notices/ai SYSTEM_PREFIX 미러).
const QA_SYSTEM =
  '당신은 아래 "페이지" 내용만 읽고 답하는 한국어 어시스턴트입니다.\n' +
  '반드시 지켜야 할 규칙:\n' +
  '1. 오직 아래 "페이지" 내용만 근거로 답하세요. 문서에 없는 정보·외부 지식·추측은 절대 사용하지 마세요.\n' +
  '2. 페이지에 없거나 확실하지 않은 내용은 지어내지 말고 "페이지에서 확인할 수 없는 내용이에요."라고만 답하세요.\n' +
  '3. 답은 한국어로 간결하게, 페이지에 실제로 적힌 사실만 전달하세요.';

export function summaryMessages(context: string): ChatMessage[] {
  return [
    { role: 'system', content: SUMMARY_SYSTEM + PAGE_DELIM + context },
    { role: 'user', content: '이 페이지를 요약해 주세요.' },
  ];
}

export function questionsMessages(context: string): ChatMessage[] {
  return [
    { role: 'system', content: QUESTIONS_SYSTEM + PAGE_DELIM + context },
    { role: 'user', content: '추천 질문을 만들어 주세요.' },
  ];
}

export function qaMessages(context: string, question: string): ChatMessage[] {
  return [
    { role: 'system', content: QA_SYSTEM + PAGE_DELIM + context },
    { role: 'user', content: question },
  ];
}
