import {HttpSubscriber, RedisSubscriber, Subscriber} from './subscribers';
import {Channel} from './channels';
import {Server} from './server';
import {HttpApi} from './api';
import {Log} from './log';
import axios from 'axios'
import {Firebase} from './firebase'
import Redis from 'ioredis';

const packageFile = require('../package.json');
const {constants} = require('crypto');

/**
 * Echo server class.
 */
export class EchoServer {
    /**
     * Default server options.
     */
    public defaultOptions: any = {
        authHost: 'http://localhost',
        authEndpoint: '/broadcasting/auth',
        userEndpoint: '/api/user/me',
        clients: [],
        database: 'redis',
        databaseConfig: {
            redis: {},
            sqlite: {
                databasePath: '/database/laravel-echo-server.sqlite'
            },
            publishPresence: false
        },
        devMode: false,
        host: null,
        port: 6001,
        protocol: "http",
        socketio: {},
        secureOptions: constants.SSL_OP_NO_TLSv1,
        sslCertPath: '',
        sslKeyPath: '',
        sslCertChainPath: '',
        sslPassphrase: '',
        subscribers: {
            http: true,
            redis: true
        },
        apiOriginAllow: {
            allowCors: false,
            allowOrigin: '',
            allowMethods: '',
            allowHeaders: ''
        }
    };

    /**
     * Configurable server options.
     */
    public options: any;

    /**
     * Socket.io server instance.
     */
    private server: Server;

    /**
     * Channel instance.
     */
    private channel: Channel;

    /**
     * Subscribers
     */
    private subscribers: Subscriber[];

    /**
     * Http api instance.
     */
    private httpApi: HttpApi;

    /**
     * Redis pub/sub client.
     *
     * @type {object}
     */
    private _redis: any;

    /**
     * Create a new instance.
     */
    constructor() {
    }

    /**
     * Start the Echo Server.
     */
    run(options: any): Promise<any> {
        return new Promise((resolve) => {
            this.options = Object.assign(this.defaultOptions, options);
            this._redis = new Redis(this.options.databaseConfig.redis);
            this.startup();
            this.server = new Server(this.options);
            this.server.init().then(io => {
                this.init(io).then(() => {
                    Log.info('\nServer ready!\n');
                    resolve(this);
                }, error => Log.error(error));
            }, error => Log.error(error));
        });
    }

    /**
     * Initialize the class
     */
    init(io: any): Promise<any> {
        return new Promise((resolve) => {
            this.channel = new Channel(io, this.options);

            this.subscribers = [];
            if (this.options.subscribers.http)
                this.subscribers.push(new HttpSubscriber(this.server.express, this.options));
            if (this.options.subscribers.redis)
                this.subscribers.push(new RedisSubscriber(this.options));

            this.httpApi = new HttpApi(io, this.channel, this.server.express, this.options.apiOriginAllow);
            this.httpApi.init();

            this.onConnect();
            this.listen().then((e) => resolve(e), err => Log.error(err));
        });
    }

    /**
     * Text shown at startup.
     */
    startup(): void {
        Log.title(`\nL A R A V E L  E C H O  S E R V E R  B I - D I R E C T I O N A L\n`);
        Log.info(`version ${packageFile.version}\n`);

        if (this.options.devMode) {
            Log.warning('Starting server in DEV mode...\n');
        } else {
            Log.info('Starting server...\n')
        }
    }

    /**
     * Stop the echo server.
     */
    stop(): Promise<any> {
        Log.debug('Stopping the LARAVEL ECHO SERVER')
        let promises = [];
        this.subscribers.forEach(subscriber => {
            promises.push(subscriber.unsubscribe());
        });
        promises.push(this.server.io.close());
        return Promise.all(promises).then(() => {
            this.subscribers = [];
            Log.debug('The LARAVEL ECHO SERVER server has been stopped.')
        });
    }

    /**
     * Listen for incoming event from subscribers.
     */
    listen(): Promise<any> {
        return new Promise((resolve) => {
            let subscribePromises = this.subscribers.map(subscriber => {
                return subscriber.subscribe((channel, message) => {
                    new Firebase(channel, message, this.options).dispatch();
                    return this.broadcast(channel, message);
                });
            });
            Promise.all(subscribePromises).then((e) => resolve(e));
        });
    }

    /**
     * Return a channel by its socket id.
     */
    find(socket_id: string): any {
        return this.server.io.sockets.connected[socket_id];
    }

    /**
     * Broadcast events to channels from subscribers.
     */
    async broadcast(channel: string, message: any): Promise<boolean> {
        if (message.socket && this.find(message.socket)) {
            return this.toOthers(this.find(message.socket), channel, message);
        } else {
            return this.toAll(channel, message);
        }
    }

    /**
     * Broadcast to others on channel.
     */
    toOthers(socket: any, channel: string, message: any): boolean {
        socket.broadcast.to(channel)
            .emit(message.event, channel, message.data);

        return true
    }

