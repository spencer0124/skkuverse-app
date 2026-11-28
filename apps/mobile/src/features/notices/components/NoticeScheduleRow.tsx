import { View } from 'react-native';
import { CaretDownIcon, CaretUpIcon } from 'phosphor-react-native';
import { useT, SdsRadius, SdsSpacing, SdsTypeScale } from '@skkuverse/shared';
import { Badge, Pressable, TextButton, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import type { NoticeScheduleStatus } from '../notice-schedule.types';
import type { NoticeScheduleMapTarget, NoticeScheduleRowModel } from './useNoticeScheduleSection';

const RAIL_WIDTH = SdsSpacing.x4;
const HALO_SIZE = SdsSpacing.x4;
const DOT_SIZE = SdsSpacing.x1_5;
const LINE_WIDTH = SdsSpacing.x0_5;
const TITLE_LINE_HEIGHT = SdsTypeScale.t6.lineHeight;
const HALO_TOP = (TITLE_LINE_HEIGHT - HALO_SIZE) / 2;
const DOT_CENTER = HALO_TOP + HALO_SIZE / 2;

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
    <TextButton typography="t4" variant="arrow" color="brand" onPress={() => onPress(target)} style={styles.mapButton}>
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
        <View style={styles.titleRow}>
          <Txt
            typography="t6"
            fontWeight="semiBold"
            color={isMuted ? 'neutralSubtle' : 'neutral'}
            lineBreakStrategyIOS="hangul-word"
            style={[styles.shrink, row.isStruck ? styles.struck : null]}
          >
            {row.title}
          </Txt>
          <StatusBadge status={row.status} text={row.statusText} />
        </View>
        {row.meta !== null ? (
          <Txt typography="t4" color="neutralSubtle" lineBreakStrategyIOS="hangul-word">
            {row.meta}
          </Txt>
        ) : null}
        {row.isExpanded ? (
          <View style={styles.detail}>
            {row.parts.map((part) => (
              <View key={part.id} style={styles.part}>
                <View style={styles.titleRow}>
                  <Txt
                    typography="t4"
                    fontWeight="semiBold"
                    color={part.isStruck ? 'neutralSubtle' : 'neutral'}
                    lineBreakStrategyIOS="hangul-word"
                    style={[styles.shrink, part.isStruck ? styles.struck : null]}
                  >
                    {part.title}
                  </Txt>
                  <StatusBadge status={part.status} text={part.statusText} />
                </View>
                {part.meta !== null ? (
                  <Txt typography="t4" color="neutralSubtle">
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
                <Txt typography="t4" color="neutralMuted" style={styles.bulletDot}>
                  {'•'}
                </Txt>
                <Txt typography="t4" color="neutralMuted" lineBreakStrategyIOS="hangul-word" style={styles.shrink}>
                  {text}
                </Txt>
              </View>
            ))}
            {row.moreText !== null ? (
              <Txt typography="t4" color="neutralSubtle">
                {row.moreText}
              </Txt>
            ) : null}
            {row.exceptText !== null ? (
              <Txt typography="t4" color="neutralSubtle">
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
      accessibilityLabel={row.meta === null ? row.title : `${row.title}, ${row.meta}`}
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
    paddingVertical: SdsSpacing.x1,
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
  },
  line: {
    position: 'absolute',
    top: -SdsSpacing.x1,
    bottom: -SdsSpacing.x1,
    width: LINE_WIDTH,
    backgroundColor: color.bg.neutralMuted,
  },
  lineFromDot: {
    top: DOT_CENTER,
  },
  lineToDot: {
    bottom: undefined,
    height: DOT_CENTER + SdsSpacing.x1,
  },
  halo: {
    width: HALO_SIZE,
    height: HALO_SIZE,
    marginTop: HALO_TOP,
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
    paddingBottom: SdsSpacing.x2,
    gap: SdsSpacing.x0_5,
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
    paddingTop: HALO_TOP,
  },
  detail: {
    paddingTop: SdsSpacing.x2,
    gap: SdsSpacing.x2,
  },
  part: {
    gap: SdsSpacing.x0_5,
  },
  bullet: {
    flexDirection: 'row',
  },
  bulletDot: {
    width: SdsSpacing.x4,
  },
  mapButton: {
    alignSelf: 'flex-start',
  },
}));
