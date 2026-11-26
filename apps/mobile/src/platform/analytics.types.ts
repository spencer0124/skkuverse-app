import type { Campus, SubwayDirectionKey } from '@skkuverse/shared';
import type { MapTabId } from '@/features/map/map-config.types';
import type { GameEndParams, GameSubmitParams } from '@/features/games/host/host.rules';
import type { GameId } from '@/features/games/games.constants';
import type { MiniAppBridgeParams, MiniAppLoadParams } from '@/features/web/shell/telemetry.rules';
import type { SubwayViewSource } from '@/features/transit/subway/subway.rules';
import type { RunAttachmentKind } from '@/features/transit/schedule/run-attachments.rules';
import type { EntrySource, ItemAction, LinkKind, ViewName } from './analytics.rules';
import type { AppCheckFailureKind } from './app-check.rules';
import type { HandoffKind } from './handoff.rules';
import type { AnonTrigger } from '@/features/auth/anon-session.rules';
import type { AnonFailureClass, AuthFailureClass } from '@/features/auth/sign-in-errors.rules';
import type { OverviewOutcome } from '@/features/notices/overview/overview.rules';
import type { ServiceSource } from '@/features/transit/schedule/schedule-config.rules';
import type { TransitItemKind } from '@/features/transit/transit.types';
import type { PromoParams } from '@/features/promo/promo.types';

/**
 * WHY: every new event goes here and through `track()`, never a new wrapper: a closed set keeps the
 * property under GA4's 500-name quota and its params ids, never free text, an email or a location.
 * SEE: docs/explanation/analytics.md ("Adding an event")
 */
export interface EventMap {
  view_open: { view: ViewName; item_id?: string; source: EntrySource; nth?: number; nth_all?: number };
  view_close: { view: ViewName; item_id?: string; dwell_ms: number };
  item_action: { view: ViewName; item_id?: string; action: ItemAction; target?: string };
  link_open: { kind: LinkKind; via: 'deeplink' | 'push'; item_id?: string; src?: string };
  game_start: { game_id: GameId; play_id: string; play_n: number; source: EntrySource };
  game_end: GameEndParams;
  game_submit: GameSubmitParams;
  game_action: { game_id: GameId; play_id?: string; action: GameAction; detail?: string };
  promo_impression: PromoParams;
  promo_tap: PromoParams;
  miniapp_load: MiniAppLoadParams;
  miniapp_bridge: MiniAppBridgeParams;
  bus_service_view: { route_id: string; service_id: string; source: ServiceSource };
  transit_item_tap: {
    item_id: string;
    kind: TransitItemKind;
    section_id: string;
    group_id?: string;
    launch_ms?: number;
  };
  subway_open: { station_id: string; line?: string; source: EntrySource };
  subway_view: {
    station_id: string;
    line: string;
    direction: SubwayDirectionKey;
    trains: number;
    source: SubwayViewSource;
  };
  transit_load_error: { surface: TransitLoadSurface; item_id?: string; op: 'error' | 'retry' };
  schedule_attachment_view: { kind: RunAttachmentKind; id: string; run_key: string };
  schedule_attachment_action: { kind: RunAttachmentKind; id: string; run_key: string };
  // WHY: never the query, which is free text the user typed.
  notice_overview: {
    result: OverviewOutcome;
    ms: number;
    scope: number;
    cached?: 'true' | 'false';
    sources?: number;
  };
  map_chip: { chip_id: string; source: ChipSource; op: 'select' | 'clear'; tab?: MapTabId; ran_in?: MapTabId };
  app_foreground: { bg_ms: number; handoff?: HandoffKind };
  push_sub: {
    miniapp_id: string;
    op: 'on' | 'off' | 'reapply';
    source: 'feed' | 'toggle' | 'uid_change' | 'retry';
    result: 'ok' | 'fail' | 'denied' | 'dismissed';
    error?: string;
  };
  app_check: {
    phase: 'init' | 'refresh' | 'probe';
    result: 'ok' | AppCheckFailureKind | 'bounded';
    ms: number;
    code?: string;
    provider: AppCheckProvider;
    first_launch: boolean;
  };
  anon_signin: {
    trigger: AnonTrigger;
    result: 'ok' | AnonFailureClass;
    ac_kind?: AppCheckFailureKind | 'bounded';
    code?: string;
    attempt: number;
    ms: number;
    first_launch: boolean;
  };
}

