import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  History, 
  ArrowRight, 
  Sparkles, 
  Check, 
  Compass, 
  Radio, 
  Gauge, 
  AlertTriangle,
  Play,
  Square,
  Settings,
  Sliders,
  BellRing,
  Languages,
  Activity,
  User,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceAssistantProps {
  onNavigate: (tab: any) => void;
  lang: 'en' | 'hi';
  visibleAlerts: any[];
}

interface CommandHistoryItem {
  id: string;
  query: string;
  reply: string;
  timestamp: string;
  success: boolean;
}

// Global speech reference array to prevent Chromium speech synthesis GC bug (choppy audio)
const activeUtterances: any[] = [];

export default function VoiceAssistant({ onNavigate, lang, visibleAlerts }: VoiceAssistantProps) {
  // Voice preferences & Settings
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('flymind_voice_enabled') !== 'false';
    } catch { return true; }
  });

  const [voiceLanguage, setVoiceLanguage] = useState<'en' | 'hi' | 'hinglish'>(() => {
    try {
      return (localStorage.getItem('flymind_voice_language') as 'en' | 'hi' | 'hinglish') || 'hinglish';
    } catch { return 'hinglish'; }
  });

  const [wakeWordEnabled, setWakeWordEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('flymind_wake_word_enabled') === 'true';
    } catch { return false; }
  });

  const [activeWakeWord, setActiveWakeWord] = useState<string>(() => {
    try {
      return localStorage.getItem('flymind_active_wake_word') || 'Hey FlyMind';
    } catch { return 'Hey FlyMind'; }
  });

  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('flymind_voice_alerts_enabled') !== 'false';
    } catch { return true; }
  });

  const [voiceSpeed, setVoiceSpeed] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('flymind_voice_speed');
      return saved ? parseFloat(saved) : 1.0;
    } catch { return 1.0; }
  });

  // Unique voice settings (Pitch, pauses, tone smoothness)
  const [voicePitch, setVoicePitch] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('flymind_voice_pitch');
      return saved ? parseFloat(saved) : 1.0;
    } catch { return 1.0; }
  });

  const [voiceSmoothness, setVoiceSmoothness] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('flymind_voice_smoothness');
      return saved ? parseInt(saved) : 85;
    } catch { return 85; }
  });

  const [assistantPersonality, setAssistantPersonality] = useState<'jarvis' | 'mentor' | 'energetic' | 'scientific'>(() => {
    try {
      return (localStorage.getItem('flymind_assistant_personality') as any) || 'jarvis';
    } catch { return 'jarvis'; }
  });

  // Micro-filter mic enhancements
  const [noiseCancellation, setNoiseCancellation] = useState<boolean>(() => {
    try {
      return localStorage.getItem('flymind_noise_cancellation') !== 'false';
    } catch { return true; }
  });

  const [micEnhancement, setMicEnhancement] = useState<boolean>(() => {
    try {
      return localStorage.getItem('flymind_mic_enhancement') !== 'false';
    } catch { return true; }
  });

  const [echoCancellation, setEchoCancellation] = useState<boolean>(() => {
    try {
      return localStorage.getItem('flymind_echo_cancellation') !== 'false';
    } catch { return true; }
  });

  const [voiceSensitivity, setVoiceSensitivity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('flymind_voice_sensitivity');
      return saved ? parseInt(saved) : 55;
    } catch { return 55; }
  });

  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>(() => {
    try {
      return (localStorage.getItem('flymind_voice_gender') as 'female' | 'male') || 'female';
    } catch { return 'female'; }
  });

  const [autoSpeakScan, setAutoSpeakScan] = useState<boolean>(() => {
    try {
      return localStorage.getItem('flymind_auto_speak_scan_result') !== 'false';
    } catch { return true; }
  });

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [latestResponse, setLatestResponse] = useState<string>('');
  const [displayMarkdown, setDisplayMarkdown] = useState<string>('');
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Real-time audio analysis variables
  const [liveFreqData, setLiveFreqData] = useState<number[]>(new Array(16).fill(0.04));
  const [micAmplitude, setMicAmplitude] = useState<number>(0);
  const [vocalConfidence, setVocalConfidence] = useState<number>(0.95);

  // Custom spelling corrections learning dictionary
  const defaultWordMap: Record<string, string> = {
    "for mind ai": "FlyMind AI",
    "for mind": "FlyMind AI",
    "frequently": "FlyMind AI",
    "playmind": "FlyMind AI",
    "play mind": "FlyMind AI",
    "fly mind": "FlyMind AI",
    "flymind": "FlyMind AI",
    "prime mind": "FlyMind AI",
    "vessel": "BSF",
    "psf": "BSF",
    "dsf": "BSF",
    "b s f": "BSF",
    "b.s.f.": "BSF",
    "pre pupa": "Prepupa",
    "free pupa": "Prepupa",
    "pay pupa": "Prepupa",
    "prapa": "Prepupa",
    "prypupa": "Prepupa",
    "larva": "Larvae",
    "larve": "Larvae",
    "larvi": "Larvae",
    "laarve": "Larvae",
    "coala": "Colony",
    "coalony": "Colony",
    "coloni": "Colony",
    "humadity": "Humidity",
    "humidaty": "Humidity",
    "fongus": "Fungus",
    "fungas": "Fungus",
    "phungus": "Fungus",
    "bio scan": "BioScan",
    "biosean": "BioScan",
    "buy scan": "BioScan",
    "tell emetry": "Telemetry",
    "till emetry": "Telemetry",
    "tele metry": "Telemetry",
    "bio mass": "Biomass",
    "buy mass": "Biomass"
  };

  const [customDictionary, setCustomDictionary] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('flymind_voice_dictionary');
      return saved ? JSON.parse(saved) : { ...defaultWordMap };
    } catch { return { ...defaultWordMap }; }
  });

  const [newDictPhrase, setNewDictPhrase] = useState('');
  const [newDictCorrection, setNewDictCorrection] = useState('');
  const [dictSearchText, setDictSearchText] = useState('');
  const [teachingOpen, setTeachingOpen] = useState(false);

  const [history, setHistory] = useState<CommandHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('flymind_voice_history');
      return saved ? JSON.parse(saved) : [
        {
          id: 'welcome',
          query: voiceLanguage === 'hi' ? 'नमस्ते फ्लाईमाइंड' : 'Hello FlyMind',
          reply: voiceLanguage === 'hi' 
            ? 'नमस्ते! मैं आपका फ्लाईमाइंड एआई वॉयस असिस्टेंट हूं। आप मुझसे अपनी ट्रे का तापमान, आर्द्रता या कीट स्वास्थ्य पूछ सकते हैं।' 
            : voiceLanguage === 'hinglish'
              ? 'Hello! Main aapka FlyMind AI voice companion hoon. Mujhse temperature, humidity aur cycle status ke baare me poochhein.'
              : 'Greetings! I am FlyMind BSF Farming OS AI Agent. Ask me anything about environmental telemetry or larval status.',
          timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          success: true
        }
      ];
    } catch { return []; }
  });

  // Reference hooks
  const recognitionRef = useRef<any>(null);
  const continuousWakeWordRef = useRef<any>(null);
  const lastSpokenAlertId = useRef<string>('');
  const ttsTimeoutRef = useRef<any>(null);
  const spokenAlertTracker = useRef<Record<string, number>>({});

  // Web Audio stream refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Advanced spelling corrector for custom vocabulary alignment
  const correctSpeechText = (rawText: string): string => {
    let cleaned = rawText;
    // Sort keys descending in length so we replace longer phrases first
    const sortedKeys = Object.keys(customDictionary).sort((a, b) => b.length - a.length);
    for (const phrase of sortedKeys) {
      const correction = customDictionary[phrase];
      const escaped = phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      // Replace whole words or boundaries
      const regexBound = new RegExp(`\\b${escaped}\\b`, 'gi');
      cleaned = cleaned.replace(regexBound, correction);
      if (phrase.includes(' ')) {
        const regexSub = new RegExp(escaped, 'gi');
        cleaned = cleaned.replace(regexSub, correction);
      }
    }
    return cleaned;
  };

  // Audio Luxury synthetic beeper
  const playBeep = (freq = 950, duration = 0.12) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.frequency.value = freq;
      osc.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn("Audio Context beep failed", e);
    }
  };

  // Conversational English technical terms to Hindi phonetic Devanagari translation mapper 
  const convertEnglishToHindiPhonetics = (text: string): string => {
    let result = text;
    
    // Mappings of standard biological/farming jargon to Hindi Devanagari characters
    const mappings: Record<string, string> = {
      "humidity": "ह्यूमिडिटी",
      "temperature": "टेंपरेचर",
      "temp": "टेंपरेचर",
      "fungus": "फंगस",
      "mold": "मोल्ड",
      "risk": "रिस्क",
      "detected": "डिटेक्टेड",
      "larvae": "लार्वा",
      "healthy": "हेल्दी",
      "condition": "कंडीशन",
      "status": "स्टेटस",
      "pupa": "प्यूपा",
      "prepupa": "प्री-प्यूपा",
      "egg": "एग",
      "eggs": "अंडे",
      "bsf": "बीएसएफ",
      "fcr": "एफसीआर",
      "feed": "फ़ीड",
      "substrate": "सबस्ट्रेट",
      "biomass": "बायोमास",
      "celsius": "सेल्सियस",
      "degrees": "डिग्री",
      "warning": "वॉर्निंग",
      "critical": "क्रिटिकल",
      "danger": "डेंजर",
      "active": "एक्टिव",
      "good": "अच्छा",
      "high": "हाई",
      "low": "लो",
      "medium": "मीडियम",
      "progress": "प्रोग्रेस",
      "percent": "परसेंट",
      "complete": "कम्पलीट",
      "advice": "सलाह",
      "recommendation": "सलाह",
      "attention": "ध्यान दें",
      "normal": "नॉर्मल",
      "overcrowded": "ओवरक्राउडेड",
      "overcrowding": "ओवरक्राउडिंग",
      "drying": "ड्राइंग",
      "moisture": "मॉइस्चर",
      "colony": "कॉलोनी"
    };

    // Sort keys descending in length to avoid partial replacements
    const sortedKeys = Object.keys(mappings).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      const value = mappings[key];
      const escaped = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      result = result.replace(regex, value);
      // Fallback for compound substrings without word boundaries
      if (key.includes(' ') || key.length > 4) {
        const regexSub = new RegExp(escaped, 'gi');
        result = result.replace(regexSub, value);
      }
    }

    return result;
  };

  // Upgraded Natural Premium Text-To-Speech engine with GC anchor and language support
  const speakVoice = (text: string) => {
    if (!voiceEnabled) return;
    if (!('speechSynthesis' in window)) return;
    
    try {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      // Clear previous anchors
      activeUtterances.length = 0;
      
      // Auto-detect if we should speak in Hindi style
      const containsHindi = /[\u0900-\u097F]/.test(text) || 
                            voiceLanguage === 'hi' || 
                            lang === 'hi' ||
                            (voiceLanguage === 'hinglish' && (text.toLowerCase().includes('hai') || text.toLowerCase().includes('aur')));
      
      let formattedText = text;
      if (containsHindi) {
        // Enforce phonetic Hindi mappings to avoid English letter spelling style robotic accent
        formattedText = convertEnglishToHindiPhonetics(formattedText);
      }

      // Inject commas and short punctuation gaps dynamically depending on the selected "smoothness" rate
      if (voiceSmoothness > 50) {
        formattedText = formattedText
          .replace(/([.?!])\s*/g, "$1, ... ")
          .replace(/(\d+(\.\d+)?)\s*(percent|g|kg|degrees|celsius|परसेंट|डिग्री|सेल्सियस)/gi, " $1 , $3");
      }
      
      const utterance = new SpeechSynthesisUtterance(formattedText);
      const voices = window.speechSynthesis.getVoices();
      
      let selectedVoice = null;
      if (containsHindi) {
        utterance.lang = 'hi-IN'; // FORCE HINDI native model to completely eliminate robotic spelling
        
        // Preferred Hindi native voices (Google हिन्दी, Kalpana, Hemant, Microsoft Indian English fallbacks)
        selectedVoice = voices.find(v => v.lang.startsWith('hi-IN') && v.name.includes('Google')) || 
                        voices.find(v => v.lang.startsWith('hi-IN')) || 
                        voices.find(v => v.lang.startsWith('en-IN') && v.name.includes('Google')) ||
                        voices.find(v => v.lang.startsWith('en-IN')) ||
                        voices.find(v => v.lang.startsWith('hi'));
      } else {
        utterance.lang = 'en-US';
        
        // Match English gender preference with high quality neural matches
        if (voiceGender === 'male') {
          selectedVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Male') || v.name.includes('David') || v.name.includes('Mark'))) ||
                          voices.find(v => v.lang.startsWith('en'));
        } else {
          selectedVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google US English') || v.name.includes('Zira') || v.name.includes('Natural') || v.name.includes('Premium') || v.name.includes('Neural'))) ||
                          voices.find(v => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Hazel'))) ||
                          voices.find(v => v.lang.startsWith('en'));
        }
      }
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      
      utterance.pitch = voicePitch * (voiceGender === 'female' ? 1.05 : 0.90);
      utterance.rate = voiceSpeed;
      
      utterance.onstart = () => {
        setIsSpeaking(true);
        if (!analyserRef.current) {
          startSimulatedPulseWave();
        }
      };
      
      utterance.onend = () => {
        setIsSpeaking(false);
        cancelAnimationFrame(animationFrameRef.current!);
      };
      
      utterance.onerror = (event: any) => {
        console.warn("Primary Speech Synthesis failure. Attempting secondary fallback...", event);
        setIsSpeaking(false);
        cancelAnimationFrame(animationFrameRef.current!);
        
        // Secondary Fallback Speech system:
        try {
          const fallbackUtterance = new SpeechSynthesisUtterance(formattedText);
          fallbackUtterance.lang = containsHindi ? 'hi-IN' : 'en-US';
          fallbackUtterance.rate = voiceSpeed;
          fallbackUtterance.onstart = () => setIsSpeaking(true);
          fallbackUtterance.onend = () => setIsSpeaking(false);
          
          activeUtterances.push(fallbackUtterance);
          window.speechSynthesis.speak(fallbackUtterance);
        } catch (secondaryErr) {
          console.error("Secondary fallback TTS failed on device:", secondaryErr);
          // Audio tone indicators for physical alerts feedback (APK & physical devices backup)
          playBeep(880, 0.2);
          setTimeout(() => playBeep(550, 0.3), 250);
        }
      };
      
      // GC Bug Prevention Anchor
      activeUtterances.push(utterance);
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("FlyMind Voice Synthesis failure:", err);
      setIsSpeaking(false);
    }
  };

  const startSimulatedPulseWave = () => {
    let frame = 0;
    const ticker = () => {
      frame++;
      const wave = Array.from({ length: 16 }, (_, i) => {
        return (Math.sin(frame * 0.15 + i * 0.45) * 0.35 + 0.5) * (Math.random() * 0.2 + 0.8);
      });
      setLiveFreqData(wave);
      animationFrameRef.current = requestAnimationFrame(ticker);
    };
    ticker();
  };

  // Broadcast settings sync
  useEffect(() => {
    localStorage.setItem('flymind_voice_enabled', voiceEnabled.toString());
  }, [voiceEnabled]);

  useEffect(() => {
    localStorage.setItem('flymind_voice_language', voiceLanguage);
  }, [voiceLanguage]);

  useEffect(() => {
    localStorage.setItem('flymind_active_wake_word', activeWakeWord);
    if (wakeWordEnabled) {
      stopWakeWordListening();
      startWakeWordListening();
    }
  }, [activeWakeWord]);

  useEffect(() => {
    localStorage.setItem('flymind_voice_speed', voiceSpeed.toString());
  }, [voiceSpeed]);

  useEffect(() => {
    localStorage.setItem('flymind_voice_pitch', voicePitch.toString());
  }, [voicePitch]);

  useEffect(() => {
    localStorage.setItem('flymind_voice_smoothness', voiceSmoothness.toString());
  }, [voiceSmoothness]);

  useEffect(() => {
    localStorage.setItem('flymind_assistant_personality', assistantPersonality);
  }, [assistantPersonality]);

  useEffect(() => {
    localStorage.setItem('flymind_noise_cancellation', noiseCancellation.toString());
  }, [noiseCancellation]);

  useEffect(() => {
    localStorage.setItem('flymind_mic_enhancement', micEnhancement.toString());
  }, [micEnhancement]);

  useEffect(() => {
    localStorage.setItem('flymind_echo_cancellation', echoCancellation.toString());
  }, [echoCancellation]);

  useEffect(() => {
    localStorage.setItem('flymind_voice_sensitivity', voiceSensitivity.toString());
  }, [voiceSensitivity]);

  useEffect(() => {
    localStorage.setItem('flymind_voice_gender', voiceGender);
  }, [voiceGender]);

  useEffect(() => {
    localStorage.setItem('flymind_auto_speak_scan_result', autoSpeakScan.toString());
  }, [autoSpeakScan]);

  // Sync wake word switch
  useEffect(() => {
    localStorage.setItem('flymind_wake_word_enabled', wakeWordEnabled.toString());
    if (wakeWordEnabled) {
      startWakeWordListening();
    } else {
      stopWakeWordListening();
    }
    return () => stopWakeWordListening();
  }, [wakeWordEnabled]);

  useEffect(() => {
    localStorage.setItem('flymind_voice_alerts_enabled', voiceAlertsEnabled.toString());
  }, [voiceAlertsEnabled]);

  useEffect(() => {
    localStorage.setItem('flymind_voice_history', JSON.stringify(history));
  }, [history]);

  // Handle external scan events to instantly speak the report!
  useEffect(() => {
    const handleScanComplete = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail || !autoSpeakScan) return;
      
      const payload = customEvent.detail;
      
      // Build dynamic facts and limits
      const stage = payload.detectedStage || 'Unknown Stage';
      const status = payload.status || 'Active';
      const tempVal = parseFloat(localStorage.getItem('flymind_temp') || '29.4');
      const humidityVal = parseInt(localStorage.getItem('flymind_humidity') || '64');
      
      const highTempThr = Number(localStorage.getItem('flymind_high_temp_limit') || 33);
      const lowTempThr = Number(localStorage.getItem('flymind_low_temp_limit') || 22);
      const highHumThr = Number(localStorage.getItem('flymind_high_humidity_limit') || 85);
      const lowHumThr = Number(localStorage.getItem('flymind_low_humidity_limit') || 45);

      // Analyze Climate alerts for spoken context
      let tempWarningEn = '';
      let tempWarningHi = '';
      let tempWarningHinglish = '';

      if (tempVal > highTempThr) {
        tempWarningEn = `Alert: Temperature level is dangerously high at ${tempVal.toFixed(1)} degrees. `;
        tempWarningHi = `गंभीर चेतावनी: तापमान सीमा से अधिक है, अभी ${tempVal.toFixed(1)} डिग्री है। `;
        tempWarningHinglish = `Temperature alarm active hai. Racks bahut garam hain. Currently ${tempVal.toFixed(1)} degrees temperature hai. `;
      } else if (tempVal < lowTempThr) {
        tempWarningEn = `Alert: Chilling temperature registered at ${tempVal.toFixed(1)} degrees. Growth will stall. `;
        tempWarningHi = `चेतावनी: तापमान कम है, अभी ${tempVal.toFixed(1)} डिग्री है जिससे विकास धीमा हो सकता है। `;
        tempWarningHinglish = `Chilling temperature risk hai. Traies cold hain at ${tempVal.toFixed(1)} degrees. `;
      }

      let fungusWarningEn = '';
      let fungusWarningHi = '';
      let fungusWarningHinglish = '';

      const statusLower = status.toLowerCase();
      const payloadAdvice = payload.farmingAdvice || 'maintain good humidity and substrate aeration';

      if (statusLower.includes('fungus') || statusLower.includes('mold') || humidityVal > highHumThr) {
        fungusWarningEn = `Hazard warning: High humidity has increased mold and fungus risk in active compartments. `;
        fungusWarningHi = `जैविक खतरा चेतावनी: अधिक नमी के कारण कवक और फंगस संदूषण का गंभीर रिस्क पाया गया है। `;
        fungusWarningHinglish = `Humidity zyada hai. Fungus risk medium detected in trays. Action lijiye. `;
      }

      // Auto-identify appropriate speech system based on both the global app 'lang' and local 'voiceLanguage'
      const currentLang = (lang === 'hi' && voiceLanguage === 'en') ? 'hinglish' : voiceLanguage;
      let verbalStatement = '';

      if (currentLang === 'en') {
        verbalStatement = `Scan report complete. Detected lifecycle stage is ${stage}. BSF colony status is ${status}. Climate metrics are ${tempVal.toFixed(1)} degrees Celsius, and relative humidity is ${humidityVal} percent. ${tempWarningEn}${fungusWarningEn}AI recommended action is: ${payloadAdvice}.`;
      } else if (currentLang === 'hi') {
        // Translation lookups for full Devanagari Hindi readout
        const baseStageTranslator: Record<string, string> = {
          'Growing Larvae': 'बढ़ते लार्वा',
          'L1 Larvae': 'एल वन लार्वा',
          'L2 Larvae': 'एल टू लार्वा',
          'L3 Larvae': 'एल थ्री लार्वा',
          'Prepupa': 'प्री-प्यूपा',
          'Pupa': 'प्यूपा',
          'Adult BSF': 'वयस्क बीएसएफ मक्खी',
          'Eggs': 'अंडे'
        };
        const stageHi = baseStageTranslator[stage] || stage;

        const baseStatusTranslator: Record<string, string> = {
          'Active': 'सक्रिय अवस्था',
          'Healthy': 'स्वस्थ और उत्तम',
          'Overcrowded': 'अत्यधिक घनी आबादी',
          'Fungus Risk/Mold': 'फंगस का संक्रमण खतरा',
          'Dormant': 'निष्क्रिय और सुस्त',
          'Critical': 'अत्यंत गंभीर'
        };
        const statusHi = baseStatusTranslator[status] || status;

        // Custom recommendations translate
        let adviceHi = payloadAdvice;
        if (payloadAdvice.toLowerCase().includes('moist') || payloadAdvice.toLowerCase().includes('water')) {
          adviceHi = "नमी बनाए रखने के लिए हल्का पानी छिड़कें और पर्याप्त भोजन दें।";
        } else if (payloadAdvice.toLowerCase().includes('stir') || payloadAdvice.toLowerCase().includes('mix')) {
          adviceHi = "हवा के संचार के लिए खाद के मिश्रण को अच्छी तरह हिलाएं।";
        } else if (payloadAdvice.toLowerCase().includes('ventil') || payloadAdvice.toLowerCase().includes('cool')) {
          adviceHi = "हवादार पंखे चलाएं और पिंजरों का तापमान नियंत्रित करें।";
        }

        verbalStatement = `कीट स्कैन रिपोर्ट पूरी हो चुकी है। पहचानी गई जीवन चक्र अवस्था ${stageHi} है। कॉलोनी की भौतिक स्थिति ${statusHi} है। वर्तमान वातावरण सेंसर तापमान ${tempVal.toFixed(1)} डिग्री है और ट्रे की नमी ${humidityVal} प्रतिशत दर्ज है। ${tempWarningHi}${fungusWarningHi}एआई सलाहकार की प्रमुख सलाह: ${adviceHi}`;
      } else {
        // Hinglish mode
        verbalStatement = `Biological scan completed! Detected stage ${stage} hai, colony condition abhi ${status} status me chal rahi hai. Inside humidity ${humidityVal} percent hai and average tray temperature ${tempVal.toFixed(1)} degrees. ${tempWarningHinglish}${fungusWarningHinglish}Main recommendation hai: ${payloadAdvice}.`;
      }
      
      // Brief timeout to let user see visuals and complete dashboard UI rendering first
      setTimeout(() => {
        speakVoice(verbalStatement);
      }, 1200);
    };

    window.addEventListener('flymind_scan_complete', handleScanComplete);
    return () => {
      window.removeEventListener('flymind_scan_complete', handleScanComplete);
    };
  }, [autoSpeakScan, voiceLanguage, lang]);

  // Continuous monitoring for ambient sensors (High Temp, Low Humidity warnings, overcrowding, Sluggish, fungal risk)
  useEffect(() => {
    if (!voiceAlertsEnabled || !voiceEnabled) return;

    const checkTelemetryAndAlerts = () => {
      const currentTemp = parseFloat(localStorage.getItem('flymind_temp') || '29.4');
      const currentHum = parseInt(localStorage.getItem('flymind_humidity') || '64');
      const activeStage = localStorage.getItem('flymind_scanned_stage') || 'Growing Larvae';
      const lastFungusRisk = localStorage.getItem('flymind_fungal_detected') === 'true';

      const highTempLimit = parseFloat(localStorage.getItem('flymind_high_temp_limit') || '33');
      const lowTempLimit = parseFloat(localStorage.getItem('flymind_low_temp_limit') || '22');
      const highHumLimit = parseFloat(localStorage.getItem('flymind_high_humidity_limit') || '85');
      const lowHumLimit = parseFloat(localStorage.getItem('flymind_low_humidity_limit') || '45');

      const now = Date.now();
      const COOLDOWN = 60000; // 60 seconds verbal alarm delay to avoid overlapping loops

      const triggerVerbalAlert = (alertKey: string, phrases: { en: string; hi: string; hinglish: string }) => {
        const lastSpoken = spokenAlertTracker.current[alertKey] || 0;
        if (now - lastSpoken > COOLDOWN && !isListening && !isProcessing) {
          spokenAlertTracker.current[alertKey] = now;
          let phraseText = phrases.en;
          if (voiceLanguage === 'hi') phraseText = phrases.hi;
          if (voiceLanguage === 'hinglish') phraseText = phrases.hinglish;
          speakVoice(phraseText);
        }
      };

      // 1. High Temperature Alert
      if (currentTemp > highTempLimit) {
        triggerVerbalAlert('high_temp', {
          en: `Warning alert. Temperature level is critically high. Currently at ${currentTemp} degrees. Activate cooling fans.`,
          hi: `सावधान। थर्मामीटर तापमान बहुत अधिक है। अभी का तापमान ${currentTemp} डिग्री है। कूलिंग चालू करें।`,
          hinglish: `Caution! Temperature level critically high hai. Current temp is ${currentTemp} degrees. Please cool down the racks.`
        });
      }
      // 2. Low Humidity Alert
      else if (currentHum < lowHumLimit) {
        triggerVerbalAlert('low_humidity', {
          en: `Warning. Soil humidity is critically low at ${currentHum} percent. Dry substrate risk.`,
          hi: `चेतावनी। सांद्रता या नमी अत्यंत कम है। वर्तमान नमी ${currentHum} प्रतिशत है। हल्का छिड़काव करें।`,
          hinglish: `Alert. Feed tray humidity dangerously low ho gayi hai at ${currentHum} percent. Sookha risk ban raha hai.`
        });
      }
      // 3. Fungal Alert
      if (lastFungusRisk) {
        triggerVerbalAlert('fungus', {
          en: "Biological Hazard Alert. Fungal spore colonies detected. Action required.",
          hi: "जैविक चेतावनी। कीट ट्रे में कवक संदूषण का पता चला है। सफाई करें।",
          hinglish: "Warning. Larvae colony me fungal development detect hua hai. Substrate ko stir karein."
        });
      }
      // 4. Overcrowding Check (high temp + high density simulated)
      if (currentTemp > 32.5 && currentHum > 75) {
        triggerVerbalAlert('crowd', {
          en: "Alert. Colony overcrowding detected. Active larvae generating metabolic heat.",
          hi: "चेतावनी। पिंजरे में कीड़ों की घनी आबादी है। तुरंत विभाजित करें।",
          hinglish: "Warning. Overcrowded biological density detect hui hai. Tray partition require hai."
        });
      }
    };

    const intervalId = setInterval(checkTelemetryAndAlerts, 12000); // Poll telemetry register states
    return () => clearInterval(intervalId);
  }, [voiceAlertsEnabled, voiceEnabled, voiceLanguage, isListening, isProcessing]);

  const setupAudioAnalyser = async () => {
    try {
      if (!('navigator' in window && 'mediaDevices' in navigator)) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: echoCancellation,
          noiseSuppression: noiseCancellation,
          autoGainControl: micEnhancement
        }
      });
      
      micStreamRef.current = stream;
      
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; // Small fft for 32 bin frequency spectrum
      source.connect(analyser);
      analyserRef.current = analyser;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateFrequencies = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Sum amplitude for mic pulse glow
        let sum = 0;
        const normalized = Array.from(dataArray).slice(0, 16).map(val => {
          sum += val;
          return val / 255.0; // scale between 0.0 and 1.0
        });
        
        const avg = sum / 16;
        setMicAmplitude(avg);
        setLiveFreqData(normalized);
        
        // Dynamic confidence simulation with low micro-variance
        const confidenceClarity = Math.min(0.99, Math.max(0.75, 0.88 + (avg > 12 ? (100 - avg) / 1000 : 0.05)));
        setVocalConfidence(Number(confidenceClarity.toFixed(2)));
        
        animationFrameRef.current = requestAnimationFrame(updateFrequencies);
      };
      
      updateFrequencies();
    } catch (err) {
      console.warn("Media devices/Web Audio disabled or permission denied. Falling back to simulated visuals.", err);
    }
  };

  const teardownAudioAnalyser = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setLiveFreqData(new Array(16).fill(0.04));
    setMicAmplitude(0);
  };

  // Main SpeechRecognition initializer
  const startListening = async () => {
    if (isListening || isProcessing) return;
    
    stopWakeWordListening();
    setSpeechError(null);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition API is not supported in this browser. Please use Chrome or Safari.");
      return;
    }

    playBeep(1020, 0.16); // High-tech wake chime
    setTranscript('');
    setIsListening(true);
    
    // Connect actual micro audio analyser
    await setupAudioAnalyser();

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = voiceLanguage === 'hi' ? 'hi-IN' : 'en-US';

    recognition.onresult = (event: any) => {
      let currentResult = '';
      let confidence = 0.95;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentResult += event.results[i][0].transcript;
        if (event.results[i][0].confidence) {
          confidence = event.results[i][0].confidence;
        }
      }
      
      // Realtime spelling correction & custom dictionary alignment
      const correctedText = correctSpeechText(currentResult);
      setTranscript(correctedText);
      setVocalConfidence(Number(Math.max(confidence, 0.84).toFixed(2)));
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
      teardownAudioAnalyser();
      if (event.error === 'not-allowed') {
        setSpeechError('not-allowed');
      } else if (event.error !== 'no-speech') {
        setSpeechError(event.error);
      }
      setIsListening(false);
      playBeep(480, 0.22); // Failure drop chime
      
      if (wakeWordEnabled) startWakeWordListening();
    };

    recognition.onend = () => {
      setIsListening(false);
      teardownAudioAnalyser();
      
      setTranscript(prev => {
        const finalized = prev.trim();
        if (finalized) {
          playBeep(1150, 0.08); // Processing pulse tone
          handleSendToAI(finalized);
        } else {
          if (wakeWordEnabled) startWakeWordListening();
        }
        return finalized;
      });
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn(e);
      }
    }
    teardownAudioAnalyser();
    setIsListening(false);
  };

  // Continuous Hotword Wake Handler
  const startWakeWordListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition || continuousWakeWordRef.current) return;

    const wakeRecognizer = new SpeechRecognition();
    wakeRecognizer.continuous = true;
    wakeRecognizer.interimResults = false;
    wakeRecognizer.lang = 'hi-IN'; // Picks up both Hindi & Roman Hindi easily

    wakeRecognizer.onresult = (event: any) => {
      const lastIndex = event.results.length - 1;
      const spokenText = event.results[lastIndex][0].transcript.toLowerCase();
      
      const targetPhrase = activeWakeWord.toLowerCase();

      // Flexible hotword keyword matching with custom audio spelling
      const matchesWake = spokenText.includes(targetPhrase) || 
                          (targetPhrase === 'hey flymind' && (spokenText.includes('hey flymind') || spokenText.includes('flymind') || spokenText.includes('playmind') || spokenText.includes('fly mind'))) ||
                          (targetPhrase === 'flymind scan' && (spokenText.includes('scan') || spokenText.includes('flymind scan'))) ||
                          (targetPhrase === 'hello colony' && (spokenText.includes('hello colony') || spokenText.includes('colony'))) ||
                          (targetPhrase === 'bsf assistant' && (spokenText.includes('assistant') || spokenText.includes('bsf')));

      if (matchesWake) {
        wakeRecognizer.stop();
        playBeep(1200, 0.1);
        setTimeout(() => {
          startListening();
        }, 150);
      }
    };

    wakeRecognizer.onend = () => {
      continuousWakeWordRef.current = null;
      if (wakeWordEnabled && !isListening && !isProcessing) {
        startWakeWordListening();
      }
    };

    try {
      continuousWakeWordRef.current = wakeRecognizer;
      wakeRecognizer.start();
    } catch (e) {
      console.warn("Wake word continuous listener error:", e);
    }
  };

  const stopWakeWordListening = () => {
    if (continuousWakeWordRef.current) {
      try {
        continuousWakeWordRef.current.stop();
      } catch {}
      continuousWakeWordRef.current = null;
    }
  };

  // Submit Query to real AI server-side proxy
  const handleSendToAI = async (messageText: string) => {
    if (!messageText.trim()) return;
    setIsProcessing(true);

    try {
      const tempVal = parseFloat(localStorage.getItem('flymind_temp') || '29.4');
      const humVal = parseInt(localStorage.getItem('flymind_humidity') || '64');
      const eggVal = parseFloat(localStorage.getItem('flymind_latest_egg_weight') || '12.5');
      const larvaeVal = parseFloat(localStorage.getItem('flymind_latest_larvae_weight') || '25.0');
      const feedVal = parseFloat(localStorage.getItem('flymind_latest_feed_qty') || '5.0');
      
      const payloadContext = {
        temp: tempVal,
        humidity: humVal,
        eggWeight: eggVal,
        larvaeWeight: larvaeVal,
        feedQty: feedVal,
        yieldRatio: eggVal > 0 ? Number((larvaeVal / eggVal).toFixed(2)) : 2.00,
        fcr: larvaeVal > 0 ? Number((feedVal / larvaeVal).toFixed(2)) : 1.80,
        activeAlerts: visibleAlerts.map(a => ({ title: a.title, msg: a.msg, hiMsg: a.hiMsg })),
        currentStage: localStorage.getItem('flymind_scanned_stage') || 'Growing Larvae'
      };

      const res = await fetch('/api/voice-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          lang: voiceLanguage, // feed voice preferences directly to Gemini
          personality: assistantPersonality, // feed custom assistant personality directly to server.ts!
          farmContext: payloadContext
        })
      });

      if (!res.ok) {
        throw new Error("FlyMind AI response failed");
      }

      const data = await res.json();
      
      const textSpeech = data.textSpeech || "I didn't process that clearly.";
      const textDisplay = data.textDisplay || "I couldn't process this request.";
      const action = data.action;
      const targetTab = data.targetTab;

      setLatestResponse(textSpeech);
      setDisplayMarkdown(textDisplay);

      // Speak AI result smoothly
      speakVoice(textSpeech);

      // Process direct physical navigation requests
      if (action === 'navigate' && targetTab && targetTab !== 'none' && targetTab !== 'voice') {
        const actionMessage = voiceLanguage === 'hi' 
          ? `ठीक है, मैं आपको ${targetTab} स्क्रीन पर ले जा रहा हूं।` 
          : voiceLanguage === 'hinglish' ? `Sure, main aapko instantly ${targetTab} page par redirect kar rahi hoon.` : `Navigating to the ${targetTab} panel as requested.`;
        
        speakVoice(actionMessage);
        setTimeout(() => {
          onNavigate(targetTab);
        }, 1600);
      }

      const newLog: CommandHistoryItem = {
        id: Math.random().toString(),
        query: messageText,
        reply: textSpeech,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        success: true
      };
      setHistory(prev => [newLog, ...prev.slice(0, 19)]);

    } catch (err: any) {
      console.error(err);
      const errReply = voiceLanguage === 'hi' 
        ? "सिग्नल कनेक्टिविटी व्यवधान। पुनः प्रयास करें।" 
        : voiceLanguage === 'hinglish' ? "Uplink issue. Dobara bolkar try kijiye." : "Network downlink delayed. Please try again.";
      
      setLatestResponse(errReply);
      speakVoice(errReply);

      const errorLog: CommandHistoryItem = {
        id: Math.random().toString(),
        query: messageText,
        reply: errReply,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        success: false
      };
      setHistory(prev => [errorLog, ...prev]);
    } finally {
      setIsProcessing(false);
      if (wakeWordEnabled && !isListening) {
        startWakeWordListening();
      }
    }
  };

  const handleSuggestClick = (suggestion: string) => {
    if (isListening || isProcessing) return;
    setTranscript(suggestion);
    handleSendToAI(suggestion);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('flymind_voice_history');
  };

  const suggestions = voiceLanguage === 'hi' ? [
    "क्या तापमान सुरक्षित है?",
    "अलर्ट स्क्रीन दिखाओ",
    "क्या आर्द्रता सुदृढ़ है?",
    "कीड़ों की उपज क्या है?"
  ] : voiceLanguage === 'hinglish' ? [
    "Temperature abhi kya chal raha hai?",
    "Alerts check karo aur screen dekhao",
    "Kya feed moisture normal hai?",
    "Larvae cycle stage analyze karo"
  ] : [
    "Check temperature limits",
    "Is larvae feed too wet?",
    "Show active alerts",
    "Identify current lifecycle progress"
  ];

  return (
    <div className="space-y-6 pb-28">
      {/* Visual Header / Welcome Section */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-2 text-[#00E5FF] text-[10px] font-mono tracking-widest uppercase mb-1.5">
            <Radio className="w-3.5 h-3.5 animate-pulse text-neon-green" />
            <span>JARVIS VOX ENGINE ONLINE &bull; लाइव ध्वनि सहायक</span>
          </div>
          <h2 className="text-3xl font-extrabold font-display tracking-tight text-white mb-1">
            {lang === 'hi' ? 'एआई वॉयस असिस्टेंट' : 'FlyMind Vox Portal'}
          </h2>
          <p className="text-xs text-white/40 max-w-xl font-sans">
            {lang === 'hi' 
              ? 'फ्लाईमाइंड वॉयस असिस्टेंट आपके प्रश्नों को सुनता है, लाइव ट्रे स्थिति का आकलन करता है और त्वरित परिणाम बोलता है।' 
              : 'Interact with your BSF facility using spoken commands. Controls dynamic navigation, telemetry feedback, and alarm checks.'}
          </p>
        </div>
      </section>

      {/* Main Glassmorphic Glowing Assistant Screen */}
      <div className="p-6 md:p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 shadow-2xl relative overflow-hidden flex flex-col items-center">
        {/* Holographic background gradient overlays */}
        <div className="absolute top-0 right-0 w-84 h-84 bg-neon-green/[0.02] blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-84 h-84 bg-neon-cyan/[0.03] blur-[120px] rounded-full pointer-events-none" />
        
        {/* Visual Pulse Orb and Mic Control */}
        <div className="py-8 flex flex-col items-center relative z-10 w-full">
          <div className="relative w-36 h-36 flex items-center justify-center">
            {/* Spinning Technical Outer Rings */}
            <motion.div
              animate={{ rotate: isListening ? 360 : 0 }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
              className={`absolute inset-0 border border-dashed rounded-full pointer-events-none ${
                isListening ? 'border-neon-green/45' : 'border-white/10'
              }`}
            />
            <motion.div
              animate={{ rotate: isProcessing ? -360 : 0 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className={`absolute inset-2 border border-dotted rounded-full pointer-events-none ${
                isProcessing ? 'border-[#00E5FF]/45' : 'border-white/5'
              }`}
            />

            {/* Glowing active core pulses with spring scale indicators */}
            <AnimatePresence>
              {isListening && (
                <>
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0.6 }}
                    animate={{ scale: 1.55, opacity: 0 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full bg-neon-green/10 border border-neon-green/30"
                  />
                  <motion.div
                    initial={{ scale: 1.0, opacity: 0.4 }}
                    animate={{ scale: 1.35, opacity: 0 }}
                    exit={{ scale: 1.0, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 1.4, ease: "easeOut", delay: 0.4 }}
                    className="absolute inset-0 rounded-full bg-neon-cyan/5 border border-[#00E5FF]/20"
                  />
                </>
              )}
            </AnimatePresence>

            {/* The Tactile Holographic Mic Button */}
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isProcessing}
              type="button"
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 relative select-none cursor-pointer ${
                isListening 
                  ? 'bg-red-500/10 border border-red-500/40 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.25)]' 
                  : isProcessing
                    ? 'bg-[#00E5FF]/10 border border-[#00E5FF]/40 text-[#00E5FF]'
                    : 'bg-black/40 border border-white/10 text-neon-green hover:border-neon-green/45 hover:shadow-[0_0_30px_rgba(57,255,20,0.25)]'
              }`}
            >
              <AnimatePresence mode="wait">
                {isListening ? (
                  <motion.div
                    key="listening"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                  >
                    <Square className="w-8 h-8 fill-red-400/20" />
                  </motion.div>
                ) : isProcessing ? (
                  <motion.div
                    key="processing"
                    initial={{ scale: 0.8, rotate: 0 }}
                    animate={{ scale: 1, rotate: 360 }}
                    exit={{ scale: 0.8 }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                  >
                    <RefreshCw className="w-8 h-8" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                  >
                    <Mic className="w-9 h-9" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>

          <span className="text-[10px] font-mono font-bold tracking-widest text-white/40 uppercase mt-4 block">
            {isListening 
              ? (lang === 'hi' ? 'बोलिए, सुन रहा हूँ...' : 'Listening... Speak now') 
              : isProcessing 
                ? (lang === 'hi' ? 'प्रक्रिया चल रही है...' : 'Decoding uplink...') 
                : (lang === 'hi' ? 'माइक्रोफ़ोन टैप करें' : 'Tap Orb to Command')}
          </span>
        </div>

        {/* Real-time speech wave animation & Neural frequency spectrum under Mic orb */}
        <div className="w-full flex flex-col items-center justify-center py-4 relative z-25">
          {isListening && (
            <div className="space-y-2 w-full max-w-md">
              <div className="flex justify-between items-center text-[9px] font-mono text-neon-green font-bold">
                <span>REAL-TIME MICROPHONE ANALYSIS</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-ping" />
                  SENSING FREQUENCY BUFFER
                </span>
              </div>
              <div className="flex items-end gap-1 h-14 justify-center w-full bg-black/40 border border-white/5 p-3 rounded-2xl">
                {liveFreqData.map((v, i) => (
                  <div
                    key={i}
                    style={{ height: `${Math.max(10, v * 100)}%` }}
                    className="w-2.5 rounded-full bg-gradient-to-t from-neon-green to-neon-cyan duration-75 transition-all shadow-[0_0_12px_rgba(57,255,20,0.45)]"
                  />
                ))}
              </div>
              <div className="flex justify-between items-center text-[8.5px] font-mono text-white/40">
                <span>Mic Audio Gain: auto-adjust</span>
                <span className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded text-neon-cyan font-semibold">
                  Signal Decibel: {Math.max(30, Math.floor(micAmplitude))} dB
                </span>
              </div>
            </div>
          )}
          {isSpeaking && !isListening && (
            <div className="space-y-2 w-full max-w-md">
              <div className="flex justify-between items-center text-[9px] font-mono text-neon-cyan font-bold">
                <span>PREMIUM NEURAL VOICE SYNTHESIS</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-ping" />
                  STREAMING SPEECH AUDIO
                </span>
              </div>
              <div className="flex items-end gap-1 h-14 justify-center w-full bg-black/40 border border-white/5 p-3 rounded-2xl">
                {Array.from({ length: 16 }).map((_, i) => {
                  const heightMult = Math.sin(Date.now() * 0.006 + i * 0.5) * 0.35 + 0.65;
                  return (
                    <div
                      key={i}
                      style={{ height: `${Math.max(12, heightMult * 85)}%` }}
                      className="w-2.5 rounded-full bg-gradient-to-t from-neon-cyan via-neon-green to-[#00E5FF] transition-all duration-100 shadow-[0_0_10px_rgba(0,229,255,0.4)]"
                    />
                  );
                })}
              </div>
              <div className="flex justify-between items-center text-[8.5px] font-mono text-white/40">
                <span>Codec: SpeechSynthesisUtterance</span>
                <span className="text-neon-cyan animate-pulse font-semibold">OUTPUT: ONLINE &middot; SPEAKING</span>
              </div>
            </div>
          )}
        </div>

        {/* Permission / Sandbox Security Error Banner */}
        <AnimatePresence>
          {speechError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="w-full mb-5 p-4.5 rounded-2xl bg-red-500/10 border border-red-500/35 text-xs text-red-200 space-y-3 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
                <AlertTriangle className="w-16 h-16 text-red-500" />
              </div>
              
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 animate-bounce" />
                <span className="font-mono font-extrabold uppercase tracking-widest text-[9.5px]">
                  {speechError === 'not-allowed'
                    ? (lang === 'hi' ? 'माइक्रोफ़ोन अनुमति अवरुद्ध' : 'MICROPHONE ACCESS BLOCKED')
                    : (lang === 'hi' ? 'त्रुटि उत्पन्न हुई' : 'VOX DECODER ERROR')}
                </span>
              </div>

              <div className="space-y-1.5 leading-relaxed font-sans pr-4 relative z-10 text-white/90">
                {speechError === 'not-allowed' ? (
                  <>
                    <p className="font-bold text-white text-xs">
                      {lang === 'hi' 
                        ? 'आईफ़्रेम सुरक्षा प्रतिबंधों के कारण ब्राउज़र ने माइक्रोफ़ोन अनुमति को रोक दिया है।' 
                        : 'Web Sandbox Restrictions: Browser blocks microphone requests inside security iframes.'}
                    </p>
                    <ul className="list-decimal pl-4.5 space-y-1 text-[11px] text-white/60">
                      <li>
                        {lang === 'hi'
                          ? 'पूर्ण सिंक और वॉयस एजेंट सक्रिय करने के लिए पृष्ठ को नए स्वतंत्र टैब में खोलें।'
                          : 'Click the "Open in new tab" icon button in the top-right corner of Google AI Studio.'}
                      </li>
                      <li>
                        {lang === 'hi'
                          ? 'अपने ब्राउज़र की यूआरएल पट्टी (address bar) में माइक्रोफ़ोन अनुमति प्रदान करें।'
                          : 'Grant microphone access to this origin using the settings in your browser address bar.'}
                      </li>
                    </ul>
                  </>
                ) : (
                  <p className="text-white/80">
                    {lang === 'hi' 
                      ? `माइक्रोफ़ोन सिग्नल डिकोड करने में असमर्थ। त्रुटि कोड: ${speechError}` 
                      : `An error occurred during speech audio capture: ${speechError}`}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2.5 pt-1 border-t border-white/5 relative z-10 font-mono">
                <button
                  type="button"
                  onClick={() => {
                    setSpeechError(null);
                    startListening();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/35 text-white hover:bg-red-500/35 transition-all uppercase font-bold text-[9px] cursor-pointer"
                >
                  {lang === 'hi' ? 'पुनः प्रयास करें' : 'Retry Vox Link'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.open(window.location.href, '_blank');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all uppercase font-bold text-[9px] cursor-pointer"
                >
                  {lang === 'hi' ? 'नया टैब खोलें ↗' : 'Launch New Tab ↗'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Interactive Live User Transcribing HUD display */}
        <div className="w-full bg-black/45 border border-white/5 rounded-3xl p-5 space-y-3 font-mono">
          <div className="flex items-center justify-between text-[9px] text-white/30 tracking-widest uppercase font-black">
            <span>LIVE UPLINK TRANSCRIPT</span>
            <span className="text-neon-cyan flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-ping" />
              {voiceLanguage === 'hi' ? 'HINDI VOCAL DECRYPT' : voiceLanguage === 'hinglish' ? 'HINGLISH AUTO-SPEECH' : 'ENGLISH DECRYPT'}
            </span>
          </div>
          <p className={`text-sm ${transcript ? 'text-white font-bold' : 'text-white/25 italic'}`}>
            {transcript || (lang === 'hi' ? '"तापमान की जाँच करें"..."खतरनाक अलर्ट दिखाओ"' : '"Is the larvae healthy?"..."show settings screen"')}
          </p>
        </div>

        {/* Dynamic AI Response Card */}
        <AnimatePresence>
          {(latestResponse || displayMarkdown) && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full mt-5 p-5.5 rounded-3xl bg-white/[0.02] border border-neon-cyan/25 flex gap-4.5"
            >
              <div className="p-3.5 h-fit rounded-2.5xl bg-neon-cyan/10 border border-[#00E5FF]/20 text-neon-cyan shrink-0 font-bold">
                <Sparkles className="w-5.5 h-5.5 animate-pulse text-neon-green" />
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono font-black text-neon-cyan uppercase tracking-widest">
                    Jarvis Response System
                  </span>
                  <button 
                    onClick={() => speakVoice(latestResponse)}
                    className="p-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    title="Repeat speaking"
                    type="button"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-neon-green" />
                  </button>
                </div>
                
                {/* Spoken Text section */}
                <p className="text-sm text-white/90 leading-relaxed font-sans font-semibold">
                  {latestResponse}
                </p>

                {/* Additional detailed visual display if markdown exists */}
                {displayMarkdown && displayMarkdown !== latestResponse && (
                  <div className="p-3.5 rounded-2xl bg-black/35 border border-white/5 text-xs text-white/60 leading-relaxed space-y-1 font-sans">
                    {displayMarkdown}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Suggested Quick Vocal commands section */}
      <section className="space-y-3">
        <div className="flex items-center gap-1 text-[11px] font-mono text-white/50 tracking-widest uppercase">
          <Compass className="w-3.5 h-3.5 text-[#00E5FF]" />
          <span>Tap to Ask JARVIS / त्वरित ध्वनि प्रश्न</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => handleSuggestClick(suggestion)}
              type="button"
              className="px-4 py-3.5 rounded-2xl bg-white/[0.01] border border-white/5 hover:border-neon-cyan/25 hover:bg-white/[0.03] transition-all text-left text-xs font-semibold text-white/80 flex items-center justify-between group cursor-pointer"
            >
              <span className="line-clamp-1">{suggestion}</span>
              <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-[#00E5FF] group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
            </button>
          ))}
        </div>
      </section>

      {/* Audio agent controls & settings section */}
      <section className="p-6 rounded-[2rem] bg-white/[0.01] border border-white/5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3.5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Gauge className="w-4.5 h-4.5 text-neon-green" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/60 font-mono">
              AI Speech Synthesizer & Voice Settings
            </h3>
          </div>
          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-neon-green/10 text-neon-green border border-neon-green/30 uppercase">
            PRO MODULE
          </span>
        </div>

        {/* Master Voice Synthesizer Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-white block">
              Voice Engine Master On/Off
            </span>
            <p className="text-[10px] text-white/40 leading-relaxed max-w-sm">
              Shut down or enable all vocalized synthesis, spoken guides, and speech readouts globally.
            </p>
          </div>
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            type="button"
            className={`w-12 h-6.5 rounded-full p-0.5 transition-all duration-300 relative shrink-0 cursor-pointer ${
              voiceEnabled ? 'bg-neon-green' : 'bg-white/10'
            }`}
          >
            <motion.div
              layout
              className={`w-5.5 h-5.5 rounded-full bg-black shadow-md ${
                voiceEnabled ? 'ml-5.5' : 'ml-0'
              }`}
            />
          </button>
        </div>

        {/* Hinglish / Hindi / English Mode Selector */}
        <div className="flex items-center justify-between border-t border-white/5 pt-3.5">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-white block flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-neon-cyan" />
              Dialogue Speech Language
            </span>
            <p className="text-[10px] text-white/40 leading-relaxed max-w-sm">
              Toggle the voice speech synthesis dialect between standard English, Hindi, or natural conversational Hinglish.
            </p>
          </div>
          <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5 shrink-0">
            {['en', 'hi', 'hinglish'].map((l) => (
              <button
                key={l}
                onClick={() => setVoiceLanguage(l as any)}
                type="button"
                className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-md transition-all cursor-pointer ${
                  voiceLanguage === l ? 'bg-neon-green text-black font-extrabold' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Assistant Personality Selector */}
        <div className="flex items-center justify-between border-t border-white/5 pt-3.5">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-white block flex items-center gap-1.5 font-sans">
              <Sparkles className="w-3.5 h-3.5 text-neon-green animate-pulse" />
              Assistant AI Persona
            </span>
            <p className="text-[10px] text-white/40 leading-relaxed max-w-sm font-sans">
              Tailor speech personality tones, formatting style, and response characteristics.
            </p>
          </div>
          <select
            value={assistantPersonality}
            onChange={(e) => setAssistantPersonality(e.target.value as any)}
            className="bg-black/60 border border-white/10 hover:border-white/25 text-[10px] font-mono font-bold uppercase rounded-lg p-2 text-[#00E5FF] outline-none cursor-pointer"
          >
            <option value="jarvis" className="bg-neutral-900 text-white font-mono">🤖 JARVIS (Bilingual / Smart)</option>
            <option value="mentor" className="bg-neutral-900 text-white font-mono">👨‍🏫 MENTOR (Friendly Teacher)</option>
            <option value="energetic" className="bg-neutral-900 text-white font-mono">⚡ ENERGETIC (Motivated / Fast)</option>
            <option value="scientific" className="bg-neutral-900 text-white font-mono">🔬 SCIENTIFIC (Analytical / Data)</option>
          </select>
        </div>

        {/* Custom Wake Word Selection */}
        <div className="flex flex-col md:flex-row justify-between pt-3.5 border-t border-white/5 gap-3.5">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-white block">
              Custom Wake Word Hotword
            </span>
            <p className="text-[10px] text-white/40 leading-relaxed max-w-md">
              Choose the designated hotphrase that immediately registers to awaken local mic recording pipelines.
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            {/* Wake Word Enable Switch */}
            <div className="flex items-center justify-between gap-4 self-end">
              <span className="text-[10px] font-mono text-neon-cyan uppercase">Enable Hotword detection:</span>
              <button
                onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
                type="button"
                className={`w-10 h-5.5 rounded-full p-0.5 transition-all duration-300 relative shrink-0 cursor-pointer ${
                  wakeWordEnabled ? 'bg-neon-cyan' : 'bg-white/10'
                }`}
              >
                <div className={`w-4.5 h-4.5 rounded-full bg-black ${wakeWordEnabled ? 'ml-4.5' : 'ml-0'}`} />
              </button>
            </div>
            {/* Options list */}
            {wakeWordEnabled && (
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/40 rounded-xl border border-white/5">
                {['Hey FlyMind', 'FlyMind Scan', 'Hello Colony', 'BSF Assistant'].map((word) => (
                  <button
                    key={word}
                    onClick={() => setActiveWakeWord(word)}
                    type="button"
                    className={`px-2 py-1 text-[8px] font-mono font-bold uppercase rounded-md transition-all whitespace-nowrap ${
                      activeWakeWord === word ? 'bg-neon-cyan text-black font-extrabold' : 'text-white/30 hover:text-white/60'
                    }`}
                  >
                    {word}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ambient vocalizer alert toggle */}
        <div className="flex items-center justify-between border-t border-white/5 pt-3.5">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-white block">
              Vocal Alarm Announcements
            </span>
            <p className="text-[10px] text-white/40 leading-relaxed max-w-sm">
              Instruct Jarvis to alert you immediately with clear spoken warnings over any environmental thresholds breached.
            </p>
          </div>
          <button
            onClick={() => setVoiceAlertsEnabled(!voiceAlertsEnabled)}
            type="button"
            className={`w-12 h-6.5 rounded-full p-0.5 transition-all duration-300 relative shrink-0 cursor-pointer ${
              voiceAlertsEnabled ? 'bg-neon-green' : 'bg-white/10'
            }`}
          >
            <motion.div
              layout
              className={`w-5.5 h-5.5 rounded-full bg-black shadow-md ${
                voiceAlertsEnabled ? 'ml-5.5' : 'ml-0'
              }`}
            />
          </button>
        </div>

        {/* Auto-Speak Bio Scan Result Toggle */}
        <div className="flex items-center justify-between border-t border-white/5 pt-3.5">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-white block">
              Auto-vocalize Scan Outcomes
            </span>
            <p className="text-[10px] text-white/40 leading-relaxed max-w-sm">
              As soon as a biology photo scan generates successfully, Jarvis speaks findings and recommendations automatically.
            </p>
          </div>
          <button
            onClick={() => setAutoSpeakScan(!autoSpeakScan)}
            type="button"
            className={`w-12 h-6.5 rounded-full p-0.5 transition-all duration-300 relative shrink-0 cursor-pointer ${
              autoSpeakScan ? 'bg-neon-green' : 'bg-white/10'
            }`}
          >
            <motion.div
              layout
              className={`w-5.5 h-5.5 rounded-full bg-black shadow-md ${
                autoSpeakScan ? 'ml-5.5' : 'ml-0'
              }`}
            />
          </button>
        </div>

        {/* Voice Gender Selection  */}
        <div className="flex items-center justify-between border-t border-white/5 pt-3.5 text-xs">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-white block">
              AI Speech Gender Expression
            </span>
            <p className="text-[10px] text-white/40 leading-relaxed max-w-sm">
              Adjust speech synth profiles between standard Female or balanced Male voice timbres.
            </p>
          </div>
          <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5 shrink-0">
            {['female', 'male'].map((g) => (
              <button
                key={g}
                onClick={() => setVoiceGender(g as any)}
                type="button"
                className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-md transition-all cursor-pointer ${
                  voiceGender === g ? 'bg-neon-cyan text-black font-extrabold shadow-sm' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Speech Voice Speed Rate Slider */}
        <div className="border-t border-white/5 pt-3.5 text-xs space-y-2">
          <div className="flex justify-between items-center">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-white block">
                Dialogue Speech Speed Rate
              </span>
              <p className="text-[10px] text-white/40 leading-relaxed max-w-sm">
                Fine tune synthesis pace between slow cautious telemetry readings or lightning fast agronomic answers.
              </p>
            </div>
            <span className="p-1 px-2 rounded bg-white/5 font-mono text-[10px] text-neon-green border border-white/5">{voiceSpeed.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.8"
            step="0.1"
            value={voiceSpeed}
            onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-neon-green outline-none"
          />
        </div>

        {/* Speech Recognition Sensitivity Slider */}
        <div className="border-t border-white/5 pt-3.5 text-xs space-y-2">
          <div className="flex justify-between items-center">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-white block">
                Vocal Uplink Sensitivity threshold
              </span>
              <p className="text-[10px] text-white/40 leading-relaxed max-w-sm">
                Vary the software sound noise floor sensitivity level for environmental filter.
              </p>
            </div>
            <span className="p-1 px-2 rounded bg-white/5 font-mono text-[10px] text-neon-cyan border border-white/5">{voiceSensitivity}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            value={voiceSensitivity}
            onChange={(e) => setVoiceSensitivity(parseInt(e.target.value))}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-neon-cyan outline-none"
          />
        </div>

        {/* Dialogue Vocal Pitch Tone Slider */}
        <div className="border-t border-white/5 pt-3.5 text-xs space-y-2">
          <div className="flex justify-between items-center">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-white block">
                Dialogue Vocal Pitch Tone
              </span>
              <p className="text-[10px] text-white/40 leading-relaxed max-w-sm font-sans">
                Fine tune synthesis vocal pitch, establishing a deep commanding vocal presence or soft intelligent response tone.
              </p>
            </div>
            <span className="p-1 px-2 rounded bg-white/5 font-mono text-[10px] text-neon-green border border-white/5">{voicePitch.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.05"
            value={voicePitch}
            onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-neon-green outline-none"
          />
        </div>

        {/* Dialogue Smoothness Rate Slider */}
        <div className="border-t border-white/5 pt-3.5 text-xs space-y-2">
          <div className="flex justify-between items-center">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-white block">
                Vocal Cadence & Smoothness (Breath Gaps)
              </span>
              <p className="text-[10px] text-white/40 leading-relaxed max-w-sm">
                Set pause duration modifiers to inject natural micro-breaths, preventing robotic speech speeds.
              </p>
            </div>
            <span className="p-1 px-2 rounded bg-white/5 font-mono text-[10px] text-neon-cyan border border-white/5">{voiceSmoothness}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            value={voiceSmoothness}
            onChange={(e) => setVoiceSmoothness(parseInt(e.target.value))}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-neon-cyan outline-none"
          />
        </div>

        {/* Real-time Hardware Filters */}
        <div className="border-t border-white/5 pt-3.5 space-y-3">
          <span className="text-xs font-bold text-white block flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-neon-cyan animate-pulse animate-pulse" />
            Vocal Hardware Signal Micro-Filters
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setNoiseCancellation(!noiseCancellation)}
              className={`p-2.5 rounded-xl border flex items-center justify-between text-[11px] font-mono font-bold transition-all uppercase cursor-pointer ${
                noiseCancellation ? 'bg-neon-green/[0.04] border-neon-green/35 text-neon-green' : 'bg-transparent border-white/5 text-white/40 hover:border-white/10'
              }`}
            >
              <span>Noise Cancellation</span>
              <Check className={`w-3.5 h-3.5 shrink-0 ${noiseCancellation ? 'opacity-100' : 'opacity-0'}`} />
            </button>
            <button
              type="button"
              onClick={() => setMicEnhancement(!micEnhancement)}
              className={`p-2.5 rounded-xl border flex items-center justify-between text-[11px] font-mono font-bold transition-all uppercase cursor-pointer ${
                micEnhancement ? 'bg-neon-cyan/[0.04] border-neon-cyan/35 text-neon-cyan' : 'bg-transparent border-white/5 text-white/40 hover:border-white/10'
              }`}
            >
              <span>Mic AGC Boost</span>
              <Check className={`w-3.5 h-3.5 shrink-0 ${micEnhancement ? 'opacity-100' : 'opacity-0'}`} />
            </button>
            <button
              type="button"
              onClick={() => setEchoCancellation(!echoCancellation)}
              className={`p-2.5 rounded-xl border flex items-center justify-between text-[11px] font-mono font-bold transition-all uppercase cursor-pointer ${
                echoCancellation ? 'bg-neon-green/[0.04] border-neon-green/35 text-neon-green' : 'bg-transparent border-white/5 text-white/40 hover:border-white/10'
              }`}
            >
              <span>Echo Filtering</span>
              <Check className={`w-3.5 h-3.5 shrink-0 ${echoCancellation ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          </div>
        </div>

        {/* Dictionary Training Panel */}
        <div className="border-t border-white/5 pt-4">
          <button
            onClick={() => setTeachingOpen(!teachingOpen)}
            type="button"
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-black/35 border border-white/5 hover:border-white/10 transition-all text-left text-xs text-white/80 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-neon-green animate-pulse" />
              <span className="font-mono font-black uppercase text-[10.5px]">AI Custom Dictionary Learning ({Object.keys(customDictionary).length} Words)</span>
            </div>
            <span className="text-[10px] font-mono text-neon-cyan">{teachingOpen ? 'CLOSE ▲' : 'EXPAND ▼'}</span>
          </button>

          {teachingOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3.5 p-4.5 rounded-2xl bg-black/60 border border-white/5 space-y-4"
            >
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-bold text-neon-green font-mono uppercase">Train Custom Speech Recognition</h4>
                <p className="text-[10px] text-white/40 leading-relaxed">
                  Teach the voice assistant to map incorrectly heard phonetic spellings into exact farming terminology (e.g. "for mind" &rarr; "FlyMind AI").
                </p>
              </div>

              {/* Form to add training correction */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3 border-b border-white/5">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase text-white/55">When Heard (Phonetic spelling):</label>
                  <input
                    type="text"
                    placeholder="e.g. for mind"
                    value={newDictPhrase}
                    onChange={(e) => setNewDictPhrase(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 hover:border-white/20 p-2.5 rounded-xl text-xs text-white outline-none focus:border-neon-cyan transition-all font-mono"
                  />
                </div>
                <div className="space-y-1 relative">
                  <label className="text-[9px] font-mono uppercase text-white/55">Correct To (Term):</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. FlyMind AI"
                      value={newDictCorrection}
                      onChange={(e) => setNewDictCorrection(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 hover:border-white/20 p-2.5 rounded-xl text-xs text-white outline-none focus:border-neon-cyan transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newDictPhrase.trim() && newDictCorrection.trim()) {
                          const updated = {
                            ...customDictionary,
                            [newDictPhrase.trim().toLowerCase()]: newDictCorrection.trim()
                          };
                          setCustomDictionary(updated);
                          setNewDictPhrase('');
                          setNewDictCorrection('');
                          playBeep(1200, 0.1);
                        }
                      }}
                      className="px-4 rounded-xl bg-neon-green text-black font-extrabold text-[10px] font-mono uppercase cursor-pointer hover:scale-95 transition-all"
                    >
                      Learn
                    </button>
                  </div>
                </div>
              </div>

              {/* Search and list learned words */}
              <div className="space-y-2.5 font-sans">
                <div className="flex justify-between items-center">
                  <span className="text-[9.5px] font-mono uppercase text-white/35">Learned Vocabulary Definitions</span>
                  <input
                    type="text"
                    placeholder="Search terms..."
                    value={dictSearchText}
                    onChange={(e) => setDictSearchText(e.target.value)}
                    className="bg-white/5 border border-white/5 p-1 px-2.5 rounded-lg text-[9.5px] text-white outline-none w-36 font-mono focus:border-white/10 text-white/90"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1 select-none">
                  {Object.entries(customDictionary)
                    .filter(([phrase, correction]) => 
                      phrase.includes(dictSearchText.toLowerCase()) || 
                      String(correction).toLowerCase().includes(dictSearchText.toLowerCase())
                    )
                    .map(([phrase, correction]) => (
                      <div key={phrase} className="flex justify-between items-center p-2 rounded-xl bg-white/[0.02] border border-white/5 text-[10px] font-mono">
                        <span className="text-white/40 line-clamp-1 italic">"{phrase}"</span>
                        <div className="flex items-center gap-1.5">
                          <span className="bg-neon-cyan/15 text-neon-cyan px-1.5 py-0.5 rounded text-[9px] font-bold">&rarr; {correction}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...customDictionary };
                              delete updated[phrase];
                              setCustomDictionary(updated);
                              playBeep(450, 0.12);
                            }}
                            className="text-red-400 hover:text-red-300 px-1 hover:scale-105 transition-all text-sm outline-none"
                            title="Remove definition"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Commands history log section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white/60 uppercase font-mono">
            <History className="w-4 h-4 text-[#00E5FF]" />
            <span>Vox Command History Logs</span>
          </div>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              type="button"
              className="text-[9px] font-bold font-mono tracking-wider text-red-400 hover:text-red-300 uppercase cursor-pointer bg-transparent border-0"
            >
              Clear Logs
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="text-center py-6 text-xs text-white/30 italic">No recent conversational voice sessions.</p>
        ) : (
          <div className="space-y-3 max-h-44 overflow-y-auto pr-1">
            {history.map((log) => (
              <div 
                key={log.id} 
                className={`p-3.5 rounded-2xl bg-white/[0.01] border ${
                  log.success ? 'border-white/5' : 'border-red-500/15 bg-red-500/[0.01]'
                } space-y-1.5`}
              >
                <div className="flex justify-between items-center text-[9px] font-mono">
                  <span className="text-white/60 font-black flex items-center gap-1.5">
                    <span className={`w-1 h-1 rounded-full ${log.success ? 'bg-neon-green' : 'bg-red-500'}`} />
                    Q: {log.query}
                  </span>
                  <span className="text-white/20">{log.timestamp}</span>
                </div>
                <p className="text-xs text-[#00E5FF]/85 font-sans font-medium pl-2.5">
                  {log.reply}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
