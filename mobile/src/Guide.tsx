import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Pressable, StyleSheet, AccessibilityInfo, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, Button } from "./ui";

/**
 * First-launch user guide: a short self-playing demo (about 40 s) that runs fully offline.
 * Shown once, then never again (the app stores a single "seen" flag). Tap the card to pause.
 * With "Reduce motion" on, it does not auto-play: the person moves through it with Next.
 */
const SCENES = [
  { icon: "\u{1F6E1}", title: "Report safely", text: "No account. Nothing links a tip to you." },
  { icon: "\u{1F512}", title: "Locked on your phone", text: "Your message is encrypted before it leaves your phone. Only SAPS can open it." },
  { icon: "\u{1F4CD}", title: "Only a rough area", text: "We share about 5 km, never your exact location." },
  { icon: "\u{1F9FE}", title: "Save your claim code", text: "You get one claim code, shown once. Write it down: it is the only way to check or claim." },
  { icon: "\u{1F50E}", title: "Follow your tip", text: "See it move from Received to Assigned to Verified." },
  { icon: "\u{1F381}", title: "Get rewarded", text: "When an officer verifies your tip, claim a one-time voucher. No name needed." },
  { icon: "\u{1F6AA}", title: "Quick exit", text: "Tap Quick exit on any screen to leave at once and clear what is shown." },
];
const SCENE_MS = 5500;

export function Guide({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduce, setReduce] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.6)).current;
  const last = i === SCENES.length - 1;

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {}); }, []);
  useEffect(() => {
    if (reduce) { pop.setValue(1); return; }
    pop.setValue(0.6);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  }, [i, reduce, pop]);
  useEffect(() => {
    if (reduce || paused || last) return;
    progress.setValue(0);
    const run = Animated.timing(progress, { toValue: 1, duration: SCENE_MS, easing: Easing.linear, useNativeDriver: false });
    run.start(({ finished }) => { if (finished) setI((n) => Math.min(n + 1, SCENES.length - 1)); });
    return () => run.stop();
  }, [i, paused, reduce, last, progress]);

  const s = SCENES[i]!;
  return (
    <LinearGradient colors={[C.deep, C.navy, "#12404a"]} style={g.fill}>
      <View style={g.bars}>
        {SCENES.map((_, n) => (
          <View key={n} style={g.track}>
            <Animated.View style={[g.fillBar, { width: n < i || last && n === i || reduce && n <= i ? "100%" : n === i ? progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) : "0%" }]} />
          </View>
        ))}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Skip guide" onPress={onDone} style={g.skip}><Text style={g.skipText}>Skip</Text></Pressable>
      <Pressable accessibilityLabel={paused ? "Resume guide" : "Pause guide"} onPress={() => setPaused((p) => !p)} style={g.stage}>
        <Animated.View style={[g.orb, { transform: [{ scale: pop }] }]}><Text style={g.icon}>{s.icon}</Text></Animated.View>
        <Text accessibilityRole="header" style={g.title}>{s.title}</Text>
        <Text accessibilityLiveRegion="polite" style={g.text}>{s.text}</Text>
        <Text style={g.hint}>{reduce ? "" : paused ? "Paused. Tap to resume" : "Tap to pause"}</Text>
      </Pressable>
      <View style={g.footer}>
        {i > 0 && <Button kind="ghost" label="Back" onPress={() => setI(i - 1)} />}
        {last ? <Button label="Get started" onPress={onDone} /> : <Button label="Next" onPress={() => setI(i + 1)} />}
      </View>
    </LinearGradient>
  );
}

const g = StyleSheet.create({
  fill: { flex: 1, paddingTop: 64, paddingHorizontal: 24, paddingBottom: 32 },
  bars: { flexDirection: "row", gap: 6 }, track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(246,244,239,0.2)", overflow: "hidden" },
  fillBar: { height: 4, backgroundColor: C.orange },
  skip: { alignSelf: "flex-end", paddingVertical: 16, paddingHorizontal: 8 }, skipText: { color: C.muted, fontSize: 16, fontWeight: "700" },
  stage: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  orb: { width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(232,115,26,0.16)", borderWidth: 2, borderColor: C.orange, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 84 }, title: { color: C.paper, fontSize: 32, fontWeight: "800", textAlign: "center" },
  text: { color: "#d9d4c8", fontSize: 18, lineHeight: 27, textAlign: "center", paddingHorizontal: 8 }, hint: { color: C.muted, fontSize: 13, marginTop: 8 },
  footer: { gap: 12 },
});
