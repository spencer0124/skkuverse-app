// External-entry (universal link / FCM tap) 으로만 통과하는 deferred deep-link
// intent. `+native-intent.tsx` 가 React 트리 바깥에서 호출되지만 같은 JS 번들이
// 라 module state 공유는 안전하다. 외부 진입 시 (1) 여기에 set, (2) 노티스 탭
// 으로 navigate. RootLayout 의 PendingNoticeLinkConsumer 가 navigation root
// ready 시점에 consume 해서 detail 을 push 한다.
//
// In-app router.push('/notices/{id}') 콜은 이 모듈을 거치지 않으므로 영향 없음.

import { devLog } from '@/services/dev-log';

type Pending = { sourceId: string; articleNo: string } | null;

let pending: Pending = null;
const listeners = new Set<() => void>();

export const pendingExternalNoticeLink = {
  set(p: NonNullable<Pending>) {
    pending = p;
    // RELEASE-GATE(debug-menu): listenerCount는 race 진단용 — set 시점에
    // PendingNoticeLinkConsumer가 subscribe 했는지 여부.
    devLog('pendingLink.set', {
      hasSourceId: !!p.sourceId,
      hasArticleNo: !!p.articleNo,
      listenerCount: listeners.size,
    });
    listeners.forEach((cb) => {
      cb();
    });
  },
  consume(): Pending {
    const p = pending;
    pending = null;
    devLog('pendingLink.consume', { hasPending: !!p });
    return p;
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};
