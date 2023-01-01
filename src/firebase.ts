const _ = require("lodash");
const redisClient = require('ioredis').createClient();
const admin = require("firebase-admin");
const util = require('util');
require('dotenv').config();

admin.initializeApp({
    credential: admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS)
});

export class Firebase {
    public channel: string = null;
    public message: any;

    public defaultOptions: any = {
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
    public options: any;


    constructor(channel: string, message: any) {
        this.channel = channel;
        this.message = message;
        // this.message = message;
    }

    configurator(options: any): void {
        this.options = _.merge(this.defaultOptions, options);
    }

    async dispatch(): Promise<any> {
        // console.log(this.channel, this.message)
        let tokens = [];
        await redisClient.hget('fcm:' + this.message?.data?.clients, 'token').then(e => tokens.push(e))
        if (!tokens.length) return
        let options = {
            tokens,
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
            case 'finding-driver':
                Object.assign(options, {
                    notification: {
                        title: 'باربر پیدا شد',
                        body: `${this.message?.data?.driver?.vehicle} ${this.message?.data?.driver?.license_plate}`,
                    },
                })
                this.configurator(options)
                firebaseResponse = await admin.messaging().sendMulticast(this.options);
                break
            case 'transport-status':
                switch (this.message?.data?.status) {
                    case 'رسیدن به مبدا':
                        Object.assign(options, {
                            notification: {
                                title: 'باربر شما رسید',
                                body: 'کاربر گرامی باربر شما در مبدا منتظر است',
                            },
                        })
                        this.configurator(options)
                        firebaseResponse = await admin.messaging().sendMulticast(this.options);
                        break
                    case 'خاتمه یافته':
                        Object.assign(options, {
                            notification: {
                                title: 'بار تحویل داده شد',
                                body: 'کاربر گرامی بار شما با موفقیت به مقصد رسید',
                            },
                        })
                        this.configurator(options)
                        firebaseResponse = await admin.messaging().sendMulticast(this.options);
                        break
                    case 'مردود':
                        Object.assign(options, {
                            notification: {
                                title: 'سفارش شما رد شد',
                                body: `کاربر گرامی سفارش شما به دلیل ${this.message?.data?.reason} رد شد`,
                            },
                        })
                        this.configurator(options)
                        firebaseResponse = await admin.messaging().sendMulticast(this.options);
                        break
                }
                break;
            default:
                break;
        }
        if (typeof firebaseResponse === 'object') {
            if (firebaseResponse.failureCount > 0) {
                console.error("\x1b[41mfirebase an error occurred!\x1b[0m")
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
