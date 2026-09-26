export {
  HOME_LAYOUT_VERSION,
  DEFAULT_BANNER_ASPECT_RATIO,
  DEFAULT_AUTO_ROTATE_SEC,
  parseHomeLayout,
  parseBannerCarousel,
  type HomeLayout,
  type HomeSection,
  type HomeBannerCarousel,
  type HomeBannerItem,
  type HomeBannerImage,
  type HomeBannerDefault,
  type HomeTileGrid,
  type HomeTile,
} from './schema';
export { defaultHomeLayout } from './defaults';
export { getCachedHomeLayout, fetchHomeLayout } from './repository';
export { useHomeLayout, HOME_LAYOUT_KEY } from './hooks';
