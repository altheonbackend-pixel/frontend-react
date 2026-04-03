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
      <div className="lang-switcher homescreen-lang-switcher">
        <button
          onClick={() => changeLanguage('fr')}
          className={`lang-btn${currentLang.startsWith('fr') ? ' active' : ''}`}
        >
          FR
        </button>
        <button
          onClick={() => changeLanguage('en')}
          className={`lang-btn${currentLang.startsWith('en') ? ' active' : ''}`}
        >
          EN
        </button>
      </div>
    </header>
  );
};

export default HomescreenHeader;