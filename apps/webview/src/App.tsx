import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import ErrorPage from './pages/error';
import HSSCMap from './pages/hsscmap/hsscmap';
import NSCMap from './pages/nscmap/nscmap';
import HSSCBusInfo from './pages/bus/HSSCBusInfo';
import CampusBusInfo from './pages/bus/CampusBusInfo';
import LostAndFound from './pages/lostandfound/LostAndFound';

function App() {
  useEffect(() => {
    const setScreenSize = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setScreenSize();
    window.addEventListener('resize', setScreenSize);
    return () => window.removeEventListener('resize', setScreenSize);
  }, []);

  return (
    <Routes>
      <Route path="/" element={<ErrorPage />} />
      <Route path="map">
        <Route path="hssc" element={<HSSCMap />} />
        <Route path="nsc" element={<NSCMap />} />
      </Route>
      <Route path="bus">
        <Route path="hssc/info" element={<HSSCBusInfo />} />
        <Route path="campus/info" element={<CampusBusInfo />} />
      </Route>
      <Route path="skku">
        <Route path="lostandfound" element={<LostAndFound />} />
      </Route>
    </Routes>
  );
}

export default App;
