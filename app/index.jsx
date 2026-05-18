import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { G, Line, Path, Rect, Text as SvgText } from "react-native-svg";

const COLORS = {
  clean: "#2f7dbd",
  noisy: "#f4a261",
  denoised: "#2ca02c",
  normal: "#111827",
  arrhythmia: "#111827",
  grid: "#d9dee7",
  axis: "#2f7dbd",
  text: "#263142",
  muted: "#667085"
};

const SIGNAL_QUALITIES = ["Good", "Stable", "Noisy"];

function seededRandom(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function gaussian(value, center, width, amplitude) {
  return amplitude * Math.exp(-Math.pow(value - center, 2) / (2 * width * width));
}

function heartbeat(t, center) {
  return (
    gaussian(t, center - 0.12, 0.026, 0.1) +
    gaussian(t, center - 0.018, 0.01, -0.2) +
    gaussian(t, center, 0.012, 1.04) +
    gaussian(t, center + 0.025, 0.012, -0.26) +
    gaussian(t, center + 0.28, 0.048, 0.23)
  );
}

function createDenoisingSeries(seed) {
  const samples = 220;
  const duration = 5;
  const heartRate = 62 + Math.round(seededRandom(seed + 1) * 34);
  const interval = 60 / heartRate;
  const firstBeat = 0.48 + seededRandom(seed + 2) * 0.18;
  const beats = [];
  const clean = [];
  const noisy = [];
  const denoised = [];
  const noiseLevel = 0.22 + seededRandom(seed + 3) * 0.18;
  const denoiseRatio = 0.09 + seededRandom(seed + 4) * 0.09;

  for (let beat = firstBeat; beat < duration + 0.4; beat += interval + (seededRandom(seed + beat * 11) - 0.5) * 0.08) {
    beats.push(beat);
  }

  for (let index = 0; index < samples; index += 1) {
    const x = (duration * index) / (samples - 1);
    const base = beats.reduce((sum, beat) => sum + heartbeat(x, beat), 0);
    const baseline = 0.04 * Math.sin(x * (2.2 + seededRandom(seed + 5))) - 0.03;
    const noise =
      noiseLevel * Math.sin(x * (48 + seededRandom(seed + 6) * 18)) +
      noiseLevel * 0.62 * Math.sin(x * (130 + seededRandom(seed + 7) * 34)) +
      noiseLevel * 0.38 * Math.sin(x * (218 + seededRandom(seed + 8) * 36));
    const cleanY = base + baseline;

    clean.push({ x, y: cleanY });
    noisy.push({ x, y: cleanY + noise });
    denoised.push({ x, y: cleanY + noise * denoiseRatio + 0.018 * Math.sin(x * (13 + seededRandom(seed + 9) * 10)) });
  }

  return [
    { label: "Clean", color: COLORS.clean, data: clean, width: 1.8 },
    { label: "Noisy", color: COLORS.noisy, data: noisy, width: 1.1 },
    { label: "Denoised", color: COLORS.denoised, data: denoised, width: 2.1 }
  ];
}

function createRhythmSeries(beats, seed, irregular = false) {
  const duration = 15;
  const samples = 280;

  return Array.from({ length: samples }, (_, index) => {
    const x = (duration * index) / (samples - 1);
    const base = beats.reduce((sum, beat, beatIndex) => {
      const scale = irregular ? 0.74 + seededRandom(seed + beatIndex + 20) * 0.36 : 0.96 + seededRandom(seed + beatIndex + 40) * 0.08;
      return sum + heartbeat(x, beat) * scale;
    }, 0);
    const variation = irregular
      ? 0.1 * Math.sin(x * (5.6 + seededRandom(seed + 41))) + 0.06 * Math.sin(x * (15.4 + seededRandom(seed + 42) * 4)) - 0.12
      : 0.02 * Math.sin(x * (3.8 + seededRandom(seed + 43))) - 0.06;

    return { x, y: base + variation };
  });
}

function createBeatSchedule(seed, duration, baseInterval, irregular = false) {
  const beats = [];
  let time = 0.25 + seededRandom(seed + 60) * 0.5;

  while (time < duration) {
    const jitter = irregular ? (seededRandom(seed + time * 17) - 0.5) * 0.7 : (seededRandom(seed + time * 13) - 0.5) * 0.06;
    time += Math.max(0.72, baseInterval + jitter);
    beats.push(time);
  }

  return beats;
}

function createMockSnapshot(seed) {
  const heartRate = 62 + Math.round(seededRandom(seed + 100) * 36);
  const noiseRemoved = 70 + Math.round(seededRandom(seed + 101) * 23);
  const quality = SIGNAL_QUALITIES[Math.floor(seededRandom(seed + 102) * SIGNAL_QUALITIES.length)];
  const normalBeats = createBeatSchedule(seed + 120, 15, 1.75);
  const arrhythmiaBeats = createBeatSchedule(seed + 140, 15, 1.55, true);

  return {
    comparisonSeries: createDenoisingSeries(seed),
    normalSeries: createRhythmSeries(normalBeats, seed + 200),
    arrhythmiaSeries: createRhythmSeries(arrhythmiaBeats, seed + 300, true),
    metrics: [
      { label: "Heart rate", value: String(heartRate), unit: "bpm", tone: "#e8f3ff" },
      { label: "Noise removed", value: String(noiseRemoved), unit: "%", tone: "#eaf8ef" },
      { label: "Signal quality", value: quality, unit: "", tone: "#fff4df" }
    ],
    updatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  };
}

function toPath(points, bounds, innerWidth, innerHeight) {
  return points
    .map((point, index) => {
      const x = bounds.left + ((point.x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * innerWidth;
      const y = bounds.top + (1 - (point.y - bounds.yMin) / (bounds.yMax - bounds.yMin)) * innerHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function EcgChart({ title, subtitle, series, duration, yMin, yMax, height = 250, showLegend = false }) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(Math.max(width - 32, 320), 720);
  const padding = { top: 22, right: 18, bottom: 42, left: 42 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const bounds = { left: padding.left, top: padding.top, xMin: 0, xMax: duration, yMin, yMax };
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  const xTicks = Array.from({ length: duration + 1 }, (_, index) => index);

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>{title}</Text>
          {subtitle ? <Text style={styles.chartSubtitle}>{subtitle}</Text> : null}
        </View>
        {showLegend ? (
          <View style={styles.legend}>
            {series.map((item) => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <Svg width={chartWidth} height={height}>
        <Rect x={0} y={0} width={chartWidth} height={height} fill="#ffffff" rx={16} />
        <G>
          {xTicks.map((tick) => {
            const x = padding.left + (tick / duration) * innerWidth;
            return <Line key={`x-${tick}`} x1={x} x2={x} y1={padding.top} y2={padding.top + innerHeight} stroke={COLORS.grid} strokeWidth={1} />;
          })}
          {yTicks.map((tick) => {
            const y = padding.top + (1 - (tick - yMin) / (yMax - yMin)) * innerHeight;
            return <Line key={`y-${tick}`} x1={padding.left} x2={padding.left + innerWidth} y1={y} y2={y} stroke={COLORS.grid} strokeWidth={1} />;
          })}
          <Line x1={padding.left} x2={padding.left} y1={padding.top} y2={padding.top + innerHeight} stroke="#344054" strokeWidth={1.4} />
          <Line x1={padding.left} x2={padding.left + innerWidth} y1={padding.top + innerHeight} y2={padding.top + innerHeight} stroke={COLORS.axis} strokeWidth={1.6} />
          {series.map((item) => (
            <Path
              key={item.label}
              d={toPath(item.data, bounds, innerWidth, innerHeight)}
              fill="none"
              stroke={item.color}
              strokeWidth={item.width ?? 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={item.opacity ?? 1}
            />
          ))}
          {xTicks.filter((tick) => tick % (duration > 6 ? 2 : 1) === 0).map((tick) => {
            const x = padding.left + (tick / duration) * innerWidth;
            return <SvgText key={`xlabel-${tick}`} x={x} y={height - 17} fill={COLORS.text} fontSize="11" textAnchor="middle">{tick}</SvgText>;
          })}
          {yTicks.map((tick) => {
            const y = padding.top + (1 - (tick - yMin) / (yMax - yMin)) * innerHeight + 4;
            return <SvgText key={`ylabel-${tick}`} x={padding.left - 10} y={y} fill={COLORS.text} fontSize="11" textAnchor="end">{tick.toFixed(tick % 1 === 0 ? 0 : 1)}</SvgText>;
          })}
          <SvgText x={padding.left + innerWidth / 2} y={height - 4} fill={COLORS.text} fontSize="11" fontWeight="600" textAnchor="middle">
            Time (seconds)
          </SvgText>
        </G>
      </Svg>
    </View>
  );
}

export default function HomeScreen() {
  const [seed, setSeed] = useState(1);
  const [isLive, setIsLive] = useState(true);
  const [snapshot, setSnapshot] = useState(() => createMockSnapshot(1));

  useEffect(() => {
    setSnapshot(createMockSnapshot(seed));
  }, [seed]);

  useEffect(() => {
    if (!isLive) {
      return undefined;
    }

    const intervalId = globalThis.setInterval(() => {
      setSeed((currentSeed) => currentSeed + 1);
    }, 1200);

    return () => globalThis.clearInterval(intervalId);
  }, [isLive]);

  const generateSample = () => setSeed((currentSeed) => currentSeed + 1);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Mock EKG data</Text>
          <Text style={styles.title}>Denoised ECG Monitor</Text>
          <Text style={styles.description}>
            Live-feeling prototype that generates fake clean, noisy, and denoised ECG signals at runtime.
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.liveDot, isLive ? styles.liveDotActive : styles.liveDotPaused]} />
            <Text style={styles.statusText}>{isLive ? "Live simulation" : "Paused"} · Updated {snapshot.updatedAt}</Text>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <Pressable style={[styles.controlButton, isLive ? styles.controlButtonActive : null]} onPress={() => setIsLive((currentValue) => !currentValue)}>
            <Text style={[styles.controlButtonText, isLive ? styles.controlButtonTextActive : null]}>{isLive ? "Pause live" : "Start live"}</Text>
          </Pressable>
          <Pressable style={styles.controlButton} onPress={generateSample}>
            <Text style={styles.controlButtonText}>Generate sample</Text>
          </Pressable>
        </View>

        <View style={styles.metricsRow}>
          {snapshot.metrics.map((metric) => (
            <View key={metric.label} style={[styles.metricCard, { backgroundColor: metric.tone }]}>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricValue}>{metric.value}</Text>
                {metric.unit ? <Text style={styles.metricUnit}>{metric.unit}</Text> : null}
              </View>
            </View>
          ))}
        </View>

        <EcgChart
          title="ECG Denoising (5 sec)"
          subtitle="Clean vs noisy vs denoised waveform"
          series={snapshot.comparisonSeries}
          duration={5}
          yMin={-0.7}
          yMax={1.35}
          height={280}
          showLegend
        />

        <Text style={styles.sectionTitle}>Rhythm Examples</Text>
        <EcgChart
          title="Normal ECG"
          subtitle="Regular beat intervals"
          series={[{ label: "Normal", color: COLORS.normal, data: snapshot.normalSeries, width: 2.2 }]}
          duration={15}
          yMin={-1}
          yMax={1}
          height={190}
        />
        <EcgChart
          title="ECG with Arrhythmia"
          subtitle="Irregular beat spacing and amplitude variation"
          series={[{ label: "Arrhythmia", color: COLORS.arrhythmia, data: snapshot.arrhythmiaSeries, width: 2.2 }]}
          duration={15}
          yMin={-1}
          yMax={1}
          height={190}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f3f6fb"
  },
  content: {
    alignItems: "center",
    paddingBottom: 34,
    paddingHorizontal: 16,
    paddingTop: 54
  },
  hero: {
    alignSelf: "stretch",
    backgroundColor: "#162033",
    borderRadius: 28,
    marginBottom: 16,
    overflow: "hidden",
    padding: 24
  },
  eyebrow: {
    color: "#8fd3ff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginBottom: 8,
    textTransform: "uppercase"
  },
  title: {
    color: "#ffffff",
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: -0.7
  },
  description: {
    color: "#d5dfef",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 560
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 18
  },
  liveDot: {
    borderRadius: 6,
    height: 10,
    width: 10
  },
  liveDotActive: {
    backgroundColor: "#36d399"
  },
  liveDotPaused: {
    backgroundColor: "#f59e0b"
  },
  statusText: {
    color: "#e8eef8",
    fontSize: 13,
    fontWeight: "700"
  },
  controlsRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: 10,
    marginBottom: 14
  },
  controlButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "rgba(16, 24, 40, 0.12)",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 13
  },
  controlButtonActive: {
    backgroundColor: "#2f7dbd",
    borderColor: "#2f7dbd"
  },
  controlButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800"
  },
  controlButtonTextActive: {
    color: "#ffffff"
  },
  metricsRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 6
  },
  metricCard: {
    borderColor: "rgba(16, 24, 40, 0.08)",
    borderRadius: 20,
    borderWidth: 1,
    flexBasis: "31%",
    flexGrow: 1,
    minWidth: 104,
    padding: 14
  },
  metricLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  metricValueRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 5,
    marginTop: 8
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800"
  },
  metricUnit: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4
  },
  chartCard: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "#ffffff",
    borderColor: "rgba(16, 24, 40, 0.08)",
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 8,
    paddingTop: 16,
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18
  },
  chartHeader: {
    alignItems: "flex-start",
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12
  },
  chartTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800"
  },
  chartSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 3
  },
  legend: {
    alignItems: "flex-start",
    gap: 5,
    marginLeft: 10
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5
  },
  legendSwatch: {
    borderRadius: 6,
    height: 7,
    width: 18
  },
  legendText: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "700"
  },
  sectionTitle: {
    alignSelf: "stretch",
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "800",
    marginTop: 24
  }
});
