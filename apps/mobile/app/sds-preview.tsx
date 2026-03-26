/**
 * SDS Preview — shows all Tier 1 + Tier 2 SDS components for visual testing.
 * Every component state is exposed for comprehensive verification.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SdsColors } from '@skkuuniverse/shared';
import {
  Txt,
  Button,
  Badge,
  Border,
  Switch,
  Checkbox,
  ListRow,
  AccordionList,
  type AccordionSection,
  TextButton,
  IconButton,
  ListHeader,
  ListFooter,
  Skeleton,
  Loader,
  ProgressBar,
  SearchField,
  TextField,
  Dialog,
  Toast,
} from '@skkuuniverse/sds';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Txt typography="t4" fontWeight="bold" style={styles.sectionTitle}>
        {title}
      </Txt>
      {children}
    </View>
  );
}

function SubSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.subSection}>
      <Txt typography="t7" color={SdsColors.grey500} style={styles.subLabel}>{label}</Txt>
      {children}
    </View>
  );
}

export default function SDSPreviewScreen() {
  // ── Tier 1 state ──
  const [switchOn, setSwitchOn] = useState(false);
  const [checkLine, setCheckLine] = useState(false);
  const [checkCircle, setCheckCircle] = useState(true);
  const [count, setCount] = useState(0);
  const [floorExpanded, setFloorExpanded] = useState<number | null>(null);
  const [floorShowAll, setFloorShowAll] = useState<Record<number, boolean>>({});

  // ── Tier 2 state ──
  // SearchField
  const [searchText, setSearchText] = useState('');
  const [searchClearable, setSearchClearable] = useState('초기값');

  // TextField
  const [tfBoxAppear, setTfBoxAppear] = useState('');
  const [tfBoxSustain, setTfBoxSustain] = useState('');
  const [tfLine, setTfLine] = useState('');
  const [tfError, setTfError] = useState('');
  const [tfPrefix, setTfPrefix] = useState('');
  const [tfClearable, setTfClearable] = useState('');
  const [tfDisabled] = useState('비활성화됨');

  // ProgressBar
  const [progress, setProgress] = useState(30);

  // Dialog
  const [alertOpen, setAlertOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [alertCustomOpen, setAlertCustomOpen] = useState(false);
  const [confirmNoDimmerOpen, setConfirmNoDimmerOpen] = useState(false);

  // Toast
  const [toastCheck, setToastCheck] = useState(false);
  const [toastError, setToastError] = useState(false);
  const [toastWarning, setToastWarning] = useState(false);
  const [toastInfo, setToastInfo] = useState(false);
  const [toastWithButton, setToastWithButton] = useState(false);
  const [toastTop, setToastTop] = useState(false);

  // Progress bar auto-increment demo
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => (p >= 100 ? 0 : p + 10));
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ════════════════════════════════════════════
            TIER 1 COMPONENTS
            ════════════════════════════════════════════ */}

        {/* ── Txt ── */}
        <Section title="Txt">
          <Txt typography="t1" fontWeight="bold">t1 Bold — Hero</Txt>
          <Txt typography="t3" fontWeight="bold">t3 Bold — Screen Title</Txt>
          <Txt typography="t5">t5 Regular — Body (default)</Txt>
          <Txt typography="t6" color={SdsColors.grey600}>t6 Grey — Small body</Txt>
          <Txt typography="t7" color={SdsColors.grey500}>t7 Caption</Txt>
        </Section>

        <Border />

        {/* ── Button ── */}
        <Section title="Button — Press Animation">
          <Txt typography="t6" color={SdsColors.grey600}>
            inline: scale down + dim overlay (꾹 누르기)
          </Txt>
          <View style={styles.row}>
            <Button size="big" onPress={() => setCount(c => c + 1)}>
              {`Tap me (${count})`}
            </Button>
          </View>
          <View style={styles.row}>
            <Button size="large" type="danger" onPress={() => setCount(c => c + 1)}>Danger</Button>
            <Button size="medium" style="weak" onPress={() => setCount(c => c + 1)}>Weak</Button>
          </View>
          <View style={styles.row}>
            <Button size="tiny" onPress={() => setCount(c => c + 1)}>Tiny</Button>
            <Button size="tiny" type="dark" onPress={() => setCount(c => c + 1)}>Dark</Button>
            <Button size="tiny" type="light" onPress={() => setCount(c => c + 1)}>Light</Button>
          </View>
          <Txt typography="t6" color={SdsColors.grey600}>
            block: dim overlay only (scale 없음)
          </Txt>
          <Button display="block" onPress={() => setCount(c => c + 1)}>Block Display</Button>
          <View style={styles.row}>
            <Button size="medium" disabled onPress={() => {}}>Disabled</Button>
            <Button size="medium" loading onPress={() => {}}>Loading</Button>
          </View>
        </Section>

        <Border />

        {/* ── Badge ── */}
        <Section title="Badge">
          <View style={styles.row}>
            <Badge size="large" color={SdsColors.blue500} backgroundColor={SdsColors.blue50}>Large</Badge>
            <Badge size="medium" color={SdsColors.green500} backgroundColor={SdsColors.green50}>Medium</Badge>
            <Badge size="small">Small</Badge>
            <Badge size="tiny" color={SdsColors.red500} backgroundColor={SdsColors.red50}>Tiny</Badge>
          </View>
        </Section>

        <Border />

        {/* ── Switch ── */}
        <Section title="Switch">
          <View style={styles.row}>
            <Txt typography="t5">Toggle:</Txt>
            <Switch checked={switchOn} onCheckedChange={setSwitchOn} />
          </View>
          <View style={styles.row}>
            <Txt typography="t5" color={SdsColors.grey500}>Disabled:</Txt>
            <Switch checked disabled />
          </View>
        </Section>

        <Border />

        {/* ── Checkbox ── */}
        <Section title="Checkbox">
          <Checkbox.Line checked={checkLine} onCheckedChange={setCheckLine}>
            <Txt typography="t5">Line Checkbox</Txt>
          </Checkbox.Line>
          <View style={{ height: 12 }} />
          <Checkbox.Circle checked={checkCircle} onCheckedChange={setCheckCircle}>
            <Txt typography="t5">Circle Checkbox</Txt>
          </Checkbox.Circle>
          <View style={{ height: 12 }} />
          <Checkbox.Line checked disabled>
            <Txt typography="t5" color={SdsColors.grey400}>Disabled Checked</Txt>
          </Checkbox.Line>
        </Section>

        <Border />

        {/* ── ListRow ── */}
        <Section title="ListRow">
          <ListRow
            contents={<ListRow.Texts type="1RowTypeA" top="Simple one-line row" />}
            withArrow
            onPress={() => {}}
          />
          <Border type="padding24" />
          <ListRow
            contents={
              <ListRow.Texts type="2RowTypeA" top="Two-line title" bottom="Subtitle text here" />
            }
            right={<Badge size="small" color={SdsColors.blue500} backgroundColor={SdsColors.blue50}>New</Badge>}
            onPress={() => {}}
          />
          <Border type="padding24" />
          <ListRow
            left={<ListRow.LeftText>Label</ListRow.LeftText>}
            contents={<ListRow.Texts type="1RowTypeB" top="Bold with left label" />}
            withArrow
            onPress={() => {}}
          />
          <Border type="padding24" />
          <ListRow
            contents={
              <ListRow.Texts type="3RowTypeA" top="Subtitle" middle="Main content text" bottom="Additional info" />
            }
          />
        </Section>

        <Border />

        {/* ── AccordionList ── */}
        <Section title="AccordionList">
          <AccordionList
            sections={SAMPLE_SECTIONS}
            expandedIndex={floorExpanded}
            onToggle={setFloorExpanded}
            showAllMap={floorShowAll}
            onShowAll={(i) => setFloorShowAll(prev => ({ ...prev, [i]: true }))}
            keyExtractor={(item) => item.id}
            highlightKey="21301"
            renderItem={(item, _i, highlighted) => (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 10,
                  backgroundColor: highlighted ? SdsColors.blue50 : undefined,
                }}
              >
                <Txt
                  typography="t7"
                  fontWeight={highlighted ? 'medium' : 'regular'}
                  color={highlighted ? SdsColors.blue500 : SdsColors.grey700}
                  style={{ flex: 1 }}
                >
                  {item.name}
                </Txt>
                <Badge
                  size="tiny"
                  color={highlighted ? SdsColors.blue500 : SdsColors.grey400}
                  backgroundColor={highlighted ? SdsColors.blue50 : SdsColors.grey100}
                >
                  {item.id}
                </Badge>
              </View>
            )}
          />
        </Section>

        <Border />

        {/* ════════════════════════════════════════════
            TIER 2 COMPONENTS
            ════════════════════════════════════════════ */}

        {/* ── TextButton ── */}
        <Section title="TextButton">
          <SubSection label="variant: arrow / underline / clear">
            <View style={styles.row}>
              <TextButton typography="t5" variant="arrow" onPress={() => {}}>Arrow</TextButton>
              <TextButton typography="t5" variant="underline" onPress={() => {}}>Underline</TextButton>
              <TextButton typography="t5" variant="clear" onPress={() => {}}>Clear</TextButton>
            </View>
          </SubSection>
          <SubSection label="fontWeight: regular / medium / semiBold / bold">
            <View style={styles.row}>
              <TextButton typography="t6" variant="arrow" fontWeight="regular" onPress={() => {}}>Regular</TextButton>
              <TextButton typography="t6" variant="arrow" fontWeight="medium" onPress={() => {}}>Medium</TextButton>
              <TextButton typography="t6" variant="arrow" fontWeight="semiBold" onPress={() => {}}>SemiBold</TextButton>
              <TextButton typography="t6" variant="arrow" fontWeight="bold" onPress={() => {}}>Bold</TextButton>
            </View>
          </SubSection>
          <SubSection label="color / typography variants">
            <View style={styles.row}>
              <TextButton typography="t5" variant="arrow" color={SdsColors.blue500} fontWeight="bold" onPress={() => {}}>Blue Bold</TextButton>
              <TextButton typography="t7" variant="underline" color={SdsColors.red500} onPress={() => {}}>Red t7</TextButton>
              <TextButton typography="t6" variant="clear" color={SdsColors.green500} onPress={() => {}}>Green t6</TextButton>
            </View>
          </SubSection>
          <SubSection label="disabled">
            <View style={styles.row}>
              <TextButton typography="t5" variant="arrow" disabled>Arrow disabled</TextButton>
              <TextButton typography="t5" variant="underline" disabled>Underline disabled</TextButton>
              <TextButton typography="t5" variant="clear" disabled>Clear disabled</TextButton>
            </View>
          </SubSection>
        </Section>

        <Border />

        {/* ── IconButton ── */}
        <Section title="IconButton">
          <SubSection label="variant: fill / border / clear (default)">
            <View style={styles.row}>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <IconButton
                  icon={<Txt typography="t6" fontWeight="bold" color={SdsColors.grey700}>+</Txt>}
                  variant="fill"
                  onPress={() => {}}
                />
                <Txt typography="t7" color={SdsColors.grey400}>fill</Txt>
              </View>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <IconButton
                  icon={<Txt typography="t6" fontWeight="bold" color={SdsColors.grey700}>X</Txt>}
                  variant="border"
                  onPress={() => {}}
                />
                <Txt typography="t7" color={SdsColors.grey400}>border</Txt>
              </View>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <IconButton
                  icon={<Txt typography="t6" fontWeight="bold" color={SdsColors.blue500}>i</Txt>}
                  variant="clear"
                  onPress={() => {}}
                />
                <Txt typography="t7" color={SdsColors.grey400}>clear</Txt>
              </View>
            </View>
          </SubSection>
          <SubSection label="disabled / custom bgColor">
            <View style={styles.row}>
              <IconButton
                icon={<Txt typography="t6" fontWeight="bold" color={SdsColors.grey400}>D</Txt>}
                variant="fill"
                disabled
              />
              <IconButton
                icon={<Txt typography="t6" fontWeight="bold" color="#FFFFFF">C</Txt>}
                variant="fill"
                bgColor={SdsColors.blue500}
                onPress={() => {}}
              />
              <IconButton
                icon={<Txt typography="t6" fontWeight="bold" color={SdsColors.red500}>!</Txt>}
                variant="border"
                bgColor={SdsColors.red50}
                onPress={() => {}}
              />
            </View>
          </SubSection>
          <SubSection label="press animation (꾹 누르기)">
            <IconButton
              icon={<Txt typography="t5" fontWeight="bold" color={SdsColors.blue500}>A</Txt>}
              variant="fill"
              iconSize={32}
              label="Large icon button"
              onPress={() => {}}
            />
          </SubSection>
        </Section>

        <Border />

        {/* ── ListHeader ── */}
        <Section title="ListHeader">
          <SubSection label="title + upper + right (RightText)">
            <ListHeader
              upper={<ListHeader.DescriptionParagraph>보조설명</ListHeader.DescriptionParagraph>}
              title={
                <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
                  타이틀 내용
                </ListHeader.TitleParagraph>
              }
              right={<ListHeader.RightText typography="t7">악세사리</ListHeader.RightText>}
            />
          </SubSection>
          <SubSection label="title + lower">
            <ListHeader
              title={
                <ListHeader.TitleParagraph typography="t4" fontWeight="bold">
                  큰 타이틀
                </ListHeader.TitleParagraph>
              }
              lower={<ListHeader.DescriptionParagraph>하단 설명 텍스트</ListHeader.DescriptionParagraph>}
            />
          </SubSection>
          <SubSection label="RightArrow compound">
            <ListHeader
              title={
                <ListHeader.TitleParagraph typography="t5" fontWeight="bold">
                  전체보기
                </ListHeader.TitleParagraph>
              }
              right={<ListHeader.RightArrow typography="t7" onPress={() => {}}>더보기</ListHeader.RightArrow>}
            />
          </SubSection>
          <SubSection label="pressable (onPress)">
            <ListHeader
              title={
                <ListHeader.TitleParagraph typography="t5" fontWeight="medium">
                  눌러보세요
                </ListHeader.TitleParagraph>
              }
              right={<ListHeader.RightText>›</ListHeader.RightText>}
              onPress={() => {}}
            />
          </SubSection>
        </Section>

        <Border />

        {/* ── ListFooter ── */}
        <Section title="ListFooter">
          <SubSection label="borderType: full (default)">
            <ListFooter
              title={<ListFooter.Title>더 보기</ListFooter.Title>}
              onPress={() => {}}
            />
          </SubSection>
          <SubSection label="borderType: none + right + custom color">
            <ListFooter
              borderType="none"
              title={<ListFooter.Title color={SdsColors.grey600} fontWeight="bold">더 보기</ListFooter.Title>}
              right={
                <ListFooter.Right>
                  <Txt typography="t7" color={SdsColors.grey600}>›</Txt>
                </ListFooter.Right>
              }
              onPress={() => {}}
            />
          </SubSection>
          <SubSection label="non-pressable (no onPress)">
            <ListFooter
              borderType="none"
              title={<ListFooter.Title color={SdsColors.grey400}>표시만 하는 푸터</ListFooter.Title>}
            />
          </SubSection>
        </Section>

        <Border />

        {/* ── Skeleton ── */}
        <Section title="Skeleton">
          <SubSection label="Skeleton.Animate (shimmer)">
            <Skeleton.Animate>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Skeleton width={48} height={48} borderRadius={24} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width="80%" height={16} />
                    <Skeleton width="60%" height={14} />
                  </View>
                </View>
                <Skeleton width="100%" height={12} />
                <Skeleton width="90%" height={12} />
                <Skeleton width="70%" height={12} />
              </View>
            </Skeleton.Animate>
          </SubSection>
          <SubSection label="borderRadius variants (default 6)">
            <Skeleton.Animate>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Skeleton width={60} height={60} borderRadius={0} />
                <Skeleton width={60} height={60} borderRadius={6} />
                <Skeleton width={60} height={60} borderRadius={12} />
                <Skeleton width={60} height={60} borderRadius={30} />
              </View>
            </Skeleton.Animate>
          </SubSection>
          <SubSection label="without Animate (no shimmer, static)">
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Skeleton width={100} height={20} />
              <Skeleton width={80} height={20} />
            </View>
          </SubSection>
        </Section>

        <Border />

        {/* ── Loader ── */}
        <Section title="Loader">
          <SubSection label="size: small / medium / large (default)">
            <View style={styles.row}>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Loader size="small" type="primary" />
                <Txt typography="t7" color={SdsColors.grey500}>small</Txt>
              </View>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Loader size="medium" type="primary" />
                <Txt typography="t7" color={SdsColors.grey500}>medium</Txt>
              </View>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Loader size="large" type="primary" />
                <Txt typography="t7" color={SdsColors.grey500}>large</Txt>
              </View>
            </View>
          </SubSection>
          <SubSection label="type: primary / dark / light">
            <View style={styles.row}>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Loader size="medium" type="primary" />
                <Txt typography="t7" color={SdsColors.grey500}>primary</Txt>
              </View>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Loader size="medium" type="dark" />
                <Txt typography="t7" color={SdsColors.grey500}>dark</Txt>
              </View>
              <View style={{ alignItems: 'center', gap: 4, backgroundColor: SdsColors.grey900, padding: 12, borderRadius: 8 }}>
                <Loader size="medium" type="light" />
                <Txt typography="t7" color="#FFFFFF">light</Txt>
              </View>
            </View>
          </SubSection>
          <SubSection label="with label">
            <Loader size="medium" type="primary" label="불러오는 중..." />
          </SubSection>
          <SubSection label="customSize / customStrokeColor">
            <View style={styles.row}>
              <Loader customSize={18} customStrokeColor={SdsColors.red500} />
              <Loader customSize={30} customStrokeColor={SdsColors.green500} />
              <Loader customSize={48} customStrokeColor="#FF6600" />
            </View>
          </SubSection>
        </Section>

        <Border />

        {/* ── ProgressBar ── */}
        <Section title="ProgressBar">
          <Txt typography="t6" color={SdsColors.grey600}>{`자동 progress: ${progress}%`}</Txt>
          <SubSection label="size: light (2px)">
            <ProgressBar progress={progress} size="light" withAnimation />
          </SubSection>
          <SubSection label="size: normal (4px, default)">
            <ProgressBar progress={progress} size="normal" withAnimation />
          </SubSection>
          <SubSection label="size: bold (8px) + custom color">
            <ProgressBar progress={progress} size="bold" color={SdsColors.green500} withAnimation />
          </SubSection>
          <SubSection label="withAnimation: false (즉시 반영)">
            <ProgressBar progress={progress} size="normal" />
          </SubSection>
          <SubSection label="static values: 0 / 25 / 50 / 75 / 100">
            <View style={{ gap: 6 }}>
              <ProgressBar progress={0} size="normal" />
              <ProgressBar progress={25} size="normal" color={SdsColors.red500} />
              <ProgressBar progress={50} size="normal" color="#FF6600" />
              <ProgressBar progress={75} size="normal" color={SdsColors.blue500} />
              <ProgressBar progress={100} size="normal" color={SdsColors.green500} />
            </View>
          </SubSection>
        </Section>

        <Border />

        {/* ── SearchField ── */}
        <Section title="SearchField">
          <SubSection label="hasClearButton: false (default)">
            <SearchField
              placeholder="검색어를 입력하세요"
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.length > 0 && (
              <Txt typography="t7" color={SdsColors.grey500}>{`입력: "${searchText}"`}</Txt>
            )}
          </SubSection>
          <SubSection label="hasClearButton: true">
            <SearchField
              placeholder="클리어 가능"
              value={searchClearable}
              onChangeText={setSearchClearable}
              hasClearButton
            />
          </SubSection>
        </Section>

        <Border />

        {/* ── TextField ── */}
        <Section title="TextField">
          <SubSection label="box + labelOption: appear (default)">
            <TextField
              variant="box"
              label="이름"
              placeholder="이름을 입력하세요"
              value={tfBoxAppear}
              onChangeText={setTfBoxAppear}
            />
          </SubSection>
          <SubSection label="box + labelOption: sustain">
            <TextField
              variant="box"
              label="항상 보이는 라벨"
              labelOption="sustain"
              placeholder="입력"
              value={tfBoxSustain}
              onChangeText={setTfBoxSustain}
            />
          </SubSection>
          <SubSection label="line variant">
            <TextField
              variant="line"
              label="이메일"
              placeholder="이메일 입력"
              value={tfLine}
              onChangeText={setTfLine}
              suffix="@skku.edu"
            />
          </SubSection>
          <SubSection label="hasError + help text">
            <TextField
              variant="box"
              label="비밀번호"
              hasError={tfError.length > 0 && tfError.length < 6}
              help={tfError.length > 0 && tfError.length < 6 ? '6자 이상 입력하세요' : '도움말 텍스트'}
              value={tfError}
              onChangeText={setTfError}
              secureTextEntry
            />
          </SubSection>
          <SubSection label="prefix + suffix">
            <TextField
              variant="box"
              label="금액"
              prefix="₩"
              suffix="원"
              value={tfPrefix}
              onChangeText={setTfPrefix}
              keyboardType="numeric"
            />
          </SubSection>
          <SubSection label="TextField.Clearable">
            <TextField.Clearable
              variant="box"
              label="클리어 가능"
              value={tfClearable}
              onChangeText={setTfClearable}
            />
          </SubSection>
          <SubSection label="disabled">
            <TextField variant="box" label="비활성화" value={tfDisabled} disabled />
          </SubSection>
          <SubSection label="line + disabled">
            <TextField variant="line" label="Line 비활성화" value="readonly" disabled />
          </SubSection>
        </Section>

        <Border />

        {/* ── Dialog ── */}
        <Section title="Dialog">
          <SubSection label="Dialog.Alert / Dialog.Confirm">
            <View style={styles.row}>
              <Button size="medium" onPress={() => setAlertOpen(true)}>Alert</Button>
              <Button size="medium" style="weak" onPress={() => setConfirmOpen(true)}>Confirm</Button>
            </View>
          </SubSection>
          <SubSection label="custom buttonText + content">
            <Button size="medium" type="dark" onPress={() => setAlertCustomOpen(true)}>
              Custom Alert
            </Button>
          </SubSection>
          <SubSection label="closeOnDimmerClick: false">
            <Button size="medium" style="weak" type="dark" onPress={() => setConfirmNoDimmerOpen(true)}>
              Dimmer 클릭 무시
            </Button>
          </SubSection>
        </Section>

        <Border />

        {/* ── Toast ── */}
        <Section title="Toast">
          <SubSection label="icon types: check / error / warning / info">
            <View style={styles.row}>
              <Button size="tiny" onPress={() => setToastCheck(true)}>Check</Button>
              <Button size="tiny" type="danger" onPress={() => setToastError(true)}>Error</Button>
              <Button size="tiny" type="dark" onPress={() => setToastWarning(true)}>Warning</Button>
              <Button size="tiny" type="light" onPress={() => setToastInfo(true)}>Info</Button>
            </View>
          </SubSection>
          <SubSection label="with button / position: top">
            <View style={styles.row}>
              <Button size="tiny" onPress={() => setToastWithButton(true)}>With Button</Button>
              <Button size="tiny" style="weak" onPress={() => setToastTop(true)}>Top Position</Button>
            </View>
          </SubSection>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Overlay components ── */}
      <Dialog.Alert
        open={alertOpen}
        title="알림"
        description="작업이 완료되었습니다."
        onClose={() => setAlertOpen(false)}
      />
      <Dialog.Confirm
        open={confirmOpen}
        title="삭제 확인"
        description="정말로 삭제하시겠어요?"
        leftButton={
          <Button size="large" display="block" style="weak" type="dark" onPress={() => setConfirmOpen(false)}>
            취소
          </Button>
        }
        rightButton={
          <Button size="large" display="block" type="danger" onPress={() => setConfirmOpen(false)}>
            삭제
          </Button>
        }
        onClose={() => setConfirmOpen(false)}
      />
      <Dialog.Alert
        open={alertCustomOpen}
        title={
          <Txt typography="t4" fontWeight="bold" color={SdsColors.blue500} style={{ textAlign: 'center' }}>
            커스텀 타이틀
          </Txt>
        }
        description="ReactNode 타이틀, 커스텀 버튼 텍스트"
        content={
          <View style={{ padding: 12, backgroundColor: SdsColors.grey50, borderRadius: 8, marginBottom: 8 }}>
            <Txt typography="t7" color={SdsColors.grey600}>추가 컨텐츠 영역</Txt>
          </View>
        }
        buttonText="닫기"
        onClose={() => setAlertCustomOpen(false)}
      />
      <Dialog.Confirm
        open={confirmNoDimmerOpen}
        title="딤 클릭 무시"
        description="dimmer를 클릭해도 닫히지 않아요. 버튼만 동작합니다."
        closeOnDimmerClick={false}
        leftButton={
          <Button size="large" display="block" style="weak" type="dark" onPress={() => setConfirmNoDimmerOpen(false)}>
            취소
          </Button>
        }
        rightButton={
          <Button size="large" display="block" onPress={() => setConfirmNoDimmerOpen(false)}>
            확인
          </Button>
        }
        onClose={() => setConfirmNoDimmerOpen(false)}
      />

      {/* Toast overlays */}
      <Toast
        open={toastCheck}
        text="저장되었어요"
        icon={<Toast.Icon type="check" />}
        onClose={() => setToastCheck(false)}
      />
      <Toast
        open={toastError}
        text="오류가 발생했어요"
        icon={<Toast.Icon type="error" />}
        onClose={() => setToastError(false)}
      />
      <Toast
        open={toastWarning}
        text="주의가 필요해요"
        icon={<Toast.Icon type="warning" />}
        onClose={() => setToastWarning(false)}
      />
      <Toast
        open={toastInfo}
        text="안내 메시지입니다"
        icon={<Toast.Icon type="info" />}
        onClose={() => setToastInfo(false)}
      />
      <Toast
        open={toastWithButton}
        text="실행 취소할까요?"
        icon={<Toast.Icon type="check" />}
        button={<Toast.Button text="실행취소" onPress={() => setToastWithButton(false)} />}
        duration={5}
        onClose={() => setToastWithButton(false)}
      />
      <Toast
        open={toastTop}
        text="상단에 표시되는 토스트"
        position="top"
        icon={<Toast.Icon type="info" />}
        onClose={() => setToastTop(false)}
      />
    </SafeAreaView>
  );
}

