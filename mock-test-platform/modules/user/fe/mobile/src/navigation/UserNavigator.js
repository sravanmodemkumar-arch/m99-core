import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, ActivityIndicator } from "react-native";

import ProfileScreen      from "../screens/ProfileScreen";
import HistoryScreen      from "../screens/HistoryScreen";
import AnalyticsScreen    from "../screens/AnalyticsScreen";
import SubscriptionScreen from "../screens/SubscriptionScreen";

// Auth module login screen (shared OTP flow)
import LoginScreen from "../../../../../../auth/fe/mobile/src/screens/LoginScreen";

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNav() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   "#1a237e",
        tabBarInactiveTintColor: "#8a9ab7",
        tabBarStyle: { borderTopColor: "#e0e4ed" },
        tabBarLabel: route.name,
        tabBarIcon: ({ color, size }) => {
          const icons = { Profile:"👤", History:"📋", Analytics:"📊", Plan:"🎟️" };
          return <View style={{ opacity: color === "#1a237e" ? 1 : 0.5 }}>
            <ActivityIndicator style={{ display: "none" }} />
            {/* emoji icons */}
          </View>;
        },
      })}
    >
      <Tab.Screen name="Profile"    component={ProfileScreen}
        options={{ tabBarIcon: () => null, tabBarLabel: "👤 Profile" }} />
      <Tab.Screen name="History"    component={HistoryScreen}
        options={{ tabBarIcon: () => null, tabBarLabel: "📋 History" }} />
      <Tab.Screen name="Analytics"  component={AnalyticsScreen}
        options={{ tabBarIcon: () => null, tabBarLabel: "📊 Analytics" }} />
      <Tab.Screen name="Plan"       component={SubscriptionScreen}
        options={{ tabBarIcon: () => null, tabBarLabel: "🎟️ Plan" }} />
    </Tab.Navigator>
  );
}

export default function UserNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem("auth_token").then(token =>
      setInitialRoute(token ? "Main" : "Login")
    );
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#1a237e" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main"  component={TabNav} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
