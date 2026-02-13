/**
 * BLE Advertiser Service
 * 
 * Advertises the user's cypher_id as the BLE local name so the
 * gate's ESP32 scanner can detect it (replacing nRF Connect).
 * 
 * Flow:
 *   1. App calls startAdvertising(cypherId)
 *   2. Phone broadcasts as BLE peripheral with localName = cypherId
 *   3. ESP32 scans and sees "METRO-XXXX" → sends to gate Python
 *   4. Gate matches cypher_id to face → opens gate
 */

import { PermissionsAndroid, Platform } from 'react-native';

let BlePeripheral = null;

// Lazy import to avoid crashes if native module unavailable
try {
    BlePeripheral = require('munim-bluetooth-peripheral').default;
} catch (e) {
    console.warn('BLE Peripheral module not available:', e.message);
}

// A simple UUID for the service (can be anything, gate doesn't use it)
const SERVICE_UUID = '00001826-0000-1000-8000-00805f9b34fb';

let isAdvertising = false;

/**
 * Request BLE permissions (Android only)
 */
async function requestPermissions() {
    if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        const allGranted = Object.values(granted).every(
            (status) => status === PermissionsAndroid.RESULTS.GRANTED
        );
        return allGranted;
    }
    // iOS handles permissions via Info.plist
    return true;
}

/**
 * Start advertising the cypher_id as BLE local name.
 * The gate's ESP32 scanner will pick this up.
 */
export async function startAdvertising(cypherId) {
    if (!BlePeripheral) {
        throw new Error('BLE Peripheral not available. Need a dev build (not Expo Go).');
    }

    if (isAdvertising) {
        console.log('BLE: Already advertising');
        return true;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
        throw new Error('BLE permissions denied');
    }

    try {
        // Set the local name to the cypher_id (e.g., "METRO-A1B2C3D4...")
        await BlePeripheral.setLocalName(cypherId);

        // Start advertising with the service UUID
        await BlePeripheral.startAdvertising({
            serviceUuids: [SERVICE_UUID],
            localName: cypherId,
        });

        isAdvertising = true;
        console.log(`📡 BLE: Advertising as "${cypherId}"`);
        return true;
    } catch (error) {
        console.error('BLE start failed:', error);
        throw error;
    }
}

/**
 * Stop BLE advertising.
 */
export async function stopAdvertising() {
    if (!BlePeripheral || !isAdvertising) return;

    try {
        await BlePeripheral.stopAdvertising();
        isAdvertising = false;
        console.log('📡 BLE: Stopped advertising');
    } catch (error) {
        console.error('BLE stop failed:', error);
    }
}

/**
 * Check if currently advertising.
 */
export function isBleAdvertising() {
    return isAdvertising;
}

/**
 * Check if BLE peripheral is available (native module loaded).
 */
export function isBleAvailable() {
    return BlePeripheral !== null;
}
