import Redis from "ioredis";

class RedisClientManager {
    private static _redisClient: Redis = null;

    static getClient(databaseConfig: any): any {
        if (!this._redisClient) {
            this._redisClient = new Redis(databaseConfig);
        }
        return this._redisClient;
    }

    static async closeClient(): Promise<void> {
        if (this._redisClient) {
            await this._redisClient.quit();
            this._redisClient = null;
        }
    }
}

export default RedisClientManager;
