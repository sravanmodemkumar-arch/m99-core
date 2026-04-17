import React, { useState, useEffect } from "react";
import { NavigationContainer }         from "@react-navigation/native";
import { createStackNavigator }        from "@react-navigation/stack";
import AsyncStorage                    from "@react-native-async-storage/async-storage";
import { ActivityIndicator, View }     from "react-native";

import LoginScreen    from "../../../../../../exam-engine/fe/mobile/src/screens/LoginScreen";
import RRBHomeScreen  from "../screens/RRBHomeScreen";

// RRB Group D screens
import GDHomeScreen     from "../../../../../rrb-group-d/fe/mobile/src/screens/HomeScreen";
import GDExamScreen     from "../../../../../rrb-group-d/fe/mobile/src/screens/ExamScreen";
import GDResultScreen   from "../../../../../rrb-group-d/fe/mobile/src/screens/ResultScreen";
import GDAnalysisScreen from "../../../../../rrb-group-d/fe/mobile/src/screens/AnalysisScreen";

// RRB NTPC screens
import NTPCHomeScreen     from "../../../../../rrb-ntpc/fe/mobile/src/screens/HomeScreen";
import NTPCExamScreen     from "../../../../../rrb-ntpc/fe/mobile/src/screens/ExamScreen";
import NTPCResultScreen   from "../../../../../rrb-ntpc/fe/mobile/src/screens/ResultScreen";
import NTPCAnalysisScreen from "../../../../../rrb-ntpc/fe/mobile/src/screens/AnalysisScreen";

const Stack = createStackNavigator();

export default function RRBNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem("auth_token").then(token => {
      setInitialRoute(token ? "RRBHome" : "Login");
    });
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f0f4f8" }}>
        <ActivityIndicator size="large" color="#0d47a1" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
        <Stack.Screen name="Login"          component={LoginScreen}      />
        <Stack.Screen name="RRBHome"        component={RRBHomeScreen}    />
        {/* Group D flow */}
        <Stack.Screen name="RRBGroupDHome"  component={GDHomeScreen}     />
        <Stack.Screen name="Exam"           component={GDExamScreen}     />
        <Stack.Screen name="Result"         component={GDResultScreen}   />
        <Stack.Screen name="Analysis"       component={GDAnalysisScreen} />
        {/* NTPC flow */}
        <Stack.Screen name="RRBNTPCHome"    component={NTPCHomeScreen}     />
        <Stack.Screen name="NTPCExam"       component={NTPCExamScreen}     />
        <Stack.Screen name="NTPCResult"     component={NTPCResultScreen}   />
        <Stack.Screen name="NTPCAnalysis"   component={NTPCAnalysisScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
