import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import RRBNavigator from "./src/navigation/Navigator.js";

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RRBNavigator />
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
