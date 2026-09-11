import { createRoot } from 'react-dom/client';
import '@kit/tokens.css';
import App from './App';
import Showroom from './Showroom';

// /?showroom 또는 #showroom → 세계관 쇼룸(딥 브리프 B1 카드), 그 외 → 밀도 데모
const showroom = location.search.includes('showroom') || location.hash === '#showroom';

createRoot(document.getElementById('root')!).render(showroom ? <Showroom /> : <App />);
