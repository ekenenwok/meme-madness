import React, { useState, useRef, useEffect, useCallback } from "react";
import { Rocket, Skull, Coins, TrendingDown, Heart, Play, RotateCcw, Copy, Zap, Ghost, Flame, Check, Volume2, VolumeX } from "lucide-react";
import * as Tone from "tone";

const INK = "#eef1ff";
const BG0 = "#05010b";
const BG1 = "#0b0620";
const CYAN = "#00f0ff";
const MAG = "#ff2e97";
const GOLD = "#ffcc33";
const VIOLET = "#8b5cf6";
const DANGER = "#ff3b57";

const CHARACTERS = [
  { id: "luna", name: "LUNA VOLT", tag: "SIGNAL WITCH", color: CYAN, icon: Zap, perk: "Wider catch radius", hitboxMul: 1.35, lives: 3, speedMul: 1 },
  { id: "rekt", name: "REKT ROLLINS", tag: "SERIAL DEGEN", color: "#ff7a1a", icon: Flame, perk: "Combo multiplier caps higher", hitboxMul: 1, lives: 3, speedMul: 1, comboCap: 8 },
  { id: "ghost", name: "GHOST_078", tag: "ANON NODE", color: VIOLET, icon: Ghost, perk: "+1 extra life", hitboxMul: 1, lives: 4, speedMul: 1 },
  { id: "baron", name: "BARON BAGHOLDER", tag: "DIAMOND HANDS", color: GOLD, icon: Coins, perk: "Market falls 12% slower", hitboxMul: 1, lives: 3, speedMul: 0.88 },
];

const ROUND_SECONDS = 45;
const WAGMI_THRESHOLD = 650;

let uid = 0;
const nextId = () => ++uid;

function spawnItem(width) {
  const roll = Math.random();
  let type;
  if (roll < 0.5) type = "pump";
  else if (roll < 0.72) type = "rug";
  else if (roll < 0.92) type = "fud";
  else type = "bonus";
  return { id: nextId(), type, x: 8 + Math.random() * (width - 16), y: -8, caught: false };
}

const ITEM_META = {
  pump: { icon: Rocket, color: CYAN, label: "PUMP" },
  rug: { icon: Skull, color: DANGER, label: "RUG PULL" },
  fud: { icon: TrendingDown, color: MAG, label: "FUD" },
  bonus: { icon: Coins, color: GOLD, label: "BONUS" },
};

