import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { TrophyIcon, XIcon } from 'phosphor-react-native';
import { GlassIconButton, Txt } from '@skkuverse/sds';
import { authStore, SdsColors, useAuthStore, useT } from '@skkuverse/shared';
import type { GameMessage } from '@skkuverse/game-host';
import { AdUnitIds } from '@/utils/ad-helper';
import { logHandledError } from '@/services/crashlytics';
import { playWebHaptic } from '@/features/webview/haptic';
import { emailPrefixOf } from '@/features/profile/domain';
import { useUserProfile } from '@/features/profile/useUserProfile';
import type { NativeGameId } from '../ids';
import { NATIVE_GAMES, scoreText } from '../registry';
import { isBetter, type MyLine } from '../leaderboard/domain';
import { LeaderboardTopSection } from '../leaderboard/LeaderboardTopSection';
import { useRankOf } from '../leaderboard/useLeaderboard';
import { RankPromptSheet } from '../result/RankPromptSheet';
import { ResultPanel } from '../result/ResultPanel';
import { ReviveOffer } from '../result/ReviveOffer';
import { ScoreHeader } from '../result/ScoreHeader';
import { canRevive, initialSession, isFinal, sessionReducer } from './domain';
import { GameShell, type GameShellHandle } from './GameShell';
import { getHighScore, setHighScore } from './highScore';
import { startRun } from './repository';
import { useAutoSubmit } from './useAutoSubmit';
import { useRewardedRevive } from './useRewardedRevive';

/** How long the controls stay up at the start of a run. */
const CONTROLS_MS = 2500;
/** A stamp older than this is re-taken at the first tap (the rules give a run an hour from its stamp). */
const REARM_AFTER_MS = 10 * 60 * 1000;
/** The crash splash plays this long before the result panel rises. */
const PANEL_DELAY_MS = 600;
/** A revive the ad paid for must bring the run back this soon, or the crash is final. */
const REVIVE_WATCHDOG_MS = 3000;
const BOARD_LIMIT = 5;
/** Nothing is stored for a game not yet played. */
const NO_BEST = 0;
/** How long a run that just went on the board stays on screen before the game moves on. */
const SETTLE_VIEW_MS = 1800;
/** The floating buttons at the top right. */
const ACTION_SIZE = 40;
/** A `host:reset` the page has not acknowledged (`game:phase ready`) this soon is sent once more. */
const RESET_ACK_MS = 1000;

/**
 * A bundled game, hosted full screen. The page plays; this screen owns
 * everything a run is worth — the run stamp, the device best, revives, and
 * the leaderboard — through pieces no game owns: the result panel, the board,
 * the revive offer. A game supplies only its entry in NATIVE_GAMES.
 */
