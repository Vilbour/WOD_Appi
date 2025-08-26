import React, { useEffect, useMemo, useState } from "react";

/* ========== UTIL ========== */
const roundTo = (x: number, step = 2.5) => Math.round(x / step) * step;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const fmt = (n: number) => n.toString().padStart(2, "0");

function useLocalStore<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : initial; }
    catch { return initial; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue];
}

/* ========== TYPES ========== */
type Scheme = { percent?: number; sets: number; reps: number | string; note?: string };
type MainBlock = { lift: string; scheme: Scheme[] };
type Accessory = { name: string; sets: number; reps: number | string };
type Session = { day: number; title: string; warmup: string[]; main: MainBlock; accessories: Accessory[] };
type WeekData = { week: number; squatType: "Back Squat" | "Front Squat"; days: Session[] };
type OneRM = { ["Snatch"]: number; ["Clean & Jerk"]: number; ["Deadlift"]: number; ["Bench Press"]: number; ["Back Squat"]: number; ["Front Squat"]: number };
type RowLog = { setWeights: number[]; notes?: string };
type AccessoryLog = { weight?: number; reps?: number|string; setsCompleted?: number };
type DayLog = { main: { [rowIdx: number]: RowLog }; accessories: { [accIdx: number]: AccessoryLog } };
type LogStore = { [key: string]: DayLog };

/* ========== PROGRAM (sama logiikka, vain UI muuttuu) ========== */
const pct = (p: number, sets: number, reps: number | string, note = ""): Scheme => ({ percent: p, sets, reps, note });

const MAIN = {
  snatch: {
    1: [pct(55,2,3), pct(60,2,3), pct(65,2,3)],
    2: [pct(60,2,3), pct(65,2,3), pct(70,2,3)],
    3: [pct(70,3,2), pct(72,3,2)],
    4: [pct(72,2,2), pct(75,2,2), pct(78,2,2)],
    5: [pct(75,3,2), pct(80,3,2)],
    6: [pct(78,2,2), pct(82,2,2)],
    7: [pct(80,2,2), pct(85,2,1)],
    8: [pct(82,3,1), pct(85,2,1)],
    9: [pct(85,3,1,"build heavy singles"), pct(88,1,1), pct(90,1,1)],
    10:[pct(60,2,2), pct(65,1,2), pct(70,1,2)],
  },
  cj: {
    1: [pct(55,4,"1+1"), pct(60,2,"1+1"), pct(65,2,"1+1")],
    2: [pct(60,4,"1+1"), pct(65,2,"1+1"), pct(70,2,"1+1")],
    3: [pct(70,3,"1+1"), pct(75,3,"1+1")],
    4: [pct(72,2,"1+1"), pct(78,2,"1+1")],
    5: [pct(75,3,"1+1"), pct(80,3,"1+1")],
    6: [pct(78,2,"1+1"), pct(82,2,"1+1")],
    7: [pct(80,3,"1+1"), pct(85,2,"1+1")],
    8: [pct(82,3,"1+1"), pct(85,2,"1+1")],
    9: [pct(85,2,"1+1"), pct(88,1,"1+1"), pct(90,1,"1+1")],
    10:[pct(60,2,"1+1"), pct(65,1,"1+1"), pct(70,1,"1+1")],
  },
  deadlift: {
    1: [pct(60,1,5), pct(65,1,5), pct(70,3,5)],
    3: [pct(70,1,4), pct(75,3,4)],
    5: [pct(75,1,4), pct(80,3,4)],
    7: [pct(80,4,3)],
    9: [pct(85,3,3)],
  },
  bench: {
    2: [pct(60,1,6), pct(65,1,6), pct(70,3,5)],
    4: [pct(72,4,4)],
    6: [pct(75,4,4)],
    8: [pct(80,4,3)],
    10:[pct(60,3,5)],
  },
  backSquat: {
    base:[pct(60,2,5), pct(70,2,4), pct(75,2,4)],
    3:[pct(70,2,4), pct(75,2,4), pct(80,1,3)],
    5:[pct(75,2,4), pct(80,2,3)],
    7:[pct(80,3,3)],
    9:[pct(85,3,2)],
  },
  frontSquat: {
    base:[pct(60,2,5), pct(65,2,4), pct(70,2,4)],
    4:[pct(70,2,4), pct(75,2,3)],
    6:[pct(75,3,3)],
    8:[pct(80,3,2)],
    10:[pct(60,3,3)],
  }
};

