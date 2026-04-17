import React, { useState, useEffect } from "react";
import { NavigationContainer }         from "@react-navigation/native";
import { createStackNavigator }        from "@react-navigation/stack";
import AsyncStorage                    from "@react-native-async-storage/async-storage";
import { ActivityIndicator, View }     from "react-native";

import LoginScreen    from "../../../../../../../exam-engine/fe/mobile/src/screens/LoginScreen";
import HomeScreen     from "../screens/HomeScreen";
import ExamScreen     from "../screens/ExamScreen";
import ResultScreen   from "../screens/ResultScreen";
import AnalysisScreen from "../screens/AnalysisScreen";

const Stack = createStackNavigator();

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem("auth_token").then(token => {
      setInitialRoute(token ? "RRBNTPCHome" : "Login");
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
        <Stack.Screen name="Login"          component={LoginScreen}    />
        <Stack.Screen name="RRBNTPCHome"  component={HomeScreen}     />
        <Stack.Screen name="NTPCExam"           component={ExamScreen}     />
        <Stack.Screen name="NTPCResult"         component={ResultScreen}   />
        <Stack.Screen name="NTPCAnalysis"       component={AnalysisScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
