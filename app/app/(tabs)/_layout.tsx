import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
    const scale = useSharedValue(focused ? 1.15 : 1);
    const translateY = useSharedValue(focused ? -2 : 0);

    React.useEffect(() => {
        scale.value = withSpring(focused ? 1.15 : 1, { damping: 12, stiffness: 200 });
        translateY.value = withSpring(focused ? -2 : 0, { damping: 12, stiffness: 200 });
    }, [focused]);

    const animStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { translateY: translateY.value },
        ],
    }));

    return (
        <Animated.View style={[styles.iconWrap, animStyle]}>
            <Text style={styles.iconEmoji}>{emoji}</Text>
            {focused && <View style={styles.activeDot} />}
        </Animated.View>
    );
}

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#0056D2',
                tabBarInactiveTintColor: '#9CA3AF',
                tabBarStyle: styles.tabBar,
                tabBarLabelStyle: styles.tabLabel,
                animation: 'shift',
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="pass"
                options={{
                    title: 'Pass',
                    tabBarIcon: ({ focused }) => <TabIcon emoji="🎫" focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="history"
                options={{
                    title: 'History',
                    tabBarIcon: ({ focused }) => <TabIcon emoji="🕐" focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 0,
        height: Platform.OS === 'ios' ? 88 : 68,
        paddingTop: 8,
        paddingBottom: Platform.OS === 'ios' ? 28 : 10,
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
    },
    tabLabel: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
    iconWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconEmoji: {
        fontSize: 22,
    },
    activeDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#0056D2',
        marginTop: 3,
    },
});
