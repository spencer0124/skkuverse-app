import { View } from 'react-native';
import { CaretDownIcon, CaretUpIcon } from 'phosphor-react-native';
import { useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Badge, Pressable, TextButton, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import type { NoticeScheduleStatus } from '../notice-schedule.types';
import type { NoticeScheduleMapTarget, NoticeScheduleRowModel } from './useNoticeScheduleSection';

const RAIL_WIDTH = SdsSpacing.x6;
const HALO_SIZE = SdsSpacing.x6;
const DOT_SIZE = SdsSpacing.x2;
const LINE_WIDTH = SdsSpacing.x0_5;
const DOT_CENTER = SdsSpacing.x0_5 + HALO_SIZE / 2;

const STATUS_BADGE = {
  scheduled: null,
  tentative: { color: 'warningContrast', backgroundColor: 'warningWeak' },
  rescheduled: { color: 'informativeContrast', backgroundColor: 'informativeWeak' },
  cancelled: { color: 'criticalContrast', backgroundColor: 'criticalWeak' },
  suspended: { color: 'neutralMuted', backgroundColor: 'neutralWeak' },
} as const;

function StatusBadge({ status, text }: { status: NoticeScheduleStatus; text: string | null }) {
  const badge = STATUS_BADGE[status];
  if (badge === null || text === null) return null;
  return (
    <Badge size="xsmall" color={badge.color} backgroundColor={badge.backgroundColor} fontWeight="bold">
      {text}
    </Badge>
  );
}

interface MapButtonProps {
  target: NoticeScheduleMapTarget;
  label: string;
  onPress: (target: NoticeScheduleMapTarget) => void;
}

function MapButton({ target, label, onPress }: MapButtonProps) {
  const styles = useStyles();
  return (
    <TextButton typography="t6" variant="arrow" color="brand" onPress={() => onPress(target)} style={styles.mapButton}>
      {label}
    </TextButton>
  );
}

interface Props {
  row: NoticeScheduleRowModel;
  isFirst: boolean;
  isLast: boolean;
  onToggle: (id: string) => void;
  onMapPress: (target: NoticeScheduleMapTarget) => void;
}

export function NoticeScheduleRow({ row, isFirst, isLast, onToggle, onMapPress }: Props) {
  const styles = useStyles();
  const color = useSemanticColors();
  const { t } = useT();
  const isMuted = row.phase === 'past' || row.isStruck;
  const dotStyle = row.phase === 'past' ? styles.dotPast : styles.dotActive;

  const body = (
    <>
      <View style={styles.rail}>
        {isFirst && isLast ? null : (
          <View style={[styles.line, isFirst ? styles.lineFromDot : null, isLast ? styles.lineToDot : null]} />
        )}
        <View style={[styles.halo, row.phase === 'ongoing' ? styles.haloOngoing : null]}>
          <View style={[styles.dot, dotStyle]} />
        </View>
      </View>
      <View style={styles.content}>
        <Txt typography="t5" color="neutralSubtle">
          {row.dateText}
        </Txt>
        <View style={styles.titleRow}>
          <Txt
            typography="t7"
            fontWeight="bold"
            color={isMuted ? 'neutralSubtle' : 'neutral'}
            lineBreakStrategyIOS="hangul-word"
            style={[styles.shrink, row.isStruck ? styles.struck : null]}
          >
            {row.title}
          </Txt>
          <StatusBadge status={row.status} text={row.statusText} />
        </View>
        {row.meta !== null ? (
          <Txt typography="t5" color="neutralMuted">
            {row.meta}
          </Txt>
        ) : null}
        {row.isExpanded ? (
          <View style={styles.detail}>
            {row.parts.map((part) => (
              <View key={part.id} style={styles.part}>
                <View style={styles.titleRow}>
                  <Txt
                    typography="t6"
                    fontWeight="bold"
                    color={part.isStruck ? 'neutralSubtle' : 'neutral'}
                    lineBreakStrategyIOS="hangul-word"
                    style={[styles.shrink, part.isStruck ? styles.struck : null]}
                  >
                    {part.title}
                  </Txt>
                  <StatusBadge status={part.status} text={part.statusText} />
                </View>
                {part.meta !== null ? (
                  <Txt typography="t5" color="neutralMuted">
                    {part.meta}
                  </Txt>
                ) : null}
                {part.mapTarget !== null ? (
                  <MapButton target={part.mapTarget} onPress={onMapPress} label={t('notices.schedule.showOnMap')} />
                ) : null}
              </View>
            ))}
            {row.occurrenceTexts.map((text, index) => (
              <View key={index} style={styles.bullet}>
                <Txt typography="t6" color="neutralMuted" style={styles.bulletDot}>
                  {'•'}
                </Txt>
                <Txt typography="t6" color="neutralMuted" lineBreakStrategyIOS="hangul-word" style={styles.shrink}>
                  {text}
                </Txt>
              </View>
            ))}
            {row.moreText !== null ? (
              <Txt typography="t5" color="neutralSubtle">
                {row.moreText}
              </Txt>
            ) : null}
            {row.exceptText !== null ? (
              <Txt typography="t5" color="neutralSubtle">
                {row.exceptText}
              </Txt>
            ) : null}
            {row.mapTarget !== null ? (
              <MapButton target={row.mapTarget} onPress={onMapPress} label={t('notices.schedule.showOnMap')} />
            ) : null}
          </View>
        ) : null}
      </View>
      {row.isExpandable ? (
        <View style={styles.chevron}>
          {row.isExpanded ? (
            <CaretUpIcon size={20} color={color.fg.neutralSubtle} />
          ) : (
            <CaretDownIcon size={20} color={color.fg.neutralSubtle} />
          )}
        </View>
      ) : null}
    </>
  );

  if (!row.isExpandable) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      bg="layerDefault"
      onPress={() => onToggle(row.id)}
      accessibilityRole="button"
      accessibilityState={{ expanded: row.isExpanded }}
      accessibilityLabel={`${row.dateText}, ${row.title}`}
      style={styles.row}
    >
      {body}
    </Pressable>
  );
}

