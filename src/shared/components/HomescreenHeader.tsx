// src/components/HomescreenHeader.tsx

//import React from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/HomescreenHeader.css';

const HomescreenHeader = () => {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const currentLang = i18n.language || 'fr';

  return (
    <header className="homescreen-header">
      <div className="header-info">
        <h1 className="company-name">Altheon Medical Expertise</h1>
        <p className="slogan">{t('landing.slogan')}</p>
      </div>
      <div className="language-switcher" style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '8px', zIndex: 1000 }}>
        <button 
          onClick={() => changeLanguage('fr')} 
          style={{ 
            cursor: 'pointer', 
            padding: '6px 12px', 
            fontWeight: 'bold',
            backgroundColor: currentLang.startsWith('fr') ? '#007bff' : '#ffffff', 
            color: currentLang.startsWith('fr') ? '#fff' : '#333', 
            border: currentLang.startsWith('fr') ? 'none' : '1px solid #ddd', 
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          FR
        </button>
        <button 
          onClick={() => changeLanguage('en')} 
          style={{ 
            cursor: 'pointer', 
            padding: '6px 12px', 
            fontWeight: 'bold',
            backgroundColor: currentLang.startsWith('en') ? '#007bff' : '#ffffff', 
            color: currentLang.startsWith('en') ? '#fff' : '#333', 
            border: currentLang.startsWith('en') ? 'none' : '1px solid #ddd', 
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          EN
        </button>
      </div>
    </header>
  );
};

export default HomescreenHeader;