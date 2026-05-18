import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { G, Line, Path, Rect } from "react-native-svg";

const BLUE = "#27a5d3";
const TEXT = "#202633";
const MUTED = "#8f98a3";
const ECG_LINE = "#9f9f9f";

const ecgLines = [makeEcgData(1, 10), makeEcgData(4, 10), makeEcgData(8, 7)];
const cleanData = makeEcgData(2, 5);
const noisyData = cleanData.map((point) => ({
  x: point.x,
  y: point.y + 0.2 * Math.sin(point.x * 55) + 0.1 * Math.sin(point.x * 140)
}));
const denoisedData = cleanData.map((point) => ({
  x: point.x,
  y: point.y + 0.03 * Math.sin(point.x * 20)
}));

// Fake ECG points for the demo. The spikes make it look like a heartbeat.
function makeEcgData(seed, seconds) {
  const points = [];
  const samples = 220;

  for (let index = 0; index < samples; index += 1) {
    const x = (seconds * index) / (samples - 1);
    const beatPosition = x % 0.9;
    const spike = Math.exp(-Math.pow(beatPosition - 0.08, 2) / 0.0009) * 0.75;
    const smallWave = 0.18 * Math.sin(x * 18 + seed) + 0.08 * Math.sin(x * 45 + seed);
    const noise = 0.04 * Math.sin(x * 95 + seed);

    points.push({ x, y: spike + smallWave + noise });
  }

  return points;
}

function makePath(points, width, height, seconds) {
  return points
    .map((point, index) => {
      const x = (point.x / seconds) * width;
      const y = height / 2 - point.y * 55;

      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function HeartIcon() {
  return (
    <Svg width={58} height={52} viewBox="0 0 58 52">
      <Path d="M29 50 C11 36 2 27 2 16 C2 7 9 1 17 1 C22 1 26 4 29 8 C32 4 36 1 41 1 C49 1 56 7 56 16 C56 27 47 36 29 50 Z" fill="red" />
    </Svg>
  );
}

function Header({ activeTab, setActiveTab }) {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.headerText}>30s ECG Recording</Text>
      </View>
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, activeTab === "recording" && styles.activeTab]} onPress={() => setActiveTab("recording")}>
          <Text style={[styles.tabText, activeTab === "recording" && styles.activeTabText]}>Recording</Text>
        </Pressable>
        <Pressable style={[styles.tab, activeTab === "denoised" && styles.activeTab]} onPress={() => setActiveTab("denoised")}>
          <Text style={[styles.tabText, activeTab === "denoised" && styles.activeTabText]}>Denoised</Text>
        </Pressable>
      </View>
    </>
  );
}

function RecordingView({ heartRate }) {
  const isGood = heartRate >= 60 && heartRate <= 100;

  return (
    <>
      <View style={styles.heartPanel}>
        <View style={styles.heartRow}>
          <HeartIcon />
          <Text style={styles.heartRate}>{heartRate}</Text>
          <Text style={styles.perMinute}>/min</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={[styles.statusText, isGood ? styles.goodText : styles.badText]}>{isGood ? "Regular heart beat" : "Abnormal heart beat"}</Text>
          <View style={[styles.infoCircle, !isGood && styles.badCircle]}>
            <Text style={styles.infoText}>i</Text>
          </View>
        </View>
      </View>
      <EcgPaper />
    </>
  );
}

function EcgPaper() {
  const { height, width } = useWindowDimensions();
  const paperWidth = Math.min(Math.max(width, 320), 720);
  const paperHeight = Math.max(height - 390, 390);
  const baselines = [82, 232, 370];

  return (
    <View style={styles.paper}>
      <Svg width={paperWidth} height={paperHeight}>
        <Rect width={paperWidth} height={paperHeight} fill="white" />
        <Grid width={paperWidth} height={paperHeight} />
        {ecgLines.map((line, index) => (
          <Path
            key={`ecg-${index}`}
            d={makePath(line, paperWidth, baselines[index] * 2, index === 2 ? 7 : 10)}
            fill="none"
            stroke={ECG_LINE}
            strokeWidth={1.3}
          />
        ))}
      </Svg>
    </View>
  );
}

