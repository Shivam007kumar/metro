import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchTrips } from '../../src/api/client';
import useUserStore from '../../src/store/userStore';

export default function HistoryScreen() {
    const { user } = useUserStore();
    const [trips, setTrips] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            let isMounted = true;

            const loadTrips = async () => {
                if (!user?.id) {
                    setLoading(false);
                    return;
                }

                setLoading(true);
                setError(null);
                try {
                    const data = await fetchTrips();
                    if (isMounted) {
                        setTrips(data || []);
                    }
                } catch (e) {
                    console.error('Fetch trips error:', e);
                    if (isMounted) {
                        setError('Could not load trip history');
                    }
                } finally {
                    if (isMounted) setLoading(false);
                }
            };

            loadTrips();

            return () => { isMounted = false; };
        }, [user?.id])
    );

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    };

    const formatTime = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <Animated.Text entering={FadeIn.duration(300)} style={styles.header}>
                    Trip History
                </Animated.Text>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#0056D2" />
                    <Text style={styles.loadingText}>Loading trips...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Animated.Text entering={FadeIn.duration(300)} style={styles.header}>
                Trip History
            </Animated.Text>

            {/* Line Info Badge */}
            <Animated.View
                entering={FadeInDown.delay(100).duration(400).springify()}
                style={styles.lineBadge}
            >
                <Text style={styles.lineBadgeText}>🚇 Mumbai Metro Line 1 — Versova ↔ Ghatkopar</Text>
            </Animated.View>

            {error && (
                <Animated.View entering={FadeIn.duration(300)} style={styles.errorBanner}>
                    <Text style={styles.errorText}>⚠️ {error}</Text>
                </Animated.View>
            )}

            <FlatList
                data={trips}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <Animated.View
                        entering={FadeInUp.delay(200).duration(600)}
                        style={styles.emptyContainer}
                    >
                        <Text style={styles.emptyIcon}>🚇</Text>
                        <Text style={styles.emptyText}>No trips yet</Text>
                        <Text style={styles.emptySub}>
                            Your travel history on the Ghatkopar line{'\n'}will appear here after your first ride
                        </Text>
                    </Animated.View>
                }
                renderItem={({ item, index }) => (
                    <Animated.View
                        entering={SlideInRight.delay(150 + index * 80).duration(400).springify().damping(18)}
                        style={styles.tripCard}
                    >
                        <View style={styles.tripHeader}>
                            <View style={styles.routeDot} />
                            <Text style={styles.tripRoute}>{item.station_name || 'Unknown Station'}</Text>
                        </View>

                        <View style={[styles.accessBadge, {
                            backgroundColor: item.access_granted ? '#ECFDF5' : '#FEF2F2',
                        }]}>
                            <Text style={{
                                color: item.access_granted ? '#059669' : '#DC2626',
                                fontSize: 12,
                                fontWeight: '600',
                            }}>
                                {item.access_granted ? '✓ Access Granted' : '✗ Access Denied'}
                            </Text>
                        </View>

                        <View style={styles.tripFooter}>
                            <View>
                                <Text style={styles.tripDate}>{formatDate(item.entry_time)}</Text>
                                <Text style={styles.tripTime}>{formatTime(item.entry_time)}</Text>
                            </View>
                            <View style={styles.fareContainer}>
                                <Text style={styles.fareLabel}>FARE</Text>
                                <Text style={styles.tripFare}>₹{item.fare_charged || 0}</Text>
                            </View>
                        </View>
                    </Animated.View>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FB',
    },
    header: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1F2937',
        padding: 20,
        paddingBottom: 8,
    },
    lineBadge: {
        marginHorizontal: 20,
        marginBottom: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#F0F4FF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    lineBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#3B82F6',
        textAlign: 'center',
    },
    list: {
        padding: 20,
        paddingTop: 8,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: '#6B7280',
        fontSize: 14,
    },
    errorBanner: {
        marginHorizontal: 20,
        marginBottom: 8,
        padding: 12,
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
    },
    errorText: {
        color: '#DC2626',
        fontSize: 13,
        textAlign: 'center',
    },
    tripCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 20,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    tripHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    routeDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#0056D2',
        marginRight: 12,
    },
    tripRoute: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    accessBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        marginBottom: 12,
    },
    tripFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    tripDate: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
    },
    tripTime: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 2,
    },
    fareContainer: {
        alignItems: 'flex-end',
    },
    fareLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#9CA3AF',
        letterSpacing: 0.5,
    },
    tripFare: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingTop: 80,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#6B7280',
    },
    emptySub: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 4,
        textAlign: 'center',
        lineHeight: 20,
    },
});
