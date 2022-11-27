import { Log } from '../log';
import { Subscriber } from './subscriber';

export class HttpSubscriber implements Subscriber {
    /**
     * Create new instance of http subscriber.
     *
     * @param  {any} express
     * @param options
     */
    constructor(private express, private options) { }

    /**
     * Subscribe to events to broadcast.
     *
     * @return {void}
     */
    subscribe(callback): Promise<any> {
        return new Promise((resolve) => {
            // Broadcast a message to a channel
            this.express.post('/apps/:appId/events', (req, res) => {
                let body: any = [];
                res.on('error', (error) => {
                    if (this.options.devMode) {
                        Log.error(error);
                    }
                });

                req.on('data', (chunk) => body.push(chunk))
                    .on('end', () => this.handleData(req, res, body, callback));
            });

            Log.success('Listening for http events...');

            resolve(this);
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
                this.express.post('/apps/:appId/events', (req, res) => {
                    res.status(404).send();
                });
                resolve(this);
            } catch(e) {
                reject('Could not overwrite the event endpoint -> ' + e);
            }
        });
    }

    /**
     * Handle incoming event data.
     *
     * @param  {any} req
     * @param  {any} res
     * @param  {any} body
     * @param  {Function} broadcast
     * @return {boolean}
     */
    handleData(req, res, body, broadcast): boolean {
        body = JSON.parse(Buffer.concat(body).toString());

        if ((body.channels || body.channel) && body.name && body.data) {

            let data = body.data;
            try {
                data = JSON.parse(data);
            } catch (e) { }

            let message = {
                event: body.name,
                data: data,
                socket: body.socket_id
            }
            let channels = body.channels || [body.channel];

            if (this.options.devMode) {
                Log.info("Channel: " + channels.join(', '));
                Log.info("Event: " + message.event);
                Log.info("Data: " + data);
            }

            channels.forEach(channel => broadcast(channel, message));
        } else {
            return this.badResponse(
                req,
                res,
                'Event must include channel, event name and data'
            );
        }

        res.json({ message: 'ok' })
    }

    /**
     * Handle bad requests.
     *
     * @param  {any} req
     * @param  {any} res
     * @param  {string} message
     * @return {boolean}
     */
    badResponse(req: any, res: any, message: string): boolean {
        res.statusCode = 400;
        res.json({ error: message });

        return false;
    }
}