export type AppCheckProvider = 'debug' | 'playIntegrity' | 'appAttestWithDeviceCheckFallback';

export type GameAction =
  | 'revive_tap'
  | 'revive_ok'
  | 'revive_fail'
  | 'offer_expired'
  | 'offer_unavailable'
  | 'next'
  | 'new_best'
  | 'prompt_shown'
  | 'prompt_accept'
  | 'prompt_decline'
  | 'claim_ok'
  | 'claim_fail'
  | 'submit_retry'
  | 'sound_toggle'
  | 'board_open'
  | 'close'
  | 'close_midrun';

/** WHY: `chip`, `portal` and `home` are declared ahead of any caller; the first caller of each says here what it means. */
export type ChipSource = 'row' | 'overlay' | 'chip' | 'portal' | 'push' | 'deeplink' | 'home';

export type TransitLoadSurface = 'transit_tab' | 'subway' | 'bus_config' | 'bus_schedule' | 'bus_stop';

export type BuildingDetailSource = 'marker' | 'search' | 'connection' | 'direct';

export type SearchResultType = 'building' | 'space' | 'bus_stop' | 'subway_station';

export type HomeContentType =
  | 'profile'
  | 'settings'
  | 'hero'
  | 'banner'
  | 'tile'
  | 'notice_more'
  | 'notice_row'
  | 'news_more'
  | 'news_card'
  | 'news_modal_close'
  | 'onboarding_cta'
  | 'hall_of_fame'
  | 'feed_more'
  | 'feed_row'
  | 'feed_push_ask';

export type NoticesContentType =
  | 'tab_strip'
  | 'list_row'
  | 'header_bookmark'
  | 'header_bell'
  | 'accessory_search'
  | 'picker_done'
  | 'picker_close'
  | 'picker_row'
  | 'picker_chip_remove'
  | 'picker_unsupported'
  | 'search_back'
  | 'overview_source'
  | 'detail_share'
  | 'detail_view_source'
  | 'detail_sibling_prev'
  | 'detail_sibling_next'
  | 'detail_attachment_preview'
  | 'detail_attachment_download'
  | 'detail_markdown_link'
  | 'detail_markdown_contact'
  | 'detail_line_map'
  | 'detail_schedule_map'
  | 'detail_line_search'
  | 'detail_line_call'
  | 'detail_line_email'
  | 'detail_line_link'
  | 'detail_line_quote'
  | 'detail_cta'
  | 'onboarding_landing_cta'
  | 'onboarding_landing_signin';

export type BusContentType =
  | 'schedule_day'
  | 'schedule_week_prev'
  | 'schedule_week_next'
  | 'schedule_info'
  | 'realtime_info'
  | 'realtime_refresh'
  | 'schedule_refresh'
  | 'schedule_section'
  | 'boarding_photo'
  | 'boarding_street_view'
  | 'boarding_map'
  | 'boarding_subway';

export type CampusContentType =
  | 'filter_button'
  | 'search_button'
  | 'quick_action_building_map'
  | 'quick_action_building_code'
  | 'quick_action_lost_found'
  | 'filter_sheet_campus_pill'
  | 'building_desc_expand'
  | 'eventmap_list_row'
  | 'eventmap_list_facet'
  | 'eventmap_list_facet_pick'
  | 'locate_button'
  | 'compass'
  | 'campus_suggestion'
  | 'location_permission';

export type SearchContentType =
  | 'clear_button'
  | 'section_buildings_toggle'
  | 'section_stops_toggle'
  | 'section_stations_toggle'
  | 'section_spaces_toggle';

export type SettingsContentType =
  | 'row_account'
  | 'row_notifications'
  | 'row_kakao'
  | 'row_licenses'
  | 'row_oss'
  | 'row_attributions'
  | 'row_tos'
  | 'row_debug_logs'
  | 'signin_from_account_anon';

