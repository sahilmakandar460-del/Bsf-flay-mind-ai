import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  MapPin, 
  Award, 
  Activity, 
  Terminal, 
  Cpu, 
  ShieldCheck, 
  Droplets, 
  Thermometer, 
  Bell, 
  Volume2, 
  VolumeX, 
  LogOut, 
  Edit3, 
  Check, 
  Sparkles, 
  Clock, 
  FileText, 
  Camera, 
  Languages, 
  Settings, 
  Zap,
  Flame,
  Info,
  Share2,
  Users,
  Shield,
  Scale,
  Cloud,
  HelpCircle,
  MessageSquare,
  X,
  ChevronDown,
  ChevronUp,
  Vibrate,
  BellRing,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { db, auth, storage } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { playAlertSound } from '../lib/audioAlerts';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

interface ProfileProps {
  onNavigate?: (tab: string) => void;
}

interface FarmerProfile {
  fullName: string;
  farmName: string;
  farmLocation: string;
  experienceLevel: string;
  contactEmail: string;
  phone: string;
  selectedAvatarId: string;
  customAvatarBase64?: string;
  setupDate: string;
}

const AVATAR_OPTIONS = [
  { id: 'larva-master', label: 'Larva AI Master', icon: '🐛', color: '#39FF14' },
  { id: 'fly-expert', label: 'Chitin Pilot', icon: '🪰', color: '#00E5FF' },
  { id: 'biotech-sensor', label: 'Sensor Overlord', icon: '📡', color: '#FF007F' },
  { id: 'colony-queen', label: 'Swarm Director', icon: '🔱', color: '#FFFF00' }
];

