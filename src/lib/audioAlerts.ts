/**
 * Web Audio API synthesizer for BSF Agronomic Alerts and Mobile Vibration patterns.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export type AlertSoundType = 
  | 'high_temp' 
  | 'low_temp' 
  | 'high_humidity' 
  | 'fungus_risk' 
  | 'critical_health';

export function playAlertSound(type: AlertSoundType) {
  const isMuted = localStorage.getItem('flymind_alert_muted') === 'true';
  if (isMuted) return;

  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Create master volume node with safe volume control
    const mainGain = ctx.createGain();
    mainGain.connect(ctx.destination);
    mainGain.gain.setValueAtTime(0.18, now); // Comfortable listening volume

    if (type === 'high_temp') {
      // 1. High Temperature: Rapid high-pitched warning beep beep beep pulsing quickly (sawtooth frequency chirp)
      playTone(ctx, 950, 'square', now, 0.12, mainGain);
      playTone(ctx, 950, 'square', now + 0.20, 0.12, mainGain);
      playTone(ctx, 950, 'square', now + 0.40, 0.12, mainGain);
    } 
    else if (type === 'low_temp') {
      // 2. Low Temperature: Slow low-pitched warning bongs (triangle wave pulsing slowly)
      playTone(ctx, 220, 'triangle', now, 0.40, mainGain);
      playTone(ctx, 225, 'triangle', now + 0.70, 0.40, mainGain);
    } 
    else if (type === 'high_humidity') {
      // 3. High Humidity: Dual frequency high-pitched water drop bubbles sweeps
      playToneWithSweep(ctx, 1100, 1600, 'sine', now, 0.22, mainGain);
      playToneWithSweep(ctx, 1100, 1600, 'sine', now + 0.32, 0.22, mainGain);
    } 
    else if (type === 'fungus_risk') {
      // 4. Fungus Risk: Low disharmonious buzzy warning (sawtooth waves slightly detuned)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(360, now);
      
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(364, now); // slightly detuned for beat frequency
      
      gainNode.gain.setValueAtTime(0.0, now);
      gainNode.gain.linearRampToValueAtTime(0.07, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(mainGain);
      
      osc1.start(now);
      osc2.start(now);
      
      osc1.stop(now + 0.77);
      osc2.stop(now + 0.77);
    } 
    else if (type === 'critical_health') {
      // 5. Critical BSF Health Warning: Alternating two-tone fast urgent siren
      playTone(ctx, 620, 'sine', now, 0.18, mainGain);
      playTone(ctx, 820, 'sine', now + 0.20, 0.18, mainGain);
      playTone(ctx, 620, 'sine', now + 0.40, 0.18, mainGain);
      playTone(ctx, 820, 'sine', now + 0.60, 0.18, mainGain);
    }

    // Trigger mobile vibration feedback
    triggerVibration(type);
  } catch (err) {
    console.error("Web Audio Alert failed to play:", err);
  }
}

function playTone(ctx: AudioContext, freq: number, type: OscillatorType, startTime: number, duration: number, dest: AudioNode) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  
  // smooth volume envelope to prevent sound "clicking"
  gainNode.gain.setValueAtTime(0.0, startTime);
  gainNode.gain.linearRampToValueAtTime(0.08, startTime + 0.02);
  gainNode.gain.setValueAtTime(0.08, startTime + duration - 0.02);
  gainNode.gain.linearRampToValueAtTime(0.001, startTime + duration);
  
  osc.connect(gainNode);
  gainNode.connect(dest);
  
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

function playToneWithSweep(ctx: AudioContext, startFreq: number, endFreq: number, type: OscillatorType, startTime: number, duration: number, dest: AudioNode) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, startTime);
  osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);
  
  gainNode.gain.setValueAtTime(0.0, startTime);
  gainNode.gain.linearRampToValueAtTime(0.07, startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  
  osc.connect(gainNode);
  gainNode.connect(dest);
  
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

function triggerVibration(type: AlertSoundType) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      if (type === 'critical_health') {
        // High urgency alternating pulse
        navigator.vibrate([250, 100, 250, 100, 400]);
      } else if (type === 'high_temp') {
        // Fast consecutive buzzes
        navigator.vibrate([120, 60, 120, 60, 120]);
      } else if (type === 'fungus_risk') {
        // Long single heavy rumble
        navigator.vibrate(500);
      } else {
        // Medium informative feedback pulses
        navigator.vibrate([180, 120, 180]);
      }
    } catch (e) {
      console.warn("Vibrate API not allowed or unsupported by frame sandbox constraints:", e);
    }
  }
}