export function GameScreen({ gameId }: { gameId: NativeGameId }) {
  const game = NATIVE_GAMES[gameId];
  const router = useRouter();
  const { t, tpl } = useT();
  const insets = useSafeAreaInsets();
  const shell = useRef<GameShellHandle>(null);
  const [session, dispatch] = useReducer(sessionReducer, undefined, initialSession);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const [hi, setHi] = useState(() => getHighScore(gameId));
  const [newBest, setNewBest] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [appActive, setAppActive] = useState(true);
  const [prompt, setPrompt] = useState<{ variant: 'signIn' | 'setup'; busy: boolean; error: string | null } | null>(null);
  // The board is offered once per screen, and again only after a new best:
  // a game has many runs, and asking after every one of them is nagging.
  const offeredBoard = useRef(false);

  const uid = useAuthStore((s) => s.uid);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const email = useAuthStore((s) => s.email);
  const profile = useUserProfile(uid && !isAnonymous ? uid : null);
  const ad = useRewardedRevive(AdUnitIds.gameRevive, game.revives);
  const auto = useAutoSubmit({ gameId, session, dispatch, profile });

  // ── Run stamps ──
  // The stamp goes out before the first tap — on the title and before each
  // restart — so the clock the leaderboard trusts can only start early.
  const armed = useRef<{ uid: string; at: number } | null>(null);
  const arm = useCallback(() => {
    const current = authStore.getState().uid;
    if (!current) return;
    const id = startRun(current, gameId, (err) => logHandledError('games/start-run', err));
    armed.current = { uid: current, at: Date.now() };
    dispatch({ type: 'runArmed', run: { id, uid: current } });
  }, [gameId]);
  // At the first tap it is re-taken only when it cannot serve: nobody was
  // signed in yet, someone else is now, or it is too old for a long run.
  const ensureArmed = useCallback(() => {
    const current = authStore.getState().uid;
    const a = armed.current;
    if (!a || a.uid !== current || Date.now() - a.at > REARM_AFTER_MS) arm();
  }, [arm]);

  // The page acknowledges a reset by going back to its title. Without that the
  // page would sit on its result under the host's title with no way out.
  const awaitingReset = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearResetWait = () => {
    if (awaitingReset.current) clearTimeout(awaitingReset.current);
    awaitingReset.current = null;
  };
  useEffect(() => clearResetWait, []);

  const onMessage = useCallback(
    (m: GameMessage) => {
      if (m.type === 'game:ready' || (m.type === 'game:phase' && m.phase === 'ready')) clearResetWait();
      dispatch({ type: 'page', message: m });
      switch (m.type) {
        case 'game:ready':
          shell.current?.send({ type: 'host:init', hi: getHighScore(gameId) });
          if (sessionRef.current.phase !== 'crashed') arm();
          break;
        case 'game:start':
          ensureArmed();
          setShowControls(true);
          break;
        case 'game:over': {
          const best = getHighScore(gameId);
          if (m.score > 0 && (best === NO_BEST || isBetter(game.score.order, m.score, best))) {
            setHighScore(gameId, m.score);
            setHi(m.score);
            setNewBest(true);
            offeredBoard.current = false;
          }
          break;
        }
        case 'game:haptic':
          playWebHaptic(m.style);
          break;
      }
    },
    [arm, ensureArmed, gameId, game.score.order],
  );

  useEffect(() => {
    if (!showControls) return;
    const id = setTimeout(() => setShowControls(false), CONTROLS_MS);
    return () => clearTimeout(id);
  }, [showControls]);

  // The panel rises after the crash splash has had its moment.
  useEffect(() => {
    if (session.phase !== 'crashed' || !session.over) {
      setPanelVisible(false);
      return;
    }
    const id = setTimeout(() => setPanelVisible(true), PANEL_DELAY_MS);
    return () => clearTimeout(id);
  }, [session.phase, session.over]);

  // Something over the game (the board, sign-in) pauses a run: a sheet leaves
  // the page visible and running underneath.
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) shell.current?.send({ type: 'host:pause' });
  }, [focused]);

  // Leaving the app pauses a run, and holds the revive countdown.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
      if (state !== 'active') shell.current?.send({ type: 'host:pause' });
    });
    return () => sub.remove();
  }, []);

  // No ad can play: the offer ends at once rather than counting down to nothing.
  useEffect(() => {
    if (session.offer === 'open' && ad.status === 'failed') dispatch({ type: 'offerUnavailable' });
  }, [session.offer, ad.status]);
  // A crash retries an ad that failed to load for the last one.
  useEffect(() => {
    if (session.phase === 'crashed' && ad.status === 'failed') ad.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase]);

  // A revive the ad paid for that never brought the run back: the crash is final.
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (watchdog.current) clearTimeout(watchdog.current);
  }, []);

  const revive = async () => {
    dispatch({ type: 'reviveStarted' });
    const runId = sessionRef.current.run?.id;
    if (!(await ad.show())) {
      dispatch({ type: 'reviveFailed' });
      return;
    }
    if (sessionRef.current.run?.id !== runId) return; // restarted meanwhile
    shell.current?.send({ type: 'host:revive' });
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = setTimeout(() => {
      watchdog.current = null;
      if (sessionRef.current.phase === 'crashed') dispatch({ type: 'reviveFailed' });
    }, REVIVE_WATCHDOG_MS);
  };

  /** Settle the run as it stands and go back to the game's title. */
  const toTitle = () => {
    const s = sessionRef.current;
    if (s.phase === 'crashed' && s.over) {
      // Settle this run from a snapshot first: the reset below clears it.
      const finalized = isFinal(s) ? s : sessionReducer(s, { type: 'finalize' });
      auto.settleNow(finalized);
    }
    dispatch({ type: 'restart' });
    setNewBest(false);
    arm();
    shell.current?.send({ type: 'host:reset' });
    clearResetWait();
    awaitingReset.current = setTimeout(() => {
      awaitingReset.current = null;
      shell.current?.send({ type: 'host:reset' });
    }, RESET_ACK_MS);
  };

  /**
   * "Next": the run is settled and the game goes back to its title — unless
   * this run could go on the board once the player signs in or picks a
   * nickname, which is offered here, once. Meanwhile the run is final (the
   * revive offer stops) but stays on screen, so it can still be written.
   */
  const next = () => {
    const s = sessionRef.current;
    const needs = auto.needsFor(s);
    if (needs && !offeredBoard.current) {
      offeredBoard.current = true;
      dispatch({ type: 'finalize' });
      setPrompt({ variant: needs, busy: false, error: null });
      return;
    }
    toTitle();
  };

  const acceptPrompt = async () => {
    if (!prompt) return;
    if (prompt.variant === 'setup') {
      setPrompt(null);
      auto.pickNickname();
      return;
    }
    setPrompt({ ...prompt, busy: true, error: null });
    const failure = await auto.signIn();
    if (failure === null) setPrompt(null);
    else if (failure === 'cancelled') setPrompt((p) => p && { ...p, busy: false });
    else setPrompt((p) => p && { ...p, busy: false, error: t(failure === 'domain' ? 'auth.domainNotAllowed' : 'auth.unknownError') });
  };

  const declinePrompt = () => {
    if (!prompt || prompt.busy) return;
    setPrompt(null);
    toTitle();
  };

  // Back from signing in or picking a nickname: "next" was already pressed, so
  // once the run has found its place on the board — long enough to watch the
  // line slide in — the game moves on by itself. If the player backed out and
  // nothing will be written, it moves on at once.
  const { detour, resetDetour, needsFor } = auto;
  const toTitleRef = useRef(toTitle);
  toTitleRef.current = toTitle;
  useEffect(() => {
    if (detour.state !== 'back' || !focused) return;
    const status = session.submission.status;
    const settled = status === 'submitted' || status === 'notImproved' || status === 'failed';
    // Backed out: still facing the very step they were sent to.
    const stuck = status === 'idle' && detour.step !== null && needsFor(session) === detour.step;
    if (!settled && !stuck) return;
    const id = setTimeout(
      () => {
        resetDetour();
        toTitleRef.current();
      },
      settled ? SETTLE_VIEW_MS : 0,
    );
    return () => clearTimeout(id);
  }, [detour, focused, session, needsFor, resetDetour]);

  // Leaving the game (X, a swipe, Android back) settles a run still on
  // screen, as "next" would: a record set just before closing is not lost.
  const navigation = useNavigation();
  const settleNow = auto.settleNow;
  useEffect(
    () =>
      navigation.addListener('beforeRemove', () => {
        const s = sessionRef.current;
        if (s.phase === 'crashed' && s.over) settleNow(isFinal(s) ? s : sessionReducer(s, { type: 'finalize' }));
      }),
    [navigation, settleNow],
  );

  const openBoard = () => router.push({ pathname: '/games/[id]/leaderboard', params: { id: gameId } } as never);

  // ── The player's line on the board ──
  // Their best while the run is open; the new best, at its new rank, once it
  // is written; and while it cannot be written (signed out, no nickname) a
  // ghost where this score would rank. One key throughout, so it moves.
  const over = session.over;
  const submitted = session.submission.status === 'submitted' ? session.submission : null;
  const showGhost = !!over && !submitted && !auto.myBest && over.score > 0;
  const ghostRank = useRankOf(gameId, showGhost ? over!.score : null);
  const prevRank = useRef<number | null>(null);
  useEffect(() => {
    if (session.phase === 'crashed' && session.submission.status === 'idle') prevRank.current = auto.myBest?.rank ?? null;
  }, [session.phase, session.submission.status, auto.myBest]);

  const me: MyLine | null = useMemo(() => {
    if (!over) return null;
    const p = profile.status === 'ready' ? profile.profile : null;
    const prefix = emailPrefixOf(email);
    if (submitted && uid && p?.nickname && prefix) {
      return {
        kind: 'entry',
        entry: { uid, nickname: p.nickname, emailPrefix: prefix, campus: p.campus, score: over.score },
        rank: submitted.rank ?? auto.myBest?.rank ?? 1,
      };
    }
    if (auto.myBest) return { kind: 'entry', entry: auto.myBest.entry, rank: auto.myBest.rank };
    if (showGhost && ghostRank.data) return { kind: 'ghost', uid: uid ?? 'me', score: over.score, rank: ghostRank.data };
    return null;
  }, [over, submitted, uid, profile, email, auto.myBest, showGhost, ghostRank.data]);

  const boardNote = (() => {
    if (submitted) {
      const before = prevRank.current;
      const now = submitted.rank;
      if (before === null) return t('game.newEntry');
      if (now !== null && now < before) return tpl('game.rankUp', before - now);
      return null;
    }
    if (session.submission.status === 'failed') {
      const { reason } = session.submission;
      return reason === 'network' ? t('game.submitFailed') : reason === 'otherAccount' ? t('game.submitOtherAccount') : null;
    }
    return null;
  })();

  // Shown while it counts, and spent once it has run out; never when no ad could play.
  const offerShown = session.offer === 'open' || session.offer === 'watching' || session.offer === 'closed';
  const showOffer = game.revives && !!over && over.revivesLeft > 0 && offerShown;

  return (
    <View style={[styles.root, { backgroundColor: game.background }]}>
      <StatusBar style="dark" />
      {/* Android draws edge to edge, so the window is not resized for the
          keyboard: a game that types shrinks its web view itself, and the
          page (sized to its viewport) keeps the input above the keyboard.
          iOS needs nothing — WebKit shrinks the visual viewport. */}
      <KeyboardAvoidingView
        style={styles.stage}
        behavior="height"
        enabled={game.keyboard && Platform.OS === 'android'}
      >
        <GameShell ref={shell} html={game.html} background={game.background} keyboard={game.keyboard} onMessage={onMessage} />
      </KeyboardAvoidingView>
      <game.Overlay phase={session.phase} hi={hi} showControls={showControls} />

      {/* The result cards go under the floating buttons, which stay on top. */}
      {panelVisible && over && (
        <ResultPanel
          score={
            <ScoreHeader
              headline={t(game.headline(over))}
              score={over.score}
              best={hi}
              format={game.score.format}
              unit={game.score.unitKey ? t(game.score.unitKey) : undefined}
              details={over.stats && game.details ? game.details(over.stats, tpl) : undefined}
              isNewBest={newBest}
            />
          }
          board={
            <LeaderboardTopSection
              gameId={gameId}
              title={t('game.hallOfFame')}
              limit={BOARD_LIMIT}
              me={me}
              footer={
                boardNote && (
                  <Txt typography="t7" fontWeight="semibold" color={SdsColors.brand} style={styles.note}>
                    {boardNote}
                  </Txt>
                )
              }
            />
          }
          offer={
            showOffer ? (
              <ReviveOffer
                offer={session.offer === 'open' || session.offer === 'watching' ? session.offer : 'closed'}
                enabled={canRevive(session, ad.status === 'ready')}
                adLoading={ad.status === 'loading'}
                paused={!appActive || !focused}
                onRevive={revive}
                onExpire={() => dispatch({ type: 'offerExpired' })}
              />
            ) : undefined
          }
          onNext={next}
          scrim={game.scrim}
          topInset={insets.top + ACTION_SIZE + 20}
        />
      )}
      <View style={[styles.actions, { top: insets.top + 8 }]} pointerEvents="box-none">
        <GlassIconButton icon={<TrophyIcon size={20} color={SdsColors.grey900} weight="bold" />} onPress={openBoard} label={t('game.leaderboard')} />
        <GlassIconButton icon={<XIcon size={20} color={SdsColors.grey900} weight="bold" />} onPress={() => router.back()} label={t('common.close')} />
      </View>
      {prompt && over && (
        <RankPromptSheet
          open
          variant={prompt.variant}
          score={scoreText(game, over.score, t)}
          busy={prompt.busy}
          error={prompt.error}
          onAccept={acceptPrompt}
          onLater={declinePrompt}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stage: { flex: 1 },
  actions: { position: 'absolute', right: 16, flexDirection: 'row', gap: 10 },
  note: { textAlign: 'center', marginTop: 4 },
});
