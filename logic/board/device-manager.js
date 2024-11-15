import inquirer from 'inquirer';
import { SerialDeviceFinder } from './serialDeviceFinder.js';
import * as descriptors from './descriptors.js';
import { getMicroPythonVersionFromPort } from 'upy-packager';

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
     * @returns {Promise<Array>} List of connected boards in the format {port, ID, vendorID, productID, name}
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
     * Gets the board based on the vendorID. If no vendorID is provided, it will return the first board found.
     * If more than one board is found, it will prompt the user to select a board.
     */
    async getDevice(vendorIDFilter = null, productIDFilter = null) {
        let boards = await this.getConnectedDevices(vendorIDFilter, productIDFilter);
        
        if (boards.length === 0) {
            return null;
        }

        if (boards.length === 1) {
            return boards[0];
        }

        const boardOptions = boards.map((board) => {
            return { "name" : `${board.manufacturer} ${board.name} at ${board.serialPort}`, "value" : board };
        });

        const selection = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedPort',
                message: 'Please select your board:',
                choices: boardOptions,
            },
        ]);
        return selection.selectedPort;
    }

    async getMicroPythonVersion(serialDevice) {
        return getMicroPythonVersionFromPort(serialDevice.serialPort);
    }
}