import { useLocalSearchParams } from 'expo-router';
import { VideoPlayerScreen } from '@/features/video/VideoPlayerScreen';

export default function VideoPlayerRoute() {
  const { videoId, title } = useLocalSearchParams<{ videoId: string; title: string }>();
  return <VideoPlayerScreen videoId={videoId ?? ''} title={title ?? ''} />;
}
