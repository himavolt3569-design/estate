'use client';

import { useRef } from 'react';
import { MapPin, ShieldCheck } from 'lucide-react';
import styles from './hero-home-scene.module.css';

/** A small, self-contained illustration: no video, canvas, or external asset request. */
export function HeroHomeScene() {
  const sceneRef = useRef<HTMLDivElement>(null);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    sceneRef.current?.style.setProperty('--pointer-x', `${x * 7}deg`);
    sceneRef.current?.style.setProperty('--pointer-y', `${y * -7}deg`);
  };

  const resetPointer = () => {
    sceneRef.current?.style.setProperty('--pointer-x', '0deg');
    sceneRef.current?.style.setProperty('--pointer-y', '0deg');
  };

  return <div ref={sceneRef} className={styles.scene} aria-hidden="true" onPointerMove={onPointerMove} onPointerLeave={resetPointer}>
    <div className={styles.aura} />
    <div className={styles.orbit} />
    <div className={styles.model}>
      <svg viewBox="0 0 520 440" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.house}>
        <defs>
          <linearGradient id="heroPlot" x1="80" y1="225" x2="405" y2="392" gradientUnits="userSpaceOnUse"><stop stopColor="#16647A"/><stop offset="1" stopColor="#092746"/></linearGradient>
          <linearGradient id="heroLeftWall" x1="138" y1="185" x2="267" y2="360" gradientUnits="userSpaceOnUse"><stop stopColor="#EDF3EE"/><stop offset="1" stopColor="#B7D3D0"/></linearGradient>
          <linearGradient id="heroRightWall" x1="281" y1="230" x2="423" y2="294" gradientUnits="userSpaceOnUse"><stop stopColor="#D7E9E5"/><stop offset="1" stopColor="#85ADAE"/></linearGradient>
          <linearGradient id="heroRoof" x1="165" y1="127" x2="393" y2="223" gradientUnits="userSpaceOnUse"><stop stopColor="#718DA0"/><stop offset="1" stopColor="#254866"/></linearGradient>
          <linearGradient id="heroGlass" x1="199" y1="204" x2="339" y2="302" gradientUnits="userSpaceOnUse"><stop stopColor="#9DE3DF"/><stop offset="1" stopColor="#196A84"/></linearGradient>
          <filter id="heroShadow" x="18" y="62" width="490" height="369" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="18"/></filter>
          <filter id="heroGlow" x="168" y="0" width="185" height="190" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="15"/></filter>
        </defs>

        <ellipse cx="263" cy="363" rx="191" ry="42" fill="#001D3A" fillOpacity=".55" filter="url(#heroShadow)"/>
        <path d="M260 188 466 296 260 404 54 296 260 188Z" fill="#061D35" stroke="#86D8DF" strokeOpacity=".45" strokeWidth="2"/>
        <path d="M260 175 466 283V296L260 404V391L54 283V296L260 404" fill="#08263F"/>
        <path d="M260 175 466 283 260 391 54 283 260 175Z" fill="url(#heroPlot)" stroke="#A7E9E8" strokeOpacity=".7" strokeWidth="2"/>
        <path d="M75 283 260 380 445 283M129 245 315 342M202 207 388 305M387 245 201 343M315 207 129 305" stroke="#86D5DA" strokeOpacity=".16" strokeWidth="2"/>
        <path d="M96 282 260 368 424 282" stroke="#F5D18B" strokeOpacity=".72" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="260" cy="334" r="39" fill="#F4CC88" fillOpacity=".08" stroke="#EBC98E" strokeOpacity=".55" strokeWidth="2"/>
        <circle cx="260" cy="334" r="62" stroke="#EBC98E" strokeOpacity=".25" strokeWidth="2" strokeDasharray="7 9"/>

        {/* Solid faces and their window cutouts make the building read as a small 3D model. */}
        <path d="M129 174 263 244V357L129 287V174Z" fill="url(#heroLeftWall)" stroke="#EAF7F2" strokeWidth="2"/>
        <path d="M263 244 412 167V281L263 357V244Z" fill="url(#heroRightWall)" stroke="#D6F0EA" strokeWidth="2"/>
        <path d="M129 229 263 298 412 222" stroke="#8CB5B5" strokeOpacity=".7" strokeWidth="3"/>
        <path d="M160 212 196 230V267L160 249V212ZM209 237 245 256V293L209 274V237ZM160 269 196 288V320L160 301V269ZM209 295 245 314V346L209 326V295Z" fill="url(#heroGlass)" stroke="#F4E8C9" strokeWidth="3"/>
        <path d="M285 259 323 239V275L285 296V259ZM338 232 386 207V242L338 268V232ZM285 314 323 294V329L285 349V314ZM338 286 386 261V296L338 321V286Z" fill="url(#heroGlass)" stroke="#F4E8C9" strokeWidth="3"/>
        <path d="M178 222V257M227 247V282M304 250V286M361 220V255M178 278V311M227 305V337M304 304V339M361 274V308" stroke="#C8FAF0" strokeOpacity=".65" strokeWidth="2"/>
        <path d="M129 174 263 244 412 167 278 99 129 174Z" fill="url(#heroRoof)" stroke="#E1EEE9" strokeWidth="3"/>
        <path d="M153 173 278 111 390 168 263 233 153 173Z" fill="#34546E" stroke="#9CBCD0" strokeOpacity=".7" strokeWidth="2"/>
        <path d="M153 173 263 233 390 168" stroke="#B5D2D8" strokeOpacity=".5" strokeWidth="2"/>
        <path d="M129 174 263 244 412 167V177L263 255 129 185V174Z" fill="#173952" stroke="#C5DAD9" strokeWidth="2"/>
        <path d="M144 292 263 355 398 286" stroke="#F7D18F" strokeOpacity=".8" strokeWidth="3" strokeLinecap="round"/>

        <ellipse cx="263" cy="110" rx="39" ry="20" fill="#FBDCA1" fillOpacity=".45" filter="url(#heroGlow)"/>
        <circle cx="263" cy="87" r="32" fill="#F6D49A" fillOpacity=".12" stroke="#F8D9A7" strokeOpacity=".55" strokeWidth="2"/>
        <path d="M263 43c-19 0-34 15-34 34 0 25 34 54 34 54s34-29 34-54c0-19-15-34-34-34Z" fill="#F3C875" stroke="#FFF1CF" strokeWidth="3"/>
        <circle cx="263" cy="77" r="12" fill="#163F59"/>
      </svg>
    </div>
    <div className={`${styles.chip} ${styles.chipTop}`}><ShieldCheck size={19} strokeWidth={2.2}/><span className={styles.chipLines}><i/><i/></span></div>
    <div className={`${styles.chip} ${styles.chipBottom}`}><MapPin size={19} strokeWidth={2.2}/><span className={styles.chipLines}><i/><i/></span></div>
    <span className={`${styles.spark} ${styles.sparkOne}`} />
    <span className={`${styles.spark} ${styles.sparkTwo}`} />
    <span className={`${styles.spark} ${styles.sparkThree}`} />
  </div>;
}
