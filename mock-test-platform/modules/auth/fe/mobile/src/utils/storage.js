import AsyncStorage from "@react-native-async-storage/async-storage";

export const Storage = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, String(value)),
  remove: (key) => AsyncStorage.removeItem(key),
  clear: () => AsyncStorage.clear(),
  getJson: async (key) => {
    const v = await AsyncStorage.getItem(key);
    try { return v ? JSON.parse(v) : null; } catch { return null; }
  },
  setJson: (key, value) => AsyncStorage.setItem(key, JSON.stringify(value)),
};