/* Apuliike-poolit (sama logiikka kuin aiemmin) */
const POOL = {
  warm: ["SAS / band warm-up","Bird Dog","Glute Bridge","Superman / Hyper","Overhead Duck Walk","T-plank","90/90 Hip Flow","Rack Lats Stretch","Shoulder Spins","Hip Mobilization"],

  snatchBarbellOnly: ["Snatch Pull (to knee)"],
  cjBarbellLight: ["Push Press","Jerk Behind Neck (tech)","Clean Pull (to knee)"],
  squatAssistBar: ["Paused Squat (3s)","Tempo Squat (3-0-3)"],
  deadliftAssistBar: ["Romanian Deadlift","Good Morning","Snatch Grip RDL"],

  upperHyper: ["DB Lateral Raise","Rear Delt Fly (DB/Cable)","Incline DB Press","Lat Pulldown / Pull-up","Seated Cable Row","Face Pull","Single-arm DB Row","Cable Fly","Triceps Pressdown","Biceps Curl (DB)"],
  lowerHyper: ["Walking Lunges","Leg Press","Hack/Goblet Squat","Hamstring Curl (machine)","Reverse Hyper","Seated Calf Raise","Standing Calf Raise","Spanish Squat"],

  core: ["Hanging Leg Raise","Cable Crunch","Pallof Press","Back Extension","Weighted Plank 30–45s","Dead Bug","Side Plank 30–45s"]
};

const pickVaried = (list: string[], amount: number, seed: number) => {
  const rot = seed % list.length;
  const rotated = list.slice(rot).concat(list.slice(0, rot));
  return rotated.slice(0, amount);
};

