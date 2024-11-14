import { SerialPort } from 'serialport'

export class SerialDevice {
    constructor(vendorID, productID, serialPort = null, serialNumber = null) {
        this.vendorID = vendorID;
        this.productID = productID;
        this.serialNumber = serialNumber;
        this.serialPort = serialPort;
        this.manufacturer = null;
        this.name = null;
    }
}

export class SerialDeviceFinder {

    async getDeviceList(vendorIDFilter = null, productIDFilter = null) {
        let devices = [];
        const ports = await SerialPort.list();

        for (const port of ports) {
            if(port.vendorId === undefined || port.productId === undefined) continue;
            const vendorID = parseInt(port.vendorId, 16);
            const productID = parseInt(port.productId, 16);

            if(vendorIDFilter && vendorID !== vendorIDFilter) continue;
            if(productIDFilter && productID !== productIDFilter) continue;

            let serialNumber = port.serialNumber;

            // Check if serial number contains an ampersand (bug on Windows)
            // SEE: https://github.com/serialport/node-serialport/issues/2726
            if(port.serialNumber?.includes('&')){
                serialNumber = null;
            }
            const newDevice = new SerialDevice(vendorID, productID, port.path, serialNumber);
            devices.push(newDevice);
        }
        return devices;
    }
}