/** WHY: prefixed, so a feed banner never reads as a home banner (`HomeContentType` `banner`). */
export type SduiContentType = 'sdui_banner' | 'sdui_banner_viewer' | 'notice_widget' | 'button_grid_item';

export type MealsContentType = 'meals_campus' | 'meals_day' | 'meals_cafeteria' | 'meals_tab' | 'meals_fixed_menu';

export type OnboardingStepKey =
  | 'campus'
  | 'primary_dept'
  | 'interest_dept'
  | 'login'
  | 'notification'
  | 'notice_categories'
  | 'completion';

export type OnboardingAction =
  | 'enter'
  | 'advance'
  | 'back'
  | 'skip'
  | 'exit_cancel'
  | 'exit_leave'
  | 'select_campus'
  | 'select_primary_dept'
  | 'open_unsupported_sheet'
  | 'select_unsupported_umbrella'
  | 'go_dept_survey'
  | 'toggle_interest_dept'
  | 'clear_interest_depts'
  | 'signin_attempt'
  | 'signin_success'
  | 'signin_error'
  | 'permission_grant'
  | 'permission_deny'
  | 'toggle_category'
  | 'complete';

/**
 * WHY: its own event, not `onboarding_step`: the intro is a tour every anonymous user sees, and merging
 * it with the configuration wizard would make the wizard's drop-off unreadable.
 */
export type IntroStepKey = 'shuttle' | 'map' | 'notices' | 'login';

export type IntroAction =
  | 'enter'
  | 'advance'
  | 'skip'
  | 'signin_attempt'
  | 'signin_success'
  | 'signin_error';

export type SettingsActionKey =
  | 'sign_out_prompt'
  | 'sign_out_confirm'
  | 'sign_out_cancel'
  | 'delete_account_prompt'
  | 'delete_account_confirm'
  | 'delete_account_cancel'
  | 'delete_feedback_submit'
  | 'delete_feedback_skip';

export type AuthEvent =
  | 'signin_attempt'
  | 'signin_success'
  | 'signin_cancel'
  | 'signin_domain_rejected'
  | 'signin_error';

export type AuthSurface =
  | 'login_screen'
  | 'onboarding'
  | 'account_settings'
  | 'notices_landing'
  | 'game';

export type ViewOpenExtra = Pick<EventMap['view_open'], 'nth' | 'nth_all'>;

export interface LogBuildingViewInputs {
  skkuId: number;
  buildingName: string;
  campus: Campus;
  source: BuildingDetailSource;
}

export interface LogSearchPerformInputs {
  query: string;
  buildingResults: number;
  spaceResults: number;
  stopResults?: number;
  stationResults?: number;
  campusFilter?: string;
}

export interface LogSearchResultTapInputs {
  resultType: SearchResultType;
  resultName: string;
  campus: Campus | null;
  skkuId?: number;
  stopId?: string;
  stationId?: string;
}

export interface LogBusRouteOpenInputs {
  routeId: string;
  routeLabel: string;
  screenType: string;
  source: EntrySource;
}

export interface LogNoticeViewInputs {
  sourceId: string;
  articleNo: number;
  tabKey?: string;
}

export interface LogHomeContentSelectInputs {
  content_type: HomeContentType;
  item_id: string;
}

export interface LogOnboardingStepInputs {
  step: OnboardingStepKey;
  action: OnboardingAction;
  detail?: string;
}

export interface LogIntroStepInputs {
  step: IntroStepKey;
  action: IntroAction;
  detail?: string;
}

export interface LogNotificationTabToggleInputs {
  tab_key: string;
  enabled: boolean;
  source: 'settings' | 'onboarding';
}

export interface LogSettingsActionInputs {
  action: SettingsActionKey;
  detail?: string;
}

export interface LogAuthEventInputs {
  event: AuthEvent;
  surface: AuthSurface;
  detail?: string;
  cls?: AuthFailureClass;
  ac_kind?: AppCheckFailureKind | 'bounded';
}