/* Viikot (4 treeniä/vko, kyykky vuoroviikoin; Päivä4: mave pariton / penkki parillinen) */
const weeks: WeekData[] = Array.from({ length: 10 }, (_, i) => {
  const week = i + 1;
  const squatType = (week % 2 === 1) ? "Back Squat" : "Front Squat";
  const odd = week % 2 === 1;

  // Snatch (yläkroppa): 1 barbell + 3 hyper upper + 1 core => 5 apuliikettä
  const snatchAccessories: Accessory[] = [
    { name: POOL.snatchBarbellOnly[0], sets: 3, reps: 3 },
    ...pickVaried(POOL.upperHyper, 3, week*13+1).map(n => ({ name: n, sets: 3, reps: 10 })),
    { name: pickVaried(POOL.core, 1, week*17+1)[0], sets: 3, reps: 12 },
  ];

  // Squat (alakroppa): 1 bar + 2 hyper lower + 1 core => 4
  const squatAccessories: Accessory[] = [
    { name: pickVaried(POOL.squatAssistBar, 1, week*5+2)[0], sets: 3, reps: 3 },
    ...pickVaried(POOL.lowerHyper, 2, week*7+2).map(n => ({ name: n, sets: 3, reps: 12 })),
    { name: pickVaried(POOL.core, 1, week*9+2)[0], sets: 3, reps: 12 }
  ];

  // C&J (yläkroppa): viikko3 barbell=Push Press; muuten 1 light bar + 3 hyper + 1 core => 5
  const cjBarbell = (week === 3) ? "Push Press" : pickVaried(POOL.cjBarbellLight, 1, week*19+3)[0];
  const cjAccessories: Accessory[] = [
    { name: cjBarbell, sets: 3, reps: 3 },
    ...pickVaried(POOL.upperHyper, 3, week*23+3).map(n => ({ name: n, sets: 3, reps: 10 })),
    { name: pickVaried(POOL.core, 1, week*29+3)[0], sets: 3, reps: 12 },
  ];

  // Deadlift (alakroppa): 1 bar + 2 hyper lower + 1 core => 4
  const dlAccessories: Accessory[] = [
    { name: pickVaried(POOL.deadliftAssistBar, 1, week*31+4)[0], sets: 3, reps: 6 },
    ...pickVaried(POOL.lowerHyper, 2, week*37+4).map(n => ({ name: n, sets: 3, reps: 10 })),
    { name: pickVaried(POOL.core, 1, week*41+4)[0], sets: 3, reps: 12 },
  ];

  // Bench (yläkroppa): 4 hyper + 1 core => 5
  const benchAccessories: Accessory[] = [
    ...pickVaried(POOL.upperHyper, 4, week*43+4).map(n => ({ name: n, sets: 3, reps: 10 })),
    { name: pickVaried(POOL.core, 1, week*47+4)[0], sets: 3, reps: 12 },
  ];

  const days: Session[] = [
    { day: 1, title: "Snatch Day", warmup: pickVaried(POOL.warm, 3, week*11+1), main: { lift: "Snatch", scheme: (MAIN.snatch as any)[week] }, accessories: snatchAccessories },
    { day: 2, title: `${squatType} Day`, warmup: pickVaried(POOL.warm, 3, week*11+2), main: { lift: squatType, scheme: squatType==="Back Squat" ? ((MAIN.backSquat as any)[week] || (MAIN.backSquat as any).base) : ((MAIN.frontSquat as any)[week] || (MAIN.frontSquat as any).base) }, accessories: squatAccessories },
    { day: 3, title: "Clean & Jerk Day", warmup: pickVaried(POOL.warm, 3, week*11+3), main: { lift: "Clean & Jerk", scheme: (MAIN.cj as any)[week] }, accessories: cjAccessories },
    odd
      ? { day: 4, title: "Deadlift Day", warmup: pickVaried(POOL.warm, 3, week*11+4), main: { lift: "Deadlift", scheme: (MAIN.deadlift as any)[week] }, accessories: dlAccessories }
      : { day: 4, title: "Bench Press Day", warmup: pickVaried(POOL.warm, 3, week*11+4), main: { lift: "Bench Press", scheme: (MAIN.bench as any)[week] }, accessories: benchAccessories },
  ];

  return { week, squatType, days };
});

/* ========== PROGRESS (bar only, no %) ========== */
function computeSessionProgress(session: Session, log: DayLog) {
  const totalMainSets = session.main.scheme.reduce((s, r) => s + r.sets, 0);
  let doneMain = 0;
  session.main.scheme.forEach((r, idx) => {
    const row = log.main[idx];
    if (!row) return;
    const setOk = row.setWeights?.filter(w => (w ?? 0) > 0).length || 0;
    doneMain += Math.min(setOk, r.sets);
  });
  const totalAccSets = session.accessories.reduce((s, a) => s + a.sets, 0);
  let doneAcc = 0;
  session.accessories.forEach((a, i) => {
    const row = log.accessories[i]; if (!row) return;
    doneAcc += Math.min(row.setsCompleted ?? 0, a.sets);
  });
  const total = totalMainSets + totalAccSets;
  const done  = doneMain + doneAcc;
  const pct = total ? Math.round((done/total)*100) : 0;
  return { pct, done, total };
}
const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
    <div className="h-full bg-indigo-500" style={{ width: `${value}%` }} />
  </div>
);

