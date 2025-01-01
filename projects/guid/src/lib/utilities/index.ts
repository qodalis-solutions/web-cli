export const generateGUID = (): string => {
    // Generate a GUID in the format of xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
        const random = (Math.random() * 16) | 0; // Random integer between 0 and 15
        const value = char === 'x' ? random : (random & 0x3) | 0x8; // Ensure 'y' starts with 8, 9, A, or B
        return value.toString(16); // Convert to hexadecimal
    });
};

export const validateGUID = (guid: string): boolean => {
    // Regular expression to match a valid GUID format
    const guidRegex =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    return guidRegex.test(guid);
};
