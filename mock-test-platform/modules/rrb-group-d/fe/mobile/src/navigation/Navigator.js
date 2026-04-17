import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen   from "../screens/HomeScreen.js";
import ExamScreen   from "../screens/ExamScreen.js";
import ResultScreen from "../screens/ResultScreen.js";

const Stack = createNativeStackNavigator();

export default function RRBNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="Home"   component={HomeScreen} />
      <Stack.Screen name="Exam"   component={ExamScreen}   options={{ gestureEnabled: false }} />
      <Stack.Screen name="Result" component={ResultScreen} options={{ gestureEnabled: false }} />
    </Stack.Navigator>
  );
}
