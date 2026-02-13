import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInLeft, FadeInUp, SlideInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addWalletMoney } from '../../src/api/client';
import useUserStore from '../../src/store/userStore';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function HomeScreen() {
    const router = useRouter();
    const { profile, user, refreshProfile } = useUserStore();
    const [addingMoney, setAddingMoney] = useState(false);

    const fullName = profile?.full_name || user?.user_metadata?.full_name || 'User';
    const firstName = fullName.split(' ')[0];
    const balance = profile?.wallet_balance ?? 0;
    const cypherId = profile?.cypher_id || '—';
    const isEnrolled = profile?.is_enrolled || false;

    useFocusEffect(
        useCallback(() => {
            refreshProfile();
        }, [])
    );

    const handleAddMoney = async () => {
        if (!user) return;
        setAddingMoney(true);
        try {
            const result = await addWalletMoney(100);
            await refreshProfile();
            Alert.alert('Success', `₹100 added! New balance: ₹${result.new_balance}`);
        } catch (error: any) {
            console.error('Add money error:', error?.response?.data || error);
            Alert.alert('Error', error?.response?.data?.detail || 'Could not add money. Try again.');
        } finally {
            setAddingMoney(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                {/* Welcome Card — fade in from left */}
                <Animated.View
                    entering={FadeInLeft.delay(100).duration(500).springify()}
                    style={styles.welcomeCard}
                >
                    <Text style={styles.welcomeEmoji}>👋</Text>
                    <View>
                        <Text style={styles.welcomeLabel}>Welcome back!</Text>
                        <Text style={styles.welcomeName}>{firstName}</Text>
                    </View>
                </Animated.View>

                {/* Balance Card — slide up with spring */}
                <Animated.View
                    entering={FadeInUp.delay(200).duration(600).springify().damping(16)}
                    style={styles.balanceCard}
                >
                    <View style={styles.balanceCardInner}>
                        <Text style={styles.balanceLabel}>Total Balance</Text>
                        <Text style={styles.balanceAmount}>₹{Number(balance).toFixed(0)}</Text>
                        <View style={styles.cardChip}>
                            <Text style={styles.cardChipText}>💳</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[styles.addMoneyButton, addingMoney && { opacity: 0.6 }]}
                        onPress={handleAddMoney}
                        activeOpacity={0.8}
                        disabled={addingMoney}
                    >
                        {addingMoney ? (
                            <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                            <Text style={styles.addMoneyText}>+ Add ₹100</Text>
                        )}
                    </TouchableOpacity>
                </Animated.View>

                {/* Enrollment Banner — slide in from right */}
                {!isEnrolled && (
                    <AnimatedTouchable
                        entering={SlideInRight.delay(400).duration(500).springify()}
                        style={styles.enrollBanner}
                        onPress={() => router.push('/scan')}
                        activeOpacity={0.8}
                    >
                        <View style={styles.enrollPulse}>
                            <Text style={styles.enrollIcon}>📸</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.enrollTitle}>Complete Face Enrollment</Text>
                            <Text style={styles.enrollSub}>Required to use metro gates</Text>
                        </View>
                        <Text style={styles.enrollArrow}>→</Text>
                    </AnimatedTouchable>
                )}

                {/* Quick Actions — staggered fade in */}
                <Animated.Text
                    entering={FadeIn.delay(500).duration(400)}
                    style={styles.sectionTitle}
                >
                    Quick Actions
                </Animated.Text>
                <View style={styles.actionsRow}>
                    <AnimatedTouchable
                        entering={FadeInDown.delay(550).duration(400).springify()}
                        style={styles.actionCard}
                        activeOpacity={0.7}
                        onPress={() => router.push('/(tabs)/history')}
                    >
                        <View style={styles.actionIconWrap}>
                            <Text style={styles.actionIcon}>🚇</Text>
                        </View>
                        <Text style={styles.actionLabel}>Trip History</Text>
                    </AnimatedTouchable>
                    <AnimatedTouchable
                        entering={FadeInDown.delay(650).duration(400).springify()}
                        style={styles.actionCard}
                        activeOpacity={0.7}
                        onPress={() => router.push('/(tabs)/pass')}
                    >
                        <View style={styles.actionIconWrap}>
                            <Text style={styles.actionIcon}>🎫</Text>
                        </View>
                        <Text style={styles.actionLabel}>My Pass</Text>
                    </AnimatedTouchable>
                </View>

                {/* Pass ID — fade in from bottom */}
                <Animated.View
                    entering={FadeInUp.delay(700).duration(500)}
                    style={styles.passIdCard}
                >
                    <Text style={styles.passIdLabel}>YOUR METRO ID</Text>
                    <Text style={styles.passIdValue}>{cypherId}</Text>
                    {isEnrolled && (
                        <View style={styles.activeChip}>
                            <View style={styles.activeDot} />
                            <Text style={styles.activeText}>ACTIVE</Text>
                        </View>
                    )}
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FB',
    },
    scroll: {
        padding: 20,
        paddingBottom: 40,
    },
    welcomeCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        flexDirection: 'row',
        alignItems: 'center',
    },
    welcomeEmoji: {
        fontSize: 32,
        marginRight: 14,
    },
    welcomeLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    welcomeName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1F2937',
        marginTop: 2,
    },
    balanceCard: {
        borderRadius: 20,
        marginBottom: 16,
        overflow: 'hidden',
    },
    balanceCardInner: {
        backgroundColor: '#0056D2',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 28,
        minHeight: 160,
        justifyContent: 'center',
    },
    balanceLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 8,
    },
    balanceAmount: {
        color: '#FFFFFF',
        fontSize: 42,
        fontWeight: '800',
        letterSpacing: -1,
    },
    cardChip: {
        position: 'absolute',
        right: 28,
        top: 28,
        opacity: 0.3,
    },
    cardChipText: {
        fontSize: 48,
    },
    addMoneyButton: {
        backgroundColor: '#003D99',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        padding: 16,
        alignItems: 'center',
    },
    addMoneyText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    enrollBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#FCD34D',
    },
    enrollPulse: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#FDE68A',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    enrollIcon: {
        fontSize: 22,
    },
    enrollTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#92400E',
    },
    enrollSub: {
        fontSize: 12,
        color: '#B45309',
        marginTop: 2,
    },
    enrollArrow: {
        fontSize: 20,
        color: '#92400E',
        fontWeight: '700',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 12,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    actionCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 3,
    },
    actionIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#F0F4FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    actionIcon: {
        fontSize: 24,
    },
    actionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    passIdCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    passIdLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#9CA3AF',
        letterSpacing: 1,
        marginBottom: 8,
    },
    passIdValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    activeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 100,
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981',
        marginRight: 6,
    },
    activeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#059669',
        letterSpacing: 0.5,
    },
});