const useStyles = createThemedStyles(({ color }) => ({
  row: {
    flexDirection: 'row',
    paddingHorizontal: SdsSpacing.gutter,
    paddingVertical: SdsSpacing.x2,
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
  },
  line: {
    position: 'absolute',
    top: -SdsSpacing.x2,
    bottom: -SdsSpacing.x2,
    width: LINE_WIDTH,
    backgroundColor: color.bg.neutralMuted,
  },
  lineFromDot: {
    top: DOT_CENTER,
  },
  lineToDot: {
    bottom: undefined,
    height: DOT_CENTER + SdsSpacing.x2,
  },
  halo: {
    width: HALO_SIZE,
    height: HALO_SIZE,
    marginTop: SdsSpacing.x0_5,
    borderRadius: SdsRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloOngoing: {
    backgroundColor: color.bg.brandWeak,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: SdsRadius.full,
  },
  dotActive: {
    backgroundColor: color.bg.brandSolid,
  },
  dotPast: {
    backgroundColor: color.stroke.control,
  },
  content: {
    flex: 1,
    paddingLeft: SdsSpacing.x3,
    paddingBottom: SdsSpacing.x4,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: SdsSpacing.x2,
  },
  shrink: {
    flexShrink: 1,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  chevron: {
    paddingLeft: SdsSpacing.x2,
    paddingTop: SdsSpacing.x4,
  },
  detail: {
    paddingTop: SdsSpacing.x3,
    gap: SdsSpacing.x3,
  },
  part: {
    gap: SdsSpacing.x1,
  },
  bullet: {
    flexDirection: 'row',
  },
  bulletDot: {
    width: SdsSpacing.x5,
  },
  mapButton: {
    alignSelf: 'flex-start',
  },
}));