/* ========== 90s REST TIMER (WOD-tyyli / siisti badge) ========== */
function useRestTimer() {
  const [active, setActive] = useState(false);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(()=> setSecs(s => (s >= 90 ? 90 : s+1)), 1000);
    return () => clearInterval(id);
  }, [active]);
  useEffect(() => { if (secs >= 90 && active) setActive(false); }, [secs, active]);
  const start = () => { setSecs(0); setActive(true); };
  const stop  = () => setActive(false);
  const reset = () => { setActive(false); setSecs(0); };
  return { active, secs, start, stop, reset };
}
function RestTimerBadge({ timer }:{ timer: ReturnType<typeof useRestTimer> }) {
  if (!timer.active && timer.secs === 0) return null;
  const pct = Math.round((clamp(timer.secs,0,90) / 90) * 100);
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50">
      <div className="rounded-full bg-white/90 shadow-lg border border-slate-200 px-4 py-2 flex items-center gap-3">
        <div className="font-['Outfit',sans-serif] text-xl text-slate-900">{fmt(Math.floor(timer.secs/60))}:{fmt(timer.secs%60)}</div>
        <div className="w-36">
          <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {timer.active ? (
          <button onClick={timer.stop} className="text-xs font-semibold bg-slate-900 text-white rounded-full px-3 py-1">Stop</button>
        ) : (
          <button onClick={timer.start} className="text-xs font-semibold bg-indigo-600 text-white rounded-full px-3 py-1">Restart</button>
        )}
        <button onClick={timer.reset} className="text-xs font-semibold bg-slate-100 text-slate-800 rounded-full px-3 py-1 border border-slate-300">Reset</button>
      </div>
    </div>
  );
}

/* ========== HEADER / NAV (WOD-fiilis) ========== */
const titleFont = "font-['Outfit',sans-serif]";
const bodyFont = "font-['Inter',system-ui,sans-serif]";

function Header() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
      <div className="flex items-center justify-between">
        <div>
          <div className={`${titleFont} text-2xl text-slate-900`}>Weightlifting Program</div>
          <div className="text-sm text-slate-500">10 weeks • 4 sessions / week</div>
        </div>
        <div className={`${titleFont} hidden sm:block text-xl text-indigo-600`}>Training Log</div>
      </div>
    </div>
  );
}

