import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { confirmEnrollment, WS_URL } from '../src/api/client';
import useUserStore from '../src/store/userStore';

export default function ScanScreen() {
    const router = useRouter();
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef(null);
    const wsRef = useRef(null);
    const [status, setStatus] = useState("CONNECTING...");
    const [instruction, setInstruction] = useState("Align face in frame");
    const [boxColor, setBoxColor] = useState("white");
    const [stage, setStage] = useState("CENTER"); // Track which pose we're on
    const { user, profile, refreshProfile } = useUserStore();
    const isStreaming = useRef(false);
    const isMounted = useRef(true);
    const enrollmentComplete = useRef(false);

    const fullName = profile?.full_name || user?.user_metadata?.full_name || "Unknown";
    const cypherId = profile?.cypher_id || `METRO-${Date.now().toString(16).toUpperCase()}`;
    const userId = user?.id;

    useEffect(() => {
        isMounted.current = true;
        if (!permission?.granted) requestPermission();

        const timer = setTimeout(() => {
            if (isMounted.current) connectWebSocket();
        }, 500);

        return () => {
            isMounted.current = false;
            clearTimeout(timer);
            disconnectWebSocket();
        };
    }, [permission, userId]);

    const connectWebSocket = () => {
        if (!userId || enrollmentComplete.current) return;

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        const url = `${WS_URL}/ws/capture/${userId}/${encodeURIComponent(fullName)}/${cypherId}`;
        console.log("Connecting WS:", url);

        wsRef.current = new WebSocket(url);

        wsRef.current.onopen = () => {
            if (!isMounted.current) return;
            setStatus("CONNECTED");
            setInstruction("Look straight at the camera");
            setBoxColor("yellow");
            startStreaming();
        };

        wsRef.current.onmessage = (event) => {
            if (!isMounted.current) return;
            try {
                const data = JSON.parse(event.data);
                handleServerMessage(data);
            } catch (e) {
                console.error("WS Parse Error", e);
            }
        };

        wsRef.current.onerror = (e) => {
            if (!isMounted.current || enrollmentComplete.current) return;
            setStatus("CONNECTION ERROR");
            setInstruction("Could not connect to server");
            setBoxColor("red");
            console.log("WS Error:", e.message || e);
        };

        wsRef.current.onclose = () => {
            if (!isMounted.current || enrollmentComplete.current) return;
            setStatus("DISCONNECTED");
            setInstruction("Connection lost. Go back and retry.");
            setBoxColor("red");
            isStreaming.current = false;
        };
    };

    const disconnectWebSocket = () => {
        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.onerror = null;
            wsRef.current.close();
            wsRef.current = null;
        }
        isStreaming.current = false;
    };

    const handleServerMessage = (data) => {
        setInstruction(data.msg);

        switch (data.status) {
            case "GUIDE":
                setStatus("SCANNING");
                setBoxColor("yellow");
                break;
            case "RETRY":
                setStatus("RETRY");
                setBoxColor("red");
                break;
            case "NEXT":
                setStatus("POSE CAPTURED ✓");
                setBoxColor("green");
                // Extract the next pose direction from the message
                const match = data.msg?.match(/look\s+(\w+)/i);
                if (match) setStage(match[1].toUpperCase());
                break;
            case "COMPLETE":
                enrollmentComplete.current = true;
                setStatus("ENROLLED ✓");
                setBoxColor("lime");
                isStreaming.current = false;
                disconnectWebSocket();

                // Persist enrollment: refresh from Supabase, with API fallback
                handleEnrollmentComplete();
                break;
        }
    };

    const handleEnrollmentComplete = async () => {
        try {
            // If backend WS didn't save to Supabase, call the fallback endpoint
            await confirmEnrollment().catch(() => { });
            // Refresh profile from Supabase to get confirmed state
            await refreshProfile();
        } catch (e) {
            console.log("Post-enrollment sync error:", e);
        }

        Alert.alert("Success", "Face Enrollment Complete!", [
            {
                text: "OK",
                onPress: () => {
                    if (router.canGoBack()) {
                        router.replace('/(tabs)/pass');
                    } else {
                        router.push('/(tabs)/pass');
                    }
                }
            }
        ]);
    };

    const startStreaming = async () => {
        if (isStreaming.current) return;
        isStreaming.current = true;

        const loop = async () => {
            if (!isMounted.current || !isStreaming.current || enrollmentComplete.current) return;
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

            if (!cameraRef.current) {
                setTimeout(loop, 500);
                return;
            }

            try {
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.4,
                    skipProcessing: true,
                    base64: true,
                });

                if (!photo) {
                    throw new Error("Failed to capture image");
                }

                const manipulated = await ImageManipulator.manipulateAsync(
                    photo.uri,
                    [{ resize: { width: 480 } }],
                    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                );

                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(`data:image/jpeg;base64,${manipulated.base64}`);
                }

                setTimeout(loop, 400);
            } catch (e) {
                console.log("Stream Error:", e);
                setTimeout(loop, 1000);
            }
        };

        loop();
    };

    if (!permission) return <View />;
    if (!permission.granted) return (
        <View style={styles.container}>
            <Text style={{ color: 'white', marginBottom: 20 }}>No access to camera</Text>
            <TouchableOpacity onPress={requestPermission} style={{ padding: 10, backgroundColor: 'blue', borderRadius: 5 }}>
                <Text style={{ color: 'white' }}>Grant Permission</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <CameraView
                style={StyleSheet.absoluteFill}
                facing="front"
                ref={cameraRef}
            />

            <View style={styles.overlay}>
                {/* Header with status */}
                <View style={[styles.header, {
                    backgroundColor: boxColor === 'red'
                        ? 'rgba(220, 38, 38, 0.8)'
                        : boxColor === 'green' || boxColor === 'lime'
                            ? 'rgba(16, 185, 129, 0.8)'
                            : 'rgba(0, 51, 102, 0.8)'
                }]}>
                    <Text style={styles.statusText}>{status}</Text>
                </View>

                {/* Guide Box */}
                <View style={[styles.box, { borderColor: boxColor }]}>
                    <Text style={[styles.instruction, { color: boxColor }]}>{instruction}</Text>
                </View>

                <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => {
                        if (router.canGoBack()) router.back();
                        else router.replace('/');
                    }}
                >
                    <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
        padding: 24,
        alignItems: 'center',
        zIndex: 10
    },
    header: {
        marginTop: 60,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    statusText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
        letterSpacing: 1
    },
    box: {
        width: 280,
        height: 380,
        borderWidth: 2,
        borderRadius: 24,
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 20,
        backgroundColor: 'transparent',
        borderStyle: 'dashed'
    },
    instruction: {
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        color: '#fff',
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: -10
    },
    cancelBtn: {
        marginBottom: 40,
        paddingHorizontal: 32,
        paddingVertical: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 100,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)'
    },
    cancelText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500'
    }
});
