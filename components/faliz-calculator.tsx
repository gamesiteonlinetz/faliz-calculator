import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  evaluateExpression,
  formatResult,
  type AngleMode,
} from "@/lib/calculator";

const C = {
  page: "#111820",
  panel: "#27333B",
  panelDeep: "#1C272E",
  panelEdge: "#43515A",
  ivory: "#F0E8D7",
  ivoryTop: "#FFF9EB",
  mutedKey: "#D8D0C1",
  mutedTop: "#ECE6DA",
  ink: "#23313B",
  teal: "#8BD3BE",
  tealDeep: "#3B766A",
  display: "#DDE8DC",
  displayInk: "#20352C",
  displayMute: "#66786C",
};
const HISTORY_KEY = "faliz-calculator-history-v1";
const CREDITS: { label: string; url: string }[] = [
  { label: "Threads", url: "https://www.threads.com/@ard.sing" },
  { label: "Reddit", url: "https://www.reddit.com/u/gamesiteonline" },
  { label: "Instagram", url: "https://www.instagram.com/ard.sing" },
  {
    label: "WhatsApp channel",
    url: "https://whatsapp.com/channel/0029VbChyDUI1rcht5jajL3q",
  },
  {
    label: "YouTube",
    url: "https://youtube.com/@gamesiteonline?si=2qKZs5YUptHS6cTd",
  },
  { label: "Google Play Games", url: "https://my.play/gamesiteonline" },
];
type HistoryEntry = {
  id: string;
  expression: string;
  result: string;
  createdAt: number;
};
type KeyAction = "input" | "function" | "operator" | "utility" | "equals";
type KeyProps = {
  label: string;
  action?: KeyAction;
  small?: boolean;
  onPress: () => void;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  accessibilityLabel?: string;
};