function Grid({ width, height }) {
  const lines = [];

  for (let x = 0; x <= width; x += 10) {
    const isBigLine = x % 50 === 0;
    lines.push(<Line key={`x-${x}`} x1={x} x2={x} y1={0} y2={height} stroke={isBigLine ? "#ffbcbc" : "#ffe2e2"} strokeWidth={isBigLine ? 0.9 : 0.45} />);
  }

  for (let y = 0; y <= height; y += 10) {
    const isBigLine = y % 50 === 0;
    lines.push(<Line key={`y-${y}`} x1={0} x2={width} y1={y} y2={y} stroke={isBigLine ? "#ffbcbc" : "#ffe2e2"} strokeWidth={isBigLine ? 0.9 : 0.45} />);
  }

  return <G>{lines}</G>;
}

function DenoisedView() {
  return (
    <ScrollView contentContainerStyle={styles.denoisedPage}>
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Static denoised ECG data</Text>
        <Text style={styles.chartText}>Orange is noisy mock data. Green is the same signal after denoising.</Text>
        <DenoisedChart />
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#f4a261" }]} />
            <Text style={styles.legendText}>Noisy</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#2ca02c" }]} />
            <Text style={styles.legendText}>Denoised</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function DenoisedChart() {
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(Math.max(width - 32, 320), 720);
  const chartHeight = 320;

  return (
    <Svg width={chartWidth} height={chartHeight}>
      <Rect width={chartWidth} height={chartHeight} fill="white" />
      <Grid width={chartWidth} height={chartHeight} />
      <Path d={makePath(noisyData, chartWidth, chartHeight, 5)} fill="none" stroke="#f4a261" strokeWidth={1.3} />
      <Path d={makePath(denoisedData, chartWidth, chartHeight, 5)} fill="none" stroke="#2ca02c" strokeWidth={2.4} />
    </Svg>
  );
}

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState("recording");
  const [heartRate, setHeartRate] = useState(68);

  // Heart rate moves up and down so the app feels alive.
  useEffect(() => {
    let direction = 1;

    const intervalId = globalThis.setInterval(() => {
      setHeartRate((currentRate) => {
        if (currentRate >= 104) direction = -1;
        if (currentRate <= 56) direction = 1;
        return currentRate + direction * 2;
      });
    }, 1500);

    return () => globalThis.clearInterval(intervalId);
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      {activeTab === "recording" ? <RecordingView heartRate={heartRate} /> : <DenoisedView />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#f0f1f4",
    flex: 1
  },
  header: {
    alignItems: "center",
    backgroundColor: BLUE,
    justifyContent: "center",
    paddingBottom: 22,
    paddingHorizontal: 32,
    paddingTop: 58
  },
  headerText: {
    color: "white",
    fontSize: 28,
    fontWeight: "600"
  },
  tabs: {
    backgroundColor: "white",
    borderBottomColor: "#e5e7eb",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12
  },
  tab: {
    alignItems: "center",
    backgroundColor: "#eef2f5",
    borderRadius: 18,
    flex: 1,
    paddingVertical: 11
  },
  activeTab: {
    backgroundColor: BLUE
  },
  tabText: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "800"
  },
  activeTabText: {
    color: "white"
  },
  heartPanel: {
    backgroundColor: "white",
    paddingBottom: 28,
    paddingHorizontal: 28,
    paddingTop: 36
  },
  heartRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  heartRate: {
    color: TEXT,
    fontSize: 78,
    fontWeight: "700",
    letterSpacing: -2
  },
  perMinute: {
    color: TEXT,
    fontSize: 31,
    marginTop: 20
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    marginTop: 26
  },
  statusText: {
    fontSize: 32
  },
  goodText: {
    color: "#bfdfb1"
  },
  badText: {
    color: "#f59e0b"
  },
  infoCircle: {
    alignItems: "center",
    backgroundColor: "#f7ad2d",
    borderRadius: 17,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  badCircle: {
    backgroundColor: "#f59e0b"
  },
  infoText: {
    color: "white",
    fontSize: 23,
    fontWeight: "800"
  },
  paper: {
    backgroundColor: "white",
    borderTopColor: "#ffbcbc",
    borderTopWidth: 1,
    flex: 1,
    overflow: "hidden"
  },
  denoisedPage: {
    padding: 16,
    paddingBottom: 28
  },
  chartCard: {
    backgroundColor: "white",
    borderColor: "#e5e7eb",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    paddingTop: 18
  },
  chartTitle: {
    color: TEXT,
    fontSize: 22,
    fontWeight: "800",
    paddingHorizontal: 18
  },
  chartText: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 6,
    paddingHorizontal: 18
  },
  legendRow: {
    flexDirection: "row",
    gap: 18,
    justifyContent: "center",
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
    color: MUTED,
    fontSize: 13,
    fontWeight: "700"
  }
});
