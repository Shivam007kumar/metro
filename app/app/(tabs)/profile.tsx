import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import useUserStore from '../../src/store/userStore';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function ProfileScreen() {
    const router = useRouter();
    const { user, profile, logout, refreshProfile } = useUserStore();

    const fullName = profile?.full_name || user?.user_metadata?.full_name || 'Unknown';
    const email = user?.email || '—';
    const cypherId = profile?.cypher_id || '—';
    const isEnrolled = profile?.is_enrolled || false;
    const balance = profile?.wallet_balance ?? 0;

    useFocusEffect(
        useCallback(() => {
            refreshProfile();
        }, [])
    );

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                    await supabase.auth.signOut();
                    logout();
                    router.replace('/');
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                <Animated.Text
                    entering={FadeIn.delay(50).duration(400)}
                    style={styles.header}
                >
                    Profile
                </Animated.Text>

                {/* Avatar — zoom in */}
                <Animated.View
                    entering={ZoomIn.delay(150).duration(500).springify()}
                    style={styles.avatarContainer}
                >
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {fullName.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                    <Text style={styles.profileName}>{fullName}</Text>
                    <Text style={styles.profileEmail}>{email}</Text>
                </Animated.View>

                {/* Info Cards — staggered */}
                <Animated.View
                    entering={FadeInUp.delay(300).duration(500).springify()}
                    style={styles.infoCard}
                >
                    <InfoRow label="Metro ID" value={cypherId} mono />
                    <InfoRow label="Wallet Balance" value={`₹${Number(balance).toFixed(2)}`} />
                    <InfoRow
                        label="Enrollment"
                        value={isEnrolled ? '✅ Complete' : '⚠️ Pending'}
                    />
                    <InfoRow label="Member Since" value={new Date(user?.created_at || '').toLocaleDateString()} />
                </Animated.View>

                {/* Actions */}
                {!isEnrolled && (
                    <AnimatedTouchable
                        entering={FadeInDown.delay(500).duration(400).springify()}
                        style={styles.enrollButton}
                        onPress={() => router.push('/scan')}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.enrollButtonText}>Complete Face Enrollment</Text>
                    </AnimatedTouchable>
                )}

                <AnimatedTouchable
                    entering={FadeInDown.delay(600).duration(400)}
                    style={styles.logoutButton}
                    onPress={handleLogout}
                    activeOpacity={0.8}
                >
                    <Text style={styles.logoutText}>Logout</Text>
                </AnimatedTouchable>
            </ScrollView>
        </SafeAreaView>
    );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={[
                styles.infoValue,
                mono && { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 13 }
            ]}>{value}</Text>
        </View>
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
    header: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 24,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#0056D2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#0056D2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    profileName: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 4,
    },
    profileEmail: {
        fontSize: 14,
        color: '#6B7280',
    },
    infoCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 4,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    infoLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
        maxWidth: '60%',
        textAlign: 'right',
    },
    enrollButton: {
        backgroundColor: '#0056D2',
        borderRadius: 14,
        padding: 16,
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: '#0056D2',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    enrollButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    logoutButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FCA5A5',
    },
    logoutText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: '600',
    },
});