/* ========== MAIN LIFT: otsikko kerran + SARIJA-LOKEROT VAAKAAN ========== */
function MainLiftRow({
  main, oneRM, log, onLogChange, onAnySetLogged
}:{ main: MainBlock; oneRM: Partial<OneRM>; log: DayLog["main"]; onLogChange:(rowIdx:number, data:RowLog)=>void; onAnySetLogged: ()=>void }) {
  const rm = (oneRM as any)[main.lift] ?? 0;

  return (
    <div className="space-y-6">
      <div className={`${titleFont} text-xl text-slate-900`}>{main.lift}</div>

      {main.scheme.map((s, idx) => {
        const est = (rm && s.percent) ? roundTo((s.percent/100)*rm) : 0;
        const row = log[idx] ?? { setWeights: Array.from({length:s.sets}, ()=>0) } as RowLog;
        const setWeights = row.setWeights?.length === s.sets ? row.setWeights : Array.from({length:s.sets}, (_,i)=>row.setWeights?.[i] ?? 0);

        return (
          <div key={idx} className="space-y-2">
            {/* Rivi-info */}
            <div className="text-sm font-semibold text-slate-700">
              {s.sets} x {s.reps} {s.percent ? <>@ <span className="text-slate-900">{s.percent}%</span></> : null}
              {est ? <span className="ml-2 text-slate-500">~{est} kg</span> : null}
            </div>

            {/* Lokerot vierekkäin, ei wrap: inline-flex + whitespace-nowrap */}
            <div className="overflow-x-auto [-webkit-overflow-scrolling:touch] touch-pan-x">
              <div className="inline-flex gap-3 pr-2 py-1 whitespace-nowrap">
                {setWeights.map((w,i)=>(
                  <div key={i} className="shrink-0 min-w-[10.5rem] bg-white rounded-xl border border-slate-200 shadow-sm">
                    <div className="p-3 text-center">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Set {i+1}</div>
                      <div className="text-xs text-slate-500">Reps: <span className="text-slate-900 font-semibold">{s.reps}</span></div>
                      <div className="text-xs text-slate-500">Target: <span className="text-slate-900 font-semibold">{est ? `${est} kg` : "-"}</span></div>
                      <input
                        type="number"
                        inputMode="decimal"
                        className="input w-full mt-2 bg-slate-50 border-slate-200"
                        placeholder={est ? `${est}` : ""}
                        value={w || ""}
                        onChange={(e)=>{
                          const v = Number(e.target.value || 0);
                          const next=[...setWeights]; next[i]=v;
                          onLogChange(idx, { ...row, setWeights: next });
                        }}
                        onBlur={onAnySetLogged}
                      />
                    </div>
                    <div className="h-[3px] bg-indigo-500 rounded-b-xl" />
                  </div>
                ))}
              </div>
            </div>

            {/* Pääliikkeen lyhyt muistiinpano (optional) */}
            <input
              type="text"
              className="input w-full bg-slate-50 border-slate-200"
              placeholder="Notes (main lift)"
              value={row.notes ?? ""}
              onChange={(e)=> onLogChange(idx, { ...row, notes: e.target.value })}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ========== ACCESSORIES (ei muistiinpanoja) ========== */
function AccessoriesLogger({
  items, log, onLogChange
}:{ items: Accessory[]; log: DayLog["accessories"]; onLogChange:(i:number, data:AccessoryLog)=>void }) {
  return (
    <div className="grid gap-2">
      {items.map((a,i)=>{
        const row = log[i] ?? {};
        return (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="font-semibold text-slate-900">{a.name} <span className="text-slate-500">— {a.sets} x {a.reps}</span></div>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <input type="number" inputMode="decimal" placeholder="Weight kg"
                className="input bg-slate-50 border-slate-200"
                value={row.weight ?? ""} onChange={(e)=>onLogChange(i, { ...row, weight: Number(e.target.value || 0) })}/>
              <input type="number" inputMode="decimal" placeholder="Reps"
                className="input bg-slate-50 border-slate-200"
                value={typeof row.reps==="number" ? row.reps : ""} onChange={(e)=>onLogChange(i, { ...row, reps: Number(e.target.value || 0) })}/>
              <div className="flex items-center gap-2">
                <input type="number" inputMode="decimal" placeholder={`Done /${a.sets}`}
                  className="input w-24 bg-slate-50 border-slate-200"
                  value={row.setsCompleted ?? 0} onChange={(e)=>onLogChange(i, { ...row, setsCompleted: Number(e.target.value || 0) })}/>
                <span className="text-slate-500 text-sm">/ {a.sets}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ========== APP (Tabs: Workout / Settings) ========== */
export default function App() {
  const [tab, setTab] = useLocalStore<"workout"|"settings">("wl_tab","workout");
  const [week, setWeek] = useLocalStore<number>("wl_week", 1);
  const [day, setDay]   = useLocalStore<number>("wl_day", 1);
  const [oneRM, setOneRM] = useLocalStore<Partial<OneRM>>("wl_1rm", {
    "Snatch": 70, "Clean & Jerk": 90, "Deadlift": 195, "Bench Press": 110, "Back Squat": 130, "Front Squat": 110
  });
  const [logs, setLogs] = useLocalStore<LogStore>("wl_log_v2", {});
  const key = `${week}-${day}`;
  const dayLog: DayLog = logs[key] ?? { main: {}, accessories: {} };

  const current = useMemo(()=> weeks.find(w => w.week === week)!, [week]);
  const session = useMemo(()=> current.days.find(d => d.day === day)!, [current, day]);
  useEffect(()=>{ if (day < 1 || day > 4) setDay(1); }, [week]);

  const sessionProg = computeSessionProgress(session, dayLog);
  const overallIndex = (week-1)*4 + (day-1);
  const overallPct = Math.round((overallIndex / (10*4 - 1)) * 100);

  const updateMainLog = (rowIdx:number, data:RowLog) =>
    setLogs(prev => ({ ...prev, [key]: { ...dayLog, main: { ...dayLog.main, [rowIdx]: data } } }));
  const updateAccLog = (i:number, data:AccessoryLog) =>
    setLogs(prev => ({ ...prev, [key]: { ...dayLog, accessories: { ...dayLog.accessories, [i]: data } } }));

  const timer = useRestTimer();
  const startRestFromInput = () => { timer.start(); };

  return (
    <div className={`min-h-screen ${bodyFont} bg-slate-50 text-slate-900`}>
      <RestTimerBadge timer={timer} />

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <Header />

        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={()=>setTab("workout")} className={`px-4 py-2 rounded-lg border ${tab==="workout" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-800"}`}>Workout</button>
          <button onClick={()=>setTab("settings")} className={`px-4 py-2 rounded-lg border ${tab==="settings" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-800"}`}>Settings</button>
        </div>

        {/* Program progress (bar only) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Program • Week {week} / Day {day}</div>
          <ProgressBar value={overallPct} />
        </div>

        {tab==="settings" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className={`${titleFont} text-xl mb-3`}>1RM Settings</div>
            <div className="grid md:grid-cols-3 grid-cols-1 gap-3">
              {["Snatch","Clean & Jerk","Deadlift","Bench Press","Back Squat","Front Squat"].map((k) => (
                <label key={k} className="text-sm flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <span className="w-32">{k}</span>
                  <input type="number" inputMode="decimal"
                    className="input w-full bg-white border-slate-200"
                    value={(oneRM as any)[k] ?? ""} onChange={(e)=>setOneRM(v => ({ ...v, [k]: Number(e.target.value || 0) }))}/>
                  <span className="text-slate-500">kg</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {tab==="workout" && (
          <>
            {/* Week/Day Nav */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <button className="px-4 py-2 rounded-lg bg-slate-100 text-slate-900 border border-slate-200" onClick={()=>setWeek(w => Math.max(1,w-1))}>◀ Week</button>
                <div className={`${titleFont} text-xl`}>Week {week}</div>
                <button className="px-4 py-2 rounded-lg bg-slate-100 text-slate-900 border border-slate-200" onClick={()=>setWeek(w => Math.min(10,w+1))}>Week ▶</button>
              </div>

              {/* Day buttons */}
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[1,2,3,4].map(d=>(
                  <button key={d}
                          className={`px-3 py-2 rounded-lg border ${d===day ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-800"}`}
                          onClick={()=>setDay(d)}>
                    Day {d}
                  </button>
                ))}
              </div>

              <div className="mt-3 text-sm text-slate-600">This week squat: <span className="font-semibold text-slate-900">{current.squatType}</span></div>
            </div>

            {/* Session card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className={`${titleFont} text-xl`}>{session.title}</div>
                <div className="w-48"><ProgressBar value={computeSessionProgress(session, dayLog).pct} /></div>
              </div>

              <div className="text-sm text-slate-600">Warm-up: {session.warmup.join(" · ")}</div>

              <section>
                <MainLiftRow
                  main={session.main}
                  oneRM={oneRM}
                  log={dayLog.main}
                  onLogChange={(rowIdx, data)=> setLogs(prev => ({ ...prev, [key]: { ...dayLog, main: { ...dayLog.main, [rowIdx]: data } } }))}
                  onAnySetLogged={startRestFromInput}
                />
              </section>

              <section>
                <div className={`${titleFont} text-lg mb-2`}>Accessories</div>
                <AccessoriesLogger
                  items={session.accessories}
                  log={dayLog.accessories}
                  onLogChange={(i, data)=> setLogs(prev => ({ ...prev, [key]: { ...dayLog, accessories: { ...dayLog.accessories, [i]: data } } }))}
                />
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

