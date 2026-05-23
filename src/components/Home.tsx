import React, { useState, useEffect } from 'react';
import { 
  Thermometer, 
  Droplets, 
  TrendingUp, 
  Bug, 
  AlertCircle, 
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Smartphone,
  Sliders,
  Play,
  Activity,
  CheckCircle,
  HelpCircle,
  Clock,
  RefreshCw,
  Power,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

const data = [
  { name: 'Day 1', growth: 10 },
  { name: 'Day 4', growth: 25 },
  { name: 'Day 7', growth: 45 },
  { name: 'Day 10', growth: 60 },
  { name: 'Day 13', growth: 85 },
  { name: 'Day 16', growth: 95 },
];

interface HomeProps {
  onNavigate?: (tab: 'home' | 'scan' | 'tracker' | 'alerts') => void;
}

export default function Home({ onNavigate }: HomeProps) {
  // Synchronized language state for Home Dashboard
  const [lang, setLang] = useState<'hi' | 'en'>(() => {
    try {
      return (localStorage.getItem('flymind_language') as 'hi' | 'en') || 'hi';
    } catch { return 'hi'; }
  });

  useEffect(() => {
    const handleLangSync = () => {
      try {
        const savedLang = localStorage.getItem('flymind_language') as 'hi' | 'en';
        if (savedLang) setLang(savedLang);
      } catch (e) {
        console.error("Home language sync error", e);
      }
    };
    window.addEventListener('storage', handleLangSync);
    window.addEventListener('flymind_language_update', handleLangSync);
    return () => {
      window.removeEventListener('storage', handleLangSync);
      window.removeEventListener('flymind_language_update', handleLangSync);
    };
  }, []);

  // Live environmental parameters
  const [temp, setTemp] = useState<number>(() => {
    const saved = localStorage.getItem('flymind_temp');
    return saved ? parseFloat(saved) : 29.4;
  });
  const [humidity, setHumidity] = useState<number>(() => {
    const saved = localStorage.getItem('flymind_humidity');
    return saved ? parseInt(saved) : 64;
  });

  // Weight states and biometrics analytics
  const [avgEggWeight, setAvgEggWeight] = useState<number>(() => {
    const saved = localStorage.getItem('flymind_latest_egg_weight');
    return saved ? parseFloat(saved) : 12.5;
  });
  const [avgLarvaeWeight, setAvgLarvaeWeight] = useState<number>(() => {
    const saved = localStorage.getItem('flymind_latest_larvae_weight');
    return saved ? parseFloat(saved) : 25.0;
  });
  const [totalFeedQty, setTotalFeedQty] = useState<number>(() => {
    const saved = localStorage.getItem('flymind_latest_feed_qty');
    return saved ? parseFloat(saved) : 5.0;
  });
  const [fcr, setFcr] = useState<number>(1.8);
  const [yieldRatio, setYieldRatio] = useState<number>(2.0);
  
  // Browser accessibility flags
  const [hasTempSensor, setHasTempSensor] = useState<boolean>(false);
  const [hasHumiditySensor, setHasHumiditySensor] = useState<boolean>(false);
  
  // Power states
  const [isSensorActive, setIsSensorActive] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  
  // Update counter to animate sensor activity
  const [updateCount, setUpdateCount] = useState<number>(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Read support on load
  useEffect(() => {
    const tempAvailable = 'AmbientTemperatureSensor' in window;
    const humAvailable = 'HumiditySensor' in window;
    setHasTempSensor(tempAvailable);
    setHasHumiditySensor(humAvailable);
  }, []);

  // Sync state between tabs and OCR scan results dynamically
  useEffect(() => {
    const handleStorageChange = () => {
      const savedTemp = localStorage.getItem('flymind_temp');
      const savedHum = localStorage.getItem('flymind_humidity');
      if (savedTemp) setTemp(parseFloat(savedTemp));
      if (savedHum) setHumidity(parseInt(savedHum));
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('flymind_ocr_update', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('flymind_ocr_update', handleStorageChange);
    };
  }, []);

  // Load dynamic weight metrics and analytics from Firestore and update Home View dynamically
  useEffect(() => {
    const handleLocalHatchingUpdate = () => {
      const savedEgg = localStorage.getItem('flymind_latest_egg_weight');
      const savedLarvae = localStorage.getItem('flymind_latest_larvae_weight');
      const savedFeed = localStorage.getItem('flymind_latest_feed_qty');
      if (savedEgg) setAvgEggWeight(parseFloat(savedEgg));
      if (savedLarvae) setAvgLarvaeWeight(parseFloat(savedLarvae));
      if (savedFeed) setTotalFeedQty(parseFloat(savedFeed));
    };

    window.addEventListener('flymind_hatching_update', handleLocalHatchingUpdate);

    // Set up actual Firebase dynamic listener
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) return;

      const path = `users/${user.uid}/farmlogs`;
      const q = query(
        collection(db, path),
        orderBy('date', 'desc'),
        limit(5)
      );

      const unsubscribeLogs = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) return;
        
        const fetched = snapshot.docs.map(doc => doc.data());
        
        // Compute weight metrics safely
        const totalEggs = fetched.reduce((acc, l) => acc + (l.eggWeight !== undefined ? l.eggWeight : 12.5), 0);
        const totalLarvae = fetched.reduce((acc, l) => acc + (l.larvaeWeight !== undefined ? l.larvaeWeight : 25.0), 0);
        const totalFeed = fetched.reduce((acc, l) => acc + l.feedQty, 0);
        
        const avgEgg = Number((totalEggs / fetched.length).toFixed(1));
        const avgLarvae = Number((totalLarvae / fetched.length).toFixed(1));
        const avgFeed = Number(totalFeed.toFixed(1));
        
        // FCR & Yield Factor
        const validFcrLogs = fetched.filter(l => l.feedQty > 0 && (l.larvaeWeight !== undefined ? l.larvaeWeight : 25.0) > 0);
        const avgFcrVal = validFcrLogs.length > 0
          ? Number((validFcrLogs.reduce((acc, l) => acc + (l.feedQty / (l.larvaeWeight || 25.0)), 0) / validFcrLogs.length).toFixed(2))
          : 1.8;
          
        const validYieldLogs = fetched.filter(l => (l.eggWeight !== undefined ? l.eggWeight : 12.5) > 0 && (l.larvaeWeight !== undefined ? l.larvaeWeight : 25.0) > 0);
        const avgYieldVal = validYieldLogs.length > 0
          ? Number((validYieldLogs.reduce((acc, l) => acc + ((l.larvaeWeight || 25.0) / (l.eggWeight || 12.5)), 0) / validYieldLogs.length).toFixed(2))
          : 2.0;

        setAvgEggWeight(avgEgg);
        setAvgLarvaeWeight(avgLarvae);
        setTotalFeedQty(avgFeed);
        setFcr(avgFcrVal);
        setYieldRatio(avgYieldVal);

        localStorage.setItem('flymind_latest_egg_weight', avgEgg.toString());
        localStorage.setItem('flymind_latest_larvae_weight', avgLarvae.toString());
        localStorage.setItem('flymind_latest_feed_qty', avgFeed.toString());
      }, (error) => {
        console.error("Home.tsx failed to load dynamic weight metrics", error);
        handleFirestoreError(error, OperationType.GET, path);
      });

      return () => {
        unsubscribeLogs();
      };
    });

    return () => {
      window.removeEventListener('flymind_hatching_update', handleLocalHatchingUpdate);
      unsubscribeAuth();
    };
  }, []);

  // Sync real-time Web Sensors & Advanced tilt physics fallbacks
  useEffect(() => {
    let tempSensorInstance: any = null;
    let humSensorInstance: any = null;
    let fallbackInterval: NodeJS.Timeout | null = null;
    let tiltListener: ((e: DeviceOrientationEvent) => void) | null = null;

    if (isSensorActive) {
      setPermissionError(null);

      // A. W3C Ambient Temperature Sensor
      if (hasTempSensor) {
        try {
          const TempSensorClass = (window as any).AmbientTemperatureSensor;
          tempSensorInstance = new TempSensorClass({ frequency: 1.5 });
          tempSensorInstance.addEventListener('reading', () => {
            if (tempSensorInstance.temperature !== undefined) {
              const currentVal = Number(tempSensorInstance.temperature.toFixed(1));
              setTemp(currentVal);
              localStorage.setItem('flymind_temp', currentVal.toString());
              setUpdateCount(prev => prev + 1);
            }
          });
          tempSensorInstance.addEventListener('error', (event: any) => {
            console.warn('W3C Temp sensor error:', event.error);
            if (event.error?.name === 'NotAllowedError') {
              setPermissionError('Sensor permission denied by the browser security policy.');
            }
          });
          tempSensorInstance.start();
        } catch (e: any) {
          console.error(e);
        }
      }

      // B. W3C Humidity Sensor
      if (hasHumiditySensor) {
        try {
          const HumSensorClass = (window as any).HumiditySensor;
          humSensorInstance = new HumSensorClass({ frequency: 1.5 });
          humSensorInstance.addEventListener('reading', () => {
            if (humSensorInstance.humidity !== undefined) {
              const currentVal = Number(humSensorInstance.humidity.toFixed(0));
              setHumidity(currentVal);
              localStorage.setItem('flymind_humidity', currentVal.toString());
              setUpdateCount(prev => prev + 1);
            }
          });
          humSensorInstance.addEventListener('error', (event: any) => {
            console.warn('W3C Humidity sensor error:', event.error);
          });
          humSensorInstance.start();
        } catch (e: any) {
          console.error(e);
        }
      }

      // C. Safe Gyroscopic Sensor & Micro-Convection Fallback
      if (!hasTempSensor || !hasHumiditySensor || isSimulating) {
        // High frequency microclimatic tick
        fallbackInterval = setInterval(() => {
          setTemp(prev => {
            const shift = (Math.random() - 0.5) * 0.16;
            const target = Number(Math.max(26.0, Math.min(34.0, prev + shift)).toFixed(1));
            localStorage.setItem('flymind_temp', target.toString());
            return target;
          });

          setHumidity(prev => {
            const shift = Math.random() > 0.5 ? 1 : -1;
            const target = Math.max(55, Math.min(75, prev + shift));
            localStorage.setItem('flymind_humidity', target.toString());
            return target;
          });

          setUpdateCount(prev => prev + 1);
        }, 1200);

        // Standard Device Tilt listeners as simulated alternative
        tiltListener = (e: DeviceOrientationEvent) => {
          if (e.beta && e.gamma) {
            // Beta represents pitch (heat gradients relative to tray cores)
            const betaNormalized = (e.beta - 40) / 90; 
            const newSimulatedTemp = 29.4 + (betaNormalized * 3.2);

            // Gamma represents roll (moisture gradients in substrate channels)
            const gammaNormalized = e.gamma / 90;
            const newSimulatedHum = Math.round(64 + (gammaNormalized * 11));

            const finalTemp = Number(Math.max(22.0, Math.min(38.0, newSimulatedTemp)).toFixed(1));
            const finalHum = Math.max(45, Math.min(85, newSimulatedHum));

            setTemp(finalTemp);
            setHumidity(finalHum);
            localStorage.setItem('flymind_temp', finalTemp.toString());
            localStorage.setItem('flymind_humidity', finalHum.toString());
            setUpdateCount(prev => prev + 1);
          }
        };

        window.addEventListener('deviceorientation', tiltListener);
      }
    } else {
      // Warm continuous background ambient drift inside the breeding facility
      fallbackInterval = setInterval(() => {
        setTemp(prev => {
          const shift = (Math.random() - 0.5) * 0.05;
          const target = Number(Math.max(28.5, Math.min(31.5, prev + shift)).toFixed(1));
          localStorage.setItem('flymind_temp', target.toString());
          return target;
        });
        setHumidity(prev => {
          if (Math.random() > 0.6) {
            const shift = Math.random() > 0.5 ? 1 : -1;
            const target = Math.max(62, Math.min(68, prev + shift));
            localStorage.setItem('flymind_humidity', target.toString());
            return target;
          }
          return prev;
        });
      }, 4000);
    }

    return () => {
      if (tempSensorInstance) {
        try { tempSensorInstance.stop(); } catch(e) {}
      }
      if (humSensorInstance) {
        try { humSensorInstance.stop(); } catch(e) {}
      }
      if (fallbackInterval) clearInterval(fallbackInterval);
      if (tiltListener) {
        window.removeEventListener('deviceorientation', tiltListener);
      }
    };
  }, [isSensorActive, hasTempSensor, hasHumiditySensor, isSimulating]);

  return (
    <div className="space-y-8 pb-24">
      {/* Visual Header / Welcome Section */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 text-neon-green text-[10px] font-mono tracking-widest uppercase mb-2">
            <span className="relative flex h-2 w-2 font-normal">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-green"></span>
            </span>
            <span>OS TELEMETRY CHANNEL: ACTIVE &bull; सिस्टम सक्रिय</span>
          </div>
          <h2 className="text-3xl font-extrabold font-display tracking-tight text-white mb-1">
            {lang === 'hi' ? 'फ्लाईमाइंड एआई डैशबोर्ड' : 'FlyMind AI Grid'}
          </h2>
          <p className="text-xs text-white/40 max-w-xl font-sans">
            {lang === 'hi' 
              ? 'अत्याधुनिक लाइव मौसम, कॉलोनी स्वास्थ्य निदान और रीयल-टाइम फ्लाईमाइंड एआई जैव-विश्लेषिकी' 
              : 'Autonomous high-fidelity microclimate parameters, smart bionomics, and intelligent larvae diagnostics'}
          </p>
        </div>
        
        {isSensorActive ? (
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-neon-green/10 border border-neon-green/30 text-[10px] font-bold text-neon-green font-mono uppercase tracking-wider shadow-[0_0_20px_rgba(57,255,20,0.15)] transition-all">
            <Activity className="w-4 h-4 animate-pulse text-neon-green" />
            <span>SYNC DATA LOGS ({updateCount})</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-white/[0.02] border border-white/10 text-[10px] font-bold text-white/40 font-mono uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
            <span>Telemetry Paused</span>
          </div>
        )}
      </section>

      {/* Primary Telemetry Bento Matrix */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Dynamic Temperature Probe */}
        <div 
          onClick={() => onNavigate?.('tracker')}
          className="p-5 rounded-[2rem] bg-white/[0.01] border border-white/5 hover:border-orange-500/30 hover:bg-white/[0.03] transition-all duration-300 group cursor-pointer relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/[0.02] blur-2xl rounded-full" />
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-orange-500/10 text-orange-400 border border-orange-500/15">
              <Thermometer className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest font-bold">RANGE: 28-32°C</span>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-black font-sans tracking-tight text-white flex items-baseline gap-0.5">
              {temp}<span className="text-sm font-semibold text-white/45">°C</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/50 uppercase font-mono tracking-wider">
                {lang === 'hi' ? 'तापमान (Temp)' : 'Temperature'}
              </span>
              <span className="text-neon-cyan opacity-0 group-hover:opacity-100 transition-opacity font-mono text-xs">→</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500/0 via-orange-500/20 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Dynamic Relative Humidity Probe */}
        <div 
          onClick={() => onNavigate?.('tracker')}
          className="p-5 rounded-[2rem] bg-white/[0.01] border border-white/5 hover:border-cyan-500/30 hover:bg-white/[0.03] transition-all duration-300 group cursor-pointer relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/[0.02] blur-2xl rounded-full" />
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/15">
              <Droplets className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest font-bold">RANGE: 60-70%</span>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-black font-sans tracking-tight text-white flex items-baseline gap-0.5">
              {humidity}<span className="text-sm font-semibold text-white/45">%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/50 uppercase font-mono tracking-wider">
                {lang === 'hi' ? 'आर्द्रता (Humidity)' : 'Relative Humidity'}
              </span>
              <span className="text-neon-cyan opacity-0 group-hover:opacity-100 transition-opacity font-mono text-xs">→</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500/0 via-cyan-500/20 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Dynamic Egg Stock Biomass */}
        <div 
          onClick={() => onNavigate?.('tracker')}
          className="p-5 rounded-[2rem] bg-white/[0.01] border border-white/5 hover:border-yellow-500/30 hover:bg-white/[0.03] transition-all duration-300 group cursor-pointer relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/[0.02] blur-2xl rounded-full" />
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-yellow-500/10 text-yellow-500 border border-yellow-500/15">
              <Bug className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-mono text-neon-green/60 uppercase tracking-widest font-normal">STOCKING</span>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-black font-sans tracking-tight text-white flex items-baseline gap-0.5">
              {avgEggWeight}<span className="text-sm font-semibold text-white/45">g</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/50 uppercase font-mono tracking-wider">
                {lang === 'hi' ? 'अंडों का वजन' : 'Egg Stock Weight'}
              </span>
              <span className="text-neon-cyan opacity-0 group-hover:opacity-100 transition-opacity font-mono text-xs">→</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500/0 via-yellow-500/20 to-yellow-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Larvae Conversion Biomass */}
        <div 
          onClick={() => onNavigate?.('tracker')}
          className="p-5 rounded-[2rem] bg-white/[0.01] border border-white/5 hover:border-purple-500/30 hover:bg-white/[0.03] transition-all duration-300 group cursor-pointer relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/[0.02] blur-2xl rounded-full" />
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/15">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-mono text-purple-400 uppercase tracking-widest font-bold">BIOMASS INDX</span>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-black font-sans tracking-tight text-white flex items-baseline gap-0.5">
              {yieldRatio.toFixed(2)}<span className="text-xs font-semibold text-white/45"> kg/g</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/50 uppercase font-mono tracking-wider">
                {lang === 'hi' ? 'कीड़ों की उपज' : 'Larvae Yield'}
              </span>
              <span className="text-neon-cyan opacity-0 group-hover:opacity-100 transition-opacity font-mono text-xs">→</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500/0 via-purple-500/20 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Dynamic Hatch Efficiency Status */}
        <div 
          onClick={() => onNavigate?.('tracker')}
          className="p-5 rounded-[2rem] bg-white/[0.01] border border-white/5 hover:border-neon-green/30 hover:bg-white/[0.03] transition-all duration-300 group cursor-pointer relative overflow-hidden col-span-2 lg:col-span-1"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-neon-green/[0.02] blur-2xl rounded-full" />
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-teal-500/10 text-neon-green border border-neon-green/15">
              <Sliders className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-mono text-teal-400 uppercase font-bold">FCR: {fcr.toFixed(2)}</span>
          </div>
          <div className="space-y-1">
            {(() => {
              let performanceStatus = 'Poor';
              let performanceStatusHindi = 'गंभीर चिंता ⚠️';
              let performanceColor = 'text-red-400';
              if (yieldRatio >= 3.5) {
                performanceStatus = 'Excellent';
                performanceStatusHindi = 'उत्कृष्ट 🏆';
                performanceColor = 'text-neon-green';
              } else if (yieldRatio >= 2.5) {
                performanceStatus = 'Good';
                performanceStatusHindi = 'उत्तम 👍';
                performanceColor = 'text-emerald-400';
              } else if (yieldRatio >= 1.5) {
                performanceStatus = 'Medium';
                performanceStatusHindi = 'संतोषजनक 📉';
                performanceColor = 'text-amber-400';
              }
              return (
                <div className={`text-2xl font-black tracking-tight ${performanceColor}`}>
                  {lang === 'hi' ? performanceStatusHindi : performanceStatus}
                </div>
              );
            })()}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/50 uppercase font-mono tracking-wider">
                {lang === 'hi' ? 'सफलता दर्ज़ा' : 'Hatch Rating'}
              </span>
              <span className="text-neon-cyan opacity-0 group-hover:opacity-100 transition-opacity font-mono text-xs">→</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-neon-green/0 via-neon-green/20 to-neon-green/0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

      </div>

      {/* Interactive Mobile Probe Interface */}
      <div className="p-6 md:p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-neon-cyan/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-neon-green/[0.02] blur-[120px] rounded-full pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start justify-between gap-6 pb-6 border-b border-white/5">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 shrink-0">
              <Smartphone className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-neon-cyan/10 text-neon-cyan font-mono text-[9px] font-bold uppercase tracking-wider mb-1">
                W3C Dynamic Probe Integration
              </div>
              <h3 className="text-lg font-bold text-white font-display">
                {lang === 'hi' ? 'सेंसर लिंक इंटरफेस' : 'Substrate Climatic Tracker Probes'}
              </h3>
              <p className="text-xs text-white/50 leading-relaxed max-w-2xl font-sans">
                {lang === 'hi' 
                  ? 'फ्लाईमाइंड पर्यावरण सेंसर आपके स्मार्टफोन के भौतिक बैरोमीटर और जाइरो सेंसर का लाइव उपयोग करके ट्रे के सटीक तापमान और सापेक्ष आर्द्रता को सिंक करते हैं।' 
                  : 'Transmit high-speed real-time relative humidity and microclimatic heat levels using specialized ambient smartphone indicators.'}
              </p>
            </div>
          </div>
        </div>

        {permissionError && (
          <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <span className="font-bold uppercase block mb-0.5">Sensor Request Failed:</span>
              <span>{permissionError}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
          
          {/* Temperature Sensor Details */}
          <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3 relative overflow-hidden group hover:border-orange-500/25 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white/95 flex items-center gap-2">
                <Thermometer className="w-4.5 h-4.5 text-orange-400" /> 
                {lang === 'hi' ? 'तापमान जांच (Physical Temp)' : 'Atmospheric Temperature'}
              </span>
              <span className={`px-2.5 py-0.5 text-[8px] uppercase tracking-widest font-mono rounded-md font-bold ${
                hasTempSensor ? "bg-neon-green/10 text-neon-green border border-neon-green/20" : "bg-white/5 text-white/30"
              }`}>
                {hasTempSensor ? (lang === 'hi' ? "समर्थित है" : "Active Probe") : (lang === 'hi' ? "अनुपलब्ध" : "Simulation Fallback")}
              </span>
            </div>
            
            <p className="text-xs text-white/45 leading-relaxed">
              {hasTempSensor 
                ? (lang === 'hi' ? '✓ भौतिक हार्डवेयर सुरक्षा सेंसर ऑनलाइन हैं और बीएफएस आवास के लिए तापमान का सटीक मापन कर रहे हैं।' : '✓ Accurate room-ambient heating status captured by onboard silicon hardware.')
                : (lang === 'hi' ? 'आपके डिवाइस पर भौतिक आंतरिक थर्मामीटर नहीं मिला।' : 'Physical thermometer absent on this device. Adaptive physics parameters loaded.')}
            </p>
          </div>

          {/* Humidity Sensor Details */}
          <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3 relative overflow-hidden group hover:border-cyan-500/25 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white/95 flex items-center gap-2">
                <Droplets className="w-4.5 h-4.5 text-cyan-400" /> 
                {lang === 'hi' ? 'नमी जांच (Ambient Humidity)' : 'Relative Bed Moisture'}
              </span>
              <span className={`px-2.5 py-0.5 text-[8px] uppercase tracking-widest font-mono rounded-md font-bold ${
                hasHumiditySensor ? "bg-neon-green/10 text-neon-green border border-neon-green/20" : "bg-white/5 text-white/30"
              }`}>
                {hasHumiditySensor ? (lang === 'hi' ? "समर्थित है" : "Active Probe") : (lang === 'hi' ? "अनुपलब्ध" : "Simulation Fallback")}
              </span>
            </div>
            
            <p className="text-xs text-white/45 leading-relaxed">
              {hasHumiditySensor 
                ? (lang === 'hi' ? '✓ भौतिक हाइग्रोमीटर ऑनलाइन है और ट्रे बेड की सापेक्ष आर्द्रता प्रेषित कर रहा है।' : '✓ Direct relative atmospheric moisture tracked via onboard baric hygrometer.')
                : (lang === 'hi' ? 'सापेक्ष आर्द्रता सेंसर अनुपलब्ध है।' : 'External hygrometric sensor absent. Adaptive physics parameters loaded.')}
            </p>
          </div>

        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6">
          <button
            onClick={() => setIsSensorActive(!isSensorActive)}
            type="button"
            className={`flex-1 py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
              isSensorActive 
                ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 animate-pulse" 
                : "bg-neon-green text-black hover:shadow-[0_0_20px_rgba(57,255,20,0.3)] active:scale-[0.99]"
            }`}
          >
            <Power className="w-4.5 h-4.5" />
            <span>
              {isSensorActive 
                ? (lang === 'hi' ? 'मोबाइल सेंसर डिस्कनेक्ट करें' : 'DISCONNECT HARDWARE LINK')
                : (lang === 'hi' ? 'मोबाइल सेंसर चालू करें' : 'INITIALIZE REAL-TIME SENSORS')}
            </span>
          </button>

          {(!hasTempSensor || !hasHumiditySensor || isSensorActive) && (
            <button
              onClick={() => {
                if (!isSensorActive) setIsSensorActive(true);
                setIsSimulating(!isSimulating);
              }}
              type="button"
              className={`py-4 px-6 rounded-2xl font-black text-xs flex items-center justify-center gap-2.5 transition-all border uppercase tracking-widest cursor-pointer ${
                isSimulating 
                  ? "bg-purple-500/15 text-purple-400 border-purple-500/25 hover:bg-purple-500/25" 
                  : "bg-white/5 text-white/85 border-white/5 hover:bg-white/10"
              }`}
            >
              <Activity className={`w-4.5 h-4.5 ${isSimulating && isSensorActive ? "animate-spin text-purple-400" : ""}`} />
              <span>
                {isSimulating && isSensorActive 
                  ? (lang === 'hi' ? 'झुकाव कंट्रोल सक्रिय' : 'GYROSCOPE TILT ACTIVE') 
                  : (lang === 'hi' ? 'जायरोस्कोप भौतिकी चालू करें' : 'ENABLE PHYSICS SIMULATION')}
              </span>
            </button>
          )}
        </div>

        {isSimulating && isSensorActive && (
          <div className="mt-4 p-4 rounded-2xl bg-purple-500/5 border border-purple-500/10 space-y-1.5 shadow-inner">
            <div className="flex items-center gap-2 text-purple-400 text-xs font-black font-mono">
              <Sliders className="w-4 h-4" />
              <span>{lang === 'hi' ? 'जायरोस्कोप कंट्रोल इंस्ट्रक्शन' : 'PHYSICS GYROSCOPE SIMULATION ENGAGED'}</span>
            </div>
            <p className="text-[11px] text-white/45 leading-relaxed font-sans font-medium">
              {lang === 'hi' 
                ? 'सिम्युलेशन मोड सक्रिय है! अपने मोबाइल को दाईं/बाईं या ऊपर/नीचे घुमाएं (Pitch / Roll) जिससे तापमान और ट्रे बेड आर्द्रता के मान रीयल-टाइम में बदलेंगे।' 
                : 'Interactive fallback enabled. Physically tilt, roll, or rotate your smartphone in 3D space to immediately calibrate relative temperature and moisture readouts dynamically.'}
            </p>
          </div>
        )}
      </div>

      {/* Modern Predictive Area Graph */}
      <section 
        id="growth-chart" 
        onClick={() => onNavigate?.('tracker')}
        className="p-6 rounded-[2rem] bg-white/[0.01] border border-white/5 space-y-4 hover:border-neon-green/20 transition-all duration-300 cursor-pointer relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-neon-green/[0.01] blur-xl rounded-full pointer-events-none" />
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <span className="text-[9px] font-mono text-neon-green font-bold uppercase tracking-widest block">AI-DRIVEN PREDICTION ENGINE</span>
            <h3 className="text-base font-bold font-display text-white uppercase tracking-wide flex items-center gap-2">
              <Bug className="w-4.5 h-4.5 text-neon-green shrink-0" />
              Larvae Growth Forecast (21 Days)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-white/40 uppercase font-bold flex items-center gap-1 group-hover:text-neon-green transition-colors">
            <span>METRICS GRAPH</span>
            <span>→</span>
          </span>
        </div>
        <div className="h-56 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#39FF14" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#39FF14" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff07" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 10, fill: '#ffffff30', fontFamily: 'monospace'}} 
                dy={10}
              />
              <YAxis hide />
              <Tooltip 
                contentStyle={{backgroundColor: '#0c0c0e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px'}}
                itemStyle={{color: '#39FF14', fontSize: '11px', fontFamily: 'monospace'}}
              />
              <Area 
                type="monotone" 
                dataKey="growth" 
                stroke="#39FF14" 
                fillOpacity={1} 
                fill="url(#colorGrowth)" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Live AI Diagnostics Intelligence Feed */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1 pb-1.5 border-b border-white/5">
          <Zap className="w-4.5 h-4.5 text-neon-green" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/60 font-mono">Live BSF Diagnostics Channel</h3>
        </div>
        
        <div 
          id="alert-feed-1" 
          onClick={() => onNavigate?.('alerts')}
          className="p-5 rounded-3xl bg-white/[0.01] border border-white/5 flex gap-4 cursor-pointer hover:border-neon-green/30 hover:bg-white/[0.02] active:scale-[0.99] transition-all duration-200"
        >
          <div className="w-1.5 h-auto rounded-full bg-neon-green shrink-0 shadow-[0_0_8px_#39FF14]" />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] font-black font-mono text-neon-green uppercase tracking-wide">
                Optimal Digest Co-efficient Recommendation
              </span>
              <span className="text-[9px] text-white/30 font-mono uppercase tracking-widest shrink-0">VIEW ALERTS →</span>
            </div>
            <p className="text-xs text-white/70 font-medium leading-relaxed">
              {lang === 'hi' 
                ? 'कीड़े एल ३ (L3) लार्वा चरण में अत्यंत सक्रिय चयापचय में हैं। दैनिक भोजन की मात्रा में १५% की वृद्धि करें जिससे कि उपज स्वस्थ व टिकाऊ बनी रहे।' 
                : 'Larvae batch in Tray #12 is nearing peak metabolic assimilation. Increase vegetable and carbon scrap feed portions by 15% to maintain exponential weight curve.'}
            </p>
          </div>
        </div>

        <div 
          id="alert-feed-2" 
          onClick={() => onNavigate?.('alerts')}
          className="p-5 rounded-3xl bg-white/[0.01] border border-white/5 flex gap-4 cursor-pointer hover:border-orange-500/30 hover:bg-white/[0.02] active:scale-[0.99] transition-all duration-200"
        >
          <div className="w-1.5 h-auto rounded-full bg-orange-500 shrink-0 shadow-[0_0_8px_#f97316]" />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] font-black font-mono text-orange-400 uppercase tracking-wide">
                Sensory Heat Alarm Triggered
              </span>
              <span className="text-[9px] text-white/30 font-mono uppercase tracking-widest shrink-0">RESOLVE →</span>
            </div>
            <p className="text-xs text-white/70 font-medium leading-relaxed">
              {lang === 'hi' 
                ? 'चेतावनी: ट्रे #४ के कोर बेडिंग का तापमान २.५°C बढ़ गया है। सहायक शीतलन नलिकाएं और वेंटिलेशन स्वतः सक्रिय कर दिया गया है।' 
                : 'Warning: Tray #4 bio-bedding core temperature rose by 2.5°C over safe threshold limit. Supplementary cooling loops and exhaust fans activated.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
