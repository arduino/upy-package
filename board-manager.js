import { execSync } from 'child_process';
import inquirer from 'inquirer';

const ARDUINO_VID = '0x2341';

export class BoardManager {
    
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
    
    async getArduinoBoard() {
        const boards = this.getConnectedBoards().filter((board) => board.vendorID === ARDUINO_VID);

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
}