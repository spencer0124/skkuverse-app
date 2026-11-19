/**
 * QUIRK(rnscreens): the header, the body and the bottom accessory are separate native trees with no
 * shared Context, and the accessory mounts twice ('regular' and 'inline'), so local state would desync.
 */

import { create } from 'zustand';
import { createPendingSlot } from '@skkuverse/shared';
import { devLog } from '@/platform/dev-log';

interface NoticesUiState {
  activeTabKey: string;
  setActiveTabKey: (key: string) => void;
  accessorySearchQuery: string;
  setAccessorySearchQuery: (q: string) => void;
}

export const useNoticesUiStore = create<NoticesUiState>((set) => ({
  activeTabKey: '',
  setActiveTabKey: (key) => set({ activeTabKey: key }),
  accessorySearchQuery: '',
  setAccessorySearchQuery: (q) => set({ accessorySearchQuery: q }),
}));

// WHY: module state is safe to share with `+native-intent.tsx`, which runs outside React in the same bundle;
// in-app router.push never passes through here.

/** WHY: the review prompt requires 'push' specifically, so there is no default; every caller classifies itself. */
export type ExternalEntrySource = 'push' | 'universal_link';

type Pending = { sourceId: string; articleNo: string; source: ExternalEntrySource };

export const externalNoticeLinkQueue = createPendingSlot<Pending>({
  name: 'pendingLink',
  log: devLog,
  // WHY: whether each field arrived, never the ids, which name what the user reads.
  describe: (p) => ({ hasSourceId: !!p.sourceId, hasArticleNo: !!p.articleNo, source: p.source }),
});