// ---- Sound engine: fully generative synthwave score + FX, no audio files ----
function useSoundEngine() {
  const readyRef = useRef(false);
  const mutedRef = useRef(false);
  const bassSynthRef = useRef(null);
  const leadSynthRef = useRef(null);
  const fxSynthRef = useRef(null);
  const noiseSynthRef = useRef(null);
  const loopRef = useRef(null);
  const [muted, setMuted] = useState(false);

  const init = useCallback(async () => {
    if (readyRef.current) return;
    await Tone.start();
    Tone.Transport.bpm.value = 122;

    const master = new Tone.Volume(-6).toDestination();

    bassSynthRef.current = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.3 },
      filterEnvelope: { attack: 0.02, decay: 0.3, sustain: 0.2, baseFrequency: 200, octaves: 2 },
    }).connect(master);
    bassSynthRef.current.volume.value = -4;

    leadSynthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.2 },
    }).connect(master);
    leadSynthRef.current.volume.value = -14;

    fxSynthRef.current = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.08 },
    }).connect(master);
    fxSynthRef.current.volume.value = -8;

    noiseSynthRef.current = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.005, decay: 0.25, sustain: 0 },
    }).connect(master);
    noiseSynthRef.current.volume.value = -10;

    const bassPattern = ["A1", "A1", "F1", "G1"];
    const leadChords = [
      ["A3", "C4", "E4"],
      ["F3", "A3", "C4"],
      ["C3", "E3", "G3"],
      ["G3", "B3", "D4"],
    ];
    let step = 0;
    loopRef.current = new Tone.Loop((time) => {
      const bar = Math.floor(step / 4) % bassPattern.length;
      bassSynthRef.current.triggerAttackRelease(bassPattern[bar], "8n", time);
      if (step % 4 === 0) {
        leadSynthRef.current.triggerAttackRelease(leadChords[bar], "2n", time, 0.35);
      }
      step++;
    }, "8n");

    readyRef.current = true;
  }, []);

  const start = useCallback(async () => {
    await init();
    Tone.Transport.start();
    loopRef.current && loopRef.current.start(0);
  }, [init]);

  const stop = useCallback(() => {
    if (loopRef.current) loopRef.current.stop();
    Tone.Transport.stop();
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      Tone.Destination.mute = next;
      return next;
    });
  }, []);

  const sfx = {
    pump: () => !mutedRef.current && fxSynthRef.current && fxSynthRef.current.triggerAttackRelease("A5", "16n"),
    bonus: () => {
      if (mutedRef.current || !fxSynthRef.current) return;
      fxSynthRef.current.triggerAttackRelease("C6", "16n");
      setTimeout(() => fxSynthRef.current.triggerAttackRelease("E6", "16n"), 90);
    },
    rug: () => !mutedRef.current && noiseSynthRef.current && noiseSynthRef.current.triggerAttackRelease("4n"),
    fud: () => !mutedRef.current && fxSynthRef.current && fxSynthRef.current.triggerAttackRelease("D4", "16n"),
    go: () => !mutedRef.current && fxSynthRef.current && fxSynthRef.current.triggerAttackRelease("G5", "8n"),
    over: () => {
      if (mutedRef.current || !fxSynthRef.current) return;
      fxSynthRef.current.triggerAttackRelease("E4", "8n");
      setTimeout(() => fxSynthRef.current.triggerAttackRelease("C4", "4n"), 150);
    },
  };

  return { start, stop, toggleMute, muted, sfx };
}

