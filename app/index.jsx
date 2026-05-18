import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { G, Line, Path, Rect, Text as SvgText } from "react-native-svg";

const COLORS = {
  blue: "#27a5d3",
  text: "#202633",
  muted: "#9aa0a8",
  gridMinor: "#ffe2e2",
  gridMajor: "#ffbcbc",
  trace: "#9f9f9f",
  regular: "#bfdfb1",
  abnormal: "#f59e0b"
};

const ecgStrips = [
  createStripSignal(1, 10),
  createStripSignal(6, 10),
  createStripSignal(11, 6.5)
];
const denoisedClean = createDenoisedSignal([0.55, 1.55, 2.55, 3.55, 4.55]);
const denoisedNoisy = denoisedClean.map((point) => ({
  x: point.x,
  y: point.y + 0.2 * Math.sin(point.x * 54) + 0.12 * Math.sin(point.x * 136)
}));
const denoisedData = denoisedClean.map((point) => ({
  x: point.x,
  y: point.y + 0.03 * Math.sin(point.x * 18)
}));

function gaussian(value, center, width, amplitude) {
  return amplitude * Math.exp(-Math.pow(value - center, 2) / (2 * width * width));
}

function heartbeat(time, center) {
  return (
    gaussian(time, center - 0.12, 0.035, 0.12) +
    gaussian(time, center - 0.018, 0.012, -0.18) +
    gaussian(time, center, 0.018, 0.55) +
    gaussian(time, center + 0.03, 0.016, -0.23) +
    gaussian(time, center + 0.28, 0.07, 0.2)
  );
}

function createStripSignal(seed, duration) {
  const samples = 260;
  const beats = [];

  for (let beat = 0.7; beat < duration + 0.5; beat += 0.86 + 0.08 * Math.sin(seed + beat * 2.1)) {
    beats.push(beat);
  }

  return Array.from({ length: samples }, (_, index) => {
    const x = (duration * index) / (samples - 1);
    const base = beats.reduce((sum, beat) => sum + heartbeat(x, beat), 0);
    const noise = 0.05 * Math.sin(x * 40 + seed) + 0.035 * Math.sin(x * 91 + seed * 2);
    const drift = 0.04 * Math.sin(x * 1.4 + seed);

    return { x, y: base + noise + drift };
  });
}

function createDenoisedSignal(beats) {
  const samples = 190;
  const duration = 5;

  return Array.from({ length: samples }, (_, index) => {
    const x = (duration * index) / (samples - 1);
    const baseline = -0.04 + 0.03 * Math.sin(x * 2.6);
    const y = beats.reduce((sum, beat) => sum + heartbeat(x, beat), baseline);

    return { x, y };
  });
}

