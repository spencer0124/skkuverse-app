import { useLocalSearchParams } from 'expo-router';
import { VideoPlayerScreen } from '@/features/video/VideoPlayerScreen';

export default function VideoPlayerRoute() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  return <VideoPlayerScreen videoId={videoId ?? ''} />;
}