export default function MemeMadness() {
  const [screen, setScreen] = useState("select");
  const [selected, setSelected] = useState(CHARACTERS[0]);
  const [count, setCount] = useState(3);
  const sound = useSoundEngine();

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [items, setItems] = useState([]);
  const [playerX, setPlayerX] = useState(50);
  const [flash, setFlash] = useState(null);
  const [copied, setCopied] = useState(false);

  const areaRef = useRef(null);
  const rafRef = useRef(null);
  const spawnTimerRef = useRef(null);
  const timeTimerRef = useRef(null);
  const boostTimerRef = useRef(null);
  const playerXRef = useRef(50);
  const stateRef = useRef({ score: 0, lives: 3, combo: 0, bestCombo: 0, multiplier: 1 });

  useEffect(() => { playerXRef.current = playerX; }, [playerX]);

  const resetGameState = useCallback((char) => {
    stateRef.current = { score: 0, lives: char.lives, combo: 0, bestCombo: 0, multiplier: 1 };
    setScore(0);
    setLives(char.lives);
    setCombo(0);
    setBestCombo(0);
    setMultiplier(1);
    setTimeLeft(ROUND_SECONDS);
    setItems([]);
    setPlayerX(50);
    playerXRef.current = 50;
  }, []);

  const startCountdown = async (char) => {
    setSelected(char);
    resetGameState(char);
    setScreen("countdown");
    setCount(3);
    await sound.start();
  };

  useEffect(() => {
    if (screen !== "countdown") return;
    if (count === 0) {
      sound.sfx.go();
      setScreen("play");
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [screen, count]);

  const endGame = useCallback(() => {
    sound.stop();
    sound.sfx.over();
    setScreen("result");
  }, [sound]);

  useEffect(() => {
    if (screen !== "play") return;
    const char = selected;

    spawnTimerRef.current = setInterval(() => {
      setItems((prev) => {
        if (prev.length > 9) return prev;
        return [...prev, spawnItem(100)];
      });
    }, 650);

    timeTimerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timeTimerRef.current);
          clearInterval(spawnTimerRef.current);
          endGame();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    const baseSpeed = 0.32 * char.speedMul;
    let last = performance.now();

    const loop = (now) => {
      const dt = Math.min(32, now - last);
      last = now;
      const speedScale = 1 + (ROUND_SECONDS - timeLeft) * 0.01;

      setItems((prev) => {
        const px = playerXRef.current;
        const hitboxHalf = 9 * char.hitboxMul;
        const next = [];
        for (const it of prev) {
          const ny = it.y + baseSpeed * speedScale * (dt / 16.6);
          if (ny >= 86 && ny <= 96 && !it.caught && Math.abs(it.x - px) <= hitboxHalf) {
            handleCatch(it.type, char);
            continue;
          }
          if (ny > 104) {
            if (it.type === "pump" || it.type === "bonus") {
              stateRef.current.combo = 0;
              setCombo(0);
            }
            continue;
          }
          next.push({ ...it, y: ny });
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(spawnTimerRef.current);
      clearInterval(timeTimerRef.current);
      clearTimeout(boostTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const doFlash = (color) => {
    const key = Math.random();
    setFlash({ color, key });
    setTimeout(() => setFlash((f) => (f && f.key === key ? null : f)), 220);
  };

  const handleCatch = (type, char) => {
    const s = stateRef.current;
    if (type === "pump") {
      s.combo = Math.min(s.combo + 1, char.comboCap || 6);
      s.multiplier = 1 + s.combo * 0.15;
      s.score += Math.round(12 * s.multiplier);
      s.bestCombo = Math.max(s.bestCombo, s.combo);
      doFlash(CYAN);
      sound.sfx.pump();
    } else if (type === "bonus") {
      s.score += Math.round(60 * s.multiplier);
      s.multiplier = Math.min(s.multiplier + 0.5, 4);
      doFlash(GOLD);
      sound.sfx.bonus();
      clearTimeout(boostTimerRef.current);
      boostTimerRef.current = setTimeout(() => {
        s.multiplier = 1 + s.combo * 0.15;
        setMultiplier(s.multiplier);
      }, 4000);
    } else if (type === "rug") {
      s.lives -= 1;
      s.combo = 0;
      s.multiplier = 1;
      doFlash(DANGER);
      sound.sfx.rug();
      setLives(s.lives);
      if (s.lives <= 0) {
        setScore(s.score);
        setTimeout(() => endGame(), 150);
      }
    } else if (type === "fud") {
      s.score = Math.max(0, s.score - 15);
      s.combo = 0;
      s.multiplier = 1;
      doFlash(MAG);
      sound.sfx.fud();
    }
    setScore(s.score);
    setCombo(s.combo);
    setBestCombo(s.bestCombo);
    setMultiplier(s.multiplier);
  };

  const handlePointerMove = (e) => {
    if (!areaRef.current) return;
    const rect = areaRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    const clamped = Math.max(4, Math.min(96, pct));
    setPlayerX(clamped);
  };

  const wagmi = score >= WAGMI_THRESHOLD;

  const copyResult = async () => {
    const text = `MEME MADNESS // ran it as ${selected.name}\nPortfolio: $${score}\nBest combo: x${bestCombo}\nResult: ${wagmi ? "WAGMI" : "NGMI"}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      setCopied(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(circle at 50% -10%, ${BG1} 0%, ${BG0} 60%)`,
        color: INK,
        fontFamily: "'JetBrains Mono','Space Mono',ui-monospace,monospace",
        display: "flex",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <CircuitBackground />
      <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 2 }}>
        {(screen === "select" || screen === "play") && (
          <MuteButton muted={sound.muted} onToggle={sound.toggleMute} />
        )}
        {screen === "select" && <SelectScreen onPick={startCountdown} />}
        {screen === "countdown" && <CountdownScreen count={count} char={selected} />}
        {screen === "play" && (
          <PlayScreen
            areaRef={areaRef}
            selected={selected}
            score={score}
            lives={lives}
            timeLeft={timeLeft}
            combo={combo}
            multiplier={multiplier}
            items={items}
            playerX={playerX}
            flash={flash}
            onMove={handlePointerMove}
          />
        )}
        {screen === "result" && (
          <ResultScreen
            score={score}
            bestCombo={bestCombo}
            wagmi={wagmi}
            selected={selected}
            onAgain={() => setScreen("select")}
            onCopy={copyResult}
            copied={copied}
          />
        )}
      </div>
    </div>
  );
}

function CircuitBackground() {
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.18, zIndex: 1 }} preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse">
          <path d="M 42 0 L 0 0 0 42" fill="none" stroke={CYAN} strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  );
}

function MuteButton({ muted, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        all: "unset", cursor: "pointer", position: "absolute", top: 14, right: 14, zIndex: 5,
        width: 34, height: 34, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(14,10,32,0.6)", border: `1px solid ${CYAN}55`,
      }}
      aria-label={muted ? "Unmute" : "Mute"}
    >
      {muted ? <VolumeX size={16} color="#9aa0c8" /> : <Volume2 size={16} color={CYAN} />}
    </button>
  );
}

function Panel({ children, style }) {
  return (
    <div style={{ background: "rgba(14,10,32,0.55)", border: `1px solid rgba(0,240,255,0.25)`, backdropFilter: "blur(10px)", borderRadius: 14, boxShadow: "0 0 30px rgba(0,240,255,0.06)", ...style }}>
      {children}
    </div>
  );
}

function SelectScreen({ onPick }) {
  return (
    <div style={{ padding: "28px 16px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: MAG, marginBottom: 6 }}>EKENENWOK PRESENTS</div>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 2, lineHeight: 1.1, textShadow: `0 0 18px ${CYAN}66` }}>
          MEME<span style={{ color: CYAN }}>MADNESS</span>
        </div>
        <div style={{ fontSize: 11, letterSpacing: 3, color: "#9aa0c8", marginTop: 6 }}>PICK YOUR TRADER · SURVIVE THE FEED</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {CHARACTERS.map((c) => {
          const Icon = c.icon;
          return (
            <button key={c.id} onClick={() => onPick(c)} style={{ all: "unset", cursor: "pointer" }}>
              <Panel style={{ padding: "16px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, transition: "transform 0.15s" }}>
                <div style={{ width: 56, height: 56, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(circle, ${c.color}33, transparent 70%)`, border: `1.5px solid ${c.color}`, boxShadow: `0 0 16px ${c.color}55` }}>
                  <Icon size={26} color={c.color} strokeWidth={2} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textAlign: "center" }}>{c.name}</div>
                <div style={{ fontSize: 9, letterSpacing: 2, color: c.color, textAlign: "center" }}>{c.tag}</div>
                <div style={{ fontSize: 9.5, color: "#9aa0c8", textAlign: "center", lineHeight: 1.3 }}>{c.perk}</div>
              </Panel>
            </button>
          );
        })}
      </div>

      <Panel style={{ padding: 14, fontSize: 11, color: "#9aa0c8", lineHeight: 1.6 }}>
        <span style={{ color: CYAN }}>■ PUMP</span> catches build your combo multiplier.{" "}
        <span style={{ color: GOLD }}>■ BONUS</span> coins spike your multiplier hard.{" "}
        <span style={{ color: DANGER }}>■ RUG PULLS</span> cost a life and reset your streak.{" "}
        <span style={{ color: MAG }}>■ FUD</span> drains your bag. Drag left / right to move.
      </Panel>
    </div>
  );
}

function CountdownScreen({ count, char }) {
  const Icon = char.icon;
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
      <Icon size={48} color={char.color} style={{ filter: `drop-shadow(0 0 14px ${char.color})` }} />
      <div style={{ fontSize: 13, letterSpacing: 3, color: "#9aa0c8" }}>LOADING {char.name}</div>
      <div key={count} style={{ fontSize: 64, fontWeight: 800, color: count === 0 ? CYAN : INK, textShadow: `0 0 24px ${char.color}88` }}>
        {count === 0 ? "GO" : count}
      </div>
    </div>
  );
}

function PlayScreen({ areaRef, selected, score, lives, timeLeft, combo, multiplier, items, playerX, flash, onMove }) {
  const Icon = selected.icon;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ padding: "12px 14px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#9aa0c8" }}>PORTFOLIO</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: CYAN, textShadow: `0 0 12px ${CYAN}66` }}>${score}</div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: lives }).map((_, i) => <Heart key={i} size={16} color={DANGER} fill={DANGER} />)}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#9aa0c8" }}>TIME</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{timeLeft}s</div>
        </div>
      </div>

      <div style={{ padding: "0 14px 8px", display: "flex", justifyContent: "center" }}>
        <div style={{ fontSize: 11, letterSpacing: 2, padding: "4px 12px", borderRadius: 999, border: `1px solid ${GOLD}66`, color: GOLD, background: "rgba(255,204,51,0.08)" }}>
          COMBO x{combo} · MULT {multiplier.toFixed(2)}
        </div>
      </div>

      <div
        ref={areaRef}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onTouchMove={onMove}
        style={{ position: "relative", flex: 1, margin: "0 10px 10px", borderRadius: 16, border: "1px solid rgba(0,240,255,0.2)", overflow: "hidden", background: "linear-gradient(180deg, rgba(0,240,255,0.04), rgba(255,46,151,0.05))", touchAction: "none" }}
      >
        {flash && <div style={{ position: "absolute", inset: 0, background: flash.color, opacity: 0.14, pointerEvents: "none" }} />}

        {items.map((it) => {
          const meta = ITEM_META[it.type];
          const ItemIcon = meta.icon;
          return (
            <div key={it.id} style={{ position: "absolute", left: `${it.x}%`, top: `${it.y}%`, transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <ItemIcon size={22} color={meta.color} style={{ filter: `drop-shadow(0 0 8px ${meta.color})` }} />
            </div>
          );
        })}

        <div style={{ position: "absolute", left: `${playerX}%`, top: "90%", transform: "translate(-50%, -50%)" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(circle, ${selected.color}44, transparent 70%)`, border: `1.5px solid ${selected.color}`, boxShadow: `0 0 18px ${selected.color}88` }}>
            <Icon size={22} color={selected.color} />
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 9.5, color: "#6b7099", paddingBottom: 10, letterSpacing: 1 }}>
        drag anywhere in the feed to move {selected.name.split(" ")[0]}
      </div>
    </div>
  );
}

function ResultScreen({ score, bestCombo, wagmi, selected, onAgain, onCopy, copied }) {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "0 20px", textAlign: "center" }}>
      <div style={{ fontSize: 12, letterSpacing: 4, color: "#9aa0c8" }}>SESSION CLOSED</div>
      <div style={{ fontSize: 46, fontWeight: 900, color: wagmi ? CYAN : DANGER, textShadow: `0 0 26px ${wagmi ? CYAN : DANGER}88` }}>
        {wagmi ? "WAGMI" : "NGMI"}
      </div>

      <Panel style={{ padding: "18px 24px", width: "100%", maxWidth: 300 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: "#9aa0c8" }}>FINAL PORTFOLIO</div>
        <div style={{ fontSize: 34, fontWeight: 800, color: GOLD, margin: "4px 0 10px" }}>${score}</div>
        <div style={{ fontSize: 11, color: "#9aa0c8" }}>
          Best combo <span style={{ color: INK }}>x{bestCombo}</span> · Ran it as <span style={{ color: selected.color }}>{selected.name}</span>
        </div>
      </Panel>

      <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 300 }}>
        <button onClick={onAgain} style={{ all: "unset", flex: 1, cursor: "pointer", textAlign: "center", padding: "12px 0", borderRadius: 10, border: `1px solid ${CYAN}`, color: CYAN, fontSize: 12, letterSpacing: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <RotateCcw size={14} /> RUN IT BACK
        </button>
        <button onClick={onCopy} style={{ all: "unset", flex: 1, cursor: "pointer", textAlign: "center", padding: "12px 0", borderRadius: 10, border: `1px solid ${GOLD}`, color: GOLD, fontSize: 12, letterSpacing: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "COPIED" : "COPY RESULT"}
        </button>
      </div>
    </div>
  );
}
