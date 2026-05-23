import React, { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Lock, 
  LogIn, 
  UserPlus, 
  Fingerprint, 
  Sparkles, 
  AlertCircle, 
  Chrome, 
  Eye, 
  EyeOff, 
  Home, 
  MapPin, 
  Check, 
  User, 
  CheckCircle2, 
  Globe
} from 'lucide-react';
import { cn } from '../lib/utils';

interface AuthProps {
  onSuccess: () => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  
  // Login Form fields
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem('flymind_remembered_email') || '';
    } catch { return ''; }
  });
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return localStorage.getItem('flymind_remember_me') === 'true';
    } catch { return true; }
  });

  // Signup fields
  const [fullName, setFullName] = useState('');
  const [farmName, setFarmName] = useState('');
  const [farmLocation, setFarmLocation] = useState('');
  
  // Utilities
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);

  // Password strength checker helper
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: 'Unentered', color: 'bg-white/10' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1;
    if (/\d/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) return { score, label: 'Weak Substrate', color: 'bg-red-500' };
    if (score <= 4) return { score, label: 'Stable Strain', color: 'bg-orange-500' };
    return { score, label: 'Cyber-Secure Bio-Node', color: 'bg-neon-green' };
  };

  const strength = getPasswordStrength(password);

  const createProfileInDB = async (user: any, additionalData?: { fullName?: string, farmName?: string, farmLocation?: string }) => {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    const fName = additionalData?.fullName || user.displayName || 'Sahil Makandar';
    const fCluster = additionalData?.farmName || 'FlyMind Alpha Cluster';
    const fLoc = additionalData?.farmLocation || 'Maharashtra, India (Grid 14B)';

    // Update Firestore user document
    const profilePayload = {
      email: user.email,
      fullName: fName,
      farmName: fCluster,
      farmLocation: fLoc,
      experienceLevel: 'Professional BSF Farmer',
      contactEmail: user.email,
      phone: '+91 98765 43210',
      selectedAvatarId: 'larva-master',
      createdAt: serverTimestamp(),
      setupDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    };

    await setDoc(userRef, profilePayload, { merge: true });

    // Sync client-side Profile state representation immediately to prevent lag delay
    localStorage.setItem('flymind_farmer_profile', JSON.stringify({
      fullName: fName,
      farmName: fCluster,
      farmLocation: fLoc,
      experienceLevel: 'Professional BSF Farmer',
      contactEmail: user.email,
      phone: '+91 98765 43210',
      selectedAvatarId: 'larva-master',
      setupDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    }));
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Auto supply Google details with stable default farm details
      await createProfileInDB(result.user, {
        fullName: result.user.displayName || 'Google Agri Operator',
        farmName: 'FlyMind Shared Cluster',
        farmLocation: 'Global Grid IP-B'
      });

      setShowSuccessScreen(true);
      setTimeout(() => {
        onSuccess();
      }, 1800);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Form inputs validation checks
    if (mode === 'signup') {
      if (!fullName.trim() || !farmName.trim() || !farmLocation.trim()) {
        setError('Please enter all biometric fields (Name, Farm Name, Coordinates).');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('Microclimate password must contain at least 6 characters.');
        setLoading(false);
        return;
      }
    }

    try {
      if (mode === 'login') {
        const result = await signInWithEmailAndPassword(auth, email, password);
        
        // Setup initial Profile cache if missing
        const userRef = doc(db, 'users', result.user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const dat = userSnap.data();
          localStorage.setItem('flymind_farmer_profile', JSON.stringify({
            fullName: dat.fullName || dat.displayName || 'Sahil Makandar',
            farmName: dat.farmName || 'FlyMind Alpha Cluster',
            farmLocation: dat.farmLocation || 'Maharashtra, India (Grid 14B)',
            experienceLevel: dat.experienceLevel || 'Professional BSF Farmer',
            contactEmail: dat.contactEmail || result.user.email,
            phone: dat.phone || '+91 98765 43210',
            selectedAvatarId: dat.selectedAvatarId || 'larva-master',
            customAvatarBase64: dat.customAvatarBase64 || undefined,
            setupDate: dat.setupDate || 'May 12, 2026'
          }));
        }

        if (rememberMe) {
          localStorage.setItem('flymind_remembered_email', email);
          localStorage.setItem('flymind_remember_me', 'true');
        } else {
          localStorage.removeItem('flymind_remembered_email');
          localStorage.setItem('flymind_remember_me', 'false');
        }

        setShowSuccessScreen(true);
        setTimeout(() => {
          onSuccess();
        }, 1800);

      } else if (mode === 'signup') {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await createProfileInDB(result.user, {
          fullName,
          farmName,
          farmLocation
        });

        setShowSuccessScreen(true);
        setTimeout(() => {
          onSuccess();
        }, 1800);

      } else {
        // Send reset code
        await sendPasswordResetEmail(auth, email);
        setError("Decrypt instructions dispatched! Please check your email.");
        setMode('login');
      }
    } catch (err: any) {
      let friendlyMsg = err.message;
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        friendlyMsg = "Access Denied. Node coordinates or terminal passkey mismatch.";
      } else if (err.code === 'auth/email-already-in-use') {
        friendlyMsg = "Operator already initialized under this email stream.";
      }
      setError(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[95vh] p-4 space-y-6">
      
      {/* SUCCESS TRANSITIONAL SCREEN COMPONENT */}
      <AnimatePresence>
        {showSuccessScreen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#030303] flex flex-col items-center justify-center space-y-5 px-6 py-10"
          >
            <div className="w-24 h-24 relative">
              <div className="absolute inset-0 bg-neon-green/10 rounded-full blur-xl scale-125 animate-pulse" />
              <div className="w-full h-full rounded-full border-2 border-neon-green flex items-center justify-center bg-black/60 shadow-[0_0_25px_rgba(57,255,20,0.3)]">
                <CheckCircle2 className="w-12 h-12 text-neon-green" />
              </div>
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black font-display tracking-tight text-white uppercase">Decryption Success</h2>
              <div className="flex justify-center items-center gap-2 text-[10px] font-mono text-neon-cyan leading-none uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-neon-green animate-ping" />
                <span>Synchronizing Bio-Link Arrays...</span>
              </div>
            </div>

            {/* Simulated telemetry logs scrolling */}
            <div className="w-full max-w-xs p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-[9px] font-mono text-white/40 space-y-1 mt-6 text-left">
              <p className="text-neon-green font-bold">[INIT] Loading Sensory Farm Channels...</p>
              <p>[BOOT] Initializing Gemini 3.5 Agronomic Engine...</p>
              <p>[SYNC] Connected. Establishing encrypted database...</p>
              <p className="text-neon-cyan font-bold">[SUCCESS] Operator Session Validated.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Brand Logo and Title Header */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4 text-center"
      >
        <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-tr from-[#050505] to-[#121820] border border-white/10 flex items-center justify-center shadow-[0_0_50px_rgba(57,255,20,0.18)] [clip-path:polygon(50%_0%,_100%_25%,_100%_75%,_50%_100%,_0%_75%,_0%_25%)] relative group overflow-hidden">
          <div className="absolute inset-[1px] border border-neon-cyan/20 rounded-[1.8rem] [clip-path:polygon(50%_0%,_100%_25%,_100%_75%,_50%_100%,_0%_75%,_0%_25%)]" />
          
          <svg className="w-10 h-10 text-neon-green filter drop-shadow-[0_0_6px_#39FF14] relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 4v16" strokeLinecap="round" />
            <rect x="10.5" y="7" width="3" height="10" rx="1.5" fill="currentColor" opacity="0.3" />
            <circle cx="12" cy="5" r="2" fill="currentColor" />
            <path d="M10 2.5a2 2 0 0 0 2 1.5M14 2.5a2 2 0 0 1-2 1.5" strokeLinecap="round" />
            <path d="M11 9 C 7 8, 4 9, 3 11 C 2 13, 5 15, 11 11" fill="currentColor" fillOpacity="0.1" strokeLinecap="round" className="animate-pulse" />
            <path d="M11 11 C 6 11, 4 13, 4 15 C 4 17, 7 17, 11 13" fill="currentColor" fillOpacity="0.05" strokeLinecap="round" />
            <path d="M13 9 C 17 8, 20 9, 21 11 C 22 13, 19 15, 13 11" fill="currentColor" fillOpacity="0.1" strokeLinecap="round" className="animate-pulse" />
            <path d="M13 11 C 18 11, 20 13, 20 15 C 20 17, 17 17, 13 13" fill="currentColor" fillOpacity="0.05" strokeLinecap="round" />
            <circle cx="12" cy="12" r="1.1" fill="#00E5FF" />
            <circle cx="7" cy="11" r="0.7" fill="#39FF14" />
            <circle cx="17" cy="11" r="0.7" fill="#39FF14" />
          </svg>
          <div className="absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        </div>
        
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight font-display text-white">FlyMind <span className="text-neon-green">AI</span></h1>
          <p className="text-neon-cyan/65 text-[10px] font-mono uppercase tracking-[0.22em] font-black">BSF Security Decrypt-Node</p>
        </div>
      </motion.div>

      {/* Main Glassmorphism Form Container */}
      <motion.div 
        layout
        className="w-full max-w-sm bg-[#090b0f]/85 border border-white/10 p-6.5 rounded-[2.5rem] shadow-[0_30px_70px_rgba(0,0,0,0.95)] backdrop-blur-xl relative overflow-hidden"
      >
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-neon-green/5 blur-2xl rounded-full" />
        <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-neon-cyan/5 blur-2xl rounded-full" />

        {/* Tab Toggle between login and signup */}
        <div className="flex bg-white/5 p-1 rounded-2xl mb-5">
          <button 
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className={cn(
              "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer",
              mode === 'login' ? "bg-neon-green text-black font-extrabold shadow-[0_0_15px_rgba(57,255,20,0.25)]" : "text-white/40"
            )}
          >
            Access Terminal
          </button>
          <button 
            type="button"
            onClick={() => { setMode('signup'); setError(null); }}
            className={cn(
              "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer",
              mode === 'signup' ? "bg-neon-green text-black font-extrabold shadow-[0_0_15px_rgba(57,255,20,0.25)]" : "text-white/40"
            )}
          >
            Initialize Operator
          </button>
        </div>

        {/* Animated dynamic error display */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 p-3 rounded-2xl text-red-400 text-xs font-semibold leading-relaxed mb-4"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary Auth Form fields */}
        <form onSubmit={handleAuth} className="space-y-3.5">
          {mode === 'signup' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-3"
            >
              {/* Full Name input */}
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input 
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Farmer Name (जैसे साहिल मकनदार)"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-semibold text-white placeholder-white/30 focus:outline-none focus:border-neon-green/50 transition-all"
                />
              </div>

              {/* Farm Name input */}
              <div className="relative">
                <Home className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input 
                  type="text"
                  required
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  placeholder="Farm Identity (जैसे FlyMind Unit 1)"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-semibold text-white placeholder-white/30 focus:outline-none focus:border-neon-green/50 transition-all"
                />
              </div>

              {/* Farm Location coordinates */}
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input 
                  type="text"
                  required
                  value={farmLocation}
                  onChange={(e) => setFarmLocation(e.target.value)}
                  placeholder="Grid Coordinates / State Location"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-semibold text-white placeholder-white/30 focus:outline-none focus:border-neon-green/50 transition-all"
                />
              </div>
            </motion.div>
          )}

          {/* Email input field */}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input 
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (e.g. sahil@example.com)"
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-semibold text-white placeholder-white/30 focus:outline-none focus:border-neon-green/50 transition-all"
            />
          </div>

          {mode !== 'forgot' && (
            <div className="space-y-2 relative">
              {/* Password field */}
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Access Code / password"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-11 text-xs font-semibold text-white placeholder-white/30 focus:outline-none focus:border-neon-green/50 transition-all"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/40 hover:text-white transition-all cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Real-time interactive password strength check */}
              {mode === 'signup' && password.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="px-1 space-y-1.5"
                >
                  <div className="flex justify-between text-[8px] font-mono text-white/40 uppercase tracking-widest font-black">
                    <span>Core Strength:</span>
                    <span className={cn(
                      strength.score > 4 ? "text-neon-green" : strength.score > 2 ? "text-orange-400" : "text-red-400"
                    )}>{strength.label}</span>
                  </div>
                  
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden flex gap-0.5">
                    <div className={cn("h-full flex-1 transition-all", strength.score >= 1 ? strength.color : "bg-white/5")} />
                    <div className={cn("h-full flex-1 transition-all", strength.score >= 3 ? strength.color : "bg-white/5")} />
                    <div className={cn("h-full flex-1 transition-all", strength.score >= 5 ? strength.color : "bg-white/5")} />
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Remember code & forgot pass row */}
          {mode === 'login' && (
            <div className="flex items-center justify-between px-1 py-1">
              <label className="flex items-center gap-2 cursor-pointer text-[10px] font-bold text-white/45">
                <input 
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded bg-white/5 border-white/10 text-neon-green focus:ring-0 w-3.5 h-3.5"
                />
                <span>Remember Connection</span>
              </label>

              <button 
                type="button"
                onClick={() => setMode('forgot')}
                className="text-[10px] font-black uppercase text-neon-cyan/70 hover:text-white transition-all cursor-pointer"
              >
                Access Offline?
              </button>
            </div>
          )}

          {/* Submit Action Button */}
          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-neon-green text-black font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2.5 shadow-[0_0_20px_rgba(57,255,20,0.25)] hover:shadow-[0_0_35px_rgba(57,255,20,0.4)] disabled:opacity-50 transition-all mt-3 cursor-pointer"
          >
            {loading ? (
              <Sparkles className="w-4 h-4 animate-spin text-black" />
            ) : (
              <>
                {mode === 'login' && <LogIn className="w-4 h-4" />}
                {mode === 'signup' && <UserPlus className="w-4 h-4" />}
                {mode === 'forgot' && <Globe className="w-4 h-4" />}
                <span>
                  {mode === 'login' ? 'Decrypt System' : mode === 'signup' ? 'Deploy Operator' : 'Dispatch Recovery'}
                </span>
              </>
            )}
          </button>
        </form>

        {/* OAuth Google trigger */}
        <div className="flex items-center gap-4 py-4">
          <div className="h-px bg-white/10 flex-1" />
          <span className="text-[8px] font-mono text-white/20 uppercase tracking-[0.25em] font-black">Secure Override</span>
          <div className="h-px bg-white/10 flex-1" />
        </div>

        <button 
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 font-bold rounded-2xl flex items-center justify-center gap-2.5 transition-all text-xs cursor-pointer active:scale-98"
        >
          <Chrome className="w-4 h-4 text-white" />
          <span className="uppercase tracking-widest font-extrabold text-[10px]">Verify identity with Google</span>
        </button>

        {/* Forgot return trigger */}
        {mode === 'forgot' && (
          <button 
            onClick={() => setMode('login')}
            className="w-full text-center text-[9px] uppercase tracking-widest text-[#a1a1aa] hover:text-white transition-all pt-4 cursor-pointer"
          >
            &larr; Return to main Security port
          </button>
        )}
      </motion.div>
    </div>
  );
}