function signalToPath(points, width, baseline, amplitude, duration) {
  return points
    .map((point, index) => {
      const x = (point.x / duration) * width;
      const y = baseline - point.y * amplitude;

      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function chartToPath(points, bounds, innerWidth, innerHeight) {
  return points
    .map((point, index) => {
      const x = bounds.left + ((point.x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * innerWidth;
      const y = bounds.top + (1 - (point.y - bounds.yMin) / (bounds.yMax - bounds.yMin)) * innerHeight;

      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function HeartIcon() {
  return (
    <Svg width={58} height={52} viewBox="0 0 58 52">
      <Path
        d="M29 50 C11 36 2 27 2 16 C2 7 9 1 17 1 C22 1 26 4 29 8 C32 4 36 1 41 1 C49 1 56 7 56 16 C56 27 47 36 29 50 Z"
        fill="#ff0000"
      />
    </Svg>
  );
}

function InfoIcon({ isGood }) {
  return (
    <View style={[styles.infoIcon, isGood ? styles.infoIconGood : styles.infoIconBad]}>
      <Text style={styles.infoIconText}>i</Text>
    </View>
  );
}

function EcgPaper() {
  const { height, width } = useWindowDimensions();
  const paperWidth = Math.min(Math.max(width, 320), 720);
  const paperHeight = Math.max(height - 390, 390);
  const minorStep = 10;
  const majorStep = 50;
  const verticalLines = Math.ceil(paperWidth / minorStep) + 1;
  const horizontalLines = Math.ceil(paperHeight / minorStep) + 1;
  const baselines = [82, 232, 370];

  return (
    <View style={styles.paperWrap}>
      <Svg width={paperWidth} height={paperHeight}>
        <Rect x={0} y={0} width={paperWidth} height={paperHeight} fill="#ffffff" />
        <G>
          {Array.from({ length: verticalLines }, (_, index) => {
            const x = index * minorStep;
            const isMajor = index % (majorStep / minorStep) === 0;

            return <Line key={`v-${index}`} x1={x} x2={x} y1={0} y2={paperHeight} stroke={isMajor ? COLORS.gridMajor : COLORS.gridMinor} strokeWidth={isMajor ? 0.9 : 0.45} />;
          })}
          {Array.from({ length: horizontalLines }, (_, index) => {
            const y = index * minorStep;
            const isMajor = index % (majorStep / minorStep) === 0;

            return <Line key={`h-${index}`} x1={0} x2={paperWidth} y1={y} y2={y} stroke={isMajor ? COLORS.gridMajor : COLORS.gridMinor} strokeWidth={isMajor ? 0.9 : 0.45} />;
          })}

          {ecgStrips.map((strip, index) => (
            <Path
              key={`strip-${index}`}
              d={signalToPath(strip, paperWidth, baselines[index], 50, index === 2 ? 6.5 : 10)}
              fill="none"
              stroke={COLORS.trace}
              strokeWidth={1.2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </G>
      </Svg>
    </View>
  );
}

function DenoisedChart() {
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(Math.max(width - 32, 320), 720);
  const height = 330;
  const padding = { top: 28, right: 18, bottom: 42, left: 42 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const bounds = { left: padding.left, top: padding.top, xMin: 0, xMax: 5, yMin: -0.8, yMax: 1.15 };
  const xTicks = [0, 1, 2, 3, 4, 5];
  const yTicks = [-0.5, 0, 0.5, 1];
  const series = [
    { label: "Noisy", color: "#f4a261", data: denoisedNoisy, width: 1.2 },
    { label: "Denoised", color: "#2ca02c", data: denoisedData, width: 2.4 }
  ];

  return (
    <View style={styles.denoisedCard}>
      <Text style={styles.denoisedTitle}>Static denoised ECG data</Text>
      <Text style={styles.denoisedText}>This chart uses mock ECG data to show a noisy signal and a denoised signal.</Text>
      <Svg width={chartWidth} height={height}>
        <Rect x={0} y={0} width={chartWidth} height={height} fill="#ffffff" rx={18} />
        <G>
          {xTicks.map((tick) => {
            const x = padding.left + (tick / 5) * innerWidth;
            return <Line key={`x-${tick}`} x1={x} x2={x} y1={padding.top} y2={padding.top + innerHeight} stroke="#d9dee7" strokeWidth={1} />;
          })}
          {yTicks.map((tick) => {
            const y = padding.top + (1 - (tick - bounds.yMin) / (bounds.yMax - bounds.yMin)) * innerHeight;
            return <Line key={`y-${tick}`} x1={padding.left} x2={padding.left + innerWidth} y1={y} y2={y} stroke="#d9dee7" strokeWidth={1} />;
          })}
          <Line x1={padding.left} x2={padding.left} y1={padding.top} y2={padding.top + innerHeight} stroke="#344054" strokeWidth={1.2} />
          <Line x1={padding.left} x2={padding.left + innerWidth} y1={padding.top + innerHeight} y2={padding.top + innerHeight} stroke={COLORS.blue} strokeWidth={1.4} />
          {series.map((item) => (
            <Path
              key={item.label}
              d={chartToPath(item.data, bounds, innerWidth, innerHeight)}
              fill="none"
              stroke={item.color}
              strokeWidth={item.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          <SvgText x={padding.left + innerWidth / 2} y={height - 10} fill={COLORS.text} fontSize="12" textAnchor="middle">
            Time (seconds)
          </SvgText>
        </G>
      </Svg>
      <View style={styles.legendRow}>
        {series.map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MenuTabs({ activeScreen, onChange }) {
  return (
    <View style={styles.menuTabs}>
      <Pressable style={[styles.menuButton, activeScreen === "recording" ? styles.menuButtonActive : null]} onPress={() => onChange("recording")}>
        <Text style={[styles.menuText, activeScreen === "recording" ? styles.menuTextActive : null]}>Recording</Text>
      </Pressable>
      <Pressable style={[styles.menuButton, activeScreen === "denoised" ? styles.menuButtonActive : null]} onPress={() => onChange("denoised")}>
        <Text style={[styles.menuText, activeScreen === "denoised" ? styles.menuTextActive : null]}>Denoised</Text>
      </Pressable>
    </View>
  );
}

function RecordingScreen({ heartRate, isGood }) {
  return (
    <>
      <View style={styles.summary}>
        <View style={styles.heartRateWrap}>
          <HeartIcon />
          <Text style={styles.heartRate}>{heartRate}</Text>
          <Text style={styles.perMinute}>/min</Text>
        </View>

        <View style={styles.resultRow}>
          <Text style={[styles.resultText, isGood ? styles.resultGood : styles.resultBad]}>{isGood ? "Regular heart beat" : "Abnormal heart beat"}</Text>
          <InfoIcon isGood={isGood} />
        </View>
      </View>

      <EcgPaper />
    </>
  );
}

function DenoisedScreen() {
  return (
    <ScrollView contentContainerStyle={styles.denoisedScreen}>
      <DenoisedChart />
      <View style={styles.simpleInfoCard}>
        <Text style={styles.simpleInfoTitle}>What it means</Text>
        <Text style={styles.simpleInfoText}>The orange line has extra noise. The green line is the same mock signal after basic denoising.</Text>
      </View>
    </ScrollView>
  );
}

export default function HomeScreen() {
  const [activeScreen, setActiveScreen] = useState("recording");
  const [heartRate, setHeartRate] = useState(68);
  const isGood = heartRate >= 60 && heartRate <= 100;

  useEffect(() => {
    let direction = 1;

    const intervalId = globalThis.setInterval(() => {
      setHeartRate((currentRate) => {
        if (currentRate >= 104) {
          direction = -1;
        }
        if (currentRate <= 56) {
          direction = 1;
        }

        return currentRate + direction * 2;
      });
    }, 1500);

    return () => globalThis.clearInterval(intervalId);
  }, []);

  return (
      <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.recordBar}>
        <Text style={styles.recordTitle}>30s ECG Recording</Text>
      </View>
      <MenuTabs activeScreen={activeScreen} onChange={setActiveScreen} />

      {activeScreen === "recording" ? <RecordingScreen heartRate={heartRate} isGood={isGood} /> : <DenoisedScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#f0f1f4",
    flex: 1
  },
  recordBar: {
    alignItems: "center",
    backgroundColor: COLORS.blue,
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 22,
    paddingTop: 58
  },
  recordTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "600"
  },
  menuTabs: {
    backgroundColor: "#ffffff",
    borderBottomColor: "#e5e7eb",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  menuButton: {
    alignItems: "center",
    backgroundColor: "#eef2f5",
    borderRadius: 18,
    flex: 1,
    paddingVertical: 11
  },
  menuButtonActive: {
    backgroundColor: COLORS.blue
  },
  menuText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800"
  },
  menuTextActive: {
    color: "#ffffff"
  },
  summary: {
    backgroundColor: "#ffffff",
    paddingBottom: 28,
    paddingHorizontal: 28,
    paddingTop: 36
  },
  heartRateWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-start"
  },
  heartRate: {
    color: COLORS.text,
    fontSize: 78,
    fontWeight: "700",
    letterSpacing: -2
  },
  perMinute: {
    color: COLORS.text,
    fontSize: 31,
    marginTop: 20
  },
  resultRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    marginTop: 26
  },
  resultText: {
    fontSize: 32,
    fontWeight: "400"
  },
  resultGood: {
    color: COLORS.regular
  },
  resultBad: {
    color: COLORS.abnormal
  },
  infoIcon: {
    alignItems: "center",
    borderRadius: 17,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  infoIconGood: {
    backgroundColor: "#f7ad2d"
  },
  infoIconBad: {
    backgroundColor: COLORS.abnormal
  },
  infoIconText: {
    color: "#ffffff",
    fontSize: 23,
    fontWeight: "800"
  },
  paperWrap: {
    backgroundColor: "#ffffff",
    borderTopColor: COLORS.gridMajor,
    borderTopWidth: 1,
    flex: 1,
    overflow: "hidden"
  },
  denoisedScreen: {
    padding: 16,
    paddingBottom: 28
  },
  denoisedCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    paddingTop: 18
  },
  denoisedTitle: {
    alignSelf: "stretch",
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
    paddingHorizontal: 18
  },
  denoisedText: {
    alignSelf: "stretch",
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 6,
    paddingHorizontal: 18
  },
  legendRow: {
    flexDirection: "row",
    gap: 18,
    marginBottom: 16
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  legendDot: {
    borderRadius: 5,
    height: 10,
    width: 10
  },
  legendText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  simpleInfoCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 14,
    padding: 18
  },
  simpleInfoTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800"
  },
  simpleInfoText: {
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8
  }
});
