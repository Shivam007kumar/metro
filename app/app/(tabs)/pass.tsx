import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    FadeInDown,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import useUserStore from '../../src/store/userStore';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function PassScreen() {
    const { user, profile, refreshProfile } = useUserStore();

    const fullName = profile?.full_name || user?.user_metadata?.full_name || 'Unknown User';
    const cypherId = profile?.cypher_id || 'NOT ENROLLED';
    const balance = profile?.wallet_balance ?? 0;
    const isEnrolled = profile?.is_enrolled || false;

    // Reanimated shared values for pulse
    const pulseScale = useSharedValue(1);
    const pulseOpacity = useSharedValue(0.6);
    const cardScale = useSharedValue(0.95);

    useFocusEffect(
        useCallback(() => {
            refreshProfile();
        }, [])
    );

    useEffect(() => {
        // Continuous pulse animation
        pulseScale.value = withRepeat(
            withSequence(
                withTiming(1.4, { duration: 1200, easing: Easing.out(Easing.ease) }),
                withTiming(1, { duration: 1200, easing: Easing.in(Easing.ease) })
            ),
            -1,
            false
        );
        pulseOpacity.value = withRepeat(
            withSequence(
                withTiming(0, { duration: 1200, easing: Easing.out(Easing.ease) }),
                withTiming(0.6, { duration: 1200, easing: Easing.in(Easing.ease) })
            ),
            -1,
            false
        );

        // Card entrance bounce
        cardScale.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.5)) });
    }, [isEnrolled]);

    const pulseAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
        opacity: pulseOpacity.value,
    }));

    const cardAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: cardScale.value }],
    }));

    const copyCypherId = async () => {
        if (!isEnrolled) {
            Alert.alert('Not Enrolled', 'Complete face enrollment first to get your Metro ID.');
            return;
        }
        try {
            await Clipboard.setStringAsync(cypherId);
            Alert.alert('Copied!', 'CypherID copied to clipboard for nRF Connect');
        } catch {
            Alert.alert('Copy', cypherId);
        }
    };

    const statusColor = isEnrolled ? '#10B981' : '#F59E0B';
    const statusBg = isEnrolled ? '#ECFDF5' : '#FEF3C7';
    const statusTextColor = isEnrolled ? '#059669' : '#D97706';

    return (
        <SafeAreaView style={styles.container}>
            <Animated.Text
                entering={FadeIn.delay(100).duration(400)}
                style={styles.header}
            >
                Digital Pass
            </Animated.Text>

            <Animated.View style={[styles.card, cardAnimStyle]}>
                {/* Status Pulse — smooth reanimated */}
                <Animated.View
                    entering={FadeInDown.delay(200).duration(500)}
                    style={styles.statusContainer}
                >
                    <Animated.View style={[styles.pulse, pulseAnimStyle, {
                        backgroundColor: isEnrolled ? 'rgba(52, 211, 153, 0.25)' : 'rgba(251, 191, 36, 0.25)',
                    }]} />
                    <Animated.View style={[styles.dotOuter, {
                        backgroundColor: isEnrolled ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                    }]}>
                        <View style={[styles.dot, {
                            backgroundColor: statusColor,
                            shadowColor: statusColor,
                        }]} />
                    </Animated.View>
                </Animated.View>

                <Animated.Text
                    entering={FadeIn.delay(400).duration(400)}
                    style={[styles.statusText, {
                        color: statusTextColor,
                        backgroundColor: statusBg,
                    }]}
                >
                    {isEnrolled ? 'ACTIVE' : 'PENDING ENROLLMENT'}
                </Animated.Text>

                <Animated.Text
                    entering={FadeInUp.delay(500).duration(400)}
                    style={styles.name}
                >
                    {fullName}
                </Animated.Text>

                {/* CypherID — Tappable to copy */}
                <AnimatedTouchable
                    entering={FadeInUp.delay(600).duration(400)}
                    onPress={copyCypherId}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.token, !isEnrolled && styles.tokenPending]}>
                        {isEnrolled ? cypherId : '— ENROLL TO GET ID —'}
                    </Text>
                </AnimatedTouchable>

                {isEnrolled && (
                    <Animated.Text
                        entering={FadeIn.delay(700).duration(300)}
                        style={styles.simulationHint}
                    >
                        Tap ID above to copy → paste in nRF Connect
                    </Animated.Text>
                )}

                {/* Wallet */}
                <Animated.View
                    entering={FadeInUp.delay(750).duration(500)}
                    style={styles.walletContainer}
                >
                    <Text style={styles.walletLabel}>WALLET BALANCE</Text>
                    <Text style={styles.walletAmount}>₹{Number(balance).toFixed(2)}</Text>
                </Animated.View>

                <Animated.Text
                    entering={FadeIn.delay(850).duration(400)}
                    style={styles.hint}
                >
                    {isEnrolled ? 'Keep screen open at gate' : 'Complete face enrollment to activate pass'}
                </Animated.Text>
            </Animated.View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 32,
        letterSpacing: -0.5,
    },
    card: {
        width: 320,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        alignItems: 'center',
        paddingVertical: 36,
        paddingHorizontal: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
        elevation: 12,
    },
    statusContainer: {
        marginBottom: 24,
        justifyContent: 'center',
        alignItems: 'center',
        height: 100,
        width: 100,
    },
    pulse: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    dotOuter: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        shadowRadius: 8,
        shadowOpacity: 0.5,
    },
    statusText: {
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 1.5,
        marginBottom: 20,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 100,
        overflow: 'hidden',
    },
    name: {
        color: '#111827',
        fontSize: 26,
        fontWeight: '700',
        marginBottom: 14,
        textAlign: 'center',
    },
    token: {
        color: '#374151',
        fontSize: 14,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        backgroundColor: '#F0F4FF',
        padding: 12,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    tokenPending: {
        color: '#9CA3AF',
        backgroundColor: '#F9FAFB',
        borderColor: '#E5E7EB',
    },
    simulationHint: {
        color: '#F59E0B',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 8,
        marginBottom: 24,
        textAlign: 'center',
    },
    walletContainer: {
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        paddingTop: 20,
        marginTop: 16,
        width: '100%',
    },
    walletLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#9CA3AF',
        letterSpacing: 1,
        marginBottom: 4,
    },
    walletAmount: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1F2937',
    },
    hint: {
        color: '#9CA3AF',
        marginTop: 20,
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
    },
});