function Key({
  label,
  action = "input",
  small,
  onPress,
  icon,
  accessibilityLabel,
}: KeyProps) {
  const equals = action === "equals",
    utility = action === "utility",
    fn = action === "function";
  const face = equals
    ? C.teal
    : utility
      ? C.mutedKey
      : fn
        ? C.panelDeep
        : C.ivory;
  const top = equals
    ? "#B5E7D6"
    : utility
      ? C.mutedTop
      : fn
        ? "#39464D"
        : C.ivoryTop;
  const color = equals ? "#142921" : fn ? "#D8E5DA" : C.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [
        s.keyShell,
        small && s.keySmall,
        { backgroundColor: equals ? "#28574F" : fn ? "#172229" : "#8D8A80" },
        pressed && s.keyPressed,
      ]}
    >
      <View
        style={[
          s.keyFace,
          { backgroundColor: face, borderTopColor: top },
          small && s.smallFace,
        ]}
      >
        {icon ? (
          <MaterialCommunityIcons
            name={icon}
            size={small ? 16 : 19}
            color={color}
          />
        ) : (
          <Text
            style={[
              s.keyText,
              small && s.smallKeyText,
              equals && s.equalsText,
              fn && s.functionText,
            ]}
          >
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
const displayExpression = (v: string) =>
  v.replace(/\*/g, " × ").replace(/\//g, " ÷ ").replace(/-/g, "−");

export default function FalizCalculator() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [expression, setExpression] = useState("");
  const [angle, setAngle] = useState<AngleMode>("DEG");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [lastAnswer, setLastAnswer] = useState("");
  const [lastCalculation, setLastCalculation] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(HISTORY_KEY)
      .then((raw) => {
        if (alive && raw) {
          try {
            setHistory(JSON.parse(raw) as HistoryEntry[]);
          } catch {
            setHistory([]);
          }
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (loaded)
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history)).catch(
        () => undefined,
      );
  }, [history, loaded]);
  const result = useMemo(() => {
    if (!expression) return "0";
    try {
      return formatResult(evaluateExpression(expression, angle));
    } catch {
      return "";
    }
  }, [expression, angle]);
  const keyHeight = Math.max(
    40,
    Math.min(54, (height - insets.top - insets.bottom - 430) / 5),
  );
  const sciHeight = Math.max(34, Math.min(43, keyHeight * 0.78));
  const tap = useCallback((fn: () => void) => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => undefined);
    fn();
  }, []);
  const append = useCallback((v: string) => {
    setError("");
    setExpression((current) => {
      if (/^[+*/^%!)]$/.test(v) && !current) return current;
      return current + v;
    });
  }, []);
  const add = (
    label: string,
    v = label,
    action: KeyAction = "input",
    small = false,
  ) => (
    <Key
      key={`${label}-${v}`}
      label={label}
      action={action}
      small={small}
      onPress={() => tap(() => append(v))}
    />
  );
  const calculate = useCallback(() => {
    if (!expression) return;
    try {
      const answer = formatResult(evaluateExpression(expression, angle));
      const item: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        expression,
        result: answer,
        createdAt: Date.now(),
      };
      setHistory((items) =>
        [
          item,
          ...items.filter(
            (entry) =>
              entry.expression !== expression || entry.result !== answer,
          ),
        ].slice(0, 40),
      );
      setLastAnswer(answer);
      setLastCalculation(expression);
      setExpression(answer);
      setError("");
      if (Platform.OS !== "web")
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => undefined);
      Keyboard.dismiss();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the expression");
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => undefined,
        );
    }
  }, [angle, expression]);
  const backspace = () => {
    setError("");
    setExpression((x) => x.slice(0, -1));
  };
  const clear = () => {
    setExpression("");
    setError("");
    setLastCalculation("");
  };
  const scientific: [string, string][] = [
    ["sin", "sin("],
    ["cos", "cos("],
    ["tan", "tan("],
    ["ln", "ln("],
    ["log", "log("],
    ["sin⁻¹", "asin("],
    ["cos⁻¹", "acos("],
    ["tan⁻¹", "atan("],
    ["√", "sqrt("],
    ["x²", "^2"],
    ["π", "π"],
    ["e", "e"],
    ["x!", "!"],
    ["1/x", "inv("],
    ["xʸ", "^"],
  ];
  const rows: [string, string, KeyAction?][][] = [
    [
      ["AC", "AC", "utility"],
      ["(", "(", "utility"],
      [")", ")", "utility"],
      ["%", "%", "utility"],
      ["÷", "/", "operator"],
    ],
    [
      ["7", "7"],
      ["8", "8"],
      ["9", "9"],
      ["⌫", "back", "utility"],
      ["×", "*", "operator"],
    ],
    [
      ["4", "4"],
      ["5", "5"],
      ["6", "6"],
      ["−", "-", "operator"],
      ["+", "+", "operator"],
    ],
    [
      ["1", "1"],
      ["2", "2"],
      ["3", "3"],
      ["xʸ", "^", "operator"],
      ["=", "equals", "equals"],
    ],
    [
      ["0", "0"],
      [".", "."],
      ["ANS", "ans", "utility"],
      ["×10ˣ", "*10^", "utility"],
      ["±", "sign", "utility"],
    ],
  ];
  const pressMain = (v: string) =>
    tap(() => {
      if (v === "AC") clear();
      else if (v === "back") backspace();
      else if (v === "sign") setExpression((x) => (x ? `-(${x})` : "-"));
      else if (v === "ans") append(lastAnswer || "0");
      else if (v === "equals") calculate();
      else append(v);
    });
  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" backgroundColor={C.page} />
      <View pointerEvents="none" style={s.ambientGlow} />
      <ScrollView
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.content,
          {
            paddingTop: Math.max(insets.top, 10) + 5,
            paddingBottom: Math.max(insets.bottom, 12) + 8,
          },
        ]}
      >
        <View style={s.header}>
          <View style={s.brandBlock}>
            <View style={s.brandMark}>
              <View style={s.brandMarkInset}>
                <Text style={s.brandGlyph}>ƒ</Text>
              </View>
            </View>
            <View>
              <Text style={s.brandName}>FALIZ</Text>
              <Text style={s.brandCaption}>PRECISION, MADE TACTILE</Text>
            </View>
          </View>
          <Pressable
            onPress={() => tap(() => setShowHistory(true))}
            style={({ pressed }) => [
              s.historyButton,
              pressed && { opacity: 0.75 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open calculation history"
          >
            <MaterialCommunityIcons name="history" size={19} color={C.teal} />
            <Text style={s.historyButtonText}>HISTORY</Text>
            {history.length > 0 && (
              <View style={s.historyCount}>
                <Text style={s.historyCountText}>
                  {history.length > 9 ? "9+" : history.length}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
        <View style={s.instrument}>
          <View style={s.instrumentRim}>
            <View style={s.instrumentInner}>
              <View style={s.displayTopline}>
                <View style={s.liveIndicator}>
                  <View style={s.liveDot} />
                  <Text style={s.displayLabel}>LIVE RESULT</Text>
                </View>
                <View style={s.modeBadge}>
                  <Text style={s.modeBadgeText}>{angle} ANGLE</Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  flexGrow: 1,
                  justifyContent: "flex-end",
                }}
              >
                <Text numberOfLines={1} style={s.expressionText}>
                  {expression ? displayExpression(expression) : "0"}
                </Text>
              </ScrollView>
              <View style={s.displayDivider} />
              <View style={s.resultLine}>
                <Text style={s.resultEquals}>＝</Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.62}
                  style={[s.resultText, error && s.errorResult]}
                >
                  {error ? "—" : result || "…"}
                </Text>
              </View>
              {!!lastCalculation && !error && (
                <Text numberOfLines={1} style={s.previousCalculation}>
                  {displayExpression(lastCalculation)} = {lastAnswer}
                </Text>
              )}
              {!!error && (
                <Text numberOfLines={1} style={s.errorHint}>
                  {error}
                </Text>
              )}
            </View>
          </View>
          <View style={s.displayFoot}>
            <View style={s.speakerLine} />
            <Text style={s.displayFootText}>FZ—01 · SCIENTIFIC INSTRUMENT</Text>
            <View style={s.speakerLine} />
          </View>
        </View>
        <View style={s.controlRail}>
          <View style={s.angleToggle}>
            {(["DEG", "RAD"] as AngleMode[]).map((m) => (
              <Pressable
                key={m}
                onPress={() => tap(() => setAngle(m))}
                accessibilityRole="button"
                accessibilityState={{ selected: m === angle }}
                style={[s.angleOption, m === angle && s.angleOptionActive]}
              >
                <Text
                  style={[
                    s.angleOptionText,
                    m === angle && s.angleOptionTextActive,
                  ]}
                >
                  {m}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.keyboardLabel}>SCIENTIFIC KEYBOARD</Text>
          <Pressable
            onPress={() => tap(() => append(lastAnswer || "0"))}
            accessibilityRole="button"
            accessibilityLabel="Insert previous answer"
            style={s.ansPill}
          >
            <Text style={s.ansPillText}>ANS</Text>
          </Pressable>
        </View>
        <View style={s.keypad}>
          {[0, 1, 2].map((row) => (
            <View key={`sci-${row}`} style={[s.keyRow, { height: sciHeight }]}>
              {scientific
                .slice(row * 5, row * 5 + 5)
                .map(([label, value]) => add(label, value, "function", true))}
            </View>
          ))}
          {rows.map((row, rowIndex) => (
            <View
              key={`row-${rowIndex}`}
              style={[s.keyRow, s.mainRow, { height: keyHeight }]}
            >
              {row.map(([label, value, action = "input"], index) => (
                <Key
                  key={`${label}-${index}`}
                  label={label}
                  action={action}
                  icon={value === "back" ? "backspace-outline" : undefined}
                  accessibilityLabel={
                    value === "back"
                      ? "Delete last character"
                      : value === "sign"
                        ? "Toggle sign"
                        : value === "equals"
                          ? "Calculate result"
                          : undefined
                  }
                  onPress={() => pressMain(value)}
                />
              ))}
            </View>
          ))}
        </View>
        <Pressable
          style={s.footer}
          onPress={() => setShowCredits(true)}
          accessibilityRole="button"
          accessibilityLabel="Open credits and social links"
        >
          <View style={s.footerLine} />
          <Text style={s.footerText}>CREDITS & LINKS</Text>
          <View style={s.footerLine} />
        </Pressable>
      </ScrollView>
      <Modal
        visible={showHistory}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={s.modalRoot}>
          <Pressable
            onPress={() => setShowHistory(false)}
            style={s.modalScrim}
            accessibilityRole="button"
            accessibilityLabel="Close history"
          />
          <View
            style={[
              s.historySheet,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>Calculation history</Text>
                <Text style={s.sheetSubtitle}>
                  Your recent work, ready to pick up again.
                </Text>
              </View>
              <Pressable
                style={s.sheetClose}
                onPress={() => setShowHistory(false)}
                accessibilityRole="button"
                accessibilityLabel="Close history"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={C.ivory}
                />
              </Pressable>
            </View>
            {history.length === 0 ? (
              <View style={s.emptyHistory}>
                <View style={s.emptyIcon}>
                  <MaterialCommunityIcons
                    name="history"
                    size={25}
                    color={C.teal}
                  />
                </View>
                <Text style={s.emptyTitle}>Nothing calculated yet</Text>
                <Text style={s.emptyHint}>
                  Your completed calculations will appear here.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={s.historyList}
                showsVerticalScrollIndicator={false}
              >
                {history.map((entry, i) => (
                  <Pressable
                    key={entry.id}
                    onPress={() => {
                      setExpression(entry.expression);
                      setLastCalculation(entry.expression);
                      setLastAnswer(entry.result);
                      setError("");
                      setShowHistory(false);
                    }}
                    style={({ pressed }) => [
                      s.historyRow,
                      i === 0 && s.historyFirstRow,
                      pressed && { opacity: 0.7 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Reuse ${entry.expression}, result ${entry.result}`}
                  >
                    <View style={s.historyCopy}>
                      <Text numberOfLines={1} style={s.historyExpression}>
                        {displayExpression(entry.expression)}
                      </Text>
                      <Text style={s.historyDate}>
                        {new Date(entry.createdAt).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric" },
                        )}
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={s.historyResult}>
                      {entry.result}
                    </Text>
                    <MaterialCommunityIcons
                      name="arrow-up-left"
                      size={16}
                      color={C.teal}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {history.length > 0 && (
              <Pressable
                onPress={() => setHistory([])}
                style={s.clearHistory}
                accessibilityRole="button"
              >
                <Text style={s.clearHistoryText}>CLEAR HISTORY</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
      <Modal
        visible={showCredits}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCredits(false)}
      >
        <View style={s.modalRoot}>
          <Pressable
            onPress={() => setShowCredits(false)}
            style={s.modalScrim}
            accessibilityRole="button"
            accessibilityLabel="Close credits"
          />
          <View
            style={[
              s.historySheet,
              s.creditsSheet,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>Credits & links</Text>
                <Text style={s.sheetSubtitle}>
                  Connect with GamesiteOnline.
                </Text>
              </View>
              <Pressable
                style={s.sheetClose}
                onPress={() => setShowCredits(false)}
                accessibilityRole="button"
                accessibilityLabel="Close credits"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={C.ivory}
                />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CREDITS.map(({ label, url }) => (
                <Pressable
                  key={label}
                  onPress={() =>
                    void Linking.openURL(url).catch(() => undefined)
                  }
                  style={({ pressed }) => [
                    s.creditRow,
                    pressed && { opacity: 0.72 },
                  ]}
                  accessibilityRole="link"
                  accessibilityLabel={`${label}: ${url}`}
                >
                  <View style={s.creditIcon}>
                    <MaterialCommunityIcons
                      name="link-variant"
                      size={17}
                      color={C.teal}
                    />
                  </View>
                  <View style={s.creditCopy}>
                    <Text style={s.creditLabel}>{label}</Text>
                    <Text numberOfLines={1} style={s.creditUrl}>
                      {url}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="open-in-new"
                    size={16}
                    color="#93A69A"
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.page },
  ambientGlow: {
    position: "absolute",
    top: -180,
    left: -90,
    width: 430,
    height: 440,
    borderRadius: 220,
    backgroundColor: "#1C2C31",
    opacity: 0.58,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    maxWidth: 560,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    minHeight: 53,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 9,
  },
  brandBlock: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: {
    width: 37,
    height: 37,
    borderRadius: 12,
    backgroundColor: "#172128",
    borderTopWidth: 1.5,
    borderColor: "#46565A",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.36,
    shadowRadius: 3,
    elevation: 4,
  },
  brandMarkInset: {
    width: 27,
    height: 27,
    borderRadius: 9,
    backgroundColor: "#2A3B3D",
    borderWidth: 1,
    borderColor: "#52635E",
    alignItems: "center",
    justifyContent: "center",
  },
  brandGlyph: {
    color: C.teal,
    fontFamily: "Georgia",
    fontSize: 22,
    fontWeight: "700",
    marginTop: -2,
  },
  brandName: {
    color: "#F3EBDD",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 2.7,
  },
  brandCaption: {
    color: "#81918B",
    fontSize: 8,
    letterSpacing: 1.05,
    marginTop: 2,
  },
  historyButton: {
    height: 37,
    minWidth: 96,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: C.panel,
    borderTopWidth: 1,
    borderTopColor: C.panelEdge,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  historyButtonText: {
    fontSize: 9,
    letterSpacing: 1,
    color: "#DAE2DC",
    fontWeight: "700",
  },
  historyCount: {
    borderRadius: 9,
    backgroundColor: C.tealDeep,
    paddingHorizontal: 4,
    minWidth: 16,
    alignItems: "center",
  },
  historyCountText: { fontSize: 9, color: "#F3F1E8", fontWeight: "700" },
  instrument: { marginBottom: 8 },
  instrumentRim: {
    borderRadius: 20,
    padding: 5,
    backgroundColor: "#131C21",
    borderWidth: 1.5,
    borderColor: "#4C595B",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 8,
  },
  instrumentInner: {
    minHeight: 190,
    borderRadius: 15,
    backgroundColor: C.display,
    paddingHorizontal: 15,
    paddingTop: 16,
    paddingBottom: 14,
    borderTopWidth: 1.5,
    borderTopColor: "#F2F5E8",
    borderLeftWidth: 1,
    borderLeftColor: "#E7EDE0",
    overflow: "hidden",
  },
  displayTopline: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  liveIndicator: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#5F9879" },
  displayLabel: {
    color: C.displayMute,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.35,
  },
  modeBadge: {
    backgroundColor: "rgba(48,76,59,.09)",
    borderRadius: 5,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  modeBadgeText: {
    color: C.displayMute,
    fontSize: 7,
    letterSpacing: 1,
    fontWeight: "700",
  },
  expressionText: {
    minWidth: "100%",
    textAlign: "right",
    color: "#536A5B",
    fontSize: 19,
    fontWeight: "500",
    letterSpacing: 0.15,
    paddingVertical: 2,
  },
  displayDivider: {
    height: 1,
    backgroundColor: "rgba(33,48,43,.15)",
    marginVertical: 4,
  },
  resultLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  resultEquals: { color: "#759183", fontSize: 16 },
  resultText: {
    color: C.displayInk,
    fontSize: 42,
    fontWeight: "600",
    letterSpacing: -0.7,
    flexShrink: 1,
    textAlign: "right",
  },
  errorResult: { color: "#A15F4E" },
  previousCalculation: {
    color: "#708075",
    fontSize: 9,
    textAlign: "right",
    marginTop: 1,
  },
  errorHint: {
    color: "#A15F4E",
    fontSize: 9,
    textAlign: "right",
    marginTop: 1,
  },
  displayFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingTop: 6,
  },
  speakerLine: {
    width: 20,
    height: 2,
    borderRadius: 2,
    backgroundColor: "#354149",
  },
  displayFootText: {
    color: "#79877F",
    fontSize: 7,
    letterSpacing: 1.6,
    fontWeight: "600",
  },
  controlRail: {
    height: 37,
    borderRadius: 11,
    backgroundColor: "#202C32",
    borderTopWidth: 1,
    borderTopColor: "#3A484C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    marginBottom: 7,
  },
  angleToggle: {
    flexDirection: "row",
    padding: 3,
    gap: 2,
    borderRadius: 8,
    backgroundColor: "#151F24",
  },
  angleOption: {
    minWidth: 34,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
  },
  angleOptionActive: {
    backgroundColor: "#44564F",
    borderTopWidth: 1,
    borderTopColor: "#708179",
  },
  angleOptionText: {
    color: "#7B8983",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  angleOptionTextActive: { color: "#DCE9DD" },
  keyboardLabel: {
    color: "#98A69E",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.65,
  },
  ansPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: "#34443F",
    borderTopWidth: 1,
    borderTopColor: "#65766B",
  },
  ansPillText: {
    color: "#BFD9CB",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },
  keypad: { gap: 6 },
  keyRow: { flexDirection: "row", gap: 7 },
  mainRow: { marginTop: 2 },
  keyShell: {
    flex: 1,
    minWidth: 0,
    borderRadius: 13,
    paddingBottom: 3,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.24,
    shadowRadius: 2,
    elevation: 3,
  },
  keySmall: { borderRadius: 9, paddingBottom: 2 },
  keyFace: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderTopWidth: 2,
    borderLeftWidth: 0.6,
    borderLeftColor: "rgba(255,255,255,.55)",
  },
  smallFace: { borderRadius: 8, borderTopWidth: 1.5 },
  keyPressed: {
    transform: [{ translateY: 2 }],
    paddingBottom: 0,
    opacity: 0.95,
  },
  keyText: {
    color: C.ink,
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  smallKeyText: { fontSize: 12, fontWeight: "600" },
  equalsText: { fontSize: 25, fontWeight: "700" },
  functionText: { color: "#D5DED7", fontSize: 11, fontWeight: "600" },
  footer: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 3,
  },
  footerLine: { height: 1, width: 30, backgroundColor: "#39454A" },
  footerText: {
    fontSize: 7,
    color: "#74817B",
    letterSpacing: 1.8,
    fontWeight: "600",
  },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(6,11,14,.64)",
  },
  historySheet: {
    maxHeight: "79%",
    minHeight: 300,
    borderTopLeftRadius: 27,
    borderTopRightRadius: 27,
    backgroundColor: "#202C32",
    borderTopWidth: 1,
    borderColor: "#53605E",
    paddingHorizontal: 21,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 14,
  },
  creditsSheet: { maxHeight: "86%" },
  sheetHandle: {
    alignSelf: "center",
    width: 39,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#61706C",
    marginBottom: 18,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 17,
  },
  sheetTitle: {
    color: "#F2EBDD",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  sheetSubtitle: { color: "#9AA8A0", fontSize: 11, marginTop: 4 },
  creditRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderTopWidth: 1,
    borderColor: "rgba(210,220,208,.1)",
    paddingVertical: 8,
  },
  creditIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#34443F",
    borderTopWidth: 1,
    borderColor: "#52645B",
  },
  creditCopy: { flex: 1, minWidth: 0 },
  creditLabel: { color: "#E7E3D8", fontSize: 12, fontWeight: "700" },
  creditUrl: { color: "#94A49B", fontSize: 9, marginTop: 3 },
  sheetClose: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: "#334047",
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
    borderColor: "#51605F",
  },
  historyList: { flexGrow: 0, marginBottom: 11 },
  historyRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderTopWidth: 1,
    borderColor: "rgba(210,220,208,.1)",
    paddingVertical: 9,
  },
  historyFirstRow: { borderTopWidth: 0 },
  historyCopy: { flex: 1, minWidth: 0 },
  historyExpression: { color: "#C7D0C9", fontSize: 13 },
  historyDate: { color: "#829087", fontSize: 9, marginTop: 3 },
  historyResult: {
    color: C.teal,
    fontSize: 16,
    fontWeight: "600",
    maxWidth: "36%",
  },
  clearHistory: {
    height: 41,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#354249",
    borderTopWidth: 1,
    borderColor: "#50605D",
  },
  clearHistoryText: {
    color: "#E0B692",
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  emptyHistory: {
    flex: 1,
    minHeight: 175,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#34443F",
    borderTopWidth: 1,
    borderColor: "#5A6B61",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { color: "#EEE7D9", fontSize: 15, fontWeight: "600" },
  emptyHint: {
    color: "#99A69F",
    fontSize: 11,
    textAlign: "center",
    marginTop: 5,
  },
});
