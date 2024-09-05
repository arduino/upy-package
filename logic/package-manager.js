import yaml from 'js-yaml';
import { execSync } from 'child_process';
import { BoardManager } from './board-manager.js';
import { satisfies, valid } from 'semver';
import inquirer from 'inquirer';

const registryUrls = [
    // 'https://raw.githubusercontent.com/arduino/package-index-py/main/package-list.yaml',
    'https://raw.githubusercontent.com/arduino/package-index-py/file-override/package-list.yaml',
    'https://raw.githubusercontent.com/arduino/package-index-py/micropython-lib/micropython-lib.yaml'
];

const DEFAULT_LIB_PATH = '/lib';

export class PackageManager {
    /**
     * Converts a github URL to a mpremote compatible URL
     * @param {string} url A Github repository URL such as https://github.com/arduino/arduino-iot-cloud-py
     * @param {string} branch If specified, the branch to use, e.g. main
     * @returns The converted URL, e.g. github:arduino/arduino-iot-cloud-py@branch
     */
    convertGithubURL(url, branch = null) {
        if (url.startsWith('github:')) {
            return url;
        }

        // Only Github URLs are supported
        if (!url.includes("github.com")) {
            return null;
        }

        const parts = url.split('/');
        const user = parts[parts.length - 2];
        const repo = parts[parts.length - 1].split('.')[0];

        let constructedURL = `github:${user}/${repo}`;
        if (branch) {
            constructedURL += `@${branch}`;
        }
        return constructedURL;
    }

    getRepositoryNameFromURL(url) {
        if (url.startsWith('github:')) {
            return url.split(':')[1].split('@')[0];
        } else if (url.startsWith('http')) {
            return url.split('/')[4].split('.')[0];
        }
        return null;
    }

    normalizeRepositoryName(name) {
        // Replace characters so that it results in a valid Python package name
        return name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    }

    // Function to fetch and parse the package list from a given registry URL
    async getPackageList() {
        let packages = [];

        for (const registryUrl of registryUrls) {
            try {
                const response = await fetch(registryUrl);
                const data = await response.text();
                packages = packages.concat(yaml.load(data).packages);
            } catch (error) {
                console.error(`Error fetching package list from ${registryUrl}:`, error.message);
                process.exit(1);
            }
        }
        return packages;
    }

    async getPackageInfo(packageName) {
        const packageList = await this.getPackageList();
        let packageInfo = packageList.find((pkg) => pkg.name === packageName);
        if (!packageInfo) return null;
        let info = `📦 ${packageInfo.name}\n🔗 ${packageInfo.url}`;

        if(packageInfo.description) {
            info += `\n📝 ${packageInfo.description}`;
        }

        if(packageInfo.tags) {
            info += `\n🔖 [${packageInfo.tags.join(', ')}]`;
        }
        if(packageInfo.author) {
            info += `\n👤 ${packageInfo.author}`;
        }
        if(packageInfo.license) {
            info += `\n📜 ${packageInfo.license}`;
        }
        return info;
    }

    // Function to list packages from a given registry URL
    async listPackages() {
        const packageList = await this.getPackageList();
        return packageList ? packageList.map((pkg) => `📦 ${pkg.name}`).join('\n') : null;
    }

    // Function to find a package matching the supplied pattern
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

    async checkRequiredRuntime(selectedPackage, board) {
        let requiredRuntime = selectedPackage.runtime;
        requiredRuntime ||= selectedPackage.overrides?.runtime;
        const boardManager = new BoardManager();
        const boardRuntime = boardManager.getMicroPythonVersion(board);
        
        if(!valid(boardRuntime)){
            throw new Error(`Board runtime version ${boardRuntime} is not valid.`);
        }

        const runsRequiredVersion = satisfies(boardRuntime, requiredRuntime);
        if (!runsRequiredVersion) {
            console.warn(`🚨 Package '${selectedPackage.name}' requires a different runtime version (${requiredRuntime}) than the one running on the board (${boardRuntime}).`);
            // Use inquirer to prompt the user to continue or abort
            const response = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'continue',
                    message: 'Do you want to continue with the installation?',
                    default: false,
                },
            ]);
            return response.continue;
        }
        return true;
    }

    async getPackage(packageName) {
        const packageList = await this.getPackageList();
        const foundPackage = packageList.find((pkg) => pkg.name === packageName);
        
        if (!foundPackage) {
            throw new Error(`Package '${packageName}' not found.`);
        }

        return foundPackage;
    }

    installPackageFromGithubURL(url, board, targetPath = null) {
        const repositoryName = this.getRepositoryNameFromURL(url);
        if (!repositoryName) {
            throw new Error(`Invalid repository URL '${url}'`);
        }

        let selectedPackage = {
            name: repositoryName,
            url: url
        };
        this.installPackage(selectedPackage, board, targetPath);
    }


    // Function to install MicroPython packages using mpremote
    installPackage(selectedPackage, board, targetPath = null) {
        if(!board){
            throw new Error('No board was selected.');
        }
        let packageArgument;
        let indexArg = '';
        if(!targetPath) targetPath = DEFAULT_LIB_PATH;
        
        if(selectedPackage.index){
            // Only take last path segment of package URL if it's in an index
            packageArgument = selectedPackage.url.split('/').pop();
            indexArg = selectedPackage.index ? `--index ${selectedPackage.index}` : '';
        } else if(selectedPackage.files){
            // If the package has files, append them to the URL
            packageArgument = selectedPackage.files.join(' ');
            
            if(selectedPackage.files.length > 1){
                // If there are multiple files, add the package name to the target path
                // Infer target path from repository name
                // This will serve as the package name used for import after installation
                const repoName = this.getRepositoryNameFromURL(selectedPackage.url);
                let normalizedRepoName = this.normalizeRepositoryName(repoName);
                targetPath = `${targetPath}/${normalizedRepoName}`;
            }
        } else {
            packageArgument = this.convertGithubURL(selectedPackage.url);
        }

        if (!packageArgument) {
            throw new Error(`Nothing to install for package '${selectedPackage.name}'.`);
        }    

        const targetPathArg = targetPath ? `--target=${targetPath}` : '';
        let command = `mpremote connect id:${board.ID} mip install ${targetPathArg} ${indexArg} ${packageArgument}`;
        // Remove double spaces resulting from empty arguments
        command = command.replace(/\s\s+/g, ' ');
        
        try {
            execSync(command, { stdio: ['ignore', 'inherit', 'pipe'] });
        } catch (error) {
            let installationError = new Error(`Error installing package ${selectedPackage.name}.`);

            if(error.message.includes('Package not found')){
                installationError.message += " 'package.json' file not found in package repository.";
            }

            installationError.stack = error.message;
            throw installationError;
        }
    }
}