# Trainings

## 1. Aerobic / Zone 2 (Base Engine)

**Purpose:**  
Mitochondrial fitness, fat oxidation, recovery capacity.

### Session
- **60–120 min** at **60–75% FTP**
- Cadence: natural (**80–95 rpm**)

### Good for
- Building endurance
- Recovery between hard sessions
- Increasing training volume

### Example
1. 10 min warm-up
2. 75 min steady Zone 2
3. 5–10 min cooldown

---

## 2. Sweet Spot (Most Time-Efficient Endurance)

**Purpose:**  
Improve FTP with manageable fatigue.

### Session
- **2×20 min** or **3×15 min**
- Intensity: **88–94% FTP**
- **5 min easy recovery** between intervals

### Example
1. Warm-up
2. 3×15 min @ 90% FTP
3. 5 min recovery between intervals
4. Cooldown

### Good for
- Busy weeks
- Indoor training
- Building sustained power

---

## 3. Threshold / FTP Intervals

**Purpose:**  
Raise lactate threshold.

### Session Options
- **2×20 min @ 95–100% FTP**
- **4×10 min @ 100–105% FTP**

Hard but controlled.

### Example
1. 15 min warm-up
2. 4×10 min @ FTP
3. 5 min easy between intervals
4. Cooldown

### Good for
- Time trials
- Long climbs
- Sustained power

---

## 4. Rønnestad Intervals (VO₂max Classic)

**Purpose:**  
Increase VO₂max and high-end aerobic power.

### Classic Format
- **3 sets**
- Each set:
  - **13×**
    - 30 sec hard
    - 15 sec easy
- **3 min easy** between sets

### Intensity
- Hard = **120–130% FTP**
- Easy = soft spinning

### Notes
Very effective but brutal.

**Beginner variation:** Start with **2 sets**.

### Good for
- Breaking plateaus
- Race fitness
- Repeated hard efforts

---

## 5. 4×8 min VO₂max Intervals

**Purpose:**  
Highly effective for aerobic gains and VO₂ improvements.

### Session
- **4×8 min @ 105–110% FTP**
- **2–3 min recovery**

### Feeling
“You can survive, but don’t want another minute.”

### Good for
- FTP improvement
- VO₂max gains
- Time-efficient training

---

## 6. Microbursts / 30–30s

**Purpose:**  
VO₂max work with lower mental fatigue.

### Session
- **2–3 sets**
- Each set:
  - **10–15×**
    - 30 sec hard
    - 30 sec easy

### Intensity
- Hard = **120–130% FTP**

### Good for
- VO₂max development
- Short, intense sessions
- Mental variety

---

## 7. Over-Unders

**Purpose:**  
Lactate clearance and race-specific fitness.

### Session
**3×12 min**
Repeat:
- 2 min @ 95% FTP
- 1 min @ 105–110% FTP

### Feeling
Feels terrible—in a productive way.

### Good for
- Hilly rides
- Group rides
- Gran fondos

---

## 8. Sprint / Neuromuscular Power

**Purpose:**  
Increase top-end sprint power.

### Session
- **8–12 × 10–15 sec all-out sprint**
- **2–4 min full recovery**

### Good for
- Peak power
- Sprint performance
- Low-fatigue high-quality work

# Structure

```JSON
{
  name: "My training name",
  description: "primary benefit...",
  steps: [
    {
      type: "relative",
      load_rel: 50,
      name: "Warmup"
      duration_s: 600,
    },
    {
    type: "repeat",
    repeat_times: 10,
    steps: [
      {
        type: "relative",
        load_rel: 180,
        name: "Load"
        duration_s: 10,
      },
      {
        type: "relative",
        load_rel: 40,
        name: "Warmup"
        duration_s: 600,
      },
    ]
    },
    {
      type: "absolute",
      load_abs: 130,
      name: "Cooldown"
      duration_s: 600,
    },
  ]
}
```

Notes:
- `type`:
  - `absolute`=absolute (`load_abs` will be in watt)
  - `relative`=relative to FTP (`load_rel` will be in percent FTP)
  - `repeat` enalbes to specify a multiple `steps` that are repeated `repeat_times` times.