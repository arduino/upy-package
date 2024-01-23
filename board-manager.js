import { execSync } from 'child_process';
import inquirer from 'inquirer';

export class BoardManager {
    
    getConnectedBoards(vendorID = '0x2341') {
        const command = `arduino-cli board list --format json`;
        const output = JSON.parse(execSync(command, { encoding: 'utf-8' }));

        // Filter boards with given vendor ID
        const boards = output.filter((board) => {
            const { port } = board;
            return port.properties && port.properties.vid === vendorID;
        });

        return boards;
    }
    
    async getBoardID() {
        const boards = this.getConnectedBoards();

        if (boards.length === 0) {
            return null;
        }

        if (boards.length === 1) {
            return boards[0].port.hardware_id;
        }

        const boardOptions = boards.map((board) => {
            return `${board.port.address}`;
        });

        const selection = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedBoard',
                message: 'Select the port connected to your Arduino board:',
                choices: boardOptions,
            },
        ]);
        const selectedBoard = boards.find((board) => board.port.address === selection.selectedBoard);
        return selectedBoard.port.hardware_id;
    }
}