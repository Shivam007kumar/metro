import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
    const scale = useSharedValue(focused ? 1.15 : 1);
    const translateY = useSharedValue(focused ? -2 : 0);
    const dotOpacity = useSharedValue(focused ? 1 : 0);

    React.useEffect(() => {
        scale.value = withSpring(focused ? 1.15 : 1, { damping: 14, stiffness: 180 });
        translateY.value = withSpring(focused ? -2 : 0, { damping: 14, stiffness: 180 });
        dotOpacity.value = withTiming(focused ? 1 : 0, { duration: 250 });
    }, [focused]);

    const iconStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { translateY: translateY.value },
        ],
    }));

    const dotStyle = useAnimatedStyle(() => ({
        opacity: dotOpacity.value,
    }));

    return (
        <Animated.View style={[styles.iconWrap, iconStyle]}>
            <Text style={styles.iconEmoji}>{emoji}</Text>
            <Animated.View style={[styles.activeDot, dotStyle]} />
        </Animated.View>
    );
}

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#2563EB',
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
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#2563EB',
        marginTop: 3,
    },
});