    /**
     * Broadcast to all members on channel.
     */
    toAll(channel: string, message: any): boolean {
        this.server.io.to(channel)
            .emit(message.event, channel, message.data);

        return true
    }

    /**
     * On server connection.
     */
    onConnect(): void {
        this.server.io.use(async (socket: any, next: any): Promise<void> => {
            const bearer = socket?.handshake?.auth?.headers?.Authorization ?? socket?.handshake?.headers.authorization
            if (!!bearer) {
                try {
                    await axios({
                        method: 'get',
                        url: this.options.authHost + this.options.userEndpoint,
                        headers: {
                            Authorization: bearer
                        }
                    }).then(r => {
                        if (this.options.devMode) {
                            Log.debug(r.data)
                            socket.user = r.data
                        }
                    }).catch(e => {
                        if (this.options.devMode) {
                            Log.debug(e.message)
                        }
                    })
                    next();
                } catch (error) {
                    if (this.options.devMode) {
                        Log.debug(`Token is not valid! Unknown user rejected with socket id ${socket.id}`)
                        Log.debug(error);
                    }
                    next(new Error(error));
                }
            } else {
                if (this.options.devMode)
                    Log.debug(`Unknown user rejected with socket id ${socket.id}`)
                next(new Error(`Unknown user rejected with socket id ${socket.id}`));
            }
        }).on('connection', socket => {
            socket.on("disconnect", (reason) => {
                this._redis.hdel('users', socket.id)
                this._redis.hdel('sockets', socket.id)
                if (this.options.devMode)
                    Log.debug(`user disconnected: ${socket?.user?.name} with socket id : ${socket.id} and reason : ${reason}`)
            });
            if (this.options.devMode)
                Log.debug(`user connected: ${socket?.user?.name} with socket id : ${socket.id}`)
            this._redis.hset('users', socket.user.id, JSON.stringify(socket.user))
            this._redis.hset('sockets', socket.user.id, socket.id)
            this.onSubscribe(socket);
            this.onUnsubscribe(socket);
            this.onDisconnecting(socket);
            this.onClientEvent(socket);
            this.onPublish(socket);
            this.onHandleCoords(socket);
            this.onHandleTransportStatus(socket);
            this.onTicketRevoke(socket);
        });
    }

    /**
     * On subscribe to a channel.
     */
    onSubscribe(socket: any): void {
        socket.on('subscribe', data => {
            if (this.options.devMode)
                Log.debug(`${socket.user.name}  subscribing to channel: ${data.channel}`)
            this.channel.join(socket, data);
            if (this.options.devMode)
                Log.debug(`${socket.user.name}  subscribed to channel: ${data.channel}`)
        });
    }

    /**
     * On unsubscribe from a channel.
     */
    onUnsubscribe(socket: any): void {
        socket.on('unsubscribe', data => {
            this.channel.leave(socket, data.channel, 'unsubscribed');
            if (this.options.devMode)
                Log.debug(`user unsubscribed: ${socket?.user?.name} with socket id : ${socket.id}`)
        });
    }

    /**
     * On socket disconnecting.
     */
    onDisconnecting(socket: any): void {
        socket.on('disconnecting', reason => {
            Object.keys(socket.rooms).forEach(room => {
                if (room !== socket.id) {
                    this.channel.leave(socket, room, reason);
                }
            });
            if (this.options.devMode)
                Log.debug(`user disconnecting: ${socket?.user?.name} with socket id : ${socket.id} and reason : ${reason}`)
        });
    }

    /**
     * On client events.
     */
    onClientEvent(socket: any): void {
        socket.on('client event', data => {
            if (this.options.devMode)
                Log.debug(`client event: ${data}`)
            this.channel.clientEvent(socket, data);
        });
    }

    /**
     * On publish to a channel
     */
    onPublish(socket: any): void {
        socket.on("transport-list", data => {
            if (this.options.devMode)
                Log.debug(`transport-list: ${data}`);
            this._redis.publish(data?.channel, JSON.stringify(data?.body))
        })
    }

    onHandleCoords(socket: any): void {
        socket.on("transport-coords", data => {
            if (this.options.devMode)
                Log.debug(data)
            socket.to(data?.channel).emit('transport-coords', data?.body?.data)
            this._redis.rpush('coords:' + data?.body?.data?.transport_id, JSON.stringify(data?.body?.data?.coords))
        })
    }

    onHandleTransportStatus(socket: any): void {
        socket.on("transport-status", data => {
            if (data?.body?.data?.status === 'finished') {
                this._redis.publish(data?.channel, JSON.stringify(data?.body))
            }
        })
    }

    onTicketRevoke(socket: any): void {
        socket.on("revoke-ticket", message => {
            if (this.options.devMode)
                Log.debug(message)
            message.body.user = socket.user;
            this._redis.publish(message?.channel, JSON.stringify(message?.body))
        })
    }
}
