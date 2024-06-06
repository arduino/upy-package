import { execSync } from 'child_process';
import inquirer from 'inquirer';

/**
 * Class to manage connected boards
 */
export class BoardManager {
    
    /**
     * Get a list of connected boards. It uses mpremote to get the list.
     * @returns {Array} List of connected boards in the format {port, ID, vendorID, productID, name}
     */
    getConnectedBoards() {
        const command = `mpremote connect list`;

        // Convert output e.g. /dev/cu.usbmodem1234561 123456 2341:056b Arduino Nano ESP32 to
        // object with properties port, ID, vendorID, productID, productName
        const entries = execSync(command, { encoding: 'utf-8' }).split('\n');
        entries.pop(); // Remove last empty line
        const boardInfo = entries.map((line) => {
            const parts = line.split(' ');
            return {
                port: parts[0],
                ID: parts[1],
                vendorID: `0x${parts[2].split(':')[0]}`,
                productID: `0x${parts[2].split(':')[1]}`,
                name: parts.slice(3).join(' '),
            };
        });

        return boardInfo;
    }
    
    /**
     * Gets the board based on the vendorID. If no vendorID is provided, it will return the first board found.
     * If more than one board is found, it will prompt the user to select a board.
     * @param {string} vendorID 
     * @returns 
     */
    async getBoard(vendorID = null) {
        let boards = this.getConnectedBoards()
        
        if(vendorID){
            boards = boards.filter((board) => board.vendorID === vendorID);
        }

        if (boards.length === 0) {
            return null;
        }

        if (boards.length === 1) {
            return boards[0];
        }

        const boardOptions = boards.map((board) => {
            return { "name" : `${board.name} at ${board.port}`, "value" : board };
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
        const command = `mpremote connect id:${board.ID} exec "import os; print(os.uname().release)"`;
        return execSync(command, { encoding: 'utf-8' }).trim();
    }
}