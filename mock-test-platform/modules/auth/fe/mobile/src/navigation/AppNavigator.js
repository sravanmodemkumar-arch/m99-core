import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import SplashScreen from "../screens/SplashScreen.js";
import WelcomeScreen from "../screens/WelcomeScreen.js";
import LandingScreen from "../screens/LandingScreen.js";
import LoginScreen from "../screens/LoginScreen.js";
import Register1Screen from "../screens/Register1Screen.js";
import Register2Screen from "../screens/Register2Screen.js";
import Register3Screen from "../screens/Register3Screen.js";
import SocialCompleteScreen from "../screens/SocialCompleteScreen.js";
import FirstLoginScreen from "../screens/FirstLoginScreen.js";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen.js";
import HomeScreen from "../screens/HomeScreen.js";
import ProfileScreen from "../screens/ProfileScreen.js";
import EditProfileScreen from "../screens/EditProfileScreen.js";
import SecurityScreen from "../screens/SecurityScreen.js";
import DeleteAccountScreen from "../screens/DeleteAccountScreen.js";
import SettingsScreen from "../screens/SettingsScreen.js";
import SubscriptionsScreen from "../screens/SubscriptionsScreen.js";
import HelpScreen from "../screens/HelpScreen.js";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register1" component={Register1Screen} />
        <Stack.Screen name="Register2" component={Register2Screen} />
        <Stack.Screen name="Register3" component={Register3Screen} />
        <Stack.Screen name="SocialComplete" component={SocialCompleteScreen} />
        <Stack.Screen name="FirstLogin" component={FirstLoginScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Security" component={SecurityScreen} />
        <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Subscriptions" component={SubscriptionsScreen} />
        <Stack.Screen name="Help" component={HelpScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
