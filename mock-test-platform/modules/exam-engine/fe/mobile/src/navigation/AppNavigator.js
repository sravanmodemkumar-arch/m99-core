import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";

import ExamScreen     from "../screens/ExamScreen";
import ResultScreen   from "../screens/ResultScreen";
import AnalysisScreen from "../screens/AnalysisScreen";

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Exam">
        <Stack.Screen name="Exam"     component={ExamScreen}     />
        <Stack.Screen name="Result"   component={ResultScreen}   />
        <Stack.Screen name="Analysis" component={AnalysisScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
