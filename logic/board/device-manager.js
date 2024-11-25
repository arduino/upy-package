import { SerialDevice, SerialDeviceFinder, getMicroPythonVersionFromPort } from 'upy-packager';
import * as descriptors from './descriptors.js';

/**
 * Class to manage connected boards
 */
export class DeviceManager {

    constructor() {
        this.serialDeviceFinder = new SerialDeviceFinder();
        this.deviceDescriptors = Object.values(descriptors);
    }

    /**
     * Get a list of connected boards. Optionally filter by vendorID and productID.
     * @returns {Promise<Array<SerialDevice>>} List of connected boards as SerialDevice objects.
     */
    async getConnectedDevices(vendorIDFilter = null, productIDFilter = null) {
        let devices = await this.serialDeviceFinder.getDeviceList(vendorIDFilter, productIDFilter);
        devices = devices.map((device) => {
            const matchingDescriptors = this.deviceDescriptors.filter((descriptor) => {
                return descriptor.vid === device.vendorID && descriptor.pid === device.productID;
            });
            
            if (matchingDescriptors.length > 1) {
                throw new Error(`Multiple descriptors found for device ${device.name}`);
            }

            if(matchingDescriptors.length === 1) {
                device.name = matchingDescriptors[0].name;
                device.manufacturer = matchingDescriptors[0].manufacturer;
            }

            return device;
        });
        return devices;
    }

    /**
     * Gets the board with the given serial port.
     * There can never be more than one board with the same serial port.
     * @param {string} serialPort The serial port to get the board for
     * @returns {Promise<SerialDevice>} The board with the given serial port
     */
    async getConnectedBoardByPort(serialPort) {
        const devices = await this.getConnectedDevices();
        return devices.find((device) => device.serialPort === serialPort);
    }

    /**
     * Get the MicroPython version running on the board
     * @param {SerialDevice} serialDevice The board to get the version from
     * @returns {Promise<string>} The MicroPython version as a string (e.g. '1.0.0')
     */
    async getMicroPythonVersion(serialDevice) {
        return getMicroPythonVersionFromPort(serialDevice.serialPort);
    }
}