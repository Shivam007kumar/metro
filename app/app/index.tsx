import { useRootNavigationState, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, SlideInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../src/lib/supabase';
import useUserStore from '../src/store/userStore';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function LoginScreen() {
    const router = useRouter();
    const rootNavigationState = useRootNavigationState();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    const { setSession, setProfile, user } = useUserStore();

    useEffect(() => {
        // On mount, check if there's a valid session (cold start / app reopen)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setSession(session);
                fetchProfile(session.user.id);
            }
        });

        // Listen for auth state changes.
        // SIGNED_IN: user explicitly signed in
        // INITIAL_SESSION: app cold-started with a persisted session
        // SIGNED_OUT: user logged out
        // We intentionally skip TOKEN_REFRESHED to prevent stale refresh
        // tokens from re-creating a session after logout.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
                setSession(session);
                fetchProfile(session.user.id);
            } else if (event === 'SIGNED_OUT') {
                setSession(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!rootNavigationState?.key) return;
        if (user?.id) {
            setTimeout(() => router.replace('/(tabs)'), 0);
        }
    }, [user?.id, rootNavigationState?.key]);

    const fetchProfile = async (uid: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', uid)
            .single();

        if (data) setProfile(data);
    };

    const handleAuth = async () => {
        if (!email || !password) return Alert.alert("Error", "Please fill in all fields");
        if (isSignUp && !fullName.trim()) return Alert.alert("Error", "Please enter your full name");
        setLoading(true);

        try {
            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { full_name: fullName.trim() }
                    }
                });
                if (error) throw error;
                if (!data?.session) {
                    Alert.alert("Check Email", "Please verify your email to continue.");
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (error: any) {
            Alert.alert("Auth Error", error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F0F4FF" />
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.content}
                >
                    {/* Branding — gentle fade-in */}
                    <View style={styles.header}>
                        <Animated.View
                            entering={FadeIn.delay(100).duration(800)}
                            style={styles.logoBox}
                        >
                            <Text style={styles.logoEmoji}>🚇</Text>
                        </Animated.View>
                        <Animated.Text
                            entering={FadeIn.delay(300).duration(700)}
                            style={styles.title}
                        >
                            Metro Go
                        </Animated.Text>
                        <Animated.Text
                            entering={FadeIn.delay(500).duration(700)}
                            style={styles.subtitle}
                        >
                            Your seamless journey starts here.
                        </Animated.Text>
                    </View>

                    {/* Form Card — smooth slide up */}
                    <Animated.View
                        entering={SlideInUp.delay(400).duration(600)}
                        style={styles.formCard}
                    >
                        <Text style={styles.formTitle}>
                            {isSignUp ? 'Create Account' : 'Welcome Back'}
                        </Text>
                        <Text style={styles.formSubtitle}>
                            {isSignUp ? 'Sign up to get started' : 'Enter your credentials to access your pass'}
                        </Text>

                        {isSignUp && (
                            <Animated.View entering={FadeInUp.duration(400)}>
                                <Text style={styles.label}>Full Name</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Shivam Kumar"
                                    placeholderTextColor="#9CA3AF"
                                    value={fullName}
                                    onChangeText={setFullName}
                                    autoCapitalize="words"
                                />
                            </Animated.View>
                        )}

                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="hello@example.com"
                            placeholderTextColor="#9CA3AF"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />

                        <Text style={styles.label}>Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor="#9CA3AF"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />

                        <AnimatedTouchable
                            entering={FadeIn.delay(600).duration(500)}
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleAuth}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.buttonText}>
                                    {isSignUp ? 'Sign Up' : 'Sign In'}
                                </Text>
                            )}
                        </AnimatedTouchable>

                        <TouchableOpacity
                            style={styles.switchButton}
                            onPress={() => setIsSignUp(!isSignUp)}
                        >
                            <Text style={styles.switchText}>
                                {isSignUp
                                    ? 'Already have an account? '
                                    : "Don't have an account? "}
                                <Text style={styles.switchBold}>
                                    {isSignUp ? 'Sign In' : 'Sign Up'}
                                </Text>
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    content: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 36,
    },
    logoBox: {
        width: 72,
        height: 72,
        borderRadius: 18,
        backgroundColor: '#0056D2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    logoEmoji: {
        fontSize: 36,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1F2937',
        letterSpacing: -0.5,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 15,
        color: '#6B7280',
    },
    formCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    formTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 4,
    },
    formSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 20,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 6,
        marginTop: 12,
    },
    input: {
        height: 52,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    button: {
        height: 52,
        backgroundColor: '#0056D2',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
    },
    buttonDisabled: {
        backgroundColor: '#93B8E8',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    switchButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    switchText: {
        color: '#6B7280',
        fontSize: 14,
    },
    switchBold: {
        color: '#0056D2',
        fontWeight: '700',
    },
});

