/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Home from './components/Home';
import Scan from './components/Scan';
import Tracker from './components/Tracker';
import Alerts from './components/Alerts';
import Settings from './components/Settings';
import Profile from './components/Profile';
import VoiceAssistant from './components/VoiceAssistant';
import { auth, db, onAuthStateChanged, signOut, User } from './lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { playAlertSound, AlertSoundType } from './lib/audioAlerts';
import { 
  Home as HomeIcon, 
  Scan as ScanIcon, 
  ListTodo, 
  Bell, 
  LogOut, 
  Loader2, 
  Settings as SettingsIcon,
  Volume2,
  VolumeX,
  AlertTriangle,
  Thermometer,
  Droplets,
  Zap,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  CircleUser as UserIcon,
  Mic as MicIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

type Tab = 'home' | 'scan' | 'tracker' | 'voice' | 'alerts' | 'profile' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2800);
    return () => clearTimeout(timer);
  }, []);

  // Global synchronized language
  const [lang, setLang] = useState<'hi' | 'en'>(() => {
    try {
      return (localStorage.getItem('flymind_language') as 'hi' | 'en') || 'hi';
    } catch { return 'hi'; }
  });

  // Synchronized alarms state in App.tsx
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('flymind_dismissed_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('flymind_acknowledged_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('flymind_alert_muted');
      return saved ? JSON.parse(saved) : false;
    } catch { return false; }
  });
  const [settingsVersion, setSettingsVersion] = useState(0);

  // 1. Listen for auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 1b. Listen to language sync triggers
  useEffect(() => {
    const handleLangSync = () => {
      try {
        const savedLang = localStorage.getItem('flymind_language') as 'hi' | 'en';
        if (savedLang) setLang(savedLang);
      } catch (e) {
        console.error("Language sync error", e);
      }
    };
    window.addEventListener('storage', handleLangSync);
    window.addEventListener('flymind_language_update', handleLangSync);
    return () => {
      window.removeEventListener('storage', handleLangSync);
      window.removeEventListener('flymind_language_update', handleLangSync);
    };
  }, []);

  const changeLanguage = (nextLang: 'hi' | 'en') => {
    setLang(nextLang);
    localStorage.setItem('flymind_language', nextLang);
    window.dispatchEvent(new Event('flymind_language_update'));
  };

  // 2. Synchronize muting and acknowledgements across screens in real-time
  useEffect(() => {
    const handleSync = () => {
      try {
        const savedMute = localStorage.getItem('flymind_alert_muted');
        setIsMuted(savedMute ? JSON.parse(savedMute) : false);
        
        const savedDismissed = localStorage.getItem('flymind_dismissed_alerts');
        setDismissedAlerts(savedDismissed ? JSON.parse(savedDismissed) : []);
        
        const savedAcked = localStorage.getItem('flymind_acknowledged_alerts');
        setAcknowledgedAlerts(savedAcked ? JSON.parse(savedAcked) : []);
        
        setSettingsVersion(v => v + 1);
      } catch (e) {
        console.error("Local sync error", e);
      }
    };
    
    window.addEventListener('storage', handleSync);
    window.addEventListener('flymind_settings_update', handleSync);
    window.addEventListener('flymind_alert_muted_update', handleSync);
    
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('flymind_settings_update', handleSync);
      window.removeEventListener('flymind_alert_muted_update', handleSync);
    };
  }, []);

  // 3. Real-time background Firestore observer to crosscheck thresholds even on different tabs
  useEffect(() => {
    if (!user) return;

    const path = `users/${user.uid}/farmlogs`;
    const q = query(
      collection(db, path),
      orderBy('date', 'desc'),
      limit(5) // evaluate up to the 5 latest telemetric logs in real time
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setActiveAlerts([]);
        return;
      }

      const highTempThr = Number(localStorage.getItem('flymind_high_temp_limit') || 33);
      const lowTempThr = Number(localStorage.getItem('flymind_low_temp_limit') || 22);
      const highHumThr = Number(localStorage.getItem('flymind_high_humidity_limit') || 85);
      const lowHumThr = Number(localStorage.getItem('flymind_low_humidity_limit') || 45);

      const generated: any[] = [];

      snapshot.docs.forEach((doc) => {
        const latest = doc.data();
        const logId = doc.id;
        const notesStr = (latest.notes || "").toLowerCase();
        const condStr = (latest.larvaeCondition || "").toLowerCase();
        const feedTypeStr = (latest.feedType || "").toLowerCase();

        // 1. High Temperature
        if (latest.temp > highTempThr) {
          generated.push({
            id: `temp-high-${logId}`,
            priority: 'red',
            soundType: 'high_temp',
            title: 'Facility Overheat Alarm / कड़ा तापमान चेतावनी 🚨',
            msg: `Critical temperature of ${latest.temp}°C detected, exceeding set limit bounds of ${highTempThr}°C. Substrates are warming rapidly!`,
            hiMsg: `चेतावनी: तापमान ${latest.temp}°C ने सुरक्षा सीमा ${highTempThr}°C को पार कर लिया है। ट्रे गर्म हो रही हैं!`,
            type: 'critical',
            icon: Thermometer,
            color: 'text-red-500',
            bg: 'bg-red-500/10',
            time: 'Live'
          });
        }

        // 2. Low Temperature
        if (latest.temp < lowTempThr) {
          generated.push({
            id: `temp-low-${logId}`,
            priority: 'yellow',
            soundType: 'low_temp',
            title: 'Incubator Chill Wave / ठंड होने की चेतावनी ❄️',
            msg: `Chilling temp of ${latest.temp}°C registered, dropping below limit bounds (${lowTempThr}°C). Larvae growth will stall.`,
            hiMsg: `चेतावनी: तापमान ${latest.temp}°C दर्ज किया गया है। विकास चक्र धीमा हो जाएगा!`,
            type: 'warning',
            icon: Thermometer,
            color: 'text-orange-500',
            bg: 'bg-orange-500/10',
            time: 'Live'
          });
        }

        // 3. High Humidity
        if (latest.humidity > highHumThr) {
          generated.push({
            id: `hum-high-${logId}`,
            priority: 'yellow',
            soundType: 'high_humidity',
            title: 'Bedding Over-Moisture / अधिक नमी ⚠️',
            msg: `Substrate relative moisture has climbed to ${latest.humidity}%, exceeding maximum safe limits of ${highHumThr}%. Humidity too high. Fungus risk increasing.`,
            hiMsg: `चेतावनी: नमी का स्तर ${latest.humidity}% है, जो सीमा ${highHumThr}% से अधिक है। फंगस लग सकती है!`,
            type: 'warning',
            icon: Droplets,
            color: 'text-orange-500',
            bg: 'bg-orange-500/10',
            time: 'Live'
          });
        }

        // 4. Low Humidity
        if (latest.humidity < lowHumThr) {
          generated.push({
            id: `hum-low-${logId}`,
            priority: 'red',
            soundType: 'critical_health',
            title: 'Extreme Dehydration Warning / सूखापन संकट 🏜️',
            msg: `Substrate moisture has plunged to ${latest.humidity}%, dropping below set boundary limits of ${lowHumThr}%.`,
            hiMsg: `गंभीर चेतावनी: ट्रे की नमी ${latest.humidity}% तक गिर गई है, जो न्यूनतम सुरक्षा सीमा से कम है!`,
            type: 'critical',
            icon: Droplets,
            color: 'text-red-500',
            bg: 'bg-red-500/10',
            time: 'Live'
          });
        }

        // 5. Fungus Detection
        if (notesStr.includes("fungus") || condStr.includes("fungus") || feedTypeStr.includes("fungus")) {
          generated.push({
            id: `hazard-fungus-${logId}`,
            priority: 'red',
            soundType: 'fungus_risk',
            title: 'Fungus Spore Infection / कवक संदूषण 🍄',
            msg: 'Humidity too high. Fungus risk increasing.',
            hiMsg: 'नमी बहुत अधिक है। कवक (फंगस) का कवकजाल तेजी से बढ़ रहा है। ट्रे बदलें!',
            type: 'critical',
            icon: AlertTriangle,
            color: 'text-red-500',
            bg: 'bg-red-500/10',
            time: 'Live'
          });
        }

        // 6. Mold Risk
        if (notesStr.includes("mold") || notesStr.includes("mould") || notesStr.includes("mildew") || condStr.includes("mold") || condStr.includes("mould")) {
          generated.push({
            id: `hazard-mold-${logId}`,
            priority: 'yellow',
            soundType: 'fungus_risk',
            title: 'Active Mold Bloom Risk / फूई (फपूँदी) का खतरा ⚠️',
            msg: 'Sour anaerobic mold risk detected. Please aerate the bed and break substrate crusts.',
            hiMsg: 'अम्लीय फंगस परत का जोखिम: कृपया ट्रे को हिलाएं और ताजी हवा दें!',
            type: 'warning',
            icon: AlertTriangle,
            color: 'text-orange-500',
            bg: 'bg-orange-500/10',
            time: 'Live'
          });
        }

        // 7. Overcrowding
        if (condStr.includes("crowd") || condStr.includes("overcrowd") || notesStr.includes("crowd") || notesStr.includes("overcrowd")) {
          generated.push({
            id: `hazard-crowd-${logId}`,
            priority: 'yellow',
            soundType: 'critical_health',
            title: 'Larvae Overcrowding Detected / अत्यधिक घनी आबादी ⚠️',
            msg: 'Larvae overcrowding detected. Reduce tray density.',
            hiMsg: 'चेतावनी: कीड़ों की बहुत घनी आबादी है। कीड़ों को दूसरी ट्रे में विभाजित करें!',
            type: 'warning',
            icon: ShieldAlert,
            color: 'text-yellow-500',
            bg: 'bg-yellow-500/10',
            time: 'Live'
          });
        }

        // 8. Sluggish Larvae
        if (condStr.includes("sluggish") || notesStr.includes("sluggish")) {
          generated.push({
            id: `hazard-sluggish-${logId}`,
            priority: 'yellow',
            soundType: 'low_temp',
            title: 'Sluggish Larval Activity / सुस्त गतिविधि 🐛',
            msg: 'Larvae movement low. Check oxygen and moisture.',
            hiMsg: 'चेतावनी: सुस्त कीड़े पाए गए। वेंटिलेशन और नमी की जाँच करें!',
            type: 'warning',
            icon: AlertCircle,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            time: 'Live'
          });
        }

        // 9. Prepupa Migration Stage (Green = Safe)
        if (condStr.includes("prepupa") || condStr.includes("pupa") || condStr.includes("harvest") || notesStr.includes("prepupa") || notesStr.includes("pupa") || notesStr.includes("harvest")) {
          generated.push({
            id: `stage-prepupa-${logId}`,
            priority: 'green',
            soundType: 'high_humidity',
            title: 'Prepupa Migration Stage / प्री-प्यूपा विकास चरण 🌱',
            msg: 'Prepupa migration stage detected.',
            hiMsg: 'प्री-प्यूपा प्रवास अवस्था का पता चला है। इन्हें शुष्क क्रॉल-आउट ट्रे में स्थानांतरित करें।',
            type: 'success',
            icon: Zap,
            color: 'text-neon-green',
            bg: 'bg-neon-green/10',
            time: 'Optimal'
          });
        }

        // 10. Feed Rotten Detection
        if (notesStr.includes("rotten") || notesStr.includes("rot") || notesStr.includes("decay") || notesStr.includes("sour") || feedTypeStr.includes("rot")) {
          generated.push({
            id: `hazard-rot-${logId}`,
            priority: 'red',
            soundType: 'critical_health',
            title: 'Soured Feed Warning / सड़ा हुआ भोजन संकट 🤢',
            msg: 'Feed appears rotten. Replace immediately.',
            hiMsg: 'चारा सड़ चुका है! बैक्टीरिया कवक से कीड़ों की रक्षा हेतु तुरंत चारा हटाएँ!',
            type: 'critical',
            icon: AlertTriangle,
            color: 'text-red-500',
            bg: 'bg-red-500/10',
            time: 'Live'
          });
        }

        // 11. Dead Larvae Detection
        if (notesStr.includes("dead") || notesStr.includes("death") || condStr.includes("dead") || condStr.includes("dormant") && (latest.temp < lowTempThr || notesStr.includes("mortality"))) {
          generated.push({
            id: `hazard-dead-${logId}`,
            priority: 'red',
            soundType: 'critical_health',
            title: 'Larvae Mortality Alarm / मृत संक्रमण संकट 🚨',
            msg: 'Critical - Mass decomposition or dead larvae detected. Sanitize breeding rows.',
            hiMsg: 'गंभीर शिकायत: मृत कीड़ों का पता चला है। संक्रमण फ़ैल सकता है, साफ-सफाई करें!',
            type: 'critical',
            icon: ShieldAlert,
            color: 'text-red-500',
            bg: 'bg-red-500/10',
            time: 'Live'
          });
        }

        // 12. Low Activity Warning
        if (condStr.includes("dormant") || notesStr.includes("low activity") || notesStr.includes("dormant") || notesStr.includes("inactive")) {
          generated.push({
            id: `status-low-activity-${logId}`,
            priority: 'yellow',
            soundType: 'low_temp',
            title: 'Low Activity Warning / निम्न कीड़ा सक्रियता 💤',
            msg: 'Larvae movement low. Check moisture and tray parameters.',
            hiMsg: 'कीड़ों की सक्रियता सामान्य से काफी कम है! आर्द्रता और ऑक्सीजन को बढ़ाएँ।',
            type: 'warning',
            icon: AlertCircle,
            color: 'text-orange-500',
            bg: 'bg-orange-500/10',
            time: 'Live'
          });
        }
      });

      setActiveAlerts(generated);
    });

    return () => unsubscribe();
  }, [user, settingsVersion]);

  // Filter out dismissed and acknowledged ones
  const visibleAlerts = activeAlerts.filter(
    (alert) => !dismissedAlerts.includes(alert.id) && !acknowledgedAlerts.includes(alert.id)
  );

  // 4. Handle auto play alert sound and repeat loop every 10 seconds on critical (red) alarms
  useEffect(() => {
    if (visibleAlerts.length === 0) return;

    const criticalAlerts = visibleAlerts.filter(a => a.priority === 'red');
    const warningAlerts = visibleAlerts.filter(a => a.priority === 'yellow');

    const triggerTone = () => {
      if (criticalAlerts.length > 0) {
        playAlertSound(criticalAlerts[0].soundType);
      } else if (warningAlerts.length > 0) {
        playAlertSound(warningAlerts[0].soundType);
      }
    };

    // Play tone immediately on change
    triggerTone();

    // Critical alarms repeat tone every 10 seconds until user registers action
    let alarmTimer: any = null;
    if (criticalAlerts.length > 0) {
      alarmTimer = setInterval(() => {
        triggerTone();
      }, 10000);
    }

    return () => {
      if (alarmTimer) {
        clearInterval(alarmTimer);
      }
    };
  }, [visibleAlerts.length, settingsVersion]);

  // Acknowledge locally and write to storage
  const handleAcknowledgeAlert = (alertId: string, alertTitle: string, alertMsg: string) => {
    const updated = [...acknowledgedAlerts, alertId];
    setAcknowledgedAlerts(updated);
    localStorage.setItem('flymind_acknowledged_alerts', JSON.stringify(updated));

    try {
      const saved = localStorage.getItem('flymind_alerts_history');
      const history = saved ? JSON.parse(saved) : [];
      const newEntry = {
        title: alertTitle,
        msg: alertMsg,
        actionType: 'acknowledged',
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) + ' ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
      localStorage.setItem('flymind_alerts_history', JSON.stringify([newEntry, ...history]));
    } catch (e) {
      console.error(e);
    }

    window.dispatchEvent(new Event('flymind_settings_update'));
  };

  const handleDismissAlert = (alertId: string, alertTitle: string, alertMsg: string) => {
    const updated = [...dismissedAlerts, alertId];
    setDismissedAlerts(updated);
    localStorage.setItem('flymind_dismissed_alerts', JSON.stringify(updated));

    try {
      const saved = localStorage.getItem('flymind_alerts_history');
      const history = saved ? JSON.parse(saved) : [];
      const newEntry = {
        title: alertTitle,
        msg: alertMsg,
        actionType: 'dismissed',
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) + ' ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
      localStorage.setItem('flymind_alerts_history', JSON.stringify([newEntry, ...history]));
    } catch (e) {
      console.error(e);
    }

    window.dispatchEvent(new Event('flymind_settings_update'));
  };

  const toggleLocalMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    localStorage.setItem('flymind_alert_muted', JSON.stringify(nextMuted));
    window.dispatchEvent(new Event('flymind_settings_update'));
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out failed", error);
    }
  };

  const tabs = [
    { id: 'home', icon: HomeIcon, label: 'Home' },
    { id: 'scan', icon: ScanIcon, label: 'Scan' },
    { id: 'tracker', icon: ListTodo, label: 'Tracker' },
    { id: 'voice', icon: MicIcon, label: 'Voice' },
    { id: 'alerts', icon: Bell, label: 'Alerts' },
    { id: 'profile', icon: UserIcon, label: 'Profile' },
    { id: 'settings', icon: SettingsIcon, label: 'Settings' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return <Home onNavigate={(t) => setActiveTab(t as Tab)} />;
      case 'scan': return <Scan onNavigate={(t) => setActiveTab(t as Tab)} />;
      case 'tracker': return <Tracker />;
      case 'voice': return <VoiceAssistant onNavigate={(t) => setActiveTab(t as Tab)} lang={lang} visibleAlerts={visibleAlerts} />;
      case 'alerts': return <Alerts onNavigate={(t) => setActiveTab(t as Tab)} />;
      case 'profile': return <Profile onNavigate={(t) => setActiveTab(t as Tab)} />;
      case 'settings': return <Settings onNavigate={(t) => setActiveTab(t as Tab)} />;
      default: return <Home onNavigate={(t) => setActiveTab(t as Tab)} />;
    }
  };

  if (showSplash || loading) {
    return (
      <div className="flex h-screen max-w-md mx-auto items-center justify-center bg-[#030303] text-white relative border-x border-white/5 font-sans select-none overflow-hidden">
        {/* Abstract futuristic grid or background circuit glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(57,255,20,0.06),transparent_60%)] pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-neon-cyan/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-neon-green/3 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="flex flex-col items-center gap-7 relative z-10 text-center px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: -15 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="w-24 h-24 relative"
          >
            {/* Hexagon glass structure */}
            <div className="absolute inset-0 bg-gradient-to-tr from-neon-green/20 via-neon-cyan/20 to-transparent border border-white/10 rounded-[2rem] [clip-path:polygon(50%_0%,_100%_25%,_100%_75%,_50%_100%,_0%_75%,_0%_25%)] flex items-center justify-center shadow-[0_0_50px_rgba(57,255,20,0.15)] relative">
              {/* Spinning or glowing ring inside hexagon */}
              <div className="absolute inset-1 border border-neon-cyan/30 rounded-[1.8rem] [clip-path:polygon(50%_0%,_100%_25%,_100%_75%,_50%_100%,_0%_75%,_0%_25%)] animate-pulse" />
              
              {/* High-Fi Minimalist Black Soldier Fly Symbol */}
              <svg className="w-12 h-12 text-neon-green filter drop-shadow-[0_0_8px_#39FF14]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                {/* Body core */}
                <path d="M12 4v16" strokeLinecap="round" />
                <rect x="10.5" y="7" width="3" height="10" rx="1.5" fill="currentColor" opacity="0.3" />
                {/* Head */}
                <circle cx="12" cy="5" r="2" fill="currentColor" />
                {/* Insect antennas */}
                <path d="M10 2.5a2 2 0 0 0 2 1.5M14 2.5a2 2 0 0 1-2 1.5" strokeLinecap="round" />
                {/* Left Wings */}
                <path d="M11 9 C 7 8, 4 9, 3 11 C 2 13, 5 15, 11 11" fill="currentColor" fillOpacity="0.1" strokeLinecap="round" />
                <path d="M11 11 C 6 11, 4 13, 4 15 C 4 17, 7 17, 11 13" fill="currentColor" fillOpacity="0.05" strokeLinecap="round" />
                {/* Right Wings */}
                <path d="M13 9 C 17 8, 20 9, 21 11 C 22 13, 19 15, 13 11" fill="currentColor" fillOpacity="0.1" strokeLinecap="round" />
                <path d="M13 11 C 18 11, 20 13, 20 15 C 20 17, 17 17, 13 13" fill="currentColor" fillOpacity="0.05" strokeLinecap="round" />
                {/* Advanced circuit dot overlays */}
                <circle cx="12" cy="12" r="1" fill="#00E5FF" />
                <circle cx="7" cy="11" r="0.7" fill="#39FF14" />
                <circle cx="17" cy="11" r="0.7" fill="#39FF14" />
              </svg>
            </div>
            
            {/* Glowing outer shadow ring */}
            <div className="absolute inset-0 bg-neon-green/10 blur-xl rounded-full scale-75 -z-10 animate-pulse" />
          </motion.div>

          <div className="space-y-2">
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-4xl font-black tracking-tight font-display text-white"
            >
              FlyMind <span className="text-neon-green">AI</span>
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 0.7, duration: 0.8 }}
              className="text-[10px] font-mono uppercase tracking-[0.25em] text-neon-cyan"
            >
              Smart BSF Farming Intelligence
            </motion.p>
          </div>

          {/* Futuristic subtle linear loading indicator */}
          <div className="w-40 h-[2px] bg-white/5 rounded-full overflow-hidden mt-6 relative">
            <motion.div
              initial={{ left: '-100%' }}
              animate={{ left: '100%' }}
              transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
              className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-neon-green to-transparent"
            />
          </div>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="text-[8px] font-mono text-white mt-16"
          >
            SECURE DECRYPT PROTOCOLS ENABLED &bull; VER 3.5
          </motion.p>
        </div>
      </div>
    );
  }



  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-dark-bg text-white overflow-hidden relative border-x border-white/5">
      
      {/* Floating HUD real-time bilingual alert toast notification */}
      <AnimatePresence>
        {visibleAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.94 }}
            transition={{ type: 'spring', damping: 20, stiffness: 280 }}
            className="absolute top-16 left-3.5 right-3.5 z-50 p-4.5 rounded-2xl bg-[#09090b]/95 border backdrop-blur-xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] space-y-3 font-sans overflow-hidden"
            style={{
              borderColor: visibleAlerts[0].priority === 'red' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)',
              boxShadow: visibleAlerts[0].priority === 'red' 
                ? '0 0 30px rgba(239, 68, 68, 0.15), 0 25px 50px rgba(0,0,0,0.9)' 
                : '0 0 30px rgba(245, 158, 11, 0.15), 0 25px 50px rgba(0,0,0,0.9)'
            }}
          >
            {/* Top tiny bar with indicator pulse & mute toggler */}
            <div className="flex items-center justify-between gap-2.5 pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full animate-ping shrink-0",
                  visibleAlerts[0].priority === 'red' ? "bg-red-500" : "bg-amber-500"
                )} />
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-widest font-mono",
                  visibleAlerts[0].priority === 'red' ? "text-red-500" : "text-amber-500"
                )}>
                  {visibleAlerts[0].priority === 'red' ? "🔴 CRITICAL BSF HAZARD" : "🟡 CAUTION METRICS"}
                </span>
              </div>

              {/* Quick Mute on the Toast popup directly */}
              <button 
                onClick={toggleLocalMute}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer pointer-events-auto"
                title={isMuted ? "Unmute alarm sounds" : "Mute alarm sounds"}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400 animate-pulse" /> : <Volume2 className="w-3.5 h-3.5 text-neon-green" />}
              </button>
            </div>

            {/* Warning Message section */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-black uppercase text-white tracking-wide leading-tight">
                {visibleAlerts[0].title}
              </h4>
              <div className="space-y-1">
                <p className="text-[11px] text-white/75 leading-relaxed font-sans">
                  {visibleAlerts[0].msg}
                </p>
                <p className="text-[11px] text-neon-green/85 leading-relaxed font-bold font-sans">
                  {visibleAlerts[0].hiMsg}
                </p>
              </div>
            </div>

            {/* Bilingual Action Triggers */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <button
                onClick={() => handleDismissAlert(visibleAlerts[0].id, visibleAlerts[0].title, visibleAlerts[0].msg)}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all text-[9px] font-bold uppercase tracking-wider cursor-pointer pointer-events-auto"
              >
                Dismiss / हटाएँ
              </button>
              <button
                onClick={() => handleAcknowledgeAlert(visibleAlerts[0].id, visibleAlerts[0].title, visibleAlerts[0].msg)}
                className={cn(
                  "px-4 py-1.5 rounded-xl text-black font-extrabold text-[9px] uppercase tracking-wider transition-all cursor-pointer pointer-events-auto hover:scale-105 active:scale-95",
                  visibleAlerts[0].priority === 'red' ? "bg-red-500 hover:bg-red-600 shadow-[0_0_15px_rgba(239, 68, 68, 0.4)]" : "bg-amber-500 hover:bg-amber-600 shadow-[0_0_15px_rgba(245, 158, 11, 0.4)]"
                )}
              >
                Acknowledge / समझ गया ✓
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <header className="px-4 py-3 flex items-center justify-between bg-black/60 backdrop-blur-xl border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.3)] z-15 shrink-0 relative transition-all">
        <div className="flex items-center gap-3">
          {/* Glowing Circular SaaS AI Emblem */}
          <div className="w-10 h-10 rounded-full bg-black/80 border border-neon-green/30 flex items-center justify-center shadow-[0_0_15px_rgba(57,255,20,0.15)] relative group overflow-hidden transition-all duration-300 hover:border-neon-green/60 hover:shadow-[0_0_20px_rgba(57,255,20,0.3)]">
            {/* Backdrop Glow Accent */}
            <div className="absolute inset-0 bg-gradient-to-tr from-neon-green/10 to-neon-cyan/5 opacity-50 group-hover:opacity-80 transition-opacity" />
            
            <svg 
              viewBox="0 0 100 100" 
              className="w-8 h-8 select-none relative z-10 animate-pulse duration-[3000ms]"
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="wing-grad-left" x1="50%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#39FF14" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.2" />
                </linearGradient>
                <linearGradient id="wing-grad-right" x1="50%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#39FF14" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.2" />
                </linearGradient>
                <linearGradient id="body-grad" x1="50%" y1="0%" x2="50%" y2="100%">
                  <stop offset="0%" stopColor="#00E5FF" />
                  <stop offset="100%" stopColor="#39FF14" />
                </linearGradient>
                <filter id="glow-heavy" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* HUD telemetric telemetry ring */}
              <circle cx="50" cy="50" r="45" stroke="#39FF14" strokeWidth="1" strokeDasharray="3 4" strokeOpacity="0.25" />
              <circle cx="50" cy="50" r="41" stroke="#00E5FF" strokeWidth="0.5" strokeOpacity="0.15" />
              
              {/* Antennae */}
              <path d="M50 35 Q44 24 38 22" stroke="#00E5FF" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.75" filter="url(#glow-heavy)" />
              <path d="M50 35 Q56 24 62 22" stroke="#00E5FF" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.75" filter="url(#glow-heavy)" />

              {/* Symmetrical sharp technical wing structures representing AI / BSF wings */}
              <path d="M50,40 L18,28 C16,27 20,44 32,52 L50,56 Z" fill="url(#wing-grad-left)" stroke="#39FF14" strokeWidth="1" strokeOpacity="0.5" />
              <path d="M50,40 L82,28 C84,27 80,44 68,52 L50,56 Z" fill="url(#wing-grad-right)" stroke="#39FF14" strokeWidth="1" strokeOpacity="0.5" />
              
              {/* Lower dynamic secondary wing structures */}
              <path d="M50,56 L24,54 C23,55 30,68 40,68 L50,60 Z" fill="url(#wing-grad-left)" fillOpacity="0.4" stroke="#00E5FF" strokeWidth="0.75" strokeOpacity="0.3" />
              <path d="M50,56 L76,54 C77,55 70,68 60,68 L50,60 Z" fill="url(#wing-grad-right)" fillOpacity="0.4" stroke="#00E5FF" strokeWidth="0.75" strokeOpacity="0.3" />

              {/* Stylized Head */}
              <circle cx="50" cy="33" r="3.5" fill="#00E5FF" filter="url(#glow-heavy)" />

              {/* Central high-tech segmented body representing precision automated rearing */}
              <path d="M46,44 L54,44 L53,48 L47,48 Z" fill="url(#body-grad)" filter="url(#glow-heavy)" />
              <path d="M45,51 L55,51 L54,56 L46,56 Z" fill="url(#body-grad)" />
              <path d="M44,59 L56,59 L55,65 L45,65 Z" fill="url(#body-grad)" />
              <path d="M45,68 L55,68 L53,74 L47,74 Z" fill="#39FF14" />
              <path d="M48,77 L52,77 L50,83 Z" fill="#39FF14" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wider uppercase font-display text-white leading-none">
              FlyMind <span className="text-neon-cyan select-none">AI</span>
            </h1>
            <span className="text-[8px] font-mono font-bold tracking-widest text-[#00E5FF] uppercase block mt-1">
              BSF Intelligence System
            </span>
          </div>
        </div>

        {/* Global Language Toggle & Controls */}
        <div className="flex items-center gap-2.5">
          {/* Tactile language pill */}
          <div className="flex items-center gap-0.5 bg-black/57 p-1 rounded-xl border border-white/5 shadow-inner">
            <button
              onClick={() => changeLanguage('hi')}
              type="button"
              className={cn(
                "px-2.5 py-1 text-[9px] uppercase font-black rounded-lg cursor-pointer transition-all",
                lang === 'hi' 
                  ? "bg-neon-green text-black font-black shadow-[0_0_8px_rgba(57,255,20,0.3)]" 
                  : "text-white/40 hover:text-white"
              )}
            >
              हिन्दी
            </button>
            <button
              onClick={() => changeLanguage('en')}
              type="button"
              className={cn(
                "px-2.5 py-1 text-[9px] uppercase font-black rounded-lg cursor-pointer transition-all",
                lang === 'en' 
                  ? "bg-neon-green text-black font-black shadow-[0_0_8px_rgba(57,255,20,0.3)]" 
                  : "text-white/40 hover:text-white"
              )}
            >
              EN
            </button>
          </div>

          <button 
            onClick={handleSignOut}
            className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 hover:bg-white/10 hover:border-white/15 transition-all cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5 text-white/40 hover:text-white transition-colors" />
          </button>
          
          <div 
            onClick={() => setActiveTab('alerts')}
            className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 cursor-pointer hover:bg-white/10 hover:border-white/15 transition-all relative"
            title="Alerts System"
          >
            <Bell className="w-4 h-4 text-white/60 hover:text-white transition-colors" />
            {visibleAlerts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-black animate-ping" />
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-4"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="glass border-t border-white/10 px-1 py-2.5 z-20 flex justify-around items-center shrink-0 w-full gap-1 relative bg-black/90">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={cn(
                "flex flex-col items-center justify-center transition-all duration-300 relative px-1 py-1 rounded-xl cursor-pointer flex-1 select-none pointer-events-auto hover:bg-white/5",
                isActive ? "text-neon-green" : "text-white/40"
              )}
            >
              <Icon className={cn("w-4.5 h-4.5", isActive && "drop-shadow-[0_0_8px_rgba(57,255,20,0.8)]")} />
              <span className="text-[8px] sm:text-[9px] mt-1 font-bold font-sans uppercase tracking-[#0.02em]">{tab.label}</span>
              {isActive && (
                <motion.div
                   layoutId="activeTab"
                   className="absolute -bottom-1 w-1 h-1 rounded-full bg-neon-green shadow-green shadow-[0_0_10px_#39FF14]"
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
