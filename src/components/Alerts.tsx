import React, { useState, useEffect } from 'react';
import { 
  Bell, AlertTriangle, Thermometer, Droplets, Zap, 
  CheckCircle2, MoreHorizontal, Wind, AlertCircle, 
  ShieldAlert, Info, Loader2, Signal, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';
import { db, auth, messaging } from '../lib/firebase';
import { cn } from '../lib/utils';
import { getToken } from 'firebase/messaging';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  icon: any;
  title: string;
  msg: string;
  time: string;
  color: string;
  bg: string;
  priority?: string;
  hiMsg?: string;
  soundType?: string;
}

interface AlertsProps {
  onNavigate?: (tab: 'home' | 'scan' | 'tracker' | 'alerts' | 'settings') => void;
}

export default function Alerts({ onNavigate }: AlertsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission>('default');

  // Interactive local states for Dismiss and Acknowledge
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

  const [historyLog, setHistoryLog] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('flymind_alerts_history');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Track settings changes
  const [settingsVersion, setSettingsVersion] = useState(0);

  useEffect(() => {
    const handleSettingsUpdate = () => {
      setSettingsVersion(v => v + 1);
    };
    window.addEventListener('flymind_settings_update', handleSettingsUpdate);
    return () => window.removeEventListener('flymind_settings_update', handleSettingsUpdate);
  }, []);

  const handleDismiss = (alertId: string, alertTitle: string, alertMsg: string) => {
    const updated = [...dismissedAlerts, alertId];
    setDismissedAlerts(updated);
    localStorage.setItem('flymind_dismissed_alerts', JSON.stringify(updated));

    // Save action details to history
    saveToHistory(alertTitle, alertMsg, 'dismissed');
  };

  const handleAcknowledge = (alertId: string, alertTitle: string, alertMsg: string) => {
    const updated = [...acknowledgedAlerts, alertId];
    setAcknowledgedAlerts(updated);
    localStorage.setItem('flymind_acknowledged_alerts', JSON.stringify(updated));

    // Save action details to history
    saveToHistory(alertTitle, alertMsg, 'acknowledged');
  };

  const saveToHistory = (title: string, msg: string, actionType: 'dismissed' | 'acknowledged') => {
    try {
      const saved = localStorage.getItem('flymind_alerts_history');
      const history = saved ? JSON.parse(saved) : [];
      const newEntry = {
        title,
        msg,
        actionType,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) + ' ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
      const updated = [newEntry, ...history];
      localStorage.setItem('flymind_alerts_history', JSON.stringify(updated));
      setHistoryLog(updated);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationStatus(Notification.permission);
    }

    if (!auth.currentUser) return;

    const path = `users/${auth.currentUser.uid}/farmlogs`;
    const q = query(
      collection(db, path),
      orderBy('date', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs;
      const generatedAlerts: Alert[] = [];

      // Load settings-configured thresholds with standard fallbacks
      const highTempThr = Number(localStorage.getItem('flymind_high_temp_limit') || 33);
      const lowTempThr = Number(localStorage.getItem('flymind_low_temp_limit') || 22);
      const highHumThr = Number(localStorage.getItem('flymind_high_humidity_limit') || 85);
      const lowHumThr = Number(localStorage.getItem('flymind_low_humidity_limit') || 45);

      logs.forEach((doc) => {
        const latest = doc.data();
        const logId = doc.id;
        const notesStr = (latest.notes || "").toLowerCase();
        const condStr = (latest.larvaeCondition || "").toLowerCase();
        const feedTypeStr = (latest.feedType || "").toLowerCase();

        // 1. High Temperature
        if (latest.temp > highTempThr) {
          generatedAlerts.push({
            id: `temp-high-${logId}`,
            type: 'critical',
            priority: 'red',
            icon: Thermometer,
            title: 'Facility Overheat Alarm / कड़ा तापमान चेतावनी 🚨',
            msg: `Critical temperature of ${latest.temp}°C detected, exceeding set limit bounds of ${highTempThr}°C. Substrates are warming rapidly!`,
            hiMsg: `चेतावनी: तापमान ${latest.temp}°C ने सुरक्षा सीमा ${highTempThr}°C को पार कर लिया है। ट्रे गर्म हो रही हैं!`,
            color: 'text-red-500',
            bg: 'bg-red-500/10',
            time: 'Live'
          });
        }

        // 2. Low Temperature
        if (latest.temp < lowTempThr) {
          generatedAlerts.push({
            id: `temp-low-${logId}`,
            type: 'warning',
            priority: 'yellow',
            icon: Thermometer,
            title: 'Incubator Chill Wave / ठंड होने की चेतावनी ❄️',
            msg: `Chilling temp of ${latest.temp}°C registered, dropping below limit bounds (${lowTempThr}°C). Larvae growth will stall.`,
            hiMsg: `चेतावनी: तापमान ${latest.temp}°C दर्ज किया गया है। विकास चक्र धीमा हो जाएगा!`,
            color: 'text-orange-500',
            bg: 'bg-orange-500/10',
            time: 'Live'
          });
        }

        // 3. High Humidity
        if (latest.humidity > highHumThr) {
          generatedAlerts.push({
            id: `hum-high-${logId}`,
            type: 'warning',
            priority: 'yellow',
            icon: Droplets,
            title: 'Bedding Over-Moisture / अधिक नमी ⚠️',
            msg: `Substrate relative moisture has climbed to ${latest.humidity}%, exceeding maximum safe limits of ${highHumThr}%. Humidity too high. Fungus risk increasing.`,
            hiMsg: `चेतावनी: नमी का स्तर ${latest.humidity}% है, जो सीमा ${highHumThr}% से अधिक है। फंगस लग सकती है!`,
            color: 'text-orange-500',
            bg: 'bg-orange-500/10',
            time: 'Live'
          });
        }

        // 4. Low Humidity
        if (latest.humidity < lowHumThr) {
          generatedAlerts.push({
            id: `hum-low-${logId}`,
            type: 'critical',
            priority: 'red',
            icon: Droplets,
            title: 'Extreme Dehydration Warning / सूखापन संकट 🏜️',
            msg: `Substrate moisture has plunged to ${latest.humidity}%, dropping below set boundary limits of ${lowHumThr}%.`,
            hiMsg: `गंभीर चेतावनी: ट्रे की नमी ${latest.humidity}% तक गिर गई है, जो न्यूनतम सुरक्षा सीमा से कम है!`,
            color: 'text-red-500',
            bg: 'bg-red-500/10',
            time: 'Live'
          });
        }

        // 5. Fungus Detection
        if (notesStr.includes("fungus") || condStr.includes("fungus") || feedTypeStr.includes("fungus")) {
          generatedAlerts.push({
            id: `hazard-fungus-${logId}`,
            type: 'critical',
            priority: 'red',
            icon: AlertTriangle,
            title: 'Fungus Spore Infection / कवक संदूषण 🍄',
            msg: 'Humidity too high. Fungus risk increasing.',
            hiMsg: 'नमी बहुत अधिक है। कवक (फंगस) का कवकजाल तेजी से बढ़ रहा है। ट्रे बदलें!',
            color: 'text-red-500',
            bg: 'bg-red-500/10',
            time: 'Live'
          });
        }

        // 6. Mold Risk
        if (notesStr.includes("mold") || notesStr.includes("mould") || notesStr.includes("mildew") || condStr.includes("mold") || condStr.includes("mould")) {
          generatedAlerts.push({
            id: `hazard-mold-${logId}`,
            type: 'warning',
            priority: 'yellow',
            icon: AlertTriangle,
            title: 'Active Mold Bloom Risk / फूई (फपूँदी) का खतरा ⚠️',
            msg: 'Sour anaerobic mold risk detected. Please aerate the bed and break substrate crusts.',
            hiMsg: 'अम्लीय फंगस परत का जोखिम: कृपया ट्रे को हिलाएं और ताजी हवा दें!',
            color: 'text-orange-500',
            bg: 'bg-orange-500/10',
            time: 'Live'
          });
        }

        // 7. Overcrowding
        if (condStr.includes("crowd") || condStr.includes("overcrowd") || notesStr.includes("crowd") || notesStr.includes("overcrowd")) {
          generatedAlerts.push({
            id: `hazard-crowd-${logId}`,
            type: 'warning',
            priority: 'yellow',
            icon: ShieldAlert,
            title: 'Larvae Overcrowding Detected / अत्यधिक घनी आबादी ⚠️',
            msg: 'Larvae overcrowding detected. Reduce tray density.',
            hiMsg: 'चेतावनी: कीड़ों की बहुत घनी आबादी है। कीड़ों को दूसरी ट्रे में विभाजित करें!',
            color: 'text-yellow-500',
            bg: 'bg-yellow-500/10',
            time: 'Live'
          });
        }

        // 8. Sluggish Larvae
        if (condStr.includes("sluggish") || notesStr.includes("sluggish")) {
          generatedAlerts.push({
            id: `hazard-sluggish-${logId}`,
            type: 'warning',
            priority: 'yellow',
            icon: AlertCircle,
            title: 'Sluggish Larval Activity / सुस्त गतिविधि 🐛',
            msg: 'Larvae movement low. Check oxygen and moisture.',
            hiMsg: 'चेतावनी: सुस्त कीड़े पाए गए। वेंटिलेशन और नमी की जाँच करें!',
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            time: 'Live'
          });
        }

        // 9. Prepupa Migration Stage (Green = Safe)
        if (condStr.includes("prepupa") || condStr.includes("pupa") || condStr.includes("harvest") || notesStr.includes("prepupa") || notesStr.includes("pupa") || notesStr.includes("harvest")) {
          generatedAlerts.push({
            id: `stage-prepupa-${logId}`,
            type: 'success',
            priority: 'green',
            icon: Zap,
            title: 'Prepupa Migration Stage / प्री-प्यूपा विकास चरण 🌱',
            msg: 'Prepupa migration stage detected.',
            hiMsg: 'प्री-प्यूपा प्रवास अवस्था का पता चला है। इन्हें शुष्क क्रॉल-आउट ट्रे में स्थानांतरित करें।',
            color: 'text-neon-green',
            bg: 'bg-neon-green/10',
            time: 'Optimal'
          });
        }

        // 10. Feed Rotten Detection
        if (notesStr.includes("rotten") || notesStr.includes("rot") || notesStr.includes("decay") || notesStr.includes("sour") || feedTypeStr.includes("rot")) {
          generatedAlerts.push({
            id: `hazard-rot-${logId}`,
            type: 'critical',
            priority: 'red',
            icon: AlertTriangle,
            title: 'Soured Feed Warning / सड़ा हुआ भोजन संकट 🤢',
            msg: 'Feed appears rotten. Replace immediately.',
            hiMsg: 'चारा सड़ चुका है! बैक्टीरिया कवक से कीड़ों की रक्षा हेतु तुरंत चारा हटाएँ!',
            color: 'text-red-500',
            bg: 'bg-red-500/10',
            time: 'Live'
          });
        }

        // 11. Dead Larvae Detection
        if (notesStr.includes("dead") || notesStr.includes("death") || condStr.includes("dead") || condStr.includes("dormant") && (latest.temp < lowTempThr || notesStr.includes("mortality"))) {
          generatedAlerts.push({
            id: `hazard-dead-${logId}`,
            type: 'critical',
            priority: 'red',
            icon: ShieldAlert,
            title: 'Larvae Mortality Alarm / मृत संक्रमण संकट 🚨',
            msg: 'Critical - Mass decomposition or dead larvae detected. Sanitize breeding rows.',
            hiMsg: 'गंभीर शिकायत: मृत कीड़ों का पता चला है। संक्रमण फ़ैल सकता है, साफ-सफाई करें!',
            color: 'text-red-500',
            bg: 'bg-red-500/10',
            time: 'Live'
          });
        }

        // 12. Low Activity Warning
        if (condStr.includes("dormant") || notesStr.includes("low activity") || notesStr.includes("dormant") || notesStr.includes("inactive")) {
          generatedAlerts.push({
            id: `status-low-activity-${logId}`,
            type: 'warning',
            priority: 'yellow',
            icon: AlertCircle,
            title: 'Low Activity Warning / निम्न कीड़ा सक्रियता 💤',
            msg: 'Larvae movement low. Check moisture and tray parameters.',
            hiMsg: 'कीड़ों की सक्रियता सामान्य से काफी कम है! आर्द्रता और ऑक्सीजन को बढ़ाएँ।',
            color: 'text-orange-500',
            bg: 'bg-orange-500/10',
            time: 'Live'
          });
        }
      });

      // Add default "System Safe" if no active alerts
      if (generatedAlerts.length === 0) {
        generatedAlerts.push({
          id: 'safe',
          type: 'success',
          priority: 'green',
          icon: CheckCircle2,
          title: 'System Optimal',
          msg: 'All biomarkers within standard operating range. Environmental conditions fully stable.',
          hiMsg: 'सभी जैविक संकेतक सामान्य सीमा में हैं। वातावरण पूर्णतः अनुकूल है।',
          time: 'Active',
          color: 'text-neon-green',
          bg: 'bg-neon-green/10'
        });
      }

      setAlerts(generatedAlerts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [dismissedAlerts, settingsVersion]);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationStatus(permission);
    if (permission === 'granted' && messaging) {
      try {
        const token = await getToken(messaging, { vapidKey: 'YOUR_PUBLIC_VAPID_KEY' });
        console.log('FCM Token:', token);
      } catch (e) {
        console.error('FCM Token Error:', e);
      }
    }
  };

  const activeAlerts = alerts.filter(a => !dismissedAlerts.includes(a.id));

  return (
    <div className="space-y-6">
      <section className="flex justify-between items-center">
        <div>
          <p className="text-neon-green text-xs font-mono tracking-widest uppercase mb-1">Signal Center</p>
          <h2 className="text-2xl font-bold">System Alerts</h2>
        </div>
        <div className="flex gap-2">
          {notificationStatus !== 'granted' && (
            <button 
              onClick={requestNotificationPermission}
              className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-all flex items-center gap-2"
            >
              <Bell className="w-3 h-3" />
              Enable Push
            </button>
          )}
          <button 
            onClick={() => onNavigate?.('settings')}
            className="px-3 py-1 bg-neon-green/10 border border-neon-green/20 rounded-lg text-[10px] font-bold uppercase tracking-widest text-neon-green hover:bg-neon-green/20 transition-all flex items-center gap-1 cursor-pointer"
          >
            Config Limits
          </button>
        </div>
      </section>

      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-neon-green opacity-20" />
            <p className="text-[10px] uppercase tracking-widest text-white/20 font-mono">Syncing biological signals...</p>
          </div>
        ) : activeAlerts.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 bg-white/2 border border-dashed border-white/5 rounded-3xl p-6 text-white/40 font-mono text-xs uppercase space-y-2"
          >
            <CheckCircle2 className="w-10 h-10 text-neon-green mx-auto mb-2 opacity-60 drop-shadow-[0_0_10px_#39FF1444]" />
            <h3 className="font-bold text-white/80">No Active Alerts</h3>
            <p className="text-[10px] text-white/20">All signals are safe & history has been successfully archived.</p>
          </motion.div>
        ) : activeAlerts.map(alert => {
          const Icon = alert.icon;
          const isAcknowledged = acknowledgedAlerts.includes(alert.id);
          
          return (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              key={alert.id} 
              className={cn(
                "p-5 rounded-3xl border flex gap-5 transition-all relative overflow-hidden group",
                isAcknowledged ? "border-neon-green/20 bg-neon-green/5" :
                alert.type === 'critical' ? "border-red-500/30 bg-red-500/5 hover:border-red-500/50" : 
                alert.type === 'warning' ? "border-orange-500/30 bg-orange-500/5 hover:border-orange-500/50" :
                alert.type === 'success' ? "border-neon-green/20 bg-neon-green/5" :
                "border-white/10 bg-surface"
              )}
            >
              <div className={cn("p-3 h-fit rounded-2xl flex items-center justify-center", alert.bg)}>
                <Icon className={cn("w-6 h-6", alert.color)} />
              </div>
              <div className="flex-1 space-y-1 z-10">
                <div className="flex justify-between items-start">
                  <h3 className={cn("font-bold text-sm tracking-tight", alert.color)}>{alert.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-white/40 uppercase tracking-tighter">{alert.time}</span>
                    <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", 
                      isAcknowledged ? "bg-neon-green" :
                      alert.type === 'critical' ? "bg-red-500" : 
                      alert.type === 'warning' ? "bg-orange-500" : "bg-neon-green"
                    )} />
                  </div>
                </div>
                <p className="text-sm text-white/70 leading-relaxed font-medium">
                  {alert.msg}
                </p>
                
                <div className="pt-4 flex gap-2">
                  {isAcknowledged ? (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-neon-green font-mono py-2 bg-neon-green/10 px-3.5 rounded-xl border border-neon-green/20">
                      <CheckCircle2 className="w-3.5 h-3.5 text-neon-green" />
                      <span>Acknowledged [✓]</span>
                    </div>
                  ) : alert.id === 'safe' ? (
                    <button 
                      onClick={() => onNavigate?.('tracker')}
                      className="text-[10px] font-bold uppercase tracking-[0.15em] py-2 px-4 rounded-xl bg-neon-green text-black hover:opacity-90 transition-all cursor-pointer"
                    >
                      View Live Stats
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleDismiss(alert.id, alert.title, alert.msg)}
                        className="text-[10px] font-bold uppercase tracking-[0.15em] py-2 px-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-white/60 cursor-pointer"
                      >
                        Dismiss
                      </button>
                      <button 
                        onClick={() => handleAcknowledge(alert.id, alert.title, alert.msg)}
                        className="text-[10px] font-bold uppercase tracking-[0.15em] py-2 px-4 rounded-xl bg-neon-green text-black hover:shadow-[0_0_12px_#39FF1444] transition-all cursor-pointer"
                      >
                        Acknowledge
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {/* Subtle background glow */}
              <div className={cn(
                "absolute -right-8 -top-8 w-24 h-24 blur-[60px] opacity-10 pointer-events-none transition-opacity group-hover:opacity-25",
                isAcknowledged ? "bg-neon-green" :
                alert.type === 'critical' ? "bg-red-500" : 
                alert.type === 'warning' ? "bg-orange-500" : "bg-neon-green"
              )} />
            </motion.div>
          );
        })}
      </div>

      {/* Historical Alert Log collapsible card */}
      <div className="bg-white/2 border border-white/5 rounded-3xl p-5 space-y-4">
        <div className="flex justify-between items-center cursor-pointer select-none" onClick={() => setIsHistoryOpen(!isHistoryOpen)}>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-neon-green" />
            <h3 className="font-bold text-sm text-white/80">Archived Alert History ({historyLog.length})</h3>
          </div>
          <p className="text-[10px] text-neon-green font-mono uppercase hover:underline">
            {isHistoryOpen ? "Hide Log" : "Show Log"}
          </p>
        </div>

        {isHistoryOpen && (
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {historyLog.length === 0 ? (
              <p className="text-center py-6 text-[10px] text-white/25 font-mono uppercase">No logged history</p>
            ) : (
              historyLog.map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-white/1 border border-white/5 flex justify-between items-start text-xs">
                  <div className="space-y-1">
                    <h4 className="font-bold text-white/90">{item.title}</h4>
                    <p className="text-white/55 text-[11px] leading-relaxed">{item.msg}</p>
                    <div className="flex items-center gap-2 pt-1 font-mono text-[9px] text-white/30 uppercase">
                      <span>{item.timestamp}</span>
                      <span>•</span>
                      <span className={item.actionType === 'acknowledged' ? "text-neon-green font-bold" : "text-white/40"}>
                        {item.actionType}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="p-4 rounded-2xl bg-white/2 border border-dashed border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Signal className="w-4 h-4 text-white/20" />
          <p className="text-[10px] text-white/40 uppercase font-mono">Neural Link Latency: 12ms</p>
        </div>
        <p className="text-[10px] text-neon-green/60 font-mono font-bold hover:underline cursor-pointer" onClick={() => onNavigate?.('settings')}>Settings Panel</p>
      </div>
    </div>
  );
}

const Waves = (props: any) => (
  <svg 
    {...props}
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
  >
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
    <polyline points="7.5 19.79 7.5 14.6 3 12" />
    <polyline points="21 12 16.5 14.6 16.5 19.79" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);
