export interface FirebaseDriver {
    configurator(options: object): void;

    dispatch(): Promise<any>;
}
