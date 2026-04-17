import React from "react";
import { StatusBar } from "expo-status-bar";
import RRBNavigator from "./src/navigation/RRBNavigator";

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <RRBNavigator />
    </>
  );
}
