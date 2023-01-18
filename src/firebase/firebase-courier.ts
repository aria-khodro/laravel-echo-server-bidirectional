export interface FirebaseCourier {
    configurator(options: object): void;

    dispatch(): Promise<any>;
}
