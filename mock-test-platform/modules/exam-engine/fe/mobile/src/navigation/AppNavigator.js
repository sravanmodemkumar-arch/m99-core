import React, { useState, useEffect } from "react";
import { NavigationContainer }          from "@react-navigation/native";
import { createStackNavigator }         from "@react-navigation/stack";
import AsyncStorage                     from "@react-native-async-storage/async-storage";
import { ActivityIndicator, View }      from "react-native";

import LoginScreen    from "../screens/LoginScreen";
import HomeScreen     from "../screens/HomeScreen";
import ExamScreen     from "../screens/ExamScreen";
import ResultScreen   from "../screens/ResultScreen";
import AnalysisScreen from "../screens/AnalysisScreen";

const Stack = createStackNavigator();

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState(null); // null = loading

  useEffect(() => {
    AsyncStorage.getItem("auth_token").then(token => {
      setInitialRoute(token ? "Home" : "Login");
    });
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex:1, justifyContent:"center", alignItems:"center", backgroundColor:"#f0f2f7" }}>
        <ActivityIndicator size="large" color="#1565c0" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
        <Stack.Screen name="Login"    component={LoginScreen}    />
        <Stack.Screen name="Home"     component={HomeScreen}     />
        <Stack.Screen name="Exam"     component={ExamScreen}     />
        <Stack.Screen name="Result"   component={ResultScreen}   />
        <Stack.Screen name="Analysis" component={AnalysisScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
