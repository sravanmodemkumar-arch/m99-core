import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen   from "../screens/HomeScreen.js";
import ExamScreen   from "../screens/ExamScreen.js";
import ResultScreen from "../screens/ResultScreen.js";

export type RRBStackParamList = {
  Home:   undefined;
  Exam:   { examId: string };
  Result: {
    sessionId: string;
    score: number;
    correct: number;
    wrong: number;
    skipped: number;
    total: number;
    pct: number;
    answerKey: Record<string, string>;
    responses: Record<string, { chosen: string | null; attempted: boolean }>;
    sections: Record<string, { correct: number; wrong: number; skipped: number; rawScaled: number }>;
    elapsed: number;
  };
};

const Stack = createNativeStackNavigator<RRBStackParamList>();

export default function RRBNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="Home"   component={HomeScreen} />
      <Stack.Screen name="Exam"   component={ExamScreen}   options={{ gestureEnabled: false }} />
      <Stack.Screen name="Result" component={ResultScreen} options={{ gestureEnabled: false }} />
    </Stack.Navigator>
  );
}
