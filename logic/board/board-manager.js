import { execSync } from 'child_process';
import inquirer from 'inquirer';
import { SerialDevice, SerialDeviceFinder } from './serialDeviceFinder.js';
import * as descriptors from './descriptors.js';

/**
 * Class to manage connected boards
 */
export class BoardManager {

    constructor() {
        this.serialDeviceFinder = new SerialDeviceFinder();
        this.deviceDescriptors = Object.values(descriptors);
    }

    /**
     * Get a list of connected boards. It uses mpremote to get the list.
     * @returns {Array} List of connected boards in the format {port, ID, vendorID, productID, name}
     */
    async getConnectedBoards(vendorIDFilter = null, productIDFilter = null) {
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
    async getBoard(vendorIDFilter = null, productIDFilter = null) {
        let boards = await this.getConnectedBoards(vendorIDFilter, productIDFilter);
        
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

    getMicroPythonVersion(board) {
        // TODO: Implement this
        // const command = `mpremote connect id:${board.ID} exec "import os; print(os.uname().release)"`;
        // return execSync(command, { encoding: 'utf-8' }).trim();
        return null;
    }
}