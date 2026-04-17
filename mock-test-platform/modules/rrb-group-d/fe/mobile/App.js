import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { initApi } from "./src/utils/api.js";
import RRBNavigator from "./src/navigation/Navigator.js";

initApi(() => AsyncStorage.getItem("token"));

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer>
        <RRBNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
