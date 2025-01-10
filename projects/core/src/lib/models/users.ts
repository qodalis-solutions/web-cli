export type ICliUser = {
    /**
     * The id of the user
     */
    id: string;

    /**
     * The name of the user
     */
    name: string;

    /**
     * The email of the user
     */
    email: string;

    /**
     * The groups the user belongs to
     * @default []
     */
    groups?: string[];
};

export interface ICliUserSession {
    /**
     * The user associated with the session
     */
    user: ICliUser;

    /**
     * The data associated with the user session
     */
    data?: Record<string, any>;
}

export type CliAddUser = Omit<ICliUser, 'id'>;
