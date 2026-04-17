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
        {/* RRB Group D flow — RRBHomeScreen navigates here with moduleId="rrb-group-d" */}
        <Stack.Screen name="RRBExam"        component={GDHomeScreen}     />
        <Stack.Screen name="Exam"           component={GDExamScreen}     />
        <Stack.Screen name="Result"         component={GDResultScreen}   />
        <Stack.Screen name="Analysis"       component={GDAnalysisScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
