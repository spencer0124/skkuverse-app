import { View } from 'react-native';
import { SdsSpacing } from '@skkuverse/shared';
import { ListRow, Txt, createThemedStyles } from '@skkuverse/sds';
import { formatListDate } from './notice-date.rules';
import { HighlightedText } from './components/HighlightedText';
import type { NoticeListItem } from './notices.types';

interface Props {
  item: NoticeListItem;
  onPress: (item: NoticeListItem) => void;
  /** WHY: null on a list of one board, where the tab already names it. */
  board?: string | null;
  highlightQuery?: string;
}

export function NoticeRow({ item, onPress, board, highlightQuery }: Props) {
  const styles = useStyles();
  const dateText = formatListDate(item.date);
  const hasMeta = dateText.length > 0 || Boolean(board);

  return (
    <ListRow
      onPress={() => onPress(item)}
      style={styles.row}
      containerStyle={styles.container}
      contents={
        <View>
          {/* WHY: the title is capped at one line so every row's first line starts at the same y. */}
          <HighlightedText
            typography="t4"
            fontWeight="bold"
            color="neutral"
            numberOfLines={1}
            text={item.title}
            query={highlightQuery}
          />
          {/* WHY: separators are 1pt Views, not "|" glyphs, which are never optically centered against digits. */}
          {hasMeta ? (
            <View style={styles.metaRow}>
              {dateText ? (
                <Txt typography="t2" color="neutralSubtle" numberOfLines={1} style={styles.date}>
                  {dateText}
                </Txt>
              ) : null}
              {dateText && board ? <View style={styles.metaSep} /> : null}
              {board ? (
                <Txt typography="t2" color="neutralSubtle" numberOfLines={1} style={styles.board}>
                  {board}
                </Txt>
              ) : null}
            </View>
          ) : null}
        </View>
      }
    />
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  row: {
    backgroundColor: color.bg.layerDefault,
  },
  container: {
    paddingVertical: SdsSpacing.x4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SdsSpacing.x2_5,
  },
  // EVIDENCE: WantedSans' proportional digits run 880 to 1280 units wide, so without `tnum` the
  // separators after "11/11" and "07/30" never line up.
  date: {
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  board: {
    flexShrink: 1,
  },
  // WHY: a crisp 1pt fill reads heavier than an antialiased glyph, so text ink would outshout the data.
  metaSep: {
    width: 1,
    height: 10,
    backgroundColor: color.stroke.neutralWeak,
    marginHorizontal: SdsSpacing.x2_5,
  },
}));
