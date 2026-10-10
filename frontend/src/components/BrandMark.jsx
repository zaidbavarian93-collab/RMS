import { useState } from 'react';

// شعار المطعم، أو 🍽️ إن لم يُرفع شعار (أو تعذّر تحميله)
export default function BrandMark({ logo, size = 40, className = '' }) {
  const [broken, setBroken] = useState(false);
  if (logo && !broken) {
    return <img src={logo} alt="" className={`brand-logo ${className}`} style={{ width: size, height: size }} onError={() => setBroken(true)} />;
  }
  return <span className={`logo-dot ${className}`} style={{ width: size, height: size, fontSize: size * 0.5 }}>🍽️</span>;
}