interface SpaceItem {
  id: string;
  name: string;
}

const SAMPLE_SECTIONS: AccordionSection<SpaceItem>[] = [
  {
    title: '1층',
    badge: '1F',
    subtitle: '호실 3개',
    items: [
      { id: '101', name: '안내데스크' },
      { id: '102', name: '편의점 CU' },
      { id: '103', name: '카페 투썸플레이스' },
    ],
  },
  {
    title: '2층',
    badge: '2F',
    subtitle: '호실 8개',
    items: [
      { id: '201', name: '대강당' },
      { id: '202', name: '세미나실 A' },
      { id: '203', name: '세미나실 B' },
      { id: '204', name: '교수 휴게실' },
      { id: '205', name: '행정실' },
      { id: '206', name: '학생상담센터' },
      { id: '207', name: '동아리실 1' },
      { id: '208', name: '동아리실 2' },
    ],
  },
  {
    title: '3층',
    badge: '3F',
    items: [
      { id: '301', name: '멀티미디어실' },
      { id: '302', name: '컴퓨터실습실' },
    ],
  },
  {
    title: '지하 1층',
    badge: 'B1',
    items: [
      { id: '21301', name: '학생식당' },
      { id: 'B102', name: '매점' },
    ],
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  scroll: {
    paddingBottom: 40,
  },
  section: {
    padding: 24,
    gap: 12,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  subSection: {
    gap: 8,
  },
  subLabel: {
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
});
