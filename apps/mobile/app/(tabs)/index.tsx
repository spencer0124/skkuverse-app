import { HomeScreen } from '@/features/home/HomeScreen';
import { useTabFocusTracking } from '@/hooks/useTabFocusTracking';

export default function HomeTab() {
  useTabFocusTracking('home');
  return <HomeScreen />;
}
