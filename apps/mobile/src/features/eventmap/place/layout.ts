/**
 * The place sheet's horizontal inset.
 *
 * One constant, shared by the scroll content and by the blocks that bleed past
 * it — the highlight pills and the image strip both cancel it with a negative
 * margin so they run to the card's edge while their rows stay inset.
 */

import { SdsSpacing } from '@skkuverse/shared';

export const SHEET_GUTTER = SdsSpacing.lg;
