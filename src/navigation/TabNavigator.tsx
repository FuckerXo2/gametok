import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeScreen } from '../screens/HomeScreen';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { InboxScreen } from '../screens/InboxScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

// Custom center button (Create/Plus button)
const CreateButton: React.FC<{ onPress: () => void }> = ({ onPress }) => (
  <TouchableOpacity style={styles.createButton} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.createButtonInner}>
      <View style={styles.createButtonLeft} />
      <View style={styles.createButtonRight} />
      <View style={styles.createButtonCenter}>
        <Ionicons name="add" size={28} color="#000" />
      </View>
    </View>
  </TouchableOpacity>
);

// Placeholder screen for Create
const CreateScreen = () => (
  <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ color: '#fff', fontSize: 18 }}>Create Game Session</Text>
  </View>
);

export const TabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#000',
          borderTopWidth: 0.5,
          borderTopColor: '#222',
          height: 50 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#888',
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Create"
        component={CreateScreen}
        options={{
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <CreateButton onPress={() => props.onPress?.(undefined as any)} />
          ),
        }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  createButton: {
    top: -8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonInner: {
    width: 48,
    height: 32,
    position: 'relative',
  },
  createButtonLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 26,
    backgroundColor: '#25F4EE',
    borderRadius: 8,
  },
  createButtonRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 26,
    backgroundColor: '#FF8E53',
    borderRadius: 8,
  },
  createButtonCenter: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