export default function ProfileComponent({ onNavigate }: ProfileProps) {
  // Translate system
  const [lang, setLang] = useState<'hi' | 'en'>(() => {
    try {
      return (localStorage.getItem('flymind_language') as 'hi' | 'en') || 'hi';
    } catch { return 'hi'; }
  });

  const [profile, setProfile] = useState<FarmerProfile>(() => {
    try {
      const saved = localStorage.getItem('flymind_farmer_profile');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return {
      fullName: 'Sahil Makandar',
      farmName: 'FlyMind Alpha Cluster',
      farmLocation: 'Maharashtra, India (Grid 14B)',
      experienceLevel: 'Professional BSF Farmer',
      contactEmail: 'sahilmakandar460@gmail.com',
      phone: '+91 98765 43210',
      selectedAvatarId: 'larva-master',
      setupDate: 'May 12, 2026'
    };
  });

  // State handles
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<FarmerProfile>({ ...profile });
  const [scanCount, setScanCount] = useState(0);
  const [trackedLarvaeTotal, setTrackedLarvaeTotal] = useState(0);
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);
  const [avgTemp, setAvgTemp] = useState(28.2);
  const [avgHum, setAvgHum] = useState(65);
  const [colonyStatus, setColonyStatus] = useState<'Excellent' | 'Stable' | 'Critical'>('Excellent');
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      return JSON.parse(localStorage.getItem('flymind_alert_muted') || 'false');
    } catch { return false; }
  });

  const [activities, setActivities] = useState<any[]>([]);
  const [activeBadge, setActiveBadge] = useState<string | null>(null);
  const [showAvatarChooser, setShowAvatarChooser] = useState(false);
  const [isExperienceOpen, setIsExperienceOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SaaS Operator core states
  const [activeModal, setActiveModal] = useState<'privacy' | 'terms' | 'help' | 'logout_confirm' | 'invite' | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(() => {
    try {
      return JSON.parse(localStorage.getItem('flymind_alerts_enabled') || 'true');
    } catch { return true; }
  });
  const [vibrationEnabled, setVibrationEnabled] = useState<boolean>(() => {
    try {
      return JSON.parse(localStorage.getItem('flymind_vibration_enabled') || 'true');
    } catch { return true; }
  });
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState<boolean | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(() => {
    return localStorage.getItem('flymind_last_backup_time');
  });
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<boolean | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [supportCategory, setSupportCategory] = useState('Calibration');
  const [supportMessage, setSupportMessage] = useState('');
  const [isSubmittingHelp, setIsSubmittingHelp] = useState(false);
  const [helpSubmitted, setHelpSubmitted] = useState(false);

  // Load user profile from Firestore on mount
  useEffect(() => {
    const fetchUserProfile = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const dat = userSnap.data();
          const loadedProfile = {
            fullName: dat.fullName || dat.displayName || profile.fullName,
            farmName: dat.farmName || profile.farmName,
            farmLocation: dat.farmLocation || profile.farmLocation,
            experienceLevel: dat.experienceLevel || profile.experienceLevel,
            contactEmail: dat.contactEmail || currentUser.email || profile.contactEmail,
            phone: dat.phone || profile.phone,
            selectedAvatarId: dat.selectedAvatarId || profile.selectedAvatarId,
            customAvatarBase64: dat.customAvatarBase64 || profile.customAvatarBase64,
            setupDate: dat.setupDate || profile.setupDate
          };
          setProfile(loadedProfile);
          setEditForm(loadedProfile);
        }
      } catch (e) {
        console.error("Failed to load user profile from Firestore", e);
      }
    };
    fetchUserProfile();
  }, []);

  // Synchronize dynamic values
  useEffect(() => {
    localStorage.setItem('flymind_farmer_profile', JSON.stringify(profile));
  }, [profile]);

  // Synchronize language toggles nicely
  useEffect(() => {
    const handleLangSync = () => {
      try {
        const savedLang = localStorage.getItem('flymind_language') as 'hi' | 'en';
        if (savedLang) setLang(savedLang);
      } catch (e) {
        console.error(e);
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

  const toggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    localStorage.setItem('flymind_alert_muted', JSON.stringify(nextMuted));
    window.dispatchEvent(new Event('flymind_settings_update'));
    window.dispatchEvent(new Event('flymind_alert_muted_update'));
    playAlertSound('high_temp');
  };

  // Listen to live database states to extract counts
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const path = `users/${currentUser.uid}/farmlogs`;
    const q = query(collection(db, path), orderBy('date', 'desc'), limit(15));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setScanCount(0);
        return;
      }
      
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as any);
      
      // Calculate Total Scans counts
      setScanCount(docs.length);
      
      // Sum tracked larvae weight or approximate
      const totalWeight = docs.reduce((acc, log) => {
        const w = parseFloat(log.larvaeWeight) || 0;
        return acc + w;
      }, 0);
      setTrackedLarvaeTotal(Math.round(totalWeight > 0 ? totalWeight : docs.length * 15.2));

      // Calculate state average parameters
      const temps = docs.map(d => parseFloat(d.temp)).filter(t => !isNaN(t));
      const hums = docs.map(d => parseFloat(d.humidity)).filter(h => !isNaN(h));
      
      if (temps.length > 0) {
        const sumTemp = temps.reduce((a, b) => a + b, 0);
        setAvgTemp(parseFloat((sumTemp / temps.length).toFixed(1)));
      }
      if (hums.length > 0) {
        const sumHum = hums.reduce((a, b) => a + b, 0);
        setAvgHum(Math.round(sumHum / hums.length));
      }

      // Populate history feed
      const mappedActivities = docs.slice(0, 5).map(doc => {
        const label = doc.feedType || 'Tray Scan';
        return {
          id: doc.id,
          title: label.includes('Scan') || label.includes('Biology') ? 'AI Image Scan Result' : 'BSF Tracker Logged',
          desc: doc.notes || `Temp: ${doc.temp}°C, Humidity: ${doc.humidity}%`,
          timestamp: doc.date?.seconds 
            ? new Date(doc.date.seconds * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
            : 'Just Now',
          icon: doc.feedType?.includes('Scan') ? Cpu : Activity,
          color: doc.larvaeCondition === 'Active' || doc.larvaeCondition === 'Excellent' ? 'text-neon-green' : 'text-neon-cyan'
        };
      });
      setActivities(mappedActivities);

      // Evaluate Colony Health
      const anyDangerLogs = docs.some(d => {
        const cond = (d.larvaeCondition || '').toLowerCase();
        const note = (d.notes || '').toLowerCase();
        return cond.includes('dormant') || note.includes('dead') || note.includes('hazard') || note.includes('risk');
      });
      
      if (anyDangerLogs) {
        setColonyStatus('Critical');
      } else if (docs.length > 2) {
        setColonyStatus('Excellent');
      } else {
        setColonyStatus('Stable');
      }
    }, (err) => {
      console.error("Firestore stats error in profile component", err);
    });

    return () => unsubscribe();
  }, []);

  // Fetch active alarm counts to match metrics
  useEffect(() => {
    const handleSyncAlerts = () => {
      try {
        const dismissed = JSON.parse(localStorage.getItem('flymind_dismissed_alerts') || '[]');
        const acked = JSON.parse(localStorage.getItem('flymind_acknowledged_alerts') || '[]');
        // We will mock alerts or cross-reference from dynamic alert lists
        const count = Math.max(0, 3 - dismissed.length - acked.length);
        setActiveAlertsCount(count);
      } catch {
        setActiveAlertsCount(0);
      }
    };
    handleSyncAlerts();
    window.addEventListener('flymind_settings_update', handleSyncAlerts);
    return () => window.removeEventListener('flymind_settings_update', handleSyncAlerts);
  }, []);

  // Profile editing trigger
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfile({ ...editForm });
    setIsEditing(false);

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, {
          fullName: editForm.fullName,
          farmName: editForm.farmName,
          farmLocation: editForm.farmLocation,
          experienceLevel: editForm.experienceLevel,
          phone: editForm.phone
        }, { merge: true });
      } catch (err) {
        console.error("Failed to sync profile changes to Firestore", err);
      }
    }
    
    // Trigger global event notifying other components (like Scan.tsx) of the experience change.
    window.dispatchEvent(new Event('flymind_profile_update'));
  };

  const currentAvatar = AVATAR_OPTIONS.find(av => av.id === profile.selectedAvatarId) || AVATAR_OPTIONS[0];

  // Compresses high-resolution custom avatars to prevent Firestore payload bloat
  const compressAvatar = (base64Str: string, maxWidth = 120, maxHeight = 120): Promise<string> => {
    return new Promise((resolve) => {
      if (!base64Str || !base64Str.startsWith('data:image')) {
        resolve(base64Str);
        return;
      }
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6); // 60% quality is perfect for avatar resolution
            resolve(compressedBase64);
          } else {
            resolve(base64Str);
          }
        } catch (err) {
          console.error("Canvas compression failed, falling back", err);
          resolve(base64Str);
        }
      };
      img.onerror = () => {
        resolve(base64Str);
      };
    });
  };

  // Image upload handler
  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const compressed = await compressAvatar(base64);
      setProfile(prev => ({
        ...prev,
        customAvatarBase64: compressed
      }));

      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          // Upload to Firebase Cloud Storage!
          const imageRef = ref(storage, `users/${currentUser.uid}/profile_photo.jpg`);
          await uploadString(imageRef, compressed, 'data_url');
          const downloadUrl = await getDownloadURL(imageRef);

          const userRef = doc(db, 'users', currentUser.uid);
          await setDoc(userRef, {
            customAvatarBase64: compressed,
            photoURL: downloadUrl
          }, { merge: true });
        } catch (err) {
          console.error("Failed to sync custom avatar to Cloud Storage or Firestore", err);
          // Fallback to direct Firestore sync
          const userRef = doc(db, 'users', currentUser.uid);
          await setDoc(userRef, {
            customAvatarBase64: compressed
          }, { merge: true }).catch(() => {});
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
  };

  const handleShareInvite = async () => {
    const shareUrl = `${window.location.origin}/invite?ref=${auth.currentUser?.uid || 'guest'}`;
    const shareText = lang === 'hi'
      ? `फ्लाईमाइंड एआई (FlyMind AI) के साथ अपने बीएसएफ (BSF) खेती को एआई-पॉवर्ड नैदानिकी और बायो-डोम मॉनिटरिंग से अपग्रेड करें! यहाँ जुड़ें: ${shareUrl}`
      : `Optimize your BSF larval yield with automated diagnostic telemetry! Join the FlyMind AI Smart Farming network: ${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'FlyMind AI BSF Intel',
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.error('Share failed', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
      } catch (err) {
        console.error('Clipboard copy failed', err);
      }
    }
  };

  const handleCloudBackup = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setIsBackingUp(true);
    setBackupSuccess(null);
    try {
      let avatarToUpload = profile.customAvatarBase64 || null;
      if (avatarToUpload) {
        avatarToUpload = await compressAvatar(avatarToUpload);
        // Sync back to local profile state so we don't hold the heavyweight version anymore
        setProfile(prev => ({
          ...prev,
          customAvatarBase64: avatarToUpload
        }));
      }

      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, {
        fullName: profile.fullName,
        farmName: profile.farmName,
        farmLocation: profile.farmLocation,
        experienceLevel: profile.experienceLevel,
        contactEmail: profile.contactEmail,
        phone: profile.phone,
        selectedAvatarId: profile.selectedAvatarId,
        customAvatarBase64: avatarToUpload,
        setupDate: profile.setupDate,
        email: currentUser.email || profile.contactEmail,
        createdAt: serverTimestamp()
      }, { merge: true });

      // Append log chat message in Firestore chats collection for the user
      try {
        const ticketRef = collection(db, `users/${currentUser.uid}/chats`);
        await addDoc(ticketRef, {
          role: 'ai',
          text: `[SYSTEM DIAGNOSTIC BACKUP] Synapsed Farmer Profile and sensory variables successfully encrypted and stored securely in Cloud Server node. Timestamp: ${new Date().toISOString()}`,
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.error("Failed to add system log chat entry", e);
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
      const nowStr = new Date().toLocaleString();
      localStorage.setItem('flymind_last_backup_time', nowStr);
      setLastBackupTime(nowStr);
      setBackupSuccess(true);
      setTimeout(() => setBackupSuccess(null), 3000);
    } catch (err) {
      console.error("Backup failed", err);
      setBackupSuccess(false);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleCloudRestore = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setIsRestoring(true);
    setRestoreSuccess(null);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const dat = snap.data();
        const loaded: FarmerProfile = {
          fullName: dat.fullName || profile.fullName,
          farmName: dat.farmName || profile.farmName,
          farmLocation: dat.farmLocation || profile.farmLocation,
          experienceLevel: dat.experienceLevel || profile.experienceLevel,
          contactEmail: dat.contactEmail || currentUser.email || profile.contactEmail,
          phone: dat.phone || profile.phone,
          selectedAvatarId: dat.selectedAvatarId || profile.selectedAvatarId,
          customAvatarBase64: dat.customAvatarBase64 || profile.customAvatarBase64,
          setupDate: dat.setupDate || profile.setupDate
        };
        setProfile(loaded);
        setEditForm(loaded);
        localStorage.setItem('flymind_farmer_profile', JSON.stringify(loaded));

        try {
          const ticketRef = collection(db, `users/${currentUser.uid}/chats`);
          await addDoc(ticketRef, {
            role: 'ai',
            text: `[SYSTEM SYNAPSE RESTORE] Local storage cache synchronized successfully with master database node. Real-time telemetry aligned.`,
            createdAt: serverTimestamp()
          });
        } catch (e) {
          console.error("Failed to add system log chat entry", e);
        }

        await new Promise(resolve => setTimeout(resolve, 1500));
        setRestoreSuccess(true);
        setTimeout(() => setRestoreSuccess(null), 3000);
      } else {
        setRestoreSuccess(false);
      }
    } catch (err) {
      console.error("Restore failed", err);
      setRestoreSuccess(false);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSubmitHelp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setIsSubmittingHelp(true);
    try {
      const helpRef = collection(db, `users/${currentUser.uid}/chats`);
      await addDoc(helpRef, {
        role: 'user',
        text: `[Operator Support Ticket] Category: ${supportCategory}. Message: ${supportMessage.trim()}`,
        createdAt: serverTimestamp()
      });

      await addDoc(helpRef, {
        role: 'ai',
        text: `We have registered your BSF support ticket regarding '${supportCategory}'. Our bio-telemetry team is performing standard validation scans. Ticket reference: #${Math.floor(100000 + Math.random() * 900000)}`,
        createdAt: serverTimestamp()
      });

      setHelpSubmitted(true);
      setSupportMessage('');
      setTimeout(() => {
        setHelpSubmitted(false);
        setActiveModal(null);
      }, 3000);
    } catch (err) {
      console.error("Failed to submit support", err);
    } finally {
      setIsSubmittingHelp(false);
    }
  };

  // Translations object
  const ui = {
    hi: {
      profileTitle: 'ड्रोन ऑपरेटर बायो-डैशबोर्ड',
      profileSub: 'कृषि आनुवंशिकी विंग',
      totalScans: 'कुल स्कैन',
      trackedLarvae: 'लार्वा ट्रैक्ड',
      activeAlerts: 'सक्रिय चेतावनियाँ',
      farmScore: 'फार्म स्वास्थ्य सूचकांक',
      badgeTitle: 'बायोटेक पदवी और उपलब्धियाँ',
      insightsTitle: 'एआई एग्रोनॉमी अंतर्दृष्टि',
      logsTitle: 'वास्तविक समय संवेदी गतिविधियां',
      editBtn: 'बायो-डेटा संपादित करें',
      saveBtn: 'क्लाउड सिंक / सहेजें',
      cancelBtn: 'वापस जाएं',
      infoTitle: 'कृषक जैव विवरण',
      experience: 'अनुभव स्तर',
      farmName: 'फार्म का नाम',
      location: 'स्थान / ग्रिड',
      soundToggle: 'अलार्म ध्वनियाँ',
      muted: 'बंद',
      active: 'सक्रिय',
      language: 'भाषा प्रबंधन',
      logout: 'सिस्टम डिक्रिप्ट / लॉगआउट',
      customAvatarLabel: 'कस्टम फोटो अपलोड करें',
      achievements: [
        { id: 'active', title: 'सक्रिय ऑपरेटर (Active)', desc: 'कम से कम ५ जैव विश्लेषण स्कैन पूरा करें', icon: '🔋' },
        { id: 'healthy', title: 'सुरक्षित स्वाम (Pathogen Free)', desc: 'शून्य कवक संक्रमण दर बनाए रखें', icon: '🦠' },
        { id: 'expert', title: 'एआई एग्रोनोमिस्ट (Agronomist)', desc: 'नवीनतम डीप-लर्निंग स्कैन सुविधा का उपयोग करें', icon: '🧠' },
        { id: 'stable', title: 'थर्मल स्थिरीकरण (Stable Temp)', desc: 'औसत तापमान २६-३०°C के भीतर रखें', icon: '🌌' }
      ],
      avgTemp: 'औसत तापमान',
      avgHum: 'औसत आर्द्रता',
      colonyStatus: 'कॉलोनी स्थिति',
      farmOverview: 'कृत्रिम गर्भाशय फार्म अवलोकन',
      stableInsight: 'आपकी फार्म जलवायु सुरक्षा मानकों के भीतर स्थिर है।',
      optimalInsight: 'लार्वा आर्द्रता कारक उत्कृष्ट प्रदर्शन सीमाओं में है।'
    },
    en: {
      profileTitle: 'Drone Operator Bio-Dashboard',
      profileSub: 'Agricultural Genetics Division',
      totalScans: 'Total Scans',
      trackedLarvae: 'Larvae Tracked',
      activeAlerts: 'Active Alerts',
      farmScore: 'Farm Health Score',
      badgeTitle: 'Biotech Badges & Achievements',
      insightsTitle: 'AI Agronomic Insights',
      logsTitle: 'Real-time Sensory Operations',
      editBtn: 'Edit Bio-Data Indicators',
      saveBtn: 'Force Cloud Sync',
      cancelBtn: 'Cancel',
      infoTitle: 'Farming Metadata Info',
      experience: 'Experience Level',
      farmName: 'Farm Identity',
      location: 'Grid Location',
      soundToggle: 'Telemetry Audio Signal',
      muted: 'MUTED',
      active: 'TRANSMITTING',
      language: 'Synthesizer Language',
      logout: 'Decrypt Terminal (Logout)',
      customAvatarLabel: 'Upload Bio-Id Photo',
      achievements: [
        { id: 'active', title: 'Active Transceiver', desc: 'Complete 5 or more digital tray scans', icon: '🔋' },
        { id: 'healthy', title: 'Pathogen Purified', desc: 'No active mold or severe contamination', icon: '🦠' },
        { id: 'expert', title: 'SaaS Gen Agronomist', desc: 'Deploy neural network scanner diagnostics', icon: '🧠' },
        { id: 'stable', title: 'Thermal Equilibrium', desc: 'Maintain ideal average temperature between 26-30°C', icon: '🌌' }
      ],
      avgTemp: 'Avg Incubator Temp',
      avgHum: 'Avg Substrate Hum',
      colonyStatus: 'Colony Health Index',
      farmOverview: 'BSF Bio-Dome Status Overview',
      stableInsight: 'All telemetry arrays establish microclimates are in safe bounds.',
      optimalInsight: 'Average substrate hydration trends indicate continuous high feeding yield ratio.'
    }
  };

  const t = ui[lang];

  // Dynamic compute health score
  const healthScore = Math.max(76, 99 - (activeAlertsCount * 7.5));

  return (
    <div className="space-y-6 pb-20 select-none">
      
      {/* 1. PREMIUM HEADER AVATAR SECTION WITH GLOW & SHIMMER */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative p-6 rounded-3xl bg-gradient-to-b from-white/[0.03] to-transparent border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none text-neon-green">
          <Terminal className="w-24 h-24" />
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-neon-green/5 blur-[80px] pointer-events-none rounded-full" />

        <div className="flex flex-col sm:flex-row items-center gap-5 relative z-10">
          
          {/* Glowing Circular Avatar */}
          <div className="relative group cursor-pointer" onClick={() => setShowAvatarChooser(true)}>
            <div className="w-24 h-24 rounded-full p-[3px] bg-gradient-to-tr from-neon-green via-neon-cyan to-transparent shadow-[0_0_20px_rgba(57,255,20,0.25)] relative overflow-hidden flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-[#030303] overflow-hidden flex items-center justify-center border border-white/10">
                {profile.customAvatarBase64 ? (
                  <img 
                    src={profile.customAvatarBase64} 
                    alt="Farmer Avatar" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-4xl">{currentAvatar.icon}</span>
                )}
              </div>
              
              {/* Overlay camera hover change effect */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                <Camera className="w-4 h-4 text-neon-green animate-pulse" />
                <span className="text-[8px] font-mono font-black uppercase text-white tracking-widest text-center px-1">Update Bio</span>
              </div>
            </div>

            {/* Glowing active radar dot */}
            <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-neon-green rounded-full border-2 border-[#090b0f] flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-black rounded-full animate-ping" />
            </span>
          </div>

          {/* Farmer Primary Text Fields */}
          <div className="text-center sm:text-left space-y-1 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-black font-display text-white tracking-tight flex items-center justify-center sm:justify-start gap-1.5">
                  {profile.fullName}
                  <Sparkles className="w-3.5 h-3.5 text-neon-green animate-pulse" />
                </h2>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-neon-cyan leading-none font-extrabold">
                  {profile.experienceLevel}
                </p>
              </div>
              <button 
                onClick={() => { setEditForm({ ...profile }); setIsEditing(true); }}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/55 hover:text-neon-green hover:border-neon-green/30 transition-all text-[9.5px] font-bold uppercase tracking-widest cursor-pointer flex items-center justify-center gap-1.5 hover:scale-105"
              >
                <Edit3 className="w-3 h-3 text-neon-green" />
                <span>{t.editBtn}</span>
              </button>
            </div>

            <div className="pt-2 grid grid-cols-1 xs:grid-cols-2 gap-2 text-white/55 text-xs font-semibold">
              <div className="flex items-center justify-center sm:justify-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-neon-green/60" />
                <span className="truncate">{profile.farmLocation}</span>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-1.5">
                <Clock className="w-3.5 h-3.5 text-neon-green/60" />
                <span>Active Since: {profile.setupDate}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ======================================== */}
      {/* PREMIUM FLYMIND AI SAAS ACTION CONSOLE */}
      {/* ======================================== */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-5.5 rounded-3xl bg-[#07090d]/90 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden backdrop-blur-md"
      >
        {/* Glow Mesh */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-neon-green/5 blur-3xl rounded-full pointer-events-none" />
        
        <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-4 font-mono">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-neon-green animate-spin-slow" />
            <span className="text-xs font-black uppercase tracking-widest text-white leading-none">
              {lang === 'hi' ? 'संचालक नियंत्रण कंसोल' : 'SaaS Operator Console'}
            </span>
          </div>
          <span className="text-[8px] font-bold text-[#00E5FF] px-2 py-0.5 rounded bg-neon-cyan/5 border border-neon-cyan/15 uppercase">
            SECURE ACTIVE Node
          </span>
        </div>

        <div className="space-y-2">
          {/* 1. Invite Friends Option */}
          <div 
            onClick={handleShareInvite}
            className="p-3.5 rounded-2xl bg-white/[0.01] border border-white/5 hover:border-neon-green/20 hover:bg-neon-green/[0.01] transition-all cursor-pointer flex items-center justify-between group active:scale-[0.98]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="p-2.5 rounded-xl bg-neon-green/10 text-neon-green border border-neon-green/15 group-hover:shadow-[0_0_12px_rgba(57,255,20,0.25)] transition-all">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-black font-display text-white block">
                  {lang === 'hi' ? 'संचालक व सहभागी आमंत्रित करें' : 'Invite Operators'}
                </span>
                <span className="text-[10px]/relaxed text-white/40 block mt-0.5 truncate max-w-[200px] font-semibold">
                  {lang === 'hi' ? 'अन्य ऑपरेटरों को FlyMind एआई में शामिल करें' : 'Invite other farmers to FlyMind AI'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {copiedLink ? (
                <span className="text-[9px] font-mono text-neon-green font-extrabold uppercase tracking-wider bg-neon-green/10 px-2 py-0.5 rounded border border-neon-green/20 animate-pulse">COPIED</span>
              ) : (
                <Share2 className="w-4 h-4 text-white/20 group-hover:text-neon-green transition-colors" />
              )}
            </div>
          </div>

          {/* 2. Notifications Settings Accordion */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.01] overflow-hidden transition-all">
            <div 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={cn(
                "p-3.5 flex items-center justify-between cursor-pointer transition-all hover:bg-white/[0.02]",
                isNotificationsOpen ? "bg-white/5 border-b border-white/5" : ""
              )}
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/15">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black font-display text-white block">
                    {lang === 'hi' ? 'अधिसूचना विन्यास' : 'Alert Core Settings'}
                  </span>
                  <span className="text-[10px] text-white/40 block mt-0.5 font-semibold">
                    {lang === 'hi' ? 'अलर्ट, ध्वनि व कंपन सेटिंग्स' : 'Manage alert relays, vibration & audio'}
                  </span>
                </div>
              </div>
              {isNotificationsOpen ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
            </div>

            <AnimatePresence>
              {isNotificationsOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-3.5 bg-[#030406]/55 divide-y divide-white/[0.03] space-y-3 font-semibold"
                >
                  <div className="flex items-center justify-between pb-3">
                    <div>
                      <span className="text-[11px] text-white block font-bold leading-none mb-1">
                        {lang === 'hi' ? 'ध्वनि और अलार्म अलर्ट' : 'Diagnostics Audio Warnings'}
                      </span>
                      <span className="text-[9px] font-mono text-white/30 uppercase block">Chime status metrics alert</span>
                    </div>
                    <button 
                      onClick={toggleSound}
                      className={cn(
                        "px-3 py-1.5 rounded-lg font-mono text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        isMuted 
                          ? "bg-red-500/10 text-red-400 border border-red-500/15" 
                          : "bg-neon-green/10 text-neon-green border border-neon-green/20 shadow-[0_0_10px_rgba(57,255,20,0.1)]"
                      )}
                    >
                      {isMuted ? (lang === 'hi' ? 'बंद' : 'MUTED') : (lang === 'hi' ? 'सक्रिय' : 'ACTIVE')}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-3 pb-3">
                    <div>
                      <span className="text-[11px] text-white block font-bold leading-none mb-1">
                        {lang === 'hi' ? 'कंपन प्रतिक्रिया' : 'Environmental Vibration feedbacks'}
                      </span>
                      <span className="text-[9px] font-mono text-white/30 uppercase block">Android Core haptic motors</span>
                    </div>
                    <button 
                      onClick={() => {
                        const nextV = !vibrationEnabled;
                        setVibrationEnabled(nextV);
                        localStorage.setItem('flymind_vibration_enabled', JSON.stringify(nextV));
                        if(nextV && navigator.vibrate) { navigator.vibrate(200); }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg font-mono text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        !vibrationEnabled 
                          ? "bg-red-500/10 text-red-400 border border-red-500/15" 
                          : "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 shadow-[0_0_10px_rgba(0,229,255,0.1)]"
                      )}
                    >
                      {vibrationEnabled ? (lang === 'hi' ? 'चालू' : 'ENABLED') : (lang === 'hi' ? 'बंद' : 'MUTED')}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-3">
                    <div>
                      <span className="text-[11px] text-white block font-bold leading-none mb-1">
                        {lang === 'hi' ? 'सक्रिय चेतावनियाँ रिले' : 'Alert Signal Transmissions'}
                      </span>
                      <span className="text-[9px] font-mono text-white/30 uppercase block">Relay automated push telemetry</span>
                    </div>
                    <button 
                      onClick={() => {
                        const nextA = !alertsEnabled;
                        setAlertsEnabled(nextA);
                        localStorage.setItem('flymind_alerts_enabled', JSON.stringify(nextA));
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg font-mono text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        !alertsEnabled 
                          ? "bg-red-500/10 text-red-400 border border-red-500/15" 
                          : "bg-neon-green/10 text-neon-green border border-neon-green/20 shadow-[0_0_10px_rgba(57,255,20,0.1)]"
                      )}
                    >
                      {alertsEnabled ? (lang === 'hi' ? 'सक्रिय' : 'ACTIVE') : (lang === 'hi' ? 'निष्क्रिय' : 'DISABLED')}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 3. Privacy Policy Option */}
          <div 
            onClick={() => setActiveModal('privacy')}
            className="p-3.5 rounded-2xl bg-white/[0.01] border border-white/5 hover:border-neon-cyan/20 hover:bg-neon-cyan/[0.01] transition-all cursor-pointer flex items-center justify-between group active:scale-[0.98]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="p-2.5 rounded-xl bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/15">
                <Shield className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-black font-display text-white block">
                  {lang === 'hi' ? 'गोपनीयता नीति' : 'SaaS Privacy Protocol'}
                </span>
                <span className="text-[10px] text-white/40 block mt-0.5 truncate max-w-[200px] font-semibold">
                  {lang === 'hi' ? 'डेटा संचरण और जैव-सुरक्षा गोपनीयता' : 'BSF genetic & network security'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-neon-cyan transition-colors" />
          </div>

          {/* 4. Terms & Conditions Option */}
          <div 
            onClick={() => setActiveModal('terms')}
            className="p-3.5 rounded-2xl bg-white/[0.01] border border-white/5 hover:border-[#FF007F]/20 hover:bg-[#FF007F]/[0.01] transition-all cursor-pointer flex items-center justify-between group active:scale-[0.98]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="p-2.5 rounded-xl bg-[#FF007F]/10 text-[#FF007F] border border-[#FF007F]/15">
                <Scale className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-black font-display text-white block">
                  {lang === 'hi' ? 'नियम और शर्तें' : 'System Operating SLA (Terms)'}
                </span>
                <span className="text-[10px] text-white/40 block mt-0.5 truncate max-w-[200px] font-semibold">
                  {lang === 'hi' ? 'कृषि ऑटोमेशन लाइसेंस अनुबंध' : 'BSF automated licensing SLA'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-[#FF007F] transition-colors" />
          </div>

          {/* 5. Language Settings Option (Integrated select-switches) */}
          <div 
            className="p-3.5 rounded-2xl bg-white/[0.01] border border-white/5 flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="p-2.5 rounded-xl bg-neon-green/10 text-neon-green border border-neon-green/15">
                <Languages className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-black font-display text-white block">
                  {lang === 'hi' ? 'सिस्टम वोकल कोर' : 'Vocal Processor Core'}
                </span>
                <span className="text-[10px] text-white/40 block mt-0.5 font-semibold">
                  {lang === 'hi' ? 'चयनित: हिन्दी (Hindi)' : 'Active: English'}
                </span>
              </div>
            </div>
            
            <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/5 shrink-0 scale-95">
              <button
                onClick={() => changeLanguage('hi')}
                className={cn(
                  "px-3 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all cursor-pointer",
                  lang === 'hi' ? "bg-neon-green text-black font-bold shadow-[0_0_10px_rgba(57,255,20,0.25)]" : "text-white/40 hover:text-white"
                )}
              >
                हिन्दी
              </button>
              <button
                onClick={() => changeLanguage('en')}
                className={cn(
                  "px-3 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all cursor-pointer",
                  lang === 'en' ? "bg-neon-green text-black font-bold shadow-[0_0_10px_rgba(57,255,20,0.25)]" : "text-white/40 hover:text-white"
                )}
              >
                EN
              </button>
            </div>
          </div>

          {/* 6. Cloud Backup & Sync Accordion */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.01] overflow-hidden transition-all">
            <div 
              onClick={() => setIsBackupOpen(!isBackupOpen)}
              className={cn(
                "p-3.5 flex items-center justify-between cursor-pointer transition-all hover:bg-white/[0.02]",
                isBackupOpen ? "bg-white/5 border-b border-white/5" : ""
              )}
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-violet-400/10 text-violet-400 border border-violet-400/15">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black font-display text-white block">
                    {lang === 'hi' ? 'क्लाउड बैकअप और सिंक' : 'Cloud Backup & Sync'}
                  </span>
                  {lastBackupTime ? (
                    <span className="text-[9px] font-mono text-neon-green/85 flex items-center gap-1.5 mt-0.5 font-bold uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                      {lang === 'hi' ? 'अंतिम मिलान:' : 'Last Handshake:'} {lastBackupTime}
                    </span>
                  ) : (
                    <span className="text-[10px] text-white/40 block mt-0.5 font-semibold">
                      {lang === 'hi' ? 'कृषि डेटाबेस सिंक व पुनर्स्थापना' : 'Synchronize farm database with Firestore'}
                    </span>
                  )}
                </div>
              </div>
              {isBackupOpen ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
            </div>

            <AnimatePresence>
              {isBackupOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-4 bg-[#030406]/55 space-y-4 text-xs font-semibold"
                >
                  <p className="text-[10px] font-mono leading-relaxed text-white/35 uppercase tracking-wide">
                    {lang === 'hi' 
                      ? 'क्लाउड सिंक के माध्यम से आपके समग्र जैव-आंकड़े सीधे सर्वर से संरेखित होते हैं।'
                      : 'Enables continuous replication of environmental histories, scanner logs, and operation statistics to the master Firestore repository.'}
                  </p>

                  {/* Real-time Status Indicator Block */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-2 font-mono">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-white/40 uppercase tracking-widest font-black">
                        {lang === 'hi' ? 'सिंक स्थिति:' : 'CLOUD SYNAPSE:'}
                      </span>
                      {lastBackupTime ? (
                        <span className="text-neon-green font-extrabold flex items-center gap-1.5 uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                          {lang === 'hi' ? 'सिंक किया गया' : 'SYNAPTED'}
                        </span>
                      ) : (
                        <span className="text-amber-400 font-extrabold flex items-center gap-1.5 uppercase animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          {lang === 'hi' ? 'सचेत / अनिर्धारित' : 'NOT INITIALIZED'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] border-t border-white/5 pt-2 mt-0.5">
                      <span className="text-white/40 uppercase tracking-widest font-black">
                        {lang === 'hi' ? 'अंतिम मिलान:' : 'LAST HANDSHAKE:'}
                      </span>
                      <span className="text-white/80 font-bold">
                        {lastBackupTime ? lastBackupTime : (lang === 'hi' ? 'कभी नहीं' : 'NEVER')}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 pt-1">
                    <button
                      onClick={handleCloudBackup}
                      disabled={isBackingUp || isRestoring}
                      className="px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 disabled:opacity-50 transition-all font-bold uppercase tracking-wider text-[9.5px] cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isBackingUp ? (
                        <>
                          <div className="w-3 h-3 rounded-full border border-violet-400 border-t-transparent animate-spin animate-spin-slow" />
                          <span>SYNCING...</span>
                        </>
                      ) : (
                        lang === 'hi' ? 'डेटा बैकअप' : 'Backup DATA'
                      )}
                    </button>

                    <button
                      onClick={handleCloudRestore}
                      disabled={isBackingUp || isRestoring}
                      className="px-3 py-2 rounded-xl bg-neon-cyan/10 border border-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/20 disabled:opacity-50 transition-all font-bold uppercase tracking-wider text-[9.5px] cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isRestoring ? (
                        <>
                          <div className="w-3 h-3 rounded-full border border-[#00E5FF] border-t-transparent animate-spin animate-spin-slow" />
                          <span>RESTORE...</span>
                        </>
                      ) : (
                        lang === 'hi' ? 'पुनर्स्थापित' : 'Restore State'
                      )}
                    </button>
                  </div>

                  {/* Operational sync status feeds */}
                  {backupSuccess !== null && (
                    <div className={cn(
                      "p-2.5 rounded-xl font-mono text-[9px] font-black uppercase text-center border",
                      backupSuccess ? "bg-neon-green/10 text-neon-green border-neon-green/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                    )}>
                      {backupSuccess 
                        ? (lang === 'hi' ? '✓ क्लास स्टेट एन्क्रिप्टेड और सिंक्ड!' : '✓ CLIENT STATE ENCRYPTED AND SYNCED!') 
                        : '❌ BACKUP ERROR. CONNECTION OUT OF BOUNDS.'}
                    </div>
                  )}

                  {restoreSuccess !== null && (
                    <div className={cn(
                      "p-2.5 rounded-xl font-mono text-[9px] font-black uppercase text-center border",
                      restoreSuccess ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                    )}>
                      {restoreSuccess 
                        ? (lang === 'hi' ? '✓ मास्टर सिंक्रनाइज़ेशन पुनर्प्राप्त!' : '✓ FIRESTORE STATE SYNAPTED!') 
                        : '❌ RESTORE ERROR. NO RECORD DETECTED.'}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 7. Help & Support Option */}
          <div 
            onClick={() => setActiveModal('help')}
            className="p-3.5 rounded-2xl bg-white/[0.01] border border-white/5 hover:border-amber-400/20 hover:bg-amber-400/[0.01] transition-all cursor-pointer flex items-center justify-between group active:scale-[0.98]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="p-2.5 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/15">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-black font-display text-white block font-bold">
                  {lang === 'hi' ? 'सहायता केंद्र और संपर्क' : 'Operator Helpline (Support)'}
                </span>
                <span className="text-[10px] text-white/40 block mt-0.5 truncate max-w-[200px] font-semibold">
                  {lang === 'hi' ? 'जीवाणु वैज्ञानिकों से संपर्क' : 'Submit support ticket or diagnostics'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-amber-400 transition-colors" />
          </div>

          {/* 8. LogOut Action Button */}
          <div 
            onClick={() => setActiveModal('logout_confirm')}
            className="p-3.5 rounded-2xl bg-[#ef4444]/5 hover:bg-[#ef4444]/10 border border-[#ef4444]/10 hover:border-[#ef4444]/30 transition-all cursor-pointer flex items-center justify-between group active:scale-[0.98] mt-3"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-500 border border-red-500/15 group-hover:shadow-[0_0_12px_rgba(239,68,68,0.25)] transition-all">
                <LogOut className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-black font-display text-red-400 block font-bold">
                  {lang === 'hi' ? 'सत्र समाप्त / टर्मिनल डिक्रिप्ट' : 'Terminate Console Session'}
                </span>
                <span className="text-[10px] text-white/30 block mt-0.5">
                  {lang === 'hi' ? 'फ्लाईमाइंड कोर से कनेक्शन बंद करें' : 'Disconnect session from BSF core'}
                </span>
              </div>
            </div>
            <X className="w-3.5 h-3.5 text-white/20 group-hover:text-red-400 transition-colors" />
          </div>
        </div>
      </motion.div>

      {/* 2. DYNAMIC FIREBASE STATISTICS BAR WITH METRIC CARDS */}
      <div className="grid grid-cols-2 gap-3">
        {/* TOTAL SCANS */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0e1017] to-transparent border border-white/5 hover:border-white/10 transition-colors relative group">
          <span className="text-[8px] font-mono text-neon-cyan uppercase tracking-widest block font-bold mb-1">{t.totalScans}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono tracking-tight text-white">{scanCount}</span>
            <span className="text-[10px] font-mono text-neon-green font-bold">+100%</span>
          </div>
          <div className="w-full bg-white/5 h-[2px] rounded-full overflow-hidden mt-2">
            <div className="h-full bg-neon-green w-[45%]" />
          </div>
        </div>

        {/* LARVAE TRACKED WEIGHT */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0e1017] to-transparent border border-white/5 hover:border-white/10 transition-colors relative group">
          <span className="text-[8px] font-mono text-neon-cyan uppercase tracking-widest block font-bold mb-1">{t.trackedLarvae}</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono tracking-tight text-white">{trackedLarvaeTotal}</span>
            <span className="text-[9px] font-mono text-white/40 font-bold">KG</span>
          </div>
          <div className="w-full bg-white/5 h-[2px] rounded-full overflow-hidden mt-2">
            <div className="h-full bg-neon-cyan w-[62%]" />
          </div>
        </div>

        {/* ACTIVE ALERTS */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-[#170e0e]/40 to-transparent border border-red-500/10 hover:border-red-500/20 transition-colors relative group">
          <span className="text-[8px] font-mono text-red-400 uppercase tracking-widest block font-bold mb-1">{t.activeAlerts}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono tracking-tight text-red-400">{activeAlertsCount}</span>
            <span className="text-[8px] font-mono bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded font-extrabold animate-pulse">LIVE SECURE</span>
          </div>
          <div className="w-full bg-white/5 h-[2px] rounded-full overflow-hidden mt-2">
            <div className="h-full bg-red-500" style={{ width: `${activeAlertsCount * 33}%` }} />
          </div>
        </div>

        {/* FARM HEALTH SCORE */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0e1711]/40 to-transparent border border-neon-green/10 hover:border-neon-green/20 transition-colors relative group">
          <span className="text-[8px] font-mono text-neon-green uppercase tracking-widest block font-bold mb-1">{t.farmScore}</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono tracking-tight text-neon-green">{healthScore}%</span>
            <span className="text-[9px] font-mono text-[#a1a1aa] font-bold">OPTIMAL</span>
          </div>
          <div className="w-full bg-white/5 h-[2px] rounded-full overflow-hidden mt-2">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-neon-green" style={{ width: `${healthScore}%` }} />
          </div>
        </div>
      </div>

      {/* 3. FARM OVERVIEW COMPONENT EXTRA - INTEGRATING METRICS */}
      <div className="p-5 rounded-3xl bg-[#07090d] border border-white/10 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 p-4 opacity-[0.02] text-neon-green">
          <Activity className="w-24 h-24" />
        </div>
        
        <h3 className="text-xs font-black font-mono uppercase tracking-widest text-white/50 mb-4 flex items-center gap-2">
          <Droplets className="w-4 h-4 text-neon-cyan" />
          <span>{t.farmOverview}</span>
        </h3>

        <div className="grid grid-cols-3 gap-2 text-center text-white font-sans text-xs font-bold pt-1">
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-[8px] font-mono text-white/40 uppercase block mb-1">{t.avgTemp}</span>
            <span className="text-sm font-black font-mono text-amber-300">{avgTemp}°C</span>
          </div>
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-[8px] font-mono text-white/40 uppercase block mb-1">{t.avgHum}</span>
            <span className="text-sm font-black font-mono text-neon-cyan">{avgHum}%</span>
          </div>
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-[8px] font-mono text-white/40 uppercase block mb-1">{t.colonyStatus}</span>
            <span className={cn(
              "text-xs font-black uppercase tracking-wider block",
              colonyStatus === 'Excellent' ? "text-neon-green animate-pulse" : colonyStatus === 'Stable' ? "text-neon-cyan" : "text-red-400"
            )}>
              {colonyStatus}
            </span>
          </div>
        </div>
      </div>

      {/* 4. AI-INSIGHTS SECTION */}
      <div className="p-5.5 rounded-3xl bg-[#090b0f] border border-neon-green/10 shadow-[0_5px_25px_rgba(35,255,20,0.03)] space-y-3.5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3.5 opacity-[0.03] text-neon-cyan pointer-events-none">
          <Cpu className="w-16 h-16" />
        </div>
        <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
          <div className="p-1 px-1.5 rounded-lg bg-neon-green/10 text-neon-green border border-neon-green/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <h4 className="text-[10px] font-black font-mono uppercase tracking-widest text-white">{t.insightsTitle}</h4>
        </div>
        
        <div className="space-y-2 text-xs font-semibold leading-relaxed text-white/70">
          <div className="flex gap-2 items-start shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-neon-green mt-1.5 shrink-0" />
            <p>{t.stableInsight}</p>
          </div>
          <div className="flex gap-2 items-start shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan mt-1.5 shrink-0" />
            <p>{t.optimalInsight}</p>
          </div>
          {scanCount > 0 && (
            <div className="flex gap-2 items-start shrink-0 pt-1 border-t border-white/[0.03]">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0 animate-ping" />
              <p className="text-white/80 font-bold">
                {lang === 'hi' 
                  ? `आपकी दैनिक स्कैन इतिहास गतिविधियों ने ${scanCount} सक्रिय ट्रे विश्लेषणों को सहेजा है।` 
                  : `Your daily scan histories recorded ${scanCount} active tray analysis updates.`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 5. ACHIEVEMENTS & BADGES SYSTEM */}
      <div className="p-5.5 rounded-3xl bg-surface/30 border border-white/5 space-y-4">
        <h3 className="text-xs font-black font-mono uppercase tracking-widest text-[#a1a1aa] flex items-center gap-2">
          <Award className="w-4 h-4 text-neon-green" />
          <span>{t.badgeTitle}</span>
        </h3>

        <div className="grid grid-cols-2 gap-3.5">
          {t.achievements.map((badge) => {
            const isUnlocked = 
              (badge.id === 'active' && scanCount >= 5) ||
              (badge.id === 'healthy' && colonyStatus !== 'Critical') ||
              (badge.id === 'expert' && scanCount > 1) ||
              (badge.id === 'stable' && avgTemp >= 25 && avgTemp <= 31);

            return (
              <motion.div
                key={badge.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => setActiveBadge(activeBadge === badge.id ? null : badge.id)}
                className={cn(
                  "p-4 rounded-2xl border transition-all cursor-pointer text-center relative overflow-hidden flex flex-col items-center justify-center min-h-[110px]",
                  isUnlocked 
                    ? "bg-black/50 border-neon-green/20 text-white shadow-[0_0_15px_rgba(57,255,20,0.05)]" 
                    : "bg-black/40 border-white/[0.03] text-white/20 select-none"
                )}
              >
                <div className={cn(
                  "text-3xl mb-2 filter transition-transform", 
                  isUnlocked ? "drop-shadow-[0_0_8px_#39FF14] scale-100" : "grayscale opacity-25 scale-90"
                )}>
                  {badge.icon}
                </div>
                <h4 className={cn(
                  "text-[10px] font-black uppercase tracking-wider text-center",
                  isUnlocked ? "text-white" : "text-white/30"
                )}>
                  {badge.title}
                </h4>
                
                {isUnlocked && (
                  <span className="text-[7px] font-mono text-neon-green uppercase tracking-widest font-extrabold mt-1">Unlocked</span>
                )}
                
                <AnimatePresence>
                  {activeBadge === badge.id && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute inset-0 bg-black/95 p-3 flex items-center justify-center text-center rounded-[1.3rem] border border-white/10"
                    >
                      <p className="text-[9px] font-semibold text-white/90 leading-tight">
                        {badge.desc}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 6. TELEMETRY COGNITIVE HEARTBEAT BANNER */}
      <div className="p-4 rounded-3xl bg-[#030303]/60 border border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Terminal className="w-4 h-4 text-neon-green animate-pulse" />
          <div>
            <span className="text-[9.5px]/none font-black font-mono uppercase tracking-widest text-white block">COGNITIVE SYNC STATUS</span>
            <span className="text-[8px] font-mono uppercase tracking-widest text-[#00E5FF] mt-0.5 block">LATEST HANDSHAKE STABLE</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[8.5px] font-mono text-neon-green font-bold uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-ping mr-0.5" />
          ONLINE SECURE
        </div>
      </div>

      {/* 7. REAL-TIME ACTIVITY FEED AND ANALYTICS LOGS */}
      <div className="p-5 rounded-3xl bg-[#090b0f]/65 border border-white/5 space-y-4">
        <h3 className="text-xs font-black font-mono uppercase tracking-widest text-[#a1a1aa] flex items-center gap-2">
          <Clock className="w-4 h-4 text-neon-green" />
          <span>{t.logsTitle}</span>
        </h3>

        <div className="space-y-3 pt-1">
          {activities.length > 0 ? (
            activities.map((act) => {
              const ActIcon = act.icon;
              return (
                <div key={act.id} className="flex gap-3 items-center p-3 rounded-2xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] transition-all">
                  <div className={cn("p-2 rounded-xl bg-white/5", act.color)}>
                    <ActIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-extrabold text-white truncate">{act.title}</p>
                    <p className="text-[10px] text-white/45 truncate leading-relaxed mt-0.5">{act.desc}</p>
                  </div>
                  <span className="text-[9px] font-mono text-white/30 shrink-0 font-bold">{act.timestamp}</span>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-white/30 text-xs font-mono">
              [ NO RECENT AGRI ANALYTICS RETRIEVED ]
            </div>
          )}
        </div>
      </div>

      {/* 8. EDIT PROFILE MODAL DIALOG OVERLAY */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm pointer-events-auto">
            <motion.div 
              initial={{ scale: 0.93, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.93, opacity: 0 }}
              className="w-full max-w-sm p-6.5 rounded-[2.5rem] bg-[#090b0f] border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.95)] space-y-5"
            >
              <div className="text-center">
                <h3 className="text-lg font-black tracking-tight font-display text-white">{t.editBtn}</h3>
                <p className="text-[8.5px] font-mono uppercase tracking-[0.22em] text-neon-cyan mt-1">FlyMind Bio-Link Terminal</p>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-3.5">
                {/* Full name input */}
                <div>
                  <label className="text-[9px] font-mono font-black text-white/50 uppercase tracking-widest block mb-1">Full Operator Name</label>
                  <input 
                    type="text" 
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    required
                    className="w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-neon-green/45 text-semibold"
                  />
                </div>

                {/* Farm identities */}
                <div>
                  <label className="text-[9px] font-mono font-black text-white/50 uppercase tracking-widest block mb-1">Farm/Cluster Identity</label>
                  <input 
                    type="text" 
                    value={editForm.farmName}
                    onChange={(e) => setEditForm({...editForm, farmName: e.target.value})}
                    required
                    className="w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-neon-green/45 text-semibold"
                  />
                </div>

                {/* Farm locations */}
                <div>
                  <label className="text-[9px] font-mono font-black text-white/50 uppercase tracking-widest block mb-1">Grid Coordinates / Location</label>
                  <input 
                    type="text" 
                    value={editForm.farmLocation}
                    onChange={(e) => setEditForm({...editForm, farmLocation: e.target.value})}
                    required
                    className="w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-neon-green/45 text-semibold"
                  />
                </div>

                 {/* Experience Card Selector */}
                <div className="space-y-2">
                  <label className="text-[9px] font-mono font-black text-white/50 uppercase tracking-widest block mb-1">Farming Experience Level</label>
                  
                  {(() => {
                    const LEVELS_OPTIONS = [
                      {
                        id: 'Beginner Farmer',
                        label: 'Beginner Farmer',
                        icon: '🌱',
                        desc: 'New to BSF farming and learning basics.'
                      },
                      {
                        id: 'Intermediate Farmer',
                        label: 'Intermediate Farmer',
                        icon: '📊',
                        desc: 'Understands basic farming and tracking.'
                      },
                      {
                        id: 'Advanced Farmer',
                        label: 'Advanced Farmer',
                        icon: '🧪',
                        desc: 'Uses climate tracking, biology scanning, and monitoring.'
                      },
                      {
                        id: 'Professional BSF Farmer',
                        label: 'Professional BSF Farmer',
                        icon: '🏭',
                        desc: 'Handles large-scale or advanced industrial operations.'
                      }
                    ];
                    const selectedLevel = LEVELS_OPTIONS.find(l => l.id === editForm.experienceLevel) || LEVELS_OPTIONS[3];

                    return (
                      <div className="relative">
                        {/* Currently Selected Card (Trigger) */}
                        <div
                          onClick={() => setIsExperienceOpen(!isExperienceOpen)}
                          className="p-3.5 rounded-2xl border border-neon-green/30 bg-black/40 hover:bg-white/[0.04] hover:border-neon-green/50 transition-all cursor-pointer flex items-center justify-between relative overflow-hidden active:scale-[0.99] select-none group shadow-[0_0_15px_rgba(57,255,20,0.04)]"
                        >
                          <div className="flex gap-3 items-center">
                            <div className="p-2 rounded-xl text-lg bg-neon-green/10 text-white flex items-center justify-center shrink-0 w-10 h-10 border border-neon-green/15 group-hover:scale-105 transition-transform">
                              {selectedLevel.icon}
                            </div>
                            <div className="space-y-0.5 text-left">
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-black tracking-tight text-white group-hover:text-neon-green transition-colors">
                                  {selectedLevel.label}
                                </h4>
                                <span className="text-[7px] font-mono font-bold uppercase text-neon-green px-1 py-0.5 rounded bg-neon-green/10 border border-neon-green/20">SELECTED</span>
                              </div>
                              <p className="text-[10px] text-white/50 font-medium leading-tight line-clamp-1">
                                {selectedLevel.desc}
                              </p>
                            </div>
                          </div>
                          
                          <div className="p-1 px-1.5 text-white/30 group-hover:text-neon-green transition-colors flex items-center gap-1">
                            <span className="text-[9px] font-mono font-black uppercase text-white/40 group-hover:text-neon-green/80 select-none">Change</span>
                            <motion.svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              animate={{ rotate: isExperienceOpen ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <path d="m6 9 6 6 6-6"/>
                            </motion.svg>
                          </div>
                        </div>

                        {/* Dropdown Options Popup Modal using AnimatePresence */}
                        <AnimatePresence>
                          {isExperienceOpen && (
                            <>
                              {/* Full overlay within screen boundary for backdrop dismiss */}
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsExperienceOpen(false)}
                                className="fixed inset-0 bg-black/70 backdrop-blur-md z-45 transition-all"
                              />

                              {/* Responsive bottom-sheet / dialog overlay */}
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                                transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
                                className="fixed bottom-0 left-0 right-0 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full max-w-[92%] sm:max-w-md bg-[#0a0c10]/98 border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 shadow-[0_15px_50px_rgba(0,0,0,0.95),0_0_30px_rgba(57,255,20,0.06)] z-50 backdrop-blur-2xl space-y-4 max-h-[85vh] flex flex-col mx-auto mb-0 sm:mb-auto"
                              >
                                <div className="flex items-center justify-between pb-3.5 border-b border-white/5 shrink-0">
                                  <div className="space-y-0.5">
                                    <h3 className="text-sm font-black text-white tracking-wider uppercase font-display flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 bg-neon-green rounded-full animate-ping" />
                                      Experience Profile
                                    </h3>
                                    <p className="text-[9px] font-mono text-neon-cyan tracking-widest uppercase">Aligns diagnostic tone & insights</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setIsExperienceOpen(false)}
                                    className="p-1.5 px-3 rounded-xl bg-white/5 border border-white/10 font-mono text-[9px] font-black uppercase text-white/55 hover:text-neon-cyan hover:border-neon-cyan/40 transition-all cursor-pointer select-none active:scale-95"
                                  >
                                    Dismiss
                                  </button>
                                </div>

                                <div className="space-y-2 overflow-y-auto pr-0.5 custom-scrollbar pb-1">
                                  {LEVELS_OPTIONS.map((level) => {
                                    const isSelected = editForm.experienceLevel === level.id;
                                    return (
                                      <motion.div
                                        whileTap={{ scale: 0.98 }}
                                        key={level.id}
                                        onClick={() => {
                                          setEditForm({ ...editForm, experienceLevel: level.id });
                                          setIsExperienceOpen(false);
                                        }}
                                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex gap-3 text-left relative overflow-hidden group select-none ${
                                          isSelected 
                                            ? 'bg-gradient-to-tr from-neon-green/15 to-emerald-500/5 border-neon-green shadow-[0_0_15px_rgba(57,255,20,0.15)]'
                                            : 'bg-white/[0.02] border-white/5 hover:border-white/15 hover:bg-white/[0.05]'
                                        }`}
                                      >
                                        <div className={`p-2 rounded-xl text-lg flex items-center justify-center shrink-0 w-10 h-10 border transition-all ${
                                          isSelected 
                                            ? 'bg-neon-green/10 text-white border-neon-green/30' 
                                            : 'bg-white/5 text-white/40 border-transparent'
                                        }`}>
                                          {level.icon}
                                        </div>
                                        <div className="space-y-0.5 pr-8">
                                          <h4 className={`text-xs font-black tracking-tight transition-colors ${isSelected ? 'text-neon-green' : 'text-white'}`}>
                                            {level.label}
                                          </h4>
                                          <p className="text-[10px] text-white/45 font-medium leading-tight">
                                            {level.desc}
                                          </p>
                                        </div>
                                        {isSelected && (
                                          <span className="absolute top-1/2 -translate-y-1/2 right-4 w-4 h-4 bg-neon-green rounded-full shadow-[0_0_10px_#39FF14] flex items-center justify-center">
                                            <Check className="w-2.5 h-2.5 text-black stroke-[3.5]" />
                                          </span>
                                        )}
                                      </motion.div>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })()}
                </div>

                {/* Button triggers */}
                <div className="flex gap-3 pt-3">
                  <button 
                    type="button" 
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-3 bg-white/5 text-white/60 hover:text-white rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    {t.cancelBtn}
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-3 bg-neon-green text-black font-black rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(57,255,20,0.3)] hover:scale-103 active:scale-97"
                  >
                    {t.saveBtn}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 9. AVATAR SELECTOR / UPLOADER SHEET */}
      <AnimatePresence>
        {showAvatarChooser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm pointer-events-auto">
            <motion.div 
              initial={{ scale: 0.93, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.93, opacity: 0 }}
              className="w-full max-w-sm p-6.5 rounded-[2.5rem] bg-[#090b0f] border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.95)] space-y-5"
            >
              <div className="text-center">
                <h3 className="text-lg font-black tracking-tight font-display text-white">Choose Agri Operator ID</h3>
                <p className="text-[8.5px] font-mono uppercase tracking-[0.22em] text-neon-cyan mt-1">Biotechnology Identity Config</p>
              </div>

              {/* Standard preset cards */}
              <div className="grid grid-cols-2 gap-3">
                {AVATAR_OPTIONS.map((av) => (
                  <button
                    key={av.id}
                    onClick={async () => {
                      setProfile(p => ({
                        ...p,
                        selectedAvatarId: av.id,
                        customAvatarBase64: undefined // Clear base64 if preset is chosen
                      }));
                      setShowAvatarChooser(false);

                      const currentUser = auth.currentUser;
                      if (currentUser) {
                        try {
                          const userRef = doc(db, 'users', currentUser.uid);
                          await setDoc(userRef, {
                            selectedAvatarId: av.id,
                            customAvatarBase64: null // Reset base64 on preset selection
                          }, { merge: true });
                        } catch (err) {
                          console.error("Failed to sync preset choice to Firestore", err);
                        }
                      }
                    }}
                    className={cn(
                      "p-4 rounded-2xl bg-white/[0.02] border transition-all hover:bg-white/[0.04] flex flex-col items-center justify-center gap-1.5 cursor-pointer",
                      profile.selectedAvatarId === av.id && !profile.customAvatarBase64 
                        ? "border-neon-green ring-1 ring-neon-green/30" 
                        : "border-white/5"
                    )}
                  >
                    <span className="text-3xl">{av.icon}</span>
                    <span className="text-[10px] font-black uppercase text-white/80">{av.label}</span>
                  </button>
                ))}
              </div>

              {/* Custom Image choice option */}
              <div className="pt-2 border-t border-white/5">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
                <button
                  onClick={triggerImageUpload}
                  className="w-full py-3.5 bg-neon-cyan/10 hover:bg-neon-cyan/15 border border-neon-cyan/20 text-neon-cyan hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-97"
                >
                  <Camera className="w-4 h-4 text-neon-cyan" />
                  <span>{t.customAvatarLabel}</span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAvatarChooser(false)}
                  className="w-full py-3.5 bg-white/5 text-white/50 hover:text-white border border-white/5 hover:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
