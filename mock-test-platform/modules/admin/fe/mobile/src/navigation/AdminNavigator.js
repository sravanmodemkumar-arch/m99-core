import React, { useState, useEffect } from "react";
import { NavigationContainer }          from "@react-navigation/native";
import { createStackNavigator }         from "@react-navigation/stack";
import { createBottomTabNavigator }     from "@react-navigation/bottom-tabs";
import AsyncStorage                     from "@react-native-async-storage/async-storage";
import { ActivityIndicator, View, Text } from "react-native";

import LoginScreen         from "../screens/LoginScreen";
import DashboardScreen     from "../screens/DashboardScreen";
import ExamsScreen         from "../screens/ExamsScreen";
import QuestionsScreen     from "../screens/QuestionsScreen";
import UsersScreen         from "../screens/UsersScreen";
import SubscriptionsScreen from "../screens/SubscriptionsScreen";
import ReportsScreen       from "../screens/ReportsScreen";

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

function TabIcon({ label, active }) {
  const icons = { Dashboard:"📊", Exams:"📝", Questions:"❓", Users:"👥", More:"⚙️" };
  return <Text style={{ fontSize: active ? 20 : 18, opacity: active ? 1 : 0.55 }}>{icons[label] || "•"}</Text>;
}

function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown:   false,
        tabBarStyle:   { backgroundColor: "#1a237e", borderTopColor: "#283593", height: 60 },
        tabBarLabelStyle: { color: "#fff", fontSize: 10, fontWeight: "700", marginBottom: 4 },
        tabBarActiveTintColor:   "#fff",
        tabBarInactiveTintColor: "rgba(255,255,255,0.5)",
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} active={focused} />,
      })}
    >
      <Tab.Screen name="Dashboard"   component={DashboardScreen}     />
      <Tab.Screen name="Exams"       component={ExamsScreen}         />
      <Tab.Screen name="Questions"   component={QuestionsScreen}     />
      <Tab.Screen name="Users"       component={UsersScreen}         />
      <Tab.Screen name="More"        component={SubscriptionsScreen} />
    </Tab.Navigator>
  );
}

export default function AdminNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem("admin_token").then(t => setInitialRoute(t ? "Main" : "Login"));
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1a237e" }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main"  component={AdminTabs}   />
        <Stack.Screen name="Reports" component={ReportsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
