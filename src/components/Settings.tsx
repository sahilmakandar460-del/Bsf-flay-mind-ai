import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Thermometer, 
  Droplets, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  AlertTriangle, 
  TrendingUp, 
  Sparkles, 
  FolderSync, 
  Info,
  Sliders,
  Flame,
  Undo2,
  BellRing,
  Volume2,
  VolumeX,
  Play,
  Share2, 
  Copy, 
  UserX, 
  LogOut, 
  ShieldCheck, 
  FileText, 
  Languages, 
  UserCheck, 
  Send,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { playAlertSound, AlertSoundType } from '../lib/audioAlerts';
import { auth, db } from '../lib/firebase';
import { signOut, deleteUser } from 'firebase/auth';
import { doc, deleteDoc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

// Helper to load settings from localStorage with robust defaults
const getLocalItem = (key: string, defaultValue: any) => {
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return defaultValue;
    }
  }
  return defaultValue;
};

interface FeedType {
  name: string;
  defaultQty: number;
}

export default function SettingsComponent() {
  // Sound alarm preferences
  const [isMuted, setIsMuted] = useState<boolean>(() => getLocalItem('flymind_alert_muted', false));

  // 1. Temperature thresholds state
  const [highTemp, setHighTemp] = useState<number>(() => getLocalItem('flymind_high_temp_limit', 33));
  const [lowTemp, setLowTemp] = useState<number>(() => getLocalItem('flymind_low_temp_limit', 22));

  // 2. Humidity thresholds state
  const [highHumidity, setHighHumidity] = useState<number>(() => getLocalItem('flymind_high_humidity_limit', 85));
  const [lowHumidity, setLowHumidity] = useState<number>(() => getLocalItem('flymind_low_humidity_limit', 45));

  // 3. Larvae conditions state
  const [conditions, setConditions] = useState<string[]>(() => 
    getLocalItem('flymind_larvae_conditions', ['Active', 'Sluggish', 'Overcrowded', 'Dormant', 'Harvest Ready'])
  );
  const [newCondition, setNewCondition] = useState('');
  const [editingConditionIdx, setEditingConditionIdx] = useState<number | null>(null);
  const [editingConditionVal, setEditingConditionVal] = useState('');

  // 4. Feed Types state
  const [feedTypes, setFeedTypes] = useState<FeedType[]>(() => 
    getLocalItem('flymind_feed_types', [
      { name: 'Organic Waste', defaultQty: 5 },
      { name: 'Grain Mix', defaultQty: 3 },
      { name: 'Fruit Scraps', defaultQty: 4 },
      { name: 'Experiment A', defaultQty: 10 }
    ])
  );
  const [newFeedName, setNewFeedName] = useState('');
  const [newFeedQty, setNewFeedQty] = useState<number>(5);
  const [editingFeedIdx, setEditingFeedIdx] = useState<number | null>(null);
  const [editingFeedName, setEditingFeedName] = useState('');
  const [editingFeedQty, setEditingFeedQty] = useState<number>(5);

  // Cloud backup state
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 5. Alert History
  const [alertHistory, setAlertHistory] = useState<any[]>(() => getLocalItem('flymind_alerts_history', []));

  // 6. Multi-lingual configurations
  const [lang, setLang] = useState<'hi' | 'en'>(() => {
    try {
      return (localStorage.getItem('flymind_language') as 'hi' | 'en') || 'hi';
    } catch { return 'hi'; }
  });

  // Modal displays
  const [activeModal, setActiveModal] = useState<'invite' | 'privacy' | 'terms' | 'delete' | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Sync language triggers
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

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Sign out failed", e);
    }
  };

  const handleDeleteAccount = async () => {
    const user = auth.currentUser;
    if (!user) return;
    
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError("Please type 'DELETE' to confirm account termination.");
      return;
    }

    setIsDeletingAccount(true);
    setDeleteError(null);

    try {
      // 1. Delete Firestore node
      const userRef = doc(db, 'users', user.uid);
      await deleteDoc(userRef).catch(() => {});
      
      // 2. Erase local profile cache
      localStorage.removeItem('flymind_farmer_profile');
      
      // 3. Delete Firebase User session
      await deleteUser(user);
      setActiveModal(null);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setDeleteError("For security, you must re-login before deleting your account data.");
      } else {
        setDeleteError(err.message || "Failed to proceed with account cleanup.");
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const triggerWhatsAppInvite = () => {
    const text = `FlyMind AI: Hello, join our modern BSF farming setup! Track larvae growth, automate climatic hazard alarms, and consult instant Gemini Bio-models. Download at: https://flymindagri-setup.app/invite?ref=FLYMINDBIO`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const copyRefCode = () => {
    navigator.clipboard.writeText('FLYMINDBIO');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText('https://flymindagri-setup.app/invite?ref=FLYMINDBIO');
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Translations Map
  const trans = {
    en: {
      title: "General Accounts & Bio-Security Support",
      inviteCard: "Partner Outreach & Referrals",
      inviteDesc: "Enlist neighboring farmers to connect their localized microclimate clusters.",
      refLabel: "Referral Authentication Code",
      copyCode: "Copy Code",
      copyLink: "Copy App Link",
      cop: "Copied!",
      whatsappBtn: "Invite via WhatsApp",
      privacyTitle: "Privacy & Bio-Data Policy",
      privacyBtn: "Review privacy disclosure",
      termsTitle: "BSF Platform Terms & Conditions",
      termsBtn: "Review terms of use",
      deleteBtn: "Terminate Operator bio-node",
      deleteSubtitle: "Erase all biometric databases, larvae logs, and account clusters permanently.",
      confirmDelete: "Type 'DELETE' to authorize database termination",
    },
    hi: {
      title: "सामान्य खाता और जैव-सुरक्षा सहायता",
      inviteCard: "सहयोगी संपर्क और रेफरल",
      inviteDesc: "अपने पड़ोसी किसानों को उनके स्थानीयकृत माइक्रोकलाइमेट क्लस्टर से जुड़ने के लिए आमंत्रित करें।",
      refLabel: "रेफरल प्रमाणीकरण कोड",
      copyCode: "कोड कॉपी करें",
      copyLink: "ऐप लिंक कॉपी करें",
      cop: "कॉपी किया गया!",
      whatsappBtn: "व्हाट्सएप द्वारा आमंत्रण",
      privacyTitle: "निजता और बायो-डेटा नीति",
      privacyBtn: "गोपनीयता नीति की समीक्षा करें",
      termsTitle: "बीएसएफ प्लेटफॉर्म नियम और शर्तें",
      termsBtn: "उपयोग की शर्तों की समीक्षा करें",
      deleteBtn: "ऑपरेटर बायो-नोड को समाप्त करें",
      deleteSubtitle: "सभी बायोमेट्रिक डेटाबेस, कीड़ा लॉग और खाता क्लस्टर स्थायी रूप से हटाएं।",
      confirmDelete: "डेटाबेस समाप्ति को प्रमाणित करने के लिए 'DELETE' टाइप करें",
    }
  }[lang === 'hi' ? 'hi' : 'en'];

  // Save changes to localStorage automatically
  useEffect(() => {
    localStorage.setItem('flymind_high_temp_limit', JSON.stringify(highTemp));
    localStorage.setItem('flymind_low_temp_limit', JSON.stringify(lowTemp));
    window.dispatchEvent(new Event('flymind_settings_update'));
  }, [highTemp, lowTemp]);

  useEffect(() => {
    localStorage.setItem('flymind_high_humidity_limit', JSON.stringify(highHumidity));
    localStorage.setItem('flymind_low_humidity_limit', JSON.stringify(lowHumidity));
    window.dispatchEvent(new Event('flymind_settings_update'));
  }, [highHumidity, lowHumidity]);

  useEffect(() => {
    localStorage.setItem('flymind_larvae_conditions', JSON.stringify(conditions));
    window.dispatchEvent(new Event('flymind_settings_update'));
  }, [conditions]);

  useEffect(() => {
    localStorage.setItem('flymind_feed_types', JSON.stringify(feedTypes));
    window.dispatchEvent(new Event('flymind_settings_update'));
  }, [feedTypes]);

  useEffect(() => {
    localStorage.setItem('flymind_alert_muted', JSON.stringify(isMuted));
    window.dispatchEvent(new Event('flymind_settings_update'));
    window.dispatchEvent(new Event('flymind_alert_muted_update'));
  }, [isMuted]);

  // Handle Condition Actions
  const handleAddCondition = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCondition.trim();
    if (!trimmed) return;
    if (conditions.includes(trimmed)) return;
    setConditions([...conditions, trimmed]);
    setNewCondition('');
  };

  const handleDeleteCondition = (val: string) => {
    setConditions(conditions.filter(c => c !== val));
  };

  const startEditCondition = (idx: number, val: string) => {
    setEditingConditionIdx(idx);
    setEditingConditionVal(val);
  };

  const handleSaveConditionEdit = (idx: number) => {
    const trimmed = editingConditionVal.trim();
    if (!trimmed) return;
    const updated = [...conditions];
    updated[idx] = trimmed;
    setConditions(updated);
    setEditingConditionIdx(null);
  };

  // Handle Feed Type Actions
  const handleAddFeedType = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFeedName.trim();
    if (!trimmed) return;
    if (feedTypes.some(f => f.name.toLowerCase() === trimmed.toLowerCase())) return;
    setFeedTypes([...feedTypes, { name: trimmed, defaultQty: Number(newFeedQty) }]);
    setNewFeedName('');
    setNewFeedQty(5);
  };

  const handleDeleteFeedType = (name: string) => {
    setFeedTypes(feedTypes.filter(f => f.name !== name));
  };

  const startEditFeedType = (idx: number, feed: FeedType) => {
    setEditingFeedIdx(idx);
    setEditingFeedName(feed.name);
    setEditingFeedQty(feed.defaultQty);
  };

  const handleSaveFeedTypeEdit = (idx: number) => {
    const trimmed = editingFeedName.trim();
    if (!trimmed) return;
    const updated = [...feedTypes];
    updated[idx] = { name: trimmed, defaultQty: Number(editingFeedQty) };
    setFeedTypes(updated);
    setEditingFeedIdx(null);
  };

  // Clear Alert history log
  const clearHistoryLog = () => {
    localStorage.setItem('flymind_alerts_history', JSON.stringify([]));
    setAlertHistory([]);
  };

  // Load settings from Firestore on mount
  useEffect(() => {
    const fetchCloudSettings = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      try {
        const settingsRef = doc(db, `users/${currentUser.uid}/settings`, 'current');
        const snap = await getDoc(settingsRef);
        if (snap.exists()) {
          const dat = snap.data();
          if (dat.highTempLimit !== undefined) {
            setHighTemp(dat.highTempLimit);
            localStorage.setItem('flymind_high_temp_limit', JSON.stringify(dat.highTempLimit));
          }
          if (dat.lowTempLimit !== undefined) {
            setLowTemp(dat.lowTempLimit);
            localStorage.setItem('flymind_low_temp_limit', JSON.stringify(dat.lowTempLimit));
          }
          if (dat.highHumidityLimit !== undefined) {
            setHighHumidity(dat.highHumidityLimit);
            localStorage.setItem('flymind_high_humidity_limit', JSON.stringify(dat.highHumidityLimit));
          }
          if (dat.lowHumidityLimit !== undefined) {
            setLowHumidity(dat.lowHumidityLimit);
            localStorage.setItem('flymind_low_humidity_limit', JSON.stringify(dat.lowHumidityLimit));
          }
          if (dat.larvaeConditions !== undefined) {
            setConditions(dat.larvaeConditions);
            localStorage.setItem('flymind_larvae_conditions', JSON.stringify(dat.larvaeConditions));
          }
          if (dat.feedTypes !== undefined) {
            setFeedTypes(dat.feedTypes);
            localStorage.setItem('flymind_feed_types', JSON.stringify(dat.feedTypes));
          }
          if (dat.isMuted !== undefined) {
            setIsMuted(dat.isMuted);
            localStorage.setItem('flymind_alert_muted', JSON.stringify(dat.isMuted));
          }
          if (dat.language !== undefined) {
            setLang(dat.language);
            localStorage.setItem('flymind_language', dat.language);
          }
          if (dat.alertHistory !== undefined) {
            setAlertHistory(dat.alertHistory);
            localStorage.setItem('flymind_alerts_history', JSON.stringify(dat.alertHistory));
          }

          // Restore voice preferences to local storage so VoiceAssistant is synchronized
          if (dat.voiceSpeed !== undefined) localStorage.setItem('flymind_voice_speed', JSON.stringify(dat.voiceSpeed));
          if (dat.voicePitch !== undefined) localStorage.setItem('flymind_voice_pitch', JSON.stringify(dat.voicePitch));
          if (dat.voiceSmoothness !== undefined) localStorage.setItem('flymind_voice_smoothness', JSON.stringify(dat.voiceSmoothness));
          if (dat.assistantPersonality !== undefined) localStorage.setItem('flymind_assistant_personality', dat.assistantPersonality);
          if (dat.voiceGender !== undefined) localStorage.setItem('flymind_voice_gender', dat.voiceGender);

          // Dispatch event to synchronize UI settings anywhere
          window.dispatchEvent(new Event('flymind_settings_update'));
        }
      } catch (err) {
        console.error("Failed to load settings from cloud on mount", err);
      }
    };
    fetchCloudSettings();
  }, []);

  // Sync / Cloud Backup action
  const handleCloudSync = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setIsSavingCloud(true);
    setSaveSuccess(false);
    try {
      const settingsRef = doc(db, `users/${currentUser.uid}/settings`, 'current');
      
      // Load voice settings from localStorage to back them up as well
      const voiceSpeedVal = parseFloat(localStorage.getItem('flymind_voice_speed') || '1.0');
      const voicePitchVal = parseFloat(localStorage.getItem('flymind_voice_pitch') || '1.0');
      const voiceSmoothnessVal = parseInt(localStorage.getItem('flymind_voice_smoothness') || '85');
      const assistantPersonalityVal = localStorage.getItem('flymind_assistant_personality') || 'jarvis';
      const voiceGenderVal = localStorage.getItem('flymind_voice_gender') || 'female';

      await setDoc(settingsRef, {
        highTempLimit: highTemp,
        lowTempLimit: lowTemp,
        highHumidityLimit: highHumidity,
        lowHumidityLimit: lowHumidity,
        larvaeConditions: conditions,
        feedTypes: feedTypes,
        isMuted: isMuted,
        language: lang,
        alertHistory: alertHistory,
        voiceSpeed: voiceSpeedVal,
        voicePitch: voicePitchVal,
        voiceSmoothness: voiceSmoothnessVal,
        assistantPersonality: assistantPersonalityVal,
        voiceGender: voiceGenderVal,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Add user chats system log entry for backup confirmation
      try {
        const { collection, addDoc } = await import('firebase/firestore');
        const logsRef = collection(db, `users/${currentUser.uid}/chats`);
        await addDoc(logsRef, {
          role: 'ai',
          text: `[SYSTEM DIAGNOSTIC] Farm settings, alerts threshold limit matrix, alert histories, and synthesizer voice preferences backed up successfully to Cloud Node of ${currentUser.email || 'operator'}.`,
          createdAt: new Date()
        });
      } catch (logErr) {
        console.warn("Log write failed", logErr);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to sync settings / backup config in Settings component", err);
    } finally {
      setIsSavingCloud(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Settings Welcome Panel */}
      <section className="flex items-center justify-between">
        <div>
          <p className="text-neon-green text-xs font-mono tracking-widest uppercase mb-1">Configuration</p>
          <h2 className="text-2xl font-bold">Agronomic Settings</h2>
        </div>
        <button 
          onClick={handleCloudSync}
          disabled={isSavingCloud}
          className="px-3.5 py-1.5 bg-neon-green/10 text-neon-green border border-neon-green/30 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-neon-green/20 transition-all flex items-center gap-2 cursor-pointer"
        >
          <FolderSync className={cn("w-3.5 h-3.5", isSavingCloud && "animate-spin")} />
          <span>{isSavingCloud ? "Uploading..." : saveSuccess ? "Synced!" : "Backup Config"}</span>
        </button>
      </section>

      {/* REAL-TIME ALARM & VIBRATION NOTIFICATION SETTINGS */}
      <div className="p-5 rounded-3xl bg-surface border border-white/5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-white/5 justify-between">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-4 h-4 text-neon-green" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Audio Alarm Sounds</h3>
          </div>
          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-neon-green/10 text-neon-green font-extrabold uppercase">
            Real-time Sensors
          </span>
        </div>

        {/* Mute/Unmute toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-black/40 border border-white/5">
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              Warning Alerts & Sound Feedback
            </h4>
            <p className="text-[10px] text-white/40">
              Plays high-frequency alarm tones and triggers device vibration on mobile when bounds are breached.
            </p>
          </div>

          <button
            onClick={() => setIsMuted(!isMuted)}
            className={cn(
              "p-2.5 py-2.5 rounded-xl border font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 text-center shrink-0 min-w-40",
              isMuted 
                ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20" 
                : "bg-neon-green/10 border-neon-green/30 text-neon-green hover:bg-neon-green/20"
            )}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-4 h-4" />
                <span>MUTED / आवाज बंद 🔇</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                <span>ACTIVE / चालू 🔊</span>
              </>
            )}
          </button>
        </div>

        {/* Test Alert Sound Buttons */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-1">
            Test Alert Tones / साउंड डेमो:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              { id: 'high_temp', label: '1. High Temp / उंचा तापमान', desc: 'Rapid 950Hz Square Pulsing chirp beep list', color: 'border-orange-500/20 hover:border-orange-500/50 hover:bg-orange-500/5 text-orange-400' },
              { id: 'low_temp', label: '2. Low Temp / कम तापमान', desc: 'Slow 220Hz Triangle wave low pitch chime', color: 'border-blue-500/20 hover:border-blue-500/50 hover:bg-blue-500/5 text-blue-400' },
              { id: 'high_humidity', label: '3. Wet/High Humidity / अधिक आर्द्रता', desc: 'Double 1100Hz Sine waterdrop chirp bubble sweeps', color: 'border-sky-500/20 hover:border-sky-500/50 hover:bg-sky-500/5 text-sky-400' },
              { id: 'fungus_risk', label: '4. Fungus Risk / फंगस का खतरा', desc: 'Detuned dirty 360Hz buzz alarming resonance', color: 'border-amber-500/20 hover:border-amber-500/50 hover:bg-amber-500/5 text-amber-500' },
              { id: 'critical_health', label: '5. Critical BSF Health / अति गंभीर खतरा', desc: 'High-urgency dual frequency alternating fast siren', color: 'border-red-500/20 hover:border-red-500/50 hover:bg-red-500/5 text-red-500' }
            ].map((sound) => (
              <button
                key={sound.id}
                onClick={() => playAlertSound(sound.id as AlertSoundType)}
                className={cn(
                  "p-3 rounded-2xl bg-black/25 border text-left flex items-start gap-3.5 transition-all text-xs active:scale-[0.98] group cursor-pointer",
                  sound.color
                )}
              >
                <div className="p-2 rounded-xl bg-white/5 text-inherit group-hover:bg-white/10 shrink-0 self-center">
                  <Play className="w-3.5 h-3.5 fill-current" />
                </div>
                <div className="space-y-0.5">
                  <span className="font-bold block tracking-wide">{sound.label}</span>
                  <span className="text-[9px] text-white/30 font-medium block">{sound.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 1. Climate Variables Threshold Grid */}
      <div className="p-5 rounded-3xl bg-surface border border-white/5 space-y-5">
        <div className="flex items-center gap-2.5 pb-2.5 border-b border-white/5">
          <Sliders className="w-4 h-4 text-neon-green" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Smart Thresholds</h3>
        </div>

        {/* Temperature Alert Limits */}
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 text-xs text-orange-400 font-bold uppercase tracking-wider">
            <Thermometer className="w-4 h-4" />
            <span>Temperature Alerts</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* High temperature threshold */}
            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/60">High Temperature Limit</span>
                <span className="text-orange-400 font-bold">{highTemp}°C</span>
              </div>
              <input 
                type="range"
                min="30"
                max="45"
                step="1"
                value={highTemp}
                onChange={(e) => setHighTemp(parseInt(e.target.value))}
                className="w-full accent-orange-500 bg-white/10 rounded-lg cursor-pointer h-1"
              />
              <p className="text-[10px] text-white/30">Triggers 'Facility Overheat' critical alarms if exceeded.</p>
            </div>

            {/* Low temperature threshold */}
            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/60">Low Temperature Limit</span>
                <span className="text-blue-400 font-bold">{lowTemp}°C</span>
              </div>
              <input 
                type="range"
                min="15"
                max="28"
                step="1"
                value={lowTemp}
                onChange={(e) => setLowTemp(parseInt(e.target.value))}
                className="w-full accent-blue-500 bg-white/10 rounded-lg cursor-pointer h-1"
              />
              <p className="text-[10px] text-white/30">Triggers 'Chilly Incubator' warning logs below this.</p>
            </div>
          </div>
        </div>

        {/* Humidity Alert Limits */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-blue-400 font-bold uppercase tracking-wider">
            <Droplets className="w-4 h-4" />
            <span>Relative Humidity Alerts</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* High humidity threshold */}
            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/60">High Humidity Limit</span>
                <span className="text-[#38bdf8] font-bold">{highHumidity}%</span>
              </div>
              <input 
                type="range"
                min="70"
                max="100"
                step="1"
                value={highHumidity}
                onChange={(e) => setHighHumidity(parseInt(e.target.value))}
                className="w-full accent-sky-400 bg-white/10 rounded-lg cursor-pointer h-1"
              />
              <p className="text-[10px] text-white/30">Triggers 'High Moisture Mold Risk' critical alarms if exceeded.</p>
            </div>

            {/* Low humidity threshold */}
            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/60">Low Humidity Limit</span>
                <span className="text-amber-500 font-bold">{lowHumidity}%</span>
              </div>
              <input 
                type="range"
                min="20"
                max="60"
                step="1"
                value={lowHumidity}
                onChange={(e) => setLowHumidity(parseInt(e.target.value))}
                className="w-full accent-amber-500 bg-white/10 rounded-lg cursor-pointer h-1"
              />
              <p className="text-[10px] text-white/30">Triggers 'Extreme Dryness Dehydration' logs below this.</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Custom Larvae Conditions */}
      <div className="p-5 rounded-3xl bg-surface border border-white/5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-neon-green" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Larval Life-Stage Conditions</h3>
          </div>
          <span className="text-[9px] font-mono text-white/30 uppercase">({conditions.length} Active states)</span>
        </div>

        {/* Existing condition rows */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {conditions.map((cond, idx) => (
            <div key={idx} className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between gap-3">
              {editingConditionIdx === idx ? (
                <input 
                  type="text"
                  value={editingConditionVal}
                  onChange={(e) => setEditingConditionVal(e.target.value)}
                  className="flex-1 bg-white/5 border border-neon-green/30 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                  autoFocus
                />
              ) : (
                <span className="text-xs font-semibold text-white/80">{cond}</span>
              )}

              <div className="flex gap-1">
                {editingConditionIdx === idx ? (
                  <button 
                    onClick={() => handleSaveConditionEdit(idx)}
                    className="p-1.5 text-neon-green bg-neon-green/10 hover:bg-neon-green/20 rounded-lg cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button 
                    onClick={() => startEditCondition(idx, cond)}
                    className="p-1.5 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button 
                  onClick={() => handleDeleteCondition(cond)}
                  className="p-1.5 text-red-500/50 hover:text-red-500 bg-red-500/5 hover:bg-red-500/10 rounded-lg cursor-pointer"
                  disabled={conditions.length <= 1}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add condition form */}
        <form onSubmit={handleAddCondition} className="flex gap-2">
          <input 
            type="text"
            placeholder="e.g. Mold Damaged, Ultra-Vibrant"
            value={newCondition}
            onChange={(e) => setNewCondition(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-neon-green/50"
          />
          <button 
            type="submit"
            id="add-condition-btn"
            className="px-4 bg-neon-green hover:bg-neon-green/90 text-black font-bold uppercase text-[10px] tracking-wider rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Condition
          </button>
        </form>
      </div>

      {/* 3. Custom Feed Types with Default Quantities */}
      <div className="p-5 rounded-3xl bg-surface border border-white/5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-neon-green" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Feed Ingredients Matrix</h3>
          </div>
          <span className="text-[9px] font-mono text-white/30">Autofills values in Tracker</span>
        </div>

        {/* Existing feed list */}
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {feedTypes.map((feed, idx) => (
            <div key={idx} className="p-3 bg-black/40 border border-white/5 rounded-xl flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                {editingFeedIdx === idx ? (
                  <div className="flex-1 space-y-1.5">
                    <input 
                      type="text"
                      value={editingFeedName}
                      onChange={(e) => setEditingFeedName(e.target.value)}
                      className="w-full bg-white/5 border border-neon-green/30 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-white/40">Default (kg):</span>
                      <input 
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={editingFeedQty}
                        onChange={(e) => setEditingFeedQty(Number(e.target.value))}
                        className="bg-white/5 border border-neon-green/35 rounded-lg px-2 py-0.5 text-xs text-white w-16 text-center"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs font-semibold text-white/85 block">{feed.name}</span>
                    <span className="text-[10px] text-neon-green/70">Default: {feed.defaultQty} kg</span>
                  </div>
                )}

                <div className="flex gap-1 shrink-0">
                  {editingFeedIdx === idx ? (
                    <button 
                      onClick={() => handleSaveFeedTypeEdit(idx)}
                      className="p-1.5 text-neon-green bg-neon-green/10 hover:bg-neon-green/20 rounded-lg cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button 
                      onClick={() => startEditFeedType(idx, feed)}
                      className="p-1.5 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button 
                    onClick={() => handleDeleteFeedType(feed.name)}
                    className="p-1.5 text-red-500/50 hover:text-red-500 bg-red-500/5 hover:bg-red-500/10 rounded-lg cursor-pointer"
                    disabled={feedTypes.length <= 1}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add feed type form */}
        <form onSubmit={handleAddFeedType} className="space-y-2.5 pt-1">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-1">Configure New Feed Formula</p>
          <div className="grid grid-cols-2 gap-2">
            <input 
              type="text"
              placeholder="Formula Name (e.g. Brewers Grains)"
              value={newFeedName}
              onChange={(e) => setNewFeedName(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-neon-green/50"
            />
            <div className="flex gap-1.5">
              <input 
                type="number"
                step="0.1"
                min="0.1"
                placeholder="Default kg"
                value={newFeedQty}
                onChange={(e) => setNewFeedQty(Number(e.target.value))}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white w-20 focus:outline-none text-center"
              />
              <button 
                type="submit"
                className="flex-1 bg-neon-green hover:bg-neon-green/90 text-black font-bold uppercase text-[10px] tracking-wider rounded-xl flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Formula
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 4. Smart Alerts Combination Preview Engine */}
      <div className="p-5 rounded-3xl bg-neon-green/5 border border-neon-green/20 space-y-4">
        <div className="flex items-center gap-2 pb-1.5 border-b border-white/5">
          <Sparkles className="w-4 h-4 text-neon-green" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Smart Alert Logic Matrix</h3>
        </div>
        
        <p className="text-[11px] text-white/55 leading-relaxed leading-normal">
          FlyMind combines multiple biometric readings to isolate compound environmental faults. Adjusting thresholds dynamically recalibrates the triggers below:
        </p>

        <div className="space-y-3 pt-1">
          {/* Rule 1: Temperature Overheat + Low Humidity */}
          <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex gap-3 relative overflow-hidden">
            <div className="p-1.5 max-h-8 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-red-400 flex items-center gap-1">
                Compound Risk: Egg Case Dehydration
              </h4>
              <p className="text-[10px] text-white/50 leading-relaxed">
                Triggered when Temperature &gt; <span className="text-orange-400 font-bold">{highTemp}°C</span> AND Humidity &lt; <span className="text-amber-500 font-bold">{lowHumidity}%</span>. Indicates extreme heating drying risks in nesting substrates.
              </p>
            </div>
          </div>

          {/* Rule 2: Overheat + High Humidity */}
          <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex gap-3 relative overflow-hidden">
            <div className="p-1.5 max-h-8 bg-orange-500/10 text-orange-400 rounded-lg border border-orange-500/20 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-orange-400 flex items-center gap-1">
                Pathogen Hazard: Sour Rot / Fermentation
              </h4>
              <p className="text-[10px] text-white/50 leading-relaxed">
                Triggered when Temperature &gt; <span className="text-orange-400 font-bold">{highTemp}°C</span> AND Humidity &gt; <span className="text-sky-400 font-bold">{highHumidity}%</span>. Triggers active bacterial sour fermentation alarms immediately.
              </p>
            </div>
          </div>

          {/* Rule 3: Chilling + High Humidity */}
          <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex gap-3 relative overflow-hidden">
            <div className="p-1.5 max-h-8 bg-amber-500/10 text-amber-500 rounded-lg border border-amber-500/20 shrink-0">
              <Info className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-500 flex items-center gap-1">
                Dormancy Risk: Sub-chilled Substrates
              </h4>
              <p className="text-[10px] text-white/50 leading-relaxed">
                Triggered when Temperature &lt; <span className="text-blue-400 font-bold">{lowTemp}°C</span> AND Humidity &gt; <span className="text-sky-400 font-bold">{highHumidity}%</span>. Core metabolism slows to zero, creating immediate fungal mildew vectors.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Acknowledged Alert Archive logs */}
      <div className="p-5 rounded-3xl bg-surface border border-white/5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-neon-green" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Alert History & Archive</h3>
          </div>
          {alertHistory.length > 0 && (
            <button 
              onClick={clearHistoryLog}
              className="text-[10px] font-bold text-red-400 uppercase tracking-wide hover:underline cursor-pointer"
            >
              Purge Logs
            </button>
          )}
        </div>

        {alertHistory.length === 0 ? (
          <div className="text-center py-7 text-[10px] font-mono text-white/20 uppercase tracking-wider bg-black/20 rounded-2xl border border-dashed border-white/5">
            Archive empty. Dismissed warnings report here.
          </div>
        ) : (
          <div className="space-y-2 max-h-42 overflow-y-auto">
            {alertHistory.map((item, id) => (
              <div key={id} className="p-3 rounded-xl bg-black/35 border border-white/5 flex items-start gap-3.5">
                <span className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase shrink-0 mt-0.5 font-bold ${
                  item.actionType === 'dismissed' ? "bg-white/5 text-white/50" : "bg-neon-green/10 text-neon-green"
                }`}>
                  {item.actionType}
                </span>
                <div className="flex-1 space-y-1">
                  <h4 className="text-xs font-bold text-white/80">{item.title}</h4>
                  <p className="text-[11px] text-white/40 leading-relaxed">{item.msg}</p>
                  <p className="text-[8px] text-white/20 font-mono">TIMESTAMP: {item.timestamp || "RECENT"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. GENERAL ACCOUNTS & BIO-SECURITY SUPPORT (Requested additions) */}
      <div className="p-5.5 rounded-[2.5rem] bg-[#07090d] border border-white/10 space-y-4.5">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-neon-cyan" />
            <h3 className="text-xs font-black uppercase tracking-widest text-white/60">{trans.title}</h3>
          </div>
        </div>

        {/* Global Settings: Language Toggles in Settings.tsx */}
        <div className="flex items-center justify-between text-xs py-1">
          <div className="flex items-center gap-2.5">
            <Languages className="w-4 h-4 text-neon-green" />
            <div>
              <span className="text-white block font-bold">Language / भाषा</span>
              <span className="text-[8px] font-mono text-white/30 uppercase">Global voice module</span>
            </div>
          </div>
          <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5">
            <button
              onClick={() => changeLanguage('hi')}
              className={cn(
                "px-2.5 py-1 text-[8px] font-black uppercase rounded-md transition-all cursor-pointer",
                lang === 'hi' ? "bg-neon-green text-black" : "text-white/40"
              )}
            >
              हिन्दी
            </button>
            <button
              onClick={() => changeLanguage('en')}
              className={cn(
                "px-2.5 py-1 text-[8px] font-black uppercase rounded-md transition-all cursor-pointer",
                lang === 'en' ? "bg-neon-green text-black" : "text-white/40"
              )}
            >
              EN
            </button>
          </div>
        </div>

        {/* Dynamic Partner referral card */}
        <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-3">
          <div className="flex justify-between items-start gap-2">
            <div className="space-y-0.5">
              <h4 className="text-xs font-black text-white flex items-center gap-1">
                <Share2 className="w-3.5 h-3.5 text-neon-green" />
                <span>{trans.inviteCard}</span>
              </h4>
              <p className="text-[10px] text-white/50 leading-relaxed">
                {trans.inviteDesc}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2.5 p-2 bg-black/40 rounded-xl border border-white/5">
            <div className="min-w-0">
              <span className="text-[8px] font-mono text-neon-cyan uppercase tracking-wider block font-bold leading-none mb-1">{trans.refLabel}</span>
              <span className="text-xs font-black font-mono text-white tracking-widest uppercase">FLYMINDBIO</span>
            </div>
            <button 
              onClick={copyRefCode}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[9px] font-mono font-black uppercase transition-all cursor-pointer",
                copiedCode 
                  ? "bg-neon-green/20 text-neon-green border border-neon-green/30" 
                  : "bg-white/5 border border-white/10 text-white/60 hover:text-white"
              )}
            >
              {copiedCode ? trans.cop : trans.copyCode}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={copyInviteLink}
              className="py-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-wider text-white/70 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-neon-cyan" />
              <span>{copiedLink ? trans.cop : trans.copyLink}</span>
            </button>
            <button
              onClick={triggerWhatsAppInvite}
              className="py-2.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/15 border border-[#25D366]/20 text-[#25D366] text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Legal buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button 
            type="button"
            onClick={() => setActiveModal('privacy')}
            className="py-3 px-3 rounded-2xl bg-white/[0.02] border border-white/5 text-left hover:border-white/15 transition-all cursor-pointer flex flex-col justify-between h-18"
          >
            <ShieldCheck className="w-4 h-4 text-neon-green" />
            <div>
              <span className="text-[10px] font-black text-white block uppercase leading-none mb-1">{trans.privacyTitle}</span>
              <span className="text-[8px] font-mono text-white/30 uppercase block leading-none">{trans.privacyBtn}</span>
            </div>
          </button>

          <button 
            type="button"
            onClick={() => setActiveModal('terms')}
            className="py-3 px-3 rounded-2xl bg-white/[0.02] border border-white/5 text-left hover:border-white/15 transition-all cursor-pointer flex flex-col justify-between h-18"
          >
            <FileText className="w-4 h-4 text-neon-cyan" />
            <div>
              <span className="text-[10px] font-black text-white block uppercase leading-none mb-1">{trans.termsTitle}</span>
              <span className="text-[8px] font-mono text-white/30 uppercase block leading-none">{trans.termsBtn}</span>
            </div>
          </button>
        </div>

        {/* System Sign out / Deletion controls */}
        <div className="p-4 rounded-2xl bg-[#170e0e]/10 border border-red-500/10 space-y-3 pt-3 flex flex-col">
          <div className="flex items-start gap-3">
            <UserX className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="text-xs font-black text-red-400 block uppercase leading-none">{trans.deleteBtn}</span>
              <span className="text-[9px] text-white/40 leading-relaxed block">{trans.deleteSubtitle}</span>
            </div>
          </div>
          <div className="flex gap-2.5 pt-1">
            <button
              onClick={() => setActiveModal('delete')}
              className="flex-1 py-2 text-[9px] font-black font-mono uppercase bg-red-500/15 text-red-400 rounded-xl hover:bg-red-500/20 active:scale-98 transition-all cursor-pointer text-center"
            >
              Terminate Node
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-[9px] font-black font-mono uppercase bg-white/5 border border-white/10 text-white/60 hover:text-white rounded-xl active:scale-98 transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3 h-3 text-red-400" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* OVERLAY DIALOGS (Privacy, Terms, Delete Account details) */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm pointer-events-auto overflow-hidden">
            <motion.div 
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="w-full max-w-sm max-h-[85vh] flex flex-col p-6 rounded-[2.5rem] bg-[#090b0f] border border-white/10 shadow-[0_30px_70px_rgba(0,0,0,0.95)]"
            >
              {/* Modal Dynamic Headers */}
              <div className="text-center pb-3 border-b border-white/5 relative z-10">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  {activeModal === 'privacy' && trans.privacyTitle}
                  {activeModal === 'terms' && trans.termsTitle}
                  {activeModal === 'delete' && 'CONFIRM OPERATOR DESTRUCTION'}
                </h3>
                <p className="text-[8px] font-mono uppercase tracking-[0.2em] text-neon-cyan mt-1">FlyMind Safe-Compliance Protocol</p>
              </div>

              {/* Dynamic scrollable regulatory text contents */}
              <div className="flex-1 min-h-0 overflow-y-auto py-5 space-y-4 pr-1 text-[11px] leading-relaxed text-white/60 font-sans">
                {activeModal === 'privacy' && (
                  <div className="space-y-4">
                    <p className="font-semibold text-white/80">[VER: 2026.05.22 - APPROVED Compliance State]</p>
                    
                    <div className="space-y-1">
                      <h4 className="text-neon-green font-bold uppercase text-[10px]">1. Climatic Data Storage</h4>
                      <p>FlyMind AI captures, caches, and optionally uploads thermometric substrate records, ambient relative moisture percentages, and custom feeding metrics. All values reside locally under offline memory streams unless explicitly backed up to secure Firestore channels.</p>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-neon-cyan font-bold uppercase text-[10px]">2. Diagnostic Optical Captures</h4>
                      <p>Our scanning models utilize camera layers to isolate and identify crawling densities in BSF pupae bins. Your uploaded files or real-time frames are used exclusively for object bounding calculations. Images are never redistributed, repurposed, or cataloged under public streams.</p>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-neon-green font-bold uppercase text-[10px]">3. Bio-Analytic Isolation</h4>
                      <p>Your BSF farm metrics represent specialized agrarian property. System engineers do not index proprietary telemetry, nor do we sell any aggregate agricultural indicators to external biotech agencies.</p>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-neon-cyan font-bold uppercase text-[10px]">4. Notification Channels</h4>
                      <p>Sound alarm waveforms run directly via localized audio triggers and operate independently of third-party cellular telemetry, isolating security hazard signals comprehensively.</p>
                    </div>
                  </div>
                )}

                {activeModal === 'terms' && (
                  <div className="space-y-4">
                    <p className="font-semibold text-white/80">[BSF USER CHARTER & DISCLAIMERS]</p>
                    
                    <div className="space-y-1">
                      <h4 className="text-neon-green font-bold uppercase text-[10px]">1. Agronomic AI Modeling Disclaimers</h4>
                      <p>FlyMind AI estimates health ratings, larvae feed counts, and optimal microclimate ranges with advanced generative vision technology (Gemini 3.5 Bio). All suggestions are designed as assistive guide reference indices. Farmers should crossmatch readings prior to manual feed dilutions.</p>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-neon-cyan font-bold uppercase text-[10px]">2. Operator Account Responsibility</h4>
                      <p>Each registered farmer assumes absolute custody of private access credentials. Any loss of environmental records due to manual browser reset or password disclosure remains the operator's private domain.</p>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-neon-green font-bold uppercase text-[10px]">3. Substate Maintenance Compliance</h4>
                      <p>Farmers agree to utilize non-infectious, certified feed sources when documenting logs, shielding local diagnostic monitors from hazard anomalies or biological contaminants.</p>
                    </div>
                  </div>
                )}

                {activeModal === 'delete' && (
                  <div className="space-y-4 text-center py-2">
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-2xl flex items-start gap-2 text-left">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <p>Warning: This action is absolute, permanent, and completely irreversible. All synced larvae logs, farm records, and biometric profiles will be deleted instantly.</p>
                    </div>

                    {deleteError && (
                      <div className="p-3 bg-red-500/10 text-red-300 rounded-xl text-[10px] font-bold text-left">
                        {deleteError}
                      </div>
                    )}

                    <div className="space-y-2.5 text-left pt-2">
                      <label className="text-[10px] font-black font-mono text-white/50 uppercase tracking-wider block">
                        {trans.confirmDelete}
                      </label>
                      <input 
                        type="text" 
                        placeholder="Type DELETE"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-red-500 uppercase font-mono tracking-widest text-center"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3.5 border-t border-white/5 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setDeleteConfirmText('');
                    setDeleteError(null);
                  }}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-2xl text-[10px] uppercase font-black tracking-wider transition-all cursor-pointer text-center"
                >
                  Close / Cancel
                </button>
                {activeModal === 'delete' && (
                  <button
                    type="button"
                    disabled={isDeletingAccount}
                    onClick={handleDeleteAccount}
                    className="flex-1 py-3 bg-red-600 text-white hover:bg-red-500 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                  >
                    {isDeletingAccount ? 'Erase Node...' : 'Erase Account'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
