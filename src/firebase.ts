const _ = require("lodash");
const redisClient = require('ioredis').createClient();
import * as admin from 'firebase-admin';

const util = require('util');
require('dotenv').config();

const userServiceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS_COM_ARIA);
const corporateServiceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS_COM_ARIACORPORATE);

const user = admin.initializeApp({
    credential: admin.credential.cert(userServiceAccount)
}, 'user');

const corporate = admin.initializeApp({
    credential: admin.credential.cert(corporateServiceAccount)
}, 'corporate');

export class Firebase {
    public channel: string = null;
    public message: any;

    public defaultUserOptions: any = {
        tokens: [],
        notification: {
            title: '',
            body: '',
        },
        data: {
            screen: 'CargoHomeScreen',
            channel: '',
        },
        android: {
            notification: {
                icon: 'ic_small_icon',
                color: '#12163a',
                channelId: 'transport',
                tag: '',
                sound: 'default',
            }
        },
    }

    public defaultCourierOptions: any = {
        tokens: [],
        notification: {
            title: '',
            body: '',
        },
        data: {
            screen: 'HomeScreen',
            channel: '',
        },
        android: {
            notification: {
                icon: 'ic_small_icon',
                color: '#b2eeff',
                channelId: 'order',
                tag: '',
                sound: 'default',
            }
        },
    }

    public options: any;


    constructor(channel: string, message: any) {
        this.channel = channel;
        this.message = message;
    }

    configurator(options: any, type: string): void {
        switch (type) {
            case 'user':
                this.options = _.merge(this.defaultUserOptions, options);
                break;
            case 'courier':
                this.options = _.merge(this.defaultCourierOptions, options);
        }
    }

    async redisScanner(pattern: string): Promise<any> {
        let cursor = 0;
        let result = [];
        do {
            const data = await redisClient.scan(cursor, 'MATCH', pattern);
            cursor = data[0];
            result.push(...data[1])
        } while (cursor != 0)
        if (!result.length) return []
        return redisClient.mget(result);
    }

    async dispatch(): Promise<any> {
        let tokens = [];
        let options = {
            tokens: [],
            data: {
                channel: this.channel,
            },
            android: {
                notification: {
                    tag: this.channel,
                }
            },
        }
        let firebaseResponse;
        switch (this.message?.event) {
            case 'finding-courier':
                tokens = await this.redisScanner('fcm:user:' + this.message.data.clients + '*');
                if (!tokens.length) return
                console.log(tokens)
                Object.assign(options, {
                    notification: {
                        title: 'باربر پیدا شد',
                        body: this.message?.data?.courier?.vehicle + ' ' + this.message?.data?.courier?.license_plate,
                    },
                    tokens
                })
                this.configurator(options, 'user')
                firebaseResponse = await user.messaging().sendMulticast(this.options);
                break
            case 'transport-status':
                tokens = await this.redisScanner('fcm:user:' + this.message.data.clients + '*');
                if (!tokens.length) return
                console.log(tokens)
                options.tokens = tokens;
                switch (this.message?.data?.status) {
                    case 'رسیدن به مبدا':
                        Object.assign(options, {
                            notification: {
                                title: 'باربر شما رسید',
                                body: 'کاربر گرامی باربر شما در مبدا منتظر است',
                            },
                        })
                        this.configurator(options, 'user')
                        firebaseResponse = await user.messaging().sendMulticast(this.options);
                        break
                    case 'خاتمه یافته':
                        Object.assign(options, {
                            notification: {
                                title: 'بار تحویل داده شد',
                                body: 'کاربر گرامی بار شما با موفقیت به مقصد رسید',
                            },
                        })
                        this.configurator(options, 'user')
                        firebaseResponse = await user.messaging().sendMulticast(this.options);
                        break
                    case 'مردود':
                        Object.assign(options, {
                            notification: {
                                title: 'سفارش شما رد شد',
                                body: `کاربر گرامی سفارش شما به دلیل ${this.message?.data?.reason} رد شد`,
                            },
                        })
                        this.configurator(options, 'user')
                        firebaseResponse = await user.messaging().sendMulticast(this.options);
                        break
                }
                break;
            // case 'transport-incoming':
            case 'transport-courier-incoming':
                tokens = await this.redisScanner('fcm:corporate:*');
                if (!tokens.length) return
                console.log(tokens)
                Object.assign(options, {
                    notification: {
                        title: 'سفارش جدید!',
                        body: `سفارش به شماره ${this.message?.data?.transport?.order_no} به مبلغ ${this.message?.data?.transport?.total}`,
                    },
                    tokens
                })
                this.configurator(options, 'courier')
                console.log(this.options)
                firebaseResponse = await corporate.messaging().sendMulticast(this.options);

                break;
            default:
                break;
        }
        if (typeof firebaseResponse === 'object') {
            if (firebaseResponse.failureCount > 0) {
                console.error(`\x1b[41m${firebaseResponse.responses[0].error}\x1b[0m`)
                console.error(util.inspect(firebaseResponse, true, null, true))
                const failedTokens = [];
                firebaseResponse.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        failedTokens.push(this.options.tokens[idx]);
                    }
                });
                console.log('List of tokens that caused failures:');
                failedTokens.map((token, index) => console.log(`Failed token ${index + 1}: ` + token))
            } else {
                console.log(firebaseResponse)
            }
        }
    }

}
