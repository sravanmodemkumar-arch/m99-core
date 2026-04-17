import React from "react";
import { StatusBar } from "expo-status-bar";
import AdminNavigator from "./src/navigation/AdminNavigator";

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <AdminNavigator />
    </>
  );
}
