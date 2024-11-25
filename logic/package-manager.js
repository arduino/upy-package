import yaml from 'js-yaml';
import { satisfies, valid } from 'semver';
import {Packager} from 'upy-packager';

const registryUrls = [
    'https://raw.githubusercontent.com/arduino/package-index-py/main/package-list.yaml',
    'https://raw.githubusercontent.com/arduino/package-index-py/main/micropython-lib.yaml'
];

export class Package {

    static fromObject(obj) {
        const aPackage = new Package();
        Object.assign(aPackage, obj);
        return aPackage;
    }

    toString() {
        let info = `📦 ${this.name}`;

        if(this.url) {
            info += `\n🔗 ${this.url}`;
        }

        if(this.docs) {
            info += `\n📚 ${this.docs}`
        };

        if(this.tags) {
            info += `\n🔖 [${this.tags.join(', ')}]`;
        }
        if(this.author) {
            info += `\n👤 ${this.author}`;
        }
        if(this.license) {
            info += `\n📜 ${this.license}`;
        }

        if(this.description) {
            info += `\n\n${this.description}`;
        }
        return info;
    }
}

export class PackageManager {

    /**
     * Constructor for the PackageManager class.
     * @param {boolean} compileFiles Whether to compile the files before packaging.
     * Defaults to true.
     * If set to false, the files will be packaged as they are.
     * This parameter is optional.
     * @param {boolean} overwriteExisting Whether to overwrite existing files on the board. Defaults to true.
     * When set to true, an existing package folder with the same name will be deleted before installing the new package.
     * @returns {PackageManager} A new instance of the PackageManager class.
     */
    constructor(compileFiles = true, overwriteExisting = true) {
        this.compileFiles = compileFiles;
        this.overwriteExisting = overwriteExisting;
    }

    /**
     * Function to fetch and parse the package list from given registry URLs.
     * @returns {Promise<Array<Package>} List of available packages.
     */
    async getPackageList() {
        let packages = [];

        for (const registryUrl of registryUrls) {
            try {
                const response = await fetch(registryUrl);
                const data = await response.text();
                packages = packages.concat(yaml.load(data).packages);
            } catch (error) {
                throw new Error(`Error fetching package list from ${registryUrl}: ${error.message}`);
            }
        }
        packages.sort((a, b) => a.name?.localeCompare(b.name));
        packages = packages.map(Package.fromObject);
        return packages;
    }

    /**
     * Function to find a package matching the supplied pattern
     * @param {string} pattern 
     * @returns {Promise<Array<Package>>} List of packages matching the pattern
     */
    async findPackages(pattern) {
        const packageList = await this.getPackageList();
        if (packageList) {
            const matchingPackages = packageList
                .filter((pkg) => {
                    const { name, description, tags } = pkg;
                    return (
                        name.toLowerCase().includes(pattern) ||
                        (description && description.toLowerCase().includes(pattern)) ||
                        (tags && tags.some((tag) => tag.toLowerCase().includes(pattern)))
                    );
                });

            return matchingPackages;
        } else {
            return null;
        }
    }

    /**
     * Checks if the selected package requires a runtime version that is supported by the device.
     * @param {Package} selectedPackage The package to be installed
     * @param {string} deviceRuntime The runtime version of the device as a string (e.g. '1.0.0')
     * @returns {Promise<boolean>} A promise that resolves to true if the device runtime version satisfies the package requirements
     */
    async matchesRequiredRuntime(selectedPackage, deviceRuntime) {
        let requiredRuntime = selectedPackage.required_runtime;
        if (!requiredRuntime) {
            return true;
        }

        if(!valid(deviceRuntime)){
            throw new Error(`Board runtime version ${boardRuntime} is not valid.`);
        }

        return satisfies(deviceRuntime, requiredRuntime);
    }

    /**
     * Get a package by name
     * @param {string} packageName The name of the package to get
     * @param {string} version The version of the package to get. e.g. '1.0.0' or 'v1.0.0'
     * @returns {Promise<Package>} The package with the given name
     */
    async getPackage(packageName, version = null) {
        const packageList = await this.getPackageList();
        let foundPackage;

        if(version){
            foundPackage = packageList.find((pkg) => pkg.name === packageName && pkg.version === version);
        } else {
            foundPackage = packageList.find((pkg) => pkg.name === packageName);
        }
        
        if (!foundPackage) {
            throw new Error(`Package '${packageName}' not found.`);
        }

        return foundPackage;
    }

    /**
     * Function to install a package from a URL
     * @param {string} packageURL The URL of the package to install.
     * Supported formats: 'github:owner/repo' or 'gitlab:owner/repo'
     * or https://github.com/owner/repo or https://gitlab.com/owner/repo.
     * It's also possible to indicate a specific package.json file or even single .py files.
     * Supports versioning with the by appending @version e.g. 'arduino/arduino-iot-cloud-py@v1.3.3'.
     * @param {SerialDevice} device The board to install the package on.
     */
    async installPackageFromURL(packageURL, device) {
        const packageVersion = packageURL.split("@")[1];
        const packageURLWithoutVersion = packageURL.split("@")[0];
        await this.installPackage({ "url" : packageURLWithoutVersion, "version" : packageVersion }, device);
    }

    /**
     * Function to install a package on a board from a package object
     * @param {Package} aPackage The package to install.
     * @param {SerialDevice} device The board to install the package on.
     */
    async installPackage(aPackage, device) {
        if(!device){
            throw new Error('No board was selected.');
        }

        // Official micropython-lib packages don't have a URL field in the registry,
        // so they are installed by supplying the name as the URL
        const packageURL = aPackage.url ? aPackage.url : aPackage.name;
        const customPackageJson = aPackage.package_descriptor;
        const packageVersion = aPackage.version;

        const packager = new Packager(device.serialPort, this.compileFiles, this.overwriteExisting);
        await packager.packageAndInstall(packageURL, packageVersion, customPackageJson);
        console.debug(`✅ Package installed: ${packageURL}`);
    }
}