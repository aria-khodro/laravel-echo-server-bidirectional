import {Log} from '../log';
import {Subscriber} from './subscriber';
import Redis from "ioredis";

export class RedisSubscriber implements Subscriber {
    /**
     * Redis pub/sub client.
     *
     * @type {object}
     */
    private _redis: any;


    // تعریف متغیر نماینده نمونه یکتا
    private static instance: RedisSubscriber;
    /**
     *
     * KeyPrefix for used in the redis Connection
     *
     * @type {String}
     */
    private _keyPrefix: string;

    /**
     * Create a new instance of subscriber.
     *
     * @param {any} options
     */
    constructor(private options) {
        this._keyPrefix = options.databaseConfig.redis.keyPrefix || '';
        if (!this._redis){

        this._redis = new Redis(options.databaseConfig.redis);
        }
    }



    /**
     * Subscribe to events to broadcast.
     *
     * @return {Promise<any>}
     */
    subscribe(callback): Promise<any> {
        return new Promise((resolve, reject) => {
            console.log(123456789)
            this._redis.on('pmessage', (subscribed, channel, message) => {
                try {
                    message = JSON.parse(message);
                    if (this.options.devMode) {
                        Log.info("Channel: " + channel);
                        Log.info("Event: " + message?.event ?? 'No Event Present');
                        Log.info("Data: " + JSON.stringify(message?.data, null, 4) ?? 'No Data Present');
                    }
                    callback(channel.substring(this._keyPrefix.length), message);
                } catch (e) {
                    if (this.options.devMode) {
                        Log.info("No JSON message");
                    }
                }
            });

            this._redis.psubscribe(`${this._keyPrefix}*`, (err) => {
                if (err) {
                    reject('Redis could not subscribe.')
                }

                Log.success('Listening for redis events...');

                resolve(this);
            });
        });
    }

    /**
     * Unsubscribe from events to broadcast.
     *
     * @return {Promise}
     */
    unsubscribe(): Promise<any> {
        return new Promise((resolve, reject) => {
            try {

                this._redis.disconnect();
                resolve(this);
            } catch (e) {
                reject('Could not disconnect from redis -> ' + e);
            }
        });
    }
}
