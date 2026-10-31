/* Firebase projesi yapılandırması.
   Mevcut panelinizin projesi (sevkiyat-yukleme-dashboard) varsayılan olarak kullanılır.
   Geçersiz kılmak isterseniz .env.local içinde NEXT_PUBLIC_FIREBASE_* değişkenlerini tanımlayın. */

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCuJADVrHE-QzqyQhLuoCO0S1iJ9gdUPQg',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'sevkiyat-yukleme-dashboard.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'sevkiyat-yukleme-dashboard',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'sevkiyat-yukleme-dashboard.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MSG_SENDER_ID || '633766455354',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:633766455354:web:4be47c83414c05a5aeed03',
};

export const isDefaultProject = !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
