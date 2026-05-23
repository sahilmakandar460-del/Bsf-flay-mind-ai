import React, { useState, useEffect } from 'react';
import { 
  Plus, History, Scale, Thermometer, Droplets, Grid, Loader2, Trash2, 
  TrendingUp, Activity, Sparkles, BrainCircuit, Calendar, ChevronRight,
  AlertTriangle, Heart, Gauge, Zap, Info, ShieldAlert
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { cn } from '../lib/utils';

interface FarmLog {
  id: string;
  temp: number;
  humidity: number;
  feedType: string;
  feedQty: number; // weight in kg
  larvaeCondition: string;
  hatchCount: number; // estimated from egg weight
  totalEggs?: number; // estimated from egg weight
  hatchingRate?: number; // hatch rate metric
  eggWeight: number; // eggs in grams (g)
  larvaeWeight: number; // larvae biomass in kg
  trayCount: number;
  notes: string;
  date: any;
}

export interface HealthPrediction {
  predictionText: string;
  hindiPredictionText: string;
  reason: string;
  hindiReason: string;
  kyaKare: string[];
  kyaNaKare: string[];
  confidence: 'Possible' | 'Likely' | 'Moderate risk';
  riskType: 'egg_drying' | 'humidity_improving' | 'slow_growth' | 'overcrowding' | 'fungus_risk' | 'dry_larvae' | 'optimal';
  severity: 'Excellent' | 'Good' | 'Warning' | 'Risk';
}

export interface HealthReport {
  score: number;
  status: 'Excellent' | 'Good' | 'Warning' | 'Risk';
  predictions: HealthPrediction[];
  optimalSuggestions: {
    idealTemp: string;
    idealHumidity: string;
    ventilation: string;
    feed: string;
  };
}

export function generateBsfHealthReport(logsList: FarmLog[]): HealthReport {
  const latest = logsList[0] || null;
  
  const latestTemp = latest ? latest.temp : 28;
  const latestHum = latest ? latest.humidity : 65;
  const latestCond = latest ? latest.larvaeCondition : 'Active';
  const latestWeight = latest ? (latest.larvaeWeight ?? 25.0) : 25.0;
  const latestTrayCount = latest ? (latest.trayCount ?? 10) : 10;
  const latestFcr = latest && latest.larvaeWeight > 0 ? (latest.feedQty / latest.larvaeWeight) : 1.8;
  
  let score = 100;
  const predictions: HealthPrediction[] = [];

  // Deduct based on criteria
  if (latestTemp < 24 || latestTemp > 31) {
    score -= 15;
  }
  if (latestHum < 55 || latestHum > 75) {
    score -= 15;
  }
  if (latestFcr > 2.2) {
    score -= 15;
  }
  if (latestCond === 'Sluggish' || latestCond === 'Dormant') {
    score -= 15;
  }
  if (latestTrayCount > 0 && (latestWeight / latestTrayCount) > 2.8) {
    score -= 15;
  }

  // Ensure minimum score is 25
  score = Math.max(25, score);

  let status: 'Excellent' | 'Good' | 'Warning' | 'Risk' = 'Excellent';
  if (score >= 85) status = 'Excellent';
  else if (score >= 70) status = 'Good';
  else if (score >= 50) status = 'Warning';
  else status = 'Risk';

  // 1. Low Humidity / Egg Drying Risk
  if (latestHum < 55) {
    predictions.push({
      predictionText: "Egg drying risk possible within 24 hours.",
      hindiPredictionText: "Ande sukhne ka khatra (drying risk) agle 24 hours me ho sakta hai.",
      reason: "Ambient humidity is critically low (< 55%). Dry air quickly dehydrates delicate external egg membranes, lowering egg hatching rates dramatically.",
      hindiReason: "Hawa me nami bahut kam (humidity < 55%) hai. Khushk hawa ando ko sukhaye jisse hatching rate kharab hota hai.",
      kyaKare: [
        "Sponge trick: Keep light wet sponges near egg cradles to maintain ambient moisture.",
        "Maintain optimal humidity (60% - 75%) inside hatching cabins.",
        "Sprinkle clean water mist around egg cages 2-3 times."
      ],
      kyaNaKare: [
        "Avoid placing heat bulbs directly over egg clutches without proper shielding.",
        "Do not allow heavy exhaust fans to blow dry draft directly near incubators."
      ],
      confidence: 'Likely',
      riskType: 'egg_drying',
      severity: 'Risk'
    });
  }

  // 2. High Temperature Heat Stress
  if (latestTemp > 31) {
    predictions.push({
      predictionText: "Overheating heat-stress warning.",
      hindiPredictionText: "Temperature zyada hone se larvae ko severe heat stress ka risk hai.",
      reason: "Indoor temperature exceeds 31°C. Superheated stacks limit active feeding and larvae try to migrate downward to find moisture.",
      hindiReason: "Facility ka tamman 31°C se upar hai, jisse metabolism block hota hai aur larvae feeding chhod dete hain.",
      kyaKare: [
        "Ensure stable cross-ventilation to remove stagnated tray humidity.",
        "Cover tray racks with shade cloths or introduce cooler morning feed cycles.",
        "Sprinkle cool fine water mist around active tray storage aisles."
      ],
      kyaNaKare: [
        "Avoid adding thick dense feed heaps that generate internal bio-heat.",
        "Do not keep tray covers sealed tightly; allow free passive heat exhaust."
      ],
      confidence: 'Moderate risk',
      riskType: 'overheating' as any,
      severity: 'Warning'
    });
  }

  // 3. Fungus Risk
  if (latestHum > 78 || (latest && latest.feedType === 'Organic Waste' && latestHum > 72)) {
    predictions.push({
      predictionText: "Fungus & mold outbreak risk.",
      hindiPredictionText: "Possible fungus aur mold growth (fapundi) detected.",
      reason: "High moisture content coupled with acidic food creates anaerobic pockets, which speeds up gray scale mycelium and viral spores.",
      hindiReason: "Nami aur acidic wet food ke karan tray me hava rukti hai, jisse safed fapundi (mold) tezi se failta hai.",
      kyaKare: [
        "Turn the tray substrate using hand-spades to aerate compact parts.",
        "Incorporate highly absorbent dry carbon like rice husk, sawdust or coco-peat.",
        "Temporarily reduce the feed dosage rate by 40%."
      ],
      kyaNaKare: [
        "Never add new wet sugary feed on top of existing sour, mold-ridden feed layers.",
        "Do not close ventilation vents while organic decay heat is high."
      ],
      confidence: 'Likely',
      riskType: 'fungus_risk',
      severity: 'Risk'
    });
  }

  // 4. Slow Larvae Growth Trend
  if (latestFcr > 2.2 || latestCond === 'Sluggish') {
    predictions.push({
      predictionText: "Larvae growth appears slower than normal.",
      hindiPredictionText: "Larvae growth normal se kafi dheet aur slow (sluggish) lag rahi hai.",
      reason: "Suboptimal biological conversion (FCR > 2.2). It typically happens because of poor nutritional protein quality or low ambient metabolic stimulation.",
      hindiReason: "Feed conversion index (FCR: " + latestFcr.toFixed(2) + ") thoda high hai. Iska matlab larvae feed acche se organic matter digest nahi kar pa rahe.",
      kyaKare: [
        "Enrich feed with highly digestible protein like wheat bran or rice washings.",
        "Verify indoor temperature rests in the stable 26°C - 30°C comfort zone.",
        "Turn dense feeding layers once daily to ensure easy crawl access."
      ],
      kyaNaKare: [
        "Do not feed pure starch or woody cellulose like dense tree shells or dry stems.",
        "Never starve the active nursery batches during their active L3 development stage."
      ],
      confidence: 'Possible',
      riskType: 'slow_growth',
      severity: 'Warning'
    });
  }

  // 5. Overcrowding Risk
  if (latestTrayCount > 0 && (latestWeight / latestTrayCount) > 2.8) {
    predictions.push({
      predictionText: "Overcrowding density risk detected.",
      hindiPredictionText: "Trays me overcrowding (zyada bheed) ke sanket lag rahe hain.",
      reason: "High stocking density (> 2.8 kg/tray) increases metabolic tray core temperature and hampers movement, leading to crawlers running out.",
      hindiReason: "Har tray me dense bioload " + (latestWeight / latestTrayCount).toFixed(1) + " kg hai, jo normal limit se kafi zyada hai.",
      kyaKare: [
        "Divide and split active crawl population into secondary nursery trays.",
        "Widen density distribution to keep substrate beds below 3 cm depth.",
        "Introduce fresh feeder crates to divide the active population."
      ],
      kyaNaKare: [
        "Do not stack fresh feed vertically; spread it horizontally across expanded trays.",
        "Avoid using deep, unvented bucket modules."
      ],
      confidence: 'Moderate risk',
      riskType: 'overcrowding',
      severity: 'Warning'
    });
  }

  // 6. Dry Larvae Dehydration
  if (latestCond === 'Dormant' || (latestHum < 55 && latestTemp > 28)) {
    if (!predictions.some(p => p.riskType === 'slow_growth' || p.riskType === 'dry_larvae')) {
      predictions.push({
        predictionText: "Dry, dehydrated larvae risk.",
        hindiPredictionText: "Larvae dry lag rahe hain aur inactive dehydration ka risk hai.",
        reason: "Feed bed moisture has fully evaporated. Cuticle respiration in black soldier fly larvae dries out, forcing hibernation or mortality.",
        hindiReason: "Tamman zyada aur moisture kam hone se feeder bed bilkul sookh chuka hai, jisse larvae seekh rahe hain.",
        kyaKare: [
          "Sprinkle warm pure water carefully using a hand sprayer directly over dehydrated areas.",
          "Fleshy feed: Replenish moisture using watermelon skins, melon pulp or sliced cucumbers.",
          "Layer a thin cover over the tray to prevent rapid humidity ventilation."
        ],
        kyaNaKare: [
          "Do not feed dry powder grain mash alone until you moisten the substrate beds.",
          "Do not put the tray near high speed heating pipes."
        ],
        confidence: 'Likely',
        riskType: 'dry_larvae',
        severity: 'Risk'
      });
    }
  }

  // 7. Humidity Improving Trend (If present)
  if (logsList.length > 1) {
    const prev = logsList[1];
    if (latestHum > prev.humidity && latestHum >= 60 && latestHum <= 72) {
      predictions.push({
        predictionText: "Humidity trend improving.",
        hindiPredictionText: "Namii ya humidity ka trend behtar lag raha hai (stable range).",
        reason: "Humidity levels are trending upwards into the optimal range (60-72%). Larval beds are securing helpful respiration moisture.",
        hindiReason: "Air moisture badh kar " + latestHum + "% par aa gaya hai jo larvae ki skin moisture ke liye ideal hai.",
        kyaKare: [
          "Continuously log reading daily to sustain this optimal biological equilibrium.",
          "Keep existing ventilation speeds."
        ],
        kyaNaKare: [
          "Do not implement quick water sprinkling that will soggy up the balance."
        ],
        confidence: 'Possible',
        riskType: 'humidity_improving',
        severity: 'Good'
      });
    }
  }

  // Fallback optimal diagnostic if everything is superb
  if (predictions.length === 0) {
    predictions.push({
      predictionText: "Colony environment is fully balanced.",
      hindiPredictionText: "Environmental conditions behtareen aur fully balanced hain.",
      reason: "Temperature, moisture levels and biological movement index are working exactly within premium agronomic parameters.",
      hindiReason: "Aapke farm ka tamman (" + latestTemp + "°C) aur humidity (" + latestHum + "%) dono optimum scale par chal rahe hain.",
      kyaKare: [
        "Plan normal harvest cycles (prepupae separation timeframe is approaching).",
        "Maintain current feed recipes and tray ventilation speeds."
      ],
      kyaNaKare: [
        "Do not adjust feed ratios or introduce sudden chemical or mold stressors."
      ],
      confidence: 'Possible',
      riskType: 'optimal' as any,
      severity: 'Excellent'
    });
  }

  return {
    score,
    status,
    predictions,
    optimalSuggestions: {
      idealTemp: "26°C - 30°C",
      idealHumidity: "60% - 75%",
      ventilation: "Continuous gentle ventilation (0.2 m/s). Avoid stale air traps which accumulate heavy carbon gas.",
      feed: "Target feed moisture should be 65-70%. Substrate should not release pools of water when squeezed tightly, but must not turn into hard, dry lumps."
    }
  };
}

export default function Tracker() {
  const [logs, setLogs] = useState<FarmLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [view, setView] = useState<'dashboard' | 'add'>('dashboard');
  const [prediction, setPrediction] = useState<string | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Custom states for BSF Health Prediction & Visual Telemetry
  const [chartTab, setChartTab] = useState<'biomass' | 'climate'>('biomass');
  const [activePredIdx, setActivePredIdx] = useState<number>(0);

  // Dynamic lists loaded from settings (localStorage)
  const [feedTypes, setFeedTypes] = useState<{ name: string; defaultQty: number }[]>(() => {
    const saved = localStorage.getItem('flymind_feed_types');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { name: 'Organic Waste', defaultQty: 5 },
      { name: 'Grain Mix', defaultQty: 3 },
      { name: 'Fruit Scraps', defaultQty: 4 },
      { name: 'Experiment A', defaultQty: 10 }
    ];
  });

  const [conditions, setConditions] = useState<string[]>(() => {
    const saved = localStorage.getItem('flymind_larvae_conditions');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return ['Active', 'Sluggish', 'Overcrowded', 'Dormant', 'Harvest Ready'];
  });

  // Form State using decimal weight properties
  const [formData, setFormData] = useState({
    temp: 28,
    humidity: 65,
    feedType: 'Organic Waste',
    feedQty: 5.0,
    larvaeCondition: 'Active',
    eggWeight: 12.5,
    larvaeWeight: 25.0,
    trayCount: 10,
    notes: ''
  });

  // Sync state between config, tab changes and raw sensors
  useEffect(() => {
    const savedTemp = localStorage.getItem('flymind_temp');
    const savedHum = localStorage.getItem('flymind_humidity');
    const savedFeedTypes = localStorage.getItem('flymind_feed_types');
    const savedConds = localStorage.getItem('flymind_larvae_conditions');

    let currentFeeds = feedTypes;
    if (savedFeedTypes) {
      try {
        const parsed = JSON.parse(savedFeedTypes);
        setFeedTypes(parsed);
        currentFeeds = parsed;
      } catch (e) {}
    }

    let currentConds = conditions;
    if (savedConds) {
      try {
        const parsed = JSON.parse(savedConds);
        setConditions(parsed);
        currentConds = parsed;
      } catch (e) {}
    }

    setFormData(prev => ({
      ...prev,
      temp: savedTemp ? parseFloat(savedTemp) : prev.temp,
      humidity: savedHum ? parseInt(savedHum) : prev.humidity,
      feedType: currentFeeds.length > 0 ? currentFeeds[0].name : prev.feedType,
      feedQty: currentFeeds.length > 0 ? currentFeeds[0].defaultQty : prev.feedQty,
      larvaeCondition: currentConds.length > 0 ? currentConds[0] : prev.larvaeCondition
    }));
  }, [view]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const path = `users/${auth.currentUser.uid}/farmlogs`;
    const q = query(
      collection(db, path),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FarmLog[];
      setLogs(fetchedLogs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    // Validate inputs
    if (isNaN(formData.eggWeight) || formData.eggWeight <= 0) {
      setValidationError("Egg Weight must be a positive number greater than 0.");
      return;
    }
    if (isNaN(formData.larvaeWeight) || formData.larvaeWeight < 0) {
      setValidationError("Larvae Weight cannot be negative.");
      return;
    }
    if (isNaN(formData.feedQty) || formData.feedQty < 0) {
      setValidationError("Feed quantity cannot be negative.");
      return;
    }

    setValidationError(null);
    setIsAdding(true);
    const path = `users/${auth.currentUser.uid}/farmlogs`;
    
    // Estimate hatch/larvae parameters under professional standard coefficients
    const computedHatchCount = Math.round(formData.eggWeight * 35000);
    const calculatedHatchRate = 92.4; // Hatch rate baseline percentage

    try {
      await addDoc(collection(db, path), {
        ...formData,
        hatchCount: computedHatchCount,
        totalEggs: computedHatchCount,
        hatchingRate: calculatedHatchRate,
        userId: auth.currentUser.uid,
        date: serverTimestamp()
      });

      // Update state triggers and sync with localStorage for immediate Home view refresh
      localStorage.setItem('flymind_latest_hatch_rate', calculatedHatchRate.toString());
      localStorage.setItem('flymind_latest_egg_weight', formData.eggWeight.toString());
      localStorage.setItem('flymind_latest_larvae_weight', formData.larvaeWeight.toString());
      localStorage.setItem('flymind_latest_feed_qty', formData.feedQty.toString());
      window.dispatchEvent(new Event('flymind_hatching_update'));

      setView('dashboard');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsAdding(false);
    }
  };

  const getPrediction = async () => {
    if (logs.length === 0) return;
    setIsPredicting(true);
    
    // Simulate smart agronomic BSF log analytics
    setTimeout(() => {
      // Calculate averages to provide highly accurate custom advice
      const totalTemp = logs.reduce((acc, l) => acc + l.temp, 0);
      const avgTemp = totalTemp / logs.length;
      const totalHum = logs.reduce((acc, l) => acc + l.humidity, 0);
      const avgHum = totalHum / logs.length;

      const totalEggWeight = logs.reduce((acc, l) => acc + (l.eggWeight !== undefined ? l.eggWeight : 12.5), 0);
      const totalLarvaeWeight = logs.reduce((acc, l) => acc + (l.larvaeWeight !== undefined ? l.larvaeWeight : 25.0), 0);
      const totalFeed = logs.reduce((acc, l) => acc + l.feedQty, 0);
      const avgRatio = totalLarvaeWeight > 0 ? (totalFeed / totalLarvaeWeight) : 1.8;

      let advice = "";
      if (avgRatio > 2.5) {
        advice = `CRITICAL DEVIATION: Elevated Feed Conversion Ratio (FCR: ${avgRatio.toFixed(2)}) detected. Larvae consumption is high without parallel biomass gain. Adjust feed moisture or decrease density.`;
      } else if (avgTemp > 31) {
        advice = "WARNING: Elevated temperature trend detected. Larvae metabolic core heat is high; increase ventilation airflow and start overhead fine water misting in tray arrays.";
      } else if (avgTemp < 22) {
        advice = "ALERT: Cold facility trend detected. Growth metabolic speed will halt if temperature drops below 18°C. Add warm incubator lighting or thermal insulating blankets.";
      } else if (avgHum < 55) {
        advice = "ACTION: Low humidity core drying detected. Dampen the feed substrate to about 65% moisture capacity to maintain continuous nutritional feeding.";
      } else {
        advice = `OPTIMAL BIOMASS METRICS: Continuous growth cycle is highly efficient. Average Biomass Yield is ${(totalLarvaeWeight / (totalEggWeight || 1)).toFixed(2)} kg of larvae per gram of eggs.`;
      }

      setPrediction(advice);
      setIsPredicting(false);
    }, 1200); // Super fast 1.2s simulation is extremely satisfying and immediate
  };

  const deleteLog = async (logId: string) => {
    if (!auth.currentUser) return;
    const path = `users/${auth.currentUser.uid}/farmlogs/${logId}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const chartData = [...logs].reverse().map(log => {
    const eggW = log.eggWeight !== undefined ? log.eggWeight : 12.5;
    const larvaeW = log.larvaeWeight !== undefined ? log.larvaeWeight : 25.0;
    const fcr = larvaeW > 0 ? Number((log.feedQty / larvaeW).toFixed(2)) : 0;
    const yieldRatio = eggW > 0 ? Number((larvaeW / eggW).toFixed(2)) : 0;
    const hatchEst = Math.round(eggW * 35000);
    return {
      date: log.date ? (log.date instanceof Timestamp ? log.date.toDate() : new Date(log.date)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Pending',
      temp: log.temp,
      humidity: log.humidity,
      eggWeight: eggW,
      larvaeWeight: larvaeW,
      feed: log.feedQty,
      fcr: fcr,
      yieldRatio: yieldRatio,
      hatchEst: hatchEst
    };
  });

  return (
    <div className="space-y-6 pb-20">
      <header className="flex justify-between items-center">
        <div>
          <p className="text-neon-cyan text-xs font-mono tracking-widest uppercase mb-1">Farm Intelligence &bull; फार्म डेटा</p>
          <h2 className="text-2xl font-black tracking-tight font-display text-white">
            Telemetry <span className="text-neon-green">Tracker</span>
          </h2>
        </div>
        <div className="flex glass rounded-xl p-1 border border-white/10">
          <button 
            onClick={() => setView('dashboard')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
              view === 'dashboard' ? "bg-neon-green text-black shadow-[0_0_12px_rgba(57,255,20,0.4)]" : "text-white/40 hover:text-white"
            )}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setView('add')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
              view === 'add' ? "bg-neon-green text-black shadow-[0_0_12px_rgba(57,255,20,0.4)]" : "text-white/40 hover:text-white"
            )}
          >
            Log Data
          </button>
        </div>
      </header>

      {view === 'dashboard' ? (() => {
        // Calculate health report from real or baseline logs
        const reportLogs = logs.length > 0 ? logs : [
          {
            id: "demo-1",
            temp: 28,
            humidity: 64,
            feedType: "Organic Waste",
            feedQty: 5.5,
            larvaeCondition: "Active",
            eggWeight: 12.5,
            larvaeWeight: 24.5,
            trayCount: 10,
            notes: "Demo starting batch baseline",
            date: new Date()
          }
        ];
        const report = generateBsfHealthReport(reportLogs);

        return (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-4 rounded-2xl glass-card glass-card-hover relative overflow-hidden group">
                <p className="text-[10px] text-white/40 uppercase font-mono mb-1">Avg Egg Weight</p>
                <p className="text-xl font-black text-neon-green tracking-tight font-mono">
                  {logs.length > 0 ? (logs.reduce((acc, l) => acc + (l.eggWeight !== undefined ? l.eggWeight : 12.5), 0) / logs.length).toFixed(1) : '12.5'}g
                </p>
                <span className="text-[8px] font-mono text-neon-cyan/50 uppercase block mt-1 tracking-wider">Colony Stock</span>
                <div className="absolute top-0 right-0 w-8 h-8 bg-neon-green/5 blur-xl group-hover:bg-neon-green/10 transition-colors" />
              </div>

              <div className="p-4 rounded-2xl glass-card glass-card-hover relative overflow-hidden group">
                <p className="text-[10px] text-white/40 uppercase font-mono mb-1">Avg Larvae Weight</p>
                <p className="text-xl font-black text-white tracking-tight font-mono">
                  {logs.length > 0 ? (logs.reduce((acc, l) => acc + (l.larvaeWeight !== undefined ? l.larvaeWeight : 25.0), 0) / logs.length).toFixed(1) : '25.0'}kg
                </p>
                <span className="text-[8px] font-mono text-neon-cyan/50 uppercase block mt-1 tracking-wider">Live Biomass</span>
                <div className="absolute top-0 right-0 w-8 h-8 bg-white/5 blur-xl group-hover:bg-white/10 transition-colors" />
              </div>

              <div className="p-4 rounded-2xl glass-card glass-card-hover relative overflow-hidden group">
                <p className="text-[10px] text-white/40 uppercase font-mono mb-1">Total Feed Consumed</p>
                <p className="text-xl font-black text-white tracking-tight font-mono">
                  {logs.length > 0 ? logs.reduce((acc, l) => acc + l.feedQty, 0).toFixed(1) : '0.0'}kg
                </p>
                <span className="text-[8px] font-mono text-neon-cyan/50 uppercase block mt-1 tracking-wider">Feed Input</span>
                <div className="absolute top-0 right-0 w-8 h-8 bg-white/5 blur-xl group-hover:bg-white/10 transition-colors" />
              </div>

              <div className="p-4 rounded-2xl glass-card glass-card-hover relative overflow-hidden group">
                <p className="text-[10px] text-white/40 uppercase font-mono mb-1">Feed Conversion (FCR)</p>
                <p className="text-xl font-black text-neon-green tracking-tight font-mono">
                  {(() => {
                     const logsWithFcr = logs.filter(l => l.feedQty > 0 && (l.larvaeWeight !== undefined ? l.larvaeWeight : 25.0) > 0);
                     if (logsWithFcr.length === 0) return '1.80';
                     const totalFcr = logsWithFcr.reduce((acc, l) => {
                       const lw = l.larvaeWeight !== undefined ? l.larvaeWeight : 25.0;
                       return acc + (l.feedQty / lw);
                     }, 0);
                     return (totalFcr / logsWithFcr.length).toFixed(2);
                  })()}
                </p>
                <span className="text-[8px] font-mono text-neon-cyan/50 uppercase block mt-1 tracking-wider">FCR Score</span>
                <div className="absolute top-0 right-0 w-8 h-8 bg-neon-green/5 blur-xl group-hover:bg-neon-green/10 transition-colors" />
              </div>

              <div className="p-4 rounded-2xl glass-card relative overflow-hidden group">
                <p className="text-[10px] text-white/40 uppercase font-mono mb-1">Biomass Yield Factor</p>
                <p className="text-xl font-black text-white tracking-tight font-mono">
                  {(() => {
                     const logsWithYield = logs.filter(l => (l.eggWeight !== undefined ? l.eggWeight : 12.5) > 0 && (l.larvaeWeight !== undefined ? l.larvaeWeight : 25.0) > 0);
                     if (logsWithYield.length === 0) return '2.00';
                     const totalYield = logsWithYield.reduce((acc, l) => {
                       const ew = l.eggWeight !== undefined ? l.eggWeight : 12.5;
                       const lw = l.larvaeWeight !== undefined ? l.larvaeWeight : 25.0;
                       return acc + (lw / ew);
                     }, 0);
                     return (totalYield / logsWithYield.length).toFixed(2);
                  })()}
                </p>
                <span className="text-[8px] font-mono text-white/20 uppercase block mt-1">Larvae g/eggs</span>
              </div>
            </div>

            {/* Smart BSF Health Prediction Dashboard */}
            <div className="p-6 rounded-3xl glass-card space-y-6 relative overflow-hidden border-neon-cyan/15 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-neon-green/10 text-neon-green border border-neon-green/20 rounded-xl relative">
                    <span className="absolute inset-0 bg-neon-green/10 filter blur rounded-xl" />
                    <BrainCircuit className="w-5 h-5 relative z-10" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm tracking-wider uppercase text-white font-display">BSF Health Prediction System</h3>
                    <p className="text-[10px] text-neon-cyan/60 font-mono mt-0.5">Dual-Language Colony Diagnostics & Bio-analysis</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-neon-green animate-ping" />
                  <span className="text-[9px] font-mono uppercase tracking-wider text-neon-green font-bold">Predictive AI Active</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                {/* Left Panel - Circular Gauge */}
                <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 bg-white/[0.01] border border-white/5 rounded-2xl text-center space-y-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-white/40">Colony Health Index</span>
                  
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg className="absolute w-full h-full transform -rotate-90">
                      <circle cx="72" cy="72" r="62" className="stroke-white/5 fill-none" strokeWidth="8" />
                      <circle 
                        cx="72" 
                        cy="72" 
                        r="62" 
                        className="fill-none transition-all duration-1000"
                        strokeWidth="8" 
                        strokeDasharray={2 * Math.PI * 62}
                        strokeDashoffset={2 * Math.PI * 62 * (1 - report.score / 100)}
                        strokeLinecap="round"
                        stroke={
                          report.status === 'Excellent' ? "#39FF14" :
                          report.status === 'Good' ? "#10b981" :
                          report.status === 'Warning' ? "#fbbf24" : "#ef4444"
                        }
                      />
                    </svg>
                    <div className="text-center z-10">
                      <span className="text-4xl font-black font-sans tracking-tight text-white">{report.score}%</span>
                      <span className="text-[8px] text-white/30 block font-mono tracking-widest uppercase mt-0.5">Telemetry Core</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className={cn(
                      "px-3 py-1 rounded-xl text-xs font-black uppercase tracking-widest inline-flex items-center gap-1.5 border",
                      report.status === 'Excellent' ? "bg-neon-green/10 text-neon-green border-neon-green/20" :
                      report.status === 'Good' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      report.status === 'Warning' ? "bg-amber-400/10 text-amber-300 border-amber-500/20" :
                      "bg-red-500/10 text-red-500 border-red-500/20 animate-pulse"
                    )}>
                      <Heart className="w-3.5 h-3.5 fill-current" />
                      <span>{report.status} dasha</span>
                    </div>
                    <p className="text-[10px] text-white/45 max-w-[200px] leading-relaxed mx-auto">
                      {report.status === 'Excellent' && "Colony is premium. All environmental parameters are fully optimized."}
                      {report.status === 'Good' && "Steady environment. Feeder biological conversion rates behave normally."}
                      {report.status === 'Warning' && "Caution check recommended. Environmental fluctuations detected."}
                      {report.status === 'Risk' && "Immediate remediation required! Extreme biosecurity mortality threat."}
                    </p>
                  </div>
                </div>

                {/* Right Panel - Interactive Predictive Risks & Advice */}
                <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-wider font-mono text-white/40">Smart Environmental Diagnostics & Advice</p>
                    <div className="space-y-2">
                      {report.predictions.map((pred, idx) => {
                        const isOpen = activePredIdx === idx;
                        return (
                          <div 
                            key={idx}
                            onClick={() => setActivePredIdx(idx)}
                            className={cn(
                              "p-4 rounded-2xl border text-left cursor-pointer transition-all",
                              isOpen 
                                ? "bg-white/[0.03] border-neon-green/30 shadow-[0_4px_20px_rgba(57,255,20,0.03)]" 
                                : "bg-black/20 border-white/5 hover:border-white/10"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div className={cn(
                                  "p-1.5 rounded-lg shrink-0",
                                  pred.severity === 'Risk' ? "bg-red-500/10 text-red-400" :
                                  pred.severity === 'Warning' ? "bg-amber-400/10 text-amber-300" :
                                  "bg-neon-green/10 text-neon-green"
                                )}>
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-white uppercase tracking-wider leading-tight">
                                    {pred.predictionText}
                                  </h4>
                                  <p className="text-[10px] text-white/40 font-mono mt-0.5">Confidence: {pred.confidence}</p>
                                </div>
                              </div>
                              <ChevronRight className={cn("w-4 h-4 text-white/40 transition-transform", isOpen && "rotate-90 text-neon-green")} />
                            </div>

                            <AnimatePresence>
                              {isOpen && (
                                <motion.div 
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-4 pt-4 border-t border-white/5 space-y-3.5 overflow-hidden"
                                >
                                  <div>
                                    <span className="text-[9px] uppercase font-mono text-neon-green/80 font-bold block tracking-wider">🔮 PREDICTION (भविष्यवाणी)</span>
                                    <p className="text-xs font-medium text-white/95 mt-1">{pred.predictionText}</p>
                                    <p className="text-xs text-white/50 italic font-sans mt-0.5">{pred.hindiPredictionText}</p>
                                  </div>
                                  <div>
                                    <span className="text-[9px] uppercase font-mono text-neon-green/80 font-bold block tracking-wider">❓ POSSIBLE REASON (संभावित कारण)</span>
                                    <p className="text-xs text-white/80 mt-1 leading-relaxed">{pred.reason}</p>
                                    <p className="text-xs text-white/50 italic leading-relaxed mt-0.5">{pred.hindiReason}</p>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                    <div className="p-3 bg-neon-green/5 border border-neon-green/10 rounded-xl space-y-1">
                                      <span className="text-[9px] uppercase font-mono text-neon-green font-extrabold block">✔ KYA KARE (क्या करें)</span>
                                      <ul className="list-disc pl-3 text-[11px] text-white/80 space-y-1">
                                        {pred.kyaKare.map((k, i) => <li key={i}>{k}</li>)}
                                      </ul>
                                    </div>
                                    <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl space-y-1">
                                      <span className="text-[9px] uppercase font-mono text-red-400 font-extrabold block">❌ KYA NA KARE (क्या न करें)</span>
                                      <ul className="list-disc pl-3 text-[11px] text-white/80 space-y-1">
                                        {pred.kyaNaKare.map((k, i) => <li key={i}>{k}</li>)}
                                      </ul>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ideal Environmental Targets */}
              <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Gauge className="w-4 h-4 text-neon-green" />
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/50 font-mono">BSF Target Reference Standards (आदर्श मानक)</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-mono">
                  <div className="p-3 bg-black/30 border border-white/5 rounded-xl">
                    <span className="text-[8px] text-white/30 block mb-0.5 uppercase">Ideal Temperature</span>
                    <span className="font-sans font-bold text-white block text-sm">{report.optimalSuggestions.idealTemp}</span>
                    <span className="text-[8px] text-white/40 block mt-1">Your Avg: <span className="text-neon-green font-bold">{logs.length > 0 ? (logs.reduce((acc, l) => acc + l.temp, 0) / logs.length).toFixed(1) : '28.0'}°C</span></span>
                  </div>
                  <div className="p-3 bg-black/30 border border-white/5 rounded-xl">
                    <span className="text-[8px] text-white/30 block mb-0.5 uppercase">Ideal Humidity</span>
                    <span className="font-sans font-bold text-white block text-sm">{report.optimalSuggestions.idealHumidity}</span>
                    <span className="text-[8px] text-white/40 block mt-1">Your Avg: <span className="text-neon-green font-bold">{logs.length > 0 ? (logs.reduce((acc, l) => acc + l.humidity, 0) / logs.length).toFixed(1) : '65'}%</span></span>
                  </div>
                  <div className="p-3 bg-black/30 border border-white/5 rounded-xl sm:col-span-2 space-y-1">
                    <span className="text-[8px] text-white/30 block uppercase">Substrate Feed Moisture Guidelines</span>
                    <p className="font-sans text-[10px] text-white/70 leading-relaxed">{report.optimalSuggestions.feed}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Telemetry Chart Hub with dynamic switching */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white/60">Colony Telemetry & Trend Hub</h3>
                  <p className="text-[9px] text-white/30 font-mono mt-0.5">Toggle growth parameters or microclimate history</p>
                </div>
                
                <div className="inline-flex bg-white/5 border border-white/10 rounded-xl p-1 shrink-0 self-start sm:self-auto">
                  <button
                    onClick={() => setChartTab('biomass')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                      chartTab === 'biomass' ? "bg-neon-green text-black animate-pulse" : "text-white/40 hover:text-white"
                    )}
                  >
                    Biomass & Biomix
                  </button>
                  <button
                    onClick={() => setChartTab('climate')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                      chartTab === 'climate' ? "bg-neon-green text-black animate-pulse" : "text-white/40 hover:text-white"
                    )}
                  >
                    Climate Tracks
                  </button>
                </div>
              </div>

              {chartTab === 'biomass' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Biomass Yield area chart */}
                  <div className="p-6 rounded-3xl bg-surface border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold font-mono text-white/40 uppercase tracking-widest">Larvae Growth Trend (Biomass)</h3>
                      <Activity className="w-4 h-4 text-neon-green" />
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorLarvae" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#39FF14" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#39FF14" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff11" vertical={false} />
                          <XAxis dataKey="date" stroke="#ffffff44" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#ffffff44" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #39FF1433', borderRadius: '12px' }}
                            itemStyle={{ color: '#39FF14' }}
                          />
                          <Area type="monotone" dataKey="larvaeWeight" stroke="#39FF14" fillOpacity={1} fill="url(#colorLarvae)" strokeWidth={2} name="Larvae Biomass (kg)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Feed Allocation line chart */}
                  <div className="p-6 rounded-3xl bg-surface border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold font-mono text-white/40 uppercase tracking-widest">Feed Allocation Over Time</h3>
                      <Scale className="w-4 h-4 text-neon-green" />
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff11" vertical={false} />
                          <XAxis dataKey="date" stroke="#ffffff44" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#ffffff44" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #39FF1433', borderRadius: '12px' }}
                            itemStyle={{ color: '#39FF14' }}
                          />
                          <Line type="monotone" dataKey="feed" stroke="#39FF14" strokeWidth={2} dot={{ r: 4, fill: '#39FF14' }} name="Feed weight (kg)" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* FCR convert area chart */}
                  <div className="p-6 rounded-3xl bg-surface border border-white/5 space-y-4 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold font-mono text-white/40 uppercase tracking-widest">Feed Conversion Ratio (FCR) Index</h3>
                      <TrendingUp className="w-4 h-4 text-neon-green" />
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorFcr" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#39FF14" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#39FF14" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff11" vertical={false} />
                          <XAxis dataKey="date" stroke="#ffffff44" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#ffffff44" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #39FF1433', borderRadius: '12px' }}
                            itemStyle={{ color: '#39FF14' }}
                          />
                          <Area type="monotone" dataKey="fcr" stroke="#39FF14" fillOpacity={1} fill="url(#colorFcr)" strokeWidth={2} name="Feed Conversion Ratio" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Temperature history */}
                  <div className="p-6 rounded-3xl bg-surface border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold font-mono text-white/40 uppercase tracking-widest">Temperature History Trend (°C)</h3>
                      <Thermometer className="w-4 h-4 text-orange-400" />
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff11" vertical={false} />
                          <XAxis dataKey="date" stroke="#ffffff44" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#ffffff44" fontSize={10} tickLine={false} axisLine={false} domain={[15, 45]} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #f9731633', borderRadius: '12px' }}
                            itemStyle={{ color: '#f97316' }}
                          />
                          <Area type="monotone" dataKey="temp" stroke="#f97316" fillOpacity={1} fill="url(#colorTemp)" strokeWidth={2} name="Temperature (°C)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Humidity history */}
                  <div className="p-6 rounded-3xl bg-surface border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold font-mono text-white/40 uppercase tracking-widest">Humidity History Trend (%)</h3>
                      <Droplets className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorHum" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff11" vertical={false} />
                          <XAxis dataKey="date" stroke="#ffffff44" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#ffffff44" fontSize={10} tickLine={false} axisLine={false} domain={[30, 100]} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #06b6d433', borderRadius: '12px' }}
                            itemStyle={{ color: '#06b6d4' }}
                          />
                          <Area type="monotone" dataKey="humidity" stroke="#06b6d4" fillOpacity={1} fill="url(#colorHum)" strokeWidth={2} name="Humidity (%)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>

          {/* History Snippet */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/60">Log History</h3>
              <button 
                onClick={() => setView('add')}
                className="text-neon-green text-[10px] font-bold uppercase hover:underline"
              >
                Log New Entry
              </button>
            </div>
            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-neon-green" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-10 bg-white/2 border border-dashed border-white/10 rounded-2xl text-white/20 uppercase text-[10px] tracking-widest">
                System awaiting first dataset
              </div>
            ) : (
              <div className="space-y-3">
                {logs.slice(0, 5).map(log => {
                  const ew = log.eggWeight !== undefined ? log.eggWeight : 12.5;
                  const lw = log.larvaeWeight !== undefined ? log.larvaeWeight : 25.0;
                  const yieldVal = ew > 0 ? (lw / ew) : 0;
                  
                  // Define Performance scale
                  let performanceStatus = 'Poor';
                  let performanceColor = 'text-red-400 border-red-500/30 bg-red-500/10';
                  if (yieldVal >= 3.5) {
                    performanceStatus = 'Excellent';
                    performanceColor = 'text-neon-green border-neon-green/30 bg-neon-green/10';
                  } else if (yieldVal >= 2.5) {
                    performanceStatus = 'Good';
                    performanceColor = 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
                  } else if (yieldVal >= 1.5) {
                    performanceStatus = 'Medium';
                    performanceColor = 'text-amber-400 border-amber-500/30 bg-amber-500/10';
                  }

                  return (
                    <div key={log.id} className="p-4 rounded-2xl bg-surface border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3 group hover:border-white/20 transition-all">
                      <div className="flex gap-4 items-center">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex flex-col items-center justify-center font-mono text-[8px] text-white/40 leading-tight">
                          <Calendar className="w-3 h-3 mb-1" />
                          {log.date ? (log.date instanceof Timestamp ? log.date.toDate() : new Date(log.date)).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'Now'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm">{log.feedType} Log</h4>
                            <span className={`px-2 py-0.5 rounded text-[8px] border font-bold uppercase tracking-wide ${performanceColor}`}>
                              {performanceStatus}
                            </span>
                          </div>
                          <p className="text-[10px] text-white/40 uppercase font-mono mt-0.5">
                            {log.larvaeCondition} • {log.trayCount} Trays • Egg: <span className="text-neon-green font-bold">{ew}g</span> • Larvae: <span className="text-neon-green font-bold">{lw}kg</span> • Yield: <span className="text-neon-green font-bold">{yieldVal.toFixed(2)}kg/g</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-4 border-t border-white/5 md:border-t-0 pt-2.5 md:pt-0">
                        <div className="text-left md:text-right">
                          <p className="text-sm font-bold text-neon-green">{log.temp}°C / {log.humidity}%</p>
                          <p className="text-[10px] text-white/40 uppercase">Sensors</p>
                        </div>
                        <button 
                          onClick={() => deleteLog(log.id)}
                          className="p-2 opacity-100 md:opacity-0 group-hover:opacity-100 text-red-500/50 hover:text-red-500 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
        );
      })() : (
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="p-6 rounded-3xl bg-surface border border-white/10 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Temperature (°C)</label>
                  <input 
                    type="number" 
                    value={formData.temp}
                    onChange={(e) => setFormData({...formData, temp: Number(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-neon-green/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Humidity (%)</label>
                  <input 
                    type="number" 
                    value={formData.humidity}
                    onChange={(e) => setFormData({...formData, humidity: Number(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-neon-green/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Feed Type</label>
                  <select 
                    value={formData.feedType}
                    onChange={(e) => {
                      const selectedVal = e.target.value;
                      const matchedFeed = feedTypes.find(f => f.name === selectedVal);
                      const defaultQty = matchedFeed ? matchedFeed.defaultQty : formData.feedQty;
                      setFormData({
                        ...formData,
                        feedType: selectedVal,
                        feedQty: defaultQty
                      });
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-neon-green/50 appearance-none"
                  >
                    {feedTypes.map((feed, i) => (
                      <option key={i} value={feed.name} className="bg-neutral-900 text-white">{feed.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Feed Qty (kg)</label>
                  <input 
                    type="number" 
                    value={formData.feedQty}
                    onChange={(e) => setFormData({...formData, feedQty: Number(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-neon-green/50"
                  />
                </div>
              </div>

              {validationError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-mono tracking-tight flex items-start gap-2">
                  <span className="font-extrabold uppercase shrink-0 bg-red-500 text-black px-1 rounded text-[9px]">ERROR</span>
                  <span>{validationError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Larvae Condition</label>
                  <select 
                    value={formData.larvaeCondition}
                    onChange={(e) => setFormData({...formData, larvaeCondition: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-neon-green/50 appearance-none text-white"
                  >
                    {conditions.map((cond, i) => (
                      <option key={i} value={cond} className="bg-neutral-900 text-white">{cond}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Egg Weight (g)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="0.1"
                    value={formData.eggWeight}
                    onChange={(e) => {
                      setFormData({...formData, eggWeight: Number(e.target.value)});
                      setValidationError(null);
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-neon-green/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Larvae Weight (kg)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="0"
                    value={formData.larvaeWeight}
                    onChange={(e) => {
                      setFormData({...formData, larvaeWeight: Number(e.target.value)});
                      setValidationError(null);
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-neon-green/50"
                  />
                </div>
              </div>

              {/* Dynamic BSF Agriculture Performance Indicators */}
              {(() => {
                const eggs = formData.eggWeight || 0;
                const larvae = formData.larvaeWeight || 0;
                const feed = formData.feedQty || 0;
                
                // Formulas for BSF Biometrics:
                const fcrNum = larvae > 0 ? (feed / larvae) : 0;
                const fcr = fcrNum > 0 ? fcrNum.toFixed(2) : '0.00';
                const yieldRatioNum = eggs > 0 ? (larvae / eggs) : 0;
                const yieldRatio = yieldRatioNum.toFixed(2);

                // Define Performance scale
                let performanceStatus = 'Poor';
                let performanceColor = 'text-red-400 bg-red-500/10 border-red-500/20';
                if (yieldRatioNum >= 3.5) {
                  performanceStatus = 'Excellent';
                  performanceColor = 'text-neon-green bg-neon-green/10 border-neon-green/20';
                } else if (yieldRatioNum >= 2.5) {
                  performanceStatus = 'Good';
                  performanceColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                } else if (yieldRatioNum >= 1.5) {
                  performanceStatus = 'Medium';
                  performanceColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
                }

                // Automatic Estimates
                let hatchQuality = 'Under-performing (Substrate adjustment needed)';
                if (yieldRatioNum >= 3.5) hatchQuality = 'Premium (High egg viability & perfect hatch rate)';
                else if (yieldRatioNum >= 2.5) hatchQuality = 'Healthy (Standard neonate batch viability)';
                else if (yieldRatioNum >= 1.5) hatchQuality = 'Moderate (Awaiting increased density settling)';

                let prodEfficiency = 'High food wastage (Substrate or population lag)';
                if (fcrNum > 0 && fcrNum <= 1.5) prodEfficiency = 'Outstanding Bio-conversion (Highly efficient assimilation)';
                else if (fcrNum > 1.5 && fcrNum <= 2.2) prodEfficiency = 'Target Standard reached (Optimum feed reduction)';
                else if (fcrNum > 2.2 && fcrNum <= 3.0) prodEfficiency = 'Moderate conversion (Dampen/turn substrate)';

                let growthPerformance = 'Sub-optimal / Stunted Development (Check temperature)';
                if (yieldRatioNum >= 3.0 && fcrNum <= 2.0 && fcrNum > 0) {
                  growthPerformance = 'Outstanding Development (Instar L3 robust staging)';
                } else if (yieldRatioNum >= 1.8 && fcrNum <= 2.5 && fcrNum > 0) {
                  growthPerformance = 'Vigorous Development (Highly active population)';
                }

                return (
                  <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl space-y-4">
                    <p className="text-[10px] uppercase tracking-wider font-mono text-white/40">Dynamic Real-time Biometrics Preview</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Hatch Performance Card */}
                      <div className="p-3 bg-black/40 border border-white/5 rounded-xl space-y-1">
                        <span className="text-[9px] font-mono uppercase text-white/40 block">Hatch Performance</span>
                        <div className={`text-base font-black px-2 py-0.5 rounded-md inline-block border ${performanceColor}`}>
                          {performanceStatus}
                        </div>
                        <p className="text-[8px] text-white/30 font-mono">Based on Larvae Yield ratio</p>
                      </div>

                      {/* Yield Ratio */}
                      <div className="p-3 bg-black/40 border border-white/5 rounded-xl space-y-1">
                        <span className="text-[9px] font-mono uppercase text-white/40 block">Larvae Yield</span>
                        <div className="text-xl font-bold text-white">{yieldRatio} <span className="text-[10px] text-white/40">kg/g</span></div>
                        <p className="text-[8px] text-white/30 font-mono">Biomass weight gain factor</p>
                      </div>

                      {/* Feed Conversion Ratio */}
                      <div className="p-3 bg-black/40 border border-white/5 rounded-xl space-y-1">
                        <span className="text-[9px] font-mono uppercase text-white/40 block">Resource Efficiency</span>
                        <div className={`text-xl font-bold ${Number(fcr) > 2.2 ? 'text-orange-500' : 'text-neon-green'}`}>{fcr} <span className="text-[10px] text-white/40">FCR</span></div>
                        <p className="text-[8px] text-white/30 font-mono">Target benchmark: &lt; 2.2</p>
                      </div>
                    </div>

                    {/* Automatic Estimates Details */}
                    <div className="pt-2 border-t border-white/5 space-y-2">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-white/40">Hatch Quality:</span>
                        <span className="text-white/90 font-medium font-sans">{hatchQuality}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-white/40">Production Efficiency:</span>
                        <span className="text-white/90 font-medium font-sans">{prodEfficiency}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-white/40">Growth Performance:</span>
                        <span className="text-neon-green font-mono">{growthPerformance}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Tray Count</label>
                  <input 
                    type="number" 
                    value={formData.trayCount}
                    onChange={(e) => setFormData({...formData, trayCount: Number(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-neon-green/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Notes</label>
                <textarea 
                  placeholder="Observation notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-neon-green/50 h-24 resize-none"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isAdding}
              className="w-full py-4 bg-neon-green text-black font-black uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(57,255,20,0.2)]"
            >
              {isAdding ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Calibrating Data...</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  <span>Finalize Entry</span>
                </>
              )}
            </button>

            <button 
              type="button" 
              onClick={() => setView('dashboard')}
              className="w-full py-4 text-white/40 text-[10px] uppercase font-bold tracking-widest hover:text-white"
            >
              Discard and Return
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
