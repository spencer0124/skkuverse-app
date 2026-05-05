// External-entry (universal link / FCM tap) 으로만 통과하는 deferred deep-link
// intent. `+native-intent.tsx` 가 React 트리 바깥에서 호출되지만 같은 JS 번들이
// 라 module state 공유는 안전하다. 외부 진입 시 (1) 여기에 set, (2) 노티스 탭
// 으로 navigate. RootLayout 의 PendingNoticeLinkConsumer 가 navigation root
// ready 시점에 consume 해서 detail 을 push 한다.
//
// In-app router.push('/notices/{id}') 콜은 이 모듈을 거치지 않으므로 영향 없음.

type Pending = { sourceId: string; articleNo: string } | null;

let pending: Pending = null;
const listeners = new Set<() => void>();

export const pendingExternalNoticeLink = {
  set(p: NonNullable<Pending>) {
    pending = p;
    listeners.forEach((cb) => {
      cb();
    });
  },
  consume(): Pending {
    const p = pending;
    pending = null;
    return p;
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};
