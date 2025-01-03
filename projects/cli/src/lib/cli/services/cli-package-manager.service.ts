import { Injectable } from '@angular/core';
import { Package } from '@qodalis/cli-core';

@Injectable({
    providedIn: 'root',
})
export class CliPackageManagerService {
    private readonly storageKey = 'cliPackages';

    public QODALIS_COMMAND_PREFIX = '@qodalis/cli-';

    constructor() {}

    /**
     * Retrieves the list of packages from localStorage.
     * @returns {Package[]} Array of packages
     */
    getPackages(): Package[] {
        const packages = localStorage.getItem(this.storageKey);
        return packages ? JSON.parse(packages) : [];
    }

    /**
     * Retrieves a package by name from the list.
     * @param packageName {string} The name of the package to retrieve
     * @returns {Package | undefined} The package if found, undefined otherwise
     */
    getPackage(packageName: string): Package | undefined {
        return this.getPackages().find(
            (p) =>
                p.name === packageName ||
                p.name === this.QODALIS_COMMAND_PREFIX + packageName,
        );
    }

    /**
     * Checks if a package with the given name exists in the list.
     * @param packageName {string} The name of the package to check
     * @returns {boolean} True if the package exists, false otherwise
     */
    hasPackage(packageName: string): boolean {
        return this.getPackage(packageName) !== undefined;
    }

    /**
     * Adds a new package to the list and saves it in localStorage.
     * @param pkg {Package} The package to add
     */
    addPackage(pkg: Package): void {
        const packages = this.getPackages();
        if (packages.find((p) => p.name === pkg.name)) {
            throw new Error(`Package with name "${pkg.name}" already exists.`);
        }
        packages.push(pkg);
        this.savePackages(packages);
    }

    /**
     * Removes a package by name and saves the updated list in localStorage.
     * @param packageName {string} The name of the package to remove
     */
    removePackage(packageName: string): Package {
        const packages = this.getPackages();
        const packageToRemove = packages.find(
            (p) =>
                p.name === packageName ||
                p.name === this.QODALIS_COMMAND_PREFIX + packageName,
        );

        if (!packageToRemove) {
            throw new Error(`Package with name "${packageName}" not found.`);
        }

        const updatedPackages = packages.filter(
            (p) => p.name !== packageToRemove.name,
        );

        if (packages.length === updatedPackages.length) {
            throw new Error(`Package with name "${packageName}" not found.`);
        }

        this.savePackages(updatedPackages);

        return packageToRemove!;
    }

    /**
     * Updates an existing package in the list and saves the updated list in localStorage.
     * @param pkg {Package} The updated package
     * @throws {Error} If the package to update is not found
     * @returns {void}
     * @throws {Error} If the package to update is not found
     * @returns {void}
     */
    updatePackage(pkg: Package): void {
        const packages = this.getPackages();
        const index = packages.findIndex((p) => p.name === pkg.name);
        if (index === -1) {
            throw new Error(`Package with name "${pkg.name}" not found.`);
        }
        packages[index] = pkg;
        this.savePackages(packages);
    }

    /**
     * Saves the list of packages to localStorage.
     * @param packages {Package[]} The list of packages to save
     */
    private savePackages(packages: Package[]): void {
        localStorage.setItem(this.storageKey, JSON.stringify(packages));
    }
}
