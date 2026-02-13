import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

const useUserStore = create(
    persist(
        (set, get) => ({
            session: null,
            user: null,       // Supabase Auth User
            profile: null,    // Public Profile (wallet, enrolled status, etc)
            isEnrolled: false,

            setSession: (session) => set({
                session,
                user: session?.user ?? null,
            }),

            setProfile: (profile) => set({
                profile,
                isEnrolled: profile?.is_enrolled || false,
            }),

            /**
             * Re-fetch profile from Supabase (source of truth).
             * Call this after enrollment, adding money, etc.
             */
            refreshProfile: async () => {
                const userId = get().user?.id;
                if (!userId) return null;

                try {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', userId)
                        .single();

                    if (data && !error) {
                        set({
                            profile: data,
                            isEnrolled: data.is_enrolled || false,
                        });
                        return data;
                    }
                } catch (e) {
                    console.error('refreshProfile error:', e);
                }
                return null;
            },

            logout: () => {
                set({
                    session: null,
                    user: null,
                    profile: null,
                    isEnrolled: false,
                });
                // Explicitly clear persisted storage to prevent stale rehydration
                AsyncStorage.removeItem('user-storage').catch(() => { });
            },
        }),
        {
            name: 'user-storage',
            storage: createJSONStorage(() => AsyncStorage),
            // Only persist profile data — NOT user/session (those come from supabase.auth on startup)
            partialize: (state) => ({
                profile: state.profile,
                isEnrolled: state.isEnrolled,
            }),
        }
    )
);

export default useUserStore;
